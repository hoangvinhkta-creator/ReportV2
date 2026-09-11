/* Gộp doanh số theo ĐƠN VỊ THỜI GIAN tuỳ chọn (ngày/tháng/quý/năm), và so
 * kỳ hiện tại với ĐÚNG kỳ đó của năm trước — dùng chung cho P2(b) (biểu đồ).
 *
 * Chủ dự án chốt 11/09/2026 (phiên dựng "Bản Vẽ Biểu Đồ Line"): mọi biểu đồ
 * đều có tab đổi đơn vị thời gian VÀ chồng một đường/cột "cùng kỳ năm
 * trước". Thuật toán dưới đây đã kiểm bằng tay trên số thật của mockup
 * (20 tháng, 369.657.171.568 đ / 29.883 đơn — mọi đơn vị đều cộng ra đúng
 * con số đó, không rơi không trùng) trước khi chuyển vào Engine — xem
 * `docs/prompt-P3.md` không liên quan, còn bối cảnh đầy đủ nằm ở ROADMAP.md
 * mục "LINE" và "Hai nhánh chạy SONG SONG".
 *
 * ── VÌ SAO ĐÂY LÀ MỘT MODULE THUẦN, KHÔNG PHẢI MỘT PHẦN CỦA gop-ban-hang.mjs ──
 * `gop-ban-hang.mjs` biến sổ THÔ (ma trận ô Excel) thành `bc/ky`. Module này
 * làm việc NGƯỢC hướng: đọc lại `bc/ky` đã có (hoặc một chuỗi ngày đã gộp
 * sẵn) rồi nhóm theo một đơn vị thời gian khác. Hai việc khác nhau, hai
 * nguồn vào khác nhau — gộp chung một file thì mỗi lần sửa một bên phải đọc
 * lại cả bên kia.
 *
 * TRÌNH DUYỆT KHÔNG BAO GIỜ CHẠY FILE NÀY (LUẬT SỐ 1). "Ngày nào thuộc
 * tháng/quý nào", "kỳ nào là cùng kỳ năm trước" là LUẬT PHÂN LOẠI — CLAUDE.md
 * liệt tên rõ trong danh sách cấm ở frontend. Trình duyệt chỉ nhận cây kết
 * quả `{nam: {viTri: {doanh_so, so_don, khoa}}}` đã tính sẵn rồi vẽ.
 */

/** Đơn vị thời gian hợp lệ. KHÔNG có "tuan" — chủ dự án đã bỏ (11/09/2026,
 *  "tôi ghi nhầm số 3 thành 4"); đừng thêm lại nếu không có yêu cầu mới. */
export const DON_VI_HOP_LE = ["ngay", "thang", "quy", "nam"];

/** Ngày "YYYY-MM-DD" → { nam, viTri, khoa } theo từng đơn vị gộp.
 *
 *  `viTri` là VỊ TRÍ TRONG MỘT CHU KỲ NĂM (ngày-trong-năm / tháng-trong-năm
 *  / quý-trong-năm; "nam" chỉ có một vị trí) — đây là trục dùng để chồng
 *  "năm nay" lên "năm ngoái" ĐÚNG VỊ TRÍ khi vẽ hai đường so sánh. */
export function viTriTheoDonVi(ngayStr, donVi) {
  const m = String(ngayStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("gop-theo-thoi-gian: ngay khong dung dang YYYY-MM-DD: " + ngayStr);
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error("gop-theo-thoi-gian: thang/ngay ngoai pham vi: " + ngayStr);
  }

  if (donVi === "ngay") {
    const dau = Date.UTC(y, 0, 1);
    const nay = Date.UTC(y, mo - 1, d);
    const ngayTrongNam = Math.round((nay - dau) / 86400000) + 1;
    return { nam: y, viTri: ngayTrongNam, khoa: ngayStr };
  }
  if (donVi === "thang") {
    return { nam: y, viTri: mo, khoa: ngayStr.slice(0, 7) };
  }
  if (donVi === "quy") {
    const q = Math.ceil(mo / 3);
    return { nam: y, viTri: q, khoa: y + "-Q" + q };
  }
  if (donVi === "nam") {
    return { nam: y, viTri: 1, khoa: String(y) };
  }
  throw new Error("gop-theo-thoi-gian: don vi khong biet: " + donVi
    + " (chỉ nhận " + DON_VI_HOP_LE.join("/") + ")");
}

/* Tiền VND có thể ra phần thập phân thật (đơn giá lẻ ở một vài dòng sổ —
 * xem chú thích LUAT_DOANH_SO trong gop-ban-hang.mjs), nên không làm tròn
 * về số nguyên; chỉ cắt bụi dấu phẩy động. */
const lamTron = (x) => Math.round(x * 100) / 100;

/** Gộp MỘT chuỗi ngày `{ "YYYY-MM-DD": {doanh_so, so_don} }` theo đơn vị,
 *  TÁCH RIÊNG từng năm — trả `{ [nam]: { [viTri]: {doanh_so, so_don, khoa} } }`.
 *
 *  Đây là hình dạng để vẽ hai đường/cột chồng theo vị trí trong chu kỳ năm:
 *  `ra[2026][8]` (tháng 8 năm nay) đứng cạnh `ra[2025][8]` (tháng 8 năm
 *  ngoái) ở đúng cùng một vị trí trục X.
 *
 *  KHÔNG ném lỗi với chuỗi rỗng — trả `{}`. Ngày dạng sai thì ném lỗi (xem
 *  `viTriTheoDonVi`): một ngày đọc sai âm thầm rơi vào group khác còn tệ hơn
 *  dừng hẳn. */
export function gopMotChuoiNgay(seriesNgay, donVi) {
  if (!seriesNgay || typeof seriesNgay !== "object") {
    throw new Error("gop-theo-thoi-gian: can mot chuoi ngay dang doi tuong");
  }
  const ra = {};
  for (const ngay of Object.keys(seriesNgay)) {
    const o = seriesNgay[ngay] || {};
    const { nam, viTri, khoa } = viTriTheoDonVi(ngay, donVi);
    const theoNam = (ra[nam] ||= {});
    const cell = (theoNam[viTri] ||= { doanh_so: 0, so_don: 0, khoa });
    cell.doanh_so = lamTron(cell.doanh_so + (Number(o.doanh_so) || 0));
    cell.so_don += Number(o.so_don) || 0;
  }
  return ra;
}

/** Vị trí MỚI NHẤT có dữ liệu trong một chuỗi ngày, theo đơn vị — dùng để
 *  biết "kỳ hiện tại" là kỳ nào khi vẽ bảng xếp hạng (P2(b), bước sau).
 *  Trả `null` nếu chuỗi rỗng. */
export function viTriMoiNhat(seriesNgay, donVi) {
  const ngays = Object.keys(seriesNgay || {}).sort();
  const ngayCuoi = ngays[ngays.length - 1];
  return ngayCuoi ? viTriTheoDonVi(ngayCuoi, donVi) : null;
}

/** Giá trị tại (năm, vị trí) cụ thể của một chuỗi ĐÃ GỘP — `{doanh_so:0,
 *  so_don:0}` nếu không có, KHÔNG `undefined`: bên gọi (vẽ biểu đồ so cùng
 *  kỳ năm trước) luôn cần một số để vẽ, kể cả khi kỳ đó chưa có dòng nào. */
export function giaTriTaiViTri(daGop, nam, viTri) {
  const o = daGop && daGop[nam] && daGop[nam][viTri];
  return o ? { doanh_so: o.doanh_so, so_don: o.so_don } : { doanh_so: 0, so_don: 0 };
}

/** `bc/ky` = `{ "<kỳ>": { "<nhân viên>": { "<ngày>": {doanh_so, so_don} } } }`
 *  → MỘT chuỗi ngày cộng dồn — toàn công ty nếu không lọc, hoặc chỉ những
 *  nhân viên trong `locNhanVien` (dùng khi gộp theo LINE — xem
 *  `line.mjs::xepLine`, hàm này KHÔNG tự biết gì về line, bên gọi tự lọc
 *  danh sách nhân viên trước khi đưa vào đây).
 *
 *  Đây là bước "phẳng hoá" DUY NHẤT của toàn bộ tầng biểu đồ: mọi hàm khác
 *  trong module này làm việc trên MỘT chuỗi ngày, không biết gì về cây
 *  `bc/ky` hay về nhân viên — tách bạch để còn dùng lại được cho cả công ty
 *  lẫn từng line mà không phải viết hai đường gộp khác nhau. */
export function gopCayKyThanhChuoiNgay(cayKy, locNhanVien) {
  if (!cayKy || typeof cayKy !== "object") {
    throw new Error("gop-theo-thoi-gian: can cay bc/ky dang doi tuong");
  }
  const loc = locNhanVien ? new Set(locNhanVien) : null;
  const ra = {};
  for (const ky of Object.keys(cayKy)) {
    const theoNv = cayKy[ky];
    if (!theoNv || typeof theoNv !== "object") continue;
    for (const nv of Object.keys(theoNv)) {
      if (loc && !loc.has(nv)) continue;
      const theoNgay = theoNv[nv];
      if (!theoNgay || typeof theoNgay !== "object") continue;
      for (const ngay of Object.keys(theoNgay)) {
        const o = theoNgay[ngay] || {};
        const cell = (ra[ngay] ||= { doanh_so: 0, so_don: 0 });
        cell.doanh_so = lamTron(cell.doanh_so + (Number(o.doanh_so) || 0));
        cell.so_don += Number(o.so_don) || 0;
      }
    }
  }
  return ra;
}

/** Hai năm gần nhất có mặt trong một chuỗi ngày, giảm dần — `[namNay,
 *  namTruoc]`. Trả mảng rỗng nếu chuỗi rỗng, một phần tử nếu chỉ có một năm
 *  (khi đó không có "cùng kỳ năm trước" để so — bên gọi tự xử lý, hàm này
 *  không đoán). */
export function haiNamGanNhat(seriesNgay) {
  const nams = new Set(Object.keys(seriesNgay || {}).map((k) => +k.slice(0, 4)));
  return [...nams].sort((a, b) => b - a).slice(0, 2);
}

/** Hàm TỔNG HỢP cho "màn mở" (sức khoẻ kinh doanh toàn công ty, P2(b)
 *  bước 1) — nhận thẳng cây `bc/ky`, trả đủ dữ liệu để vẽ 3 tab (Ngày/
 *  Tháng/Năm) mà KHÔNG cần gọi lại lần nào nữa.
 *
 *  Trả:
 *    theo_ngay, theo_thang, theo_nam  — mỗi cái là kết quả `gopMotChuoiNgay`
 *                                       ở đúng đơn vị đó, cả hai năm
 *    vi_tri_moi_nhat                  — { ngay, thang, nam } — "hôm nay" ở
 *                                       từng đơn vị, để biết đường năm nay
 *                                       nên vẽ dừng ở đâu
 *    hai_nam                          — [namNay, namTruoc], hoặc mảng ngắn
 *                                       hơn nếu dữ liệu chưa đủ hai năm */
export function gopSucKhoeCongTy(cayKy) {
  const chuoi = gopCayKyThanhChuoiNgay(cayKy);
  return {
    theo_ngay: gopMotChuoiNgay(chuoi, "ngay"),
    theo_thang: gopMotChuoiNgay(chuoi, "thang"),
    theo_nam: gopMotChuoiNgay(chuoi, "nam"),
    vi_tri_moi_nhat: {
      ngay: viTriMoiNhat(chuoi, "ngay"),
      thang: viTriMoiNhat(chuoi, "thang"),
      nam: viTriMoiNhat(chuoi, "nam"),
    },
    hai_nam: haiNamGanNhat(chuoi),
  };
}
