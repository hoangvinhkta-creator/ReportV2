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
    ok('  · và không PUT vào nhánh KPI', /ghiDb\(DUONG_BANG_KPI/.test(GW), false);
  }

  /* ─────────── E. Nguồn hỏng không chặn cả bảng, nhưng phải NÓI ─────────── */

  console.log('\nE) Nguồn KPI hỏng — không chặn bảng đơn, nhưng không im lặng');
  {
    /* KHÔNG ném: quy đổi là MỘT cột; doanh số, số đơn, khách, giá vốn đọc
       được mà không cần nó. Khác hẳn bảng line (thiếu là 503). */
    ok('đọc bảng KPI lỗi thì KHÔNG ném 503',
       /khong-doc-duoc-(kpi|bang-kpi)/.test(GW), false);
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
       /minNgay, quyetDinh\.val \|\| \{\}, kpiVal, gdVal\)/.test(GW), true);
    ok('  · và vào cả đường ngoài phạm vi khớp mã (dungBangDonSuaTay)',
       /kpiVal, gdVal, ky\)/.test(GW), true);
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

       Cách canh: không bên nào được ĐỌC tầng `mac_dinh` để so với tầng `ky`.
       Gateway có nhắc `mac_dinh` nhưng chỉ để DỰNG ĐƯỜNG GHI, nên canh bằng
       phép đọc hai tầng cạnh nhau. */
    ok('Gateway không tự hợp nhất hai tầng',
       /mac_dinh[^\n]*\|\||\bky\b[^\n]*\?\?[^\n]*mac_dinh/.test(GW), false);
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

  xong();
})();
