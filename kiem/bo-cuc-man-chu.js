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
  ok('  · và lượt sửa/xoá một dòng đều gọi nó với tuỳ chọn ấy, không gọi taiKy() trần',
     (JS.match(/taiKy\(\{\s*imLang:\s*true\s*\}\)/g) || []).length, 2);
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

console.log('\n11) Quyết định mồ côi — CLAUDE.md đòi "kèm danh sách, không im lặng bỏ qua"');
{
  ok('băng dựng từ bản kê Engine trả', /const tst = b\.tom_tat_sua_tay;/.test(JS), true);
  ok('  · nói rõ quyết định vẫn được GIỮ, không phải đã mất',
     /tự áp[\s\S]{0,20}trở lại/.test(JS), true);
  /* "Kèm danh sách" là chữ của CLAUDE.md, không phải gợi ý: chỉ một con số
     thì người dùng không biết quyết định nào đang treo để mà đi tìm. */
  ok('  · và liệt kê ĐỦ khoá, không cắt bớt',
     /tst\.mo_coi\.map\(\(x\) => x\.khoa\)\.join/.test(JS), true);
  ok('  · không có phép cắt danh sách nào lén vào', /mo_coi\.slice\(/.test(JS), false);
}

xong();
