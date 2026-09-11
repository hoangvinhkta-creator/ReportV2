/* Bộ xác minh danh tính của Gateway (src/auth.js) — sao lại đúng cách kiểm
 * đã chạy thật bên Tracking (kiem/gateway-xac-thuc.js): tự sinh một cặp
 * khoá RSA, tự chế token (cả hợp lệ lẫn tấn công), ném vào ĐÚNG hàm
 * xacMinhToken() thật, thay khoá công khai Google bằng khoá tự sinh. Chạy
 * được vì Node và Cloudflare Workers dùng chung WebCrypto.
 *
 * Phần RIÊNG của ReportV2 (không có bên Tracking): vaiBaoCao()/doiVaiBaoCao()
 * — hai vai quantri/quanly, đọc thẳng từ perms dùng chung.
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
  const KID = 'kid-cua-bai-kiem';

  let soLanLayKhoa = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('securetoken@system.gserviceaccount.com')) {
      soLanLayKhoa++;
      return new Response(JSON.stringify({
        keys: [{ kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwkPub.n, e: jwkPub.e }],
      }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
    }
    throw new Error('bài kiểm không cho gọi ra ngoài: ' + url);
  };

  const { xacMinhToken, vaiBaoCao, doiVaiBaoCao, LoiXacThuc, tokenTuHeader } =
    await import('file://' + path.join(GOC, 'src/auth.js'));

  const gio = Math.floor(Date.now() / 1000);
  const claimChuan = () => ({
    aud: DUAN, iss: 'https://securetoken.google.com/' + DUAN,
    sub: 'uid-nhan-vien-1', email: 'nv@tinphat.test',
    iat: gio - 10, auth_time: gio - 10, exp: gio + 3600,
  });

  function ky(claim, dau) {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT', ...(dau || {}) }));
    const c = b64u(JSON.stringify(claim));
    const s = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), privateKey);
    return h + '.' + c + '.' + b64u(s);
  }

  async function thu(token) {
    try { await xacMinhToken(token, DUAN); return 'OK'; }
    catch (e) { return e instanceof LoiXacThuc ? e.ly.split(':')[0] : 'LOI-LA:' + e.message; }
  }

  console.log('\n1) Token thật, đúng mọi thứ → phải qua');
  {
    const r = await xacMinhToken(ky(claimChuan()), DUAN);
    ok('nhận đúng uid từ claim `sub`', r.uid, 'uid-nhan-vien-1');
    ok('nhận đúng email', r.email, 'nv@tinphat.test');
  }

  console.log('\n2) HAI ĐÒN KINH ĐIỂN CỦA JWT — phải chặn cả hai');
  {
    const c = b64u(JSON.stringify(claimChuan()));
    const hNone = b64u(JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' }));
    ok('alg:"none" bị từ chối', await thu(hNone + '.' + c + '.'), 'alg-khong-cho-phep');

    const hHs = b64u(JSON.stringify({ alg: 'HS256', kid: KID, typ: 'JWT' }));
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
    const sig = b64u(crypto.createHmac('sha256', pubPem).update(hHs + '.' + c).digest());
    ok('HS256 ký bằng khoá công khai bị từ chối', await thu(hHs + '.' + c + '.' + sig),
       'alg-khong-cho-phep');
  }

  console.log('\n3) Chữ ký sai / khoá lạ');
  {
    const t = ky(claimChuan());
    const hong = t.slice(0, -6) + 'AAAAAA';
    ok('đổi một mẩu chữ ký → từ chối', await thu(hong), 'chu-ky-sai');

    const k2 = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
    const c = b64u(JSON.stringify(claimChuan()));
    const s = b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), k2.privateKey));
    ok('ký bằng khoá lạ → từ chối', await thu(h + '.' + c + '.' + s), 'chu-ky-sai');

    ok('kid không có trong danh sách → từ chối',
       await thu(ky(claimChuan(), { kid: 'kid-bia-ra' })), 'kid-khong-biet');
  }

  console.log('\n4) Claim sai — kiểm SAU khi chữ ký đã đúng');
  {
    ok('aud của dự án khác → từ chối',
       await thu(ky({ ...claimChuan(), aud: 'du-an-khac' })), 'aud-sai');
    ok('iss giả mạo → từ chối',
       await thu(ky({ ...claimChuan(), iss: 'https://ke-gian.example.com/' + DUAN })), 'iss-sai');
    ok('token đã hết hạn → từ chối',
       await thu(ky({ ...claimChuan(), exp: gio - 7200 })), 'token-het-han');
    ok('iat ở tương lai → từ chối',
       await thu(ky({ ...claimChuan(), iat: gio + 9999 })), 'iat-tuong-lai');
    ok('thiếu sub (không biết là ai) → từ chối',
       await thu(ky({ ...claimChuan(), sub: undefined })), 'thieu-sub');
  }

  console.log('\n5) Token rác / thiếu');
  {
    ok('không có token → từ chối', await thu(null), 'thieu-token');
    ok('chuỗi rỗng → từ chối', await thu(''), 'thieu-token');
    ok('không đủ ba phần → từ chối', await thu('abc.def'), 'token-sai-dinh-dang');
    ok('ba phần nhưng không giải mã được → từ chối',
       await thu('@@@.###.$$$'), 'token-giai-ma-hong');
  }

  console.log('\n6) Chỉ nhận đúng khuôn `Bearer <token>` ở header');
  {
    const h = (v) => tokenTuHeader(new Request('https://x.test/', { headers: v ? { Authorization: v } : {} }));
    ok('Bearer đúng khuôn', h('Bearer abc.def.ghi'), 'abc.def.ghi');
    ok('không có header → null', h(null), null);
    ok('thiếu chữ Bearer → null', h('abc.def.ghi'), null);
    ok('Basic auth → null', h('Basic dXNlcjpwdw=='), null);
  }

  console.log('\n7) Nhớ đệm khoá — không gọi Google mỗi request');
  {
    soLanLayKhoa = 0;
    for (let i = 0; i < 5; i++) await xacMinhToken(ky(claimChuan()), DUAN);
    ok('5 lượt xác minh chỉ lấy khoá tối đa 1 lần', soLanLayKhoa <= 1, true);
  }

  console.log('\n8) vaiBaoCao()/doiVaiBaoCao() — quantri bao trùm quanly, thiếu vai thì 403');
  {
    const thuVai = (perms) => {
      try { return { vai: doiVaiBaoCao({ perms }), loi: null }; }
      catch (e) { return { vai: null, loi: e.ma + ':' + e.ly }; }
    };
    ok('quantri:true → vai quantri', vaiBaoCao({ perms: { quantri: true } }), 'quantri');
    ok('quanly:true → vai quanly', vaiBaoCao({ perms: { quanly: true } }), 'quanly');
    ok('cả hai true → quantri thắng', vaiBaoCao({ perms: { quantri: true, quanly: true } }), 'quantri');
    ok('không có vai nào → null', vaiBaoCao({ perms: {} }), null);
    ok('không có perms → null', vaiBaoCao({}), null);

    ok('doiVaiBaoCao trả đúng vai', thuVai({ quanly: true }), { vai: 'quanly', loi: null });
    ok('doiVaiBaoCao 403 khi thiếu vai', thuVai({}), { vai: null, loi: '403:chua-co-quyen-bao-cao' });

    /* Client gửi "true" (chuỗi) thay vì true (boolean) — phải trượt. So sánh
       lỏng ở đây là mở cửa cho tự phong quyền, giống bẫy doiQuyen() bên
       Tracking đã canh. */
    ok('perms kiểu chuỗi KHÔNG được coi là true',
       vaiBaoCao({ perms: { quantri: 'true' } }), null);
    ok('perms.admin (quyền bên Tracking) KHÔNG tự động cấp vai báo cáo',
       vaiBaoCao({ perms: { admin: true } }), null);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
