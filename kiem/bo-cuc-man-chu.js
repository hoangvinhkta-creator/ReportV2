/* Bố cục màn chủ — cái hợp đồng giữa P3 và nhánh P2(b).
 *
 * Chủ dự án chốt LẠI 12/09/2026: bỏ hẳn tab [Biểu đồ] — chỉ còn MỘT màn, và
 * biểu đồ nằm ngay dưới bảng [Tổng hợp], theo đúng kỳ mà bảng đang mở. Đây
 * là thứ dễ mất nhất khi hai nhánh cùng sửa index.html: chỉ cần ai đó dời
 * `#o-dashboard` ra khỏi `#manBaoCao`, hay bỏ một trong hai cửa
 * `window.SucKhoe`, là hai khối hết đồng bộ kỳ mà không bộ kiểm nào kêu.
 *
 * Bộ này canh bằng cách đọc CHÍNH index.html và don-hang.js, không dựng
 * DOM giả — thứ cần giữ là văn bản đã deploy, không phải hành vi mô phỏng.
 */
const { doc, cat, ok, xong } = require('./khung');

const HTML = doc('public/index.html');
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const JS = doc('public/don-hang.js');

console.log('\n1) KHÔNG còn tab chính — chỉ một màn duy nhất');
{
  /* Chủ dự án chốt 12/09/2026: bỏ hẳn tab [Biểu đồ], biểu đồ dời xuống dưới
     bảng, nên hàng tab chính chỉ còn một nút — tức không còn lý do tồn tại.
     Canh chiều NGƯỢC với bản trước P6: thứ phải vắng mặt, chứ không phải
     thứ phải có. */
  for (const id of ['nutManBaoCao', 'nutManBieuDo', 'tabChinh', 'manBieuDo']) {
    ok('không còn #' + id + ' trong HTML', new RegExp('id="' + id + '"').test(HTML), false);
  }
  /* Soi trên mã đã bỏ chú thích: chú thích CÓ nhắc tên hàm cũ, và nhắc là
     đúng — nó nói vì sao hàm ấy biến mất. Thứ phải vắng là lời gọi thật. */
  const maJS = JS.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  ok('  · và don-hang.js không còn hàm đổi màn', /doiManChinh\s*\(/.test(maJS), false);

  const khoiBaoCao = cat(HTML, /<section id="manBaoCao"[^>]*>/);
  ok('#manBaoCao mở sẵn (không có hidden)', /hidden/.test(khoiBaoCao), false);
}

console.log('\n2) Biểu đồ nằm TRONG màn báo cáo, ngay dưới bảng');
{
  const trongBaoCao = cat(HTML, /<section id="manBaoCao"[\s\S]*?<\/section>/);
  ok('#o-dashboard nằm trong khối #manBaoCao', /id="o-dashboard"/.test(trongBaoCao), true);
  /* "Ngay dưới bảng" là một yêu cầu về THỨ TỰ, không chỉ về chỗ chứa. */
  ok('  · và đứng SAU ô vẽ bảng',
     trongBaoCao.indexOf('id="veDonHang"') < trongBaoCao.indexOf('id="o-dashboard"'), true);
  /* Ẩn sẵn: không thì nó chớp lên một khối rỗng trong lúc lượt tải đầu chưa
     xong, và ở tab của một line nó phải ẩn hẳn. */
  ok('  · ẩn sẵn trong HTML', /id="o-dashboard"[^>]*hidden/.test(HTML), true);

  /* Hai cửa vào DUY NHẤT giữa hai nhánh — don-hang.js không được sửa thẳng
     DOM của khối biểu đồ, và suc-khoe.js không được tự đoán kỳ bằng cách soi
     nút nào đang sáng. Đây là chỗ hai nhánh dễ buộc chặt vào nhau nhất. */
  ok('don-hang.js báo kỳ sang bằng window.SucKhoe.datKy()',
     /window\.SucKhoe\.datKy\(/.test(JS), true);
  ok('  · và bật/tắt cả khối bằng window.SucKhoe.hien()',
     /window\.SucKhoe\.hien\(/.test(JS), true);
  ok('  · chỉ bật ở tab [Tổng hợp] (line === null)',
     /SucKhoe\.hien\(trangThai\.line === null && !!trangThai\.ky\)/.test(JS), true);
  ok('  · và KHÔNG sờ thẳng vào #o-dashboard', /"o-dashboard"/.test(JS), false);
  /* Cửa cũ `moTab()` chết cùng tab — còn sót một lượt gọi là gọi vào hư không. */
  ok('không còn gọi cửa cũ moTab()', /SucKhoe\.moTab/.test(JS), false);

  /* Đổi tháng thì biểu đồ phải đổi theo BẢNG — lượt báo nằm trong `taiKy`,
     nơi duy nhất mọi lượt đổi năm/tháng/line đi qua. */
  ok('mỗi lượt đổi kỳ đều báo sang biểu đồ',
     /async function taiKy[\s\S]{0,600}?baoBieuDo\(\)/.test(JS), true);
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
  /* Chủ dự án chốt LẠI 12/09/2026: cột quy đổi vẫn chen giữa [Tổng bán] và
     [Tên khách hàng], nhưng [Ghi chú] DỜI ra SAU [Địa chỉ] — ghi chú là chữ
     đọc kèm thông tin khách, không phải một cột tiền, để nó chen vào giữa
     khối tiền là cắt đôi mạch đọc. Hai cột icon vẫn ở CUỐI cùng.

     Tên cột rút còn [Quy đổi] (chủ dự án chốt 12/09/2026): tiêu đề dài hơn
     bề rộng cột thì phần thừa chỉ làm hàng tiêu đề cao lên, không thêm chữ
     nào đọc được. Ghim luôn tên CŨ đã biến mất, để một lượt sửa nửa vời
     (đổi ở bảng này mà quên bảng [Tổng hợp]) không lọt qua. */
  ok('cột quy đổi mang tên ngắn “Quy đổi”', COT.includes('Quy đổi'), true);
  ok('  · tên dài cũ đã bỏ hẳn', COT.includes('Doanh số quy đổi'), false);
  ok('“Quy đổi” nằm sau “Tổng bán”, trước “Tên khách hàng”',
     COT.indexOf('Tổng bán') < COT.indexOf('Quy đổi')
     && COT.indexOf('Quy đổi') < COT.indexOf('Tên khách hàng'), true);
  ok('“Ghi chú” nằm ngay SAU “Địa chỉ”',
     COT.indexOf('Ghi chú'), COT.indexOf('Địa chỉ') + 1);
  ok('  · và KHÔNG còn nằm trong khối tiền',
     COT.indexOf('Ghi chú') > COT.indexOf('Tên khách hàng'), true);
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

console.log('\n6) Bán trả lại (BTL) — màn hình chỉ ĐỌC cờ, không tự đặt luật');
{
  /* LUẬT SỐ 1. "Chứng từ nào là bán trả lại", "trừ bao nhiêu", "dòng nào bị
     triệt tiêu" đều là nghiệp vụ và nằm ở `engine/src/btl.mjs`. Trình duyệt
     chạm vào bất kỳ phần nào của luật ấy là một luật thứ hai, và hai bản sẽ
     trôi khỏi nhau mà không ai đối chiếu. */
  ok('không tự nhận dạng số chứng từ BTL', /\/\^BTL/i.test(JS), false);
  ok('không tự đặt số lượng −1', /so_luong\s*=\s*-\s*1/.test(JS), false);
  ok('chỉ đọc cờ Engine đặt', /d\.btl_trang_thai/.test(JS), true);

  /* Ô SL của một dòng BTL mang con số 0 hoặc −1 — hai con số trông giống
     nhau tới mức không ai đoán được vì sao, nên nó phải đi qua hàm có
     `title` giải thích chứ không phải ô trơn. */
  ok('ô SL dựng bằng oSoLuong() để còn chỗ giải thích',
     /tr\.appendChild\(oSoLuong\(d\)\)/.test(JS), true);
  ok('  · và dòng chưa truy ra tiền bôi đỏ như mọi ô chưa rõ',
     /btl_chua_ro_tien[\s\S]{0,200}classList\.add\("oChuaRo"\)/.test(JS), true);

  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('có nền riêng cho dòng BTL', /\.bangDon tr\.hangBTL > td \{/.test(cssSach), true);
  /* KHÔNG dùng lại nền đỏ của dòng 0 đồng: một cặp BTL đã triệt tiêu nhau
     cũng hiện "0" ở mọi cột tiền, và cùng màu là người đọc đi tìm một khoản
     giá vốn không hề có. */
  const nenBTL = cat(cssSach, /\.bangDon tr\.hangBTL > td \{[^}]*\}/);
  const nen0d = cat(cssSach, /\.bangDon tr\.hang0d > td \{[^}]*\}/);
  ok('  · và nền ấy KHÁC nền dòng 0 đồng', nenBTL === nen0d, false);
}

console.log('\n7) Ghi chú — lấy từ cột Diễn giải của sổ, do Engine trả về');
{
  ok('cột Ghi chú vẽ từ trường Engine trả', /tr\.appendChild\(o\(d\.ghi_chu\)\)/.test(JS), true);
  /* Chú giải dưới bảng từng ghi "Ghi chú chờ chốt công thức" — để nguyên câu
     ấy sau khi cột đã có dữ liệu là nói sai với người đọc. */
  ok('chú giải không còn nói Ghi chú chờ công thức',
     /Ghi chú chờ chốt công thức/.test(JS), false);
}

console.log('\n8) Ghim đầu cột — cuộn BÊN TRONG khung bảng, không cuộn cả trang');
{
  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  /* `overflow-x: auto` một mình đã đủ để trình duyệt tự áp `overflow-y:
     auto` (luật phụ thuộc của CSS Overflow) — nhưng phải khai TƯỜNG MINH cả
     hai, không được để một trong hai chỉ có "nhờ suy luận": người sau đọc
     CSS mà không biết luật ngầm ấy sẽ xoá nhầm dòng "thừa". Đo bằng
     Playwright trên đúng cấu hình CŨ (chỉ `overflow-x`) mới thấy: `<th>`
     dù đã `position: sticky` vẫn trôi tuột theo trang khi cuộn — sticky chỉ
     "dính" thật khi CHÍNH khung `.bocBang` là thứ đang cuộn. */
  const bocBang = cat(cssSach, /\.bocBang \{[^}]*\}/);
  ok('.bocBang khai overflow-y: auto', /overflow-y\s*:\s*auto/.test(bocBang), true);
  ok('.bocBang có max-height (JS tính lại theo màn hình lúc chạy)',
     /max-height\s*:/.test(bocBang), true);

  ok('don-hang.js có hàm tính lại chiều cao khung bảng',
     /function dieuChinhCaoBang\(\)/.test(JS), true);
  ok('  · gọi hàm ấy NGAY sau khi gắn .bocBang vào DOM — sticky cần khung đã có kích thước thật',
     /khung\.appendChild\(boc\);\s*\n\s*dieuChinhCaoBang\(\);/.test(JS), true);
  ok('  · và gắn lại theo mỗi lượt đổi cỡ màn hình',
     /addEventListener\("resize",\s*dieuChinhCaoBang\)/.test(JS), true);
  /* Đúng MỘT listener resize cho cả phiên trang — hàm này nằm ở mức module,
     không phải bên trong `veBang()`: viết nhầm vào trong đó thì mỗi lượt vẽ
     lại bảng (đổi tháng, đổi line, sửa một dòng) sẽ CHỒNG THÊM một listener
     nữa, và cuối buổi làm việc trang xử lý resize chậm dần không ai biết
     vì sao. */
  const soLanGan = (JS.match(/addEventListener\("resize"/g) || []).length;
  ok('  · đúng MỘT listener resize trong cả file, không chồng thêm mỗi lượt vẽ', soLanGan, 1);
}

console.log('\n9) Sửa tại chỗ — tự lưu khi rời dòng, không chớp "Đang tải…"');
{
  /* Chủ dự án chốt 12/09/2026: "bấm sửa xong phải bấm Enter sau đó trang
     load lại thêm 1 lần nữa rất mất thời gian" — hai việc phải sửa CÙNG
     lúc: (a) không bắt bấm Enter, rời dòng là lưu; (b) lượt tải lại sau khi
     lưu không được chớp "Đang tải…" hay nhảy cuộn về gốc. */
  ok('rời dòng (focusout ra ngoài tr) tự gọi lưu, không chỉ đợi Enter',
     /tr\.addEventListener\("focusout"/.test(JS), true);
  ok('  · xét relatedTarget còn nằm trong CHÍNH dòng đang sửa hay không '
     + '(chuyển giữa ô Giá nhập ↔ Nơi nhập không tính là rời dòng)',
     /!tr\.contains\(e\.relatedTarget\)/.test(JS), true);
  /* Enter/Escape đều xoá input khỏi DOM (qua `traLai()`), và việc xoá ấy tự
     sinh thêm một `focusout` — không chặn trùng thì Enter sẽ lưu HAI LẦN,
     còn Escape sẽ vô tình LƯU dù người dùng vừa bấm huỷ. */
  ok('có cờ chặn một phiên sửa kết thúc quá một lần (Enter/Escape đều tự '
     + 'sinh thêm một focusout)', /phien\.xong/.test(JS), true);

  ok('taiKy() nhận được tuỳ chọn gọi ÊM (không chớp "Đang tải…")',
     /async function taiKy\(tuyChon\)/.test(JS), true);
  /* TÁM chỗ gọi `taiKy({imLang:true})`, sau khi hai lượt của P4 (sửa một
     dòng, xoá một dòng) chuyển sang đường NHANH ngày 12/09/2026 — xem khối
     kế tiếp. Còn lại: gán mã xong (phải lấy GIÁ VỐN của mã vừa gán ngay,
     không bắt người dùng F5; giá theo ngày bán nằm bên Tracking nên bắt buộc
     hỏi lại máy chủ), bốn của P5 (rời khỏi dải setup sau khi sửa KPI/hệ số,
     bỏ bản ghi đè một kỳ, tick gia dụng, bấm nút "mặc định ↔ riêng tháng
     này"), một của P6 (rời khỏi BẢNG [Tổng hợp] sau khi sửa ngày công), cộng
     ĐÚNG MỘT lượt dự phòng bên trong `apBangMoi()`.

     Chú ý lượt rời dải KPI: nó vẽ lại khi tiêu điểm rời KHỎI DẢI, không vẽ
     ngay trong lượt ghi. Vẽ ngay thì ô người dùng vừa Tab sang bị xoá khỏi
     DOM giữa lúc họ đang gõ — dải là MỘT đơn vị sửa nhiều ô, khác một dòng
     sửa tay của P4 nơi lượt lưu cũng là lượt đóng ô.

     Tất cả đều phải ÊM vì tất cả là sửa TẠI CHỖ trên bảng đang mở: chớp
     "Đang tải…" rồi cuộn về gốc sau mỗi cú tick là đúng thứ chủ dự án chốt
     phải hết (12/09/2026). Và tất cả đều phải LẤY SỐ TỪ MÁY CHỦ, không tự vá
     số ở trình duyệt — đổi một hệ số là đổi mọi con số quy đổi của bảng cộng
     tổng line và phần trăm đạt, bốn con số do Engine tính (LUẬT SỐ 1).

     Đếm bằng con số tuyệt đối chứ không "≥ 3": một lượt sửa tại chỗ mới mà
     quên `imLang` sẽ làm bài này đỏ, và đó đúng là lúc cần biết. */
  ok('  · và TÁM lượt vẽ lại êm (gán mã · 4 lượt KPI của P5 · ngày công của '
     + 'P6 · 1 lượt dự phòng trong apBangMoi) đều gọi nó với tuỳ chọn ấy',
     (JS.match(/taiKy\(\{\s*imLang:\s*true\s*\}\)/g) || []).length, 8);

  /* ── Đường NHANH của sửa/xoá một dòng (chủ dự án chốt 12/09/2026: "hiển
     thị kết quả ngay lập tức thay vì phải đợi") ──

     `POST /api/sua-dong` nay trả LUÔN bảng đã tính lại, nên một lượt bấm chỉ
     còn MỘT vòng mạng thay vì hai. Máy chủ vừa ghi xong đang đứng cạnh mọi
     nguyên liệu để dựng lại bảng ấy; bắt trình duyệt gọi thêm một GET nữa là
     trả tiền hai lần cho cùng một phép tính.

     Điều KHÔNG đổi, và là điều phải canh: con số vẫn do Engine tính. Trình
     duyệt chỉ VẼ thứ máy chủ đưa. */
  ok('sửa một dòng gửi kèm line đang xem, để máy chủ dựng lại đúng bảng ấy',
     /gia_nhap: giaGui, noi_nhap: noiGui, line: trangThai\.line/.test(JS), true);
  ok('  · xoá một dòng cũng vậy', /khoa, xoa: true,\s*\n?\s*line: trangThai\.line/.test(JS), true);
  /* Đếm LỜI GỌI (`apBangMoi(kq);` có chấm phẩy), không đếm cả dòng khai hàm
     (`function apBangMoi(kq) {`) — bỏ chấm phẩy là bài này đếm ra 3 và "đúng
     hai chỗ gọi" thành một câu vô nghĩa. */
  ok('  · cả hai đi qua apBangMoi, không tự gọi lại GET',
     (JS.match(/apBangMoi\(kq\);/g) || []).length, 2);

  /* Hai ca rơi về đường cũ, cả hai đều là ca thật. Thiếu ca thứ hai là lỗi
     im lặng tệ nhất của cả lượt sửa này: người dùng bấm sửa rồi đổi sang tab
     line khác trong lúc lượt ghi đang bay, và bảng của line CŨ được vẽ đè
     lên — số của một người khác, dưới đúng cái tab mang tên mình. */
  ok('  · máy chủ không kèm bảng thì gọi lại GET như cũ',
     /if \(dungCho\) veKetQua\(b\);\s*\n\s*else taiKy\(\{ imLang: true \}\);/.test(JS), true);
  ok('  · đổi tab/tháng giữa chừng thì KHÔNG vẽ bảng của chỗ cũ',
     /kq\.ky === trangThai\.ky[\s\S]{0,120}=== trangThai\.line/.test(JS), true);

  /* Hai đường vẽ (tải lại, và bảng do lượt ghi trả về) phải đi qua ĐÚNG một
     hàm. Hai bản vẽ là hai bản trôi khỏi nhau, và chỗ trôi ở đây là con số
     hiện sau khi sửa khác con số hiện sau khi tải lại. */
  ok('cả hai đường vẽ dùng chung veKetQua()', /function veKetQua\(kq\)/.test(JS), true);
  ok('  · và taiKy() cũng đi qua nó', /veKetQua\(await goi\(duong\)\)/.test(JS), true);
  ok('  · giữ nguyên vị trí cuộn của khung bảng qua lượt vẽ lại',
     /bocMoi\.scrollTop\s*=\s*cuonCu/.test(JS), true);
}

console.log('\n10) Băng "còn N dòng chưa có giá vốn" — câu ROADMAP đòi ở P4');
{
  /* ROADMAP.md, P4 "Bạn nhìn thấy gì": *lợi nhuận của một kỳ, CỘNG danh sách
     rõ ràng "N dòng chưa có giá vốn, vì lý do gì"*. Trước 12/09/2026 lý do
     CHỈ nằm ở `title` của từng ô, nên muốn biết cả kỳ còn nợ bao nhiêu thì
     phải rê chuột từng dòng — mà đây đúng là con số người đối chiếu tay cần
     thấy trước nhất. */
  ok('băng dựng từ bản kê Engine trả, không tự cộng ở trình duyệt',
     /const tg = b\.tom_tat_gia;/.test(JS), true);
  ok('  · nói ra CẢ số dòng lẫn lý do', /chưa có giá vốn/.test(JS), true);
  ok('  · và nói khi mọi dòng đã đủ giá, không im lặng',
     /đều đã có giá vốn theo ngày bán/.test(JS), true);
  /* Kỳ ngoài phạm vi dữ liệu giá KHÔNG được hiện băng này: ở đó không có giá
     vốn theo thiết kế, và một câu "còn N dòng chưa có giá vốn" chỉ mời người
     ta đi làm một việc không làm được — đúng lý do băng gán mã cũng bị chặn
     ở đó. */
  ok('  · nhưng KHÔNG hiện ở kỳ ngoài phạm vi / lúc nguồn giá hỏng',
     /tg && kq\.trong_pham_vi_ma !== false && !kq\.loi_nguon_ma/.test(JS), true);

  /* Hai bảng dịch lý do phải phủ ĐỦ tập trạng thái của hợp đồng
     `daily-min-v1` cộng lý do nội bộ `chua-co-ma`. Thiếu một mã là màn hình
     hiện nguyên chữ tiếng Anh của app khác — đúng chuyện đã xảy ra với
     `OUT_OF_STOCK`, một trạng thái CÓ THẬT mà cả ba bản bảng dịch đều
     thiếu. */
  const doc2 = (ten) => {
    const khoi = cat(JS, new RegExp('const ' + ten + ' = \\{[\\s\\S]*?\\n  \\};'));
    return [...khoi.matchAll(/^\s*"?([A-Za-z_-]+)"?\s*:/gm)].map((m) => m[1]).sort();
  };
  const DU = ['INVALID_PRODUCT_CODE', 'NO_DATA', 'OUT_OF_STOCK',
    'SOURCE_UNAVAILABLE', 'chua-co-ma'];
  ok('bảng dịch cho tooltip phủ đủ mọi lý do', doc2('LY_DO_GIA'), DU);
  ok('bảng dịch NGẮN cho băng tổng cũng vậy', doc2('LY_DO_GIA_NGAN'), DU);
  /* Hai bản chứ không một, có chủ đích: bản tooltip là một câu đứng sau
     "Chưa có giá vốn:" nên có chủ ngữ và dấu chấm; nhét nguyên nó vào băng
     sẽ ra "12 dòng dòng này chưa được gán mã bảng giá.". */
  ok('  · và hai bản KHÁC chữ nhau, không phải một bản chép đôi',
     cat(JS, /const LY_DO_GIA = \{[\s\S]*?\n  \};/)
     === cat(JS, /const LY_DO_GIA_NGAN = \{[\s\S]*?\n  \};/), false);

  /* Engine từng giữ một bản THỨ BA, không ai import. Nó đã bị bỏ; bài này
     giữ cho nó không quay lại — ba bản của một bảng là ba chỗ để sửa nhầm. */
  const ENG = doc('engine/src/khop-ma.mjs');
  ok('Engine KHÔNG giữ một bản bảng dịch thứ ba', /export const LY_DO_GIA/.test(ENG), false);
}

console.log('\n11) Băng quyết định mồ côi ĐÃ BỎ — chốt 12/09/2026, có ghi vào CLAUDE.md');
{
  /* Bản trước canh điều NGƯỢC LẠI: băng phải có mặt và phải liệt kê đủ khoá,
     theo đúng câu trong CLAUDE.md. Chủ dự án nhìn nó ngoài đời (22 khoá in
     liền một mạch dưới mỗi bảng, ngày nào cũng thế) và chốt bỏ.

     Bài kiểm không im lặng đổi chiều: nó canh CẢ HAI vế của chốt ấy — băng
     biến mất khỏi màn hình, VÀ số liệu không mất theo (Engine vẫn tính, xem
     `kiem/sua-tay.js`), VÀ CLAUDE.md đã được sửa cho khỏi còn một luật viết
     ngược lại code. Bỏ một luật mà quên sửa file luật là để lại một cái bẫy
     cho phiên sau: người đọc CLAUDE.md sẽ tưởng code đang hỏng. */
  ok('không còn băng mồ côi trên màn hình',
     /tst\.mo_coi\.map\(\(x\) => x\.khoa\)\.join/.test(JS), false);
  ok('  · không còn đọc `tom_tat_sua_tay` để vẽ băng nào',
     /const tst = b\.tom_tat_sua_tay;/.test(JS), false);
  ok('  · nhưng chú thích nói rõ vì sao bỏ, không xoá trắng',
     /Băng QUYẾT ĐỊNH MỒ CÔI ĐÃ BỎ/.test(JS), true);

  const LUAT = doc('CLAUDE.md');
  ok('CLAUDE.md KHÔNG còn đòi màn hình in danh sách ấy',
     /màn hình phải nói rõ có bao nhiêu quyết định cũ/.test(LUAT), false);
  ok('  · và có ghi lại chốt bỏ, kèm nơi số liệu vẫn còn',
     /tom_tat_sua_tay\.mo_coi/.test(LUAT), true);
}

console.log('\n12) Ba luật hiển thị chốt 12/09/2026');
{
  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

  /* Đã phân loại mà vẫn chưa có giá vốn thì ô Giá nhập bôi ĐỎ, không để mờ.
     Trước bản này hai cảnh mờ y như nhau, nên người dùng cứ đi gán lại mã
     cho một dòng ĐÃ CÓ mã — một việc không chữa được gì. */
  ok('ô Giá nhập phân biệt "chưa gán mã" với "đã có mã mà thiếu giá"',
     /chuaGanMa \? "oChuaGia" : "oChuaRo"/.test(JS), true);
  ok('  · và nói thẳng rằng gán lại mã không chữa được',
     /gán lại mã KHÔNG chữa được/.test(JS), true);

  /* Dòng lỗ bôi đỏ cả dòng. Cờ do ENGINE đặt: ba loại dòng âm theo thiết kế
     (chiết khấu, quà tặng 0đ, bán trả lại) bị loại ra ở đó, và việc loại ấy
     là phán đoán nghiệp vụ chứ không phải một phép so `< 0`. */
  ok('dòng lỗ đọc cờ Engine, không tự xét loi_nhuan < 0',
     /d\.la_lo \? "hangLo" : null/.test(JS), true);
  ok('  · màn hình KHÔNG tự so lợi nhuận với 0', /loi_nhuan\s*<\s*0/.test(JS), false);
  ok('  · và có nền riêng, không dùng lại lớp của dòng 0 đồng',
     /\.bangDon tr\.hangLo > td \{/.test(cssSach), true);

  /* Chú giải màu dưới bảng đã BỎ (chủ dự án chốt "bỏ đi không cần"). */
  /* Bắt theo một câu CHỈ có trong chú giải ấy, không bắt theo "Tiền hiện
     theo nghìn đồng" — chuỗi đó còn nằm trong chú thích giải thích `nghin()`
     ở đầu file, và bắt trúng nó là bài kiểm đỏ vì một lời giải thích cho
     người đọc mã. */
  ok('không còn đoạn chú giải màu dưới bảng',
     /Ô vàng: chưa có mã bảng giá/.test(JS), false);
  ok('  · và cũng không còn câu chú giải về nút sửa/xoá',
     /Enter lưu, Esc huỷ|bấm ra chỗ khác hoặc Enter/.test(JS), false);
}

xong();
