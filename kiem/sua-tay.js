/* SỬA TAY MỘT DÒNG HÀNG (engine/src/sua-tay.mjs).
 *
 * Bốn thứ bộ này canh, xếp theo mức đắt nếu hỏng:
 *
 *  A. TỔNG KHÔNG THEO KỊP. Xoá một dòng mà tổng đơn / tổng ngày / tóm tắt
 *     vẫn cộng nó là một bảng tự mâu thuẫn với chính mình — sai êm, và người
 *     đối chiếu tay sẽ mất buổi để tìm ra con số thừa ở đâu.
 *
 *  B. HAI MÀN HÌNH HAI CON SỐ. Chủ dự án chốt xoá dòng thì trừ ở CẢ HAI —
 *     bảng đơn và biểu đồ. Bảng đơn đọc `bc/dong`, biểu đồ đọc `bc/ky`; trừ
 *     một bên là hai màn nói hai con số cho cùng một tháng.
 *
 *  C. SỐ ĐƠN ĐẾM THIẾU. Một đơn có nhiều dòng. Trừ một đơn vì mất một dòng
 *     là đếm thiếu đơn — đơn vẫn còn đó với những dòng khác.
 *
 *  D. QUYẾT ĐỊNH BIẾN MẤT. Sửa tay phải THẮNG mọi con số máy tính ra, sống
 *     qua lần nhập lại, và khi không còn dòng nào để áp thì phải NÓI RA chứ
 *     không im lặng bỏ qua (CLAUDE.md).
 */
const path = require('path');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const S = await import('file://' + path.join(GOC, 'engine/src/sua-tay.mjs'));
  const D = await import('file://' + path.join(GOC, 'engine/src/dong-hang.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/khop-ma.mjs'));
  const G = await import('file://' + path.join(GOC, 'engine/src/gop-ban-hang.mjs'));

  const BANG_LINE = { thu_tu: ['Nội thành'], cua_ten: { 'Đức Hiệp': 'Nội thành' } };
  const dg = (o) => ({ ngay: o.ngay || '2026-09-08', so_ct: o.ct, ten_hang: o.ten,
    so_luong: o.sl || 1, don_gia: o.tien, doanh_so: o.tien, chiet_khau: o.ck || 0,
    nhan_vien: 'Đức Hiệp', imei: null });

  /* Hai đơn: BH1 có HAI dòng, BH2 có MỘT. Đủ để phân biệt "xoá một dòng của
     đơn nhiều dòng" với "xoá dòng cuối cùng của một đơn". */
  const DONG = {
    [D.khoaDong('BH1', 'Tivi A', 0)]: dg({ ct: 'BH1', ten: 'Tivi A', tien: 10000000 }),
    [D.khoaDong('BH1', 'Tivi B', 0)]: dg({ ct: 'BH1', ten: 'Tivi B', tien: 5000000 }),
    [D.khoaDong('BH2', 'Tivi C', 0)]: dg({ ct: 'BH2', ten: 'Tivi C', tien: 3000000 }),
  };
  const KA = D.khoaDong('BH1', 'Tivi A', 0);
  const KB = D.khoaDong('BH1', 'Tivi B', 0);
  const KC = D.khoaDong('BH2', 'Tivi C', 0);

  const ve = (qd) => S.apDungSuaTay(D.dungBangDon(DONG, {}, BANG_LINE, null), qd);
  const moiDong = (b) => {
    const r = [];
    for (const ng of b.ngay) for (const don of ng.don) for (const d of don.dong) r.push(d);
    return r;
  };

  /* ─────────── Không có quyết định nào thì không đổi gì ─────────── */

  console.log('\n1) Bảng chưa ai động vào');
  {
    const b = ve({});
    ok('giữ đủ dòng', moiDong(b).length, 3);
    ok('tổng nguyên vẹn', b.tom_tat.doanh_so, 18000000);
    ok('đếm đúng số đơn', b.tom_tat.so_don, 2);
    ok('không dòng nào bị đánh dấu sửa tay',
      moiDong(b).some((d) => d.da_sua_tay), false);
    ok('bản kê sạch', b.tom_tat_sua_tay, { so_sua_tay: 0, so_xoa: 0, mo_coi: [] });
  }

  /* Ô rỗng là rác còn sót, KHÔNG phải một quyết định — đếm nó vào "đã sửa
     tay" là tô xanh một dòng chưa ai động vào. */
  console.log('\n2) Ô quyết định rỗng không phải một quyết định');
  ok('ô rỗng', S.coQuyetDinh({}), false);
  ok('ô chỉ có dấu vết người ghi', S.coQuyetDinh({ boi: 'sep', luc: 1 }), false);
  ok('nơi nhập chuỗi rỗng', S.coQuyetDinh({ noi_nhap: '   ' }), false);
  ok('giá nhập 0 VẪN là một quyết định', S.coQuyetDinh({ gia_nhap: 0 }), true);
  ok('xoá là một quyết định', S.coQuyetDinh({ xoa: true }), true);
  {
    const b = ve({ [KA]: { boi: 'sep', luc: 1 } });
    ok('ô rỗng không làm dòng thành đã-sửa-tay',
      moiDong(b).some((d) => d.da_sua_tay), false);
  }

  /* ─────────── A. Sửa tay thắng, và tổng theo kịp ─────────── */

  console.log('\n3) Sửa giá nhập — thắng máy, và lợi nhuận tính lại');
  {
    const b = ve({ [KA]: { gia_nhap: 6000000, boi: 'sep', luc: 1 } });
    const a = moiDong(b).find((d) => d.ma_san_pham === 'Tivi A');
    ok('giá nhập theo người', a.gia_nhap, 6000000);
    ok('  · và ghi rõ nguồn là sửa tay', a.nguon_gia, 'sua-tay');
    ok('  · dòng được đánh dấu để tô xanh', a.da_sua_tay, true);
    /* Lợi nhuận là HÀM của giá nhập, không phải một con số độc lập — sửa giá
       mà không tính lại lợi nhuận là để hai ô cạnh nhau nói hai chuyện. */
    ok('lợi nhuận tính lại theo giá mới', a.loi_nhuan, 10000000 - 6000000);
    ok('doanh số KHÔNG đổi (sửa giá vốn không đụng doanh thu)',
      b.tom_tat.doanh_so, 18000000);
  }

  console.log('\n4) Sửa nơi nhập');
  {
    const b = ve({ [KA]: { noi_nhap: '  Việt Hải  ', boi: 'sep', luc: 1 } });
    const a = moiDong(b).find((d) => d.ma_san_pham === 'Tivi A');
    ok('nơi nhập theo người, đã cắt khoảng trắng', a.noi_nhap, 'Việt Hải');
    ok('  · ghi rõ nguồn', a.nguon_noi_nhap, 'sua-tay');
  }

  /* Sửa tay phải thắng con số máy vừa điền — chủ dự án chốt, vĩnh viễn tới
     khi chính người ấy xoá. */
  console.log('\n5) Sửa tay ĐÈ con số tự động');
  {
    const b = D.dungBangDon(DONG, {}, BANG_LINE, null);
    for (const ng of b.ngay) for (const don of ng.don) for (const d of don.dong) {
      d.gia_nhap = 9999; d.noi_nhap = 'Máy tự điền'; d.nguon_gia = undefined;
    }
    S.apDungSuaTay(b, { [KA]: { gia_nhap: 1000, noi_nhap: 'Trung Xuân' } });
    const a = moiDong(b).find((d) => d.ma_san_pham === 'Tivi A');
    const kh = moiDong(b).find((d) => d.ma_san_pham === 'Tivi B');
    ok('dòng đã sửa: lấy số của người', [a.gia_nhap, a.noi_nhap], [1000, 'Trung Xuân']);
    ok('dòng chưa sửa: giữ số máy điền', [kh.gia_nhap, kh.noi_nhap], [9999, 'Máy tự điền']);
  }

  /* ─────────── C. Xoá dòng, và số đơn phải đúng ─────────── */

  console.log('\n6) Xoá một dòng của đơn NHIỀU dòng');
  {
    const b = ve({ [KA]: { xoa: true } });
    ok('dòng biến khỏi bảng', moiDong(b).some((d) => d.ma_san_pham === 'Tivi A'), false);
    ok('  · các dòng khác còn nguyên', moiDong(b).length, 2);
    ok('tổng trừ đúng phần đã xoá', b.tom_tat.doanh_so, 8000000);
    /* Đơn BH1 vẫn còn dòng "Tivi B" nên vẫn là một đơn. */
    ok('SỐ ĐƠN không đổi — đơn vẫn còn dòng khác', b.tom_tat.so_don, 2);
    ok('tổng của đơn BH1 trừ theo', b.ngay[0].don.find((x) => x.so_ct === 'BH1').tong_ban, 5000000);
    ok('doanh số của NGÀY trừ theo', b.ngay[0].doanh_so, 8000000);
    ok('bản kê đếm đúng', b.tom_tat_sua_tay.so_xoa, 1);
  }

  console.log('\n7) Xoá dòng CUỐI CÙNG của một đơn');
  {
    const b = ve({ [KC]: { xoa: true } });
    ok('cả đơn biến mất', b.ngay[0].don.some((x) => x.so_ct === 'BH2'), false);
    ok('SỐ ĐƠN giảm một', b.tom_tat.so_don, 1);
    ok('tổng trừ đúng', b.tom_tat.doanh_so, 15000000);
  }

  console.log('\n8) Xoá sạch mọi dòng của một ngày');
  {
    const b = ve({ [KA]: { xoa: true }, [KB]: { xoa: true }, [KC]: { xoa: true } });
    /* Ngày không còn đơn nào thì bỏ hẳn, không để lại một ngày 0 đồng —
       "hôm ấy bán 0 đồng" và "hôm ấy không còn dòng nào" là hai câu khác. */
    ok('ngày rỗng bị bỏ khỏi bảng', b.ngay.length, 0);
    ok('mọi tổng về 0', [b.tom_tat.doanh_so, b.tom_tat.so_don, b.tom_tat.so_dong],
      [0, 0, 0]);
  }

  /* Chiết khấu gộp thành một dòng do Engine dựng, không có khoá bền, nên nó
     không sửa tay được — và không được biến mất cùng dòng hàng. */
  console.log('\n9) Dòng chiết khấu');
  {
    const D2 = {
      [D.khoaDong('BH3', 'Tivi D', 0)]: dg({ ct: 'BH3', ten: 'Tivi D', tien: 9000000, ck: 100000 }),
      [D.khoaDong('BH3', 'Tivi E', 0)]: dg({ ct: 'BH3', ten: 'Tivi E', tien: 1000000 }),
    };
    const b = S.apDungSuaTay(D.dungBangDon(D2, {}, BANG_LINE, null),
      { [D.khoaDong('BH3', 'Tivi D', 0)]: { xoa: true } });
    const ds = moiDong(b);
    ok('dòng chiết khấu vẫn còn', ds.some((d) => d.la_chiet_khau), true);
    ok('tổng đơn = dòng còn lại − chiết khấu',
      b.ngay[0].don[0].tong_ban, 1000000 - 100000);
  }

  /* ─────────── D. Quyết định mồ côi ─────────── */

  console.log('\n10) Quyết định không còn dòng nào để áp');
  {
    const b = ve({ 'BH9|Khong-co-that|0': { gia_nhap: 500, boi: 'sep' } });
    ok('nói ra, không im lặng bỏ qua', b.tom_tat_sua_tay.mo_coi.length, 1);
    ok('  · kèm chính con số đã nhập', b.tom_tat_sua_tay.mo_coi[0].gia_nhap, 500);
    ok('  · và bảng không đổi gì', b.tom_tat.doanh_so, 18000000);
  }

  /* ─────────── B. Trừ vào `bc/ky` cho biểu đồ ─────────── */

  console.log('\n11) Trừ phần đã xoá ra khỏi bc/ky');

  const truCua = (qd) => S.tinhTruDaXoa(DONG, qd, G.khoaNhanVien);
  const NV = G.khoaNhanVien('Đức Hiệp');

  ok('không xoá gì thì không trừ gì', truCua({}), {});
  ok('xoá một dòng của đơn nhiều dòng: trừ tiền, KHÔNG trừ đơn',
    truCua({ [KA]: { xoa: true } }),
    { [NV]: { '2026-09-08': { doanh_so: 10000000, so_don: 0 } } });
  ok('xoá dòng cuối của một đơn: trừ cả đơn',
    truCua({ [KC]: { xoa: true } }),
    { [NV]: { '2026-09-08': { doanh_so: 3000000, so_don: 1 } } });
  ok('xoá cả hai dòng của BH1: trừ tiền cả hai, và trừ MỘT đơn',
    truCua({ [KA]: { xoa: true }, [KB]: { xoa: true } }),
    { [NV]: { '2026-09-08': { doanh_so: 15000000, so_don: 1 } } });

  /* Doanh số của một dòng = doanh_so − chiết khấu, đúng `LUAT_DOANH_SO`
     đang bật. Trừ theo công thức khác là trừ một con số không cùng thang với
     con số đang nằm trong `bc/ky`. */
  {
    const D3 = { k: dg({ ct: 'BH7', ten: 'Tivi F', tien: 5000000, ck: 200000 }) };
    ok('trừ theo doanh_so − chiết khấu',
      S.tinhTruDaXoa(D3, { k: { xoa: true } }, G.khoaNhanVien),
      { [NV]: { '2026-09-08': { doanh_so: 4800000, so_don: 1 } } });
  }

  console.log('\n12) Áp phần trừ vào cây bc/ky nhiều kỳ');
  {
    const CAY = {
      '2026-09': { [NV]: { '2026-09-08': { doanh_so: 18000000, so_don: 2, so_dong: 3 } } },
      '2026-08': { [NV]: { '2026-08-01': { doanh_so: 7000000, so_don: 1 } } },
    };
    const ra = S.truVaoCayKy(CAY, { '2026-09': truCua({ [KA]: { xoa: true } }) });
    ok('kỳ có quyết định thì trừ',
      ra['2026-09'][NV]['2026-09-08'], { doanh_so: 8000000, so_don: 2, so_dong: 3 });
    ok('kỳ không có quyết định đi qua nguyên vẹn', ra['2026-08'], CAY['2026-08']);
    /* KHÔNG sửa tại chỗ: cây đầu vào là thứ Gateway vừa đọc và có thể còn
       dùng cho việc khác trong cùng lượt gọi. */
    ok('cây gốc KHÔNG bị sửa', CAY['2026-09'][NV]['2026-09-08'].doanh_so, 18000000);

    const sach = S.truVaoCayKy(CAY,
      { '2026-09': truCua({ [KA]: { xoa: true }, [KB]: { xoa: true }, [KC]: { xoa: true } }) });
    /* Ô cạn sạch thì bỏ hẳn, không để lại một ô 0 đồng / 0 đơn: "hôm ấy có
       đi làm mà không bán được gì" khác hẳn "hôm ấy không còn dòng nào". */
    ok('ô cạn sạch thì bỏ hẳn, không để lại ô 0', sach['2026-09'], {});
    ok('không có quyết định nào thì trả đúng cây cũ', S.truVaoCayKy(CAY, {}), CAY);
  }

  xong();
})();
