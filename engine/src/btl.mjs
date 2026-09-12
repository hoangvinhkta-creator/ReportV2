/* CHỨNG TỪ BTL — "BÁN TRẢ LẠI" (chủ dự án chốt 12/09/2026).
 *
 * Sổ MISA ghi một lượt khách trả hàng bằng một chứng từ riêng, số bắt đầu
 * bằng `BTL`. Trên sổ 2025 có 122 dòng như vậy, và chúng ghi 0 đồng — nghĩa
 * là nếu để nguyên thì một lượt trả hàng KHÔNG trừ đi đồng doanh số nào, dù
 * tiền đã quay về túi khách. Đó là lý do phải có file này.
 *
 * ── HAI TÌNH HUỐNG, HAI CÁCH XỬ ──
 *
 * Chủ dự án chốt luật theo việc đơn gốc có nằm trong CHÍNH KỲ ĐANG XEM hay
 * không — và đó không phải một chi tiết kỹ thuật, nó là cả nghiệp vụ:
 *
 *   · TÌM THẤY đơn gốc trong kỳ → doanh số của đơn gốc cũng đang nằm trong
 *     chính bảng này. Trừ thêm một lần nữa là trừ hai lần. Nên cả HAI dòng
 *     (đơn mua và dòng trả lại) về SỐ LƯỢNG 0 và TIỀN 0 — "coi như 2 dòng
 *     thông báo": chúng còn hiện ra để người đọc thấy đã có một lượt trả,
 *     nhưng không cộng vào đâu cả.
 *
 *   · KHÔNG tìm thấy → đơn gốc ở tháng khác, và doanh số của nó ĐÃ được tính
 *     ở tháng ấy rồi. Lần này mới là lần trừ. Dòng BTL nhận SỐ LƯỢNG −1 và
 *     tổng bán mang dấu ÂM.
 *
 * Số âm ấy chạy thẳng vào công thức lợi nhuận chung mà không cần nhánh riêng:
 * `tổng bán − giá nhập × SL` = `−X − g×(−1)` = `−X + g`, đúng bằng phần lãi
 * phải nhả lại. Cũng vậy với cặp "thông báo": SL 0 nên lợi nhuận ra 0.
 *
 * ── VÌ SAO GHÉP TRÊN `bc/dong` CHỨ KHÔNG TRÊN BẢNG ĐÃ LỌC LINE ──
 *
 * Màn hình có tab line, và `dungBangDon()` lọc theo line TRƯỚC khi trả bảng.
 * Nếu ghép trên bảng đã lọc thì một đơn gốc của nhân viên line A với chứng từ
 * BTL của line B sẽ "không tìm thấy nhau" ở tab A, tìm thấy ở tab Tổng hợp —
 * cùng một tháng ra hai con số khác nhau tuỳ tab đang mở. Nên phép ghép chạy
 * trên TOÀN kỳ, rồi kết quả mới áp xuống những dòng có mặt trong bảng.
 *
 * ── MỘT ĐIỀU CHƯA LÀM, CỐ Ý ──
 *
 * `bc/ky` (số đã tính sẵn, biểu đồ đọc) KHÔNG được trừ theo lượt này — cùng
 * lớp việc với "xoá dòng" ở `sua-tay.mjs`, và cần thêm một đường đọc `bc/dong`
 * cho mọi kỳ. Ghi ở ROADMAP.md để không ai tưởng là đã xong.
 */

import { deKhoa } from "./dong-hang.mjs";

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/* CÙNG phép làm tròn với `dong-hang.mjs` và `khop-ma.mjs` — cố ý chép đúng.
   Xem lý do ở cuối `khop-ma.mjs`. */
const lamTron = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Số chứng từ có phải một lượt bán trả lại không.
 *
 *  Nhận dạng bằng TIỀN TỐ của số chứng từ vì đó là thứ duy nhất sổ MISA đưa
 *  ra — không có cột "loại chứng từ". */
export function laChungTuBTL(so_ct) {
  return /^BTL/i.test(String(so_ct == null ? "" : so_ct));
}

const chuanTen = (s) =>
  String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Số điện thoại → dạng so sánh được. Sổ thật viết cùng một người ba kiểu:
 *  "0869 931 931", "0869931931", "+84869931931". So nguyên văn là ba người.
 *
 *  Bỏ mọi ký tự không phải chữ số, rồi cắt phần đầu quốc gia về CÙNG một
 *  dạng: số thuê bao Việt Nam luôn bắt đầu bằng 0 ở dạng trong nước, nên
 *  "84…" (≥10 chữ số) và "0…" cùng quy về phần còn lại. */
const chuanSdt = (s) => {
  let d = String(s == null ? "" : s).replace(/\D+/g, "");
  if (d.startsWith("0084")) d = d.slice(4);
  else if (d.startsWith("84") && d.length >= 10) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
};

/** Một khách → danh sách khoá nhận dạng, ƯU TIÊN SỐ ĐIỆN THOẠI.
 *
 *  Hai khoá chứ không một, và thử theo thứ tự: SĐT là thứ gần như duy nhất
 *  trong sổ, còn tên khách thì "Anh Hùng" có hàng chục người. Nhưng nhiều đơn
 *  cũ không có SĐT, và bỏ hẳn tên là bỏ luôn khả năng ghép của những đơn ấy —
 *  nên tên là LỰA CHỌN SAU, không phải lựa chọn song song.
 *
 *  Ngưỡng 8 chữ số loại các ô rác kiểu "0" hay "123" mà sổ vẫn có. */
function khoaKhach(kh) {
  const ra = [];
  const sdt = chuanSdt(kh && kh.dien_thoai);
  if (sdt.length >= 8) ra.push("P:" + sdt);
  const ten = chuanTen(kh && kh.ten);
  if (ten) ra.push("T:" + ten);
  return ra;
}

/** Số tiền phải trừ cho một dòng BTL không ghép được đơn gốc.
 *
 *  `null` nghĩa là KHÔNG TRUY RA ĐƯỢC — và khi ấy không được đoán lấy 0.
 *  Trừ 0 đồng trông y hệt "đã xử lý xong" trên màn hình, trong khi sự thật
 *  là một lượt trả hàng chưa được trừ đồng nào. Màn hình bôi đỏ dòng ấy. */
export function tienTraLai(d) {
  const ds = Math.abs(Number(d && d.doanh_so) || 0);
  if (ds > 0) return lamTron(ds);
  /* Sổ ghi dòng BTL 0 đồng ở cột `Doanh số bán` nhưng vẫn giữ ĐƠN GIÁ của
     mặt hàng — đó là con số khách đã trả cho một chiếc. SL của dòng BTL luôn
     là −1 (chủ dự án chốt), nên đơn giá chính là số phải trừ. */
  const dg = Math.abs(Number(d && d.don_gia) || 0);
  if (dg > 0) return lamTron(dg);
  return null;
}

/** Ghép mỗi dòng BTL của một kỳ với đơn đã bán trước đó, nếu có.
 *
 *  Điều kiện ghép — cả BA phải đúng, không có "gần đúng":
 *    · cùng khách (SĐT, hoặc tên khi không bên nào có SĐT)
 *    · cùng TÊN HÀNG. Một khách mua ba món rồi trả một món là chuyện thường;
 *      ghép theo mỗi khách là trả nhầm món và trừ nhầm tiền.
 *    · đơn gốc bán vào ngày KHÔNG SAU ngày trả.
 *
 *  Một dòng gốc chỉ ghép được MỘT lần: khách mua hai chiếc rồi trả hai lần
 *  thì hai dòng BTL phải ăn vào hai dòng gốc khác nhau, không cùng một dòng.
 *
 *  Trả về bản đồ theo KHOÁ DÒNG (bền qua mọi lượt nhập lại — CLAUDE.md), chứ
 *  không trả bảng đã sửa: người gọi áp nó xuống bảng nào cũng được. */
export function ghepBTL(dongCuaKy, khachCuaKy) {
  const dong = laObj(dongCuaKy) ? dongCuaKy : {};
  const khach = laObj(khachCuaKy) ? khachCuaKy : {};

  const btl = [];
  const ban = [];
  for (const khoa of Object.keys(dong)) {
    const d = dong[khoa];
    if (!laObj(d)) continue;
    const kh = khach[deKhoa(d.so_ct)] || {};
    (laChungTuBTL(d.so_ct) ? btl : ban).push({ khoa, d, keys: khoaKhach(kh) });
  }

  /* (khoá khách, tên hàng) → các dòng bán, xếp theo ngày. Dựng chỉ mục thay
     vì dò lồng nhau: một kỳ có hàng nghìn dòng, và dò lồng là phép nhân. */
  const chiMuc = new Map();
  for (const x of ban) {
    const ten = chuanTen(x.d.ten_hang);
    for (const k of x.keys) {
      const kk = k + "\x1f" + ten;
      if (!chiMuc.has(kk)) chiMuc.set(kk, []);
      chiMuc.get(kk).push(x);
    }
  }
  const xepDong = (a, b) =>
    a.d.ngay < b.d.ngay ? -1 : a.d.ngay > b.d.ngay ? 1
      : a.khoa < b.khoa ? -1 : a.khoa > b.khoa ? 1 : 0;
  for (const ds of chiMuc.values()) ds.sort(xepDong);
  btl.sort(xepDong);

  const daDung = new Set();
  const theo_khoa = {};
  let khop = 0, khong_khop = 0, khong_ro_tien = 0;

  for (const x of btl) {
    const ten = chuanTen(x.d.ten_hang);
    let doi = null;
    for (const k of x.keys) {
      const ds = chiMuc.get(k + "\x1f" + ten);
      if (!ds) continue;
      /* Lùi từ cuối: trong nhiều lần mua cùng món, lần GẦN NGÀY TRẢ NHẤT là
         lần khách đang trả. Lấy lần đầu tiên là gán trả về một hoá đơn cũ
         hơn mà chính nó có thể bị trả sau đó. */
      for (let i = ds.length - 1; i >= 0; i--) {
        const c = ds[i];
        if (daDung.has(c.khoa) || c.d.ngay > x.d.ngay) continue;
        doi = c;
        break;
      }
      if (doi) break;
    }

    if (doi) {
      daDung.add(doi.khoa);
      khop++;
      theo_khoa[x.khoa] = { vai: "btl", trang_thai: "khop",
        doi_khoa: doi.khoa, doi_ct: doi.d.so_ct, doi_ngay: doi.d.ngay };
      theo_khoa[doi.khoa] = { vai: "goc", trang_thai: "khop",
        doi_khoa: x.khoa, doi_ct: x.d.so_ct, doi_ngay: x.d.ngay };
      continue;
    }

    const tien = tienTraLai(x.d);
    if (tien === null) {
      khong_ro_tien++;
      theo_khoa[x.khoa] = { vai: "btl", trang_thai: "khong-ro-tien" };
    } else {
      khong_khop++;
      theo_khoa[x.khoa] = { vai: "btl", trang_thai: "khong-khop", tien };
    }
  }

  return { theo_khoa,
    tom_tat: { so_dong_btl: btl.length, khop, khong_khop, khong_ro_tien } };
}

/** Áp kết quả ghép xuống một bảng đơn đã dựng.
 *
 *  Chạy NGAY SAU `dungBangDon()` và TRƯỚC `dienGiaNhap()`: giá vốn nhân với
 *  số lượng, nên số lượng phải là con số cuối cùng trước khi tính tiền.
 *
 *  Không tự cộng lại tổng của đơn/ngày/bảng — `apDungSuaTay()` chạy cuối
 *  chuỗi và cộng lại từ đầu cho cả bảng. Cộng ở hai nơi là hai công thức
 *  phải khớp nhau mãi mãi. */
export function apDungBTL(bang, ghep) {
  const theo = laObj(ghep) && laObj(ghep.theo_khoa) ? ghep.theo_khoa : {};
  let tren_bang = 0;

  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      for (const d of don.dong) {
        const g = d.khoa ? theo[d.khoa] : null;
        if (!g) continue;
        tren_bang++;
        d.la_btl = g.vai === "btl";
        d.btl_trang_thai = g.trang_thai;
        d.btl_doi_ct = g.doi_ct ?? null;

        if (g.trang_thai === "khop") {
          /* "Coi như 2 dòng thông báo": còn hiện ra, nhưng không cộng vào
             doanh số lẫn lợi nhuận của ai. */
          d.so_luong = 0;
          d.tong_ban = 0;
          d.loi_nhuan = 0;
          d.btl_thong_bao = true;
        } else if (g.trang_thai === "khong-khop") {
          d.so_luong = -1;
          d.gia_ban = lamTron(g.tien);
          d.tong_ban = lamTron(-g.tien);
          d.loi_nhuan = null;
        } else {
          /* Không truy ra số tiền. Số lượng vẫn −1 để dòng đọc lên đúng
             nghiệp vụ, nhưng tiền KHÔNG được bịa — cờ dưới đây bắt lợi nhuận
             để trống và màn hình bôi đỏ. */
          d.so_luong = -1;
          d.btl_chua_ro_tien = true;
        }
      }
    }
  }

  bang.tom_tat_btl = { ...(laObj(ghep) && laObj(ghep.tom_tat) ? ghep.tom_tat : {}), tren_bang };
  return bang;
}
