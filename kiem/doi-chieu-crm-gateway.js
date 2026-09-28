/* ĐỐI CHIẾU CRM — phía Gateway (`src/crm.js`), 28/09/2026.
 *
 *  A. THÔNG TIN KHÁCH CỦA CRM KHÔNG ĐI QUA. Tên, SĐT, địa chỉ khách dừng ở
 *     Gateway — danh sách TRẮNG, nên trường mới bên CRM tự bị bỏ lại.
 *  B. THIẾU SECRET / THIẾU INDEX PHẢI THÀNH LỖI CÓ TÊN, không thành "không
 *     có đơn CRM nào" (CLAUDE.md: nguồn hỏng thì báo lỗi, không trả rỗng).
 *  C. TRA ĐÚNG PROJECT, ĐÚNG TÀI KHOẢN. Token của CRM không được đè token
 *     của Tracking trong bộ nhớ đệm.
 *  D. DẤU VÂN ỔN ĐỊNH — cùng dữ liệu cùng dấu, để lượt hỏi mỗi phút trả
 *     `khong_doi` thay vì dựng lại cả bảng.
 */
const path = require('path');
const crypto = require('crypto');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const C = await import('file://' + path.join(GOC, 'src/crm.js'));
  const PEM = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' });

  console.log('\nA) locDon — chỉ trường cần để so, không một chữ nào về khách');
  {
    const d = C.locDon({ misa: 'BH1', owner: 'ly', status: 'done', discount: 5,
      cusName: 'Chị Lan', cusPhone: '0900', cusAddr: 'Hà Nội', addr: 'x', note: 'giao sáng',
      customer: 'c1', lines: [{ item: 'X1', qty: 1, unitPrice: 2, unitCost: 1,
        misaName: 'Tivi', supplier: 'NCC A', pgroup: 'g' }] });
    ok('giữ trường so sánh', [d.misa, d.owner, d.status, d.discount], ['BH1', 'ly', 'done', 5]);
    ok('bỏ tên/SĐT/địa chỉ/ghi chú/khách', ['cusName', 'cusPhone', 'cusAddr', 'addr', 'note', 'customer']
      .filter((k) => k in d), []);
    ok('dòng hàng cũng chỉ giữ trường cần', Object.keys(d.lines[0]).sort(),
       ['item', 'misaName', 'qty', 'unitCost', 'unitPrice']);
    ok('mảng thưa dạng đối tượng vẫn đọc đúng thứ tự',
       C.locDon({ lines: { 1: { item: 'B' }, 0: { item: 'A' } } }).lines.map((l) => l.item), ['A', 'B']);
  }

  console.log('\nB) Lỗi có tên');
  {
    let ly = null;
    try { await C.docDonCrm({}, { co: true, khoang: [], tu: 0, den: 1 }); }
    catch (e) { ly = e instanceof C.LoiCrm ? e.ly : 'loai-khac'; }
    ok('thiếu secret → crm-thieu-service-account', ly, 'crm-thieu-service-account');
    ok('kỳ không đối chiếu → không gọi mạng, không lỗi',
       (await C.docDonCrm({}, { co: false })).dau, 'khong-ap-dung');
  }

  /* Firebase giả: ghi lại mọi URL, trả theo truy vấn. */
  const goi = [];
  const DON = {
    o1: { misa: 'BH74545', owner: 'ly', status: 'done', expectDeliver: 5, cusPhone: '0900' },
    o2: { misa: '', owner: 'kien', status: 'done', created: 7 },
    o3: { misa: '', owner: 'kien', status: 'done', created: 7, expectDeliver: 999999 },
  };
  let loiIndex = false;
  global.fetch = async (url, opt) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      return { ok: true, json: async () => ({ access_token: 'tok-crm', expires_in: 3600 }) };
    }
    const u = new URL(url);
    goi.push({ url: String(url), auth: opt && opt.headers && opt.headers.Authorization });
    if (u.pathname.endsWith('/users.json')) {
      return { ok: true, status: 200, json: async () => ({ ly: { name: 'Ly', email: 'ly@x', role: 'staff' } }) };
    }
    const ob = JSON.parse(u.searchParams.get('orderBy'));
    if (loiIndex && ob === 'misa') return { ok: false, status: 400, json: async () => ({}) };
    const ra = {};
    if (ob === 'misa') ra.o1 = DON.o1;
    if (ob === 'created') { ra.o2 = DON.o2; ra.o3 = DON.o3; }
    return { ok: true, status: 200, json: async () => ra };
  };
  const ENV = { CRM_SA_EMAIL: 'sa@crm', CRM_SA_KEY: PEM };
  const KH = { co: true, khoang: [['BH74545', 'BH74600']], tu: 1, den: 100 };

  console.log('\nC) Tra đúng project, đúng truy vấn');
  {
    const kq = await C.docDonCrm(ENV, KH);
    ok('mọi lượt đi về project CRM', goi.every((g) => g.url.startsWith(C.CRM_DB_MAC_DINH)), true);
    ok('mang token của tài khoản CRM', goi.every((g) => g.auth === 'Bearer tok-crm'), true);
    const u = new URL(goi.find((g) => /orderBy=%22misa%22/.test(g.url)).url);
    ok('tra theo khoảng số BH', [u.searchParams.get('startAt'), u.searchParams.get('endAt')],
       ['"BH74545"', '"BH74600"']);
    ok('đơn tìm theo số BH có mặt', !!kq.don.o1, true);
    ok('  · đã lọc SĐT khách', 'cusPhone' in kq.don.o1, false);
    ok('tra theo created chỉ nhận đơn KHÔNG có ngày giao', [!!kq.don.o2, !!kq.don.o3], [true, false]);
    ok('người chỉ mang TÊN, không email', kq.nguoi, { ly: 'Ly' });

    const kq2 = await C.docDonCrm(ENV, KH);
    ok('D) cùng dữ liệu → cùng dấu vân', kq2.dau, kq.dau);
    DON.o1.discount = 10;
    ok('D) CRM đổi một con số → dấu vân đổi', (await C.docDonCrm(ENV, KH)).dau !== kq.dau, true);
  }

  console.log('\nB2) Rules CRM chưa có .indexOn → lỗi nói đúng việc phải làm');
  {
    loiIndex = true;
    let ly = null;
    try { await C.docDonCrm(ENV, KH); } catch (e) { ly = e.ly; }
    ok('400 ở lượt orderBy → crm-thieu-index', ly, 'crm-thieu-index');
  }

  console.log('\nE) Route mới có mặt và đi qua boc(true, …)');
  {
    const GW = doc('src/index.js');
    ok('khai trong API_ROUTES', /\["GET \/api\/doi-chieu-crm", layDoiChieuCrm\]/.test(GW), true);
    ok('đòi vai báo cáo', /const layDoiChieuCrm = boc\(true,/.test(GW), true);
    ok('Gateway không ghi gì sang CRM', /method:\s*"(PUT|PATCH|POST|DELETE)"/.test(doc('src/crm.js')), false);
  }

  xong();
})();
