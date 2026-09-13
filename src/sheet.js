/* Google Sheets — lớp nói chuyện với Google, và CHỈ thế.
 *
 * Không một phép tính tiền nào ở đây: Engine dựng sẵn từng ô
 * (`engine/src/day-sheet.mjs`), file này chỉ mang chúng đi và dịch lỗi của
 * Google ra việc-phải-làm.
 *
 * ─── XÁC THỰC: KHÔNG SECRET MỚI, KHÔNG BẬT LẠI API ────────────────────────
 * Dùng ĐÚNG service account đã có, đổi mỗi chuỗi `scope` — `fbToken()` đã
 * khoá bộ nhớ token theo scope sẵn từ P1 nên không phải sửa gì ở đó.
 *
 * Repo Marketing đã đi trước đường này (`src/sheet.js` bên đó, chạy thật từ
 * 21/08/2026) trên cùng project Firebase `tinphattracking`. Google Sheets API
 * bật theo PROJECT chứ không theo Worker hay theo service account, nên bên
 * này không phải bật lại. Việc duy nhất còn phải làm bằng tay là chia sẻ
 * từng file Sheet cho email của service account (`FB_SA_EMAIL`) — đó là
 * quyền của từng file, không liên quan gì tới việc API đã bật hay chưa.
 * Quên bước ấy thì Google trả 403, và `dichLoi()` dưới đây nói thẳng ra.
 */

import { fbToken } from "./firebase.js";

/* Cố ý KHÔNG gộp vào scope database: gộp là mọi lượt gọi Firebase từ đó mang
   theo cả quyền ghi Sheets. Hai việc, hai token. */
export const SCOPE_SHEETS = "https://www.googleapis.com/auth/spreadsheets";

const GOC = "https://sheets.googleapis.com/v4/spreadsheets/";

/* ─────────────── Link → (id, gid) ───────────────
 *
 * Chủ dự án dán NGUYÊN link trên thanh địa chỉ, dạng
 *   https://docs.google.com/spreadsheets/d/<id>/edit?…#gid=<gid>
 *
 * Đòi `#gid` chứ không chấp nhận link trần, và đây là chuyện mất dữ liệu chứ
 * không phải kén chọn: link trần thì phải đoán "chắc là tab đầu tiên", mà
 * mỗi lượt đẩy XOÁ TRẮNG dải A3:J/O3:S của tab đích. Đoán trượt một lần là
 * xoá sạch số liệu của một nhân viên khác, im lặng. Bắt dán đúng tab thì
 * không có gì để đoán.
 */
const RE_ID = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/;
const RE_GID = /[#?&]gid=(\d{1,20})\b/;

/**
 * Tách link Google Sheet thành `{ id, gid }`.
 * @returns {{id: string, gid: number}|{loi: string}}
 */
export function phanTichLink(link) {
  const s = typeof link === "string" ? link.trim() : "";
  if (!s) return { loi: "Chưa dán link." };
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(s)) {
    return { loi: "Link phải là một bảng tính Google (docs.google.com/spreadsheets/…)." };
  }
  const mi = s.match(RE_ID);
  if (!mi) return { loi: "Không thấy mã bảng tính trong link." };
  const mg = s.match(RE_GID);
  if (!mg) {
    return { loi: "Link thiếu #gid — mở ĐÚNG tab cần ghi rồi copy lại link "
      + "trên thanh địa chỉ (đuôi phải có dạng #gid=123456)." };
  }
  const gid = Number(mg[1]);
  if (!Number.isSafeInteger(gid) || gid < 0) return { loi: "Mã tab (gid) không hợp lệ." };
  return { id: mi[1], gid };
}

/** Lỗi có câu chữ dành cho người đọc — Gateway bắt và trả nguyên câu `vi`. */
export class LoiSheet extends Error {
  constructor(ma, vi) { super(vi); this.ma = ma; this.vi = vi; }
}

/** Câu lỗi của Google → việc phải làm.
 *
 *  403 và 404 là hai chỗ vấp gần như chắc chắn của lần chạy đầu, và câu
 *  nguyên văn của Google không nói được phải làm gì. Mã khác thì giữ ngắn —
 *  chi tiết vào nhật ký, không ra màn hình. */
function dichLoi(ma, than) {
  const t = String(than || "");
  if (ma === 403) {
    if (/SERVICE_DISABLED|has not been used in project|it is disabled/i.test(t)) {
      return "Google Sheets API chưa được bật cho project của service account. "
        + "Bật một lần trong Google Cloud Console rồi thử lại.";
    }
    return "Google từ chối (403) — nhiều khả năng file Sheet chưa được chia sẻ "
      + "cho service account. Mở file → Chia sẻ → dán email trong secret "
      + "FB_SA_EMAIL (xem ở Cloudflare) → quyền Editor.";
  }
  if (ma === 404) return "Không tìm thấy bảng tính — kiểm lại link đã dán.";
  if (ma === 401) return "Service account không xin được token. Kiểm FB_SA_EMAIL/FB_SA_KEY.";
  if (ma === 429) return "Google đang chặn vì quá nhiều lượt gọi. Thử lại sau ít phút.";
  return "Google trả lỗi " + ma + ".";
}

/** Một lượt gọi Sheets API, đã gắn token và đã dịch lỗi. */
async function goi(duong, opt, token, fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f(GOC + duong, {
    ...opt,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json",
               ...(opt && opt.headers) },
  });
  if (!r.ok) {
    const than = await r.text().catch(() => "");
    throw new LoiSheet(r.status === 403 || r.status === 404 ? 400 : 502,
                       dichLoi(r.status, than));
  }
  return r.json();
}

/** Tên tab (title) của một `gid`.
 *
 *  Phải hỏi Google: ký pháp A1 chỉ gọi tab bằng TÊN, không gọi bằng gid, còn
 *  người dùng thì chỉ có gid trong link. Xin đúng hai trường thay vì cả bảng
 *  tính — một file 58 tab trả về vài trăm KB metadata mà mình cần một chuỗi. */
export async function tenTabTheoGid(env, id, gid, opts = {}) {
  const token = opts.token || await fbToken(env, SCOPE_SHEETS);
  if (!token) throw new LoiSheet(503, "Chưa cấu hình service account.");
  /* Xin kèm KÍCH THƯỚC LƯỚI, không chỉ tên tab — xem `nongLuoi()` bên dưới:
     một tab Google Sheets mới chỉ có 1.000 dòng × 26 cột, mà Nội thành đo
     trên sổ thật là ~1.600 dòng một tháng. Hỏi gộp vào đúng lượt này thay vì
     mở thêm một lượt gọi nữa. */
  const j = await goi(encodeURIComponent(id)
    + "?fields=sheets(properties(sheetId%2Ctitle%2CgridProperties))", { method: "GET" },
    token, opts.fetchImpl);
  const ds = Array.isArray(j.sheets) ? j.sheets : [];
  for (const s of ds) {
    const p = s && s.properties;
    if (p && Number(p.sheetId) === Number(gid)) {
      const g = p.gridProperties || {};
      return { ten: String(p.title), token,
               so_dong_luoi: Number(g.rowCount) || 0,
               so_cot_luoi: Number(g.columnCount) || 0 };
    }
  }
  throw new LoiSheet(400, "Bảng tính không có tab nào mang mã gid=" + gid
    + " — có thể tab đã bị xoá, hoặc link lấy từ file khác.");
}

/* Cột cuối mình ghi là S — cột thứ 19. */
const COT_CAN = 19;

/**
 * Nới lưới của tab cho đủ chỗ TRƯỚC khi ghi.
 *
 * Một tab mới của Google Sheets là 1.000 dòng × 26 cột. Nội thành ~1.600
 * dòng/tháng, nên lượt đẩy đầu tiên vào một file mới sẽ đâm thẳng vào trần
 * lưới. Nới trước bằng `appendDimension` là dứt khoát và kiểm được, thay vì
 * trông chờ `values.update` tự nới — nó nới hay không tuỳ dạng dải, và "tuỳ"
 * là thứ không nên có giữa chủ dự án và bộ số tháng này.
 *
 * Chỉ nới, không bao giờ THU HẸP: dòng thừa dưới cùng thì vô hại, còn thu
 * hẹp là xoá mất thứ chủ dự án để bên dưới mà mình không hề biết.
 */
async function nongLuoi(id, gid, { soDongCan, soDongLuoi, soCotLuoi }, token, fetchImpl) {
  const yeuCau = [];
  if (soDongLuoi && soDongCan > soDongLuoi) {
    yeuCau.push({ appendDimension: {
      sheetId: gid, dimension: "ROWS", length: soDongCan - soDongLuoi } });
  }
  if (soCotLuoi && soCotLuoi < COT_CAN) {
    yeuCau.push({ appendDimension: {
      sheetId: gid, dimension: "COLUMNS", length: COT_CAN - soCotLuoi } });
  }
  if (!yeuCau.length) return;
  await goi(encodeURIComponent(id) + ":batchUpdate",
    { method: "POST", body: JSON.stringify({ requests: yeuCau }) }, token, fetchImpl);
}

/* Tên tab đi vào ký pháp A1, nơi `'` và `!` là ký tự CÓ NGHĨA. Sheets cho
   phép nháy đơn trong tên tab, và cách thoát của A1 là nhân đôi nó. Thoát
   cho đúng chứ không cấm: tên tab là thứ chủ dự án tự đặt, và từ chối một
   cái tên hợp lệ của Google là bắt anh đổi tên file cho vừa lòng mã này. */
const danhTab = (ten) => "'" + String(ten).replace(/'/g, "''") + "'";

/**
 * Đẩy các khối ô của Engine sang một tab.
 *
 * Thứ tự BẮT BUỘC: xoá trước, ghi sau — và xoá bằng dải MỞ ĐUÔI (`A3:J`,
 * không phải `A3:J500`). Lượt này ít dòng hơn lượt trước mà chỉ ghi đè thì
 * phần đuôi của lượt cũ ở lại bên dưới, nối vào trông y như dữ liệu thật, và
 * mọi công thức `SUM` ở dòng 1 cộng cả phần thừa ấy.
 *
 * Và chỉ xoá ĐÚNG hai dải Engine sắp ghi. Không `clear` cả tab như repo
 * Marketing làm: bên đó tab là của riêng máy, bên này dòng 1 là công thức
 * của chủ dự án, dòng 2 là hàng tiêu đề anh gõ, K–N là cột anh điền tay.
 */
export async function daySangTab(env, { id, gid, khoi }, opts = {}) {
  const { ten, token, so_dong_luoi, so_cot_luoi } = await tenTabTheoGid(env, id, gid, opts);
  const tab = danhTab(ten);
  const hangDau = opts.hangDau || 3;

  const dai = khoi.map((k) => tab + "!" + k.cot_dau + hangDau + ":" + k.cot_cuoi);

  /* Nới lưới TRƯỚC cả lượt xoá: xoá xong mà ghi hỏng vì thiếu chỗ thì tab
     nằm lại trắng trơn, tức mất bộ số của lượt trước mà không nhận lại gì. */
  const soDongCan = hangDau - 1 + Math.max(...khoi.map((k) => k.dong.length), 0);
  await nongLuoi(id, gid, { soDongCan, soDongLuoi: so_dong_luoi, soCotLuoi: so_cot_luoi },
                 token, opts.fetchImpl);

  await goi(encodeURIComponent(id) + "/values:batchClear",
    { method: "POST", body: JSON.stringify({ ranges: dai }) }, token, opts.fetchImpl);

  /* Không dòng nào (line rỗng trong kỳ) thì xoá xong là xong — đúng việc
     phải làm, không phải một ca lỗi. Gửi `values` rỗng thì Google từ chối. */
  const coDong = khoi.some((k) => k.dong.length);
  if (!coDong) return { ten_tab: ten, so_dong: 0 };

  await goi(encodeURIComponent(id) + "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      /* RAW, không USER_ENTERED — xem `serialNgay()` bên Engine: USER_ENTERED
         biến mọi ô mở đầu bằng `=`, `+`, `-` thành CÔNG THỨC, và tên hàng
         trên sổ MISA có ô như thế. RAW thì chữ vào nguyên văn. */
      valueInputOption: "RAW",
      data: khoi.map((k, i) => ({ range: dai[i], values: k.dong })),
    }),
  }, token, opts.fetchImpl);

  return { ten_tab: ten, so_dong: khoi[0].dong.length };
}

/**
 * Phủ định dạng ngày và tiền lên đúng những cột mang chúng.
 *
 * Định dạng Ô thay vì ép sẵn dấu chấm vào chuỗi bên Engine — bài học từ repo
 * Marketing: ép sẵn thì Sheet nhận CHỮ, mất hết khả năng cộng, lọc và sắp
 * xếp, tức mất đúng thứ người ta mở bảng tính ra để làm. Công thức dòng 1
 * của chủ dự án cũng sẽ cộng ra 0 mà không báo gì.
 *
 * Chạy sau lượt ghi và KHÔNG chặn kết quả: ô đã có số đúng rồi, định dạng
 * hỏng thì cùng lắm là nhìn xấu.
 */
export async function dinhDangCot(env, { id, gid, cotNgay, cotTien, hangDau, hangCuoi },
                                 opts = {}) {
  const token = opts.token || await fbToken(env, SCOPE_SHEETS);
  if (!token) throw new LoiSheet(503, "Chưa cấu hình service account.");

  const o = (cot, mau) => ({
    repeatCell: {
      range: { sheetId: gid, startRowIndex: hangDau - 1, endRowIndex: hangCuoi,
               startColumnIndex: cot, endColumnIndex: cot + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: mau.type, pattern: mau.pattern } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  const yeuCau = [o(cotNgay, { type: "DATE", pattern: "dd/mm/yyyy" })];
  for (const c of cotTien) yeuCau.push(o(c, { type: "NUMBER", pattern: "#,##0" }));

  await goi(encodeURIComponent(id) + ":batchUpdate",
    { method: "POST", body: JSON.stringify({ requests: yeuCau }) }, token, opts.fetchImpl);
}
