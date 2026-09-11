/* LUẬT SỐ 1 (CLAUDE.md): nghiệp vụ nằm ở backend, trình duyệt chỉ hiển thị
 * và nhận thao tác. Bộ này là phép kiểm nhanh "Ctrl+U" tự động — quét
 * public/index.html và toàn bộ mã nguồn tìm những thứ KHÔNG được phép lọt
 * ra ngoài, để không phải nhớ tự kiểm tay mỗi lần sửa.
 */
const fs = require('fs');
const path = require('path');
const { GOC, doc, ok, xong } = require('./khung');

const HTML = doc('public/index.html');

/* Mã JS của trang tĩnh nằm ở HAI chỗ, và bộ này phải soi CẢ HAI:
 *
 *   1. khối <script> viết thẳng trong index.html
 *   2. mọi file .js rời trong public/
 *
 * Chỗ 2 có từ lúc tách P2(b) — biểu đồ — và P3 — tải file — thành hai nhánh
 * chạy song song: cả hai đều phải thêm màn hình, mà `public/index.html` chỉ
 * có một, nên quy ước là mỗi màn một file .js riêng và index.html chỉ thêm
 * một thẻ <script src>. Nếu bộ này vẫn chỉ soi khối inline thì đúng lúc mã
 * chuyển ra file rời là lưới canh LUẬT SỐ 1 hở toang mà không ai thấy — bộ
 * kiểm vẫn xanh vì nó không còn nhìn vào chỗ có mã. */
const JS_ROI = (() => {
  const day = path.join(GOC, 'public');
  const ra = [];
  const quet = (thuMuc) => {
    for (const ten of fs.readdirSync(path.join(GOC, thuMuc))) {
      const rel = path.join(thuMuc, ten);
      if (fs.statSync(path.join(GOC, rel)).isDirectory()) quet(rel);
      else if (ten.endsWith('.js')) ra.push({ ten: rel, ma: doc(rel) });
    }
  };
  if (fs.existsSync(day)) quet('public');
  return ra;
})();

const JS_INLINE = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];
/* Nối lại để soi chung — nhưng giữ `JS_ROI` riêng để báo được TÊN FILE khi đỏ. */
const JS_SCRIPT = JS_INLINE + '\n' + JS_ROI.map(f => f.ma).join('\n');

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

  /* Báo theo TỪNG FILE: khi có nhiều file .js rời, một danh sách đường dẫn
     lạ không nói được file nào sai. */
  for (const f of JS_ROI) {
    const la = [...f.ma.matchAll(/fetch\(\s*['"`]([^'"`]+)/g)]
      .map(m => m[1]).filter(d => !d.startsWith('/api/'));
    ok(f.ten + ': mọi fetch() đều vào /api/', la, []);
  }

  /* Mỗi file .js rời phải được index.html nạp thật — một file mồ côi là mã
     chết mà bộ kiểm vẫn soi, dễ làm người sau tưởng nó đang chạy. */
  for (const f of JS_ROI) {
    const ten = f.ten.replace(/^public\//, '');
    ok(f.ten + ': được index.html nạp bằng <script src>',
       new RegExp('<script[^>]+src=["\']/?' + ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']').test(HTML), true);
  }
}

console.log('\n3b) File .js rời của trang tĩnh cũng không được mang nghiệp vụ hay khoá');
{
  for (const f of JS_ROI) {
    ok(f.ten + ': không gọi firebase.database(', /firebase\.database\(/.test(f.ma), false);
    ok(f.ten + ': không có db.ref(', /db\.ref\(/.test(f.ma), false);
    ok(f.ten + ': không mang FB_SA_KEY/FB_SA_EMAIL', /FB_SA_KEY|FB_SA_EMAIL/.test(f.ma), false);
    ok(f.ten + ': không mang X-Report-Key', /REPORT_API_KEY|X-Report-Key/i.test(f.ma), false);
  }
  if (!JS_ROI.length) ok('(chưa có file .js rời nào trong public/)', true, true);
}

console.log('\n4) Không file mã nguồn nào trong repo mang khoá riêng service account viết chết');
{
  /* Quét TOÀN BỘ src/, engine/src/, public/, bin/ — không chỉ index.html — vì
     khoá lộ có thể nằm ở bất kỳ file nào ai đó lỡ tay dán vào. `bin/` có mặt
     từ P2 (script nạp sổ chạy tay, dùng service account). */
  const CAY = ['src', 'engine/src', 'public', 'bin'];
  const timFile = (thuMuc, ra = []) => {
    const day = path.join(GOC, thuMuc);
    if (!fs.existsSync(day)) return ra;
    for (const ten of fs.readdirSync(day)) {
      const p = path.join(day, ten);
      const rel = path.join(thuMuc, ten);
      if (fs.statSync(p).isDirectory()) timFile(rel, ra);
      else if (/\.(js|mjs|html|json)$/.test(ten)) ra.push(rel);
    }
    return ra;
  };
  const files = CAY.flatMap(c => timFile(c));
  const dinh = files.filter(f => /BEGIN PRIVATE KEY/.test(doc(f)));
  ok('không file nào chứa "BEGIN PRIVATE KEY"', dinh, []);
}

xong();
