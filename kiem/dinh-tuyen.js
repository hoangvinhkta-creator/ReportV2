/* Bộ định tuyến của Gateway: method nào được đi đường nào, đường lạ đi đâu,
 * và security header có gắn cho MỌI phản hồi hay không. Sao lại đúng cách
 * kiểm đã chạy thật bên Tracking (kiem/dinh-tuyen.js), rút gọn theo đúng
 * những gì P1 thật sự có (chỉ GET/HEAD, chỉ một endpoint /api/me).
 */
const { ok, xong, doc } = require('./khung');
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

  /* Biến thể cho mục 8: tự chọn host và tự thêm biến môi trường. Giữ `goi`
     nguyên si có chủ ý — mọi mục từ 1 đến 7 phải chạy với ĐÚNG cấu hình cũ
     (không khai cờ, host `*.workers.dev`), để bài kiểm chứng minh cờ tắt là
     không đổi một hành vi nào. */
  const goiTai = (goc, duong, method, envPhu) => w.fetch(
    new Request(goc + duong, { method: method || 'GET' }), { ...ENV, ...envPhu });

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
    ok('POST /api/xoa-ky KHÔNG còn 405', (await goi('/api/xoa-ky', 'POST')).status, 401);

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

  console.log('\n8) P7 — MỘT tên miền duy nhất, cờ ENFORCE_CANONICAL_HOST');
  {
    const WD = 'https://reportv2-gateway.workers.dev';
    const THAT = 'https://reports.tinphatcrm.com';
    const BAT = { CANONICAL_HOST: 'reports.tinphatcrm.com', ENFORCE_CANONICAL_HOST: '1' };

    /* Cờ TẮT — hành vi không đổi một chữ so với trước P7. Đây là bài giữ cho
       lượt deploy đầu của P7 vô hại: route mới gắn vào, mã mới đã nằm sẵn,
       nhưng chưa đóng cửa nào cả. */
    {
      const r = await goiTai(WD, '/', 'GET', { CANONICAL_HOST: 'reports.tinphatcrm.com' });
      ok('cờ tắt: workers.dev vẫn phục vụ file tĩnh', /DA-ROI-XUONG-ASSETS/.test(await r.text()), true);
      const r0 = await goiTai(WD, '/', 'GET', { ...BAT, ENFORCE_CANONICAL_HOST: '0' });
      ok('cờ khai thẳng "0": vẫn phục vụ', r0.status, 200);
    }

    /* Cờ BẬT — host lạ chỉ còn một việc: chỉ sang địa chỉ thật. */
    {
      const r = await goiTai(WD, '/', 'GET', BAT);
      ok('cờ bật: GET workers.dev → 301', r.status, 301);
      ok('301 trỏ đúng tên miền thật', r.headers.get('Location'), THAT + '/');

      const q = await goiTai(WD, '/api/don-hang?ky=2026-09&line=Nội thành', 'GET', BAT);
      ok('301 giữ nguyên path VÀ query',
         decodeURIComponent(q.headers.get('Location')),
         THAT + '/api/don-hang?ky=2026-09&line=Nội thành');

      const h = await goiTai(WD, '/', 'HEAD', BAT);
      ok('HEAD cũng được chỉ đường', h.status, 301);
    }

    /* Method khác KHÔNG được chuyển hướng — 301 làm client đổi POST thành
       GET, hoặc gửi lại thân request sang một origin khác. */
    {
      for (const m of ['POST', 'PUT', 'DELETE']) {
        const r = await goiTai(WD, '/api/tai-so', m, BAT);
        ok(m + ' vào host lạ → 421, KHÔNG phải 301', r.status, 421);
        ok(m + ' vào host lạ không kèm Location', r.headers.get('Location'), null);
      }
    }

    /* Host lạ bị chặn TRƯỚC cửa đường dẫn: `*.workers.dev` không trả lời
       thay app về bất cứ đường nào, kể cả để nói 404. */
    {
      const r = await goiTai(WD, '/.env', 'GET', BAT);
      ok('đường cấm trên host lạ → 301 (host xét trước đường dẫn)', r.status, 301);
      const a = await goiTai(WD, '/api/khong-he-co', 'GET', BAT);
      ok('đường /api/ lạ trên host lạ → 301, không phải 404', a.status, 301);
    }

    /* Tên miền thật vẫn thông, và cờ bật không được chạm gì tới nó. */
    {
      const r = await goiTai(THAT, '/', 'GET', BAT);
      ok('cờ bật: tên miền thật vẫn lấy được file tĩnh',
         /DA-ROI-XUONG-ASSETS/.test(await r.text()), true);
      ok('cờ bật: /api/me trên tên miền thật vẫn tới cửa xác thực (401)',
         (await goiTai(THAT, '/api/me', 'GET', BAT)).status, 401);
      ok('cờ bật: POST /api/tai-so trên tên miền thật KHÔNG bị 421',
         (await goiTai(THAT, '/api/tai-so', 'POST', BAT)).status, 401);
    }

    /* So host không phân biệt hoa/thường — `CANONICAL_HOST` gõ hoa vẫn phải
       khớp, chứ không lặng lẽ chuyển hướng tên miền thật về chính nó (một
       vòng lặp 301 vô tận, và không có gì đỏ lên). */
    {
      const r = await goiTai(THAT, '/', 'GET',
        { ...BAT, CANONICAL_HOST: 'Reports.TinPhatCRM.com' });
      ok('CANONICAL_HOST gõ hoa vẫn khớp tên miền thật', r.status, 200);
      const kv = await goiTai(THAT, '/', 'GET', { ...BAT, CANONICAL_HOST: '  reports.tinphatcrm.com  ' });
      ok('CANONICAL_HOST lọt khoảng trắng vẫn khớp', kv.status, 200);
    }

    /* Cờ bật mà CANONICAL_HOST rỗng: KHÔNG chặn gì. Một tên miền gõ sai không
       được phép hạ cả app — và chặn ở đây thì không còn địa chỉ nào để vào mà
       sửa. Cặp giá trị ấy được canh ở mục 9, tức đỏ ở `npm test` trước khi
       `wrangler deploy` chạy. */
    {
      for (const rong of [undefined, '', '   ']) {
        const r = await goiTai(WD, '/', 'GET', { ENFORCE_CANONICAL_HOST: '1', CANONICAL_HOST: rong });
        ok('cờ bật + CANONICAL_HOST ' + JSON.stringify(rong) + ' → vẫn phục vụ, không tự khoá',
           r.status, 200);
      }
    }

    /* Chỉ đúng chuỗi "1" mới bật. Một giá trị lỡ tay ("true", "yes", "01")
       KHÔNG được coi là bật: cờ này đóng đường vào, nên nó phải bật bằng một
       giá trị duy nhất viết ra được, không bật bằng "thứ gì trông giống có". */
    {
      for (const v of ['true', 'yes', 'on', '01', '1 ', 2]) {
        const r = await goiTai(WD, '/', 'GET', { ...BAT, ENFORCE_CANONICAL_HOST: v });
        ok('ENFORCE_CANONICAL_HOST = ' + JSON.stringify(v) + ' KHÔNG bật cờ', r.status, 200);
      }
    }

    /* Security header vẫn gắn cho cả hai phản hồi mới — cùng luật mục 6. */
    {
      const r = await goiTai(WD, '/', 'GET', BAT);
      ok('301 có CSP', !!r.headers.get('Content-Security-Policy'), true);
      const p = await goiTai(WD, '/api/tai-so', 'POST', BAT);
      ok('421 có CSP', !!p.headers.get('Content-Security-Policy'), true);
    }
  }

  console.log('\n9) wrangler.toml — route và cờ phải khai cùng MỘT tên miền');
  {
    const W = doc('wrangler.toml').split('\n')
      .filter(d => !d.trim().startsWith('#') && d.trim()).join('\n');

    ok('có khai [[routes]]', /\[\[routes\]\]/.test(W), true);
    const pattern = (W.match(/pattern\s*=\s*"([^"]+)"/) || [])[1];
    ok('route gắn đúng zone tinphatcrm.com', /zone_name\s*=\s*"tinphatcrm\.com"/.test(W), true);
    ok('route phủ mọi đường dẫn (/*)', /\/\*$/.test(pattern || ''), true);

    const canonical = (W.match(/CANONICAL_HOST\s*=\s*"([^"]*)"/) || [])[1];
    const co = (W.match(/ENFORCE_CANONICAL_HOST\s*=\s*"([^"]*)"/) || [])[1];

    ok('CANONICAL_HOST có khai và không rỗng', !!(canonical && canonical.trim()), true);
    ok('ENFORCE_CANONICAL_HOST chỉ được là "0" hoặc "1"', ['0', '1'].includes(co), true);

    /* Bài quan trọng nhất của mục này. Hai nơi khai cùng một tên miền: route
       (nơi Worker THẬT SỰ nhận request) và cờ (nơi Worker chỉ người dùng
       tới). Lệch nhau thì cờ bật là chuyển hướng mọi người sang một host mà
       Worker này không hề phục vụ — một vòng chết im lặng, không bài kiểm
       runtime nào bắt được vì mỗi bên tự nó vẫn đúng. */
    ok('hostname của route KHỚP ĐÚNG CANONICAL_HOST',
       (pattern || '').replace(/\/\*$/, '').toLowerCase(), (canonical || '').trim().toLowerCase());

    /* Cờ chỉ được bật khi có tên miền để chỉ tới. Runtime cố ý fail-safe
       (mục 8), nên ĐÂY là chỗ duy nhất một cấu hình như thế bị chặn — và nó
       chặn đúng lúc: `[build] command = "npm test"` làm wrangler deploy
       không chạy. */
    if (co === '1') ok('cờ bật thì CANONICAL_HOST phải có giá trị',
                       !!(canonical && canonical.trim()), true);
  }

  console.log('\n10) P7 — Access đã bỏ: đăng nhập Firebase là lớp DUY NHẤT');
  {
    /* Tới P7 không còn Cloudflare Access phía trước tên miền nữa, nên mỗi
       đường `/api/` tự nó là cả hàng rào. Bài này đọc THẲNG bảng
       `API_ROUTES` trong mã rồi gọi từng đường không kèm token: một endpoint
       thêm sau này mà quên bọc `boc()` sẽ trả 200 ở đây và đỏ ngay, không
       phải chờ ai nhớ cập nhật một danh sách thứ hai. */
    const SRC = doc('src/index.js');
    const bang = SRC.slice(SRC.indexOf('const API_ROUTES'));
    const duong = [...bang.slice(0, bang.indexOf(']);')).matchAll(/\["(GET|POST) ([^"]+)"/g)]
      .map(m => [m[1], m[2]]);

    ok('đọc được bảng API_ROUTES từ mã', duong.length > 0, true);
    /* Ngưỡng SÀN, không ghim con số: P6b đang mở thêm đường và một bài kiểm
       an ninh không được làm đỏ build của người khác chỉ vì có thêm endpoint.
       Sàn vẫn bắt được ca thật sự đáng sợ — biểu thức trên vỡ và vòng lặp
       dưới chỉ còn soi hai đường, trông y như một bài đã đạt. */
    ok('đọc được ít nhất 15 đường (P1→P6 đã có ngần ấy)', duong.length >= 15, true);

    for (const [cach, d] of duong) {
      const r = await goi(d, cach);
      ok(cach + ' ' + d + ' không kèm token → 401', r.status, 401);
    }

    /* Và không đường nào được bọc `boc(false, …)` — dạng đó chỉ đòi đăng
       nhập mà KHÔNG đòi vai báo cáo, tức mở cho mọi tài khoản Firebase của
       công ty, kể cả tài khoản app Marketing dùng chung Firebase này. */
    ok('không handler nào bọc boc(false, …)', /boc\(\s*false\s*,/.test(SRC), false);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
