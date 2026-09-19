/* TRÌNH PHÂN LOẠI THỦ CÔNG — đường dây Gateway → Engine → Firebase.
 *
 * `kiem/phan-loai.js` canh nghiệp vụ thuần. Bộ này chạy Gateway THẬT với
 * Firebase trong bộ nhớ và Tracking giả, và canh đúng phần còn lại: cái gì
 * được ghi xuống, ghi ở đâu, và cái gì bị từ chối.
 *
 * Năm chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. DANH SÁCH HÃNG THÀNH DANH SÁCH MỞ. CLAUDE.md cấm dựng bộ phân loại
 *     thương hiệu thứ hai. Một ô gõ tự do CHÍNH LÀ một danh sách thứ hai,
 *     chỉ là nó lớn lên mỗi lần một dòng mà không ai thấy. Chốt duy nhất
 *     giữ được luật ấy nằm ở PHÍA MÁY CHỦ — trình chọn thì sửa được bằng
 *     Console.
 *  B. CHỮ GHI XUỐNG LỆCH HOA THƯỜNG. "samsung" ghi nguyên là một hãng thứ
 *     mười một không có màu, đứng riêng một mảng cạnh Samsung thật trên
 *     biểu đồ cơ cấu. Chuỗi ghi xuống phải là chuỗi CHÍNH TẮC của bảng giá.
 *  C. GHI NHẦM CHỖ. Nhánh phải là `bc/quyetdinh/phan-loai/<khoá tên hàng>`
 *     — nhánh riêng, không bị lượt nhập sổ đè, khoá bền qua nhập lại.
 *  D. ĐÈ LÊN BẢNG GIÁ. Dòng đã có mã thì hãng/ngành đến từ bảng giá dùng
 *     chung của ba app; bảng tay không được đè lên.
 *  E. NGUỒN HỎNG TRẢ RỖNG. Tracking hỏng thì 503, không phải một trình chọn
 *     rỗng đọc lên thành "Tracking không có hãng nào" (CLAUDE.md).
 */
const path = require('path');
const crypto = require('crypto');
const { ok, xong, doc } = require('./khung');
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
      /* Ghi Firebase: bộ gan-ma chỉ trả 200 rồi thôi. Ở đây phải SOI được
         ghi xuống đâu và ghi cái gì — đó đúng là thứ bộ này canh. */
      daGhiFb.push({ duong, cach, than: opt && opt.body ? JSON.parse(opt.body) : null });
      return new Response('', { status: 200 });
    };
  }
  let daGhiFb = [];

  gai(dungDb({}));
  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  /* CÙNG một thể hiện module mà Gateway đang dùng (Node ESM gộp theo URL),
     nên `xoaDem()` ở đây xoá đúng bộ đệm Gateway đọc. */
  const TRK = await import('file://' + path.join(GOC, 'src/tracking.js'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
  const S = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));
  const PL = await import('file://' + path.join(GOC, 'engine/src/phan-loai.mjs'));
  const w = mod.default;
  globalThis.fetch = fetchThat;

  const engine = () => ({
    async phienBan() { return 'kiem'; },
    async tomTatLine(a, b) { return D.tomTatLine(a, b); },
    async dungBangDon(a, b, c, d) { return D.dungBangDon(a, b, c, d); },
    /* Mười sáu tham số, và phân loại tay là cái CUỐI — đúng chỗ bẫy số 4
       bắt nó phải nằm. Đếm bằng tay ở đây là cố ý: lệch một ô thì bài này
       đỏ, chứ không phải tới lúc nhìn thấy một cột NONE không chịu co. */
    async dungBangDonKemMa(a, b, c, d, n, ky, mn, qd, _kpi, _gd, _kt, _bc, _bo,
                           _nt, _mtd, qdPl) {
      const bang = K.khopMaChoBangDon(D.dungBangDon(a, b, c, d), n, ky);
      PL.apPhanLoaiTay(bang, qdPl);
      if (mn) K.dienGiaNhap(bang, mn);
      return S.apDungSuaTay(bang, qd);
    },
    async dungBangDonSuaTay(a, b, c, d, qd, _kpi, _gd, _ky, _kt, _bc, _bo,
                            _nt, _mtd, qdPl) {
      const bang = D.dungBangDon(a, b, c, d);
      PL.apPhanLoaiTay(bang, qdPl);
      return S.apDungSuaTay(bang, qd);
    },
    async mucPhanLoai(n) { return PL.mucPhanLoai(n); },
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
    daGoiTrk = []; daGhiFb = [];
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


  /* Mười hãng có cổng bảo hành + hai hãng của bảng giá giả — dùng để canh
     màn hình KHÔNG gõ cứng tên hãng nào. */
  const B = await import('file://' + path.join(GOC, 'engine/src/bao-hanh.mjs'));
  const B_HANG = B.HANG_BAO_HANH.concat(['TCL', 'Sharp']);

  const K_TCL = K.khoaTenHang('Tivi TCL 65C6K');
  const K_CHAN = K.khoaTenHang('Chân máy giặt Đa Năng - chiều');
  /* Hạt có sẵn MỘT quyết định phân loại tay, cho phần đọc bảng đơn. */
  const HAT_PL = (pl) => {
    const h = HAT();
    h.bc.quyetdinh['phan-loai'] = pl;
    return h;
  };

  console.log('\nE) GET /api/phan-loai/muc — danh sách từ bảng giá');
  {
    let r = await goi('/api/phan-loai/muc');
    ok('trả 200', r.ma, 200);
    ok('hãng lấy từ bảng giá', r.js.hang, ['Sharp', 'TCL']);
    ok('ngành hàng cũng vậy', r.js.nganh, ['Tivi', 'Tủ lạnh']);
    /* Danh sách trắng: KHÔNG kéo theo trường lạ của bảng giá. */
    ok('không rò trường lạ của bảng giá', r.chu.includes('gia_von_bi_mat'), false);
    ok('  · kể cả giá trị của nó', r.chu.includes('9999'), false);
    ok('khoá không rò ra trình duyệt', r.chu.includes(KHOA_BC), false);

    /* E — nguồn hỏng thì 503, KHÔNG trả danh sách rỗng. */
    r = await goi('/api/phan-loai/muc', { trk: { boardHong: true } });
    ok('bảng giá hỏng → 503, không trả rỗng', r.ma, 503);
    r = await goi('/api/phan-loai/muc', { trk: { chet: true } });
    ok('đứt mạng cũng 503', r.ma, 503);
    r = await goi('/api/phan-loai/muc', { trk: { board: {} } });
    ok('bảng giá RỖNG cũng là nguồn hỏng', r.ma, 503);

    /* Engine cũ (giữa hai lượt deploy song song — bẫy số 4) nói thẳng. */
    r = await goi('/api/phan-loai/muc', { env: { REPORT_ENGINE: {
      async phienBan() { return 'cu'; } } } });
    ok('Engine cũ chưa có cửa ấy → 503, không nổ 500', r.ma, 503);
    /* Mã lỗi nội bộ KHÔNG ra màn hình (CLAUDE.md) — nó đi vào nhật ký. */
    ok('  · và không lộ mã lỗi nội bộ', /engine-chua-co/.test(r.chu), false);
  }

  console.log('\nA+B+C) POST /api/phan-loai — ghi cái gì, ghi ở đâu');
  {
    let r = await goi('/api/phan-loai',
      { than: { khoa: K_CHAN, hang: 'Sharp', nganh: 'Tủ lạnh' } });
    ok('ghi được → 200', r.ma, 200);
    ok('  · và nói đã ghi', r.js.ghi, true);
    const ghi = daGhiFb.find((g) => g.duong.includes('quyetdinh/phan-loai'));
    /* C — nhánh RIÊNG, khoá là khoá tên hàng (bền qua lần nhập lại). */
    ok('ghi vào bc/quyetdinh/phan-loai/<khoá tên hàng>',
       ghi.duong, 'bc/quyetdinh/phan-loai/' + K_CHAN);
    ok('  · và ghi đúng hai trường', [ghi.than.hang, ghi.than.nganh], ['Sharp', 'Tủ lạnh']);
    ok('  · kèm người và lúc, để còn lần lại được',
       [typeof ghi.than.boi, typeof ghi.than.luc], ['string', 'object']);

    /* B — chuỗi ghi xuống là chuỗi CHÍNH TẮC của bảng giá, không phải chuỗi
       màn hình gửi lên. Lệch hoa thường là hai hãng, hai màu, hai mảng. */
    r = await goi('/api/phan-loai',
      { than: { khoa: K_CHAN, hang: 'sHaRp', nganh: 'tủ LẠNH' } });
    ok('gửi lệch hoa thường vẫn nhận', r.ma, 200);
    const g2 = daGhiFb.find((g) => g.duong.includes('quyetdinh/phan-loai'));
    ok('  · nhưng ghi xuống là chữ CHÍNH TẮC của bảng giá',
       [g2.than.hang, g2.than.nganh], ['Sharp', 'Tủ lạnh']);
    ok('  · và dội lại cho màn hình cũng vậy',
       [r.js.hang, r.js.nganh], ['Sharp', 'Tủ lạnh']);

    /* A — giá trị NGOÀI bảng giá bị chặn ở máy chủ. */
    r = await goi('/api/phan-loai',
      { than: { khoa: K_CHAN, hang: 'Hãng Tự Gõ', nganh: 'Tủ lạnh' } });
    ok('hãng ngoài bảng giá → 400', r.ma, 400);
    ok('  · và KHÔNG ghi gì', daGhiFb.filter((g) => g.duong.includes('phan-loai')).length, 0);
    /* Ca này người dùng TỰ SỬA ĐƯỢC, nên câu trả về phải nói được việc phải
       làm — không phải câu chung "Dữ liệu gửi lên không hợp lệ". */
    ok('  · và câu nói được bước tiếp theo', /Bảng giá/.test(r.js.loi), true);
    r = await goi('/api/phan-loai',
      { than: { khoa: K_CHAN, hang: 'Sharp', nganh: 'Ngành Tự Gõ' } });
    ok('ngành ngoài bảng giá → 400', r.ma, 400);
    ok('  · và KHÔNG ghi gì', daGhiFb.filter((g) => g.duong.includes('phan-loai')).length, 0);

    /* Một nửa quyết định vẫn là một quyết định. */
    r = await goi('/api/phan-loai', { than: { khoa: K_CHAN, hang: 'Sharp' } });
    ok('chỉ hãng thôi vẫn ghi được', r.ma, 200);
    ok('  · ngành để null, KHÔNG bịa', r.js.nganh, null);

    /* Khoá phải đúng khuôn Engine dựng — màn hình không tự dựng khoá. */
    for (const [ten, k] of [['rỗng', ''], ['không có tiền tố', 'ABC'],
                            ['có ký tự lạ', 'N_ABC/../hack'],
                            ['chữ thường', 'N_abc']]) {
      r = await goi('/api/phan-loai', { than: { khoa: k, hang: 'Sharp' } });
      ok('khoá ' + ten + ' → 400', r.ma, 400);
      ok('  · và không ghi gì', daGhiFb.filter((g) => g.duong.includes('phan-loai')).length, 0);
    }

    /* Rút lại = XOÁ hẳn, không ghi hai ô rỗng. */
    r = await goi('/api/phan-loai', { than: { khoa: K_CHAN, hang: null, nganh: null } });
    ok('rút lại → 200', r.ma, 200);
    const gx = daGhiFb.find((g) => g.duong.includes('quyetdinh/phan-loai'));
    ok('  · và là lượt XOÁ, không phải ghi hai ô rỗng', gx.cach, 'DELETE');
    ok('  · rút lại KHÔNG cần hỏi Tracking',
       daGoiTrk.filter((g) => g.duong.includes('xuat')).length, 0);

    /* E — Tracking hỏng thì KHÔNG ghi bừa một giá trị chưa đối chiếu. */
    r = await goi('/api/phan-loai',
      { than: { khoa: K_CHAN, hang: 'Sharp' }, trk: { boardHong: true } });
    ok('Tracking hỏng → 503, không ghi bừa', r.ma, 503);
    ok('  · và KHÔNG ghi gì', daGhiFb.filter((g) => g.duong.includes('phan-loai')).length, 0);
  }

  console.log('\nD) Bảng đơn — áp quyết định, nhưng mã bảng giá luôn thắng');
  {
    /* `Chân máy giặt…` không khớp mã nào (đó là cả lý do đường này tồn tại);
       `Tivi TCL 65C6K` thì khớp ra mã và lấy hãng từ bảng giá. */
    const r = await goi('/api/don-hang?ky=2026-09', { hat: HAT_PL({
      [K_CHAN]: { hang: 'Sharp', nganh: 'Tủ lạnh' },
      [K_TCL]: { hang: 'Sharp', nganh: 'Tủ lạnh' },
    }) });
    ok('bảng đơn ra bình thường', r.ma, 200);
    const ds = moiDong(r.js.bang);
    const chan = ds.find((d) => d.ma_san_pham.startsWith('Chân'));
    const tcl = ds.find((d) => d.ma_san_pham.startsWith('Tivi'));

    ok('dòng KHÔNG có mã nhận phân loại tay', [chan.hang, chan.nganh_hang],
       ['Sharp', 'Tủ lạnh']);
    ok('  · và mang cờ để màn hình phân biệt được', chan.phan_loai_tay, true);
    /* D — bảng giá là nguồn dùng chung của ba app; bảng tay không đè lên. */
    ok('dòng CÓ mã vẫn lấy hãng từ bảng giá', tcl.hang, 'TCL');
    ok('  · kể cả ngành hàng', tcl.nganh_hang, 'Tivi');
    ok('  · và KHÔNG bị dán cờ phân loại tay', tcl.phan_loai_tay, undefined);

    /* Tracking hỏng: phép khớp mã không chạy, nhưng quyết định của NGƯỜI
       không có lý do gì phải biến mất theo. */
    const r2 = await goi('/api/don-hang?ky=2026-09', {
      hat: HAT_PL({ [K_CHAN]: { hang: 'Sharp', nganh: 'Tủ lạnh' } }),
      trk: { boardHong: true },
    });
    ok('Tracking hỏng: bảng đơn vẫn ra', r2.ma, 200);
    ok('  · kèm cờ nguồn hỏng', !!r2.js.loi_nguon_ma, true);
    const chan2 = moiDong(r2.js.bang).find((d) => d.ma_san_pham.startsWith('Chân'));
    ok('  · và phân loại tay VẪN áp', chan2.hang, 'Sharp');

    /* Nhánh quyết định chưa có gì thì bảng vẫn ra, không nổ. */
    const r3 = await goi('/api/don-hang?ky=2026-09');
    ok('chưa có quyết định nào: bảng vẫn ra', r3.ma, 200);
    ok('  · và hai cột nhãn để trống, không bịa',
       moiDong(r3.js.bang).find((d) => d.ma_san_pham.startsWith('Chân')).hang, null);
  }

  console.log('\nF) Màn hình — LUẬT SỐ 1, và dây nối vào bảng đơn');
  {
    const FE = doc('public/phan-loai.js');
    const DH = doc('public/don-hang.js');
    const HTML = doc('public/index.html');
    const sach = (m) => m.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const FE_SACH = sach(FE);

    /* A lần nữa, ở phía màn hình: không có một luật phân loại nào ở đây.
       Không đoán hãng từ tên hàng, không so gần đúng, không danh sách gõ
       cứng — danh sách đến từ `/api/phan-loai/muc`, tức từ bảng giá. */
    ok('màn hình hỏi danh sách qua /api/phan-loai/muc',
       /\/api\/phan-loai\/muc/.test(FE), true);
    ok('  · mọi fetch đều vào /api/', [...FE.matchAll(/fetch\(\s*['"`]([^'"`]+)/g)]
       .map((d) => d[1]).filter((d) => !d.startsWith('/api/')), []);
    ok('  · KHÔNG gõ cứng tên hãng nào',
       B_HANG.some((h) => new RegExp('["\'`]' + h + '["\'`]').test(FE_SACH)), false);
    ok('  · và không có phép so gần đúng nào',
       /levenshtein|khoangCach|tuongTu|fuzzy/i.test(FE_SACH), false);
    /* Khoá do Engine dựng và đi kèm ô; màn hình KHÔNG tự dựng khoá. */
    ok('  · không tự dựng khoá tên hàng',
       /normalize\(|replace\(\/\[\^A-Z0-9\]/.test(FE_SACH), false);
    ok('  · mà gửi lại đúng chuỗi khoá của ô', /khoa,$|khoa, hang, nganh/.test(FE), true);

    /* Chuỗi ghi vào ô phải là chuỗi MÁY CHỦ dội lại (đã quy về chính tắc),
       không phải chuỗi vừa chọn trên màn: lệch hoa thường là hai hãng. */
    ok('vá ô bằng chuỗi máy chủ dội lại',
       /khiXong\(js\.hang \|\| null, js\.nganh \|\| null\)/.test(FE), true);

    /* Dây nối vào bảng đơn — và ba trạng thái của ô nhãn. */
    ok('index.html nạp phan-loai.js',
       /<script src="\/phan-loai\.js"><\/script>/.test(HTML), true);
    ok('don-hang mở trình phân loại từ ô Hãng / Ngành hàng',
       /window\.PhanLoai\.moPhanLoai\(/.test(DH), true);
    ok('  · chỉ khi ô có khoá tên hàng', /tdN\.dataset\.khoa/.test(DH), true);
    /* D ở phía màn hình: dòng ĐÃ có mã thì hai ô không bấm được — sửa chúng
       ở đây là dựng bản thứ hai đè lên bảng giá dùng chung. */
    ok('  · dòng CÓ mã thì không mở được',
       /if \(d\.ma_bang_gia\) \{[\s\S]{0,200}?return td;/.test(DH), true);
    /* Vá TẠI CHỖ, không vẽ lại bảng (giữ lời hứa "không nhảy dòng"). */
    ok('  · và vá tại chỗ mọi dòng cùng khoá',
       /function vaPhanLoaiTheoKhoa/.test(DH), true);
    ok('  · không vẽ lại bảng sau khi ghi',
       /vaPhanLoaiTheoKhoa\(khoaN, hang, nganh\)/.test(DH), true);
    /* Dòng đã phân loại TAY phải trông khác nhãn đến từ bảng giá. */
    ok('CSS phân biệt được nhãn gán tay', /\.oNhanTay\b/.test(HTML), true);
    ok('  · và ô bấm được có con trỏ tay', /\.oNhanBamDuoc[^{]*\{[^}]*cursor: pointer/.test(HTML), true);

    /* Trình chọn ngành là SELECT cố định; hãng là ô gõ ra gợi ý (chủ dự án
       chốt 19/09/2026). Hai kiểu khác nhau, có lý do: ngành vài chục mục
       nên chọn thẳng nhanh hơn, hãng thì dài hơn nhiều. */
    ok('ngành hàng là trình chọn cố định', /el\("select", "chonNganhPhanLoai"\)/.test(FE), true);
    ok('hãng là ô gõ ra gợi ý', /oTim\.addEventListener\("input", veHang\)/.test(FE), true);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
