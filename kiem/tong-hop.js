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

  console.log('\nK) Đúng 15 cột, đúng thứ tự chủ dự án chốt 12/09/2026');
  {
    const kh = UI.match(/const COT_TONG_HOP = \[([\s\S]*?)\n    \];/);
    ok('tìm thấy danh sách cột', !!kh, true);
    const ten = [...(kh ? kh[1] : '').matchAll(/ten: "([^"]+)"/g)].map(m => m[1]);
    ok('đúng 16 cột', ten.length, 16);
    ok('đúng thứ tự, đúng tên', ten, [
      'Line', 'Số đơn', 'Số sản phẩm', 'Doanh số thuần (nghìn đ)',
      'Lợi nhuận (nghìn đ)', 'Doanh số quy đổi (nghìn đ)', 'Tỉ lệ tồn kho',
      'KPI (nghìn đ)', 'Đạt', 'Vs. Tháng trước',
      'Thưởng (nghìn đ)', 'Ngày công', 'Lương cứng (nghìn đ)',
      'Phụ cấp (nghìn đ)', 'Tổng lương (nghìn đ)', 'Ghi chú',
    ]);
    /* Cột "Hệ số" bỏ khỏi bảng này (chủ dự án chốt) — nó vẫn xem và sửa được
       trên dải setup của từng tab line, nên không mất đường vào. */
    ok('cột "Hệ số" đã bỏ khỏi [Tổng hợp]', ten.includes('Hệ số'), false);
    ok('  · nhưng dải setup của tab line vẫn còn', /function veDaiKpi/.test(UI), true);

    ok('cột Doanh số quy đổi có highlight (CSS)',
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

    ok('chỉ lấy khi ở tab [Tổng hợp], không lấy ở tab line',
       /line\s*\n?\s*\? null\s*\n?\s*: await docDoanhSoLineKyTruoc/.test(GW), true);
    /* Nguồn hỏng thì cột để trống, KHÔNG chặn cả bảng đơn — cùng kỷ luật với
       bảng KPI của P5. */
    ok('kỳ trước đọc hỏng thì trả null, không ném',
       /catch \(e\) \{[\s\S]{0,240}ky-truoc-hong[\s\S]{0,80}return null;/.test(GW), true);
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
       /dungBangDonKemMa\([^)]*doanhSoLineKyTruoc, bangCong\)/.test(ENG), true);
    ok('dungBangDonSuaTay cũng vậy',
       /dungBangDonSuaTay\([^)]*doanhSoLineKyTruoc, bangCong\)/.test(ENG), true);
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
            doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 20 },
      L1: { doanh_so: 100000, so_don: 1, so_dong: 1, so_san_pham: 1, loi_nhuan: 10000,
            don_thieu_loi_nhuan: 1, doanh_so_quy_doi: 100000, don_thieu_quy_doi: 1,
            kpi: null, dat_pt: null, ty_le_ton_kho_pt: null, doanh_so_chua_ro_nguon: 50000,
            doanh_so_ky_truoc: 0, vs_thang_truoc_pt: null },
    };
    const kq = {
      tom_tat_line: { thu_tu: ['L1', 'L2', 'L3'], line: {} },
      bang: { tom_tat_kpi: { line, thu_tu: ['L2', 'L1', 'L3'], thieu_bang: false, van_de: [],
        vs_line: {
          L2: { doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 20 },
          L1: { doanh_so_ky_truoc: 0, vs_thang_truoc_pt: null },
          /* L3 chưa có đơn tháng này, nhưng tháng trước bán 400 — phải ra
             −100%, đúng ca mà mục G ghim ở tầng Engine. */
          L3: { doanh_so_ky_truoc: 400000, vs_thang_truoc_pt: -100 },
        },
        tong: { doanh_so: 1000000, so_don: 4, so_san_pham: 8, loi_nhuan: 100000,
                doanh_so_quy_doi: 1000000, kpi: 1000000, dat_pt: 100,
                ty_le_ton_kho_pt: 36, doanh_so_chua_ro_nguon: 50000,
                doanh_so_ky_truoc: 750000, vs_thang_truoc_pt: 33.3 },
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
    ok('4 hàng: tiêu đề + 3 line + TỔNG', b.con.length, 5);
    /* Lệch một ô ở một hàng là mọi con số từ đó trở đi đọc sang sai tên cột —
       lớp lỗi mà chỉ chạy thật mới thấy. */
    ok('MỌI hàng đều đúng 16 ô', b.con.map((r) => r.con.length), [16, 16, 16, 16, 16]);

    const chu = (i) => b.con[i].con.map((c) => c.textContent);
    ok('thứ tự hàng theo tom_tat_kpi.thu_tu, không theo tom_tat_line',
       [chu(1)[0], chu(2)[0], chu(3)[0]], ['L2', 'L1', 'L3']);
    ok('hàng cuối là TỔNG', chu(4)[0], 'TỔNG');

    /* Line CÓ đơn: mọi cột có số. */
    ok('L2 — số đơn, số sản phẩm, doanh số thuần',
       [chu(1)[1], chu(1)[2], chu(1)[3]], ['3', '7', '900']);
    ok('L2 — tỉ lệ tồn kho và Vs. tháng trước',
       [chu(1)[6], chu(1)[9]], ['40,0%', '▲ +20,0%']);
    ok('  · tăng thì mang lớp màu tăng', b.con[1].con[9].className, 'oSo vsTang');

    /* Line THIẾU dữ liệu: ba cách trống khác nhau, ba câu khác nhau. */
    ok('L1 — lợi nhuận và quy đổi dán nhãn thiếu bằng dấu *',
       [chu(2)[4], chu(2)[5]], ['10 *', '100 *']);
    ok('L1 — chưa biết nơi nhập nào → "—", KHÔNG phải 0%', chu(2)[6], '—');
    ok('  · và ô đó nói vì sao', /không có dữ liệu giá vốn/.test(b.con[2].con[6].title), true);
    ok('L1 — tháng trước 0đ → "mới", KHÔNG phải "—"', chu(2)[9], 'mới');

    /* Line KHÔNG có đơn nào: 0 là sự thật, "—" là chưa biết. */
    ok('L3 — số đơn/sản phẩm/doanh số là 0 (sự thật, không phải "chưa biết")',
       [chu(3)[1], chu(3)[2], chu(3)[3]], ['0', '0', '0']);
    ok('L3 — các cột suy ra thì "—"', [chu(3)[4], chu(3)[6], chu(3)[7]], ['—', '—', '—']);
    ok('L3 — line sập về 0đ vẫn hiện −100% ở cột Vs.', chu(3)[9], '▼ -100,0%');
    ok('  · và mang lớp màu giảm', b.con[3].con[9].className, 'oSo vsGiam');

    /* ── Nhóm cột lương ── */

    /* L2 — cách B, có đủ mọi thứ. Ô Ngày công là Ô NHẬP (đang là quantri) nên
       `textContent` rỗng; con số nằm ở `value` của <input> con. */
    ok('L2 — Thưởng / Lương cứng / Phụ cấp / Tổng lương',
       [chu(1)[10], chu(1)[12], chu(1)[13], chu(1)[14]],
       ['4.550', '4.846', '780', '10.176']);
    const oNhap = b.con[1].con[11].con[0];
    ok('L2 — ô Ngày công là một <input>', !!oNhap, true);
    ok('  · mang đúng số đã nhập', oNhap.value, '28');
    ok('  · và khoá theo tên line để lượt ghi biết sửa ai', oNhap.dataset.line, 'L2');
    ok('L2 — Ghi chú nói hệ số thực tế VÀ thưởng nóng đã gồm trong cột Thưởng',
       chu(1)[15], 'Cách B · 0,45% · đã gồm 500 thưởng mốc 1,5 tỷ');

    /* L1 — cùng một hàng, HAI lý do trống khác nhau, hai câu khác nhau. */
    ok('L1 — chưa có quy đổi nên Thưởng "—"', chu(2)[10], '—');
    ok('  · và ô đó nói vì sao', /chưa tính được thưởng/.test(b.con[2].con[10].title), true);
    ok('L1 — chưa nhập ngày công nên Lương cứng "—"', chu(2)[12], '—');
    ok('  · và ô đó nói một câu KHÁC', /Chưa nhập ngày công/.test(b.con[2].con[12].title), true);
    ok('L1 — Ghi chú vẫn nói được bậc đã nhận ra', chu(2)[15], 'Cách A · chưa tính được thưởng');

    /* L3 — hệ số không thuộc cách nào (Nội thành 2%): cả nhóm trống, kể cả ô
       Ngày công, và KHÔNG dựng ô nhập cho nó. */
    ok('L3 — không thuộc cách nào: cả sáu ô lương đều "—"',
       chu(3).slice(10), ['—', '—', '—', '—', '—', '—']);
    ok('  · và KHÔNG dựng ô nhập ngày công', b.con[3].con[11].con.length, 0);
    ok('  · Ghi chú nói thẳng vì sao', /không phải 7,5%/.test(b.con[3].con[15].title), true);

    /* TỔNG — cộng ba cột tiền, bỏ trống Ngày công và Ghi chú. */
    ok('TỔNG — ba cột tiền có số', [chu(4)[10], chu(4)[12], chu(4)[13], chu(4)[14]],
       ['4.550', '4.846', '780', '10.176']);
    ok('  · Ngày công để TRỐNG (cộng ngày công nhiều line là vô nghĩa)', chu(4)[11], '');
    ok('  · Ghi chú cũng để trống', chu(4)[15], '');

    /* Highlight ba mức khi vượt KPI. */
    ok('đạt 90% thì KHÔNG tô', b.con[1].con[8].className, 'oSo ');

    /* Cột quy đổi được tô — chủ dự án yêu cầu highlight đúng cột này. */
    ok('ô cột quy đổi mang lớp highlight', b.con[1].con[5].className, 'oSo oQuyDoi');
    ok('  · và tiêu đề cột ấy cũng vậy', b.con[0].con[5].className, 'oQuyDoi');
  }

  xong();
})();
