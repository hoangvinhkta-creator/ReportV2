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
      const b = docBonus(m[don.so_ct]);
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
