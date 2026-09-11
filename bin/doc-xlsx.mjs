/* Đọc một file .xlsx ra MA TRẬN Ô THÔ, bằng Node thuần — không thư viện.
 *
 * Vì sao tự viết thay vì `npm i` một thư viện đọc Excel:
 *
 * 1. Repo này có 0 dependency, và `npm test` là CỬA CHẶN BUILD của Cloudflare
 *    (wrangler.toml). Thêm một cây dependency vào đường đó để phục vụ MỘT
 *    script chạy một lần là đổi rủi ro của bản deploy thật lấy tiện tay.
 * 2. Ở P4 việc đọc .xlsx chuyển sang TRÌNH DUYỆT (CLAUDE.md cho phép: "đọc
 *    file .xlsx người dùng chọn rồi gửi lên"). File này vì thế là công cụ
 *    riêng của P2, không phải một mảnh của kiến trúc lâu dài — càng ít nó
 *    dính vào repo càng tốt.
 *
 * Phạm vi CÓ CHỦ Ý HẸP: đủ đọc đúng file MISA xuất ra, không phải đủ đọc mọi
 * file Excel trên đời. Gặp thứ ngoài phạm vi thì NÉM LỖI có tên, không đoán
 * — một file đọc sai một nửa còn tệ hơn một file không đọc được.
 *
 * KHÔNG ghi gì ra đĩa. Ô của sổ (có tên, SĐT, địa chỉ khách) chỉ đi qua bộ
 * nhớ tiến trình rồi bị bỏ — ROADMAP.md P2.
 */
import { inflateRawSync } from "node:zlib";

/* ─────────────── Tầng 1: giải nén ZIP ───────────────
 * .xlsx là một file ZIP. Chỉ cần đọc theo TÊN vài entry, nên đọc Central
 * Directory (bảng mục lục ở cuối file) rồi nhảy tới từng entry — không cần
 * quét tuần tự cả file. */

const SIG_EOCD = 0x06054b50;   // End Of Central Directory
const SIG_CD = 0x02014b50;     // một entry của Central Directory
const SIG_LFH = 0x04034b50;    // Local File Header

/** Bảng { tên entry → Buffer đã giải nén } của một file ZIP trong bộ nhớ. */
export function moZip(buf) {
  /* EOCD nằm ở cuối, sau nó là comment dài tối đa 65535 byte → quét ngược từ
     cuối, không quét xuôi từ đầu (một chuỗi byte trùng chữ ký có thể xuất
     hiện giữa dữ liệu nén). */
  let eocd = -1;
  const somNhat = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= somNhat; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("doc-xlsx: khong phai file zip (khong thay EOCD)");

  const soEntry = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || soEntry === 0xffff) {
    // ZIP64 — Excel chỉ dùng khi file rất lớn. Không đoán, báo thẳng.
    throw new Error("doc-xlsx: file dung ZIP64, ngoai pham vi bo doc nay");
  }

  const ra = new Map();
  let p = cdOffset;
  for (let n = 0; n < soEntry; n++) {
    if (buf.readUInt32LE(p) !== SIG_CD) {
      throw new Error("doc-xlsx: central directory hong o entry " + n);
    }
    const cach = buf.readUInt16LE(p + 10);
    const cSize = buf.readUInt32LE(p + 20);
    const uSize = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cLen = buf.readUInt16LE(p + 32);
    const lfh = buf.readUInt32LE(p + 42);
    const ten = buf.toString("utf8", p + 46, p + 46 + nLen);
    p += 46 + nLen + eLen + cLen;

    /* Kích thước trong Local File Header có thể là 0 (streaming, số thật nằm
       ở Data Descriptor SAU dữ liệu). Số của Central Directory thì luôn thật
       — dùng số đó, chỉ lấy ở LFH độ dài hai trường biến đổi để biết dữ liệu
       bắt đầu ở đâu. */
    if (buf.readUInt32LE(lfh) !== SIG_LFH) {
      throw new Error("doc-xlsx: local header hong cua " + ten);
    }
    const lnLen = buf.readUInt16LE(lfh + 26);
    const leLen = buf.readUInt16LE(lfh + 28);
    const dau = lfh + 30 + lnLen + leLen;
    const than = buf.subarray(dau, dau + cSize);

    let noi;
    if (cach === 0) noi = Buffer.from(than);            // không nén
    else if (cach === 8) noi = inflateRawSync(than);    // deflate
    else throw new Error("doc-xlsx: cach nen " + cach + " khong ho tro (" + ten + ")");

    if (noi.length !== uSize) {
      throw new Error("doc-xlsx: giai nen lech kich thuoc o " + ten);
    }
    ra.set(ten, noi);
  }
  return ra;
}

/* ─────────────── Tầng 2: XML ───────────────
 * Không dùng bộ phân tích XML đầy đủ, cũng có chủ ý: sheet của sổ 2026 là
 * 10,6 MB XML với ~255.000 ô, và cấu trúc SpreadsheetML ở đây rất đều
 * (<row><c r=".." t=".."><v>..</v></c></row>). Quét bằng biểu thức chính
 * quy một lượt là đủ và nhanh; đổi lại phải tự giải mã thực thể XML. */

const THUC_THE = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Giải mã thực thể XML trong một đoạn văn bản. */
export function giaiMaXml(s) {
  if (s.indexOf("&") < 0) return s;   // đường nhanh: phần lớn ô không có
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (ca, t) => {
    if (t[0] === "#") {
      const ma = t[1] === "x" || t[1] === "X"
        ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10);
      return Number.isFinite(ma) ? String.fromCodePoint(ma) : ca;
    }
    return THUC_THE[t] !== undefined ? THUC_THE[t] : ca;
  });
}

/** Nối mọi <t> trong một đoạn — một <si> của sharedStrings có thể bị chẻ
 *  thành nhiều <r><t>..</t></r> khi ô có nhiều định dạng chữ; nối lại mới ra
 *  đúng chuỗi người dùng thấy. */
function gomT(doan) {
  let ra = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(doan)) !== null) ra += m[1] === undefined ? "" : giaiMaXml(m[1]);
  return ra;
}

/** xl/sharedStrings.xml → mảng chuỗi, tra theo chỉ số. */
function docChuoiChung(xml) {
  if (!xml) return [];
  const ra = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) ra.push(m[1] === undefined ? "" : gomT(m[1]));
  return ra;
}

/** "M" → 12, "AA" → 26. Chữ cột trong thuộc tính r của ô ("M6"). */
export function soCot(chu) {
  let n = 0;
  for (let i = 0; i < chu.length; i++) n = n * 26 + (chu.charCodeAt(i) - 64);
  return n - 1;
}

/* ─────────────── Tầng 3: sheet → ma trận ô ─────────────── */

/** Sheet đầu tiên của workbook, theo đúng thứ tự khai trong workbook.xml
 *  (thứ tự file sheet1/sheet2.xml KHÔNG chắc là thứ tự tab). */
function duongSheetDau(zip) {
  const wb = zip.get("xl/workbook.xml");
  if (!wb) throw new Error("doc-xlsx: thieu xl/workbook.xml");
  const s = wb.toString("utf8");
  const m = s.match(/<sheet\s[^>]*?\/?>/);
  if (!m) throw new Error("doc-xlsx: workbook khong khai sheet nao");
  const ten = (m[0].match(/\sname="([^"]*)"/) || [, ""])[1];
  const rid = (m[0].match(/\sr:id="([^"]*)"/) || [, ""])[1];

  let duong = null;
  const rels = zip.get("xl/_rels/workbook.xml.rels");
  if (rels && rid) {
    const rs = rels.toString("utf8");
    const re = /<Relationship\s[^>]*?\/?>/g;
    let r;
    while ((r = re.exec(rs)) !== null) {
      if ((r[0].match(/\sId="([^"]*)"/) || [, ""])[1] !== rid) continue;
      let t = (r[0].match(/\sTarget="([^"]*)"/) || [, ""])[1];
      if (!t) break;
      t = giaiMaXml(t).replace(/^\/+/, "");
      duong = t.startsWith("xl/") ? t : "xl/" + t;
      break;
    }
  }
  // Dự phòng cho file không có rels hợp lệ — vẫn là đường MISA thực tế dùng.
  if (!duong || !zip.has(duong)) duong = "xl/worksheets/sheet1.xml";
  if (!zip.has(duong)) throw new Error("doc-xlsx: khong thay sheet " + duong);
  return { ten: giaiMaXml(ten), duong };
}

/** Ma trận ô của sheet đầu tiên: `bang[0]` là HÀNG 1 của sheet.
 *
 *  Giá trị ô giữ nguyên kiểu thô: số ra `number` (kể cả ngày — Excel lưu
 *  ngày là số sê-ri, và `gop-ban-hang.mjs::doiNgay` biết đổi), chuỗi ra
 *  `string`, ô trống là `undefined`. CỐ Ý không đọc xl/styles.xml để đoán ô
 *  nào là ngày: bố cục sổ đã cố định (cột 0 là ngày), nên đoán định dạng chỉ
 *  thêm một chỗ có thể sai. */
export function docBangTuXlsx(buf) {
  const zip = moZip(buf);
  const { ten, duong } = duongSheetDau(zip);
  const sst = docChuoiChung(zip.get("xl/sharedStrings.xml")?.toString("utf8"));
  const xml = zip.get(duong).toString("utf8");

  const bang = [];
  const reHang = /<row\s[^>]*?r="(\d+)"[^>]*?>([\s\S]*?)<\/row>|<row\s[^>]*?r="(\d+)"[^>]*?\/>/g;
  const reO = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let mh;
  while ((mh = reHang.exec(xml)) !== null) {
    const soHang = +(mh[1] !== undefined ? mh[1] : mh[3]);
    const than = mh[2];
    const hang = [];
    if (than) {
      reO.lastIndex = 0;
      let mo;
      while ((mo = reO.exec(than)) !== null) {
        const thuocTinh = mo[1], trong = mo[2];
        const r = (thuocTinh.match(/\br="([A-Z]+)\d+"/) || [, null])[1];
        if (r === null) continue;
        const i = soCot(r);
        if (trong === undefined) { hang[i] = undefined; continue; }

        const kieu = (thuocTinh.match(/\bt="([^"]*)"/) || [, "n"])[1];
        if (kieu === "inlineStr") { hang[i] = gomT(trong); continue; }

        const mv = trong.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>|<v(?:\s[^>]*)?\/>/);
        const v = mv ? (mv[1] === undefined ? "" : giaiMaXml(mv[1])) : null;
        if (v === null) { hang[i] = undefined; continue; }

        if (kieu === "s") {
          const k = Number(v);
          /* Chỉ số trỏ ra ngoài bảng chuỗi chung = file hỏng thật. Không thay
             bằng chuỗi rỗng: một ô nhân viên lặng lẽ thành trống sẽ đẩy tiền
             sang "(chưa gán)" mà không ai biết. */
          if (!Number.isInteger(k) || k < 0 || k >= sst.length) {
            throw new Error("doc-xlsx: chi so chuoi chung sai (" + v + ") o hang " + soHang);
          }
          hang[i] = sst[k];
        } else if (kieu === "b") {
          hang[i] = v === "1";
        } else if (kieu === "str" || kieu === "e") {
          hang[i] = v;
        } else {
          const n = Number(v);
          hang[i] = Number.isFinite(n) ? n : v;
        }
      }
    }
    bang[soHang - 1] = hang;
  }
  // Hàng trống hoàn toàn không có <row> → lấp mảng rỗng cho bên gọi khỏi sập.
  for (let i = 0; i < bang.length; i++) if (bang[i] === undefined) bang[i] = [];
  return { ten_sheet: ten, bang };
}
