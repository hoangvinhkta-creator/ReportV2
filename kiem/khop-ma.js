/* KHỚP TÊN HÀNG → MÃ BẢNG GIÁ (engine/src/khop-ma.mjs).
 *
 * Bộ này canh bốn thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. KHOÁ LỆCH VỚI TRACKING. Công thức khoá `inv/map` phải giống HỆT bản
 *     của Tracking. Lệch một ký tự là quyết định gán tay của hai app rơi vào
 *     hai ô khác nhau — không ai thấy cho tới lúc giá vốn sai. Chạy CHÍNH mã
 *     của Tracking cạnh mã của repo này, cộng một loạt giá trị ghim tuyệt
 *     đối cho trường hợp không có repo Tracking bên cạnh.
 *
 *  B. KHỚP SAI MÃ. `65C6K` và `65C6KS` là hai model khác nhau — chủ dự án
 *     nêu đích danh ca này. Dò chuỗi con thì `"65C6KS"` chứa `"65C6K"` và
 *     một chiếc tivi bị gán sang model khác, sai tiền và im lặng. Bộ này
 *     dựng đúng cảnh ấy.
 *
 *  C. ĐOÁN THAY NGƯỜI. Hai mã trong một câu, một cụm bị hai mã cùng nhận,
 *     một mục từ điển toàn chữ — cả ba phải xuống HÀNG CHỜ, không được đoán.
 *     Và quyết định của người phải thắng mọi phép khớp của máy, kể cả `"-"`.
 *
 *  D. TRẢ RỖNG THAY VÌ BÁO LỖI. Bảng giá Tracking hỏng mà trả một bảng "mọi
 *     dòng đều chưa khớp" là để một sự cố mạng nói một KẾT LUẬN NGHIỆP VỤ
 *     thay người (CLAUDE.md). Phải NÉM LỖI.
 */
const path = require('path');
const { ok, xong, cat, coTracking, docTracking, TRK } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));

  /* ─────────── A. Khoá phải khớp Tracking ─────────── */

  console.log('\nA) Công thức khoá inv/map');

  /* Ghim TUYỆT ĐỐI — chạy cả khi không có repo Tracking bên cạnh. Đây đúng
     những giá trị `kiem/phan-loai-ten-hang.js` bên Tracking đang canh. */
  ok('dấu tiếng Việt bị XOÁ, không quy về chữ không dấu',
    K.khoaTenHang('Tủ lạnh Sharp SJ-X198V-DG'), 'N_TLNHSHARPSJX198VDG');
  ok('bỏ mọi ký tự ngoài A-Z0-9',
    K.khoaTenHang('Tivi 75" Q6FA, model 2026'), 'N_TIVI75Q6FAMODEL2026');
  ok('câu rỗng ra khoá trần', K.khoaTenHang(''), 'N_');
  ok('cắt ở 80 ký tự', K.khoaTenHang('A'.repeat(200)).length, 82);
  ok('null ra khoá trần', K.khoaTenHang(null), 'N_');

  /* Phép chéo hai repo — chạy CHÍNH `invKeyOfName()` của Tracking. */
  if (!coTracking()) {
    console.log('  – BỎ QUA phép chéo với Tracking: không thấy repo ở ' + TRK);
  } else {
    console.log('  (đối chiếu với repo Tracking ở ' + TRK + ')');
    const js = docTracking('public/index.html')
      .match(/<script>([\s\S]*?)<\/script>/)[1];
    const banTracking = eval('(function(){\n'
      + cat(js, /function normCode\(c\)\{[^\n]*\n/)
      + cat(js, /const invKeyOfName = [^\n]*\n/)
      + 'return invKeyOfName;\n})()');

    const CAU = [
      'Tủ lạnh Sharp SJ-X198V-DG',
      'Chân máy giặt Đa Năng - chiều',
      'Tivi TCL 65C6K', 'Tivi TCL 65C6KS',
      'Điều hoà Daikin FTKB35YVMV / RKB35YVMV',
      'Tivi 75" Q6FA, model 2026',
      '  khoảng trắng hai đầu  ', 'A'.repeat(200), '', '---',
    ];
    for (const c of CAU)
      ok('khoá khớp Tracking: ' + (c.length > 26 ? c.slice(0, 26) + '…' : c || '(rỗng)'),
        K.khoaTenHang(c), banTracking(c));
  }

  /* ─────────── Bảng giá giả, dựng đúng hình dạng /api/xuat/ ─────────── */

  /* `alt` là MẢNG ở đầu ra `/api/xuat/board` (Tracking cắt chuỗi ngăn phẩy
     trước khi trả). Dựng sai hình dạng này là bài kiểm chạy trên một thế giới
     không có thật. */
  const BOARD = {
    '65C6K':      { name: '65C6K', alt: [], brand: 'TCL', category_label: 'Tivi' },
    '65C6KS':     { name: '65C6KS', alt: [], brand: 'TCL', category_label: 'Tivi' },
    'X198VDGEN':  { name: 'SJ-X198V-DG', alt: ['X198V'], brand: 'Sharp', category_label: 'Tủ lạnh' },
    'K65S20M2':   { name: 'K-65S20M2', alt: [], brand: 'Sony', category_label: 'Tivi' },
    'K55S20M2':   { name: 'K-55S20M2', alt: [], brand: 'Sony', category_label: 'Tivi' },
    'QUAT':       { name: 'Quạt', alt: [], brand: null, category_label: 'Quạt' },
    'MACU':       { name: 'NR-BX471', alt: [], brand: 'Panasonic', category_label: 'Tủ lạnh' },
    'MAMOI':      { name: 'NR-BX999', alt: [], brand: 'Panasonic', category_label: 'Tủ lạnh' },
  };
  const ALIAS = { MACU: 'MAMOI' };
  const bo = (invMap) => K.dungBoKhop({ board: BOARD, alias: ALIAS, inv_map: invMap || {} });

  /* ─────────── B. Khớp tự động, và chỗ nó phải KHÔNG khớp ─────────── */

  console.log('\nB) Khớp cụm trọn trong tên');

  let b = bo();
  ok('khớp mã đứng riêng thành một từ',
    K.khopTenHang('Tivi TCL 65C6K', b), { ma: '65C6K', nguon: 'tu-dong', khoa: 'N_TIVITCL65C6K', ly_do: null });

  /* Ca chủ dự án nêu đích danh. Dò chuỗi con là gán nhầm ở đúng đây. */
  ok('65C6KS KHÔNG bị nuốt thành 65C6K',
    K.khopTenHang('Tivi TCL 65C6KS', b).ma, '65C6KS');
  ok('65C6K KHÔNG khớp sang 65C6KS',
    K.khopTenHang('Tivi TCL 65C6K', b).ma, '65C6K');

  /* Ca NGUY HIỂM NHẤT, và là lý do phép khớp chạy trên biên từ: bảng giá có
     `65C6K` nhưng KHÔNG có `65C6KS`. Dò chuỗi con thì `"65C6KS"` chứa
     `"65C6K"`, chỉ khớp được đúng một mã, nên không có phép "nhiều mã" nào
     cứu — máy gán thẳng chiếc tivi sang model khác, im lặng, và tiền sai.
     Khớp theo token thì `65C6KS` đơn giản không phải `65C6K`. */
  {
    const chiCoMaNgan = { '65C6K': BOARD['65C6K'] };
    const bn = K.dungBoKhop({ board: chiCoMaNgan, alias: {}, inv_map: {} });
    ok('mã dài KHÔNG có trên bảng giá thì xuống gán tay, KHÔNG gán sang mã ngắn',
      K.khopTenHang('Tivi TCL 65C6KS', bn),
      { ma: null, nguon: null, khoa: 'N_TIVITCL65C6KS', ly_do: 'chua-khop' });
    ok('cùng bảng giá ấy, mã ngắn vẫn khớp đúng',
      K.khopTenHang('Tivi TCL 65C6K', bn).ma, '65C6K');
  }

  ok('khớp mã nhiều từ (gạch nối tách thành ba từ)',
    K.khopTenHang('Tủ lạnh Sharp SJ-X198V-DG', b).ma, 'X198VDGEN');
  ok('name và alt cùng trỏ một mã vẫn là MỘT mã',
    K.khopTenHang('Tủ lạnh SJ-X198V-DG (X198V)', b).ma, 'X198VDGEN');
  ok('khớp được qua alt',
    K.khopTenHang('Tủ lạnh Sharp X198V', b).ma, 'X198VDGEN');

  ok('mã dính liền trong câu vẫn khớp (khoá board là một từ)',
    K.khopTenHang('Tu lanh X198VDGEN', b).ma, 'X198VDGEN');

  /* Mã bị cắt rời bởi khoảng trắng KHÔNG còn là token ấy nữa — bỏ sót, và
     bỏ sót là đúng: dòng xuống gán tay chứ không gán bừa. */
  ok('mã bị gõ tách làm đôi thì KHÔNG khớp',
    K.khopTenHang('Tivi TCL 65 C6K', b).ly_do, 'chua-khop');

  ok('không có mã nào trong câu → chưa khớp',
    K.khopTenHang('Chân máy giặt Đa Năng - chiều', b),
    { ma: null, nguon: null, khoa: 'N_CHNMYGITANNGCHIU', ly_do: 'chua-khop' });

  /* ─────────── C. Không đoán thay người ─────────── */

  console.log('\nB2) Nguyên câu bằng sạch một mục bảng giá — ca thật 12/09/2026');
  {
    /* Màn Tồn kho của Tracking có nhánh "thêm mã mới" ghi `board/<mã>` bằng
       NGUYÊN CÂU tên hàng trong file tồn. Chủ dự án gặp thật: bảng giá có
       mục mã là cả câu mười từ, dòng bán mang đúng y nguyên câu ấy, mà vẫn
       rơi xuống hàng chờ vì câu dài hơn trần `CUM_TOI_DA` (8 từ) nên không
       vào từ điển cụm. Tệ hơn: ở hàng chờ thì gán tay CŨNG không xong —
       chính mặt hàng ấy đang là dòng tồn kho hoạt động nên chốt NB-2 bên
       Tracking từ chối. Người dùng kẹt giữa hai màn hình. */
    const CAU = 'GIÁ TREO TIVI ĐA NĂNG ERGOTEK E66 32 - 80 INCH';
    const bo = K.dungBoKhop({ board: { [CAU]: { name: CAU, alt: [] } }, alias: {}, inv_map: {} });
    ok('mục dài 10 từ KHÔNG vào từ điển cụm (trần cũ giữ nguyên)', bo.cum.size, 0);
    ok('nhưng nguyên câu bằng sạch thì vẫn khớp', K.khopTenHang(CAU, bo).ma, CAU);
    ok('  · và ghi rõ là máy khớp', K.khopTenHang(CAU, bo).nguon, 'tu-dong');
    /* ĐIỀU KHÔNG ĐƯỢC PHÉP ĐỔI: mục dài chỉ tham gia phép so NGUYÊN CÂU,
       KHÔNG bao giờ được làm một cụm con nằm trong câu dài hơn. Mất tính
       chất này là trần `CUM_TOI_DA` mất tác dụng — đúng thứ nó sinh ra để
       chặn: một mục từ điển dài nuốt mấy từ thường gặp của câu văn xuôi. */
    ok('câu DÀI HƠN chứa trọn mục ấy thì KHÔNG khớp',
      K.khopTenHang(CAU + ' loại 2', bo).ma, null);
    ok('  · và xuống hàng chờ với lý do rõ', K.khopTenHang(CAU + ' loại 2', bo).ly_do, 'chua-khop');

    /* Rào CHỮ SỐ giữ nguyên cho cả bậc này: nhánh "thêm mã mới" cũng đẻ ra
       được một mục tên trần kiểu "Tủ lạnh", và để một dòng bán ghi đúng hai
       chữ ấy khớp vào đó là gán một mặt hàng thật vào một mã rác. */
    const boChu = K.dungBoKhop({ board: { 'Tủ lạnh': { name: 'Tủ lạnh', alt: [] } },
      alias: {}, inv_map: {} });
    ok('nguyên câu KHÔNG có chữ số thì vẫn không khớp',
      K.khopTenHang('Tủ lạnh', boChu).ma, null);

    /* Hai mã cùng nhận nguyên một câu ⟹ hàng chờ, và KHÔNG rơi tiếp xuống
       phép dò cụm: nhập nhằng ở bậc chặt nhất thì bậc lỏng hơn càng không
       gỡ được. */
    const boDoi = K.dungBoKhop({ board: {
      'MA1': { name: 'Tivi ABC 123', alt: [] },
      'MA2': { name: 'Tivi ABC 123', alt: [] },
    }, alias: {}, inv_map: {} });
    ok('hai mã cùng nhận nguyên một câu ⟹ hàng chờ',
      K.khopTenHang('Tivi ABC 123', boDoi).ly_do, 'nhieu-ma');

    /* Quyết định của NGƯỜI vẫn thắng bậc mới này, đúng thứ tự CLAUDE.md. */
    const boNg = K.dungBoKhop({ board: { [CAU]: { name: CAU, alt: [] }, 'KHAC9': { name: 'KHAC9', alt: [] } },
      alias: {}, inv_map: { [K.khoaTenHang(CAU)]: 'KHAC9' } });
    ok('quyết định trong inv/map vẫn thắng phép so nguyên câu',
      K.khopTenHang(CAU, boNg).ma, 'KHAC9');
    ok('  · và "bỏ qua" của người cũng vậy',
      K.khopTenHang(CAU, K.dungBoKhop({ board: { [CAU]: { name: CAU, alt: [] } },
        alias: {}, inv_map: { [K.khoaTenHang(CAU)]: '-' } })).nguon, 'bo-qua');
  }

  console.log('\nC) Chỗ máy phải im và nhường cho người');

  ok('hai mã trong một câu → hàng chờ, không chọn bên nào',
    K.khopTenHang('Tivi Sony K-65S20M2 (thay thế K-55S20M2)', b).ly_do, 'nhieu-ma');
  ok('hai mã trong một câu thì KHÔNG ra mã nào',
    K.khopTenHang('Tivi Sony K-65S20M2 (thay thế K-55S20M2)', b).ma, null);

  /* Rào an toàn: mục từ điển toàn chữ không được vào từ điển, nếu không nó
     nuốt đúng những từ thường gặp trong câu văn xuôi của sổ. */
  ok('mã toàn chữ ("Quạt") không tự khớp',
    K.khopTenHang('Quạt Panasonic để bàn', b).ly_do, 'chua-khop');

  /* Alias: quyết định gộp mã là của người, dòng phải chảy theo. */
  ok('khớp tự động đi qua alias về mã chính',
    K.khopTenHang('Tủ lạnh Panasonic NR-BX471', b).ma, 'MAMOI');

  /* Bậc 1 & 2 — quyết định của người thắng máy. */
  let bq = bo({ N_TIVITCL65C6K: '65C6KS' });
  ok('quyết định của người ĐÈ phép khớp của máy',
    K.khopTenHang('Tivi TCL 65C6K', bq), { ma: '65C6KS', nguon: 'quyet-dinh', khoa: 'N_TIVITCL65C6K', ly_do: null });

  bq = bo({ N_TIVITCL65C6K: '-' });
  ok('"-" là một quyết định, không phải giá trị rỗng',
    K.khopTenHang('Tivi TCL 65C6K', bq), { ma: null, nguon: 'bo-qua', khoa: 'N_TIVITCL65C6K', ly_do: null });
  ok('"bỏ qua" KHÔNG rơi xuống khớp tự động',
    K.khopTenHang('Tivi TCL 65C6K', bq).nguon, 'bo-qua');

  bq = bo({ N_CHNMYGITANNGCHIU: 'X198VDGEN' });
  ok('gán tay cứu được câu máy chịu thua',
    K.khopTenHang('Chân máy giặt Đa Năng - chiều', bq).ma, 'X198VDGEN');

  bq = bo({ N_TIVITCL65C6K: 'MACU' });
  ok('quyết định trỏ mã phụ vẫn quy về mã chính',
    K.khopTenHang('Tivi TCL 65C6K', bq).ma, 'MAMOI');

  /* Mã bị xoá khỏi bảng giá sau khi người ta gán: không hiện mã chết, và
     cũng không lặng lẽ tự khớp lại. */
  bq = bo({ N_TIVITCL65C6K: 'DA-BI-XOA' });
  ok('quyết định trỏ mã đã xoá → nói ra, không tự khớp lại',
    K.khopTenHang('Tivi TCL 65C6K', bq), { ma: null, nguon: null, khoa: 'N_TIVITCL65C6K', ly_do: 'ma-da-xoa' });

  /* ─────────── D. Nguồn hỏng phải NÉM LỖI ─────────── */

  console.log('\nD) Nguồn hỏng thì báo lỗi, không trả rỗng');

  const nem = (f) => { try { f(); return false; } catch (e) { return true; } };
  ok('bảng giá rỗng → ném lỗi', nem(() => K.dungBoKhop({ board: {} })), true);
  ok('không có bảng giá → ném lỗi', nem(() => K.dungBoKhop({})), true);
  ok('bảng giá sai kiểu → ném lỗi', nem(() => K.dungBoKhop({ board: [] })), true);
  ok('nguồn là null → ném lỗi', nem(() => K.dungBoKhop(null)), true);
  /* `inv_map` rỗng thì KHÁC — "chưa ai phân loại dòng nào" là trạng thái
     thật của một hệ vừa triển khai, không phải nguồn hỏng. */
  ok('inv_map rỗng KHÔNG phải nguồn hỏng',
    nem(() => K.dungBoKhop({ board: BOARD, inv_map: {} })), false);

  /* ─────────── Bảng đơn: điền mã, hãng, ngành hàng, và bản kê còn nợ ─────────── */

  console.log('\nE) Điền vào bảng đơn hàng');

  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const dg = (o) => ({
    ngay: o.ngay || '2026-09-08', so_ct: o.ct, ten_hang: o.ten,
    so_luong: 1, don_gia: o.tien, doanh_so: o.tien,
    chiet_khau: o.ck || 0, nhan_vien: 'Tín Phát 0869931931', imei: null,
  });
  const DONG = {
    a: dg({ ct: 'BH1', ten: 'Tivi TCL 65C6K', tien: 9000000 }),
    b: dg({ ct: 'BH1', ten: 'Chân máy giặt Đa Năng - chiều', tien: 200000, ck: 50000 }),
    c: dg({ ct: 'BH2', ten: 'Chân máy giặt Đa Năng - chiều', tien: 200000 }),
    d: dg({ ct: 'BH2', ten: 'Tủ lạnh Sharp SJ-X198V-DG', tien: 12000000 }),
  };
  const BANG_LINE = { 'Tín Phát': { thu_tu: 1, nguon: ['Tín Phát 0869931931'] } };

  const bang = D.dungBangDon(DONG, {}, BANG_LINE, null);
  K.khopMaChoBangDon(bang, { board: BOARD, alias: ALIAS, inv_map: {} });

  const moiDong = [];
  for (const ng of bang.ngay) for (const don of ng.don) for (const d of don.dong) moiDong.push(d);
  const tim = (ten) => moiDong.find(d => d.ma_san_pham === ten);

  ok('dòng khớp được có mã', tim('Tivi TCL 65C6K').ma_bang_gia, '65C6K');
  ok('dòng khớp được ghi rõ nguồn là máy', tim('Tivi TCL 65C6K').nguon_ma, 'tu-dong');
  /* Hãng và ngành hàng tra THẲNG từ bảng giá — không dựng bộ phân loại
     thương hiệu thứ hai (CLAUDE.md). */
  ok('hãng lấy từ bảng giá', tim('Tivi TCL 65C6K').hang, 'TCL');
  ok('ngành hàng lấy từ bảng giá', tim('Tivi TCL 65C6K').nganh_hang, 'Tivi');
  ok('Tracking không dám khẳng định hãng thì để null, không đoán',
    tim('Tủ lạnh Sharp SJ-X198V-DG').hang, 'Sharp');

  ok('dòng chưa khớp không có mã', tim('Chân máy giặt Đa Năng - chiều').ma_bang_gia, null);
  ok('dòng chưa khớp nói rõ lý do', tim('Chân máy giặt Đa Năng - chiều').ly_do_chua_ma, 'chua-khop');
  ok('dòng chưa khớp vẫn mang khoá để gán tay',
    tim('Chân máy giặt Đa Năng - chiều').khoa_ten, 'N_CHNMYGITANNGCHIU');

  /* Giá vốn/lợi nhuận thuộc lát cắt sau — lát này không được chạm vào. */
  ok('giá nhập vẫn để trống ở lát cắt này', tim('Tivi TCL 65C6K').gia_nhap, null);
  ok('lợi nhuận vẫn để trống ở lát cắt này', tim('Tivi TCL 65C6K').loi_nhuan, null);

  /* Dòng chiết khấu là một phép trừ của cả đơn, không phải mặt hàng — đưa nó
     vào hàng chờ gán mã là mời người dùng phân loại một con số. */
  const ck = moiDong.find(d => d.la_chiet_khau);
  ok('có dòng chiết khấu để soi', !!ck, true);
  ok('dòng chiết khấu không vào hàng chờ', ck.nguon_ma, 'khong-phai-hang');
  ok('dòng chiết khấu không mang khoá tên', ck.khoa_ten, null);
  /* Cùng một hình dạng dòng cho cả hai loại — màn hình đọc một bộ trường,
     không phải nhớ dòng nào có trường nào. */
  ok('dòng chiết khấu vẫn đủ trường như dòng hàng',
    [ck.ma_bang_gia, ck.ly_do_chua_ma], [null, null]);

  const tt = bang.tom_tat_ma;
  ok('đếm đúng số dòng hàng thật (không tính chiết khấu)', tt.tong_dong, 4);
  ok('đếm đúng số dòng đã có mã', tt.da_co_ma, 2);
  ok('đếm đúng số dòng máy tự khớp', tt.tu_dong, 2);
  ok('đếm đúng số dòng còn nợ mã', tt.chua_co_ma, 2);

  /* Hàng chờ gom theo TÊN chứ không theo dòng: gán một tên là xong mọi dòng
     mang tên đó. Hai dòng cùng tên ở hai đơn khác nhau ⟹ MỘT mục. */
  ok('hàng chờ gom theo tên, không theo dòng', tt.chua_khop.length, 1);
  ok('mục hàng chờ nói rõ có bao nhiêu dòng chịu ảnh hưởng',
    tt.chua_khop[0], { ten: 'Chân máy giặt Đa Năng - chiều',
      khoa: 'N_CHNMYGITANNGCHIU', ly_do: 'chua-khop', so_dong: 2 });

  /* Gán một tên rồi dựng lại: cả hai dòng phải cùng khỏi. */
  const bang2 = D.dungBangDon(DONG, {}, BANG_LINE, null);
  K.khopMaChoBangDon(bang2, { board: BOARD, alias: ALIAS,
    inv_map: { N_CHNMYGITANNGCHIU: 'X198VDGEN' } });
  ok('gán MỘT tên là xong MỌI dòng mang tên đó', bang2.tom_tat_ma.chua_co_ma, 0);
  ok('hàng chờ sạch sau khi gán', bang2.tom_tat_ma.chua_khop.length, 0);
  ok('đếm đúng số dòng do người quyết định', bang2.tom_tat_ma.quyet_dinh, 2);

  /* "-" không phải "đã có mã", cũng không phải "còn nợ" — nó là một cột
     riêng, và gộp nó vào bên nào cũng làm bản kê nói sai. */
  const bang3 = D.dungBangDon(DONG, {}, BANG_LINE, null);
  K.khopMaChoBangDon(bang3, { board: BOARD, alias: ALIAS,
    inv_map: { N_CHNMYGITANNGCHIU: '-' } });
  ok('"bỏ qua" đếm riêng, không lẫn vào đã-có-mã', bang3.tom_tat_ma.bo_qua, 2);
  ok('"bỏ qua" không còn nằm ở hàng chờ', bang3.tom_tat_ma.chua_co_ma, 0);
  ok('"bỏ qua" không được đếm là đã có mã', bang3.tom_tat_ma.da_co_ma, 2);

  /* Bảng giá hỏng phải nổ TRƯỚC khi trả ra một bảng "mọi dòng chưa khớp". */
  const bang4 = D.dungBangDon(DONG, {}, BANG_LINE, null);
  ok('bảng giá hỏng → cả lượt dựng bảng ném lỗi',
    nem(() => K.khopMaChoBangDon(bang4, { board: {} })), true);

  /* ─────────── F. Mốc kỳ: trước 09/2026 KHÔNG khớp gì ─────────── */

  console.log('\nF) Mốc kỳ');

  ok('kỳ 09/2026 nằm trong phạm vi', K.kyCoKhopMa('2026-09'), true);
  ok('kỳ sau đó cũng vậy', K.kyCoKhopMa('2026-10'), true);
  ok('kỳ 08/2026 NGOÀI phạm vi', K.kyCoKhopMa('2026-08'), false);
  ok('kỳ 2025 ngoài phạm vi', K.kyCoKhopMa('2025-12'), false);
  ok('không phải chuỗi thì ngoài phạm vi', K.kyCoKhopMa(null), false);

  {
    const b8 = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b8, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-08');
    const ds8 = [];
    for (const ng of b8.ngay) for (const d of ng.don) for (const x of d.dong) ds8.push(x);
    ok('kỳ ngoài phạm vi: bảng đơn vẫn dựng đủ dòng', ds8.length > 0, true);
    /* Điểm mấu chốt: KHÔNG chạy phép khớp, nên không dòng nào bị gắn "chưa
       khớp". Chạy rồi trả "0 dòng khớp" là mời người dùng gán một đống mã mà
       ở kỳ ấy gán xong cũng không ra được đồng giá vốn nào. */
    ok('  · nhưng KHÔNG dòng nào bị gắn lý do chưa khớp',
      ds8.some((d) => d.ly_do_chua_ma), false);
    ok('  · và nói rõ là ngoài phạm vi, kèm mốc',
      b8.tom_tat_ma, { ngoai_pham_vi: true, tu_ky: '2026-09' });
    ok('  · không có bảng kê hàng chờ', b8.tom_tat_ma.chua_khop, undefined);

    const b9 = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b9, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-09');
    ok('kỳ trong phạm vi vẫn khớp như thường', b9.tom_tat_ma.tu_dong, 2);
  }

  ok('mã cần hỏi giá: chỉ những mã đã khớp, khử trùng và sắp',
    K.maCanGiaVon(DONG, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-09'),
    ['65C6K', 'X198VDGEN']);
  ok('kỳ ngoài phạm vi thì không hỏi mã nào',
    K.maCanGiaVon(DONG, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-08'), []);

  /* ─────────── G. Giá nhập theo ĐÚNG ngày bán ─────────── */

  console.log('\nG) Giá nhập theo ngày bán');

  const bg = (o) => ({ product_code: o.ma, effective_date: o.ngay,
    min_price: o.gia === undefined ? null : o.gia,
    price_status: o.ts || (o.gia === undefined ? 'NO_DATA' : 'OK'),
    day_status: o.ds || 'FINAL', observed_on: o.qs || o.ngay,
    carried_from: (o.qs && o.qs !== o.ngay) ? o.qs : null });

  const veBangGia = (mn, ky) => {
    const b = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b, { board: BOARD, alias: ALIAS, inv_map: {} }, ky || '2026-09');
    K.dienGiaNhap(b, mn);
    const ds = [];
    for (const ng of b.ngay) for (const don of ng.don) for (const x of don.dong) ds.push(x);
    return { b, ds, tim: (t) => ds.find((d) => d.ma_san_pham === t) };
  };

  /* ĐÂY LÀ BÀI QUAN TRỌNG NHẤT CỦA CẢ BỘ. `min_price` đếm bằng NGHÌN đồng
     (`currency_unit: VND_THOUSAND`), mọi con số của Báo cáo đếm bằng ĐỒNG.
     Quên phép nhân 1.000 là sai gấp một nghìn lần, và sai ÊM: 5.250 đọc lên
     vẫn trông y như một cái giá thật. */
  {
    const { tim } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-08', gia: 5250 })], errors: [] });
    ok('min_price 5.250 (nghìn đ) thành 5.250.000 đ', tim('Tivi TCL 65C6K').gia_nhap, 5250000);
    /* Lợi nhuận = tổng bán − giá nhập × số lượng. */
    ok('lợi nhuận = tổng bán − giá nhập × SL',
      tim('Tivi TCL 65C6K').loi_nhuan, 9000000 - 5250000 * 1);
  }

  /* Đơn vị lạ phải NỔ, không được lặng lẽ nhân nhầm. */
  ok('đơn vị tiền khác hợp đồng → ném lỗi',
    nem(() => veBangGia({ currency_unit: 'VND', records: [], errors: [] })), true);
  ok('đơn vị vắng mặt thì vẫn chạy (trang rỗng không khai đơn vị)',
    nem(() => veBangGia({ records: [], errors: [] })), false);

  /* Giá của ĐÚNG NGÀY BÁN, không phải ngày khác. Bản ghi đặt ở ngày 09 mà
     đơn bán ngày 08 thì dòng ấy KHÔNG có giá — hệ Min trả bản ghi cho từng
     ngày đã hỏi, nên "gần đúng ngày" không phải một khái niệm ở đây. */
  {
    const { tim } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-09', gia: 5250 })], errors: [] });
    ok('bản ghi của ngày KHÁC không được dùng cho ngày bán này',
      tim('Tivi TCL 65C6K').gia_nhap, null);
  }

  /* Mốc MANG QUA: hệ Min chỉ ghi khi đổi, nên bản ghi của ngày bán có thể
     được quan sát từ một ngày trước. Đó là bình thường và phải dùng được —
     nhưng ngày quan sát thật phải đi kèm để còn đối chiếu tay. */
  {
    const { tim } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-08', gia: 5250, qs: '2026-09-01' })],
      errors: [] });
    ok('mốc mang qua vẫn cho giá', tim('Tivi TCL 65C6K').gia_nhap, 5250000);
    ok('  · và giữ ngày quan sát thật', tim('Tivi TCL 65C6K').ngay_gia, '2026-09-01');
  }

  /* Ba lý do chưa có giá, mỗi lý do phải tới được đúng dòng của nó. */
  {
    const { tim, b } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-08' })],
      errors: [{ product_code: 'X198VDGEN', effective_date: '2026-09-08',
        reason: 'SOURCE_UNAVAILABLE' }] });
    ok('bản ghi có mà min_price null → NO_DATA',
      tim('Tivi TCL 65C6K').ly_do_chua_gia, 'NO_DATA');
    ok('  · và KHÔNG hiện giá 0', tim('Tivi TCL 65C6K').gia_nhap, null);
    ok('  · lợi nhuận cũng để trống, không phải 0', tim('Tivi TCL 65C6K').loi_nhuan, null);
    ok('lý do từ errors tới đúng dòng',
      tim('Tủ lạnh Sharp SJ-X198V-DG').ly_do_chua_gia, 'SOURCE_UNAVAILABLE');
    ok('dòng chưa có mã thì lý do là chưa-có-mã',
      tim('Chân máy giặt Đa Năng - chiều').ly_do_chua_gia, 'chua-co-ma');
    ok('bản kê đếm đủ số dòng chưa có giá', b.tom_tat_gia.chua_co_gia, 4);
    /* So theo CẶP ĐÃ SẮP, không so nguyên object: thứ tự khoá của một object
       là thứ tự gặp dòng, một chi tiết cài đặt — ghim nó vào bài kiểm là để
       một lượt đổi thứ tự sắp dòng làm đỏ một phép canh không liên quan. */
    ok('  · và tách theo từng lý do',
      Object.entries(b.tom_tat_gia.theo_ly_do).sort(),
      [['NO_DATA', 1], ['SOURCE_UNAVAILABLE', 1], ['chua-co-ma', 2]]);
  }

  /* Lợi nhuận của ĐƠN chỉ có nghĩa khi mọi dòng hàng của nó đã có giá vốn.
     Thiếu một dòng mà vẫn cộng là đưa ra một con số nhỏ hơn sự thật và không
     nói rằng nó thiếu. */
  {
    const { b } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-08', gia: 1000 })], errors: [] });
    const don1 = b.ngay[0].don.find((x) => x.so_ct === 'BH1');
    ok('đơn còn dòng thiếu giá thì lợi nhuận đơn để trống', don1.loi_nhuan, null);
  }
  {
    const mn = { currency_unit: 'VND_THOUSAND', records: [
      bg({ ma: '65C6K', ngay: '2026-09-08', gia: 1000 }),
      bg({ ma: 'X198VDGEN', ngay: '2026-09-08', gia: 2000 }),
    ], errors: [] };
    const b = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b, { board: BOARD, alias: ALIAS,
      inv_map: { N_CHNMYGITANNGCHIU: '-' } }, '2026-09');
    K.dienGiaNhap(b, mn);
    const don2 = b.ngay[0].don.find((x) => x.so_ct === 'BH2');
    /* BH2 có hai dòng: một tủ lạnh đã có giá, một dòng "bỏ qua" (không phải
       sản phẩm). "Bỏ qua" vẫn là dòng chưa có giá vốn, nên đơn vẫn treo. */
    ok('dòng "bỏ qua" vẫn làm lợi nhuận đơn treo', don2.loi_nhuan, null);
  }

  /* Dòng chiết khấu đã biết chắc lợi nhuận của nó từ dungBangDon() — giá
     nhập 0 nên lợi nhuận = chính nó, mang dấu âm. dienGiaNhap không được
     đụng vào, và cũng không được đếm nó là "chưa có giá". */
  {
    const { ds, b } = veBangGia({ currency_unit: 'VND_THOUSAND',
      records: [bg({ ma: '65C6K', ngay: '2026-09-08', gia: 1 })], errors: [] });
    const ck = ds.find((d) => d.la_chiet_khau);
    ok('dòng chiết khấu giữ nguyên lợi nhuận của nó', ck.loi_nhuan, -50000);
    ok('  · và không bị đếm vào bản kê thiếu giá',
      b.tom_tat_gia.co_gia + b.tom_tat_gia.chua_co_gia, 4);
  }

  /* ─────────── H. Nơi nhập theo ngày bán ─────────── */

  console.log('\nH) Nơi nhập');

  /* Một mục `min_sources`: chuỗi trần = NCC (ca thường), còn `{t, id}` để
     dựng được nguồn TỒN KHO — hợp đồng `daily-min-v1` phân biệt hai loại
     bằng `source_type`, không bằng tên. */
  const nguonHd = (x) => (typeof x === 'string'
    ? { source_type: 'SUPPLIER', source_id: x }
    : { source_type: x.t, source_id: x.id });
  const bgN = (nguon, gia, kho) => ({ product_code: '65C6K', effective_date: '2026-09-08',
    min_price: gia === undefined ? 5250 : gia, price_status: 'AVAILABLE',
    day_status: 'FINAL', observed_on: '2026-09-08', carried_from: null,
    min_sources: nguon.map(nguonHd),
    ...(kho === undefined ? {} : { inventory_unit_cost: kho }) });

  const noiNhapCua = (nguon, gia, kho) => {
    const b = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-09');
    K.dienGiaNhap(b, { currency_unit: 'VND_THOUSAND',
      records: [bgN(nguon, gia, kho)], errors: [] });
    for (const ng of b.ngay) for (const don of ng.don) for (const x of don.dong)
      if (x.ma_san_pham === 'Tivi TCL 65C6K') return { o: x, bang: b };
    return { o: null, bang: b };
  };

  ok('một nguồn giữ Min → lấy đúng nguồn đó',
    noiNhapCua(['Tuấn Ngoan']).o.noi_nhap, 'Tuấn Ngoan');

  /* Thứ tự ưu tiên chủ dự án chốt. Tracking trả danh sách theo thứ tự của
     nó, nên phép chọn KHÔNG được ăn theo vị trí trong mảng. */
  ok('nhiều nguồn cùng giá → chọn theo thứ tự ưu tiên',
    noiNhapCua(['Văn Quân', 'Việt Hải', 'Thăng Long']).o.noi_nhap, 'Việt Hải');
  ok('  · Điện tử 179 trên Thăng Long',
    noiNhapCua(['Thăng Long', 'Điện tử 179']).o.noi_nhap, 'Điện tử 179');
  ok('  · Trung Xuân trên Văn Quân',
    noiNhapCua(['Văn Quân', 'Trung Xuân']).o.noi_nhap, 'Trung Xuân');
  ok('nguồn ngoài danh sách xếp SAU mọi tên đã khai',
    noiNhapCua(['Minh Ngọc', 'Văn Quân']).o.noi_nhap, 'Văn Quân');
  ok('  · toàn nguồn ngoài danh sách thì giữ thứ tự Tracking trả',
    noiNhapCua(['Minh Ngọc', 'Đất Việt']).o.noi_nhap, 'Minh Ngọc');

  /* CA NGUY HIỂM: "Việt Hải" và "Việt Hàn" là HAI NCC khác nhau, hai cột
     cạnh nhau trên bảng giá (chủ dự án xác nhận). Ghép gần đúng hai cái tên
     ấy là gán sai nơi nhập, im lặng — đúng lớp lỗi 65C6K/65C6KS. */
  ok('"Việt Hàn" KHÔNG được hưởng ưu tiên của "Việt Hải"',
    noiNhapCua(['Văn Quân', 'Việt Hàn']).o.noi_nhap, 'Văn Quân');
  ok('  · và khi chỉ có Việt Hàn thì vẫn lấy đúng tên nó',
    noiNhapCua(['Việt Hàn']).o.noi_nhap, 'Việt Hàn');
  ok('  · còn Việt Hải thì thắng tất',
    noiNhapCua(['Việt Hàn', 'Trung Xuân', 'Việt Hải']).o.noi_nhap, 'Việt Hải');

  /* Hoa/thường và khoảng trắng thừa là lỗi gõ, không phải một NCC khác. */
  ok('khác hoa/thường vẫn được ưu tiên',
    noiNhapCua(['Văn Quân', '  việt   hải ']).o.noi_nhap, '  việt   hải ');

  /* Không truy ra được giá Min thì cũng không có nơi nhập — chủ dự án chốt
     dòng ấy bôi đỏ chứ không bịa một cái tên. */
  {
    const b = D.dungBangDon(DONG, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-09');
    K.dienGiaNhap(b, { currency_unit: 'VND_THOUSAND', records: [], errors: [] });
    let x = null;
    for (const ng of b.ngay) for (const don of ng.don) for (const y of don.dong)
      if (y.ma_san_pham === 'Tivi TCL 65C6K') x = y;
    ok('không có giá Min → không có nơi nhập', x.noi_nhap, null);
  }

  /* ── TỒN KHO THẮNG MỌI NCC (chủ dự án chốt 12/09/2026) ──
     Hàng đã nằm trong kho thì bắt buộc xuất từ kho, kể cả khi hôm ấy có NCC
     báo giá rẻ hơn: giá thị trường giảm không làm số hàng trong kho biến mất.
     Trước bản này `TON_KHO` rơi vào nhánh "ngoài danh sách" nên nó xếp SAU
     mọi NCC có tên — tức Kho gần như không bao giờ được hiện, và khi được
     hiện thì hiện ra đúng chữ `TON_KHO`. */
  const KHO = { t: 'INVENTORY', id: 'TON_KHO' };
  ok('tồn kho thắng cả NCC ưu tiên cao nhất',
    noiNhapCua([KHO, 'Việt Hải']).o.noi_nhap, 'Kho');
  ok('  · thắng cả khi Tracking trả nó ở CUỐI danh sách',
    noiNhapCua(['Việt Hải', 'Trung Xuân', KHO]).o.noi_nhap, 'Kho');
  ok('  · và hiện chữ cho người đọc, không phải mã TON_KHO của Tracking',
    noiNhapCua([KHO]).o.noi_nhap, 'Kho');
  /* Nhận theo `source_type` — một NCC vô tình được đặt tên "TON_KHO" vẫn chỉ
     là một NCC, và một nguồn INVENTORY đổi `source_id` vẫn là tồn kho. */
  ok('một NCC tên trùng "TON_KHO" KHÔNG được hưởng ưu tiên của tồn kho',
    noiNhapCua(['TON_KHO', 'Việt Hải']).o.noi_nhap, 'Việt Hải');
  ok('  · còn nguồn INVENTORY đổi tên vẫn là tồn kho',
    noiNhapCua([{ t: 'INVENTORY', id: 'KHO-TP' }, 'Việt Hải']).o.noi_nhap, 'Kho');

  /* Nhãn "Kho" KHÔNG được lọt vào phép đếm NCC ưu tiên — nó không phải một
     nhà cung cấp, và đếm nó vào đó là làm hỏng đúng tín hiệu "tên nào khai
     trong danh sách mà cả kỳ không gặp lần nào". */
  ok('Kho không bị đếm như một NCC ưu tiên',
    noiNhapCua([KHO]).bang.tom_tat_gia.ncc_uu_tien_khong_gap.length, 5);

  /* ── KHO ĐẮT HƠN MIN (hợp đồng `min-2` của Tracking) ──
     Đây là ca cả lượt sửa này sinh ra để giải, và nó KHÔNG thấy được qua
     `min_sources`: kho đắt hơn nên Tracking không kể tên kho ở đó — đúng như
     `min_sources` phải thế, vì nó trả lời "ai giữ giá rẻ nhất". Sự thật "kho
     còn hàng" đi bằng trường riêng `inventory_unit_cost`. */
  {
    const r = noiNhapCua(['Việt Hải'], 5250, 9000);
    ok('kho còn hàng mà ĐẮT HƠN Min: nơi nhập vẫn là Kho', r.o.noi_nhap, 'Kho');
    /* Vế thứ hai của luật, và là vế dễ làm hỏng nhất: đổi NHÃN thì được,
       đụng vào TIỀN thì không. Giá nhập phải vẫn là giá Min. */
    ok('  · nhưng GIÁ NHẬP vẫn là giá Min, không phải giá kho', r.o.gia_nhap, 5250000);
    ok('  · và giá kho đi kèm ra màn hình để người đối chiếu không tưởng là lỗi',
      r.o.gia_ton_kho, 9000000);
  }
  ok('kho RẺ HƠN Min cũng là Kho', noiNhapCua(['Việt Hải'], 5250, 3000).o.noi_nhap, 'Kho');
  /* Cờ "chữ Kho này do MÁY chọn" — màn hình chỉ được giải thích khi nó còn
     đúng. `kiem/sua-tay.js` canh vế còn lại: gõ đè nơi nhập thì cờ phải tắt,
     không thì ô ghi tên một NCC mà tooltip vẫn nói "hàng xuất từ kho". */
  ok('máy chọn Kho thì bật cờ để màn hình biết được phép giải thích',
    noiNhapCua(['Việt Hải'], 5250, 9000).o.noi_nhap_tu_kho, true);
  ok('  · máy chọn một NCC thì KHÔNG bật',
    noiNhapCua(['Việt Hải'], 5250, null).o.noi_nhap_tu_kho, false);
  /* `inventory_unit_cost: null` là câu trả lời THẬT của hợp đồng — "kho không
     có hàng mã ấy hôm đó" — chứ không phải một ô còn thiếu. */
  ok('hợp đồng nói rõ kho KHÔNG có hàng → quay về thứ tự NCC',
    noiNhapCua(['Việt Hải', 'Trung Xuân'], 5250, null).o.noi_nhap, 'Việt Hải');
  ok('  · và không bịa ra một giá kho', noiNhapCua(['Việt Hải'], 5250, null).o.gia_ton_kho, null);
  /* Bản ghi ghi TRƯỚC lượt deploy `min-2` không có khoá ấy. Hai đường phải
     cùng ra "không có hàng" — và khi ấy nhánh `min_sources` cũ vẫn phải còn
     hiệu lực, nếu không thì ngày cũ tệ hơn cả trước khi có luật ưu tiên. */
  ok('bản ghi CŨ (không có khoá) cũng quay về thứ tự NCC',
    noiNhapCua(['Việt Hải', 'Trung Xuân']).o.noi_nhap, 'Việt Hải');
  ok('  · nhưng nếu bản ghi cũ ấy có kho giữ Min thì Kho vẫn thắng',
    noiNhapCua([KHO, 'Việt Hải']).o.noi_nhap, 'Kho');

  /* Luật ưu tiên im lặng không chạy là lỗi không ai thấy — bản kê phải nói
     tên nào cả kỳ không gặp lần nào. */
  ok('bản kê nói tên ưu tiên nào cả kỳ không gặp',
    noiNhapCua(['Việt Hải']).bang.tom_tat_gia.ncc_uu_tien_khong_gap,
    ['Điện tử 179', 'Thăng Long', 'Trung Xuân', 'Văn Quân']);

  /* ─────────── I. Dòng 0 đồng ─────────── */

  console.log('\nI) Dòng 0 đồng');

  {
    const dg0 = (o) => ({ ngay: '2026-09-08', so_ct: o.ct, ten_hang: o.ten,
      so_luong: 1, don_gia: o.tien, doanh_so: o.tien, chiet_khau: 0,
      nhan_vien: 'Tín Phát 0869931931', imei: null });
    const D0 = {
      a: dg0({ ct: 'BH9', ten: 'Tivi TCL 65C6K', tien: 9000000 }),
      b: dg0({ ct: 'BH9', ten: 'Tủ lạnh Sharp SJ-X198V-DG', tien: 0 }),
      c: dg0({ ct: 'BTL9', ten: 'Tivi TCL 65C6K', tien: 0 }),
    };
    const b = D.dungBangDon(D0, {}, BANG_LINE, null);
    K.khopMaChoBangDon(b, { board: BOARD, alias: ALIAS, inv_map: {} }, '2026-09');
    K.dienGiaNhap(b, { currency_unit: 'VND_THOUSAND', records: [
      bgN(['Việt Hải']),
      { product_code: 'X198VDGEN', effective_date: '2026-09-08', min_price: 3000,
        price_status: 'AVAILABLE', day_status: 'FINAL', observed_on: '2026-09-08',
        min_sources: [{ source_type: 'SUPPLIER', source_id: 'Trung Xuân' }] },
    ], errors: [] });

    const ds = [];
    for (const ng of b.ngay) for (const don of ng.don) for (const x of don.dong) ds.push(x);
    const qua = ds.find((x) => x.ma_san_pham === 'Tủ lạnh Sharp SJ-X198V-DG');
    const thuong = ds.find((x) => x.ma_san_pham === 'Tivi TCL 65C6K' && x.tong_ban > 0);
    const btl = ds.find((x) => x.tong_ban === 0 && x.ma_san_pham === 'Tivi TCL 65C6K');

    ok('dòng 0 đồng được đánh dấu', qua.la_dong_0d, true);
    ok('dòng có tiền KHÔNG bị đánh dấu', thuong.la_dong_0d, false);
    /* Doanh thu 0 nên công thức chung tự cho ra số ÂM — đúng "phép tính như
       dòng chiết khấu", không cần nhánh riêng. */
    ok('dòng 0 đồng vẫn có giá vốn', qua.gia_nhap, 3000000);
    ok('  · và lợi nhuận ÂM đúng bằng giá vốn', qua.loi_nhuan, -3000000);
    ok('  · vẫn có nơi nhập như mọi dòng khác', qua.noi_nhap, 'Trung Xuân');

    /* BTL là nghiệp vụ khác (hàng trả về), chủ dự án chốt để xử sau — nên nó
       KHÔNG được gộp chung với dòng quà tặng. */
    ok('chứng từ BTL 0 đồng KHÔNG bị đánh dấu như quà tặng', btl.la_dong_0d, false);
    ok('đếm đúng số dòng 0 đồng, không tính BTL', b.tom_tat_gia.so_dong_0d, 1);
  }

  xong();
})();
