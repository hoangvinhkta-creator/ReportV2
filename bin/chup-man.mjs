/* CHỤP ẢNH MÀN BÁO CÁO THẬT bằng Chromium — để SOI, không phải để ĐOÁN.
 *
 * Vì sao có file này: bố cục của màn báo cáo được tính bằng phép ĐO lúc chạy
 * (`canhCaoKhoi()` bên `public/suc-khoe.js` chia chỗ còn lại của màn hình cho
 * khối biểu đồ). Bộ kiểm trong `kiem/` chạy trên một DOM giả KHÔNG có bộ dựng
 * flex/grid, nên nó canh được phép tính mà không thấy được kết quả. Ba lượt
 * sửa bố cục liên tiếp (12/09/2026) đều trượt vì lý do đó, và chỉ lộ ra khi
 * chủ dự án mở bằng máy thật. Lượt thứ tư chạy file này và thấy ngay: khối
 * biểu đồ đang đo lúc BẢNG CHƯA VẼ XONG nên nó tưởng mình bắt đầu ở y≈200
 * thay vì y≈460, và phép đo "chỗ trống bên dưới" thì tự quy chiếu vào chính
 * nó (xem chú thích `choDuoiKhoi`).
 *
 * KHÔNG nằm trong `npm test`, và `playwright` KHÔNG phải dependency của repo:
 * repo này cố ý 0 dependency (xem `package.json`), mà Cloudflare chạy
 * `npm test` ở mỗi lượt build — thêm một gói 300 MB vào đó là trả giá cho
 * mọi lượt deploy để phục vụ một việc chạy tay. Cài tạm khi cần:
 *
 *     mkdir -p /tmp/chup && cd /tmp/chup && npm i playwright
 *     node /đường/dẫn/ReportV2/bin/chup-man.mjs 900 /tmp/chup
 *
 * Tham số: chiều cao cửa sổ (mặc định 900) và thư mục đã cài playwright.
 * Ảnh ra `man-<cao>.png` ngay thư mục ấy, kèm một bảng số đo in ra màn hình.
 *
 * Dữ liệu là BỊA — không gọi Firebase, không gọi Gateway, không chạm sổ thật.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CAO = Number(process.argv[2] || 900);
const NOI_PW = process.argv[3] || process.cwd();
const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONG = path.join(GOC, "public");

const doi = createRequire(path.join(NOI_PW, "noop.cjs"));
let chromium;
try { ({ chromium } = doi("playwright")); } catch {
  console.error("Chưa có playwright ở " + NOI_PW + ". Chạy: cd " + NOI_PW + " && npm i playwright");
  process.exit(2);
}

/* Firebase giả: trả sẵn một người đã đăng nhập, không chạm mạng. */
const FB_GIA = `window.firebase={initializeApp(){},auth(){return{
  currentUser:{email:'ai.do@vidu',getIdToken:async()=>'tok'},
  onAuthStateChanged(cb){setTimeout(()=>cb(this.currentUser),0);},
  signInWithEmailAndPassword:async()=>{},signOut:async()=>{}};}};`;

/* ---- Dữ liệu bịa: 10 line, kỳ 2026-09, ba line chưa có đơn nào ---- */
const LINE = ["Nội thành", "Tín Phát", "Miền Bắc", "Tổng kho", "Quyết chiến",
  "Đông Á", "Tân Á", "Fanpage", "Shopee", "Khác"];
const CO_DON = new Set(["Nội thành", "Tín Phát", "Tổng kho", "Tân Á", "Fanpage", "Shopee", "Khác"]);

const chuoiNgay = (nam, den, heSo) => {
  const o = {};
  for (let d = 1; d <= den; d++) {
    if (d % 7 === 0) continue;              // ngày nghỉ → lỗ hổng thật
    o[d] = {
      doanh_so: Math.round((400 + 260 * Math.sin(d / 2.1)) * 1e6 * heSo),
      so_don: 8 + (d % 6),
      khoa: nam + "-09-" + String(d).padStart(2, "0"),
    };
  }
  return o;
};

const line = {}, vs_line = {}, luong = {}, tomTatLine = {};
LINE.forEach((ten, i) => {
  const co = CO_DON.has(ten);
  tomTatLine[ten] = co ? { doanh_so: 1e9 / (i + 1), so_don: 40 - i * 3, so_dong: 60 - i * 4 }
    : { doanh_so: 0, so_don: 0, so_dong: 0 };
  vs_line[ten] = { doanh_so_ky_truoc: co ? 1e9 : 0, vs_thang_truoc_pt: co ? -20 - i * 5 : null };
  if (!co) return;
  line[ten] = {
    doanh_so: 1e9 / (i + 1), so_don: 40 - i * 3, so_dong: 60 - i * 4, so_san_pham: 70 - i * 5,
    loi_nhuan: 6e7 / (i + 1), don_thieu_loi_nhuan: 1,
    doanh_so_quy_doi: 8e8 / (i + 1), don_thieu_quy_doi: 1,
    he_so_pt: ten === "Tín Phát" ? 7.5 : (ten === "Nội thành" ? 2 : 5.5),
    he_so_gia_dung_pt: null, kpi: 1.3e9, dat_pt: 60 - i * 4,
    ty_le_ton_kho_pt: 50 - i * 4, doanh_so_tu_kho: 1e8, doanh_so_ro_nguon: 1e9,
    doanh_so_chua_ro_nguon: 1e7,
  };
  luong[ten] = ten === "Nội thành"
    ? { cach: null, he_so_thuong_pt: null, moc_nong: 0, nguong_nong: null, thuong_nong: null,
        thuong: null, ngay_cong: null, luong_cung: null, phu_cap: null, tong_luong: null }
    : { cach: ten === "Tín Phát" ? "A" : "B", he_so_thuong_pt: ten === "Tín Phát" ? 0.15 : 0.3,
        moc_nong: 0, nguong_nong: null, thuong_nong: 0, thuong: 1e6,
        ngay_cong: ten === "Tín Phát" ? 26 : null,
        luong_cung: ten === "Tín Phát" ? 4.5e6 : null,
        phu_cap: ten === "Tín Phát" ? 78e4 : null,
        tong_luong: ten === "Tín Phát" ? 6.3e6 : null };
});

const DON_HANG = {
  ky: "2026-09", loi_nguon_ma: null, loi_nguon_kpi: null, trong_pham_vi_ma: true,
  tom_tat_line: { thu_tu: LINE, line: tomTatLine },
  bang: { line: null, ngay: [], tom_tat: {}, tom_tat_kpi: {
    line, vs_line, thu_tu: LINE, thieu_bang: false, van_de: [],
    tong: { doanh_so: 6.5e9, so_don: 515, so_san_pham: 864, loi_nhuan: 1.4e8,
      doanh_so_quy_doi: 4.7e9, kpi: 2.03e10, dat_pt: 23, ty_le_ton_kho_pt: 44.4,
      don_thieu_quy_doi: 1, doanh_so_chua_ro_nguon: 1e7,
      doanh_so_ky_truoc: 1e10, vs_thang_truoc_pt: -58.5 },
    luong: { line: luong, tong: { thuong: 2.7e6, luong_cung: 4.5e6, phu_cap: 78e4, tong_luong: 6.3e6 } },
  } },
};
const lineNgay = {};
for (const ten of LINE) {
  lineNgay[ten] = CO_DON.has(ten)
    ? { 2026: { 9: chuoiNgay(2026, 13, 0.2) }, 2025: { 9: chuoiNgay(2025, 30, 0.18) } } : {};
}
const SUC_KHOE = {
  cac_nam: [2026, 2025],
  theo_ngay_thang: { 2026: { 9: chuoiNgay(2026, 13, 1) }, 2025: { 9: chuoiNgay(2025, 30, 0.9) } },
  theo_thang: { 2026: {}, 2025: {} }, theo_quy: { 2026: {}, 2025: {} },
  line: { thu_tu: LINE, theo_thang: {}, theo_nam: {}, theo_ngay_thang: lineNgay,
    tom_tat: { doanh_so_tong: 0, so_don_tong: 0, khop_tong: true } },
};

const KIEU = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const tr = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const trang = await (await tr.newContext({ viewport: { width: 1920, height: CAO } })).newPage();
trang.on("pageerror", (e) => console.error("  LỖI TRANG:", e.message));

await trang.route("**/*", async (duong) => {
  const u = new URL(duong.request().url());
  if (u.hostname === "www.gstatic.com") return duong.fulfill({ contentType: "text/javascript", body: FB_GIA });
  if (u.pathname === "/api/me") return duong.fulfill({ json: { vai: "quantri", name: "Ai Đó", email: "ai.do@vidu" } });
  if (u.pathname === "/api/ky-co-don") return duong.fulfill({ json: { ky: ["2026-09"], nam: { 2026: ["2026-09"] }, thu_tu_nam: ["2026"] } });
  if (u.pathname === "/api/don-hang") return duong.fulfill({ json: DON_HANG });
  if (u.pathname === "/api/bao-cao/suc-khoe") return duong.fulfill({ json: SUC_KHOE });
  if (u.pathname.startsWith("/api/")) return duong.fulfill({ json: {} });
  const f = path.join(CONG, u.pathname === "/" ? "index.html" : u.pathname);
  if (fs.existsSync(f)) {
    return duong.fulfill({ contentType: KIEU[path.extname(f)] || "text/plain", body: fs.readFileSync(f) });
  }
  return duong.fulfill({ status: 404, body: "" });
});

await trang.goto("http://bao-cao.vidu/", { waitUntil: "domcontentloaded" });
await trang.waitForSelector("#skHopVe svg", { timeout: 10000 });
await trang.waitForTimeout(400);

const so = await trang.evaluate(() => {
  const o = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { tren: Math.round(b.top), duoi: Math.round(b.bottom),
      rong: Math.round(b.width), cao: Math.round(b.height) };
  };
  return { manHinh: innerHeight, trangCao: document.documentElement.scrollHeight,
    bang: o(".bangTongHop"), khoi: o("#o-dashboard"), trai: o("#skVe"), phai: o("#skLuoiNho"),
    soO: document.querySelectorAll(".oMini").length,
    soHangBang: document.querySelectorAll(".bangTongHop tr").length };
});

const d = (x) => (x ? String(x.tren).padStart(5) + " →" + String(x.duoi).padStart(5)
  + "  cao" + String(x.cao).padStart(5) + "  rộng" + String(x.rong).padStart(6) : "  (không có)");
console.log("\n  màn hình        " + so.manHinh + "px      chiều cao trang " + so.trangCao + "px");
console.log("  bảng tổng hợp " + d(so.bang) + "   (" + so.soHangBang + " hàng)");
console.log("  khối biểu đồ  " + d(so.khoi));
console.log("  cột TRÁI      " + d(so.trai));
console.log("  cột PHẢI      " + d(so.phai) + "   (" + so.soO + " ô nhỏ)");
const thua = so.trangCao - so.manHinh;
console.log("\n  " + (thua > 0 ? "✗ còn phải CUỘN " + thua + "px" : "✓ lọt trọn một màn"));
console.log("  " + (so.trai && so.phai && so.trai.cao === so.phai.cao
  ? "✓ hai cột cùng chiều cao" : "✗ hai cột LỆCH chiều cao"));

const anh = path.join(NOI_PW, "man-" + CAO + ".png");
await trang.screenshot({ path: anh });
console.log("  ảnh: " + anh + "\n");
await tr.close();
