/* Canh hai thứ quanh việc nạp sổ ở P2:
 *
 *   A. BỘ ĐỌC .xlsx (`bin/doc-xlsx.mjs`) — tự viết, nên phải tự canh. Kiểm
 *      bằng một file .xlsx DỰNG TẠI CHỖ trong bộ nhớ, không dùng sổ thật:
 *      sổ thật có tên/SĐT/địa chỉ khách, không được vào repo hay vào CI.
 *
 *   B. KỶ LUẬT của script nạp (`bin/nap-so-legacy.mjs`) — những điều không
 *      kiểm được bằng cách chạy nó (nó cần khoá Firebase thật), nhưng kiểm
 *      được bằng cách đọc mã nguồn: không ghi file trung gian, không đọc cột
 *      dữ liệu cá nhân, không tự dựng client Firebase thứ hai, không tự tính
 *      lại nghiệp vụ, và mặc định KHÔNG ghi gì.
 */
const { doc, ok, xong } = require('./khung');
const zlib = require('zlib');

/* ── Dựng một .xlsx tối thiểu trong bộ nhớ ─────────────────────────────────
   Ghi entry kiểu STORED (không nén) — bộ đọc hỗ trợ cả stored và deflate, và
   stored làm fixture đọc được bằng mắt khi phải gỡ lỗi. */
function zipStored(entry) {
  const cuc = [], cd = [];
  let vt = 0;
  for (const [ten, noiDung] of entry) {
    const ten_b = Buffer.from(ten, 'utf8');
    const than = Buffer.from(noiDung, 'utf8');
    const crc = typeof zlib.crc32 === 'function' ? zlib.crc32(than) : 0;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6); lfh.writeUInt16LE(0, 8);   // không nén
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(than.length, 18); lfh.writeUInt32LE(than.length, 22);
    lfh.writeUInt16LE(ten_b.length, 26); lfh.writeUInt16LE(0, 28);
    cuc.push(lfh, ten_b, than);

    const e = Buffer.alloc(46);
    e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6);
    e.writeUInt16LE(0, 10); e.writeUInt32LE(crc, 16);
    e.writeUInt32LE(than.length, 20); e.writeUInt32LE(than.length, 24);
    e.writeUInt16LE(ten_b.length, 28); e.writeUInt32LE(vt, 42);
    cd.push(e, ten_b);
    vt += lfh.length + ten_b.length + than.length;
  }
  const thanCd = Buffer.concat(cd);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entry.length, 8); eocd.writeUInt16LE(entry.length, 10);
  eocd.writeUInt32LE(thanCd.length, 12); eocd.writeUInt32LE(vt, 16);
  return Buffer.concat([...cuc, thanCd, eocd]);
}

const WB = '<?xml version="1.0"?><workbook><sheets>'
  + '<sheet name="SỔ CHI TIẾT BÁN HÀNG" sheetId="1" r:id="rId1"/></sheets></workbook>';
const RELS = '<?xml version="1.0"?><Relationships>'
  + '<Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>';

/** .xlsx gồm một sheet, với bảng chuỗi chung và thân sheet cho sẵn. */
function xlsxMau(sst, sheetBody, duongSheet = 'xl/worksheets/sheet1.xml') {
  const s = '<?xml version="1.0"?><sst count="' + sst.length + '">'
    + sst.map(x => '<si>' + x + '</si>').join('') + '</sst>';
  return zipStored([
    ['xl/workbook.xml', WB],
    ['xl/_rels/workbook.xml.rels', RELS],
    ['xl/sharedStrings.xml', s],
    [duongSheet, '<?xml version="1.0"?><worksheet><sheetData>' + sheetBody
      + '</sheetData></worksheet>'],
  ]);
}

(async () => {
const { docBangTuXlsx, moZip, giaiMaXml, soCot } = await import('../bin/doc-xlsx.mjs');
const G = await import('../engine/src/gop-ban-hang.mjs');

console.log('\n1) Giải nén ZIP');
{
  const z = moZip(zipStored([['a.txt', 'xin chào'], ['b/c.txt', 'hai']]));
  ok('đọc được entry theo tên', z.get('a.txt').toString('utf8'), 'xin chào');
  ok('entry trong thư mục con', z.get('b/c.txt').toString('utf8'), 'hai');

  let loi = null;
  try { moZip(Buffer.from('không phải zip')); } catch (e) { loi = /EOCD/.test(e.message); }
  ok('không phải zip → nổ, không trả rỗng', loi, true);

  /* Deflate: đường thật của mọi .xlsx do Excel/MISA xuất ra. */
  const than = Buffer.from('nội dung nén'.repeat(40), 'utf8');
  const nen = zlib.deflateRawSync(than);
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(8, 8);
  lfh.writeUInt32LE(nen.length, 18); lfh.writeUInt32LE(than.length, 22);
  lfh.writeUInt16LE(5, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(nen.length, 20); cd.writeUInt32LE(than.length, 24);
  cd.writeUInt16LE(5, 28); cd.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(51, 12); eocd.writeUInt32LE(35 + nen.length, 16);
  const zb = Buffer.concat([lfh, Buffer.from('x.txt'), nen, cd, Buffer.from('x.txt'), eocd]);
  ok('entry nén deflate giải ra đúng nguyên văn',
     moZip(zb).get('x.txt').toString('utf8'), than.toString('utf8'));
}

console.log('\n2) Thực thể XML và chữ cột');
{
  ok('&amp; &lt; &gt;', giaiMaXml('a&amp;b&lt;c&gt;d'), 'a&b<c>d');
  ok('thực thể số thập phân', giaiMaXml('&#65;'), 'A');
  ok('thực thể số thập lục (ứ)', giaiMaXml('&#x1EE9;'), 'ứ');
  ok('chuỗi không có & đi qua nguyên vẹn', giaiMaXml('Thu Hà'), 'Thu Hà');
  ok('A → 0', soCot('A'), 0);
  ok('M → 12 (cột nhân viên)', soCot('M'), 12);
  ok('Q → 16 (cột cuối của sổ)', soCot('Q'), 16);
  ok('AA → 26', soCot('AA'), 26);
}

console.log('\n3) Ô: chuỗi chung, số, bool, inlineStr, ô thưa');
{
  const x = xlsxMau(
    ['<t>An</t>', '<t xml:space="preserve">  hai đầu  </t>', '<r><t>Thu</t></r><r><t> Hà</t></r>'],
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>46023</v></c>'
    + '<c r="D1" t="s"><v>1</v></c><c r="E1" t="s"><v>2</v></c>'
    + '<c r="F1" t="b"><v>1</v></c><c r="G1" t="inlineStr"><is><t>trong dòng</t></is></c>'
    + '<c r="H1"/></row>'
    + '<row r="3"><c r="A3"><v>7</v></c></row>');
  const b = x && docBangTuXlsx(x);
  ok('tên sheet đọc từ workbook.xml', b.ten_sheet, 'SỔ CHI TIẾT BÁN HÀNG');
  ok('chuỗi chung', b.bang[0][0], 'An');
  ok('số giữ nguyên kiểu number (ngày là sê-ri Excel)', b.bang[0][2], 46023);
  ok('xml:space="preserve" giữ nguyên khoảng trắng', b.bang[0][3], '  hai đầu  ');
  ok('chuỗi bị chẻ nhiều <r><t> được nối lại', b.bang[0][4], 'Thu Hà');
  ok('bool', b.bang[0][5], true);
  ok('inlineStr', b.bang[0][6], 'trong dòng');
  ok('ô tự đóng <c/> → trống', b.bang[0][7], undefined);
  ok('cột bị nhảy (B1 không có) → trống', b.bang[0][1], undefined);
  ok('bang[0] là HÀNG 1 của sheet', b.bang[2][0], 7);
  ok('hàng 2 không có <row> vẫn là mảng, không phải undefined', b.bang[1], []);
}

console.log('\n4) Nguồn hỏng thì NỔ — không đoán, không trả rỗng (CLAUDE.md)');
{
  /* Chỉ số trỏ ra ngoài bảng chuỗi chung. Nếu lặng lẽ thành chuỗi rỗng thì
     một ô NVBH sẽ âm thầm rơi vào "(chưa gán)" và tiền đi sai người. */
  let loi = null;
  try {
    docBangTuXlsx(xlsxMau(['<t>An</t>'], '<row r="1"><c r="A1" t="s"><v>99</v></c></row>'));
  } catch (e) { loi = /chi so chuoi chung sai/.test(e.message); }
  ok('chỉ số chuỗi chung sai → nổ', loi, true);

  let loi2 = null;
  try { docBangTuXlsx(zipStored([['xl/khac.xml', 'x']])); } catch (e) { loi2 = true; }
  ok('thiếu xl/workbook.xml → nổ', loi2, true);

  /* Cách nén lạ (ví dụ 12 = bzip2): báo tên cách nén, không trả nửa file.
     Vá đúng trường "cách nén" của Central Directory — đó là trường moZip
     đọc. Vị trí CD lấy từ EOCD chứ không đếm tay, để bài kiểm không hỏng
     theo mỗi lần đổi tên file fixture. */
  const z = zipStored([['x.txt', 'abc']]);
  const cdOffset = z.readUInt32LE(z.length - 22 + 16);
  z.writeUInt16LE(12, cdOffset + 10);
  let loi3 = null;
  try { moZip(z); } catch (e) { loi3 = /cach nen 12/.test(e.message); }
  ok('cách nén không hỗ trợ → nổ có tên', loi3, true);
}

console.log('\n5) Bộ đọc + hàm gộp chạy liền nhau ra đúng số');
{
  /* Sheet đúng bố cục sổ thật: tiêu đề hàng 4/5, dữ liệu từ hàng 6, ngày là
     sê-ri Excel — đúng như file MISA xuất ra. */
  const sst = ['<t>Ngày </t>', '<t>Số BH</t>', '<t>Doanh số bán</t>', '<t>NVBH</t>',
               '<t>Số chứng từ</t>', '<t>Tên nhân viên bán hàng</t>',
               '<t>BH1</t>', '<t>BH2</t>', '<t>An</t>'];
  const body =
    '<row r="4"><c r="A4" t="s"><v>0</v></c><c r="B4" t="s"><v>1</v></c>'
    + '<c r="K4" t="s"><v>2</v></c><c r="M4" t="s"><v>3</v></c></row>'
    + '<row r="5"><c r="B5" t="s"><v>4</v></c><c r="M5" t="s"><v>5</v></c></row>'
    + '<row r="6"><c r="A6"><v>46023</v></c><c r="B6" t="s"><v>6</v></c>'
    + '<c r="K6"><v>8000000</v></c><c r="M6" t="s"><v>8</v></c></row>'
    + '<row r="7"><c r="A7"><v>46023</v></c><c r="B7" t="s"><v>6</v></c>'
    + '<c r="K7"><v>250000</v></c><c r="M7" t="s"><v>8</v></c></row>'
    + '<row r="8"><c r="A8"><v>46024</v></c><c r="B8" t="s"><v>7</v></c>'
    + '<c r="K8"><v>1000000</v></c><c r="M8" t="s"><v>8</v></c></row>';
  const { bang } = docBangTuXlsx(xlsxMau(sst, body));

  ok('bố cục khớp sau khi đi qua bộ đọc', G.kiemBoCuc(bang), []);
  const r = G.gopSoBanHang(bang);
  ok('ngày sê-ri → đúng kỳ và đúng ngày',
     r.ky['2026-01']['An']['2026-01-01'], { doanh_so: 8250000, so_don: 1 });
  ok('ngày hôm sau là ô riêng',
     r.ky['2026-01']['An']['2026-01-02'], { doanh_so: 1000000, so_don: 1 });
  ok('tổng tháng', r.tom_tat.thang['2026-01'],
     { doanh_so: 9250000, so_don: 2, so_nhan_vien: 1, so_ngay: 2 });
  ok('không cảnh báo nào', r.canh_bao, []);
}

/* ─────────────── B. Kỷ luật của script nạp ─────────────── */

const SCRIPT = doc('bin/nap-so-legacy.mjs');
const DOC_XLSX = doc('bin/doc-xlsx.mjs');
const GOP = doc('engine/src/gop-ban-hang.mjs');
/* Bỏ chú thích trước khi soi mã: cả ba file GIẢI THÍCH bằng tiếng Việt vì sao
   không đọc cột dữ liệu cá nhân, và chính câu giải thích đó có chứa tên cột.
   Soi cả chú thích thì bài kiểm đỏ vì đúng cái chú thích nó muốn có. */
const boChuThich = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const SCRIPT_MA = boChuThich(SCRIPT);
const GOP_MA = boChuThich(GOP);

console.log('\n6) Dữ liệu cá nhân: bốn cột khách hàng KHÔNG được đọc ở P2');
{
  ok('COT_PII kể đủ bốn cột', [...G.COT_PII].sort(),
     ['dia_chi', 'dien_thoai', 'ma_khach', 'ten_khach']);

  /* Hàm gộp KHÔNG được chạm bốn cột ấy. Khai vị trí trong bảng COT là cần —
     đó là tài liệu bố cục sổ — nhưng `h[COT.ten_khach]` thì không. */
  for (const c of G.COT_PII) {
    ok('gop-ban-hang không đọc ô ' + c,
       new RegExp('\\[\\s*COT\\.' + c + '\\s*\\]').test(GOP_MA), false);
    ok('script nạp không đọc ô ' + c, new RegExp('COT\\.' + c).test(SCRIPT_MA), false);
  }
  ok('kết quả trả về chỉ có doanh_so và so_don',
     /doanh_so:\s*\w+,\s*so_don/.test(GOP_MA), true);
}

console.log('\n7) Không ghi file trung gian nào — PII chỉ đi qua bộ nhớ tiến trình');
{
  for (const [ten, ma] of [['script nạp', SCRIPT_MA], ['bộ đọc xlsx', boChuThich(DOC_XLSX)]]) {
    ok(ten + ': không writeFile/appendFile/createWriteStream',
       /writeFile|appendFile|createWriteStream|writeFileSync/.test(ma), false);
    ok(ten + ': không mkdir/mkdtemp (không dựng chỗ chứa tạm)',
       /mkdir|mkdtemp|tmpdir/.test(ma), false);
  }
  ok('script chỉ ĐỌC từ đĩa (readFileSync), không ghi',
     /readFileSync/.test(SCRIPT_MA), true);
}

console.log('\n8) Nghiệp vụ ở Engine, script chỉ gọi lại — P4 dùng ĐÚNG hàm này');
{
  ok('script import gopSoBanHang từ engine/src/gop-ban-hang.mjs',
     /import\s*\{[^}]*gopSoBanHang[^}]*\}\s*from\s*"\.\.\/engine\/src\/gop-ban-hang\.mjs"/
       .test(SCRIPT), true);
  ok('script KHÔNG tự dùng chỉ số cột nào (bố cục là việc của Engine)',
     /\[\s*(?:8|9|10|11|12)\s*\]/.test(SCRIPT_MA), false);
  ok('script KHÔNG tự đếm đơn (không có Set số chứng từ riêng)',
     /new Set\(/.test(SCRIPT_MA), false);

  /* Hàm gộp phải chạy được bằng Node THUẦN — không import gì của Cloudflare —
     vì nếu không thì bộ kiểm và script nạp không nạp nổi nó, và nghiệp vụ sẽ
     bị chép sang một bản thứ hai. */
  ok('gop-ban-hang không import cloudflare:*', /cloudflare:/.test(GOP), false);
  ok('gop-ban-hang không import gì cả (hàm thuần)', /^\s*import\s/m.test(GOP), false);
}

console.log('\n9) Chỉ MỘT đường chạm Firebase — dùng lại src/firebase.js của Gateway');
{
  ok('script import ghiDb/docDb từ src/firebase.js',
     /import\s*\{[^}]*ghiDb[^}]*\}\s*from\s*"\.\.\/src\/firebase\.js"/.test(SCRIPT), true);
  ok('script không tự gọi oauth2.googleapis.com', /oauth2\.googleapis/.test(SCRIPT_MA), false);
  ok('script không tự dựng URL firebasedatabase',
     /firebasedatabase|firebaseio/.test(SCRIPT_MA), false);
  ok('script không tự ký JWT', /crypto\.subtle|RSASSA/.test(SCRIPT_MA), false);
  ok('khoá riêng chỉ đến từ biến môi trường, không viết chết',
     /BEGIN PRIVATE KEY/.test(SCRIPT), false);
  /* Đường ghi phải là bc/ky/<kỳ> và phải đi qua ghiDb (PUT) — tức ĐÈ TRỌN
     một kỳ mỗi lượt, đúng "Nhập sổ" của CLAUDE.md. Không được là PATCH (vaDb)
     vào nhánh con: PATCH để lại dòng của lần nạp trước mà lần này không còn. */
  ok('dựng đường ghi từ "bc/ky/" + kỳ', /"bc\/ky\/"\s*\+/.test(SCRIPT_MA), true);
  ok('ghi qua ghiDb (PUT, đè trọn kỳ)', /await\s+ghiDb\(/.test(SCRIPT_MA), true);
  ok('KHÔNG dùng vaDb/PATCH cho bc/ky', /vaDb/.test(SCRIPT_MA), false);
}

console.log('\n10) Mặc định KHÔNG ghi gì — phải nói --ghi mới chạm Firebase');
{
  ok('có cờ --ghi', /"--ghi"/.test(SCRIPT_MA), true);
  ok('thoát sớm khi không có --ghi', /if\s*\(!ghi\)/.test(SCRIPT_MA), true);
  ok('thiếu FB_SA_EMAIL/FB_SA_KEY thì dừng, không ghi nửa vời',
     /!env\.FB_SA_EMAIL\s*\|\|\s*!env\.FB_SA_KEY/.test(SCRIPT_MA), true);
  ok('có cờ --doc-lai để đọc ngược mà xác nhận', /"--doc-lai"/.test(SCRIPT_MA), true);
}

console.log('\n11) Đối chiếu nội bộ CHẶN lượt ghi, và tên nhân viên được báo ra');
{
  /* Điều kiện ra khỏi P2 là đối chiếu nội bộ khớp 0 lệch. Nếu script in ra
     "không khớp" rồi vẫn ghi tiếp thì điều kiện ấy chỉ là trang trí. */
  ok('script đọc doi_chieu_noi_bo', /doi_chieu_noi_bo/.test(SCRIPT_MA), true);
  ok('lệch thì THOÁT, không ghi gì', /lechNoiBo\)\s*\{[\s\S]{0,200}?process\.exit/.test(SCRIPT_MA), true);
  /* Và phép chặn phải nằm TRƯỚC chỗ ghi, không phải sau. */
  ok('chỗ chặn nằm trước lượt ghiDb đầu tiên',
     SCRIPT_MA.indexOf('lechNoiBo') < SCRIPT_MA.indexOf('await ghiDb('), true);
  ok('script in danh sách tên nhân viên để chủ dự án ghép',
     /tom_tat\.nhan_vien/.test(SCRIPT_MA), true);
  ok('script KHÔNG tự ghép tên gần giống (không so gần đúng, không bỏ dấu)',
     /normalize\(|localeCompare|levenshtein|toLowerCase\(\)/.test(SCRIPT_MA), false);
}

console.log('\n12) Engine đã có hàm TRƯỚC khi Gateway gọi (bẫy số 4 của ROADMAP)');
{
  const IDX = doc('engine/src/index.js');
  ok('Engine mở hàm gopSoBanHang qua Service Binding',
     /async\s+gopSoBanHang\s*\(/.test(IDX), true);
  ok('Engine import hàm chung, không chép lại',
     /from\s*"\.\/gop-ban-hang\.mjs"/.test(IDX), true);
  /* Hai Worker build SONG SONG khi merge. Gateway gọi một hàm Engine trong
     CÙNG lượt merge là tự tạo ra vài chục giây lỗi thật cho người đang dùng.
     P2 chỉ ĐẶT hàm vào Engine; Gateway gọi nó ở P4, lượt merge sau. */
  ok('Gateway CHƯA gọi gopSoBanHang (để P4 gọi ở lượt merge sau)',
     /gopSoBanHang/.test(doc('src/index.js')), false);
}

xong();
})().catch(e => { console.error(e); process.exit(1); });
