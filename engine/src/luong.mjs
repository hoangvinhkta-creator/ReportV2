/* THƯỞNG VÀ LƯƠNG THEO LINE — P6 lượt 2, chủ dự án chốt 12/09/2026.
 *
 * ── VÌ SAO PHÂN LOẠI THEO HỆ SỐ, KHÔNG THEO TÊN LINE ──
 *
 * Chủ dự án chốt thẳng, và đây là yêu cầu quan trọng nhất của cả module:
 * *"nhân viên hệ số 7,5% tính lương theo cách A, hệ số 5,5% tính theo cách
 * B... để nếu sau này có nhân viên mới tôi chỉ cần nhập hệ số là hệ thống tự
 * động hiểu được cách tính lương, không phải code lại."*
 *
 * Nên KHÔNG có danh sách tên line nào trong file này. Bản đầu của yêu cầu là
 * một danh sách tên ("trừ Nội thành, Fanpage, Shopee"), và chính chủ dự án
 * đổi nó sang luật theo hệ số. Chôn lại tên vào đây là phá đúng thứ vừa được
 * đổi: thêm một người mới sẽ lại phải sửa repo và chờ deploy — sai người
 * chịu trách nhiệm, đúng lý do `line.mjs` để bảng ánh xạ ở Firebase.
 *
 * Hệ quả phải nói rõ, vì nó KHÁC bản đầu: Fanpage và Shopee đang mang hệ số
 * 5,5% nên chúng RƠI VÀO cách B và có lương. Muốn chúng không tính lương thì
 * đổi HỆ SỐ của chúng trên dải setup — đó là cái công tắc đúng chỗ.
 *
 * Nội thành (hệ số 2%) không thuộc cách nào nên không tính lương — chủ dự án
 * chốt "tạm thời không tính". Line chưa khai hệ số cũng vậy.
 *
 * ── VÌ SAO MỐC THƯỞNG NÓNG LÀ SỐ CỐ ĐỊNH, KHÔNG PHẢI TỈ LỆ KPI ──
 *
 * Chủ dự án chốt (phương án (a) khi được hỏi thẳng giữa hai phương án). Mốc
 * của cách B là con số anh đưa thẳng: 1,5 tỷ và 2 tỷ. Mốc của cách A suy một
 * lần từ tỉ lệ hai con số ấy so với KPI của B, rồi ĐÓNG BĂNG:
 *
 *     1,5 tỷ ÷ 1,3 tỷ = 115,38%  →  A: 2,7 tỷ × 115,38% = 3.115.384.615 đ
 *     2,0 tỷ ÷ 1,3 tỷ = 153,85%  →  A: 2,7 tỷ × 153,85% = 4.153.846.154 đ
 *
 * Cố định chứ không tính lại theo KPI đang áp, và đó là chủ ý: KPI sửa được
 * từng kỳ trên dải setup, nên buộc mốc chạy theo KPI là hạ KPI một tháng thì
 * mốc thưởng nóng tự tụt theo — một khoản tiền đổi mà không ai bấm gì.
 */

/* Cùng phép làm tròn với `kpi.mjs`, `dong-hang.mjs`, `khop-ma.mjs` và
 * `btl.mjs` — CHÉP đúng, có chủ đích (xem lý do tại `kpi.mjs`). */
const lamTron = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Đường nhánh ngày công. Khai MỘT chỗ để Gateway đọc và Gateway ghi không
 *  bao giờ trỏ lệch nhau — cùng lý do `DUONG_BANG_KPI` của P5. */
export const DUONG_NGAY_CONG = "bc/quyetdinh/cong";

/** Ngày công chuẩn của một tháng — mẫu số của cả lương cứng lẫn phụ cấp. */
export const NGAY_CONG_CHUAN = 26;

/** Lương cứng cho đúng `NGAY_CONG_CHUAN` ngày, bằng ĐỒNG. */
const LUONG_CUNG_CHUAN = 4_500_000;

/** Phụ cấp một ngày công, bằng ĐỒNG. */
const PHU_CAP_MOT_NGAY = 30_000;

/* Hai bậc tính lương, khoá theo HỆ SỐ QUY ĐỔI của line.
 *
 * `thuong` đọc là: đạt < 100% ăn mốc đầu, ≥ 100% ăn mốc hai, ≥ 110% mốc ba,
 * ≥ 120% mốc bốn. Viết thành CẶP (ngưỡng, hệ số) chứ không bốn hằng số rời:
 * thêm một bậc sau này là thêm một dòng, không phải sửa một chuỗi if lồng.
 *
 * `nong` là hai mốc DOANH SỐ QUY ĐỔI (đồng) và số tiền thưởng TỔNG khi chạm
 * mốc ấy — 1 triệu ở mốc hai là TỔNG, không phải cộng thêm vào 500 nghìn
 * ("đạt 2 tỉ: thưởng thêm 500 nữa tổng là 1 triệu"). */
const BAC = {
  /* Cách A — hệ số 7,5% (hiện là line Tín Phát, nhưng file này không biết
     điều đó và không được biết). */
  7.5: {
    ten: "A",
    thuong: [[0, 0.15], [100, 0.2], [110, 0.25], [120, 0.3]],
    nong: [[3_115_384_615, 500_000], [4_153_846_154, 1_000_000]],
  },
  /* Cách B — hệ số 5,5%. */
  5.5: {
    ten: "B",
    thuong: [[0, 0.3], [100, 0.4], [110, 0.45], [120, 0.5]],
    nong: [[1_500_000_000, 500_000], [2_000_000_000, 1_000_000]],
  },
};

/** Bậc lương đang áp cho một hệ số quy đổi — `null` khi hệ số không thuộc
 *  cách nào (Nội thành 2%, hay line chưa khai hệ số). */
export function bacLuong(heSoPt) {
  if (typeof heSoPt !== "number" || !Number.isFinite(heSoPt)) return null;
  return BAC[heSoPt] || null;
}

/** Hệ số thưởng (phần trăm) của một bậc theo phần trăm đạt KPI.
 *
 *  `datPt` là `null` khi line chưa đặt KPI. Khi ấy ăn bậc THẤP NHẤT, không
 *  phải không có thưởng: "chưa đặt mục tiêu" không có nghĩa là "không bán
 *  được gì" — doanh số quy đổi vẫn có thật và vẫn được thưởng theo mức nền. */
export function heSoThuong(bac, datPt) {
  const d = typeof datPt === "number" && Number.isFinite(datPt) ? datPt : 0;
  let ra = bac.thuong[0][1];
  for (const [nguong, hs] of bac.thuong) if (d >= nguong) ra = hs;
  return ra;
}

/** Thưởng nóng: mốc cao nhất đã chạm, và số tiền của mốc ấy.
 *
 *  Trả cả `moc` (0/1/2) lẫn `tien` để màn hình ghi được đúng câu chủ dự án
 *  yêu cầu ở cột Ghi chú — "số tiền thưởng đã bao gồm thưởng theo mốc 1 tỉ 5
 *  / 2 tỉ, nếu đạt; còn không đạt thì không ghi gì". Không đạt là `moc: 0`,
 *  và màn hình im lặng. */
export function thuongNong(bac, quyDoi) {
  const q = Number(quyDoi) || 0;
  let moc = 0, tien = 0, nguong = null;
  bac.nong.forEach(([n, t], i) => {
    if (q >= n) { moc = i + 1; tien = t; nguong = n; }
  });
  return { moc, tien, nguong };
}

/** Lương cứng theo ngày công.
 *
 *  Chia đều CẢ HAI CHIỀU (chủ dự án chốt phương án (a) khi được hỏi thẳng):
 *  dưới 26 ngày thì trừ theo tỉ lệ, trên 26 ngày thì cộng theo tỉ lệ. Khác
 *  hẳn phụ cấp ngay dưới — phụ cấp có TRẦN, lương cứng thì không. */
export function luongCung(ngayCong) {
  return lamTron(LUONG_CUNG_CHUAN * ngayCong / NGAY_CONG_CHUAN);
}

/** Phụ cấp theo ngày công, TRẦN ở 26 ngày.
 *
 *  Chủ dự án chốt: "30 × 26 ngày. Dưới 26 thì nhân theo thực tế. Vượt 26 thì
 *  vẫn tính tối đa cho 26 ngày." Trần này là chỗ phụ cấp khác lương cứng —
 *  làm thêm ngày thì được thêm lương, không được thêm phụ cấp. */
export function phuCap(ngayCong) {
  return lamTron(PHU_CAP_MOT_NGAY * Math.min(ngayCong, NGAY_CONG_CHUAN));
}

/** Toàn bộ nhóm cột lương của MỘT line.
 *
 *  `o` là một mục của `tom_tat_kpi.line`; `ngayCong` là số người dùng nhập
 *  (`null` khi chưa nhập).
 *
 *  Ba lối ra `null`, và chúng phải tách bạch vì màn hình nói ba câu khác
 *  nhau — cùng kỷ luật "0 đồng khác chưa biết" của cả repo:
 *
 *    · hệ số không thuộc cách nào  → cả nhóm cột trống, line này không tính
 *                                    lương (Nội thành).
 *    · quy đổi CHƯA BIẾT           → thưởng trống. Kỳ trước `MOC_KHOP_MA`
 *                                    không có giá vốn nên không có quy đổi;
 *                                    để thưởng ra 0 ở đó là màn hình nói
 *                                    "tháng này không được thưởng đồng nào".
 *    · chưa nhập ngày công         → lương cứng, phụ cấp trống.
 *
 *  `tong_luong` chỉ có số khi CẢ BA khoản đều biết — cộng một tổng còn thiếu
 *  khoản rồi gọi nó là "Tổng lương" là đưa ra một con số nhỏ hơn sự thật mà
 *  không dán nhãn thiếu. */
export function luongCuaLine(o, ngayCong) {
  const bac = bacLuong(o ? o.he_so_pt : null);
  const trong = {
    cach: null, he_so_thuong_pt: null, moc_nong: 0, nguong_nong: null,
    thuong_nong: null, thuong: null,
    ngay_cong: null, luong_cung: null, phu_cap: null, tong_luong: null,
  };
  if (!bac || !o) return trong;

  /* "Chưa biết quy đổi" nhận ra bằng: có đơn, mà MỌI đơn đều còn thiếu giá
     vốn. Đó đúng là hình dạng của một kỳ trước `MOC_KHOP_MA`. Thiếu một
     phần thì vẫn tính — màn hình đã dán dấu * cho cột quy đổi, và thưởng
     thừa hưởng đúng cảnh báo ấy. */
  const muQuyDoi = (o.so_don || 0) > 0 && (o.don_thieu_quy_doi || 0) >= (o.so_don || 0);

  const nc = typeof ngayCong === "number" && Number.isFinite(ngayCong) && ngayCong >= 0
    ? ngayCong : null;

  const ra = { ...trong, cach: bac.ten, ngay_cong: nc };

  if (!muQuyDoi) {
    const hs = heSoThuong(bac, o.dat_pt);
    const nong = thuongNong(bac, o.doanh_so_quy_doi);
    ra.he_so_thuong_pt = hs;
    ra.moc_nong = nong.moc;
    ra.nguong_nong = nong.nguong;
    ra.thuong_nong = nong.tien;
    ra.thuong = lamTron((Number(o.doanh_so_quy_doi) || 0) * hs / 100 + nong.tien);
  }

  if (nc !== null) {
    ra.luong_cung = luongCung(nc);
    ra.phu_cap = phuCap(nc);
  }

  if (ra.thuong !== null && ra.luong_cung !== null) {
    ra.tong_luong = lamTron(ra.thuong + ra.luong_cung + ra.phu_cap);
  }
  return ra;
}

/** Nhóm cột lương cho MỌI line của bảng, cộng hàng TỔNG.
 *
 *  Hàng TỔNG cộng ba cột TIỀN và bỏ trống Ngày công: cộng ngày công của
 *  nhiều line ra một con số không có nghĩa nào (26 + 26 + 24 = 76 "ngày" của
 *  ai?). Cộng phần biết được, đúng cách `gopKpiToanCongTy()` đang làm. */
export function luongTheoLine(tomTatKpi, bangCong) {
  const cua = (tomTatKpi && tomTatKpi.line) || {};
  const cong = bangCong && typeof bangCong === "object" && !Array.isArray(bangCong)
    ? bangCong : {};

  const line = {};
  let thuong = null, luong_cung = null, phu_cap = null, tong_luong = null;
  for (const ten of Object.keys(cua)) {
    const m = cong[ten];
    const nc = m && typeof m === "object" && typeof m.ngay_cong === "number"
      ? m.ngay_cong : null;
    const r = luongCuaLine(cua[ten], nc);
    line[ten] = r;
    if (r.thuong !== null) thuong = lamTron((thuong || 0) + r.thuong);
    if (r.luong_cung !== null) luong_cung = lamTron((luong_cung || 0) + r.luong_cung);
    if (r.phu_cap !== null) phu_cap = lamTron((phu_cap || 0) + r.phu_cap);
    if (r.tong_luong !== null) tong_luong = lamTron((tong_luong || 0) + r.tong_luong);
  }
  return { line, tong: { thuong, luong_cung, phu_cap, tong_luong } };
}
