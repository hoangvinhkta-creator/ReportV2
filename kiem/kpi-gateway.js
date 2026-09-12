/* GATEWAY + MÀN HÌNH của P5 — hai đường ghi, đơn vị ở biên, và phân quyền.
 *
 * Bộ này canh năm thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. ĐƯỜNG DẪN TRÔI GIỮA HAI WORKER. Gateway khai `bc/quyetdinh/kpi` dưới
 *     dạng chuỗi, Engine khai trong `kpi.mjs`. Lệch một ký tự thì Gateway ghi
 *     vào một ô Engine không bao giờ đọc tới, và triệu chứng duy nhất là "đặt
 *     KPI rồi mà vẫn hiện chưa đặt" — rất khó lần ra. Cùng bài toán
 *     `kiem/khop-ma.js` canh công thức khoá chéo hai repo.
 *
 *  B. ĐƠN VỊ KHÔNG ĐƯỢC QUY ĐỔI Ở BIÊN. Màn hình gõ NGHÌN đồng, nhánh lưu
 *     ĐỒNG. Quên nhân 1.000 là KPI nhỏ đi 1.000 lần và mọi phần trăm đạt vọt
 *     lên 100.000% — sai to đến mức lộ ngay, nhưng chiều ngược (nhân hai lần)
 *     thì không lộ.
 *
 *  C. PHÂN QUYỀN LỌT. `boc("quantri", …)` viết nhầm thành `boc(true, …)` sẽ
 *     mở cả hai đường ghi cho Quản lí mà KHÔNG báo gì — `"quantri"` là chuỗi
 *     truthy nên bản `boc()` cũ coi nó y như `true`.
 *
 *  D. ENGINE TÍNH ĐÚNG RỒI KHÔNG AI HIỆN RA. Lớp lỗi chiếm BA trong bảy lỗi
 *     cuối P4 (xem docs/handoff/2026-09-12-P4-dong.md mục 4). Mọi trường
 *     `tom_tat_kpi` Engine trả phải có đường ra tới màn hình.
 *
 *  E. Ô TICK MỞ OAN MÀN GÁN MÃ. Ô tick nằm BÊN TRONG ô Mã sản phẩm, nên một
 *     cú bấm vào nó cũng khớp `td[data-o="ma"]`. Không chặn thì tick một cái
 *     là bật một hộp thoại không ai gọi.
 */
const path = require('path');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const GW = doc('src/index.js');
  /** Cắt đúng thân một handler của Gateway, từ `const <tên> = boc(` tới lượt
   *  khai kế tiếp.
   *
   *  Vì sao cần: đo bằng regex trên CẢ file canh được "có/không có ở đâu đó",
   *  nhưng phần lớn điều đáng canh ở đây là "handler NÀY không làm việc ấy" —
   *  và hai thứ khác nhau hẳn. Bốn bài của bộ này từng đỏ oan đúng vì lẫn hai
   *  thứ: `napKpi` dùng PUT và ném `khong-doc-duoc-kpi` một cách hoàn toàn
   *  đúng, mà phép đo trên cả file lại đọc thành "`dat-kpi` dùng PUT" và
   *  "`don-hang` ném 503". Một bài kiểm đo sai chỗ thì đỏ oan, và đỏ oan lâu
   *  ngày là bài kiểm bị tháo. */
  const thanHandler = (ten) => {
    const i = GW.indexOf('const ' + ten + ' = boc(');
    if (i < 0) throw new Error('không thấy handler ' + ten);
    const sau = GW.slice(i + 10);
    const j = sau.search(/\n(?:const|function|\/\* ={3,})/);
    return j < 0 ? sau : sau.slice(0, j);
  };
  const UI = doc('public/don-hang.js');
  const HTML = doc('public/index.html');
  const P = await import('file://' + path.join(GOC, 'engine/src/kpi.mjs'));

  /* ─────────── A. Đường dẫn hai bản phải bằng nhau ─────────── */

  console.log('\nA) Đường dẫn Firebase — hai bản khai, không được trôi');
  {
    const lay = (ten) => {
      const m = GW.match(new RegExp('const ' + ten + ' = "([^"]+)"'));
      return m ? m[1] : null;
    };
    ok('Gateway khai DUONG_BANG_KPI', lay('DUONG_BANG_KPI'), P.DUONG_BANG_KPI);
    ok('Gateway khai DUONG_GIA_DUNG', lay('DUONG_GIA_DUNG'), P.DUONG_GIA_DUNG);

    /* Cả hai PHẢI nằm dưới `bc/quyetdinh` — đó là điều cho chúng thừa hưởng
       rules đang chạy (.read quantri|quanly, .write false). Mở một nhánh gốc
       mới thì phải sửa rules rồi publish tay trên Console, thêm đúng một bước
       có thể quên, và tới lúc quên thì nhánh mới mở toang hoặc đóng hẳn. */
    ok('nhánh KPI nằm dưới bc/quyetdinh', P.DUONG_BANG_KPI.startsWith('bc/quyetdinh/'), true);
    ok('nhánh gia dụng nằm dưới bc/quyetdinh', P.DUONG_GIA_DUNG.startsWith('bc/quyetdinh/'), true);

    /* Và rules của `bc/quyetdinh` phải THẬT SỰ đang là ".write": false — nếu
       ai nới nó ra thì trình duyệt ghi thẳng được vào nhánh KPI, bỏ qua cả
       phép kiểm đơn vị lẫn phép kiểm vai của Gateway. */
    const rules = JSON.parse(doc('firebase-rules/bc.rules.json'));
    const qd = rules.bc.quyetdinh;
    ok('bc/quyetdinh vẫn .write: false (mọi lượt ghi phải qua Gateway)', qd['.write'], false);
    ok('bc/quyetdinh đọc được cho cả hai vai báo cáo',
       /quantri/.test(qd['.read']) && /quanly/.test(qd['.read']), true);
  }

  /* ─────────── B. Đơn vị quy đổi ở BIÊN ─────────── */

  console.log('\nB) Đơn vị — NGHÌN đồng ở ô nhập, ĐỒNG trong nhánh');
  {
    /* Gateway nhân 1.000 đúng MỘT chỗ, ở lượt ghi. */
    ok('Gateway nhân 1.000 khi ghi KPI', /Math\.round\(n \* 1000\)/.test(GW), true);
    /* Màn hình chia 1.000 đúng MỘT chỗ, để HIỆN. Đây là phép đổi đơn vị để
       đọc, không phải công thức nghiệp vụ — nó không quyết định con số nào,
       chỉ quyết định dấu phẩy đứng ở đâu. */
    ok('màn hình chia 1.000 khi hiện KPI vào ô nhập',
       /khoa === "kpi" \? gt \/ 1000 : gt/.test(UI), true);
    /* Hạt giống phải khớp đúng con số chủ dự án gõ, sau khi đổi đơn vị. */
    ok('2.700.000 nghìn đ ⟶ 2.700.000.000 đ',
       P.BANG_KPI_HAT_GIONG.mac_dinh['Tín Phát'].kpi / 1000, 2700000);
    ok('15.000.000 nghìn đ ⟶ 15.000.000.000 đ',
       P.BANG_KPI_HAT_GIONG.mac_dinh['Nội thành'].kpi / 1000, 15000000);
    ok('1.300.000 nghìn đ ⟶ 1.300.000.000 đ',
       P.BANG_KPI_HAT_GIONG.mac_dinh['Khác'].kpi / 1000, 1300000);

    /* Hệ số KHÔNG được nhân chia gì cả ở biên — nó là phần trăm ở cả hai
       đầu. Một phép đổi đơn vị lẻn vào đây là sai 100 lần. */
    ok('hệ số không bị nhân/chia ở Gateway',
       /he_so_pt[^;]*[*/]\s*(100|1000)/.test(GW), false);
  }

  /* ─────────── C. Phân quyền ─────────── */

  console.log('\nC) Phân quyền — hai đường ghi CHỈ Quản trị');
  {
    /* `boc()` phải phân biệt được chuỗi với boolean. Ép boolean thì
       `boc("quantri", …)` chạy y như `boc(true, …)` và mở đường cho Quản lí
       mà không báo gì. */
    ok('boc() nhận dạng tên vai bằng typeof, không ép boolean',
       /typeof canVai === "string"/.test(GW), true);
    ok('boc() chặn khi vai không khớp', /vaiDuyNhat && vai !== vaiDuyNhat/.test(GW), true);
    ok('  · và chặn bằng 403', /403, "can-vai:"/.test(GW), true);

    ok('dat-kpi đòi vai quantri', /const datKpi = boc\("quantri"/.test(GW), true);
    ok('gia-dung đòi vai quantri', /const datGiaDung = boc\("quantri"/.test(GW), true);
    /* Và mọi đường CŨ vẫn mở cho cả hai vai — lượt nới này không được vô tình
       thắt chặt đường nào khác. */
    const soBocTrue = (GW.match(/= boc\(true,/g) || []).length;
    ok('mười một đường cũ vẫn boc(true) — không thắt chặt oan đường nào',
       soBocTrue, 11);

    /* Hai đường phải có mặt trong bảng route, và CHỈ nhận POST. */
    ok('dat-kpi trong bảng route', /\["POST \/api\/dat-kpi", datKpi\]/.test(GW), true);
    ok('gia-dung trong bảng route', /\["POST \/api\/gia-dung", datGiaDung\]/.test(GW), true);
    ok('không ai mở GET cho hai đường ghi',
       /GET \/api\/(dat-kpi|gia-dung)/.test(GW), false);

    /* Màn hình khoá ô sẵn cho Quản lí — nhưng đó là TRANG TRÍ. Phép chặn
       thật ở Gateway, và bài ngay trên đã canh nó. */
    ok('màn hình đọc vai để khoá dải setup', /window\.VAI_BAO_CAO === "quantri"/.test(UI), true);
    ok('index.html đặt vai từ /api/me', /window\.VAI_BAO_CAO = me\.vai/.test(HTML), true);
  }

  /* ─────────── D. Khoá đi vào đường Firebase phải được canh ─────────── */

  console.log('\nD) Khoá đi thẳng vào đường Firebase — canh khuôn, không sửa hộ');
  {
    /* `khoaTenHang()` trả `N_` + chỉ A-Z0-9. Canh đúng khuôn ấy, chặt hơn
       phép lọc ký tự cấm — và chặt được vì khuôn rất hẹp. */
    ok('khoá gia dụng bị canh đúng khuôn khoaTenHang()',
       /\^N_\[A-Z0-9\]\*\$/.test(GW), true);
    ok('tên line bị canh ký tự Firebase cấm', /line-khong-hop-le/.test(GW), true);
    ok('kỳ bị canh bằng laKy()', /ky !== null && !laKy\(ky\)/.test(GW), true);

    /* Rút lại dấu gia dụng thì XOÁ bản ghi, không ghi `gia_dung: false`:
       nhánh chỉ nên chứa mặt hàng ĐANG là gia dụng, nếu không nó phình theo
       số lần người ta bấm thử và "có mặt trong nhánh" hết còn nghĩa. */
    ok('rút lại dấu gia dụng thì xoá bản ghi', /xoaDb\(DUONG_GIA_DUNG/.test(GW), true);

    /* Audit trail: mọi lượt ghi mang `boi` + `luc`, trong CÙNG lượt ghi. */
    ok('dat-kpi ghi kèm người sửa', /o\.boi = nguoi\.email \|\| nguoi\.uid/.test(GW), true);
    ok('gia-dung ghi kèm người sửa', /boi: nguoi\.email \|\| nguoi\.uid/.test(GW), true);

    /* PATCH chứ không PUT: hợp nhất theo từng trường chỉ dùng được khi lượt
       ghi chỉ chạm đúng trường người dùng vừa gõ. PUT là đè cả bản, tức đặt
       riêng KPI một tháng sẽ xoá luôn hệ số riêng của tháng đó. */
    ok('dat-kpi dùng vaDb (PATCH), không ghiDb (PUT)',
       /vaDb\(duong, o, env\)/.test(GW), true);
    /* Đo trong THÂN `datKpi`, không trên cả file: `napKpi` dùng PUT và dùng
       đúng — nó dựng cả cây từ rỗng, không hợp nhất vào gì cả, và nó đã chặn
       "chỉ khi rỗng" nên PUT không đè được của ai. */
    ok('  · và không PUT trong chính handler dat-kpi',
       /ghiDb\(/.test(thanHandler('datKpi')), false);
    /* Ngược lại: `napKpi` PHẢI dùng PUT. PATCH vào một nhánh rỗng cũng ra kết
       quả đúng hôm nay, nhưng nó nói sai ý định ("hợp nhất vào cái đang có")
       ở đúng chỗ ý định là "dựng từ rỗng". */
    ok('nap-kpi dùng ghiDb (PUT) — dựng cả cây từ rỗng',
       /ghiDb\(DUONG_BANG_KPI, hat, env\)/.test(thanHandler('napKpi')), true);
  }

  /* ─────────── E. Nguồn hỏng không chặn cả bảng, nhưng phải NÓI ─────────── */

  console.log('\nE) Nguồn KPI hỏng — không chặn bảng đơn, nhưng không im lặng');
  {
    /* KHÔNG ném: quy đổi là MỘT cột; doanh số, số đơn, khách, giá vốn đọc
       được mà không cần nó. Khác hẳn bảng line (thiếu là 503). */
    /* Đo trong THÂN `layDonHang`. `napKpi` ném `khong-doc-duoc-kpi` và ném
       đúng: ở đó không đọc được nhánh nghĩa là không biết nó rỗng hay không,
       và ghi mù vào một nhánh có thể đang có dữ liệu là điều duy nhất tuyệt
       đối không được làm. Hai handler, hai cách xử đúng — nên phải đo riêng. */
    ok('đọc bảng KPI lỗi thì layDonHang KHÔNG ném 503',
       /khong-doc-duoc-(kpi|bang-kpi)/.test(thanHandler('layDonHang')), false);
    ok('  · mà trả cờ lỗi về màn hình', /loi_nguon_kpi/.test(GW), true);
    ok('  · và ghi nhật ký cảnh báo', /canh_bao: loi_nguon_kpi/.test(GW), true);
    ok('màn hình nói ra khi nguồn KPI hỏng', /kq\.loi_nguon_kpi/.test(UI), true);
  }

  /* ─────────── F. Engine tính rồi PHẢI có đường ra màn hình ─────────── */

  console.log('\nF) Mọi trường tom_tat_kpi đều có đường ra màn hình');
  {
    /* Lớp lỗi chiếm BA trong bảy lỗi cuối P4: Engine tính đúng rồi không ai
       hiện ra. Bài này canh từng trường một, bằng tên — thêm một trường mới
       mà quên nối vào màn hình thì nó đỏ. */
    for (const t of ['doanh_so_quy_doi', 'dat_pt', 'kpi', 'he_so_pt',
                     'he_so_gia_dung_pt', 'don_thieu_quy_doi', 'thieu_bang',
                     'van_de', 'co_rieng_ky', 'la_gia_dung']) {
      ok('màn hình đọc `' + t + '`', UI.includes(t), true);
    }
    /* `tong` do Engine cộng — màn hình PHẢI đọc nó, không được tự cộng lại. */
    ok('hàng TỔNG đọc tom_tat_kpi.tong', /tkpi \? tkpi\.tong : null/.test(UI), true);
    ok('  · và không tự cộng doanh_so_quy_doi ở trình duyệt',
       /doanh_so_quy_doi\s*\+=|\+\s*\w+\.doanh_so_quy_doi/.test(UI), false);

    /* Gateway phải TRUYỀN hai nhánh xuống Engine — đọc rồi mà không truyền là
       đúng lớp lỗi này, ở tầng dưới một bậc. */
    ok('Gateway truyền bảng KPI + tick vào dungBangDonKemMa',
       /minNgay, quyetDinh\.val \|\| \{\}, kpiVal, gdVal, doanhSoKyTruoc, congVal\)/.test(GW), true);
    ok('  · và vào cả đường ngoài phạm vi khớp mã (dungBangDonSuaTay)',
       /kpiVal, gdVal, ky, doanhSoKyTruoc, congVal\)/.test(GW), true);
  }

  /* ─────────── G. Ô tick không mở oan màn gán mã ─────────── */

  console.log('\nG) Ô tick gia dụng — bấm vào nó không bật màn gán mã');
  {
    ok('có nhánh chặn ô tick trong uỷ quyền bấm',
       /input\[data-o="gd"\]/.test(UI), true);
    ok('  · và nó chặn lan truyền', /e\.stopPropagation\(\)/.test(UI), true);
    /* Thứ tự quan trọng: nhánh ô tick phải đứng TRƯỚC nhánh ô Mã, vì ô tick
       nằm BÊN TRONG ô Mã nên một cú bấm khớp cả hai.
       Cắt lấy đúng thân hàm uỷ quyền rồi so trong đó — so trên cả file là
       sai dụng cụ: `td[data-o="ma"]` còn xuất hiện sớm hơn ở `xoaDongHang()`
       (lấy tên hàng cho câu hỏi xác nhận), chỗ không liên quan gì tới thứ tự
       nhánh. Một bài kiểm đo sai chỗ thì đỏ oan, và đỏ oan lâu ngày là bài
       kiểm bị tháo. */
    /* Đo đúng LỜI GỌI `closest(...)`, không đo chuỗi chọn trần: chuỗi trần còn
       nằm trong chính chú thích giải thích cái bẫy này, và chú thích ấy đứng
       TRƯỚC nhánh ô tick — đo thô thì bài đỏ oan dù code đúng thứ tự. */
    const than = UI.slice(UI.indexOf('tbody.addEventListener("click"'));
    const iGd = than.indexOf(`closest('input[data-o="gd"]')`);
    const iMa = than.indexOf(`closest('td[data-o="ma"]')`);
    ok('  · cả hai lời gọi closest() đều có mặt trong hàm uỷ quyền',
       iGd >= 0 && iMa >= 0, true);
    ok('  · và nhánh ô tick gọi closest() TRƯỚC nhánh ô Mã', iGd < iMa, true);

    /* Ô tick chỉ hiện ở line CÓ hệ số gia dụng, và điều đó do DỮ LIỆU nói —
       không phải màn hình đóng cứng tên "Nội thành". Đổi ý về một line khác
       thì ô tick tự hiện ra ở đó. */
    ok('ô tick hiện theo he_so_gia_dung_pt của line, không theo tên line',
       /hanh\.he_so_gia_dung_pt !== null/.test(UI), true);
    ok('  · màn hình KHÔNG đóng cứng tên "Nội thành"', /"Nội thành"/.test(UI), false);

    /* Ghi không được thì ô tick phải trả về trạng thái THẬT — để nó hiện
       trạng thái vừa bấm là nói một quyết định chưa hề được lưu. */
    ok('ghi lỗi thì ô tick trả về trạng thái thật', /tick\.checked = !bat/.test(UI), true);
  }

  /* ─────────── G2. Nhịp sửa của dải setup ─────────── */

  console.log('\nG2) Dải setup — lưu ngay, vẽ lại MUỘN, và không giữ chế độ oan');
  {
    /* Vẽ lại ngay trong lượt ghi thì ô người dùng vừa Tab sang bị xoá khỏi DOM
       giữa lúc họ đang gõ, và mấy ký tự sau rơi vào hư không. Dải là MỘT đơn
       vị sửa nhiều ô — khác một dòng sửa tay của P4 nơi lượt lưu cũng là lượt
       đóng ô. Nên lượt ghi chỉ đặt cờ; lượt rời dải mới vẽ. */
    ok('guiKpi() đặt cờ chứ không vẽ lại ngay',
       /dai\.dataset\.canVeLai = "1"/.test(UI), true);
    ok('  · và vẽ lại khi tiêu điểm rời KHỎI DẢI',
       /dai\.contains\(document\.activeElement\)/.test(UI), true);
    /* `setTimeout(0)`: lúc `focusout` bắn thì `activeElement` còn là <body>,
       chưa phải ô kế tiếp. Đọc sớm một nhịp thì lần nào cũng tưởng người dùng
       đã đi ra, và ta quay về đúng cái lỗi vừa sửa. */
    ok('  · sau một nhịp, vì activeElement lúc focusout còn là <body>',
       /setTimeout\(\(\) => \{[\s\S]{0,400}?activeElement/.test(UI), true);
    ok('  · và cờ chết cùng dải (nằm trên dataset, không phải biến ngoài)',
       /let canVeLai|var canVeLai/.test(UI), false);

    /* Enter trong ô số không tự nhả tiêu điểm, nên không có bài này thì người
       dùng thấy "đã lưu" mà bảng dưới vẫn là số cũ. */
    ok('Enter nhả tiêu điểm để chuỗi ghi→vẽ chạy đúng nhịp',
       /e\.key !== "Enter"[\s\S]{0,200}?o\.blur\(\)/.test(UI), true);

    /* Chế độ "riêng tháng này" phải tắt mỗi lần đổi năm/tháng/line — bật ở tab
       này rồi bấm sang tab khác mà nó còn bật là đặt một bản ghi đè người dùng
       không hề muốn, ở đúng một tháng, lặng lẽ. */
    ok('có MỘT cửa đổi chỗ xem', /function doiCho\(moi\)/.test(UI), true);
    ok('  · và nó tắt chế độ riêng-tháng-này',
       /doiCho[\s\S]{0,300}?trangThai\.kpiRiengKy = false/.test(UI), true);
    /* Không nút nào được tự gán `trangThai.line`/`.ky` rồi gọi `taiKy()` bỏ
       qua cửa ấy — để mỗi nút tự nhớ tắt là để một nút nào đó quên. */
    ok('  · không nút tab nào tự gán trangThai rồi taiKy() bỏ qua cửa',
       /trangThai\.(line|ky|nam) = [^;]+;\s*taiKy\(\)/.test(UI), false);

    /* Băng "còn N dòng chưa có mã" đếm ô trong bảng đơn — tab Tổng hợp không
       có bảng đơn, nên không ẩn là để một câu nói về một bảng không còn trên
       màn hình. */
    ok('tab Tổng hợp ẩn băng "còn N dòng chưa có mã"',
       /function veTongHop[\s\S]{0,600}?demLaiConNo\(false\)/.test(UI), true);
  }

  /* ─────────── H. Bảng vẫn đúng 19 cột sau P5 ─────────── */

  console.log('\nH) Bảng đơn vẫn đúng 19 cột — ô tick không thành cột thứ 20');
  {
    const mCot = UI.match(/const COT = \[([\s\S]*?)\];/);
    const soCot = mCot ? (mCot[1].match(/"/g) || []).length / 2 : 0;
    ok('đúng 19 cột', soCot, 19);
    const mRong = UI.match(/const RONG_COT = \[([\s\S]*?)\];/);
    const soRong = mRong ? mRong[1].split(',').length : 0;
    ok('đúng 19 bề rộng', soRong, 19);
    /* Không có cột "Gia dụng" nào — chủ dự án chốt ô tick nằm TRONG ô Mã sản
       phẩm, không cần tiêu đề cột. */
    ok('không sinh cột "Gia dụng"', /"Gia dụng"/.test(mCot ? mCot[1] : ''), false);
  }

  /* ─────────── I. LUẬT SỐ 1 trên phần mới ─────────── */

  console.log('\nI) LUẬT SỐ 1 — phần mới không rò công thức xuống trình duyệt');
  {
    /* Màn hình GỬI số người gõ và HIỆN số Engine trả. Không một phép chia
       nào ra doanh số quy đổi, không một mức KPI đóng cứng nào. */
    ok('không có phép chia ra quy đổi ở màn hình',
       /loi_nhuan\s*[*/]/.test(UI), false);
    ok('không có mức KPI đóng cứng ở màn hình',
       /2700000|15000000000|1300000000/.test(UI), false);
    /* Gateway cũng KHÔNG được tính quy đổi — nó chuyển dữ liệu, Engine tính. */
    ok('Gateway không tự tính quy đổi', /doanh_so_quy_doi/.test(GW), false);
    /* Luật hợp nhất mặc định↔kỳ nằm ở Engine. Hai đầu còn lại KHÔNG được có
       một bản thứ hai của nó: Gateway chỉ ghi vào đúng một trong hai tầng,
       màn hình chỉ đọc con số đã hợp nhất. Một bản luật thứ hai ở đây là chỗ
       hai bên trôi khỏi nhau mà triệu chứng chỉ là "số hiện không đúng số vừa
       gõ" — rất khó lần ra.

       Cách canh — bất biến thật là: Gateway không bao giờ TRA GIÁ TRỊ CỦA MỘT
       LINE ra khỏi tầng `mac_dinh`. Nó được nhắc `mac_dinh` để dựng đường ghi
       (`datKpi`) và để đếm số line (`napKpi`), cả hai đều không phải hợp nhất.
       Phép hợp nhất thì buộc phải chỉ vào một line cụ thể trong tầng ấy —
       `mac_dinh[line]` — nên đó chính là thứ phải vắng mặt. */
    ok('Gateway không tra giá trị của một line ra khỏi tầng mac_dinh',
       /mac_dinh[^\n]{0,30}\[\s*(line|ten)\s*\]/.test(GW), false);
    ok('  · và không có bản hanhKpi() thứ hai ở Gateway',
       /(function|const)\s+hanhKpi\b/.test(GW), false);
    ok('  · và màn hình không đọc tầng mac_dinh chút nào',
       /mac_dinh/.test(UI), false);
    /* Màn hình lấy con số đang áp từ `hanh` Engine trả kèm bảng đơn — đúng
       một nguồn, không suy ra từ con số vừa gõ. */
    ok('  · màn hình đọc con số đang áp từ `hanh` của Engine',
       /tkpi \? tkpi\.hanh : null/.test(UI), true);
    ok('  · và biết từng trường đến từ tầng nào (`tu`)',
       /hanh\.tu\[o\.khoa\] === "ky"/.test(UI), true);
  }

  /* ─────────── J. Hành vi THẬT của hai đường, qua Worker ─────────── */

  console.log('\nJ) Hai đường ghi — chạy thật qua Worker, không chỉ đọc bảng route');
  {
    /* Đọc bảng route bằng regex canh được "đã khai", không canh được "khai
       đúng". `methodChoPhep()` suy method từ chính `API_ROUTES`, nên một lỗi ở
       đó không lộ ra ở phép đọc chữ — phải gọi thật. */
    const mod = await import('file://' + path.join(GOC, 'src/index.js'));
    const w = mod.default;
    const ENV = {
      ASSETS: { fetch: async () => new Response('assets') },
      REPORT_ENGINE: { phienBan: async () => '0.10.0-kpi-quy-doi' },
      // Cố ý KHÔNG có service account: bộ này chỉ canh phần TRƯỚC lớp xác thực.
    };
    const goi = (duong, method) => w.fetch(
      new Request('https://reportv2-gateway.workers.dev' + duong,
        { method: method || 'GET' }), ENV);

    /* Không kèm token → 401, tức request đã qua cửa method và tới được lớp
       "anh là ai", đúng thứ tự CLAUDE.md đòi. KHÔNG phải 405 (đường có thật)
       và KHÔNG phải 404. */
    ok('POST /api/dat-kpi không token → 401', (await goi('/api/dat-kpi', 'POST')).status, 401);
    ok('POST /api/gia-dung không token → 401', (await goi('/api/gia-dung', 'POST')).status, 401);

    /* Chỉ POST. Mở GET cho một đường GHI là mở đường sửa dữ liệu bằng một cái
       link — thứ bấm được từ bất cứ đâu. */
    for (const cach of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      ok(cach + ' /api/dat-kpi bị chặn 405', (await goi('/api/dat-kpi', cach)).status, 405);
      ok(cach + ' /api/gia-dung bị chặn 405', (await goi('/api/gia-dung', cach)).status, 405);
    }
    const r = await goi('/api/dat-kpi', 'GET');
    ok('405 nói rõ chỉ POST đi được', r.headers.get('Allow'), 'POST');

    /* Và đường lạ gần giống vẫn 404 — "không có gì ở đây", không phải 405
       (405 cho đường lạ là tự khai đường nào có thật). */
    ok('/api/dat-kpi-abc là đường lạ → 404', (await goi('/api/dat-kpi-abc', 'POST')).status, 404);
    ok('/api/kpi (chưa bao giờ có) → 404', (await goi('/api/kpi', 'POST')).status, 404);
  }

  /* ─────────── K. Nút nạp bộ số lượt đầu ─────────── */

  console.log('\nK) POST /api/nap-kpi — khởi tạo, KHÔNG phải đặt lại');
  {
    const than = thanHandler('napKpi');

    /* Điều quan trọng nhất của đường này: nó CHỈ chạy khi nhánh còn rỗng. Nhờ
       vậy nó không thể nào xoá mất một con số chủ dự án đã sửa trên màn hình,
       kể cả khi bấm nhầm hai lần, kể cả sau này. Bỏ chốt ấy là biến một nút
       khởi tạo thành một nút đặt-lại không ai xin phép. */
    ok('từ chối khi nhánh đã có bộ số', /da-co-bo-so/.test(than), true);
    ok('  · và đọc NÔNG để kiểm, không kéo cả cây về',
       /docDbNong\(DUONG_BANG_KPI/.test(than), true);
    /* Từ chối CÓ LÝ DO thì trả 200 kèm `ghi: false`, không trả 4xx: 4xx hiện
       thành "Dữ liệu gửi lên không hợp lệ" — một câu SAI, và nó làm người
       dùng đi tìm sai chỗ. */
    ok('  · từ chối bằng ghi:false, không bằng mã lỗi 4xx',
       /return \{ ghi: false, ly_do: "da-co-bo-so" \}/.test(than), true);
    ok('  · và màn hình nói đúng câu đó',
       /da-co-bo-so[\s\S]{0,200}?dải setup/.test(UI), true);

    /* Bộ số lấy từ ENGINE, không chép sang Gateway: nó là quyết định nghiệp vụ
       (mục tiêu kinh doanh từng line), và `kiemBangKpi()` cùng `kiem/kpi.js`
       canh đúng bản Engine. Hai bản là hai bản trôi khỏi nhau. */
    ok('bộ số hỏi Engine, không đóng cứng ở Gateway',
       /REPORT_ENGINE\.bangKpiHatGiong\(\)/.test(than), true);
    for (const so of ['2700000000', '15000000000', '1300000000', '7.5', '5.5']) {
      ok('  · Gateway KHÔNG chứa con số ' + so, GW.includes(so), false);
    }
    /* Kiểm lại bằng phép kiểm của Engine TRƯỚC khi ghi. Dư trên giấy (hằng số
       đã có bài ghim) nhưng rẻ, và nó canh đúng ca một lượt sửa hằng số lọt
       qua: bộ kiểm chạy ở lượt BUILD, cái này chạy ở lượt GHI. */
    ok('kiểm hạt giống trước khi ghi',
       /REPORT_ENGINE\.kiemBangKpi\(hat\)/.test(than), true);
    /* Đọc ngược để xác nhận — cùng kỷ luật `--doc-lai` của mọi script nạp
       trong repo. Ghi xong mà đọc lại rỗng là lượt ghi thất bại LẶNG LẼ, và nó
       phải lộ ra bây giờ chứ không phải lúc chủ dự án mở màn hình thấy trống. */
    ok('đọc ngược xác nhận sau khi ghi', /ghi-roi-doc-lai-rong/.test(than), true);

    ok('chỉ Quản trị nạp được', /const napKpi = boc\("quantri"/.test(GW), true);
    ok('có trong bảng route', /\["POST \/api\/nap-kpi", napKpi\]/.test(GW), true);

    /* Màn hình KHÔNG biết một con số nào trong bộ ấy — nó chỉ bấm và đọc kết
       quả. Con số trong câu giải thích của nút là chữ cho người đọc, nên canh
       bằng dạng MÁY đọc được (đủ chữ số) chứ không bằng dạng người đọc. */
    ok('màn hình không chứa bộ số dạng máy đọc được',
       /\b(2700000|15000000|1300000)\b/.test(UI), false);
    ok('màn hình có nút nạp', /nutNapKpi/.test(UI), true);
    ok('  · chỉ hiện cho Quản trị',
       /thieu_bang[\s\S]{0,900}?VAI_BAO_CAO === "quantri"/.test(UI), true);
    ok('  · và nói rõ vì sao Quản lí không thấy nút',
       /Chỉ Quản trị nạp được/.test(UI), true);
    /* Nút khoá trong lúc gọi — bấm hai lần liên tiếp là hai lượt ghi chồng
       nhau, và lượt thứ hai sẽ ăn câu "đã có bộ số rồi" do chính lượt đầu
       vừa tạo ra. Đúng kỹ thuật thì vô hại, nhưng nó hiện ra thành một câu
       lỗi ngay sau một lượt vừa thành công — đọc không hiểu gì. */
    ok('  · nút khoá trong lúc đang nạp', /nut\.disabled = true/.test(UI), true);
  }

  /* ─────────── L. Ô hệ số gia dụng — khai được khi chưa có ─────────── */

  console.log('\nL) Hệ số gia dụng — con gà và quả trứng');
  {
    /* LỖI ĐÃ SỬA: bản đầu ẩn ô này khi giá trị còn trống, nên một line chưa có
       hệ số gia dụng thì KHÔNG CÓ ĐƯỜNG NÀO đặt nó từ màn hình. Với nhánh KPI
       rỗng (trước lượt nạp đầu) thì kể cả Nội thành cũng không đặt được 8%. */
    ok('ô hiện khi đã có giá trị, HOẶC khi vừa bấm mở cho line này',
       /trangThai\.moGiaDung !== trangThai\.line\) continue/.test(UI), true);
    ok('có nút mở ô cho line chưa khai', /\+ thêm hệ số gia dụng/.test(UI), true);
    /* Nút chỉ hiện khi CHƯA có — line đã có hệ số thì ô đã nằm sẵn ở trên. */
    ok('  · và chỉ hiện khi line chưa có hệ số ấy',
       /he_so_gia_dung_pt === null[\s\S]{0,160}?moGiaDung !== trangThai\.line/.test(UI), true);
    /* Trạng thái mở phải chết khi đi sang chỗ khác: nó là "tôi đang định khai
       thêm cho line NÀY", không phải một trạng thái của dữ liệu. Giữ lại thì
       sang line khác lại thấy một ô trống mời gõ một hệ số line ấy không cần. */
    ok('  · và đóng lại khi đổi năm/tháng/line',
       /doiCho[\s\S]{0,400}?trangThai\.moGiaDung = null/.test(UI), true);
    /* Màn hình vẫn KHÔNG đóng cứng tên line nào — ai có hệ số gia dụng là việc
       của dữ liệu, kể cả sau lượt sửa này. */
    ok('  · và vẫn không đóng cứng tên "Nội thành"', /"Nội thành"/.test(UI), false);
  }

  /* ─────────── M. Không đường nào cache được ─────────── */

  console.log('\nM) Cache — mọi phản hồi /api/ phải là no-store');
  {
    /* LỖI THẬT, chủ dự án gặp 12/09/2026: tick "gia dụng" xong thì số trên
       DÒNG đổi mà một con số TỔNG thì không.
       Engine KHÔNG sai — có phép thử chạy cả hai trạng thái tick, mọi tổng
       (dòng, đơn, ngày, line, bảng, toàn công ty) khớp tuyệt đối với tổng cộng
       tay của từng dòng.
       Chỗ hỏng: `withSecurityHeaders()` chỉ đặt `Cache-Control` cho
       `text/html`, nên mọi phản hồi `/api/` đi ra KHÔNG MANG HEADER CACHE NÀO
       — và không header thì trình duyệt được phép tự đoán thời gian còn tươi.
       Hai URL khác nhau (`?ky=…&line=Nội thành` cho tab line, `?ky=…` cho tab
       Tổng hợp) có hai ô cache RIÊNG, nên chúng cũ đi ở hai thời điểm khác
       nhau và nói hai con số khác nhau cho cùng một sự thật. */
    ok('Gateway đặt no-store cho JSON, không chỉ cho HTML',
       /application\/json[\s\S]{0,120}?Cache-Control", "no-store/.test(GW)
       || /text\/html"\)\s*\|\|[\s\S]{0,80}?application\/json/.test(GW), true);
    /* Nhánh HTML KHÔNG được mất — trang tĩnh vẫn phải no-store như cũ. */
    ok('  · và vẫn còn no-store cho HTML', /text\/html/.test(GW), true);

    /* Header mới chỉ chặn những lượt cache TỪ NAY. Bản đã nằm trong cache của
       trình duyệt TRƯỚC lượt sửa vẫn còn đó và vẫn được dùng lại — nên phía
       client cũng phải bỏ qua cache, nếu không chủ dự án phải xoá cache bằng
       tay mới thấy số đúng. BỐN nơi gọi, cả bốn phải có. */
    for (const f of ['public/don-hang.js', 'public/suc-khoe.js',
                     'public/gan-ma.js', 'public/tai-len.js']) {
      ok(f.replace('public/', '') + ' gọi với cache no-store',
         /cache: "no-store"|\.cache = "no-store"/.test(doc(f)), true);
    }
    /* Và không có lượt gọi nào mọc thêm mà không ai xét. GHIM ĐẾM, không quét
       bằng regex: một lời gọi `fetch(` nhiều dòng thì regex không biết đâu là
       hết tham số, nên phép quét đọc sai — bản đầu của bài này đã đỏ oan đúng
       vì vậy, báo ba file "bỏ sót" trong khi cả ba đã có `no-store`.
       Đếm thì thô nhưng không bao giờ nói sai: thêm một lời gọi là bài đỏ, và
       người thêm phải tự xét nó cần `no-store` hay không rồi sửa con số này. */
    const soGoi = ['public/don-hang.js', 'public/suc-khoe.js', 'public/gan-ma.js',
                   'public/tai-len.js', 'public/index.html', 'public/doc-xlsx.js']
      .reduce((t, f) => t + (doc(f).match(/await fetch\(/g) || []).length, 0);
    /* SÁU lượt gọi, và vì sao từng lượt đúng như đang là:
         don-hang.js  goi()     GET  → no-store (bảng đơn, đổi sau mỗi lượt sửa)
         don-hang.js  goiGhi()  POST → không cần: POST không bao giờ được cache
         suc-khoe.js            GET  → no-store (Dashboard, cùng nguồn bc/ky)
         gan-ma.js    goi()     cả hai → no-store
         tai-len.js   goi()     cả hai → no-store
         index.html   /api/me   GET  → một lượt lúc đăng nhập; vai và tên người
                                       dùng không đổi trong một phiên nên cache
                                       ở đây vô hại. Ngoại lệ DUY NHẤT. */
    ok('đúng sáu lượt gọi fetch trong public/ — thêm lượt nào phải xét lại',
       soGoi, 6);
  }

  /* ─────────── N. Ô Mã sản phẩm — mã ngắn thay câu tên kế toán ─────────── */

  console.log('\nN) Ô Mã sản phẩm — dòng đã khớp hiện MÃ NGẮN');
  {
    /* Chủ dự án chốt 12/09/2026: `"Tivi Samsung 65U8500F"` đã khớp `65U8500F`
       thì chỉ hiện `65U8500F`. Cột rộng 240px mà câu tên kế toán thường dài
       hơn nên bị cắt đuôi — đúng đoạn đuôi mang model, tức phần duy nhất phân
       biệt hai dòng với nhau. */
    ok('chữ hiện ra là mã ngắn khi đã khớp, câu tên khi chưa',
       /el\("span", null, d\.ma_hien \|\| d\.ma_bang_gia \|\| d\.ma_san_pham\)/.test(UI), true);

    /* Và mã ngắn ấy phải là CÁCH VIẾT của Tracking, không phải khoá đã chuẩn
       hoá: Tracking lưu `board/RT268WEPMV68` nhưng hiện `RT268WE-PMV(68)`, và
       cùng một mặt hàng đọc ra hai kiểu ở hai màn hình là chỗ chủ dự án bắt
       được 12/09/2026. `ma_hien` đứng TRƯỚC `ma_bang_gia` mới đúng thứ tự —
       đảo lại thì field mới có mặt cũng không bao giờ được dùng. */
    ok('  · và ưu tiên cách viết (ma_hien) trước mã thật',
       UI.indexOf('d.ma_hien') < UI.indexOf('d.ma_bang_gia'), true);

    /* BẮT BUỘC giữ câu tên đầy đủ ở `dataset.ten`: màn gán mã khoá theo TÊN
       HÀNG, nên gửi mã ngắn thay cho tên là ghi quyết định vào một ô KHÁC ô
       Engine sẽ đọc — và triệu chứng duy nhất là "gán rồi mà vẫn hiện chưa
       gán". Đây là chỗ đắt nhất của lượt sửa này. */
    ok('câu tên đầy đủ vẫn ở dataset.ten',
       /td\.dataset\.ten = d\.ma_san_pham/.test(UI), true);
    /* Đo đúng BẤT BIẾN, không đo một dòng chú thích: thân `vaDongTheoKhoa()`
       không được GHI vào `dataset.ten` bao giờ. Bản đầu của bài này dò chính
       câu chú thích "dataset.ten KHÔNG đổi" — một phép đo vô nghĩa, vì xoá
       chú thích thì bài đỏ còn xoá chính dòng bảo vệ thì bài vẫn xanh. */
    const thanVa = UI.slice(UI.indexOf('function vaDongTheoKhoa'),
                            UI.indexOf('function demLaiConNo'));
    ok('  · và lượt vá tại chỗ KHÔNG GHI vào dataset.ten',
       /dataset\.ten\s*=/.test(thanVa), false);
    ok('  · nhưng có ĐỌC nó để dựng lại câu tên khi bỏ qua',
       /dataset\.ten/.test(thanVa), true);
    /* Câu tên cũng phải còn đọc được bằng mắt — rê chuột. */
    ok('title mang câu tên đầy đủ',
       /td\.title = d\.ma_san_pham \+ "\\n\\nMã bảng giá: " \+ \(d\.ma_hien \|\| d\.ma_bang_gia\)/.test(UI), true);

    /* Vá TẠI CHỖ sau khi gán tay phải đổi cả chữ trong ô, không chờ mạng —
       cả điểm của `vaDongTheoKhoa()` là lời hứa "không nhảy dòng". */
    ok('gán tay xong thì ô đổi sang mã ngắn ngay tại chỗ',
       /nhan\.textContent = chu;/.test(UI), true);
    /* Chuỗi vá tại chỗ phải là CHÍNH chuỗi lượt tải sau sẽ hiện. Lệch nhau
       thì ô nhấp một cái sang chữ khác ngay dưới con trỏ và người vừa gán
       tưởng mình gán nhầm. */
    ok('  · và chuỗi ấy là cách viết Engine đưa sang, không phải mã thật',
       /const chu = hien \|\| ma;/.test(UI), true);
    ok('  · cách viết đọc từ mục vừa chọn, không tự tính ở trình duyệt',
       /const hien = \(muc && muc\.hien\) \|\| null;/.test(UI), true);
    ok('  · và "bỏ qua" thì ô về lại câu tên đầy đủ',
       /nhan\.textContent = td\.dataset\.ten/.test(UI), true);

    /* Câu hỏi xác nhận XOÁ phải dùng tên ĐẦY ĐỦ: hai câu tên kế toán khác nhau
       có thể cùng khớp về MỘT mã, nên "Xoá 65U8500F?" là câu hỏi không chỉ
       đúng vào dòng nào — mà đây là lượt xoá tiền khỏi báo cáo. */
    ok('câu hỏi xoá dòng dùng tên đầy đủ, không dùng mã ngắn',
       /oMa\.dataset\.ten \|\| oMa\.textContent/.test(UI), true);

    /* Chiết khấu và phụ phí cố định không bao giờ có `ma_bang_gia`, nên chúng
       vẫn hiện nguyên câu — không cần luật riêng, nhưng phải đúng vậy. */
    ok('chiết khấu/phụ phí vẫn hiện nguyên câu (không có ma_bang_gia)',
       /la_chiet_khau \|\| d\.la_phu_phi_co_dinh\) \{ td\.className = "oTen"/.test(UI), true);

    /* Bảng vẫn 19 cột, bề rộng không đổi: cột này còn phải chứa câu tên dài
       cho những dòng CHƯA khớp, nên không hẹp lại được. */
    const mRong = UI.match(/const RONG_COT = \[([\s\S]*?)\];/);
    ok('bề rộng cột Mã sản phẩm không đổi (dòng chưa khớp vẫn cần 240px)',
       /240/.test(mRong ? mRong[1] : ''), true);
  }

  /* ───── P. Sửa/xoá một dòng: máy chủ trả LUÔN bảng đã tính lại ───── */

  console.log('\nP) POST /api/sua-dong trả kèm bảng mới — một lượt bấm, một vòng mạng');
  {
    /* Chủ dự án chốt 12/09/2026: "hiển thị kết quả ngay lập tức thay vì phải
       đợi". Bản trước ghi xong rồi bảo trình duyệt gọi lại `GET
       /api/don-hang`, tức trả tiền HAI vòng mạng cho cùng một phép tính —
       trong khi máy chủ vừa ghi xong đang đứng cạnh mọi nguyên liệu. */
    ok('có hàm dựng bảng dùng chung cho cả đường đọc lẫn đường ghi',
       /async function dungBangDonHang\(env, ky, line, rid\)/.test(GW), true);
    ok('  · GET /api/don-hang đi qua chính nó',
       /return dungBangDonHang\(env, ky, line, rid\);/.test(GW), true);
    ok('  · và lượt ghi cũng vậy',
       /bang = await dungBangDonHang\(env, ky, than\.line, rid\);/.test(GW), true);
    ok('  · trả về dưới tên `bang_moi`', /bang_moi: bang/.test(GW), true);

    /* `line` từ THÂN request là dữ liệu người dùng gửi lên — phải kiểm hình
       dạng như mọi tham số khác, đúng luật đang áp cho `line` của query. Bỏ
       qua là để một chuỗi dài tuỳ ý đi thẳng vào khoá đọc. */
    ok('line trong thân request cũng bị kiểm độ dài',
       /than\.line\.length > 60[\s\S]{0,80}line-khong-hop-le/.test(GW), true);
    /* Chỉ dựng lại khi màn hình NÓI nó đang xem chỗ nào. Không có `line` thì
       không đoán — Gateway bản mới phục vụ trình duyệt bản cũ vẫn phải chạy. */
    ok('  · không có `line` thì không dựng, không đoán',
       /typeof than\.line === "string" \|\| than\.line === null/.test(GW), true);

    /* Ca quan trọng nhất của cả khối: lượt GHI đã xong rồi. Dựng lại bảng
       hỏng mà ném ra ngoài là biến một lượt ghi THÀNH CÔNG thành một thông
       báo lỗi đỏ — nói dối về thứ vừa xảy ra, và người dùng sẽ bấm lại. */
    ok('dựng lại hỏng thì lượt GHI vẫn báo thành công, chỉ khuyết bảng',
       /return bang \? \{ ghi: true, ky, khoa, bang_moi: bang \} : \{ ghi: true, ky, khoa \};/.test(GW), true);
    ok('  · và ghi một dòng cảnh báo để còn truy được',
       /canh_bao: "dung-lai-bang-hong:"/.test(GW), true);
  }

  console.log('\nQ) /api/don-hang đọc SONG SONG — bỏ 11 vòng xếp hàng');
  {
    /* Bản trước `await` từng nguồn một: 11 lượt đi mạng nối đuôi nhau cho MỘT
       lần bấm, và bấm sang tab line nào cũng trả lại đủ ngần ấy (chủ dự án đo
       3–4 giây mỗi lượt đổi tab). Chúng gần như độc lập — thứ tự cũ chỉ là
       thứ tự người viết nghĩ ra từng thứ. */
    const than = GW.slice(GW.indexOf('async function dungBangDonHang'),
                          GW.indexOf('const layDonHang = boc'));
    ok('bảy lượt đọc Firebase + bảng giá + kỳ trước đi trong MỘT Promise.all',
       (than.match(/await Promise\.all\(\[/g) || []).length >= 1, true);
    for (const d of ['bc/dong/', 'bc/khach/', 'bc/quyetdinh/dong/',
                     'DUONG_BANG_KPI', 'DUONG_GIA_DUNG', 'DUONG_NGAY_CONG']) {
      const khoi = than.slice(than.indexOf('await Promise.all(['));
      ok('  · ' + d + ' nằm trong đợt song song',
         khoi.slice(0, khoi.indexOf('  ]);')).includes(d), true);
    }

    /* Bảng giá ~400 KB và Min theo ngày vài nghìn bản ghi: kỳ ngoài phạm vi
       khớp mã thì KHÔNG được kéo về. Nhưng cũng không được bắt bảy lượt đọc
       kia ngồi chờ câu trả lời "kỳ này có trong phạm vi không" — nên phạm vi
       đi bằng một lời hứa, và bảng giá móc vào `.then()` của nó. */
    ok('kỳ ngoài phạm vi vẫn KHÔNG kéo bảng giá về',
       /huaPhamVi\.then\(\(trong\) => \(trong[\s\S]{0,60}docNguonTracking\(env\)/.test(than), true);
    ok('  · và bảy lượt đọc kia không phải chờ câu trả lời ấy',
       than.indexOf('const huaPhamVi') < than.indexOf('await Promise.all(['), true);

    /* Tracking hỏng KHÔNG được làm hỏng cả bảng đơn (CLAUDE.md: doanh số, số
       đơn, khách hàng đọc được mà không cần bảng giá). Một lỗi thoát ra khỏi
       `Promise.all` sẽ huỷ cả đợt — nên nó phải bị bắt NGAY TẠI lời hứa. */
    ok('lỗi Tracking bị bắt tại chỗ, không thoát ra huỷ cả đợt',
       /docNguonTracking\(env\)\.then\([\s\S]{0,200}LoiTracking[\s\S]{0,80}return \{ nguon: null, ly: e\.ly \}/.test(than), true);

    /* Ba con số thời gian vào nhật ký: lượt sau còn chậm thì `wrangler tail`
       nói ngay chậm ở ĐÂU, không phải đoán lại từ đầu. */
    ok('nhật ký tách thời gian theo từng đợt', /ms_doc, ms_gia, ms_engine/.test(than), true);

    /* KHÔNG có bộ đệm nào được thêm: đệm là đổi tốc độ lấy nguy cơ đọc số cũ,
       và số cũ đúng là lỗi đã phải sửa ở P5 (PR #73 — tổng quy đổi cũ do
       cache). Lượt sửa này chỉ bỏ thời gian NGỒI CHỜ. */
    ok('không lén thêm bộ đệm nào cho bảng đơn',
       /caches\.default|new Cache|cacheTtl/.test(than), false);
  }

  xong();
})();
