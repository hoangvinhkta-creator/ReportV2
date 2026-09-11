/* Canh hàm gộp dùng chung của P2 (`engine/src/gop-ban-hang.mjs`) — hàm mà P4
 * sẽ gọi lại cho dữ liệu tải lên sống. Nó sai thì cả chuỗi thời gian trên
 * biểu đồ P3 sai, và sai im lặng: một con số vẫn hiện ra, chỉ là con số khác.
 *
 * Dữ liệu ở đây là BỊA HOÀN TOÀN — không có ô nào của sổ thật, không tên,
 * không SĐT, không địa chỉ khách. Bộ kiểm chạy trong CI công khai được.
 */
const { ok, xong } = require('./khung');

/* Dựng một "sheet" tối thiểu ĐÚNG bố cục sổ thật: hàng 1 tên báo cáo, hàng 2
 * khoảng ngày, hàng 3 trống, hàng 4 tiêu đề, hàng 5 tiêu đề phụ, dữ liệu từ
 * hàng 6. Bố cục này chính là thứ `kiemBoCuc()` canh, nên nếu ai đổi neo
 * tiêu đề mà quên đổi ở đây thì bộ kiểm đỏ — đúng ý muốn. */
function soMau(dong) {
  const h4 = [];
  h4[0] = 'Ngày '; h4[1] = 'Số BH'; h4[10] = 'Doanh số bán'; h4[12] = 'NVBH';
  const h5 = [];
  h5[1] = 'Số chứng từ'; h5[12] = 'Tên nhân viên bán hàng';
  return [['SỔ CHI TIẾT BÁN HÀNG'], ['Từ ngày 01/01/2026 đến ngày '], [], h4, h5, ...dong];
}

/** Một dòng bán: chỉ đặt những cột P2 thật sự đọc. */
function dongBan({ ngay, so_ct, sl = 1, dg = 0, ds, ck = 0, nv }) {
  const h = [];
  h[0] = ngay; h[1] = so_ct; h[8] = sl; h[9] = dg;
  h[10] = ds === undefined ? sl * dg : ds;
  h[11] = ck; h[12] = nv;
  return h;
}

(async () => {
const G = await import('../engine/src/gop-ban-hang.mjs');

console.log('\n1) Bố cục sổ — sai thì NỔ, không lặng lẽ trả số rỗng');
{
  ok('sổ đúng bố cục: không neo nào lệch', G.kiemBoCuc(soMau([])), []);

  /* Ca thật hay gặp nhất: ai đó đọc hàng 1 làm tiêu đề (mặc định của mọi
     thư viện đọc bảng). Khi đó cột 12 không còn là nhân viên. */
  const lech = G.kiemBoCuc([[], [], [], ['x'], ['y']]);
  ok('bố cục sai: kể đủ 6 neo lệch', lech.length, 6);
  ok('neo cột 12 hàng 4 nằm trong danh sách lệch',
     lech.some(l => l.hang === 4 && l.cot === 12 && l.mong === 'nvbh'), true);

  let ma = null;
  try { G.gopSoBanHang([[], [], [], [], []]); } catch (e) { ma = e.ma; }
  ok('gopSoBanHang NÉM LỖI khi bố cục sai', ma, 'bo-cuc-khong-khop');

  let ma2 = null;
  try { G.gopSoBanHang(null); } catch (e) { ma2 = 'nem'; }
  ok('gopSoBanHang ném lỗi khi không phải ma trận', ma2, 'nem');

  ok('cột nhân viên vẫn ở vị trí 12 (khớp raw_reader.py của V1)', G.COT.nhan_vien, 12);
  ok('dữ liệu bắt đầu từ hàng 6', G.HANG_DAU_DU_LIEU, 6);
}

console.log('\n2) Một số chứng từ là MỘT đơn, dù có bao nhiêu dòng hàng');
{
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 1000, nv: 'An' }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 2000, nv: 'An' }),  // cùng đơn
    dongBan({ ngay: '2026-01-02', so_ct: 'BH2', dg: 3000, nv: 'An' }),
  ]));
  ok('3 dòng / 2 chứng từ → 2 đơn',
     r.ky['2026-01']['An']['2026-01-02'].so_don, 2);
  ok('doanh số cộng theo DÒNG, không theo đơn',
     r.ky['2026-01']['An']['2026-01-02'].doanh_so, 6000);
  ok('tổng số đơn của cả sổ', r.tom_tat.so_don_tong, 2);
  ok('không có cảnh báo nào', r.canh_bao, []);
}

console.log('\n3) Tách theo (kỳ, nhân viên, ngày) — đúng hình dạng bc/ky');
{
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-31', so_ct: 'BH1', dg: 100, nv: 'An' }),
    dongBan({ ngay: '2026-02-01', so_ct: 'BH2', dg: 200, nv: 'An' }),   // sang kỳ khác
    dongBan({ ngay: '2026-02-01', so_ct: 'BH3', dg: 300, nv: 'Bình' }), // người khác
  ]));
  ok('hai kỳ', Object.keys(r.ky).sort(), ['2026-01', '2026-02']);
  ok('bc/ky/<kỳ>/<nhân viên>/<ngày> = {doanh_so, so_don}',
     r.ky['2026-02']['Bình']['2026-02-01'], { doanh_so: 300, so_don: 1 });
  ok('một nhân viên ở kỳ 01', Object.keys(r.ky['2026-01']), ['An']);
  ok('hai nhân viên ở kỳ 02', Object.keys(r.ky['2026-02']).sort(), ['An', 'Bình']);
  ok('tổng tháng 02', r.tom_tat.thang['2026-02'],
     { doanh_so: 500, so_don: 2, so_nhan_vien: 2, so_ngay: 1 });
}

console.log('\n4) Dòng không có số chứng từ bị BỎ — kể cả dòng "Tổng cộng" của sổ');
{
  const tong = [];
  tong[0] = 'Tổng cộng'; tong[10] = 999999;   // đúng hình dòng cuối sổ thật
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 1000, nv: 'An' }),
    tong,
  ]));
  ok('dòng "Tổng cộng" không được cộng vào doanh thu', r.tom_tat.doanh_so_tong, 1000);
  ok('và được đếm là dòng bỏ', r.tom_tat.dong_bo_thieu_so_ct, 1);
  ok('số dòng bán thật', r.tom_tat.dong_tong, 1);
}

console.log('\n5) Ô nhân viên trống: KHÔNG bỏ dòng, dồn vào "(chưa gán)" và báo ra');
{
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 5000, nv: 'An' }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH2', dg: 7000, nv: null }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH3', dg: 100, nv: '   ' }),  // chỉ khoảng trắng
  ]));
  ok('tiền của dòng trống nhân viên KHÔNG mất khỏi tổng tháng',
     r.tom_tat.thang['2026-01'].doanh_so, 12100);
  ok('nằm ở khoá "(chưa gán)"',
     r.ky['2026-01'][G.NV_CHUA_GAN]['2026-01-02'], { doanh_so: 7100, so_don: 2 });
  const c = r.canh_bao.find(x => x.ma === 'thieu-nhan-vien');
  ok('có cảnh báo thieu-nhan-vien với đúng số lượng', c && c.so_luong, 2);
  ok('cảnh báo kể tên số chứng từ để còn sửa được (P5)',
     c && c.vi_du.sort(), ['BH2', 'BH3']);
}

console.log('\n6) Dòng không có ngày: không xếp được vào kỳ nào → báo KÈM số tiền');
{
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 1000, nv: 'An' }),
    dongBan({ ngay: null, so_ct: 'BH9', dg: 4200, nv: 'An' }),
  ]));
  ok('không lẫn vào kỳ nào', r.tom_tat.doanh_so_tong, 1000);
  const c = r.canh_bao.find(x => x.ma === 'thieu-ngay');
  ok('báo số dòng', c && c.so_luong, 1);
  ok('báo luôn số tiền không xếp được — để khoảng lệch có tên',
     c && c.doanh_so_khong_xep_duoc, 4200);
}

console.log('\n7) Ngày: nhận Date, số sê-ri Excel và chuỗi ISO — ra cùng một kỳ');
{
  ok('số sê-ri Excel 46023 → 01/01/2026 (mốc 30/12/1899)',
     G.doiNgay(46023), { ky: '2026-01', ngay: '2026-01-01', nam: 2026 });
  ok('45658 → 01/01/2025', G.doiNgay(45658).ngay, '2025-01-01');
  ok('Date cho cùng kết quả', G.doiNgay(new Date(Date.UTC(2026, 0, 1))).ngay, '2026-01-01');
  ok('chuỗi "2026-01-02 00:00:00"', G.doiNgay('2026-01-02 00:00:00').ngay, '2026-01-02');
  ok('sê-ri có phần giờ vẫn ra đúng ngày', G.doiNgay(46023.75).ngay, '2026-01-01');
  ok('ô trống → null', G.doiNgay(''), null);
  ok('chữ không phải ngày → null', G.doiNgay('hôm qua'), null);
  ok('Date không hợp lệ → null', G.doiNgay(new Date('x')), null);

  /* Cùng một sổ nạp ở hai múi giờ khác nhau phải ra CÙNG một ngày — nếu
     doiNgay dùng giờ địa phương thì 46023 ở UTC-7 sẽ lùi thành 31/12/2025. */
  const cu = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  ok('múi giờ của máy không đổi được kết quả', G.doiNgay(46023).ngay, '2026-01-01');
  if (cu === undefined) delete process.env.TZ; else process.env.TZ = cu;

  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: 46023, so_ct: 'BH1', dg: 100, nv: 'An' }),
    dongBan({ ngay: '2026-01-01', so_ct: 'BH2', dg: 200, nv: 'An' }),
  ]));
  ok('sê-ri và chuỗi cùng ngày rơi vào CÙNG một ô',
     r.ky['2026-01']['An']['2026-01-01'], { doanh_so: 300, so_don: 2 });
}

console.log('\n8) Chuẩn hoá tên nhân viên — hai cách mã hoá dấu không được thành hai người');
{
  /* "Đức" viết hai cách: tổ hợp (ư U+01B0 + dấu sắc rời U+0301) và dựng sẵn
     (ứ U+1EE9). Hai chuỗi KHÁC NHAU với ===, nhưng là cùng một cái tên. Cả
     hai đều gặp thật khi dữ liệu đi qua nhiều công cụ khác nhau. */
  /* Viết bằng mã điểm, KHÔNG dán ký tự thật: một công cụ nào đó chuẩn hoá
     lại file (nhiều editor làm thế) sẽ biến chuỗi tổ hợp thành chuỗi dựng
     sẵn, và bài kiểm này lặng lẽ thành một bài kiểm rỗng. */
  const to_hop = 'Đ' + String.fromCodePoint(0x01B0, 0x0301) + 'c';  // ư + dấu sắc rời
  const dung_san = 'Đ' + String.fromCodePoint(0x1EE9) + 'c';        // ứ dựng sẵn
  ok('hai cách mã hoá vốn là hai chuỗi khác nhau', to_hop === dung_san, false);
  ok('NFC gộp hai cách mã hoá thành một chuỗi',
     G.chuanHoaChu(to_hop) === G.chuanHoaChu(dung_san), true);
  ok('gộp cụm trắng và cắt hai đầu', G.chuanHoaChu('  Thu   Hà  '), 'Thu Hà');
  ok('ô trống → null', G.chuanHoaChu('   '), null);

  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 100, nv: to_hop }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH2', dg: 200, nv: dung_san }),
  ]));
  ok('→ MỘT nhân viên trên bc/ky, không phải hai', Object.keys(r.ky['2026-01']).length, 1);
}

console.log('\n9) Khoá Firebase: ký tự cấm bị thay, KHÔNG bị bỏ (bỏ là gộp nhầm hai người)');
{
  ok('dấu chấm → ~', G.khoaNhanVien('A.B'), 'A~B');
  ok('gạch chéo, #, $, [, ] cũng vậy', G.khoaNhanVien('a/b#c$d[e]f'), 'a~b~c~d~e~f');
  ok('"A.B" và "AB" vẫn là hai khoá khác nhau',
     G.khoaNhanVien('A.B') === G.khoaNhanVien('AB'), false);
  ok('ký tự điều khiển → ~', G.khoaNhanVien('AB'), 'A~B');
  ok('tên trống → (chưa gán)', G.khoaNhanVien(null), G.NV_CHUA_GAN);
  ok('tên thật của sổ đi qua nguyên vẹn',
     G.khoaNhanVien(' Thu Hà - Đại Lý 0900000000 '), 'Thu Hà - Đại Lý 0900000000');

  /* Khoá sinh ra phải là đường dẫn Firebase hợp lệ theo đúng bộ canh của
     Gateway — hai chỗ này không được nghĩ khác nhau. */
  const { kiemDuong } = await import('../src/firebase.js');
  for (const ten of ['A.B', 'a/b#c$d[e]f', 'Thu Hà - Đại Lý 0900000000', null]) {
    ok('bc/ky/2026-01/<khoá>/ngày hợp lệ với kiemDuong: ' + String(ten),
       kiemDuong('bc/ky/2026-01/' + G.khoaNhanVien(ten) + '/2026-01-02'), null);
  }
}

console.log('\n10) Tiền: ô trống là 0, chữ không đọc được thì BÁO chứ không coi là 0');
{
  ok('ô trống → 0 (không chiết khấu = chiết khấu 0)', G.doiSo(''), 0);
  ok('null → 0', G.doiSo(null), 0);
  ok('số → chính nó', G.doiSo(8000000), 8000000);
  ok('chuỗi số → số', G.doiSo(' 8000000 '), 8000000);
  ok('chữ → null (để bên gọi báo ra)', G.doiSo('không có'), null);
  ok('NaN → null', G.doiSo(NaN), null);

  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', ds: 'lỗi', nv: 'An' }),
  ]));
  const c = r.canh_bao.find(x => x.ma === 'tien-khong-doc-duoc');
  ok('dòng tiền không đọc được được kể tên', c && c.vi_du, ['BH1']);
  ok('và vẫn giữ đơn (không bỏ dòng)', r.tom_tat.so_don_tong, 1);
}

console.log('\n11) Bất biến chống cộng đôi: một chứng từ ở hai ô phải LỘ RA');
{
  // Cùng số chứng từ, hai ngày → nếu im lặng thì tổng công ty cộng đôi.
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 100, nv: 'An' }),
    dongBan({ ngay: '2026-01-03', so_ct: 'BH1', dg: 200, nv: 'An' }),
  ]));
  ok('so_don_tong đếm distinct cả sổ → 1', r.tom_tat.so_don_tong, 1);
  ok('cộng so_don của mọi ô → 2', r.tom_tat.so_don_cong_o, 2);
  ok('có cảnh báo don-nhieu-ngay',
     !!r.canh_bao.find(x => x.ma === 'don-nhieu-ngay'), true);
  const cd = r.canh_bao.find(x => x.ma === 'so-don-cong-doi');
  ok('và cảnh báo so-don-cong-doi nói rõ lệch bao nhiêu', cd && cd.so_luong, 1);

  const r2 = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 100, nv: 'An' }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', dg: 200, nv: 'Bình' }),
  ]));
  ok('một chứng từ hai nhân viên cũng bị báo',
     !!r2.canh_bao.find(x => x.ma === 'don-nhieu-nhan-vien'), true);

  /* Trên sổ THẬT 2026 không có ca nào như trên (11.069/11.069 chứng từ gọn
     trong một ngày, một nhân viên) — nên hai luật đếm "distinct cả sổ" và
     "distinct trong (nhân viên, ngày)" ra cùng một số. Bộ kiểm này canh cái
     ngày sổ về sau KHÔNG còn đúng thế. */
}

console.log('\n12) Ngày bất khả thi vẫn GIỮ NGUYÊN (tổng phải khớp sổ) nhưng phải báo');
{
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '1999-05-05', so_ct: 'BH1', dg: 100, nv: 'An' }),
  ]));
  ok('vẫn vào bc/ky theo đúng ngày đã ghi', r.ky['1999-05']['An']['1999-05-05'].doanh_so, 100);
  ok('và bị báo là ngay-bat-thuong',
     !!r.canh_bao.find(x => x.ma === 'ngay-bat-thuong'), true);
}

console.log('\n13) Không làm rơi tiền vì bụi dấu phẩy động');
{
  // 0,1 + 0,2 !== 0,3 nếu cộng thẳng bằng float.
  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', ds: 0.1, nv: 'An' }),
    dongBan({ ngay: '2026-01-02', so_ct: 'BH2', ds: 0.2, nv: 'An' }),
  ]));
  ok('0,1 + 0,2 = 0,3 đúng đến 2 chữ số thập phân',
     r.ky['2026-01']['An']['2026-01-02'].doanh_so, 0.3);
  ok('tổng tháng cũng vậy', r.tom_tat.thang['2026-01'].doanh_so, 0.3);
}

console.log('\n14) Luật doanh số là MỘT hằng số có tên, không rải rác trong code');
{
  ok('luật đang dùng được ghi vào tóm tắt để báo cáo giải thích được',
     G.gopSoBanHang(soMau([])).tom_tat.luat_doanh_so, G.LUAT_DOANH_SO);
  ok('và là một trong hai luật đã tra cứu',
     ['cot-doanh-so-ban', 'tru-chiet-khau'].includes(G.LUAT_DOANH_SO), true);

  const r = G.gopSoBanHang(soMau([
    dongBan({ ngay: '2026-01-02', so_ct: 'BH1', sl: 2, dg: 1000, ds: 2000, ck: 300, nv: 'An' }),
  ]));
  const mong = G.LUAT_DOANH_SO === 'tru-chiet-khau' ? 1700 : 2000;
  ok('tiền của dòng đúng theo luật đang bật',
     r.ky['2026-01']['An']['2026-01-02'].doanh_so, mong);
}

console.log('\n15) Sổ rỗng (chỉ tiêu đề) → cây rỗng, KHÔNG nổ');
{
  const r = G.gopSoBanHang(soMau([]));
  ok('cây kỳ rỗng', r.ky, {});
  ok('không đơn nào', r.tom_tat.so_don_tong, 0);
  ok('không cảnh báo giả', r.canh_bao, []);
}

xong();
})().catch(e => { console.error(e); process.exit(1); });
