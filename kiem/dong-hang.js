/* Dòng hàng (engine/src/dong-hang.mjs): khoá bền, trích dòng, luật đè theo
 * kỳ, đối chiếu file mới với file cũ, và cách thể hiện chiết khấu.
 *
 * Mọi con số trong bộ này lấy từ SỔ THẬT chủ dự án gửi 11/09/2026 (sổ
 * 08/2026 và sổ 09/2026), không phải số bịa — ghi ra đây để lần sau ai sửa
 * còn biết mình đang làm lệch cái gì.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const L = await import('file://' + path.join(GOC, 'engine/src/line.mjs'));
  const G = await import('file://' + path.join(GOC, 'engine/src/gop-ban-hang.mjs'));

  /* ─── Sổ giả lập, dựng ĐÚNG bố cục sổ MISA thật ───
     Hàng 1 tên báo cáo, hàng 2 kỳ, hàng 4 tiêu đề, hàng 5 tiêu đề phụ, dữ
     liệu từ hàng 6. `kiemBoCuc()` canh sáu ô tiêu đề nên không bịa được. */
  const TIEU_DE = ['Ngày ', 'Số BH', 'Diễn giải', 'Tên hàng trên chứng từ ', 'Mã khách hàng',
    'Tên KH', 'Địa chỉ', 'ĐT di động (Người liên hệ)', 'SL', 'Đơn giá', 'Doanh số bán',
    'Chiết khấu', 'NVBH', 'Giao vận', 'Lương chuyến ', 'Trường mở rộng chi tiết 1', 'Lợi nhuận'];
  const TIEU_DE_PHU = ['Ngày hạch toán', 'Số chứng từ', 'Diễn giải chung', '', '', 'Tên khách hàng',
    '', '', 'Số lượng bán', '', '', '', 'Tên nhân viên bán hàng', '', '', '', ''];

  /** Một dòng sổ. `ngay` là chuỗi ISO — `doiNgay` nhận cả ba dạng thật. */
  const dg = (o) => {
    const h = new Array(17).fill('');
    h[0] = o.ngay; h[1] = o.ct; h[3] = o.ten; h[4] = o.ma_khach || '';
    h[5] = o.khach || ''; h[6] = o.dia_chi || ''; h[7] = o.dt || '';
    h[8] = o.sl ?? 1; h[9] = o.dg ?? 0; h[10] = o.ds ?? 0; h[11] = o.ck ?? 0;
    h[12] = o.nv || ''; h[15] = o.imei || '';
    return h;
  };
  const so = (dong) => [['SỔ CHI TIẾT BÁN HÀNG'], ['Tháng 9 năm 2026'], [], TIEU_DE, TIEU_DE_PHU, ...dong];

  console.log('\n1) Khoá dòng — BỀN qua mỗi lần nhập lại, không bao giờ theo số thứ tự dòng');
  {
    ok('cùng (chứng từ, tên, lần) ra cùng khoá',
       D.khoaDong('BH72812', 'Tủ lạnh Samsung', 1), D.khoaDong('BH72812', 'Tủ lạnh Samsung', 1));
    ok('khác lần xuất hiện thì khác khoá',
       D.khoaDong('BH1', 'Chân máy giặt', 1) === D.khoaDong('BH1', 'Chân máy giặt', 2), false);

    /* Ký tự Firebase cấm trong tên hàng là chuyện THẬT: 1.360/27.299 dòng của
       ba sổ thật có dấu chấm hoặc gạch chéo ("RS57DG400EM9/S"). Lọt một cái
       vào khoá là lượt ghi hỏng, hoặc tệ hơn: ghi vào một nhánh khác. */
    const k = D.khoaDong('BH1', 'Tủ lạnh RS57DG400EM9/S 1.5m', 1);
    ok('khoá không còn ký tự Firebase cấm', /[.#$/[\]]/.test(k), false);

    /* Thay bằng "~" chứ không BỎ ĐI: bỏ đi thì "A.B" và "AB" thành một khoá,
       tức gộp nhầm hai mặt hàng khác nhau thành một dòng. */
    ok('"A.B" và "AB" KHÔNG đụng khoá',
       D.khoaDong('BH1', 'A.B', 1) === D.khoaDong('BH1', 'AB', 1), false);

    /* Tên hàng dài nhất đo được trên sổ thật là 190 ký tự (một ô tên hàng bị
       dùng làm ô ghi chú thu hồi). Cắt cho vừa khoá Firebase, nhưng cắt trần
       thì hai tên dài khác nhau trong cùng chứng từ sẽ đụng khoá. */
    const dai1 = 'X'.repeat(150) + 'MỘT';
    const dai2 = 'X'.repeat(150) + 'HAI';
    ok('hai tên dài khác nhau vẫn ra hai khoá khác nhau',
       D.khoaDong('BH1', dai1, 1) === D.khoaDong('BH1', dai2, 1), false);
    ok('khoá của tên dài vẫn ngắn hơn giới hạn khoá Firebase (768 byte)',
       Buffer.byteLength(D.khoaDong('BH1', dai1, 1)) < 768, true);
  }

  console.log('\n2) Trích dòng hàng — tách đúng ba nhánh theo bảng phân quyền CLAUDE.md');
  {
    const t = D.trichDongHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tủ lạnh', sl: 1, dg: 11600000, ds: 11600000, ck: 100000,
           nv: 'Đức Hiệp', khach: 'Chị Nga', dt: '0988456479', dia_chi: 'Số 5 ngõ 28', imei: 'SN123' }),
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Máy rửa bát', sl: 1, dg: 6600000, ds: 6600000, ck: 100000,
           nv: 'Đức Hiệp', khach: 'Chị Nga', dt: '0988456479', dia_chi: 'Số 5 ngõ 28' }),
      dg({ ngay: '2026-09-05', ct: 'BH2', ten: 'Tivi', sl: 1, dg: 15700000, ds: 15700000,
           nv: 'FANPAGE 0327339229', khach: 'Anh Long' }),
    ]));

    ok('gom đúng một kỳ', Object.keys(t.dong), ['2026-09']);
    ok('ba dòng hàng', Object.keys(t.dong['2026-09']).length, 3);
    ok('phạm vi ngày đúng', t.pham_vi['2026-09'],
       { tu: '2026-09-02', den: '2026-09-05', so_ngay: 2, so_dong: 3, so_don: 2 });

    /* PII KHÔNG được lẫn vào `bc/dong` — nhánh đó không phải nhánh đóng như
       `bc/khach`. Kiểm bằng cách soi cả cây, không kiểm từng trường: thêm một
       trường mới sau này mà lỡ tay mang tên khách theo thì bài này đỏ. */
    const chuoiDong = JSON.stringify(t.dong);
    ok('bc/dong KHÔNG chứa tên khách', /Chị Nga|Anh Long/.test(chuoiDong), false);
    ok('bc/dong KHÔNG chứa số điện thoại', /0988456479/.test(chuoiDong), false);
    ok('bc/dong KHÔNG chứa địa chỉ', /ngõ 28/.test(chuoiDong), false);

    /* Khoá HAI TẦNG: kỳ rồi mới tới số chứng từ — không phẳng như bản đầu.
       Đây là chỗ giải quyết việc `bc/khach` bị đọc TOÀN BỘ mỗi lần mở một
       kỳ (đo trên sổ thật: 151 KB/tháng, phẳng thì con số đó cộng dồn mãi
       mãi — 36 tháng đã 5,29 MB cho một lượt xem). */
    ok('bc/khach khoá theo KỲ trước', Object.keys(t.khach), ['2026-09']);
    ok('rồi mới tới SỐ CHỨNG TỪ, không theo dòng', Object.keys(t.khach['2026-09']).sort(), ['BH1', 'BH2']);
    ok('bc/khach giữ đủ ba trường', t.khach['2026-09'].BH1,
       { ten: 'Chị Nga', dien_thoai: '0988456479', dia_chi: 'Số 5 ngõ 28' });
    ok('bc/imei trỏ ngược về đơn', t.imei.SN123, { so_ct: 'BH1', ngay: '2026-09-02', ten_hang: 'Tủ lạnh' });

    /* Chiết khấu ở lại trường riêng, dòng hàng giữ NGUYÊN cột `Doanh số bán`
       của sổ. Trừ ở đây là trừ hai lần khi `dungBangDon` thêm dòng chiết khấu. */
    const mot = t.dong['2026-09'][D.khoaDong('BH1', 'Tủ lạnh', 1)];
    ok('doanh_so giữ nguyên cột sổ, CHƯA trừ chiết khấu', mot.doanh_so, 11600000);
    ok('chiết khấu nằm ở trường riêng', mot.chiet_khau, 100000);
  }

  console.log('\n3) Dòng không dùng được — bỏ đúng như gopSoBanHang, không im lặng');
  {
    const t = D.trichDongHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', ds: 1000, nv: 'A' }),
      /* Không số chứng từ = không có gì để nhập. Đây CŨNG là thứ bỏ đúng dòng
         `Tổng cộng` sổ tự in ở cuối — cộng nó vào là gấp đôi doanh thu. */
      dg({ ngay: '2026-09-02', ct: '', ten: 'Tổng cộng', ds: 999999 }),
      /* Có chứng từ nhưng không đọc được ngày → không có kỳ nào để xếp vào. */
      dg({ ngay: '', ct: 'BH9', ten: 'Tivi', ds: 500, nv: 'A' }),
    ]));
    ok('chỉ một dòng vào cây', Object.keys(t.dong['2026-09']).length, 1);
    ok('dòng không có ngày được ĐẾM, không biến mất', t.dong_khong_co_ky, 1);
  }

  console.log('\n4) Luật đè theo TỪNG KỲ — tải sổ tháng 10 không được xoá tháng 9');
  {
    const cu = { '2026-09': { tu: '2026-09-01', den: '2026-09-30' } };

    ok('kỳ chưa có dữ liệu → ghi mới, không canh gì',
       D.kiemPhuSong({ '2026-10': { tu: '2026-10-01', den: '2026-10-15' } }, cu).hop_le, true);

    ok('file phủ trọn kỳ cũ → cho đè',
       D.kiemPhuSong({ '2026-09': { tu: '2026-09-01', den: '2026-09-30' } }, cu).hop_le, true);

    /* Ví dụ (d) của chủ dự án: file 1/9–15/10 phủ trọn tháng 9 đang có, nên
       tháng 9 đè được và tháng 10 ghi mới. */
    ok('file 1/9–15/10 → tháng 9 đè, tháng 10 ghi mới',
       D.kiemPhuSong({ '2026-09': { tu: '2026-09-01', den: '2026-09-30' },
                       '2026-10': { tu: '2026-10-01', den: '2026-10-15' } }, cu).hop_le, true);

    /* Đây là ca phải TỪ CHỐI: cho ghi thì 01–15/09 biến mất lặng lẽ và tổng
       tháng tụt mà không ai biết vì sao. */
    const thieu = D.kiemPhuSong({ '2026-09': { tu: '2026-09-16', den: '2026-09-30' } }, cu);
    ok('file thiếu nửa đầu tháng → TỪ CHỐI', thieu.hop_le, false);
    ok('nói rõ kỳ nào thiếu và thiếu so với khoảng nào', thieu.thieu,
       [{ ky: '2026-09', cu: { tu: '2026-09-01', den: '2026-09-30' },
          moi: { tu: '2026-09-16', den: '2026-09-30' } }]);

    /* Kỳ đang có mà file mới không nhắc tới thì KHÔNG ĐỤNG — đây đúng là câu
       "tải riêng file tháng 10 thì tháng 9 vẫn giữ nguyên". */
    ok('kỳ cũ vắng mặt trong file mới KHÔNG bị coi là lỗi',
       D.kiemPhuSong({ '2026-10': { tu: '2026-10-01', den: '2026-10-15' } }, cu).thieu, []);
  }

  console.log('\n5) Phạm vi lấy từ bc/ky — để 20 kỳ legacy (không có dòng hàng) vẫn được canh');
  {
    ok('đọc đúng ngày đầu và ngày cuối',
       D.phamViCayKy({ 'Đức Hiệp': { '2026-08-03': {}, '2026-08-28': {} },
                       'Mr Quý': { '2026-08-01': {} } }),
       { tu: '2026-08-01', den: '2026-08-28', so_ngay: 3 });
    ok('kỳ rỗng trả null', D.phamViCayKy({}), null);
  }

  console.log('\n6) Đối chiếu file mới ↔ file cũ');
  {
    const r = (o) => ({ ngay: '2026-09-02', so_ct: 'BH1', ten_hang: 'Tivi', so_luong: 1,
                        don_gia: 0, doanh_so: 0, chiet_khau: 0, nhan_vien: 'A', ...o });
    const cu = { k1: r({}), k2: r({ doanh_so: 500 }), k3: r({ doanh_so: 700 }) };
    const moi = { k1: r({}), k2: r({ doanh_so: 900 }), k4: r({ doanh_so: 100 }) };

    const kq = D.doiChieuKy(cu, moi, []);
    ok('đếm đúng thêm/đổi/mất/giữ',
       { ...kq.tom_tat }, { them: 1, doi: 1, mat: 1, bi_khoa: 0, giu: 1, tong_sau_khi_ghi: 3 });
    ok('dòng biến mất bị XOÁ THẲNG (chủ dự án chốt)', kq.cay.k3, undefined);
    ok('dòng đổi lấy bản MỚI', kq.cay.k2.doanh_so, 900);
    ok('nói rõ trường nào đổi, trước sau bao nhiêu',
       { doi_gi: kq.doi[0].doi_gi, truoc: kq.doi[0].truoc, sau: kq.doi[0].sau },
       { doi_gi: ['doanh_so'], truoc: { doanh_so: 500 }, sau: { doanh_so: 900 } });

    /* Trường hợp (c) của chủ dự án: đơn đã chỉnh sửa tay thì KHÔNG đè, cảnh
       báo riêng để kiểm lại. Quyết định của người không bao giờ thua một lượt
       tải file (CLAUDE.md — "Nhập sổ"). */
    const khoa = D.doiChieuKy(cu, moi, ['k2']);
    ok('dòng đã sửa tay GIỮ bản cũ', khoa.cay.k2.doanh_so, 500);
    ok('và được cảnh báo riêng', khoa.bi_khoa.map(b => [b.khoa, b.ly_do]), [['k2', 'da-sua-tay']]);
    ok('không bị đếm vào "đổi"', { doi: khoa.tom_tat.doi, bi_khoa: khoa.tom_tat.bi_khoa }, { doi: 0, bi_khoa: 1 });

    /* Dòng đã sửa tay mà BIẾN MẤT khỏi file mới: xoá nó là xoá luôn một quyết
       định của người mà không hỏi ai — giữ lại và cảnh báo. */
    const mat = D.doiChieuKy(cu, moi, ['k3']);
    ok('dòng đã sửa tay mà biến mất thì GIỮ LẠI', mat.cay.k3.doanh_so, 700);
    ok('và nói rõ vì sao', mat.bi_khoa.map(b => b.ly_do), ['da-sua-tay-va-bien-mat']);

    /* Kỳ mới hoàn toàn: 1.607 dòng "thêm" là chuyện bình thường của sổ thật,
       nên danh sách ví dụ phải bị chặn — một cảnh báo 1.607 dòng thì không ai
       đọc, và `tom_tat` đã nói đủ quy mô. */
    const to = {};
    for (let i = 0; i < 200; i++) to['k' + i] = r({});
    const lonn = D.doiChieuKy({}, to, []);
    ok('đếm đủ 200 dòng thêm', lonn.tom_tat.them, 200);
    ok('nhưng chỉ kể tối đa 50 ví dụ', lonn.them.length, 50);
  }

  console.log('\n7) Bảng đơn hàng — chiết khấu GỘP thành đúng một dòng, mang dấu âm');
  {
    /* Ca thật `BH72812` của sổ 08/2026: MISA rải chiết khấu ra CẢ HAI dòng,
       100.000 đ mỗi dòng. Chủ dự án chốt: cộng lại thành một dòng duy nhất. */
    const t = D.trichDongHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH72812', ten: 'Tủ lạnh Samsung', sl: 1, dg: 11600000,
           ds: 11600000, ck: 100000, nv: 'Đức Hiệp', khach: 'Chị Nga', dt: '0988456479' }),
      dg({ ngay: '2026-09-02', ct: 'BH72812', ten: 'Máy rửa bát', sl: 1, dg: 6600000,
           ds: 6600000, ck: 100000, nv: 'Đức Hiệp', khach: 'Chị Nga', dt: '0988456479' }),
    ]));
    const bang = D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], L.BANG_LINE_HAT_GIONG, null);
    const don = bang.ngay[0].don[0];

    ok('hai dòng hàng + đúng MỘT dòng chiết khấu', don.dong.length, 3);
    ok('chỉ một dòng mang cờ chiết khấu', don.dong.filter(d => d.la_chiet_khau).length, 1);

    const ck = don.dong.find(d => d.la_chiet_khau);
    ok('mã hàng là "Chiết khấu"', ck.ma_san_pham, D.MA_CHIET_KHAU);
    ok('cộng cả hai dòng lại: 100.000 + 100.000', ck.tong_ban, -200000);
    ok('giá bán mang dấu âm', ck.gia_ban, -200000);
    ok('giá nhập 0 (chủ dự án chốt)', ck.gia_nhap, 0);
    ok('nên lợi nhuận của dòng chiết khấu biết chắc, không phải null', ck.loi_nhuan, -200000);

    /* Đây là bất biến quan trọng nhất của cách thể hiện này: cộng các dòng
       của đơn phải ra ĐÚNG con số `gopSoBanHang()` đưa vào `bc/ky` và đúng
       con số biểu đồ P2(b) đang vẽ. Lệch là bảng đơn hàng và biểu đồ kể hai
       câu chuyện khác nhau về cùng một tháng. */
    const congDong = don.dong.reduce((s, d) => s + d.tong_ban, 0);
    ok('cộng các dòng == tổng đơn', congDong, don.tong_ban);
    const gop = G.gopSoBanHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH72812', ten: 'Tủ lạnh Samsung', sl: 1, dg: 11600000,
           ds: 11600000, ck: 100000, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-02', ct: 'BH72812', ten: 'Máy rửa bát', sl: 1, dg: 6600000,
           ds: 6600000, ck: 100000, nv: 'Đức Hiệp' }),
    ]));
    ok('và bằng ĐÚNG con số gopSoBanHang đưa vào bc/ky',
       bang.tom_tat.doanh_so, gop.tom_tat.doanh_so_tong);

    ok('đơn mang thông tin khách lấy từ nhánh đóng bc/khach',
       { ten: don.ten_khach, dt: don.dien_thoai }, { ten: 'Chị Nga', dt: '0988456479' });

    /* Sáu cột chưa có nguồn ở P3 phải là `null` TƯỜNG MINH, không phải 0:
       0 đồng và "chưa biết" là hai chuyện khác nhau, và P4 mới điền chúng. */
    const hang = don.dong.find(d => !d.la_chiet_khau);
    ok('giá nhập chưa có → null, KHÔNG phải 0', hang.gia_nhap, null);
    ok('lợi nhuận dòng hàng thật chưa tính được → null', hang.loi_nhuan, null);
    ok('nơi nhập / hãng / ngành hàng / ghi chú đều null',
       [hang.noi_nhap, hang.hang, hang.nganh_hang, hang.ghi_chu], [null, null, null, null]);
  }

  console.log('\n8) Bảng đơn hàng — lọc theo line, và line lấy từ bảng ánh xạ chứ không từ tên');
  {
    const t = D.trichDongHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: 100, ds: 100, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-03', ct: 'BH2', ten: 'Tủ lạnh', sl: 1, dg: 200, ds: 200,
           nv: 'FANPAGE 0327339229' }),
    ]));
    const B = L.BANG_LINE_HAT_GIONG;

    const noiThanh = D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], B, 'Nội thành');
    ok('lọc Nội thành chỉ còn đơn của Đức Hiệp', noiThanh.ngay.map(n => n.don.map(d => d.so_ct)), [['BH1']]);

    /* Chính là ca đã sửa ở lượt này: sổ 09/2026 ghi HOA "FANPAGE 0327339229".
       Bảng line khai đúng dạng đó nên đơn rơi vào Fanpage, không rơi "Khác". */
    const fanpage = D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], B, 'Fanpage');
    ok('FANPAGE viết hoa rơi ĐÚNG line Fanpage', fanpage.ngay.map(n => n.don.map(d => d.so_ct)), [['BH2']]);
    ok('và KHÔNG rơi nhầm sang Khác',
       D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], B, L.LINE_KHAC).ngay, []);

    ok('không lọc thì có cả hai ngày', D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], B, null).ngay.length, 2);
    ok('ngày sắp tăng dần', D.dungBangDon(t.dong['2026-09'], t.khach['2026-09'], B, null).ngay.map(n => n.ngay),
       ['2026-09-02', '2026-09-03']);
  }

  console.log('\n9) Tóm tắt line — line chưa có đơn nào vẫn phải hiện ra với số 0');
  {
    const t = D.trichDongHang(so([
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: 1000, ds: 1000, ck: 100, nv: 'Đức Hiệp' }),
    ]));
    const tt = D.tomTatLine(t.dong['2026-09'], L.BANG_LINE_HAT_GIONG);

    ok('đủ mười line theo thu_tu, không suy từ dữ liệu', tt.thu_tu.length, 10);
    ok('Shopee chưa có đơn nào vẫn hiện ra', tt.line.Shopee, { doanh_so: 0, so_don: 0, so_dong: 0 });
    ok('Nội thành đã trừ chiết khấu, khớp luật doanh số đang bật',
       tt.line['Nội thành'], { doanh_so: 900, so_don: 1, so_dong: 1 });
  }

  console.log('\n10) xuLySoBanHang — một lượt gọi trả cả tổng lẫn dòng');
  {
    const dong = [
      dg({ ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', sl: 1, dg: 1000, ds: 1000, ck: 100, nv: 'Đức Hiệp' }),
      dg({ ngay: '2026-09-03', ct: 'BH2', ten: 'Tủ lạnh', sl: 1, dg: 2000, ds: 2000, nv: 'Mr Quý' }),
    ];
    const kq = D.xuLySoBanHang(so(dong));
    const gop = G.gopSoBanHang(so(dong));

    /* Gộp hai việc vào một hàm là để ma trận ô (0,45 MB một tháng, 7 MB một
       năm) chỉ đi qua Service Binding MỘT lần. Nhưng nó không được đổi một
       con số nào của `gopSoBanHang` — bài này ghim đúng điều đó. */
    ok('tổng y hệt gopSoBanHang gọi riêng', kq.ky, gop.ky);
    ok('tóm tắt y hệt', kq.tom_tat, gop.tom_tat);
    ok('kèm dòng hàng', Object.keys(kq.dong['2026-09']).length, 2);
    ok('kèm phạm vi để canh lượt đè', kq.pham_vi['2026-09'].so_don, 2);
    ok('đối chiếu nội bộ vẫn khớp', kq.tom_tat.doi_chieu_noi_bo.khop, true);

    /* Bố cục sai thì NÉM, không trả bảng rỗng — CLAUDE.md "Nguồn hỏng thì
       BÁO LỖI". Gateway dựa vào đúng chỗ này để từ chối file lạ. */
    let nem = null;
    try { D.xuLySoBanHang([[], [], [], ['sai'], [], []]); } catch (e) { nem = e.ma; }
    ok('sổ sai bố cục → ném lỗi có tên', nem, 'bo-cuc-khong-khop');
  }

  xong();
})();
