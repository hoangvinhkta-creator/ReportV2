/* KỲ CHƯA TỚI — mở khoá tab tháng 10, 11, 12 (chủ dự án chốt 19/09/2026).
 *
 * "Tab tháng chưa đến hãy unlock cho tôi, bảng tổng hợp ghi rõ (Số liệu cùng
 * kì năm trước) […] để khi cần tôi có thể xem được xu hướng sắp tới."
 *
 * Bộ này canh năm chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. GHI VÀO MỘT KỲ CHƯA TỚI. Đây là cái đắt nhất và nó hỏng trong im
 *     lặng: một quyết định sửa tay ghi vào `bc/quyetdinh/dong/2026-12` nằm
 *     im ở đó cho tới khi tháng 12 về, rồi bất ngờ áp lên sổ thật. Màn hình
 *     đã ẩn hết nút, nhưng màn hình thì sửa được bằng Console — chốt phải ở
 *     Gateway.
 *  B. SỐ NĂM TRƯỚC ĐỘI LỐT SỐ THÁNG NÀY. Bảng tiền mà người đọc tưởng là
 *     của tháng đang mở thì mọi con số trong đó đều sai theo một cách không
 *     nhìn ra được. Phải có băng chữ, và `ky` / `ky_so_lieu` phải là hai
 *     trường riêng.
 *  C. THÁNG ĐANG DIỄN RA BỊ XẾP NHẦM. Sổ tháng 9 mới đổ một nửa vẫn là số
 *     THẬT; thay nó bằng số năm ngoái là nói dối về tháng đang bán. Lệch
 *     múi giờ 7 tiếng là chỗ dễ hỏng nhất.
 *  D. THÁNG ĐÃ QUA MÀ CHƯA CÓ SỔ CŨNG BỊ MỞ. Ở đó "chưa tải lên" là một
 *     việc còn nợ, và hiện số năm ngoái là giấu mất việc ấy.
 *  E. BIỂU ĐỒ CƠ CẤU BÁO TRỐNG. Kỳ chưa tới thì `nay` không có đồng nào,
 *     nên nếu vẫn lấy `nay` làm mẫu số thì biểu đồ báo "chưa có dòng hàng
 *     nào" đúng vào lúc nó có đủ số để vẽ.
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
      daGhiFb.push({ duong, cach });
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
  const C = await import('file://' + path.join(GOC, 'engine/src/co-cau.mjs'));
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


  /* Giờ VIỆT NAM, đúng công thức Gateway dùng (`kyHomNay`). Tính ra chứ
     không gõ cứng: một bộ kiểm gõ cứng "2026-10" sẽ tự đúng hôm nay rồi tự
     sai vào tháng sau, và sai theo kiểu không ai đọc ra. */
  const kyVN = (lechThang) => {
    const t = new Date(Date.now() + 7 * 3600 * 1000);
    const m = t.getUTCFullYear() * 12 + t.getUTCMonth() + (lechThang || 0);
    return Math.floor(m / 12) + '-' + String((m % 12) + 1).padStart(2, '0');
  };
  const NAY = kyVN(0);
  const KY_TL = kyVN(1);               // tháng sau — "chưa tới"
  const KY_TL_NGUON = (Number(KY_TL.slice(0, 4)) - 1) + '-' + KY_TL.slice(5, 7);
  const KY_QUA = kyVN(-25);            // đã qua, và chắc chắn không có sổ

  /* Hạt: sổ nằm ở CÙNG KỲ NĂM TRƯỚC của tháng chưa tới, không ở tháng nào
     khác — nhờ thế "bảng có số" chứng minh được đúng một điều: Gateway đã
     đi lấy đúng kỳ ấy. */
  const HAT_TL = () => {
    const h = HAT();
    h.bc.dong[KY_TL_NGUON] = {
      k1: dong({ ct: 'BH7', ten: 'Tivi TCL 65C6K', tien: 7000000 }),
    };
    return h;
  };

  console.log('\nB) GET /api/don-hang kỳ chưa tới → số của CÙNG KỲ NĂM TRƯỚC');
  {
    const r = await goi('/api/don-hang?ky=' + KY_TL, { hat: HAT_TL() });
    ok('mở được, không 400', r.ma, 200);
    /* B — hai trường RIÊNG. Một trường nhập nhằng là chỗ màn hình đọc nhầm. */
    ok('`ky` vẫn là kỳ người dùng hỏi', r.js.ky, KY_TL);
    ok('  · và `ky_so_lieu` nói số đến từ đâu', r.js.ky_so_lieu, KY_TL_NGUON);
    ok('  · kèm cờ để màn hình treo băng chữ', r.js.la_ky_tuong_lai, true);
    /* A — và cờ đóng mọi đường ghi trên màn hình. */
    ok('  · và cờ chỉ-đọc', r.js.chi_doc, true);
    ok('bảng CÓ số, lấy từ kỳ năm trước', r.js.bang.tom_tat.doanh_so, 7000000);

    /* C — tháng ĐANG diễn ra không bị xếp nhầm, dù sổ mới đổ một nửa. */
    const r2 = await goi('/api/don-hang?ky=' + NAY, { hat: HAT_TL() });
    ok('tháng đang diễn ra KHÔNG bị thay nguồn', r2.js.la_ky_tuong_lai, undefined);
    ok('  · và không bị khoá ghi', r2.js.chi_doc, undefined);

    /* Kỳ đã qua vẫn là kỳ thường — bảng rỗng, không thay nguồn. */
    const r3 = await goi('/api/don-hang?ky=' + KY_QUA, { hat: HAT_TL() });
    ok('kỳ đã qua KHÔNG bị thay nguồn', r3.js.la_ky_tuong_lai, undefined);
  }

  console.log('\nA) Mọi đường GHI vào kỳ chưa tới đều bị chặn ở GATEWAY');
  {
    /* Màn hình đã ẩn hết nút, nhưng màn hình thì sửa được bằng Console. Đây
       là chốt thật — và nó phải chặn TRƯỚC khi chạm Firebase. */
    const duong = [
      ['/api/sua-dong', { ky: KY_TL, khoa: 'BH1|X|1', gia_nhap: 1000, line: null }],
      ['/api/dat-cong', { ky: KY_TL, line: 'Nội thành', ngay_cong: 26 }],
      ['/api/bonus', { ky: KY_TL, so_ct: 'BH1', tien: 50000, ly_do: 'KHBH' }],
      ['/api/sheet-link', { ky: KY_TL, line: 'Nội thành', link: 'https://x' }],
      ['/api/day-sheet', { ky: KY_TL, line: 'Nội thành' }],
    ];
    for (const [d, than] of duong) {
      const r = await goi(d, { than, hat: HAT_TL() });
      ok(d + ' vào kỳ chưa tới → 400', r.ma, 400);
      ok('  · và KHÔNG ghi gì xuống Firebase',
         daGhiFb.filter((g) => g.cach !== 'GET').length, 0);
      /* Người dùng tự hiểu được vì sao — không phải câu chung "Dữ liệu gửi
         lên không hợp lệ". */
      ok('  · và câu nói rõ vì sao', /chưa tới/.test(r.js.loi || ''), true);
    }

    /* Cùng đường ấy, kỳ THẬT thì vẫn đi được — chốt không được chặn nhầm. */
    const r = await goi('/api/sua-dong',
      { than: { ky: NAY, khoa: 'BH1|X|1', gia_nhap: 1000, line: null }, hat: HAT_TL() });
    ok('kỳ đang diễn ra vẫn ghi được bình thường', r.ma !== 400, true);
  }

  console.log('\nE) Biểu đồ cơ cấu — chỉ cột năm trước');
  {
    const d = (n, h, ds) => ({ nganh_hang: n, hang: h, tong_ban: ds, so_luong: 1,
      la_chiet_khau: false, la_phu_phi_co_dinh: null });
    const b = (ds) => ({ ngay: [{ ngay: 'x', don: [{ so_ct: '1', dong: ds }] }] });

    const r = C.coCauNganhHang(b([]), b([d('Tivi', 'Sony', 100)]));
    ok('kỳ này rỗng + năm trước có số → chi_ky_truoc', r.chi_ky_truoc, true);
    /* Cột vẫn phải dựng ĐỦ, không thì màn hình không có gì để vẽ. */
    ok('  · và cột của năm trước có số thật',
       r.theo_doanh_so.truoc.cot.map((x) => x.gia_tri), [100]);

    ok('cả hai kỳ có số → KHÔNG bật',
       C.coCauNganhHang(b([d('Tivi', 'LG', 50)]), b([d('Tivi', 'Sony', 100)])).chi_ky_truoc,
       false);
    /* Khác hẳn "chưa có sổ năm trước để so" — hai câu, màn hình vẽ hai thứ. */
    ok('không có sổ năm trước → KHÔNG bật (đó là ca khác)',
       C.coCauNganhHang(b([d('Tivi', 'LG', 50)]), null).chi_ky_truoc, false);
    ok('  · cả hai cùng rỗng cũng KHÔNG bật',
       C.coCauNganhHang(b([]), b([])).chi_ky_truoc, false);
  }

  console.log('\nD+F) Màn hình — mở nút tháng nào, và khoá những gì');
  {
    const DH = doc('public/don-hang.js');
    const FE = doc('public/co-cau.js');
    const HTML = doc('public/index.html');

    /* D — CHỈ tháng chưa tới mới mở; tháng đã qua mà chưa có sổ vẫn khoá. */
    ok('nút tháng chưa tới mở được', /const chuaToi = !co && ky > moc;/.test(DH), true);
    ok('  · tháng đã qua chưa có sổ vẫn khoá',
       /nut\.disabled = !co && !chuaToi;/.test(DH), true);
    ok('  · và trông khác tháng có sổ thật', /\.tabChuaToi\b/.test(HTML), true);

    /* B — băng chữ ở CẢ tab Tổng hợp lẫn tab line. Tab line mới là nơi có
       cột tiền từng dòng, tức chỗ đọc nhầm tháng thì đắt nhất. */
    ok('có băng "Số liệu cùng kỳ năm trước"',
       /Số liệu cùng kỳ năm trước/.test(DH), true);
    ok('  · dựng ở tab Tổng hợp', /const bangTl = bangKyTuongLai\(kq\);\s*\n\s*if \(bangTl\) ve\.appendChild/.test(DH), true);
    ok('  · và ở tab của một line', /if \(bangTl\) khung\.appendChild/.test(DH), true);

    /* A ở phía màn hình: không mời người dùng bấm một cái nút sẽ báo lỗi. */
    ok('cờ chỉ-đọc đặt từ phản hồi máy chủ', /chiDoc = !!kq\.chi_doc;/.test(DH), true);
    for (const [ten, re] of [
      ['nút Sửa / Xoá', /kq\.co_gia_von !== false\s*\n?\s*&& !chiDoc/],
      ['ô gán mã', /if \(chiDoc\) return td;\s*\n\s*\n\s*td\.dataset\.o = "ma"/],
      ['ô phân loại', /if \(chiDoc\) return td;   \/\/ kỳ chưa tới/],
      ['nút bonus', /if \(!laQuanTri\(\) \|\| chiDoc\)/],
      ['tick gia dụng', /const duoc = laQuanTri\(\) && !chiDoc;/],
      ['ô ngày công', /const duocNhap = laQuanTri\(\) && !chiDoc;/],
      ['dải đẩy Sheet', /if \(!laQuanTri\(\) \|\| chiDoc\) return;/],
    ]) {
      ok('  · khoá ' + ten, re.test(DH), true);
    }

    /* E ở phía màn hình: mọi chỗ hỏi "bộ số đang vẽ" phải đi qua MỘT cửa —
       sót một chỗ là thẻ bên phải nói về một tháng trống trong khi cột bên
       trái vẽ năm trước. */
    /* Biểu đồ SỨC KHOẺ không cần sửa gì để vẽ đúng — kỳ chưa tới thì
       `diemNay` rỗng và nó tự chỉ vẽ đường xám. Thứ PHẢI sửa là chú giải:
       kể tên một đường không hề có trên hình là mời người đọc đi tìm nó. */
    const SK = doc('public/suc-khoe.js');
    ok('chú giải không kể tên đường không được vẽ',
       /coNay === false/.test(SK), true);
    ok('  · và nó biết có vẽ đường năm nay hay không',
       /diemTruoc\.length > 0, diemNay\.length > 0\)/.test(SK), true);

    ok('biểu đồ có một cửa duy nhất cho bộ số đang vẽ', /function boChinh|const boChinh/.test(FE), true);
    ok('  · và không chỗ nào còn đọc thẳng theo_doanh_so.nay',
       /theo_doanh_so\.nay/.test(FE.replace(/\/\*[\s\S]*?\*\//g, ' ')
         .replace(/const boChinh[^\n]*\n/, ' ')), false);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
