/* PHỤ PHÍ CỐ ĐỊNH TRÊN SỔ — Chi phí vận chuyển / Chi phí lắp đặt / Chênh VAT
 * (engine/src/khop-ma.mjs).
 *
 * Ba thứ bộ này canh, xếp theo mức đắt nếu hỏng:
 *
 *  A. RƠI VÀO HÀNG CHỜ GÁN MÃ. Ba khoản này không phải mặt hàng — chủ dự án
 *     chốt 12/09/2026 "cố định không cần phân loại". Đưa chúng vào hàng chờ
 *     là mời người dùng đi phân loại một khoản tiền công/tiền chênh không hề
 *     có trên bảng giá Tracking.
 *
 *  B. GIÁ NHẬP SAI CÔNG THỨC. Giá nhập phải LUÔN bằng giá bán — không tra
 *     Tracking, không đoán theo mã nào cả. Lợi nhuận phải ra 0 khi sổ ghi
 *     đúng "Doanh số bán = SL × Đơn giá" như những dòng phụ phí vẫn có.
 *
 *  C. NHẬN NHẦM MỘT MẶT HÀNG THẬT THÀNH PHỤ PHÍ. Cụm phải khớp CHÍNH XÁC ba
 *     nhãn đã chốt — một cái tên tình cờ chứa một phần của cụm (ví dụ chỉ có
 *     chữ "vận chuyển" mà không có "chi phí") không được rơi vào nhánh này.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));

  const BOARD = { '65C6K': { name: '65C6K', alt: [], brand: 'TCL', category_label: 'Tivi' } };
  const BANG_LINE = { 'Tín Phát': { thu_tu: 1, nguon: ['Tín Phát 0869931931'] } };

  const dg = (o) => ({
    ngay: o.ngay || '2026-09-08', so_ct: o.ct, ten_hang: o.ten,
    so_luong: o.sl ?? 1, don_gia: o.dg, doanh_so: (o.sl ?? 1) * o.dg,
    chiet_khau: 0, nhan_vien: 'Tín Phát 0869931931', imei: null,
  });

  function dungBang(ds) {
    const dong = {};
    const dem = new Map();
    for (const o of ds) {
      const lan = (dem.get(o.ct + '\x1f' + o.ten) || 0) + 1;
      dem.set(o.ct + '\x1f' + o.ten, lan);
      dong[D.khoaDong(o.ct, o.ten, lan)] = dg(o);
    }
    const bang = D.dungBangDon(dong, {}, BANG_LINE, null);
    K.khopMaChoBangDon(bang, { board: BOARD, alias: {}, inv_map: {} }, '2026-09');
    K.dienGiaNhap(bang, { currency_unit: 'VND_THOUSAND', records: [], errors: [] });
    return bang;
  }
  const moiDong = (b) => {
    const r = [];
    for (const ng of b.ngay) for (const don of ng.don) for (const d of don.dong) r.push(d);
    return r;
  };
  const tim = (b, ten) => moiDong(b).find((d) => d.ma_san_pham === ten);

  /* ─────────── A. Nhận ra ba khoản, không rơi vào hàng chờ gán mã ─────────── */

  console.log('\nA) Ba khoản phụ phí cố định — không vào hàng chờ gán mã');
  {
    const b = dungBang([
      { ct: 'BH1', ten: 'Chi phí vận chuyển', dg: 200000 },
      { ct: 'BH1', ten: 'Chi phí lắp đặt TV 65 inch', dg: 500000 },
      { ct: 'BH1', ten: 'Chênh VAT', dg: 100000 },
      { ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000 },
    ]);

    for (const ten of ['Chi phí vận chuyển', 'Chi phí lắp đặt TV 65 inch', 'Chênh VAT']) {
      const d = tim(b, ten);
      ok('"' + ten + '" không có mã bảng giá', d.ma_bang_gia, null);
      ok('  · nguồn nói rõ đây là phụ phí cố định', d.nguon_ma, 'phu-phi-co-dinh');
      ok('  · không mang khoá tên (không cần gán tay)', d.khoa_ten, null);
      ok('  · không có lý do "chưa khớp" (nó chưa từng được đưa đi khớp)',
        d.ly_do_chua_ma, null);
    }
    /* "Chi phí lắp đặt TV 65 inch" phải khớp đúng nhãn "Chi phí lắp đặt" —
       phần "TV 65 inch" chỉ là mô tả thêm của người bán, không đổi nhãn. */
    ok('cụm khớp giữ ĐÚNG nhãn đã chốt, không lẫn phần mô tả thêm',
      tim(b, 'Chi phí lắp đặt TV 65 inch').la_phu_phi_co_dinh, 'Chi phí lắp đặt');

    /* Cụm không bắt buộc đứng ĐẦU câu — người bán hàng có thể viết mô tả
       TRƯỚC nó. Không có ca này thì một phép sửa lỡ tay bó khớp về "chỉ
       nhận ở đầu câu" vẫn để mọi bài kiểm ở trên xanh, vì mọi ví dụ khác
       đều tình cờ đặt cụm ở đầu. */
    const b2 = dungBang([{ ct: 'BH1b', ten: 'TV 65 inch - Chi phí lắp đặt', dg: 500000 }]);
    ok('cụm khớp dù đứng SAU phần mô tả, không chỉ ở đầu câu',
      tim(b2, 'TV 65 inch - Chi phí lắp đặt').la_phu_phi_co_dinh, 'Chi phí lắp đặt');

    const tt = b.tom_tat_ma;
    ok('bản kê CHỈ đếm dòng hàng thật (không tính ba khoản phụ phí)',
      tt.tong_dong, 1);
    ok('  · và hàng chờ gán mã rỗng', tt.chua_khop.length, 0);
  }

  /* ─────────── B. Giá nhập = giá bán, lợi nhuận = 0 ─────────── */

  console.log('\nB) Giá nhập luôn bằng giá bán, không tra Tracking');
  {
    const b = dungBang([{ ct: 'BH2', ten: 'Chi phí lắp đặt', dg: 500000 }]);
    const d = tim(b, 'Chi phí lắp đặt');

    ok('giá nhập bằng đúng giá bán', d.gia_nhap, d.gia_ban);
    ok('  · và bằng đúng 500.000', d.gia_nhap, 500000);
    ok('lợi nhuận ra 0 (không lãi cũng không lỗ)', d.loi_nhuan, 0);
    /* Nơi nhập mặc định là KHO (chủ dự án chốt 12/09/2026): vận chuyển và
       lắp đặt là công của CHÍNH nhà mình bỏ ra, không mua của NCC nào. */
    ok('nơi nhập mặc định là Kho', d.noi_nhap, 'Kho');
    /* Nhưng KHÔNG phải cả ba: "Chênh VAT" là một khoản chênh lệch thuế,
       không có hàng nào đi ra khỏi kho, nên gán cho nó một nơi nhập là bịa
       ra một sự kiện kho chưa từng xảy ra. */
    ok('  · nhưng Chênh VAT thì KHÔNG — không có hàng nào rời kho',
      tim(dungBang([{ ct: 'BH2b', ten: 'Chênh VAT', dg: 100000 }]), 'Chênh VAT').noi_nhap, null);
    ok('  · và vận chuyển cũng là Kho như lắp đặt',
      tim(dungBang([{ ct: 'BH2c', ten: 'Chi phí vận chuyển', dg: 200000 }]),
        'Chi phí vận chuyển').noi_nhap, 'Kho');
    ok('không mang lý do "chưa có giá" (không phải một dòng đang thiếu)',
      d.ly_do_chua_gia, null);

    /* Không tính vào bản kê "còn bao nhiêu dòng chưa có giá vốn" — ba khoản
       này không đi qua Tracking nên không thuộc phép đếm ấy, giống hệt dòng
       chiết khấu. */
    ok('không lọt vào bản kê "chưa có giá vốn"',
      b.tom_tat_gia.chua_co_gia, 0);
    ok('không được tính là "đã tra được giá vốn từ Tracking"',
      b.tom_tat_gia.co_gia, 0);
    ok('không bị đếm là dòng 0 đồng dù không tra Tracking',
      b.tom_tat_gia.so_dong_0d, 0);

    /* Lợi nhuận của CẢ ĐƠN vẫn phải ra một con số, không phải `null` — đơn
       này chỉ có đúng một dòng, và dòng ấy đã biết chắc lợi nhuận. */
    ok('lợi nhuận của đơn tính được (không bị coi là "thiếu giá")',
      b.ngay[0].don[0].loi_nhuan, 0);
  }

  console.log('\nB2) Sổ ghi lệch VAT vẫn ra đúng số, số lượng khác 1 vẫn nhân đúng');
  {
    /* Đơn giá 300.000, SL 2 → doanh số 600.000. Lợi nhuận vẫn phải ra 0. */
    const b = dungBang([{ ct: 'BH3', ten: 'Chi phí lắp đặt điều hoà', dg: 300000, sl: 2 }]);
    const d = tim(b, 'Chi phí lắp đặt điều hoà');
    ok('giá nhập = giá bán dù số lượng khác 1', d.gia_nhap, 300000);
    ok('lợi nhuận vẫn ra 0 khi tổng bán đúng bằng giá bán × SL', d.loi_nhuan, 0);
  }

  /* ─────────── C. Không nhận nhầm một mặt hàng thật ─────────── */

  console.log('\nC) Không nhận nhầm — chỉ khớp ĐÚNG cụm đã chốt');
  {
    const b = dungBang([
      { ct: 'BH4', ten: 'Dịch vụ vận chuyển nội thành', dg: 100000 },
      { ct: 'BH4', ten: 'Lắp đặt máy lạnh Daikin', dg: 200000 },
    ]);
    /* "Dịch vụ vận chuyển" và "Lắp đặt" KHÔNG phải "Chi phí vận chuyển" /
       "Chi phí lắp đặt" — thiếu chữ "Chi phí" ở đầu là một cụm khác, và cụm
       khác thì phải xuống hàng chờ như mọi tên hàng lạ khác, không được
       đoán là "chắc cũng là phụ phí". */
    const vc = tim(b, 'Dịch vụ vận chuyển nội thành');
    const ld = tim(b, 'Lắp đặt máy lạnh Daikin');
    ok('"Dịch vụ vận chuyển…" KHÔNG bị nhận là phụ phí cố định',
      vc.la_phu_phi_co_dinh, undefined);
    ok('  · xuống hàng chờ gán mã như bình thường', vc.ly_do_chua_ma, 'chua-khop');
    ok('"Lắp đặt…" (thiếu "Chi phí") KHÔNG bị nhận là phụ phí cố định',
      ld.la_phu_phi_co_dinh, undefined);
  }

  console.log('\nC2) Bỏ dấu, hoa/thường không làm trật khớp — vẫn CHỈ đúng ba nhãn');
  {
    const b = dungBang([
      { ct: 'BH5', ten: 'CHI PHI VAN CHUYEN', dg: 150000 },
      { ct: 'BH5', ten: 'chi phí Lắp Đặt máy giặt', dg: 250000 },
      { ct: 'BH5', ten: 'chênh vat', dg: 50000 },
    ]);
    ok('viết hoa hết, bỏ dấu vẫn khớp "Chi phí vận chuyển"',
      tim(b, 'CHI PHI VAN CHUYEN').la_phu_phi_co_dinh, 'Chi phí vận chuyển');
    ok('hoa/thường lẫn lộn, có thêm mô tả vẫn khớp "Chi phí lắp đặt"',
      tim(b, 'chi phí Lắp Đặt máy giặt').la_phu_phi_co_dinh, 'Chi phí lắp đặt');
    ok('chữ thường hết vẫn khớp "Chênh VAT"',
      tim(b, 'chênh vat').la_phu_phi_co_dinh, 'Chênh VAT');
  }

  xong();
})();
