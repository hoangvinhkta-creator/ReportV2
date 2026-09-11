/* Bộ đọc .xlsx chạy TRONG TRÌNH DUYỆT (public/doc-xlsx.js).
 *
 * Đây là mảnh duy nhất của P3 nằm ở phía trình duyệt mà vẫn phải ĐÚNG TỪNG
 * Ô: nó là thứ biến file người dùng chọn thành ma trận gửi lên Gateway. Sai
 * một ô là sai một dòng tiền, và sai lặng lẽ.
 *
 * Cách kiểm: dựng một file .xlsx THẬT trong bộ nhớ (ZIP + deflate + XML
 * SpreadsheetML, đúng những thứ MISA xuất ra), rồi đọc bằng CẢ HAI bộ —
 * bản Node đã chạy trên 40.118 dòng sổ thật ở P2 (`bin/doc-xlsx.mjs`) và
 * bản trình duyệt. Hai bên phải ra ma trận GIỐNG HỆT. Bản Node là chuẩn
 * đối chiếu, nên bài này bắt được đúng thứ đáng sợ nhất: bản port trôi khỏi
 * bản gốc mà không ai thấy.
 *
 * `public/doc-xlsx.js` là script cho trình duyệt (IIFE gắn vào `window`),
 * nên chạy nó trong một hộp `vm` với `window` giả. Node 18+ có sẵn
 * `DecompressionStream`, `Blob`, `Response` — cùng API trình duyệt dùng.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const { ok, xong } = require('./khung');
const GOC = path.resolve(__dirname, '..');

/* ─── Dựng file .xlsx trong bộ nhớ ─── */

const BANG_CRC = (() => {
  const b = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    b[n] = c;
  }
  return b;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = BANG_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Gói các entry thành một file ZIP. `nen` chọn deflate hay lưu thô — cả
 *  hai cách đều gặp thật trong file Excel, nên phải đọc được cả hai. */
function dongZip(entry) {
  const cuc = [], mucLuc = [];
  let viTri = 0;
  for (const e of entry) {
    const ten = Buffer.from(e.ten, 'utf8');
    const tho = Buffer.from(e.noi, 'utf8');
    const than = e.nen === false ? tho : zlib.deflateRawSync(tho);
    const cach = e.nen === false ? 0 : 8;
    const crc = crc32(tho);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(cach, 8);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(than.length, 18);
    lfh.writeUInt32LE(tho.length, 22);
    lfh.writeUInt16LE(ten.length, 26); lfh.writeUInt16LE(0, 28);
    cuc.push(lfh, ten, than);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(cach, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(than.length, 20);
    cd.writeUInt32LE(tho.length, 24);
    cd.writeUInt16LE(ten.length, 28);
    cd.writeUInt32LE(viTri, 42);
    mucLuc.push(cd, ten);

    viTri += lfh.length + ten.length + than.length;
  }
  const cdBuf = Buffer.concat(mucLuc);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entry.length, 8);
  eocd.writeUInt16LE(entry.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(viTri, 16);
  return Buffer.concat([Buffer.concat(cuc), cdBuf, eocd]);
}

const thoat = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chuCot = (i) => {
  let s = '', n = i + 1;
  while (n > 0) { const d = (n - 1) % 26; s = String.fromCharCode(65 + d) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/** Dựng .xlsx từ một ma trận. Chuỗi đi vào sharedStrings (đúng cách Excel
 *  làm), số đi thẳng vào <v>, `null` là ô trống thật sự không có thẻ <c>. */
function dungXlsx(bang, tuyChon) {
  const o = tuyChon || {};
  const sst = [];
  const chiSo = new Map();
  const hang = [];
  for (let r = 0; r < bang.length; r++) {
    const h = bang[r] || [];
    const o_ = [];
    for (let c = 0; c < h.length; c++) {
      const v = h[c];
      if (v === null || v === undefined) continue;
      const ref = chuCot(c) + (r + 1);
      if (typeof v === 'number') {
        o_.push('<c r="' + ref + '"><v>' + v + '</v></c>');
      } else if (o.noiDong) {
        o_.push('<c r="' + ref + '" t="inlineStr"><is><t>' + thoat(v) + '</t></is></c>');
      } else {
        if (!chiSo.has(v)) { chiSo.set(v, sst.length); sst.push(v); }
        o_.push('<c r="' + ref + '" t="s"><v>' + chiSo.get(v) + '</v></c>');
      }
    }
    if (o_.length) hang.push('<row r="' + (r + 1) + '">' + o_.join('') + '</row>');
  }

  const sheet = '<?xml version="1.0"?><worksheet><sheetData>' + hang.join('') + '</sheetData></worksheet>';
  const chuoiChung = '<?xml version="1.0"?><sst count="' + sst.length + '">'
    + sst.map(s => '<si><t>' + thoat(s) + '</t></si>').join('') + '</sst>';

  /* Thứ tự sheet trong workbook.xml là thứ tự TAB, không phải thứ tự file
     sheetN.xml — bộ đọc phải theo r:id chứ không theo tên file. */
  const entry = [
    { ten: 'xl/workbook.xml', noi: '<?xml version="1.0"?><workbook><sheets>'
      + '<sheet name="' + thoat(o.tenSheet || 'SỔ CHI TIẾT BÁN HÀNG') + '" sheetId="1" r:id="rId7"/>'
      + '</sheets></workbook>' },
    { ten: 'xl/_rels/workbook.xml.rels', noi: '<?xml version="1.0"?><Relationships>'
      + '<Relationship Id="rId9" Target="worksheets/sheetKHAC.xml"/>'
      + '<Relationship Id="rId7" Target="worksheets/sheetTHAT.xml"/>'
      + '</Relationships>' },
    { ten: 'xl/worksheets/sheetTHAT.xml', noi: sheet },
    { ten: 'xl/worksheets/sheetKHAC.xml', noi: '<?xml version="1.0"?><worksheet><sheetData>'
      + '<row r="1"><c r="A1" t="inlineStr"><is><t>SHEET SAI</t></is></c></row></sheetData></worksheet>' },
  ];
  if (!o.noiDong) entry.push({ ten: 'xl/sharedStrings.xml', noi: chuoiChung, nen: o.nen });
  return dongZip(entry);
}

/* ─── Nạp bộ đọc của trình duyệt vào một hộp có `window` giả ─── */
function napBoDocTrinhDuyet() {
  const win = {};
  const hop = vm.createContext({
    window: win, TextDecoder, Blob, Response, DecompressionStream,
    Number, String, Error, Map, Set, Uint8Array, DataView, Math, JSON, console,
  });
  vm.runInContext(fs.readFileSync(path.join(GOC, 'public/doc-xlsx.js'), 'utf8'), hop);
  return win.DocXlsx;
}

(async () => {
  const TD = napBoDocTrinhDuyet();
  const { docBangTuXlsx: doNode } = await import('file://' + path.join(GOC, 'bin/doc-xlsx.mjs'));

  ok('public/doc-xlsx.js gắn đúng một cửa ra window', typeof TD.docBangTuXlsx, 'function');

  /* Ma trận mang đủ những thứ sổ MISA thật có: tiêu đề hai tầng, số sê-ri
     ngày, tiền, tên có dấu tiếng Việt, ô trống giữa hàng, ký tự phải thoát
     XML, và một hàng trống hoàn toàn. */
  const MAU = [
    ['SỔ CHI TIẾT BÁN HÀNG'],
    ['Tháng 9 năm 2026'],
    [],
    ['Ngày ', 'Số BH', 'Diễn giải', 'Tên hàng trên chứng từ ', 'Mã khách hàng', 'Tên KH',
     'Địa chỉ', 'ĐT di động (Người liên hệ)', 'SL', 'Đơn giá', 'Doanh số bán', 'Chiết khấu',
     'NVBH', 'Giao vận', 'Lương chuyến ', 'Trường mở rộng chi tiết 1', 'Lợi nhuận'],
    ['Ngày hạch toán', 'Số chứng từ', 'Diễn giải chung', null, null, 'Tên khách hàng',
     null, null, 'Số lượng bán', null, null, null, 'Tên nhân viên bán hàng', null, null, null, null],
    [46266, 'BH73844', 'Bán hàng CÔNG TY CỔ PHẦN "ABC" & <XYZ>', 'Máy giặt LG FX1412N5G',
     'V.BB.CADIMA', 'CÔNG TY CỔ PHẦN', 'Qua lấy', null, 1, 9550000, 9550000, 0,
     'Đức Hiệp', 'Qua lấy', null, '602VWJH1F164', 9550000],
    [46266, 'BH73753', null, 'Tủ lạnh RS57DG400EM9/S', null, 'ĐIỆN MÁY PHÚ LỘC', null, null,
     1, 13850000, 13850000, 100000, 'FANPAGE 0327339229', null, null, null, 13850000],
    [],
    ['Tổng cộng', null, null, null, null, null, null, null, 2, null, 23400000, 100000],
  ];

  console.log('\n1) Bản trình duyệt đọc ra ĐÚNG cùng ma trận với bản Node đã chạy thật');
  {
    const f = dungXlsx(MAU);
    const a = await TD.docBangTuXlsx(new Uint8Array(f));
    const b = doNode(f);

    ok('đọc đúng tên sheet theo r:id, không theo tên file sheetN.xml',
       a.ten_sheet, 'SỔ CHI TIẾT BÁN HÀNG');
    ok('số hàng khớp', a.bang.length, b.bang.length);

    /* Bản Node để ô trống là `undefined` (mảng thưa), bản trình duyệt lấp
       `null` vì `JSON.stringify` biến lỗ mảng thành `null` khi gửi lên
       Gateway. Cùng nghĩa, nên so sau khi quy về một dạng — nhưng phải quy
       về dạng ĐI QUA MẠNG, tức là `null`. */
    const quy = (bang) => JSON.parse(JSON.stringify(bang.map(h => Array.from(h || [], v => v === undefined ? null : v))));
    ok('TỪNG Ô giống hệt bản Node', quy(a.bang), quy(b.bang));

    /* Ghim vài ô cụ thể — nếu cả hai bộ cùng sai một kiểu thì bài trên vẫn
       xanh, bài này thì không. */
    ok('ngày giữ nguyên số sê-ri Excel (Engine mới là nơi đổi)', a.bang[5][0], 46266);
    ok('tiền ra number, không ra chuỗi', a.bang[5][10], 9550000);
    ok('tên nhân viên giữ nguyên chữ HOA', a.bang[6][12], 'FANPAGE 0327339229');
    ok('tên hàng có dấu gạch chéo còn nguyên', a.bang[6][3], 'Tủ lạnh RS57DG400EM9/S');
    ok('thực thể XML được giải mã đúng', a.bang[5][2], 'Bán hàng CÔNG TY CỔ PHẦN "ABC" & <XYZ>');
    ok('ô trống giữa hàng là null, không tụt cột', a.bang[6][2], null);
    ok('hàng trống hoàn toàn vẫn giữ chỗ', a.bang[2], []);
    ok('dòng "Tổng cộng" vẫn được đọc ra (Engine mới là nơi bỏ nó)', a.bang[8][0], 'Tổng cộng');
  }

  console.log('\n2) Cả hai cách nén Excel dùng đều đọc được');
  {
    const thoChua = dungXlsx(MAU, { nen: false });   // entry lưu thô, không deflate
    const a = await TD.docBangTuXlsx(new Uint8Array(thoChua));
    ok('entry không nén (cách 0) đọc được', a.bang[5][1], 'BH73844');

    const noiDong = dungXlsx(MAU, { noiDong: true }); // chuỗi nằm ngay trong ô
    const c = await TD.docBangTuXlsx(new Uint8Array(noiDong));
    ok('chuỗi kiểu inlineStr đọc được', c.bang[5][1], 'BH73844');
    ok('và cho cùng kết quả với kiểu sharedStrings', c.bang[6][12], 'FANPAGE 0327339229');
  }

  console.log('\n3) File hỏng thì NÉM LỖI CÓ TÊN, không trả bảng nửa vời');
  {
    /* CLAUDE.md: "Nguồn hỏng thì BÁO LỖI, không bao giờ trả rỗng". Một file
       đọc sai một nửa còn tệ hơn một file không đọc được — nửa kia sẽ lặng
       lẽ thành doanh số thiếu. */
    let loi = null;
    try { await TD.docBangTuXlsx(new Uint8Array(Buffer.from('đây không phải zip'))); }
    catch (e) { loi = e.message; }
    ok('file không phải .xlsx → ném', /không phải \.xlsx|ZIP/.test(String(loi)), true);

    loi = null;
    try {
      /* Chỉ số chuỗi chung trỏ ra ngoài bảng = file hỏng thật. Không được
         thay bằng chuỗi rỗng: một ô nhân viên lặng lẽ thành trống sẽ đẩy
         tiền sang "_chua_xac_dinh" mà không ai biết. */
      const f = dongZip([
        { ten: 'xl/workbook.xml', noi: '<?xml version="1.0"?><workbook><sheets><sheet name="X" r:id="r1"/></sheets></workbook>' },
        { ten: 'xl/_rels/workbook.xml.rels', noi: '<?xml version="1.0"?><Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>' },
        { ten: 'xl/worksheets/sheet1.xml', noi: '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>99</v></c></row></sheetData></worksheet>' },
        { ten: 'xl/sharedStrings.xml', noi: '<?xml version="1.0"?><sst count="1"><si><t>chỉ có một</t></si></sst>' },
      ]);
      await TD.docBangTuXlsx(new Uint8Array(f));
    } catch (e) { loi = e.message; }
    ok('chỉ số chuỗi chung trỏ sai → ném, KHÔNG lặng lẽ thành ô trống',
       /chỉ số chuỗi chung|hỏng/.test(String(loi)), true);
  }

  console.log('\n4) LUẬT SỐ 1 — bộ đọc này không được biết một luật nghiệp vụ nào');
  {
    const ma = fs.readFileSync(path.join(GOC, 'public/doc-xlsx.js'), 'utf8');
    /* Nếu file này bắt đầu biết "cột 12 là nhân viên" hay "dữ liệu từ hàng
       6" thì luật sổ đã rò ra trình duyệt — đúng thứ CLAUDE.md cấm, và
       đúng thứ không ai để ý cho tới khi hai nơi nói hai luật khác nhau. */
    for (const cam of ['nhan_vien', 'doanh_so', 'chiet_khau', 'so_ct', 'HANG_DAU_DU_LIEU', 'khoaNhanVien']) {
      ok('không nhắc tới "' + cam + '"', ma.includes(cam), false);
    }
    ok('không có phép chia 1000 hay phép trừ tiền nào', /\/\s*1000|doanh|Doanh số bán/.test(ma), false);
  }

  xong();
})();
