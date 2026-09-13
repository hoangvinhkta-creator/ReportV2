/* ĐẨY SANG GOOGLE SHEET — canh đúng những chỗ sai thì sai tiền hoặc mất dữ
 * liệu của chủ dự án, không canh cho đủ số bài.
 *
 * Bốn nhóm rủi ro thật của đường này:
 *   A. bố cục cột lệch      → tiền vào nhầm cột, im lặng
 *   B. chạm dòng 1/2 hay K–N → xoá mất công thức và cột tay của chủ dự án
 *   C. link trỏ nhầm tab     → xoá trắng số liệu của một nhân viên khác
 *   D. đơn vị / ngày sai     → Summary cộng ra số vô nghĩa
 */
const path = require('path');
const { GOC, doc, ok, xong } = require('./khung');

const GW = doc('src/index.js');
const SHEET = doc('src/sheet.js');
const FE = doc('public/don-hang.js');
const WRANGLER = doc('wrangler.toml');

/* Nạp THẬT cả hai module để kiểm hành vi, không chỉ soi chữ: bố cục cột và
   phép tách link là hai chỗ soi chữ không bắt được lỗi. */
let E, S;
(async () => {
  E = await import('file://' + path.join(GOC, 'engine/src/day-sheet.mjs'));
  S = await import('file://' + path.join(GOC, 'src/sheet.js'));
  chay();
})();

function chay() {

console.log('\nA) Bố cục cột — đúng ảnh chủ dự án chốt 13/09/2026');
{
  ok('19 cột (A…S)', E.COT_SHEET.length, 19);
  ok('A–J đúng thứ tự đã chốt', E.COT_SHEET.slice(0, 10),
     ['Ngày', 'Số BH', 'Nơi nhập', 'Mã Sản phẩm', 'Số lượng',
      'Giá nhập TT', 'Giá bán', 'Tổng bán', 'Lợi nhuận', 'Quy đổi']);
  ok('K–N là null = KHÔNG ĐỤNG TỚI (cột tay của chủ dự án)',
     E.COT_SHEET.slice(10, 14), [null, null, null, null]);
  ok('O–S đúng thứ tự đã chốt', E.COT_SHEET.slice(14),
     ['Tên khách hàng', 'Số điện thoại', 'Địa chỉ', 'Hãng', 'IMEI']);
  ok('năm cột tiền là F G H I J', E.COT_TIEN, [5, 6, 7, 8, 9]);
  ok('cột ngày là A', E.COT_NGAY, 0);
}

console.log('\nB) Dòng 1 và dòng 2 BẤT KHẢ XÂM PHẠM');
{
  /* Summary của chủ dự án trỏ thẳng vào ô dòng 1 của từng tab
     (`'01.2026 Ly'!$B$1`), và dòng 2 là hàng tiêu đề anh tự gõ. Ghi đè một
     trong hai là hỏng cả file báo cáo năm, không chỉ hỏng một tháng. */
  ok('ghi từ dòng 3', E.HANG_DAU, 3);
  ok('Engine trả hang_dau cho Gateway, không để Gateway tự đoán',
     /hang_dau: HANG_DAU/.test(doc('engine/src/day-sheet.mjs')), true);
  ok('Gateway xoá bằng dải MỞ ĐUÔI (A3:J, không phải A3:J500) — dòng thừa của '
     + 'lượt trước phải biến mất',
     /k\.cot_dau \+ hangDau \+ ":" \+ k\.cot_cuoi/.test(SHEET), true);
  ok('KHÔNG dùng values:clear trên cả tab', /values:clear\b/.test(SHEET), false);
  ok('chỉ batchClear đúng hai dải Engine sắp ghi',
     /values:batchClear[\s\S]{0,200}ranges: dai/.test(SHEET), true);
}

console.log('\nC) Hai khối rời — K–N không nằm trong dải nào bị ghi');
{
  const bang = { ngay: [{ ngay: '2026-08-01', don: [{
    so_ct: 'BH1', ten_khach: 'Chị Nga', dien_thoai: '0988', dia_chi: 'Hà Nội',
    dong: [{ ma_san_pham: 'X', so_luong: 1, gia_nhap: 12550000, gia_ban: 12850000,
             tong_ban: 12850000, loi_nhuan: 300000, doanh_so_quy_doi: 4000000,
             noi_nhap: 'Kho', hang: 'LG', imei: 'IM1' }],
  }] }] };
  const k = E.dungKhoiSheet(bang);
  ok('đúng hai khối', k.khoi.length, 2);
  ok('khối 1 là A→J', [k.khoi[0].cot_dau, k.khoi[0].cot_cuoi], ['A', 'J']);
  ok('khối 2 là O→S', [k.khoi[1].cot_dau, k.khoi[1].cot_cuoi], ['O', 'S']);
  ok('khối 1 rộng đúng 10 ô', k.khoi[0].dong[0].length, 10);
  ok('khối 2 rộng đúng 5 ô', k.khoi[1].dong[0].length, 5);
  /* Nếu hai khối liền nhau thành một dải A:S thì K–N bị xoá trắng. Khoảng
     hở giữa J và O chính là thứ giữ bốn cột tay của chủ dự án. */
  ok('có khoảng hở giữa hai khối (J … O), không phải một dải liền',
     k.khoi[0].cot_cuoi === 'J' && k.khoi[1].cot_dau === 'O', true);
}

console.log('\nD) Đơn vị nghìn đồng và ngày — chủ dự án chốt 13/09/2026');
{
  const bang = { ngay: [{ ngay: '2026-08-01', don: [{
    so_ct: 'BH1', ten_khach: 'A', dien_thoai: null, dia_chi: null,
    dong: [{ ma_san_pham: 'X', so_luong: 1, gia_nhap: 12550000, gia_ban: 12850000,
             tong_ban: 12850000, loi_nhuan: 300000, doanh_so_quy_doi: 4000000 }],
  }] }] };
  const h = E.dungKhoiSheet(bang).khoi[0].dong[0];
  ok('giá nhập 12.550.000 đ → 12550 (nghìn đồng, khớp file cũ)', h[5], 12550);
  ok('lợi nhuận 300.000 đ → 300', h[8], 300);
  ok('quy đổi 4.000.000 đ → 4000', h[9], 4000);
  ok('số lượng KHÔNG bị chia 1.000', h[4], 1);

  /* 46235 là số sê-ri của 01/08/2026, đọc thẳng từ file "Báo cáo Kinh doanh
     2026" của chủ dự án (ô A3 tab "08.2026 Tín Phát"). Ghim con số thật ấy
     chứ không ghim lại công thức của chính mình. */
  ok('ngày 2026-08-01 → sê-ri 46235 (đúng ô A3 file thật)',
     E.serialNgay('2026-08-01'), 46235);
  ok('ngày là SỐ, không phải chuỗi', typeof h[0], 'number');
  ok('ngày hỏng → null chứ không phải NaN', E.serialNgay('khong-phai-ngay'), null);
}

console.log('\nE) Chỉ dòng đầu của đơn mang ngày · số BH · khách');
{
  /* Chủ dự án chốt phương án này để `count()` cột B ra đúng SỐ ĐƠN. Lặp ở
     mọi dòng thì công thức dòng 1 của anh đếm ra số DÒNG — lệch âm thầm. */
  const bang = { ngay: [{ ngay: '2026-08-01', don: [{
    so_ct: 'BH72685', ten_khach: 'Chị Nga', dien_thoai: '0988456479',
    dia_chi: 'Cù Chính Lan',
    dong: [
      { ma_san_pham: 'TV', so_luong: 1, tong_ban: 1000, hang: 'LG', imei: 'I1' },
      { ma_san_pham: 'Giá treo', so_luong: 1, tong_ban: 250, hang: null, imei: null },
    ],
  }] }] };
  const k = E.dungKhoiSheet(bang);
  const [d1, d2] = k.khoi[0].dong;
  const [o1, o2] = k.khoi[1].dong;
  ok('dòng đầu CÓ ngày', typeof d1[0], 'number');
  ok('dòng đầu CÓ số BH', d1[1], 'BH72685');
  ok('dòng sau KHÔNG có ngày', d2[0], null);
  ok('dòng sau KHÔNG có số BH', d2[1], null);
  ok('dòng đầu có tên khách · SĐT · địa chỉ',
     [o1[0], o1[1], o1[2]], ['Chị Nga', '0988456479', 'Cù Chính Lan']);
  ok('dòng sau để trống cả ba', [o2[0], o2[1], o2[2]], [null, null, null]);
  /* Cột của DÒNG (không phải của đơn) vẫn phải có mặt ở mọi dòng. */
  ok('mã sản phẩm có ở CẢ HAI dòng', [d1[3], d2[3]], ['TV', 'Giá treo']);
}

console.log('\nF) Mã sản phẩm hiện đúng thứ màn hình đang hiện');
{
  const mot = (r) => E.dungKhoiSheet({ ngay: [{ ngay: '2026-08-01', don: [{
    so_ct: 'BH1', dong: [r] }] }] }).khoi[0].dong[0][3];
  ok('ưu tiên ma_hien (mã ngắn Tracking)',
     mot({ ma_hien: 'NGAN', ma_bang_gia: 'BG', ma_san_pham: 'câu tên kế toán dài' }), 'NGAN');
  ok('không có ma_hien thì lấy ma_bang_gia',
     mot({ ma_bang_gia: 'BG', ma_san_pham: 'câu dài' }), 'BG');
  ok('chưa khớp mã thì mới dùng tên thô của sổ',
     mot({ ma_san_pham: 'câu dài' }), 'câu dài');
}

console.log('\nG) Link phải trỏ ĐÚNG TAB — đoán trượt là xoá nhầm số của người khác');
{
  const { phanTichLink } = S;
  const L = 'https://docs.google.com/spreadsheets/d/1XmAYo7fPUJsxIjpuj_v64uSGe8ERkzZXKVhyTZr9IWk/edit#gid=123456';
  ok('link đủ id + gid → tách đúng', phanTichLink(L), { id: '1XmAYo7fPUJsxIjpuj_v64uSGe8ERkzZXKVhyTZr9IWk', gid: 123456 });
  ok('gid=0 (tab đầu) vẫn hợp lệ',
     phanTichLink(L.replace('#gid=123456', '#gid=0')).gid, 0);
  ok('THIẾU #gid thì TỪ CHỐI, không đoán tab đầu',
     !!phanTichLink('https://docs.google.com/spreadsheets/d/1XmAYo7fPUJsxIjpuj_v64uSGe8ERkzZXKVhyTZr9IWk/edit').loi, true);
  ok('không phải link Google Sheets thì từ chối',
     !!phanTichLink('https://example.com/a?gid=1').loi, true);
  ok('ô trống thì từ chối', !!phanTichLink('').loi, true);
}

console.log('\nH) RAW, không USER_ENTERED — tên hàng không được thành công thức');
{
  /* Tên hàng trên sổ MISA có ô mở đầu bằng dấu trừ. USER_ENTERED sẽ hiểu
     chúng là công thức, và ô ấy thành #NAME? hoặc tệ hơn là một phép tính
     bịa ra. RAW thì chữ vào nguyên văn. */
  ok('valueInputOption là RAW', /valueInputOption: "RAW"/.test(SHEET), true);
  /* Soi CHỖ KHAI, không soi cả file: chú thích ngay trên dòng ấy có nhắc tên
     USER_ENTERED để nói vì sao KHÔNG dùng nó, và một phép kiểm cấm cả chữ sẽ
     bắt người sau xoá đúng lời giải thích đang giữ cho lỗi này không tái
     diễn. */
  ok('không khai valueInputOption: USER_ENTERED',
     /valueInputOption:\s*"USER_ENTERED"/.test(SHEET), false);
}

console.log('\nH2) Nới lưới trước khi ghi — tab mới chỉ có 1.000 dòng');
{
  /* Nội thành ~1.600 dòng/tháng trên sổ thật, mà một tab Google Sheets mới
     là 1.000 dòng × 26 cột. Không nới trước thì lượt đẩy ĐẦU TIÊN vào file
     mới của chủ dự án đâm vào trần lưới — đúng lượt anh mở ra xem. */
  ok('xin kèm gridProperties trong lượt đọc metadata',
     /fields=sheets\(properties\(sheetId%2Ctitle%2CgridProperties\)\)/.test(SHEET), true);
  ok('có bước nới lưới bằng appendDimension',
     /appendDimension[\s\S]{0,120}dimension: "ROWS"/.test(SHEET), true);
  ok('  · nới cả CỘT khi tab hẹp hơn cột S',
     /appendDimension[\s\S]{0,160}dimension: "COLUMNS"/.test(SHEET), true);
  ok('  · cột cuối cần là S = cột thứ 19', /COT_CAN = 19/.test(SHEET), true);
  /* Thứ tự là chuyện mất dữ liệu: xoá xong mới phát hiện thiếu chỗ thì tab
     nằm lại trắng trơn. */
  ok('nới lưới chạy TRƯỚC lượt batchClear',
     SHEET.indexOf('await nongLuoi(') < SHEET.indexOf('values:batchClear'), true);
  ok('CHỈ nới, không bao giờ thu hẹp lưới',
     /soDongCan > soDongLuoi/.test(SHEET) && !/deleteDimension/.test(SHEET), true);
}

console.log('\nI) Chỉ Quản trị — đổi link là đổi ĐÍCH ĐẾN của tên khách và SĐT');
{
  ok('/api/sheet-link bọc boc("quantri")',
     /const datSheetLink = boc\("quantri"/.test(GW), true);
  ok('/api/day-sheet bọc boc("quantri")',
     /const daySheet = boc\("quantri"/.test(GW), true);
  ok('cả hai đường đã khai trong API_ROUTES',
     /\["POST \/api\/sheet-link", datSheetLink\][\s\S]{0,120}\["POST \/api\/day-sheet", daySheet\]/.test(GW), true);
  ok('mỗi lượt đổi link ghi nhật ký kèm uid (rào thứ nhất đã chốt)',
     /nhatKy\(\{ rid, uid: nguoi\.uid, duong: "\/api\/sheet-link"/.test(GW), true);
}

console.log('\nJ) Nguồn hỏng thì KHÔNG đẩy (CLAUDE.md — "Nguồn hỏng thì BÁO LỖI")');
{
  /* Đẩy một bảng thiếu giá vốn là ĐÈ mất bộ số đúng của lượt trước bằng một
     bộ thiếu, và trên Sheet không có gì nói là thiếu. */
  ok('giá hỏng thì dừng, không ghi',
     /if \(kq\.loi_nguon_ma\) throw new LoiXacThuc\(503, "nguon-gia-hong:/.test(GW), true);
  ok('KPI hỏng thì dừng, không ghi',
     /if \(kq\.loi_nguon_kpi\) throw new LoiXacThuc\(503, "nguon-kpi-hong:/.test(GW), true);
  ok('lỗi Google ghi xuống day_loi để lượt mở màn hình sau còn thấy',
     /day_loi: e\.vi/.test(GW), true);
  ok('lượt đẩy THÀNH CÔNG xoá dấu lỗi cũ (không kêu mãi sau khi đã sửa)',
     /day_luc: \{ "\.sv": "timestamp" \}, day_loi: null/.test(GW), true);
}

console.log('\nK) Lượt tự động 17h30 giờ VN');
{
  ok('wrangler khai cron 30 10 * * * (= 17h30 +07:00)',
     /crons = \["30 10 \* \* \*"\]/.test(WRANGLER), true);
  ok('Worker có handler scheduled()', /async scheduled\(event, env, ctx\)/.test(GW), true);
  ok('đẩy kỳ hiện tại VÀ kỳ liền trước (đầu tháng còn sửa sổ tháng cũ)',
     /\[kyVN\(luc, 0\), kyVN\(luc, 1\)\]/.test(GW), true);
  ok('kỳ tính theo giờ VN, không theo UTC', /VN_LECH_MS = 7 \* 3600 \* 1000/.test(GW), true);
  ok('một line hỏng KHÔNG làm dừng các line còn lại (try trong vòng lặp)',
     /for \(const line of bangLine\.val\.thu_tu\) \{\s*try \{/.test(GW), true);
}

console.log('\nL) LUẬT SỐ 1 — trình duyệt không dựng một ô nào của Sheet');
{
  ok('màn hình KHÔNG biết bố cục cột', /COT_SHEET|cot_dau|cot_cuoi/.test(FE), false);
  ok('màn hình KHÔNG tự chia 1.000 cho Sheet', /\/ 1000[\s\S]{0,40}sheet/i.test(FE), false);
  ok('màn hình KHÔNG tự dựng số sê-ri ngày', /serialNgay|46235|1899/.test(FE), false);
  ok('màn hình chỉ gửi link + kỳ + line, không gửi dòng nào',
     /goiGhi\("\/api\/day-sheet", \{\s*line: trangThai\.line, ky: trangThai\.ky,\s*\}\)/.test(FE), true);
}

xong();
}
