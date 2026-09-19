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
    /* Không tự xếp hạng, không tự cắt danh sách — hai việc ấy LÀ phép gộp. */
    ok('không tự xếp hạng ngành/hãng', /\.sort\(/.test(FE_SACH), false);
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

  console.log('\nB) Màu — theo TÊN hãng, bền qua mọi cột và cả hai tháng');
  {
    ok('có hàm gán màu theo tên', /function mauHang\(ten\)/.test(FE), true);
    /* Vân tay của TÊN, không phải chỉ số vòng lặp. `charCodeAt` là dấu hiệu
       chắc chắn nó đang băm chuỗi chứ không đếm vị trí. */
    ok('  · băm từ chuỗi tên', /ten\.charCodeAt\(/.test(FE), true);
    ok('  · và KHÔNG lấy màu theo thứ tự trong cột',
       /MAU\[\s*i\s*(%|\])/.test(FE_SACH), false);

    /* "Khác" và "Chưa phân loại" phải XÁM, không lấy màu trong bảng pastel:
       chúng là phần gộp và phần chưa biết, mắt phải đọc ra ngay. */
    ok('mảng "Khác" có màu riêng', /MAU_KHAC/.test(FE), true);
    ok('cột "Chưa phân loại" có màu riêng', /MAU_CHUA_PHAN_LOAI/.test(FE), true);

    /* Gam PASTEL (chủ dự án chốt): màn này mở cả buổi. Đo bằng độ sáng —
       mọi màu trong bảng phải sáng, không màu nào bão hoà nhảy lên trước
       mắt. */
    const bang = (FE.match(/const MAU = \[[\s\S]*?\];/) || [''])[0];
    const mau = [...bang.matchAll(/#([0-9a-f]{6})/g)].map((m) => m[1]);
    ok('có đủ một bảng màu', mau.length >= 8, true);
    const sang = (h) => (parseInt(h.slice(0, 2), 16) * 0.299
      + parseInt(h.slice(2, 4), 16) * 0.587 + parseInt(h.slice(4, 6), 16) * 0.114);
    ok('  · mọi màu đều nhạt (pastel, không chói)', mau.every((h) => sang(h) >= 170), true);
    /* Và không màu nào tối tới mức chữ đen trên nó đọc không ra — mảng nào
       cũng có thể phải mang nhãn về sau. */
    ok('  · và không màu nào quá tối', mau.every((h) => sang(h) <= 240), true);
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
