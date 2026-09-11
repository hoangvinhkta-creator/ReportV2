/* Fragment rules bc/ (firebase-rules/bc.rules.json) phải đúng bảng mức mở
 * CLAUDE.md đã chốt — sáu nhánh, không thừa không thiếu, và không nhánh nào
 * mở .write cho trình duyệt.
 *
 * Bốn nhánh đầu là của CLAUDE.md. Hai nhánh sau (`dong`, `backup`) thêm ở
 * P3 khi chủ dự án yêu cầu danh sách đơn hàng và nút quay về bản cũ — chốt
 * 11/09/2026. Cả hai ĐÓNG HẲN với mọi vai: `bc/dong` giữ từng dòng hàng và
 * `bc/backup` giữ trọn bản lưu của một kỳ (gồm cả dòng hàng), trình duyệt
 * không bao giờ đọc thẳng mà hỏi Gateway.
 */
const { docJson, ok, xong } = require('./khung');

const R = docJson('firebase-rules/bc.rules.json');

console.log('\n1) Đúng sáu nhánh, không thừa không thiếu');
{
  ok('cấp cao nhất chỉ có một khoá "bc"', Object.keys(R), ['bc']);
  ok('bc có đúng sáu nhánh con',
     Object.keys(R.bc).sort(), ['backup', 'dong', 'imei', 'khach', 'ky', 'quyetdinh']);
}

console.log('\n2) bc/ky và bc/quyetdinh — đọc được cho quantri/quanly, KHÔNG ai ghi thẳng được');
{
  /* Rules đọc `profiles/<uid>/vai` — NGUỒN SỰ THẬT bên Tracking
     (admSetVai() ghi `vai` cùng lúc với chiếu ra `perms`). KHÔNG đọc
     `perms.quantri`/`perms.quanly` — hai khoá đó không tồn tại trong hồ sơ
     Tracking thật, và đọc nhầm chúng đã gây mất quyền một tài khoản thật
     trên máy thật. Bộ này giữ nguyên bài học đó. */
  for (const nhanh of ['ky', 'quyetdinh']) {
    const doc = R.bc[nhanh]['.read'];
    ok(nhanh + '.read đòi auth != null', /auth != null/.test(doc), true);
    ok(nhanh + '.read đọc profiles/<uid>/vai, KHÔNG đọc perms',
       doc.includes("child('vai')") && !doc.includes("child('perms')"), true);
    ok(nhanh + '.read nhắc tới vai "quantri"', doc.includes("=== 'quantri'"), true);
    ok(nhanh + '.read nhắc tới vai "quanly"', doc.includes("=== 'quanly'"), true);
    ok(nhanh + '.write đóng hẳn cho trình duyệt — chỉ Gateway ghi bằng service account',
       R.bc[nhanh]['.write'], false);
  }
}

console.log('\n3) bc/khach, bc/imei, bc/dong, bc/backup — đóng với MỌI vai, kể cả quantri');
{
  /* `khach`/`imei`: chứa thông tin khách hàng, và Firebase này dùng chung
     với app Marketing (CLAUDE.md). `dong`/`backup`: dòng hàng thô và bản lưu
     trọn kỳ — trình duyệt không có việc gì đọc thẳng, mọi lượt xem đi qua
     Gateway, nên đóng hẳn là mức mở ĐÚNG chứ không phải mức mở thừa. */
  for (const nhanh of ['khach', 'imei', 'dong', 'backup']) {
    ok(nhanh + '.read đóng cho mọi vai', R.bc[nhanh]['.read'], false);
    ok(nhanh + '.write đóng cho mọi vai', R.bc[nhanh]['.write'], false);
  }
}

xong();
