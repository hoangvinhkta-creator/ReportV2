/* Đường tải sổ của Gateway (POST /api/tai-so, /api/hoan-tac) — CỬA CHẶN.
 *
 * Bộ này chạy Gateway THẬT, đầu đến cuối: token ký bằng khoá RSA tự sinh
 * (đúng cách `kiem/gateway-xac-thuc.js` làm), Engine thật nối qua Service
 * Binding giả, và Firebase là một cây trong bộ nhớ đứng sau một `fetch` giả
 * nói đúng REST API của RTDB. Không một dòng nào của `src/index.js` bị sửa
 * cho vừa bộ kiểm.
 *
 * Điều bộ này canh, và là điều duy nhất đáng canh ở đây: mỗi cửa chặn phải
 * chặn TRƯỚC KHI GHI. "Không ghi gì" được kiểm bằng NHẬT KÝ mọi lượt ghi,
 * không bằng niềm tin — ghi nửa chừng là để lại một kỳ nửa cũ nửa mới mà
 * không ai biết ranh giới ở đâu.
 */
const path = require('path');
const crypto = require('crypto');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');
const DUAN = 'tinphattracking';

const b64u = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwkPub = publicKey.export({ format: 'jwk' });
  const KID = 'kid-cua-bai-kiem';
  /* `src/firebase.js::fbToken()` KÝ THẬT bằng WebCrypto trước mỗi lượt chạm
     database, nên `FB_SA_KEY` phải là một khoá PKCS8 dùng được — đưa chuỗi
     giả vào thì nó ném, trả null, và mọi lượt đọc hoá 503 "thiếu service
     account" chứ không phải lỗi nghiệp vụ đang muốn kiểm. */
  const PEM_SA = privateKey.export({ type: 'pkcs8', format: 'pem' });

  /** Token hợp lệ cho một uid — chữ ký thật, khoá công khai do bài kiểm cấp. */
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

  /* ─── Firebase giả lập: cây trong bộ nhớ + nhật ký mọi lượt GHI ─── */
  function dungDb(hat) {
    const cay = JSON.parse(JSON.stringify(hat || {}));
    const daGhi = [];
    const tra = (duong) => {
      let v = cay;
      for (const doan of duong.split('/')) {
        if (v === null || typeof v !== 'object') return null;
        v = v[doan];
        if (v === undefined) return null;
      }
      return v === undefined ? null : v;
    };
    const dat = (duong, gt) => {
      const doan = duong.split('/');
      let v = cay;
      for (let i = 0; i < doan.length - 1; i++) {
        if (v[doan[i]] === null || typeof v[doan[i]] !== 'object') v[doan[i]] = {};
        v = v[doan[i]];
      }
      if (gt === null) delete v[doan[doan.length - 1]];
      else v[doan[doan.length - 1]] = gt;
    };
    return { cay, daGhi, tra, dat };
  }

  /** Những nhánh dữ liệu đã bị chạm vào — thứ dùng để chứng minh "không ghi gì". */
  const nhanhDaGhi = (db) => [...new Set(db.daGhi.map(g => g.duong.split('/').slice(0, 2).join('/')))].sort();

  const fetchThat = globalThis.fetch;
  /** `honKhiGhi(duong)` — trả `true` để bài kiểm GIẢ LẬP Firebase từ chối
   *  đúng lượt ghi vào đường đó (bất kể PUT/PATCH/DELETE), mô phỏng ca
   *  thật 11/09/2026: PATCH `bc/imei` bị Firebase trả về không phải 2xx. */
  function gai(db, honKhiGhi) {
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({
          keys: [{ kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwkPub.n, e: jwkPub.e }],
        }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
      }
      /* Lượt xin OAuth token của service account — `src/firebase.js` gọi
         trước mỗi lượt chạm database. */
      if (u.includes('oauth2') || u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'gia', expires_in: 3600 }),
          { headers: { 'content-type': 'application/json' } });
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
      if (honKhiGhi && honKhiGhi(duong)) return new Response('{"error":"gia lap loi"}', { status: 400 });
      const than = opt && opt.body ? JSON.parse(opt.body) : null;
      db.daGhi.push({ cach, duong });
      if (cach === 'PUT') db.dat(duong, than);
      else if (cach === 'DELETE') db.dat(duong, null);
      else if (cach === 'PATCH') for (const k of Object.keys(than || {})) db.dat(duong + '/' + k, than[k]);
      return new Response('', { status: 200 });
    };
  }

  /* `src/auth.js` xác minh chữ ký NGAY LÚC NẠP MODULE nào? Không — nhưng nó
     lấy khoá công khai qua `fetch`, nên `fetch` giả phải có mặt trước lượt
     gọi đầu tiên. Nạp Gateway sau khi đã gài. */
  gai(dungDb({}));
  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
  const S = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));
  const w = mod.default;
  globalThis.fetch = fetchThat;

  const engine = () => ({
    async phienBan() { return 'kiem'; },
    async xuLySoBanHang(bang) { return D.xuLySoBanHang(bang); },
    async phamViCayKy(c) { return D.phamViCayKy(c); },
    async kiemPhuSong(a, b) { return D.kiemPhuSong(a, b); },
    async doiChieuKy(a, b, c) { return D.doiChieuKy(a, b, c); },
    async dungBangDon(a, b, c, d) { return D.dungBangDon(a, b, c, d); },
    async tomTatLine(a, b) { return D.tomTatLine(a, b); },
    /* P4 — bộ này KHÔNG đặt `REPORT_API_KEY`, nên Gateway không gọi được
       Tracking và tự lùi về `dungBangDon()` trần. Đó chính là điều đáng canh
       ở đây: thiếu khoá thì đường tải sổ vẫn chạy trọn vẹn, không hỏng lây. */
    async kyCoKhopMa(ky) { return K.kyCoKhopMa(ky); },
    async dungBangDonSuaTay(a, b, c, d, qd) { return S.apDungSuaTay(D.dungBangDon(a, b, c, d), qd); },
    async maCanGiaVon(dong, n, ky) { return K.maCanGiaVon(dong, n, ky); },
  });

  const ENV = () => ({
    ASSETS: { fetch: async () => new Response('tĩnh') },
    REPORT_ENGINE: engine(),
    FB_SA_EMAIL: 'kiem@vi-du', FB_SA_KEY: PEM_SA,
    FB_DB_URL: 'https://kiem-default-rtdb.asia-southeast1.firebasedatabase.app',
  });

  const BANG_LINE = { thu_tu: ['Nội thành', 'Khác'], cua_ten: { 'Đức Hiệp': 'Nội thành' } };
  const HAT = () => ({
    profiles: {
      sep: { email: 'sep@tinphat.test', name: 'Sếp', vai: 'quantri' },
      sale: { email: 'sale@tinphat.test', name: 'Sale', vai: 'sale' },
    },
    bc: { quyetdinh: { line: BANG_LINE } },
  });

  /** Gọi Gateway như trình duyệt gọi. */
  async function goi(db, duong, tuyChon) {
    const o = tuyChon || {};
    gai(db, o.honKhiGhi);
    try {
      const h = { Authorization: 'Bearer ' + token(o.ai || 'sep') };
      if (o.than !== undefined) h['Content-Type'] = 'application/json';
      return await w.fetch(new Request('https://g.workers.dev' + duong, {
        method: o.cach || (o.than !== undefined ? 'POST' : 'GET'),
        headers: h,
        body: o.than === undefined ? undefined : JSON.stringify(o.than),
      }), ENV());
    } finally { globalThis.fetch = fetchThat; }
  }
  const doc = async (r) => ({ ma: r.status, than: await r.json().catch(() => ({})) });

  /* ─── Sổ giả lập, đúng bố cục sổ MISA thật ─── */
  const TIEU_DE = ['Ngày ', 'Số BH', 'Diễn giải', 'Tên hàng trên chứng từ ', 'Mã khách hàng',
    'Tên KH', 'Địa chỉ', 'ĐT di động (Người liên hệ)', 'SL', 'Đơn giá', 'Doanh số bán',
    'Chiết khấu', 'NVBH', 'Giao vận', 'Lương chuyến ', 'Trường mở rộng chi tiết 1', 'Lợi nhuận'];
  const TIEU_DE_PHU = ['Ngày hạch toán', 'Số chứng từ', 'Diễn giải chung', '', '', 'Tên khách hàng',
    '', '', 'Số lượng bán', '', '', '', 'Tên nhân viên bán hàng', '', '', '', ''];
  const dg = (o) => {
    const h = new Array(17).fill('');
    h[0] = o.ngay; h[1] = o.ct; h[3] = o.ten; h[5] = o.khach || ''; h[6] = o.dia_chi || '';
    h[7] = o.dt || ''; h[8] = o.sl ?? 1; h[9] = o.dg ?? 0; h[10] = o.ds ?? 0; h[11] = o.ck ?? 0;
    h[12] = o.nv || ''; h[15] = o.imei || '';
    return h;
  };
  const so = (dong) => [['SỔ CHI TIẾT BÁN HÀNG'], ['Tháng 9 năm 2026'], [], TIEU_DE, TIEU_DE_PHU, ...dong];

  const SO_CHUAN = so([
    dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: 1000, ds: 1000, ck: 100,
         nv: 'Đức Hiệp', khach: 'Chị Nga', dt: '0988456479', dia_chi: 'Ngõ 28', imei: 'IM1' }),
    dg({ ngay: '2026-09-05', ct: 'BH2', ten: 'Tủ lạnh', sl: 1, dg: 2000, ds: 2000,
         nv: 'Đức Hiệp', khach: 'Anh Long' }),
  ]);

  console.log('\n1) Ai được tải sổ');
  {
    const db = dungDb(HAT());
    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: SO_CHUAN }, ai: 'sale' }));
    ok('vai "sale" của Tracking KHÔNG được vào (chỉ quantri/quanly)', r.ma, 403);
    ok('và không ghi một nhánh nào', nhanhDaGhi(db), []);
  }
  {
    const db = dungDb(HAT());
    gai(db);
    const r = await w.fetch(new Request('https://g.workers.dev/api/tai-so',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), ENV());
    globalThis.fetch = fetchThat;
    ok('không token → 401', r.status, 401);
    ok('và không ghi một nhánh nào', nhanhDaGhi(db), []);
  }

  console.log('\n2) Lượt tải sạch — ghi đúng bốn nhánh, không hơn');
  {
    const db = dungDb(HAT());
    const r = await doc(await goi(db, '/api/tai-so', { than: { ten_file: 'so.xlsx', bang: SO_CHUAN } }));
    ok('trả 200', r.ma, 200);
    ok('có ghi', r.than.ghi, true);
    ok('chạm đúng bốn nhánh dữ liệu', nhanhDaGhi(db), ['bc/dong', 'bc/imei', 'bc/khach', 'bc/ky']);

    /* Kỳ đầu tiên của một nhánh trống thì KHÔNG lưu bản cũ — "quay lại bản
       trước" của một kỳ chưa từng tồn tại không có nghĩa gì, và ba ô lưu
       quý hơn thế. */
    ok('kỳ mới tinh thì không tạo bản lưu rỗng', db.tra('bc/backup'), null);

    ok('bc/ky giữ hạt (nhân viên, ngày) như P2',
       Object.keys(db.tra('bc/ky/2026-09/Đức Hiệp')).sort(), ['2026-09-02', '2026-09-05']);
    ok('doanh số đã trừ chiết khấu', db.tra('bc/ky/2026-09/Đức Hiệp/2026-09-02').doanh_so, 900);
    ok('bc/dong có đủ hai dòng hàng', Object.keys(db.tra('bc/dong/2026-09')).length, 2);
    ok('bc/khach khoá theo KỲ rồi mới tới số chứng từ',
       Object.keys(db.tra('bc/khach/2026-09')).sort(), ['BH1', 'BH2']);
    ok('bc/imei trỏ ngược về đơn', db.tra('bc/imei/IM1').so_ct, 'BH1');

    /* PII đi qua Gateway nhưng KHÔNG được đọng lại ở nhánh sai. */
    ok('bc/dong KHÔNG mang một chữ nào của khách',
       /Chị Nga|Anh Long|0988456479|Ngõ 28/.test(JSON.stringify(db.tra('bc/dong'))), false);

    ok('màn hình nhận đủ số để báo cáo lượt tải',
       [r.than.tom_tat.dong_tong, r.than.tom_tat.doanh_so_tong, r.than.tom_tat.so_don_tong], [2, 2900, 2]);
    ok('và nhận diễn biến từng kỳ', r.than.ky_da_ghi.map(k => [k.ky, k.la_ky_moi, k.doi_chieu.them]),
       [['2026-09', true, 2]]);
  }

  console.log('\n2b) bc/imei hỏng KHÔNG được chặn cả lượt tải — ca thật 11/09/2026');
  {
    /* Tái hiện đúng sự cố thật: tải sổ 08/2026, bc/ky + bc/dong + bc/khach
       ghi xong, nhưng Firebase từ chối PATCH bc/imei. Bản trước lượt sửa
       này NÉM 503 ở đây — người dùng thấy "chưa phục vụ được" và tưởng
       KHÔNG có gì được lưu, trong khi doanh số/đơn hàng/khách đã nằm trên
       Firebase. bc/imei là bảng tra phụ, chưa màn nào đọc tới — không
       được phép làm mất niềm tin vào phần đã ghi thành công. */
    const db = dungDb(HAT());
    const r = await doc(await goi(db, '/api/tai-so',
      { than: { bang: SO_CHUAN }, honKhiGhi: (d) => d === 'bc/imei' }));

    ok('vẫn trả 200, VẪN ghi (không ném 503 vì một bảng phụ hỏng)', [r.ma, r.than.ghi], [200, true]);
    ok('và nói rõ bảng IMEI không ghi được, kèm chi tiết lỗi',
       r.than.imei_loi, 'db-tu-choi:HTTP 400');
    ok('doanh số VẪN được ghi đầy đủ', db.tra('bc/ky/2026-09/Đức Hiệp/2026-09-02').doanh_so, 900);
    ok('dòng hàng VẪN được ghi đầy đủ', Object.keys(db.tra('bc/dong/2026-09')).length, 2);
    ok('khách VẪN được ghi đầy đủ', db.tra('bc/khach/2026-09/BH1').ten, 'Chị Nga');
    ok('chỉ riêng bc/imei là trống, đúng như Firebase đã từ chối', db.tra('bc/imei'), null);
  }

  console.log('\n3) Tải lại cùng kỳ — ĐÈ, không cộng dồn, và lưu bản cũ trước khi đè');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { ten_file: 'lan1.xlsx', bang: SO_CHUAN } });

    const lan2 = so([
      /* BH1 đổi giá, BH2 biến mất, BH3 mới. */
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: 1500, ds: 1500, ck: 100, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-07', ct: 'BH3', ten: 'Máy giặt', sl: 1, dg: 3000, ds: 3000, nv: 'Đức Hiệp' }),
    ]);
    const r = await doc(await goi(db, '/api/tai-so', { than: { ten_file: 'lan2.xlsx', bang: lan2 } }));
    ok('trả 200 và có ghi', [r.ma, r.than.ghi], [200, true]);

    const d = r.than.ky_da_ghi[0].doi_chieu;
    ok('đếm đúng thêm/đổi/mất', [d.them, d.doi, d.mat], [1, 1, 1]);
    ok('ĐÈ chứ không cộng dồn — chỉ còn hai dòng', Object.keys(db.tra('bc/dong/2026-09')).length, 2);
    ok('dòng biến mất bị xoá thẳng (chủ dự án chốt)',
       JSON.stringify(db.tra('bc/dong/2026-09')).includes('Tủ lạnh'), false);
    ok('bc/ky cũng bị đè trọn, ngày cũ không còn',
       Object.keys(db.tra('bc/ky/2026-09/Đức Hiệp')).sort(), ['2026-09-02', '2026-09-07']);

    const ban = db.tra('bc/backup/2026-09');
    ok('đã lưu đúng một bản cũ trước khi đè', Object.keys(ban).length, 1);
    const b = ban[Object.keys(ban)[0]];
    /* Nhãn nói đúng thứ bản lưu chứa: trạng thái TRƯỚC khi lan2.xlsx đè
       lên. Gọi nó là "file đã tạo ra bản này" là đọc ngược hẳn nghĩa —
       file đó (lan1.xlsx) không được lưu ở đâu cả. */
    ok('bản lưu ghi rõ ai tải và bị file nào đè lên',
       [b.boi, b.truoc_khi], ['sep@tinphat.test', 'lan2.xlsx']);
    ok('và giữ trọn trạng thái cũ để quay về được',
       JSON.stringify(b.dong).includes('Tủ lạnh'), true);

    /* `bc/khach/<kỳ>` ĐÈ TRỌN theo kỳ — cùng động tác với bc/ky, bc/dong.
       lan2 không ghi tên khách nào (BH1 đổi giá không kèm khách, BH3 mới
       cũng không), nên khách của lan1 (Chị Nga @ BH1, Anh Long @ BH2)
       KHÔNG còn sót lại — đè trọn kỳ không được để lại một khách mồ côi
       của dòng đã biến mất (BH2) hay đã đổi mà không còn khai khách lại. */
    ok('bc/khach/2026-09 đè trọn — không còn khách nào của lan1',
       db.tra('bc/khach/2026-09'), null);
  }

  console.log('\n4) Hoàn tác — quay về bản lưu, và bản hiện tại cũng được lưu trước');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { ten_file: 'lan1.xlsx', bang: SO_CHUAN } });
    /* Lần 2 phải PHỦ TRỌN khoảng ngày đang có (02/09→05/09), nếu không nó
       bị chính luật phủ sóng từ chối và bài này kiểm nhầm thứ khác. */
    await goi(db, '/api/tai-so', { than: { ten_file: 'lan2.xlsx', bang: so([
      dg({ ngay: '2026-09-02', ct: 'BH9', ten: 'Khác hẳn', sl: 1, dg: 5, ds: 5, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-05', ct: 'BH10', ten: 'Khác nữa', sl: 1, dg: 5, ds: 5, nv: 'Đức Hiệp' })]) } });
    ok('sau lần 2 chỉ còn hai dòng của file mới', Object.keys(db.tra('bc/dong/2026-09')).length, 2);
    ok('và dòng của lần 1 đã biến mất',
       JSON.stringify(db.tra('bc/dong/2026-09')).includes('Tivi'), false);
    /* lan2 không khai khách nào — bc/khach/2026-09 đè trọn về rỗng. */
    ok('khách của lần 1 (Chị Nga, Anh Long) không còn sau khi đè',
       db.tra('bc/khach/2026-09'), null);

    const ds = await doc(await goi(db, '/api/ban-luu?ky=2026-09'));
    ok('danh sách bản lưu có một bản', ds.than.ban.length, 1);
    /* Chỉ trả NHÃN, không trả nội dung: mỗi bản chứa trọn cây dòng của một
       kỳ (~390 KB trên sổ thật) mà màn hình chỉ cần biết lưu lúc nào. */
    ok('và chỉ trả nhãn, không kèm cả cây dòng', ds.than.ban[0].dong, undefined);

    const r = await doc(await goi(db, '/api/hoan-tac',
      { than: { ky: '2026-09', moc: ds.than.ban[0].moc } }));
    ok('hoàn tác xong', [r.ma, r.than.xong], [200, true]);
    ok('dữ liệu đã quay về lần 1',
       JSON.stringify(db.tra('bc/dong/2026-09')).includes('Tivi'), true);
    /* Hoàn tác phải trả CẢ khách, không chỉ doanh số/dòng hàng — thiếu nó
       thì bảng đơn hàng sau hoàn tác hiện tên khách của LƯỢT SAU (rỗng),
       trông như đã hoàn tác xong nhưng thật ra chỉ xong một nửa. */
    ok('khách cũng quay về đúng lần 1',
       db.tra('bc/khach/2026-09'), { BH1: { ten: 'Chị Nga', dien_thoai: '0988456479', dia_chi: 'Ngõ 28' },
                                      BH2: { ten: 'Anh Long', dien_thoai: '', dia_chi: '' } });
    ok('bản hiện tại được lưu trước khi quay, nên quay nhầm vẫn quay lại được',
       Object.keys(db.tra('bc/backup/2026-09')).length, 2);

    const hong = await doc(await goi(db, '/api/hoan-tac', { than: { ky: '2026-09', moc: 'khong-co-that-2026' } }));
    ok('mốc không tồn tại → nói thẳng, không nổ', [hong.ma, hong.than.xong], [200, false]);
  }

  console.log('\n5) Chỉ giữ BA bản lưu gần nhất (chủ dự án chốt)');
  {
    const db = dungDb(HAT());
    for (let i = 1; i <= 5; i++) {
      await goi(db, '/api/tai-so', { than: { ten_file: 'lan' + i + '.xlsx', bang: so([
        dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: i, ds: i, nv: 'Đức Hiệp' })]) } });
    }
    const ban = Object.keys(db.tra('bc/backup/2026-09') || {});
    ok('năm lượt tải để lại đúng ba bản', ban.length, 3);
    ok('và là ba bản MỚI NHẤT', ban.sort().slice(-3).length, 3);
  }

  console.log('\n6) Đối chiếu nội bộ lệch → KHÔNG GHI GÌ (script chạy tay chặn y hệt)');
  {
    /* Một chứng từ nằm ở hai nhân viên: cộng theo ô ra 2 đơn trong khi cả sổ
       chỉ có 1 chứng từ. Đây là ca `gopSoBanHang()` kêu `doi-chieu-noi-bo-lech`. */
    const db = dungDb(HAT());
    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', ds: 1000, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-03', ct: 'BH1', ten: 'Tủ lạnh', ds: 2000, nv: 'Mr Quý' })]) } }));
    ok('trả 200 nhưng KHÔNG ghi', [r.ma, r.than.ghi], [200, false]);
    ok('nói rõ vì sao', r.than.ly_do, 'doi-chieu-noi-bo-lech');
    ok('và KHÔNG chạm một nhánh dữ liệu nào', nhanhDaGhi(db), []);
  }

  console.log('\n7) File không phủ hết kỳ đang có → TỪ CHỐI CẢ LƯỢT');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', ds: 1000, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-28', ct: 'BH2', ten: 'Tủ lạnh', ds: 2000, nv: 'Đức Hiệp' })]) } });
    const truoc = JSON.stringify(db.tra('bc/ky/2026-09'));
    db.daGhi.length = 0;

    /* File mới chỉ có nửa cuối tháng. Cho ghi thì 02/09 biến mất lặng lẽ. */
    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-28', ct: 'BH2', ten: 'Tủ lạnh', ds: 2000, nv: 'Đức Hiệp' })]) } }));
    ok('trả 200 nhưng KHÔNG ghi', [r.ma, r.than.ghi], [200, false]);
    ok('nói rõ vì sao', r.than.ly_do, 'khong-phu-song');
    ok('và kể đúng kỳ nào thiếu', r.than.thieu.map(t => t.ky), ['2026-09']);
    ok('KHÔNG chạm nhánh nào', nhanhDaGhi(db), []);
    ok('dữ liệu cũ nguyên vẹn từng chữ', JSON.stringify(db.tra('bc/ky/2026-09')), truoc);
  }

  console.log('\n8) Kỳ vắng mặt trong file mới KHÔNG bị đụng — tải sổ T10 không xoá T9');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', ds: 1000, nv: 'Đức Hiệp' })]) } });
    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-10-03', ct: 'BH7', ten: 'Máy giặt', ds: 7000, nv: 'Đức Hiệp' })]) } }));

    ok('tháng 10 ghi mới, không cần phủ tháng 9', [r.ma, r.than.ghi], [200, true]);
    ok('tháng 9 còn nguyên', db.tra('bc/ky/2026-09/Đức Hiệp/2026-09-02').doanh_so, 1000);
    ok('tháng 10 đã có', db.tra('bc/ky/2026-10/Đức Hiệp/2026-10-03').doanh_so, 7000);
    ok('và không ai lưu bản cũ cho tháng 9', db.tra('bc/backup/2026-09'), null);
  }

  console.log('\n9) Một file phủ HAI kỳ — kỳ cũ đè, kỳ mới ghi (ví dụ 1/9–15/10 của chủ dự án)');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', ds: 1000, nv: 'Đức Hiệp', khach: 'Chị Nga' }),
      dg({ ngay: '2026-09-30', ct: 'BH2', ten: 'Tủ lạnh', ds: 2000, nv: 'Đức Hiệp', khach: 'Anh Long' })]) } });

    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: so([
      dg({ ngay: '2026-09-01', ct: 'BH1', ten: 'Tivi', ds: 1100, nv: 'Đức Hiệp', khach: 'Chị Nga' }),
      dg({ ngay: '2026-09-30', ct: 'BH2', ten: 'Tủ lạnh', ds: 2000, nv: 'Đức Hiệp', khach: 'Anh Long' }),
      dg({ ngay: '2026-10-15', ct: 'BH8', ten: 'Điều hoà', ds: 8000, nv: 'Đức Hiệp', khach: 'Chị Hạnh' })]) } }));

    ok('ghi được cả hai kỳ', r.than.ky_da_ghi.map(k => k.ky), ['2026-09', '2026-10']);
    ok('kỳ cũ là "đè", kỳ mới là "mới"', r.than.ky_da_ghi.map(k => k.la_ky_moi), [false, true]);
    ok('chỉ kỳ bị đè mới có bản lưu',
       [!!db.tra('bc/backup/2026-09'), !!db.tra('bc/backup/2026-10')], [true, false]);

    /* Cô lập THẬT: khách của kỳ này không đụng khách của kỳ kia — không
       chỉ bc/ky/bc/dong mà cả bc/khach cũng phải tách bạch. */
    ok('bc/khach/2026-09 chỉ có khách của tháng 9',
       Object.keys(db.tra('bc/khach/2026-09')).sort(), ['BH1', 'BH2']);
    ok('bc/khach/2026-10 chỉ có khách của tháng 10, KHÔNG lẫn khách tháng 9',
       Object.keys(db.tra('bc/khach/2026-10')), ['BH8']);
    ok('và đúng nội dung', db.tra('bc/khach/2026-10/BH8').ten, 'Chị Hạnh');
  }

  console.log('\n10) Sổ sai bố cục → báo lỗi cho người tải, KHÔNG trả bảng rỗng');
  {
    const db = dungDb(HAT());
    const r = await doc(await goi(db, '/api/tai-so', { than: { bang: [[], [], [], ['sai'], [], []] } }));
    ok('trả 200 nhưng không ghi', [r.ma, r.than.ghi], [200, false]);
    ok('nói rõ là bố cục sai', r.than.ly_do, 'so-khong-doc-duoc');
    ok('và câu cho người đọc nhắc đúng chuyện bố cục', /[Bb]ố cục/.test(r.than.cau), true);
    ok('KHÔNG chạm nhánh nào', nhanhDaGhi(db), []);
  }

  console.log('\n11) Màn đơn hàng đọc được đúng thứ vừa ghi');
  {
    const db = dungDb(HAT());
    await goi(db, '/api/tai-so', { than: { bang: SO_CHUAN } });

    const ky = await doc(await goi(db, '/api/ky-co-don'));
    ok('kỳ gom theo năm để dựng tab', ky.than.nam, { 2026: ['2026-09'] });

    const dh = await doc(await goi(db, '/api/don-hang?ky=2026-09&line=' + encodeURIComponent('Nội thành')));
    ok('trả 200', dh.ma, 200);
    ok('một ngày một đơn, đúng thứ tự ngày',
       dh.than.bang.ngay.map(n => [n.ngay, n.don.length]), [['2026-09-02', 1], ['2026-09-05', 1]]);

    const don1 = dh.than.bang.ngay[0].don[0];
    ok('đơn có chiết khấu được thêm đúng một dòng gộp', don1.dong.length, 2);
    ok('dòng chiết khấu mang dấu âm', don1.dong.find(d => d.la_chiet_khau).tong_ban, -100);
    ok('tổng đơn đã tính sẵn, khớp bc/ky', don1.tong_ban, db.tra('bc/ky/2026-09/Đức Hiệp/2026-09-02').doanh_so);

    /* Thông tin khách CHỈ đi qua đường này — `bc/khach` đóng với mọi vai. */
    ok('tên khách lấy được từ nhánh đóng', don1.ten_khach, 'Chị Nga');

    ok('tổng kỳ của bảng == tổng của bc/ky',
       dh.than.bang.tom_tat.doanh_so, 900 + 2000);

    const la = await doc(await goi(db, '/api/don-hang?ky=xx'));
    ok('kỳ sai định dạng → 400', la.ma, 400);
  }

  console.log('\n12) Xoá trọn một kỳ — cứu cho ca tải nhầm sổ, kỳ mới tinh không có bản lưu để hoàn tác');
  {
    const db = dungDb(HAT());

    const rong = await doc(await goi(db, '/api/xoa-ky', { than: { ky: '2026-09' } }));
    ok('kỳ chưa có dữ liệu → nói thẳng, không nổ, không ghi', [rong.ma, rong.than.xong], [200, false]);
    ok('không lưu bản rỗng nào', db.tra('bc/backup/2026-09'), null);

    await goi(db, '/api/tai-so', { than: { bang: SO_CHUAN } });
    ok('trước khi xoá: đủ cả ba nhánh', [!!db.tra('bc/ky/2026-09'), !!db.tra('bc/dong/2026-09'), !!db.tra('bc/khach/2026-09')],
       [true, true, true]);

    const r = await doc(await goi(db, '/api/xoa-ky', { than: { ky: '2026-09' } }));
    ok('xoá thành công', [r.ma, r.than.xong], [200, true]);
    ok('cả ba nhánh đều sạch', [db.tra('bc/ky/2026-09'), db.tra('bc/dong/2026-09'), db.tra('bc/khach/2026-09')],
       [null, null, null]);

    /* An toàn như mọi thao tác đè khác: xoá vẫn LƯU BẢN CŨ trước — cứu
       được qua chính /api/hoan-tac đã có, không cần đường cứu hộ riêng. */
    const ds = await doc(await goi(db, '/api/ban-luu?ky=2026-09'));
    ok('có đúng một bản lưu từ trước khi xoá', ds.than.ban.length, 1);
    ok('nhãn nói rõ vì sao lưu', ds.than.ban[0].truoc_khi, '(trước khi xoá kỳ)');

    const hoan = await doc(await goi(db, '/api/hoan-tac', { than: { ky: '2026-09', moc: ds.than.ban[0].moc } }));
    ok('hoàn tác cứu lại được kỳ vừa xoá', hoan.than.xong, true);
    ok('doanh số trở lại', db.tra('bc/ky/2026-09/Đức Hiệp/2026-09-02').doanh_so, 900);
    ok('khách trở lại', db.tra('bc/khach/2026-09/BH1').ten, 'Chị Nga');

    /* Kỳ sai định dạng, và người không đủ quyền — cùng luật với /api/tai-so. */
    const saiKy = await doc(await goi(db, '/api/xoa-ky', { than: { ky: 'xx' } }));
    ok('kỳ sai định dạng → nói thẳng, không nổ', [saiKy.ma, saiKy.than.xong], [200, false]);
    const khongQuyen = await doc(await goi(db, '/api/xoa-ky', { than: { ky: '2026-09' }, ai: 'sale' }));
    ok('vai "sale" không được xoá', khongQuyen.ma, 403);
  }

  console.log('\n13) Thứ tự bảng API_ROUTES — nhánh P2(b) chạy song song vẫn đứng yên');
  {
    const ma = require('fs').readFileSync(path.join(GOC, 'src/index.js'), 'utf8');
    for (const d of ['POST /api/tai-so', 'POST /api/hoan-tac', 'POST /api/xoa-ky', 'GET /api/ban-luu',
      'GET /api/ky-co-don', 'GET /api/don-hang']) {
      ok('bảng API_ROUTES có ' + d, ma.includes('["' + d + '"'), true);
    }
    /* ROADMAP.md dặn P3 chỉ THÊM vào cuối bảng, không sắp xếp lại — cả hai
       nhánh song song cùng thêm dòng vào đúng bảng này. */
    ok('đường của P1 vẫn đứng đầu', ma.indexOf('["GET /api/me"') < ma.indexOf('["POST /api/tai-so"'), true);
    ok('đường của P2(b) không bị dời xuống dưới đường P3',
       ma.indexOf('["GET /api/bao-cao/suc-khoe"') < ma.indexOf('["POST /api/tai-so"'), true);
  }

  xong();
})();
