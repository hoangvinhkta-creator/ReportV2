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
  /* Biểu đồ hoãn vẽ tới lần đầu mở tab — chỉ có tác dụng nếu khung tab
     thật sự báo sang. Quên dòng này thì tab [Biểu đồ] mở ra TRỐNG mãi mãi,
     mà mọi bộ kiểm khác vẫn xanh. */
  ok('mở tab [Biểu đồ] thì báo sang suc-khoe.js qua window.SucKhoe.moTab()',
     /window\.SucKhoe\.moTab\(\)/.test(JS), true);
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

  /* Bề rộng cột chốt cố định (P4) — `<colgroup>` chỉ đúng khi số <col> khớp
     số cột. Thiếu một số thì cột cuối mất bề rộng và bảng lại co giãn theo
     nội dung đúng lúc P4 điền chữ vào; thừa một số thì lệch hết từ chỗ đó
     trở đi. Cả hai đều là "biến dạng cột" mà chủ dự án chốt phải hết. */
  const RONG = JSON.parse(cat(JS, /const RONG_COT = \[[\s\S]*?\];/)
    .replace(/^const RONG_COT = /, '').replace(/;$/, ''));
  ok('RONG_COT có đúng một số cho mỗi cột', RONG.length, COT.length);
  ok('mọi bề rộng đều là số dương', RONG.every((w) => Number.isFinite(w) && w > 0), true);
  ok('bảng đơn khai table-layout: fixed',
     /\.bangDon\s*\{[^}]*table-layout:\s*fixed/.test(HTML), true);
  ok('ô bảng đơn có overflow: hidden (bố cục cố định KHÔNG tự cắt chữ tràn)',
     /\.bangDon th,\s*\.bangDon td\s*\{[^}]*overflow:\s*hidden/.test(HTML), true);

  /* Đo thật trên Chromium 12/09/2026: thiếu dòng khai bề rộng TOÀN BẢNG thì
     `table-layout: fixed` vẫn co bảng cho vừa khung bọc rồi chia lại theo TỈ
     LỆ — và tỉ lệ phụ thuộc nội dung, nên cột "Hãng" nhảy 47px → 49px ngay
     sau một lượt gán mã. Đúng cái "biến dạng cột" chủ dự án chốt phải hết,
     và không một bài kiểm tĩnh nào trước đó thấy. Phải tính từ RONG_COT chứ
     không gõ tay một con số — gõ tay là mời một bản lệch nằm im. */
  ok('bề rộng toàn bảng khai tường minh, tính từ tổng RONG_COT',
     /bang\.style\.width\s*=\s*RONG_COT\.reduce/.test(JS), true);
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
