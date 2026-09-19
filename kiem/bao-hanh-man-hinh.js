/* TAB [KÍCH HOẠT BẢO HÀNH] — phần MÀN HÌNH và GATEWAY.
 *
 * `kiem/bao-hanh.js` canh nghiệp vụ (Engine). Bộ này canh phần còn lại của
 * lát cắt dọc: hợp đồng giữa trang tĩnh, Gateway và cấu hình deploy.
 *
 * Bốn chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. LUẬT SỐ 1 RÒ RA TRÌNH DUYỆT. Mười tên hãng, phép chia dòng vào tab,
 *     phép đếm — chép bất cứ cái nào sang `public/bao-hanh.js` là dựng bản
 *     thứ hai của một luật, và hai bản trôi khỏi nhau trong im lặng.
 *  B. PHÂN QUYỀN LỆCH. Chủ dự án chốt: cả hai vai TICK được, chỉ Quản trị
 *     sửa User/Pass và các bước. Lệch một đường là Quản lí sửa được thứ cả
 *     phòng đọc theo.
 *  C. ẢNH KHÔNG HIỆN ĐƯỢC. Ba thứ phải khớp nhau cùng lúc — binding R2 trong
 *     wrangler.toml, `blob:` trong CSP, và đường ảnh trong bảng route. Thiếu
 *     một cái thì màn hướng dẫn trống trơn mà console mới nói vì sao.
 *  D. HAI MÀN LẠC NHAU. Kỳ dùng chung: đổi tháng ở màn này phải ăn sang màn
 *     kia. Đứt cửa nối là hai màn lặng lẽ nói về hai tháng khác nhau.
 */
const path = require('path');
const { doc, ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/bao-hanh.mjs'));

  const HTML = doc('public/index.html');
  const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const FE = doc('public/bao-hanh.js');
  const DH = doc('public/don-hang.js');
  const GW = doc('src/index.js');
  const WR = doc('wrangler.toml');

  console.log('\nA) LUẬT SỐ 1 — màn hình không giữ một luật nghiệp vụ nào');
  {
    /* Mười cái tên hãng là một QUYẾT ĐỊNH nghiệp vụ. Chép chúng sang trình
       duyệt là dựng bản thứ hai, và chỗ trôi ở đây là một hãng ghi được dữ
       liệu vào Firebase mà không tab nào hiện nó ra — hoặc ngược lại, một
       tab mời người dùng gõ hướng dẫn vào một hãng Gateway sẽ từ chối. */
    const dinh = B.HANG_BAO_HANH.filter(h => new RegExp('["\'`]' + h + '["\'`]').test(FE));
    ok('bao-hanh.js không khai lại tên hãng nào', dinh, []);
    /* Và nó cũng không được tự CHIA dòng vào hãng: danh sách đến từ máy chủ
       đã chia sẵn, việc của màn hình là lấy đúng ngăn ra mà vẽ. */
    ok('  · lấy danh sách của một hãng THẲNG từ máy chủ',
       /kq\.hang\[trangThai\.hang\]/.test(FE), true);
    ok('  · và không tự lọc lại mảng dòng nào',
       /\.(chua|da|dong)\.filter\(/.test(FE), false);
    ok('  · không tự quyết dòng nào là "máy đã bán"',
       /la_chiet_khau|la_phu_phi|btl_trang_thai/.test(FE), false);
    ok('  · không tự tách ô IMEI (Engine trả về mảng rồi)',
       /imei[^\n]*\.split\(/.test(FE), false);

    /* Thứ tự tab hãng cũng từ máy chủ (`kq.thu_tu`), không phải một mảng
       viết cứng ở đây. */
    ok('vẽ tab hãng từ kq.thu_tu của máy chủ', /for \(const ten of kq\.thu_tu\)/.test(FE), true);
  }

  console.log('\nB) Phân quyền — tick cho cả hai vai, hướng dẫn chỉ Quản trị');
  {
    ok('GET /api/bao-hanh mở cho cả hai vai',
       /const layBaoHanh = boc\(true,/.test(GW), true);
    ok('POST /api/kich-hoat mở cho cả hai vai (việc hằng ngày)',
       /const datKichHoat = boc\(true,/.test(GW), true);
    ok('POST /api/bao-hanh/dang-nhap CHỈ Quản trị',
       /const datDangNhapBaoHanh = boc\("quantri",/.test(GW), true);
    ok('POST /api/bao-hanh/buoc CHỈ Quản trị',
       /const datBuocBaoHanh = boc\("quantri",/.test(GW), true);
    ok('POST /api/bao-hanh/anh CHỈ Quản trị',
       /const taiAnhBaoHanh = boc\("quantri",/.test(GW), true);

    /* Đường ĐỌC ảnh phải mở cho cả hai vai — Quản lí không sửa hướng dẫn
       nhưng vẫn phải XEM được, không thì các bước chỉ còn chữ. */
    ok('GET /api/bao-hanh/anh mở cho cả hai vai',
       /const layAnhBaoHanh = bocNhiPhan\(true,/.test(GW), true);
    /* Và cửa nhị phân phải đi qua ĐÚNG hàng rào của `boc()`: một cửa sau bỏ
       qua xác thực là một cửa sau, dù nó chỉ trả về ảnh. */
    for (const [ten, re] of [['xác thực', /bocNhiPhan[\s\S]{0,900}?await xacThuc\(request, env\)/],
                             ['phân quyền', /bocNhiPhan[\s\S]{0,900}?doiVaiBaoCao\(nguoi\)/],
                             ['chặn sai vai 403', /bocNhiPhan[\s\S]{0,900}?403, "can-vai:"/]]) {
      ok('  · bocNhiPhan vẫn ' + ten, re.test(GW), true);
    }

    /* Sáu đường phải có mặt trong bảng route — `kiem/dinh-tuyen.js` đọc
       chính bảng ấy rồi gọi từng đường không kèm token, nên một đường quên
       khai sẽ không được bài kia canh. */
    for (const d of ['GET /api/bao-hanh', 'POST /api/kich-hoat',
                     'POST /api/bao-hanh/dang-nhap', 'POST /api/bao-hanh/buoc',
                     'GET /api/bao-hanh/anh', 'POST /api/bao-hanh/anh']) {
      ok('  · "' + d + '" có trong API_ROUTES',
         new RegExp('\\["' + d.replace(/\//g, '\\/') + '"').test(GW), true);
    }
    /* Không ai mở GET cho ba đường GHI. */
    ok('không có GET cho đường ghi nào',
       /GET \/api\/(kich-hoat|bao-hanh\/dang-nhap|bao-hanh\/buoc)/.test(GW), false);

    /* Màn hình khoá sẵn nút sửa cho Quản lí — TRANG TRÍ, phép chặn thật ở
       Gateway (bài ngay trên). Nhưng để ô bấm được mà lưu không được là một
       lời hứa hỏng. */
    ok('màn hình đọc vai để ẩn nút sửa hướng dẫn',
       /window\.VAI_BAO_CAO === "quantri"/.test(FE), true);
  }

  console.log('\nC) Ảnh hướng dẫn — ba mảnh phải khớp nhau cùng lúc');
  {
    ok('wrangler.toml khai binding R2', /\[\[r2_buckets\]\]/.test(WR), true);
    ok('  · tên binding đúng thứ Gateway gọi', /binding = "ANH_BAO_HANH"/.test(WR), true);
    ok('  · và Gateway gọi đúng tên ấy', /env\.ANH_BAO_HANH/.test(GW), true);

    /* `<img src>` không gắn được header `Authorization`, nên ảnh phải qua
       `fetch()` rồi `createObjectURL` — mà thiếu `blob:` trong CSP thì
       trình duyệt chặn đúng tấm ảnh vừa tải về, im lặng với người dùng. */
    ok('CSP mở img-src cho blob:', /"img-src [^"]*blob:/.test(GW), true);
    ok('  · màn hình dựng blob từ byte đã tải', /URL\.createObjectURL/.test(FE), true);
    ok('  · và KHÔNG trỏ thẳng <img src> vào đường ảnh (sẽ 401)',
       /\.src\s*=\s*["'`]\/api\/bao-hanh\/anh/.test(FE), false);

    /* Danh sách kiểu ảnh ĐÓNG. Một tấm SVG là một tài liệu chạy được script;
       phục vụ nó từ cùng tên miền với app là mở một cánh cửa không cần cho
       một màn chỉ cần ảnh chụp màn hình. */
    const kieu = (GW.match(/const KIEU_ANH = \{[^}]*\}/) || [''])[0];
    ok('nhận đúng ba kiểu ảnh', /image\/png/.test(kieu) && /image\/jpeg/.test(kieu)
       && /image\/webp/.test(kieu), true);
    ok('  · và KHÔNG nhận svg', /svg/i.test(kieu), false);
    ok('  · ô chọn file trên màn hình cũng không mời chọn svg',
       /accept = "image\/png,image\/jpeg,image\/webp"/.test(FE), true);

    /* Trần đo LẠI sau khi đọc byte: `Content-Length` là thứ bên gửi tự khai. */
    ok('đo lại kích thước thật sau khi đọc byte',
       /byte\.byteLength > TRAN_ANH/.test(GW), true);

    /* Khoá ảnh đến từ trình duyệt ở đường đọc, nên khuôn phải hẹp. */
    ok('khoá ảnh có khuôn đóng', /function laKhoaAnh/.test(GW), true);
    ok('  · và chặn ".."', /!s\.includes\("\.\."\)/.test(GW), true);
  }

  console.log('\nD) Hai màn — một hàng tab cấp 1, một kỳ dùng chung');
  {
    ok('HTML có hàng tab cấp 1', /id="tabMan"/.test(HTML), true);
    ok('  · và khối màn bảo hành', /id="manBaoHanh"/.test(HTML), true);
    ok('  · nút do bao-hanh.js vẽ (tên hai màn chỉ có MỘT chỗ)',
       /const MAN = \[/.test(FE), true);
    ok('  · đúng hai màn, không nhiều hơn',
       (FE.match(/\{ ma: "(bao-cao|bao-hanh)"/g) || []).length, 2);

    /* Cửa nối HAI CHIỀU, và cả hai đều phải có: thiếu chiều đi thì đổi tháng
       bên báo cáo không ăn sang bảo hành; thiếu chiều về thì biểu đồ bị đo
       lúc đang ẩn và quay lại thấy một khung cao 0. */
    ok('don-hang.js báo kỳ sang bằng window.BaoHanh.datKy()',
       /window\.BaoHanh\.datKy\(trangThai\.ky\)/.test(DH), true);
    ok('  · và lượt báo ấy nằm trong taiKy() — nơi MỌI lượt đổi kỳ đi qua',
       /async function taiKy[\s\S]{0,900}?window\.BaoHanh\.datKy/.test(DH), true);
    ok('bao-hanh.js gọi về bằng window.DonHang.canhLaiBieuDo()',
       /window\.DonHang\.canhLaiBieuDo\(\)/.test(FE), true);
    ok('  · và don-hang.js mở đúng cửa ấy',
       /canhLaiBieuDo: function/.test(DH), true);

    /* Không màn nào sờ thẳng vào DOM của màn kia — quy ước từ P2(b). */
    ok('bao-hanh.js không sờ vào #veDonHang', /"veDonHang"/.test(FE), false);
    ok('bao-hanh.js không sờ vào #o-dashboard', /"o-dashboard"/.test(FE), false);

    /* Màn bảo hành KHÔNG tự dựng bộ chọn tháng thứ hai — hai bộ chọn cho
       cùng một câu hỏi là hai lần chọn, và tệ hơn là hai câu trả lời khác
       nhau đứng cạnh nhau trên cùng một trang. */
    ok('bao-hanh.js không vẽ hàng năm/tháng riêng',
       /"tabNam"|"tabThang"/.test(FE), false);
  }

  console.log('\nE) Bốn khối của màn, đúng thứ tự chủ dự án mô tả');
  {
    const i = (s) => FE.indexOf(s);
    ok('1. đăng nhập → 2. các bước → 3. bảng',
       i('veDaiDangNhap(hd.dang_nhap') < i('veHopBuoc(hd.buoc')
       && i('veHopBuoc(hd.buoc') < i('veBang(o)'), true);

    /* Hướng dẫn ĐÓNG SẴN: mỗi ngày người ta vào đây để tick, không để đọc
       lại ba mươi bước — mở sẵn là bảng việc bị đẩy xuống dưới mép màn hình
       ở mọi lượt vào (chủ dự án chốt "ít thao tác trùng lặp"). */
    ok('hộp hướng dẫn đóng sẵn', /moBuoc: false/.test(FE), true);
    ok('  · và CSS có luật giấu ruột khi đóng',
       /\.hopBuoc\.dongLai \.ruotBuoc \{ display: none/.test(CSS), true);

    /* Công tắc soi lại việc đã làm — chủ dự án chốt 19/09/2026: tick nhầm
       phải sửa lại được ngay trong tab, không phải mở Console. */
    ok('có công tắc "Hiện cả đã kích hoạt"', /Hiện cả /.test(FE), true);
    ok('  · và bỏ tick gửi xong:false', /xong: false/.test(GW), true);
    ok('  · bỏ tick XOÁ hẳn ô, không ghi false',
       /than\.xong === false[\s\S]{0,200}?xoaDb\(duong, env\)/.test(GW), true);

    /* Tám cột chủ dự án chốt, cộng cột tick ở đầu. */
    const cot = JSON.parse((FE.match(/const COT_BH = \[[\s\S]*?\];/) || [''])[0]
      .replace(/^const COT_BH = /, '').replace(/;$/, ''));
    ok('đúng tám cột đã chốt', cot,
       ['Ngày', 'Số BH', 'Mã sản phẩm', 'SL', 'Tên khách', 'SĐT', 'Địa chỉ', 'Số imei']);
  }

  console.log('\nF) Nguồn hỏng thì BÁO LỖI, không bao giờ trả rỗng (CLAUDE.md)');
  {
    /* Tracking hỏng → không dòng nào có hãng → mười tab cùng rỗng. Im lặng
       ở đây là màn hình nói "không còn máy nào phải kích hoạt" thay người. */
    ok('Gateway chuyển tiếp loi_nguon_ma', /loi_nguon_ma: kqBang\.loi_nguon_ma/.test(GW), true);
    ok('  · và màn hình nói thẳng ra', /kq\.loi_nguon_ma/.test(FE), true);
    /* Nhánh tick hỏng thì DỪNG, không coi như "chưa ai tick": mọi máy đã làm
       xong sẽ hiện trở lại thành việc phải làm. */
    ok('nhánh tick đọc hỏng thì 503, không coi như rỗng',
       /khong-doc-duoc-kich-hoat/.test(GW), true);
    /* Dòng chưa xếp được hãng phải được NÓI RA, không im lặng biến mất. */
    ok('màn hình nói ra số dòng chưa xếp được hãng',
       /chua_ro_hang/.test(FE), true);
  }

  console.log('\nG) Mật khẩu cổng hãng — không rơi vào nhật ký');
  {
    /* Chủ dự án chốt để mật khẩu ở `bc/quyetdinh`, nơi cả hai vai đọc được.
       Đó là một quyết định về AI ĐƯỢC ĐỌC. Nó không kéo theo "và ghi luôn
       vào log": log đi ra ngoài phạm vi ấy (Cloudflare Observability), và
       một chuỗi lọt vào log thì không rút lại được. */
    const kh = (GW.match(/const datDangNhapBaoHanh = boc[\s\S]*?\n\}\);/) || [''])[0];
    ok('đường ghi đăng nhập có ghi nhật ký', /nhatKy\(/.test(kh), true);
    ok('  · nhưng KHÔNG ghi giá trị mật khẩu vào đó',
       /nhatKy\(\{[^}]*mat_khau/.test(kh), false);
    ok('  · cũng không ghi user',
       /nhatKy\(\{[^}]*\buser\b/.test(kh), false);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
