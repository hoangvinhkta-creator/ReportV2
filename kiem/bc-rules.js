/* Fragment rules bc/ (firebase-rules/bc.rules.json) phải đúng bảng mức mở
 * CLAUDE.md đã chốt — bốn nhánh, không thừa không thiếu, và không nhánh nào
 * mở .write cho trình duyệt.
 */
const { docJson, ok, xong } = require('./khung');

const R = docJson('firebase-rules/bc.rules.json');

console.log('\n1) Đúng bốn nhánh, không thừa không thiếu');
{
  ok('cấp cao nhất chỉ có một khoá "bc"', Object.keys(R), ['bc']);
  ok('bc có đúng bốn nhánh con',
     Object.keys(R.bc).sort(), ['imei', 'khach', 'ky', 'quyetdinh']);
}

console.log('\n2) bc/ky và bc/quyetdinh — đọc được cho quantri/quanly, KHÔNG ai ghi thẳng được');
{
  for (const nhanh of ['ky', 'quyetdinh']) {
    const doc = R.bc[nhanh]['.read'];
    ok(nhanh + '.read đòi auth != null', /auth != null/.test(doc), true);
    ok(nhanh + '.read nhắc tới quantri', doc.includes("perms').child('quantri')"), true);
    ok(nhanh + '.read nhắc tới quanly', doc.includes("perms').child('quanly')"), true);
    ok(nhanh + '.read so sánh CHẶT === true (không nhận chuỗi "true")',
       /\.val\(\)\s*===\s*true/.test(doc), true);
    ok(nhanh + '.write đóng hẳn cho trình duyệt — chỉ Gateway ghi bằng service account',
       R.bc[nhanh]['.write'], false);
  }
}

console.log('\n3) bc/khach và bc/imei — đóng với MỌI vai, kể cả quantri (chứa thông tin khách)');
{
  for (const nhanh of ['khach', 'imei']) {
    ok(nhanh + '.read đóng cho mọi vai', R.bc[nhanh]['.read'], false);
    ok(nhanh + '.write đóng cho mọi vai', R.bc[nhanh]['.write'], false);
  }
}

xong();
