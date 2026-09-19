/* BẢNG MÀU CỦA TỪNG HÃNG — `public/mau-hang.js`.
 *
 * Chủ dự án chốt 19/09/2026: "mỗi hãng 1 màu", và "những màu này gán luôn
 * lên các nút chọn tab ở kích hoạt bảo hành".
 *
 * Bộ này canh bốn chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. BẢNG MÀU LẠC KHỎI DANH SÁCH HÃNG THẬT. File ấy CÓ gõ mười tên hãng —
 *     ngoại lệ có chủ đích với LUẬT SỐ 1, vì một bảng màu phải khoá theo một
 *     cái gì đó. Bài dưới đây đối chiếu mười khoá ấy với `HANG_BAO_HANH` của
 *     Engine, nên ngoại lệ ấy không âm thầm trôi đi.
 *  B. HAI HÃNG CÙNG MÀU. Đó đúng là lỗi của bản băm-từ-tên mà lượt này thay
 *     thế: hai mảng cùng màu ở hai cột KHÔNG phải cùng một hãng, tức màu nói
 *     sai đúng điều nó sinh ra để nói.
 *  C. MÀU CHÓI. Chủ dự án chốt gam pastel — màn này mở cả buổi.
 *  D. HAI MÀN DÙNG HAI BẢNG. Biểu đồ cơ cấu và hàng tab bảo hành phải gọi
 *     CÙNG một cửa, không file nào được chép bảng màu sang bên mình.
 */
const path = require('path');
const { doc, ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

/** Chạy file trình duyệt trong một hộp kín rồi lấy `window.MauHang`. */
function napMauHang() {
  const vm = require('vm');
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(doc('public/mau-hang.js'), ctx);
  return ctx.window.MauHang;
}

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/bao-hanh.mjs'));
  const M = napMauHang();
  const FE_CO_CAU = doc('public/co-cau.js');
  const FE_BAO_HANH = doc('public/bao-hanh.js');
  const HTML = doc('public/index.html');

  console.log('\nA) Bảng màu KHỚP danh sách hãng thật của Engine');
  {
    ok('nạp được window.MauHang', typeof (M || {}).cua, 'function');
    /* Đây là bài giữ cho ngoại lệ "màn hình được gõ tên hãng" không trôi:
       thêm một hãng bên Engine mà quên thêm màu thì bài này đỏ, chứ không
       phải tới lúc nhìn thấy một cái chấm xám lạ trên hàng tab. */
    ok('mười khoá của bảng màu khớp HANG_BAO_HANH',
       Object.keys(M._bang).sort(), B.HANG_BAO_HANH.slice().sort());
  }

  console.log('\nB) Mỗi hãng MỘT màu, và không hai hãng nào trùng màu');
  {
    const mau = B.HANG_BAO_HANH.map((h) => M.cua(h));
    ok('mười hãng ra mười màu KHÁC NHAU', new Set(mau).size, 10);
    /* Cùng một tên phải luôn ra cùng một màu, ở mọi lượt gọi và mọi màn. */
    ok('gọi hai lần ra cùng màu', M.cua('Samsung'), M.cua('Samsung'));
    /* Chữ gõ tay bên bảng giá lệch hoa/thường là chuyện có thật — không thì
       "samsung" rơi xuống dải dự phòng và đổi màu giữa hai màn. */
    ok('không phân biệt hoa thường', M.cua('SAMSUNG'), M.cua('Samsung'));
    ok('thừa khoảng trắng vẫn cùng màu', M.cua('  Samsung  '), M.cua('Samsung'));

    /* Hãng NGOÀI mười cái vẫn phải có màu — bảng giá Tracking là danh sách
       mở, và một hãng lạ hiện ra không màu là một mảng trắng giữa biểu đồ. */
    const la = M.cua('Electrolux');
    ok('hãng lạ vẫn có màu', /^#[0-9a-f]{6}$/.test(la), true);
    ok('  · và KHÔNG mượn màu của một hãng đã khai', mau.indexOf(la), -1);
    ok('  · cùng tên lạ thì cùng màu', M.cua('Electrolux'), la);

    /* Ba sắc xám là "không phải một hãng" — chúng không được đụng màu hãng. */
    for (const [ten, m] of [['Khác', M.MAU_KHAC], ['chưa phân loại', M.MAU_CHUA_PHAN_LOAI],
                            ['chưa rõ hãng', M.MAU_CHUA_RO_HANG]]) {
      ok('màu "' + ten + '" không trùng màu hãng nào', mau.indexOf(m), -1);
    }
    ok('tên rỗng → màu "chưa rõ hãng"', M.cua(''), M.MAU_CHUA_RO_HANG);
    ok('không phải chuỗi cũng vậy', M.cua(null), M.MAU_CHUA_RO_HANG);
  }

  console.log('\nC) Gam pastel — đo thật, không tin lời hứa trong chú thích');
  {
    const sang = (h) => {
      const x = h.replace('#', '');
      return parseInt(x.slice(0, 2), 16) * 0.299 + parseInt(x.slice(2, 4), 16) * 0.587
        + parseInt(x.slice(4, 6), 16) * 0.114;
    };
    const moiMau = B.HANG_BAO_HANH.map((h) => M.cua(h))
      .concat([M.cua('Electrolux'), M.cua('Beko'), M.cua('Aqua')]);
    ok('mọi màu đều nhạt (không chói)', moiMau.every((m) => sang(m) >= 170), true);
    /* Và không màu nào nhạt tới mức mất hẳn hình dạng mảng trên nền trắng. */
    ok('  · nhưng không màu nào trắng quá', moiMau.every((m) => sang(m) <= 240), true);
  }

  console.log('\nD) MỘT bảng, hai màn cùng gọi — không ai chép sang bên mình');
  {
    const sach = (m) => m.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const [ten, ma] of [['co-cau.js', FE_CO_CAU], ['bao-hanh.js', FE_BAO_HANH]]) {
      ok(ten + ' gọi window.MauHang', /window\.MauHang/.test(ma), true);
      /* Không file nào được khai một bảng mã màu của riêng nó. */
      ok('  · và KHÔNG khai mã màu hãng nào', /#[0-9a-f]{6}/i.test(sach(ma)), false);
    }
    /* `bao-hanh.js` vẫn KHÔNG được gõ tên hãng — nó lấy tên từ máy chủ rồi
       đưa nguyên sang bảng màu. Ngoại lệ chỉ dành cho `mau-hang.js`. */
    const dinh = B.HANG_BAO_HANH.filter((h) => new RegExp('["\'`]' + h + '["\'`]').test(FE_BAO_HANH));
    ok('bao-hanh.js vẫn không khai lại tên hãng nào', dinh, []);

    ok('index.html nạp mau-hang.js', /<script src="\/mau-hang\.js"><\/script>/.test(HTML), true);
    /* Nạp TRƯỚC hai file dùng nó — không thì lượt vẽ đầu tiên không có màu. */
    ok('  · và nạp trước co-cau.js',
       HTML.indexOf('/mau-hang.js') < HTML.indexOf('/co-cau.js'), true);
    ok('  · và trước bao-hanh.js',
       HTML.indexOf('/mau-hang.js') < HTML.indexOf('/bao-hanh.js'), true);
    /* Ô màu là MỘT lớp CSS dùng chung cho cả chú giải lẫn hàng tab. */
    ok('CSS có lớp .oMauHang', /\.oMauHang\b/.test(HTML), true);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
