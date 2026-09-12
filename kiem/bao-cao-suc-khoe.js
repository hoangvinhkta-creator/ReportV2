/* Endpoint /api/bao-cao/suc-khoe — "màn mở" (P2(b) bước 1). Kiểm CẢ đường
 * dây thật: xác thực → phân quyền → đọc bc/ky qua src/firebase.js (giả
 * fetch tới database, không đụng Firebase thật) → gọi ĐÚNG hàm Engine thật
 * (engine/src/gop-theo-thoi-gian.mjs, không phải bản giả) → trả JSON.
 *
 * Giả `fetch` toàn cục theo ba chặng, mô phỏng đúng cách kiem/gateway-xac-
 * thuc.js đã làm cho JWK: (1) JWK Google để ký/kiểm token đăng nhập, (2)
 * oauth2.googleapis.com/token để đổi service-account key ra access token,
 * (3) chính Realtime Database — trả JSON khác nhau theo đường dẫn được gọi.
 */
const { ok, xong } = require('./khung');
const crypto = require('crypto');
const path = require('path');
const GOC = path.resolve(__dirname, '..');
const DUAN = 'tinphattracking';

const b64u = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwkPub = publicKey.export({ format: 'jwk' });
  const KID = 'kid-cua-bai-kiem-suc-khoe';

  // Khoá riêng của "tài khoản dịch vụ" giả — chỉ cần import được bằng
  // WebCrypto (fbToken() tự ký JWT bằng khoá này), KHÔNG cần ai kiểm chữ ký
  // đó trong bài kiểm này vì lượt đổi token đã bị giả ở fetch.
  const saPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const FB_SA_KEY = saPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  // Cây bc/ky giả, hai năm, đủ để đối chiếu tổng qua Engine thật.
  const CAY_KY = {
    '2025-08': { An: { '2025-08-10': { doanh_so: 1000, so_don: 5 } } },
    '2026-08': {
      An: { '2026-08-10': { doanh_so: 1200, so_don: 6 } },
      Binh: { '2026-08-31': { doanh_so: 300, so_don: 1 } },
    },
  };
  const HO_SO_QUANLY = { vai: 'quanly', email: 'ql@tinphat.test', name: 'Quản Lí' };
  const HO_SO_KHONG_VAI = { email: 'nv@tinphat.test' };

  let hoSoDangDung = HO_SO_QUANLY;
  let choBcKyLoi = false;
  let choBcKyRong = false;
  let choBangLineLoi = false;
  let choBangLineThieu = false;

  /* Bảng line nhỏ, đủ phủ hai tên nhân viên của CAY_KY. KHÔNG dùng bảng hạt
     giống thật để bài kiểm không đỏ mỗi lần chủ dự án thêm một nhân viên. */
  const BANG_LINE = {
    thu_tu: ['Nội thành', 'Shopee', 'Khác'],
    cua_ten: { An: 'Nội thành', Binh: 'Nội thành' },
  };

  /* Một dòng 200 đ của An trong ngày 10/08/2026, và một quyết định xoá nó.
     Đủ để chứng minh biểu đồ trừ theo — đúng lời hứa "xoá thì trừ ở CẢ HAI". */
  let coXoaTay = false;
  const DONG_08 = {
    'BH1|Tivi|0': { nhan_vien: 'An', ngay: '2026-08-10', so_ct: 'BH1',
      ten_hang: 'Tivi', so_luong: 1, don_gia: 200, doanh_so: 200, chiet_khau: 0 },
  };
  const QUYET_DINH = { 'BH1|Tivi|0': { xoa: true, boi: 'sep@tinphat.test' } };

  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('securetoken@system.gserviceaccount.com')) {
      return new Response(JSON.stringify({
        keys: [{ kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwkPub.n, e: jwkPub.e }],
      }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
    }
    if (u.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'tok-gia', expires_in: 3600 }),
        { headers: { 'content-type': 'application/json' } });
    }
    if (u.includes('/profiles/')) {
      return new Response(JSON.stringify(hoSoDangDung), { status: 200 });
    }
    if (u.includes('/bc/ky.json')) {
      if (choBcKyLoi) return new Response('loi', { status: 500 });
      return new Response(JSON.stringify(choBcKyRong ? null : CAY_KY), { status: 200 });
    }
    if (u.includes('/bc/quyetdinh/line.json')) {
      if (choBangLineLoi) return new Response('loi', { status: 500 });
      return new Response(JSON.stringify(choBangLineThieu ? null : BANG_LINE), { status: 200 });
    }
    /* P5 — đường Dashboard hỏi "kỳ nào có quyết định sửa tay" (đọc NÔNG),
       rồi chỉ kỳ nào thật sự có lệnh XOÁ mới kéo `bc/dong` của kỳ ấy về. */
    if (u.includes('/bc/quyetdinh/dong.json')) {
      return new Response(JSON.stringify(coXoaTay ? { '2026-08': true } : null),
        { status: 200 });
    }
    if (u.includes('/bc/quyetdinh/dong/2026-08.json')) {
      return new Response(JSON.stringify(coXoaTay ? QUYET_DINH : null), { status: 200 });
    }
    if (u.includes('/bc/dong/2026-08.json')) {
      return new Response(JSON.stringify(coXoaTay ? DONG_08 : null), { status: 200 });
    }
    throw new Error('bài kiểm không cho gọi ra ngoài: ' + u);
  };

  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  const w = mod.default;
  const engineThat = await import('file://' + path.join(GOC, 'engine/src/gop-theo-thoi-gian.mjs'));
  const lineThat = await import('file://' + path.join(GOC, 'engine/src/line.mjs'));
  const suaTayThat = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));
  const gopThat = await import('file://' + path.join(GOC, 'engine/src/gop-ban-hang.mjs'));

  const gio = Math.floor(Date.now() / 1000);
  function tokenChuan(uid) {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
    const c = b64u(JSON.stringify({
      aud: DUAN, iss: 'https://securetoken.google.com/' + DUAN,
      sub: uid || 'uid-quanly-1', email: 'ql@tinphat.test',
      iat: gio - 10, auth_time: gio - 10, exp: gio + 3600,
    }));
    const s = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), privateKey);
    return h + '.' + c + '.' + b64u(s);
  }

  const ENV_CO_FIREBASE = {
    ASSETS: { fetch: async () => new Response('DA-ROI-XUONG-ASSETS', { headers: { 'Content-Type': 'text/html' } }) },
    FB_SA_EMAIL: 'sa@tinphat.test.iam.gserviceaccount.com',
    FB_SA_KEY,
    /* Gọi ĐÚNG hàm Engine thật, không phải bản giả — bài kiểm này canh cả
       chỗ nối giữa Gateway và Engine, không chỉ phần định tuyến. */
    REPORT_ENGINE: {
      gopSucKhoeCongTy: async (cayKy) => engineThat.gopSucKhoeCongTy(cayKy),
      gopLineTheoThoiGian: async (cayKy, bang) => lineThat.gopLineTheoThoiGian(cayKy, bang),
      /* P5 — đường Dashboard trừ phần đã xoá tay ra khỏi `bc/ky` trước khi
         gộp. Bộ này không dựng quyết định nào nên phần trừ luôn rỗng; điều
         đáng canh ở đây là đường ấy KHÔNG làm hỏng lượt đọc bình thường. */
      truVaoCayKy: async (cay, tru) => suaTayThat.truVaoCayKy(cay, tru),
      tinhTruDaXoa: async (dong, qd) => suaTayThat.tinhTruDaXoa(dong, qd, gopThat.khoaNhanVien),
    },
  };

  const goi = (env, duong, headers) => w.fetch(
    new Request('https://reportv2-gateway.workers.dev' + duong, { headers }), env);
  const goiCoToken = (env, duong, uid) => goi(env, duong, { Authorization: 'Bearer ' + tokenChuan(uid) });

  console.log('\n1) Chưa đăng nhập → 401, không đụng Firebase');
  {
    const r = await goi(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('không có token → 401', r.status, 401);
  }

  console.log('\n2) Đăng nhập rồi nhưng không có vai báo cáo → 403');
  {
    hoSoDangDung = HO_SO_KHONG_VAI;
    const r = await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('hồ sơ thiếu vai → 403', r.status, 403);
    const than = await r.json();
    ok('403 không lộ mã lỗi nội bộ', than.ly, undefined);
  }

  console.log('\n3) Có vai quanly, bc/ky đọc được, Engine thật chạy được → 200 đúng số');
  {
    hoSoDangDung = HO_SO_QUANLY;
    choBcKyLoi = false; choBcKyRong = false;
    const r = await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('quanly → 200', r.status, 200);
    const than = await r.json();
    ok('có đủ nhóm kết quả Dashboard cần, KHÔNG còn ba field cũ (theo_ngay/theo_nam/hai_nam)',
       Object.keys(than).sort(),
       ['cac_nam', 'line', 'theo_ngay_thang', 'theo_quy', 'theo_thang', 'vi_tri_moi_nhat']);
    ok('phần xếp hạng có đủ line theo thứ tự bảng', than.line.thu_tu, ['Nội thành', 'Shopee', 'Khác']);
    ok('Nội thành gộp cả An lẫn Bình, năm 2026', than.line.theo_nam['Nội thành'][2026],
       { doanh_so: 1500, so_don: 7 });
    ok('Shopee chưa có dòng nào → vẫn có mặt, rỗng', than.line.theo_nam.Shopee, {});
    /* Bất biến quan trọng nhất của phần này: cộng mọi line == tổng công ty.
       Lệch là có tiền rơi ra ngoài mọi line mà nhìn bảng không cách nào biết. */
    ok('cộng mọi line == tổng công ty', than.line.tom_tat.khop_tong, true);
    ok('theo_thang cộng đúng cả An và Bình tháng 08/2026', than.theo_thang[2026][8],
       { doanh_so: 1500, so_don: 7, khoa: '2026-08' });
    ok('theo_thang năm 2025 riêng, không lẫn 2026', than.theo_thang[2025][8],
       { doanh_so: 1000, so_don: 5, khoa: '2025-08' });
  }

  console.log('\n4) quantri cũng dùng được (hai vai đều hợp lệ, không riêng quanly)');
  {
    hoSoDangDung = { vai: 'quantri', email: 'qt@tinphat.test' };
    const r = await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('quantri → 200', r.status, 200);
  }

  console.log('\n5) bc/ky đọc lỗi → 503, KHÔNG trả cây rỗng giả làm "chưa có đơn nào"');
  {
    hoSoDangDung = HO_SO_QUANLY;
    choBcKyLoi = true;
    const r = await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('bc/ky lỗi → 503', r.status, 503);
    const than = await r.json();
    ok('503 không lộ mã lỗi nội bộ', than.ly, undefined);
    ok('503 vẫn có câu tử tế cho người dùng', typeof than.loi, 'string');
    choBcKyLoi = false;
  }

  console.log('\n6) bc/ky rỗng (chưa nhập sổ bao giờ) → vẫn 200, cây kết quả rỗng, không ném');
  {
    choBcKyRong = true;
    const r = await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe');
    ok('bc/ky null → vẫn 200', r.status, 200);
    const than = await r.json();
    ok('vi_tri_moi_nhat toàn null', than.vi_tri_moi_nhat, { ngay: null, thang: null, quy: null, nam: null });
    ok('theo_ngay_thang rỗng', than.theo_ngay_thang, {});
    ok('cac_nam rỗng', than.cac_nam, []);
    choBcKyRong = false;
  }

  console.log('\n7) Engine ném lỗi (bảng méo) → 503, không lộ chi tiết');
  {
    const envEngineHong = { ...ENV_CO_FIREBASE, REPORT_ENGINE: { gopSucKhoeCongTy: async () => { throw new Error('be-tung-noi-bo'); } } };
    const r = await goiCoToken(envEngineHong, '/api/bao-cao/suc-khoe');
    ok('Engine ném lỗi → 503', r.status, 503);
    const than = await r.json();
    ok('không lộ "be-tung-noi-bo" ra ngoài', JSON.stringify(than).includes('be-tung-noi-bo'), false);
  }

  console.log('\n8) Thiếu Service Binding Engine → 503, không rơi xuống 500 mù mờ');
  {
    const envThieuEngine = { ...ENV_CO_FIREBASE, REPORT_ENGINE: undefined };
    const r = await goiCoToken(envThieuEngine, '/api/bao-cao/suc-khoe');
    ok('thiếu REPORT_ENGINE → 503', r.status, 503);
  }

  console.log('\n8b) Bảng line hỏng → 503 CẢ endpoint, không lặng lẽ bỏ riêng phần xếp hạng');
  {
    /* Bảng line là thứ người sửa tay trên Firebase Console. Sai mà vẫn trả
       200 kèm một bảng xếp hạng thiếu line thì không ai biết là đang đọc số
       thiếu — đúng cái CLAUDE.md cấm ("Nguồn hỏng thì BÁO LỖI"). */
    hoSoDangDung = HO_SO_QUANLY;
    choBangLineLoi = true;
    ok('đọc bảng line lỗi → 503', (await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe')).status, 503);
    choBangLineLoi = false;

    choBangLineThieu = true;
    ok('thiếu hẳn bảng line → 503', (await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe')).status, 503);
    choBangLineThieu = false;

    const envLineHong = {
      ...ENV_CO_FIREBASE,
      REPORT_ENGINE: {
        ...ENV_CO_FIREBASE.REPORT_ENGINE,
        gopLineTheoThoiGian: async () => { throw new Error('bang-line-khong-hop-le'); },
      },
    };
    const r = await goiCoToken(envLineHong, '/api/bao-cao/suc-khoe');
    ok('Engine từ chối bảng line → 503', r.status, 503);
    ok('không lộ mã lỗi nội bộ ra ngoài',
       JSON.stringify(await r.json()).includes('bang-line-khong-hop-le'), false);
  }

  console.log('\n8b) Dòng đã XOÁ TAY bị trừ khỏi biểu đồ — không chỉ khỏi bảng đơn');
  {
    hoSoDangDung = HO_SO_QUANLY;
    choBcKyLoi = false; choBcKyRong = false; choBangLineLoi = false; choBangLineThieu = false;

    coXoaTay = false;
    const truoc = await (await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe')).json();
    coXoaTay = true;
    const sau = await (await goiCoToken(ENV_CO_FIREBASE, '/api/bao-cao/suc-khoe')).json();

    /* Chủ dự án chốt 12/09/2026: xoá một dòng thì trừ ở CẢ HAI. Bảng đơn đọc
       `bc/dong`, biểu đồ đọc `bc/ky`; trừ một bên là hai màn hình nói hai con
       số cho cùng một tháng và không ai biết bên nào đúng. */
    const t08 = (x) => x.theo_thang[2026][8];
    ok('trước khi xoá: tháng 8/2026 đủ số', t08(truoc).doanh_so, 1500);
    ok('sau khi xoá 200 đ: biểu đồ TRỪ THEO', t08(sau).doanh_so, 1300);
    ok('  · và số đơn giảm một (chứng từ không còn dòng nào)',
       t08(truoc).so_don - t08(sau).so_don, 1);
    /* Line phải trừ theo cùng một con số — nếu không thì tổng công ty và
       tổng các line lệch nhau, đúng thứ bất biến `gopTheoLine` canh. */
    ok('bảng xếp hạng line cũng trừ theo',
       truoc.line.theo_nam['Nội thành'][2026].doanh_so
       - sau.line.theo_nam['Nội thành'][2026].doanh_so, 200);
    coXoaTay = false;
  }

console.log('\n9) Sai method → 405, đúng như mọi endpoint /api/ khác');
  {
    const r = await w.fetch(
      new Request('https://reportv2-gateway.workers.dev/api/bao-cao/suc-khoe', { method: 'POST' }), ENV_CO_FIREBASE);
    ok('POST bị chặn 405', r.status, 405);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
