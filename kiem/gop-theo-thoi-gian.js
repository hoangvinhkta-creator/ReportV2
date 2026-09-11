/* Canh `engine/src/gop-theo-thoi-gian.mjs` — cơ chế gộp theo đơn vị thời
 * gian (ngày/tháng/quý/năm) + so cùng kỳ năm trước, dùng cho mọi biểu đồ
 * P2(b) ("Bản Vẽ Biểu Đồ Line" chủ dự án đã duyệt 11/09/2026).
 *
 * Cái đắt nhất nếu sai ở đây: một tháng/quý CỘNG THIẾU hoặc CỘNG TRÙNG mà
 * vẫn ra một con số trông bình thường trên biểu đồ — không ai phát hiện
 * bằng mắt. Nên bộ này canh nặng nhất vào bất biến "gộp ở đơn vị nào cũng
 * phải ra cùng MỘT tổng".
 *
 * Dữ liệu kiểm BỊA HOÀN TOÀN — không có ô nào của sổ thật.
 */
const { ok, xong } = require('./khung');

(async () => {
const G = await import('../engine/src/gop-theo-thoi-gian.mjs');

console.log('\n1) Vị trí trong chu kỳ năm — từng đơn vị');
{
  ok('01/01 → ngày thứ 1 trong năm', G.viTriTheoDonVi('2026-01-01', 'ngay'), { nam: 2026, viTri: 1, khoa: '2026-01-01' });
  ok('31/12 năm thường → ngày thứ 365', G.viTriTheoDonVi('2025-12-31', 'ngay').viTri, 365);
  ok('31/12 năm nhuận → ngày thứ 366', G.viTriTheoDonVi('2024-12-31', 'ngay').viTri, 366);
  ok('29/02 năm nhuận đọc được (2024 là năm nhuận)', G.viTriTheoDonVi('2024-02-29', 'ngay').viTri, 60);

  ok('tháng: lấy đúng số tháng', G.viTriTheoDonVi('2026-08-15', 'thang'), { nam: 2026, viTri: 8, khoa: '2026-08' });

  ok('quý: tháng 1-3 → Q1', G.viTriTheoDonVi('2026-02-01', 'quy'), { nam: 2026, viTri: 1, khoa: '2026-Q1' });
  ok('quý: tháng 4-6 → Q2', G.viTriTheoDonVi('2026-04-01', 'quy').viTri, 2);
  ok('quý: tháng 7-9 → Q3', G.viTriTheoDonVi('2026-08-31', 'quy').viTri, 3);
  ok('quý: tháng 10-12 → Q4', G.viTriTheoDonVi('2026-12-01', 'quy').viTri, 4);

  ok('năm: chỉ một vị trí', G.viTriTheoDonVi('2026-05-05', 'nam'), { nam: 2026, viTri: 1, khoa: '2026' });

  let ma = null;
  try { G.viTriTheoDonVi('2026-01-01', 'tuan'); } catch (e) { ma = e.message; }
  ok('đơn vị "tuan" KHÔNG còn được nhận — chủ dự án đã bỏ 11/09/2026', /don vi khong biet/.test(ma), true);

  let ma2 = null;
  try { G.viTriTheoDonVi('2026-13-01', 'thang'); } catch (e) { ma2 = 'nem'; }
  ok('ngày sai định dạng → ném lỗi, không đoán', ma2, 'nem');

  let ma3 = null;
  try { G.viTriTheoDonVi('01/01/2026', 'thang'); } catch (e) { ma3 = 'nem'; }
  ok('ngày kiểu DD/MM/YYYY (không phải ISO) → ném lỗi', ma3, 'nem');
}

console.log('\n2) Gộp một chuỗi ngày — bất biến: tổng KHÔNG đổi dù gộp đơn vị nào');
{
  const chuoi = {
    '2025-01-05': { doanh_so: 1000, so_don: 2 },
    '2025-01-31': { doanh_so: 500, so_don: 1 },
    '2025-04-01': { doanh_so: 2000, so_don: 3 },
    '2026-01-05': { doanh_so: 4000, so_don: 5 },
  };
  const tongGoc = 1000 + 500 + 2000 + 4000, donGoc = 2 + 1 + 3 + 5;

  for (const dv of ['ngay', 'thang', 'quy', 'nam']) {
    const gop = G.gopMotChuoiNgay(chuoi, dv);
    let tong = 0, don = 0;
    for (const nam of Object.keys(gop)) for (const vt of Object.keys(gop[nam])) {
      tong += gop[nam][vt].doanh_so; don += gop[nam][vt].so_don;
    }
    ok('đơn vị "' + dv + '": tổng doanh số không đổi', tong, tongGoc);
    ok('đơn vị "' + dv + '": tổng số đơn không đổi', don, donGoc);
  }

  const gopThang = G.gopMotChuoiNgay(chuoi, 'thang');
  ok('hai dòng cùng tháng 01/2025 được CỘNG lại', gopThang[2025][1], { doanh_so: 1500, so_don: 3, khoa: '2025-01' });
  ok('tháng 04/2025 tách riêng', gopThang[2025][4], { doanh_so: 2000, so_don: 3, khoa: '2025-04' });
  ok('năm 2026 tách khỏi 2025 dù cùng vị trí (tháng 1)', gopThang[2026][1], { doanh_so: 4000, so_don: 5, khoa: '2026-01' });

  ok('chuỗi rỗng → cây rỗng, không ném', G.gopMotChuoiNgay({}, 'thang'), {});
  let nem = false;
  try { G.gopMotChuoiNgay(null, 'thang'); } catch (e) { nem = true; }
  ok('chuỗi không phải object → ném', nem, true);
}

console.log('\n3) Không làm rơi tiền vì bụi dấu phẩy động');
{
  const chuoi = { '2026-01-01': { doanh_so: 0.1, so_don: 0 }, '2026-01-02': { doanh_so: 0.2, so_don: 0 } };
  const gop = G.gopMotChuoiNgay(chuoi, 'thang');
  ok('0,1 + 0,2 = 0,3 đúng đến 2 chữ số thập phân', gop[2026][1].doanh_so, 0.3);
}

console.log('\n4) Vị trí mới nhất có dữ liệu — theo từng đơn vị');
{
  const chuoi = { '2025-01-01': { doanh_so: 1, so_don: 1 }, '2026-08-31': { doanh_so: 2, so_don: 1 }, '2026-03-15': { doanh_so: 3, so_don: 1 } };
  ok('mới nhất theo ngày', G.viTriMoiNhat(chuoi, 'ngay'), { nam: 2026, viTri: 243, khoa: '2026-08-31' });
  ok('mới nhất theo tháng', G.viTriMoiNhat(chuoi, 'thang'), { nam: 2026, viTri: 8, khoa: '2026-08' });
  ok('mới nhất theo quý', G.viTriMoiNhat(chuoi, 'quy'), { nam: 2026, viTri: 3, khoa: '2026-Q3' });
  ok('chuỗi rỗng → null, không ném', G.viTriMoiNhat({}, 'thang'), null);
}

console.log('\n5) Giá trị tại một vị trí — 0 khi không có, không phải undefined');
{
  const gop = G.gopMotChuoiNgay({ '2026-03-01': { doanh_so: 100, so_don: 2 } }, 'thang');
  ok('có dữ liệu', G.giaTriTaiViTri(gop, 2026, 3), { doanh_so: 100, so_don: 2 });
  ok('không có tháng đó trong năm 2026', G.giaTriTaiViTri(gop, 2026, 7), { doanh_so: 0, so_don: 0 });
  ok('không có năm đó luôn', G.giaTriTaiViTri(gop, 2020, 3), { doanh_so: 0, so_don: 0 });
  ok('cây rỗng/null cũng an toàn', G.giaTriTaiViTri(null, 2026, 3), { doanh_so: 0, so_don: 0 });
}

console.log('\n6) Hai năm gần nhất — giảm dần, không suy đoán khi thiếu dữ liệu');
{
  ok('hai năm', G.haiNamGanNhat({ '2025-01-01': {}, '2026-06-01': {}, '2024-01-01': {} }), [2026, 2025]);
  ok('chỉ một năm → mảng một phần tử', G.haiNamGanNhat({ '2026-01-01': {} }), [2026]);
  ok('rỗng → mảng rỗng', G.haiNamGanNhat({}), []);
}

console.log('\n7) Phẳng hoá cây bc/ky → một chuỗi ngày, có lọc nhân viên (dùng cho LINE)');
{
  const cayKy = {
    '2026-01': {
      An: { '2026-01-05': { doanh_so: 100, so_don: 1 }, '2026-01-06': { doanh_so: 50, so_don: 1 } },
      Binh: { '2026-01-05': { doanh_so: 200, so_don: 2 } },
    },
    '2026-02': {
      An: { '2026-02-01': { doanh_so: 10, so_don: 1 } },
    },
  };
  const congTy = G.gopCayKyThanhChuoiNgay(cayKy);
  ok('gộp CẢ công ty: 05/01 cộng cả An lẫn Bình', congTy['2026-01-05'], { doanh_so: 300, so_don: 3 });
  ok('06/01 chỉ có An', congTy['2026-01-06'], { doanh_so: 50, so_don: 1 });
  ok('02/2026 có mặt', congTy['2026-02-01'], { doanh_so: 10, so_don: 1 });

  const chiAn = G.gopCayKyThanhChuoiNgay(cayKy, ['An']);
  ok('lọc chỉ An: 05/01 KHÔNG có phần của Bình', chiAn['2026-01-05'], { doanh_so: 100, so_don: 1 });
  ok('lọc chỉ An: không có ngày nào của Bình khi Bình không có ngày riêng', Object.keys(chiAn).sort(),
     ['2026-01-05', '2026-01-06', '2026-02-01']);

  const chiBinh = G.gopCayKyThanhChuoiNgay(cayKy, ['Binh']);
  ok('lọc chỉ Bình: chỉ còn đúng một ngày', Object.keys(chiBinh), ['2026-01-05']);
  ok('lọc chỉ Bình: đúng số của Bình', chiBinh['2026-01-05'], { doanh_so: 200, so_don: 2 });

  const locKhongAi = G.gopCayKyThanhChuoiNgay(cayKy, ['Khong-ton-tai']);
  ok('lọc theo tên không tồn tại → chuỗi rỗng, không ném', locKhongAi, {});

  let nem = false;
  try { G.gopCayKyThanhChuoiNgay(null); } catch (e) { nem = true; }
  ok('cây bc/ky không phải object → ném', nem, true);

  ok('cây méo (kỳ null) không làm sập — bỏ qua, không ném',
     G.gopCayKyThanhChuoiNgay({ '2026-01': null }), {});
  ok('cây méo (nhân viên null) không làm sập',
     G.gopCayKyThanhChuoiNgay({ '2026-01': { An: null } }), {});
}

console.log('\n8) BẤT BIẾN: gopCayKyThanhChuoiNgay rồi gộp theo đơn vị == cộng thẳng cả cây');
{
  const cayKy = {
    '2025-11': { A: { '2025-11-20': { doanh_so: 700, so_don: 4 } } },
    '2026-01': { A: { '2026-01-02': { doanh_so: 300, so_don: 1 } }, B: { '2026-01-02': { doanh_so: 150, so_don: 2 } } },
  };
  let tongCay = 0, donCay = 0;
  for (const ky of Object.keys(cayKy)) for (const nv of Object.keys(cayKy[ky])) for (const ng of Object.keys(cayKy[ky][nv])) {
    tongCay += cayKy[ky][nv][ng].doanh_so; donCay += cayKy[ky][nv][ng].so_don;
  }
  const chuoi = G.gopCayKyThanhChuoiNgay(cayKy);
  const gopQuy = G.gopMotChuoiNgay(chuoi, 'quy');
  let tongQuy = 0, donQuy = 0;
  for (const nam of Object.keys(gopQuy)) for (const vt of Object.keys(gopQuy[nam])) { tongQuy += gopQuy[nam][vt].doanh_so; donQuy += gopQuy[nam][vt].so_don; }
  ok('tổng doanh số khớp cây gốc', tongQuy, tongCay);
  ok('tổng số đơn khớp cây gốc', donQuy, donCay);
}

console.log('\n9) gopSucKhoeCongTy — hàm tổng hợp cho màn mở (P2(b) bước 1)');
{
  const cayKy = {
    '2025-08': { A: { '2025-08-10': { doanh_so: 1000, so_don: 5 } } },
    '2026-08': { A: { '2026-08-10': { doanh_so: 1200, so_don: 6 } }, B: { '2026-08-31': { doanh_so: 300, so_don: 1 } } },
  };
  const r = G.gopSucKhoeCongTy(cayKy);
  ok('có đủ ba đơn vị', Object.keys(r).sort(), ['hai_nam', 'theo_nam', 'theo_ngay', 'theo_thang', 'vi_tri_moi_nhat']);
  ok('theo_thang cộng đúng cả A và B tháng 08/2026', r.theo_thang[2026][8], { doanh_so: 1500, so_don: 7, khoa: '2026-08' });
  ok('theo_thang năm 2025 riêng', r.theo_thang[2025][8], { doanh_so: 1000, so_don: 5, khoa: '2025-08' });
  ok('theo_nam gộp cả năm', r.theo_nam[2026][1], { doanh_so: 1500, so_don: 7, khoa: '2026' });
  ok('vi_tri_moi_nhat.ngay đúng ngày cuối cùng có dữ liệu', r.vi_tri_moi_nhat.ngay.khoa, '2026-08-31');
  ok('hai_nam giảm dần', r.hai_nam, [2026, 2025]);

  // đối chiếu chéo: tổng theo_ngay phải bằng tổng theo_thang phải bằng tổng theo_nam
  const tongCuaGop = (gop) => {
    let t = 0; for (const nam of Object.keys(gop)) for (const vt of Object.keys(gop[nam])) t += gop[nam][vt].doanh_so;
    return t;
  };
  const tongThat = 1000 + 1200 + 300;
  ok('theo_ngay/theo_thang/theo_nam đều cộng ra cùng một tổng',
     [tongCuaGop(r.theo_ngay), tongCuaGop(r.theo_thang), tongCuaGop(r.theo_nam)],
     [tongThat, tongThat, tongThat]);
}

console.log('\n10) DON_VI_HOP_LE là danh sách tường minh, đúng bốn đơn vị đã chốt');
{
  ok('đúng 4 đơn vị, đúng thứ tự thường dùng', G.DON_VI_HOP_LE, ['ngay', 'thang', 'quy', 'nam']);
  ok('không có "tuan"', G.DON_VI_HOP_LE.includes('tuan'), false);
}

xong();
})().catch(e => { console.error(e); process.exit(1); });
