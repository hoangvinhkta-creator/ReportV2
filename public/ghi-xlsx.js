/* Đóng một MA TRẬN Ô ĐÃ ĐIỀN SẴN thành file .xlsx — và DỪNG Ở ĐÓ.
 *
 * Anh em của `doc-xlsx.js`, đi chiều ngược lại. Nó KHÔNG biết cột nào là
 * IMEI, dòng nào được xuất, mã cửa hàng là gì: tiêu đề, độ rộng cột và từng
 * ô đều đến nguyên từ Engine (`dongXuatExcel` trong `engine/src/bao-hanh.mjs`).
 * Việc duy nhất ở đây là viết chúng thành XML SpreadsheetML rồi gói ZIP.
 *
 * Vì sao tự viết thay vì nạp SheetJS: cùng lý do `doc-xlsx.js` — CSP chỉ cho
 * script từ `'self'` và gstatic, và nới CSP là đổi một lỗ thật lấy chút tiện.
 *
 * MỌI Ô LÀ CHỮ (`inlineStr`), cố ý: IMEI, số điện thoại và ngày `yyyymmdd`
 * trông như số, và để Excel hiểu chúng là số là mất số 0 đầu của SĐT, còn
 * IMEI 15 chữ số thì bị làm tròn thành dạng `3.51E+14` — một mã sai mà cổng
 * hãng vẫn nhận.
 *
 * ZIP không nén (phương thức 0): file vài trăm dòng thì nén chẳng đáng gì,
 * còn bỏ nén là bỏ cả một lượt `CompressionStream` bất đồng bộ — và Excel,
 * LibreOffice, cổng tải lên đều đọc ZIP không nén như thường.
 */
(function () {
  'use strict';

  var BANG_CRC = (function () {
    var b = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      b[n] = c;
    }
    return b;
  })();
  function crc32(u8) {
    var c = -1;
    for (var i = 0; i < u8.length; i++) c = BANG_CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  /** Gói các file thành một ZIP không nén. */
  function dongZip(tep) {
    var enc = new TextEncoder();
    var phan = [], muc = [], viTri = 0;
    tep.forEach(function (t) {
      var ten = enc.encode(t.ten);
      var than = enc.encode(t.noi);
      var crc = crc32(than);
      var dau = new Uint8Array(30 + ten.length);
      var v = new DataView(dau.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x0800, true);          // tên file UTF-8
      v.setUint16(8, 0, true);               // không nén
      v.setUint16(12, 33, true);             // ngày DOS 01/01/1980 — số 0 là ngày không hợp lệ
      v.setUint32(14, crc, true);
      v.setUint32(18, than.length, true);
      v.setUint32(22, than.length, true);
      v.setUint16(26, ten.length, true);
      dau.set(ten, 30);
      phan.push(dau, than);
      muc.push({ ten: ten, crc: crc, dai: than.length, viTri: viTri });
      viTri += dau.length + than.length;
    });
    var batDauCd = viTri, daiCd = 0;
    muc.forEach(function (m) {
      var cd = new Uint8Array(46 + m.ten.length);
      var v = new DataView(cd.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 20, true);
      v.setUint16(8, 0x0800, true);
      v.setUint16(10, 0, true);
      v.setUint16(14, 33, true);
      v.setUint32(16, m.crc, true);
      v.setUint32(20, m.dai, true);
      v.setUint32(24, m.dai, true);
      v.setUint16(28, m.ten.length, true);
      v.setUint32(42, m.viTri, true);
      cd.set(m.ten, 46);
      phan.push(cd);
      daiCd += cd.length;
    });
    var cuoi = new Uint8Array(22);
    var v = new DataView(cuoi.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, muc.length, true);
    v.setUint16(10, muc.length, true);
    v.setUint32(12, daiCd, true);
    v.setUint32(16, batDauCd, true);
    phan.push(cuoi);

    var tong = phan.reduce(function (s, p) { return s + p.length; }, 0);
    var ra = new Uint8Array(tong), o = 0;
    phan.forEach(function (p) { ra.set(p, o); o += p.length; });
    return ra;
  }

  /** Thoát ký tự XML, và bỏ ký tự điều khiển XML 1.0 không cho phép — một
   *  ký tự lạ lọt từ sổ MISA vào là Excel báo "file hỏng" cho cả file. */
  function xml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tenCot(i) {
    var s = '';
    for (i = i + 1; i > 0; i = Math.floor((i - 1) / 26)) {
      s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    }
    return s;
  }

  function o(ref, giaTri, kieu) {
    var v = String(giaTri === null || giaTri === undefined ? '' : giaTri);
    if (!v && !kieu) return '';
    return '<c r="' + ref + '" t="inlineStr"' + (kieu ? ' s="' + kieu + '"' : '')
      + '><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
  }

  /** `{ ten_sheet, cot, rong_cot, dong }` → Uint8Array của một file .xlsx. */
  function tao(bang) {
    var cot = bang.cot || [];
    var dong = bang.dong || [];
    var rong = bang.rong_cot || [];

    var hang = ['<row r="1" ht="34" customHeight="1">'
      + cot.map(function (c, i) { return o(tenCot(i) + '1', c, 1); }).join('') + '</row>'];
    dong.forEach(function (d, j) {
      var r = j + 2;
      hang.push('<row r="' + r + '">'
        + d.map(function (x, i) { return o(tenCot(i) + r, x, 0); }).join('') + '</row>');
    });

    var cols = rong.length ? '<cols>' + rong.map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Number(w) + '" customWidth="1"/>';
    }).join('') + '</cols>' : '';

    var NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    var NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
    var DAU = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    return dongZip([
      { ten: '[Content_Types].xml', noi: DAU
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>' },
      { ten: '_rels/.rels', noi: DAU + '<Relationships xmlns="' + PKG + '">'
        + '<Relationship Id="rId1" Type="' + NSR + '/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>' },
      { ten: 'xl/workbook.xml', noi: DAU + '<workbook xmlns="' + NS + '" xmlns:r="' + NSR + '">'
        + '<sheets><sheet name="' + xml(bang.ten_sheet || 'Sheet1') + '" sheetId="1" r:id="rId1"/></sheets>'
        + '</workbook>' },
      { ten: 'xl/_rels/workbook.xml.rels', noi: DAU + '<Relationships xmlns="' + PKG + '">'
        + '<Relationship Id="rId1" Type="' + NSR + '/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="' + NSR + '/styles" Target="styles.xml"/>'
        + '</Relationships>' },
      /* Kiểu 1 = ô tiêu đề: chữ đậm cỡ 12, nền vàng nhạt, viền mảnh, căn
         giữa, cho xuống dòng — trông như file mẫu người dùng đã quen. Kiểu
         `@` (numFmt 49) ở ô dữ liệu để gõ sửa tay trong Excel vẫn giữ là chữ. */
      { ten: 'xl/styles.xml', noi: DAU + '<styleSheet xmlns="' + NS + '">'
        + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        + '<font><b/><sz val="12"/><name val="Calibri"/></font></fonts>'
        + '<fills count="3"><fill><patternFill patternType="none"/></fill>'
        + '<fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill></fills>'
        + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
        + '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right>'
        + '<top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="2">'
        + '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        + '<xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
        + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        + '</cellXfs>'
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>' },
      { ten: 'xl/worksheets/sheet1.xml', noi: DAU + '<worksheet xmlns="' + NS + '" xmlns:r="' + NSR + '">'
        + '<dimension ref="A1:' + tenCot(Math.max(cot.length, 1) - 1) + (dong.length + 1) + '"/>'
        + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        + '<sheetFormatPr defaultRowHeight="15"/>'
        + cols
        + '<sheetData>' + hang.join('') + '</sheetData>'
        + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
        + '</worksheet>' },
    ]);
  }

  /** Dựng file rồi đưa trình duyệt tải về với tên cho sẵn. */
  function taiVe(bang, tenFile) {
    var blob = new Blob([tao(bang)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = tenFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* Thu hồi SAU một nhịp: thu hồi ngay trong cùng lượt thì vài trình duyệt
       huỷ lượt tải trước khi nó kịp bắt đầu. */
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  window.GhiXlsx = { tao: tao, taiVe: taiVe };
})();
