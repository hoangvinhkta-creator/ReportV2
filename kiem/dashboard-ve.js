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
    /* Hình học: mặc định RỖNG (0 / null) đúng như một DOM giả không bố cục,
       nên `canhCaoKhoi()` của file thật tự thoát sớm và mọi mục kiểm khác
       chạy y như trước. Mục "hai cột cùng chiều cao" bật chúng lên bằng tay
       để soi đúng phép đo — thứ không mục nào khác thấy được. */
    style: {}, _hop: null, _cha: null, _w: 0, _h: 0,
    getBoundingClientRect() { return el._hop; },
    get parentElement() { return el._cha; },
    get clientWidth() { return typeof el._w === 'function' ? el._w() : el._w; },
    get clientHeight() { return typeof el._h === 'function' ? el._h() : el._h; },
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
    line: LINE_GIA,
  };
}

/* Khối xếp hạng Line. Dựng tay với số CỐ ĐỊNH, không suy từ chuỗi ngày ở
   trên — bài kiểm phải biết trước thứ hạng đúng là gì thì mới canh được
   thứ tự sắp xếp. "Khác" cố tình để doanh số CAO NHẤT: chủ dự án chốt nó
   luôn xếp cuối, nên đây là ca bắt lỗi "sắp thuần theo giá trị". */
const LINE_GIA = {
  thu_tu: ['Nội thành', 'Tín Phát', 'Shopee', 'Khác'],
  theo_thang: {
    /* Nội thành: có LỖ HỔNG ở tháng 4-6 (nhân viên nghỉ rồi bán lại) — canh
       việc lưới nhỏ NGẮT đoạn chứ không vẽ liền một đường giả qua đó. */
    'Nội thành': {
      2026: {
        1: { doanh_so: 100, so_don: 1, khoa: '2026-01' },
        2: { doanh_so: 150, so_don: 2, khoa: '2026-02' },
        3: { doanh_so: 200, so_don: 2, khoa: '2026-03' },
        7: { doanh_so: 300, so_don: 3, khoa: '2026-07' },
        /* so_don CỐ Ý cao (50, không phải 5) — chỉ số này khi đổi sang tab
           "Số đơn" phải đưa Nội thành VƯỢT Tín Phát về thứ hạng, để canh
           việc lưới nhỏ SẮP LẠI theo đúng chỉ số đang xem, không kẹt theo
           thứ hạng doanh số đã tính từ lúc mở màn. */
        9: { doanh_so: 500, so_don: 50, khoa: '2026-09' },
      },
      2025: { 9: { doanh_so: 400, so_don: 4, khoa: '2025-09' } },
    },
    /* Tín Phát: ĐỦ tháng 1-9, không lỗ hổng — ca "đường bình thường". */
    'Tín Phát': {
      2026: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1,
        { doanh_so: 100 * (i + 1) + 800, so_don: i + 1, khoa: '2026-' + String(i + 1).padStart(2, '0') }])),
    },
    Shopee: {},   // chưa có số năm nào — ca "Chưa có số năm 2026"
    'Khác': { 2026: { 9: { doanh_so: 9999, so_don: 99, khoa: '2026-09' } } },   // MỘT tháng duy nhất
  },
  /* NGÀY × LINE — trường mới của P6, nguồn cho lưới nhỏ khi biểu đồ trái
     đang ở [Ngày]. Cùng hình dạng `theo_ngay_thang` của toàn công ty:
     line → năm → tháng → ngày. Cố ý để Nội thành có LỖ HỔNG (ngày 3 và 4
     không bán) để canh việc ngắt đoạn ở mức ngày y như ở mức tháng. */
  theo_ngay_thang: {
    'Nội thành': { 2026: { 9: {
      1: { doanh_so: 100, so_don: 1, khoa: '2026-09-01' },
      2: { doanh_so: 150, so_don: 2, khoa: '2026-09-02' },
      5: { doanh_so: 250, so_don: 47, khoa: '2026-09-05' },
    } } },
    'Tín Phát': { 2026: { 9: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1,
      { doanh_so: 100 * (i + 1), so_don: i + 1, khoa: '2026-09-0' + (i + 1) }])) } },
    Shopee: {},
    'Khác': { 2026: { 9: { 3: { doanh_so: 9999, so_don: 99, khoa: '2026-09-03' } } } },
  },
  theo_nam: {
    'Nội thành': { 2026: { doanh_so: 5000, so_don: 50 }, 2025: { doanh_so: 4000, so_don: 40 } },
    'Tín Phát': { 2026: { doanh_so: 9000, so_don: 90 } },
    Shopee: {},
    'Khác': { 2026: { doanh_so: 99999, so_don: 999 } },
  },
  tom_tat: { doanh_so_tong: 0, so_don_tong: 0, khop_tong: true },
};

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
  /* `window.addEventListener` — file thật nghe `resize` để đo lại chỗ còn
     lại của màn hình. DOM giả không có hình học nên phép đo tự bỏ qua
     (`canhCaoKhoi` thoát sớm khi `innerHeight` vắng mặt), nhưng nếu thiếu
     hẳn hàm này thì cả file không nạp nổi. */
  addEventListener: () => {},
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
/* "Nạp lại từ đầu": đăng xuất rồi đăng nhập lại. Phải báo kỳ kèm theo —
   đăng xuất quên cả kỳ đang xem, và người sau đăng nhập vào cùng trình
   duyệt không được tự động kéo về số của người trước. */
const napLai = () => { cbAuth(null); cbAuth(NGUOI); ctx.SucKhoe.datKy('2026-09'); };
const veHtml = () => CAY.skVe.innerHTML;
/* Từ P6 kỳ KHÔNG còn chọn trong khối này — màn báo cáo báo sang. */
const datKy = (ky) => ctx.SucKhoe.datKy(ky);
const nutTab = () => CAY.skTabDonVi.con;
const nutChiSo = () => CAY.skTabChiSo.con;

/** Cắt riêng một trong hai SVG theo aria-label. */
const svgCua = (ten) => veHtml().split('<svg').slice(1)
  .map((s) => '<svg' + s.split('</svg>')[0])
  .find((s) => s.includes('aria-label="' + ten)) || '';

const nhanDoc = (svg) => [...svg.matchAll(/text-anchor="end">([^<]*)</g)].map((m) => m[1]);
/* Đọc ngược nhãn trục thành số. Từ 12/09/2026 nhãn tiền viết GỌN ("2B" =
   2 tỷ đồng, "500M" = 500 triệu) để lấy lại bề ngang cho hình vẽ — nên phép
   đọc ngược phải biết ba hậu tố ấy, nếu không mọi bài canh đỉnh trục đọc ra
   số 2 thay vì 2.000.000.000 và đỏ hàng loạt. */
const soTu = (s) => {
  const t = String(s).trim();
  const he = { B: 1e9, M: 1e6, K: 1e3 }[t.slice(-1)] || 1;
  const n = Number((he === 1 ? t : t.slice(0, -1)).replace(/\./g, '').replace(',', '.'));
  return n * he;
};
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

  console.log('\n1) Đăng nhập KHÔNG tự tải — chỉ khi màn báo cáo báo kỳ sang');
  {
    /* Tab [Biểu đồ] đã bỏ (P6), nên cửa hoãn-tải không còn là `moTab()` mà
       là `datKy()`. Lý do hoãn thì KHÔNG đổi: gọi API ngay lúc đăng nhập là
       kéo `bc/ky` của cả hai năm về trước khi biết người dùng xem kỳ nào —
       và ở màn Nhập sổ thì không ai xem biểu đồ cả. */
    cbAuth(NGUOI);
    await nghi(); await nghi(); await nghi();
    ok('đăng nhập xong CHƯA gọi API nào', fetchGoi, null);
    ok('  · và chưa ghi gì vào ô #o-dashboard',
       CAY['o-dashboard'] ? CAY['o-dashboard'].innerHTML : '', '');

    /* Hai cửa vào DUY NHẤT giữa màn báo cáo (don-hang.js) và file này. */
    ok('có cửa vào window.SucKhoe.datKy()', typeof (ctx.SucKhoe || {}).datKy, 'function');
    ok('có cửa vào window.SucKhoe.hien()', typeof (ctx.SucKhoe || {}).hien, 'function');
    ok('cửa cũ moTab() đã bỏ', typeof (ctx.SucKhoe || {}).moTab, 'undefined');

    datKy('2026-09');
    await nghi(); await nghi(); await nghi();

    const khung = CAY['o-dashboard'].innerHTML;
    ok('báo kỳ → khung được ghi vào ô màn báo cáo chừa sẵn',
       /skTabDonVi/.test(khung) && /skTabChiSo/.test(khung) && /skVe/.test(khung)
       && /skLuoiNho/.test(khung), true);
    ok('  · và KHÔNG còn dải nút phụ (kỳ do màn báo cáo chọn)',
       /skDaiPhu/.test(khung), false);
    ok('  · hai cột: biểu đồ trái, lưới nhỏ phải', /haiCotBieuDo/.test(khung), true);
    ok('gọi đúng /api/bao-cao/suc-khoe', fetchGoi && fetchGoi.url, '/api/bao-cao/suc-khoe');
    ok('có kèm Bearer token', (fetchGoi.opts.headers || {}).Authorization, 'Bearer tok-gia');

    /* Đổi line hay vẽ lại bảng đều báo kỳ sang lần nữa — mỗi lần thêm một
       lượt gọi thì hoãn tải chẳng giải quyết được gì. */
    fetchGoi = null;
    datKy('2026-09');
    await nghi(); await nghi();
    ok('báo lại CÙNG kỳ KHÔNG gọi API lần nữa', fetchGoi, null);

    /* `onAuthStateChanged` còn nổ lại mỗi lần token tự làm mới. */
    cbAuth(NGUOI);
    await nghi(); await nghi();
    ok('token tự làm mới KHÔNG kéo thêm lượt gọi', fetchGoi, null);

    /* Ẩn/hiện cả khối — chỉ tab [Tổng hợp] mới có biểu đồ. */
    ctx.SucKhoe.hien(false);
    ok('hien(false) ẩn cả khối', CAY['o-dashboard'].hidden, true);
    ctx.SucKhoe.hien(true);
    ok('hien(true) mở lại', CAY['o-dashboard'].hidden, false);
  }

  console.log('\n2) MỘT biểu đồ mỗi lúc, hai tab chuyển Doanh số ↔ Số đơn');
  {
    /* Chủ dự án chốt 12/09/2026 gộp hai biểu đồ vào một khung. Trước đây vẽ
       cả hai chồng dọc — khối cao gấp đôi và đẩy lưới nhỏ xuống dưới màn. */
    ok('chỉ MỘT <svg> trong cột trái', (veHtml().match(/<svg/g) || []).length, 1);
    ok('mặc định là Doanh số', !!svgCua('Doanh số'), true);
    ok('KHÔNG vẽ kèm Số đơn', !!svgCua('Số đơn'), false);
    /* Tiêu đề nay ở DẢI ĐIỀU KHIỂN, ngang hàng với [Ngày][Tháng][Quý] (chủ
       dự án chốt 12/09/2026) — nó vốn chiếm riêng một dòng ngay trên hình. */
    ok('tiêu đề KHÔNG còn nằm trong ô vẽ', /tieuDeSk/.test(veHtml()), false);
    ok('  · mà ở dải điều khiển, ghi rõ đơn vị',
       /Doanh số theo ngày[^<]*<span class="donViCua">\(nghìn đồng\)/.test(
         CAY.skTieuDe.innerHTML), true);
    /* Chú giải nay nằm ở dải điều khiển (mép phải), không còn là một hàng
       riêng dưới biểu đồ — chủ dự án chốt 12/09/2026 để lấy lại một dòng
       chiều cao. Nên nó KHÔNG còn trong `#skVe`. */
    ok('chú giải KHÔNG còn nằm trong ô vẽ', /chuGiaiSk/.test(veHtml()), false);
    ok('  · mà ở dải điều khiển, đúng một lần',
       (CAY.skChuGiai.innerHTML.match(/chuGiaiSk/g) || []).length, 1);
    ok('  · và kể đủ hai kỳ', /Năm 2026[\s\S]*Năm 2025/.test(CAY.skChuGiai.innerHTML), true);

    ok('hai nút chỉ số, Doanh số đang chọn',
       nutChiSo().map((n) => n.textContent + (n.className.includes('tabDang') ? '*' : '')),
       ['Doanh số*', 'Số đơn']);
  }

  console.log('\n3) Đổi sang [Số đơn] → cùng khung vẽ CHUỖI KHÁC, không phải cùng chuỗi');
  {
    const that = dinhThat(duLieuGia(), 2026, 9);
    const dinhTien = soTu(nhanDoc(svgCua('Doanh số')).pop());
    kiemMoc('Doanh số', that.tien, 1);

    nutChiSo()[1].click();
    ok('giờ vẽ Số đơn', !!svgCua('Số đơn'), true);
    ok('  · và KHÔNG còn Doanh số', !!svgCua('Doanh số'), false);
    const dinhDon = soTu(nhanDoc(svgCua('Số đơn')).pop());
    ok('đỉnh trục Doanh số là số lớn (đồng)', dinhTien > 1e6, true);
    ok('đỉnh trục Số đơn là số nhỏ (đơn)', dinhDon > 0 && dinhDon < 100, true);
    kiemMoc('Số đơn', that.don, 1);
    ok('mốc trục Số đơn đều là số nguyên',
       nhanDoc(svgCua('Số đơn')).every((s) => Number.isInteger(soTu(s))), true);
    nutChiSo()[0].click();
  }

  console.log('\n4) Mặc định: tab Ngày, ĐÚNG kỳ màn báo cáo đang mở');
  {
    ok('ba tab đơn vị', nutTab().map((n) => n.textContent), ['Ngày', 'Tháng', 'Quý']);
    ok('tab Ngày đang chọn', nutTab()[0].className.includes('tabDang'), true);
    /* Kỳ KHÔNG còn do khối này tự đoán — nó lấy đúng cái màn báo cáo báo
       sang. Hai chỗ cùng đoán một mặc định là hai chỗ sẽ đoán lệch nhau. */
    ok('tiêu đề nói đúng tháng 9/2026', /tháng 9\/2026/.test(veHtml()), true);
    soiRac('tab Ngày');
    kiemTruc('Doanh số', true);
  }

  console.log('\n5) Màn báo cáo đổi sang T2 → biểu đồ đổi theo, KHÔNG gọi lại API');
  {
    fetchGoi = null;
    datKy('2026-02');
    ok('không gọi API lần hai (dữ liệu đã nhớ)', fetchGoi, null);
    ok('biểu đồ đổi sang tháng 2/2026', svgCua('Doanh số').includes('tháng 2/2026'), true);
    /* 2026 không nhuận: trục phải dừng ở 28, không chừa chỗ trống tới 31. */
    ok('trục ngang dừng ở 28, không chừa tới 31',
       /text-anchor="middle">28</.test(veHtml()) && !/text-anchor="middle">3[01]</.test(veHtml()), true);
    soiRac('tab Ngày T2');
    kiemTruc('Doanh số', true);
    datKy('2026-09');
  }

  console.log('\n6) Tab Tháng → 12 tháng của NĂM đang chọn');
  {
    nutTab()[1].click();
    ok('biểu đồ nói năm 2026', svgCua('Doanh số').includes('theo tháng · năm 2026'), true);
    ok('trục ngang T1…T12', /">T1</.test(veHtml()) && /">T12</.test(veHtml()), true);
    soiRac('tab Tháng');
    kiemTruc('Doanh số', false);
  }

  console.log('\n7) Màn báo cáo đổi sang năm 2025 — 2024 không có số');
  {
    datKy('2025-09');
    ok('tiêu đề đổi sang 2025', /theo tháng · năm 2025/.test(veHtml()), true);
    /* Chú giải không được kể tên một đường không hề được vẽ — người xem sẽ
       đi tìm đường xám đó rồi tưởng biểu đồ hỏng. */
    ok('năm trước không có số → chú giải KHÔNG kể Năm 2024',
       /Năm 2024/.test(CAY.skChuGiai.innerHTML), false);
    ok('chỉ vẽ MỘT đường', (veHtml().match(/<path/g) || []).length, 1);
    nutTab()[0].click();
    ok('tab Ngày giữ nguyên kỳ 9/2025', /tháng 9\/2025/.test(veHtml()), true);
    soiRac('tab Ngày 2025');
    datKy('2026-09');
  }

  console.log('\n8) Tab Quý → 4 quý của năm đang chọn');
  {
    nutTab()[2].click();
    ok('trục ngang Q1…Q4', /">Q1</.test(veHtml()) && /">Q4</.test(veHtml()), true);
    /* 2026 mới có số tới tháng 9 → chỉ Q1..Q3; 2025 đủ Q1..Q4. Quý CHƯA TỚI
       không được vẽ một chấm 0 đ — đó là bịa ra một quý không tồn tại.
       +2 là hai chấm "TB" (trung bình) — cả hai kỳ đều có số. */
    ok('3 quý (2026) + 4 quý (2025) + 2 chấm TB = 9 chấm', soCham(svgCua('Doanh số')), 9);
    soiRac('tab Quý');
    kiemTruc('Doanh số', false);
    nutTab()[0].click();
  }

  console.log('\n9) Rê chuột đọc được số ĐẦY ĐỦ, không phải số đã làm gọn');
  {
    nutTab()[1].click();
    const mau = /<title>[^<]*\d\.\d{3}[^<]*đ[^<]*đơn<\/title>/;
    ok('biểu đồ có <title> ghi đủ tiền và số đơn', mau.test(svgCua('Doanh số')), true);
    nutChiSo()[1].click();
    ok('  · đổi sang Số đơn vẫn vậy', mau.test(svgCua('Số đơn')), true);
    nutChiSo()[0].click();
  }

  console.log('\n9b) Chấm "TB" (trung bình) trên biểu đồ đường');
  {
    nutTab()[0].click();
    datKy('2026-09');                                 // cả hai kỳ đều có số
    const tien = svgCua('Doanh số');
    ok('có nhãn "TB"', tien.includes('>TB<'), true);
    ok('có 2 chấm TB (kỳ này + kỳ trước) — bán kính 4, viền trắng',
       (tien.match(/r="4" fill="[^"]+" stroke="#fff"/g) || []).length === 2, true);
    ok('title chấm TB ghi rõ "Trung bình mỗi ngày" kèm tên kỳ và tiền ĐÃ LÀM TRÒN về đồng',
       /<title>Trung bình mỗi ngày · Tháng 9\/2026: [\d.]+ đ<\/title>/.test(tien), true);
    nutChiSo()[1].click();
    ok('title chấm TB của Số đơn ghi số có phần lẻ (không làm tròn về nguyên)',
       /<title>Trung bình mỗi ngày · Tháng 9\/2026: \d+[,.]?\d* đơn<\/title>/.test(svgCua('Số đơn')), true);
    nutChiSo()[0].click();
  }

  console.log('\n9c) Chấm TB biến mất đúng cách khi kỳ trước không có số (2024 không tồn tại)');
  {
    nutTab()[1].click();                              // tab Tháng
    datKy('2025-09');                                 // diemNay đủ 12 tháng, diemTruoc (2024) rỗng
    const svg = svgCua('Doanh số');
    ok('kỳ trước (2024) không có số → chỉ 1 chấm TB, không ném lỗi',
       (svg.match(/r="4" fill="[^"]+" stroke="#fff"/g) || []).length === 1
       && !/NaN|undefined/.test(svg), true);
    ok('chấm TB còn lại đúng là của kỳ này (năm 2025), không phải kỳ trước',
       svg.includes('<title>Trung bình mỗi tháng · Năm 2025:'), true);
    nutTab()[0].click(); datKy('2026-09');            // dọn về T9/2026 cho mục sau
  }

  console.log('\n10) Lưới nhỏ — xu hướng theo Line, ĐỒNG BỘ với biểu đồ bên trái');
  {
    // Đưa trạng thái về T9/2026, chỉ số Doanh số (mặc định) trước khi kiểm.
    napLai();
    await nghi(); await nghi(); await nghi();

    const tieuDe = () => CAY.skLuoiNho.innerHTML;
    const luoi = () => CAY.skLuoiNho.innerHTML;
    const miniCua = (ten) => luoi().split('<svg').slice(1).map((s) => '<svg' + s.split('</svg>')[0])
      .find((s) => s.includes('aria-label="Xu hướng ' + ten + '"')) || '';
    const tenTheoThuTu = () => [...luoi().matchAll(/class="tenMini">([^<]*)</g)].map((m) => m[1]);
    const dCua = (svg) => (svg.match(/<path[^>]*d="([^"]*)"/) || [, ''])[1];

    /* ── Mặc định [Ngày]: lưới phải vẽ theo NGÀY của đúng tháng biểu đồ trái
       đang vẽ. Đây là điều kiện chính của bố cục mới — chủ dự án chốt
       12/09/2026 "cụm này cũng thể hiện khung thời gian, kiểu biểu đồ đồng
       bộ với biểu đồ trên". */
    ok('tiêu đề nói đúng khung thời gian của biểu đồ trái (theo ngày · tháng 9/2026)',
       /Xu hướng theo Line · theo ngày · tháng 9\/2026/.test(tieuDe()), true);
    ok('  · và đúng đơn vị đang xem', /<span class="donViCua">\(nghìn đồng\)/.test(tieuDe()), true);
    /* Từ 12/09/2026 cụm bỏ hai nhóm: line KHÔNG có số nào trong kỳ (một ô
       ghi "chưa có số" không phải một xu hướng, nó chỉ chiếm chỗ của ô có số
       thật) và line GOM đứng cuối bảng ("Khác" — một rổ nhiều tên rời rạc
       nên đường của nó không nói lên gì, và bỏ ra thì số ô còn lại chẵn).
       Bảng [Tổng hợp] VẪN giữ "Khác": ở đó nó là một dòng tiền có thật. */
    ok('chỉ còn ô của line CÓ số', tenTheoThuTu().slice().sort(), ['Nội thành', 'Tín Phát']);
    ok('  · Shopee (chưa có số) bị bỏ', tenTheoThuTu().includes('Shopee'), false);
    ok('  · "Khác" (line gom, cuối bảng) cũng bị bỏ', tenTheoThuTu().includes('Khác'), false);
    ok('  · và KHÔNG còn ô rỗng nào', /oMiniRong/.test(luoi()), false);
    /* Số cột do JS chốt, để lưới chia ít hàng mà ô không quá hẹp. */
    ok('lưới được gán số cột tường minh',
       /grid-template-columns:repeat\(\d+,1fr\)/.test(luoi()), true);
    ok('không NaN/undefined/Infinity', /NaN|undefined|Infinity/.test(luoi()), false);

    /* KHÔNG còn bộ chọn chỉ số RIÊNG của lưới — nó dùng chung hàng tab với
       biểu đồ trái. Hai khối cạnh nhau nói hai chỉ số khác nhau là chuyện
       chấp nhận được khi chúng ở hai màn, không chấp nhận được khi chúng
       nằm sát nhau. */
    ok('lưới KHÔNG có hàng tab chỉ số riêng', /skLuoiChiSo/.test(luoi()), false);

    console.log('    (Nội thành bán ngày 1, 2, 5 — lỗ hổng 3-4 phải NGẮT đoạn)');
    const ntSvg = miniCua('Nội thành');
    ok('có vẽ biểu đồ cho Nội thành', !!ntSvg, true);
    ok('đường Nội thành tách thành 2 đoạn (1-2, rồi 5 lẻ)',
       (dCua(ntSvg).match(/M/g) || []).length, 2);

    console.log('    (Tín Phát đủ ngày 1-5 — đường liền MỘT đoạn)');
    ok('đường Tín Phát chỉ MỘT đoạn', (dCua(miniCua('Tín Phát')).match(/M/g) || []).length, 1);
    ok('rê chuột đọc được tên line, ngày/tháng/năm và tiền đầy đủ',
       /<title>Tín Phát · 5\/09\/2026: [\d.]+ đ<\/title>/.test(miniCua('Tín Phát')), true);

    /* ── Đổi CHỈ SỐ ở hàng tab CHUNG: cả hai khối phải đổi theo. */
    console.log('    (đổi qua "Số đơn" — Nội thành (50 đơn) vượt Tín Phát (15 đơn))');
    nutChiSo()[1].click();
    ok('biểu đồ TRÁI đổi sang Số đơn', !!svgCua('Số đơn'), true);
    ok('  · lưới PHẢI cũng đổi theo', /<span class="donViCua">\(đơn\)/.test(tieuDe()), true);
    ok('  · và thứ hạng đổi theo chỉ số', tenTheoThuTu(), ['Nội thành', 'Tín Phát']);
    nutChiSo()[0].click();

    /* ── Đổi ĐƠN VỊ sang [Tháng]: lưới chuyển sang 12 tháng của năm. */
    console.log('    (đổi qua đơn vị [Tháng] — lưới chuyển sang 12 tháng của năm)');
    nutTab()[1].click();
    ok('tiêu đề lưới đổi theo', /Xu hướng theo Line · theo tháng · năm 2026/.test(tieuDe()), true);
    ok('Nội thành ở mức tháng tách 3 đoạn (1-2-3, 7, 9) vì lỗ hổng 4-6 và 8',
       (dCua(miniCua('Nội thành')).match(/M/g) || []).length, 3);
    ok('rê chuột ở mức tháng đọc đúng nhãn tháng',
       /<title>Tín Phát · Tháng 9\/2026: [\d.]+ đ<\/title>/.test(miniCua('Tín Phát')), true);
    ok('ở mức tháng cũng chỉ còn line CÓ số, không có "Khác"',
       tenTheoThuTu(), ['Tín Phát', 'Nội thành']);

    /* ── Đơn vị [Quý]: chủ dự án chốt lưới CHỈ làm theo ngày + tháng. */
    console.log('    (đơn vị [Quý] — lưới nói thẳng một câu, không vẽ khung thời gian khác)');
    nutTab()[2].click();
    ok('lưới không vẽ ô nào', /<svg/.test(luoi()), false);
    ok('  · và nói rõ vì sao', /chỉ vẽ theo ngày và theo tháng/.test(luoi()), true);
    nutTab()[0].click();
  }

  console.log('\n11) Engine cũ chưa trả ngày × line (giữa hai lượt deploy) → nói thẳng, KHÔNG nổ');
  {
    /* Bẫy số 4: `theo_ngay_thang` của line là trường MỚI ở P6. Bản Engine cũ
       còn đang chạy thì nó vắng — mười ô trống trông y như mười line đã
       ngừng bán, nên phải nói ra một câu. */
    const cu = LINE_GIA.theo_ngay_thang;
    delete LINE_GIA.theo_ngay_thang;
    napLai();
    await nghi(); await nghi(); await nghi();
    ok('vẫn vẽ được biểu đồ chính', (veHtml().match(/<svg/g) || []).length, 1);
    ok('lưới nói thẳng máy chủ chưa trả số theo ngày',
       /chưa trả số theo ngày cho từng line/.test(CAY.skLuoiNho.innerHTML), true);
    ok('  · và KHÔNG vẽ ô rỗng nào', /<svg/.test(CAY.skLuoiNho.innerHTML), false);
    LINE_GIA.theo_ngay_thang = cu;
  }

  console.log('\n12) Engine chưa trả khối `line` (giữa hai lượt deploy) → bỏ khối, KHÔNG nổ');
  {
    /* Bẫy số 4: có lúc Gateway cũ còn đang chạy và chưa trả `line`. Dashboard
       phải thiếu đúng một khối chứ không được vỡ cả màn hình. */
    const cu = LINE_GIA.thu_tu;
    delete LINE_GIA.thu_tu;
    napLai();
    await nghi(); await nghi(); await nghi();
    ok('vẫn vẽ được biểu đồ chính', (veHtml().match(/<svg/g) || []).length, 1);
    ok('khối lưới nhỏ để trống', CAY.skLuoiNho.innerHTML, '');
    LINE_GIA.thu_tu = cu;
  }

  console.log('\n13) API lỗi → báo lỗi, KHÔNG vẽ số giả');
  {
    tuChoi = true;
    napLai();                                        // đăng xuất, đăng nhập lại, mở tab
    await nghi(); await nghi(); await nghi();
    ok('hiện câu lỗi của máy chủ',
       /Hệ thống tạm thời chưa phục vụ được/.test(CAY.skLoi.textContent), true);
    ok('không còn biểu đồ cũ nằm lại', /<svg/.test(veHtml()), false);
    ok('khối lưới nhỏ cũng dọn sạch', CAY.skLuoiNho.innerHTML, '');
  }

  console.log('\n14) Hai cột CÙNG chiều cao, và khối vừa đúng chỗ còn lại của màn hình');
  {
    /* Chủ dự án chốt 12/09/2026, hai yêu cầu đi liền nhau: hai cụm phải cân
       nhau, và mở trang ra phải thấy cả bảng lẫn biểu đồ không cần cuộn.
       Cả hai là MỘT phép chia: lấy phần màn hình còn lại DƯỚI bảng rồi ép
       hai cột cùng chiều cao ấy.

       Trước lượt này mỗi cột tự cao theo nội dung, nên lưới 10 ô bên phải
       cao gần gấp đôi biểu đồ bên trái — và không bài kiểm nào thấy, vì
       không bài nào đo hình học. Mục này dựng một màn 900px giả: bảng phía
       trên kết thúc ở y=520, phần đệm + dải nút của khối cao 72px. */
    tuChoi = false;
    /* `layEl` chứ không `CAY[...]`: ô khung vẽ chỉ được tạo ra khi file thật
       hỏi tới nó, mà nó chưa hỏi lần nào (phép đo vẫn đang thoát sớm). */
    layEl('o-dashboard')._hop = { top: 520, height: 300 };
    layEl('skVe')._cha = { offsetHeight: 228 };
    layEl('skHopVe')._w = 684;
    /* Khung vẽ = chiều cao cột đã ép, trừ tiêu đề và chú giải (≈50px) —
       đúng cách `flex: 1` chia trong trình duyệt thật. */
    layEl('skHopVe')._h = () => Math.max(0, parseInt(layEl('skVe').style.height || '0', 10) - 50);
    ctx.innerHeight = 900;

    napLai();
    await nghi(); await nghi(); await nghi();

    /* 900 − 520 (đỉnh khối) − 14 (lề đáy) − 72 (phần ngoài hai cột) = 294. */
    ok('cột trái cao đúng phần màn hình còn lại', CAY.skVe.style.height, '294px');
    ok('cột phải CÙNG chiều cao — hai cụm cân nhau', CAY.skLuoiNho.style.height, CAY.skVe.style.height);

    /* viewBox phải cùng TỈ LỆ với khung vẽ, nếu không SVG chừa dải trắng và
       cột trái lại trông "hụt" — đúng triệu chứng chủ dự án báo. */
    const vb = veHtml().match(/viewBox="0 0 (\d+) (\d+)"/);
    ok('viewBox đã tính lại theo khung (không còn cao cố định 200)', vb && vb[2] !== '200', true);
    const tlKhung = 684 / layEl('skHopVe').clientHeight;
    ok('  · và ĐÚNG tỉ lệ khung (lệch dưới 1%)',
       Math.abs(Number(vb[1]) / Number(vb[2]) / tlKhung - 1) < 0.01, true);
    ok('  · svg lấp kín khung (width + height 100%)',
       /width="100%" height="100%"/.test(veHtml()), true);

    /* Lượt đo GỌI LẠI lượt vẽ, mà lượt vẽ lại gọi lượt đo — không có cái
       chốt `dangCanh` thì đây là một vòng lặp vô hạn treo cả trang. */
    const caoCu = vb[2];
    nutChiSo()[1].click();
    const vb2 = veHtml().match(/viewBox="0 0 (\d+) (\d+)"/);
    ok('vẽ lại không làm chiều cao trôi đi (không lặp vô hạn)', vb2[2], caoCu);
    nutChiSo()[0].click();

    /* Màn rất thấp: thà cả trang cuộn thêm một chút còn hơn ép biểu đồ bẹp
       tới mức không đọc được — cùng kỷ luật sàn của khung bảng đơn. */
    ctx.innerHeight = 600;
    napLai();
    await nghi(); await nghi(); await nghi();
    ok('màn thấp → chặn ở SÀN, không bẹp dí', CAY.skVe.style.height, '200px');

    /* MÀN CAO — bài quan trọng nhất của mục này, vì nó ghim đúng lỗi chủ dự
       án bắt được khi mở thật: bản đầu chỉ có sàn, nên "chỗ còn lại" 800px
       làm biểu đồ phình to ra đúng lúc lẽ ra phải gọn lại. Không có trần thì
       ô này ra 800px và không ai thấy cho tới lúc mở trên một màn cao. */
    ctx.innerHeight = 1400;
    napLai();
    await nghi(); await nghi(); await nghi();
    ok('màn cao → chặn ở TRẦN, KHÔNG ăn hết chỗ còn lại', CAY.skVe.style.height, '420px');
    ok('  · và cột phải vẫn bằng đúng cột trái', CAY.skLuoiNho.style.height, '420px');
    ctx.innerHeight = 900;
  }

  console.log('\n15) Đường cong KHÔNG vọt lố ra ngoài giá trị THẬT');
  {
    /* Chủ dự án chốt 12/09/2026 (kèm ảnh mẫu): đường phải có độ cong. Nhưng
       một phép làm cong bình thường (Catmull-Rom) VỌT LỐ giữa hai điểm — đo
       được ngay ở bản đầu: chuỗi [100,60,80,20,50] có đáy thật là 20 mà
       đường võng xuống 15.
       Trên biểu đồ TIỀN đó là vẽ ra một con số không có trong sổ: người đọc
       thấy một ngày thấp hơn ngày thấp nhất mà không cách nào biết nó là do
       phép vẽ. Bài này ghim phép nội suy ĐƠN ĐIỆU đã thay vào. */
    const nguon = doc('public/suc-khoe.js')
      .match(/function duongCong\(dsX, dsY\)[\s\S]*?\n  \}\n/)[0].replace(/^  /gm, '');
    const hop = vm.createContext({ Math, Number, String });
    const duongCong = vm.runInContext('(' + nguon + ')', hop);
    ok('cắt được hàm vẽ đường cong', typeof duongCong, 'function');

    /* Mọi toạ độ trong `d` — kể cả TAY NẮM của Bézier — phải nằm trong
       khoảng giá trị thật. Tay nắm vượt ra ngoài chính là chỗ đường võng
       quá đà, nên canh cả chúng chứ không chỉ canh các điểm mút. */
    const soi = (Y) => {
      const d = duongCong(Y.map((_, i) => i * 10), Y);
      const ys = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((_, i) => i % 2 === 1);
      return [Math.min(...ys), Math.max(...ys)];
    };
    for (const Y of [[100, 60, 80, 20, 50], [10, 90, 10, 90, 10], [0, 0, 50, 50, 0],
                     [5, 4, 3, 2, 1], [1, 2, 3, 4, 5], [7, 7, 7], [3, 9], [42]]) {
      const [lo, hi] = soi(Y);
      ok('không vọt lố trên chuỗi ' + JSON.stringify(Y),
         lo >= Math.min(...Y) - 0.05 && hi <= Math.max(...Y) + 0.05, true);
    }

    /* Vẫn phải CONG thật, không lặng lẽ thành đường gấp khúc. */
    ok('đường có lệnh cong `C` của SVG', /C/.test(duongCong([0, 10, 20], [0, 50, 10])), true);
    ok('  · và đi qua ĐÚNG mọi điểm dữ liệu',
       /^M0\.0,0\.0 C[\d.,\- ]*10\.0,50\.0 C[\d.,\- ]*20\.0,10\.0$/.test(
         duongCong([0, 10, 20], [0, 50, 10])), true);

    /* Hai chuỗi nay CÙNG là đường liền (chủ dự án bỏ nét đứt), nên chúng chỉ
       còn phân biệt bằng MÀU — chú giải vì vậy là bắt buộc, và nét đứt cũ
       không được sót lại ở đâu. */
    const MA = doc('public/suc-khoe.js');
    ok('không còn nét đứt ở chuỗi kỳ trước', /stroke-dasharray/.test(MA), false);
    ok('màu kỳ trước cùng họ xanh với trang chủ (không cam)',
       /MAU_TRUOC = "#7da2e3"/.test(MA), true);
  }

  xong();
})().catch((e) => { console.error('BÀI KIỂM CHẾT:', e); process.exit(1); });
