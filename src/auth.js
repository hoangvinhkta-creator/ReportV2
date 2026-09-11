/* Xác minh danh tính người gọi ở PHÍA MÁY CHỦ — LUẬT SỐ 1 của CLAUDE.md bắt
 * đầu từ đây: trình duyệt không bao giờ tự xưng "tôi là quản trị", chỉ có
 * chữ ký Firebase kiểm được ở đây mới nói lên điều đó.
 *
 * Logic kiểm token sao lại gần nguyên văn từ Worker `tracking` (src/auth.js)
 * — cùng một Firebase project nên cùng một cách kiểm chữ ký, chép hai bản là
 * sớm muộn hai bản lệch nhau. Phần RIÊNG của Reports là `vaiBaoCao()`: hai
 * vai `quantri`/`quanly` (CLAUDE.md), không phải bộ quyền chi tiết của
 * Tracking.
 */
import { docDb } from './firebase.js';

const JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const LECH_GIAY = 60;

let _khoa = { ds: null, het: 0 };

/** Lấy khoá công khai, có nhớ đệm theo đúng Cache-Control của Google. */
async function layKhoa(epLayLai) {
  const gio = Date.now();
  if (!epLayLai && _khoa.ds && _khoa.het > gio) return _khoa.ds;

  const r = await fetch(JWK_URL);
  if (!r.ok) {
    // KHÔNG dùng khoá cũ quá hạn để "cho chạy tạm" — lấy khoá hỏng thì từ
    // chối hẳn, không bao giờ fail-open.
    throw new LoiXacThuc(503, "khong-lay-duoc-khoa");
  }
  const j = await r.json();
  const cc = r.headers.get("cache-control") || "";
  const m = cc.match(/max-age=(\d+)/);
  const song = Math.min(m ? +m[1] : 3600, 86400) * 1000;
  _khoa = { ds: j.keys || [], het: gio + song };
  return _khoa.ds;
}

/** Lỗi có mã HTTP đi kèm. `ly` là mã NGẮN cho log, không phải câu hiển thị
 *  cho người dùng — người gọi tự dịch sang câu tử tế. */
export class LoiXacThuc extends Error {
  constructor(ma, ly) { super(ly); this.ma = ma; this.ly = ly; }
}

const b64urlToBytes = (s) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

/**
 * Kiểm một Firebase ID token. Trả { uid, email } hoặc ném LoiXacThuc.
 * `projectId` phải là hằng của mình, KHÔNG lấy từ token.
 */
export async function xacMinhToken(token, projectId) {
  if (!token) throw new LoiXacThuc(401, "thieu-token");
  const phan = String(token).split(".");
  if (phan.length !== 3) throw new LoiXacThuc(401, "token-sai-dinh-dang");

  let dau, claim;
  try {
    dau = b64urlToJson(phan[0]);
    claim = b64urlToJson(phan[1]);
  } catch (e) { throw new LoiXacThuc(401, "token-giai-ma-hong"); }

  // CHỐT CHẶN QUAN TRỌNG NHẤT: chỉ nhận RS256 — chặn cả alg:"none" (bỏ chữ
  // ký) lẫn đòn đổi sang HS256 rồi ký bằng chính KHOÁ CÔNG KHAI (ai cũng có).
  if (dau.alg !== "RS256") throw new LoiXacThuc(401, "alg-khong-cho-phep");
  if (!dau.kid) throw new LoiXacThuc(401, "thieu-kid");

  let ds = await layKhoa(false);
  let k = ds.find((x) => x.kid === dau.kid);
  // Không thấy kid: rất có thể Google vừa xoay khoá. Lấy lại MỘT lần rồi mới
  // chịu thua — không thì mỗi lần Google xoay khoá là cả công ty đứng ngoài
  // cửa cho tới khi hết hạn nhớ đệm.
  if (!k) {
    ds = await layKhoa(true);
    k = ds.find((x) => x.kid === dau.kid);
  }
  if (!k) throw new LoiXacThuc(401, "kid-khong-biet");

  const ck = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["verify"]
  );
  const duLieu = new TextEncoder().encode(phan[0] + "." + phan[1]);
  const chuKy = b64urlToBytes(phan[2]);
  const chuKyDung = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", ck, chuKy, duLieu);
  if (!chuKyDung) throw new LoiXacThuc(401, "chu-ky-sai");

  // Chữ ký đúng mới xét tới nội dung — đọc claim của một token chưa kiểm chữ
  // ký là đọc thứ do người lạ viết ra.
  const gio = Math.floor(Date.now() / 1000);
  if (claim.aud !== projectId) throw new LoiXacThuc(401, "aud-sai");
  if (claim.iss !== "https://securetoken.google.com/" + projectId)
    throw new LoiXacThuc(401, "iss-sai");
  if (!(Number(claim.exp) > gio - LECH_GIAY)) throw new LoiXacThuc(401, "token-het-han");
  if (!(Number(claim.iat) <= gio + LECH_GIAY)) throw new LoiXacThuc(401, "iat-tuong-lai");
  if (claim.auth_time !== undefined &&
      !(Number(claim.auth_time) <= gio + LECH_GIAY))
    throw new LoiXacThuc(401, "auth-time-tuong-lai");
  if (!claim.sub || typeof claim.sub !== "string")
    throw new LoiXacThuc(401, "thieu-sub");

  return { uid: claim.sub, email: claim.email || "" };
}

/** Rút token khỏi header. Chỉ nhận đúng khuôn `Bearer <token>`. */
export function tokenTuHeader(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : null;
}

/**
 * Xác thực đầy đủ: token hợp lệ VÀ có hồ sơ trong database.
 *
 * Hai bước tách bạch, cố ý. Token hợp lệ chỉ chứng minh "Firebase biết người
 * này"; bất kỳ ai cũng tự đăng ký được một tài khoản Firebase. Có hồ sơ ở
 * `profiles/<uid>` mới là "được công ty cấp quyền vào" — hồ sơ này DÙNG
 * CHUNG với Tracking và Marketing, Reports không có bảng người dùng riêng.
 *
 * Trả { uid, email, name, perms }. Ném LoiXacThuc nếu không qua.
 */
export async function xacThuc(request, env) {
  const projectId = env.FB_PROJECT_ID || "tinphattracking";
  const nguoi = await xacMinhToken(tokenTuHeader(request), projectId);

  const hs = await docDb("profiles/" + nguoi.uid, env);
  if (!hs.ok) throw new LoiXacThuc(503, "khong-doc-duoc-ho-so:" + hs.ma);
  if (!hs.val) throw new LoiXacThuc(403, "chua-co-ho-so");

  return {
    uid: nguoi.uid,
    email: hs.val.email || nguoi.email,
    name: hs.val.name || "",
    perms: hs.val.perms || {},
  };
}

/**
 * Vai của người này TRONG Báo cáo — chỉ hai giá trị CLAUDE.md công nhận,
 * đọc thẳng từ `perms` dùng chung. `quantri` bao trùm `quanly`, giống cách
 * `admin` bao trùm mọi quyền khác bên Tracking — hai nơi hiểu khác nhau là
 * nguồn lỗi kinh điển nên giữ cùng nếp.
 *
 * Trả "quantri" | "quanly" | null. So sánh CHẶT bằng `=== true`: client gửi
 * "true" (chuỗi) trong một trường nào đó của hồ sơ không được coi là cấp
 * quyền.
 */
export function vaiBaoCao(nguoi) {
  const p = (nguoi && nguoi.perms) || {};
  if (p.quantri === true) return "quantri";
  if (p.quanly === true) return "quanly";
  return null;
}

/** Đòi có vai báo cáo (quantri hoặc quanly). Ném LoiXacThuc 403 nếu không. */
export function doiVaiBaoCao(nguoi) {
  const vai = vaiBaoCao(nguoi);
  if (!vai) throw new LoiXacThuc(403, "chua-co-quyen-bao-cao");
  return vai;
}
