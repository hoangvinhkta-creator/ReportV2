/* PHÂN LOẠI THỦ CÔNG — hãng và ngành hàng cho dòng KHÔNG có mã bảng giá.
 * Chủ dự án chốt 19/09/2026.
 *
 * Bộ này canh sáu chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. BẢNG PHÂN LOẠI TAY ĐÈ LÊN BẢNG GIÁ. Bảng giá Tracking là nguồn dùng
 *     chung của ba app. Một bảng riêng của Báo cáo mà đè được lên nó là hai
 *     app nói hai câu khác nhau về cùng một mặt hàng, và không ai biết cho
 *     tới lúc số lệch. Mã LUÔN thắng.
 *  B. QUYẾT ĐỊNH BỊ MẤT KHI NHẬP LẠI. Khoá phải là tên hàng đã chuẩn hoá —
 *     đúng khoá `inv/map`, dùng lại chứ không viết bản thứ hai — nên nó bền
 *     qua mọi lần nhập lại và áp cho MỌI kỳ (CLAUDE.md).
 *  C. QUYẾT ĐỊNH MỒ CÔI BIẾN MẤT IM LẶNG. Kỳ đang xem không có dòng nào
 *     mang tên ấy thì quyết định vẫn phải được ĐẾM và GIỮ (CLAUDE.md).
 *  D. PHÂN LOẠI MỘT KHOẢN TIỀN. Chiết khấu là phép trừ của cả đơn, phụ phí
 *     cố định là tiền công — không cái nào là mặt hàng để xếp vào ngành.
 *  E. DANH SÁCH HÃNG THÀNH DANH SÁCH MỞ. CLAUDE.md cấm bộ phân loại thương
 *     hiệu thứ hai: giá trị chọn được phải là giá trị CÓ THẬT trên bảng giá.
 *  F. NGUỒN HỎNG TRẢ RỖNG. Danh sách hãng rỗng đọc lên thành "Tracking
 *     không có hãng nào" — một kết luận nghiệp vụ thay cho sự cố mạng.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const P = await import('file://' + path.join(GOC, 'engine/src/phan-loai.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));

  /** Một dòng hàng trên bảng đơn đã qua khớp mã. */
  const d = (ten, them) => ({
    ma_san_pham: ten, so_luong: 1, tong_ban: 100,
    ma_bang_gia: null, khoa_ten: K.khoaTenHang(ten),
    hang: null, nganh_hang: null,
    la_chiet_khau: false, la_phu_phi_co_dinh: null,
    ...(them || {}),
  });
  const bang = (ds) => ({ ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', dong: ds }] }] });
  const dong1 = (b) => b.ngay[0].don[0].dong[0];

  const HITACHI = 'Tủ lạnh Hitachi R-FVY480PGV9';
  const K_HITACHI = K.khoaTenHang(HITACHI);

  console.log('\nB) Khoá — dùng lại ĐÚNG công thức của inv/map');
  {
    /* Hai công thức khoá là hai bảng trôi khỏi nhau, và triệu chứng duy nhất
       là "phân loại rồi mà vẫn hiện chưa phân loại" — rất khó lần ra. */
    ok('khoaPhanLoai CHÍNH LÀ khoaTenHang', P.khoaPhanLoai, K.khoaTenHang);
    ok('  · nên hai bên ra cùng một khoá', P.khoaPhanLoai(HITACHI), K_HITACHI);

    /* Khoá theo TÊN nên áp cho mọi dòng mang tên ấy, ở mọi đơn, mọi kỳ —
       đúng loại "MỘT MẶT HÀNG" của CLAUDE.md. Khoá theo dòng là bắt người
       dùng trả lời cùng một câu hỏi bốn mươi lần một tháng. */
    const b = bang([d(HITACHI), d(HITACHI), d('Tivi Sony 55X80L')]);
    P.apPhanLoaiTay(b, { [K_HITACHI]: { hang: 'Hitachi', nganh: 'Tủ lạnh' } });
    const ds = b.ngay[0].don[0].dong;
    ok('một quyết định áp cho MỌI dòng cùng tên',
       ds.map((x) => x.hang), ['Hitachi', 'Hitachi', null]);
    ok('  · và đếm đủ số dòng đã áp', b.tom_tat_phan_loai_tay.so_dong, 2);
    ok('  · nhưng chỉ đếm MỘT tên', b.tom_tat_phan_loai_tay.so_ten, 1);
    ok('  · dòng không có quyết định thì KHÔNG bị đụng',
       ds[2].nganh_hang, null);
    ok('  · dòng đã áp mang cờ để màn hình phân biệt được',
       [ds[0].phan_loai_tay, ds[2].phan_loai_tay], [true, undefined]);
  }

  console.log('\nA) Mã bảng giá LUÔN THẮNG');
  {
    const b = bang([d(HITACHI, { ma_bang_gia: 'RF-480', hang: 'Hitachi',
                                 nganh_hang: 'Tủ lạnh (bảng giá)' })]);
    P.apPhanLoaiTay(b, { [K_HITACHI]: { hang: 'Samsung', nganh: 'Tivi' } });
    ok('dòng CÓ mã không bị bảng tay đè', dong1(b).hang, 'Hitachi');
    ok('  · kể cả ngành hàng', dong1(b).nganh_hang, 'Tủ lạnh (bảng giá)');
    ok('  · và không bị dán cờ phân loại tay', dong1(b).phan_loai_tay, undefined);
    /* Quyết định KHÔNG mất — nó nằm im và vẫn được đếm, để lượt rút mã sau
       này áp lại được. Đây chính là ca "mồ côi" của CLAUDE.md. */
    ok('  · nhưng quyết định vẫn được GIỮ và đếm',
       b.tom_tat_phan_loai_tay.mo_coi, [K_HITACHI]);
  }

  console.log('\nC) Quyết định mồ côi — đếm và giữ, không im lặng bỏ qua');
  {
    const b = bang([d('Tivi Sony 55X80L')]);
    const qd = { [K_HITACHI]: { hang: 'Hitachi', nganh: 'Tủ lạnh' },
                 [K.khoaTenHang('Máy giặt LG')]: { hang: 'LG', nganh: null } };
    P.apPhanLoaiTay(b, qd);
    ok('kỳ này không có dòng nào mang tên ấy → mồ côi',
       b.tom_tat_phan_loai_tay.mo_coi.length, 2);
    ok('  · liệt kê ĐỦ từng khoá, không cắt bớt',
       b.tom_tat_phan_loai_tay.mo_coi, [K_HITACHI, K.khoaTenHang('Máy giặt LG')].sort());
    ok('  · và không áp nhầm lên dòng nào', dong1(b).hang, null);

    /* Dòng xuất hiện trở lại thì quyết định tự áp lại — không cần ai bấm. */
    const b2 = bang([d(HITACHI)]);
    P.apPhanLoaiTay(b2, qd);
    ok('dòng xuất hiện lại → tự áp trở lại', dong1(b2).hang, 'Hitachi');
    ok('  · và khoá ấy hết mồ côi',
       b2.tom_tat_phan_loai_tay.mo_coi, [K.khoaTenHang('Máy giặt LG')]);
  }

  console.log('\nD) KHÔNG phân loại một khoản tiền');
  {
    const b = bang([
      d('Chiết khấu', { la_chiet_khau: true }),
      d('Phí vận chuyển', { la_phu_phi_co_dinh: 'Vận chuyển' }),
    ]);
    P.apPhanLoaiTay(b, {
      [K.khoaTenHang('Chiết khấu')]: { hang: 'Samsung', nganh: 'Tivi' },
      [K.khoaTenHang('Phí vận chuyển')]: { hang: 'LG', nganh: 'Tủ lạnh' },
    });
    const ds = b.ngay[0].don[0].dong;
    ok('chiết khấu KHÔNG nhận phân loại', ds[0].hang, null);
    ok('phụ phí cố định cũng vậy', ds[1].hang, null);
    ok('  · và cả hai quyết định ấy thành mồ côi, không biến mất',
       b.tom_tat_phan_loai_tay.mo_coi.length, 2);
  }

  console.log('\n2) Một nửa quyết định vẫn là một quyết định');
  {
    const b = bang([d(HITACHI)]);
    P.apPhanLoaiTay(b, { [K_HITACHI]: { hang: 'Hitachi', nganh: null } });
    ok('chỉ có hãng thì chỉ điền hãng', dong1(b).hang, 'Hitachi');
    ok('  · ngành vẫn để trống, KHÔNG bịa', dong1(b).nganh_hang, null);

    const b2 = bang([d(HITACHI)]);
    P.apPhanLoaiTay(b2, { [K_HITACHI]: { hang: '   ', nganh: '  ' } });
    ok('hai ô rỗng KHÔNG phải một quyết định', dong1(b2).hang, null);
    ok('  · và không bị đếm thành mồ côi', b2.tom_tat_phan_loai_tay.mo_coi, []);
  }

  console.log('\n3) Chạy được cả khi dòng chưa qua khớp mã (Tracking hỏng)');
  {
    /* Tracking hỏng thì `khopMaChoBangDon` không chạy, nên dòng không mang
       `khoa_ten`. Quyết định của NGƯỜI không có lý do gì phải biến mất chỉ
       vì một nhánh phụ không trả lời. */
    const b = bang([{ ma_san_pham: HITACHI, so_luong: 1, tong_ban: 100,
                      hang: null, nganh_hang: null, la_chiet_khau: false }]);
    P.apPhanLoaiTay(b, { [K_HITACHI]: { hang: 'Hitachi', nganh: 'Tủ lạnh' } });
    ok('khoá tự tính lại từ tên hàng', dong1(b).hang, 'Hitachi');
  }

  console.log('\n4) Bảng quyết định rỗng / sai kiểu — không nổ, không đụng gì');
  {
    for (const [ten, qd] of [['null', null], ['rỗng', {}], ['mảng', []],
                             ['chuỗi', 'x'], ['số', 7]]) {
      const b = bang([d(HITACHI)]);
      P.apPhanLoaiTay(b, qd);
      ok('bảng ' + ten + ' → không dòng nào bị đụng', dong1(b).hang, null);
      ok('  · và vẫn có bản kê', b.tom_tat_phan_loai_tay.so_dong, 0);
    }
    const b = bang([]);
    P.apPhanLoaiTay(b, { [K_HITACHI]: { hang: 'Hitachi' } });
    ok('bảng đơn rỗng cũng không nổ', b.tom_tat_phan_loai_tay.so_dong, 0);
  }

  console.log('\nE+F) mucPhanLoai — danh sách ĐÓNG, lấy từ bảng giá');
  {
    const nguon = { board: {
      'RF-1': { brand: 'Hitachi', category_label: 'Tủ lạnh' },
      'RF-2': { brand: 'hitachi', category_label: 'Tủ lạnh' },
      'TV-1': { brand: 'Sony', category_label: 'Tivi' },
      'TV-2': { brand: '  ', category_label: null },
      'XX-1': { brand: 'Áo', category_label: 'Gia dụng - Bosch' },
      'XX-2': 'không phải đối tượng',
    } };
    const m = P.mucPhanLoai(nguon);
    /* Hoa/thường lệch nhau là chuyện có thật với chữ gõ tay bên bảng giá —
       hai mục "Hitachi"/"hitachi" trong trình chọn là hai lựa chọn trông
       giống hệt nhau, và chọn nhầm cái thứ hai là một hãng thứ mười một
       không có màu. */
    ok('gộp hoa/thường thành MỘT mục', m.hang, ['Áo', 'Hitachi', 'Sony']);
    ok('  · giữ cách viết gặp đầu tiên', m.hang.indexOf('Hitachi') >= 0, true);
    ok('  · ô trống và giá trị lạ bị bỏ qua', m.hang.indexOf('') , -1);
    ok('ngành hàng cũng vậy', m.nganh, ['Gia dụng - Bosch', 'Tivi', 'Tủ lạnh']);
    /* Sắp theo tiếng Việt: "Áo" phải đứng trước "Hitachi", không phải sau
       mọi chữ Latin như thứ tự mã Unicode thô. */
    ok('sắp theo bảng chữ cái tiếng Việt', m.hang[0], 'Áo');

    /* F — nguồn hỏng thì NÉM, không trả rỗng (CLAUDE.md). */
    for (const [ten, n] of [['null', null], ['không có board', {}],
                            ['board rỗng', { board: {} }],
                            ['board sai kiểu', { board: [] }]]) {
      let nem = false;
      try { P.mucPhanLoai(n); } catch { nem = true; }
      ok('nguồn ' + ten + ' → NÉM, không trả danh sách rỗng', nem, true);
    }
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
