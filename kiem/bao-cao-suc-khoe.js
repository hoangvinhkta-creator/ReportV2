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
    throw new Error('bài kiểm không cho gọi ra ngoài: ' + u);
  };

  const mod = await import('file://' + path.join(GOC, 'src/index.js'));
  const w = mod.default;
  const engineThat = await import('file://' + path.join(GOC, 'engine/src/gop-theo-thoi-gian.mjs'));

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
    REPORT_ENGINE: { gopSucKhoeCongTy: async (cayKy) => engineThat.gopSucKhoeCongTy(cayKy) },
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
    ok('có đủ nhóm kết quả Dashboard cần', Object.keys(than).sort(),
       ['cac_nam', 'hai_nam', 'theo_nam', 'theo_ngay', 'theo_ngay_thang', 'theo_quy', 'theo_thang', 'vi_tri_moi_nhat']);
    ok('theo_thang cộng đúng cả An và Bình tháng 08/2026', than.theo_thang[2026][8],
       { doanh_so: 1500, so_don: 7, khoa: '2026-08' });
    ok('theo_thang năm 2025 riêng, không lẫn 2026', than.theo_thang[2025][8],
       { doanh_so: 1000, so_don: 5, khoa: '2025-08' });
    ok('hai_nam giảm dần', than.hai_nam, [2026, 2025]);
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
    ok('theo_ngay rỗng', than.theo_ngay, {});
    ok('vi_tri_moi_nhat toàn null', than.vi_tri_moi_nhat, { ngay: null, thang: null, quy: null, nam: null });
    ok('theo_ngay_thang rỗng', than.theo_ngay_thang, {});
    ok('cac_nam rỗng', than.cac_nam, []);
    ok('hai_nam rỗng', than.hai_nam, []);
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

  console.log('\n9) Sai method → 405, đúng như mọi endpoint /api/ khác');
  {
    const r = await w.fetch(
      new Request('https://reportv2-gateway.workers.dev/api/bao-cao/suc-khoe', { method: 'POST' }), ENV_CO_FIREBASE);
    ok('POST bị chặn 405', r.status, 405);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
