/* Chạy hết mọi bộ kiểm trong thư mục này, cộng tổng, trả mã lỗi ≠ 0 nếu có
 * bài hỏng. Chép nguyên bộ chạy của Tracking (kiem/chay.js) — đây là thứ CI
 * gọi, và sau này là thứ gắn vào Build command của Cloudflare.
 *
 * Mỗi bộ chạy trong MỘT TIẾN TRÌNH RIÊNG, cố ý — xem chú thích gốc bên
 * Tracking cho lý do đầy đủ (biến của bộ này đè bộ kia nếu chạy chung một
 * tiến trình).
 *
 * Thêm bộ mới: thả file .js vào thư mục này là xong, không phải khai báo ở
 * đâu cả.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const BO = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.js') && f !== 'khung.js' && f !== 'chay.js')
  .sort();

let tongDat = 0, tongHong = 0, boHong = [], boBoQua = [], boChet = [];

for (const f of BO) {
  let ra = '';
  try {
    ra = execFileSync(process.execPath, [path.join(DIR, f)],
      { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    ra = (e.stdout || '') + (e.stderr || '');
  }
  const dong = ra.trim().split('\n');
  let cuoi = '';
  for (const d of dong) if (/^\d+ đạt, \d+ hỏng$/.test(d.trim())) cuoi = d.trim();
  const m = cuoi.match(/^(\d+) đạt, (\d+) hỏng$/);

  if (m) {
    const dat = +m[1], hong = +m[2];
    tongDat += dat; tongHong += hong;
    if (hong) { boHong.push(f); console.log(`  ✗ ${f.padEnd(24)} ${dat} đạt, ${hong} HỎNG`); }
    else console.log(`  ✓ ${f.padEnd(24)} ${dat} đạt`);
  } else if (/BỎ QUA/.test(ra)) {
    boBoQua.push(f);
    console.log(`  – ${f.padEnd(24)} bỏ qua`);
  } else {
    boHong.push(f); boChet.push(f);
    console.log(`  ✗ ${f.padEnd(24)} CHẾT GIỮA CHỪNG`);
    console.log(ra.trim().split('\n').slice(-6).map(x => '      ' + x).join('\n'));
  }
}

console.log('\n' + '─'.repeat(52));
console.log(`  ${BO.length} bộ · ${tongDat} đạt · ${tongHong} hỏng`
  + (boChet.length ? ` · ${boChet.length} bộ CHẾT GIỮA CHỪNG` : '')
  + (boBoQua.length ? ` · ${boBoQua.length} bỏ qua` : ''));
if (boHong.length) {
  console.log('  HỎNG: ' + boHong.join(', '));
  process.exit(1);
}
console.log('  Tất cả đạt.');
