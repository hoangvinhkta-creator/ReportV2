/* CHỨNG TỪ BÁN TRẢ LẠI (engine/src/btl.mjs).
 *
 * Năm thứ bộ này canh, xếp theo mức đắt nếu hỏng:
 *
 *  A. TRỪ HAI LẦN. Đơn gốc nằm ngay trong kỳ đang xem thì doanh số của nó
 *     đã có trong bảng; trừ thêm lượt trả lại nữa là trừ đúng hai lần. Cả
 *     hai dòng phải về 0 — "coi như 2 dòng thông báo" (chủ dự án chốt).
 *
 *  B. KHÔNG TRỪ LẦN NÀO. Đơn gốc ở tháng khác thì doanh số đã tính ở tháng
 *     ấy, và lượt này là lần trừ DUY NHẤT. Bỏ qua là một lượt trả hàng không
 *     bao giờ được trừ — đúng hành vi của bản trước file này.
 *
 *  C. GHÉP NHẦM MÓN. Một khách mua ba món rồi trả một món là chuyện thường.
 *     Ghép theo mỗi khách là trả nhầm món, trừ nhầm tiền, và không ai thấy.
 *
 *  D. TRẢ HÀNG LÀM TĂNG LÃI. Số lượng −1 chạy vào `tổng bán − giá vốn × SL`.
 *     Nếu không truy ra được số tiền mà vẫn áp công thức ấy, kết quả là một
 *     số DƯƠNG: mỗi lượt trả hàng đẩy lợi nhuận lên.
 *
 *  E. HAI TAB HAI CON SỐ. Phép ghép chạy trên TOÀN kỳ chứ không trên bảng đã
 *     lọc line — nếu không, đơn gốc của line A và chứng từ BTL của line B chỉ
 *     tìm thấy nhau ở tab Tổng hợp.
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/btl.mjs'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const S = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));

  const BANG_LINE = { thu_tu: ['Nội thành', 'Ngoại thành'],
    cua_ten: { 'Đức Hiệp': 'Nội thành', 'Minh Tâm': 'Ngoại thành' } };

  const dg = (o) => ({ ngay: o.ngay, so_ct: o.ct, ten_hang: o.ten,
    so_luong: o.sl ?? 1, don_gia: o.dg ?? 0, doanh_so: o.ds ?? 0,
    chiet_khau: 0, nhan_vien: o.nv || 'Đức Hiệp', imei: null });

  /** Cây dòng + cây khách của một kỳ, khai bằng một danh sách cho gọn. */
  function ky(ds) {
    const dong = {}, khach = {};
    const dem = new Map();
    for (const o of ds) {
      const lan = (dem.get(o.ct + '\x1f' + o.ten) || 0) + 1;
      dem.set(o.ct + '\x1f' + o.ten, lan);
      dong[D.khoaDong(o.ct, o.ten, lan)] = dg(o);
      if (o.khach || o.dt)
        khach[D.deKhoa(o.ct)] = { ten: o.khach || '', dien_thoai: o.dt || '', dia_chi: '' };
    }
    return { dong, khach };
  }

  const moiDong = (b) => {
    const r = [];
    for (const ng of b.ngay) for (const don of ng.don) for (const d of don.dong) r.push(d);
    return r;
  };
  /** Dựng bảng đúng thứ tự thật của Engine: dựng → BTL → (giá vốn) → sửa tay. */
  const ve = (k, line) => {
    const b = D.dungBangDon(k.dong, k.khach, BANG_LINE, line || null);
    B.apDungBTL(b, B.ghepBTL(k.dong, k.khach));
    return b;
  };
  const timTheoCt = (b, ct) => moiDong(b).filter((d) => String(d.khoa || '').startsWith(ct + '|'));

  /* ─────────── 1. Nhận dạng chứng từ ─────────── */

  console.log('\n1) Nhận dạng chứng từ bán trả lại');
  {
    ok('BTL là bán trả lại', B.laChungTuBTL('BTL123'), true);
    ok('thường hoá vẫn nhận', B.laChungTuBTL('btl123'), true);
    ok('BH không phải', B.laChungTuBTL('BH74228'), false);
    /* Nhận theo TIỀN TỐ, không theo "có chứa": một chứng từ bán hàng mang
       chữ BTL ở giữa số không phải một lượt trả hàng. */
    ok('BTL ở giữa số KHÔNG tính', B.laChungTuBTL('BH-BTL-9'), false);
    ok('rỗng không tính', B.laChungTuBTL(''), false);
    ok('null không nổ', B.laChungTuBTL(null), false);
  }

  /* ─────────── 2. Ghép được — hai dòng thông báo ─────────── */

  console.log('\n2) Đơn gốc NẰM TRONG kỳ — cả hai dòng về 0');
  {
    const k = ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]);
    const b = ve(k);
    const goc = timTheoCt(b, 'BH1')[0];
    const tra = timTheoCt(b, 'BTL1')[0];

    ok('dòng gốc về số lượng 0', goc.so_luong, 0);
    ok('dòng gốc về tiền 0', goc.tong_ban, 0);
    ok('dòng trả lại về số lượng 0', tra.so_luong, 0);
    ok('dòng trả lại về tiền 0', tra.tong_ban, 0);
    ok('cả hai được đánh dấu là cặp thông báo', [goc.btl_thong_bao, tra.btl_thong_bao], [true, true]);
    ok('dòng gốc trỏ sang chứng từ trả lại', goc.btl_doi_ct, 'BTL1');
    ok('dòng trả lại trỏ về chứng từ gốc', tra.btl_doi_ct, 'BH1');
    ok('chỉ dòng BTL mang cờ la_btl', [goc.la_btl, tra.la_btl], [false, true]);
    ok('bản kê đếm đúng một cặp', b.tom_tat_btl.khop, 1);

    /* A — TRỪ HAI LẦN. Đơn gốc 9 triệu nằm ngay trong kỳ; sau lượt trả,
       doanh số của cả kỳ phải về 0, không phải −9 triệu. */
    S.apDungSuaTay(b, {});
    ok('doanh số cả kỳ về 0, KHÔNG trừ hai lần', b.tom_tat.doanh_so, 0);
    ok('lợi nhuận hai dòng là 0 chẵn', [goc.loi_nhuan, tra.loi_nhuan], [0, 0]);
  }

  /* ─────────── 3. Không ghép được — trừ đúng một lần ─────────── */

  console.log('\n3) Đơn gốc Ở THÁNG KHÁC — dòng trả lại mang số lượng −1');
  {
    const k = ky([
      { ngay: '2026-09-09', ct: 'BTL2', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]);
    const b = ve(k);
    const tra = timTheoCt(b, 'BTL2')[0];

    ok('số lượng −1', tra.so_luong, -1);
    /* B — sổ ghi 0 đồng ở cột Doanh số bán nhưng vẫn giữ ĐƠN GIÁ. Đó là con
       số khách đã trả, và là con số phải trừ. */
    ok('tổng bán mang dấu âm, lấy từ đơn giá', tra.tong_ban, -9000000);
    ok('trạng thái là không khớp', tra.btl_trang_thai, 'khong-khop');

    S.apDungSuaTay(b, {});
    ok('doanh số cả kỳ âm đúng một lần', b.tom_tat.doanh_so, -9000000);

    /* Lợi nhuận: `−9tr − 7tr×(−1)` = `−2tr`, đúng phần lãi phải nhả lại. */
    tra.gia_nhap = 7000000;
    S.apDungSuaTay(b, {});
    ok('lợi nhuận = −(lãi đã ăn), không phải số dương', tra.loi_nhuan, -2000000);
  }

  /* ─────────── 4. Không truy ra được tiền ─────────── */

  console.log('\n4) Không truy ra được số tiền — KHÔNG bịa, và KHÔNG làm tăng lãi');
  {
    const k = ky([
      { ngay: '2026-09-09', ct: 'BTL3', ten: 'Tivi TCL 65C6K', dg: 0, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]);
    const b = ve(k);
    const tra = timTheoCt(b, 'BTL3')[0];

    ok('trạng thái nói rõ là chưa rõ tiền', tra.btl_trang_thai, 'khong-ro-tien');
    ok('có cờ để màn hình bôi đỏ', tra.btl_chua_ro_tien, true);
    ok('KHÔNG bịa ra một khoản trừ', tra.tong_ban, 0);
    ok('bản kê đếm riêng', b.tom_tat_btl.khong_ro_tien, 1);

    /* D — TRẢ HÀNG LÀM TĂNG LÃI. Có giá vốn mà áp công thức chung thì ra
       `0 − 7tr×(−1)` = `+7tr`. Phải để trống, và đơn phải nói là thiếu. */
    tra.gia_nhap = 7000000;
    S.apDungSuaTay(b, {});
    ok('lợi nhuận dòng để TRỐNG, không phải số dương', tra.loi_nhuan, null);
    ok('lợi nhuận của đơn cũng để trống', b.ngay[0].don[0].loi_nhuan, null);
  }

  /* ─────────── 5. Điều kiện ghép — ba thứ, không "gần đúng" ─────────── */

  console.log('\n5) Ghép chỉ khi cùng khách, cùng tên hàng, và bán trước ngày trả');
  {
    /* C — GHÉP NHẦM MÓN. */
    const khacMon = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tủ lạnh Sharp', dg: 5000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('khác TÊN HÀNG thì KHÔNG ghép', khacMon.tom_tat_btl.khop, 0);
    ok('  · dòng gốc giữ nguyên doanh số', timTheoCt(khacMon, 'BH1')[0].tong_ban, 9000000);

    const khacKhach = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 0,
        khach: 'Anh Long', dt: '0912000111' },
    ]));
    ok('khác KHÁCH thì KHÔNG ghép', khacKhach.tom_tat_btl.khop, 0);

    const banSau = ve(ky([
      { ngay: '2026-09-20', ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('đơn bán SAU ngày trả thì KHÔNG ghép', banSau.tom_tat_btl.khop, 0);

    const cungNgay = ve(ky([
      { ngay: '2026-09-09', ct: 'BH1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi TCL 65C6K', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('mua rồi trả TRONG NGÀY vẫn ghép', cungNgay.tom_tat_btl.khop, 1);
  }

  /* ─────────── 6. Nhận khách ─────────── */

  console.log('\n6) Nhận khách — số điện thoại trước, tên là lựa chọn sau');
  {
    const khacCachViet = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988 456 479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'chị nga', dt: '+84988456479' },
    ]));
    ok('cùng SĐT viết khác kiểu vẫn là một người', khacCachViet.tom_tat_btl.khop, 1);

    const khongSdt = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000, khach: 'Chị Nga' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0, khach: 'Chị  NGA' },
    ]));
    ok('không có SĐT thì ghép theo tên, bỏ qua hoa/thường và khoảng trắng',
      khongSdt.tom_tat_btl.khop, 1);

    /* Ô SĐT rác ("0", "123") không được biến thành một khoá nhận dạng — nó sẽ
       gộp mọi khách có cùng ô rác ấy thành một người. */
    const sdtRac = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '123' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Anh Long', dt: '123' },
    ]));
    ok('ô SĐT quá ngắn KHÔNG được dùng làm khoá', sdtRac.tom_tat_btl.khop, 0);

    const khongTenKhongSdt = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000 },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0 },
    ]));
    ok('không có gì để nhận khách thì KHÔNG ghép bừa', khongTenKhongSdt.tom_tat_btl.khop, 0);
  }

  /* ─────────── 7. Một dòng gốc chỉ ghép một lần ─────────── */

  console.log('\n7) Mua một chiếc, trả hai lần — chỉ ghép được một');
  {
    const b = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-10', ct: 'BTL2', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('đúng một cặp ghép được', b.tom_tat_btl.khop, 1);
    ok('lượt trả thứ hai thành khoản trừ', b.tom_tat_btl.khong_khop, 1);
    ok('  · và nó là lượt đến SAU', timTheoCt(b, 'BTL2')[0].btl_trang_thai, 'khong-khop');

    /* Mua hai chiếc, trả hai lần thì cả hai phải ghép — nếu không, lượt thứ
       hai bị trừ thêm một lần nữa trong khi doanh số gốc vẫn nằm trong bảng. */
    const hai = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-03', ct: 'BH2', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-10', ct: 'BTL2', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('mua hai, trả hai thì ghép đủ hai cặp', hai.tom_tat_btl.khop, 2);
    S.apDungSuaTay(hai, {});
    ok('  · và doanh số cả kỳ về 0', hai.tom_tat.doanh_so, 0);
  }

  /* ─────────── 8. Ghép trên TOÀN kỳ, không theo tab line ─────────── */

  console.log('\n8) Đơn gốc và chứng từ BTL ở hai line khác nhau');
  {
    const k = ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479', nv: 'Đức Hiệp' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479', nv: 'Minh Tâm' },
    ]);
    /* E — HAI TAB HAI CON SỐ. Mở tab "Ngoại thành" thì đơn gốc không có mặt
       trong bảng, nhưng phép ghép vẫn phải thấy nó — nếu không, dòng BTL
       thành một khoản trừ 9 triệu chỉ tồn tại ở đúng tab ấy. */
    const tabNgoai = ve(k, 'Ngoại thành');
    const tra = timTheoCt(tabNgoai, 'BTL1')[0];
    ok('tab chỉ có dòng BTL vẫn biết là đã ghép', tra.btl_trang_thai, 'khop');
    ok('  · nên KHÔNG trừ lần nữa', tra.tong_ban, 0);

    const tabNoi = ve(k, 'Nội thành');
    ok('tab bên kia thấy dòng gốc đã bị triệt tiêu', timTheoCt(tabNoi, 'BH1')[0].so_luong, 0);

    const tong = ve(k, null);
    ok('tab Tổng hợp ra cùng một kết quả', tong.tom_tat_btl.khop, 1);
  }

  /* ─────────── 9. Không có BTL thì không đổi gì ─────────── */

  console.log('\n9) Kỳ không có chứng từ BTL nào');
  {
    const b = ve(ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
    ]));
    ok('không đánh dấu dòng nào', moiDong(b).filter((d) => d.btl_trang_thai).length, 0);
    ok('bản kê nói rõ là không có', b.tom_tat_btl.so_dong_btl, 0);
    S.apDungSuaTay(b, {});
    ok('doanh số nguyên vẹn', b.tom_tat.doanh_so, 9000000);
  }

  /* ─────────── 10. Dòng 0 đồng bị triệt tiêu KHÔNG phải quà tặng ─────────── */

  console.log('\n10) Dòng gốc về 0 đồng KHÔNG được bôi đỏ như quà tặng');
  {
    const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
    const k = ky([
      { ngay: '2026-09-02', ct: 'BH1', ten: 'Tivi', dg: 9000000, ds: 9000000,
        khach: 'Chị Nga', dt: '0988456479' },
      { ngay: '2026-09-09', ct: 'BTL1', ten: 'Tivi', dg: 9000000, ds: 0,
        khach: 'Chị Nga', dt: '0988456479' },
    ]);
    const b = ve(k);
    K.dienGiaNhap(b, { currency_unit: 'VND_THOUSAND', records: [], errors: [] });
    ok('dòng gốc bị triệt tiêu KHÔNG bị đánh dấu 0 đồng',
      timTheoCt(b, 'BH1')[0].la_dong_0d, false);
    ok('và bản kê 0 đồng cũng không đếm nó', b.tom_tat_gia.so_dong_0d, 0);
  }

  xong();
})();
