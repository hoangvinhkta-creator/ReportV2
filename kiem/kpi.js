/* DOANH SỐ QUY ĐỔI + KPI THEO LINE (engine/src/kpi.mjs) — P5.
 *
 * Bộ này canh năm thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. SAI ĐƠN VỊ HỆ SỐ. `he_so_pt` lưu bằng PHẦN TRĂM (7.5), không phải phân
 *     số (0.075). Hai dạng đều là số dương hợp lệ, nên lẫn dạng thì phép
 *     chia vẫn chạy và vẫn ra một con số trông bình thường — sai đúng 100
 *     lần. Có bài ghim ví dụ tính tay của chủ dự án làm mốc tuyệt đối.
 *
 *  B. LẤY HỆ SỐ THEO BẢNG THAY VÌ THEO ĐƠN. Tab [Tổng hợp] dựng bảng chứa
 *     MỌI line cùng lúc. Lấy một hệ số cho cả bảng thì cả công ty bị quy đổi
 *     bằng hệ số của một line — con số trông bình thường mà sai hoàn toàn.
 *
 *  C. TICK GIA DỤNG KHOÁ SAI TẦM. Chủ dự án chốt 12/09/2026 đây là quyết
 *     định về MỘT MẶT HÀNG, khoá theo `khoa_ten`, áp cho MỌI kỳ. Khoá theo
 *     dòng/theo kỳ thì tháng sau phải tick lại hàng trăm dòng.
 *
 *  D. HOÁ `null` THÀNH 0. "Chưa biết lãi bao nhiêu" và "lãi 0 đồng" là hai
 *     chuyện khác nhau — cùng kỷ luật `dienGiaNhap()` của P4. Hoá 0 là để
 *     một ô trống nói một kết luận nghiệp vụ thay người.
 *
 *  E. THÊM LUẬT RIÊNG CHO DÒNG ÂM. Một công thức duy nhất: P4 đã đặt
 *     `loi_nhuan` của BTL/chiết khấu/quà tặng/phụ phí về đúng con số nghiệp
 *     vụ, nên phép chia tự ra đúng. Lọc dòng âm ở đây là dựng bản luật thứ
 *     hai cạnh bản P4 đã có.
 */
const path = require('path');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const P = await import('file://' + path.join(GOC, 'engine/src/kpi.mjs'));
  const L = await import('file://' + path.join(GOC, 'engine/src/line.mjs'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));

  const HAT = P.BANG_KPI_HAT_GIONG;

  /* ─────────── A. Bộ số chủ dự án chốt 12/09/2026 ─────────── */

  console.log('\nA) Hạt giống — ghim đúng con số chủ dự án chốt 12/09/2026');
  {
    const md = HAT.mac_dinh;
    /* Ghim TUYỆT ĐỐI, bằng ĐỒNG. Chủ dự án gõ "2.700.000" và nói rõ "2 tỷ 7
       đã được ghi gọn" → ô nhập nói NGHÌN đồng, nhánh lưu ĐỒNG. Một bài ghim
       con số tính sẵn là cách duy nhất bắt được lượt sửa làm lệch 1.000 lần. */
    ok('Tín Phát KPI = 2,7 tỷ đồng', md['Tín Phát'].kpi, 2700000000);
    ok('Tín Phát hệ số = 7,5%', md['Tín Phát'].he_so_pt, 7.5);
    ok('Tín Phát KHÔNG có hệ số gia dụng', md['Tín Phát'].he_so_gia_dung_pt, undefined);

    ok('Nội thành KPI = 15 tỷ đồng', md['Nội thành'].kpi, 15000000000);
    ok('Nội thành hệ số = 2%', md['Nội thành'].he_so_pt, 2);
    ok('Nội thành hệ số gia dụng = 8%', md['Nội thành'].he_so_gia_dung_pt, 8);

    /* Tám line còn lại — chủ dự án chốt "mỗi line 1,3 tỷ, đủ cả 8", gồm cả
       "Khác" (gộp 5 tên) và "Shopee" (chưa có dòng nào tới 08/2026). */
    const tam = ['Miền Bắc', 'Tổng kho', 'Quyết chiến', 'Đông Á', 'Tân Á',
                 'Fanpage', 'Shopee', 'Khác'];
    ok('đúng 8 line "còn lại"', tam.length, 8);
    for (const t of tam) {
      ok(t + ' KPI = 1,3 tỷ', md[t].kpi, 1300000000);
      ok('  · ' + t + ' hệ số = 5,5%', md[t].he_so_pt, 5.5);
      ok('  · ' + t + ' KHÔNG có hệ số gia dụng', md[t].he_so_gia_dung_pt, undefined);
    }

    /* MỌI line của bảng line phải có KPI. Thiếu một line thì tab [Tổng hợp]
       hiện "chưa đặt KPI" cho nó mãi mãi mà không ai nhớ ra vì sao. */
    const thieu = L.BANG_LINE_HAT_GIONG.thu_tu.filter((l) => !md[l]);
    ok('không line nào của bảng line bị thiếu KPI', thieu, []);
    /* Và ngược lại: không có KPI cho một line không tồn tại. */
    const la = Object.keys(md).filter((l) => !L.BANG_LINE_HAT_GIONG.thu_tu.includes(l));
    ok('không có KPI cho line lạ', la, []);

    ok('hạt giống hợp lệ', P.kiemBangKpi(HAT), []);
    /* Hằng số phải ĐÓNG BĂNG được qua JSON mà không mất gì — đó là cách Engine
       trả nó cho Gateway ở `bangKpiHatGiong()`, và cũng là cách nó đi vào
       Firebase. Một giá trị không tuần tự hoá được (undefined lồng trong
       object, NaN, Infinity) sẽ lặng lẽ biến mất hoặc thành `null` đúng lúc
       ghi, chứ không nổ lúc khai. */
    ok('hạt giống đi qua JSON không mất gì',
      JSON.parse(JSON.stringify(HAT)), JSON.parse(JSON.stringify(HAT)));
    ok('  · và bản đi qua JSON vẫn hợp lệ',
      P.kiemBangKpi(JSON.parse(JSON.stringify(HAT))), []);
    ok('hạt giống chưa có bản ghi đè kỳ nào', Object.keys(HAT.ky || {}), []);
    /* CHỈ Nội thành có hệ số gia dụng — chủ dự án chốt "riêng tab Nội thành".
       Suy diễn sang line khác là vượt quyết định. */
    const coGd = Object.keys(md).filter((l) => md[l].he_so_gia_dung_pt != null);
    ok('đúng một line có hệ số gia dụng, và là Nội thành', coGd, ['Nội thành']);
  }

  /* ─────────── B. Công thức: ví dụ tính tay của chủ dự án ─────────── */

  const motDong = (line, loiNhuan, khoaTen) => ({
    line: line || 'Tín Phát',
    ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', line: line || 'Tín Phát',
      tong_ban: 0, dong: [{ khoa_ten: khoaTen || 'N_X', loi_nhuan: loiNhuan }] }] }],
    tom_tat: { doanh_so: 0, so_don: 1, so_dong: 1 },
  });
  const q1 = (b) => b.ngay[0].don[0].dong[0].doanh_so_quy_doi;

  console.log('\nB) Công thức — ví dụ tính tay chủ dự án đưa 12/09/2026');
  {
    /* "Lợi nhuận 1 triệu của Tín Phát, tức 1.000 > tính ra được doanh số quy
       đổi sẽ là 1.000/7,5% = 13.333 triệu" — con số 13.333 là NGHÌN đồng
       (13,3 triệu). Ghim cả hai dạng để không ai đọc lệch đơn vị lần nữa. */
    const b = motDong('Tín Phát', 1000000);
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
    ok('1 triệu lợi nhuận ÷ 7,5% = 13.333.333,33 đ', q1(b), 13333333.33);
    ok('  · tức 13.333 nghìn đ, đúng số chủ dự án tính tay',
      Math.round(q1(b) / 1000), 13333);

    /* Tính chất đáng ghim nhất của "chia cho tỉ suất mục tiêu": bán ĐÚNG tỉ
       suất mục tiêu thì quy đổi ra BẰNG ĐÚNG doanh số thuần. Đây là cách đọc
       con số ra nghĩa, và là phép thử rẻ nhất để biết công thức còn đúng
       chiều. Doanh thu 2 tỷ lãi 7,5% = 150 triệu → quy đổi lại đúng 2 tỷ. */
    const b2 = motDong('Tín Phát', 150000000);
    P.dienDoanhSoQuyDoi(b2, HAT, '2026-09', {});
    ok('bán đúng tỉ suất mục tiêu → quy đổi = doanh số thuần', q1(b2), 2000000000);

    /* Lãi dày hơn mục tiêu thì quy đổi VƯỢT doanh số thật; hạ giá chạy số thì
       TỤT xuống dưới. Đúng điều chủ dự án muốn: không còn đường hạ lợi nhuận
       để về số cho nhanh. */
    const b3 = motDong('Tín Phát', 300000000);
    P.dienDoanhSoQuyDoi(b3, HAT, '2026-09', {});
    ok('lãi gấp đôi mục tiêu → quy đổi gấp đôi doanh số thuần', q1(b3), 4000000000);
  }

  /* ─────────── C. Hệ số lấy theo ĐƠN, không theo bảng ─────────── */

  console.log('\nC) Tab [Tổng hợp] — mỗi đơn ăn hệ số của CHÍNH line mình');
  {
    /* Đúng hình dạng bảng của tab [Tổng hợp]: `bang.line === null`, nhiều
       line trong cùng một bảng. Lấy một hệ số cho cả bảng là con số sai mà
       trông bình thường — đây là bài bắt đúng ca đó. */
    const b = {
      line: null,
      ngay: [{ ngay: '2026-09-01', don: [
        { so_ct: 'BH1', line: 'Tín Phát', tong_ban: 0,
          dong: [{ khoa_ten: 'N_A', loi_nhuan: 1000000 }] },
        { so_ct: 'BH2', line: 'Nội thành', tong_ban: 0,
          dong: [{ khoa_ten: 'N_B', loi_nhuan: 1000000 }] },
      ] }],
      tom_tat: { doanh_so: 0, so_don: 2, so_dong: 2 },
    };
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
    const ds = b.ngay[0].don;
    ok('đơn của Tín Phát ăn 7,5%', ds[0].dong[0].doanh_so_quy_doi, 13333333.33);
    ok('đơn của Nội thành ăn 2%', ds[1].dong[0].doanh_so_quy_doi, 50000000);
    ok('  · hai con số KHÁC nhau cho cùng một đồng lãi',
      ds[0].dong[0].doanh_so_quy_doi !== ds[1].dong[0].doanh_so_quy_doi, true);

    const tk = b.tom_tat_kpi.line;
    ok('bản kê tách đúng hai line', Object.keys(tk).sort(), ['Nội thành', 'Tín Phát']);
    ok('quy đổi của Tín Phát', tk['Tín Phát'].doanh_so_quy_doi, 13333333.33);
    ok('quy đổi của Nội thành', tk['Nội thành'].doanh_so_quy_doi, 50000000);
    ok('tổng bảng = cộng hai line',
      b.tom_tat.doanh_so_quy_doi, 13333333.33 + 50000000);
    /* `hanh` là hệ số của line ĐANG XEM — ở [Tổng hợp] không có line nào đang
       xem, nên phải là null chứ không phải hệ số của line đầu tiên. */
    ok('[Tổng hợp] không có hệ số nào "đang áp"', b.tom_tat_kpi.hanh, null);
  }

  /* ─────────── D. Tick gia dụng — quyết định về MỘT MẶT HÀNG ─────────── */

  console.log('\nD) Tick gia dụng — khoá theo MẶT HÀNG, áp mọi kỳ');
  {
    const giaDung = { N_MAYGIAT: { gia_dung: true } };

    const b = {
      line: 'Nội thành',
      ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', line: 'Nội thành', tong_ban: 0,
        dong: [
          { khoa_ten: 'N_MAYGIAT', loi_nhuan: 1000000 },
          { khoa_ten: 'N_TIVI', loi_nhuan: 1000000 },
        ] }] }],
      tom_tat: { doanh_so: 0, so_don: 1, so_dong: 2 },
    };
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', giaDung);
    const dd = b.ngay[0].don[0].dong;
    ok('dòng đã tick ăn hệ số gia dụng 8%', dd[0].doanh_so_quy_doi, 12500000);
    ok('  · và được gắn cờ để màn hình vẽ ô tick đúng', dd[0].la_gia_dung, true);
    ok('dòng KHÔNG tick ăn hệ số thường 2%', dd[1].doanh_so_quy_doi, 50000000);
    ok('  · và cờ là false', dd[1].la_gia_dung, false);

    /* ÁP CHO MỌI KỲ — đây là điều phân biệt "quyết định về một mặt hàng" với
       "quyết định về một dòng" (CLAUDE.md). Cùng `khoa_ten` ở một kỳ KHÁC
       vẫn phải ăn 8%, không cần tick lại. */
    const bSau = {
      line: 'Nội thành',
      ngay: [{ ngay: '2026-10-05', don: [{ so_ct: 'BH9', line: 'Nội thành', tong_ban: 0,
        dong: [{ khoa_ten: 'N_MAYGIAT', loi_nhuan: 1000000 }] }] }],
      tom_tat: { doanh_so: 0, so_don: 1, so_dong: 1 },
    };
    P.dienDoanhSoQuyDoi(bSau, HAT, '2026-10', giaDung);
    ok('kỳ SAU vẫn ăn 8% mà không phải tick lại', q1(bSau), 12500000);

    /* Line KHÔNG khai hệ số gia dụng thì tick rồi cũng ăn hệ số thường — chủ
       dự án chỉ chốt hệ số gia dụng cho Nội thành, nới sang line khác là
       vượt quyết định. */
    const bTP = motDong('Tín Phát', 1000000, 'N_MAYGIAT');
    P.dienDoanhSoQuyDoi(bTP, HAT, '2026-09', giaDung);
    ok('Tín Phát tick gia dụng vẫn ăn 7,5% (line không khai hệ số ấy)',
      q1(bTP), 13333333.33);
    ok('  · cờ vẫn bật (tick là sự thật về mặt hàng, không phải về line)',
      bTP.ngay[0].don[0].dong[0].la_gia_dung, true);

    /* Dòng không có `khoa_ten` (chiết khấu gộp, phụ phí cố định) không bao
       giờ là gia dụng — không có khoá bền nào để gắn quyết định vào. */
    const bCk = motDong('Nội thành', -500000, null);
    bCk.ngay[0].don[0].dong[0].khoa_ten = null;
    P.dienDoanhSoQuyDoi(bCk, HAT, '2026-09', { null: { gia_dung: true } });
    ok('dòng không có khoá tên hàng không bao giờ là gia dụng',
      bCk.ngay[0].don[0].dong[0].la_gia_dung, false);

    /* Tick mang `gia_dung` khác `true` (ví dụ đã rút lại) KHÔNG được tính. */
    const bRut = motDong('Nội thành', 1000000, 'N_MAYGIAT');
    P.dienDoanhSoQuyDoi(bRut, HAT, '2026-09', { N_MAYGIAT: { gia_dung: false } });
    ok('tick đã rút lại thì về hệ số thường', q1(bRut), 50000000);
  }

  /* ─────────── E. `null` không bao giờ thành 0 ─────────── */

  console.log('\nE) "Chưa biết" và "bằng 0" là hai chuyện khác nhau');
  {
    for (const [nhan, ln] of [['null', null], ['undefined', undefined]]) {
      const b = motDong('Tín Phát', ln);
      P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
      ok('lợi nhuận ' + nhan + ' → quy đổi null, KHÔNG phải 0', q1(b), null);
    }
    /* Lãi đúng 0 đồng thì quy đổi đúng 0 — phân biệt được với "chưa biết". */
    const b0 = motDong('Tín Phát', 0);
    P.dienDoanhSoQuyDoi(b0, HAT, '2026-09', {});
    ok('lợi nhuận đúng 0 → quy đổi đúng 0 (khác null)', q1(b0), 0);

    /* Line chưa khai hệ số: quy đổi null, không phải 0. Bảng KPI rỗng là
       trạng thái thật trước lượt nạp hạt giống đầu tiên. */
    const bL = motDong('Line Lạ', 1000000);
    P.dienDoanhSoQuyDoi(bL, HAT, '2026-09', {});
    ok('line chưa khai hệ số → quy đổi null', q1(bL), null);

    const bR = motDong('Tín Phát', 1000000);
    P.dienDoanhSoQuyDoi(bR, null, '2026-09', {});
    ok('chưa có bảng KPI nào → quy đổi null', q1(bR), null);

    /* Hệ số 0 hoặc âm KHÔNG được ra Infinity/âm vô nghĩa — chia cho 0 là lỗi
       dữ liệu, và một ô "Infinity" trên báo cáo tiền là thứ không được phép. */
    for (const hs of [0, -5, null]) {
      const bang = { mac_dinh: { X: { kpi: 1000, he_so_pt: hs } } };
      const b = motDong('X', 1000000);
      P.dienDoanhSoQuyDoi(b, bang, '2026-09', {});
      ok('hệ số ' + JSON.stringify(hs) + ' → quy đổi null, không Infinity', q1(b), null);
    }
    /* Hệ số vượt 100% là đơn vị ghi lẫn (gõ 750 thay vì 7,5) — không dùng. */
    const bV = motDong('X', 1000000);
    P.dienDoanhSoQuyDoi(bV, { mac_dinh: { X: { kpi: 1000, he_so_pt: 750 } } }, '2026-09', {});
    ok('hệ số > 100% → quy đổi null (đơn vị ghi lẫn)', q1(bV), null);
  }

  /* ─────────── F. Dòng âm đi qua nguyên vẹn, không có luật riêng ─────────── */

  console.log('\nF) BTL · chiết khấu · quà tặng 0đ — một công thức, dấu âm đi qua');
  {
    const b = {
      line: 'Tín Phát',
      ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', line: 'Tín Phát', tong_ban: 0,
        dong: [
          { khoa_ten: 'N_A', loi_nhuan: 1000000 },            // hàng thật
          { khoa_ten: null, loi_nhuan: -150000 },             // chiết khấu gộp
          { khoa_ten: 'N_B', loi_nhuan: -2000000 },           // quà tặng 0 đồng
          { khoa_ten: 'N_C', loi_nhuan: 0 },                  // phụ phí cố định
        ] }] }],
      tom_tat: { doanh_so: 0, so_don: 1, so_dong: 4 },
    };
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
    const dd = b.ngay[0].don[0].dong;
    ok('hàng thật → quy đổi dương', dd[0].doanh_so_quy_doi, 13333333.33);
    ok('chiết khấu gộp → quy đổi ÂM, không bị lọc',
      dd[1].doanh_so_quy_doi, -2000000);
    ok('quà tặng 0đ (có giá vốn) → quy đổi ÂM, trừ vào line',
      dd[2].doanh_so_quy_doi, -26666666.67);
    ok('phụ phí cố định (lãi 0) → quy đổi đúng 0', dd[3].doanh_so_quy_doi, 0);
    /* Tổng line cộng cả phần âm. Lọc dòng âm ở đây là dựng bản luật thứ hai
       về "dòng nào tính tiền", cạnh bản P4 đã có. */
    /* Ghim con số TÍNH SẴN, không ghim một biểu thức cộng trừ: chính vế
       "mong" viết bằng biểu thức mới là chỗ sinh rác float
       (13333333.33 − 2000000 − 26666666.67 ra …340000002 trong JS). Engine
       làm tròn SAU TỪNG BƯỚC cộng (`lamTron`) nên nó không mang rác ấy — và
       đó đúng là thứ bài này cần canh, nên vế mong phải là hằng số. */
    ok('tổng line cộng cả dòng âm',
      b.tom_tat_kpi.line['Tín Phát'].doanh_so_quy_doi, -15333333.34);
  }

  /* ─────────── G. Tổng của ĐƠN khi thiếu một dòng ─────────── */

  console.log('\nG) Thiếu giá vốn một dòng — tổng ĐƠN null, tổng LINE vẫn cộng');
  {
    const b = {
      line: 'Tín Phát',
      ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', line: 'Tín Phát', tong_ban: 0,
        dong: [
          { khoa_ten: 'N_A', loi_nhuan: 1000000 },
          { khoa_ten: 'N_B', loi_nhuan: null },
        ] }] }],
      tom_tat: { doanh_so: 0, so_don: 1, so_dong: 2 },
    };
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
    /* Cùng luật `don.loi_nhuan` của P4: thiếu một dòng → null. Cộng phần biết
       được rồi gọi nó là tổng của đơn là nói một con số thiếu mà không dán
       nhãn thiếu. */
    ok('tổng ĐƠN null khi còn một dòng chưa quy đổi được',
      b.ngay[0].don[0].doanh_so_quy_doi, null);
    /* Tổng LINE thì KHÁC luật, có chủ đích: đây là con số người đối chiếu KPI
       cần, và bỏ cả đơn vì một dòng thiếu giá làm nó tụt mà không ai biết tụt
       bao nhiêu. `don_thieu_quy_doi` nói thẳng còn nợ bao nhiêu đơn. */
    const tk = b.tom_tat_kpi.line['Tín Phát'];
    ok('tổng LINE vẫn cộng phần quy đổi được', tk.doanh_so_quy_doi, 13333333.33);
    ok('  · và đếm số đơn còn thiếu để màn hình nói ra', tk.don_thieu_quy_doi, 1);
  }

  /* ─────────── H. Mặc định chung + ghi đè từng kỳ ─────────── */

  console.log('\nH) Hợp nhất mặc định ↔ ghi đè kỳ, THEO TỪNG TRƯỜNG');
  {
    const bang = {
      mac_dinh: { 'Tín Phát': { kpi: 2700000000, he_so_pt: 7.5 } },
      ky: { '2026-10': { 'Tín Phát': { kpi: 3000000000 } } },
    };
    const t9 = P.hanhKpi(bang, 'Tín Phát', '2026-09');
    ok('kỳ không có ghi đè → mặc định', [t9.kpi, t9.he_so_pt], [2700000000, 7.5]);
    ok('  · và nói rõ nguồn là mặc định', t9.tu.kpi, 'mac_dinh');
    ok('  · không có bản ghi đè riêng kỳ này', t9.co_rieng_ky, false);

    const t10 = P.hanhKpi(bang, 'Tín Phát', '2026-10');
    ok('kỳ có ghi đè KPI → lấy KPI riêng', t10.kpi, 3000000000);
    /* Đây là bài quan trọng nhất của mục này: ghi đè CHỈ `kpi` thì hệ số phải
       VẪN là mặc định, không biến mất. Thay cả bản thì đặt riêng một con số
       là mất con số kia — và bộ "mặc định chung + ghi đè từng kỳ" (chủ dự án
       chốt 12/09/2026) hết dùng được. */
    ok('  · hệ số KHÔNG nhắc tới thì vẫn là mặc định', t10.he_so_pt, 7.5);
    ok('  · nguồn từng trường nói đúng chỗ lấy',
      [t10.tu.kpi, t10.tu.he_so_pt], ['ky', 'mac_dinh']);
    ok('  · có bản ghi đè riêng kỳ này', t10.co_rieng_ky, true);

    /* `boi`/`luc` là dấu vết audit Gateway gắn kèm mỗi lượt ghi — KHÔNG phải
       hệ số, và không được làm phép hợp nhất coi là "có đặt riêng". */
    const bangVet = {
      mac_dinh: { X: { kpi: 1000, he_so_pt: 5, boi: 'a@b.c', luc: 123 } },
      ky: { '2026-10': { X: { boi: 'a@b.c', luc: 456 } } },
    };
    const v = P.hanhKpi(bangVet, 'X', '2026-10');
    ok('dấu vết audit không bị nhầm thành hệ số',
      [v.kpi, v.he_so_pt, v.co_rieng_ky], [1000, 5, false]);

    const trong = P.hanhKpi({}, 'X', '2026-09');
    ok('line chưa khai gì → mọi trường null',
      [trong.kpi, trong.he_so_pt, trong.he_so_gia_dung_pt], [null, null, null]);
  }

  /* ─────────── I. Phần trăm đạt KPI ─────────── */

  console.log('\nI) % đạt KPI — và "chưa đặt KPI" khác "đạt 0%"');
  {
    /* Doanh thu 2 tỷ lãi 7,5% → quy đổi 2 tỷ; KPI 2,7 tỷ → đạt 74,07%. */
    const b = motDong('Tín Phát', 150000000);
    P.dienDoanhSoQuyDoi(b, HAT, '2026-09', {});
    ok('đạt = quy đổi ÷ KPI × 100',
      b.tom_tat_kpi.line['Tín Phát'].dat_pt, 74.07);
    ok('  · mang theo mức KPI để màn hình không phải tra lại',
      b.tom_tat_kpi.line['Tín Phát'].kpi, 2700000000);

    /* Chưa đặt KPI → `null`, KHÔNG phải 0%. Hai câu khác nhau hẳn: "chưa có
       mục tiêu nào" và "có mục tiêu mà chưa làm được gì". */
    const bK = motDong('X', 1000000);
    P.dienDoanhSoQuyDoi(bK, { mac_dinh: { X: { he_so_pt: 5 } } }, '2026-09', {});
    ok('chưa đặt KPI → đạt null, không phải 0', b2Dat(bK), null);
    function b2Dat(bb) { return bb.tom_tat_kpi.line.X.dat_pt; }
  }

  /* ─────────── J. Tổng toàn công ty theo thứ tự line chính thức ─────────── */

  console.log('\nJ) Tổng toàn công ty — theo `thu_tu`, không suy từ dữ liệu');
  {
    const b = {
      line: null,
      ngay: [{ ngay: '2026-09-01', don: [
        { so_ct: 'BH1', line: 'Tín Phát', tong_ban: 1000000,
          dong: [{ khoa_ten: 'N_A', loi_nhuan: 150000000 }] },
        { so_ct: 'BH2', line: 'Nội thành', tong_ban: 2000000,
          dong: [{ khoa_ten: 'N_B', loi_nhuan: 200000000 }] },
      ] }],
      tom_tat: { doanh_so: 3000000, so_don: 2, so_dong: 2 },
    };
    P.apDungKpi(b, HAT, '2026-09', {}, L.BANG_LINE_HAT_GIONG.thu_tu);
    const t = b.tom_tat_kpi.tong;
    ok('tổng quy đổi = 2 tỷ + 10 tỷ', t.doanh_so_quy_doi, 2000000000 + 10000000000);
    /* Tổng KPI chỉ cộng line CÓ MẶT trong kỳ, không cộng cả 10 line: so một
       tổng quy đổi của 2 line với KPI của 10 line là một tỉ lệ vô nghĩa. */
    ok('tổng KPI cộng đúng hai line có mặt', t.kpi, 2700000000 + 15000000000);
    ok('đạt toàn công ty', t.dat_pt, 67.8);
    ok('không thiếu bảng KPI', b.tom_tat_kpi.thieu_bang, false);
    ok('không vấn đề gì ở bảng KPI', b.tom_tat_kpi.van_de, []);

    /* Vắng bảng và bảng SAI là hai chuyện khác nhau, báo bằng hai trường
       khác nhau — màn hình phải nói đúng câu. */
    const bV = motDong('Tín Phát', 1000000);
    P.apDungKpi(bV, null, '2026-09', {}, null);
    ok('vắng bảng KPI → thieu_bang true, van_de rỗng',
      [bV.tom_tat_kpi.thieu_bang, bV.tom_tat_kpi.van_de], [true, []]);

    const bS = motDong('Tín Phát', 1000000);
    P.apDungKpi(bS, { mac_dinh: { 'Tín Phát': { kpi: -5, he_so_pt: 7.5 } } },
      '2026-09', {}, null);
    ok('bảng SAI → thieu_bang false, van_de có mục', bS.tom_tat_kpi.thieu_bang, false);
    ok('  · và nói rõ chỗ sai', bS.tom_tat_kpi.van_de.length > 0, true);
    /* Bảng sai thì KHÔNG dùng nửa vời: quy đổi null hết, không lấy phần
       "trông như còn đúng". Một bộ số đã sai ở một chỗ thì không có cơ sở nào
       để tin những chỗ còn lại. */
    ok('  · và quy đổi null hết, không dùng nửa vời', q1(bS), null);
  }

  /* ─────────── K. Kiểm bảng KPI ─────────── */

  console.log('\nK) kiemBangKpi — bắt đúng ca đơn vị ghi lẫn');
  {
    const sai = (b) => P.kiemBangKpi(b).map((v) => v.ma);
    ok('bảng không phải đối tượng', sai(null), ['bang-khong-phai-doi-tuong']);
    ok('bảng rỗng là hợp lệ (chưa khai gì)', sai({}), []);
    ok('KPI âm', sai({ mac_dinh: { X: { kpi: -1 } } }), ['kpi-khong-hop-le']);
    ok('KPI = 0 (chia ra vô cực)', sai({ mac_dinh: { X: { kpi: 0 } } }), ['kpi-khong-hop-le']);
    ok('KPI là chuỗi', sai({ mac_dinh: { X: { kpi: '2700000' } } }), ['kpi-khong-hop-le']);
    ok('KPI vắng là hợp lệ (line chưa đặt mức)', sai({ mac_dinh: { X: {} } }), []);
    ok('hệ số 0', sai({ mac_dinh: { X: { he_so_pt: 0 } } }), ['he-so-khong-hop-le']);
    /* Bài bắt đơn vị: gõ 750 thay vì 7,5. Trần 100 nói thẳng nhánh này đo
       bằng phần trăm. */
    ok('hệ số 750% (gõ thừa hai chữ số)',
      sai({ mac_dinh: { X: { he_so_pt: 750 } } }), ['he-so-vuot-100']);
    ok('hệ số đúng 100% là hợp lệ', sai({ mac_dinh: { X: { he_so_pt: 100 } } }), []);
    ok('hệ số gia dụng cũng bị canh',
      sai({ mac_dinh: { X: { he_so_pt: 5, he_so_gia_dung_pt: 500 } } }), ['he-so-vuot-100']);
    ok('bản ghi đè theo kỳ cũng bị canh',
      sai({ ky: { '2026-09': { X: { he_so_pt: 0 } } } }), ['he-so-khong-hop-le']);
    ok('mac_dinh là mảng', sai({ mac_dinh: [] }), ['mac-dinh-khong-phai-doi-tuong']);
  }

  /* ─────────── L. Chạy thật qua cả chuỗi P4 → P5 ─────────── */

  console.log('\nL) Chuỗi thật: sổ thô → khớp mã → giá vốn → quy đổi');
  {
    /* Không dựng bảng bằng tay ở bài này: đi ĐÚNG chuỗi Gateway gọi, để bắt
       được ca "Engine tính đúng rồi không ai nối vào" — đúng lớp lỗi chiếm 3
       trong 7 lỗi cuối P4 (xem handoff mục 4). */
    const BOARD = { '65C6K': { name: '65C6K', alt: [], brand: 'TCL', category_label: 'Tivi' } };
    const BANG_LINE = {
      thu_tu: ['Tín Phát', 'Khác'],
      cua_ten: { 'Tín Phát 0869931931': 'Tín Phát' },
    };
    const dong = {
      [D.khoaDong('BH1', 'Tivi TCL 65C6K', 1)]: {
        ngay: '2026-09-08', so_ct: 'BH1', ten_hang: 'Tivi TCL 65C6K',
        so_luong: 1, don_gia: 9000000, doanh_so: 9000000, chiet_khau: 0,
        nhan_vien: 'Tín Phát 0869931931', imei: null,
      },
    };
    /* Lọc theo line (`'Tín Phát'`), đúng như Gateway làm khi người dùng đang
       đứng ở một tab line — đó là đường mà dải setup đọc `hanh` từ. Đường
       KHÔNG lọc (tab [Tổng hợp]) đã được mục C canh riêng. */
    const b = D.dungBangDon(dong, {}, BANG_LINE, 'Tín Phát');
    K.khopMaChoBangDon(b, { board: BOARD, alias: {}, inv_map: {} }, '2026-09');
    K.dienGiaNhap(b, { currency_unit: 'VND_THOUSAND', errors: [],
      records: [{ product_code: '65C6K', effective_date: '2026-09-08',
        min_price: 5250, price_status: 'OK', day_status: 'FINAL',
        observed_on: '2026-09-08', carried_from: null }] });

    const d = b.ngay[0].don[0].dong[0];
    ok('giá vốn theo đúng ngày bán', d.gia_nhap, 5250000);
    ok('lợi nhuận = 9.000.000 − 5.250.000', d.loi_nhuan, 3750000);
    /* `khoa_ten` do khớp mã gắn — đó là khoá tick gia dụng dùng, nên nó phải
        có mặt thật ở cuối chuỗi, không chỉ trong bài dựng tay. */
    ok('khoá tên hàng có mặt để tick gia dụng gắn vào',
      d.khoa_ten, K.khoaTenHang('Tivi TCL 65C6K'));

    P.apDungKpi(b, HAT, '2026-09', {}, BANG_LINE.thu_tu);
    ok('quy đổi = 3.750.000 ÷ 7,5%', d.doanh_so_quy_doi, 50000000);
    ok('tổng ĐƠN có đủ (mọi dòng đã quy đổi)',
      b.ngay[0].don[0].doanh_so_quy_doi, 50000000);
    ok('tổng NGÀY có số', b.ngay[0].doanh_so_quy_doi, 50000000);
    ok('tổng BẢNG có số', b.tom_tat.doanh_so_quy_doi, 50000000);
    ok('hệ số đang áp đi kèm cho dải setup',
      [b.tom_tat_kpi.hanh.he_so_pt, b.tom_tat_kpi.hanh.kpi], [7.5, 2700000000]);
  }

  /* ─────────── M. LUẬT SỐ 1 — công thức không rò xuống trình duyệt ─────── */

  console.log('\nM) LUẬT SỐ 1 — hệ số và phép chia KHÔNG nằm ở trình duyệt');
  {
    /* Ctrl+U trên trang đã deploy không được đọc ra cách tính một con số
       tiền (CLAUDE.md). Ba thứ tuyệt đối không được có trong public/:
       con số hệ số, con số KPI, và phép chia ra quy đổi. */
    const src = ['public/don-hang.js', 'public/index.html', 'public/suc-khoe.js']
      .map((f) => doc(f)).join('\n');
    for (const so of ['2700000000', '15000000000', '1300000000']) {
      ok('mức KPI ' + so + ' không có trong public/', src.includes(so), false);
    }
    /* Phép chia ra quy đổi: bất kỳ chỗ nào lấy lợi nhuận chia cho một hệ số. */
    ok('không có phép chia lợi nhuận ÷ hệ số ở trình duyệt',
      /loi_nhuan\s*[\*/]\s*(100|he_so)/.test(src), false);
    ok('không có he_so_pt nào bị nhân/chia ở trình duyệt',
      /he_so_pt\s*[\*/]/.test(src) || /\/\s*he_so_pt/.test(src), false);
    /* Màn hình PHẢI đọc trường Engine trả — nếu không thì Engine tính đúng
       rồi không ai hiện ra (lớp lỗi chiếm 3/7 lỗi cuối P4). */
    ok('màn hình đọc `doanh_so_quy_doi` do Engine trả',
      doc('public/don-hang.js').includes('doanh_so_quy_doi'), true);
  }

  xong();
})();
