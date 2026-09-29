/* Đọc đơn hàng từ Firebase CỦA CRM — đối chiếu CRM ↔ sổ, 28/09/2026.
 *
 * CRM nằm trên một project Firebase KHÁC (`tinphatcrm-b71e7`), không phải
 * project Tracking/Marketing mà mọi thứ khác của Report dùng. Nên có một
 * tài khoản dịch vụ riêng (`CRM_SA_EMAIL`/`CRM_SA_KEY`), chỉ nằm ở secret,
 * và chỉ ĐỌC: file này không có đường ghi nào sang CRM, cố ý.
 *
 * Gateway vẫn là nơi DUY NHẤT chạm Firebase (CLAUDE.md) — trình duyệt không
 * bao giờ nối thẳng sang CRM.
 *
 * Nghiệp vụ (ghép, so, đơn vị tiền) KHÔNG nằm ở đây — ở
 * `engine/src/doi-chieu-crm.mjs`. File này chỉ làm ba việc: tra theo kế
 * hoạch Engine đưa, lọc bớt trường, và trả lỗi rõ ràng khi không đọc được.
 */
import { fbToken } from "./firebase.js";

export const CRM_DB_MAC_DINH =
  "https://tinphatcrm-b71e7-default-rtdb.asia-southeast1.firebasedatabase.app";

/** Lỗi đọc CRM. `ly` là mã ngắn cho nhật ký và cho băng cảnh báo — màn
 *  hình nói thẳng "chưa đối chiếu được CRM", không im lặng như thể mọi đơn
 *  đều khớp (CLAUDE.md: nguồn hỏng thì BÁO LỖI, không trả rỗng). */
export class LoiCrm extends Error {
  constructor(ly) { super(ly); this.ly = ly; }
}

/* DANH SÁCH TRẮNG các trường được mang qua Gateway. Đơn CRM còn tên, SĐT,
 * địa chỉ khách (`cusName`, `cusPhone`, `cusAddr`, `addr`, `note`…) — Report
 * không cần một chữ nào trong đó để so SL và tiền, nên chúng dừng ở đây,
 * không đi tiếp sang Engine hay ra trình duyệt. Danh sách TRẮNG chứ không
 * ĐEN: CRM thêm một trường nhạy cảm mới sau này thì nó tự bị bỏ lại. */
const TRUONG_DON = ["misa", "owner", "status", "discount", "expectDeliver", "created",
  "item", "qty", "unitPrice", "unitCost", "price", "costPrice"];
/* `supplier` = nơi nhập nhân viên khai bên CRM (chủ dự án cần nó cạnh giá
   nhập lệch, 29/09/2026). Là tên nhà cung cấp, không phải thông tin khách. */
const TRUONG_DONG = ["item", "qty", "unitPrice", "unitCost", "misaName", "misaCode", "supplier"];

function chon(o, truong) {
  const ra = {};
  for (const k of truong) if (o[k] !== undefined && o[k] !== null) ra[k] = o[k];
  return ra;
}

export function locDon(od) {
  if (!od || typeof od !== "object") return null;
  const ra = chon(od, TRUONG_DON);
  if (od.lines && typeof od.lines === "object") {
    const ds = Array.isArray(od.lines) ? od.lines
      : Object.keys(od.lines).sort((a, b) => Number(a) - Number(b)).map((k) => od.lines[k]);
    ra.lines = ds.filter((l) => l && typeof l === "object").map((l) => chon(l, TRUONG_DONG));
  }
  return ra;
}

async function tra(env, tok, duong, truyVan) {
  const goc = (env.CRM_DB_URL || CRM_DB_MAC_DINH).replace(/\/+$/, "");
  const url = goc + "/" + duong + ".json" + (truyVan ? "?" + truyVan : "");
  let r;
  try {
    r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
  } catch (e) {
    throw new LoiCrm("crm-mang-loi");
  }
  /* 400 ở một lượt `orderBy` gần như luôn là "Index not defined" — rules
     của CRM chưa có `.indexOn` cho trường ấy. Tách mã riêng để nhật ký nói
     thẳng việc phải làm, không phải đoán từ một con số HTTP. */
  if (r.status === 400 && truyVan) throw new LoiCrm("crm-thieu-index");
  if (!r.ok) throw new LoiCrm("crm-tu-choi:" + r.status);
  try {
    return await r.json();
  } catch (e) {
    throw new LoiCrm("crm-tra-rac");
  }
}

const q = (o) => Object.keys(o).map((k) => k + "=" + encodeURIComponent(JSON.stringify(o[k]))).join("&");

/** Đọc đơn CRM theo kế hoạch của Engine (`keHoachCrm`).
 *
 *  Trả { don: { <id>: đơn đã lọc }, nguoi: { <id>: tên }, dau } — `dau` là
 *  dấu vân của đúng dữ liệu vừa đọc, để lượt hỏi định kỳ của màn hình biết
 *  CRM có đổi gì không mà không phải dựng lại cả bảng. Ném `LoiCrm`. */
export async function docDonCrm(env, keHoach) {
  if (!keHoach || !keHoach.co) return { don: {}, nguoi: {}, dau: "khong-ap-dung" };
  if (!env.CRM_SA_EMAIL || !env.CRM_SA_KEY) throw new LoiCrm("crm-thieu-service-account");
  const tok = await fbToken(env, null, { email: env.CRM_SA_EMAIL, key: env.CRM_SA_KEY });
  if (!tok) throw new LoiCrm("crm-khong-lay-duoc-token");

  /* Ba loại lượt tra, đi SONG SONG:
       · theo `misa` trong từng khoảng số BH của sổ — ghép chiều xuôi;
       · theo `expectDeliver` và `created` trong tháng — chiều ngược (đơn
         CRM có mà sổ không, kể cả đơn chưa có số BH). `created` bù cho đơn
         không có ngày giao: CRM gõ vào MISA `expectDeliver || created`.
     Cả ba cần `.indexOn` trên `orders` bên rules CRM. */
  const luot = keHoach.khoang.map(([a, b]) =>
    tra(env, tok, "orders", q({ orderBy: "misa", startAt: a, endAt: b })));
  luot.push(tra(env, tok, "orders", q({ orderBy: "expectDeliver", startAt: keHoach.tu, endAt: keHoach.den })));
  luot.push(tra(env, tok, "orders", q({ orderBy: "created", startAt: keHoach.tu, endAt: keHoach.den })));
  luot.push(tra(env, tok, "users"));
  const kq = await Promise.all(luot);
  const users = kq.pop() || {};
  const theoTao = kq.pop() || {};

  const don = {};
  for (const phan of kq) {
    for (const id of Object.keys(phan || {})) {
      const d = locDon(phan[id]);
      if (d) don[id] = d;
    }
  }
  /* Tra theo `created` chỉ để bắt đơn KHÔNG có ngày giao — đơn có ngày giao
     ở tháng khác mà tạo trong tháng này không thuộc kỳ này. */
  for (const id of Object.keys(theoTao)) {
    const od = theoTao[id];
    if (!od || typeof od !== "object" || od.expectDeliver) continue;
    const d = locDon(od);
    if (d) don[id] = d;
  }

  /* `users` bên CRM còn email, vai, thiết bị — chỉ lấy đúng cái tên. */
  const nguoi = {};
  for (const id of Object.keys(users)) {
    const u = users[id];
    if (u && typeof u === "object" && typeof u.name === "string") nguoi[id] = u.name;
  }

  const sapXep = (o) => Object.keys(o).sort().map((k) => [k, o[k]]);
  const byte = new TextEncoder().encode(JSON.stringify([sapXep(don), sapXep(nguoi)]));
  const bam = new Uint8Array(await crypto.subtle.digest("SHA-256", byte));
  const dau = [...bam.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { don, nguoi, dau };
}
