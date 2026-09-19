/* BIỂU ĐỒ CƠ CẤU NGÀNH HÀNG — phần MÀN HÌNH và GATEWAY.
 *
 * `kiem/co-cau.js` canh nghiệp vụ (Engine). Bộ này canh phần còn lại của lát
 * cắt dọc: hợp đồng giữa trang tĩnh và Gateway.
 *
 * Năm chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. LUẬT SỐ 1 RÒ RA TRÌNH DUYỆT. Ngưỡng "top 8" và "dưới 5%" là phép cộng
 *     tiền rồi chia tỉ lệ — chép sang `public/co-cau.js` là dựng bản thứ hai
 *     của một luật, và hai bản trôi khỏi nhau trong im lặng.
 *  B. MÀU ĐỔI GIỮA HAI CỘT. Màu gán theo vị trí trong cột thì Samsung là màu
 *     #1 ở cột Tủ lạnh và màu #3 ở cột Tivi — người đọc hết quét màu dọc
 *     được, và hai cột cạnh nhau hết so được với nhau.
 *  C. ĐỘ PHỦ BỊ GIẤU. Con số này là thứ duy nhất giữ cho biểu đồ không nói
 *     dối khi hai tháng gán mã khác nhau.
 *  D. NGUỒN HỎNG NÓI THÀNH KẾT LUẬN. Tracking hỏng → mọi thứ rơi vào "Chưa
 *     phân loại", và một biểu đồ trống không giải thích đọc ra thành "tháng
 *     này không bán gì" (CLAUDE.md).
 *  E. HAI BẢNG SỐ TRÔI KHỎI NHAU. Biểu đồ phải dùng lại CHÍNH đường dựng
 *     bảng đơn, không đọc `bc/dong` bằng một lối thứ hai.
 */
const path = require('path');
const { doc, ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const E = await import('file://' + path.join(GOC, 'engine/src/co-cau.mjs'));

  const HTML = doc('public/index.html');
  const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const FE = doc('public/co-cau.js');
  const SK = doc('public/suc-khoe.js');
  const DH = doc('public/don-hang.js');
  const GW = doc('src/index.js');
  /* Soi trên mã ĐÃ BỎ CHÚ THÍCH ở những bài "thứ này phải vắng mặt": chú
     thích của file có nhắc tên các ngưỡng, và nhắc là đúng — nó nói vì sao
     chúng KHÔNG ở đây. Thứ phải vắng là mã thật. */
  const sach = (m) => m.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const FE_SACH = sach(FE);

  console.log('\nA) LUẬT SỐ 1 — màn hình không cộng một đồng nào');
  {
    /* Hai ngưỡng là quyết định nghiệp vụ, và chúng CHỈ có một bản, ở Engine.
       Màn hình nhận đúng những cột phải vẽ. */
    ok('không khai lại ngưỡng top-8', /\b8\b[^\n]*ngành|SO_NGANH/.test(FE_SACH), false);
    ok('không khai lại ngưỡng 5%', /NGUONG_HANG|\.05\b|\b5\s*\/\s*100/.test(FE_SACH), false);
    /* Không tự xếp hạng lại CỘT hay RUỘT CỘT, không tự cắt danh sách — hai
       việc ấy LÀ phép gộp, và Engine đã làm xong.

       Có đúng MỘT phép `sort` được phép: xếp danh sách CHÚ GIẢI MÀU trong
       card theo doanh số. Nó sắp một danh sách màu để mắt dễ dò, không đổi
       một con số nào hiện ra — số vẫn lấy nguyên từ từng mảng Engine trả
       về. Ghim đúng một lượt để một phép sort thứ hai lẻn vào thì đỏ. */
    ok('chỉ có ĐÚNG MỘT phép sort (chú giải màu)',
       (FE_SACH.match(/\.sort\(/g) || []).length, 1);
    ok('  · và nó KHÔNG sắp lại cột hay ruột cột',
       /\.cot\.sort\(|\.hang\.sort\(|\.gom\.sort\(/.test(FE_SACH), false);
    ok('không tự cắt danh sách', /\.slice\(0,\s*\d/.test(FE_SACH), false);
    /* Và không tự quyết dòng nào được tính — đó là `laDongTinhCoCau`. */
    ok('không tự lọc dòng hàng',
       /la_chiet_khau|la_phu_phi|btl_trang_thai|tong_ban/.test(FE_SACH), false);

    /* Thứ nó ĐƯỢC phép tính: phần trăm để quy ra chiều cao pixel. Đó là một
       phép đổi đơn vị vẽ, không phải một con số người đọc ra. */
    ok('có quy tỉ lệ ra chiều cao', /gia_tri\s*\/\s*tong/.test(FE_SACH), true);

    ok('mọi fetch đều vào /api/', [...FE.matchAll(/fetch\(\s*['"`]([^'"`]+)/g)]
       .map((m) => m[1]).filter((d) => !d.startsWith('/api/')), []);
    ok('hỏi đúng đường /api/co-cau', /\/api\/co-cau\?ky=/.test(FE), true);
  }

  console.log('\nB) Màu lấy từ MỘT bảng dùng chung, không băm tại chỗ');
  {
    /* Bản đầu băm tên hãng ra một trong mười hai màu. Về lý thì cùng tên ra
       cùng màu; về mắt thì hai hãng đụng cùng một ô băm là chuyện thường
       với vài chục cái tên — và khi ấy hai mảng cùng màu KHÔNG phải cùng một
       hãng, tức màu nói sai đúng điều nó sinh ra để nói.

       Bảng và mọi bài kiểm về màu nay ở `kiem/mau-hang.js`; ở đây chỉ canh
       rằng file này KHÔNG dựng lại một bộ màu của riêng nó. */
    ok('không còn hàm băm màu tại chỗ', /charCodeAt|0x811c9dc5/.test(FE_SACH), false);
    ok('  · và không khai một mã màu nào', /#[0-9a-f]{6}/i.test(FE_SACH), false);
    ok('lấy màu qua cửa chung window.MauHang', /window\.MauHang/.test(FE), true);
    /* Thiếu file kia thì NÓI một câu rồi dừng — không vẽ một biểu đồ nửa
       màu, thứ trông như dữ liệu hỏng chứ không như thiếu một file. */
    ok('  · thiếu bảng màu thì nói thẳng, không vẽ nửa vời',
       /Chưa tải được bảng màu/.test(FE), true);
  }

  console.log('\nB2) Ba lỗi bố cục của bản đầu, sau khi chủ dự án mở thật');
  {
    /* 1 — KHUNG SVG SAI TỈ LỆ. Bản đầu khai `viewBox` cứng rồi để trình
       duyệt tự chừa hai dải trắng; đo trên ảnh chụp thật, biểu đồ chỉ chiếm
       chừng nửa chỗ đang có. Nay ĐO khung rồi tính chiều cao hệ toạ độ theo
       đúng tỉ lệ ấy — y như biểu đồ doanh số bên trái vẫn làm. */
    ok('chiều cao hệ toạ độ tính từ khung THẬT',
       /RONG \* h \/ w/.test(FE), true);
    ok('  · và vẽ SAU khi khối đã vào trang (không thì đo ra 0)',
       FE.indexOf('oVe.appendChild(hang)') < FE.indexOf('veHinh(oHinh, kq)'), true);
    /* Lượt vẽ đầu của mỗi lần mở trang vẫn đo phải một cột chưa được ép
       chiều cao — `veLai()` gọi vẽ TRƯỚC `canhCaoKhoi()`. Nên phải có đường
       đo lại, và Dashboard phải gọi nó. */
    ok('  · có cửa canhLai() để đo lại', /window\.CoCau = \{ ve, canhLai \}/.test(FE), true);
    ok('  · và Dashboard gọi nó sau khi ép chiều cao',
       /window\.CoCau\.canhLai\(\)/.test(SK), true);

    /* 2 — TRỤC DỌC CỨNG 0–100%. Với 8–11 ngành thì không ngành nào chiếm
       quá chừng 35%, nên hai phần ba phía trên là khoảng trắng vĩnh viễn. */
    ok('trần trục co theo cột cao nhất', /function tranTruc/.test(FE), true);
    ok('  · làm tròn LÊN bội số 5', /Math\.ceil\([\s\S]{0,40}\/ 5\) \* 5/.test(FE), true);
    ok('  · có sàn để tháng một-ngành không vẽ cột chạm nóc',
       /SAN_TRAN_PT/.test(FE), true);
    /* Trần lấy theo cột cao nhất của CẢ HAI tháng — lấy riêng tháng này thì
       cột năm trước cao hơn sẽ tràn ra khỏi khung. */
    ok('  · và xét cả cột của năm trước', /if \(kq\.co_ky_truoc\) \{\s*\n\s*for \(const c of B\.cot\)/.test(FE), true);

    /* 3 — CARD bên phải, và bỏ nút [Số máy]. */
    ok('có card bên phải', /cardCoCau/.test(FE), true);
    ok('  · bấm một mảng thì ghim vào card', /datChon\(c\.ten/.test(FE), true);
    ok('  · KHÔNG còn nút [Số máy]', /"Số máy"\)/.test(FE_SACH), false);
    ok('  · và không còn trạng thái chỉ tiêu', /chiTieu/.test(FE_SACH), false);
    /* Số máy nay sống trong card, cạnh doanh số của cùng một mảng. */
    ok('  · card hiện CẢ doanh số lẫn số máy',
       /veKhoiSo\("Doanh số"/.test(FE) && /veKhoiSo\("Số máy"/.test(FE), true);
    /* Năm trước bằng 0 thì KHÔNG in "+∞%" — nói thẳng "năm trước không có". */
    ok('  · và không bịa phần trăm khi năm trước bằng 0',
       /năm trước không có/.test(FE), true);
  }

  console.log('\nB3) Bốn chỗ chủ dự án chốt lại sau lượt mở thật thứ hai');
  {
    /* 1 — NÚT LỌC LÊN HÀNG TRÊN, HAI DÒNG GIẢI THÍCH DƯỚI BIỂU ĐỒ BỎ ĐI.
       Cả hai ăn chiều cao của một khối vốn đã chật; nửa phải của hàng tiêu
       đề thì bỏ không. */
    ok('dải nút đặt vào hàng TIÊU ĐỀ', /cha\.insertBefore\(dai, oTieuDe\)/.test(FE), true);
    ok('  · không còn đắp lên trên biểu đồ',
       /oVe\.appendChild\(veDaiNut/.test(FE_SACH), false);
    /* Dải này nằm NGOÀI `oVe`, tức ngoài thứ `veRuot()` dọn mỗi lượt — nên
       phải có một đường gỡ riêng, không thì nút của tháng cũ treo lại. */
    ok('  · và có đường gỡ riêng khi đổi tháng', /function boDaiNut/.test(FE), true);
    ok('  · gọi lúc đang tải tháng mới', /boDaiNut\(\);/.test(FE), true);
    ok('không còn hai dòng độ phủ DƯỚI biểu đồ',
       /veChuGiaiDoPhu/.test(FE), false);
    /* Nhưng con số độ phủ KHÔNG mất — nó vào card. Bỏ hẳn nó là biểu đồ so
       hai tháng gán mã khác nhau mà không nói (CLAUDE.md). */
    ok('  · nhưng độ phủ vẫn hiện, trong card', /veDoPhu\(kq\)/.test(FE), true);
    ok('  · và cảnh báo lệch độ phủ vẫn còn', /function chipLechDoPhu/.test(FE), true);

    /* 2 — MÀU: MỘT HÃNG MỘT MÀU Ở MỌI CỘT, KHÔNG BIẾN THỂ SẮC ĐỘ.
       Bản trước làm nhạt cả cột năm trước bằng `opacity`. Đó đúng là một
       biến thể sắc độ của màu hãng — mảng Samsung ở cột phải không ra đúng
       màu Samsung, tức màu nói sai điều nó sinh ra để nói. */
    ok('mảng cột năm trước KHÔNG bị làm nhạt',
       /\.mangCoCau\.mangTruoc\s*\{[^}]*opacity/.test(CSS), false);
    ok('  · và không mảng nào mang opacity',
       /\.mangCoCau[^{]*\{[^}]*opacity/.test(CSS), false);
    /* Tín hiệu "tháng nào" phải nằm NGOÀI mảng màu — hai thứ xám, không
       đụng tới bảng màu hãng. */
    ok('  · thay bằng vạch chân cột', /\.chanCot\b/.test(CSS) && /chanCotTruoc/.test(FE), true);
    ok('  · vạch chân vẽ cả khi cột cao 0', FE.indexOf('const chan = nut("rect"')
       < FE.indexOf('if (ptCot <= 0) return;'), true);

    /* 3 — RUỘT CỘT XẾP LỚN → BÉ TỪ ĐÁY LÊN. Phép sắp ở ENGINE, không ở đây:
       màn hình vẽ đúng thứ tự nhận được (`kiem/co-cau.js` canh phép sắp). */
    ok('màn hình KHÔNG tự sắp lại ruột cột',
       /\.hang\.sort\(/.test(FE_SACH), false);

    /* 4 — CARD KHÔNG CÓ THANH TRƯỢT. Nội dung bóp cho vừa, không cho cuộn. */
    ok('card không còn overflow-y: auto',
       /\.cardCoCau\s*\{[^}]*overflow-y:\s*auto/.test(CSS), false);
    ok('  · danh sách hãng chia hai cột', /\.dsMauDoi[^{]*\{[^}]*grid-template-columns/.test(CSS), true);
    /* `grid` chứ không `columns`: cột báo chí xếp dọc thì ô màu hai cột
       lệch nhau, mà chủ dự án chốt "các ô màu phải nằm trên cùng 1 trục". */
    ok('  · và KHÔNG dùng cột báo chí (ô màu sẽ lệch trục)',
       /\.dsMauHang[^{]*\{[^}]*column-count/.test(CSS), false);
    ok('hai nhãn phụ rút ngắn', /"Hãng nhỏ"/.test(FE) && /"None"/.test(FE), true);
    ok('  · không còn lối viết dài', /Hãng nhỏ, đã gộp|Chưa gán mã \(NONE\)/.test(FE), false);
    ok('  · và bỏ câu nhắc "bấm vào một mảng"',
       /Bấm vào một mảng trên biểu đồ/.test(FE), false);
  }

  console.log('\nB4) Ba chỗ chủ dự án chốt lại ở lượt mở thứ ba');
  {
    /* 1 — CỠ CHỮ TRỤC BẰNG BIỂU ĐỒ BÊN CẠNH.
       font-size của chữ SVG đo bằng đơn vị HỆ TOẠ ĐỘ. Hai biểu đồ có hai hệ
       toạ độ (640 và 1000) và hai khung rộng khác nhau — cột phải còn nhường
       240px cho thẻ chi tiết — nên KHAI CỨNG một con số trong CSS là ra hai
       cỡ chữ khác hẳn nhau trên màn, đúng cái chủ dự án vừa chỉ ra. Cỡ chữ
       phải HỎI biểu đồ trái (px thật) rồi quy về đơn vị của mình. */
    ok('cỡ chữ trục KHÔNG khai cứng trong CSS',
       /\.nhanTrucCoCau\s*\{[^}]*font-size/.test(CSS)
       || /\.nhanNganh\s*\{[^}]*font-size/.test(CSS), false);
    ok('  · mà hỏi biểu đồ trái lấy cỡ THẬT',
       /window\.SucKhoe\.coChuTrucPx\(\)/.test(FE), true);
    ok('  · và suc-khoe có mở cửa ấy', /coChuTrucPx,/.test(SK), true);
    ok('  · cỡ ấy tính từ MỘT hằng, không phải bốn con số rải rác',
       /font-size="10"/.test(SK), false);
    ok('  · quy px trên màn về đơn vị hệ toạ độ bên này',
       /\(px \* RONG\) \/ w/.test(FE), true);
    ok('  · có bản lùi khi chưa đo được khung', /CO_CHU_LUI/.test(FE), true);
    /* Chữ to lên thì hai lề phải giãn theo, không thì "100,0%" tràn ra
       ngoài khung và tên ngành đè mép dưới. */
    ok('  · lề trái và lề dưới co theo cỡ chữ',
       /const LE_TRAI = Math\.max\(46, coChu/.test(FE)
       && /const LE_DUOI = Math\.max\(28, coChu/.test(FE), true);
    ok('  · và số ký tự cắt tên ngành cũng vậy',
       /oNganh \/ \(coChu \* 0\.62\)/.test(FE), true);

    /* 2 — CHỌN MỘT MẢNG THÌ CỘT CÙNG KỲ CŨNG NỔI BẬT. Đó đúng là việc người
       ta bấm để làm: so một hãng với chính nó năm ngoái. */
    ok('mảng cùng kỳ cũng nổi bật khi chọn',
       /const chon = !laTruoc &&/.test(FE_SACH), false);
    ok('  · tức chọn theo (ngành, hãng), không theo cột nào',
       /const chon = dangChon\(c\.ten, h\.la_tron \? null : h\.ten\)/.test(FE), true);

    /* 3 — BỎ DÃY SỐ TỈ TRỌNG DƯỚI TRỤC. Thẻ bên phải đã nói con số ấy, kèm
       cả doanh số lẫn số máy. */
    ok('không còn dãy số tỉ trọng dưới trục', /nhanNganhPt/.test(FE), false);
    ok('  · và CSS cũng sạch', /nhanNganhPt|nhanPtTruoc/.test(CSS), false);
  }

  console.log('\nC+D) Độ phủ và nguồn hỏng — nói ra, không giấu');
  {
    ok('màn hình vẽ độ phủ', /do_phu/.test(FE), true);
    ok('  · và cảnh báo khi hai tháng lệch độ phủ quá xa',
       /canhBaoDoPhu/.test(FE), true);
    ok('  · Engine có trả độ phủ để mà vẽ',
       typeof E.coCauNganhHang({ ngay: [] }, null).do_phu.nay.doanh_so_pt, 'object');

    ok('nguồn bảng giá hỏng thì nói thẳng', /loi_nguon_ma/.test(FE), true);
    ok('  · và Gateway có gửi cờ ấy', /loi_nguon_ma: kqNay\.loi_nguon_ma/.test(GW), true);

    /* Hai cách đọc, chủ dự án chốt 19/09/2026. Mặc định là cách THẬT THÀ —
       cột xám đứng trên trục. */
    ok('có nút [Chỉ phần đã phân loại]', /Chỉ phần đã phân loại/.test(FE), true);
    ok('  · nhưng mặc định là TẮT (cột xám vẫn hiện)',
       /boChuaPhanLoai: false/.test(FE), true);
  }

  console.log('\nE) Gateway — dùng lại CHÍNH đường dựng bảng đơn');
  {
    ok('GET /api/co-cau có trong API_ROUTES', /\["GET \/api\/co-cau", layCoCau\]/.test(GW), true);
    ok('  · mở cho cả hai vai', /const layCoCau = boc\(true,/.test(GW), true);
    ok('  · không ai mở POST cho nó', /POST \/api\/co-cau/.test(GW), false);

    const kh = (GW.match(/const layCoCau = boc[\s\S]*?\n\}\);/) || [''])[0];
    /* E — dùng lại `dungBangDonHang`, không đọc `bc/dong` bằng lối thứ hai.
       Hãng chỉ có sau khi khớp mã, hàng trả lại chỉ lộ sau apDungBTL, và một
       dòng XOÁ TAY phải biến khỏi CẢ biểu đồ. */
    ok('dựng bằng dungBangDonHang()', /dungBangDonHang\(env, ky, null, rid\)/.test(kh), true);
    ok('  · và KHÔNG đọc thẳng bc/dong', /bc\/dong/.test(kh), false);
    /* Hai tháng SONG SONG: chúng độc lập, xếp hàng là bắt người dùng chờ
       gấp đôi cho không. */
    ok('hai tháng dựng song song', /await Promise\.all\(\[/.test(kh), true);
    ok('  · kỳ năm trước lấy bằng namTruoc()', /namTruoc\(ky\)/.test(kh), true);
    /* Kỳ năm trước hỏng KHÔNG được kéo theo cả biểu đồ — cơ cấu tháng này
       vẫn đọc được mà không cần nó. */
    ok('  · kỳ năm trước hỏng thì bắt tại chỗ', /ky-truoc-hong/.test(kh), true);
    /* "Có bảng" khác "có dữ liệu": kỳ chưa nạp sổ vẫn ra một bảng hợp lệ với
       0 ngày, và đưa nguyên nó cho Engine là vẽ một cột 0 trông như "năm
       ngoái không bán gì". */
    ok('  · kỳ rỗng quy về null, không đưa bảng 0 ngày cho Engine',
       /ngay\.length \? kqTruoc\.bang : null/.test(kh), true);
  }

  console.log('\nF) Bố cục — cột phải của Dashboard, và xu hướng line về tab line');
  {
    ok('suc-khoe gọi sang window.CoCau.ve()', /window\.CoCau\.ve\(/.test(SK), true);
    ok('  · và KHÔNG sờ thẳng vào DOM của biểu đồ cơ cấu',
       /khoiCoCau|svgCoCau/.test(sach(SK)), false);
    ok('co-cau.js không sờ vào ô của biểu đồ trái', /"skVe"|"o-dashboard"/.test(FE), false);

    /* Cụm mười ô cũ phải VẮNG khỏi Dashboard — còn ở đó thì nửa phải có hai
       thứ chồng nhau. */
    ok('suc-khoe không còn hàm vẽ cụm lưới cũ', /veKhoiLuoiNho\s*\(/.test(sach(SK)), false);
    ok('  · và không còn ô #skLuoiNho', /"skLuoiNho"/.test(SK), false);

    ok('don-hang gọi window.SucKhoe.veXuHuongLine()',
       /window\.SucKhoe\.veXuHuongLine\(/.test(DH), true);
    /* NGAY TRÊN bảng đơn (chủ dự án chốt), không phải dưới: bảng của một
       line dài hàng trăm dòng, để dưới là phải cuộn rất xa mới thấy. */
    ok('  · và khối ấy dựng TRƯỚC bảng',
       DH.indexOf('khoiXuHuongLine') < DH.indexOf('const boc = el("div", "bocBang")'), true);
    /* `don-hang.js` CÓ `createElementNS` cho mấy icon nút của nó — đó là
       chuyện khác. Thứ nó không được có là phần dựng ĐƯỜNG XU HƯỚNG: hệ toạ
       độ, bộ số, phép bắt chuột. Chúng ở suc-khoe.js và chỉ có một bản. */
    ok('  · don-hang không dựng đường xu hướng',
       /veMiniDuong|caoOMini|khoMini|layDiem\(/.test(sach(DH)), false);

    for (const lop of ['khoiCoCau', 'svgCoCau', 'mangCoCau', 'chuGiaiCoCau',
                       'khoiXuHuongLine']) {
      ok('CSS có luật cho .' + lop, new RegExp('\\.' + lop + '\\b').test(CSS), true);
    }
    ok('index.html nạp co-cau.js', /<script src="\/co-cau\.js"><\/script>/.test(HTML), true);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
