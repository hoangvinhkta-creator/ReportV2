/* THƯỞNG VÀ LƯƠNG THEO LINE (engine/src/luong.mjs) — P6 lượt 2.
 *
 * Bộ này canh năm thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. PHÂN LOẠI THEO TÊN LINE THAY VÌ THEO HỆ SỐ. Chủ dự án chốt thẳng
 *     12/09/2026: *"nhân viên hệ số 7,5% tính theo cách A, 5,5% theo cách B...
 *     để sau này có nhân viên mới tôi chỉ cần nhập hệ số là hệ thống tự hiểu,
 *     không phải code lại."* Chôn một tên line vào module là phá đúng điều
 *     ấy, và triệu chứng chỉ lộ ra khi có người mới — lúc đó không ai nhớ vì
 *     sao lương của họ trống.
 *
 *  B. SAI BIÊN BẬC THƯỞNG. Bốn bậc cách nhau 0,05% và mốc là ĐẠT ĐÚNG 100%,
 *     110%, 120%. Lấy `>` thay vì `>=` thì người đạt tròn 100% rơi xuống bậc
 *     nền — mất tiền thật, mà bảng vẫn trông bình thường.
 *
 *  C. THƯỞNG NÓNG CỘNG DỒN. Chủ dự án nói rõ: đạt 2 tỷ là "thưởng thêm 500
 *     nữa TỔNG là 1 triệu", không phải 500 + 1.000 = 1,5 triệu.
 *
 *  D. LƯƠNG CỨNG VÀ PHỤ CẤP DÙNG CHUNG MỘT LUẬT. Chúng KHÁC nhau đúng ở
 *     chỗ trần: lương cứng chia đều cả hai chiều, phụ cấp chặn ở 26 ngày.
 *     Gộp làm một là làm thêm ngày thì được thêm cả phụ cấp.
 *
 *  E. HOÁ "CHƯA BIẾT" THÀNH 0. Ba lối ra `null` khác nhau — không thuộc cách
 *     nào / chưa có quy đổi / chưa nhập ngày công — và cả ba KHÔNG được thành
 *     số 0. Cùng kỷ luật của cả repo.
 *
 * Dữ liệu kiểm BỊA, trừ các con số chủ dự án đưa (chúng được ghim tuyệt đối).
 */
const path = require('path');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const L = await import('file://' + path.join(GOC, 'engine/src/luong.mjs'));
  const P = await import('file://' + path.join(GOC, 'engine/src/kpi.mjs'));

  /** Một mục `tom_tat_kpi.line` bịa. */
  const muc = (x) => Object.assign({
    he_so_pt: 5.5, dat_pt: 0, doanh_so_quy_doi: 0, so_don: 1, don_thieu_quy_doi: 0,
  }, x);

  /* ─────────── A. Phân loại theo HỆ SỐ, không theo tên ─────────── */

  console.log('\nA) Cách tính lương đi theo HỆ SỐ QUY ĐỔI, không theo tên line');
  {
    ok('hệ số 7,5% → cách A', L.bacLuong(7.5).ten, 'A');
    ok('hệ số 5,5% → cách B', L.bacLuong(5.5).ten, 'B');
    /* Nội thành 2% — chủ dự án chốt "tạm thời không tính". */
    ok('hệ số 2% → không thuộc cách nào', L.bacLuong(2), null);
    ok('line chưa khai hệ số → không thuộc cách nào', L.bacLuong(null), null);
    ok('hệ số lạ (6%) → không thuộc cách nào', L.bacLuong(6), null);

    /* ĐÂY LÀ BÀI QUAN TRỌNG NHẤT CỦA CẢ BỘ. Yêu cầu nguyên văn của chủ dự án
       là "nhập hệ số là hệ thống tự hiểu, không phải code lại" — một tên line
       trong file này là lời hứa ấy bị phá, và phá im lặng. Bản ĐẦU của yêu
       cầu chính là một danh sách tên ("trừ Nội thành, Fanpage, Shopee"), nên
       cám dỗ chép nó vào đây là có thật. */
    const MA = doc('engine/src/luong.mjs').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const ten of ['Nội thành', 'Tín Phát', 'Fanpage', 'Shopee', 'Miền Bắc',
                       'Tổng kho', 'Quyết chiến', 'Đông Á', 'Tân Á']) {
      ok('mã không nhắc tên line "' + ten + '"', MA.includes(ten), false);
    }
  }

  /* ─────────── B. Bốn bậc thưởng, và biên của chúng ─────────── */

  console.log('\nB) Bốn bậc thưởng — ghim đúng con số chủ dự án đưa');
  {
    const A = L.bacLuong(7.5), B = L.bacLuong(5.5);
    ok('A: dưới 100% → 0,15%', L.heSoThuong(A, 99.9), 0.15);
    ok('A: đúng 100% → 0,20%', L.heSoThuong(A, 100), 0.2);
    ok('A: đúng 110% → 0,25%', L.heSoThuong(A, 110), 0.25);
    ok('A: đúng 120% → 0,30%', L.heSoThuong(A, 120), 0.3);
    ok('A: vượt xa (500%) vẫn dừng ở bậc cuối', L.heSoThuong(A, 500), 0.3);

    ok('B: dưới 100% → 0,30%', L.heSoThuong(B, 99.99), 0.3);
    ok('B: đúng 100% → 0,40%', L.heSoThuong(B, 100), 0.4);
    ok('B: đúng 110% → 0,45%', L.heSoThuong(B, 110), 0.45);
    ok('B: đúng 120% → 0,50%', L.heSoThuong(B, 120), 0.5);

    /* Ngay DƯỚI mốc phải là bậc cũ — bài bắt lỗi `>` thành `>=` hoặc ngược lại. */
    ok('B: 109,99% vẫn là bậc 100%', L.heSoThuong(B, 109.99), 0.4);
    ok('B: 119,99% vẫn là bậc 110%', L.heSoThuong(B, 119.99), 0.45);

    /* Chưa đặt KPI thì không có phần trăm đạt — ăn bậc NỀN, không phải mất
       thưởng: "chưa đặt mục tiêu" không có nghĩa là "không bán được gì". */
    ok('chưa đặt KPI (dat_pt null) → bậc nền', L.heSoThuong(B, null), 0.3);
  }

  /* ─────────── C. Thưởng nóng ─────────── */

  console.log('\nC) Thưởng nóng — mốc CỐ ĐỊNH, và mốc 2 là TỔNG chứ không cộng dồn');
  {
    const B = L.bacLuong(5.5);
    ok('B: 1,49 tỷ chưa chạm mốc nào', L.thuongNong(B, 1_490_000_000).tien, 0);
    ok('B: đúng 1,5 tỷ → 500 nghìn', L.thuongNong(B, 1_500_000_000).tien, 500_000);
    ok('B: 1,99 tỷ vẫn là 500 nghìn', L.thuongNong(B, 1_990_000_000).tien, 500_000);
    /* Chủ dự án: "đạt 2 tỉ thưởng thêm 500 nữa TỔNG là 1 triệu" — không phải
       1,5 triệu. Đây là bài bắt phép cộng dồn. */
    ok('B: đúng 2 tỷ → 1 triệu (TỔNG, không phải 1,5 triệu)',
       L.thuongNong(B, 2_000_000_000).tien, 1_000_000);
    ok('B: 10 tỷ vẫn là 1 triệu', L.thuongNong(B, 10_000_000_000).tien, 1_000_000);
    ok('  · và nói rõ đang ở mốc mấy', L.thuongNong(B, 2_000_000_000).moc, 2);

    /* Mốc của A suy MỘT LẦN từ tỉ lệ hai con số của B so với KPI của B, rồi
       đóng băng (chủ dự án chọn phương án (a)). Bài này ghim chính TỈ LỆ ấy,
       nối thẳng sang bộ số KPI hạt giống — nếu ai đó sửa một trong hai đầu mà
       quên đầu kia thì nó đỏ. */
    const A = L.bacLuong(7.5);
    const kpiA = P.BANG_KPI_HAT_GIONG.mac_dinh['Tín Phát'].kpi;
    const kpiB = P.BANG_KPI_HAT_GIONG.mac_dinh['Miền Bắc'].kpi;
    ok('KPI của bậc A là 2,7 tỷ', kpiA, 2_700_000_000);
    ok('KPI của bậc B là 1,3 tỷ', kpiB, 1_300_000_000);
    const gan = (x, y) => Math.abs(x - y) / y < 1e-6;
    ok('mốc 1 của A đúng tỉ lệ (1,5 tỷ ÷ 1,3 tỷ) của KPI A',
       gan(A.nong[0][0] / kpiA, 1_500_000_000 / kpiB), true);
    ok('mốc 2 của A đúng tỉ lệ (2 tỷ ÷ 1,3 tỷ) của KPI A',
       gan(A.nong[1][0] / kpiA, 2_000_000_000 / kpiB), true);
    /* Ghim tuyệt đối luôn, để một lượt sửa "làm tròn cho đẹp" phải cố ý. */
    ok('mốc 1 của A = 3.115.384.615 đ', A.nong[0][0], 3_115_384_615);
    ok('mốc 2 của A = 4.153.846.154 đ', A.nong[1][0], 4_153_846_154);
    ok('A: số tiền thưởng nóng GIỐNG B', A.nong.map((x) => x[1]), [500_000, 1_000_000]);

    /* CỐ ĐỊNH nghĩa là không chạy theo KPI đang áp: hạ KPI của một line B
       xuống 1 tỷ thì mốc vẫn là 1,5 tỷ, không tụt còn 1,154 tỷ. */
    const r = L.luongCuaLine(muc({ he_so_pt: 5.5, kpi: 1_000_000_000, dat_pt: 140,
      doanh_so_quy_doi: 1_400_000_000 }), 26);
    ok('hạ KPI không kéo mốc thưởng nóng tụt theo', r.moc_nong, 0);
  }

  /* ─────────── D. Lương cứng và phụ cấp — KHÁC nhau ở cái trần ─────────── */

  console.log('\nD) Lương cứng chia đều hai chiều; phụ cấp có TRẦN 26 ngày');
  {
    ok('26 ngày công chuẩn', L.NGAY_CONG_CHUAN, 26);
    ok('đủ 26 ngày → 4.500.000 đ', L.luongCung(26), 4_500_000);
    /* Chủ dự án chốt phương án (a): thiếu ngày thì trừ theo tỉ lệ. */
    ok('24 ngày → chia theo tỉ lệ', L.luongCung(24), 4_153_846.15);
    ok('vượt lên 28 ngày → cộng theo tỉ lệ', L.luongCung(28), 4_846_153.85);
    ok('0 ngày → 0 đồng', L.luongCung(0), 0);

    ok('phụ cấp đủ 26 ngày → 780.000 đ', L.phuCap(26), 780_000);
    ok('phụ cấp 24 ngày → 720.000 đ', L.phuCap(24), 720_000);
    /* Cái trần — chỗ phụ cấp khác lương cứng. */
    ok('phụ cấp 28 ngày VẪN 780.000 đ (trần 26)', L.phuCap(28), 780_000);
    ok('phụ cấp 31 ngày vẫn vậy', L.phuCap(31), 780_000);
    ok('  · trong khi lương cứng 28 ngày thì TĂNG',
       L.luongCung(28) > L.luongCung(26), true);
  }

  /* ─────────── E. Ghép cả nhóm cột cho một line ─────────── */

  console.log('\nE) Cả nhóm cột lương của một line — một ca tính tay đầy đủ');
  {
    /* Line B, quy đổi 1,6 tỷ, đạt 123% (vượt mốc 120%), làm đủ 26 ngày:
         thưởng      = 1.600.000.000 × 0,5%  = 8.000.000
         thưởng nóng = chạm 1,5 tỷ           =   500.000
         lương cứng  = 4.500.000 × 26/26     = 4.500.000
         phụ cấp     = 30.000 × 26           =   780.000
         tổng lương  = 8.500.000 + 4.500.000 + 780.000 = 13.780.000 */
    const r = L.luongCuaLine(muc({ he_so_pt: 5.5, dat_pt: 123,
      doanh_so_quy_doi: 1_600_000_000 }), 26);
    ok('cách B', r.cach, 'B');
    ok('hệ số thưởng 0,5% (đã vượt 120%)', r.he_so_thuong_pt, 0.5);
    ok('chạm mốc nóng thứ nhất', r.moc_nong, 1);
    ok('thưởng = 8.000.000 + 500.000', r.thuong, 8_500_000);
    ok('lương cứng', r.luong_cung, 4_500_000);
    ok('phụ cấp', r.phu_cap, 780_000);
    ok('tổng lương = thưởng + lương cứng + phụ cấp', r.tong_luong, 13_780_000);
    ok('  · và đúng bằng phép cộng tay',
       r.tong_luong, r.thuong + r.luong_cung + r.phu_cap);

    /* Line A cùng doanh số: hệ số thấp hơn, và mốc nóng cao hơn nhiều nên
       CHƯA chạm — đây là chỗ hai cách thật sự khác nhau. */
    const a = L.luongCuaLine(muc({ he_so_pt: 7.5, dat_pt: 123,
      doanh_so_quy_doi: 1_600_000_000 }), 26);
    ok('cùng 1,6 tỷ nhưng cách A ăn 0,3%', a.he_so_thuong_pt, 0.3);
    ok('  · và CHƯA chạm mốc nóng nào (mốc A là 3,1 tỷ)', a.moc_nong, 0);
    ok('  · nên thưởng chỉ là 1,6 tỷ × 0,3%', a.thuong, 4_800_000);
  }

  /* ─────────── F. Ba lối ra `null`, ba câu khác nhau ─────────── */

  console.log('\nF) Ba lý do trống khác nhau — KHÔNG cái nào được thành số 0');
  {
    /* (1) Hệ số không thuộc cách nào — Nội thành. */
    const nt = L.luongCuaLine(muc({ he_so_pt: 2, dat_pt: 150,
      doanh_so_quy_doi: 9_000_000_000 }), 26);
    ok('Nội thành (2%): không có cách', nt.cach, null);
    ok('  · thưởng null dù doanh số rất lớn', nt.thuong, null);
    ok('  · lương cứng null dù ĐÃ nhập ngày công', nt.luong_cung, null);
    ok('  · tổng lương null', nt.tong_luong, null);

    /* (2) Chưa có quy đổi — kỳ trước MOC_KHOP_MA. Mọi đơn đều thiếu giá vốn. */
    const cu = L.luongCuaLine(muc({ he_so_pt: 5.5, dat_pt: null,
      doanh_so_quy_doi: 0, so_don: 40, don_thieu_quy_doi: 40 }), 26);
    ok('kỳ chưa có quy đổi: vẫn nhận ra cách', cu.cach, 'B');
    ok('  · nhưng thưởng null, KHÔNG phải 0', cu.thuong, null);
    ok('  · hệ số thưởng cũng null (chưa tính được)', cu.he_so_thuong_pt, null);
    ok('  · lương cứng và phụ cấp VẪN có (chúng không phụ thuộc quy đổi)',
       [cu.luong_cung, cu.phu_cap], [4_500_000, 780_000]);
    ok('  · tổng lương null vì còn thiếu một khoản', cu.tong_luong, null);

    /* Thiếu MỘT PHẦN thì vẫn tính — màn hình đã dán dấu * cho cột quy đổi. */
    const mot = L.luongCuaLine(muc({ he_so_pt: 5.5, dat_pt: 50,
      doanh_so_quy_doi: 1_000_000_000, so_don: 40, don_thieu_quy_doi: 3 }), 26);
    ok('thiếu MỘT PHẦN đơn thì vẫn tính thưởng', mot.thuong, 3_000_000);

    /* (3) Chưa nhập ngày công. */
    const chua = L.luongCuaLine(muc({ he_so_pt: 5.5, dat_pt: 100,
      doanh_so_quy_doi: 1_000_000_000 }), null);
    ok('chưa nhập ngày công: thưởng VẪN có', chua.thuong, 4_000_000);
    ok('  · nhưng lương cứng null, KHÔNG phải 0', chua.luong_cung, null);
    ok('  · phụ cấp null', chua.phu_cap, null);
    ok('  · tổng lương null', chua.tong_luong, null);

    /* Gõ số 0 KHÁC bỏ trống — 0 ngày công là một câu thật. */
    const khong = L.luongCuaLine(muc({ he_so_pt: 5.5, dat_pt: 100,
      doanh_so_quy_doi: 1_000_000_000 }), 0);
    ok('gõ 0 ngày công: lương cứng là 0 THẬT, không phải null', khong.luong_cung, 0);
    ok('  · và tổng lương vẫn cộng được', khong.tong_luong, 4_000_000);
  }

  /* ─────────── G. Cả bảng, và hàng TỔNG ─────────── */

  console.log('\nG) luongTheoLine() — cả bảng cộng hàng TỔNG');
  {
    const tkpi = { line: {
      X: muc({ he_so_pt: 5.5, dat_pt: 100, doanh_so_quy_doi: 1_000_000_000 }),
      Y: muc({ he_so_pt: 7.5, dat_pt: 100, doanh_so_quy_doi: 1_000_000_000 }),
      Z: muc({ he_so_pt: 2, dat_pt: 100, doanh_so_quy_doi: 1_000_000_000 }),
    } };
    const r = L.luongTheoLine(tkpi, { X: { ngay_cong: 26 }, Y: { ngay_cong: 26 } });
    ok('X (cách B, 0,4%)', r.line.X.thuong, 4_000_000);
    ok('Y (cách A, 0,2%)', r.line.Y.thuong, 2_000_000);
    ok('Z không tính lương', r.line.Z.cach, null);

    ok('TỔNG thưởng cộng X và Y, bỏ qua Z', r.tong.thuong, 6_000_000);
    ok('TỔNG lương cứng chỉ cộng hai line có ngày công', r.tong.luong_cung, 9_000_000);
    ok('TỔNG phụ cấp', r.tong.phu_cap, 1_560_000);
    ok('TỔNG lương', r.tong.tong_luong, 16_560_000);

    /* Bảng ngày công vắng hẳn (chưa ai nhập tháng này) không được làm nổ. */
    const r2 = L.luongTheoLine(tkpi, null);
    ok('chưa nhập ngày công nào: thưởng vẫn cộng được', r2.tong.thuong, 6_000_000);
    ok('  · còn lương cứng thì null, KHÔNG phải 0', r2.tong.luong_cung, null);
  }

  /* ─────────── H. Nối vào apDungKpi ─────────── */

  console.log('\nH) apDungKpi gắn bản kê lương vào tom_tat_kpi');
  {
    const bang = {
      line: null,
      ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', line: 'Tín Phát',
        tong_ban: 1_000_000, dong: [{ so_luong: 1, tong_ban: 1_000_000,
          loi_nhuan: 202_500_000 }] }] }],
      tom_tat: {},
    };
    P.apDungKpi(bang, P.BANG_KPI_HAT_GIONG, '2026-09', {}, ['Tín Phát'], null,
      { 'Tín Phát': { ngay_cong: 26 } });
    const lg = bang.tom_tat_kpi.luong.line['Tín Phát'];
    /* Lợi nhuận 202,5 triệu ÷ hệ số 7,5% = quy đổi 2,7 tỷ = đúng KPI → đạt
       100% → bậc hai của cách A (0,2%). */
    ok('quy đổi ra đúng KPI', bang.tom_tat_kpi.line['Tín Phát'].doanh_so_quy_doi, 2_700_000_000);
    ok('đạt tròn 100%', bang.tom_tat_kpi.line['Tín Phát'].dat_pt, 100);
    ok('nên ăn bậc 0,2% của cách A', lg.he_so_thuong_pt, 0.2);
    ok('thưởng = 2,7 tỷ × 0,2%', lg.thuong, 5_400_000);
    ok('cách phân loại lấy từ hệ số 7,5% của chính line', lg.cach, 'A');
    ok('bản kê lương đi kèm hàng TỔNG', bang.tom_tat_kpi.luong.tong.thuong, 5_400_000);
  }

  /* ─────────── I. Đường ghi ngày công ─────────── */

  console.log('\nI) POST /api/dat-cong — chỉ Quản trị, bắt buộc kỳ');
  {
    const GW = doc('src/index.js');
    ok('đường có trong bảng route', /\["POST \/api\/dat-cong", datCong\]/.test(GW), true);
    /* Ngày công là vế nhân của lương cứng và phụ cấp — cùng mức với dat-kpi. */
    ok('CHỈ vai quantri', /const datCong = boc\("quantri"/.test(GW), true);
    /* Không có tầng "mặc định chung" như KPI: một tháng có bao nhiêu ngày công
       là chuyện của đúng tháng ấy. */
    ok('kỳ BẮT BUỘC (không có tầng mặc định như KPI)',
       /datCong[\s\S]{0,900}?if \(!laKy\(ky\)\) throw new LoiXacThuc\(400/.test(GW), true);
    ok('ô trống XOÁ hẳn bản ghi, không ghi ngay_cong: null',
       /than\.ngay_cong === null[\s\S]{0,200}xoaDb\(duong, env\)/.test(GW), true);
    /* Trần 31: không tháng nào dài hơn, và gõ nhầm ở đây thì lương cứng nhân
       thẳng theo tỉ lệ. */
    ok('chặn số ngày vô lý', /n < 0 \|\| n > 31/.test(GW), true);
    /* KHÔNG nhân 1.000 ở biên — đây là SỐ NGÀY, không phải tiền. Nhầm chỗ này
       là lương cứng sai 1.000 lần. */
    const than = GW.match(/const datCong = boc[\s\S]*?\n\}\);/)[0];
    ok('không nhân 1.000 (ngày công không phải tiền)', /\* 1000/.test(than), false);

    ok('Gateway đọc nhánh ngày công của ĐÚNG kỳ đang xem',
       /docDb\(DUONG_NGAY_CONG \+ "\/" \+ ky, env\)/.test(GW), true);
    ok('  · và truyền xuống Engine ở CUỐI chữ ký (bẫy số 4)',
       /doanhSoKyTruoc, congVal\)/.test(GW), true);
    ok('đường nhánh nằm dưới bc/quyetdinh (thừa hưởng rules đang chạy)',
       L.DUONG_NGAY_CONG, 'bc/quyetdinh/cong');
  }

  xong();
})();
