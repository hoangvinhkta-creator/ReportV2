/* Mọi id mà mã trang tĩnh đi TÌM đều phải có thật — hoặc trong
 * `public/index.html`, hoặc do chính mã đó dựng ra.
 *
 * Vì sao có bộ này (11/09/2026): hai nhánh P2(b) và P3 cùng sửa một file
 * `index.html`, và bố cục vừa bị dựng lại một lượt (bỏ lưới thẻ, gộp màn
 * "Đơn hàng theo line" thành trang chủ). Xoá một thẻ mà quên một chỗ
 * `getElementById` là kiểu lỗi KHÔNG bộ kiểm nào khác bắt được: Node không
 * chạy mã trang tĩnh, `npm test` vẫn xanh, và trên máy thật thì
 * `null.hidden = true` ném ngay lúc đăng nhập — đúng loại lỗi "bấm xong
 * không có gì xảy ra" mà repo này đã mất gần một buổi vì nó.
 *
 * Bộ này chỉ soi TĨNH nên không thay được việc mở bằng máy thật; nó chỉ
 * chặn đúng một lỗi, nhưng chặn được ngay lúc đẩy.
 */
const fs = require('fs');
const path = require('path');
const { GOC, doc, ok, xong } = require('./khung');

const HTML = doc('public/index.html');
const FILE_JS = fs.readdirSync(path.join(GOC, 'public'))
  .filter((t) => t.endsWith('.js')).map((t) => 'public/' + t);

/* id có mặt trong index.html */
const idTrongHtml = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

/* id do chính mã JS dựng ra (ghi trong chuỗi `id="…"` của một khối innerHTML)
   — những cái này không có trong index.html mà vẫn hợp lệ. */
const idDoJsDung = new Set();
for (const f of FILE_JS) {
  for (const m of doc(f).matchAll(/\bid="([^"]+)"/g)) idDoJsDung.add(m[1]);
}

console.log('\n1) index.html có đủ id mà mã trang tĩnh đi tìm');
{
  const inline = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];
  const nguon = [['public/index.html (khối inline)', inline],
                 ...FILE_JS.map((f) => [f, doc(f)])];

  for (const [ten, ma] of nguon) {
    /* Bắt cả `getElementById('x')` lẫn lối tắt `$('x')` mà cả bốn file đang dùng. */
    const idCanTim = new Set([
      ...[...ma.matchAll(/getElementById\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
      ...[...ma.matchAll(/\$\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
    ]);
    const thieu = [...idCanTim].filter((id) => !idTrongHtml.has(id) && !idDoJsDung.has(id));
    ok(ten + ': không đi tìm id không tồn tại', thieu, []);
  }
}

console.log('\n2) Không có id nào khai TRÙNG trong index.html');
{
  /* Trùng id thì `getElementById` trả về thẻ ĐẦU TIÊN — một màn hình có thể
     ghi vào đúng thẻ, màn kia ghi vào thẻ vô hình, không báo lỗi gì. Dễ xảy
     ra nhất đúng lúc gộp hai màn làm một như lượt vừa rồi. */
  const tatCa = [...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dem = {};
  for (const id of tatCa) dem[id] = (dem[id] || 0) + 1;
  ok('mỗi id chỉ khai một lần', Object.keys(dem).filter((id) => dem[id] > 1), []);
}

console.log('\n3) Ô #o-dashboard vẫn còn — hợp đồng giữa hai nhánh P2(b) và P3');
{
  /* P3 sở hữu khung, P2(b) sở hữu nội dung ô này (ROADMAP.md). Mất ô là
     Dashboard im lặng không vẽ gì mà không ai báo. */
  ok('index.html có ô #o-dashboard', idTrongHtml.has('o-dashboard'), true);
  ok('public/suc-khoe.js vẫn vẽ vào đúng ô đó',
     /getElementById\(["']o-dashboard["']\)|\$\(["']o-dashboard["']\)/.test(doc('public/suc-khoe.js')), true);
}

xong();
