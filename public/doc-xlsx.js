/* Đọc file .xlsx người dùng chọn ra MA TRẬN Ô THÔ — và DỪNG Ở ĐÓ.
 *
 * CLAUDE.md cho phép trình duyệt "đọc file .xlsx người dùng chọn rồi gửi
 * lên". File này làm đúng ngần ấy: mở ZIP, đọc XML, trả về mảng hai chiều
 * các ô. Nó KHÔNG biết cột 12 là nhân viên, KHÔNG biết dòng nào phải bỏ,
 * KHÔNG cộng một đồng nào. Toàn bộ luật đó nằm ở Engine
 * (`engine/src/gop-ban-hang.mjs`, `engine/src/dong-hang.mjs`) — mở Ctrl+U
 * trang này không đọc được cách tính ra bất kỳ con số tiền nào.
 *
 * Vì sao tự viết thay vì nạp một thư viện đọc Excel: CSP của Gateway chỉ
 * cho script từ `'self'` và gstatic (xem `src/index.js`). Kéo SheetJS từ
 * CDN là phải nới CSP — đổi một lỗ thật trên bản deploy lấy chút tiện tay.
 * Bản Node tương đương đã chạy trên 40.118 dòng sổ thật ở P2
 * (`bin/doc-xlsx.mjs`); file này là đúng cùng thuật toán, khác mỗi chỗ giải
 * nén (`DecompressionStream` của trình duyệt thay cho `zlib` của Node) nên
 * mọi hàm ở đây là async.
 *
 * Phạm vi CÓ CHỦ Ý HẸP: đủ đọc đúng file MISA xuất ra, không phải đủ đọc
 * mọi file Excel trên đời. Gặp thứ ngoài phạm vi thì NÉM LỖI CÓ TÊN, không
 * đoán — một file đọc sai một nửa còn tệ hơn một file không đọc được.
 */
(function () {
  'use strict';

  var SIG_EOCD = 0x06054b50;   // End Of Central Directory
  var SIG_CD = 0x02014b50;     // một entry của Central Directory
  var SIG_LFH = 0x04034b50;    // Local File Header

  var utf8 = new TextDecoder('utf-8');

  /** Giải nén deflate thô. Trình duyệt cũ không có `DecompressionStream`
   *  ('deflate-raw' có từ Chrome 103 / Safari 16.4 / Firefox 113) — báo
   *  thẳng chứ không im lặng trả rỗng. */
  async function xaNen(u8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Trình duyệt này quá cũ để đọc file .xlsx — hãy cập nhật trình duyệt.');
    }
    var luong = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(luong).arrayBuffer());
  }

  /** Bảng { tên entry → Uint8Array đã giải nén } của một file ZIP trong bộ nhớ.
   *
   *  .xlsx là một file ZIP. Chỉ cần vài entry theo TÊN, nên đọc Central
   *  Directory (bảng mục lục ở cuối file) rồi nhảy tới từng entry — không
   *  quét tuần tự cả file. */
  async function moZip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    /* EOCD nằm ở cuối, sau nó là comment dài tối đa 65535 byte → quét NGƯỢC
       từ cuối. Quét xuôi thì một chuỗi byte trùng chữ ký nằm giữa dữ liệu
       nén sẽ bị nhận nhầm. */
    var eocd = -1;
    var somNhat = Math.max(0, u8.length - 65557);
    for (var i = u8.length - 22; i >= somNhat; i--) {
      if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('File không phải .xlsx (không thấy cấu trúc ZIP).');

    var soEntry = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);
    if (cdOffset === 0xffffffff || soEntry === 0xffff) {
      // ZIP64 — Excel chỉ dùng khi file rất lớn. Không đoán, báo thẳng.
      throw new Error('File dùng định dạng ZIP64, ngoài phạm vi bộ đọc này.');
    }

    var ra = new Map();
    var p = cdOffset;
    for (var n = 0; n < soEntry; n++) {
      if (dv.getUint32(p, true) !== SIG_CD) throw new Error('Mục lục ZIP hỏng ở entry ' + n + '.');
      var cach = dv.getUint16(p + 10, true);
      var cSize = dv.getUint32(p + 20, true);
      var uSize = dv.getUint32(p + 24, true);
      var nLen = dv.getUint16(p + 28, true);
      var eLen = dv.getUint16(p + 30, true);
      var cLen = dv.getUint16(p + 32, true);
      var lfh = dv.getUint32(p + 42, true);
      var ten = utf8.decode(u8.subarray(p + 46, p + 46 + nLen));
      p += 46 + nLen + eLen + cLen;

      /* Kích thước trong Local File Header có thể là 0 (streaming, số thật
         nằm ở Data Descriptor SAU dữ liệu). Số của Central Directory thì
         luôn thật — chỉ lấy ở LFH độ dài hai trường biến đổi để biết dữ
         liệu bắt đầu ở đâu. */
      if (dv.getUint32(lfh, true) !== SIG_LFH) throw new Error('Header cục bộ hỏng của ' + ten + '.');
      var lnLen = dv.getUint16(lfh + 26, true);
      var leLen = dv.getUint16(lfh + 28, true);
      var dau = lfh + 30 + lnLen + leLen;
      var than = u8.subarray(dau, dau + cSize);

      var noi;
      if (cach === 0) noi = than;                 // không nén
      else if (cach === 8) noi = await xaNen(than);   // deflate
      else throw new Error('Cách nén ' + cach + ' không hỗ trợ (' + ten + ').');

      if (noi.length !== uSize) throw new Error('Giải nén lệch kích thước ở ' + ten + '.');
      ra.set(ten, noi);
    }
    return ra;
  }

  /* ─── XML ───
   * Không dùng DOMParser, có chủ ý: sheet của sổ cả năm là hơn 10 MB XML với
   * ~255.000 ô, dựng cây DOM cho ngần ấy nút là tốn bộ nhớ vô ích. Cấu trúc
   * SpreadsheetML ở đây rất đều (<row><c r=".." t=".."><v>..</v></c></row>),
   * quét bằng biểu thức chính quy một lượt là đủ — đổi lại phải tự giải mã
   * thực thể XML. Cùng cách bản Node đã chạy thật ở P2. */

  var THUC_THE = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  function giaiMaXml(s) {
    if (s.indexOf('&') < 0) return s;   // đường nhanh: phần lớn ô không có
    return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (ca, t) {
      if (t[0] === '#') {
        var ma = (t[1] === 'x' || t[1] === 'X')
          ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10);
        return Number.isFinite(ma) ? String.fromCodePoint(ma) : ca;
      }
      return THUC_THE[t] !== undefined ? THUC_THE[t] : ca;
    });
  }

  /** Nối mọi <t> trong một đoạn — một <si> của sharedStrings bị chẻ thành
   *  nhiều <r><t>..</t></r> khi ô có nhiều định dạng chữ; nối lại mới ra
   *  đúng chuỗi người dùng thấy. */
  function gomT(doan) {
    var ra = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
    while ((m = re.exec(doan)) !== null) ra += m[1] === undefined ? '' : giaiMaXml(m[1]);
    return ra;
  }

  function docChuoiChung(xml) {
    if (!xml) return [];
    var ra = [], re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g, m;
    while ((m = re.exec(xml)) !== null) ra.push(m[1] === undefined ? '' : gomT(m[1]));
    return ra;
  }

  /** "M" → 12, "AA" → 26. Chữ cột trong thuộc tính r của ô ("M6"). */
  function soCot(chu) {
    var n = 0;
    for (var i = 0; i < chu.length; i++) n = n * 26 + (chu.charCodeAt(i) - 64);
    return n - 1;
  }

  /** Sheet ĐẦU TIÊN theo đúng thứ tự khai trong workbook.xml — thứ tự file
   *  sheet1/sheet2.xml KHÔNG chắc là thứ tự tab. */
  function duongSheetDau(zip) {
    var wb = zip.get('xl/workbook.xml');
    if (!wb) throw new Error('File .xlsx thiếu xl/workbook.xml.');
    var s = utf8.decode(wb);
    var m = s.match(/<sheet\s[^>]*?\/?>/);
    if (!m) throw new Error('File .xlsx không khai sheet nào.');
    var ten = (m[0].match(/\sname="([^"]*)"/) || [, ''])[1];
    var rid = (m[0].match(/\sr:id="([^"]*)"/) || [, ''])[1];

    var duong = null;
    var rels = zip.get('xl/_rels/workbook.xml.rels');
    if (rels && rid) {
      var rs = utf8.decode(rels);
      var re = /<Relationship\s[^>]*?\/?>/g, r;
      while ((r = re.exec(rs)) !== null) {
        if ((r[0].match(/\sId="([^"]*)"/) || [, ''])[1] !== rid) continue;
        var t = (r[0].match(/\sTarget="([^"]*)"/) || [, ''])[1];
        if (!t) break;
        t = giaiMaXml(t).replace(/^\/+/, '');
        duong = t.indexOf('xl/') === 0 ? t : 'xl/' + t;
        break;
      }
    }
    // Dự phòng cho file không có rels hợp lệ — vẫn là đường MISA thực tế dùng.
    if (!duong || !zip.has(duong)) duong = 'xl/worksheets/sheet1.xml';
    if (!zip.has(duong)) throw new Error('Không thấy sheet dữ liệu trong file.');
    return { ten: giaiMaXml(ten), duong: duong };
  }

  /** Ma trận ô của sheet đầu tiên: `bang[0]` là HÀNG 1 của sheet.
   *
   *  Giá trị ô giữ NGUYÊN KIỂU THÔ: số ra number (kể cả ngày — Excel lưu
   *  ngày là số sê-ri, và Engine biết đổi), chuỗi ra string, ô trống là
   *  null. CỐ Ý không đọc xl/styles.xml để đoán ô nào là ngày: đoán định
   *  dạng chỉ thêm một chỗ có thể sai, mà đó lại là việc của Engine. */
  async function docBangTuXlsx(u8) {
    var zip = await moZip(u8);
    var sh = duongSheetDau(zip);
    var sst = docChuoiChung(zip.has('xl/sharedStrings.xml') ? utf8.decode(zip.get('xl/sharedStrings.xml')) : '');
    var xml = utf8.decode(zip.get(sh.duong));

    var bang = [];
    var reHang = /<row\s[^>]*?r="(\d+)"[^>]*?>([\s\S]*?)<\/row>|<row\s[^>]*?r="(\d+)"[^>]*?\/>/g;
    var reO = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    var mh;
    while ((mh = reHang.exec(xml)) !== null) {
      var soHang = +(mh[1] !== undefined ? mh[1] : mh[3]);
      var than = mh[2];
      var hang = [];
      if (than) {
        reO.lastIndex = 0;
        var mo;
        while ((mo = reO.exec(than)) !== null) {
          var thuocTinh = mo[1], trong = mo[2];
          var r = (thuocTinh.match(/\br="([A-Z]+)\d+"/) || [, null])[1];
          if (r === null) continue;
          var i = soCot(r);
          if (trong === undefined) { hang[i] = null; continue; }

          var kieu = (thuocTinh.match(/\bt="([^"]*)"/) || [, 'n'])[1];
          if (kieu === 'inlineStr') { hang[i] = gomT(trong); continue; }

          var mv = trong.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>|<v(?:\s[^>]*)?\/>/);
          var v = mv ? (mv[1] === undefined ? '' : giaiMaXml(mv[1])) : null;
          if (v === null) { hang[i] = null; continue; }

          if (kieu === 's') {
            var k = Number(v);
            /* Chỉ số trỏ ra ngoài bảng chuỗi chung = file hỏng thật. Không
               thay bằng chuỗi rỗng: một ô nhân viên lặng lẽ thành trống sẽ
               đẩy tiền sang "chưa xác định" mà không ai biết. */
            if (!Number.isInteger(k) || k < 0 || k >= sst.length) {
              throw new Error('File hỏng: chỉ số chuỗi chung sai ở hàng ' + soHang + '.');
            }
            hang[i] = sst[k];
          } else if (kieu === 'b') {
            hang[i] = v === '1';
          } else if (kieu === 'str' || kieu === 'e') {
            hang[i] = v;
          } else {
            var so = Number(v);
            hang[i] = Number.isFinite(so) ? so : v;
          }
        }
      }
      bang[soHang - 1] = hang;
    }
    /* Hàng trống hoàn toàn không có <row> → lấp mảng rỗng, và lấp mọi lỗ
       trong mảng thưa: JSON.stringify biến lỗ thành `null`, nhưng Engine
       duyệt bằng chỉ số nên để lỗ là để một `undefined` đi qua mạng. */
    for (var j = 0; j < bang.length; j++) {
      if (bang[j] === undefined) bang[j] = [];
      else for (var c = 0; c < bang[j].length; c++) if (bang[j][c] === undefined) bang[j][c] = null;
    }
    return { ten_sheet: sh.ten, bang: bang };
  }

  window.DocXlsx = { docBangTuXlsx: docBangTuXlsx };
})();
