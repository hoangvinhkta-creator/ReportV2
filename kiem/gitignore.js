/* Canh `.gitignore` — tấm lưới chặn hai thứ không bao giờ được vào repo:
 * khoá service account, và sổ bán hàng (có tên/SĐT/địa chỉ khách hàng).
 *
 * Vì sao cần một bộ kiểm cho một file cấu hình: cái giá của việc nó sai là
 * KHÔNG ĐỐI XỨNG. Thiếu một dòng ở đây thì không có gì đỏ, không có gì chậm,
 * không ai nhận ra — cho tới lúc một khoá riêng nằm trong lịch sử git công
 * khai, và lúc đó sửa không còn là một commit nữa mà là xoay khoá + viết lại
 * lịch sử. Bộ này rẻ, và nó biến một im lặng nguy hiểm thành một bài kiểm đỏ.
 *
 * Tình huống thật đẻ ra nó: hướng dẫn nạp sổ bảo chủ dự án tải khoá về và đặt
 * ngay trong thư mục repo (`khoa.json`) — lúc đó repo chưa có .gitignore.
 */
const { doc, ok, xong } = require('./khung');

const GI = doc('.gitignore');
/* Bỏ dòng chú thích trước khi soi: chú thích của chính file đó có nhắc tên
   các mẫu, soi cả chú thích thì bài kiểm đạt nhờ một câu văn xuôi. */
const MAU = GI.split('\n')
  .map(d => d.trim())
  .filter(d => d && !d.startsWith('#'));

console.log('\n1) Khoá service account không bao giờ vào repo');
{
  /* `khoa.json` là ĐÚNG cái tên hướng dẫn nạp sổ bảo chủ dự án dùng — nên nó
     phải được kể tên tường minh, không chỉ dựa vào một mẫu chung. */
  ok('chặn đúng tên "khoa.json" mà hướng dẫn đang dùng', MAU.includes('khoa.json'), true);
  ok('chặn file JSON tải thẳng từ Firebase Console',
     MAU.includes('*firebase-adminsdk*.json'), true);
  ok('chặn *.pem', MAU.includes('*.pem'), true);
  ok('chặn *.key', MAU.includes('*.key'), true);
  ok('chặn .env', MAU.includes('.env'), true);
  ok('chặn .dev.vars (nơi wrangler đọc secret lúc chạy máy)',
     MAU.includes('.dev.vars'), true);
}

console.log('\n2) Sổ bán hàng không vào repo — nó chứa dữ liệu cá nhân khách hàng');
{
  /* Cột 4–7 của sổ là mã khách, tên khách, địa chỉ, số điện thoại. CLAUDE.md:
     PII đi qua bộ nhớ tiến trình rồi bỏ, không ghi ra file trung gian trong
     repo. Reports V1 chặn đúng kiểu này. */
  ok('chặn *.xlsx', MAU.includes('*.xlsx'), true);
  ok('chặn *.xls', MAU.includes('*.xls'), true);
  ok('chặn *.csv (xuất ra từ sổ cũng mang đủ PII)', MAU.includes('*.csv'), true);
}

console.log('\n3) Không có file nào đang bị theo dõi mà lẽ ra phải bị chặn');
{
  /* Bộ kiểm chỉ đọc file trong repo, nên kiểm thẳng cây thư mục: nếu một
     khoá hay một sổ đã lọt vào repo rồi thì .gitignore không cứu được nữa —
     phải thấy ngay. */
  const fs = require('fs');
  const path = require('path');
  const { GOC } = require('./khung');
  const CAM = /\.(xlsx|xlsm|xls|csv|pem|key)$/i;
  const CAM_TEN = /^(khoa\.json|\.env|\.dev\.vars)$|firebase-adminsdk.*\.json$|^service-account.*\.json$/i;

  const dinh = [];
  const quet = (thuMuc) => {
    for (const ten of fs.readdirSync(path.join(GOC, thuMuc || '.'))) {
      if (ten === '.git' || ten === 'node_modules') continue;
      const rel = thuMuc ? path.join(thuMuc, ten) : ten;
      if (fs.statSync(path.join(GOC, rel)).isDirectory()) quet(rel);
      else if (CAM.test(ten) || CAM_TEN.test(ten)) dinh.push(rel);
    }
  };
  quet('');
  ok('không file khoá/sổ nào nằm trong repo', dinh, []);
}

xong();
