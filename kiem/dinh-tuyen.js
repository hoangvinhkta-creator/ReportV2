/* Bộ định tuyến của Gateway: method nào được đi đường nào, đường lạ đi đâu,
 * và security header có gắn cho MỌI phản hồi hay không. Sao lại đúng cách
 * kiểm đã chạy thật bên Tracking (kiem/dinh-tuyen.js), rút gọn theo đúng
 * những gì P1 thật sự có (chỉ GET/HEAD, chỉ một endpoint /api/me).
 */
const { ok, xong } = require('./khung');
const path = require('path');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  const w = mod.default;

  const ENV = {
    ASSETS: { fetch: async () => new Response('DA-ROI-XUONG-ASSETS', { headers: { 'Content-Type': 'text/html' } }) },
    REPORT_ENGINE: { phienBan: async () => '0.1.0-p1' },
    // Cố ý KHÔNG có FB_SA_EMAIL/FB_SA_KEY — bộ này không kiểm nhánh xác
    // thực đã có tài khoản (xem kiem/gateway-xac-thuc.js), chỉ kiểm phần
    // request KHÔNG kèm token đã bị chặn TRƯỚC khi chạm tới đó chưa.
  };

  const goi = (duong, method, headers) => w.fetch(
    new Request('https://reportv2-gateway.workers.dev' + duong, { method: method || 'GET', headers }), ENV);

  console.log('\n1) Cửa chặn method — P3 mở POST cho ĐÚNG hai đường, mọi đường khác vẫn 405');
  {
    /* Bài này là cửa chặn của P1 ("chỉ GET/HEAD"), được P3 nới đúng một
       khe. Phép canh cho MỌI đường khác giữ nguyên không đổi một chữ — đó
       là cả điểm của việc nới có kiểm soát: nếu ai đó mở POST cho cả
       `/api/` thì những dòng dưới đây đỏ ngay. */
    ok('POST / bị chặn 405', (await goi('/', 'POST')).status, 405);
    ok('POST /api/me bị chặn 405', (await goi('/api/me', 'POST')).status, 405);
    ok('PUT /api/me bị chặn 405', (await goi('/api/me', 'PUT')).status, 405);
    ok('DELETE / bị chặn 405', (await goi('/', 'DELETE')).status, 405);
    ok('POST /api/bao-cao/suc-khoe (đường của P2b) vẫn 405',
       (await goi('/api/bao-cao/suc-khoe', 'POST')).status, 405);
    ok('POST /api/don-hang (đường chỉ đọc) vẫn 405', (await goi('/api/don-hang', 'POST')).status, 405);

    const r = await goi('/', 'POST');
    ok('405 có nói rõ method nào được phép', r.headers.get('Allow'), 'GET, HEAD');

    /* Hai đường P3 mở: KHÔNG còn 405. Chưa kèm token thì phải rơi vào cửa
       xác thực (401) — tức là request đã đi qua cửa method và tới được lớp
       "anh là ai", đúng thứ tự CLAUDE.md đòi. */
    ok('POST /api/tai-so KHÔNG còn 405', (await goi('/api/tai-so', 'POST')).status, 401);
    ok('POST /api/hoan-tac KHÔNG còn 405', (await goi('/api/hoan-tac', 'POST')).status, 401);

    /* Nhưng chỉ POST — không phải mở toang cho mọi method. */
    ok('PUT /api/tai-so vẫn bị chặn 405', (await goi('/api/tai-so', 'PUT')).status, 405);
    ok('DELETE /api/tai-so vẫn bị chặn 405', (await goi('/api/tai-so', 'DELETE')).status, 405);
    /* `/api/tai-so` là đường CHỈ nhận POST — nó không có gì để GET. Allow
       phải nói đúng ngần ấy, không kèm GET/HEAD cho đẹp đội hình. */
    ok('405 của /api/tai-so kể đúng một method', (await goi('/api/tai-so', 'PUT')).headers.get('Allow'), 'POST');
    ok('GET /api/tai-so cũng 405 (đường có thật, sai cửa)', (await goi('/api/tai-so', 'GET')).status, 405);

    /* Đường KHÔNG có trong bảng phải ra 404 (không có gì ở đây), không phải
       405 (có, nhưng sai cửa) — 405 cho đường lạ là tự khai báo đường nào
       tồn tại. */
    ok('POST vào đường /api/ lạ vẫn 404, không phải 405',
       (await goi('/api/khong-he-co', 'POST')).status, 404);
  }

  console.log('\n2) /api/ lạ phải 404, KHÔNG rơi xuống file tĩnh');
  {
    for (const d of ['/api/khong-co', '/api/', '/api/me/xyz']) {
      const r = await goi(d, 'GET');
      const than = await r.text();
      ok('GET ' + d + ' → 404', r.status, 404);
      ok('GET ' + d + ' → không trả trang index.html', /DA-ROI-XUONG-ASSETS/.test(than), false);
    }
  }

  console.log('\n3) /api/me — đúng đường, nhưng chưa đăng nhập thì 401');
  {
    const r = await goi('/api/me', 'GET');
    ok('GET /api/me không kèm token → 401', r.status, 401);
    const than = await r.json();
    ok('401 có nói câu tử tế, không lộ mã lỗi nội bộ', typeof than.loi, 'string');
    ok('401 KHÔNG lộ mã lỗi nội bộ ra JSON', than.ly, undefined);
    ok('401 có kèm rid để tra nhật ký', typeof than.rid, 'string');
  }

  console.log('\n4) Đường thật vẫn thông');
  {
    const r = await goi('/', 'GET');
    ok('GET / vẫn lấy được file tĩnh', /DA-ROI-XUONG-ASSETS/.test(await r.text()), true);
    const h = await goi('/', 'HEAD');
    ok('HEAD / cũng qua được (không bị 405)', h.status !== 405, true);
  }

  console.log('\n5) Đường nhạy cảm vẫn bị chặn — không rơi xuống file tĩnh');
  {
    for (const d of ['/.git/config', '/.env', '/wrangler.toml', '/src/index.js',
                     '/src/auth.js', '/engine/wrangler.toml', '/engine/src/index.js',
                     '/kiem/khung.js', '/docs/audit/2026-09-11-audit-reports-tracking.md',
                     '/CLAUDE.md', '/ROADMAP.md', '/package.json', '/backup.bak']) {
      const r = await goi(d, 'GET');
      ok(d + ' → 404', r.status, 404);
    }
  }

  console.log('\n6) Security header gắn cho MỌI phản hồi, kể cả phản hồi lỗi');
  {
    for (const [ten, d, m] of [['file tĩnh', '/', 'GET'], ['404 đường lạ', '/api/khong-co', 'GET'],
                               ['405 sai method', '/', 'POST'], ['404 đường cấm', '/.env', 'GET'],
                               ['401 chưa đăng nhập', '/api/me', 'GET']]) {
      const r = await goi(d, m);
      ok(ten + ' có CSP', !!r.headers.get('Content-Security-Policy'), true);
      ok(ten + ' có X-Frame-Options', r.headers.get('X-Frame-Options'), 'DENY');
    }
  }

  console.log('\n7) CSP của trang tĩnh không mở connect-src/script-src cho *.firebasedatabase.app');
  {
    /* LUẬT SỐ 1: trình duyệt không bao giờ nói chuyện thẳng với Realtime
       Database. Mở domain đó trong CSP là để hé cửa cho một lối tắt sau
       này lỡ tay dùng SDK database ngay trong trang — CSP phải tự nó chặn
       lối đó, không dựa vào kỷ luật của người viết code sau này. */
    const r = await goi('/', 'GET');
    const csp = r.headers.get('Content-Security-Policy') || '';
    ok('không mở firebasedatabase.app', /firebasedatabase\.app/.test(csp), false);
    ok('không mở firebaseio.com', /firebaseio\.com/.test(csp), false);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
