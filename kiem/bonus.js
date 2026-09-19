/* BONUS LỢI NHUẬN THEO ĐƠN — chủ dự án chốt 12/09/2026.
 *
 * Đây là tiền cộng thẳng vào lợi nhuận rồi vào doanh số quy đổi, tức vào bảng
 * lương. Bộ này canh bốn thứ, xếp theo mức đắt nếu hỏng:
 *
 *  A. BONUS KHÔNG VÀO QUY ĐỔI. Đúng điều chủ dự án yêu cầu nó phải làm; hỏng
 *     là tính năng có mà như không, và không có gì đỏ lên.
 *  B. CỘNG HAI LẦN, hoặc cộng vào line mà quên đơn (và ngược lại). Bốn tổng
 *     của cùng một số tiền phải cộng khớp nhau.
 *  C. NHẬN MỘT BẢN GHI HỎNG. Thiếu lý do, tiền âm, tiền là chuỗi — cộng vào
 *     bằng `NaN` thì cả cột tiền của tháng thành trống mà không chỉ về đâu.
 *  D. ĂN HỆ SỐ GIA DỤNG. Bonus là tiền của cả ĐƠN, không thuộc mặt hàng nào;
 *     cho nó ăn hệ số gia dụng vì đơn tình cờ có một món gia dụng là gán một
 *     luật của DÒNG lên một thứ không phải dòng.
 */
const path = require('path');
const { ok, xong, doc } = require('./khung');
const GOC = path.resolve(__dirname, '..');

(async () => {
  const B = await import('file://' + path.join(GOC, 'engine/src/bonus.mjs'));
  const K = await import('file://' + path.join(GOC, 'engine/src/kpi.mjs'));

  /* Hệ số 10% cho cả hai line, và line NT có thêm hệ số gia dụng 8% — để bài
     D phân biệt được hai con số. */
  const BANG = { mac_dinh: { L1: { kpi: 1000000, he_so_pt: 10 },
                             NT: { kpi: 1000000, he_so_pt: 10, he_so_gia_dung_pt: 8 } },
                 ky: {} };
  const dong = (x) => Object.assign({
    so_luong: 1, tong_ban: 0, loi_nhuan: 0, noi_nhap: null,
    la_chiet_khau: false, la_phu_phi_co_dinh: null,
  }, x);
  const bang = (don) => ({ line: null, ngay: [{ ngay: '2026-09-01', don }], tom_tat: {} });

  console.log('\n1) docBonus — từ chối mọi bản ghi không dùng được');
  {
    ok('bản ghi đủ thì nhận', B.docBonus({ tien: 50000, ly_do: 'KHBH' }).tien, 50000);
    ok('  · lý do có khoảng trắng thừa vẫn nhận, đã cắt',
       B.docBonus({ tien: 1, ly_do: '  KHBH  ' }).ly_do, 'KHBH');

    /* Lý do BẮT BUỘC. Một khoản tiền cộng thêm mà không nói vì sao thì tháng
       sau không ai đối chiếu lại được, kể cả chính người đã gõ nó. */
    for (const x of [{ tien: 50000 }, { tien: 50000, ly_do: '' }, { tien: 50000, ly_do: '   ' },
                     { tien: 50000, ly_do: 7 }]) {
      ok('thiếu lý do → bỏ qua: ' + JSON.stringify(x), B.docBonus(x), null);
    }
    /* Tiền hỏng. `NaN` lan ra là cả cột tiền của tháng thành trống, và không
       có gì chỉ về đúng bản ghi gây ra. */
    for (const x of [{ tien: 0, ly_do: 'a' }, { tien: -5, ly_do: 'a' },
                     { tien: 'nhiều', ly_do: 'a' }, { tien: null, ly_do: 'a' },
                     { ly_do: 'a' }]) {
      ok('tiền hỏng → bỏ qua: ' + JSON.stringify(x), B.docBonus(x), null);
    }
    ok('không phải object → bỏ qua', B.docBonus(null), null);
    ok('mảng cũng không phải bản ghi', B.docBonus([1]), null);
  }

  console.log('\n2) apDungBonus — cộng vào lợi nhuận của ĐƠN, khoá theo số chứng từ');
  {
    const b = bang([
      { so_ct: 'BH1', line: 'L1', tong_ban: 100, loi_nhuan: 1000, dong: [dong({ loi_nhuan: 1000 })] },
      { so_ct: 'BH2', line: 'L1', tong_ban: 100, loi_nhuan: 500, dong: [dong({ loi_nhuan: 500 })] },
    ]);
    B.apDungBonus(b, { BH1: { tien: 50000, ly_do: 'KHBH' } });
    const [d1, d2] = b.ngay[0].don;
    ok('đơn có bonus: lợi nhuận cộng thêm', d1.loi_nhuan, 51000);
    ok('  · và bonus gắn vào đơn để màn hình hiện', d1.bonus.ly_do, 'KHBH');
    ok('đơn KHÔNG có bonus: không đụng tới', d2.loi_nhuan, 500);
    ok('  · và không mọc ra trường bonus', d2.bonus, undefined);
    ok('bản kê đếm đúng', b.tom_tat_bonus, { so_don: 1, tong: 50000 });
    ok('danh sách lý do mặc định đi kèm bảng', b.ly_do_bonus.length, 4);

    /* Đơn chưa biết lợi nhuận: bonus vẫn GẮN để hiện ra, nhưng KHÔNG cộng —
       cộng một số biết vào một số chưa biết vẫn ra chưa biết, còn trả về
       đúng con số bonus là nói rằng cả đơn chỉ lãi có ngần ấy. */
    const b2 = bang([{ so_ct: 'BH9', line: 'L1', tong_ban: 0, loi_nhuan: null,
      dong: [dong({ loi_nhuan: null })] }]);
    B.apDungBonus(b2, { BH9: { tien: 50000, ly_do: 'KHBH' } });
    ok('đơn chưa biết lợi nhuận: vẫn null, KHÔNG hoá thành 50.000',
       b2.ngay[0].don[0].loi_nhuan, null);
    ok('  · nhưng bonus vẫn hiện được', b2.ngay[0].don[0].bonus.tien, 50000);
  }

  console.log('\n3) Bonus VÀO doanh số quy đổi — điều chủ dự án yêu cầu');
  {
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100,
      dong: [dong({ tong_ban: 100, loi_nhuan: 1000 })] }]);
    B.apDungBonus(b, { BH1: { tien: 500, ly_do: 'KHBH' } });
    K.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const don = b.ngay[0].don[0];
    const o = b.tom_tat_kpi.line.L1;

    /* Hệ số 10% ⟹ quy đổi = lợi nhuận × 10. Dòng: 1.000 → 10.000.
       Bonus 500 → 5.000. Tổng của đơn phải là 15.000. */
    ok('dòng quy đổi như cũ', don.dong[0].doanh_so_quy_doi, 10000);
    ok('bonus quy đổi riêng ra', don.quy_doi_bonus, 5000);
    ok('tổng của ĐƠN cộng cả hai', don.doanh_so_quy_doi, 15000);
    ok('tổng của LINE cũng cộng cả hai', o.doanh_so_quy_doi, 15000);
    ok('tổng của NGÀY cũng vậy', b.ngay[0].doanh_so_quy_doi, 15000);
    ok('tổng của BẢNG cũng vậy', b.tom_tat.doanh_so_quy_doi, 15000);

    /* Lợi nhuận của LINE cộng từ từng DÒNG, nên bonus — thứ gắn vào ĐƠN —
       phải được cộng tường minh. Thiếu là cột Lợi nhuận của [Tổng hợp] thấp
       hơn tổng cột Lợi nhuận của chính tab line ấy. */
    ok('lợi nhuận của LINE gồm cả bonus', o.loi_nhuan, 1500);
    /* Và phần trăm đạt phải chạy theo, không thì bonus vào quy đổi mà bảng
       vẫn báo đạt như cũ. */
    ok('phần trăm đạt tính trên quy đổi ĐÃ có bonus', o.dat_pt, 1.5);
  }

  console.log('\n4) Bonus ăn hệ số THƯỜNG, không bao giờ ăn hệ số gia dụng');
  {
    /* Đơn có một món gia dụng (hệ số 8%) và một món thường (10%). Bonus là
       tiền của cả đơn, không thuộc món nào — nó phải ăn 10%. */
    const b = bang([{ so_ct: 'BH1', line: 'NT', tong_ban: 200, dong: [
      dong({ tong_ban: 100, loi_nhuan: 800, khoa_ten: 'N_GD' }),
      dong({ tong_ban: 100, loi_nhuan: 1000 }),
    ] }]);
    B.apDungBonus(b, { BH1: { tien: 800, ly_do: 'NCC giao hộ' } });
    K.dienDoanhSoQuyDoi(b, BANG, '2026-09', { N_GD: { gia_dung: true } });
    const don = b.ngay[0].don[0];
    ok('món gia dụng ăn hệ số 8% (800 → 10.000)', don.dong[0].doanh_so_quy_doi, 10000);
    ok('món thường ăn hệ số 10% (1.000 → 10.000)', don.dong[1].doanh_so_quy_doi, 10000);
    ok('BONUS ăn hệ số THƯỜNG 10% (800 → 8.000), không phải 8%',
       don.quy_doi_bonus, 8000);
    ok('  · 8% sẽ ra 10.000 — con số phải KHÁC', don.quy_doi_bonus === 10000, false);
  }

  console.log('\n5) Line chưa khai hệ số: bonus vẫn vào lợi nhuận, KHÔNG vào quy đổi');
  {
    /* Không có hệ số thì không có phép chia nào. Hoá 0 ở đây là để một ô
       trống nói "bonus này không đem lại đồng quy đổi nào" — trong khi sự
       thật là chưa ai khai hệ số cho line. */
    const b = bang([{ so_ct: 'BH1', line: 'LX', tong_ban: 100, loi_nhuan: 1000,
      dong: [dong({ tong_ban: 100, loi_nhuan: 1000 })] }]);
    B.apDungBonus(b, { BH1: { tien: 500, ly_do: 'KHBH' } });
    K.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    ok('lợi nhuận của đơn vẫn cộng bonus', b.ngay[0].don[0].loi_nhuan, 1500);
    ok('quy đổi của bonus để trống, không phải 0', b.ngay[0].don[0].quy_doi_bonus, null);
    ok('tổng quy đổi của line không bịa ra số nào', b.tom_tat_kpi.line.LX.doanh_so_quy_doi, 0);
    ok('  · nhưng lợi nhuận của line vẫn có bonus', b.tom_tat_kpi.line.LX.loi_nhuan, 1500);
  }

  console.log('\n6) Đơn còn dòng chưa có giá vốn — bonus vào LINE, không vào tổng ĐƠN');
  {
    /* Hai luật khác nhau và cả hai đều cố ý (xem chú thích trong kpi.mjs):
       tổng của ĐƠN chỉ có nghĩa khi mọi dòng quy đổi được; tổng của LINE cộng
       mọi phần quy đổi được. Bonus là tiền chắc chắn nên nó vào line ngay. */
    const b = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 200, dong: [
      dong({ tong_ban: 100, loi_nhuan: 1000 }),
      dong({ tong_ban: 100, loi_nhuan: null }),
    ] }]);
    B.apDungBonus(b, { BH1: { tien: 500, ly_do: 'KHBH' } });
    K.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    ok('tổng của ĐƠN vẫn null (còn dòng chưa quy đổi được)',
       b.ngay[0].don[0].doanh_so_quy_doi, null);
    ok('nhưng LINE nhận cả phần dòng biết được lẫn bonus',
       b.tom_tat_kpi.line.L1.doanh_so_quy_doi, 15000);
  }

  console.log('\n7) Cửa ghi — chỉ Quản trị, lý do bắt buộc, khoá là số chứng từ');
  {
    const GW = doc('src/index.js');
    ok('đường ghi khoá cho vai quantri', /const datBonus = boc\("quantri"/.test(GW), true);
    ok('  · có trong bảng route', /\["POST \/api\/bonus", datBonus\]/.test(GW), true);
    ok('nhánh nằm dưới bc/quyetdinh (thừa hưởng rules đang chạy)',
       /const DUONG_BONUS = "bc\/quyetdinh\/bonus"/.test(GW), true);
    /* Khoá đi thẳng vào ĐƯỜNG DẪN Firebase. Firebase cấm `.` `#` `$` `[` `]`
       `/` trong khoá, và một khoá lọt qua đây là lượt ghi hỏng ở tận tầng
       dưới với thông báo không ai đọc được. */
    ok('  · số chứng từ bị ép về khuôn hẹp trước khi thành đường dẫn',
       /\^\[A-Za-z0-9_-\]\{1,40\}\$/.test(GW), true);
    ok('lý do BẮT BUỘC ở Gateway', /if \(!ly_do\) throw new LoiXacThuc\(400, "thieu-ly-do"\)/.test(GW), true);
    ok('  · và có trần độ dài', /ly-do-qua-dai/.test(GW), true);
    ok('tiền phải dương', /tien-khong-hop-le/.test(GW), true);
    /* Trần: bonus là khoản vài chục tới vài trăm nghìn. Lớn hơn thế gần như
       chắc chắn là gõ thừa số 0, và nó đi thẳng vào lương. */
    ok('  · và có trần chặn gõ thừa số 0', /tien-qua-lon/.test(GW), true);
    /* Xoá thì xoá HẲN, không ghi `tien: 0` — một bản ghi "bonus bằng 0" làm
       "có mặt trong nhánh" hết còn nghĩa. */
    ok('xoá bonus thì xoá hẳn bản ghi', /xoaDb\(DUONG_BONUS \+ "\/" \+ ky \+ "\/" \+ so_ct, env\)/.test(GW), true);
    ok('mọi lượt ghi mang dấu vết người sửa', /DUONG_BONUS[\s\S]{0,200}?boi: nguoi\.email/.test(GW), true);

    /* Bonus phải chạy SAU sửa tay (nó cộng vào lợi nhuận, mà sửa tay đổi giá
       nhập tức đổi lợi nhuận) và TRƯỚC quy đổi (quy đổi chia chính con số
       ấy). Đặt sai một vế là bonus không vào được doanh số quy đổi. */
    const ENG = doc('engine/src/index.js');
    for (const ten of ['dungBangDonKemMa', 'dungBangDonSuaTay']) {
      const than = ENG.slice(ENG.indexOf('async ' + ten));
      const cat = than.slice(0, than.indexOf('return bang;'));
      ok(ten + ': bonus chạy SAU sửa tay',
         cat.indexOf('apDungSuaTay') < cat.indexOf('apDungBonus'), true);
      ok('  · và TRƯỚC quy đổi', cat.indexOf('apDungBonus') < cat.indexOf('apDungKpi'), true);
    }
  }

  console.log('\n8) Màn hình — lý do bắt buộc, bốn lựa chọn đọc từ Engine');
  {
    const UI = doc('public/don-hang.js');
    /* Nút + chỉ hiện cho Quản trị — và từ 19/09/2026 cũng không hiện ở kỳ
       CHƯA TỚI: bảng ở đó là số của cùng kỳ năm trước, và một lượt ghi bonus
       sẽ nhắm vào một kỳ không có đơn nào (Gateway cũng chặn). */
    ok('nút + chỉ hiện cho Quản trị', /if \(!laQuanTri\(\) \|\| chiDoc\) \{/.test(UI), true);
    /* Nút đứng TRƯỚC số. Đặt sau thì bề rộng nút bị cộng vào phần bên phải,
       nên con số bonus lùi trái đúng bằng một cái nút và không còn thẳng
       hàng với mọi con số khác của cột — "biến dạng dòng" chủ dự án thấy
       13/09/2026. */
    ok('  · và nút đứng TRƯỚC số, để số thẳng hàng với cả cột',
       UI.indexOf('td.appendChild(b);') < UI.indexOf('td.appendChild(so);'), true);
    const CSS2 = doc('public/index.html').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('  · ô canh giữa theo chiều dọc (nút cao hơn dòng chữ)',
       /td\.oBonus \{[^}]*align-items:\s*center/.test(CSS2), true);
    ok('  · và số bị đẩy sát mép phải', /\.soBonus \{[^}]*margin-left:\s*auto/.test(CSS2), true);
    /* Bốn lý do đọc từ Engine, không gõ cứng ở trình duyệt: thêm một lý do
       phải là sửa đúng một chỗ. */
    ok('bốn lý do đọc từ Engine, không gõ cứng ở màn hình',
       /kq\.bang\.ly_do_bonus/.test(UI), true);
    for (const t of ['Khách/thợ qua kho lấy', 'NCC giao hộ', 'KHBH', 'Thợ lắp + KHBH']) {
      ok('  · Engine giữ lý do "' + t + '"', B.LY_DO_BONUS.includes(t), true);
    }
    /* Điều thật sự phải canh không phải "trong file có xuất hiện chữ nào"
       (một câu gợi ý trên tooltip cũng chứa) mà là: ô chọn được DỰNG TỪ danh
       sách Engine đưa sang. Gõ cứng bốn lựa chọn ở đây thì thêm một lý do là
       phải sửa hai chỗ, và hai chỗ ấy sẽ trôi khỏi nhau. */
    ok('  · và ô chọn dựng TỪ danh sách ấy, không từ một mảng gõ cứng',
       /for \(const t of \[\.\.\.dsLyDo, "Khác…"\]\)/.test(UI), true);
    /* Vẫn cho gõ lý do khác — bốn cái kia là phím tắt cho bốn ca hay gặp,
       không phải một bộ phân loại đóng. */
    ok('vẫn gõ được lý do khác', /"Khác…"/.test(UI), true);
    ok('thiếu lý do thì cảnh báo NGAY, không gửi đi',
       /Phải chọn hoặc gõ lý do được cộng/.test(UI), true);
    /* Ô số trống (hoặc 0) KHÔNG còn là lỗi — nó là cách XOÁ bonus, và ô quay
       về dấu `+` (chủ dự án chốt 13/09/2026). Nên thứ phải canh đổi chiều:
       trống thì gửi `tien: null`, không phải báo lỗi. */
    ok('  · xoá trắng ô số là BỎ bonus, không phải lỗi',
       /const than = n === 0 \? \{ tien: null \} : null;/.test(UI), true);
    ok('  · và chỉ đòi lý do khi THẬT SỰ có tiền', /if \(!than\) \{/.test(UI), true);
    /* Người dùng gõ theo NGHÌN (50 = 50.000 đ), cùng đơn vị với ô Giá nhập. */
    ok('tiền gõ theo nghìn, nhân 1.000 trước khi gửi', /Math\.round\(n \* 1000\)/.test(UI), true);
    /* Lý do cũ ngoài bốn cái mặc định phải được điền lại khi mở ra sửa —
       nếu không, mở ra sửa số tiền là lý do lặng lẽ bị thay. */
    ok('lý do cũ ngoài danh sách vẫn được điền lại khi mở sửa',
       /!dsLyDo\.includes\(cuLyDo\)/.test(UI), true);
    /* Sửa TẠI CHỖ, không bung hộp nổi (chủ dự án 13/09/2026: "tù quá" — hộp
       che mất chính cái đơn đang cộng cho, và số tiền gõ ở một chỗ khác hẳn
       cột nó sẽ hiện ra). Cùng khuôn với lượt sửa Giá nhập của P4: rời khỏi
       HÀNG là tự lưu. */
    ok('không còn hộp nổi', /hopBonus/.test(UI), false);
    ok('  · ô số nằm ngay tại cột Lợi nhuận', /tdTien\.appendChild\(oTien\)/.test(UI), true);
    ok('  · ô lý do nằm ngay tại cột Ghi chú', /tdLyDo\.appendChild\(chon\)/.test(UI), true);
    ok('  · rời khỏi HÀNG thì tự lưu, không xét từng ô',
       /!tr\.contains\(e\.relatedTarget\)\) luu\(\)/.test(UI), true);
  }

  console.log('\n9) Lợi nhuận theo NGÀY — số cho băng ngày, Engine tính');
  {
    /* Băng ngày nay là một trình thả xuống và nói đủ bốn con số, nên nó cần
       lợi nhuận của ngày. Cùng luật với line: cộng phần BIẾT ĐƯỢC, đếm riêng
       số đơn còn thiếu. Hoá phần thiếu thành 0 là để một con số nhỏ đọc như
       một con số đủ. */
    const b = bang([
      { so_ct: 'BH1', line: 'L1', tong_ban: 100, loi_nhuan: 1000,
        dong: [dong({ tong_ban: 100, loi_nhuan: 1000 })] },
      { so_ct: 'BH2', line: 'L1', tong_ban: 100, loi_nhuan: null,
        dong: [dong({ tong_ban: 100, loi_nhuan: null })] },
    ]);
    B.apDungBonus(b, { BH1: { tien: 500, ly_do: 'KHBH' } });
    K.dienDoanhSoQuyDoi(b, BANG, '2026-09', {});
    const ng = b.ngay[0];
    ok('lợi nhuận ngày = phần biết được + bonus', ng.loi_nhuan, 1500);
    ok('  · và nói rõ còn mấy đơn chưa đủ', ng.don_thieu_loi_nhuan, 1);
    /* Con số của NGÀY và của LINE phải khớp nhau khi cả bảng chỉ có một
       line và một ngày — hai đường cộng độc lập, lệch là một trong hai sai. */
    ok('  · khớp đúng con số của line', ng.loi_nhuan, b.tom_tat_kpi.line.L1.loi_nhuan);

    const b2 = bang([{ so_ct: 'BH1', line: 'L1', tong_ban: 100, loi_nhuan: 1000,
      dong: [dong({ tong_ban: 100, loi_nhuan: 1000 })] }]);
    K.dienDoanhSoQuyDoi(b2, BANG, '2026-09', {});
    ok('không đơn nào thiếu thì bộ đếm bằng 0', b2.ngay[0].don_thieu_loi_nhuan, 0);
  }

  console.log('\n10) Băng ngày = trình thả xuống, đóng sẵn');
  {
    const UI = doc('public/don-hang.js');
    /* Dùng một HÀNG BẢNG bấm được chứ không phải `<details>`: `<details>`
       trong `<tbody>` là HTML không hợp lệ, trình duyệt ném nó ra ngoài bảng
       và cột lệch hết. */
    /* Soi trên mã ĐÃ BỎ CHÚ THÍCH: chú thích ngay trên có nhắc `<details>` để
       nói vì sao KHÔNG dùng nó, và nhắc là đúng. */
    ok('không dùng <details> trong bảng',
       /<details/.test(UI.replace(/\/\*[\s\S]*?\*\//g, ' ')), false);
    ok('băng ngày đóng sẵn', /trNgay\.classList\.add\("dongLai"\)/.test(UI), true);
    ok('  · và mọi dòng của ngày ẩn theo',
       /t\.hidden = !dangMo; tbody\.appendChild\(t\)/.test(UI), true);
    /* Ngày nào ĐANG MỞ phải sống qua mỗi lượt vẽ lại. Thiếu chỗ này thì nhập
       xong một cái bonus là cả bảng dựng lại và mọi ngày đóng sập — người
       vừa gõ bị ném về đầu tháng. Nhớ theo NGÀY chứ không theo vị trí: lọc
       hay đổi line làm thứ tự đổi, còn `2026-09-01` thì không. */
    ok('  · ngày đang mở sống qua lượt vẽ lại',
       /const dangMo = trangThai\.ngayMo\.has\(ng\.ngay\);/.test(UI), true);
    ok('  · và lượt bấm cập nhật đúng bộ nhớ ấy',
       /trangThai\.ngayMo\.delete\(ng\.ngay\)[\s\S]{0,80}?trangThai\.ngayMo\.add\(ng\.ngay\)/.test(UI), true);

    /* Ngày còn đơn chưa đủ giá vốn: tô CẢ BĂNG, và đi qua `lopCanhBao()` như
       mọi cảnh báo khác — Quản lí xem báo cáo, không nhận việc. */
    ok('băng ngày còn đơn thiếu thì tô cả dòng',
       /lopCanhBao\("ngayThieu"\)/.test(UI), true);
    ok('  · và có luật CSS cho nó',
       /\.hangNgay\.ngayThieu td \{[^}]*background:/.test(
         doc('public/index.html').replace(/\/\*[\s\S]*?\*\//g, '')), true);
    ok('  · bấm vào băng thì lật trạng thái',
       /trNgay\.classList\.toggle\("dongLai"\)/.test(UI), true);
    /* Mở một ngày ra là bảng cao lên → chỗ còn lại cho biểu đồ đổi. Không
       đo lại thì bảng tràn xuống dưới biểu đồ. */
    ok('  · và đo lại chiều cao bảng sau mỗi lượt mở/đóng',
       /toggle\("dongLai"\)[\s\S]{0,400}?dieuChinhCaoBang\(\)/.test(UI), true);
    /* Bốn con số trên băng đều do Engine tính; màn hình chỉ đọc field. */
    ok('băng nói cả lợi nhuận lẫn quy đổi của ngày',
       /ng\.loi_nhuan[\s\S]{0,220}?ng\.doanh_so_quy_doi/.test(UI), true);
    ok('  · quy đổi chưa biết thì hiện "—", không hiện 0',
       /doanh_so_quy_doi === null \|\| ng\.doanh_so_quy_doi === undefined\s*\n?\s*\? "—"/.test(UI), true);
    ok('  · còn đơn thiếu giá vốn thì dán dấu "*" vào lợi nhuận',
       /ng\.don_thieu_loi_nhuan \? " \*" : ""/.test(UI), true);
  }

  xong();
})();
