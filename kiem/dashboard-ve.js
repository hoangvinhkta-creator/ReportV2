/* CHẠY THẬT `public/suc-khoe.js` và soi cái nó vẽ ra.
 *
 * Vì sao cần bộ này, trong khi đã có `kiem/luat-so-1.js` và
 * `kiem/id-co-that.js`: hai bộ kia chỉ ĐỌC mã, không chạy. Mà mọi lỗi đắt
 * nhất của Dashboard cho tới giờ đều là lỗi CHẠY MỚI THẤY, và không thấy
 * được bằng mắt kể cả khi mở trên máy thật:
 *
 *   · đường vẽ quên cộng lề trên → cả chuỗi trôi lên 12px, đọc sai giá trị
 *     theo trục dọc mà biểu đồ trông vẫn bình thường;
 *   · chuỗi chỉ có một điểm → không hiện ra gì cả (chỉ vẽ path, không chấm);
 *   · nhãn trục ngang chọn theo vị trí tuyệt đối → tháng có ngày trống thì
 *     không nhãn nào hiện ra;
 *   · đỉnh trục ép đúng 3 mốc → doanh số 2 tỉ mà trục vẽ tới 3 tỉ.
 *
 * Cách làm: dựng DOM/firebase/fetch/Date giả rồi chạy file thật trong `vm`,
 * bấm qua từng trạng thái đúng như người dùng bấm, và soi chuỗi SVG vẽ ra.
 *
 * Dữ liệu kiểm BỊA HOÀN TOÀN — không có ô nào của sổ thật.
 */
const vm = require('vm');
const path = require('path');
const { GOC, doc, ok, xong } = require('./khung');

const ma = doc('public/suc-khoe.js');

/* ─────────── DOM giả ─────────── */
function elGia(id) {
  const el = {
    id, hidden: false, textContent: '', disabled: false,
    type: '', className: '', con: [], _l: {}, _html: '',
    /* DOM thật: gán innerHTML là THAY luôn con. Stub phải làm y hệt, không
       thì nút của tab cũ còn nằm lại và bài kiểm bấm nhầm vào chúng. */
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = v; el.con = []; },
    addEventListener(ev, fn) { (el._l[ev] ||= []).push(fn); },
    appendChild(c) { el.con.push(c); return c; },
    click() { (el._l.click || []).forEach((f) => f()); },
  };
  return el;
}
const CAY = {};
const layEl = (id) => (CAY[id] ||= elGia(id));
const documentGia = {
  getElementById: (id) => layEl(id),
  createElement: () => elGia(null),
  addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') documentGia._dcl = fn; },
};

/* ─────────── Dữ liệu giả, ĐÚNG hình dạng gopSucKhoeCongTy() trả về ─────────── */
const soNgayCua = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
let DINH_TIEN = 0, DINH_DON = 0;     // giá trị lớn nhất thật, để canh độ dư của trục

function duLieuGia() {
  const theo_ngay_thang = {}, theo_thang = {}, theo_quy = {};
  DINH_TIEN = 0; DINH_DON = 0;
  const themThang = (nam, thang, soNgayCoSo) => {
    const kho = ((theo_ngay_thang[nam] ||= {})[thang] = {});
    let tong = 0, don = 0;
    for (let d = 1; d <= soNgayCoSo; d++) {
      if (d % 7 === 0) continue;                    // ngày nghỉ → lỗ hổng thật trong chuỗi
      /* Ngày 3: bán được đơn nhưng doanh số 0 đ (đơn chiết khấu hết) — ca
         có thật trong sổ, và là chỗ canh đường đáy của trục. */
      const ds = d === 3 ? 0 : 100000 * d + nam;
      const sd = d === 3 ? 0 : (d % 5) + 1;
      kho[d] = {
        doanh_so: ds, so_don: sd,
        khoa: nam + '-' + String(thang).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
      };
      tong += ds; don += sd;
    }
    (theo_thang[nam] ||= {})[thang] = {
      doanh_so: tong, so_don: don, khoa: nam + '-' + String(thang).padStart(2, '0'),
    };
    const q = Math.ceil(thang / 3);
    const oq = ((theo_quy[nam] ||= {})[q] ||= { doanh_so: 0, so_don: 0, khoa: nam + '-Q' + q });
    oq.doanh_so += tong; oq.so_don += don;
  };
  for (let m = 1; m <= 12; m++) themThang(2025, m, soNgayCua(2025, m));
  for (let m = 1; m <= 8; m++) themThang(2026, m, soNgayCua(2026, m));
  themThang(2026, 9, 10);                           // tháng hiện tại mới có 10 ngày
  return {
    theo_ngay_thang, theo_thang, theo_quy,
    cac_nam: [2026, 2025],
    vi_tri_moi_nhat: {
      ngay: { nam: 2026, viTri: 253, khoa: '2026-09-10' },
      thang: { nam: 2026, viTri: 9, khoa: '2026-09' },
      quy: { nam: 2026, viTri: 3, khoa: '2026-Q3' },
      nam: { nam: 2026, viTri: 1, khoa: '2026' },
    },
    /* Ba field Engine còn giữ cho bản giao diện cũ — bản mới KHÔNG đọc, để
       rỗng ở đây chính là phép canh điều đó. */
    theo_ngay: {}, theo_nam: {}, hai_nam: [2026, 2025],
  };
}

/* Giá trị lớn nhất THẬT của một (năm, tháng) trong dữ liệu giả — để biết
   đỉnh trục đang dư bao nhiêu. */
function dinhThat(du, nam, thang) {
  const cua = (n) => Object.values(((du.theo_ngay_thang || {})[n] || {})[thang] || {});
  const het = [...cua(nam), ...cua(nam - 1)];
  return {
    tien: Math.max(0, ...het.map((o) => o.doanh_so)),
    don: Math.max(0, ...het.map((o) => o.so_don)),
  };
}

const HOM_NAY = Date.UTC(2026, 8, 11, 12);          // 11/09/2026, giữa trưa cho chắc múi giờ
class NgayGia extends Date {
  constructor(...a) { if (a.length === 0) super(HOM_NAY); else super(...a); }
}
NgayGia.UTC = Date.UTC;
NgayGia.now = () => HOM_NAY;

let fetchGoi = null, tuChoi = false, cbAuth = null;
const ctx = {
  document: documentGia, Date: NgayGia, console, setTimeout, clearTimeout,
  fetch: async (url, opts) => {
    fetchGoi = { url, opts };
    if (tuChoi) {
      return { ok: false, status: 503, json: async () => ({ loi: 'Hệ thống tạm thời chưa phục vụ được.' }) };
    }
    return { ok: true, json: async () => duLieuGia() };
  },
  firebase: { auth: () => ({ onAuthStateChanged: (fn) => { cbAuth = fn; } }) },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(ma, ctx, { filename: 'public/suc-khoe.js' });

const nghi = () => new Promise((r) => setTimeout(r, 0));
const NGUOI = { getIdToken: async () => 'tok-gia' };
const veHtml = () => CAY.skVe.innerHTML;
const nutPhu = () => CAY.skDaiPhu.con;
const nutTab = () => CAY.skTabDonVi.con;

/** Cắt riêng một trong hai SVG theo aria-label. */
const svgCua = (ten) => veHtml().split('<svg').slice(1)
  .map((s) => '<svg' + s.split('</svg>')[0])
  .find((s) => s.includes('aria-label="' + ten)) || '';

const nhanDoc = (svg) => [...svg.matchAll(/text-anchor="end">([^<]*)</g)].map((m) => m[1]);
const soTu = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const soCham = (svg) => (svg.match(/<circle/g) || []).length;

function soiRac(nhan) {
  const h = veHtml();
  ok(nhan + ': không NaN/undefined/Infinity trong SVG',
     /NaN|undefined|Infinity/.test(h), false);
}

/** Hình học trục dọc của MỘT biểu đồ. */
function kiemTruc(ten, coChamKhong) {
  const svg = svgCua(ten);
  const yLuoi = [...svg.matchAll(/<line [^>]*y1="([\d.]+)"/g)].map((m) => +m[1]);
  const yCham = [...svg.matchAll(/<circle [^>]*cy="([\d.]+)"/g)].map((m) => +m[1]);
  if (!yLuoi.length || !yCham.length) { ok(ten + ': có lưới và có chấm', false, true); return; }
  const tren = Math.min(...yLuoi), day = Math.max(...yLuoi);
  ok(ten + ': mọi chấm nằm trong khung vẽ',
     yCham.every((y) => y >= tren - 0.6 && y <= day + 0.6), true);
  /* Chấm giá trị 0 phải nằm ĐÚNG trên đường đáy. Đây là phép bắt lỗi "quên
     cộng lề trên": quên thì cả chuỗi trôi lên đúng bằng lề, chấm 0 rời khỏi
     đáy — mà biểu đồ vẫn trông bình thường. */
  if (coChamKhong) {
    ok(ten + ': chấm giá trị 0 nằm đúng đường đáy',
       Math.abs(Math.max(...yCham) - day) < 0.6, true);
  }
}

/** Mốc trục dọc: đủ, không trùng, và KHÔNG DƯ QUÁ NHIỀU so với số thật. */
function kiemMoc(ten, gtThat, doiSo) {
  const nhan = nhanDoc(svgCua(ten));
  ok(ten + ': có 4..6 mốc trục dọc', nhan.length >= 4 && nhan.length <= 6, true);
  ok(ten + ': không mốc nào trùng nhau (' + nhan.join(' | ') + ')',
     new Set(nhan).size === nhan.length, true);
  const dinh = soTu(nhan[nhan.length - 1]) * doiSo;
  ok(ten + ': đỉnh trục KHÔNG thấp hơn số thật', dinh >= gtThat, true);
  /* Trần 34%: bản ép 3 mốc dư tới 50% và chủ dự án nhận ra ngay bằng mắt
     ("doanh số ~2 tỉ mà trục vẽ tới 3 tỉ"). 34% là ca xấu nhất mà bộ bước
     chia 1/2/2,5/5 còn có thể rơi vào. */
  ok(ten + ': đỉnh trục dư không quá 34% (' + Math.round((dinh / gtThat - 1) * 100) + '%)',
     gtThat > 0 ? dinh <= gtThat * 1.34 : true, true);
}

(async () => {
  ok('script đăng ký DOMContentLoaded', typeof documentGia._dcl === 'function', true);
  documentGia._dcl();
  ok('script đăng ký onAuthStateChanged', typeof cbAuth === 'function', true);

  console.log('\n1) Đăng nhập → dựng khung vào đúng ô #o-dashboard, gọi đúng endpoint');
  {
    cbAuth(NGUOI);
    await nghi(); await nghi(); await nghi();
    const khung = CAY['o-dashboard'].innerHTML;
    ok('khung được ghi vào ô P3 chừa sẵn',
       /skTabDonVi/.test(khung) && /skVe/.test(khung) && /skDaiPhu/.test(khung), true);
    ok('gọi đúng /api/bao-cao/suc-khoe', fetchGoi && fetchGoi.url, '/api/bao-cao/suc-khoe');
    ok('có kèm Bearer token', (fetchGoi.opts.headers || {}).Authorization, 'Bearer tok-gia');
  }

  console.log('\n2) HAI biểu đồ riêng, KHÔNG gộp hai trục dọc vào một khung');
  {
    ok('đúng hai <svg>', (veHtml().match(/<svg/g) || []).length, 2);
    ok('có biểu đồ Doanh số', !!svgCua('Doanh số'), true);
    ok('có biểu đồ Số đơn', !!svgCua('Số đơn'), true);
    ok('tiêu đề ghi rõ đơn vị từng biểu đồ',
       /Doanh số theo ngày[^<]*<span class="donViCua">\(nghìn đồng\)/.test(veHtml())
       && /Số đơn theo ngày[^<]*<span class="donViCua">\(đơn\)/.test(veHtml()), true);
    ok('chỉ MỘT chú giải cho cả hai', (veHtml().match(/chuGiaiSk/g) || []).length, 1);
  }

  console.log('\n3) Hai biểu đồ vẽ HAI chuỗi khác nhau, không phải cùng một chuỗi');
  {
    const that = dinhThat(duLieuGia(), 2026, 9);
    const dinhTien = soTu(nhanDoc(svgCua('Doanh số')).pop());
    const dinhDon = soTu(nhanDoc(svgCua('Số đơn')).pop());
    ok('đỉnh trục Doanh số là số lớn (nghìn đồng)', dinhTien > 100, true);
    ok('đỉnh trục Số đơn là số nhỏ (đơn)', dinhDon > 0 && dinhDon < 100, true);
    kiemMoc('Doanh số', that.tien, 1000);
    kiemMoc('Số đơn', that.don, 1);
    ok('mốc trục Số đơn đều là số nguyên',
       nhanDoc(svgCua('Số đơn')).every((s) => Number.isInteger(soTu(s))), true);
  }

  console.log('\n4) Mặc định: tab Ngày, ĐÚNG tháng hiện tại (11/09/2026 → T9/2026)');
  {
    ok('ba tab đơn vị', nutTab().map((n) => n.textContent), ['Ngày', 'Tháng', 'Quý']);
    ok('tab Ngày đang chọn', nutTab()[0].className.includes('tabDang'), true);
    ok('tiêu đề nói đúng tháng 9/2026', /tháng 9\/2026/.test(veHtml()), true);
    soiRac('tab Ngày');
    kiemTruc('Doanh số', true);
    kiemTruc('Số đơn', true);
  }

  console.log('\n5) Dải phụ tab Ngày = 12 tháng; tháng chưa có số thì bấm không được');
  {
    ok('đúng 12 nút', nutPhu().length, 12);
    ok('nhãn T1…T12', [nutPhu()[0].textContent, nutPhu()[11].textContent], ['T1', 'T12']);
    ok('T9 đang chọn', nutPhu()[8].className.includes('tabDang'), true);
    /* Tháng không có số vẫn HIỆN nhưng tắt: ẩn hẳn thì người xem tưởng báo
       cáo thiếu tháng, còn cho bấm thì chỉ mở ra một biểu đồ trắng. */
    ok('T10/2026 chưa có số → tắt', nutPhu()[9].disabled, true);
    ok('T8/2026 có số → bấm được', nutPhu()[7].disabled, false);
  }

  console.log('\n6) Bấm T2 → vẽ lại đúng tháng 2, KHÔNG gọi lại API');
  {
    fetchGoi = null;
    nutPhu()[1].click();
    ok('không gọi API lần hai (dữ liệu đã nhớ)', fetchGoi, null);
    ok('cả hai biểu đồ đổi sang tháng 2/2026',
       svgCua('Doanh số').includes('tháng 2/2026') && svgCua('Số đơn').includes('tháng 2/2026'), true);
    /* 2026 không nhuận: trục phải dừng ở 28, không chừa chỗ trống tới 31. */
    ok('trục ngang dừng ở 28, không chừa tới 31',
       /text-anchor="middle">28</.test(veHtml()) && !/text-anchor="middle">3[01]</.test(veHtml()), true);
    soiRac('tab Ngày T2');
    kiemTruc('Doanh số', true);
    kiemTruc('Số đơn', true);
  }

  console.log('\n7) Tab Tháng → dải phụ đổi thành các NĂM');
  {
    nutTab()[1].click();
    ok('dải phụ = các năm có số', nutPhu().map((n) => n.textContent), ['2026', '2025']);
    ok('2026 đang chọn', nutPhu()[0].className.includes('tabDang'), true);
    ok('cả hai biểu đồ nói năm 2026',
       svgCua('Doanh số').includes('theo tháng · năm 2026')
       && svgCua('Số đơn').includes('theo tháng · năm 2026'), true);
    ok('trục ngang T1…T12', /">T1</.test(veHtml()) && /">T12</.test(veHtml()), true);
    soiRac('tab Tháng');
    kiemTruc('Doanh số', false);
  }

  console.log('\n8) Đổi sang năm 2025 — 2024 không có số');
  {
    nutPhu()[1].click();
    ok('tiêu đề đổi sang 2025', /theo tháng · năm 2025/.test(veHtml()), true);
    /* Chú giải không được kể tên một đường không hề được vẽ — người xem sẽ
       đi tìm đường xám đó rồi tưởng biểu đồ hỏng. */
    ok('năm trước không có số → chú giải KHÔNG kể Năm 2024', /Năm 2024/.test(veHtml()), false);
    ok('mỗi biểu đồ chỉ vẽ MỘT đường', (veHtml().match(/<path/g) || []).length, 2);
    nutTab()[0].click();
    ok('tab Ngày giữ nguyên năm 2025', /tháng \d+\/2025/.test(veHtml()), true);
    ok('2025 có đủ 12 tháng bấm được', nutPhu().filter((n) => !n.disabled).length, 12);
    soiRac('tab Ngày 2025');
  }

  console.log('\n9) Tab Quý → không có dải phụ');
  {
    nutTab()[1].click(); nutPhu()[0].click();        // về lại năm 2026
    nutTab()[2].click();
    ok('dải phụ rỗng', nutPhu().length === 0 && CAY.skDaiPhu.innerHTML === '', true);
    ok('trục ngang Q1…Q4', /">Q1</.test(veHtml()) && /">Q4</.test(veHtml()), true);
    /* 2026 mới có số tới tháng 9 → chỉ Q1..Q3; 2025 đủ Q1..Q4. Quý CHƯA TỚI
       không được vẽ một chấm 0 đ — đó là bịa ra một quý không tồn tại. */
    ok('3 quý (2026) + 4 quý (2025) = 7 chấm mỗi biểu đồ',
       soCham(svgCua('Doanh số')) === 7 && soCham(svgCua('Số đơn')) === 7, true);
    soiRac('tab Quý');
    kiemTruc('Doanh số', false);
  }

  console.log('\n10) Rê chuột đọc được số ĐẦY ĐỦ, không phải số đã làm gọn');
  {
    nutTab()[1].click();
    const mau = /<title>[^<]*\d\.\d{3}[^<]*đ[^<]*đơn<\/title>/;
    ok('cả hai biểu đồ đều có <title> ghi đủ tiền và số đơn',
       mau.test(svgCua('Doanh số')) && mau.test(svgCua('Số đơn')), true);
  }

  console.log('\n11) API lỗi → báo lỗi, KHÔNG vẽ số giả');
  {
    tuChoi = true;
    cbAuth(null);                                    // đăng xuất
    cbAuth(NGUOI);                                   // đăng nhập lại
    await nghi(); await nghi(); await nghi();
    ok('hiện câu lỗi của máy chủ',
       /Hệ thống tạm thời chưa phục vụ được/.test(CAY.skLoi.textContent), true);
    ok('không còn biểu đồ cũ nằm lại', /<svg/.test(veHtml()), false);
    ok('dải phụ cũng dọn sạch', CAY.skDaiPhu.innerHTML, '');
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
