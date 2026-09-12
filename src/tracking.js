/* ĐƯỜNG SANG TRACKING — bảng giá, bảng gộp mã, bản đồ phân loại.
 *
 * Đây là NƠI DUY NHẤT của Gateway nói chuyện với Tracking, và là nơi duy
 * nhất khoá `X-Report-Key` xuất hiện. Engine không biết gì về khoá này:
 * Gateway đi lấy, Engine chỉ tính (LUẬT SỐ 1 — Engine là nghiệp vụ thuần,
 * và một khoá bí mật nằm trong Worker nghiệp vụ là một chỗ để quên).
 *
 * Khoá đi ở HEADER, không bao giờ trên URL: khoá trên URL lọt vào log máy
 * chủ, lịch sử trình duyệt và `Referer`. Cùng lý do Tracking đã chọn header
 * cho `/api/xuat/` và `/api/min-ngay`.
 *
 * ── FAIL CLOSED, KHÔNG BAO GIỜ TRẢ RỖNG ──
 *
 * Đọc hỏng thì NÉM LỖI. Một bảng giá rỗng đọc lên bên này thành "không mã
 * nào khớp được", và câu đó là một KẾT LUẬN NGHIỆP VỤ chứ không phải một sự
 * cố mạng (CLAUDE.md). Chính Tracking cũng trả 502 chứ không trả `200 {}`
 * cho đúng ca này — hai bên cùng một kỷ luật.
 *
 * `inv_map` rỗng thì KHÁC và được nhận: "chưa ai phân loại dòng nào" là một
 * trạng thái thật, hợp lệ, của một hệ vừa bắt đầu.
 */

const MAC_DINH_GOC = "https://price.tinphatcrm.com";

/** Lỗi của đường sang Tracking. Tách một lớp riêng để chỗ gọi phân biệt
 *  được "Tracking không trả lời" với "Firebase không trả lời" — hai sự cố
 *  khác nhau, hai việc phải làm khác nhau. */
export class LoiTracking extends Error {
  constructor(ly) { super(ly); this.ly = ly; }
}

/* Bộ nhớ tạm cho BẢNG GIÁ và BẢNG GỘP MÃ — hai nhánh đổi theo tuần, không
 * theo phút, mà bảng giá thật có ~3.500 mã (≈400 KB mỗi lượt). Kéo lại trọn
 * bộ mỗi lần người dùng bấm sang tháng khác là trả tiền băng thông cho một
 * thứ gần như không đổi.
 *
 * `inv_map` CỐ Ý KHÔNG được nhớ tạm: nó là thứ người dùng vừa sửa xong ở
 * lượt bấm trước, và hiện lại bản cũ sau khi vừa gán mã là làm người ta
 * tưởng lượt gán vừa rồi trượt.
 *
 * Nhớ tạm nằm ở phạm vi module nên nó theo từng isolate của Worker và tự
 * biến mất — cố ý: đây là bộ đệm giảm tải, không phải nguồn sự thật. */
let _dem = null;              // { luc, board, alias }
const DEM_HAN = 60_000;

/** Xoá bộ đệm — gọi sau khi chính ta vừa làm bảng giá đổi. */
export function xoaDem() { _dem = null; }

function goc(env) {
  return String(env.TRACKING_URL || MAC_DINH_GOC).replace(/\/+$/, "");
}

async function goiTracking(env, duong, tuyChon) {
  const khoa = env.REPORT_API_KEY;
  /* Chưa đặt Secret thì đóng, không mở — và nói rõ là THIẾU CẤU HÌNH chứ
     không phải "Tracking hỏng", để người vận hành không đi tìm nhầm chỗ. */
  if (!khoa) throw new LoiTracking("thieu-report-api-key");

  let r;
  try {
    r = await fetch(goc(env) + duong, {
      ...tuyChon,
      headers: { "X-Report-Key": khoa, ...((tuyChon && tuyChon.headers) || {}) },
    });
  } catch (e) {
    throw new LoiTracking("khong-goi-duoc-tracking");
  }
  let than = null;
  try { than = await r.json(); } catch (e) { than = null; }
  if (!r.ok) throw new LoiTracking("tracking-tra-" + r.status
    + (than && than.ly ? ":" + than.ly : ""));
  return than;
}

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Ba nhánh Tracking mà phép khớp mã cần, đúng hình dạng `khop-ma.mjs` đợi.
 *
 *  Ném `LoiTracking` khi bảng giá không dùng được. KHÔNG bao giờ trả một bộ
 *  rỗng — xem đầu file. */
export async function docNguonTracking(env) {
  const con = _dem && (Date.now() - _dem.luc < DEM_HAN) ? _dem : null;

  /* `inv_map` luôn tươi; bảng giá và bảng gộp mã đi qua bộ đệm. Gọi song
     song những nhánh thật sự phải ra mạng. */
  const [board, alias, invMap] = await Promise.all([
    con ? con.board : goiTracking(env, "/api/xuat/board"),
    con ? con.alias : goiTracking(env, "/api/xuat/alias"),
    goiTracking(env, "/api/xuat/inv_map"),
  ]);

  if (!laObj(board) || !Object.keys(board).length)
    throw new LoiTracking("bang-gia-rong");

  const bangAlias = laObj(alias) && laObj(alias.map) ? alias.map : {};
  const bangPhanLoai = laObj(invMap) && laObj(invMap.map) ? invMap.map : {};

  if (!con) _dem = { luc: Date.now(), board, alias };
  return { board, alias: bangAlias, inv_map: bangPhanLoai };
}

/** Danh sách mã cho ô chọn của màn gán tay — CHỈ ba trường màn hình cần.
 *
 *  Dựng mới từ danh sách trắng chứ không chuyển tiếp nguyên văn thứ Tracking
 *  trả: hôm nay `/api/xuat/board` đã chiếu sạch giá vốn rồi, nhưng hợp đồng
 *  đó là của repo kia và có thể nới ra mà bên này không hay. Một danh sách
 *  trắng ở đây làm việc "bảng giá bên kia thêm trường" không bao giờ thành
 *  "Báo cáo vô tình đẩy trường mới ra trình duyệt". */
export async function docMaBangGia(env) {
  const { board } = await docNguonTracking(env);
  const ds = [];
  for (const ma of Object.keys(board)) {
    const row = board[ma];
    if (!laObj(row)) continue;
    /* `hang`/`nhom` đi kèm để màn hình vá được hai cột Hãng/Ngành hàng ngay
       tại chỗ sau khi gán, không phải tải lại cả bảng. */
    ds.push({ ma, ten: String(row.name || ma),
      hang: row.brand ?? null, nhom: row.category_label ?? null });
  }
  ds.sort((a, b) => (a.ten < b.ten ? -1 : a.ten > b.ten ? 1 : 0));
  return ds;
}

/** Ghi một quyết định phân loại sang Tracking.
 *
 *  Gửi `ten`, KHÔNG gửi khoá: Tracking tính khoá bằng chính `invKeyOfName()`
 *  của nó rồi dội lại, nên công thức khoá chỉ có một thẩm quyền. Chỗ gọi đối
 *  chiếu khoá dội về với khoá Engine tự tính — hai repo lệch công thức thì
 *  lộ ra ngay ở lượt ghi đầu, không phải lúc giá vốn đã sai.
 *
 *  Ba chốt (mã có thật, mã còn dùng, NB-2 dòng tồn đang hoạt động) nằm ở
 *  PHÍA TRACKING — bên này không chép lại, chỉ chuyển lời từ chối thành câu
 *  cho người đọc. */
export async function ghiPhanLoai(env, ten, ma) {
  const than = await goiTracking(env, "/api/inv-map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ten, ma }),
  });
  if (!laObj(than) || typeof than.khoa !== "string")
    throw new LoiTracking("tracking-tra-thieu-khoa");
  return { khoa: than.khoa, ma: than.ma };
}

/** Lời từ chối của Tracking → câu cho người dùng đọc.
 *
 *  Mỗi câu phải nói được BƯỚC TIẾP THEO, không chỉ nói "hỏng": người đang
 *  đứng trước bảng đơn hàng cần biết mình phải làm gì, và ba trong số này
 *  có việc rất cụ thể để làm. */
export function cauLoiPhanLoai(ly) {
  const s = String(ly || "");
  if (/dang-o-ton-kho/.test(s))
    return "Mặt hàng này đang có trong Tồn kho của Tracking. Hãy phân loại bên "
      + "màn Tồn kho để hệ thống tính lại giá vốn đúng chỗ.";
  if (/ma-khong-co-tren-bang-gia/.test(s))
    return "Mã này không còn trên bảng giá — chọn lại, hoặc thêm mã bên Bảng giá trước.";
  if (/ma-khong-dung-nua/.test(s))
    return "Mã này đã được xếp vào nhóm \"Không sử dụng\" bên Tracking — chọn mã khác.";
  if (/ten-khong-phan-loai-duoc/.test(s))
    return "Tên hàng này không có ký tự chữ-số nào để làm khoá — không phân loại được.";
  if (/thieu-report-api-key/.test(s))
    return "Chưa cấu hình khoá đọc Tracking cho máy chủ Báo cáo. Báo người quản trị.";
  return "Chưa ghi được sang Tracking. Thử lại sau ít phút.";
}
