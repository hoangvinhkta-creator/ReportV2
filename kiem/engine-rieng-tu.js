/* Report Engine phải KHÔNG CÓ ĐƯỜNG VÀO TỪ INTERNET — sao lại đúng bộ kiểm
 * đã chạy thật bên Tracking (kiem/engine-rieng-tu.js) cho price-engine.
 *
 * Canh cả hai lớp:
 *   · cấu hình  — không route, không workers.dev
 *   · mã        — fetch() luôn 404, phòng khi ai đó bật nhầm workers.dev
 *   · dây nối   — wrangler.toml gốc khai đúng Service Binding, và Gateway
 *                 thật sự gọi Engine
 */
const { doc, ok, xong } = require('./khung');

const CAU_HINH = doc('engine/wrangler.toml');
const VO = doc('engine/src/index.js');
const CHINH = doc('wrangler.toml');

/** Bỏ dòng chú thích, chỉ giữ dòng cấu hình thật. */
const chiCauHinh = (s) => s.split('\n')
  .filter(d => !d.trim().startsWith('#') && d.trim())
  .join('\n');

console.log('\n1) Cấu hình Engine: không được có đường vào công khai');
{
  const c = chiCauHinh(CAU_HINH);
  ok('không khai [[routes]]', /\[\[routes\]\]/.test(c), false);
  ok('không khai [route]', /^\s*\[route\]/m.test(c), false);
  ok('không khai route = "..."', /^\s*route\s*=/m.test(c), false);
  ok('không khai routes = [...]', /^\s*routes\s*=/m.test(c), false);
  ok('không gắn tên miền riêng', /custom_domain/.test(c), false);
  ok('workers_dev khai tường minh = false', /workers_dev\s*=\s*false/.test(c), true);
  ok('có tên Worker rõ ràng', /name\s*=\s*"reportv2-engine"/.test(c), true);
  ok('không phục vụ file tĩnh ([assets])', /\[assets\]/.test(c), false);
}

console.log('\n2) Mã Engine: fetch() luôn 404 — lớp chặn cuối nếu cấu hình bị sửa');
{
  const f = (VO.match(/async fetch\(\)\s*\{[\s\S]*?\n  \}/) || [''])[0];
  ok('có hàm fetch()', f.length > 0, true);
  ok('trả đúng 404', /status:\s*404/.test(f), true);
  ok('KHÔNG trả 403 (403 là xác nhận có thứ gì ở đây)', /403/.test(f), false);
  ok('không đọc gì từ request rồi mới quyết định', /request/.test(f), false);
}

console.log('\n3) Vỏ Worker dùng WorkerEntrypoint đúng cách');
{
  ok('import WorkerEntrypoint từ cloudflare:workers', /from ["']cloudflare:workers["']/.test(VO), true);
  ok('export default extends WorkerEntrypoint', /export default class extends WorkerEntrypoint/.test(VO), true);
}

console.log('\n4) Worker chính đã gắn dây, và gắn ĐÚNG tên');
{
  const c = chiCauHinh(CHINH);
  ok('wrangler.toml gốc có khai [[services]]', /\[\[services\]\]/.test(c), true);
  ok('binding tên REPORT_ENGINE', /binding\s*=\s*"REPORT_ENGINE"/.test(c), true);

  const tenEngine = (chiCauHinh(CAU_HINH).match(/name\s*=\s*"([^"]+)"/) || [])[1];
  const tenTrongDay = (c.match(/\[\[services\]\][\s\S]*?service\s*=\s*"([^"]+)"/) || [])[1];
  ok('tên service khớp đúng tên Worker của Engine', tenTrongDay, tenEngine);

  const G = doc('src/index.js');
  ok('Gateway có gọi Engine', /env\.REPORT_ENGINE\./.test(G), true);
}

xong();
