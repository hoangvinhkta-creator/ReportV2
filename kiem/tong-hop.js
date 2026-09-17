/* TAB [TỔNG HỢP] — 15 cột, sắp theo doanh số (P6, chủ dự án chốt 12/09/2026).
 *
 * Bộ này canh bốn thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. HOÁ "CHƯA BIẾT" THÀNH 0. Nặng nhất, và hai cột mới đều dính được:
 *     "tỉ lệ tồn kho 0%" đọc ra "line này không bán đồng nào từ kho", trong
 *     khi sự thật là kỳ ấy nằm trước `MOC_KHOP_MA` nên KHÔNG DÒNG NÀO biết
 *     nơi nhập. Cùng lớp lỗi với `loi_nhuan === null` của P4.
 *
 *  B. ĐẾM NHẦM THỨ KHÔNG PHẢI HÀNG. "Số sản phẩm" cộng `so_luong`, mà
 *     `dungBangDon()` gán cứng `so_luong: 1` cho dòng chiết khấu gộp — đếm
 *     nó là mỗi đơn có chiết khấu tự mọc thêm một "sản phẩm" không hề bán.
 *
 *  C. SẮP Ở MÀN HÌNH THAY VÌ Ở ENGINE. "Sắp theo cái gì" là luật đọc số
 *     (LUẬT SỐ 1). Hai màn sắp bằng hai bản của cùng một luật là hai bảng
 *     đọc ra hai thứ hạng khác nhau.
 *
 *  D. HÀNG TỔNG CỘNG LẠI Ở TRÌNH DUYỆT. Engine đã cộng; cộng lần hai là hai
 *     con số có thể lệch nhau mà không ai biết bên nào đúng.
 */
const path = require('path');
const vm = require('vm');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const P = await import('file://' + path.join(GOC, 'engine/src/kpi.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));

  const UI = doc('public/don-hang.js');
  const GW = doc('src/index.js');
  const CSS = doc('public/index.html');

  /* Bảng KPI nhỏ, đủ để quy đổi ra số tròn — KHÔNG dùng hạt giống thật, để
     bài kiểm không đỏ mỗi lần chủ dự án đổi một mức KPI. */
  const BANG = { mac_dinh: { L1: { kpi: 1000000, he_so_pt: 10 },
                             L2: { kpi: 1000000, he_so_pt: 10 } }, ky: {} };

  /** Bảng đơn bịa, đúng hình dạng `dungBangDon()` trả ra. */
  function bang(don) {
    return { line: null, ngay: [{ ngay: '2026-09-01', don }], tom_tat: {} };
  }
  const dong = (x) => Object.assign({
    so_luong: 1, tong_ban: 0, loi_nhuan: 0, noi_nhap: null,
    la_chiet_khau: false, la_phu_phi_co_dinh: null,
  }, x);

  /* ─────────── A. "Số sản phẩm" — đếm CÁI, và chỉ đếm hàng ─────────── */

  console.log('\nA) "Số sản phẩm" = tổng SỐ LƯỢNG, không phải số dòng');
  {
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 40, dong: [
      dong({ so_luong: 3, tong_ban: 30, loi_nhuan: 3 }),
      dong({ so_luong: 1, tong_ban: 10, loi_nhuan: 1 }),
    ] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('3 tivi + 1 tủ lạnh = 4 sản phẩm', o.so_san_pham, 4);
    ok('  · trong khi số DÒNG vẫn là 2 (trường cũ giữ nguyên)', o.so_dong, 2);
  }

  console.log('\nB) Chiết khấu và phụ phí KHÔNG phải sản phẩm');
  {
    /* Ca thật: `dungBangDon()` gán `so_luong: 1` cho dòng chiết khấu gộp.
       Đếm nó thì mỗi đơn có chiết khấu tự cộng thêm một cái hàng không bán. */
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 9, dong: [
      dong({ so_luong: 2, tong_ban: 10, loi_nhuan: 2 }),
      dong({ so_luong: 1, tong_ban: -1, loi_nhuan: -1, la_chiet_khau: true }),
      dong({ so_luong: 1, tong_ban: 5, loi_nhuan: 0, la_phu_phi_co_dinh: 'Chi phí vận chuyển' }),
    ] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    ok('chỉ đếm 2 cái hàng thật', b.tom_tat_kpi.line.L1.so_san_pham, 2);

    /* BTL: `btl.mjs` đặt số lượng về 0 (ghép được) hoặc −1 (trả lại không
       ghép). Cộng cả số âm — đó mới là SỐ LƯỢNG THỰC BÁN. */
    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 0, dong: [
      dong({ so_luong: 5 }), dong({ so_luong: -1 }),
    ] }]);
    P.dienDoanhSoQuyDoi(b2, BANG, '2026-09', {});
    ok('dòng trả lại TRỪ vào số lượng, không bị bỏ qua',
       b2.tom_tat_kpi.line.L1.so_san_pham, 4);
  }

  /* ─────────── C. Lợi nhuận — cộng phần biết, đếm đơn thiếu ─────────── */

  console.log('\nC) Lợi nhuận cộng phần BIẾT ĐƯỢC, và dán nhãn phần thiếu');
  {
    const b = bang([
      { so_ct: 'BH1', line: 'L1', tong_ban: 0, dong: [
        dong({ loi_nhuan: 100 }), dong({ loi_nhuan: null }) ] },
      { so_ct: 'BH2', line: 'L1', tong_ban: 0, dong: [ dong({ loi_nhuan: 50 }) ] },
    ]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('cộng 100 + 50, bỏ qua dòng chưa biết', o.loi_nhuan, 150);
    ok('  · và nói rõ còn 1 đơn chưa đủ', o.don_thieu_loi_nhuan, 1);

    /* Đếm RIÊNG khỏi `don_thieu_quy_doi`: line chưa khai hệ số thì quy đổi
       trống ở MỌI đơn, nhưng lợi nhuận vẫn biết rõ. Dùng chung một bộ đếm là
       dán nhãn "còn thiếu" lên một cột đã đủ. */
    const b2 = bang([{ so_ct: 'BH1', line: 'LX', tong_ban: 0,
      dong: [dong({ loi_nhuan: 100 })] }]);
    P.dienDoanhSoQuyDoi(b2, BANG, '2026-09', {});
    const x = b2.tom_tat_kpi.line.LX;
    ok('line chưa khai hệ số: quy đổi thiếu 1 đơn', x.don_thieu_quy_doi, 1);
    ok('  · nhưng lợi nhuận KHÔNG thiếu đơn nào', x.don_thieu_loi_nhuan, 0);
    ok('  · và lợi nhuận vẫn có số thật', x.loi_nhuan, 100);
  }

  /* ─────────── D. Tỉ lệ tồn kho ─────────── */

  console.log('\nD) Tỉ lệ tồn kho = doanh số dòng "Kho" ÷ doanh số thuần');
  {
    ok('nhãn Kho mượn của khop-ma.mjs, không chép chuỗi mới', K.NHAN_TON_KHO, 'Kho');

    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100, dong: [
      dong({ tong_ban: 30, loi_nhuan: 3, noi_nhap: 'Kho' }),
      dong({ tong_ban: 70, loi_nhuan: 7, noi_nhap: 'Việt Hải' }),
    ] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('30 trên 100 = 30%', o.ty_le_ton_kho_pt, 30);
    ok('  · tử số đi kèm để đối chiếu tay', o.doanh_so_tu_kho, 30);
    ok('  · không còn hàng nào chưa rõ nguồn', o.doanh_so_chua_ro_nguon, 0);
  }

  console.log('\nE) KHÔNG dòng nào biết nơi nhập → "chưa biết", KHÔNG phải 0%');
  {
    /* Đây là kỳ trước MOC_KHOP_MA (không có giá vốn Tracking) — ca sẽ gặp
       thật mỗi lần mở một tháng cũ. Hoá 0% ở đây là để một ô trống nói
       "line này không bán đồng nào từ kho", một câu sai hẳn. */
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
      dong: [dong({ tong_ban: 100, loi_nhuan: null })] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-08', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('tỉ lệ là null, không phải 0', o.ty_le_ton_kho_pt, null);
    ok('  · và phần chưa rõ nguồn được đếm ra', o.doanh_so_chua_ro_nguon, 100);
  }

  console.log('\nF) Biết một phần → vẫn ra tỉ lệ, kèm phần còn chưa rõ');
  {
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100, dong: [
      dong({ tong_ban: 20, loi_nhuan: 2, noi_nhap: 'Kho' }),
      dong({ tong_ban: 80, loi_nhuan: null }),
    ] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('tỉ lệ tính trên doanh số thuần ĐẦY ĐỦ (20/100)', o.ty_le_ton_kho_pt, 20);
    ok('  · và 80 chưa rõ nguồn được nói ra để dán nhãn "sàn"',
       o.doanh_so_chua_ro_nguon, 80);

    /* Chiết khấu và Chênh VAT vốn KHÔNG có nơi nhập theo thiết kế của P4 —
       kể chúng là "chưa rõ nguồn" là dán nhãn thiếu lên ô cố ý để trống. */
    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 95, dong: [
      dong({ tong_ban: 100, loi_nhuan: 10, noi_nhap: 'Kho' }),
      dong({ tong_ban: -5, loi_nhuan: -5, la_chiet_khau: true }),
    ] }]);
    P.dienDoanhSoQuyDoi(b2, BANG, '2026-09', {});
    ok('chiết khấu không bị kể là hàng chưa rõ nguồn',
       b2.tom_tat_kpi.line.L1.doanh_so_chua_ro_nguon, 0);
  }

  /* ─────────── G. Vs. Tháng trước ─────────── */

  console.log('\nG) Vs. Tháng trước — doanh số thuần, phần trăm chênh');
  {
    const lam = (nay, truoc) => {
      const b = bang(nay === null ? [] : [{ so_ct: 'BH1', line: 'L1', tong_ban: nay,
        dong: [dong({ tong_ban: nay, loi_nhuan: 0 })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2'], truoc);
      return b.tom_tat_kpi.vs_line.L1;
    };
    const len = lam(120, { L1: 100 });
    ok('120 so với 100 = +20%', len.vs_thang_truoc_pt, 20);
    ok('  · số tháng trước đi kèm để màn hình nói ra được', len.doanh_so_ky_truoc, 100);
    ok('tụt thì ra số ÂM', lam(80, { L1: 100 }).vs_thang_truoc_pt, -20);

    /* CA ĐÁNG GIÁ NHẤT của cột này: line bán 500 tháng trước rồi tháng này
       KHÔNG có đơn nào. Nó không có mục trong `tom_tat_kpi.line` (bản kê ấy
       chỉ gom line có đơn), nên nếu cột đọc từ đó thì đúng con số đáng nhìn
       nhất — một line vừa sập hẳn — lại là con số duy nhất không hiện ra. */
    const sap = lam(null, { L1: 500 });
    ok('line sập về 0 đồng vẫn ra −100%, không phải "—"', sap.vs_thang_truoc_pt, -100);
    ok('  · dù nó KHÔNG có mục nào trong tom_tat_kpi.line', (() => {
      const b = bang([]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1'], { L1: 500 });
      return Object.keys(b.tom_tat_kpi.line);
    })(), []);

    /* Và thêm mục rỗng vào `line` KHÔNG phải cách sửa: `gopKpiToanCongTy()`
       cộng KPI của mọi line có mặt ở đó, nên tổng KPI sẽ phình theo những
       line không chạy tháng này — đúng thứ `title` ô "Đạt" đang hứa là không
       xảy ra. Bài này ghim lời hứa ấy. */
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 10,
      dong: [dong({ tong_ban: 10 })] }]);
    P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2'], { L2: 500 });
    ok('tổng KPI chỉ cộng line CÓ đơn, không cộng L2', b.tom_tat_kpi.tong.kpi, 1000000);
  }

  /* ─────────── G2. So với năm trước ─────────── */

  console.log('\nG2) So với năm trước — CÙNG THÁNG năm trước (chốt 15/09/2026)');
  {
    const lam = (nay, nam) => {
      const b = bang(nay === null ? [] : [{ so_ct: 'BH1', line: 'L1', tong_ban: nay,
        dong: [dong({ tong_ban: nay, loi_nhuan: 0 })] }]);
      /* Mốc năm trước đi ở ĐUÔI, sau `bangCong` — đúng chỗ `apDungKpi` nhận
         nó, và cũng là bài kiểm ngầm cho quy ước "thêm tham số ở đuôi". */
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2'], null, null, nam);
      return b.tom_tat_kpi.vs_line_nam.L1;
    };
    const len = lam(150, { L1: 100 });
    ok('150 so với 100 = +50%', len.vs_nam_truoc_pt, 50);
    ok('  · số năm trước đi kèm để màn hình nói ra được', len.doanh_so_nam_truoc, 100);
    ok('tụt thì ra số ÂM', lam(80, { L1: 100 }).vs_nam_truoc_pt, -20);

    /* Cùng CA ĐÁNG GIÁ NHẤT của "Vs. Tháng trước": một line năm ngoái có
       bán, năm nay không có đơn nào. Nó không có mục trong `tom_tat_kpi.line`
       nên cột phải đọc từ bảng riêng, không từ bản kê ấy. */
    ok('line năm nay không bán gì vẫn ra −100%', lam(null, { L1: 500 }).vs_nam_truoc_pt, -100);

    /* Ba trạng thái tách bạch, đúng như cột "Vs. Tháng trước". */
    const khong = lam(100, null);
    ok('không đọc được kỳ năm trước: cả hai trường đều null',
       [khong.doanh_so_nam_truoc, khong.vs_nam_truoc_pt], [null, null]);
    const khong0 = lam(100, { L1: 0 });
    ok('năm trước = 0đ: KHÔNG chia được...', khong0.vs_nam_truoc_pt, null);
    ok('  · nhưng số năm trước là 0 THẬT, để màn hình hiện "mới"',
       khong0.doanh_so_nam_truoc, 0);

    /* HAI CỘT KHÔNG ĐƯỢC LẪN NHAU. Truyền hai mốc KHÁC nhau và đòi hai con
       số khác nhau — bài này bắt đúng lỗi copy-nhầm-tên-trường, thứ mà một
       bài chỉ kiểm một cột sẽ không thấy. */
    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 200,
      dong: [dong({ tong_ban: 200, loi_nhuan: 0 })] }]);
    P.apDungKpi(b2, BANG, '2026-09', {}, ['L1'], { L1: 100 }, null, { L1: 400 });
    ok('tháng trước 100 → +100%', b2.tom_tat_kpi.vs_line.L1.vs_thang_truoc_pt, 100);
    ok('năm trước 400 → −50%, KHÔNG lẫn sang mốc kia',
       b2.tom_tat_kpi.vs_line_nam.L1.vs_nam_truoc_pt, -50);
    ok('hàng TỔNG cũng mang cả hai mốc',
       [b2.tom_tat_kpi.tong.vs_thang_truoc_pt, b2.tom_tat_kpi.tong.vs_nam_truoc_pt],
       [100, -50]);
  }

  /* ─────────── G2b. "Tính tới hôm nay" (MTD) ─────────── */

  console.log('\nG2b) Tính tới hôm nay — cắt mốc rồi mới cộng (chốt 15/09/2026)');
  {
    /* Kỳ đang xem là 2026-09, hôm nay 15/09. Line L1 bán 100 trong kỳ.
       Tháng trước bán 60 trong nửa đầu và 140 trong nửa sau — trọn tháng 200,
       nhưng tới ngày 15 mới có 60. Hai vế phải ra hai con số KHÁC nhau:
       −50% nếu so cả tháng, +66,7% nếu so cùng số ngày. Đây đúng là vấn đề
       chủ dự án nêu ("so full tháng thì chắc chắn thấp hơn"). */
    const theoNgay = { L1: { '2026-08-10': 60, '2026-08-20': 140 } };
    const lam = (homNay, ky) => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: 0 })] }]);
      P.apDungKpi(b, BANG, ky || '2026-09', {}, ['L1'], { L1: 200 }, null, null,
        { ngay_hom_nay: homNay, ky_truoc_theo_ngay: theoNgay, nam_truoc_theo_ngay: null });
      return b.tom_tat_kpi;
    };

    const t = lam('2026-09-15');
    ok('vế cả tháng vẫn là cả tháng', t.vs_line.L1.vs_thang_truoc_pt, -50);
    ok('vế tới hôm nay chỉ cộng tới 15/08', t.vs_line.L1.doanh_so_ky_truoc_mtd, 60);
    ok('  · nên ra +66,7% chứ không phải −50%',
       t.vs_line.L1.vs_thang_truoc_mtd_pt, 66.67);
    ok('Engine nói ra mốc đã cắt, để màn hình biết có vế thứ hai hay không',
       t.moc_mtd, '2026-09-15');

    /* Ngày mốc phải TÍNH VÀO, không bị bỏ. Cắt "< mốc" thay vì "<= mốc" là
       mất trọn một ngày bán ở cả hai vế so sánh, im lặng. */
    const bienTren = (() => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: 0 })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1'], { L1: 200 }, null, null,
        { ngay_hom_nay: '2026-09-10',
          ky_truoc_theo_ngay: { L1: { '2026-08-10': 60 } }, nam_truoc_theo_ngay: null });
      return b.tom_tat_kpi.vs_line.L1.doanh_so_ky_truoc_mtd;
    })();
    ok('ngày ĐÚNG BẰNG mốc vẫn được tính vào', bienTren, 60);

    /* LỖI ĐÃ VIẾT RA RỒI BỊ BẮT LẠI, ghim để không tái diễn: so CẢ CHUỖI
       "YYYY-MM-DD" thay vì so ngày-trong-tháng. Mốc "2026-09-15" và ngày
       "2026-08-20" — so cả chuỗi thì 08 < 09 nên ngày 20/08 lọt vào phép
       cộng "tới ngày 15", và vế MTD ra đúng bằng vế cả tháng. Cột mới thành
       một bản sao vô nghĩa của cột cũ, không có gì báo.

       Bài này chỉ xanh khi phép cắt so NGÀY TRONG THÁNG: 20 > 15 nên ngày
       20/08 bị loại, còn lại đúng 60. */
    ok('cắt theo NGÀY TRONG THÁNG, không so cả chuỗi ngày (hai vế khác tháng)',
       t.vs_line.L1.doanh_so_ky_truoc_mtd < 200, true);

    /* KỲ ĐÃ ĐÓNG SỔ: không gắn vế MTD. "Tới hôm nay" của một tháng đã qua
       chính là trọn tháng, và in hai con số bằng hệt nhau chỉ tổ làm người
       đọc đi tìm chỗ khác biệt. */
    const cu = lam('2026-09-15', '2026-08');
    ok('kỳ không chứa hôm nay thì KHÔNG có mốc', cu.moc_mtd, null);
    ok('  · và không gắn vế MTD vào ô nào',
       cu.vs_line.L1.doanh_so_ky_truoc_mtd, undefined);

    /* Không có bản kê ngày (Engine cũ, đường lùi của Gateway) thì cũng
       KHÔNG gắn — cột về đúng hành vi cũ, không phải một con số sai. */
    const khongHat = (() => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: 0 })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1'], { L1: 200 }, null, null,
        { ngay_hom_nay: '2026-09-15', ky_truoc_theo_ngay: null, nam_truoc_theo_ngay: null });
      return b.tom_tat_kpi.vs_line.L1;
    })();
    ok('thiếu bản kê ngày thì không gắn vế MTD',
       khongHat.doanh_so_ky_truoc_mtd, undefined);
    ok('  · nhưng vế cả tháng vẫn nguyên', khongHat.vs_thang_truoc_pt, -50);

    /* Hàng TỔNG cộng MỌI line của bảng mốc, đúng kỷ luật vế cả tháng đang
       theo — lọc theo line có đơn tháng này là so một tháng đủ với một tháng
       đã bị cắt bớt. */
    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
      dong: [dong({ tong_ban: 100, loi_nhuan: 0 })] }]);
    P.apDungKpi(b2, BANG, '2026-09', {}, ['L1'], { L1: 200 }, null, null,
      { ngay_hom_nay: '2026-09-15',
        ky_truoc_theo_ngay: { L1: { '2026-08-10': 60 }, L2: { '2026-08-12': 40 } },
        nam_truoc_theo_ngay: null });
    ok('hàng TỔNG cộng cả line tháng này không có đơn (L2)',
       b2.tom_tat_kpi.tong.doanh_so_ky_truoc_mtd, 100);
  }

  /* ─────────── G2c. Tiến độ thời gian + tỉ suất dưới mục tiêu ─────────── */

  console.log('\nG2c) Tiến độ tháng và tỉ suất dưới hệ số (chốt 17/09/2026)');
  {
    const lam = (homNay, ky, heSo, loiNhuan) => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: loiNhuan })] }]);
      P.apDungKpi(b, { mac_dinh: { L1: { kpi: 1000, he_so_pt: heSo } }, ky: {} },
        ky, {}, ['L1'], null, null, null, { ngay_hom_nay: homNay });
      return b.tom_tat_kpi;
    };

    /* Chủ dự án nêu nguyên văn: "ngày 15 là đã 50% thời gian của tháng rồi".
       Tháng 9 có 30 ngày, nên 15/30 = 50%. Ngày hôm nay TÍNH VÀO. */
    ok('15/09 trong tháng 30 ngày = 50% tiến độ',
       lam('2026-09-15', '2026-09', 10, 0).tien_do_pt, 50);
    /* Tháng 31 ngày ra một con số KHÁC — bài này chỉ xanh khi mẫu số lấy
       đúng số ngày của chính tháng ấy, không gõ cứng 30. */
    ok('15/08 trong tháng 31 ngày KHÁC 50%',
       lam('2026-08-15', '2026-08', 10, 0).tien_do_pt, 48.39);
    /* Tháng 2 năm nhuận: 29 ngày. `Date.UTC(nam, thang, 0)` biết năm nhuận,
       không phải gõ bảng. */
    ok('29/02/2028 (năm nhuận) = 100% tiến độ',
       lam('2028-02-29', '2028-02', 10, 0).tien_do_pt, 100);
    ok('ngày cuối tháng = 100%', lam('2026-09-30', '2026-09', 10, 0).tien_do_pt, 100);

    /* Kỳ đã đóng sổ: KHÔNG xét tiến độ. "Kịp tiến độ" của một tháng đã qua
       chính là "đạt 100%", thứ ba mức tô cũ đã nói rồi. */
    ok('kỳ không chứa hôm nay thì không có tiến độ',
       lam('2026-09-15', '2026-08', 10, 0).tien_do_pt, null);
    /* Không có mốc nào (bản Gateway cũ chưa truyền) cũng vậy. */
    ok('thiếu mốc hôm nay thì cũng null', (() => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: 0 })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1'], null, null, null, null);
      return b.tom_tat_kpi.tien_do_pt;
    })(), null);

    /* Tỉ suất thực so với hệ số quy đổi MỤC TIÊU của line. */
    ok('lãi 6 trên 100 với hệ số 7,5% → DƯỚI mục tiêu',
       lam('2026-09-15', '2026-09', 7.5, 6).line.L1.ty_suat_duoi_he_so, true);
    ok('lãi 9 trên 100 với hệ số 7,5% → đạt mục tiêu',
       lam('2026-09-15', '2026-09', 7.5, 9).line.L1.ty_suat_duoi_he_so, false);
    /* ĐÚNG BẰNG hệ số KHÔNG phải "dưới" — biên phải rõ, không thì một line
       bán đúng tỉ suất mục tiêu vẫn bị bôi đỏ. */
    ok('lãi đúng 7,5 trên 100 → KHÔNG dưới mục tiêu',
       lam('2026-09-15', '2026-09', 7.5, 7.5).line.L1.ty_suat_duoi_he_so, false);
    /* `null` chứ không `false` khi thiếu một vế: "chưa biết" và "đạt mục
       tiêu" là hai chuyện khác nhau, và tô trắng cho cả hai thì người đọc
       không phân biệt được. */
    ok('chưa đặt hệ số thì null, KHÔNG phải false',
       lam('2026-09-15', '2026-09', 0, 6).line.L1.ty_suat_duoi_he_so, null);
    /* Hàng TỔNG không có một hệ số duy nhất nên KHÔNG mang cờ này. */
    ok('hàng TỔNG không mang cờ dưới-hệ-số',
       lam('2026-09-15', '2026-09', 7.5, 6).tong.ty_suat_duoi_he_so, undefined);
  }

  /* ─────────── G3. Tỉ suất lợi nhuận ─────────── */

  console.log('\nG3) Tỉ suất LN — lợi nhuận ÷ doanh số thuần (chốt 15/09/2026)');
  {
    const lam = (tongBan, loiNhuan) => {
      const b = bang(tongBan === null ? [] : [{ so_ct: 'BH1', line: 'L1', tong_ban: tongBan,
        dong: [dong({ tong_ban: tongBan, loi_nhuan: loiNhuan })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1'], null, null, null);
      return b.tom_tat_kpi;
    };
    ok('lãi 10 trên doanh số 100 = 10%', lam(100, 10).line.L1.ty_suat_loi_nhuan_pt, 10);
    ok('  · và hàng TỔNG ra cùng con số', lam(100, 10).tong.ty_suat_loi_nhuan_pt, 10);

    /* Bán mà không lãi đồng nào là 0% THẬT — khác hẳn "chưa bán gì". Hai ca
       này ra hai thứ khác nhau, và gộp chúng làm một là cột nói dối. */
    ok('bán mà không lãi = 0%, không phải "—"', lam(100, 0).line.L1.ty_suat_loi_nhuan_pt, 0);
    ok('chưa bán gì thì KHÔNG có mục nào để mà chia',
       Object.keys(lam(null, 0).line), []);
    ok('  · và hàng TỔNG để null, không phải 0',
       lam(null, 0).tong.ty_suat_loi_nhuan_pt, null);

    /* Lỗ ra số ÂM, và đó là sự thật chứ không phải lỗi — không được kẹp về 0. */
    ok('bán lỗ ra số ÂM', lam(100, -20).line.L1.ty_suat_loi_nhuan_pt, -20);
  }

  console.log('\nH) "Chưa có số để so" và "tháng trước bằng 0" là HAI ca khác nhau');
  {
    const lam = (truoc) => {
      const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
        dong: [dong({ tong_ban: 100, loi_nhuan: 10 })] }]);
      P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2'], truoc);
      return b.tom_tat_kpi.vs_line.L1;
    };
    const khong = lam(null);
    ok('không đọc được kỳ trước: cả hai trường đều null',
       [khong.doanh_so_ky_truoc, khong.vs_thang_truoc_pt], [null, null]);

    const bangKhong = lam({ L1: 0 });
    ok('tháng trước = 0đ: KHÔNG chia được...', bangKhong.vs_thang_truoc_pt, null);
    ok('  · nhưng số tháng trước là 0 THẬT, để màn hình hiện "mới"',
       bangKhong.doanh_so_ky_truoc, 0);

    const vangLine = lam({ L2: 500 });
    ok('kỳ trước có bảng nhưng line này chưa có mặt → null',
       vangLine.doanh_so_ky_truoc, null);

    /* Bảng `vs_line` phải phủ MỌI line chính thức, kể cả line chưa bao giờ
       chạy — nếu không, hàng của nó thiếu ô và cả bảng lệch cột. */
    const b = bang([]);
    P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2', 'L3'], null);
    ok('phủ đủ mọi line chính thức', Object.keys(b.tom_tat_kpi.vs_line).sort(),
       ['L1', 'L2', 'L3']);
  }

  /* ─────────── I. Sắp theo doanh số, ở ENGINE ─────────── */

  console.log('\nI) Thứ tự line: doanh số thuần GIẢM DẦN, do Engine sắp');
  {
    const b = bang([
      { so_ct: 'BH1', line: 'L1', tong_ban: 10, dong: [dong({ tong_ban: 10 })] },
      { so_ct: 'BH2', line: 'L2', tong_ban: 90, dong: [dong({ tong_ban: 90 })] },
    ]);
    P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2', 'L3']);
    ok('L2 bán nhiều hơn nên đứng trước, dù khai sau',
       b.tom_tat_kpi.thu_tu, ['L2', 'L1', 'L3']);

    /* Line chưa có đơn nào VẪN có mặt — `thu_tu` là danh sách line CHÍNH
       THỨC, và một line mới mở phải hiện ra với số 0 chứ không biến mất
       (cùng lý do `line.mjs` khai tường minh). */
    ok('line 0 đồng vẫn còn trong danh sách', b.tom_tat_kpi.thu_tu.includes('L3'), true);

    /* Hoà thì giữ thứ tự khai — nếu không, mọi line 0 đồng sẽ xáo lại mỗi
       lượt mở và bảng "nhảy" mà không có lý do nào. */
    const b2 = bang([]);
    P.apDungKpi(b2, BANG, '2026-09', {}, ['A', 'B', 'C']);
    ok('hoà (mọi line 0đ) → giữ nguyên thứ tự khai', b2.tom_tat_kpi.thu_tu, ['A', 'B', 'C']);
  }

  console.log('\nJ) Màn hình KHÔNG tự sắp, KHÔNG tự cộng');
  {
    ok('màn hình đọc thứ tự từ tom_tat_kpi.thu_tu',
       /tkpi && Array\.isArray\(tkpi\.thu_tu\)/.test(UI), true);
    /* Không có phép sắp xếp nào trong `veTongHop` — nếu có, đó là bản luật
       thứ hai cạnh bản Engine, và chỗ hai bản trôi khỏi nhau là chỗ hai màn
       đọc ra hai thứ hạng. */
    const ve = UI.match(/function veTongHop[\s\S]*?\n  \}\n/);
    ok('cắt được hàm veTongHop', !!ve, true);
    ok('  · và nó KHÔNG gọi .sort() lần nào', /\.sort\(/.test(ve ? ve[0] : '.sort('), false);
    ok('hàng TỔNG vẫn đọc tom_tat_kpi.tong', /tkpi \? tkpi\.tong : null/.test(UI), true);
  }

  /* ─────────── K. 15 cột, đúng thứ tự ─────────── */

  console.log('\nK) Đúng 18 cột, đúng thứ tự (chốt 12/09/2026, nới 15/09/2026)');
  {
    const kh = UI.match(/const COT_TONG_HOP = \[([\s\S]*?)\n    \];/);
    ok('tìm thấy danh sách cột', !!kh, true);
    const ten = [...(kh ? kh[1] : '').matchAll(/ten: "([^"]+)"/g)].map(m => m[1]);
    ok('đúng 18 cột', ten.length, 18);
    ok('đúng thứ tự, đúng tên', ten, [
      'Line', 'Số đơn', 'Số sản phẩm', 'Doanh số thuần',
      'Lợi nhuận', 'Quy đổi', 'Tỉ suất LN', 'Tỉ lệ tồn kho',
      'KPI', 'Đạt', 'Vs. Tháng trước', 'Vs. Năm trước',
      'Thưởng', 'Ngày công', 'Lương cứng',
      'Phụ cấp', 'Tổng lương', 'Ghi chú',
    ]);
    /* Tỉ suất LN đứng NGAY SAU Quy đổi, tức ngay cạnh hai cột nó chia —
       Lợi nhuận và Doanh số thuần cách nó đúng một ô. Đối chiếu tay không
       phải rê mắt qua nửa bảng. */
    ok('Tỉ suất LN đứng ngay sau Quy đổi',
       ten.indexOf('Tỉ suất LN'), ten.indexOf('Quy đổi') + 1);
    /* Và "So với năm trước" đứng NGAY SAU "Vs. Tháng trước": hai cột trả lời
       hai câu cùng dạng, đọc cạnh nhau mới so được đà ngắn hạn với mùa vụ. */
    ok('So với năm trước đứng ngay sau Vs. Tháng trước',
       ten.indexOf('Vs. Năm trước'), ten.indexOf('Vs. Tháng trước') + 1);
    /* Tên cột KHÔNG còn mang "(nghìn đ)" (chủ dự án chốt 12/09/2026), và
       đoạn giải thích dưới bảng cũng bỏ — nên đơn vị chỉ còn MỘT chỗ để nói:
       đầu `title` của chính cột tiền ấy. Mất nó là bảng không còn nói đơn vị
       ở đâu cả, và một cột tiền không đơn vị là một cột đọc sai 1.000 lần. */
    const kh2 = kh ? kh[1] : '';
    for (const c of ['Doanh số thuần', 'Lợi nhuận', 'Quy đổi', 'KPI',
                     'Thưởng', 'Lương cứng', 'Phụ cấp', 'Tổng lương']) {
      ok('cột "' + c + '" nói đơn vị ở title',
         new RegExp('ten: "' + c + '"[\\s\\S]{0,80}?gt: "Nghìn đồng\\.').test(kh2), true);
    }
    ok('không còn đoạn giải thích dưới bảng',
       /Line sắp theo doanh số thuần giảm dần/.test(UI), false);
    /* Cột "Hệ số" bỏ khỏi bảng này (chủ dự án chốt) — nó vẫn xem và sửa được
       trên dải setup của từng tab line, nên không mất đường vào. */
    ok('cột "Hệ số" đã bỏ khỏi [Tổng hợp]', ten.includes('Hệ số'), false);
    ok('  · nhưng dải setup của tab line vẫn còn', /function veDaiKpi/.test(UI), true);

    ok('cột Quy đổi có highlight (CSS)',
       /\.bangTongHop td\.oQuyDoi/.test(CSS), true);
    ok('  · và ô của nó mang đúng lớp ấy', /"oSo oQuyDoi"/.test(UI), true);
  }

  console.log('\nL) Màn hình KHÔNG giữ bản thứ hai của luật lương');
  {
    /* LUẬT SỐ 1, và ở đây nó có một hệ quả rất cụ thể: chủ dự án chốt "nhập
       hệ số là hệ thống tự hiểu cách tính, không phải code lại". Một con số
       lương nào lọt vào trình duyệt là một bản luật thứ hai, và nó sẽ trôi
       khỏi bản Engine đúng lúc chủ dự án đổi mức. */
    /* Soi trên MÃ THẬT, đã bỏ chú thích và mọi chuỗi ký tự: con số 26 có mặt
       hợp lệ trong câu giải thích ở `title` ("30 một ngày công, TRẦN ở 26
       ngày") — đó là nói cho người dùng biết luật, không phải chạy luật. Thứ
       phải cấm là một hằng số lương nằm trong một PHÉP TÍNH. */
    const ma = UI
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const so of ['4500', '4_500_000', '4500000', '30000', '1500000000',
                      '0.15', '0.45', '0.005']) {
      ok('mã màn hình không mang hằng số lương `' + so + '`',
         new RegExp('[^\\w.]' + so.replace(/[.]/g, '\\.') + '[^\\w]').test(ma), false);
    }
    ok('  · không chia cho 26 ngày công', /[/*]\s*26\b/.test(ma), false);
    ok('  · và không tự nhân doanh số quy đổi với hệ số nào',
       /doanh_so_quy_doi\s*\*/.test(ma), false);
    ok('màn hình chỉ ĐỌC bản kê lương của Engine', /tkpi\.luong/.test(UI), true);

    /* Ba câu trống khác nhau cho ba lý do khác nhau — cùng kỷ luật "0 đồng
       khác chưa biết" của cả repo. */
    ok('nói được "line này không tính lương"',
       /không phải 7,5% \(cách A\) hay 5,5%/.test(UI), true);
    ok('nói được "chưa nhập ngày công"', /Chưa nhập ngày công/.test(UI), true);
    ok('nói được "chưa có quy đổi nên chưa tính được thưởng"',
       /chưa tính được thưởng — khác với không được/.test(UI), true);
  }

  /* ─────────── M. Nguồn số của bảng, và đường Gateway ─────────── */

  console.log('\nM) Mọi con số của bảng đọc từ tom_tat_kpi (đã trừ xoá tay)');
  {
    /* Bản trước P6 lấy doanh số/số đơn từ `tom_tat_line` — thứ cộng thẳng
       `bc/dong` THÔ, nên một dòng đã xoá tay vẫn nằm trong đó và cột Doanh số
       ở [Tổng hợp] kể nhiều tiền hơn chính tab của line ấy. */
    const ve = UI.match(/function veTongHop[\s\S]*?\n  \}\n/);
    const than = ve ? ve[0] : '';
    ok('không còn đọc tom_tat_line.line để lấy tiền',
       /tom_tat_line\.line\[/.test(than), false);
    ok('  · chỉ còn dùng nó làm danh sách line dự phòng',
       /kq\.tom_tat_line\.thu_tu/.test(than), true);
  }

  console.log('\nN) Gateway lấy kỳ trước ĐÚNG cách');
  {
    ok('có hàm tính kỳ liền trước', /function kyTruoc\(ky\)/.test(GW), true);
    /* Bắc qua mốc năm là ca duy nhất dễ sai, và nó chỉ xảy ra một lần mỗi
       năm — tức nếu sai thì không ai phát hiện trong 11 tháng. */
    const ky = new Function(GW.match(/function kyTruoc\(ky\)[\s\S]*?\n\}/)[0] + '; return kyTruoc;')();
    ok('2026-09 → 2026-08', ky('2026-09'), '2026-08');
    ok('2026-01 → 2025-12 (bắc qua mốc năm)', ky('2026-01'), '2025-12');
    ok('2026-11 → 2026-10 (giữ hai chữ số)', ky('2026-11'), '2026-10');

    /* Không ghim chữ `await`: từ 12/09/2026 lượt đọc này chạy trong cùng
       `Promise.all` với bảy lượt kia (bỏ 3–4 giây xếp hàng mỗi lần đổi tab),
       nên nó KHÔNG còn được await tại chỗ. Điều phải canh vẫn y nguyên và
       mới là điều đáng canh: ở tab của một line thì KHÔNG gọi nó chút nào —
       cột "Vs. Tháng trước" không có mặt ở đó, và lấy nó ở mọi lượt là bắt
       mỗi lần mở một tab line trả thêm mấy lượt đọc cho một con số không ai
       nhìn. */
    /* Từ 15/09/2026 là HAI lượt đọc — kỳ liền trước và cùng tháng năm trước
       — nên đếm cả hai: bỏ sót một cái là tab line lại phải trả thêm một
       lượt đọc Firebase cho con số không ai nhìn ở đó. */
    ok('chỉ lấy khi ở tab [Tổng hợp], không lấy ở tab line',
       (GW.match(/line\s*\?\s*null\s*:\s*(await\s+)?docDoanhSoLineMoc/g) || []).length, 2);
    ok('  · một lượt cho kỳ liền trước, một lượt cho cùng tháng năm trước',
       /docDoanhSoLineMoc\(env, kyTruoc\(ky\)[\s\S]{0,600}docDoanhSoLineMoc\(env, namTruoc\(ky\)/.test(GW), true);
    /* `namTruoc` chỉ trừ NĂM, không đụng tháng — 2026-01 phải ra 2025-01 chứ
       không phải 2025-12. Lẫn nó với `kyTruoc` là cột mùa vụ so nhầm mốc. */
    ok('  · namTruoc() giữ nguyên tháng, chỉ lùi năm',
       /return String\(nam - 1\)\.padStart\(4, "0"\) \+ "-" \+ ky\.slice\(5, 7\);/.test(GW), true);
    /* Nguồn hỏng thì cột để trống, KHÔNG chặn cả bảng đơn — cùng kỷ luật với
       bảng KPI của P5. */
    ok('kỳ trước đọc hỏng thì trả null, không ném',
       /catch \(e\) \{[\s\S]{0,300}\(nhan \|\| "ky-truoc"\) \+ "-hong:"[\s\S]{0,120}return null;/.test(GW), true);
    /* Trừ phần xoá tay: không trừ thì tháng trước đọc ra con số CAO HƠN thứ
       chính màn hình ấy hiện khi mở tháng đó. */
    ok('trừ phần xoá tay trước khi cộng', /tinhTruXoaTay\(env, mot\)/.test(GW), true);
    /* Gọi hàm Engine ĐÃ CÓ (bẫy số 4): hàm mới thì Gateway mới gọi vào Engine
       cũ sẽ nổ 503 giữa hai lượt deploy song song. */
    ok('dùng gopTheoLine đã có sẵn từ P2',
       /REPORT_ENGINE\.gopTheoLine\(cay, bangLine\)/.test(GW), true);
    /* Bẫy số 4 dưới dạng một bài kiểm: mọi tham số THÊM VÀO phải nối vào
       ĐUÔI chữ ký, không chèn vào giữa. Chèn giữa là bản Gateway cũ (còn
       đang chạy trong khoảng hai lượt deploy song song) gọi lệch chỗ mọi
       tham số sau đó — tức truyền bảng KPI vào ô của bảng giá. Bài này đỏ
       mỗi lần có người thêm tham số, và đó là chủ ý: nó bắt người sửa nhìn
       lại cái đuôi. */
    const ENG = doc('engine/src/index.js');
    ok('dungBangDonKemMa nhận tham số mới ở ĐUÔI',
       /dungBangDonKemMa\([^)]*quyetDinhBonus, doanhSoLineNamTruoc, mtd\)/.test(ENG), true);
    ok('dungBangDonSuaTay cũng vậy',
       /dungBangDonSuaTay\([^)]*quyetDinhBonus, doanhSoLineNamTruoc, mtd\)/.test(ENG), true);
    /* Và `apDungKpi` cũng nhận nó ở đuôi, SAU `bangCong`. Chèn vào giữa —
       cạnh `doanhSoLineKyTruoc`, chỗ nó thuộc về về nghĩa — là `bangCong`
       nhận nhầm bảng doanh số, và lương cả công ty sai trong im lặng. */
    ok('apDungKpi cũng nhận nó SAU bangCong, không chèn cạnh kỳ trước',
       /apDungKpi\(bang, bangKpi, ky, giaDung, thuTu, doanhSoLineKyTruoc, bangCong,\s*\n?\s*doanhSoLineNamTruoc, mtd\)/
         .test(doc('engine/src/kpi.mjs')), true);
  }

  /* ─────────── O. Hàng TỔNG ─────────── */

  console.log('\nO) Hàng TỔNG — Engine cộng, và cộng ĐÚNG phần nào');
  {
    const b = bang([
      { so_ct: 'BH1', line: 'L1', tong_ban: 100, dong: [
        dong({ so_luong: 2, tong_ban: 100, loi_nhuan: 10, noi_nhap: 'Kho' }) ] },
      { so_ct: 'BH2', line: 'L2', tong_ban: 100, dong: [
        dong({ so_luong: 3, tong_ban: 100, loi_nhuan: 20, noi_nhap: 'Việt Hải' }) ] },
    ]);
    P.apDungKpi(b, BANG, '2026-09', {}, ['L1', 'L2'], { L1: 50, L2: 150 });
    const t = b.tom_tat_kpi.tong;
    ok('tổng số sản phẩm', t.so_san_pham, 5);
    ok('tổng lợi nhuận', t.loi_nhuan, 30);
    ok('tỉ lệ tồn kho của cả công ty (100/200)', t.ty_le_ton_kho_pt, 50);
    /* Tháng trước của CẢ CÔNG TY cộng MỌI line trong bảng kỳ trước — lọc
       theo line có mặt tháng này là so một tháng đủ với một tháng bị cắt
       bớt, và con số chênh dương lên đúng bằng phần bị cắt. */
    ok('tháng trước cộng cả hai line (50+150)', t.doanh_so_ky_truoc, 200);
    ok('  · 200 so với 200 = 0%', t.vs_thang_truoc_pt, 0);
  }

  console.log('\nO2) Tổng giá TRỊ nhập/bán — Σ(đơn giá × SL), không phải Σ đơn giá');
  {
    /* Chủ dự án chốt 13/09/2026: dòng tổng của bảng cần "tổng giá nhập" và
       "tổng giá bán". Cộng thẳng đơn giá của một cái TV với đơn giá của một
       cái tủ lạnh không ra một khoản tiền có nghĩa — phải nhân với SL trước
       khi cộng. */
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 200, dong: [
      dong({ so_luong: 2, gia_ban: 100, gia_nhap: 60, tong_ban: 200, loi_nhuan: 80 }),
    ] }]);
    P.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const o = b.tom_tat_kpi.line.L1;
    ok('tổng giá bán = Σ(giá bán × SL) = 100×2', o.tong_gia_ban, 200);
    ok('tổng giá nhập = Σ(giá nhập × SL) = 60×2', o.tong_gia_nhap, 120);
    ok('không dòng nào thiếu giá nhập', o.dong_thieu_gia_nhap, 0);

    /* Chiết khấu/phụ phí không phải mặt hàng — cùng luật với "Số sản phẩm"
       ở mục A: kể chúng vào đây là cộng một đơn giá không hề tồn tại. */
    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 90, dong: [
      dong({ so_luong: 1, gia_ban: 100, gia_nhap: 60, tong_ban: 100, loi_nhuan: 40 }),
      dong({ so_luong: 1, gia_ban: -10, gia_nhap: null, tong_ban: -10, loi_nhuan: -10,
        la_chiet_khau: true }),
    ] }]);
    P.dienDoanhSoQuyDoi(b2, BANG, '2026-09', {});
    const o2 = b2.tom_tat_kpi.line.L1;
    ok('chiết khấu KHÔNG vào tổng giá bán (chỉ 100, không trừ/cộng -10)', o2.tong_gia_ban, 100);
    ok('  · và không bị đếm là "thiếu giá nhập"', o2.dong_thieu_gia_nhap, 0);

    /* `gia_nhap: null` (kỳ ngoài phạm vi khớp mã, hoặc dòng chưa tra ra giá)
       phải bị BỎ QUA khỏi tổng — cộng null×SL ra NaN sẽ làm hỏng lây sang
       tổng của những dòng khác cộng chung, và NaN thì không tự biết dừng ở
       đâu. Đếm RIÊNG số dòng thiếu, cùng kỷ luật "cộng phần biết được, đếm
       riêng phần thiếu" đang chạy cho lợi nhuận. */
    const b3 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 250, dong: [
      dong({ so_luong: 2, gia_ban: 100, gia_nhap: 60, tong_ban: 200, loi_nhuan: 80 }),
      dong({ so_luong: 1, gia_ban: 50, gia_nhap: null, tong_ban: 50, loi_nhuan: null }),
    ] }]);
    P.dienDoanhSoQuyDoi(b3, BANG, '2026-09', {});
    const o3 = b3.tom_tat_kpi.line.L1;
    ok('tổng giá bán vẫn cộng đủ (200+50)', o3.tong_gia_ban, 250);
    ok('tổng giá nhập CHỈ cộng phần biết (120), không phải NaN', o3.tong_gia_nhap, 120);
    ok('  · và đếm đúng 1 dòng thiếu', o3.dong_thieu_gia_nhap, 1);
  }

  console.log('\nO3) Hàng tổng của cả bảng đơn — đọc từ tom_tat_kpi.line, không cộng lại');
  {
    const UI2 = doc('public/don-hang.js');
    /* Hàng này đứng trong <thead>, dùng CHUNG lưới 19 cột với hàng tiêu đề
       và mọi dòng chi tiết — không phải một dòng chữ tự do như băng ngày. */
    ok('hàng tổng đọc từ tom_tat_kpi.line[trangThai.line], không tự cộng',
       /const tongLine = tkpi && tkpi\.line \? tkpi\.line\[trangThai\.line\] : null;/.test(UI2), true);
    ok('  · và bị ẨN khi đang lọc (cùng luật với băng ngày, hàng tổng đơn)',
       /if \(!loc && tongLine\)/.test(UI2), true);
    ok('  · dùng chung <colgroup>, không phải colSpan tự do',
       /const trTong = el\("tr", "hangTongBang"\);[\s\S]{0,30}for \(const c of COT\)/.test(UI2), true);

    /* Ba con số phụ thuộc Tracking hiện "—" khi kỳ ngoài phạm vi hoặc nguồn
       hỏng — dùng lại CHÍNH hai cờ `kq.trong_pham_vi_ma`/`kq.loi_nguon_ma`
       đang gác mọi ô Giá nhập khác trên bảng, không phải một phép đoán mới. */
    ok('  · "CHƯA BIẾT" (kỳ ngoài phạm vi / nguồn hỏng) hiện "—", không phải 0',
       /const thieuNguon = kq\.trong_pham_vi_ma === false \|\| !!kq\.loi_nguon_ma;/.test(UI2), true);
    ok('  · Giá nhập/Lợi nhuận/Quy đổi đều đi qua cùng MỘT cửa "—"',
       (UI2.match(/thieuNguon \? "—"/g) || []).length, 1);

    /* KHÔNG tính lại quy đổi/lợi nhuận ở đây — đọc thẳng field Engine đã có
       sẵn cho dải KPI phía trên, đúng LUẬT SỐ 1. */
    ok('SL/Tổng bán/Lợi nhuận/Quy đổi đọc thẳng field có sẵn, không cộng lại',
       /"SL": soNguyen\(tongLine\.so_san_pham\)/.test(UI2)
       && /"Tổng bán": nghinTron\(tongLine\.doanh_so\)/.test(UI2), true);
  }

  console.log('\nO4) Dải KPI bỏ chữ "quy đổi" — hàng tổng đã nói thay');
  {
    const UI3 = doc('public/don-hang.js');
    /* Chủ dự án chốt 13/09/2026: con số quy đổi ở dải KPI ("Đạt X% · quy đổi
       NNN") trùng với con số hàng tổng vừa thêm — bỏ một trong hai để không
       in cùng một sự thật ở hai chỗ mà người đọc phải tự tin là chúng khớp
       nhau. Dải KPI chỉ còn giữ đúng việc của nó: phần trăm ĐẠT. */
    ok('dải KPI KHÔNG còn in "quy đổi NNN" cạnh phần trăm đạt',
       /"Đạt " \+ so1\(cua\.dat_pt\) \+ "%  ·  quy đổi "/.test(UI3), false);
    ok('  · chỉ còn đúng "Đạt X%"',
       /el\("span", "datKpi", "Đạt " \+ so1\(cua\.dat_pt\) \+ "%"\)/.test(UI3), true);
  }

    /* ─────────── P. Chạy thật hàm vẽ, soi cái nó dựng ra ───────────
   *
   * Mọi bài trên đây hoặc chạy Engine, hoặc ĐỌC mã màn hình. Cả hai đều bỏ
   * lọt đúng một lớp lỗi: hàm vẽ ném giữa chừng, hay dựng thiếu một ô — lúc
   * ấy bảng lệch cột từ chỗ đó trở đi và mọi con số đọc sang sai tên. Ba
   * trong bảy lỗi cuối P4 thuộc lớp "Engine tính đúng rồi không ai hiện ra",
   * nên bộ này chạy `veTongHop()` thật trên DOM giả, đúng lối
   * `kiem/dashboard-ve.js` đã mở đường. */

  console.log('\nP) Chạy thật veTongHop() — đủ 16 ô mỗi hàng, đúng thứ tự Engine');
  {
    const nut = () => {
      const e = {
        className: '', textContent: '', title: '', type: '', hidden: false,
        disabled: false, con: [], _l: {}, dataset: {}, style: {},
        classList: { add(c) { e.className = (e.className ? e.className + ' ' : '') + c; } },
        get innerHTML() { return ''; },
        set innerHTML(v) { e.con = []; },
        appendChild(c) { e.con.push(c); return c; },
        addEventListener(ev, f) { (e._l[ev] ||= []).push(f); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      return e;
    };
    const cay = {};
    const ctx = {
      console: { log() {} },
      document: {
        getElementById: (id) => (cay[id] ||= nut()),
        createElement: () => nut(),
        createTextNode: (t) => ({ textContent: t, con: [] }),
        addEventListener() {}, querySelectorAll: () => [],
      },
      window: { addEventListener() {}, innerHeight: 900, VAI_BAO_CAO: 'quantri' },
      firebase: { auth: () => ({ onAuthStateChanged() {} }) },
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    /* Mở đúng MỘT hàm ra khỏi closure, chỉ trong bản sao chuỗi dùng để kiểm —
       file thật không có dòng này. Thà sửa chuỗi ở đây còn hơn nới closure
       của file chạy thật chỉ để bài kiểm với tới. */
    vm.runInContext(
      UI.replace(/\}\)\(\);\s*$/, '  globalThis.__t = { veTongHop };\n})();\n'), ctx);

    const line = {
      L2: { doanh_so: 900000, so_don: 3, so_dong: 4, so_san_pham: 7, loi_nhuan: 90000,
            don_thieu_loi_nhuan: 0, doanh_so_quy_doi: 900000, don_thieu_quy_doi: 0,
            kpi: 1000000, dat_pt: 90, ty_le_ton_kho_pt: 40, doanh_so_chua_ro_nguon: 0,
            ty_suat_loi_nhuan_pt: 10, ty_suat_duoi_he_so: true, he_so_pt: 7.5,
            doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 20 },
      L1: { doanh_so: 100000, so_don: 1, so_dong: 1, so_san_pham: 1, loi_nhuan: 10000,
            don_thieu_loi_nhuan: 1, doanh_so_quy_doi: 100000, don_thieu_quy_doi: 1,
            kpi: null, dat_pt: null, ty_le_ton_kho_pt: null, doanh_so_chua_ro_nguon: 50000,
            ty_suat_loi_nhuan_pt: 10, ty_suat_duoi_he_so: false, he_so_pt: 10,
            doanh_so_ky_truoc: 0, vs_thang_truoc_pt: null },
    };
    const kq = {
      tom_tat_line: { thu_tu: ['L1', 'L2', 'L3'], line: {} },
      bang: { tom_tat_kpi: { line, thu_tu: ['L2', 'L1', 'L3'], thieu_bang: false, van_de: [],
        /* Tháng đang chạy dở, đã trôi 50% thời gian — mốc "kịp tiến độ" của
           cột Đạt (chủ dự án chốt 17/09/2026). */
        tien_do_pt: 50,
        vs_line: {
          /* Hai vế TRÁI DẤU — đúng ca cột này sinh ra để bắt: so cả tháng
             thì tụt, mà tính tới hôm nay lại tăng. Mỗi vế phải mang màu của
             RIÊNG nó, không lấy màu chung của ô. */
          L2: { doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 20,
                doanh_so_ky_truoc_mtd: 1200000, vs_thang_truoc_mtd_pt: -25 },
          L1: { doanh_so_ky_truoc: 0, vs_thang_truoc_pt: null },
          /* L3 chưa có đơn tháng này, nhưng tháng trước bán 400 — phải ra
             −100%, đúng ca mà mục G ghim ở tầng Engine. */
          L3: { doanh_so_ky_truoc: 400000, vs_thang_truoc_pt: -100 },
        },
        /* Cột "So với năm trước" (chủ dự án chốt 15/09/2026) — bảng RIÊNG,
           cùng lý do `vs_line`: nó phủ cả line tháng này không có đơn nào.
           Ba trạng thái khác nhau trên ba line, đúng ba câu màn hình phải
           nói ra. */
        vs_line_nam: {
          L2: { doanh_so_nam_truoc: 600000, vs_nam_truoc_pt: 50,
                doanh_so_nam_truoc_mtd: 300000, vs_nam_truoc_mtd_pt: 200 },
          L1: { doanh_so_nam_truoc: null, vs_nam_truoc_pt: null },
          L3: { doanh_so_nam_truoc: 0, vs_nam_truoc_pt: null },
        },
        tong: { doanh_so: 1000000, so_don: 4, so_san_pham: 8, loi_nhuan: 100000,
                doanh_so_quy_doi: 1000000, kpi: 1000000, dat_pt: 100,
                ty_le_ton_kho_pt: 36, doanh_so_chua_ro_nguon: 50000,
                ty_suat_loi_nhuan_pt: 10,
                doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 33.3,
                doanh_so_nam_truoc: 800000, vs_nam_truoc_pt: 25,
                doanh_so_ky_truoc_mtd: 500000, vs_thang_truoc_mtd_pt: 100,
                doanh_so_nam_truoc_mtd: 500000, vs_nam_truoc_mtd_pt: 100 },
        luong: {
          line: {
            L2: { cach: 'B', he_so_thuong_pt: 0.45, moc_nong: 1,
                  nguong_nong: 1500000000, thuong_nong: 500000, thuong: 4550000,
                  ngay_cong: 28, luong_cung: 4846153.85, phu_cap: 780000,
                  tong_luong: 10176153.85 },
            /* L1 — đã nhận ra bậc, nhưng kỳ này chưa có quy đổi nên thưởng
               CHƯA BIẾT, và ngày công thì chưa ai nhập. Hai lý do trống khác
               nhau nằm trên cùng một hàng. */
            L1: { cach: 'A', he_so_thuong_pt: null, moc_nong: 0, nguong_nong: null,
                  thuong_nong: null, thuong: null,
                  ngay_cong: null, luong_cung: null, phu_cap: null, tong_luong: null },
          },
          tong: { thuong: 4550000, luong_cung: 4846153.85, phu_cap: 780000,
                  tong_luong: 10176153.85 },
        } } },
    };
    const ve = nut();
    ctx.__t.veTongHop(ve, kq);

    const boc = ve.con.find((c) => c.className === 'bocBangNho');
    ok('bảng nằm trong khung cuộn ngang', !!boc, true);
    const b = boc.con[0];
    ok('bảng mang lớp riêng của [Tổng hợp]', b.className, 'bangNho bangTongHop');
    /* L3 KHÔNG có đơn nào trong kỳ nên bị GIẤU (chủ dự án chốt 12/09/2026),
       cùng luật và cùng công tắc "Hiện thêm N line chưa có đơn" với hàng tab
       ngay trên bảng — giấu ở hàng tab mà vẫn để trong bảng là hai màn hình
       nói hai chuyện. */
    ok('3 hàng: tiêu đề + 2 line CÓ đơn + TỔNG', b.con.length, 4);
    ok('  · line không có đơn nào bị giấu khỏi bảng',
       b.con.map((r) => r.con[0].textContent).includes('L3'), false);
    /* Lệch một ô ở một hàng là mọi con số từ đó trở đi đọc sang sai tên cột —
       lớp lỗi mà chỉ chạy thật mới thấy. */
    /* Hàng tiêu đề có 18 Ô nhưng phủ 20 CỘT (hai ô mang colSpan = 2); hàng
       thân có đủ 20 ô. Lệch một ô ở một hàng là mọi con số từ đó trở đi đọc
       sang sai tên cột — lớp lỗi chỉ chạy thật mới thấy. */
    ok('hàng tiêu đề 18 ô, phủ đủ 20 cột',
       [b.con[0].con.length,
        b.con[0].con.reduce((t, c) => t + (c.colSpan || 1), 0)], [18, 20]);
    ok('MỌI hàng thân đều đúng 20 ô',
       b.con.slice(1).map((r) => r.con.length), [20, 20, 20]);

    const chu = (i) => b.con[i].con.map((c) => c.textContent);
    /* Tra ô theo TÊN CỘT, đọc từ chính hàng tiêu đề — không gõ cứng chỉ số.
       Bản trước gõ cứng, và lượt thêm hai cột (Tỉ suất LN · So với năm
       trước, 15/09/2026) làm HAI MƯƠI bài đỏ cùng lúc dù không bài nào hỏng
       thật: mọi chỉ số từ cột thứ sáu trở đi trượt đi một hoặc hai chỗ. Tra
       theo tên thì bài chỉ đỏ khi đúng thứ nó canh sai. */
    /* Chỉ số Ô THÂN của một cột — cộng dồn `colSpan` của các tiêu đề đứng
       trước. Từ 17/09/2026 hai cột so sánh mang `colSpan = 2` (ô trái cả
       tháng, ô phải tới hôm nay), nên chỉ số TIÊU ĐỀ không còn bằng chỉ số ô
       THÂN — lấy thẳng chỉ số tiêu đề là mọi cột sau chúng đọc lệch. */
    const iC = (ten) => {
      let i = 0;
      for (const c of b.con[0].con) {
        if (c.textContent === ten) return i;
        i += c.colSpan || 1;
      }
      throw new Error('không thấy cột "' + ten + '" trên hàng tiêu đề');
    };
    const oCua = (hang, ten) => b.con[hang].con[iC(ten)];
    /* Ô PHỤ của một cột so sánh — vế "tới hôm nay", ngay bên phải ô chính. */
    const oPhuCua = (hang, ten) => b.con[hang].con[iC(ten) + 1];
    const chuCua = (hang, ten) => oCua(hang, ten).textContent;
    ok('thứ tự hàng theo tom_tat_kpi.thu_tu, không theo tom_tat_line',
       [chu(1)[0], chu(2)[0]], ['L2', 'L1']);
    ok('hàng cuối là TỔNG', chu(3)[0], 'TỔNG');

    /* Line CÓ đơn: mọi cột có số. */
    ok('L2 — số đơn, số sản phẩm, doanh số thuần',
       [chu(1)[1], chu(1)[2], chu(1)[3]], ['3', '7', '900']);
    ok('L2 — tỉ lệ tồn kho và Vs. tháng trước',
       [chuCua(1, 'Tỉ lệ tồn kho'), chuCua(1, 'Vs. Tháng trước')],
       ['40,0%', '+20,0%']);
    ok('  · tăng thì mang lớp màu tăng', oCua(1, 'Vs. Tháng trước').className, 'oSo vsTang');

    /* ── Hai cột mới, chủ dự án chốt 15/09/2026 ── */
    ok('L2 — Tỉ suất LN (Engine chia, màn hình chỉ đọc)',
       chuCua(1, 'Tỉ suất LN'), '10,0%');
    ok('L2 — Vs. Năm trước', chuCua(1, 'Vs. Năm trước'), '+50,0%');
    ok('  · và ô đó nói mốc đem ra so, không để người đọc tự đoán',
       /Cùng tháng năm trước: 600 nghìn đ/.test(oCua(1, 'Vs. Năm trước').title), true);
    ok('L1 — CHƯA CÓ số năm trước → "—"', chuCua(2, 'Vs. Năm trước'), '—');
    ok('  · và nói rõ vì sao (sổ chỉ có từ 01/2025)',
       /sổ chỉ có từ 01\/2025/.test(oCua(2, 'Vs. Năm trước').title), true);
    /* Tử số của L1 còn thiếu mấy đơn chưa đủ giá vốn, nên tỉ suất là con số
       SÀN — phải dán nhãn "*", đúng quy ước cột Lợi nhuận ngay bên trái. */
    ok('L1 — Tỉ suất LN dán nhãn thiếu bằng dấu *', chuCua(2, 'Tỉ suất LN'), '10,0% *');

    /* ── Vế "tính tới hôm nay", chủ dự án chốt 15/09/2026 ──
       Cùng ô, ngăn bằng "/", không thêm cột và không thêm lời giải thích. */
    ok('L2 — vế cả tháng và vế tới hôm nay nằm ở HAI Ô rời',
       [chuCua(1, 'Vs. Tháng trước'), oPhuCua(1, 'Vs. Tháng trước').textContent],
       ['+20,0%', '-25,0%']);
    ok('  · và Vs. Năm trước cũng vậy',
       [chuCua(1, 'Vs. Năm trước'), oPhuCua(1, 'Vs. Năm trước').textContent],
       ['+50,0%', '+200,0%']);
    /* KHÔNG còn mũi tên ▲▼ (chủ dự án chốt 17/09/2026) — màu đã nói đúng
       điều mũi tên nói, và bỏ nó thì con số bắt đầu ngay ở mép ô nên cả cột
       thẳng lề. */
    ok('  · không còn mũi tên ▲▼ ở ô nào',
       /[▲▼]/.test(b.con.map((r) => r.con.map((c) => c.textContent).join('')).join('')), false);

    /* MÀU ĐẶT TRÊN <td>, KHÔNG trên <span> — một lỗi đã phải sửa: bản trước
       bọc con số vào <span class="vsTang"> trong khi CSS khai
       `.bangTongHop td.vsTang`, nên class gắn đúng mà không luật nào khớp và
       cả hai cột đen sì. Bài kiểm cũ chỉ soi tên class nên không thấy. Nay
       canh lớp nằm trên CHÍNH Ô, đúng thứ CSS với tới. */
    ok('  · vế cả tháng xanh (tăng), vế tới hôm nay đỏ (giảm) — lớp trên chính ô',
       [oCua(1, 'Vs. Tháng trước').className,
        oPhuCua(1, 'Vs. Tháng trước').className], ['oSo vsTang', 'oSo vsGiam']);
    ok('  · và vế thứ hai nói rõ mốc của nó ở title',
       /Tháng liền trước \(tới hôm nay\): 1\.200 nghìn đ/
         .test(oPhuCua(1, 'Vs. Tháng trước').title), true);

    /* Line KHÔNG có vế MTD (kỳ đã đóng sổ): ô phụ để TRỐNG, không phải "—".
       "—" nghĩa là có chỗ cho một con số mà chưa biết nó; ở đây thì tháng đã
       xong nên vế ấy không tồn tại. */
    ok('L1 — không có vế MTD thì ô phụ để trống',
       oPhuCua(2, 'Vs. Tháng trước').textContent, '');

    /* Line THIẾU dữ liệu: ba cách trống khác nhau, ba câu khác nhau. */
    ok('L1 — lợi nhuận và quy đổi dán nhãn thiếu bằng dấu *',
       [chuCua(2, 'Lợi nhuận'), chuCua(2, 'Quy đổi')], ['10 *', '100 *']);
    ok('L1 — chưa biết nơi nhập nào → "—", KHÔNG phải 0%',
       chuCua(2, 'Tỉ lệ tồn kho'), '—');
    ok('  · và ô đó nói vì sao',
       /không có dữ liệu giá vốn/.test(oCua(2, 'Tỉ lệ tồn kho').title), true);
    ok('L1 — tháng trước 0đ → "mới", KHÔNG phải "—"',
       chuCua(2, 'Vs. Tháng trước'), 'mới');


    /* ── Nhóm cột lương ── */

    /* L2 — cách B, có đủ mọi thứ. Ô Ngày công là Ô NHẬP (đang là quantri) nên
       `textContent` rỗng; con số nằm ở `value` của <input> con. */
    ok('L2 — Thưởng / Lương cứng / Phụ cấp / Tổng lương',
       [chuCua(1, 'Thưởng'), chuCua(1, 'Lương cứng'),
        chuCua(1, 'Phụ cấp'), chuCua(1, 'Tổng lương')],
       ['4.550', '4.846', '780', '10.176']);
    const oNhap = oCua(1, 'Ngày công').con[0];
    ok('L2 — ô Ngày công là một <input>', !!oNhap, true);
    ok('  · mang đúng số đã nhập', oNhap.value, '28');
    ok('  · và khoá theo tên line để lượt ghi biết sửa ai', oNhap.dataset.line, 'L2');
    ok('L2 — Ghi chú nói hệ số thực tế VÀ thưởng nóng đã gồm trong cột Thưởng',
       chuCua(1, 'Ghi chú'), '0,45% · đã gồm 500 thưởng mốc 1,5 tỷ');
    ok('  · và KHÔNG còn chữ "Cách A/Cách B"',
       /Cách [AB]/.test(chuCua(1, 'Ghi chú')), false);

    /* L1 — cùng một hàng, HAI lý do trống khác nhau, hai câu khác nhau. */
    ok('L1 — chưa có quy đổi nên Thưởng "—"', chuCua(2, 'Thưởng'), '—');
    ok('  · và ô đó nói vì sao',
       /chưa tính được thưởng/.test(oCua(2, 'Thưởng').title), true);
    ok('L1 — chưa nhập ngày công nên Lương cứng "—"', chuCua(2, 'Lương cứng'), '—');
    ok('  · và ô đó nói một câu KHÁC',
       /Chưa nhập ngày công/.test(oCua(2, 'Lương cứng').title), true);
    ok('L1 — Ghi chú nói vì sao chưa có số', chuCua(2, 'Ghi chú'), 'chưa tính được thưởng');

    /* L3 — hệ số không thuộc cách nào (Nội thành 2%): cả nhóm trống, kể cả ô
       Ngày công, và KHÔNG dựng ô nhập cho nó. */
    /* TỔNG — cộng ba cột tiền, bỏ trống Ngày công và Ghi chú. */
    ok('TỔNG — ba cột tiền có số',
       [chuCua(3, 'Thưởng'), chuCua(3, 'Lương cứng'),
        chuCua(3, 'Phụ cấp'), chuCua(3, 'Tổng lương')],
       ['4.550', '4.846', '780', '10.176']);
    ok('  · Ngày công để TRỐNG (cộng ngày công nhiều line là vô nghĩa)',
       chuCua(3, 'Ngày công'), '');
    ok('  · Ghi chú cũng để trống', chuCua(3, 'Ghi chú'), '');
    /* Hàng TỔNG cũng phải có hai cột mới — bỏ sót chúng ở đây là một hàng
       TỔNG lệch ô so với các hàng trên, đúng lớp lỗi bài "MỌI hàng đều đúng
       18 ô" đang canh. */
    ok('TỔNG — Tỉ suất LN và So với năm trước',
       [chuCua(3, 'Tỉ suất LN'), chuCua(3, 'Vs. Năm trước')],
       ['10,0%', '+25,0%']);

    /* ── Hai màu mới, chủ dự án chốt 17/09/2026 ──
       L1 có tỉ suất 10% và hệ số 10% (fixture BANG) nên KHÔNG dưới mục tiêu;
       L2 cố tình đặt cờ để canh chiều còn lại. */
    ok('L2 — tỉ suất dưới hệ số thì ô mang lớp tô đỏ',
       oCua(1, 'Tỉ suất LN').className, 'oSo tySuatThap');
    ok('  · và ô đó nói mốc đem ra so',
       /Thấp hơn hệ số quy đổi của line \(7,5%\)/.test(oCua(1, 'Tỉ suất LN').title), true);
    ok('L1 — không dưới hệ số thì KHÔNG tô', oCua(2, 'Tỉ suất LN').className, 'oSo');

    /* Cột Đạt: mức thứ tư, xanh NHẠT, chỉ cho line chưa đạt 100% mà đang
       theo kịp thời gian đã trôi. L2 đạt 90% với tiến độ 50% → kịp. */
    ok('L2 — đạt 90% mà mới trôi 50% tháng → tô mức tiến độ',
       oCua(1, 'Đạt').className, 'oSo datTienDo');
    ok('  · và ô đó nói cả hai con số',
       /tháng đã trôi 50,0% thời gian, quy đổi đã đạt 90,0% KPI/
         .test(oCua(1, 'Đạt').title), true);

    /* Highlight ba mức khi vượt KPI. */
    /* 90% KHÔNG chạm ba mức cũ (100/110/120) — bài này canh đúng điều ấy, và
       nay nói rõ nó bằng cách loại trừ ba tên lớp cũ thay vì đòi ô trắng
       trơn: từ 17/09/2026 một ô dưới 100% VẪN có thể mang lớp `datTienDo`,
       và đó là đúng. */
    ok('đạt 90% thì KHÔNG chạm ba mức vượt KPI',
       /dat1(00|10|20)/.test(oCua(1, 'Đạt').className), false);

    /* Cột quy đổi được tô — chủ dự án yêu cầu highlight đúng cột này. */
    ok('ô cột quy đổi mang lớp highlight', oCua(1, 'Quy đổi').className, 'oSo oQuyDoi');
    ok('  · và tiêu đề cột ấy cũng vậy', oCua(0, 'Quy đổi').className, 'oQuyDoi');
  }

  xong();
})();
