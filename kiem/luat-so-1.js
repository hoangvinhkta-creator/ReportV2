/* LUẬT SỐ 1 (CLAUDE.md): nghiệp vụ nằm ở backend, trình duyệt chỉ hiển thị
 * và nhận thao tác. Bộ này là phép kiểm nhanh "Ctrl+U" tự động — quét
 * public/index.html và toàn bộ mã nguồn tìm những thứ KHÔNG được phép lọt
 * ra ngoài, để không phải nhớ tự kiểm tay mỗi lần sửa.
 */
const fs = require('fs');
const path = require('path');
const { GOC, doc, ok, xong } = require('./khung');

const HTML = doc('public/index.html');
const JS_SCRIPT = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];

console.log('\n1) Trang tĩnh không được tự đọc/ghi thẳng Realtime Database');
{
  ok('không nạp SDK firebase-database (không có db thì không gọi được db)',
     /firebase-database-compat/.test(HTML), false);
  ok('không nạp SDK app-check (P1 chưa cần, tránh mở rộng bề mặt sớm)',
     /firebase-appcheck-compat/.test(HTML), false);
  ok('không gọi firebase.database(', /firebase\.database\(/.test(JS_SCRIPT), false);
  ok('không có db.ref( (mọi lượt đọc/ghi RTDB phải qua Gateway)',
     /db\.ref\(/.test(JS_SCRIPT), false);
}

console.log('\n2) Trang tĩnh không được mang khoá/token/chuỗi kết nối nào ngoài apiKey công khai');
{
  ok('không có "BEGIN PRIVATE KEY" (khoá riêng service account)',
     /BEGIN PRIVATE KEY/.test(HTML), false);
  ok('không có FB_SA_KEY hay FB_SA_EMAIL (Secret của Gateway)',
     /FB_SA_KEY|FB_SA_EMAIL/.test(HTML), false);
  ok('không có REPORT_API_KEY hay X-Report-Key (khoá gọi sang Tracking)',
     /REPORT_API_KEY|X-Report-Key/i.test(HTML), false);
}

console.log('\n3) Mọi lời gọi "phía sau" của trang tĩnh đều đi qua /api/ (Gateway), không có đường nào khác');
{
  const goiFetch = [...JS_SCRIPT.matchAll(/fetch\(\s*['"`]([^'"`]+)/g)].map(m => m[1]);
  ok('có ít nhất một lời gọi fetch (tới Gateway)', goiFetch.length > 0, true);
  const laDuongLa = goiFetch.filter(d => !d.startsWith('/api/'));
  ok('mọi lời gọi fetch() đều nhắm vào /api/... của chính Gateway', laDuongLa, []);
}

console.log('\n4) Không file mã nguồn nào trong repo mang khoá riêng service account viết chết');
{
  /* Quét TOÀN BỘ src/, engine/src/, public/ — không chỉ index.html — vì
     khoá lộ có thể nằm ở bất kỳ file nào ai đó lỡ tay dán vào. */
  const CAY = ['src', 'engine/src', 'public'];
  const timFile = (thuMuc, ra = []) => {
    const day = path.join(GOC, thuMuc);
    if (!fs.existsSync(day)) return ra;
    for (const ten of fs.readdirSync(day)) {
      const p = path.join(day, ten);
      const rel = path.join(thuMuc, ten);
      if (fs.statSync(p).isDirectory()) timFile(rel, ra);
      else if (/\.(js|html|json)$/.test(ten)) ra.push(rel);
    }
    return ra;
  };
  const files = CAY.flatMap(c => timFile(c));
  const dinh = files.filter(f => /BEGIN PRIVATE KEY/.test(doc(f)));
  ok('không file nào chứa "BEGIN PRIVATE KEY"', dinh, []);
}

xong();
