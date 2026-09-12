/* Màn đăng nhập phải nói ĐÚNG lý do Firebase từ chối — không đổ hết về
 * "kiểm tra lại email/mật khẩu".
 *
 * Vì sao có bộ này, giá đã trả 12/09/2026: lượt P7 chuyển sang
 * `reports.tinphatcrm.com` không đăng nhập được. Màn hình nói "Đăng nhập
 * không thành công — kiểm tra lại email/mật khẩu", nên mật khẩu bị gõ lại
 * nhiều lần, trong khi lỗi thật là Google trả 403 ở
 * `identitytoolkit.googleapis.com` vì khoá API Firebase giới hạn theo tên
 * miền gọi — không liên quan một chữ nào tới mật khẩu. Lý do thật chỉ đọc
 * được bằng cách mở DevTools.
 *
 * Đây đúng lớp lỗi mà audit ghi ở F-08 bên V1: một thao tác cấu hình bắt
 * buộc mà giao diện không nói ra, nên người vận hành phải mở Console mới
 * dùng được hệ thống. Bộ này canh để câu nói ấy không trôi mất.
 */
const { doc, cat, ok, xong } = require('./khung');

const JS = doc('public/index.html').match(/<script>([\s\S]*?)<\/script>/)[1];

/* Chạy CHÍNH hàm trong `index.html`, không chép lại nó ở đây — một bản chép
   là một bản trôi khỏi bản thật, và lúc trôi thì bộ kiểm vẫn xanh.
   `location` được dựng giả vì hàm có nhắc tên miền đang mở trong câu trả
   lời: tên miền là một nửa của lời hướng dẫn ("thêm CÁI NÀY vào danh
   sách"), nên nó phải được canh chứ không phải bỏ qua. */
const HOST = 'reports.tinphatcrm.com';
const cauLoiDangNhap = eval('(function(){\n'
  + 'const location = { hostname: ' + JSON.stringify(HOST) + ' };\n'
  + cat(JS, /const LOI_DANG_NHAP = \{[\s\S]*?\n\};/) + '\n'
  + cat(JS, /function cauLoiDangNhap\(e\) \{[\s\S]*?\n\}/) + '\n'
  + 'return cauLoiDangNhap;\n})()');

const cau = (e) => cauLoiDangNhap(e)[0];
const ma = (e) => cauLoiDangNhap(e)[1];

/* Thứ bị cấm là ĐÚNG câu đổ lỗi này, không phải chữ "mật khẩu" nói chung:
   "Firebase chưa bật đăng nhập bằng email/mật khẩu" nói về PHƯƠNG THỨC đăng
   nhập, và câu của ca 403 còn cố ý viết "đây KHÔNG phải lỗi mật khẩu" — cả
   hai đều đúng và đều chứa hai chữ ấy. Canh bằng chuỗi con thì bắt nhầm cả
   hai, và sửa cho bộ kiểm xanh sẽ làm câu trả lời tệ đi. */
const CAU_DO_LOI = 'Sai email hoặc mật khẩu.';

console.log('\n1) Chỉ lý do THẬT SỰ là sai mật khẩu mới được nói câu sai mật khẩu');
{
  for (const c of ['auth/wrong-password', 'auth/user-not-found',
                   'auth/invalid-credential', 'auth/invalid-login-credentials']) {
    ok(c + ' → nói sai email/mật khẩu', cau({ code: c }), 'Sai email hoặc mật khẩu.');
  }

  /* Và những lý do KHÔNG phải mật khẩu thì tuyệt đối không được nói thế. Đây
     là bài chính của cả bộ: một câu đổ lỗi sai hướng làm người dùng gõ lại
     mật khẩu hàng chục lần cho một sự cố cấu hình. */
  for (const c of ['auth/too-many-requests', 'auth/network-request-failed',
                   'auth/unauthorized-domain', 'auth/operation-not-allowed',
                   'auth/user-disabled', 'auth/invalid-email', 'auth/internal-error']) {
    ok(c + ' KHÔNG được đổ lỗi sai mật khẩu', cau({ code: c }) === CAU_DO_LOI, false);
  }
}

console.log('\n2) Ca 403 của Google — nhận ra dù SDK gói thành auth/internal-error');
{
  /* Firebase JS SDK không có mã riêng cho ca này: nó gói cái 403 của
     `identitytoolkit` thành `auth/internal-error` và nhét nguyên câu Google
     viết vào `message`. Nhận diện phải bám vào câu ấy. */
  const that = {
    code: 'auth/internal-error',
    message: '{"error":{"code":403,"message":"Requests from referer '
      + 'https://reports.tinphatcrm.com/ are blocked.","status":"PERMISSION_DENIED"}}',
  };
  const c = cau(that);
  ok('KHÔNG đổ lỗi sai mật khẩu', c === CAU_DO_LOI, false);
  ok('nói rõ Google chặn theo tên miền', /Google chặn/.test(c), true);
  ok('gọi đúng tên nơi phải sửa (Google Cloud Console)', /Google Cloud Console/.test(c), true);
  ok('nhắc đúng tên miền đang mở', c.includes(HOST), true);
  ok('nói rõ đây KHÁC mục Authorized domains của Firebase',
     /Authorized domains/.test(c), true);
  ok('vẫn giữ mã kỹ thuật để tra', ma(that), 'auth/internal-error');

  /* Các biến thể câu chữ Google có thể trả về — không được chỉ bắt đúng một
     chuỗi. */
  for (const t of ['API key not valid. Please pass a valid API key.',
                   'Requests from referrer <empty> are blocked.',
                   'PERMISSION_DENIED']) {
    ok('vẫn nhận ra: ' + t.slice(0, 32), /Google chặn/.test(cau({ code: 'auth/internal-error', message: t })), true);
  }
}

console.log('\n3) auth/unauthorized-domain — chỉ đúng sang Firebase, không sang Google Cloud');
{
  /* Hai ca này rất dễ lẫn và cách sửa nằm ở HAI trang khác nhau. Nói nhầm
     trang là mất thêm một vòng nữa. */
  const c = cau({ code: 'auth/unauthorized-domain' });
  ok('chỉ sang Firebase Console', /Firebase Console/.test(c), true);
  ok('KHÔNG chỉ nhầm sang Google Cloud Console', /Google Cloud Console/.test(c), false);
  ok('nhắc đúng tên miền đang mở', c.includes(HOST), true);
}

console.log('\n4) Lý do lạ vẫn phải tra được — luôn kèm mã, không bao giờ nuốt');
{
  ok('mã lạ vẫn có câu trả lời', cau({ code: 'auth/chua-tung-gap' }), 'Đăng nhập không thành công.');
  ok('mã lạ được giữ nguyên để tra', ma({ code: 'auth/chua-tung-gap' }), 'auth/chua-tung-gap');
  ok('lỗi không có code cũng không làm hàm chết', ma({}), 'khong-ro');
  ok('lỗi là undefined cũng không làm hàm chết', ma(undefined), 'khong-ro');
  ok('lỗi là undefined vẫn có câu tử tế', cau(undefined), 'Đăng nhập không thành công.');
}

console.log('\n5) Chỗ hiển thị: câu + mã, và không còn câu đổ lỗi cũ');
{
  const than = cat(JS, /async function doDangNhap\(\)[\s\S]*?\n\}/);
  ok('doDangNhap gọi cauLoiDangNhap', /cauLoiDangNhap\(e\)/.test(than), true);
  ok('có ghép mã vào cuối câu để tra ngay trên màn hình', /\[' \+ ma \+ '\]/.test(than), true);
  ok('KHÔNG còn câu đổ lỗi mật khẩu vô điều kiện trong doDangNhap',
     /kiểm tra lại email\/mật khẩu/.test(than), false);
}

xong();
