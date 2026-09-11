/* Bố cục màn chủ — cái hợp đồng giữa P3 và nhánh P2(b).
 *
 * Chủ dự án chốt 11/09/2026: đăng nhập xong vào thẳng [Báo cáo doanh số],
 * biểu đồ nằm SAU tab [Biểu đồ] và KHÔNG tự hiện ra nữa. Đây là thứ dễ mất
 * nhất khi hai nhánh cùng sửa index.html: chỉ cần ai đó bỏ `hidden` khỏi
 * `#manBieuDo` là biểu đồ lại đập vào mặt người dùng ngay lúc đăng nhập, mà
 * không bộ kiểm nào kêu.
 *
 * Bộ này canh bằng cách đọc CHÍNH index.html và don-hang.js, không dựng
 * DOM giả — thứ cần giữ là văn bản đã deploy, không phải hành vi mô phỏng.
 */
const { doc, cat, ok, xong } = require('./khung');

const HTML = doc('public/index.html');
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const JS = doc('public/don-hang.js');

console.log('\n1) Hai tab chính, và [Biểu đồ] KHÔNG mở sẵn lúc đăng nhập');
{
  ok('có nút [Báo cáo doanh số]', /id="nutManBaoCao"/.test(HTML), true);
  ok('có nút [Biểu đồ]', /id="nutManBieuDo"/.test(HTML), true);

  const khoiBaoCao = cat(HTML, /<section id="manBaoCao"[^>]*>/);
  ok('  · #manBaoCao mở sẵn (không có hidden)', /hidden/.test(khoiBaoCao), false);

  const khoiBieuDo = cat(HTML, /<section id="manBieuDo"[^>]*>/);
  ok('  · #manBieuDo ẩn sẵn trong HTML', /hidden/.test(khoiBieuDo), true);

  /* Không đủ nếu HTML ẩn mà mã lại mở ra ngay lúc đăng nhập. */
  ok('  · và mã quay về tab báo cáo mỗi lần đăng nhập',
     /doiManChinh\(false\)/.test(JS), true);
}

console.log('\n2) Ô #o-dashboard của P2(b) nằm TRONG tab [Biểu đồ]');
{
  const trongBieuDo = cat(HTML, /<section id="manBieuDo"[\s\S]*?<\/section>/);
  ok('#o-dashboard nằm trong khối #manBieuDo', /id="o-dashboard"/.test(trongBieuDo), true);
  /* P3 không được tự bật/tắt ô của nhánh kia nữa — trước đây tab Dashboard
     làm đúng thế và nó là lý do biểu đồ nhấp nháy mỗi lần đổi line. */
  ok('don-hang.js không còn tự bật/tắt #oDashboardBoc',
     /oDashboardBoc/.test(JS), false);
}

console.log('\n3) Năm và tháng nằm cùng một hàng');
{
  const hang = cat(HTML, /<div class="tabDonVi hangThoiGian">[\s\S]*?<\/div>\s*<\/div>/);
  ok('#tabNam và #tabThang chung một hàng',
     /id="tabNam"/.test(hang) && /id="tabThang"/.test(hang), true);
  ok('  · và năm đứng trước tháng',
     hang.indexOf('id="tabNam"') < hang.indexOf('id="tabThang"'), true);
  /* Đủ 12 tháng, tháng rỗng thì khoá — chứ không vẽ thiếu nút. */
  ok('vẽ đủ 12 nút tháng', /t <= 12/.test(JS), true);
}

console.log('\n4) Thứ tự 19 cột của bảng đơn hàng');
{
  const COT = JSON.parse(cat(JS, /const COT = \[[\s\S]*?\];/)
    .replace(/^const COT = /, '').replace(/;$/, '').replace(/,(\s*\])/, '$1'));

  ok('đủ 19 cột', COT.length, 19);
  /* Chủ dự án chốt: [Doanh số quy đổi][Ghi chú] chen vào giữa [Tổng bán] và
     [Tên khách hàng]; hai cột icon ở CUỐI cùng. */
  ok('“Doanh số quy đổi” và “Ghi chú” nằm sau “Tổng bán”, trước “Tên khách hàng”',
     COT.indexOf('Tổng bán') < COT.indexOf('Doanh số quy đổi')
     && COT.indexOf('Doanh số quy đổi') < COT.indexOf('Ghi chú')
     && COT.indexOf('Ghi chú') < COT.indexOf('Tên khách hàng'), true);
  ok('“Ghi chú” chỉ có MỘT cột (dời chỗ, không nhân đôi)',
     COT.filter((c) => c === 'Ghi chú').length, 1);
  ok('hai cột cuối là Sửa và Xoá', COT.slice(-2), ['Sửa', 'Xoá']);

  /* `hangTongDon` nhảy cóc bằng colSpan tính từ COT.length — nếu ai đó đổi
     số cột mà quên chỗ này thì hàng tổng lệch sang cột khác. */
  ok('hàng tổng đơn đặt số dưới đúng cột “Tổng bán”', COT.indexOf('Tổng bán'), 7);
  ok('  · và colSpan sau đó tính từ COT.length', /COT\.length - 8/.test(JS), true);
}

console.log('\n5) Bốn cột hẹp cắt chữ thay vì xuống dòng');
{
  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const luatHep = cat(cssSach, /\.bangDon \.oHep > span \{[^}]*\}/);
  ok('ô hẹp có text-overflow: ellipsis', /text-overflow\s*:\s*ellipsis/.test(luatHep), true);
  ok('  · và overflow: hidden', /overflow\s*:\s*hidden/.test(luatHep), true);
  ok('  · và white-space: nowrap (không ngắt dòng)',
     /white-space\s*:\s*nowrap/.test(luatHep), true);
  /* `max-width` đặt thẳng lên <td> bị bố cục bảng tự động bỏ qua — bắt buộc
     phải là <span> con thì mới cắt được. */
  ok('  · và là khối (display: block) thì max-width mới ăn',
     /display\s*:\s*block/.test(luatHep), true);

  for (const lop of ['oKhach', 'oDienThoai', 'oDiaChi', 'oImei']) {
    ok('cột .' + lop + ' có đặt max-width',
       new RegExp('\\.bangDon \\.' + lop + ' > span \\{[^}]*max-width').test(cssSach), true);
    ok('  · và don-hang.js dựng nó bằng oHep()',
       new RegExp('oHep\\([^)]*"' + lop + '"\\)').test(JS), true);
  }
}

xong();
