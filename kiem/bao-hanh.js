/* KÍCH HOẠT BẢO HÀNH — chủ dự án chốt 19/09/2026.
 *
 * Tab này là một DANH SÁCH VIỆC: mỗi dòng còn ở đây nghĩa là còn một cái máy
 * ngoài đời chưa được kích hoạt bảo hành. Nên mọi lỗi của nó đều thuộc đúng
 * một loại — MỘT CÁI MÁY BIẾN MẤT KHỎI DANH SÁCH MÀ KHÔNG AI THẤY — và loại
 * ấy không tự đỏ lên ở đâu cả: màn hình vẫn đẹp, con số vẫn có, chỉ là thiếu.
 * Khách gọi bảo hành mấy tháng sau mới biết.
 *
 * Bộ này canh năm chỗ, xếp theo mức đắt nếu hỏng:
 *
 *  A. LỌT MỘT CÁI MÁY. `laMayDaBan` loại nhầm một dòng bán thật — ví dụ loại
 *     theo tiền, mà quà tặng 0 đồng vẫn là một cái máy có IMEI.
 *  B. THÊM MỘT CÁI MÁY KHÔNG CÓ THẬT. Chiết khấu, phụ phí, hàng trả lại lọt
 *     vào danh sách — người dùng đi kích hoạt bảo hành cho một khoản tiền.
 *  C. XẾP SAI HÃNG. Một cái tivi Samsung nằm ở tab LG thì cả hai tab cùng
 *     sai, và tab LG còn mời người ta kích hoạt nhầm cổng.
 *  D. MẤT DÒNG CHƯA GÁN MÃ. Chủ dự án chốt chỉ mười tab, nên dòng chưa có
 *     hãng không thuộc tab nào — nó phải được ĐẾM, không được im lặng.
 *  E. TICK KHÔNG ĂN, hoặc ăn nhầm dòng. Khoá dòng phải là khoá BỀN của
 *     CLAUDE.md, thứ sống sót qua một lượt nhập lại sổ.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/bao-hanh.mjs'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));

  /** Một dòng hàng trên bảng đơn, mặc định là "máy đã bán bình thường". */
  const dong = (x) => Object.assign({
    khoa: 'BH1|may|0', ma_san_pham: 'Tivi Samsung 65U8500F', so_luong: 1,
    imei: null, hang: 'Samsung', la_chiet_khau: false, la_phu_phi_co_dinh: null,
  }, x);
  const bang = (ds, ngay) => ({
    ngay: [{ ngay: ngay || '2026-09-01', don: [{
      so_ct: 'BH1', ten_khach: 'Anh A', dien_thoai: '0900', dia_chi: 'Hà Nội', dong: ds,
    }] }],
  });

  console.log('\n1) Mười hãng, đúng thứ tự chủ dự án chốt — và không suy từ dữ liệu');
  {
    ok('đủ mười hãng', B.HANG_BAO_HANH.length, 10);
    ok('đúng thứ tự đã chốt', B.HANG_BAO_HANH,
       ['Samsung', 'LG', 'Sony', 'Funiki', 'Toshiba',
        'Panasonic', 'Casper', 'Hitachi', 'Daikin', 'Sharp']);

    /* Tháng không bán Hitachi nào thì tab Hitachi vẫn phải có mặt với số 0.
       Suy danh sách từ dữ liệu là đúng lúc ấy tab biến mất — mà "tháng này
       không còn máy Hitachi nào phải kích hoạt" mới là thứ cần đọc được. */
    const r = B.dsKichHoat(bang([dong({})]), {});
    ok('hãng không có dòng nào vẫn có mặt', r.thu_tu.length, 10);
    ok('  · và đếm về 0, không phải vắng mặt', r.tom_tat_hang.Hitachi, { chua: 0, da: 0 });
  }

  console.log('\n2) hangChinhThuc — tra nhãn, KHÔNG đoán hãng');
  {
    ok('đúng tên thì nhận', B.hangChinhThuc('Samsung'), 'Samsung');
    /* Bảng giá bên Tracking là dữ liệu người gõ tay: chênh một dấu cách hay
       một chữ hoa là chuyện có thật, và nó không được làm mất một cái máy. */
    ok('viết thường vẫn ra tên chính thức', B.hangChinhThuc('samsung'), 'Samsung');
    ok('thừa khoảng trắng vẫn ra tên chính thức', B.hangChinhThuc('  L G  '), 'LG');

    /* Và đây là vế NGƯỢC LẠI, vế quan trọng hơn: không có phép so gần đúng
       nào. CLAUDE.md cấm dựng bộ phân loại thương hiệu thứ hai; một cái tên
       "gần giống" phải rơi ra ngoài chứ không được đoán vào. */
    for (const x of ['Samsun', 'Samsung Vina', 'TCL', 'Electrolux', '', null, undefined]) {
      ok('không đoán: ' + JSON.stringify(x), B.hangChinhThuc(x), null);
    }
  }

  console.log('\n3) laMayDaBan — cái gì là một cái máy đã bán, cái gì không');
  {
    ok('dòng bán bình thường', B.laMayDaBan(dong({})), true);

    /* A — quà tặng 0 đồng VẪN là một cái máy. Lọc theo tiền ở đây là để lọt
       đúng những máy dễ quên nhất, vì không có con số nào nhắc đến chúng. */
    ok('quà tặng 0 đồng vẫn là một cái máy',
       B.laMayDaBan(dong({ tong_ban: 0, gia_ban: 0, loi_nhuan: 0 })), true);
    /* A — dòng chưa có giá vốn vẫn là một cái máy: giá vốn là chuyện của
       bảng báo cáo, không phải điều kiện để bảo hành. */
    ok('dòng chưa có giá nhập vẫn là một cái máy',
       B.laMayDaBan(dong({ gia_nhap: null, loi_nhuan: null })), true);

    /* B — ba thứ không phải máy. */
    ok('chiết khấu thì không', B.laMayDaBan(dong({ la_chiet_khau: true })), false);
    ok('phụ phí cố định thì không',
       B.laMayDaBan(dong({ la_phu_phi_co_dinh: 'Vận chuyển' })), false);
    /* Hàng trả lại: CẢ dòng bán lẫn dòng trả đều mang `btl_trang_thai`. Máy
       đã quay về kho thì không ai đi kích hoạt bảo hành cho nó. */
    ok('dòng trả lại (đã khớp) thì không',
       B.laMayDaBan(dong({ btl_trang_thai: 'khop', so_luong: 0 })), false);
    ok('dòng bán bị trả lại cũng không',
       B.laMayDaBan(dong({ btl_trang_thai: 'khop', la_btl: false, so_luong: 0 })), false);
    ok('BTL chưa rõ tiền cũng không',
       B.laMayDaBan(dong({ btl_trang_thai: 'chua-ro', so_luong: -1 })), false);

    ok('số lượng 0 thì không', B.laMayDaBan(dong({ so_luong: 0 })), false);
    ok('số lượng âm thì không', B.laMayDaBan(dong({ so_luong: -1 })), false);
    ok('không phải object thì không', B.laMayDaBan(null), false);
  }

  console.log('\n4) tachImei — một ô, nhiều máy');
  {
    /* Ca thật của sổ 2025 (xem `dong-hang.mjs`): hai IMEI trong một ô, ngăn
       nhau bằng dấu ngã. Hiện ra thành MỘT chuỗi dài là người dùng phải tự
       cắt bằng mắt lúc đối chiếu tem máy. */
    ok('hai IMEI ngăn bằng ~', B.tachImei('%F1518279574 ~ %E1330129573'),
       ['%F1518279574', '%E1330129573']);
    ok('ngăn bằng dấu phẩy', B.tachImei('A1, B2'), ['A1', 'B2']);
    ok('ngăn bằng xuống dòng', B.tachImei('A1\nB2'), ['A1', 'B2']);
    ok('một mã thì vẫn là một phần tử', B.tachImei(' A1 '), ['A1']);
    ok('ô trống → mảng rỗng', B.tachImei(''), []);
    ok('null → mảng rỗng', B.tachImei(null), []);

    /* KHÔNG dọn ký tự lạ bên trong một mã: ô IMEI là thứ đem đối chiếu với
       cái tem trên máy, nên nó phải hiện ra ĐÚNG như sổ ghi. */
    ok('giữ nguyên ký tự lạ trong mã', B.tachImei('%F1518279574'), ['%F1518279574']);
  }

  console.log('\n5) dsKichHoat — chia theo hãng, và đếm phần chưa xếp được');
  {
    const b = bang([
      dong({ khoa: 'k1', hang: 'Samsung', ma_san_pham: 'Tivi Samsung' }),
      dong({ khoa: 'k2', hang: 'LG', ma_san_pham: 'Tủ lạnh LG' }),
      dong({ khoa: 'k3', hang: 'TCL', ma_san_pham: 'Tivi TCL' }),       // ngoài 10 hãng
      dong({ khoa: 'k4', hang: null, ma_san_pham: 'Chân máy giặt' }),   // chưa gán mã
      dong({ khoa: 'k5', la_chiet_khau: true, hang: null }),
    ]);
    const r = B.dsKichHoat(b, {});

    ok('máy Samsung vào tab Samsung', r.hang.Samsung.chua.map(x => x.khoa), ['k1']);
    ok('máy LG vào tab LG', r.hang.LG.chua.map(x => x.khoa), ['k2']);

    /* D — hai dòng không thuộc tab nào (một vì hãng ngoài danh sách, một vì
       chưa gán mã). Chủ dự án chốt chỉ mười tab, nên chúng KHÔNG hiện ra —
       nhưng phải được ĐẾM, để màn hình nói được một câu thật thay vì để hai
       cái máy bốc hơi. */
    ok('hai dòng chưa xếp được hãng đều được đếm', r.tom_tat.chua_ro_hang, 2);
    /* Và chiết khấu KHÔNG bị đếm vào đó: nó không phải một cái máy, nên nó
       không phải "một cái máy chưa xếp được hãng". Đếm nhầm là mời người
       dùng đi gán mã cho một khoản tiền. */
    ok('chiết khấu không bị đếm là "chưa rõ hãng"', r.tom_tat.tong_may, 4);
    ok('tổng chưa kích hoạt chỉ đếm dòng có tab', r.tom_tat.chua, 2);
  }

  console.log('\n6) Mỗi dòng mang đủ bảy cột chủ dự án chốt');
  {
    const b = bang([dong({ khoa: 'k1', ma_san_pham: 'Tivi Samsung 65U8500F',
                           ma_hien: '65U8500F', so_luong: 2, imei: 'A1 ~ B2' })],
                   '2026-09-03');
    const m = B.dsKichHoat(b, {}).hang.Samsung.chua[0];
    ok('Ngày', m.ngay, '2026-09-03');
    ok('số BH', m.so_ct, 'BH1');
    /* Mã sản phẩm ưu tiên cách viết trên bảng giá (`ma_hien`), đúng như bảng
       báo cáo — cùng một cái máy phải đọc lên giống nhau ở hai tab. */
    ok('Mã sản phẩm', m.ma_san_pham, '65U8500F');
    ok('Số lượng', m.so_luong, 2);
    ok('Tên khách', m.ten_khach, 'Anh A');
    ok('SĐT', m.dien_thoai, '0900');
    ok('Địa chỉ', m.dia_chi, 'Hà Nội');
    ok('Số imei', m.imei, ['A1', 'B2']);

    /* Số lượng 2 mà sổ chỉ khai 1 IMEI thì vẫn là THIẾU — con số người dùng
       phải đi tìm lại, nên nó được tính ở đây chứ không để màn hình tự suy. */
    const thieu = B.dsKichHoat(
      bang([dong({ so_luong: 2, imei: 'A1' })]), {}).hang.Samsung.chua[0];
    ok('2 máy mà 1 IMEI → thiếu', thieu.thieu_imei, true);
    ok('  · và 2 máy 2 IMEI thì không thiếu',
       B.dsKichHoat(bang([dong({ so_luong: 2, imei: 'A1 ~ B2' })]), {})
         .hang.Samsung.chua[0].thieu_imei, false);

    /* KHÔNG bắn tiền sang tab này: nó không hiện đồng nào, mà dòng đầy đủ
       mang giá nhập và lợi nhuận của cả công ty. */
    for (const t of ['gia_nhap', 'gia_ban', 'loi_nhuan', 'tong_ban', 'quy_doi']) {
      ok('không mang trường tiền "' + t + '"', t in m, false);
    }
  }

  console.log('\n7) Tick — ăn đúng dòng, và khoá là khoá BỀN của CLAUDE.md');
  {
    const k1 = D.khoaDong('BH72812', 'Tủ lạnh Samsung', 0);
    const k2 = D.khoaDong('BH72812', 'Tủ lạnh Samsung', 1);
    const b = bang([dong({ khoa: k1, ma_san_pham: 'Tủ lạnh Samsung' }),
                    dong({ khoa: k2, ma_san_pham: 'Tủ lạnh Samsung' })]);

    /* E — hai dòng GIỐNG HỆT nhau trong cùng một chứng từ (mua hai cái tủ
       lạnh cùng model). Khoá phân biệt chúng bằng "lần xuất hiện thứ mấy",
       nên tick một cái không được làm biến mất cái kia. */
    const r = B.dsKichHoat(b, { [k1]: { luc: 1, boi: 'a@b.c' } });
    ok('tick dòng 1 → chỉ dòng 2 còn ở danh sách chưa kích hoạt',
       r.hang.Samsung.chua.map(x => x.khoa), [k2]);
    ok('  · và dòng 1 nằm ở danh sách đã kích hoạt',
       r.hang.Samsung.da.map(x => x.khoa), [k1]);
    ok('  · kèm người và lúc tick', r.hang.Samsung.da[0].kich_hoat_boi, 'a@b.c');
    ok('  · số đếm của tab khớp', r.tom_tat_hang.Samsung, { chua: 1, da: 1 });

    /* Khoá không mang số thứ tự dòng trong bảng (CLAUDE.md: "Tuyệt đối không
       dùng số thứ tự đơn"). Bài này ghim đúng cái khoá ấy: nó suy từ số
       chứng từ + tên hàng, nên nhập lại sổ không làm tick nhảy sang máy của
       người khác. */
    ok('khoá dựng từ số chứng từ + tên hàng + lần xuất hiện',
       k1.startsWith('BH72812|') && k1.endsWith('|0'), true);
  }

  console.log('\n8) daKichHoat — đọc được cả ô người sửa tay trên Console');
  {
    ok('bản ghi đủ', B.daKichHoat({ luc: 1, boi: 'a' }), true);
    /* Một ô sửa tay trên Firebase Console rất dễ thành `true` trần. Hiểu nhầm
       nó thành "chưa kích hoạt" là bắt người dùng làm lại một việc đã xong. */
    ok('true trần cũng là đã kích hoạt', B.daKichHoat(true), true);
    ok('null là chưa', B.daKichHoat(null), false);
    ok('false là chưa', B.daKichHoat(false), false);
    ok('không có ô nào là chưa', B.daKichHoat(undefined), false);
  }

  console.log('\n9) Thứ tự dòng — hai lượt mở cùng một tháng ra cùng một thứ tự');
  {
    /* Khoá Firebase không giữ thứ tự chèn, nên thứ tự phải do phép sắp quyết
       định. Không có nó thì mỗi lượt F5 danh sách xáo lại, và người đang dò
       từ trên xuống mất chỗ. */
    const b = { ngay: [
      { ngay: '2026-09-05', don: [{ so_ct: 'BH9', dong: [dong({ khoa: 'z' })] }] },
      { ngay: '2026-09-01', don: [{ so_ct: 'BH2', dong: [dong({ khoa: 'y' })] },
                                  { so_ct: 'BH1', dong: [dong({ khoa: 'x' })] }] },
    ] };
    ok('sắp theo ngày rồi tới số chứng từ',
       B.dsKichHoat(b, {}).hang.Samsung.chua.map(x => x.khoa), ['x', 'y', 'z']);
  }

  console.log('\n10) donHuongDan — nhánh Firebase là dữ liệu, không được tin');
  {
    const h = B.donHuongDan({
      dang_nhap: { user: 'tinphat', mat_khau: '123', huong_dan: 'Vào cổng ABC' },
      buoc: {
        b2: { thu_tu: 20, chu: 'Bước hai', anh: 'anh2' },
        b1: { thu_tu: 10, chu: 'Bước một', anh: null },
      },
    });
    ok('đọc đúng thông tin đăng nhập', h.dang_nhap.user, 'tinphat');
    ok('bước sắp theo thu_tu, không theo khoá', h.buoc.map(b => b.id), ['b1', 'b2']);

    /* Nhánh này người sửa được thẳng trên Console. Thiếu trường, sai kiểu,
       thừa khoá lạ đều là chuyện có thật — và một hướng dẫn hỏng không được
       làm trắng cả màn hình. */
    const r = B.donHuongDan(null);
    ok('nhánh chưa có gì → khung rỗng dùng được', r, {
      dang_nhap: { user: '', mat_khau: '', huong_dan: '', sua_luc: null, sua_boi: null },
      buoc: [],
    });
    ok('bước sai kiểu bị bỏ, bước lành vẫn còn',
       B.donHuongDan({ buoc: { a: 'hỏng', b: { thu_tu: 1, chu: 'ok' } } }).buoc.map(x => x.id),
       ['b']);
    ok('thu_tu là chuỗi vẫn sắp được',
       B.donHuongDan({ buoc: { a: { thu_tu: '20', chu: 'x' }, b: { thu_tu: '3', chu: 'y' } } })
         .buoc.map(x => x.id), ['b', 'a']);
    ok('thu_tu bằng nhau → khoá làm vế quyết định (thứ tự không nhảy)',
       B.donHuongDan({ buoc: { z: { thu_tu: 1, chu: 'x' }, a: { thu_tu: 1, chu: 'y' } } })
         .buoc.map(x => x.id), ['a', 'z']);
  }

  console.log('\n11) thuTuTiepTheo — chèn được vào giữa mà không đánh số lại cả dãy');
  {
    ok('danh sách rỗng → 10', B.thuTuTiepTheo([]), 10);
    ok('cách nhau 10 để còn chỗ chèn', B.thuTuTiepTheo([{ thu_tu: 10 }, { thu_tu: 20 }]), 30);
    ok('không phải mảng cũng không nổ', B.thuTuTiepTheo(null), 10);
    /* Khoảng giữa hai bước cũ luôn còn chỗ cho một số nguyên — đó là cả lý do
       chọn bước nhảy 10. Đánh số lại cả dãy là một lượt ghi nhiều ô, tức
       nhiều chỗ hỏng nửa chừng. */
    ok('còn chỗ chèn giữa hai bước liền nhau', 20 - 10 > 1, true);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
