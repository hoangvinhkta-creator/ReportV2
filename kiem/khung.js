/* Khung chung cho mọi bộ kiểm trong thư mục này. Chép nguyên khung của
 * Tracking (kiem/khung.js) — cùng bài toán "đường dẫn tính từ gốc repo, hàm
 * so sánh dùng chung", chép hai bản là hai bản trôi khỏi nhau. Bỏ phần dò
 * repo Marketing/CRM: ReportV2 chưa có bộ kiểm chéo repo nào cần tới chúng.
 */
const fs = require('fs');
const path = require('path');

/* Gốc repo = thư mục cha của kiem/. Không dùng process.cwd() vì nó phụ
   thuộc người gọi đang đứng ở đâu — chạy `node kiem/abc.js` từ chỗ khác là
   hỏng. */
const GOC = path.resolve(__dirname, '..');

/** Đọc một file trong repo theo đường dẫn tính từ gốc. */
const doc = p => fs.readFileSync(path.join(GOC, p), 'utf8');

/** Đọc file JSON trong repo. */
const docJson = p => JSON.parse(doc(p));

/** Lấy khối <script> đầu tiên của một file HTML trong repo. */
function docScript(p) {
  const m = doc(p).match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('không thấy khối <script> trong ' + p);
  return m[1];
}

/** Cắt một đoạn mã theo biểu thức. Ném lỗi nếu không thấy — im lặng bỏ qua
 *  một bài kiểm còn tệ hơn để nó đỏ, vì bài bị bỏ qua trông y như bài đã
 *  đạt. */
function cat(src, re) {
  const m = src.match(re);
  if (!m) throw new Error('không tìm thấy đoạn khớp ' + re);
  return m[0];
}

let dat = 0, hong = 0;

/** So sánh sâu bằng JSON. `ten` phải nói rõ ĐIỀU GÌ đang được canh, vì khi
 *  đỏ thì dòng này là tất cả những gì người sửa có trong tay. */
function ok(ten, that, mong) {
  const a = JSON.stringify(that), b = JSON.stringify(mong);
  if (a === b) { dat++; console.log('  ok  ' + ten); }
  else { hong++; console.log('  LỖI ' + ten + '\n       được  ' + a + '\n       mong   ' + b); }
}

/** In tổng kết theo ĐÚNG một khuôn để kiem/chay.js cộng lại được, rồi thoát
 *  với mã lỗi ≠ 0 nếu có bài hỏng — đây là thứ làm CI đỏ. */
function xong() {
  console.log('\n' + dat + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
}

/* ---------------------------------------------------------- repo Tracking
 *
 * P4 khớp tên hàng sổ bán với bảng giá Tracking, và công thức khoá `inv/map`
 * phải giống HỆT bản của Tracking — lệch một ký tự là quyết định gán tay của
 * hai app rơi vào hai ô khác nhau, im lặng, cho tới lúc giá vốn sai. Bộ kiểm
 * chéo hai repo vì vậy chạy CHÍNH mã của Tracking chứ không chép lại.
 *
 * Dò NHIỀU đường và IN RA đường đang dùng — chép đúng bài học của
 * `kiem/khung.js` bên Tracking: một đường dẫn đóng cứng sai khiến bộ kiểm
 * chéo LẶNG LẼ bỏ qua, và một bài bị bỏ qua trông y hệt một bài đã đạt.
 *
 * Bộ nào dùng helper này vẫn phải GHIM giá trị tuyệt đối trong repo mình:
 * nơi không có repo Tracking (CI) thì phép chéo tự bỏ qua, và khi ấy phần
 * ghim là thứ duy nhất còn canh. */
const TRK_UNGVIEN = ['/home/user/Tracking', path.resolve(GOC, '../Tracking'),
                     path.resolve(GOC, '../tracking')];
const TRK = TRK_UNGVIEN.find(d => {
  try { return fs.existsSync(d + '/public/index.html'); } catch (e) { return false; }
}) || TRK_UNGVIEN[0];
const coTracking = () => {
  try { return fs.existsSync(TRK + '/public/index.html'); } catch (e) { return false; }
};
const docTracking = p => fs.readFileSync(path.join(TRK, p), 'utf8');

module.exports = { GOC, doc, docJson, docScript, cat, ok, xong,
                   TRK, coTracking, docTracking };
