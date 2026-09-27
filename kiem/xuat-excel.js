/* XUẤT EXCEL THEO FORM HÃNG — chủ dự án chốt 27/09/2026 (chỉ LG).
 *
 * Nút này xuất file RỒI TỰ TICK những dòng đã vào file. Nên mọi lỗi của nó
 * đều thuộc một trong hai loại, và cả hai đều im lặng:
 *
 *  A. MỘT CÁI MÁY BỊ TICK MÀ KHÔNG NẰM TRONG FILE — nó rời khỏi danh sách
 *     việc mà chưa ai kích hoạt. Dòng thiếu IMEI, dòng model loại trừ, dòng
 *     không có khoá: không xuất thì TUYỆT ĐỐI không tick.
 *  B. MỘT MODEL CẤM KÍCH HOẠT HÀNG LOẠT LỌT VÀO FILE — chương trình đặc biệt
 *     bị kích hoạt sai cách. Phép so phải là so NGUYÊN MÃ, và đọc được cả
 *     nhánh Firebase lỡ thành đối tượng khoá số.
 *
 * Cộng một chỗ chép tay dễ trôi: tiêu đề cột phải bằng ĐÚNG file mẫu của
 * cổng LG, kể cả dấu xuống dòng trong ô Sell Out Date.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/bao-hanh.mjs'));

  const muc = (x) => Object.assign({
    khoa: 'BH1|may|0', ngay: '2026-09-03', so_ct: 'BH1', ma_san_pham: '65UR8050PSB',
    so_luong: 1, dien_thoai: '0901234567', imei: ['405KAAA1'], thieu_imei: false,
    da_kich_hoat: false,
  }, x);
  /* 27/09/2026 10:00 giờ Việt Nam. */
  const MS = Date.UTC(2026, 8, 27, 3, 0, 0);

  console.log('\n1) Form LG — đúng file mẫu import_sellout_template.xlsx');
  {
    ok('chỉ LG có form xuất', Object.keys(B.XUAT_EXCEL), ['LG']);
    ok('chín tiêu đề, nguyên văn file mẫu', B.XUAT_EXCEL.LG.cot, [
      '(*) Store Code', '(*) Model', '(*) Serial No', 'End User Cell',
      'End User Name', 'End User Address', '(*) Sell Out Date\n(yyyymmdd)',
      'Remark', '(Cột Ngày fix EOW, tùy chọn)',
    ]);
    ok('mã cửa hàng EASV8721', B.XUAT_EXCEL.LG.store_code, 'EASV8721');
    ok('độ rộng đủ chín cột', B.XUAT_EXCEL.LG.rong_cot.length, 9);
    ok('hangXuatExcel nhận cách viết lệch', B.hangXuatExcel(' lg '), 'LG');
    ok('hãng có tab nhưng không có form → null', B.hangXuatExcel('Samsung'), null);
    ok('không phải hãng → null', B.hangXuatExcel('LG2'), null);
  }

  console.log('\n2) Ngày xuất — theo giờ Việt Nam, dạng yyyymmdd');
  {
    ok('10 giờ sáng 27/09', B.ngayXuatVN(MS), '20260927');
    /* 6 giờ sáng ở Hà Nội vẫn là 23 giờ hôm trước theo UTC. */
    ok('6 giờ sáng VN không lùi về hôm qua',
       B.ngayXuatVN(Date.UTC(2026, 8, 26, 23, 0, 0)), '20260927');
    ok('23 giờ 59 VN vẫn là hôm đó',
       B.ngayXuatVN(Date.UTC(2026, 8, 27, 16, 59, 0)), '20260927');
  }

  console.log('\n3) Mỗi IMEI một dòng, đúng mapping cột chủ dự án chốt');
  {
    const r = B.dongXuatExcel([muc({ so_luong: 2, imei: ['A1', 'A2'] })], 'LG', { ds: [] }, MS);
    ok('hai IMEI → hai dòng', r.dong.length, 2);
    ok('dòng 1 đúng từng ô', r.dong[0],
       ['EASV8721', '65UR8050PSB', 'A1', '0901234567', '', '', '20260927', '', '']);
    ok('dòng 2 mang IMEI thứ hai', r.dong[1][2], 'A2');
    ok('tick ĐÚNG MỘT khoá cho cả dòng', r.khoa_tick, ['BH1|may|0']);
    ok('SĐT giữ số 0 đầu (chữ, không phải số)', typeof r.dong[0][3], 'string');
    ok('không có SĐT → ô trống, không phải "null"',
       B.dongXuatExcel([muc({ dien_thoai: null })], 'LG', null, MS).dong[0][3], '');
    ok('hãng không có form → null', B.dongXuatExcel([muc({})], 'Samsung', null, MS), null);
  }

  console.log('\n4) A — không xuất thì KHÔNG tick');
  {
    const r = B.dongXuatExcel([
      muc({ khoa: 'k1', imei: [], thieu_imei: true }),
      muc({ khoa: 'k2', so_luong: 2, imei: ['X'], thieu_imei: true }),
      muc({ khoa: null }),
      muc({ khoa: 'k4', ma_san_pham: 'OLED65C4PSA' }),
      muc({ khoa: 'k5', imei: ['OK'] }),
    ], 'LG', { ds: ['oled65c4psa'] }, MS);
    ok('chỉ dòng lành vào file', r.dong.map((d) => d[2]), ['OK']);
    ok('chỉ dòng lành được tick', r.khoa_tick, ['k5']);
    ok('đếm đủ từng loại bị bỏ', r.bo_qua, { loai_tru: 1, thieu_imei: 2, khong_khoa: 1 });
    /* Thiếu MỘT PHẦN cũng bỏ trọn: tick là tick cả dòng, nên xuất một IMEI
       rồi tick là cái máy thứ hai biến khỏi danh sách việc. */
    ok('thiếu một phần IMEI → không một IMEI nào của dòng đó vào file',
       r.dong.some((d) => d[2] === 'X'), false);
    ok('dòng đã tick không xuất lại',
       B.dongXuatExcel([muc({ da_kich_hoat: true })], 'LG', null, MS).dong.length, 0);
  }

  console.log('\n5) B — so NGUYÊN MÃ, không tiền tố, không chuỗi con');
  {
    const lt = { ds: ['65UR8050PSB'] };
    const x = (ma) => B.dongXuatExcel([muc({ ma_san_pham: ma })], 'LG', lt, MS).dong.length;
    ok('đúng mã → bị loại', x('65UR8050PSB'), 0);
    ok('khác hoa/thường, thừa dấu cách → vẫn bị loại', x('  65ur8050psb '), 0);
    ok('mã dài hơn (chứa mã cấm) → KHÔNG bị loại', x('65UR8050PSBX'), 1);
    ok('mã ngắn hơn (tiền tố) → KHÔNG bị loại', x('65UR8050PS'), 1);
  }

  console.log('\n6) Danh sách model — lượt ghi dọn và áp trần, lượt đọc thì không');
  {
    ok('khối chữ nhiều dòng / dấu phẩy → danh sách, bỏ trùng, giữ thứ tự',
       B.chuanHoaDsModel('65UR8050PSB\n  oled65c4psa , 65ur8050psb;\n\n43UT7300'),
       { ds: ['65UR8050PSB', 'oled65c4psa', '43UT7300'], loi: null });
    ok('mảng cũng nhận', B.chuanHoaDsModel(['A1', null, 'a1', 'B2']).ds, ['A1', 'B2']);
    ok('rỗng → danh sách rỗng hợp lệ', B.chuanHoaDsModel(''), { ds: [], loi: null });
    ok('model quá dài → từ chối, không cắt',
       B.chuanHoaDsModel('X'.repeat(B.DAI_MODEL_TOI_DA + 1)).loi, 'model-qua-dai');
    const nhieu = Array.from({ length: B.MODEL_LOAI_TRU_TOI_DA + 1 }, (_, i) => 'M' + i);
    ok('quá trần số model → từ chối, không cắt im lặng',
       B.chuanHoaDsModel(nhieu).loi, 'qua-nhieu-model');

    /* Firebase trả mảng thưa thành đối tượng khoá số. Đọc nhầm nó thành
       rỗng là xuất đúng những model đang bị cấm. */
    ok('mảng thưa từ Firebase vẫn đọc đủ',
       B.donModelLoaiTru({ ds: { 0: 'A', 2: 'B' } }).ds, ['A', 'B']);
    ok('lượt ĐỌC không áp trần', B.donModelLoaiTru({ ds: nhieu }).ds.length, nhieu.length);
    ok('nhánh chưa có gì → rỗng dùng được', B.donModelLoaiTru(null),
       { ds: [], sua_luc: null, sua_boi: null });
  }

  console.log('\n7) Cờ loai_tru_xuat trên bảng — cùng phép so với lúc xuất');
  {
    const bang = { ngay: [{ ngay: '2026-09-03', don: [{
      so_ct: 'BH1', ten_khach: 'A', dien_thoai: '09', dia_chi: 'HN', dong: [
        { khoa: 'k1', ma_san_pham: 'Tivi LG', ma_hien: '65UR8050PSB', so_luong: 1,
          imei: 'I1', hang: 'LG' },
        { khoa: 'k2', ma_san_pham: 'Tivi LG', ma_hien: '43UT7300', so_luong: 1,
          imei: 'I2', hang: 'LG' },
      ] }] }] };
    const ds = B.dsKichHoat(bang, {});
    const xe = B.ganLoaiTruXuat(ds, { LG: { model_loai_tru: { ds: ['65ur8050psb'] } } });
    ok('trả danh sách đã dọn của LG', xe.LG.model_loai_tru.ds, ['65ur8050psb']);
    const co = Object.fromEntries(ds.hang.LG.chua.map((m) => [m.khoa, m.loai_tru_xuat]));
    ok('dòng model cấm có cờ, dòng khác không', [co.k1, co.k2], [true, false]);
    ok('không có nhánh nào → vẫn có khối LG, rỗng',
       B.ganLoaiTruXuat(B.dsKichHoat(bang, {}), {}).LG.model_loai_tru.ds, []);
    ok('hãng không có form không mang cờ', ds.hang.Samsung.chua.length, 0);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
