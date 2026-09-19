/* CƠ CẤU NGÀNH HÀNG × HÃNG — chủ dự án chốt 19/09/2026.
 *
 * Biểu đồ cột chồng, hai tầng: chiều cao cột = tỉ trọng ngành, ruột cột =
 * tỉ trọng hãng trong ngành. Hai cột cạnh nhau: tháng này ‖ cùng kỳ năm
 * trước.
 *
 * Bộ này canh sáu chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. HAI CỘT KHÔNG SO ĐƯỢC VỚI NHAU. Trục ngang hoặc thứ tự hãng lệch giữa
 *     hai tháng thì mảng cùng màu là hai hãng khác nhau — người đọc so hai
 *     thứ không liên quan mà không có gì báo.
 *  B. MẤT MỘT HÃNG. Hãng bán mạnh năm ngoái, năm nay nghỉ — xếp hạng theo
 *     riêng tháng này là nó rơi vào "Khác", đúng hãng người ta mở biểu đồ ra
 *     để tìm.
 *  C. ĐỘ PHỦ BỊ GIẤU. Tháng còn ⅔ dòng chưa gán mã vẫn vẽ ra một biểu đồ đủ
 *     100% trông rất bình thường. Đo thật 01/2025: 797 máy đã phân loại,
 *     1.575 dòng chưa. So tháng gán kỹ với tháng gán ít là bịa ra tăng
 *     trưởng.
 *  D. CỘNG NHẦM TIỀN. Chiết khấu, phụ phí, hàng trả lại lọt vào cơ cấu.
 *     Hàng trả lại mang số ÂM — một mảng âm thì không vẽ được, và nếu lọt
 *     thì nó âm thầm bẻ tỉ lệ của cả cột.
 *  E. "KHÁC" NUỐT MẤT DỮ LIỆU. Gộp là cách VẼ; số bên trong phải còn đủ để
 *     rê chuột đọc được (chủ dự án chốt).
 *  F. THỨ TỰ NHẢY GIỮA HAI LƯỢT MỞ. Hai ngành bằng điểm mà để thứ tự khoá
 *     quyết định thì mỗi lần F5 trục ngang xáo lại.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const C = await import('file://' + path.join(GOC, 'engine/src/co-cau.mjs'));

  /** Một dòng hàng trên bảng đơn. */
  const d = (nganh, hang, ds, sl) => ({
    nganh_hang: nganh, hang, tong_ban: ds, so_luong: sl === undefined ? 1 : sl,
    la_chiet_khau: false, la_phu_phi_co_dinh: null,
  });
  const bang = (ds) => ({ ngay: [{ ngay: '2026-09-01', don: [{ so_ct: 'BH1', dong: ds }] }] });

  /** Cột tên gì → object cột, cho gọn bài. */
  const cot = (m, ten) => m.cot.find((x) => x.ten === ten);
  const mang = (c, ten) => (c ? c.hang.find((x) => x.ten === ten) : undefined);

  console.log('\nD) laDongTinhCoCau — cái gì được cộng vào cơ cấu');
  {
    ok('dòng bán bình thường', C.laDongTinhCoCau(d('Tivi', 'Samsung', 10)), true);
    ok('chiết khấu thì không',
       C.laDongTinhCoCau({ ...d('Tivi', 'Samsung', 10), la_chiet_khau: true }), false);
    ok('phụ phí cố định thì không',
       C.laDongTinhCoCau({ ...d('Tivi', 'Samsung', 10), la_phu_phi_co_dinh: 'Vận chuyển' }), false);

    /* D — hàng trả lại. Dòng đã khớp bị `apDungBTL` hạ tong_ban về 0; dòng
       chưa khớp mang số ÂM. Một mảng âm không có cách nào vẽ trong cột chồng
       phần trăm, và nếu lọt thì nó bẻ tỉ lệ của cả cột. */
    ok('BTL đã khớp (0 đồng) thì không', C.laDongTinhCoCau(d('Tivi', 'Samsung', 0, 0)), false);
    ok('BTL chưa khớp (âm) thì không', C.laDongTinhCoCau(d('Tivi', 'Samsung', -5, -1)), false);

    /* Và đây là chỗ luật này CỐ Ý khác `laMayDaBan` bên bao-hanh.mjs: quà
       tặng 0 đồng vẫn là một cái máy phải kích hoạt bảo hành, nhưng nó không
       góp đồng doanh số nào vào cơ cấu. Hai câu hỏi khác nhau, hai luật. */
    ok('quà tặng 0 đồng KHÔNG vào cơ cấu (khác luật bảo hành)',
       C.laDongTinhCoCau(d('Tivi', 'Samsung', 0, 1)), false);

    ok('không phải object thì không', C.laDongTinhCoCau(null), false);
  }

  console.log('\n1) Hai tầng: chiều cao cột = ngành, ruột cột = hãng');
  {
    /* Đúng ví dụ chủ dự án đưa ra: tủ lạnh chiếm 50% tổng, trong đó Samsung
       chiếm 50% của tủ lạnh. */
    const r = C.coCauNganhHang(bang([
      d('Tủ lạnh', 'Samsung', 50),
      d('Tủ lạnh', 'LG', 50),
      d('Tivi', 'Sony', 100),
    ]), null);
    const m = r.theo_doanh_so.nay;
    ok('tổng cả tháng', m.tong, 200);
    ok('cột Tủ lạnh cao 100/200 = 50%', cot(m, 'Tủ lạnh').gia_tri, 100);
    ok('  · Samsung chiếm nửa cột', mang(cot(m, 'Tủ lạnh'), 'Samsung').gia_tri, 50);
    ok('  · LG nửa còn lại', mang(cot(m, 'Tủ lạnh'), 'LG').gia_tri, 50);
    ok('cột Tivi cao nửa kia', cot(m, 'Tivi').gia_tri, 100);

    /* Số máy là một TRỤC KHÁC, không phải cùng một biểu đồ đổi nhãn. */
    ok('chỉ tiêu Số máy đếm máy, không đếm tiền',
       cot(r.theo_so_may.nay, 'Tủ lạnh').gia_tri, 2);
  }

  console.log('\n2) Top 8 ngành + cột "Khác" (chủ dự án chốt)');
  {
    const ds = [];
    for (let i = 1; i <= 12; i++) ds.push(d('N' + String(i).padStart(2, '0'), 'H', 100 - i));
    const m = C.coCauNganhHang(bang(ds), null).theo_doanh_so.nay;
    ok('đúng 8 cột ngành + 1 cột Khác', m.cot.length, 9);
    ok('  · tám ngành lớn nhất đứng riêng',
       m.cot.slice(0, 8).map((x) => x.ten), ['N01','N02','N03','N04','N05','N06','N07','N08']);
    ok('  · cột cuối là Khác', m.cot[8].ten, 'Khác');
    ok('  · và nó được đánh dấu', m.cot[8].la_khac, true);
    /* Gộp là cách VẼ, không phải cách quên: bốn ngành nhỏ vẫn cộng đủ tiền
       vào cột Khác. */
    ok('  · cột Khác cộng đủ bốn ngành nhỏ', m.cot[8].gia_tri, (100-9)+(100-10)+(100-11)+(100-12));
    ok('tổng các cột = tổng cả tháng',
       m.cot.reduce((s, x) => s + x.gia_tri, 0), m.tong);

    ok('ít hơn 8 ngành thì KHÔNG sinh cột Khác rỗng',
       C.coCauNganhHang(bang([d('Tivi', 'Sony', 10)]), null)
         .theo_doanh_so.nay.cot.map((x) => x.ten), ['Tivi']);
  }

  console.log('\n3) Hãng dưới 5% của ngành gộp thành "Khác" — nhưng giữ đủ số');
  {
    const m = C.coCauNganhHang(bang([
      d('Tivi', 'Samsung', 900),
      d('Tivi', 'Sony', 60),
      d('Tivi', 'LG', 30),     // 3% → gộp
      d('Tivi', 'TCL', 10),    // 1% → gộp
    ]), null).theo_doanh_so.nay;
    const c = cot(m, 'Tivi');
    ok('hãng ≥5% đứng riêng', c.hang.filter((x) => !x.la_khac).map((x) => x.ten),
       ['Samsung', 'Sony']);
    const k = mang(c, 'Khác');
    ok('  · phần còn lại thành một mảng Khác', k.gia_tri, 40);

    /* E — chủ dự án chốt "di chuột vào đó thấy đủ thông tin". Nếu `gom`
       rỗng thì cái gộp đã thành cái quên. */
    ok('  · và giữ đủ danh sách bên trong', k.gom.map((x) => x.ten), ['LG', 'TCL']);
    ok('  · kèm số của từng hãng', k.gom.map((x) => x.gia_tri), [30, 10]);
    ok('  · cộng lại đúng bằng mảng Khác',
       k.gom.reduce((s, x) => s + x.gia_tri, 0), k.gia_tri);
    ok('ruột cột cộng lại = chiều cao cột',
       c.hang.reduce((s, x) => s + x.gia_tri, 0), c.gia_tri);
  }

  console.log('\nA+B) Hai tháng — MỘT trục ngang, MỘT thứ tự hãng');
  {
    const nay = bang([d('Tivi', 'Samsung', 100), d('Tủ lạnh', 'LG', 50)]);
    /* Năm ngoái có một ngành và một hãng mà năm nay không còn. */
    const truoc = bang([d('Tivi', 'Sony', 80), d('Máy giặt', 'Panasonic', 70)]);
    const r = C.coCauNganhHang(nay, truoc);
    const a = r.theo_doanh_so.nay, b = r.theo_doanh_so.truoc;

    /* A — trục ngang phải GIỐNG HỆT nhau, kể cả thứ tự. */
    ok('hai tháng cùng một trục ngang', a.cot.map((x) => x.ten), b.cot.map((x) => x.ten));

    /* B — ngành và hãng chỉ có ở năm trước vẫn phải đứng riêng, vì xếp hạng
       chạy trên TỔNG HAI THÁNG. Xếp theo riêng tháng này là Máy giặt và
       Panasonic rơi vào "Khác" — đúng thứ người ta mở biểu đồ ra để tìm. */
    ok('ngành chỉ có ở năm trước vẫn có cột riêng', !!cot(a, 'Máy giặt'), true);
    ok('  · và tháng này cột ấy cao 0, không biến mất', cot(a, 'Máy giặt').gia_tri, 0);
    ok('  · trong khi năm trước nó có số', cot(b, 'Máy giặt').gia_tri, 70);
    ok('hãng chỉ có ở năm trước vẫn đứng riêng',
       !!mang(cot(b, 'Tivi'), 'Sony'), true);

    /* A — và thứ tự mảng trong một cột phải khớp từng vị trí, không thì
       mảng thứ hai của cột trái là một hãng khác với mảng thứ hai cột phải. */
    for (const ten of a.cot.map((x) => x.ten)) {
      ok('  · cột "' + ten + '": thứ tự hãng khớp hai tháng',
         cot(a, ten).hang.map((x) => x.ten), cot(b, ten).hang.map((x) => x.ten));
    }
  }

  console.log('\nC) Độ phủ — dòng chưa gán mã là một cột THẬT, và một con số');
  {
    const m0 = C.coCauNganhHang(bang([
      d('Tivi', 'Samsung', 100),
      d(null, null, 200),        // chưa gán mã → chưa có ngành lẫn hãng
    ]), null);
    const m = m0.theo_doanh_so.nay;
    /* Nhãn viết tắt "NONE" — chủ dự án chốt 19/09/2026: trục ngang chỉ có
       chừng bảy chữ, "Chưa phân loại" bị cắt thành "Chưa phân lo…". Câu đầy
       đủ vẫn ở phần rê chuột và ở dòng độ phủ dưới biểu đồ. */
    const cpl = cot(m, C.NHAN_CHUA_PHAN_LOAI);
    ok('nhãn cột chưa gán mã viết tắt là NONE', C.NHAN_CHUA_PHAN_LOAI, 'NONE');
    ok('có cột chưa phân loại', !!cpl, true);
    ok('  · cao đúng tỉ trọng thật (200/300)', cpl.gia_tri, 200);
    ok('  · và được đánh dấu để màn hình tô xám', cpl.la_chua_phan_loai, true);
    ok('  · nó không có ruột (không phải một ngành)', cpl.hang, []);
    ok('  · đứng CUỐI trục', m.cot[m.cot.length - 1].ten, C.NHAN_CHUA_PHAN_LOAI);

    ok('độ phủ nói ra bằng số', m0.do_phu.nay.doanh_so_pt, 33.3);
    ok('  · và theo cả chỉ tiêu số máy', m0.do_phu.nay.so_may_pt, 50);

    /* Gán hết thì cột xám biến mất hẳn, không để lại một cột cao 0. */
    ok('gán hết thì không còn cột xám',
       C.coCauNganhHang(bang([d('Tivi', 'Samsung', 100)]), null)
         .theo_doanh_so.nay.cot.map((x) => x.ten), ['Tivi']);

    /* Tháng rỗng: độ phủ là `null`, KHÔNG phải 0%. "Không bán gì" và "bán mà
       chưa phân loại được gì" là hai câu khác nhau trên màn hình. */
    ok('tháng không có dòng nào → độ phủ null, không phải 0',
       C.coCauNganhHang(bang([]), null).do_phu.nay.doanh_so_pt, null);
  }

  console.log('\n4) Chưa rõ hãng — tách khỏi "Chưa phân loại"');
  {
    /* Đã khớp mã (nên có ngành) nhưng bảng giá để trống `brand`. Gộp nó vào
       "Chưa phân loại" là chỉ sai một chỗ mà đi sửa nhầm chỗ kia: cái này
       sửa bên Tracking, cái kia gán mã bên tab Báo cáo. */
    const m = C.coCauNganhHang(bang([
      d('Tivi', 'Samsung', 50), d('Tivi', null, 50),
    ]), null).theo_doanh_so.nay;
    ok('không rơi vào cột chưa phân loại', !!cot(m, C.NHAN_CHUA_PHAN_LOAI), false);
    ok('  · mà thành một mảng trong chính ngành ấy',
       !!mang(cot(m, 'Tivi'), 'Chưa rõ hãng'), true);
  }

  console.log('\n5) Chưa có sổ của cùng kỳ năm trước');
  {
    const r = C.coCauNganhHang(bang([d('Tivi', 'Samsung', 100)]), null);
    ok('cờ nói thẳng là chưa có', r.co_ky_truoc, false);
    ok('  · và độ phủ của kỳ ấy là null, không phải 0', r.do_phu.truoc, null);
    /* Cột năm trước vẫn dựng đủ để trục thẳng hàng, nhưng tổng bằng 0 —
       màn hình đọc `co_ky_truoc` để nói "chưa có dữ liệu" thay vì vẽ một
       cột 0 trông như "năm ngoái không bán gì". */
    ok('  · trục vẫn thẳng hàng', r.theo_doanh_so.truoc.cot.map((x) => x.ten),
       r.theo_doanh_so.nay.cot.map((x) => x.ten));
    ok('  · và có bảng đơn năm trước thì cờ bật',
       C.coCauNganhHang(bang([]), bang([])).co_ky_truoc, true);
  }

  console.log('\nF) Thứ tự không nhảy giữa hai lượt mở');
  {
    /* Khoá của Map giữ thứ tự chèn, mà thứ tự chèn đến từ thứ tự khoá
       Firebase — thứ không bảo đảm. Hai ngành bằng điểm thì TÊN phải là vế
       quyết định. */
    const m1 = C.coCauNganhHang(bang([d('Beta', 'H', 10), d('Alpha', 'H', 10)]), null);
    const m2 = C.coCauNganhHang(bang([d('Alpha', 'H', 10), d('Beta', 'H', 10)]), null);
    ok('ngành bằng điểm → sắp theo tên',
       m1.theo_doanh_so.nay.cot.map((x) => x.ten), ['Alpha', 'Beta']);
    ok('  · và hai thứ tự nhập ra cùng một trục',
       m2.theo_doanh_so.nay.cot.map((x) => x.ten),
       m1.theo_doanh_so.nay.cot.map((x) => x.ten));

    const h1 = C.coCauNganhHang(bang([d('Tivi', 'Beta', 50), d('Tivi', 'Alpha', 50)]), null);
    ok('hãng bằng điểm cũng sắp theo tên',
       cot(h1.theo_doanh_so.nay, 'Tivi').hang.map((x) => x.ten), ['Alpha', 'Beta']);
  }

  console.log('\n6) Ngưỡng là DỮ LIỆU đi kèm, không phải con số màn hình tự biết');
  {
    const r = C.coCauNganhHang(bang([d('Tivi', 'Sony', 1)]), null);
    ok('trả kèm ngưỡng số ngành', r.nguong.so_nganh, C.SO_NGANH_TOI_DA);
    ok('  · và ngưỡng gộp hãng', r.nguong.hang_pt, C.NGUONG_HANG_PT);
    ok('đúng hai con số chủ dự án chốt', [C.SO_NGANH_TOI_DA, C.NGUONG_HANG_PT], [8, 5]);
  }

  console.log('\n7) Gộp / đổi nhãn ngành hàng (chủ dự án chốt 19/09/2026)');
  {
    /* `category_label` của Tracking là chữ người gõ tay, và trục ngang chỉ có
       chừng bảy chữ mỗi cột — ba cái tên thật bị cắt cụt ngoài đời. */
    ok('Lọc không khí → LKK', C.nhanNganh('Lọc không khí'), 'LKK');
    ok('Hút ẩm cũng → LKK (chung một cột)', C.nhanNganh('Hút ẩm'), 'LKK');
    ok('  · và đuôi dài vẫn khớp', C.nhanNganh('Lọc không khí khử mùi'), 'LKK');
    ok('Gia dụng - Bosch → Gia dụng', C.nhanNganh('Gia dụng - Bosch'), 'Gia dụng');
    ok('  · mọi "Gia dụng - X" dồn về một cột',
       C.nhanNganh('Gia dụng - Electrolux'), 'Gia dụng');
    /* Khớp trên chuỗi ĐÃ CHUẨN HOÁ, nên hoa/thường và dấu cách không làm
       lệch — tên thật bên Tracking là chữ gõ tay. */
    ok('  · không phân biệt hoa thường', C.nhanNganh('GIA DỤNG - Bosch'), 'Gia dụng');

    /* Và vế NGƯỢC LẠI, vế giữ cho bảng này không nuốt nhầm: ngành không nằm
       trong bảng thì giữ NGUYÊN tên. */
    for (const x of ['Tivi', 'Tủ lạnh', 'Máy giặt', 'Điều hoà', 'Quạt']) {
      ok('  · giữ nguyên: ' + x, C.nhanNganh(x), x);
    }

    /* ĐÂY LÀ PHÉP GỘP, không chỉ đổi nhãn: số của hai ngành CỘNG LẠI. */
    const m = C.coCauNganhHang(bang([
      d('Lọc không khí', 'Sharp', 60),
      d('Hút ẩm', 'Sharp', 40),
      d('Tivi', 'Sony', 100),
    ]), null).theo_doanh_so.nay;
    ok('hai ngành gộp thành MỘT cột', m.cot.map((x) => x.ten).sort(), ['LKK', 'Tivi']);
    ok('  · và số cộng lại', cot(m, 'LKK').gia_tri, 100);
    /* Cột gộp phải nói ra nó gồm những gì — không thì "LKK" là một nhãn
       không ai biết đang cộng của cái gì. */
    ok('  · kèm danh sách tên thật đã gộp',
       cot(m, 'LKK').ten_goc, ['Hút ẩm', 'Lọc không khí']);
    ok('cột không gộp thì KHÔNG mang ten_goc', cot(m, 'Tivi').ten_goc, undefined);

    /* Gộp phải chạy TRƯỚC khi xếp hạng: hai ngành nhỏ gộp lại có thể vượt
       một ngành đứng riêng, và xếp hạng sau khi gộp mới ra đúng trục. */
    const ds9 = [d('Lọc không khí', 'Sharp', 30), d('Hút ẩm', 'Sharp', 30)];
    for (let i = 1; i <= 8; i++) ds9.push(d('N' + i, 'H', 40));
    const m9 = C.coCauNganhHang(bang(ds9), null).theo_doanh_so.nay;
    ok('gộp xong (60) mới xếp hạng, nên LKK lên trục chứ không rơi vào Khác',
       !!cot(m9, 'LKK'), true);
  }

  console.log('\n8) Mỗi mảng mang CẢ HAI chỉ tiêu — cho card chi tiết');
  {
    /* Chủ dự án chốt 19/09/2026: bỏ nút [Số máy], bấm vào một mảng thì card
       bên phải hiện "số lượng VÀ doanh số, hiện tại so với cùng kỳ".

       Bốn con số ấy phải nằm SẴN trên chính mảng được bấm. Tra sang cấu trúc
       của chỉ tiêu kia thì hỏng đúng ca thường gặp nhất: một hãng đứng riêng
       ở bảng doanh số có thể đã bị gộp vào "Khác" ở bảng số máy, và card sẽ
       không tìm thấy nó. */
    const m = C.coCauNganhHang(bang([
      d('Tivi', 'Sony', 900, 3),
      d('Tivi', 'LG', 100, 7),
    ]), null).theo_doanh_so.nay;
    const c = cot(m, 'Tivi');
    ok('cột mang doanh số', c.doanh_so, 1000);
    ok('  · và số máy', c.so_may, 10);
    ok('mảng mang doanh số', mang(c, 'Sony').doanh_so, 900);
    ok('  · và số máy của chính nó', mang(c, 'Sony').so_may, 3);
    /* Đúng cái ca nói ở trên: LG chiếm 10% doanh số (đứng riêng) nhưng 70%
       số máy. Không có `so_may` trên mảng thì card không nói được điều đó. */
    ok('  · LG ít tiền nhưng nhiều máy', mang(c, 'LG').so_may, 7);

    /* Mảng "Khác" và danh sách bên trong nó cũng phải đủ hai chỉ tiêu. */
    const m2 = C.coCauNganhHang(bang([
      d('Tivi', 'Sony', 900, 1), d('Tivi', 'TCL', 30, 5), d('Tivi', 'Casper', 70, 2),
    ]), null).theo_doanh_so.nay;
    const k = mang(cot(m2, 'Tivi'), 'Khác');
    ok('mảng Khác mang đủ hai chỉ tiêu', [k.doanh_so, k.so_may], [30, 5]);
    ok('  · và từng hãng bên trong cũng vậy',
       k.gom.map((x) => [x.ten, x.doanh_so, x.so_may]), [['TCL', 30, 5]]);

    /* Cột chưa phân loại cũng phải có cả hai — card bấm vào nó vẫn phải nói
       được "bao nhiêu tiền, bao nhiêu máy đang chưa gán mã". */
    const m3 = C.coCauNganhHang(bang([
      d('Tivi', 'Sony', 100, 1), d(null, null, 50, 4),
    ]), null).theo_doanh_so.nay;
    ok('cột NONE mang đủ hai chỉ tiêu',
       [cot(m3, C.NHAN_CHUA_PHAN_LOAI).doanh_so, cot(m3, C.NHAN_CHUA_PHAN_LOAI).so_may],
       [50, 4]);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
