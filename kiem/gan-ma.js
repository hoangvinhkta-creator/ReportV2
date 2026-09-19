/* ĐƯỜNG DÂY GATEWAY → TRACKING (P4, lát cắt 1).
 *
 * Chạy Gateway THẬT: token ký bằng khoá RSA tự sinh, Engine thật nối qua
 * Service Binding giả, Firebase là một cây trong bộ nhớ, và Tracking là một
 * máy chủ giả nói đúng hợp đồng `/api/xuat/` + `/api/inv-map`.
 *
 * Bốn thứ bộ này canh, xếp theo mức đắt nếu hỏng:
 *
 *  A. LỘ KHOÁ. `X-Report-Key` là bí mật của Worker. Nó phải đi tới Tracking
 *     ở HEADER, và không được xuất hiện một lần nào trong thứ trả về trình
 *     duyệt — kể cả trên đường lỗi, nơi người ta hay quên.
 *
 *  B. KHOÁ LỆCH HAI REPO. Tracking dội lại khoá `inv/map` do chính nó tính.
 *     Lệch với khoá Engine tính nghĩa là hai bản công thức đã trôi khỏi
 *     nhau, và quyết định vừa ghi nằm ở một ô Báo cáo sẽ không bao giờ đọc
 *     tới. Triệu chứng duy nhất là "gán rồi mà vẫn hiện chưa gán" — rất khó
 *     lần ra, nên phải nổ NGAY tại lượt ghi.
 *
 *  C. SỰ CỐ MẠNG NÓI THAY NGƯỜI. Tracking hỏng thì bảng đơn vẫn phải ra
 *     (doanh số, số đơn không cần bảng giá), nhưng phép khớp KHÔNG được
 *     chạy và màn hình phải nhận `loi_nguon_ma` để nói "CHƯA BIẾT" chứ
 *     không phải "không có mã" (CLAUDE.md).
 *
 *  D. RÒ DỮ LIỆU BẢNG GIÁ. `/api/ma-bang-gia` dựng từ danh sách trắng, nên
 *     hợp đồng bên Tracking có nới ra thì Báo cáo cũng không vô tình đẩy
 *     trường mới xuống trình duyệt.
 */
const path = require('path');
const crypto = require('crypto');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');
const DUAN = 'tinphattracking';
const KHOA_BC = 'khoa-bao-cao-rat-bi-mat-123456';

const b64u = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwkPub = publicKey.export({ format: 'jwk' });
  const KID = 'kid-cua-bai-kiem';
  const PEM_SA = privateKey.export({ type: 'pkcs8', format: 'pem' });

  function token(uid) {
    const gio = Math.floor(Date.now() / 1000);
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
    const c = b64u(JSON.stringify({
      aud: DUAN, iss: 'https://securetoken.google.com/' + DUAN,
      sub: uid, email: uid + '@tinphat.test',
      iat: gio - 10, auth_time: gio - 10, exp: gio + 3600,
    }));
    const s = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), privateKey);
    return h + '.' + c + '.' + b64u(s);
  }

  /* ─── Bảng giá giả, ĐÚNG hình dạng `/api/xuat/board` trả ───
     `alt` là MẢNG (Tracking cắt chuỗi ngăn phẩy trước khi trả). Cố ý gắn
     thêm một trường lạ `gia_von_bi_mat` để chứng minh danh sách trắng của
     `/api/ma-bang-gia` chặn được nó — xem mục D. */
  const BOARD = {
    '65C6K': { name: '65C6K', alt: [], brand: 'TCL', category_label: 'Tivi',
      gia_von_bi_mat: 9999 },
    'X198VDGEN': { name: 'SJ-X198V-DG', alt: ['X198V'], brand: 'Sharp',
      category_label: 'Tủ lạnh' },
  };

  /* ─── Firebase giả ─── */
  function dungDb(hat) {
    const cay = JSON.parse(JSON.stringify(hat || {}));
    const tra = (duong) => {
      let v = cay;
      for (const doan of duong.split('/')) {
        if (v === null || typeof v !== 'object') return null;
        v = v[doan];
        if (v === undefined) return null;
      }
      return v === undefined ? null : v;
    };
    return { cay, tra };
  }

  const fetchThat = globalThis.fetch;

  /* Mọi lượt Gateway gọi RA NGOÀI, ghi lại để soi. `trk` mô tả Tracking cư
     xử thế nào ở lượt chạy này. */
  let daGoiTrk = [];
  function gai(db, trk) {
    const t = trk || {};
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({
          keys: [{ kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwkPub.n, e: jwkPub.e }],
        }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
      }
      if (u.includes('oauth2') || u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'gia', expires_in: 3600 }),
          { headers: { 'content-type': 'application/json' } });
      }

      /* ---- Tracking giả ---- */
      if (u.includes('price.tinphatcrm.com') || u.includes('tracking-gia')) {
        const uu = new URL(u);
        daGoiTrk.push({
          duong: uu.pathname,
          khoa: (opt && opt.headers && (opt.headers['X-Report-Key'] || opt.headers['x-report-key'])) || null,
          than: opt && opt.body ? JSON.parse(opt.body) : null,
        });
        if (t.chet) throw new Error('mạng đứt');
        if (uu.pathname === '/api/xuat/board') {
          if (t.boardHong) return new Response('{"ok":false,"ly":"nguon-hong"}', { status: 502 });
          return new Response(JSON.stringify(t.board === undefined ? BOARD : t.board),
            { headers: { 'content-type': 'application/json' } });
        }
        if (uu.pathname === '/api/xuat/alias')
          return new Response(JSON.stringify({ map: t.alias || {} }),
            { headers: { 'content-type': 'application/json' } });
        if (uu.pathname === '/api/xuat/inv_map')
          return new Response(JSON.stringify({ map: t.invMap || {} }),
            { headers: { 'content-type': 'application/json' } });
        if (uu.pathname === '/api/min-ngay') {
          if (t.minHong) return new Response('{"ok":false,"ly":"nguon-hong"}', { status: 502 });
          const b = opt && opt.body ? JSON.parse(opt.body) : {};
          let than;
          try { than = typeof t.min === 'function' ? t.min(b) : (t.min || { records: [], errors: [] }); }
          catch (e) {
            if (e.ma409) return new Response('{"ok":false,"ly":"nguon-dang-ghi"}', { status: 409 });
            throw e;
          }
          return new Response(JSON.stringify({ currency_unit: 'VND_THOUSAND',
            next_cursor: null, ...than }),
            { headers: { 'content-type': 'application/json' } });
        }
        if (uu.pathname === '/api/inv-map') {
          if (t.ghiTuChoi)
            return new Response(JSON.stringify({ ok: false, ly: t.ghiTuChoi }),
              { status: t.ghiMa || 409 });
          const than = opt && opt.body ? JSON.parse(opt.body) : {};
          const khoa = t.khoaDoiLai
            || ('N_' + String(than.ten || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 80));
          return new Response(JSON.stringify({ ok: true, khoa, ma: than.ma }),
            { headers: { 'content-type': 'application/json' } });
        }
        return new Response('{"ok":false,"ly":"khong-co"}', { status: 404 });
      }

      const m = u.match(/firebasedatabase\.app\/(.*?)\.json/);
      if (!m) throw new Error('bài kiểm không cho gọi ra ngoài: ' + u);
      const duong = decodeURIComponent(m[1]);
      const cach = (opt && opt.method) || 'GET';
      if (cach === 'GET') {
        let v = db.tra(duong);
        if (u.includes('shallow=true') && v && typeof v === 'object') {
          const nong = {};
          for (const k of Object.keys(v)) nong[k] = true;
          v = nong;
        }
        return new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 200 });
    };
  }

  gai(dungDb({}));
  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  /* CÙNG một thể hiện module mà Gateway đang dùng (Node ESM gộp theo URL),
     nên `xoaDem()` ở đây xoá đúng bộ đệm Gateway đọc. */
  const TRK = await import('file://' + path.join(GOC, 'src/tracking.js'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
  const S = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));
  const w = mod.default;
  globalThis.fetch = fetchThat;

  const engine = () => ({
    async phienBan() { return 'kiem'; },
    async tomTatLine(a, b) { return D.tomTatLine(a, b); },
    async dungBangDon(a, b, c, d) { return D.dungBangDon(a, b, c, d); },
    async dungBangDonKemMa(a, b, c, d, n, ky, mn, qd) {
      const bang = K.khopMaChoBangDon(D.dungBangDon(a, b, c, d), n, ky);
      if (mn) K.dienGiaNhap(bang, mn);
      return S.apDungSuaTay(bang, qd);
    },
    async dungBangDonSuaTay(a, b, c, d, qd) {
      return S.apDungSuaTay(D.dungBangDon(a, b, c, d), qd);
    },
    async khoaTenHang(ten) { return K.khoaTenHang(ten); },
    /* Engine giả phơi CẢ HAI tên, đúng như Engine thật sau 19/09/2026.
       Phơi tên mới là bắt buộc: chỉ có tên cũ thì Gateway luôn rơi vào cửa
       lùi, và một lỗi gõ sai `kyCoGiaVon` bên Gateway sẽ không bao giờ đỏ. */
    async kyCoGiaVon(ky) { return K.kyCoGiaVon(ky); },
    /* Tên cũ còn sống cho bản Gateway cũ giữa hai lượt deploy (bẫy số 4). */
    async kyCoKhopMa(ky) { return K.kyCoGiaVon(ky); },
    async maCanGiaVon(dong, n, ky) { return K.maCanGiaVon(dong, n, ky); },
  });

  const ENV = (them) => ({
    ASSETS: { fetch: async () => new Response('tĩnh') },
    REPORT_ENGINE: engine(),
    FB_SA_EMAIL: 'kiem@vi-du', FB_SA_KEY: PEM_SA,
    FB_DB_URL: 'https://kiem-default-rtdb.asia-southeast1.firebasedatabase.app',
    REPORT_API_KEY: KHOA_BC,
    TRACKING_URL: 'https://price.tinphatcrm.com',
    ...(them || {}),
  });

  const BANG_LINE = { thu_tu: ['Nội thành', 'Khác'], cua_ten: { 'Đức Hiệp': 'Nội thành' } };
  const dong = (o) => ({
    ngay: '2026-09-08', so_ct: o.ct, ten_hang: o.ten, so_luong: 1,
    don_gia: o.tien, doanh_so: o.tien, chiet_khau: 0,
    nhan_vien: 'Đức Hiệp', imei: null,
  });
  const HAT = () => ({
    profiles: { sep: { email: 'sep@tinphat.test', name: 'Sếp', vai: 'quantri' } },
    bc: {
      quyetdinh: { line: BANG_LINE },
      dong: {
        '2026-09': {
          k1: dong({ ct: 'BH1', ten: 'Tivi TCL 65C6K', tien: 9000000 }),
          k2: dong({ ct: 'BH2', ten: 'Chân máy giặt Đa Năng - chiều', tien: 200000 }),
        },
      },
      khach: {},
    },
  });

  async function goi(duong, o) {
    const opt = o || {};
    TRK.xoaDem(); TRK.xoaDemMin();   // mỗi phép thử bắt đầu từ bộ đệm sạch
    daGoiTrk = [];
    gai(dungDb(opt.hat || HAT()), opt.trk);
    try {
      const h = { Authorization: 'Bearer ' + token(opt.ai || 'sep') };
      if (opt.than !== undefined) h['Content-Type'] = 'application/json';
      const r = await w.fetch(new Request('https://g.workers.dev' + duong, {
        method: opt.cach || (opt.than !== undefined ? 'POST' : 'GET'),
        headers: h,
        body: opt.than === undefined ? undefined : JSON.stringify(opt.than),
      }), ENV(opt.env));
      const chu = await r.text();
      let js = null;
      try { js = JSON.parse(chu); } catch (e) { /* phép thử tự xét */ }
      return { ma: r.status, chu, js };
    } finally { globalThis.fetch = fetchThat; }
  }

  const moiDong = (bang) => {
    const ra = [];
    for (const ng of bang.ngay) for (const d of ng.don) for (const x of d.dong) ra.push(x);
    return ra;
  };

  /* ───────── A. Khoá đi header, không rò ra ngoài ───────── */

  console.log('\nA) Khoá X-Report-Key');

  let r = await goi('/api/gan-ma', { than: { ten: 'Tivi TCL 65C6K', ma: '65C6K' } });
  ok('gán mã thành công → 200', r.ma, 200);
  ok('ghi = true', r.js.ghi, true);

  const luotGhi = daGoiTrk.find((g) => g.duong === '/api/inv-map');
  ok('có gọi POST /api/inv-map của Tracking', !!luotGhi, true);
  ok('khoá đi ở HEADER', luotGhi.khoa, KHOA_BC);
  /* Gửi `ten`, KHÔNG gửi khoá: công thức khoá chỉ có một thẩm quyền. */
  ok('gửi câu tên hàng, không gửi khoá tính sẵn',
    Object.keys(luotGhi.than).sort(), ['ma', 'ten']);
  ok('gửi đúng câu tên hàng nguyên văn', luotGhi.than.ten, 'Tivi TCL 65C6K');
  ok('KHOÁ KHÔNG có trong thân trả về trình duyệt', r.chu.includes(KHOA_BC), false);

  r = await goi('/api/don-hang?ky=2026-09');
  ok('khoá không rò qua đường đọc bảng đơn', r.chu.includes(KHOA_BC), false);

  r = await goi('/api/gan-ma', {
    than: { ten: 'Tivi TCL 65C6K', ma: '65C6K' },
    trk: { ghiTuChoi: 'dang-o-ton-kho' },
  });
  ok('khoá không rò trên đường LỖI', r.chu.includes(KHOA_BC), false);

  /* Chưa đặt Secret → đóng, không mở. */
  r = await goi('/api/gan-ma', {
    than: { ten: 'Tivi TCL 65C6K', ma: '65C6K' }, env: { REPORT_API_KEY: undefined },
  });
  ok('chưa đặt REPORT_API_KEY → không ghi', r.js.ghi, false);
  ok('  · và nói rõ là thiếu cấu hình, không đổ cho Tracking',
    /khoá đọc Tracking/.test(r.js.cau || ''), true);

  /* ───────── B. Khoá lệch hai repo phải NỔ ───────── */

  console.log('\nB) Hai repo, một công thức khoá');

  r = await goi('/api/gan-ma', {
    than: { ten: 'Tivi TCL 65C6K', ma: '65C6K' },
    trk: { khoaDoiLai: 'N_MOT_KHOA_KHAC_HAN' },
  });
  ok('Tracking dội về khoá khác → 503, không im lặng nhận', r.ma, 503);
  ok('  · và không nói "đã ghi"', (r.js || {}).ghi, undefined);

  /* ───────── Lời từ chối của Tracking → câu cho người đọc ───────── */

  console.log('\nLời từ chối của Tracking');

  r = await goi('/api/gan-ma', {
    than: { ten: 'Tivi TCL 65C6K', ma: '65C6K' }, trk: { ghiTuChoi: 'dang-o-ton-kho' },
  });
  ok('NB-2: đang ở Tồn kho → không ghi', r.js.ghi, false);
  ok('  · và câu chỉ đúng việc phải làm',
    /Tồn kho/.test(r.js.cau) && /Tracking/.test(r.js.cau), true);

  r = await goi('/api/gan-ma', {
    than: { ten: 'Tivi TCL 65C6K', ma: 'MA-MA' },
    trk: { ghiTuChoi: 'ma-khong-co-tren-bang-gia', ghiMa: 404 },
  });
  ok('mã không có trên bảng giá → không ghi', r.js.ghi, false);
  ok('  · và câu nói được bước tiếp theo', /Bảng giá/.test(r.js.cau), true);

  /* Đầu vào bẩn chặn ngay tại Gateway, không làm phiền Tracking. */
  r = await goi('/api/gan-ma', { than: { ten: '', ma: '65C6K' } });
  ok('thiếu tên → 400', r.ma, 400);
  ok('  · và không gọi Tracking', daGoiTrk.length, 0);
  r = await goi('/api/gan-ma', { than: { ten: 'Tivi TCL 65C6K' } });
  ok('thiếu mã → 400', r.ma, 400);
  ok('  · và không gọi Tracking', daGoiTrk.length, 0);

  /* ───────── C. Tracking hỏng: bảng vẫn ra, nhưng nói rõ CHƯA BIẾT ───────── */

  console.log('\nC) Nguồn hỏng không được nói thay người');

  r = await goi('/api/don-hang?ky=2026-09');
  ok('Tracking chạy tốt → 200', r.ma, 200);
  ok('  · không có cờ nguồn hỏng', r.js.loi_nguon_ma, null);
  let ds = moiDong(r.js.bang);
  ok('  · dòng khớp được đã có mã',
    ds.find((d) => d.ma_san_pham === 'Tivi TCL 65C6K').ma_bang_gia, '65C6K');
  ok('  · và có hãng lấy từ bảng giá',
    ds.find((d) => d.ma_san_pham === 'Tivi TCL 65C6K').hang, 'TCL');
  ok('  · dòng không khớp được nói rõ lý do',
    ds.find((d) => d.ma_san_pham.startsWith('Chân máy giặt')).ly_do_chua_ma, 'chua-khop');

  r = await goi('/api/don-hang?ky=2026-09', { trk: { boardHong: true } });
  ok('Tracking hỏng: bảng đơn VẪN ra', r.ma, 200);
  ok('  · kèm cờ nguồn hỏng để màn hình nói "CHƯA BIẾT"',
    typeof r.js.loi_nguon_ma === 'string' && r.js.loi_nguon_ma.length > 0, true);
  ds = moiDong(r.js.bang);
  ok('  · doanh số KHÔNG bị ảnh hưởng', r.js.bang.tom_tat.doanh_so, 9200000);
  /* Điểm mấu chốt: phép khớp KHÔNG chạy chút nào. Nếu nó chạy với bảng giá
     rỗng thì mọi dòng ra "chưa khớp" — một sự cố mạng nói một kết luận
     nghiệp vụ thay người, đúng thứ CLAUDE.md cấm. */
  ok('  · phép khớp KHÔNG chạy: không dòng nào bị gắn "chưa khớp"',
    ds.some((d) => d.ly_do_chua_ma), false);
  ok('  · và không có bản kê hàng chờ giả', r.js.bang.tom_tat_ma, undefined);

  r = await goi('/api/don-hang?ky=2026-09', { trk: { chet: true } });
  ok('Tracking đứt mạng: bảng đơn vẫn ra', r.ma, 200);
  ok('  · kèm cờ nguồn hỏng', !!r.js.loi_nguon_ma, true);

  r = await goi('/api/don-hang?ky=2026-09', { trk: { board: {} } });
  ok('bảng giá RỖNG cũng là nguồn hỏng, không phải "không mã nào"',
    !!r.js.loi_nguon_ma, true);

  /* ───────── D. Danh sách mã: danh sách trắng, không rò ───────── */

  console.log('\nD) Danh sách mã cho ô chọn');

  r = await goi('/api/ma-bang-gia');
  ok('trả 200', r.ma, 200);
  ok('đủ số mã', r.js.ds.length, 2);
  ok('CHỈ bốn trường của danh sách trắng',
    Object.keys(r.js.ds[0]).sort(), ['hang', 'ma', 'nhom', 'ten']);
  /* Soi trên CHUỖI đã serialize, không trên object: thứ đi qua mạng là chuỗi. */
  ok('trường lạ của bảng giá KHÔNG lọt ra', r.chu.includes('gia_von_bi_mat'), false);
  ok('  · kể cả giá trị của nó', r.chu.includes('9999'), false);

  r = await goi('/api/ma-bang-gia', { trk: { boardHong: true } });
  ok('bảng giá hỏng → 503, không trả danh sách rỗng', r.ma, 503);
  ok('  · và không có `ds` rỗng để bên kia đọc nhầm', (r.js || {}).ds, undefined);

  /* ───────── Bộ đệm bảng giá ───────── */

  console.log('\nBộ đệm bảng giá');

  TRK.xoaDem(); TRK.xoaDemMin();
  daGoiTrk = [];
  gai(dungDb(HAT()), {});
  try {
    const h = { Authorization: 'Bearer ' + token('sep') };
    for (let i = 0; i < 2; i++) {
      await w.fetch(new Request('https://g.workers.dev/api/don-hang?ky=2026-09',
        { headers: h }), ENV());
    }
  } finally { globalThis.fetch = fetchThat; }
  const demBoard = daGoiTrk.filter((g) => g.duong === '/api/xuat/board').length;
  const demMap = daGoiTrk.filter((g) => g.duong === '/api/xuat/inv_map').length;
  ok('bảng giá chỉ kéo về MỘT lần cho hai lượt đọc', demBoard, 1);
  /* `inv_map` CỐ Ý không nhớ tạm: nó là thứ người dùng vừa sửa ở lượt bấm
     trước, và hiện lại bản cũ là làm người ta tưởng lượt gán vừa rồi trượt. */
  ok('bản đồ phân loại LUÔN kéo lại, không nhớ tạm', demMap, 2);

  /* ───────── E. Mốc kỳ: khớp mã MỌI kỳ, giá vốn chỉ từ 09/2026 ───────── */

  console.log('\nE) Kỳ không có dữ liệu giá');

  /* Viết lại 19/09/2026. Bản trước canh chiều NGƯỢC LẠI — "kỳ cũ thì không
     hỏi Tracking lượt nào" — và đó là hành vi đúng khi khớp mã CHỈ để ra giá
     vốn. Nay tab [Kích hoạt bảo hành] cần HÃNG của từng dòng ở mọi tháng, nên
     kỳ cũ phải được khớp mã. Cái phải giữ là ranh giới MỚI: khớp mã thì có,
     giá vốn thì không — và không một lượt hỏi `min-ngay` nào bị trả giá cho
     một kỳ chắc chắn không có giá. */
  {
    const hat = HAT();
    hat.bc.dong['2026-08'] = hat.bc.dong['2026-09'];
    daGoiTrk = [];
    TRK.xoaDem(); TRK.xoaDemMin();
    r = await goi('/api/don-hang?ky=2026-08', { hat });
    ok('kỳ 08/2026 vẫn ra bảng đơn', r.ma, 200);
    ok('  · và nói rõ là chưa có giá vốn', r.js.co_gia_von, false);

    /* CÓ kéo bảng giá về — đó là cả lý do của lượt sửa. */
    ok('  · CÓ kéo bảng giá về', daGoiTrk.some((g) => g.duong === '/api/xuat/board'), true);
    /* NHƯNG KHÔNG hỏi Min theo ngày: vài nghìn bản ghi cho một kỳ chắc chắn
       không có giá vốn là trả tiền cho một việc vô ích — đúng cái lo của bản
       trước, chỉ thu hẹp lại đúng phần còn vô ích. */
    ok('  · KHÔNG hỏi Min theo ngày lượt nào',
      daGoiTrk.some((g) => g.duong === '/api/min-ngay'), false);

    const dongCu = moiDong(r.js.bang);
    ok('  · có dựng bảng kê hàng chờ', Array.isArray(r.js.bang.tom_tat_ma.chua_khop), true);
    ok('  · dòng khớp được thì CÓ hãng', dongCu.some((d) => d.hang), true);
    ok('  · và có ngành hàng', dongCu.some((d) => d.nganh_hang), true);

    /* Ranh giới phải kín ở chiều còn lại: không một đồng giá vốn nào lọt vào
       kỳ cũ. Soi trên HÀNG THẬT — dòng chiết khấu gộp vốn mang `gia_nhap: 0`
       từ lúc dựng bảng, nó là một phép trừ chứ không phải món hàng phải tra
       giá. */
    const hangThat = dongCu.filter((d) => !d.la_chiet_khau && !d.la_phu_phi_co_dinh);
    ok('  · có hàng thật để soi', hangThat.length > 0, true);
    ok('  · và không dòng hàng nào có giá nhập',
      hangThat.some((d) => d.gia_nhap !== null && d.gia_nhap !== undefined), false);
    ok('  · cũng không dòng nào có lợi nhuận',
      hangThat.some((d) => d.loi_nhuan !== null && d.loi_nhuan !== undefined), false);
  }

  daGoiTrk = [];
  TRK.xoaDem(); TRK.xoaDemMin();
  r = await goi('/api/don-hang?ky=2026-09');
  ok('kỳ 09/2026 thì có giá vốn', r.js.co_gia_von, true);
  ok('  · và CÓ hỏi Min theo ngày',
    daGoiTrk.some((g) => g.duong === '/api/min-ngay'), true);

  /* CỬA LÙI, chạy thật chứ không dò chữ: dựng một Engine ĐÚNG NHƯ BẢN CŨ —
     chỉ có `kyCoKhopMa`, chưa có `kyCoGiaVon`. Đây là hình dạng Engine mà
     Gateway mới gặp trong khoảng hai Worker build song song (bẫy số 4), và
     nếu không lùi được thì mọi lượt mở bảng đơn khi ấy nổ 503 chứ không phải
     chạy chậm đi một chút. */
  {
    const eCu = engine();
    delete eCu.kyCoGiaVon;
    TRK.xoaDem(); TRK.xoaDemMin();
    gai(dungDb(HAT()), {});
    let rc;
    try {
      rc = await w.fetch(new Request('https://g.workers.dev/api/don-hang?ky=2026-09',
        { headers: { Authorization: 'Bearer ' + token('sep') } }),
        { ...ENV(), REPORT_ENGINE: eCu });
    } finally { globalThis.fetch = fetchThat; }
    ok('Engine bản CŨ (chưa có kyCoGiaVon) vẫn ra bảng đơn, không 503', rc.status, 200);
    ok('  · và vẫn trả lời đúng là kỳ này có giá vốn',
      (await rc.json()).co_gia_von, true);
  }

  /* ───────── F. Giá nhập theo ngày bán ───────── */

  console.log('\nF) Giá nhập theo ngày bán');

  const minCho = (gia) => ({
    records: [{ product_code: '65C6K', effective_date: '2026-09-08',
      min_price: gia, price_status: 'OK', day_status: 'FINAL',
      observed_on: '2026-09-08', carried_from: null }],
    errors: [],
  });

  r = await goi('/api/don-hang?ky=2026-09', { trk: { min: minCho(5250) } });
  {
    const d = moiDong(r.js.bang).find((x) => x.ma_san_pham === 'Tivi TCL 65C6K');
    /* Đơn vị đi qua trọn đường dây: Tracking đếm bằng NGHÌN đồng, bảng đơn
       đếm bằng ĐỒNG. Bài này canh đúng chỗ hai thang đo gặp nhau. */
    ok('min_price 5.250 (nghìn) tới màn hình là 5.250.000 đ', d.gia_nhap, 5250000);
    ok('  · và lợi nhuận tính từ đó', d.loi_nhuan, 9000000 - 5250000);
  }

  const luotMin = daGoiTrk.find((g) => g.duong === '/api/min-ngay');
  ok('có gọi POST /api/min-ngay', !!luotMin, true);
  ok('  · khoá đi ở header', luotMin.khoa, KHOA_BC);
  /* Hỏi trọn tháng của kỳ, không phải "hôm nay" — một đơn ngày 01/09 phải
     lấy giá của mốc 01/09, không phải giá của ngày tải file lên. */
  ok('  · hỏi đúng khoảng ngày của kỳ',
    [luotMin.than.date_from, luotMin.than.date_to], ['2026-09-01', '2026-09-30']);
  /* Chỉ hỏi mã ĐÃ KHỚP. Hỏi cả bảng giá là vượt trần 100 mã/trang của hợp
     đồng và kéo về hàng trăm nghìn bản ghi không ai dùng. */
  /* HAT() có hai dòng: một khớp được `65C6K`, một là câu văn xuôi không khớp
     mã nào. Nên tập hỏi đúng bằng MỘT mã — dòng chưa khớp không sinh ra một
     lượt hỏi giá vô nghĩa. */
  ok('  · chỉ hỏi những mã đã khớp được', luotMin.than.product_codes, ['65C6K']);

  /* Nguồn Min hỏng KHÔNG được biến thành giá 0. */
  r = await goi('/api/don-hang?ky=2026-09', { trk: { minHong: true } });
  ok('Min hỏng: bảng đơn vẫn ra', r.ma, 200);
  ok('  · kèm cờ nguồn hỏng', !!r.js.loi_nguon_ma, true);
  {
    const ds = moiDong(r.js.bang);
    ok('  · và KHÔNG dòng nào có giá nhập bịa ra',
      ds.some((x) => x.gia_nhap !== null && x.gia_nhap !== undefined), false);
  }

  /* Phân trang: hợp đồng trả tối đa 100 mã một trang. Bỏ trang sau là mất
     giá vốn của một phần mã mà bảng vẫn trông bình thường. */
  {
    let lan = 0;
    r = await goi('/api/don-hang?ky=2026-09', { trk: { min: (b) => {
      lan++;
      if (!b.cursor) return { records: [], errors: [], next_cursor: 'rev1:1' };
      return { records: minCho(5250).records, errors: [], next_cursor: null };
    } } });
    ok('đi hết mọi trang của min-ngay', lan, 2);
    ok('  · và gộp được bản ghi ở trang cuối',
      moiDong(r.js.bang).find((x) => x.ma_san_pham === 'Tivi TCL 65C6K').gia_nhap, 5250000);
  }

  /* 409 = Tracking cố ý từ chối cả trang thay vì trả một ảnh ghép của hai
     trạng thái database. Đúng việc phải làm là chờ rồi hỏi lại — báo lỗi ở
     đây là biến một cơ chế an toàn thành một sự cố trước mắt người dùng. */
  {
    let lan = 0;
    r = await goi('/api/don-hang?ky=2026-09', { trk: { min: (b) => {
      lan++;
      if (lan === 1) { const e = new Error('409'); e.ma409 = true; throw e; }
      return minCho(5250);
    } } });
    ok('409 thì THỬ LẠI, không báo lỗi ra màn hình', r.js.loi_nguon_ma, null);
    ok('  · và lấy được giá ở lượt sau',
      moiDong(r.js.bang).find((x) => x.ma_san_pham === 'Tivi TCL 65C6K').gia_nhap, 5250000);
  }

  xong();
})();
