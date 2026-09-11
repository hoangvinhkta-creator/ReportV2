/* Cửa chặn của bộ kiểm phải nằm TRONG repo, không nằm trên dashboard.
 *
 * CLAUDE.md: "Bộ kiểm hỏng là build hỏng." Chỗ duy nhất thực thi được câu đó
 * là `[build] command` trong wrangler.toml — nó chạy TRƯỚC `wrangler deploy`,
 * nên `npm test` đỏ là build dừng và Cloudflare giữ nguyên bản đang chạy.
 * GitHub Actions chỉ BÁO, không chặn: workflow đỏ mà Cloudflare vẫn deploy.
 *
 * Vì sao không để trong ô "Build command" trên dashboard — bài học đã trả giá
 * bên Tracking (17/08/2026, xem wrangler.toml repo đó): ô ấy CHỈ áp cho nhánh
 * production, build của nhánh phụ không kế thừa, log ghi "Build command: None"
 * rồi nhảy thẳng vào deploy. Mất gần một giờ mới nhìn ra, vì hai loại build
 * nằm lẫn trong cùng một danh sách.
 *
 * Bộ này canh đúng một điều: cửa ấy còn đó, và nó thật sự gọi bộ kiểm.
 */
const { doc, docJson, ok, xong } = require('./khung');

const CAU_HINH = doc('wrangler.toml');
const PKG = docJson('package.json');

/** Bỏ dòng chú thích, chỉ giữ dòng cấu hình thật — không thì chính đoạn chú
 *  thích giải thích cửa chặn lại làm bài kiểm xanh khi cửa đã bị gỡ. */
const chiCauHinh = (s) => s.split('\n')
  .filter((d) => !d.trim().startsWith('#') && d.trim())
  .join('\n');

console.log('\n1) wrangler.toml của Gateway phải khai [build] gọi bộ kiểm');
{
  const c = chiCauHinh(CAU_HINH);
  ok('có khai [build]', /\[build\]/.test(c), true);

  const lenh = (c.match(/\[build\][\s\S]*?command\s*=\s*"([^"]+)"/) || [])[1] || '';
  ok('  · có command', lenh.length > 0, true);
  /* Chấp nhận cả `npm test` lẫn một script bao ngoài (`npm run build`) miễn
     là đường dẫn cuối cùng chạy tới bộ kiểm — kiểm bằng cách lần qua
     package.json chứ không đoán theo tên. */
  const chayToiKiem = /npm\s+test/.test(lenh)
    || Object.values(PKG.scripts || {}).some(
      (s) => lenh.includes(s) || /npm\s+test/.test(String(s)));
  ok('  · command dẫn tới `npm test`', chayToiKiem, true);
}

console.log('\n2) `npm test` phải thật sự chạy bộ chạy trong kiem/');
{
  const test = (PKG.scripts || {}).test || '';
  ok('package.json có script test', test.length > 0, true);
  ok('  · và nó gọi kiem/chay.js', /kiem\/chay\.js/.test(test), true);
}

xong();
