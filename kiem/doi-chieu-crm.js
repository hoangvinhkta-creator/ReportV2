/* ĐỐI CHIẾU ĐƠN CRM ↔ SỔ — chủ dự án chốt 28/09/2026.
 *
 * Bộ này canh, xếp theo mức đắt nếu hỏng:
 *
 *  A. BÁO KHỚP MỘT DÒNG LỆCH. Đúng thứ tính năng sinh ra để bắt (nhân viên
 *     khai giá nhập sai) mà lọt qua im lặng. Lệch là lệch TUYỆT ĐỐI — một
 *     đồng cũng là lệch.
 *  B. ĐƠN VỊ TIỀN. CRM lưu NGHÌN đồng, sổ lưu đồng. Quên nhân 1.000 thì mọi
 *     dòng đều lệch và cảnh báo thành tiếng ồn không ai đọc nữa.
 *  C. GHÉP SAI DÒNG. Mã bảng giá trước, tên hàng MISA sau, cả hai là phép
 *     BẰNG — không chứa nhau, không gần đúng (`65C6K` ≠ `65C6KS`).
 *  D. CHIỀU NGƯỢC. Đơn CRM có số BH mà sổ không có phải hiện ra; đơn đã huỷ
 *     bên CRM thì không.
 *  E. NGUỒN GIÁ HỎNG KHÔNG ĐƯỢC BIẾN THÀNH "NHÂN VIÊN KHAI SAI".
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const D = await import('file://' + path.join(GOC, 'engine/src/doi-chieu-crm.mjs'));

  const dong = (x) => Object.assign({
    khoa: 'k', ma_san_pham: 'Tivi', ma_bang_gia: null, so_luong: 1,
    gia_ban: 0, gia_nhap: null, tong_ban: 0, la_chiet_khau: false,
  }, x);
  /* Đơn mặc định thuộc line Tín Phát — một trong ba line có đối chiếu CRM. */
  const don = (so_ct, ds, line) => ({ so_ct, line: line || 'Tín Phát', dong: ds });
  const bang = (dsDon, line) => ({
    line: line === undefined ? 'Tín Phát' : line,
    ngay: [{ ngay: '2026-09-10', don: dsDon }], tom_tat: {},
  });
  const KY = '2026-09';
  const CO = { co_gia_nhap: true };
  /* Đơn CRM: tiền theo NGHÌN đồng, đúng như CRM lưu. */
  const crmDon = (x) => Object.assign({ misa: 'BH74545', owner: 'ly', status: 'done',
    discount: 0, expectDeliver: Date.UTC(2026, 8, 10) - 7 * 3600e3 }, x);

  console.log('\n1) Khớp trọn — đủ ba ô xanh, đơn "khop"');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: '65C6K', so_luong: 2,
      gia_ban: 12150000, gia_nhap: 11600000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: '65C6K', qty: 2,
      unitPrice: 12150, unitCost: 11600 }] }) }, nguoi: { ly: 'Ly' } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('SL khớp', d.crm.sl.tt, 'khop');
    ok('giá nhập khớp (CRM nhân 1.000 đúng)', d.crm.gia_nhap.tt, 'khop');
    ok('giá bán khớp', d.crm.gia_ban.tt, 'khop');
    ok('đơn khớp', b.ngay[0].don[0].crm.tt, 'khop');
    ok('đơn mang tên nhân viên CRM', b.ngay[0].don[0].crm.nguoi, 'Ly');
    ok('tổng kết đếm đúng', [b.crm.so_don_khop, b.crm.so_don_lech], [1, 0]);
  }

  console.log('\n2) Lệch TUYỆT ĐỐI — một nghìn đồng cũng là lệch (A)');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: '65C6K', so_luong: 1,
      gia_ban: 27500000, gia_nhap: 11600000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: '65C6K', qty: 1,
      unitPrice: 24500, unitCost: 11601 }] }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('giá nhập lệch 1.000 đ → lệch', d.crm.gia_nhap.tt, 'lech');
    ok('  · mang đủ hai con số, theo đồng', [d.crm.gia_nhap.report, d.crm.gia_nhap.crm],
       [11600000, 11601000]);
    ok('giá bán lệch (ca BH74940: gõ 24.500 thay 27.500)', d.crm.gia_ban.tt, 'lech');
    ok('SL vẫn khớp', d.crm.sl.tt, 'khop');
    ok('đơn lệch', b.ngay[0].don[0].crm.tt, 'lech');
  }

  console.log('\n3) SL lệch, đơn giá vẫn khớp — hai ô độc lập nhau');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', so_luong: 3,
      gia_ban: 100000, gia_nhap: 90000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: 'X1', qty: 2,
      unitPrice: 100, unitCost: 90 }] }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('SL lệch', [d.crm.sl.tt, d.crm.sl.report, d.crm.sl.crm], ['lech', 3, 2]);
    ok('đơn giá bán khớp dù SL khác', d.crm.gia_ban.tt, 'khop');
    ok('đơn giá nhập khớp dù SL khác', d.crm.gia_nhap.tt, 'khop');
  }

  console.log('\n4) Cùng một mã nhiều dòng — cộng SL rồi mới so');
  {
    const b = bang([don('BH74545', [
      dong({ ma_bang_gia: 'X1', so_luong: 1, gia_ban: 100000, gia_nhap: 90000 }),
      dong({ ma_bang_gia: 'x1 ', so_luong: 1, gia_ban: 100000, gia_nhap: 90000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: 'X1', qty: 2,
      unitPrice: 100, unitCost: 90 }] }) } }, KY, CO);
    ok('hai dòng sổ cộng lại khớp một dòng CRM SL 2',
       b.ngay[0].don[0].dong.map((d) => d.crm.sl.tt), ['khop', 'khop']);
    ok('không dư dòng CRM nào', b.ngay[0].don[0].crm.chi_crm, []);
    ok('đơn khớp', b.ngay[0].don[0].crm.tt, 'khop');
  }

  console.log('\n5) Ghép theo mã là phép BẰNG — 65C6K không ăn 65C6KS (C)');
  {
    /* Số KHÁC nhau và mỗi bên hai dòng → không có căn cứ ghép: ngoài CRM. */
    const b = bang([don('BH74545', [
      dong({ ma_bang_gia: '65C6KS', ma_san_pham: 'Tivi A', so_luong: 1, gia_ban: 1000, gia_nhap: 900 }),
      dong({ ma_bang_gia: 'Z9', ma_san_pham: 'Tivi B', so_luong: 1, gia_ban: 5000, gia_nhap: 4000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [
      { item: '65C6K', qty: 1, unitPrice: 2, unitCost: 0.9 },
      { item: 'Y8', qty: 1, unitPrice: 6, unitCost: 4 }] }) } }, KY, CO);
    ok('dòng sổ không có bên CRM', b.ngay[0].don[0].dong.map((d) => d.crm.tt), ['chi_report', 'chi_report']);
    ok('dòng CRM dư ra, có tên', b.ngay[0].don[0].crm.chi_crm.map((x) => x.ma), ['65C6K', 'Y8']);
    ok('đơn lệch', b.ngay[0].don[0].crm.tt, 'lech');

    /* Cùng cặp mã ấy mà SỐ trùng từng đồng: lượt ghép theo số nhận, nhưng
       dòng mang `khac_ma` — mã vẫn KHÔNG được coi là một. */
    const b2 = bang([don('BH74545', [dong({ ma_bang_gia: '65C6KS', so_luong: 1, gia_ban: 1000, gia_nhap: 900 })])]);
    D.doiChieuCrm(b2, { don: { o1: crmDon({ lines: [{ item: '65C6K', qty: 1,
      unitPrice: 1, unitCost: 0.9 }] }) } }, KY, CO);
    ok('số trùng → ghép, nhưng đánh dấu khác mã', b2.ngay[0].don[0].dong[0].crm.khac_ma,
       { report: '65C6KS', crm: '65C6K' });
  }

  console.log('\n5b) Ca thật BH74058 — mã viết khác, số trùng từng đồng → khớp');
  {
    const b = bang([don('BH74058', [dong({ ma_bang_gia: 'AWM8-316K B', so_luong: 1,
      gia_ban: 3900000, gia_nhap: 3600000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ misa: 'BH74058', lines: [{ item: 'AWM8-316K(B)',
      qty: 1, unitPrice: 3900, unitCost: 3600 }] }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('ba ô khớp', [d.crm.sl.tt, d.crm.gia_nhap.tt, d.crm.gia_ban.tt], ['khop', 'khop', 'khop']);
    ok('mang hai mã để màn hình nói ra', d.crm.khac_ma, { report: 'AWM8-316K B', crm: 'AWM8-316K(B)' });
    ok('đơn KHỚP, không còn "CRM có thêm"', [b.ngay[0].don[0].crm.tt, b.ngay[0].don[0].crm.chi_crm],
       ['khop', []]);
  }

  console.log('\n5c) Đơn nhiều dòng — ghép theo số từng dòng, chỉ dòng lệch thật mới ngoài CRM');
  {
    const b = bang([don('BH74060', [
      dong({ ma_bang_gia: 'A 1', so_luong: 1, gia_ban: 1000000, gia_nhap: 800000 }),
      dong({ ma_bang_gia: 'B 2', so_luong: 2, gia_ban: 500000, gia_nhap: 400000 }),
      dong({ ma_bang_gia: 'C3', so_luong: 1, gia_ban: 200000, gia_nhap: 100000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ misa: 'BH74060', lines: [
      { item: 'B(2)', qty: 2, unitPrice: 500, unitCost: 400 },
      { item: 'A(1)', qty: 1, unitPrice: 1000, unitCost: 800 }] }) } }, KY, CO);
    const ds = b.ngay[0].don[0].dong;
    ok('hai dòng số trùng → ghép dù mã khác', [ds[0].crm.sl.tt, ds[1].crm.sl.tt], ['khop', 'khop']);
    ok('dòng thứ ba không có bên CRM → ngoài CRM', ds[2].crm.tt, 'chi_report');
    ok('đơn lệch (lệch số dòng)', b.ngay[0].don[0].crm.tt, 'lech');
  }

  console.log('\n5d) Mỗi bên còn đúng một dòng, giá khác → ghép, và icon lệch nói đúng chỗ');
  {
    const b = bang([don('BH74061', [dong({ ma_bang_gia: 'X 1', so_luong: 1,
      gia_ban: 3900000, gia_nhap: 3600000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ misa: 'BH74061', lines: [{ item: 'X(1)', qty: 1,
      unitPrice: 3900, unitCost: 3500 }] }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('không còn "ngoài CRM"', d.crm.tt, undefined);
    ok('giá nhập lệch hiện đúng', [d.crm.gia_nhap.tt, d.crm.gia_ban.tt, d.crm.sl.tt], ['lech', 'khop', 'khop']);
    ok('có dấu khác mã', !!d.crm.khac_ma, true);
    ok('đơn lệch vì giá nhập', b.ngay[0].don[0].crm.tt, 'lech');
  }

  console.log('\n6) Dòng sổ chưa có mã → ghép bằng tên hàng MISA');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: null,
      ma_san_pham: 'Chân máy giặt Đa Năng - chiều', so_luong: 1, gia_ban: 150000, gia_nhap: null })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: 'CHAN-MG', qty: 1,
      unitPrice: 150, unitCost: 100, misaName: 'chân máy giặt  đa năng - chiều' }] }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('ghép được bằng tên (hoa/thường, khoảng trắng thừa)', d.crm.sl.tt, 'khop');
    ok('sổ chưa có giá nhập → "thiếu", không phải "khớp"', d.crm.gia_nhap.tt, 'thieu');
    ok('  · và đơn KHÔNG được tính là khớp', b.ngay[0].don[0].crm.tt, 'lech');
  }

  console.log('\n7) Nhân viên không khai giá nhập bên CRM → thiếu');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', so_luong: 1,
      gia_ban: 1000, gia_nhap: 900 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: 'X1', qty: 1,
      unitPrice: 1, unitCost: 0 }] }) } }, KY, CO);
    ok('giá nhập CRM 0 = chưa khai', b.ngay[0].don[0].dong[0].crm.gia_nhap,
       { tt: 'thieu', report: 900, crm: null });
  }

  console.log('\n8) Chiết khấu cả đơn CRM so với dòng "Chiết khấu" của sổ');
  {
    const ck = dong({ khoa: null, ma_san_pham: 'Chiết khấu', la_chiet_khau: true,
      so_luong: 1, gia_ban: -200000, gia_nhap: 0 });
    const hang = dong({ ma_bang_gia: 'X1', so_luong: 1, gia_ban: 1000000, gia_nhap: 900000 });
    const b = bang([don('BH74545', [hang, ck])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ discount: 200, lines: [{ item: 'X1', qty: 1,
      unitPrice: 1000, unitCost: 900 }] }) } }, KY, CO);
    ok('chiết khấu khớp đặt lên chính dòng chiết khấu', ck.crm.gia_ban.tt, 'khop');
    ok('đơn khớp', b.ngay[0].don[0].crm.tt, 'khop');

    const b2 = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', so_luong: 1,
      gia_ban: 1000000, gia_nhap: 900000 })])]);
    D.doiChieuCrm(b2, { don: { o1: crmDon({ discount: 50, lines: [{ item: 'X1', qty: 1,
      unitPrice: 1000, unitCost: 900 }] }) } }, KY, CO);
    ok('CRM có chiết khấu, sổ không có dòng nào → lệch ở cấp đơn',
       b2.ngay[0].don[0].crm.chiet_khau, { tt: 'lech', report: 0, crm: 50000 });
    ok('  · đơn lệch dù mọi dòng hàng khớp', b2.ngay[0].don[0].crm.tt, 'lech');
  }

  console.log('\n9) Sổ có, CRM không (chiều xuôi) — và chứng từ không phải BH');
  {
    const b = bang([don('BH70001', [dong({})]), don('BTL00012', [dong({})])]);
    D.doiChieuCrm(b, { don: {} }, KY, CO);
    ok('BH không có bên CRM', b.ngay[0].don[0].crm, { tt: 'khong_co_crm' });
    ok('chứng từ BTL không đối chiếu', b.ngay[0].don[1].crm, undefined);
    ok('đếm', b.crm.so_don_khong_co_crm, 1);
  }

  console.log('\n10) CRM có, sổ không (chiều ngược) — TÁCH THEO NGƯỜI (D)');
  {
    const crm = { don: {
      o1: crmDon({ misa: 'BH74545', owner: 'u1', lines: [{ item: 'X1', qty: 1, unitPrice: 1, unitCost: 1 }] }),
      o2: crmDon({ misa: 'BH74546', owner: 'u2', lines: [{ item: 'X2', qty: 2, unitPrice: 5, unitCost: 4 }], discount: 1 }),
      o3: crmDon({ misa: 'BH74547', owner: 'u2', status: 'cancel' }),
      o4: crmDon({ misa: '', owner: 'u2', status: 'done' }),
      o5: crmDon({ misa: '', owner: 'u2', status: 'wait' }),
      o6: crmDon({ misa: 'BH74548', owner: 'u3' }),
      o7: crmDon({ misa: 'BH74549', owner: 'u4' }),
      o8: crmDon({ misa: 'BH74550', owner: 'u1' }),
    }, nguoi: { u1: 'Tâm', u2: 'Kiên', u3: 'Ly', u4: 'Vinh' } };
    const tab = (line, khoa) => {
      const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', gia_ban: 1000, gia_nhap: 1000 })])], line);
      D.doiChieuCrm(b, crm, KY, Object.assign({ khoa_ca_ky: khoa || [] }, CO));
      return b.crm;
    };
    const tan = tab('Tân Á');
    ok('tab Tân Á: chỉ đơn của Kiên có số BH mà sổ không có', tan.chi_crm.map((x) => x.so_bh), ['BH74546']);
    ok('  · kèm người, ngày, tổng tiền theo đồng (2×5.000 − 1.000)',
       [tan.chi_crm[0].nguoi, tan.chi_crm[0].ngay, tan.chi_crm[0].tong], ['Kiên', '10/09/2026', 9000]);
    ok('  · đơn đã huỷ không bị kể', tan.chi_crm.some((x) => x.id === 'o3'), false);
    ok('  · đơn đã giao chưa có số BH → danh sách riêng', tan.chua_bh.map((x) => x.id), ['o4']);
    ok('  · đơn chưa giao chưa có số BH → không kể', tan.chua_bh.some((x) => x.id === 'o5'), false);
    ok('tab Tổng kho: chỉ đơn của Ly', tab('Tổng kho').chi_crm.map((x) => x.so_bh), ['BH74548']);
    ok('tab Tín Phát: đơn của Tâm mà sổ không có (BH74545 CÓ trên sổ nên không kể)',
       tab('Tín Phát').chi_crm.map((x) => x.so_bh), ['BH74550']);
    ok('số BH sổ ghi ở line KHÁC vẫn là "có trên sổ" (khoá cả kỳ)',
       tab('Tín Phát', ['BH74550|tivi|1']).chi_crm, []);
    ok('người không có trong bảng (Vinh) không bị liệt kê ở đâu',
       tab(null).chi_crm.some((x) => x.id === 'o7'), false);
    ok('lineCuaNguoiCrm bỏ dấu, hạ chữ', [D.lineCuaNguoiCrm('Tâm'), D.lineCuaNguoiCrm('KIÊN'),
       D.lineCuaNguoiCrm(' Ly '), D.lineCuaNguoiCrm('Vinh')], ['Tín Phát', 'Tân Á', 'Tổng kho', null]);
  }

  console.log('\n10b) Line không dùng CRM (Nội thành…) — không đối chiếu');
  {
    const b = bang([don('BH70001', [dong({})], 'Nội thành')], 'Nội thành');
    D.doiChieuCrm(b, { don: {} }, KY, CO);
    ok('không có nhãn "Không có CRM"', b.ngay[0].don[0].crm, undefined);
    ok('không bị đếm', b.crm.so_don_khong_co_crm, 0);
  }

  console.log('\n11) Đơn CRM đã huỷ mà sổ vẫn có → lệch');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', gia_ban: 1000, gia_nhap: 1000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ status: 'cancel', lines: [{ item: 'X1', qty: 1,
      unitPrice: 1, unitCost: 1 }] }) } }, KY, CO);
    ok('đơn lệch, cờ huỷ', [b.ngay[0].don[0].crm.tt, b.ngay[0].don[0].crm.huy], ['lech', true]);
  }

  console.log('\n12) Nguồn giá hỏng / kỳ chưa có giá vốn → giá nhập "bỏ qua" (E)');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', gia_ban: 1000, gia_nhap: null })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [{ item: 'X1', qty: 1,
      unitPrice: 1, unitCost: 5 }] }) } }, KY, { co_gia_nhap: false });
    ok('giá nhập bỏ qua, không phải thiếu', b.ngay[0].don[0].dong[0].crm.gia_nhap.tt, 'bo_qua');
    ok('  · đơn vẫn khớp nhờ SL và giá bán', b.ngay[0].don[0].crm.tt, 'khop');
  }

  console.log('\n13) Đơn CRM dạng cũ không có mảng lines');
  {
    const b = bang([don('BH74545', [dong({ ma_bang_gia: 'X1', so_luong: 2,
      gia_ban: 500000, gia_nhap: 400000 })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ item: 'X1', qty: 2, price: 1000, costPrice: 800 }) } }, KY, CO);
    const d = b.ngay[0].don[0].dong[0];
    ok('đọc đơn giá = tổng ÷ SL, đúng luật ordLines() bên CRM',
       [d.crm.sl.tt, d.crm.gia_ban.tt, d.crm.gia_nhap.tt], ['khop', 'khop', 'khop']);
  }

  console.log('\n14) Dòng dính bán trả lại không bị so');
  {
    const b = bang([don('BH74545', [
      dong({ ma_bang_gia: 'X1', so_luong: 0, gia_ban: 1000, btl_trang_thai: 'da_tra' })])]);
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [] , item: '', qty: 0 }) } }, KY, CO);
    ok('dòng BTL mang cờ btl', b.ngay[0].don[0].dong[0].crm, { tt: 'btl' });
  }

  console.log('\n15) Chứng từ rải hai ngày được gom lại trước khi so');
  {
    const b = { line: 'Tín Phát', tom_tat: {}, ngay: [
      { ngay: '2026-09-10', don: [don('BH74545', [dong({ ma_bang_gia: 'X1', gia_ban: 1000, gia_nhap: 1000 })])] },
      { ngay: '2026-09-11', don: [don('BH74545', [dong({ ma_bang_gia: 'X2', gia_ban: 2000, gia_nhap: 1000 })])] },
    ] };
    D.doiChieuCrm(b, { don: { o1: crmDon({ lines: [
      { item: 'X1', qty: 1, unitPrice: 1, unitCost: 1 },
      { item: 'X2', qty: 1, unitPrice: 2, unitCost: 1 }] }) } }, KY, CO);
    ok('cả hai nửa đều khớp', [b.ngay[0].don[0].crm.tt, b.ngay[1].don[0].crm.tt], ['khop', 'khop']);
    ok('đếm là MỘT đơn', b.crm.so_don_khop, 1);
  }

  console.log('\n16) Kỳ trước mốc không đối chiếu');
  {
    const b = bang([don('BH70001', [dong({})])]);
    D.doiChieuCrm(b, { don: {} }, '2026-08', CO);
    ok('không có cờ nào', [b.crm, b.ngay[0].don[0].crm], [undefined, undefined]);
  }

  console.log('\n17) keHoachCrm — khoảng số BH để tra');
  {
    const k = D.keHoachCrm(['BH74545|tivi|1', 'BH74600|x|1', 'BH75500|y|1',
      'BTL00001|z|1', 'BH100001|w|1'], KY);
    ok('tách cụm khi cách nhau quá xa, tách theo số chữ số',
       k.khoang, [['BH74545', 'BH74600'], ['BH75500', 'BH75500'], ['BH100001', 'BH100001']]);
    ok('mốc tháng theo giờ VN', [k.tu, k.den],
       [Date.UTC(2026, 8, 1) - 7 * 3600e3, Date.UTC(2026, 9, 1) - 7 * 3600e3 - 1]);
    ok('nhận cả đối tượng bc/dong', D.keHoachCrm({ 'BH1|a|1': {} }, KY).khoang, [['BH1', 'BH1']]);
    ok('kỳ trước mốc: không tra gì', D.keHoachCrm(['BH1|a|1'], '2026-08').co, false);
  }

  xong();
})();
