/* Canh tầng LINE (`engine/src/line.mjs`) — tầng phân tích cố định xuyên thời
 * gian, nằm trên tên nhân viên.
 *
 * Cái đắt nhất nếu sai ở đây: một line kể THIẾU TIỀN mà vẫn trông như một con
 * số bình thường. Nên bộ này canh nặng nhất vào hai chỗ — bất biến "cộng mọi
 * line == tổng công ty", và "tên chưa khai KHÔNG được tan biến trong im lặng".
 *
 * Dữ liệu kiểm là BỊA, trừ đúng một chỗ có ghi rõ là lấy từ hình dạng thật
 * của sổ (tên có dấu chấm) — và cả chỗ đó cũng không dùng tên người thật.
 */
const { doc, ok, xong } = require('./khung');

/** Cây bc/ky bịa: { kỳ: { nhân viên: { ngày: {doanh_so, so_don} } } }. */
function cay(spec) {
  const ra = {};
  for (const [ky, theoNv] of Object.entries(spec)) {
    ra[ky] = {};
    for (const [nv, theoNgay] of Object.entries(theoNv)) {
      ra[ky][nv] = {};
      for (const [ngay, [doanh_so, so_don]] of Object.entries(theoNgay)) {
        ra[ky][nv][ngay] = { doanh_so, so_don };
      }
    }
  }
  return ra;
}

(async () => {
const L = await import('../engine/src/line.mjs');

/* Bảng nhỏ, đủ để kiểm luật — KHÔNG dùng bảng hạt giống thật, để bài kiểm
   không đỏ mỗi lần chủ dự án thêm một nhân viên. */
const BANG = {
  thu_tu: ['Nội thành', 'Fanpage', 'Shopee', L.LINE_KHAC],
  ghi_chu: { Shopee: 'chưa có dòng nào' },
  cua_ten: { A1: 'Nội thành', A2: 'Nội thành', B1: 'Fanpage', B2: 'Fanpage' },
};

console.log('\n1) Xếp một tên vào line; tên chưa khai về "Khác"');
{
  ok('tên đã khai', L.xepLine('A1', BANG), 'Nội thành');
  ok('tên khác cùng line', L.xepLine('A2', BANG), 'Nội thành');
  ok('tên CHƯA khai → Khác (không ném, không rơi ra ngoài)', L.xepLine('Z9', BANG), L.LINE_KHAC);
  ok('khoá nhân viên trống của sổ cũng về Khác', L.xepLine('_chua_xac_dinh', BANG), L.LINE_KHAC);
  ok('Khác là đúng chuỗi chủ dự án dùng', L.LINE_KHAC, 'Khác');
  ok('đường ghi bảng nằm trong bc/quyetdinh (nhánh đã có rules, không mở nhánh mới)',
     L.DUONG_BANG_LINE, 'bc/quyetdinh/line');
}

console.log('\n2) Bảng line sai thì NỔ, không trả bảng thiếu line');
{
  ok('bảng đúng: không vấn đề gì', L.kiemBangLine(BANG), []);
  ok('bảng rỗng', L.kiemBangLine(null).map(v => v.ma), ['bang-rong']);
  ok('thiếu thu_tu', L.kiemBangLine({}).map(v => v.ma).includes('thieu-thu-tu'), true);

  /* Thiếu line hứng là lỗi NGHIÊM TRỌNG: một tên lạ sẽ rơi vào một line không
     có trong thu_tu, và tổng theo line không còn bằng tổng công ty. */
  ok('thiếu line "Khác"',
     L.kiemBangLine({ thu_tu: ['X'] }).map(v => v.ma), ['thieu-line-khac']);
  ok('line trùng tên',
     L.kiemBangLine({ thu_tu: ['X', 'X', L.LINE_KHAC] }).map(v => v.ma), ['line-trung']);

  /* Gõ sai tên line trong cua_ten là ca thật hay gặp nhất khi sửa tay trên
     Console — phải bắt được, vì nó tạo ra một line thứ N+1 vô danh. */
  const sai = L.kiemBangLine({
    thu_tu: ['Nội thành', L.LINE_KHAC],
    cua_ten: { A1: 'Nội Thành' },   // hoa chữ T — KHÁC "Nội thành"
  });
  ok('tên line trong cua_ten không có trong thu_tu → bắt được', sai.map(v => v.ma), ['line-khong-khai']);
  ok('và nói rõ tên nào, line nào', [sai[0].ten, sai[0].line], ['A1', 'Nội Thành']);

  let ma = null;
  try { L.gopTheoLine({}, { thu_tu: ['X'] }); } catch (e) { ma = e.ma; }
  ok('gopTheoLine NÉM LỖI khi bảng không hợp lệ', ma, 'bang-line-khong-hop-le');
}

console.log('\n3) Gộp theo line: tổng line, tổng tháng, và tách theo từng nguồn');
{
  const r = L.gopTheoLine(cay({
    '2025-01': {
      A1: { '2025-01-05': [1000, 2], '2025-01-06': [500, 1] },
      A2: { '2025-01-05': [300, 1] },
      B1: { '2025-01-07': [700, 3] },
    },
    '2025-02': {
      A1: { '2025-02-01': [200, 1] },
    },
  }), BANG);

  ok('Nội thành cộng cả A1 và A2, cả hai tháng', r.line['Nội thành'].doanh_so, 2000);
  ok('số đơn cộng theo ô', r.line['Nội thành'].so_don, 5);
  ok('tách theo tháng', r.line['Nội thành'].thang['2025-01'], { doanh_so: 1800, so_don: 4 });
  ok('tháng sau', r.line['Nội thành'].thang['2025-02'], { doanh_so: 200, so_don: 1 });

  /* Chủ dự án yêu cầu tường minh: "vẫn phải thể hiện rõ trong Nội thành có 4
     nguồn này". `nguon` là chỗ trả lời câu đó. */
  ok('nguon kể đủ từng nhân viên trong line',
     Object.keys(r.line['Nội thành'].nguon).sort(), ['A1', 'A2']);
  ok('nguon A1 có số riêng', r.line['Nội thành'].nguon.A1.doanh_so, 1700);
  ok('nguon A1 tách được theo tháng',
     r.line['Nội thành'].nguon.A1.thang['2025-02'], { doanh_so: 200, so_don: 1 });
  ok('nguon A2 có số riêng', r.line['Nội thành'].nguon.A2.doanh_so, 300);

  ok('Fanpage riêng', r.line.Fanpage.doanh_so, 700);
  ok('tổng công ty theo tháng vẫn có', r.thang['2025-01'], { doanh_so: 2500, so_don: 7 });
  ok('tổng cả kỳ', r.tom_tat.doanh_so_tong, 2700);
  ok('tổng số đơn', r.tom_tat.so_don_tong, 8);
  ok('thứ tự line giữ nguyên như bảng khai (để màn hình xếp cột ổn định)',
     r.thu_tu, ['Nội thành', 'Fanpage', 'Shopee', L.LINE_KHAC]);
  ok('ghi chú của line đi kèm kết quả', r.ghi_chu.Shopee, 'chưa có dòng nào');
}

console.log('\n4) Line đã khai mà CHƯA có dòng nào vẫn hiện ra với số 0');
{
  /* Đây là lý do `thu_tu` phải khai tường minh chứ không suy từ dữ liệu: chủ
     dự án chốt "Shopee — tháng 9 này mới xuất hiện", nên suốt 2025–08/2026 nó
     phải hiện ra là 0, không phải biến mất khỏi báo cáo. */
  const r = L.gopTheoLine(cay({ '2025-01': { A1: { '2025-01-05': [100, 1] } } }), BANG);
  ok('Shopee vẫn có mặt', Object.keys(r.line).includes('Shopee'), true);
  ok('với doanh số 0', r.line.Shopee, { doanh_so: 0, so_don: 0, thang: {}, nguon: {} });
  ok('mọi line đã khai đều có mặt', Object.keys(r.line).sort(),
     ['Fanpage', 'Khác', 'Nội thành', 'Shopee']);
}

console.log('\n5) BẤT BIẾN: cộng mọi line == tổng công ty (line không được kể thiếu tiền)');
{
  const r = L.gopTheoLine(cay({
    '2025-01': { A1: { '2025-01-05': [1000, 2] }, Z9: { '2025-01-05': [999, 3] } },
  }), BANG);
  ok('khớp tổng', r.tom_tat.khop_tong, true);
  let ds = 0, don = 0;
  for (const t of Object.keys(r.line)) { ds += r.line[t].doanh_so; don += r.line[t].so_don; }
  ok('tự cộng lại cũng bằng tổng', [ds, don], [r.tom_tat.doanh_so_tong, r.tom_tat.so_don_tong]);
  ok('tên chưa khai KHÔNG bị bỏ — tiền vào Khác', r.line[L.LINE_KHAC].doanh_so, 999);
}

console.log('\n6) Tên chưa khai line phải BÁO RA, không tan biến trong "Khác"');
{
  const r = L.gopTheoLine(cay({
    '2025-01': {
      A1: { '2025-01-05': [100, 1] },
      Z9: { '2025-01-05': [5000, 2] },
      Y8: { '2025-01-05': [10, 1] },
    },
  }), BANG);
  ok('kể đủ tên chưa khai', r.chua_xep.map(c => c.ten), ['Z9', 'Y8']);
  ok('sắp theo doanh số giảm dần (tên lạ bán nhiều đập vào mắt trước)',
     r.chua_xep[0].ten, 'Z9');
  ok('kèm số tiền để biết quy mô', r.chua_xep[0].doanh_so, 5000);
  ok('kèm số đơn', r.chua_xep[0].so_don, 2);
  ok('tên ĐÃ khai không bị kể là chưa xếp',
     r.chua_xep.some(c => c.ten === 'A1'), false);
  ok('mọi tên đã khai → chua_xep rỗng',
     L.gopTheoLine(cay({ '2025-01': { A1: { '2025-01-05': [1, 1] } } }), BANG).chua_xep, []);
}

console.log('\n7) Bảng hạt giống thật — 10 line chủ dự án chốt 11/09/2026');
{
  const B = L.BANG_LINE_HAT_GIONG;
  ok('bảng hạt giống tự nó hợp lệ', L.kiemBangLine(B), []);
  ok('đúng 10 line, đúng thứ tự chủ dự án đánh số 1–10', B.thu_tu,
     ['Nội thành', 'Tín Phát', 'Miền Bắc', 'Tổng kho', 'Quyết chiến',
      'Đông Á', 'Tân Á', 'Fanpage', 'Shopee', 'Khác']);

  /* Nội thành: bốn người, và Lê Văn Quân đã nghỉ nhưng doanh số cũ của anh
     VẪN thuộc Nội thành — đó là cả điểm của tầng line. */
  const noiThanh = Object.entries(B.cua_ten).filter(([, l]) => l === 'Nội thành').map(([t]) => t);
  ok('Nội thành có đúng 4 nguồn', noiThanh.length, 4);
  ok('kể cả người đã nghỉ', noiThanh.includes('Lê Văn Quân 0865111033'), true);

  /* Fanpage: người cũ đã nghỉ + tên người mới của 09/2026 khai SẴN, nên sổ
     09/2026 nạp vào là rơi đúng line, không phải sửa gì. */
  const fanpage = Object.entries(B.cua_ten).filter(([, l]) => l === 'Fanpage').map(([t]) => t);
  ok('Fanpage có cả người cũ và tên người mới 09/2026', fanpage.sort(),
     ['Fanpage 0327339229', 'Tống Khánh Linh 0865111033']);

  /* Shopee: tên nhân viên đã khai SẴN (chủ dự án chốt 'Shopee 0865111033'),
     nhưng chưa có dòng nào trên sổ tới 08/2026. Line vẫn phải hiện ra — đó là
     việc của `thu_tu`, đã canh ở bài 4. */
  ok('Shopee đã khai đúng một tên',
     Object.entries(B.cua_ten).filter(([, l]) => l === 'Shopee').map(([t]) => t),
     ['Shopee 0865111033']);

  /* Năm tên chủ dự án chốt để lại "Khác" — khai TƯỜNG MINH, không để mặc
     định. Khác biệt thật: khai rồi thì `chua_xep` sạch, nên một nhân viên mới
     vào sau sẽ nổi lên một mình thay vì lẫn vào đám đã có quyết định. */
  ok('năm tên nhỏ được khai tường minh vào Khác',
     Object.entries(B.cua_ten).filter(([, l]) => l === L.LINE_KHAC).map(([t]) => t).sort(),
     ['Thảo Linh', 'Đinh Thùy Dương', 'Lê Quang Trường 0589691228',
      'Nguyễn Thị Minh Bảo', '_chua_xac_dinh'].sort());

  /* Hotline KHÔNG dùng được làm khoá gộp: cùng số 0865111033 đã đi qua ba tên
     ở BA line khác nhau (Nội thành → Fanpage → Shopee). Gộp theo hotline là
     trộn doanh số của ba kênh vào một. Đây là lý do tầng line gộp theo TÊN. */
  const soTrung = '0865111033';
  const lineCuaSo = new Set(
    Object.entries(B.cua_ten).filter(([t]) => t.includes(soTrung)).map(([, l]) => l));
  ok('hotline 0865111033 trải trên 3 line → không được gộp theo hotline',
     [...lineCuaSo].sort(), ['Fanpage', 'Nội thành', 'Shopee']);

  /* `cua_ten` PHẢI khoá theo khoaNhanVien() — nếu khoá theo tên nguyên văn thì
     tên có dấu chấm sẽ không bao giờ join được với khoá của bc/ky. */
  const G = await import('../engine/src/gop-ban-hang.mjs');
  ok('tên có dấu chấm được khai bằng khoá đã thay ~ (join được với bc/ky)',
     Object.keys(B.cua_ten).includes(G.khoaNhanVien('Miền Bắc 0865.909.033')), true);
  for (const ten of Object.keys(B.cua_ten)) {
    ok('khoá "' + ten + '" là khoá Firebase hợp lệ', G.khoaNhanVien(ten), ten);
  }
}

console.log('\n8) Line là CÁCH NHÌN lúc đọc — không được ghi vào bc/ky');
{
  /* Nếu tổng theo line bị ghi sẵn vào bc/ky thì mỗi lần chủ dự án đổi một cái
     tên là phải nạp lại 20 tháng sổ. Hai bài kiểm này canh đúng điều đó. */
  const GOP = doc('engine/src/gop-ban-hang.mjs');
  ok('gop-ban-hang (thứ GHI ra bc/ky) không biết gì về line',
     /line/i.test(GOP.replace(/\/\*[\s\S]*?\*\//g, '')), false);

  const SCRIPT = doc('bin/nap-so-legacy.mjs');
  const ma = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('script nạp CÓ in báo cáo line (để thấy tên chưa xếp ngay lúc nạp)',
     /gopTheoLine/.test(ma), true);
  /* ...nhưng chỉ để IN. Thứ đẩy lên Firebase vẫn là `cay` thuần từ
     gopSoBanHang, không phải kết quả gộp line. */
  ok('nhưng thứ ghi lên bc/ky vẫn là cây thuần, không phải kết quả gộp line',
     /ghiDb\(duong, cay\[k\]/.test(ma), true);
}

console.log('\n9) Engine mở hàm qua Service Binding, Gateway CHƯA gọi (bẫy số 4 ROADMAP)');
{
  const IDX = doc('engine/src/index.js');
  ok('Engine mở gopTheoLine', /async\s+gopTheoLine\s*\(/.test(IDX), true);
  ok('Engine import hàm chung, không chép lại', /from\s*"\.\/line\.mjs"/.test(IDX), true);
  ok('Gateway CHƯA gọi gopTheoLine (để lượt merge sau mới gọi)',
     /gopTheoLine/.test(doc('src/index.js')), false);
}

console.log('\n10) Cây bc/ky méo thì không làm sập phép gộp');
{
  ok('kỳ rỗng', L.gopTheoLine({}, BANG).tom_tat.doanh_so_tong, 0);
  ok('kỳ là null bị bỏ qua, không ném',
     L.gopTheoLine({ '2025-01': null }, BANG).tom_tat.doanh_so_tong, 0);
  ok('nhân viên là null bị bỏ qua',
     L.gopTheoLine({ '2025-01': { A1: null } }, BANG).tom_tat.doanh_so_tong, 0);
  ok('ô thiếu doanh_so tính là 0, không thành NaN',
     L.gopTheoLine({ '2025-01': { A1: { '2025-01-05': {} } } }, BANG).tom_tat.doanh_so_tong, 0);
  let nem = false;
  try { L.gopTheoLine(null, BANG); } catch (e) { nem = true; }
  ok('cây không phải đối tượng → ném', nem, true);
}

xong();
})().catch(e => { console.error(e); process.exit(1); });
