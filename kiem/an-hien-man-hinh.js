/* Mọi phần tử được BẬT/TẮT bằng `el.hidden` phải thật sự ẩn được.
 *
 * Vì sao có bộ này — một lỗi đã xảy ra thật 11/09/2026, và nó tốn gần một
 * buổi truy nhầm chỗ:
 *
 *   `manDangNhap.hidden = true;`   trong script
 *   `#manDangNhap { display: flex }` trong CSS
 *
 * Thuộc tính `hidden` không phải một cơ chế riêng — nó chạy nhờ luật
 * `[hidden] { display: none }` của TRÌNH DUYỆT. Mà trong thứ tự cascade, mọi
 * luật của tác giả đều thắng luật trình duyệt, không cần xét độ cụ thể. Nên
 * một dòng `display` đặt cho chính phần tử ấy là đủ để `hidden` mất tác dụng
 * HOÀN TOÀN — im lặng, không lỗi, không cảnh báo.
 *
 * Triệu chứng khi ấy giống hệt lỗi phân quyền: đăng nhập thành công, `/api/me`
 * trả 200, console sạch, mà màn hình "không có gì xảy ra" — vì màn đăng nhập
 * cao 100vh vẫn che kín, còn màn chủ nằm dưới mép màn hình.
 *
 * Bộ này canh cả hai đầu: có tấm lưới `[hidden]{display:none!important}`, và
 * mọi id được bật/tắt bằng `.hidden` đều nằm dưới tấm lưới ấy.
 */
const { doc, ok, xong } = require('./khung');

const HTML = doc('public/index.html');
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const JS = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];

console.log('\n1) Có tấm lưới [hidden] — thứ giữ cho el.hidden luôn có nghĩa');
{
  /* Bỏ chú thích trước khi dò, không thì chính đoạn giải thích phía trên làm
     bài kiểm xanh trong khi CSS thật không có dòng nào. */
  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const luat = cssSach.match(/\[hidden\]\s*\{[^}]*\}/);
  ok('CSS khai luật [hidden]', !!luat, true);
  ok('  · và đặt display:none', /display\s*:\s*none/.test(luat ? luat[0] : ''), true);
  /* `!important` là phần KHÔNG bỏ được: thiếu nó thì một luật theo id
     (`#manDangNhap{display:flex}`) vẫn thắng vì độ cụ thể cao hơn. */
  ok('  · và có !important (thiếu nó là luật theo id vẫn thắng)',
     /!important/.test(luat ? luat[0] : ''), true);
}

console.log('\n2) Mọi phần tử bật/tắt bằng .hidden đều được tấm lưới phủ');
{
  /* Dò các biến được gán `.hidden = ...` trong script, rồi lần ngược về id
     qua khai báo `const x = $('id')`. Làm bằng mã chứ không liệt kê tay: một
     màn hình mới thêm sau này phải tự động được canh, không đợi ai nhớ. */
  const bienHidden = new Set(
    [...JS.matchAll(/(\w+)\s*\.\s*hidden\s*=/g)].map((m) => m[1]));
  const idCua = {};
  for (const m of JS.matchAll(/(\w+)\s*=\s*\$\('([^']+)'\)/g)) idCua[m[1]] = m[2];

  ok('có ít nhất một màn hình bật/tắt bằng .hidden', bienHidden.size > 0, true);

  const cssSach = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const coLuoi = /\[hidden\]\s*\{[^}]*display\s*:\s*none[^}]*!important/.test(cssSach);

  /* Phần tử nào vừa bật/tắt bằng `.hidden` VỪA bị CSS đặt `display` theo id
     thì bắt buộc phải có tấm lưới — không có lưới là `hidden` chết lâm sàng. */
  const nguyHiem = [];
  for (const bien of bienHidden) {
    const id = idCua[bien];
    if (!id) continue;
    const luatId = cssSach.match(new RegExp('#' + id + '\\s*\\{[^}]*\\}'));
    if (luatId && /display\s*:/.test(luatId[0])) nguyHiem.push(id);
  }

  /* In ra để người đọc thấy bài kiểm đang canh CÁI GÌ, không phải một con số
     trừu tượng. */
  console.log('     (id bật/tắt bằng .hidden mà CSS có đặt display: '
    + (nguyHiem.length ? nguyHiem.join(', ') : 'không có') + ')');
  ok('mọi id kiểu đó đều đã có tấm lưới [hidden]!important phủ',
     nguyHiem.length === 0 || coLuoi, true);
}

xong();
