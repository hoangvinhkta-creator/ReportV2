/* BONUS LỢI NHUẬN THEO ĐƠN — chủ dự án chốt 12/09/2026.
 *
 * ── Vì sao có ──
 *
 * Một số đơn nhân viên được cộng thêm ít tiền vào lợi nhuận: khách hoặc thợ
 * tự qua kho lấy (không tốn công giao), NCC giao hộ, KHBH, thợ lắp + KHBH.
 * Khoản ấy KHÔNG có trên sổ bán hàng — nó là một quyết định của người, nên nó
 * đi đúng đường mà mọi quyết định của người trong app này đi: một nhánh
 * RIÊNG, không bị lượt nhập sổ đè, hợp nhất lúc ĐỌC (CLAUDE.md — "Nhập sổ").
 *
 * ── Khoá phải bền qua lần nhập lại ──
 *
 * Đây là quyết định về MỘT ĐƠN, không phải một dòng, nên khoá là SỐ CHỨNG TỪ.
 * Số chứng từ do MISA cấp và không đổi giữa hai lần xuất sổ — đúng nửa đầu
 * của khoá dòng mà CLAUDE.md đã chốt. Tuyệt đối không dùng số thứ tự đơn
 * trong bảng: nhập lại một kỳ là thứ tự ấy đổi, và tiền thưởng nhảy sang đơn
 * của người khác mà không ai thấy.
 *
 * ── Lý do là BẮT BUỘC ──
 *
 * Một khoản tiền cộng thêm vào lợi nhuận mà không nói vì sao thì tháng sau
 * không ai đối chiếu lại được — kể cả chính người đã gõ nó. Engine từ chối
 * ghi nhận một bonus không có lý do thay vì âm thầm nhận, và Gateway cũng
 * chặn ở đường ghi: hai lớp, vì đây là tiền đi thẳng vào bảng lương.
 *
 * ── Tiền, và chỉ tiền ──
 *
 * `apDungBonus()` chỉ cộng vào `don.loi_nhuan`. Phần QUY ĐỔI của bonus nằm ở
 * `kpi.mjs::dienDoanhSoQuyDoi()`, cùng chỗ mọi con số quy đổi khác được cộng
 * — tách ra hai nơi thì tổng của line và tổng của đơn cộng theo hai đường và
 * chỉ lệch nhau ở con số cuối tháng.
 */

const laObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/* CÙNG phép làm tròn với `lamTron()` của `dong-hang.mjs` — cố ý chép đúng, xem
   chú thích ở đó. Hai module cùng cộng tiền trên một bảng; lệch phép làm tròn
   là hai cột cùng dòng không cộng lại được với nhau. */
const lamTron = (n) => Math.round(n * 100) / 100;

/** Bốn lý do mặc định. Là DỮ LIỆU nghiệp vụ đặt ở Engine có chủ ý: màn hình
 *  đọc danh sách này qua bảng đơn, nên thêm một lý do là sửa đúng một chỗ —
 *  không phải sửa cả trình duyệt lẫn phép kiểm ở Gateway.
 *
 *  KHÔNG phải một danh sách ĐÓNG: chủ dự án vẫn gõ được lý do khác. Nó là
 *  bốn phím tắt cho bốn ca hay gặp, không phải một bộ phân loại. */
export const LY_DO_BONUS = [
  "Khách/thợ qua kho lấy",
  "NCC giao hộ",
  "KHBH",
  "Thợ lắp + KHBH",
];

/** Một bonus có dùng được không. Trả `null` nếu không.
 *
 *  Lọc ở Engine chứ không tin nhánh Firebase: một bản ghi hỏng (thiếu lý do,
 *  tiền âm, tiền là chuỗi) phải bị BỎ QUA chứ không được cộng vào lợi nhuận
 *  bằng `NaN` — `NaN` lan ra thì cả cột tiền của tháng thành trống, và không
 *  có gì chỉ về đúng bản ghi gây ra. */
export function docBonus(b) {
  if (!laObj(b)) return null;
  const tien = Number(b.tien);
  if (!Number.isFinite(tien) || tien <= 0) return null;
  const ly_do = typeof b.ly_do === "string" ? b.ly_do.trim() : "";
  if (!ly_do) return null;
  return { tien: Math.round(tien), ly_do,
    boi: typeof b.boi === "string" ? b.boi : null,
    luc: typeof b.luc === "number" ? b.luc : null };
}

/* ─────────── BONUS MẶC ĐỊNH CHO ĐIỀU HOÀ — chủ dự án chốt 28/09/2026 ───────────
 *
 * Ba line Tín Phát · Tổng kho · Tân Á: mỗi sản phẩm ngành "Điều hoà" trong
 * đơn được cộng sẵn 50.000 đ vào bonus lợi nhuận, lý do "KHBH". Đơn 3 máy là
 * 150.000 đ. Tự có, không ai phải bấm — nhưng SỬA ĐƯỢC: một quyết định tay
 * (`bc/quyetdinh/bonus/<kỳ>/<số CT>`) luôn thắng con số tự tính, kể cả quyết
 * định "bỏ bonus" (bản ghi `tat: true`).
 *
 * Tính LÚC ĐỌC chứ không ghi xuống Firebase, cùng lý do mọi thứ khác Engine
 * tính: phân loại ngành hàng hay SL của một dòng đổi (gán mã, phân loại tay,
 * tải lại sổ) thì con số tự đổi theo, không có bản ghi cũ nào nằm lại sai. */
export const LINE_BONUS_DIEU_HOA = ["Tín Phát", "Tổng kho", "Tân Á"];
export const BONUS_DIEU_HOA_MOI_SP = 50000;
export const LY_DO_BONUS_DIEU_HOA = "KHBH";

/** So tên ngành bỏ dấu: bảng giá và phân loại tay có thể viết "Điều hoà"
 *  hay "Điều hòa" (dấu đặt khác chỗ = hai chuỗi Unicode khác nhau). */
const boDau = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
export const laDieuHoa = (nganh) => boDau(nganh) === "dieu hoa";

/** Bonus tự tính của một đơn, hoặc `null` nếu đơn không được. */
export function bonusMacDinh(don) {
  if (!don || !LINE_BONUS_DIEU_HOA.includes(don.line)) return null;
  let sl = 0;
  for (const d of don.dong || []) {
    if (d.la_chiet_khau || !laDieuHoa(d.nganh_hang)) continue;
    /* SL sau bán trả lại (BTL chạy trước) — máy đã trả thì không còn thưởng. */
    sl += Number(d.so_luong) || 0;
  }
  if (sl <= 0) return null;
  return { tien: sl * BONUS_DIEU_HOA_MOI_SP, ly_do: LY_DO_BONUS_DIEU_HOA,
    boi: null, luc: null, tu_dong: true, so_may: sl };
}

/** Gắn bonus vào từng đơn của bảng và cộng vào lợi nhuận của đơn.
 *
 *  `qd` là nhánh `bc/quyetdinh/bonus/<kỳ>`, khoá theo SỐ CHỨNG TỪ.
 *
 *  Đơn chưa biết lợi nhuận (`null` — còn dòng chưa có giá vốn) thì bonus vẫn
 *  được GẮN để màn hình hiện ra, nhưng KHÔNG cộng vào đâu cả: cộng một số
 *  biết vào một số chưa biết vẫn ra chưa biết, và trả về đúng con số bonus là
 *  nói rằng cả đơn chỉ lãi có ngần ấy. */
export function apDungBonus(bang, qd) {
  if (!bang || !Array.isArray(bang.ngay)) return bang;
  const m = laObj(qd) ? qd : {};

  let so_don_co_bonus = 0, tong_bonus = 0;
  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      const tho = m[don.so_ct];
      /* Màn hình cần biết đơn này CÓ bonus mặc định hay không, kể cả khi
         quyết định tay đang đè nó: xoá trắng ô bonus của một đơn như thế
         phải ghi "bỏ bonus" (`tat`), không phải xoá bản ghi — xoá bản ghi là
         bonus tự tính mọc lại, ngược đúng ý người vừa xoá. */
      const macDinh = bonusMacDinh(don);
      if (macDinh) don.bonus_tu_tinh = macDinh.tien;
      /* Có quyết định tay thì nó thắng — kể cả `tat: true` (người đã bỏ
         bonus của đơn này, không được để bonus tự tính mọc lại). Không có
         thì mới tới bonus mặc định. */
      const b = laObj(tho) ? (tho.tat === true ? null : docBonus(tho)) : macDinh;
      if (!b) continue;
      don.bonus = b;
      so_don_co_bonus++;
      tong_bonus = lamTron(tong_bonus + b.tien);
      if (don.loi_nhuan !== null && don.loi_nhuan !== undefined) {
        don.loi_nhuan = lamTron(Number(don.loi_nhuan) + b.tien);
      }
    }
  }

  bang.tom_tat_bonus = { so_don: so_don_co_bonus, tong: tong_bonus };
  bang.ly_do_bonus = LY_DO_BONUS;
  return bang;
}
