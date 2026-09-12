/* Cách VIẾT tiền ra màn hình — nghìn đồng, và chỗ nào được làm tròn.
 *
 * Chủ dự án chốt 11/09/2026, hai luật khác nhau cho hai chỗ:
 *
 *   dòng hàng  giữ tới 3 số lẻ. Trên 27.299 dòng của ba sổ thật có 5 dòng
 *              không chẵn nghìn (9.950.001 đ, 4.090.909,09 đ — số tính
 *              ngược từ giá gồm VAT). Làm tròn ở đây là bịa mất phần lẻ
 *              của chính sổ, và người đối chiếu từng dòng với MISA sẽ thấy
 *              lệch mà không hiểu vì sao.
 *   dòng tổng  làm tròn về nghìn chẵn. "4.047.885,001" ở dòng tổng của cả
 *              một line không nói thêm điều gì, chỉ làm số khó đọc.
 *
 * Bộ này canh cả HAI đầu: hàm tính đúng, VÀ đúng hàm được gọi ở đúng chỗ.
 * Chỉ kiểm hàm thì ai đó đổi một lời gọi là lọt; chỉ kiểm lời gọi thì ai đó
 * đổi thân hàm là lọt.
 *
 * Đây là ĐỊNH DẠNG, không phải nghiệp vụ (LUẬT SỐ 1): số trong Firebase
 * vẫn là đồng, do Engine tính. Chia 1.000 chỉ đổi cách viết.
 */
const vm = require('vm');
const { doc, ok, xong } = require('./khung');

/** Lấy nguyên văn một hàm khai bằng `function ten(...)` ra khỏi file, rồi
 *  chạy nó thật. Kiểm hành vi chứ không kiểm chuỗi ký tự — một bài kiểm chỉ
 *  so chuỗi sẽ xanh cả khi hàm đã tính sai. */
function layHam(ma, ten) {
  const dau = ma.indexOf('function ' + ten + '(');
  if (dau < 0) return null;
  let i = ma.indexOf('{', dau), sau = 0;
  for (let j = i; j < ma.length; j++) {
    if (ma[j] === '{') sau++;
    else if (ma[j] === '}') { sau--; if (!sau) { i = j; break; } }
  }
  const hop = vm.createContext({ Number, Math, String });
  return vm.runInContext('(' + ma.slice(dau, i + 1) + ')', hop);
}

const DON = doc('public/don-hang.js');
const TAI = doc('public/tai-len.js');

console.log('\n1) Hàm viết tiền — nghìn đồng, và "chưa biết" khác "0 đồng"');
{
  const nghin = layHam(DON, 'nghin');
  const tron = layHam(DON, 'nghinTron');
  ok('public/don-hang.js có nghin()', typeof nghin, 'function');
  ok('public/don-hang.js có nghinTron()', typeof tron, 'function');

  ok('6.450.000 đ viết là "6.450"', nghin(6450000), '6.450');
  ok('250.000 đ viết là "250"', nghin(250000), '250');

  /* Ca thật trên sổ 2025 (BH51303) và sổ 09/2026 (BH74045). */
  ok('9.950.001 đ giữ phần lẻ ở DÒNG HÀNG', nghin(9950001), '9.950,001');
  ok('1 đ vẫn thấy được, không thành 0', nghin(1), '0,001');

  /* Ca thật đã làm chủ dự án phải nói: tổng line Nội thành 09/2026. */
  ok('4.047.885.001 đ ở DÒNG TỔNG làm tròn thành "4.047.885"', tron(4047885001), '4.047.885');
  ok('và dòng hàng thì KHÔNG làm tròn', nghin(4047885001), '4.047.885,001');

  /* Sáu cột của P4 chưa có nguồn. `null` phải ra "—" chứ không ra "0":
     "0 đồng" và "chưa biết" là hai chuyện khác hẳn nhau. */
  for (const ham of [nghin, tron]) {
    ok('null → "—", không phải "0"', ham(null), '—');
    ok('undefined → "—"', ham(undefined), '—');
    ok('chuỗi rỗng → "—"', ham(''), '—');
    ok('số không đọc được → "—", không phải "NaN"', ham('abc'), '—');
  }
  /* Nhưng 0 THẬT thì phải hiện ra là 0 — line Shopee 09/2026 có 2 đơn, 0 đ,
     và con số 0 đó là một sự thật cần nhìn thấy. */
  ok('0 đồng thật vẫn hiện "0"', tron(0), '0');

  /* Dòng chiết khấu mang dấu âm. */
  ok('chiết khấu -200.000 đ viết là "-200"', nghin(-200000), '-200');
}

console.log('\n2) Đúng hàm được gọi ở đúng chỗ');
{
  /* Cắt lấy phần vẽ MỘT DÒNG HÀNG (các ô `tr.appendChild(o(...))`) và phần
     vẽ DÒNG TỔNG, rồi soi từng phần dùng hàm nào. */
  const dongHang = DON.match(/tr\.appendChild\(oGiaNhap\(d\)\)[\s\S]*?tr\.appendChild\(o\(d\.loi_nhuan[^\n]*\n/);
  ok('tìm thấy đoạn vẽ dòng hàng', !!dongHang, true);
  ok('dòng hàng dùng nghin(), KHÔNG dùng nghinTron()',
     /nghinTron\(/.test(dongHang ? dongHang[0] : 'nghinTron('), false);
  ok('  · và có gọi nghin()', /nghin\(/.test(dongHang ? dongHang[0] : ''), true);

  /* Ô Giá nhập tách thành hàm riêng từ P4 (nó còn phải nói lý do khi chưa có
     giá), nên phép canh đơn vị tiền phải theo nó sang đó — không thì đúng cái
     cột vừa mọc ra số tiền lại là cột không ai canh cách viết. */
  const oGia = DON.match(/function oGiaNhap\(d\)\{?[\s\S]*?\n  \}/);
  ok('tìm thấy hàm oGiaNhap()', !!oGia, true);
  ok('ô Giá nhập dùng nghin(), KHÔNG dùng nghinTron()',
     /nghinTron\(/.test(oGia ? oGia[0] : 'nghinTron('), false);
  ok('  · và có gọi nghin()', /nghin\(/.test(oGia ? oGia[0] : ''), true);

  /* Bốn chỗ tổng: tổng kỳ/line, tổng của một ngày, cộng đơn, bảng Dashboard. */
  const tong = [
    ['tổng của line trong tháng', /nghinTron\(b\.tom_tat\.doanh_so\)/],
    ['tổng của một ngày', /nghinTron\(ng\.doanh_so\)/],
    ['dòng cộng đơn', /nghinTron\(don\.tong_ban\)/],
    ['bảng Dashboard theo line', /nghinTron\(l\.doanh_so\)/],
  ];
  for (const [ten, re] of tong) ok(ten + ' dùng nghinTron()', re.test(DON), true);
}

console.log('\n3) Màn nhập sổ dùng cùng một luật — hai màn không được viết khác nhau');
{
  const tron = layHam(TAI, 'nghinTron');
  ok('public/tai-len.js cũng có nghinTron()', typeof tron, 'function');
  ok('và cho cùng kết quả với màn đơn hàng', tron(4047885001), '4.047.885');

  /* Màn này chỉ hiện số TỔNG (doanh số của kỳ, tổng cả lượt tải), không có
     dòng hàng nào — nên mọi chỗ hiện tiền đều phải là bản làm tròn. */
  ok('doanh số của kỳ làm tròn', /nghinTron\(k\.thang\.doanh_so\)/.test(TAI), true);
  ok('tổng cả lượt tải làm tròn', /nghinTron\(kq\.tom_tat\.doanh_so_tong\)/.test(TAI), true);
}

console.log('\n4) Làm tròn chỉ đổi cách VIẾT — không đổi số nào đi vào Firebase');
{
  /* Nếu phép làm tròn rò vào đường ghi thì tiền thật bị sửa, không phải chỉ
     cách hiển thị. Hai file màn hình không được đụng tới thân request. */
  for (const [ten, ma] of [['don-hang.js', DON], ['tai-len.js', TAI]]) {
    const goiGhi = [...ma.matchAll(/JSON\.stringify\(([^)]*)\)/g)].map(m => m[1].trim());
    ok(ten + ': không JSON.stringify một giá trị đã chia 1000',
       goiGhi.some(g => /nghin/.test(g)), false);
  }
  ok('don-hang.js không gửi POST nào (chỉ đọc)', /method:\s*["']POST["']/.test(DON), false);
}

xong();
