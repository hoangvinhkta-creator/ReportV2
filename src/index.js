import { xacThuc, doiVaiBaoCao, LoiXacThuc } from './auth.js';
import { docDb, docDbNong, ghiDb, vaDb, xoaDb } from './firebase.js';
import { phanTichLink, daySangTab, dinhDangCot, LoiSheet } from './sheet.js';
import {
  docNguonTracking, docMaBangGia, ghiPhanLoai, cauLoiPhanLoai, docMinNgay, LoiTracking,
} from './tracking.js';

/**
 * Cloudflare Worker Gateway — Worker DUY NHẤT chạm Firebase (CLAUDE.md LUẬT
 * SỐ 1). File tĩnh nằm trong ./public (khai báo ở wrangler.toml). Vì bật
 * `run_worker_first = true` nên MỌI request đều chạy qua đây trước, kể cả
 * request vào file tĩnh — đó là điều kiện để chặn được request trước khi lộ
 * nội dung, và là điều kiện để gắn security header cho cả phần tĩnh.
 *
 * P1 chưa có tính năng báo cáo nào — chỉ MỘT endpoint, `/api/me`, để chứng
 * minh cả đường dây: trình duyệt → Gateway (xác thực + phân quyền) → Engine
 * (qua Service Binding) → màn hình.
 *
 * Thứ tự xử lý:
 *   0. Chặn host lạ — chỉ `CANONICAL_HOST` được phục vụ (P7, xem
 *      `chuyenVeTenMienChinh`)
 *   1. Chặn method lạ (P1 chỉ cần GET/HEAD, chưa endpoint nào nhận POST)
 *   2. Chặn đường dẫn nhạy cảm
 *   3. Định tuyến /api/*
 *   4. Lấy file tĩnh qua binding ASSETS
 *   5. Gắn security header cho MỌI phản hồi, kể cả phản hồi lỗi
 */

/** Đường dẫn không bao giờ được phục vụ. */
const BLOCKED_PATHS = [
  /^\/\.git/i,
  /^\/\.env/i,
  /^\/\.wrangler/i,
  /^\/(src|engine|node_modules|\.vscode|\.idea|docs|kiem)\//i,
  /^\/wrangler\.(toml|jsonc?)$/i,
  /^\/package(-lock)?\.json$/i,
  /\.(bak|old|orig|swp|sql|zip|tar|gz|log|env|pem|key|p12)$/i,
  /\.md$/i,
];

/* CSP tối giản có chủ đích: trình duyệt của Reports KHÔNG bao giờ nói chuyện
 * thẳng với Realtime Database (LUẬT SỐ 1 — chỉ Gateway chạm Firebase), nên
 * không cần mở connect-src/script-src cho *.firebasedatabase.app như Worker
 * `tracking` phải mở. Thứ trình duyệt CẦN nói chuyện là Firebase AUTH (đăng
 * nhập) và chính Gateway này (same-origin, đã có 'self'). */
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // gstatic = Firebase Auth SDK. apis.google.com = iframe trợ giúp mà
    // Firebase Auth dùng để đồng bộ phiên đăng nhập trên authDomain — thiếu
    // nó thì màn đăng nhập báo lỗi CSP chặn api.js (đã xảy ra thật bên
    // Tracking, xem src/index.js của repo đó).
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    // `blob:` thêm 19/09/2026 cho ảnh hướng dẫn kích hoạt bảo hành. Ảnh nằm
    // trong R2 và đi ra qua `GET /api/bao-hanh/anh`, một đường ĐÒI token —
    // mà `<img src>` thì không gắn được header `Authorization`. Nên màn hình
    // `fetch()` lấy byte rồi dựng `URL.createObjectURL()`. `blob:` chỉ cho
    // phép hiện thứ CHÍNH TRANG NÀY vừa dựng trong bộ nhớ, không mở thêm một
    // nguồn ảnh bên ngoài nào.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // identitytoolkit + securetoken (đăng nhập, làm mới token) — KHÔNG cần
    // *.firebasedatabase.app vì trình duyệt không đọc RTDB trực tiếp.
    "connect-src 'self' https://*.googleapis.com",
    // authDomain của cùng một Firebase project mà Tracking đang dùng.
    "frame-src 'self' https://tinphattracking.firebaseapp.com https://apis.google.com",
    "child-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Permitted-Cross-Domain-Policies": "none",
};

function withSecurityHeaders(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  const type = out.headers.get("Content-Type") || "";
  /* `no-store` cho CẢ HTML VÀ JSON.
   *
   * Bản trước chỉ đặt cho `text/html`, nên mọi phản hồi `/api/` đi ra KHÔNG
   * MANG MỘT HEADER CACHE NÀO. Không header thì trình duyệt được phép tự đoán
   * thời gian còn tươi (heuristic freshness) và phục vụ lại bản cũ — và nó
   * đoán khác nhau cho từng URL.
   *
   * Đó là lỗi thật, chủ dự án gặp ngày 12/09/2026: tick "gia dụng" xong thì
   * số trên DÒNG đổi mà một con số TỔNG thì không. Engine tính đúng — đã dựng
   * phép thử chạy cả hai trạng thái tick, mọi tổng khớp tuyệt đối với tổng
   * cộng tay của từng dòng. Chỗ hỏng là hai URL KHÁC NHAU
   * (`?ky=…&line=Nội thành` cho tab line, `?ky=…` cho tab Tổng hợp) có hai ô
   * cache RIÊNG, nên chúng cũ đi ở hai thời điểm khác nhau và nói hai con số
   * khác nhau cho cùng một sự thật.
   *
   * Mọi đường `/api/` của app này trả về DỮ LIỆU ĐỔI ĐƯỢC — doanh số, giá
   * vốn, quyết định sửa tay, hệ số KPI. Không có đường nào cache được, nên
   * đặt thẳng cho mọi JSON thay vì liệt kê từng đường: một đường mới thêm sau
   * này sẽ tự đúng, không phải nhớ thêm tên nó vào đâu cả. */
  if (type.includes("text/html") || type.includes("application/json")) {
    out.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return out;
}

/** Câu nói cho người dùng, theo mã lỗi — KHÔNG bao giờ đưa `ly` (mã lỗi nội
 *  bộ) ra ngoài, chi tiết chỉ vào log. */
const CAU_LOI = {
  400: "Dữ liệu gửi lên không hợp lệ.",
  401: "Chưa đăng nhập, hoặc phiên đã hết hạn. Đăng nhập lại rồi thử lại.",
  403: "Tài khoản của bạn không có quyền dùng chức năng này.",
  503: "Hệ thống tạm thời chưa phục vụ được. Thử lại sau ít phút.",
};

const jsonPhanHoi = (obj, status, rid) =>
  withSecurityHeaders(new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Request-Id": rid },
  }));

/** Một dòng JSON cho mỗi request nhạy cảm — đọc bằng `wrangler tail`. */
function nhatKy(o) {
  try { console.log(JSON.stringify({ t: new Date().toISOString(), ...o })); }
  catch (e) { /* nhật ký hỏng không được làm hỏng request */ }
}

/** Ghép mã lỗi ngắn (`r.ma`, ví dụ "db-tu-choi") với chi tiết (`r.vi`, ví
 *  dụ "HTTP 400") của một lượt gọi `docDb`/`ghiDb`/`vaDb`/`xoaDb` hỏng,
 *  để ghi vào log qua `LoiXacThuc`.
 *
 *  Thiếu `.vi` là chuyện đã xảy ra thật (11/09/2026): một lượt tải sổ
 *  tháng 8 báo lỗi ghi `bc/imei` với lý do `db-tu-choi` — đúng MỘT chữ,
 *  không nói Firebase trả về mã gì (400? 413? 429?), nên phải xin thêm
 *  một dòng log khác mới đoán được hướng. `.vi` giữ đúng mã HTTP thật;
 *  vẫn không lộ ra màn hình (LoiXacThuc chỉ đưa `ma` số 503 ra ngoài, câu
 *  chữ này chỉ vào log — CLAUDE.md "không lộ mã lỗi nội bộ"). */
const chiTietLoi = (r) => r.ma + (r.vi ? ":" + r.vi : "");

/**
 * Bọc một handler nghiệp vụ dưới `/api/`.
 * Thứ tự cố định, không đảo được: xác thực → phân quyền → chạy → nhật ký →
 * trả tối thiểu. Sao lại đúng nếp `boc()` của Worker `tracking` — cùng một
 * bài toán (một Gateway, nhiều endpoint sau này), một cách giải.
 *
 * @param canVai  true nếu endpoint đòi có vai báo cáo (quantri/quanly),
 *                false nếu chỉ cần đăng nhập + có hồ sơ,
 *                hoặc MỘT TÊN VAI ("quantri") nếu chỉ vai ấy được đi đường này.
 * @param chay    async ({ nguoi, vai, request, env, rid }) => object trả về
 */
function boc(canVai, chay) {
  /* Dạng chuỗi thêm ở P5 cho `dat-kpi`/`gia-dung`. Khai ở ĐÂY, tại chỗ phân
     quyền, chứ không kiểm vai bên trong từng handler: một phép kiểm nằm lẫn
     trong thân handler là phép kiểm dễ bị quên ở handler kế tiếp, còn ở đây
     nó đứng ngay cạnh tên đường trong `API_ROUTES` nên đọc bảng route là
     thấy ai đi được đường nào.

     `typeof` chứ không ép boolean: `boc("quantri", …)` viết nhầm thành
     `boc(true, …)` sẽ mở đường cho CẢ Quản lí mà không báo gì — đúng lớp lỗi
     im lặng tệ nhất, nên phải tách hẳn hai kiểu. */
  const vaiDuyNhat = typeof canVai === "string" ? canVai : null;
  return async (request, env) => {
    const rid = crypto.randomUUID();
    const batDau = Date.now();
    let nguoi = null, vai = null;
    try {
      // Anh là ai — lấy từ chữ ký token, KHÔNG lấy từ query hay body.
      nguoi = await xacThuc(request, env);
      if (canVai) vai = doiVaiBaoCao(nguoi);
      if (vaiDuyNhat && vai !== vaiDuyNhat)
        throw new LoiXacThuc(403, "can-vai:" + vaiDuyNhat);

      const ra = await chay({ nguoi, vai, request, env, rid });

      nhatKy({ rid, uid: nguoi.uid, duong: new URL(request.url).pathname,
               ma: 200, ms: Date.now() - batDau });
      return jsonPhanHoi(ra, 200, rid);
    } catch (e) {
      const ma = e instanceof LoiXacThuc ? e.ma : 500;
      const ly = (e && (e.ly || e.message)) || "khong-ro";
      nhatKy({ rid, uid: nguoi ? nguoi.uid : null,
               duong: new URL(request.url).pathname, ma, ly,
               ms: Date.now() - batDau });
      /* `choNguoi` chỉ có mặt khi handler tự viết một câu dành cho người đọc
         (xem `LoiXacThuc` ở src/auth.js) — hiện chỉ đường đẩy Sheet dùng tới.
         Mọi lỗi khác vẫn ra đúng câu chung, không lộ gì thêm. */
      const cauCho = e instanceof LoiXacThuc && e.choNguoi ? e.choNguoi : null;
      return jsonPhanHoi({ loi: cauCho || CAU_LOI[ma] || "Có lỗi phía máy chủ.", rid }, ma, rid);
    }
  };
}

/**
 * Bọc một handler trả về BYTE THÔ, không phải JSON.
 *
 * Chỉ một đường dùng tới: `GET /api/bao-hanh/anh` — ảnh hướng dẫn kích hoạt.
 * Cần một cửa riêng vì `boc()` gói mọi thứ vào `jsonPhanHoi()`, mà một tấm
 * PNG gói trong JSON là một tấm PNG phải base64 lên gấp rưỡi rồi giải mã
 * lại trong trình duyệt.
 *
 * GIỮ NGUYÊN thứ tự của `boc()` — xác thực → phân quyền → chạy → nhật ký —
 * và mọi LỖI vẫn đi ra dạng JSON như mọi đường khác. Ảnh chỉ là đường
 * THÀNH CÔNG; một cửa sau bỏ qua xác thực thì `kiem/dinh-tuyen.js` đã đỏ
 * ngay ở bài "mọi đường trong API_ROUTES không kèm token → 401".
 */
function bocNhiPhan(canVai, chay) {
  const vaiDuyNhat = typeof canVai === "string" ? canVai : null;
  return async (request, env) => {
    const rid = crypto.randomUUID();
    const batDau = Date.now();
    let nguoi = null, vai = null;
    try {
      nguoi = await xacThuc(request, env);
      if (canVai) vai = doiVaiBaoCao(nguoi);
      if (vaiDuyNhat && vai !== vaiDuyNhat)
        throw new LoiXacThuc(403, "can-vai:" + vaiDuyNhat);

      const res = await chay({ nguoi, vai, request, env, rid });
      nhatKy({ rid, uid: nguoi.uid, duong: new URL(request.url).pathname,
               ma: 200, ms: Date.now() - batDau });
      return res;
    } catch (e) {
      const ma = e instanceof LoiXacThuc ? e.ma : 500;
      const ly = (e && (e.ly || e.message)) || "khong-ro";
      nhatKy({ rid, uid: nguoi ? nguoi.uid : null,
               duong: new URL(request.url).pathname, ma, ly,
               ms: Date.now() - batDau });
      return jsonPhanHoi({ loi: CAU_LOI[ma] || "Có lỗi phía máy chủ.", rid }, ma, rid);
    }
  };
}

/* =================== /api/me ===================
 * Endpoint DUY NHẤT của P1. Không trả số liệu báo cáo nào — chỉ chứng minh
 * đường dây chạy: xác thực xong, hỏi Engine một câu vô hại (số phiên bản)
 * qua Service Binding, rồi trả về đủ để màn hình hiện tên người dùng.
 */
const layMe = boc(true, async ({ nguoi, vai, env }) => {
  let enginePhienBan = null;
  if (env.REPORT_ENGINE) {
    try { enginePhienBan = await env.REPORT_ENGINE.phienBan(); }
    catch (e) { enginePhienBan = null; } // Engine chưa nối được không được chặn hẳn /api/me
  }
  return {
    uid: nguoi.uid,
    email: nguoi.email,
    name: nguoi.name || nguoi.email,
    vai,
    engine: enginePhienBan,
  };
});

/* =================== /api/bao-cao/suc-khoe ===================
 * Dashboard — sức khoẻ kinh doanh toàn công ty: doanh số + số đơn theo
 * ngày/tháng/quý, kèm cùng kỳ năm trước, VÀ bảng xếp hạng theo LINE. Đọc
 * `bc/ky` + bảng line ở `bc/quyetdinh/line`, gộp qua Engine, trả cây kết
 * quả ĐÃ TÍNH SẴN cho màn hình vẽ (LUẬT SỐ 1).
 *
 * Trả MỘT lượt đủ cả hai phần, không tách hai endpoint: màn hình đổi tab
 * là vẽ lại ngay từ dữ liệu đã nhớ, không phải chờ mạng lần nữa.
 *
 * Nguồn hỏng (đọc `bc/ky` lỗi, bảng line thiếu hay sai, Engine ném lỗi) →
 * 503, KHÔNG bao giờ trả cây rỗng giả làm "chưa có đơn nào" (CLAUDE.md —
 * "Nguồn hỏng thì BÁO LỖI"). Bảng line sai thì nổ CẢ endpoint chứ không
 * lặng lẽ bỏ riêng phần xếp hạng: bảng đó là thứ người sửa tay trên
 * Console, sai là phải thấy ngay.
 */
const laySucKhoeCongTy = boc(true, async ({ env }) => {
  const cayKy = await docDb("bc/ky", env);
  if (!cayKy.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-ky:" + chiTietLoi(cayKy));
  const bangLine = await docDb("bc/quyetdinh/line", env);
  if (!bangLine.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bang-line:" + chiTietLoi(bangLine));
  if (!bangLine.val) throw new LoiXacThuc(503, "thieu-bang-line");
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");
  /* Trừ phần đã XOÁ TAY ra khỏi `bc/ky` trước khi gộp — chủ dự án chốt xoá
     một dòng thì trừ ở CẢ HAI. Không trừ ở đây thì bảng đơn và biểu đồ nói
     hai con số khác nhau cho cùng một tháng.

     Đọc `bc/quyetdinh/dong` NÔNG trước (chỉ tên kỳ), rồi mới đọc `bc/dong`
     của ĐÚNG những kỳ có quyết định. Kỳ chưa ai sửa — tức gần như mọi kỳ —
     không tốn một lượt đọc nào, và trường hợp thường gặp nhất (chưa sửa gì)
     không đọc thêm gì cả. */
  let truTheoKy = null;
  try {
    truTheoKy = await tinhTruXoaTay(env, cayKy.val || {});
  } catch (e) {
    if (e instanceof LoiXacThuc) throw e;
    throw new LoiXacThuc(503, "khong-tinh-duoc-tru-xoa:" + (e && e.message));
  }

  try {
    const cay = truTheoKy
      ? await env.REPORT_ENGINE.truVaoCayKy(cayKy.val || {}, truTheoKy)
      : (cayKy.val || {});
    const chung = await env.REPORT_ENGINE.gopSucKhoeCongTy(cay);
    const line = await env.REPORT_ENGINE.gopLineTheoThoiGian(cay, bangLine.val);
    return { ...chung, line };
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-suc-khoe:" + (e && e.message));
  }
});

/** Phần phải trừ khỏi `bc/ky` vì đã xoá tay, gom theo kỳ — hoặc `null` khi
 *  chưa ai xoá dòng nào.
 *
 *  Trả `null` chứ không `{}` để chỗ gọi bỏ hẳn được lượt gọi Engine: đường
 *  Dashboard chạy mỗi lần mở tab biểu đồ, và trường hợp thường gặp nhất là
 *  chưa ai sửa gì. */
async function tinhTruXoaTay(env, cayKy) {
  const nong = await docDbNong("bc/quyetdinh/dong", env);
  if (!nong.ok) throw new LoiXacThuc(503, "khong-doc-duoc-quyet-dinh:" + chiTietLoi(nong));
  const cacKy = Object.keys(nong.val || {}).filter(laKy).filter((k) => cayKy[k]);
  if (!cacKy.length) return null;

  const ra = {};
  for (const ky of cacKy) {
    const qd = await docDb("bc/quyetdinh/dong/" + ky, env);
    if (!qd.ok) throw new LoiXacThuc(503, "khong-doc-duoc-quyet-dinh:" + chiTietLoi(qd));
    /* Chỉ kỳ nào thật sự có lệnh XOÁ mới phải đọc `bc/dong` (≈390 KB/kỳ).
       Sửa giá nhập hay nơi nhập không đụng doanh số, nên chúng không kéo
       theo lượt đọc nào ở đây. */
    const coXoa = Object.values(qd.val || {})
      .some((q) => q && typeof q === "object" && q.xoa === true);
    if (!coXoa) continue;
    const dong = await docDb("bc/dong/" + ky, env);
    if (!dong.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-dong:" + chiTietLoi(dong));
    const tru = await env.REPORT_ENGINE.tinhTruDaXoa(dong.val || {}, qd.val || {});
    if (Object.keys(tru).length) ra[ky] = tru;
  }
  return Object.keys(ra).length ? ra : null;
}

/* =================== P3 — tải sổ bán hàng, nối dài dữ liệu ===================
 *
 * Đường ngược chiều với mọi endpoint trước đó: màn hình → Firebase. Trình
 * duyệt đọc .xlsx ra ma trận ô THÔ rồi gửi lên; cột nào là gì, dòng nào bỏ,
 * tiền tính thế nào đều quyết ở Engine (CLAUDE.md — LUẬT SỐ 1). Gateway ở
 * giữa chỉ làm bốn việc: xác thực, canh luật đè, lưu bản cũ, rồi ghi.
 */

/* Sổ một tháng thật nặng ~0,45 MB JSON (1.607 dòng, 08/2026); sổ cả năm
 * 7,2 MB (25.083 dòng). Cho rộng tới 24 MB để còn nhận được sổ nhiều năm,
 * nhưng phải có TRẦN: không có trần thì một request hỏng đủ sức làm Worker
 * hết bộ nhớ giữa chừng, và lúc đó không ai biết đã ghi tới đâu. */
const GIOI_HAN_THAN = 24 * 1024 * 1024;

/* Giữ ba bản lưu gần nhất cho mỗi kỳ — chủ dự án chốt 11/09/2026. */
const SO_BAN_LUU = 3;

const laKy = k => typeof k === "string" && /^\d{4}-\d{2}$/.test(k);

/** Kỳ liền trước một kỳ — `"2026-01"` → `"2025-12"`.
 *
 *  Ở Gateway chứ không ở Engine, và đây là ranh giới: "tháng trước tháng 1 là
 *  tháng 12 năm ngoái" là phép LỊCH, không phải luật nghiệp vụ — cùng loại
 *  với `k.slice(0, 4)` mà `/api/ky-co-don` ngay trên đang dùng để gom năm.
 *  Thứ Engine giữ là công thức SO SÁNH hai tháng (`chenhPhanTram()` trong
 *  `kpi.mjs`), và nó ở đúng bên kia (LUẬT SỐ 1).
 *
 *  Cố tình KHÔNG dùng `new Date()`: dựng một Date từ chuỗi rồi trừ tháng là
 *  mời múi giờ và ngày-31 vào một phép tính không cần tới ngày nào cả. */
function kyTruoc(ky) {
  const nam = Number(ky.slice(0, 4)), thang = Number(ky.slice(5, 7));
  if (!Number.isFinite(nam) || !Number.isFinite(thang)) return null;
  const t = thang === 1 ? 12 : thang - 1;
  const n = thang === 1 ? nam - 1 : nam;
  return String(n).padStart(4, "0") + "-" + String(t).padStart(2, "0");
}

/** Cùng THÁNG của năm trước — cột "So với năm trước" (chủ dự án chốt
 *  15/09/2026).
 *
 *  Chỉ trừ năm đi 1, không đụng tháng: đó đúng là phép so mùa vụ anh cần
 *  ("so sánh cùng tháng của năm trước"). 2026-01 → 2025-01, không phải
 *  2025-12 — khác hẳn `kyTruoc` ở ngay trên. */
function namTruoc(ky) {
  const nam = Number(ky.slice(0, 4));
  if (!Number.isFinite(nam)) return null;
  return String(nam - 1).padStart(4, "0") + "-" + ky.slice(5, 7);
}

/** Kỳ hiện tại theo GIỜ VIỆT NAM, dạng "YYYY-MM".
 *
 *  Worker chạy giờ UTC. Lệch 7 tiếng nghĩa là suốt 7 tiếng đầu mỗi ngày mùng
 *  1 ở Việt Nam, UTC vẫn còn ở tháng trước — và trong bảy tiếng ấy tháng đang
 *  mở sẽ bị xếp nhầm thành "kỳ chưa tới", tức bảng đơn thật của nó biến thành
 *  số của năm ngoái. Nên cộng thẳng 7 tiếng, không đụng `toLocaleString` (nó
 *  phụ thuộc bộ dữ liệu múi giờ của runtime).
 *
 *  Ở Gateway chứ không ở Engine, cùng ranh giới `kyTruoc`/`namTruoc` ngay
 *  trên: "hôm nay là tháng mấy" là phép LỊCH, không phải luật nghiệp vụ. */
function kyHomNay() {
  const t = new Date(Date.now() + 7 * 3600 * 1000);
  return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0");
}

/** Kỳ CHƯA TỚI — tháng nằm sau tháng đang diễn ra.
 *
 *  Chủ dự án chốt 19/09/2026: mở khoá mấy tab tháng ấy để xem trước số của
 *  cùng kỳ năm trước ("để khi cần tôi có thể xem được xu hướng sắp tới").
 *
 *  Tháng ĐANG diễn ra KHÔNG tính là chưa tới, dù sổ của nó mới đổ một nửa:
 *  số của nó là số thật, và thay nó bằng số năm ngoái là nói dối về tháng
 *  người ta đang bán. */
const laKyTuongLai = (ky) => typeof ky === "string" && laKy(ky) && ky > kyHomNay();

/** Chặn mọi lượt GHI nhắm vào một kỳ chưa tới.
 *
 *  Màn hình đã ẩn hết nút bấm ở đó, nhưng màn hình thì sửa được bằng Console
 *  — và một quyết định ghi vào `bc/quyetdinh/dong/2026-12` là một quyết định
 *  không kỳ nào đọc tới, nằm im ở đó cho tới khi tháng 12 về rồi bất ngờ áp
 *  lên sổ thật. Chốt phải ở đây. */
function chanKyTuongLai(ky) {
  if (laKyTuongLai(ky))
    throw new LoiXacThuc(400, "ky-tuong-lai",
      "Tháng này chưa tới. Màn hình đang hiện số của cùng kỳ năm trước để xem "
      + "trước xu hướng, nên chưa ghi được gì vào đây.");
}

/** Hai nhánh của P5. Khai LẠI ở đây dưới dạng chuỗi, không import từ
 *  `engine/src/kpi.mjs` — hai Worker cố ý KHÔNG dùng chung đồ thị module
 *  (đó chính là điểm của Service Binding), và mọi đường `bc/…` khác trong
 *  file này cũng là chuỗi khai tại chỗ.
 *
 *  Chỗ trôi là chỗ nguy hiểm: lệch một ký tự thì Gateway ghi vào một ô mà
 *  Engine không bao giờ đọc tới, và triệu chứng duy nhất là "đặt KPI rồi mà
 *  vẫn hiện chưa đặt". `kiem/kpi-gateway.js` (mục A) vì vậy canh hai bản bằng nhau
 *  trên cả hai file — cùng cách `kiem/khop-ma.js` canh công thức khoá chéo
 *  hai repo. */
const DUONG_BANG_KPI = "bc/quyetdinh/kpi";
const DUONG_GIA_DUNG = "bc/quyetdinh/gia-dung";
/** Phân loại thủ công — hãng + ngành hàng cho tên hàng KHÔNG có mã bảng giá.
 *
 *  Nhánh RIÊNG của Báo cáo, cố ý không ghi sang Tracking như `/api/gan-ma`
 *  vẫn làm. Lý do: những tên này KHÔNG có mặt hàng nào trên bảng giá để
 *  trỏ vào — ghi sang `inv/map` thì trỏ vào đâu, còn thêm một `board/<mã>`
 *  là bịa ra một mặt hàng trên bảng giá dùng chung của ba app.
 *
 *  Khoá là `khoa_ten` (quyết định về MỘT MẶT HÀNG — CLAUDE.md), nên nhánh
 *  này nhỏ và áp cho mọi kỳ. Xem `engine/src/phan-loai.mjs`. */
const DUONG_PHAN_LOAI = "bc/quyetdinh/phan-loai";
/* Nhánh ngày công của P6. Cùng lý do đặt dưới `bc/quyetdinh` như hai nhánh
   trên: đây là con số NGƯỜI nhập tay, và nhánh đó đã có rules đang chạy nên
   nhánh con thừa hưởng sẵn — không phải sửa rules rồi publish tay. */
const DUONG_NGAY_CONG = "bc/quyetdinh/cong";

/* Bonus lợi nhuận theo ĐƠN (chủ dự án chốt 12/09/2026). Nhánh RIÊNG như mọi
   quyết định của người, khoá theo SỐ CHỨNG TỪ — xem `engine/src/bonus.mjs`
   cho toàn bộ lý do. */
const DUONG_BONUS = "bc/quyetdinh/bonus";

/* Link Google Sheet đích của từng (kỳ, line) — chủ dự án chốt 13/09/2026:
   mỗi tháng tạo một Sheet mới cho từng nhân viên rồi dán link vào tab line.
   Khoá theo KỲ chứ không chỉ theo line, vì đó đúng là cách anh làm việc:
   sang tháng mới ô trống trở lại, không ai lỡ ghi đè lên file tháng trước.

   Nhánh `bc/quyetdinh` cho vai quantri|quanly ĐỌC (rules đã chạy sẵn), còn
   GHI thì chỉ qua Gateway và chỉ vai `quantri` — xem `datSheetLink`. */
const DUONG_SHEET = "bc/quyetdinh/sheet";

/* ---- Kích hoạt bảo hành (19/09/2026) ----

   HAI NHÁNH RIÊNG, không nhét chung một chỗ, vì chúng có vòng đời khác hẳn
   nhau:

   · `bao-hanh/<hãng>` — thông tin đăng nhập cổng hãng + các bước hướng dẫn.
     Khai một lần, dùng cho MỌI kỳ. Sang tháng mới không phải gõ lại.
   · `kich-hoat/<kỳ>/<khoá dòng>` — "cái máy này kích hoạt rồi". Theo KỲ, vì
     nó nói về một dòng bán của đúng tháng ấy.

   Cả hai nằm dưới `bc/quyetdinh` chứ không mở nhánh mới ở gốc `bc/`, đúng
   lối `kpi`/`cong`/`bonus` đã chọn: chúng là QUYẾT ĐỊNH CỦA NGƯỜI, không
   phải số liệu Engine tính ra, nên một lượt nhập lại sổ không được đụng tới.
   Và rules của `bc/quyetdinh` đã chạy sẵn (quantri|quanly đọc, không ai ghi
   thẳng) nên không phải sửa `firebase-rules/bc.rules.json` thêm lần nào —
   bớt đúng một bước có thể quên.

   MẬT KHẨU CỔNG HÃNG NẰM Ở ĐÂY LÀ QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (19/09/2026),
   được hỏi thẳng giữa ba phương án. Hệ quả phải nói rõ, vì nó KHÁC hẳn
   `bc/khach`: nhánh `bc/quyetdinh` mở cho CẢ HAI vai đọc thẳng từ Realtime
   Database bằng token trình duyệt, nên mật khẩu ở đây không được coi là bí
   mật với người đã đăng nhập được app. Đây không phải khoá hạ tầng (những
   thứ đó vẫn chỉ nằm ở Secret của Worker) mà là mật khẩu một cổng bảo hành
   dùng chung của phòng kinh doanh. */
const DUONG_BAO_HANH = "bc/quyetdinh/bao-hanh";
const DUONG_KICH_HOAT = "bc/quyetdinh/kich-hoat";

/** Mốc thời gian dùng được làm KHOÁ Firebase. `toISOString()` có dấu chấm
 *  và dấu hai chấm — Firebase cấm dấu chấm trong tên khoá, nên đổi hết sang
 *  gạch ngang. Vẫn sắp xếp đúng thứ tự thời gian khi so chuỗi.
 *
 *  Kèm bốn ký tự ngẫu nhiên ở cuối: hai lượt tải trong cùng một mili giây
 *  (tải lại ngay, hoặc hoàn tác nối tiếp một lượt tải) sẽ ra cùng một mốc,
 *  và bản lưu sau đè mất bản lưu trước — đúng thứ không được phép mất. */
const mocBayGio = () =>
  new Date().toISOString().replace(/[:.]/g, "-") + "-"
  + Math.random().toString(36).slice(2, 6);

/** Đọc thân JSON của request, có trần. */
async function docThan(request) {
  const dai = Number(request.headers.get("Content-Length") || 0);
  if (dai > GIOI_HAN_THAN) {
    const e = new LoiXacThuc(400, "than-qua-lon:" + dai);
    throw e;
  }
  try { return await request.json(); }
  catch (e) { throw new LoiXacThuc(400, "than-khong-phai-json"); }
}

/** Lỗi Engine ném ra khi sổ không dùng được, đổi thành câu cho người đọc.
 *
 *  Service Binding giữ được `message` của Error nhưng KHÔNG chắc giữ được
 *  thuộc tính tự thêm (`e.ma`), nên nhận dạng theo message. Không khớp mẫu
 *  nào thì trả câu chung — không bao giờ ném nguyên văn lỗi nội bộ ra ngoài. */
function cauLoiSo(e) {
  const m = String((e && e.message) || "");
  if (/bo cuc so khong khop|bo-cuc-khong-khop/.test(m)) {
    return "Bố cục file không giống Sổ chi tiết bán hàng của MISA — kiểm tra lại đúng file "
      + "(tiêu đề ở hàng 4, dữ liệu từ hàng 6).";
  }
  if (/can mot ma tran o/.test(m)) return "Không đọc được nội dung file.";
  return "Không xử lý được file này.";
}

/* =================== POST /api/tai-so ===================
 * Một lượt tải sổ, chạy theo thứ tự CỐ ĐỊNH — mỗi bước là một cửa chặn, và
 * không bước nào ghi gì trước khi mọi cửa đều mở:
 *
 *   1. Engine trích sổ (tổng + dòng hàng). Sổ sai bố cục → dừng.
 *   2. Đối chiếu NỘI BỘ lệch → DỪNG, KHÔNG GHI. Script chạy tay của P2
 *      (`bin/nap-so-legacy.mjs`) chặn đúng như vậy; đường upload phải chặn y
 *      hệt, nếu không thì hai đường vào cùng một nhánh dữ liệu có hai mức
 *      chặt khác nhau.
 *   3. Luật phủ sóng theo TỪNG KỲ → thiếu ngày thì TỪ CHỐI CẢ LƯỢT. Từ chối
 *      cả lượt chứ không ghi những kỳ hợp lệ: ghi nửa chừng là để lại một dải
 *      kỳ nửa cũ nửa mới mà không ai biết ranh giới ở đâu.
 *   4. Lưu bản cũ (3 bản gần nhất) TRƯỚC khi đè.
 *   5. Ghi: bc/ky, bc/dong, bc/khach, bc/imei.
 */
const taiSo = boc(true, async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  if (!than || !Array.isArray(than.bang)) {
    return { ghi: false, ly_do: "than-khong-hop-le",
      cau: "Không nhận được nội dung file. Chọn lại file rồi thử lại." };
  }
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  // ── 1. Engine trích sổ ───────────────────────────────────────────────
  let kq;
  try {
    kq = await env.REPORT_ENGINE.xuLySoBanHang(than.bang);
  } catch (e) {
    return { ghi: false, ly_do: "so-khong-doc-duoc", cau: cauLoiSo(e) };
  }

  const cacKy = Object.keys(kq.pham_vi || {}).sort();
  if (!cacKy.length) {
    return { ghi: false, ly_do: "so-rong",
      cau: "File không có dòng bán hàng nào đọc được.", tom_tat: kq.tom_tat };
  }
  for (const k of cacKy) {
    if (!laKy(k)) throw new LoiXacThuc(500, "ky-la:" + k);
  }

  // ── 2. Đối chiếu nội bộ lệch thì KHÔNG GHI ───────────────────────────
  const dc = kq.tom_tat && kq.tom_tat.doi_chieu_noi_bo;
  if (!dc || dc.khop !== true) {
    return {
      ghi: false, ly_do: "doi-chieu-noi-bo-lech",
      cau: "Cộng theo ngày không bằng cộng theo dòng — file có dòng bị rơi hoặc chứng từ bị "
        + "đếm hai lần. KHÔNG ghi gì cả, để số liệu đang có không bị làm hỏng.",
      tom_tat: kq.tom_tat, canh_bao: kq.canh_bao,
    };
  }

  // ── 3. Luật phủ sóng, áp theo TỪNG KỲ ────────────────────────────────
  const cayKyCu = {};      // kỳ → cây bc/ky đang có (hoặc null)
  const phamViCu = {};
  for (const ky of cacKy) {
    const doc = await docDb("bc/ky/" + ky, env);
    if (!doc.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-ky:" + chiTietLoi(doc));
    cayKyCu[ky] = doc.val || null;
    const pv = await env.REPORT_ENGINE.phamViCayKy(doc.val || null);
    if (pv) phamViCu[ky] = pv;
  }
  const phu = await env.REPORT_ENGINE.kiemPhuSong(kq.pham_vi, phamViCu);
  if (!phu.hop_le) {
    return {
      ghi: false, ly_do: "khong-phu-song", thieu: phu.thieu,
      cau: "File mới không phủ hết khoảng ngày đang có của kỳ đó, nên tải lên sẽ làm mất "
        + "những ngày còn thiếu. Xuất lại sổ cho đủ khoảng rồi tải lại.",
      tom_tat: kq.tom_tat,
    };
  }

  // ── 4+5. Từng kỳ: đối chiếu, lưu bản cũ, rồi ghi ─────────────────────
  const ky_da_ghi = [];
  for (const ky of cacKy) {
    const dongCuDoc = await docDb("bc/dong/" + ky, env);
    if (!dongCuDoc.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-dong:" + chiTietLoi(dongCuDoc));
    /* Đọc TRƯỚC khi ghi đè bên dưới (mục "5. Ghi") — bản cũ này là thứ
       luuBanCu() giữ lại, để hoàn tác trả được đúng cả khách của kỳ đó. */
    const khachCuDoc = await docDb("bc/khach/" + ky, env);
    if (!khachCuDoc.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-khach:" + chiTietLoi(khachCuDoc));
    const quyetDinh = await docDb("bc/quyetdinh/dong/" + ky, env);
    if (!quyetDinh.ok) throw new LoiXacThuc(503, "khong-doc-duoc-quyet-dinh:" + chiTietLoi(quyetDinh));

    const sanh = await env.REPORT_ENGINE.doiChieuKy(
      dongCuDoc.val || {}, kq.dong[ky] || {}, Object.keys(quyetDinh.val || {}));

    const moc = await luuBanCu(ky, cayKyCu[ky], dongCuDoc.val || null, khachCuDoc.val || null,
      nguoi, than.ten_file, env);

    const ghiKy = await ghiDb("bc/ky/" + ky, kq.ky[ky], env);
    if (!ghiKy.ok) throw new LoiXacThuc(503, "ghi-bc-ky-loi:" + chiTietLoi(ghiKy));
    const ghiDong = await ghiDb("bc/dong/" + ky, sanh.cay, env);
    if (!ghiDong.ok) throw new LoiXacThuc(503, "ghi-bc-dong-loi:" + chiTietLoi(ghiDong));
    /* PUT (đè trọn), KHÔNG PATCH — cùng động tác với bc/ky và bc/dong ở
       trên. Kỳ này chỉ còn giữ đúng khách của những dòng file mới còn
       nhắc tới; khách của dòng đã biến mất (xem "Nhập sổ" — dòng biến mất
       bị xoá thẳng) không còn mồ côi lại trong Firebase. `kq.khach[ky]`
       vắng mặt (không dòng nào của kỳ có tên/SĐT/địa chỉ) → ghi `null`,
       KHÔNG được bỏ qua lượt ghi — bỏ qua là chính con đường để lại khách
       mồ côi mà sửa này định dẹp. */
    const ghiKhach = await ghiDb("bc/khach/" + ky, kq.khach[ky] || null, env);
    if (!ghiKhach.ok) throw new LoiXacThuc(503, "ghi-bc-khach-loi:" + chiTietLoi(ghiKhach));

    ky_da_ghi.push({
      ky,
      moc_luu: moc,
      la_ky_moi: !cayKyCu[ky],
      pham_vi: kq.pham_vi[ky],
      thang: kq.tom_tat.thang[ky],
      doi_chieu: sanh.tom_tat,
      them: sanh.them, doi: sanh.doi, mat: sanh.mat, bi_khoa: sanh.bi_khoa,
    });
  }

  /* IMEI ghi PHẲNG (không theo kỳ, và bằng PATCH chứ không PUT): nó là
     bảng TRA NGƯỢC "IMEI này của đơn nào", tra cứu không theo thời gian,
     và Gateway chưa có chỗ nào đọc cả nhánh — không có áp lực phình phải
     giải quyết ở đây, khác hẳn `bc/khach` (đọc trọn nhánh mỗi lần mở một
     kỳ — xem lượt sửa "bc/khach phân theo kỳ"). PATCH ở đây đúng nghĩa:
     chỉ THÊM/SỬA đúng những IMEI xuất hiện trong file mới, không đụng IMEI
     của các đơn khác — không giống bc/khach vừa đổi sang PUT-đè-trọn-kỳ.
     KHÔNG NÉM LỖI — đây là bài học trả giá thật 11/09/2026: lượt tải tháng
     08/2026 GHI XONG `bc/ky`/`bc/dong`/`bc/khach` (doanh số, đơn hàng,
     khách — dữ liệu chính), rồi bước IMEI hỏng (Firebase từ chối PATCH)
     làm cả request ném lỗi 503, người dùng thấy "chưa phục vụ được" và
     tưởng KHÔNG có gì được lưu — trong khi dữ liệu chính đã nằm trên
     Firebase từ trước đó. Một bảng tra phụ (chưa màn nào đọc tới) không
     được phép làm mất niềm tin vào phần đã ghi thành công; báo lỗi này ra
     CẢNH BÁO trong response, không phải 503. */
  let imei_loi = null;
  if (Object.keys(kq.imei || {}).length) {
    const r = await vaDb("bc/imei", kq.imei, env);
    if (!r.ok) {
      imei_loi = chiTietLoi(r);
      /* Ghi log riêng — request này trả 200 (thành công CÓ điều kiện), nên
         dòng log chung ở boc() sẽ ghi ma:200 và không hề nhắc tới lỗi này.
         Không có dòng riêng thì lỗi trôi mất, không tra lại được. */
      nhatKy({ rid, uid: nguoi.uid, duong: "/api/tai-so", ma: 200,
               ly: "ghi-bc-imei-loi(khong-chan):" + imei_loi });
    }
  }

  return {
    ghi: true,
    ky_da_ghi,
    tom_tat: kq.tom_tat,
    canh_bao: kq.canh_bao,
    dong_khong_co_ky: kq.dong_khong_co_ky,
    imei_loi,
  };
});

/** Lưu bản cũ của một kỳ trước khi đè hoặc xoá, và cắt về ba bản gần nhất.
 *
 *  Kỳ chưa có gì thì không lưu bản rỗng — "quay lại bản trước" của một kỳ
 *  chưa từng tồn tại không có nghĩa gì, và ba ô lưu quý hơn thế.
 *
 *  Lưu kèm CẢ khách (`bc/khach/<kỳ>`), không chỉ `ky` và `dong`: thiếu nó
 *  thì hoàn tác trả đúng doanh số/dòng hàng nhưng bảng đơn hàng lại hiện
 *  tên/SĐT/địa chỉ của LƯỢT SAU (khách chưa được hoàn tác theo) — một nửa
 *  hoàn tác còn nguy hiểm hơn không hoàn tác, vì trông như đã xong. */
async function luuBanCu(ky, cayKy, dong, khach, nguoi, truoc_khi, env) {
  if (!cayKy && !dong) return null;
  const moc = mocBayGio();
  const r = await ghiDb("bc/backup/" + ky + "/" + moc, {
    luc: new Date().toISOString(),
    boi: nguoi.email || nguoi.uid,
    /* Tên trường nói đúng thứ nó chứa: đây là tên file SẮP ĐÈ lên trạng
       thái này, KHÔNG phải file đã tạo ra nó (file đó không được lưu ở đâu
       cả). Gọi nó là `ten_file` thì màn hình sẽ hiện "bản lưu · lan2.xlsx"
       trong khi nội dung là trạng thái TRƯỚC lan2 — đọc ngược hẳn nghĩa. */
    truoc_khi: typeof truoc_khi === "string" ? truoc_khi.slice(0, 200) : null,
    ky: cayKy || null,
    dong: dong || null,
    khach: khach || null,
  }, env);
  if (!r.ok) throw new LoiXacThuc(503, "luu-ban-cu-loi:" + chiTietLoi(r));

  const ds = await docDbNong("bc/backup/" + ky, env);
  if (ds.ok && ds.val) {
    const moc_cu = Object.keys(ds.val).sort();
    for (const m of moc_cu.slice(0, Math.max(0, moc_cu.length - SO_BAN_LUU))) {
      await xoaDb("bc/backup/" + ky + "/" + m, env);
    }
  }
  return moc;
}

/* =================== POST /api/hoan-tac ===================
 * Quay một kỳ về đúng trạng thái của một bản lưu. Bản hiện tại được lưu
 * TRƯỚC khi quay — quay nhầm cũng quay lại được, vì nếu không thì "hoàn
 * tác" lại chính là thao tác mất dữ liệu nguy hiểm nhất trong màn này.
 */
const hoanTac = boc(true, async ({ nguoi, request, env }) => {
  const than = await docThan(request);
  const ky = than && than.ky, moc = than && than.moc;
  /* Mốc là tên khoá do chính Gateway sinh ra (`mocBayGio`) — chữ số, chữ
     cái, gạch ngang. Canh chặt ở đây vì nó đi thẳng vào đường dẫn Firebase;
     `kiemDuong()` bên `src/firebase.js` là lớp canh thứ hai, không phải lớp
     duy nhất. */
  if (!laKy(ky) || typeof moc !== "string" || !/^[0-9A-Za-z-]{10,48}$/.test(moc)) {
    return { xong: false, cau: "Thiếu kỳ hoặc mốc bản lưu." };
  }

  const ban = await docDb("bc/backup/" + ky + "/" + moc, env);
  if (!ban.ok) throw new LoiXacThuc(503, "khong-doc-duoc-ban-luu:" + chiTietLoi(ban));
  if (!ban.val) return { xong: false, cau: "Không còn bản lưu này — có thể nó đã bị đẩy ra khỏi ba ô gần nhất." };

  const kyHienTai = await docDb("bc/ky/" + ky, env);
  const dongHienTai = await docDb("bc/dong/" + ky, env);
  const khachHienTai = await docDb("bc/khach/" + ky, env);
  if (!kyHienTai.ok || !dongHienTai.ok || !khachHienTai.ok) throw new LoiXacThuc(503, "khong-doc-duoc-hien-tai");
  await luuBanCu(ky, kyHienTai.val || null, dongHienTai.val || null, khachHienTai.val || null,
    nguoi, "(trước khi hoàn tác)", env);

  const a = await ghiDb("bc/ky/" + ky, ban.val.ky || null, env);
  if (!a.ok) throw new LoiXacThuc(503, "hoan-tac-bc-ky-loi:" + chiTietLoi(a));
  const b = await ghiDb("bc/dong/" + ky, ban.val.dong || null, env);
  if (!b.ok) throw new LoiXacThuc(503, "hoan-tac-bc-dong-loi:" + chiTietLoi(b));
  /* Bản lưu cũ (viết trước lượt này) có thể chưa từng có trường `khach` —
     PR thêm nó sau khi P3 đã merge lượt 1. `ban.val.khach ?? null` với một
     kỳ bị `null` nghĩa là "chưa có khách nào", không phải lỗi. */
  const c = await ghiDb("bc/khach/" + ky, ban.val.khach ?? null, env);
  if (!c.ok) throw new LoiXacThuc(503, "hoan-tac-bc-khach-loi:" + chiTietLoi(c));

  return { xong: true, ky, moc, luc: ban.val.luc || null, truoc_khi: ban.val.truoc_khi || null };
});

/* =================== POST /api/xoa-ky ===================
 * Xoá TRỌN một kỳ — dùng khi tải nhầm sổ (một dòng gõ sai ngày thành
 * "2031-03" chẳng hạn) và không còn cách nào gỡ nó khỏi tab năm bằng giao
 * diện. Trước lượt này, một kỳ rác nạp nhầm nằm lại VĨNH VIỄN.
 *
 * An toàn như mọi thao tác đè khác: LƯU BẢN CŨ trước khi xoá, qua đúng cơ
 * chế `luuBanCu()`/`/api/hoan-tac` đã có — xoá nhầm vẫn gọi hoàn tác được,
 * không cần một đường cứu hộ riêng.
 *
 * KHÔNG đụng `bc/quyetdinh/dong/<kỳ>` (quyết định sửa tay của kỳ đó, nếu
 * có) — nhánh đó chưa có UI ghi ở lượt này (P3 lượt 2), và "xoá kỳ có xoá
 * luôn quyết định tay hay không" là một câu hỏi nghiệp vụ của chính lượt
 * đó, không phải chuyện tự quyết ở đây.
 */
const xoaKy = boc(true, async ({ nguoi, request, env }) => {
  const than = await docThan(request);
  const ky = than && than.ky;
  if (!laKy(ky)) return { xong: false, cau: "Thiếu hoặc sai định dạng kỳ." };

  const kyHienTai = await docDb("bc/ky/" + ky, env);
  const dongHienTai = await docDb("bc/dong/" + ky, env);
  const khachHienTai = await docDb("bc/khach/" + ky, env);
  if (!kyHienTai.ok || !dongHienTai.ok || !khachHienTai.ok) throw new LoiXacThuc(503, "khong-doc-duoc-hien-tai");

  if (!kyHienTai.val && !dongHienTai.val) {
    return { xong: false, cau: "Kỳ này chưa có dữ liệu — không có gì để xoá." };
  }

  const moc = await luuBanCu(ky, kyHienTai.val || null, dongHienTai.val || null, khachHienTai.val || null,
    nguoi, "(trước khi xoá kỳ)", env);

  const a = await xoaDb("bc/ky/" + ky, env);
  if (!a.ok) throw new LoiXacThuc(503, "xoa-bc-ky-loi:" + chiTietLoi(a));
  const b = await xoaDb("bc/dong/" + ky, env);
  if (!b.ok) throw new LoiXacThuc(503, "xoa-bc-dong-loi:" + chiTietLoi(b));
  const c = await xoaDb("bc/khach/" + ky, env);
  if (!c.ok) throw new LoiXacThuc(503, "xoa-bc-khach-loi:" + chiTietLoi(c));

  return { xong: true, ky, moc_luu: moc };
});

/* =================== GET /api/ban-luu?ky= =================== */
const layBanLuu = boc(true, async ({ request, env }) => {
  const ky = new URL(request.url).searchParams.get("ky");
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  const ds = await docDb("bc/backup/" + ky, env);
  if (!ds.ok) throw new LoiXacThuc(503, "khong-doc-duoc-ban-luu:" + chiTietLoi(ds));

  /* Chỉ trả NHÃN của từng bản lưu, không trả nội dung: mỗi bản chứa trọn
     cây dòng của một kỳ (~390 KB) và màn hình chỉ cần biết "lưu lúc nào, ai
     tải, từ file nào" để bấm quay lại. */
  const ban = [];
  for (const moc of Object.keys(ds.val || {}).sort().reverse()) {
    const b = ds.val[moc] || {};
    ban.push({ moc, luc: b.luc || null, boi: b.boi || null, truoc_khi: b.truoc_khi || null,
      co_dong: !!b.dong });
  }
  return { ky, ban };
});

/* =================== GET /api/ky-co-don ===================
 * Những kỳ đã có dòng hàng, gom theo năm — để màn hình dựng tab.
 *
 * Đọc NÔNG: hỏi tên các kỳ chứ không kéo cả cây về. `bc/dong` một tháng
 * nặng ~390 KB, hỏi tên 12 tháng bằng lượt đọc đầy đủ là kéo về vài MB chỉ
 * để đọc mấy cái nhãn.
 */
const layKyCoDon = boc(true, async ({ env }) => {
  const ds = await docDbNong("bc/dong", env);
  if (!ds.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-dong:" + chiTietLoi(ds));
  const ky = Object.keys(ds.val || {}).filter(laKy).sort();

  const nam = {};
  for (const k of ky) (nam[k.slice(0, 4)] ||= []).push(k);
  return { ky, nam, thu_tu_nam: Object.keys(nam).sort() };
});

/** Doanh số thuần của TỪNG LINE ở kỳ liền trước — nguồn của cột
 *  "Vs. Tháng trước" (P6). `null` khi không đọc được, hoặc kỳ trước chưa có
 *  sổ nào.
 *
 *  `null` chứ không `{}`, và khác biệt ấy đi thẳng ra màn hình: `{}` nghĩa là
 *  "đã đọc, kỳ trước không line nào bán gì" — một câu về nghiệp vụ; `null`
 *  nghĩa là "chưa có số để so". Trả `{}` cho cả hai ca là để một ô trống nói
 *  "tháng trước bán 0 đồng" thay người, đúng thứ CLAUDE.md cấm.
 *
 *  KHÔNG ném khi đọc hỏng — cùng kỷ luật với bảng KPI ngay dưới: đây là MỘT
 *  cột, còn doanh số, số đơn, khách hàng, giá vốn đều đọc được mà không cần
 *  nó. Chặn cả bảng đơn vì một nhánh phụ không trả lời là lấy đi nhiều hơn
 *  phần bị mất.
 *
 *  Trừ phần XOÁ TAY trước khi cộng, y như Dashboard làm (`tinhTruXoaTay`):
 *  không trừ thì tháng trước đọc ra một con số CAO HƠN thứ chính màn hình
 *  ấy đang hiện khi mở tháng đó — và cột chênh lệch sai đúng bằng phần đã
 *  xoá, im lặng.
 */
async function docDoanhSoLineMoc(env, kyMoc, huaBangLine, rid, nhan) {
  const truoc = kyMoc;
  if (!truoc) return null;
  try {
    /* Khởi động lượt đọc của RIÊNG mình trước, rồi mới chờ bảng line: hàm
       này chạy trong cùng `Promise.all` với chính lượt đọc bảng line, nên
       chờ trước là tự xếp hàng sau nó mà không được gì. */
    const huaCay = docDb("bc/ky/" + truoc, env);
    const cayKy = await huaCay;
    if (!cayKy.ok) throw new Error("bc-ky:" + chiTietLoi(cayKy));
    if (!cayKy.val) return null;
    const bl = await huaBangLine;
    if (!bl.ok || !bl.val) throw new Error("bang-line:" + chiTietLoi(bl));
    const bangLine = bl.val;

    const mot = { [truoc]: cayKy.val };
    const truTheoKy = await tinhTruXoaTay(env, mot);
    const cay = truTheoKy ? await env.REPORT_ENGINE.truVaoCayKy(mot, truTheoKy) : mot;

    /* `gopLineTheoNgay` trả CẢ tổng lẫn bản kê theo từng ngày — hạt ngày là
       nguyên liệu của vế "tính tới hôm nay" (15/09/2026).

       CÓ ĐƯỜNG LÙI, bắt buộc: đây là hàm Engine MỚI, nên giữa hai lượt
       deploy song song một Gateway bản mới sẽ gặp Engine bản cũ chưa có nó
       (bẫy số 4). Lùi về `gopTheoLine` — hàm đã có từ P2 — thì hai cột mất
       vế MTD trong ít phút, đúng hành vi cũ, chứ không nổ 503 cả bảng. */
    try {
      const gn = await env.REPORT_ENGINE.gopLineTheoNgay(cay, bangLine);
      return { tong: gn.tong || {}, theo_ngay: gn.theo_ngay || {} };
    } catch (e) {
      nhatKy({ rid, duong: "/api/don-hang",
               canh_bao: (nhan || "ky-truoc") + "-khong-co-hat-ngay:" + (e && e.message) });
    }
    const gop = await env.REPORT_ENGINE.gopTheoLine(cay, bangLine);
    const ra = {};
    for (const ten of Object.keys(gop.line || {})) ra[ten] = gop.line[ten].doanh_so;
    return { tong: ra, theo_ngay: null };
  } catch (e) {
    nhatKy({ rid, duong: "/api/don-hang",
             canh_bao: (nhan || "ky-truoc") + "-hong:" + (e && e.message) });
    return null;
  }
}

/* Lệch múi giờ VN so với UTC. Worker chạy ở UTC, còn "hôm nay" và "kỳ này"
   là khái niệm của NGƯỜI DÙNG — đọc theo đồng hồ của họ. Dùng ở hai chỗ:
   mốc cắt "tính tới hôm nay" ngay dưới đây, và lượt đẩy Sheet 17h30. Khai
   MỘT bản, vì hai bản lệch nhau là hai màn hình nói hai ngày khác nhau. */
const VN_LECH_MS = 7 * 3600 * 1000;

/** Phần TỔNG của một kỳ mốc — đúng hình dạng `apDungKpi` vẫn nhận từ P6.
 *  Giữ nguyên hình dạng ấy thay vì đổi chữ ký hàm Engine: cột "Vs. Tháng
 *  trước" đang chạy đúng, và đổi kiểu tham số của nó là mời một lỗi im lặng
 *  vào đúng chỗ không cần sửa. */
const tongMoc = (m) => (m && m.tong) || null;

/** Gói nguyên liệu "tính tới hôm nay" cho Engine.
 *
 *  `ngay_hom_nay` tính theo GIỜ VN, không theo UTC: Worker chạy ở UTC, nên
 *  từ 7h tối VN trở đi `new Date()` đã sang ngày mới bên UTC và mốc cắt sẽ
 *  nhảy sớm một ngày. Kỳ và ngày là khái niệm của NGƯỜI DÙNG, đọc theo múi
 *  giờ của người dùng — cùng luật `kyVN()` của lượt đẩy Sheet đang theo.
 *
 *  Engine mới là nơi quyết định có ÁP mốc ấy hay không (kỳ đang xem phải
 *  chứa hôm nay). Gateway chỉ nói "hôm nay là ngày mấy" — một sự thật về
 *  đồng hồ, không phải một luật đọc số. */
function goiMtd(kyTruocMoc, namTruocMoc) {
  const d = new Date(Date.now() + VN_LECH_MS);
  const hai = (n) => String(n).padStart(2, "0");
  return {
    ngay_hom_nay: d.getUTCFullYear() + "-" + hai(d.getUTCMonth() + 1) + "-"
      + hai(d.getUTCDate()),
    ky_truoc_theo_ngay: (kyTruocMoc && kyTruocMoc.theo_ngay) || null,
    nam_truoc_theo_ngay: (namTruocMoc && namTruocMoc.theo_ngay) || null,
  };
}

/* =================== GET /api/don-hang?ky=&line= ===================
 * Bảng đơn hàng của một kỳ, lọc theo line. Mọi con số ĐÃ TÍNH SẴN ở Engine
 * — trình duyệt chỉ vẽ ra (LUẬT SỐ 1).
 *
 * Thông tin khách đi qua đây, và đây là ĐƯỜNG DUY NHẤT nó đi: `bc/khach`
 * đóng với MỌI vai kể cả quantri (CLAUDE.md), chỉ tài khoản dịch vụ của
 * Worker đọc được.
 */
/** Đọc mọi nguồn của MỘT (kỳ, line) rồi nhờ Engine dựng bảng đơn.
 *
 *  Tách khỏi `layDonHang` để đường GHI dùng lại được — xem `/api/sua-dong`.
 *  Nếu để nguyên trong tay áo của một endpoint thì đường ghi chỉ còn cách
 *  bảo trình duyệt "gọi lại GET đi", tức một vòng mạng thứ hai cho đúng thứ
 *  máy chủ vừa có sẵn mọi nguyên liệu để dựng. */
async function dungBangDonHang(env, ky, line, rid) {
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  /* ═══════════ LƯỢT ĐỌC CHẠY SONG SONG — sửa 12/09/2026 ═══════════
   *
   * Bản trước `await` từng nguồn một, xếp hàng: `bc/dong` → bảng line →
   * `bc/khach` → phạm vi → bảng giá Tracking → mã cần → Min theo ngày →
   * quyết định → KPI → gia dụng → ngày công → kỳ trước. Mười một lượt đi
   * mạng nối đuôi nhau cho MỘT lần bấm, và bấm sang tab line nào cũng trả
   * lại đủ ngần ấy — chủ dự án đo được 3–4 giây mỗi lượt đổi tab.
   *
   * Chúng gần như độc lập nhau. Thứ tự cũ không phải một ràng buộc, nó chỉ
   * là thứ tự người viết nghĩ ra từng thứ. Nay gom thành BA ĐỢT, mỗi đợt
   * chỉ chờ đúng thứ đợt sau thật sự cần:
   *
   *   đợt 1  mọi lượt đọc chỉ cần `env` + `ky`      (7 Firebase + bảng giá)
   *   đợt 2  mã cần giá vốn → Min theo ngày         (cần `dong` + bảng giá)
   *   đợt 3  Engine dựng bảng                       (cần tất cả)
   *
   * Tổng thời gian rơi từ "cộng mọi lượt" xuống "lượt chậm nhất mỗi đợt".
   * KHÔNG có bộ đệm nào được thêm ở đây, cố ý: đệm là đổi tốc độ lấy nguy
   * cơ đọc số cũ, và số cũ đúng là lỗi đã phải sửa ở P5 (PR #73). Lượt sửa
   * này chỉ bỏ thời gian NGỒI CHỜ, không bỏ một lượt đọc nào. */
  const dong0 = Date.now();

  /* Mốc giá vốn là một LUẬT NGHIỆP VỤ nên Engine giữ nó, Gateway chỉ hỏi.
     Hỏi qua một lời hứa CHƯA await: câu trả lời chỉ cần tới lúc quyết có đi
     hỏi Min theo ngày hay không, nên không bắt bảy lượt đọc Firebase ngồi
     chờ nó.

     Từ 19/09/2026 mốc này KHÔNG còn quyết định có khớp mã hay không — khớp
     mã chạy ở MỌI kỳ, để tab [Kích hoạt bảo hành] có hãng của từng dòng. Nó
     chỉ còn quyết hai việc: có đi lấy Min theo ngày không, và màn hình nói
     câu gì về cột Giá nhập.

     CỬA LÙI về tên cũ là bắt buộc, không phải phòng xa: hai Worker build
     SONG SONG khi merge (bẫy số 4 — ROADMAP.md), nên có một khoảng bản
     Gateway MỚI này gọi Engine CŨ chưa có `kyCoGiaVon`. Không lùi thì mọi
     lượt mở bảng đơn trong khoảng ấy nổ 503; lùi thì nó chạy đúng như cũ
     (hai tên cùng trả một câu trả lời với bản Engine cũ). */
  const huaPhamVi = Promise.resolve()
    .then(() => (env.REPORT_ENGINE.kyCoGiaVon
      ? env.REPORT_ENGINE.kyCoGiaVon(ky)
      : env.REPORT_ENGINE.kyCoKhopMa(ky)))
    .catch((e) => { throw new LoiXacThuc(503, "engine-loi-pham-vi:" + (e && e.message)); });

  /* Bảng giá Tracking — nguồn của cột mã, hãng, ngành hàng.
   *
   * Tracking hỏng thì KHÔNG làm hỏng cả bảng đơn: doanh số, số đơn, khách
   * hàng đều đọc được mà không cần bảng giá, và chặn hẳn màn hình vì một
   * nhánh phụ không trả lời là lấy đi nhiều hơn phần bị mất.
   *
   * Nhưng cũng KHÔNG im lặng trả một bảng "chưa dòng nào khớp" — đó đúng là
   * thứ CLAUDE.md cấm: một sự cố mạng nói một kết luận nghiệp vụ thay người.
   * Nên khi ấy phép khớp KHÔNG chạy chút nào, và `loi_nguon_ma` đi kèm phản
   * hồi để màn hình treo băng cảnh báo nói thẳng vì sao ba cột kia trống.
   * Ba trạng thái tách bạch: có mã / chưa có mã / CHƯA BIẾT vì nguồn hỏng.
   *
   * Bắt `LoiTracking` NGAY TẠI ĐÂY thay vì để nó nổ ra khỏi `Promise.all`:
   * một lỗi thoát ra từ đó sẽ huỷ luôn cả đợt và làm hỏng cả bảng đơn —
   * đúng điều đoạn trên vừa nói là không được. */
  /* LẤY BẢNG GIÁ Ở MỌI KỲ từ 19/09/2026 — không còn chờ `huaPhamVi` nữa.
     Bản trước bỏ qua kỳ cũ để khỏi kéo ~400 KB về cho một kỳ "không dùng
     được chúng"; nay kỳ cũ dùng được, vì hãng và ngành hàng của từng dòng
     chính là thứ tab [Kích hoạt bảo hành] cần để xếp máy vào đúng cổng.
     Đó là một lượt gọi Tracking thêm cho mỗi lượt mở một tháng cũ — đúng
     lượt gọi mà tháng hiện tại vẫn đang trả. */
  const huaNguon = docNguonTracking(env).then(
    (n) => ({ nguon: n, ly: null }),
    (e) => { if (!(e instanceof LoiTracking)) throw e; return { nguon: null, ly: e.ly }; });

  /* `bc/quyetdinh/line` chưa có kết quả lúc này, nên `docDoanhSoLineMoc`
     nhận LỜI HỨA của nó chứ không nhận giá trị. Nhờ thế nó khởi động lượt
     đọc `bc/ky/<kỳ trước>` của riêng mình NGAY, song song với bảy lượt bên
     dưới, rồi mới chờ bảng line ở đúng chỗ thật sự cần. Đưa nó xuống một
     đợt sau thì đúng cái màn hình mở đầu tiên ([Tổng hợp]) lại phải chờ
     thêm một vòng. */
  const huaBangLine = docDb("bc/quyetdinh/line", env);

  /* CHỈ tab [Tổng hợp] (`line === null`) mới cần số tháng trước — cột
     "Vs. Tháng trước" không có mặt ở tab của một line. Lấy nó ở mọi lượt là
     bắt mỗi lần mở một tab line phải trả thêm hai lượt đọc Firebase cho một
     con số không ai nhìn. */
  const [dong, bangLine, khach, quyetDinh, bangKpi, giaDung, bangCong, bonus,
         kqNguon, doanhSoKyTruoc, doanhSoNamTruoc, sheetLink, coGiaVon,
         phanLoai] = await Promise.all([
    docDb("bc/dong/" + ky, env),
    huaBangLine,
    /* Đọc ĐÚNG một kỳ, không đọc cả nhánh — `bc/khach/<kỳ>` phẳng theo
       tháng. Đọc cả nhánh (như bản đầu của P3) là con số CỘNG DỒN mãi mãi:
       đo trên sổ thật 151 KB/tháng, 36 tháng đã 5,29 MB cho MỘT lượt xem. */
    docDb("bc/khach/" + ky, env),
    /* Quyết định sửa tay của kỳ này. Nhánh RIÊNG, không bị lượt nhập sổ đè,
       và được hợp nhất ở đây — lúc ĐỌC (CLAUDE.md, mục "Nhập sổ"). */
    docDb("bc/quyetdinh/dong/" + ky, env),
    /* KPI / hệ số quy đổi, và tick "gia dụng" theo mặt hàng (P5).
       `bc/quyetdinh/gia-dung` đọc TRỌN nhánh, không theo kỳ — cố ý. Đó là
       quyết định về MỘT MẶT HÀNG nên nó áp cho mọi kỳ (CLAUDE.md), tức
       không có cách nào chia nó theo kỳ. Nhánh này nhỏ: mỗi mặt hàng đúng
       một khoá ngắn, không phải mỗi DÒNG một khoá như `bc/quyetdinh/dong`. */
    docDb(DUONG_BANG_KPI, env),
    docDb(DUONG_GIA_DUNG, env),
    /* Ngày công đọc theo ĐÚNG kỳ đang xem, không đọc cả nhánh — nó là con số
       của một tháng cụ thể, và đọc cả nhánh là con số cộng dồn mãi mãi
       (đúng bài học `bc/khach` của P3). */
    docDb(DUONG_NGAY_CONG + "/" + ky, env),
    /* Bonus đọc theo ĐÚNG kỳ đang xem, không đọc cả nhánh — nó là quyết định
       về một ĐƠN của một tháng cụ thể, và đọc cả nhánh là con số cộng dồn
       mãi mãi (đúng bài học `bc/khach` của P3). */
    docDb(DUONG_BONUS + "/" + ky, env),
    huaNguon,
    line ? null : docDoanhSoLineMoc(env, kyTruoc(ky), huaBangLine, rid, "ky-truoc"),
    /* Cùng tháng năm trước — cột "So với năm trước". Cùng lối và cùng lý do
       như dòng trên: CHỈ tab [Tổng hợp] cần, nên tab của một line không phải
       trả thêm một lượt đọc Firebase cho con số không ai nhìn.

       Hai lượt đọc này đi SONG SONG với nhau và với bảy lượt còn lại, nên
       thêm cột không thêm một nhịp chờ nào — chúng chỉ chờ cùng một bảng
       line mà cả hai đều cần. */
    line ? null : docDoanhSoLineMoc(env, namTruoc(ky), huaBangLine, rid, "nam-truoc"),
    /* Link Sheet đích của ĐÚNG (kỳ, line) đang xem. Chỉ tab của một line mới
       có ô này — tab [Tổng hợp] không đẩy đi đâu cả, nên không đọc.
       Đọc kèm ở đây thay vì mở một route riêng cho màn hình gọi: một lượt
       mạng nữa cho một chuỗi ngắn là đổi tốc độ lấy đúng con số không. */
    line ? docDb(DUONG_SHEET + "/" + ky + "/" + line, env) : null,
    /* `huaPhamVi` đi CÙNG đợt này thay vì được await riêng sau đó, và đó
       không phải chuyện gọn mã: nó đã khởi động từ trước, nên xếp nó vào đây
       không làm ai chờ thêm — nhưng nếu một lượt đọc khác trong đợt hỏng
       trước, một lời hứa BỊ TỪ CHỐI mà chưa ai await sẽ thành unhandled
       rejection trong Worker. Bản trước không vướng vì `huaNguon` móc vào
       `.then()` của nó nên lỗi chảy sẵn vào đợt; từ 19/09/2026 bảng giá
       không móc vào đó nữa, nên phải nối lại đường chảy ấy ở đây. */
    huaPhamVi,
    /* Phân loại thủ công — đọc TRỌN nhánh, không theo kỳ, cùng lối và cùng
       lý do với `bc/quyetdinh/gia-dung` ngay trên: quyết định về MỘT MẶT
       HÀNG thì áp cho mọi kỳ, tức không có cách nào chia nó theo kỳ. Nhánh
       nhỏ — mỗi mặt hàng đúng một khoá ngắn. */
    docDb(DUONG_PHAN_LOAI, env),
  ]);
  const ms_doc = Date.now() - dong0;

  if (!dong.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-dong:" + chiTietLoi(dong));
  if (!bangLine.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bang-line:" + chiTietLoi(bangLine));
  if (!bangLine.val) throw new LoiXacThuc(503, "thieu-bang-line");
  if (!khach.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-khach:" + chiTietLoi(khach));
  if (!quyetDinh.ok)
    throw new LoiXacThuc(503, "khong-doc-duoc-quyet-dinh:" + chiTietLoi(quyetDinh));

  let nguon = kqNguon.nguon, minNgay = null, loi_nguon_ma = kqNguon.ly;
  if (loi_nguon_ma) nhatKy({ rid, duong: "/api/don-hang", canh_bao: "tracking-hong:" + loi_nguon_ma });

  /* KHÔNG ném khi đọc KPI không được — khác hẳn bảng line ở trên. Quy đổi là
     MỘT cột; doanh số, số đơn, khách hàng và giá vốn đều đọc được mà không
     cần nó, nên chặn cả bảng đơn vì một nhánh phụ không trả lời là lấy đi
     nhiều hơn phần bị mất. Engine nhận `null` thì để quy đổi trống và bật
     `thieu_bang` — màn hình nói thẳng vì sao cột ấy trống, không im lặng. */
  let loi_nguon_kpi = null;
  if (!bangKpi.ok) loi_nguon_kpi = "kpi:" + chiTietLoi(bangKpi);
  else if (!giaDung.ok) loi_nguon_kpi = "gia-dung:" + chiTietLoi(giaDung);
  else if (!bangCong.ok) loi_nguon_kpi = "ngay-cong:" + chiTietLoi(bangCong);
  else if (!bonus.ok) loi_nguon_kpi = "bonus:" + chiTietLoi(bonus);
  if (loi_nguon_kpi) nhatKy({ rid, duong: "/api/don-hang", canh_bao: loi_nguon_kpi });
  const kpiVal = bangKpi.ok ? (bangKpi.val || null) : null;
  const gdVal = giaDung.ok ? (giaDung.val || {}) : {};
  const congVal = bangCong.ok ? (bangCong.val || {}) : {};
  const bonusVal = bonus.ok ? (bonus.val || {}) : {};
  /* Đọc không được thì coi như CHƯA CÓ quyết định nào, và nói ra ở nhật ký —
     KHÔNG chặn cả bảng đơn. Cùng lối cột quy đổi: mất hai cái nhãn một lượt
     còn hơn mất cả bảng vì một nhánh phụ không trả lời. Không cái nào trong
     bảng là TIỀN, nên không có con số nào sai đi vì thiếu nó. */
  let loi_nguon_phan_loai = null;
  if (!phanLoai.ok) {
    loi_nguon_phan_loai = chiTietLoi(phanLoai);
    nhatKy({ rid, duong: "/api/don-hang", canh_bao: "phan-loai:" + loi_nguon_phan_loai });
  }
  const plVal = phanLoai.ok ? (phanLoai.val || {}) : {};

  /* ── Đợt 2 — giá vốn theo NGÀY BÁN. Phải chờ đợt 1 thật: hỏi Engine mã nào
     có mặt trong kỳ (cần `dong` + bảng giá), rồi mới hỏi Tracking giá của
     đúng những mã ấy theo từng ngày. Một đơn ngày 01/09 lấy giá của mốc
     01/09, không phải giá của hôm tải file lên. */
  const gia0 = Date.now();
  /* `coGiaVon` là vế MỚI (19/09/2026). Trước lượt này `nguon` đã tự mang
     nghĩa "kỳ trong phạm vi" vì kỳ cũ không bao giờ được lấy bảng giá; nay
     nó có ở mọi kỳ, nên phải nói riêng ra. Thiếu vế này thì kỳ cũ vẫn đi một
     vòng hỏi Engine `maCanGiaVon` (trả rỗng) rồi `docMinNgay` (trả rỗng) —
     không sai số, nhưng là hai lượt gọi cho một câu trả lời đã biết trước. */
  if (nguon && coGiaVon) {
    try {
      const maCan = await env.REPORT_ENGINE.maCanGiaVon(dong.val || {}, nguon, ky);
      minNgay = await docMinNgay(env, ky, maCan);
    } catch (e) {
      if (!(e instanceof LoiTracking)) throw e;
      nguon = null; minNgay = null;
      loi_nguon_ma = e.ly;
      nhatKy({ rid, duong: "/api/don-hang", canh_bao: "tracking-hong:" + e.ly });
    }
  }
  const ms_gia = Date.now() - gia0;

  /* ── Đợt 3 — Engine dựng bảng. Hai lượt gọi độc lập nhau nên đi cùng lúc. */
  const eng0 = Date.now();
  try {
    /* Kỳ ngoài phạm vi hoặc Tracking hỏng thì vẫn phải áp sửa tay: một dòng
       đã XOÁ TAY phải biến khỏi bảng và khỏi mọi tổng dù có giá vốn hay
       không. Nên đường không-Tracking đi qua `dungBangDonSuaTay`, không phải
       `dungBangDon` trần. */
    const [tom_tat_line, bang] = await Promise.all([
      env.REPORT_ENGINE.tomTatLine(dong.val || {}, bangLine.val),
      nguon
        ? env.REPORT_ENGINE.dungBangDonKemMa(
          dong.val || {}, khach.val || {}, bangLine.val, line || null, nguon, ky,
          minNgay, quyetDinh.val || {}, kpiVal, gdVal, tongMoc(doanhSoKyTruoc), congVal,
          bonusVal, tongMoc(doanhSoNamTruoc), goiMtd(doanhSoKyTruoc, doanhSoNamTruoc),
          plVal)
        : env.REPORT_ENGINE.dungBangDonSuaTay(
          dong.val || {}, khach.val || {}, bangLine.val, line || null, quyetDinh.val || {},
          kpiVal, gdVal, ky, tongMoc(doanhSoKyTruoc), congVal, bonusVal,
          tongMoc(doanhSoNamTruoc), goiMtd(doanhSoKyTruoc, doanhSoNamTruoc), plVal),
    ]);
    /* Ba con số thời gian đi vào nhật ký, không đi ra phản hồi: lượt sau còn
       chậm thì `wrangler tail` nói ngay chậm ở ĐÂU, không phải đoán lại từ
       đầu như lượt này. */
    nhatKy({ rid, duong: "/api/don-hang", ky, line: line || null,
             ms_doc, ms_gia, ms_engine: Date.now() - eng0 });
    /* Đọc link không được thì để `null` và KHÔNG chặn bảng — cùng lối cột
       quy đổi đã chọn ở trên. Mất ô dán link một lượt còn hơn mất cả bảng vì
       một nhánh phụ không trả lời. */
    const sheet = sheetLink && sheetLink.ok && sheetLink.val
      ? { link: sheetLink.val.link || null, day_luc: sheetLink.val.day_luc || null,
          day_loi: sheetLink.val.day_loi || null }
      : null;
    /* `co_gia_von` thay tên cũ `trong_pham_vi_ma` (19/09/2026): cái tên cũ
       nói "kỳ này có được khớp mã không", mà nay mọi kỳ đều được. Thứ nó
       thật sự trả lời — và vẫn là thứ màn hình cần — là "kỳ này có giá vốn
       theo ngày không". Đổi tên chứ không giữ hai tên: hai tên cho một cờ là
       hai chỗ để lượt sửa sau chọn nhầm. */
    return { ky, tom_tat_line, bang, loi_nguon_ma, loi_nguon_kpi,
             loi_nguon_phan_loai, co_gia_von: coGiaVon, sheet };
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-don-hang:" + (e && e.message));
  }
}

const layDonHang = boc(true, async ({ request, env, rid }) => {
  const q = new URL(request.url).searchParams;
  const ky = q.get("ky");
  const line = q.get("line");
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  if (line !== null && (typeof line !== "string" || line.length > 60)) {
    throw new LoiXacThuc(400, "line-khong-hop-le");
  }

  /* KỲ CHƯA TỚI → dựng bảng của CÙNG KỲ NĂM TRƯỚC (chủ dự án chốt
     19/09/2026). Thay nguồn ngay tại đây chứ không để Engine dựng một bảng
     rỗng rồi màn hình tự đi hỏi kỳ khác: hai lượt gọi cho một bảng, và một
     màn hình tự quyết "lấy số của kỳ nào" là một luật nghiệp vụ lọt ra
     trình duyệt.

     `ky` trả về vẫn là kỳ NGƯỜI DÙNG hỏi, và `ky_so_lieu` nói số đến từ đâu
     — hai trường riêng, không một trường nhập nhằng. Màn hình bắt buộc ghi
     rõ "Số liệu cùng kỳ năm trước" (chủ dự án chốt), và `chi_doc` đóng mọi
     đường ghi: bảng đang hiện KHÔNG phải bảng của kỳ đang mở. */
  if (laKyTuongLai(ky)) {
    const nguon = namTruoc(ky);
    if (!nguon) throw new LoiXacThuc(400, "ky-khong-hop-le");
    const kq = await dungBangDonHang(env, nguon, line, rid);
    return { ...kq, ky, ky_so_lieu: nguon, la_ky_tuong_lai: true, chi_doc: true };
  }
  return dungBangDonHang(env, ky, line, rid);
});

/** Ghép BẢNG ĐÃ TÍNH LẠI vào phản hồi của một lượt GHI.
 *
 *  Máy chủ vừa ghi xong đang đứng cạnh mọi nguyên liệu để dựng lại bảng ấy;
 *  bắt trình duyệt gọi thêm một `GET /api/don-hang` nữa là trả tiền hai vòng
 *  mạng cho cùng một phép tính. Dùng chung cho `sua-dong` và `bonus` — hai
 *  đường ghi mà mỗi lượt bấm đều làm đổi số trên đúng cái bảng đang mở.
 *
 *  Dựng lại HỎNG thì lượt ghi vẫn báo thành công — nó đã ghi rồi. Trả kết quả
 *  ghi mà khuyết `bang_moi`, và màn hình rơi về đường cũ (tự gọi lại GET).
 *  Ném ở đây là biến một lượt ghi ĐÃ XONG thành một thông báo lỗi đỏ, tức nói
 *  dối về thứ vừa xảy ra — và người dùng sẽ bấm lại. */
async function kemBangMoi(env, ky, than, rid, ketQua) {
  if (!than || (typeof than.line !== "string" && than.line !== null)) return ketQua;
  if (typeof than.line === "string" && than.line.length > 60)
    throw new LoiXacThuc(400, "line-khong-hop-le");
  try {
    return { ...ketQua, bang_moi: await dungBangDonHang(env, ky, than.line, rid) };
  } catch (e) {
    nhatKy({ rid, canh_bao: "dung-lai-bang-hong:"
      + ((e && (e.ly || e.message)) || "khong-ro") });
    return ketQua;
  }
}

/* =================== POST /api/sua-dong ===================
 * Sửa tay giá nhập / nơi nhập của một dòng, hoặc xoá dòng.
 *
 * Ghi vào `bc/quyetdinh/dong/<kỳ>/<khoá dòng>` — nhánh RIÊNG, cố ý không
 * chạm `bc/dong`. Đó là điều giữ cho quyết định sống qua mỗi lượt nhập lại:
 * lượt nhập đè trọn `bc/dong`, còn nhánh này không ai đè.
 *
 * Khoá dòng do Engine dựng theo công thức CLAUDE.md (số chứng từ, tên hàng
 * chuẩn hoá, lần xuất hiện thứ mấy) và đi kèm mỗi dòng trong bảng đơn. Màn
 * hình gửi lại đúng chuỗi ấy — KHÔNG tự dựng khoá, vì công thức khoá là một
 * luật nghiệp vụ (LUẬT SỐ 1).
 *
 * Mọi lượt ghi mang `boi` + `luc` — audit trail thật đầu tiên của V2.
 */
const suaDong = boc(true, async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const ky = than && than.ky;
  const khoa = than && typeof than.khoa === "string" ? than.khoa : "";
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  chanKyTuongLai(ky);
  if (!khoa || khoa.length > 400) throw new LoiXacThuc(400, "khoa-khong-hop-le");

  /* Khoá dòng đi thẳng vào một đường Firebase. `khoaDong()` đã thay mọi ký
     tự Firebase cấm bằng `~`, nên một khoá mang chúng là khoá KHÔNG do Engine
     dựng ra — từ chối thay vì sửa hộ. */
  if (/[.#$[\]/]/.test(khoa)) throw new LoiXacThuc(400, "khoa-khong-hop-le");

  /* `xoa: true` là một quyết định; `xoa: false` là RÚT LẠI quyết định đó.
     Hai thứ khác nhau, nên đọc theo kiểu chứ không theo tính đúng/sai. */
  const o = {};
  if (than.gia_nhap === null) o.gia_nhap = null;
  else if (than.gia_nhap !== undefined) {
    const n = Number(than.gia_nhap);
    if (!Number.isFinite(n) || n < 0) throw new LoiXacThuc(400, "gia-nhap-khong-hop-le");
    o.gia_nhap = Math.round(n);
  }
  if (than.noi_nhap === null) o.noi_nhap = null;
  else if (than.noi_nhap !== undefined) {
    const t = String(than.noi_nhap).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (t.length > 80) throw new LoiXacThuc(400, "noi-nhap-qua-dai");
    o.noi_nhap = t || null;
  }
  if (than.xoa === true) o.xoa = true;
  else if (than.xoa === false) o.xoa = null;

  if (!Object.keys(o).length) throw new LoiXacThuc(400, "khong-co-gi-de-ghi");

  /* Dấu vết người sửa đi CÙNG lượt ghi, không phải một lượt ghi thứ hai:
     hai lượt ghi thì có một khoảng mà quyết định đã có mà chưa biết của ai. */
  o.boi = nguoi.email || nguoi.uid;
  o.luc = { ".sv": "timestamp" };

  const r = await vaDb("bc/quyetdinh/dong/" + ky + "/" + khoa, o, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-quyet-dinh:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/sua-dong", ky, khoa,
           viec: Object.keys(o).filter((k) => k !== "boi" && k !== "luc") });

  /* ── TRẢ LUÔN BẢNG ĐÃ TÍNH LẠI (12/09/2026) ──
   *
   * Sửa giá nhập đổi lợi nhuận của dòng, của đơn, của ngày, quy đổi, tỉ lệ
   * tồn kho và tổng cả kỳ — sáu con số do ENGINE tính, nên trình duyệt không
   * được tự nhân trừ (LUẬT SỐ 1). Bản trước vì thế bảo màn hình gọi lại
   * `GET /api/don-hang`, và người sửa một ô phải ngồi chờ TRỌN một vòng mạng
   * thứ hai — đúng chỗ chủ dự án kêu "phải đợi một lúc mới thấy kết quả".
   *
   * Máy chủ vừa ghi xong đang đứng ngay cạnh mọi nguyên liệu để dựng lại
   * bảng ấy. Dựng luôn tại đây thì một lượt bấm = MỘT vòng mạng, và con số
   * hiện ra vẫn là con số Engine tính chứ không phải phỏng đoán của trình
   * duyệt. Không có gì phải đánh đổi: cùng một phép tính, ít hơn một vòng.
   *
   * Dựng lại HỎNG thì lượt GHI vẫn thành công — nó đã ghi rồi. Trả `ghi:
   * true` mà khuyết `bang`, và màn hình rơi về đường cũ (tự gọi lại GET).
   * Ném ở đây là biến một lượt ghi ĐÃ XONG thành một thông báo lỗi đỏ, tức
   * nói dối về thứ vừa xảy ra. */
  return kemBangMoi(env, ky, than, rid, { ghi: true, ky, khoa });
});

/* =================== POST /api/dat-kpi ===================
 * Đặt KPI / hệ số quy đổi cho MỘT line — mặc định, hoặc riêng một kỳ.
 *
 * `ky` vắng  → ghi `bc/quyetdinh/kpi/mac_dinh/<line>`, áp cho MỌI kỳ.
 * `ky` có    → ghi `bc/quyetdinh/kpi/ky/<kỳ>/<line>`, chỉ kỳ đó.
 *
 * Chủ dự án chốt 12/09/2026: "mặc định chung + ghi đè từng kỳ". Hai tầng này
 * hợp nhất LÚC ĐỌC và hợp nhất THEO TỪNG TRƯỜNG (`hanhKpi()` của Engine) —
 * đặt riêng KPI tháng 9 thì hệ số vẫn là mặc định chứ không biến mất. Đường
 * này vì vậy chỉ ghi đúng những trường người dùng vừa gõ, không bao giờ ghi
 * cả bản: `vaDb` (PATCH) chứ không `ghiDb` (PUT).
 *
 * ĐƠN VỊ, chỗ dễ sai 1.000 lần: màn hình gửi KPI bằng NGHÌN đồng (ô nhập nói
 * "nghìn đ", và chủ dự án gõ "2.700.000" cho 2 tỷ 7). Nhân 1.000 Ở ĐÂY, tại
 * BIÊN — nhánh Firebase luôn là ĐỒNG. Cùng kỷ luật `min_price` của P4: đơn
 * vị được quy đổi ở biên, không bao giờ để hai đơn vị cùng sống một nhánh.
 *
 * CHỈ QUẢN TRỊ. Đây là mục tiêu kinh doanh và là vế chia của mọi con số quy
 * đổi — đổi một hệ số là đổi mọi báo cáo của mọi tháng. Quản lí vẫn ĐỌC được
 * (rules của `bc/quyetdinh` mở cho cả hai vai) nhưng không đặt được.
 */
const datKpi = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const line = than && typeof than.line === "string" ? than.line.trim() : "";
  if (!line || line.length > 60) throw new LoiXacThuc(400, "line-khong-hop-le");
  /* Tên line đi thẳng vào một đường Firebase. Bảng line là DỮ LIỆU người sửa
     được, nên một tên mang ký tự Firebase cấm là chuyện có thể xảy ra thật —
     từ chối thay vì sửa hộ, cùng cách `suaDong` xử khoá dòng. */
  if (/[.#$[\]/]/.test(line)) throw new LoiXacThuc(400, "line-khong-hop-le");

  const ky = than && than.ky !== undefined && than.ky !== null ? than.ky : null;
  if (ky !== null && !laKy(ky)) throw new LoiXacThuc(400, "ky-khong-hop-le");

  const o = {};
  /* `null` là RÚT LẠI một con số (về mặc định, hoặc về "chưa đặt"); vắng mặt
     là "không nhắc tới". Hai thứ khác nhau, nên đọc theo KIỂU chứ không theo
     tính đúng/sai — cùng cách `suaDong` đọc `xoa`. */
  if (than.kpi === null) o.kpi = null;
  else if (than.kpi !== undefined) {
    const n = Number(than.kpi);
    if (!Number.isFinite(n) || n <= 0) throw new LoiXacThuc(400, "kpi-khong-hop-le");
    /* NGHÌN đồng → ĐỒNG. Làm tròn vì ô nhập cho gõ số lẻ. */
    o.kpi = Math.round(n * 1000);
  }
  for (const t of ["he_so_pt", "he_so_gia_dung_pt"]) {
    if (than[t] === null) { o[t] = null; continue; }
    if (than[t] === undefined) continue;
    const n = Number(than[t]);
    /* Trần 100%: chốt ĐƠN VỊ, không chốt nghiệp vụ. Một hệ số gõ lẫn dạng
       phân số (0,075 thay vì 7,5) vẫn là số dương hợp lệ, nên trần này không
       bắt được ca ấy — nhưng nó bắt ca ngược (gõ 750) và nó nói thẳng nhánh
       này đo bằng phần trăm. Engine canh lại lần nữa lúc đọc. */
    if (!Number.isFinite(n) || n <= 0 || n > 100)
      throw new LoiXacThuc(400, "he-so-khong-hop-le:" + t);
    o[t] = n;
  }
  if (!Object.keys(o).length) throw new LoiXacThuc(400, "khong-co-gi-de-ghi");

  /* Dấu vết người sửa đi CÙNG lượt ghi, không phải một lượt ghi thứ hai: hai
     lượt thì có một khoảng mà con số đã đổi mà chưa biết của ai. */
  o.boi = nguoi.email || nguoi.uid;
  o.luc = { ".sv": "timestamp" };

  const duong = ky === null
    ? DUONG_BANG_KPI + "/mac_dinh/" + line
    : DUONG_BANG_KPI + "/ky/" + ky + "/" + line;
  const r = await vaDb(duong, o, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-kpi:" + chiTietLoi(r));

  /* KHÔNG dội lại con số đang áp ở đây, dù Engine có sẵn `hanhKpi()` cho
     việc đó. Màn hình tải lại cả bảng ngay sau lượt ghi — nó BUỘC phải tải,
     vì đổi một hệ số là đổi mọi con số quy đổi cộng tổng line và phần trăm
     đạt (LUẬT SỐ 1, Engine tính) — và lượt tải ấy đã mang về đúng con số
     đang áp sau hợp nhất. Dội thêm ở đây là một lượt đọc Firebase cộng một
     lượt gọi Engine cho mỗi ô người dùng gõ, lấy về một con số không ai đọc.

     Điều đáng lo thật — "đặt mặc định trong khi kỳ đang xem CÓ bản ghi đè thì
     con số đang áp KHÔNG đổi" — vẫn hiện đúng, vì lượt tải lại đọc qua đúng
     phép hợp nhất của Engine và ô sẽ mang viền xanh "riêng tháng này". */
  nhatKy({ rid, uid: nguoi.uid, duong: "/api/dat-kpi", line, ky,
           viec: Object.keys(o).filter((k) => k !== "boi" && k !== "luc") });
  return { ghi: true, line, ky };
});

/* =================== POST /api/dat-cong ===================
 * Ngày công của MỘT line trong MỘT kỳ.
 *
 * Chủ dự án chốt 12/09/2026: *"Ngày công: tự điền theo thực tế"*, và
 * *"Quản trị nhập theo từng tháng"*. Nên đường này KHÔNG có tầng "mặc định
 * chung" như `dat-kpi`: một tháng có bao nhiêu ngày công là chuyện của đúng
 * tháng ấy, không có giá trị nào áp cho mọi tháng. `ky` vì vậy BẮT BUỘC.
 *
 * Ghi `bc/quyetdinh/cong/<kỳ>/<line>` — nhánh RIÊNG, không bị lượt nhập sổ
 * đè, hợp nhất lúc ĐỌC (CLAUDE.md — "Nhập sổ"). Nhập lại sổ tháng 9 không
 * xoá mất ngày công đã gõ.
 *
 * ĐƠN VỊ: `ngay_cong` là SỐ NGÀY, không phải tiền — không nhân 1.000 ở biên
 * như `dat-kpi`. Cho phép số lẻ (nửa ngày công là chuyện có thật), trần 31 vì
 * không tháng nào dài hơn thế và một con số lớn hơn chắc chắn là gõ nhầm —
 * mà gõ nhầm ở đây thì lương cứng nhân thẳng theo tỉ lệ.
 *
 * CHỈ QUẢN TRỊ, cùng mức với `dat-kpi`: đây là vế nhân của lương cứng và phụ
 * cấp. Quản lí vẫn ĐỌC được.
 */
const datCong = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const line = than && typeof than.line === "string" ? than.line.trim() : "";
  if (!line || line.length > 60) throw new LoiXacThuc(400, "line-khong-hop-le");
  /* Tên line đi thẳng vào một đường Firebase — từ chối ký tự cấm thay vì sửa
     hộ, cùng cách `datKpi` xử. */
  if (/[.#$[\]/]/.test(line)) throw new LoiXacThuc(400, "line-khong-hop-le");

  const ky = than && than.ky;
  if (!laKy(ky)) throw new LoiXacThuc(400, "ky-khong-hop-le");
  chanKyTuongLai(ky);

  const duong = DUONG_NGAY_CONG + "/" + ky + "/" + line;

  /* `null` là XOÁ hẳn ô ngày công, về lại "chưa nhập" — khác hẳn gõ số 0
     ("tháng này không đi làm ngày nào"). Hai câu khác nhau, và cột Lương
     cứng hiện hai thứ khác nhau: "—" so với "0". Xoá thì bỏ hẳn bản ghi,
     không ghi `ngay_cong: null`, cùng lý do `gia-dung` đã chọn. */
  if (than.ngay_cong === null) {
    const x = await xoaDb(duong, env);
    if (!x.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-cong:" + chiTietLoi(x));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/dat-cong", line, ky, viec: "xoa" });
    return { ghi: true, line, ky, ngay_cong: null };
  }

  const n = Number(than.ngay_cong);
  if (!Number.isFinite(n) || n < 0 || n > 31)
    throw new LoiXacThuc(400, "ngay-cong-khong-hop-le");

  const r = await vaDb(duong, {
    ngay_cong: n,
    /* Dấu vết người sửa đi CÙNG lượt ghi — hai lượt thì có một khoảng con số
       đã đổi mà chưa biết của ai. */
    boi: nguoi.email || nguoi.uid,
    luc: { ".sv": "timestamp" },
  }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-cong:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/dat-cong", line, ky, ngay_cong: n });
  return { ghi: true, line, ky, ngay_cong: n };
});

/* =================== POST /api/gia-dung ===================
 * Đánh dấu MỘT MẶT HÀNG là gia dụng, hoặc rút lại dấu ấy.
 *
 * Chủ dự án chốt 12/09/2026: ô tick nằm trong ô Mã sản phẩm của tab Nội
 * thành, và nó là quyết định về MỘT MẶT HÀNG — nên khoá là `khoa_ten` (công
 * thức CLAUDE.md quy định cho loại quyết định này) và nó áp cho MỌI kỳ, kể
 * cả kỳ chưa nhập. Tick một lần, tháng sau không phải tick lại.
 *
 * Khoá do ENGINE dựng và đi kèm mỗi dòng trong bảng đơn (`khoa_ten`). Màn
 * hình gửi lại đúng chuỗi ấy — KHÔNG tự dựng khoá, vì công thức khoá là một
 * luật khớp mã (LUẬT SỐ 1). Cùng lối `suaDong` xử khoá dòng.
 *
 * Vì sao chỉ Quản trị: dấu này là vế chia của doanh số quy đổi trên tab Nội
 * thành (8% thay vì 2%, tức lệch 4 lần), và nó áp cho MỌI kỳ — tick sai một
 * mặt hàng là đổi số của cả quá khứ. Cùng mức với `dat-kpi`.
 */
const datGiaDung = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const khoa = than && typeof than.khoa === "string" ? than.khoa.trim() : "";
  if (!khoa || khoa.length > 120) throw new LoiXacThuc(400, "khoa-khong-hop-le");
  /* `khoaTenHang()` trả `N_` + chỉ A-Z0-9, nên một khoá ngoài khuôn ấy là
     khoá KHÔNG do Engine dựng — từ chối thay vì sửa hộ. Chặt hơn hẳn phép
     lọc ký tự cấm của `suaDong`, và chặt được vì khuôn ở đây rất hẹp. */
  if (!/^N_[A-Z0-9]*$/.test(khoa)) throw new LoiXacThuc(400, "khoa-khong-hop-le");
  if (typeof than.gia_dung !== "boolean") throw new LoiXacThuc(400, "thieu-gia-dung");

  /* Rút lại thì XOÁ hẳn bản ghi, không ghi `gia_dung: false`. Nhánh này chỉ
     nên chứa những mặt hàng ĐANG là gia dụng — giữ lại một bản ghi "không
     phải gia dụng" là để nhánh phình theo số lần người ta bấm thử, và làm
     "có mặt trong nhánh" hết còn nghĩa. */
  const r = than.gia_dung
    ? await vaDb(DUONG_GIA_DUNG + "/" + khoa,
        { gia_dung: true, boi: nguoi.email || nguoi.uid, luc: { ".sv": "timestamp" } }, env)
    : await xoaDb(DUONG_GIA_DUNG + "/" + khoa, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-gia-dung:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/gia-dung", khoa, gia_dung: than.gia_dung });
  return { ghi: true, khoa, gia_dung: than.gia_dung };
});

/* =================== GET /api/phan-loai/muc ===================
 * Danh sách hãng và ngành hàng CÓ THẬT trên bảng giá Tracking — nguồn của
 * trình phân loại thủ công.
 *
 * Danh sách ĐÓNG, và đó là điểm cả đường này đứng hay đổ. CLAUDE.md cấm dựng
 * bộ phân loại thương hiệu thứ hai; luật ấy không bị nới bởi "người dùng tự
 * gõ" — một ô gõ tự do CHÍNH LÀ một danh sách hãng thứ hai, chỉ là nó được
 * gõ dần mỗi lần một dòng, và không ai thấy nó lớn lên. Nên màn hình CHỌN,
 * và `POST /api/phan-loai` bên dưới đối chiếu lại đúng danh sách này.
 *
 * Tracking hỏng thì 503, KHÔNG trả danh sách rỗng: một trình chọn rỗng đọc
 * lên thành "Tracking không có hãng nào" (CLAUDE.md — nguồn hỏng thì báo
 * lỗi). Engine ném cho đúng ca ấy; ở đây chỉ dịch ra mã lỗi.
 */
const layMucPhanLoai = boc(true, async ({ env, rid }) => {
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");
  /* Bản Engine cũ (khoảng giữa hai lượt deploy song song — bẫy số 4) chưa có
     cửa này. Nói thẳng bằng một mã lỗi riêng thay vì để `undefined is not a
     function` nổ thành 503 không tên. */
  if (!env.REPORT_ENGINE.mucPhanLoai)
    throw new LoiXacThuc(503, "engine-chua-co-muc-phan-loai");

  let nguon;
  try {
    nguon = await docNguonTracking(env);
  } catch (e) {
    if (!(e instanceof LoiTracking)) throw e;
    nhatKy({ rid, duong: "/api/phan-loai/muc", canh_bao: "tracking-hong:" + e.ly });
    throw new LoiXacThuc(503, "tracking-hong:" + e.ly);
  }
  try {
    return await env.REPORT_ENGINE.mucPhanLoai(nguon);
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-muc-phan-loai:" + (e && e.message));
  }
});

/* =================== POST /api/phan-loai ===================
 * Gán hãng + ngành hàng cho MỘT MẶT HÀNG không có mã bảng giá, hoặc rút lại.
 *
 * Chủ dự án chốt 19/09/2026. Đường này HẸP HƠN `/api/gan-ma`: nó không cho
 * ra mã, không cho ra giá vốn, không đụng `inv/map`. Xem đầu file
 * `engine/src/phan-loai.mjs` cho lý do nó tồn tại bên cạnh gán mã.
 *
 * Khoá do ENGINE dựng và đi kèm mỗi dòng (`khoa_ten`); màn hình gửi lại đúng
 * chuỗi ấy và KHÔNG tự dựng khoá — công thức khoá là một luật khớp mã (LUẬT
 * SỐ 1). Cùng lối `datGiaDung`, kể cả phép soi khuôn `N_[A-Z0-9]*`.
 *
 * ĐỐI CHIẾU LẠI DANH SÁCH ĐÓNG Ở ĐÂY, không tin trình chọn. Trình chọn là
 * màn hình, và màn hình thì sửa được bằng Console. Chốt duy nhất giữ cho
 * nhánh này không thành một danh sách hãng thứ hai phải nằm ở phía máy chủ.
 *
 * Chuỗi ghi xuống là chuỗi CHÍNH TẮC lấy từ bảng giá, không phải chuỗi màn
 * hình gửi lên: "samsung" gõ lệch hoa thường mà ghi nguyên là một hãng thứ
 * mười một không có màu, đứng riêng một mảng cạnh Samsung thật.
 *
 * Cả hai vai, cùng mức `/api/gan-ma`: đây là hai cái NHÃN, không phải tiền.
 */
const datPhanLoai = boc(true, async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const khoa = than && typeof than.khoa === "string" ? than.khoa.trim() : "";
  if (!khoa || khoa.length > 120) throw new LoiXacThuc(400, "khoa-khong-hop-le");
  if (!/^N_[A-Z0-9]*$/.test(khoa)) throw new LoiXacThuc(400, "khoa-khong-hop-le");
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  const xin = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const hangXin = xin(than.hang), nganhXin = xin(than.nganh);
  if ((hangXin && hangXin.length > 120) || (nganhXin && nganhXin.length > 120))
    throw new LoiXacThuc(400, "qua-dai");

  /* RÚT LẠI = xoá hẳn bản ghi, không ghi hai ô rỗng. Cùng kỷ luật
     `datGiaDung`: nhánh này chỉ nên chứa những mặt hàng ĐANG có quyết định,
     không thì "có mặt trong nhánh" hết còn nghĩa và nhánh phình theo số lần
     người ta bấm thử. */
  if (!hangXin && !nganhXin) {
    const r = await xoaDb(DUONG_PHAN_LOAI + "/" + khoa, env);
    if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-phan-loai:" + chiTietLoi(r));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/phan-loai", khoa, rut: true });
    return { ghi: true, khoa, hang: null, nganh: null };
  }

  if (!env.REPORT_ENGINE.mucPhanLoai)
    throw new LoiXacThuc(503, "engine-chua-co-muc-phan-loai");
  let muc;
  try {
    muc = await env.REPORT_ENGINE.mucPhanLoai(await docNguonTracking(env));
  } catch (e) {
    if (e instanceof LoiTracking) {
      nhatKy({ rid, duong: "/api/phan-loai", canh_bao: "tracking-hong:" + e.ly });
      throw new LoiXacThuc(503, "tracking-hong:" + e.ly);
    }
    throw new LoiXacThuc(503, "engine-loi-muc-phan-loai:" + (e && e.message));
  }

  /* Dò không phân biệt hoa thường rồi lấy CHUỖI CHÍNH TẮC của bảng giá —
     xem phần đầu khối chú thích. */
  const chinhTac = (ds, v) => {
    if (!v) return null;
    const k = v.toLowerCase();
    return ds.find((x) => x.toLowerCase() === k) || null;
  };
  const hang = chinhTac(muc.hang, hangXin);
  const nganh = chinhTac(muc.nganh, nganhXin);
  /* `choNguoi` — ngoại lệ có chủ ý với "lý do nội bộ không ra màn hình", cùng
     lối đường đẩy Google Sheet đã mở. Đây đúng là lỗi NGƯỜI DÙNG sửa được, và
     là ca họ sẽ gặp thật: giấu nó sau câu chung "Dữ liệu gửi lên không hợp
     lệ" là để một người vừa chọn xong đứng đoán mình sai ở đâu. Câu chữ tự
     viết, KHÔNG nhét nguyên văn phản hồi của Tracking vào. */
  const cauNgoai = (ten) => ten + " này không có trên bảng giá Tracking. "
    + "Thêm bên Bảng giá trước, rồi quay lại chọn.";
  if (hangXin && !hang)
    throw new LoiXacThuc(400, "hang-khong-co-tren-bang-gia", cauNgoai("Hãng"));
  if (nganhXin && !nganh)
    throw new LoiXacThuc(400, "nganh-khong-co-tren-bang-gia", cauNgoai("Ngành hàng"));

  const r = await vaDb(DUONG_PHAN_LOAI + "/" + khoa,
    { hang, nganh, boi: nguoi.email || nguoi.uid, luc: { ".sv": "timestamp" } }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-phan-loai:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/phan-loai", khoa, hang, nganh });
  return { ghi: true, khoa, hang, nganh };
});

/* =================== POST /api/nap-kpi ===================
 * Nạp bộ số KPI / hệ số MẶC ĐỊNH — lượt khởi tạo đầu tiên.
 *
 * VÌ SAO ĐƯỜNG NÀY TỒN TẠI. Trước nó, nạp lượt đầu bắt buộc chạy
 * `bin/nap-kpi.mjs` dưới máy, tức phải tải khoá service account Firebase về.
 * Chủ dự án không clone repo trên máy — và bắt tải khoá admin của một
 * Firebase dùng chung với Marketing về một máy, chỉ để đặt 10 con số, là cái
 * giá không đáng trả. Gateway đã giữ khoá làm Secret sẵn, nên nó hỏi Engine
 * bộ số rồi tự ghi: không ai phải chạm vào khoá riêng lần nào.
 *
 * CHỈ CHẠY KHI NHÁNH CÒN RỖNG, và đó là cả thiết kế của đường này — nó là
 * nút KHỞI TẠO, không phải nút đặt-lại. Nhờ vậy nó không thể nào xoá mất một
 * con số chủ dự án đã sửa trên màn hình, kể cả khi bấm nhầm hai lần, kể cả
 * sau này. Muốn đặt lại toàn bộ thì đó là một việc khác, cần một lượt bàn
 * khác — không lẳng lặng gói vào cùng một nút.
 *
 * `ghiDb` (PUT) ở đây là ĐÚNG, khác `dat-kpi` dùng `vaDb` (PATCH): lượt này
 * dựng cả cây từ rỗng, không hợp nhất vào gì cả. Và vì đã chặn "chỉ khi
 * rỗng" nên PUT không đè được của ai.
 *
 * CHỈ QUẢN TRỊ, cùng mức `dat-kpi`: nó đặt mục tiêu kinh doanh của mọi line.
 */
const napKpi = boc("quantri", async ({ nguoi, env, rid }) => {
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  /* Đọc NÔNG: chỉ cần biết nhánh có gì chưa, không cần kéo cả cây về. */
  const dangCo = await docDbNong(DUONG_BANG_KPI, env);
  if (!dangCo.ok)
    throw new LoiXacThuc(503, "khong-doc-duoc-kpi:" + chiTietLoi(dangCo));
  if (dangCo.val && Object.keys(dangCo.val).length) {
    /* KHÔNG phải lỗi máy chủ — là một lời từ chối có lý do, nên trả 200 kèm
       `ghi: false` để màn hình nói được câu đúng ("đã có bộ số rồi, sửa trên
       dải setup"). Trả 4xx ở đây sẽ hiện thành "Dữ liệu gửi lên không hợp
       lệ", một câu sai và làm người dùng đi tìm sai chỗ. */
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/nap-kpi", tu_choi: "da-co-bo-so" });
    return { ghi: false, ly_do: "da-co-bo-so" };
  }

  /* Bộ số là một quyết định NGHIỆP VỤ nên nó ở Engine, Gateway chỉ đi lấy
     (LUẬT SỐ 1). Chép một bản sang đây là dựng bản thứ hai của mục tiêu kinh
     doanh, và chỗ hai bản trôi khỏi nhau là chỗ không ai thấy. */
  let hat;
  try {
    hat = await env.REPORT_ENGINE.bangKpiHatGiong();
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-hat-giong:" + (e && e.message));
  }

  /* Kiểm TRƯỚC khi ghi, bằng chính phép kiểm của Engine. Dư thừa trên giấy
     (hằng số đã có bài kiểm ghim) nhưng rẻ, và nó canh đúng ca một lượt sửa
     hằng số lọt qua: bộ kiểm chạy ở lượt build, còn cái này chạy ở lượt GHI. */
  const van_de = await env.REPORT_ENGINE.kiemBangKpi(hat);
  if (van_de.length) {
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/nap-kpi", hat_giong_sai: van_de });
    throw new LoiXacThuc(503, "hat-giong-khong-hop-le");
  }

  const r = await ghiDb(DUONG_BANG_KPI, hat, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-kpi:" + chiTietLoi(r));

  /* Đọc ngược để xác nhận — KHÔNG tin lời chính mình, cùng kỷ luật
     `--doc-lai` của mọi script nạp trong repo này. Ghi xong mà đọc lại rỗng
     là lượt ghi đã thất bại lặng lẽ, và đó là thứ phải lộ ra ngay bây giờ
     chứ không phải lúc chủ dự án mở màn hình thấy bảng trống. */
  const lai = await docDbNong(DUONG_BANG_KPI, env);
  const soLine = lai.ok && lai.val && lai.val.mac_dinh
    ? Object.keys(hat.mac_dinh || {}).length : 0;
  if (!soLine) throw new LoiXacThuc(503, "ghi-roi-doc-lai-rong");

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/nap-kpi", so_line: soLine });
  return { ghi: true, so_line: soLine };
});

/* =================== GET /api/ma-bang-gia ===================
 * Danh sách mã trên bảng giá Tracking, cho ô chọn của màn gán tay.
 *
 * Trình duyệt KHÔNG bao giờ gọi thẳng Tracking: khoá `X-Report-Key` là bí
 * mật của Worker, và CSP của trang cũng chỉ mở `connect-src 'self'`. Đường
 * này là cách duy nhất danh sách ấy tới được màn hình.
 *
 * Chỉ ba trường (`ma`, `ten`, `nhom`) — xem `docMaBangGia()` cho lý do dựng
 * từ danh sách trắng thay vì chuyển tiếp nguyên văn.
 */
const layMaBangGia = boc(true, async ({ env }) => {
  try {
    return { ds: await docMaBangGia(env) };
  } catch (e) {
    if (e instanceof LoiTracking) throw new LoiXacThuc(503, "tracking-hong:" + e.ly);
    throw e;
  }
});

/* =================== POST /api/gan-ma ===================
 * Gán một câu tên hàng vào một mã bảng giá, hoặc "bỏ qua" ("-").
 *
 * Quyết định được ghi SANG TRACKING (`POST /api/inv-map`), không ghi vào một
 * nhánh riêng của Báo cáo. Đó là điểm mấu chốt: `inv/map` là bản đồ nhận
 * dạng DÙNG CHUNG — màn Tồn kho, PHB-01 và Báo cáo cùng đọc một chỗ. Ghi
 * riêng một bản là hai app có hai câu trả lời khác nhau cho cùng một mặt
 * hàng, và không ai biết cho tới lúc giá vốn lệch.
 *
 * Ba chốt an toàn nằm ở PHÍA TRACKING (mã có thật, mã còn dùng, NB-2 dòng
 * tồn đang hoạt động). Bên này KHÔNG chép lại chúng — chép là dựng bản luật
 * thứ hai, và chỗ hai bản trôi khỏi nhau là chỗ một quyết định sai nằm im.
 */
const ganMa = boc(true, async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const ten = than && typeof than.ten === "string" ? than.ten : "";
  const ma = than && typeof than.ma === "string" ? than.ma.trim() : "";
  if (!ten.trim()) throw new LoiXacThuc(400, "thieu-ten");
  if (!ma) throw new LoiXacThuc(400, "thieu-ma");
  if (ten.length > 300 || ma.length > 120) throw new LoiXacThuc(400, "qua-dai");
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  /* Khoá do ENGINE tính — công thức khoá là một luật khớp mã, và luật thì ở
     Engine (LUẬT SỐ 1). Gateway chỉ cầm nó đi đối chiếu. */
  const khoaMongDoi = await env.REPORT_ENGINE.khoaTenHang(ten);

  let kq;
  try {
    kq = await ghiPhanLoai(env, ten, ma);
  } catch (e) {
    if (!(e instanceof LoiTracking)) throw e;
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/gan-ma", tu_choi: e.ly });
    return { ghi: false, ly_do: e.ly, cau: cauLoiPhanLoai(e.ly) };
  }

  /* HAI REPO, MỘT CÔNG THỨC KHOÁ. Tracking dội lại khoá do chính nó tính;
     lệch với khoá Engine tính nghĩa là hai bản công thức đã trôi khỏi nhau.
     Nổ NGAY tại đây — nếu không, quyết định vừa ghi nằm ở một ô mà Báo cáo
     sẽ không bao giờ đọc tới, và triệu chứng duy nhất là "gán rồi mà vẫn
     hiện chưa gán", một thứ rất khó lần ra. */
  if (kq.khoa !== khoaMongDoi) {
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/gan-ma",
             khoa_lech: { engine: khoaMongDoi, tracking: kq.khoa } });
    throw new LoiXacThuc(503, "khoa-lech-hai-repo");
  }

  return { ghi: true, khoa: kq.khoa, ma: kq.ma };
});

/* =================== POST /api/bonus ===================
 * Bonus lợi nhuận cho MỘT ĐƠN — chủ dự án chốt 12/09/2026.
 *
 * Khoá là SỐ CHỨNG TỪ (bền qua lần nhập lại; xem `engine/src/bonus.mjs`).
 * Chỉ vai `quantri`: đây là tiền cộng thẳng vào lợi nhuận rồi vào doanh số
 * quy đổi, tức vào bảng lương — cùng mức khoá với `/api/dat-kpi`.
 *
 * LÝ DO LÀ BẮT BUỘC, và chặn ở CẢ HAI đầu (màn hình và ở đây). Một khoản
 * tiền cộng thêm mà không nói vì sao thì tháng sau không ai đối chiếu lại
 * được, kể cả chính người đã gõ nó. Engine cũng bỏ qua bản ghi thiếu lý do —
 * ba lớp, vì mất một khoản này là mất tiền lương của người thật.
 */
const datBonus = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const ky = than && than.ky;
  const so_ct = than && typeof than.so_ct === "string" ? than.so_ct.trim() : "";
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  chanKyTuongLai(ky);
  /* Số chứng từ đi thẳng vào ĐƯỜNG DẪN Firebase, nên khuôn phải hẹp. MISA
     cấp dạng `BH73891`; chấp nhận chữ-số-gạch để không từ chối một biến thể
     hợp lệ, nhưng KHÔNG bao giờ chấp nhận `.`, `#`, `$`, `[`, `]`, `/` —
     Firebase cấm chúng trong khoá, và một khoá lọt qua đây là một lượt ghi
     hỏng ở tận tầng dưới với thông báo không ai đọc được. */
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(so_ct)) throw new LoiXacThuc(400, "so-ct-khong-hop-le");

  /* Xoá bonus: gửi `tien: null`. Xoá HẲN bản ghi chứ không ghi `tien: 0` —
     cùng lý do `gia-dung` xoá hẳn: một bản ghi "bonus bằng 0" làm "có mặt
     trong nhánh" hết còn nghĩa, và nhánh phình theo số lần bấm thử. */
  if (than.tien === null) {
    const r = await xoaDb(DUONG_BONUS + "/" + ky + "/" + so_ct, env);
    if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-bonus:" + chiTietLoi(r));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/bonus", ky, so_ct, viec: "xoa" });
    return kemBangMoi(env, ky, than, rid, { ghi: true, ky, so_ct });
  }

  const tien = Number(than.tien);
  if (!Number.isFinite(tien) || tien <= 0) throw new LoiXacThuc(400, "tien-khong-hop-le");
  /* Trần 100 triệu: bonus là khoản cộng thêm vài chục nghìn tới vài trăm
     nghìn. Một con số lớn hơn thế gần như chắc chắn là gõ thừa số 0 — và nó
     đi thẳng vào doanh số quy đổi rồi vào lương, nên thà chặn một ca thật
     hiếm còn hơn trả một bảng lương sai mà không ai soi lại. */
  if (tien > 100000000) throw new LoiXacThuc(400, "tien-qua-lon");

  const ly_do = typeof than.ly_do === "string"
    ? than.ly_do.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!ly_do) throw new LoiXacThuc(400, "thieu-ly-do");
  if (ly_do.length > 120) throw new LoiXacThuc(400, "ly-do-qua-dai");

  /* Dấu vết người sửa đi CÙNG lượt ghi, không phải một lượt ghi thứ hai:
     hai lượt ghi thì có một khoảng mà quyết định đã có mà chưa biết của ai. */
  const r = await vaDb(DUONG_BONUS + "/" + ky + "/" + so_ct,
    { tien: Math.round(tien), ly_do,
      boi: nguoi.email || nguoi.uid, luc: { ".sv": "timestamp" } }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-bonus:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/bonus", ky, so_ct, tien: Math.round(tien) });
  return kemBangMoi(env, ky, than, rid, { ghi: true, ky, so_ct });
});

/* =================== KÍCH HOẠT BẢO HÀNH (19/09/2026) ===================
 *
 * Tab thứ hai của app, ngang hàng [Báo cáo bán hàng]. Nó KHÔNG phải một cách
 * xem doanh số khác — nó là một DANH SÁCH VIỆC: mỗi dòng còn ở đây nghĩa là
 * còn một cái máy ngoài đời chưa được kích hoạt bảo hành trên cổng của hãng.
 *
 * Năm đường dưới đây, và ai đi được đường nào (chủ dự án chốt 19/09/2026):
 *
 *   GET  /api/bao-hanh            quantri | quanly   đọc danh sách + hướng dẫn
 *   POST /api/kich-hoat           quantri | quanly   tick "đã kích hoạt"
 *   POST /api/bao-hanh/dang-nhap  quantri            sửa User/Pass của hãng
 *   POST /api/bao-hanh/buoc       quantri            thêm/sửa/xoá một bước
 *   POST /api/bao-hanh/anh        quantri            tải ảnh hướng dẫn lên
 *   GET  /api/bao-hanh/anh        quantri | quanly   xem ảnh hướng dẫn
 *
 * Vì sao TICK mở cho cả Quản lí còn HƯỚNG DẪN thì không: kích hoạt là việc
 * làm hằng ngày, khoá nó lại là bắt Quản trị làm thay mỗi cái máy. Còn
 * User/Pass và các bước là thứ khai một lần rồi cả phòng đọc theo — sửa
 * nhầm một bước là cả phòng làm sai theo mà không ai biết đã sai từ đâu.
 */

/** Tên hãng CHÍNH THỨC, hỏi Engine — Gateway KHÔNG giữ danh sách hãng.
 *
 *  Danh sách mười hãng là một quyết định nghiệp vụ (LUẬT SỐ 1), và hai bản
 *  thì trôi khỏi nhau: chỗ trôi ở đây là một hãng ghi được dữ liệu vào
 *  Firebase mà không tab nào trên màn hình hiện nó ra. */
async function hangBaoHanhHopLe(env, s) {
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");
  if (typeof s !== "string" || s.length > 40) throw new LoiXacThuc(400, "hang-khong-hop-le");
  let ten = null;
  try { ten = await env.REPORT_ENGINE.chuanHoaHangBaoHanh(s); }
  catch (e) { throw new LoiXacThuc(503, "engine-loi-hang:" + (e && e.message)); }
  if (!ten) throw new LoiXacThuc(400, "hang-khong-hop-le");
  return ten;
}

/** Cắt gọn một câu người gõ trước khi cho nó vào Firebase.
 *
 *  Bỏ ký tự điều khiển (trừ xuống dòng, thứ hướng dẫn nhiều bước thật sự
 *  cần) và cắt theo trần. Trần là thứ bắt buộc: nhánh này đọc TRỌN mỗi lượt
 *  mở màn hình, nên một ô người dán nhầm cả trang web vào sẽ làm chậm mọi
 *  lượt mở sau đó mà không ai biết vì sao. */
function cauNguoiGo(v, tran) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, tran).trim();
}

const TRAN_USER = 120;
const TRAN_MAT_KHAU = 200;
const TRAN_HUONG_DAN = 2000;
const TRAN_CHU_BUOC = 2000;

/* =================== GET /api/bao-hanh ===================
 * Danh sách máy chưa kích hoạt của MỘT KỲ, chia sẵn theo mười hãng, cộng
 * hướng dẫn của từng hãng.
 *
 * DÙNG LẠI `dungBangDonHang()` — chính hàm dựng bảng của tab [Báo cáo bán
 * hàng] — chứ không đọc thẳng `bc/dong` rồi tự lọc. Đó là cách DUY NHẤT để
 * hai tab nói cùng một sự thật về cùng một dòng: hãng chỉ có sau khi khớp
 * mã bảng giá, hàng trả lại chỉ lộ ra sau `apDungBTL`, và một dòng bị XOÁ
 * TAY phải biến khỏi CẢ tab này. Dựng lại một đường đọc thứ hai là dựng lại
 * cả chuỗi luật ấy, và hai bản sẽ trôi khỏi nhau đúng lúc không ai để ý.
 *
 * `loi_nguon_ma` đi kèm phản hồi và màn hình BẮT BUỘC nói ra: Tracking hỏng
 * thì không dòng nào có hãng, tức mười tab cùng rỗng. Một sự cố mạng không
 * được phép nói "không còn máy nào phải kích hoạt" thay người (CLAUDE.md).
 */
const layBaoHanh = boc(true, async ({ request, env, rid }) => {
  const q = new URL(request.url).searchParams;
  const ky = q.get("ky");
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  /* Ba lượt đọc SONG SONG: bảng đơn (nặng nhất, tự nó đã gom nhiều nguồn),
     nhánh tick của kỳ, nhánh hướng dẫn. Chúng không phụ thuộc nhau, nên xếp
     hàng ba lượt là trả tiền chờ cho không. */
  const [kqBang, tick, huongDan] = await Promise.all([
    dungBangDonHang(env, ky, null, rid),
    docDb(DUONG_KICH_HOAT + "/" + ky, env),
    docDb(DUONG_BAO_HANH, env),
  ]);

  /* Nhánh tick hỏng thì DỪNG, không coi như "chưa ai tick": mọi máy đã làm
     xong sẽ hiện trở lại thành việc phải làm, và người dùng đi kích hoạt
     lần thứ hai cho cả tháng. */
  if (!tick.ok) throw new LoiXacThuc(503, "khong-doc-duoc-kich-hoat:" + chiTietLoi(tick));
  if (!huongDan.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bao-hanh:" + chiTietLoi(huongDan));

  let ds;
  try {
    ds = await env.REPORT_ENGINE.dsKichHoatBaoHanh(kqBang.bang, tick.val || {}, huongDan.val || {});
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-bao-hanh:" + (e && e.message));
  }

  /* KHÔNG chuyển tiếp `co_gia_von`: tab bảo hành không hiện một đồng tiền
     nào, nên "tháng này có giá vốn không" là một câu trả lời không ai ở đây
     hỏi. `loi_nguon_ma` thì ngược lại — Tracking hỏng là không dòng nào có
     hãng, tức mười tab cùng rỗng, và màn hình phải nói ra. */
  return { ky, ...ds, loi_nguon_ma: kqBang.loi_nguon_ma };
});

/* =================== POST /api/kich-hoat ===================
 * Tick "cái máy này đã kích hoạt bảo hành", hoặc bỏ tick.
 *
 * KHOÁ LÀ KHOÁ DÒNG BỀN của CLAUDE.md (số chứng từ + tên hàng chuẩn hoá +
 * lần xuất hiện thứ mấy trong chứng từ) — chính khoá `bc/quyetdinh/dong`
 * đang dùng. Nhập lại sổ tháng ấy thì tick ở nguyên chỗ cũ; dùng số thứ tự
 * dòng thì một lượt nhập lại là tick nhảy sang máy của khách khác, im lặng.
 *
 * KHÔNG kiểm "khoá này có thật trong kỳ không", có chủ ý: kiểm được thì phải
 * dựng lại cả bảng đơn cho MỖI lượt tick, tức vài giây cho một cú bấm mà
 * người dùng bấm hàng chục lần liên tiếp. Cái giá của việc bỏ phép kiểm là
 * một ô mồ côi nếu ai đó gọi thẳng API bằng khoá bịa — mà ô mồ côi thì không
 * khớp dòng nào nên không hiện ra ở đâu, và Engine vẫn đếm nó đúng như mọi
 * quyết định mồ côi khác.
 */
const datKichHoat = boc(true, async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const ky = than && than.ky;
  const khoa = than && typeof than.khoa === "string" ? than.khoa : "";
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  chanKyTuongLai(ky);

  /* Khoá đi THẲNG vào đường dẫn Firebase. Firebase cấm `.` `#` `$` `[` `]`
     `/` trong tên khoá, và `khoaDong()` bên Engine đã thay chúng bằng `~`
     từ lúc dựng — nên một khoá mang chúng KHÔNG thể đến từ bảng đơn thật.
     Chặn ở đây thay vì để lượt ghi hỏng ở tầng dưới với một thông báo không
     ai đọc được. */
  if (!khoa || khoa.length > 400 || /[.#$\[\]\/\u0000-\u001F]/.test(khoa)) {
    throw new LoiXacThuc(400, "khoa-khong-hop-le");
  }

  const duong = DUONG_KICH_HOAT + "/" + ky + "/" + khoa;

  /* Bỏ tick: XOÁ HẲN ô, không ghi `false`. Cùng lý do `gia-dung` và `bonus`
     đã chọn — một ô "chưa kích hoạt" làm "có mặt trong nhánh" hết còn nghĩa,
     và nhánh phình theo số lần bấm thử chứ không theo số máy đã xong. */
  if (than.xong === false) {
    const r = await xoaDb(duong, env);
    if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-kich-hoat:" + chiTietLoi(r));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/kich-hoat", ky, viec: "bo-tick" });
    return { ghi: true, ky, khoa, xong: false };
  }

  /* Ai tick và lúc nào đi CÙNG lượt ghi: hai lượt ghi thì có một khoảng mà
     máy đã đánh dấu xong mà không biết của ai — đúng thứ cần tra lại khi
     khách gọi bảo hành mà cổng hãng bảo chưa kích hoạt. */
  const r = await vaDb(duong,
    { boi: nguoi.email || nguoi.uid, luc: { ".sv": "timestamp" } }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-kich-hoat:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/kich-hoat", ky, viec: "tick" });
  return { ghi: true, ky, khoa, xong: true };
});

/* =================== POST /api/bao-hanh/dang-nhap ===================
 * User / Pass / hướng dẫn đăng nhập cổng của MỘT hãng.
 *
 * Chỉ `quantri`: cả phòng đọc theo một bản này, nên sửa nhầm là cả phòng
 * làm sai theo mà không ai biết đã sai từ đâu.
 */
const datDangNhapBaoHanh = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const hang = await hangBaoHanhHopLe(env, than && than.hang);

  const o = {
    user: cauNguoiGo(than.user, TRAN_USER),
    mat_khau: cauNguoiGo(than.mat_khau, TRAN_MAT_KHAU),
    huong_dan: cauNguoiGo(than.huong_dan, TRAN_HUONG_DAN),
    sua_boi: nguoi.email || nguoi.uid,
    sua_luc: { ".sv": "timestamp" },
  };

  const r = await vaDb(DUONG_BAO_HANH + "/" + hang + "/dang_nhap", o, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-dang-nhap:" + chiTietLoi(r));

  /* Nhật ký ghi ĐÚNG việc vừa làm, KHÔNG ghi giá trị: mật khẩu không có chỗ
     nào trong log, kể cả log chỉ mình chủ dự án đọc. */
  nhatKy({ rid, uid: nguoi.uid, duong: "/api/bao-hanh/dang-nhap", hang });
  return { ghi: true, hang };
});

/* =================== POST /api/bao-hanh/buoc ===================
 * Thêm / sửa / xoá MỘT bước hướng dẫn kích hoạt của một hãng.
 *
 * Khoá bước là một MỐC THỜI GIAN (`mocBayGio()`), không phải số thứ tự: đổi
 * chỗ hay xoá một bước ở giữa thì mọi bước sau KHÔNG phải đánh số lại, tức
 * không phải một lượt ghi nhiều ô — và một lượt ghi nhiều ô là một lượt có
 * thể hỏng nửa chừng. Thứ tự hiện ra do trường `thu_tu` quyết định (Engine
 * đánh số cách nhau 10 để còn chỗ chèn vào giữa).
 */
const datBuocBaoHanh = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const hang = await hangBaoHanhHopLe(env, than && than.hang);
  const id = than && typeof than.id === "string" ? than.id : null;
  if (id !== null && !/^[A-Za-z0-9_-]{1,60}$/.test(id))
    throw new LoiXacThuc(400, "id-buoc-khong-hop-le");

  const cu = await docDb(DUONG_BAO_HANH + "/" + hang + "/buoc", env);
  if (!cu.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bao-hanh:" + chiTietLoi(cu));
  /* Nhánh thô → danh sách phẳng. Đây KHÔNG phải phép dọn dữ liệu của Engine
     (`donHuongDan()` làm việc đó, và nó quyết định một hướng dẫn trông như
     thế nào để trả ra màn hình): ở đây chỉ cần ba thứ hoàn toàn cơ học —
     đang có bao nhiêu bước, bước sắp sửa đang trỏ tới tấm ảnh nào, và
     `thu_tu` lớn nhất là bao nhiêu để Engine tính số kế tiếp. */
  const buocTho = cu.val && typeof cu.val === "object" ? cu.val : {};
  const hienCo = Object.keys(buocTho)
    .filter((k) => buocTho[k] && typeof buocTho[k] === "object")
    .map((k) => ({ id: k, thu_tu: Number(buocTho[k].thu_tu) || 0,
                   anh: buocTho[k].anh || null }));

  /* ---- Xoá ---- */
  if (than.xoa === true) {
    if (!id) throw new LoiXacThuc(400, "thieu-id-buoc");
    const bo = hienCo.find((b) => b.id === id);
    const r = await xoaDb(DUONG_BAO_HANH + "/" + hang + "/buoc/" + id, env);
    if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-buoc:" + chiTietLoi(r));
    /* Ảnh đi theo bước. Xoá bước mà để ảnh lại là một kho phình mãi mà không
       ai nhìn thấy nó phình — nhưng lượt xoá ảnh KHÔNG được làm hỏng lượt
       xoá bước đã xong, nên nuốt lỗi và chỉ ghi nhật ký. */
    if (bo && bo.anh) {
      try { if (env.ANH_BAO_HANH) await env.ANH_BAO_HANH.delete(bo.anh); }
      catch (e) { nhatKy({ rid, canh_bao: "xoa-anh-hong:" + ((e && e.message) || "") }); }
    }
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/bao-hanh/buoc", hang, viec: "xoa" });
    return { ghi: true, hang, id };
  }

  const chu = cauNguoiGo(than.chu, TRAN_CHU_BUOC);
  const anh = typeof than.anh === "string" && than.anh ? than.anh : null;
  if (anh !== null && !laKhoaAnh(anh)) throw new LoiXacThuc(400, "anh-khong-hop-le");
  /* Một bước rỗng hoàn toàn không phải một bước — nó chỉ làm danh sách dài
     ra. Chủ dự án chốt hộp thêm bước có HAI ô; ít nhất một ô phải có gì. */
  if (!chu && !anh) throw new LoiXacThuc(400, "buoc-rong");

  /* ---- Sửa một bước đã có ---- */
  if (id) {
    const cuBuoc = hienCo.find((b) => b.id === id);
    if (!cuBuoc) throw new LoiXacThuc(400, "buoc-khong-ton-tai");
    /* Ảnh CŨ bị thay thì dọn ngay — cùng lý do như lúc xoá bước. */
    if (cuBuoc.anh && cuBuoc.anh !== anh) {
      try { if (env.ANH_BAO_HANH) await env.ANH_BAO_HANH.delete(cuBuoc.anh); }
      catch (e) { nhatKy({ rid, canh_bao: "xoa-anh-cu-hong:" + ((e && e.message) || "") }); }
    }
    const r = await vaDb(DUONG_BAO_HANH + "/" + hang + "/buoc/" + id,
      { chu, anh, sua_boi: nguoi.email || nguoi.uid, sua_luc: { ".sv": "timestamp" } }, env);
    if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-buoc:" + chiTietLoi(r));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/bao-hanh/buoc", hang, viec: "sua" });
    return { ghi: true, hang, id };
  }

  /* ---- Thêm một bước mới vào cuối ---- */
  let tran, thu_tu;
  try {
    tran = (await env.REPORT_ENGINE.hangBaoHanh()).buoc_toi_da;
    thu_tu = await env.REPORT_ENGINE.thuTuBuocTiepTheo(hienCo);
  } catch (e) { throw new LoiXacThuc(503, "engine-loi-buoc:" + (e && e.message)); }
  if (hienCo.length >= tran) throw new LoiXacThuc(400, "qua-nhieu-buoc");

  const idMoi = mocBayGio();
  const r = await vaDb(DUONG_BAO_HANH + "/" + hang + "/buoc/" + idMoi,
    { thu_tu, chu, anh, sua_boi: nguoi.email || nguoi.uid, sua_luc: { ".sv": "timestamp" } }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-buoc:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/bao-hanh/buoc", hang, viec: "them", thu_tu });
  return { ghi: true, hang, id: idMoi, thu_tu };
});

/* =================== ẢNH HƯỚNG DẪN — R2 ===================
 *
 * Ảnh KHÔNG nằm trong Realtime Database. Mỗi hãng có tới ba mươi bước, mỗi
 * bước một tấm ảnh chụp màn hình; nhét chúng vào RTDB dạng base64 là mỗi
 * lượt mở một hãng kéo về vài MB chữ, và nhánh `bc/quyetdinh` thì đọc TRỌN
 * ở mọi lượt mở màn hình. R2 giữ byte, Firebase chỉ giữ cái KHOÁ trỏ tới.
 *
 * Chủ dự án chốt phương án này 19/09/2026 (được hỏi giữa R2, base64 trong
 * Firebase, và Firebase Storage).
 */

/** Khuôn khoá ảnh trong R2 — `<Hãng>/<mốc>.<đuôi>`.
 *
 *  Khoá đến từ TRÌNH DUYỆT ở đường đọc, nên khuôn phải hẹp và phải chặn
 *  `..`: một khoá kiểu `../` không đưa ai ra khỏi bucket được (R2 không có
 *  thư mục thật), nhưng khuôn hẹp là thứ giữ cho đường này không bao giờ
 *  thành một cách dò xem bucket còn có gì khác. */
function laKhoaAnh(s) {
  return typeof s === "string" && s.length <= 120
    && /^[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(s)
    && !s.includes("..");
}

/** Kiểu ảnh được nhận, và đuôi file tương ứng.
 *
 *  Danh sách ĐÓNG, cố ý: một tấm SVG là một tài liệu chạy được script, và
 *  phục vụ nó từ cùng một tên miền với app là mở đúng cánh cửa không cần
 *  thiết cho một màn hình chỉ cần ảnh chụp màn hình. */
const KIEU_ANH = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Trần một tấm ảnh — 5 MB. Ảnh chụp màn hình một cổng bảo hành nặng vài
 *  trăm KB; 5 MB đã rộng gấp nhiều lần, mà vẫn chặn được lượt tải nhầm một
 *  file ảnh máy ảnh 40 MB vào. */
const TRAN_ANH = 5 * 1024 * 1024;

const taiAnhBaoHanh = boc("quantri", async ({ nguoi, request, env, rid }) => {
  if (!env.ANH_BAO_HANH) throw new LoiXacThuc(503, "thieu-kho-anh");
  const hang = await hangBaoHanhHopLe(env, new URL(request.url).searchParams.get("hang"));

  const kieu = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const duoi = KIEU_ANH[kieu];
  if (!duoi) throw new LoiXacThuc(400, "kieu-anh-khong-nhan");

  const dai = Number(request.headers.get("Content-Length") || 0);
  if (dai > TRAN_ANH) throw new LoiXacThuc(400, "anh-qua-lon");

  const byte = await request.arrayBuffer();
  /* Đo lại SAU khi đọc: `Content-Length` là thứ bên gửi tự khai, còn đây là
     số byte thật. Tin vào con số khai là để lọt đúng lượt tải cố tình. */
  if (byte.byteLength > TRAN_ANH) throw new LoiXacThuc(400, "anh-qua-lon");
  if (!byte.byteLength) throw new LoiXacThuc(400, "anh-rong");

  const khoa = hang + "/" + mocBayGio() + "." + duoi;
  await env.ANH_BAO_HANH.put(khoa, byte, { httpMetadata: { contentType: kieu } });

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/bao-hanh/anh", hang,
           viec: "tai-len", byte: byte.byteLength });
  return { anh: khoa };
});

/* Ảnh đi ra dạng BYTE THÔ, không gói JSON — xem `bocNhiPhan()`.
 *
 * Vì sao không phục vụ ảnh bằng một URL công khai của R2: tấm ảnh hướng dẫn
 * có chụp cả màn hình cổng hãng, đôi khi kèm chính tài khoản đang đăng nhập.
 * Đi qua đây thì nó đòi đúng một token Firebase như mọi đường khác của app.
 *
 * Hệ quả trên màn hình: `<img src>` KHÔNG gắn được header `Authorization`,
 * nên trình duyệt phải `fetch()` rồi dựng `blob:` — đó là lý do CSP của app
 * có `blob:` trong `img-src`. */
const layAnhBaoHanh = bocNhiPhan(true, async ({ request, env }) => {
  if (!env.ANH_BAO_HANH) throw new LoiXacThuc(503, "thieu-kho-anh");
  const id = new URL(request.url).searchParams.get("id");
  if (!laKhoaAnh(id)) throw new LoiXacThuc(400, "anh-khong-hop-le");

  const o = await env.ANH_BAO_HANH.get(id);
  if (!o) throw new LoiXacThuc(400, "khong-co-anh");

  /* Khoá ảnh mang một mốc thời gian nên nó KHÔNG BAO GIỜ trỏ sang một tấm
     ảnh khác — sửa ảnh của một bước là sinh khoá mới. Nhờ vậy cache được
     thật lâu, và một màn hướng dẫn ba mươi bước chỉ tải ảnh đúng một lần.
     `private` vì phản hồi này gắn với người đã đăng nhập. */
  return new Response(o.body, {
    headers: {
      "Content-Type": (o.httpMetadata && o.httpMetadata.contentType) || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
});

/* =================== GET /api/co-cau ===================
 * Cơ cấu ngành hàng × hãng của một kỳ, kèm cùng kỳ NĂM TRƯỚC để vẽ hai cột
 * đứng cạnh nhau. Chủ dự án chốt 19/09/2026.
 *
 * DÙNG LẠI `dungBangDonHang()` — chính hàm dựng bảng của tab [Báo cáo bán
 * hàng] — chứ không đọc thẳng `bc/dong` rồi tự cộng. Cùng lý do `/api/bao-hanh`
 * đã chọn: hãng và ngành hàng chỉ có sau khi khớp mã, hàng trả lại chỉ lộ ra
 * sau `apDungBTL`, và một dòng XOÁ TAY phải biến khỏi CẢ biểu đồ. Dựng một
 * đường đọc thứ hai là dựng lại cả chuỗi luật ấy, và hai bản sẽ trôi khỏi
 * nhau đúng lúc không ai để ý — lúc ấy biểu đồ và bảng nói hai sự thật khác
 * nhau về cùng một tháng.
 *
 * HAI THÁNG DỰNG SONG SONG, không nối đuôi: chúng độc lập hoàn toàn, và xếp
 * hàng là bắt người dùng chờ gấp đôi cho không. Bảng giá Tracking có bộ đệm
 * nên lượt thứ hai gần như không trả thêm gì cho nó.
 *
 * Kỳ năm trước KHÔNG CÓ SỔ là chuyện bình thường, không phải lỗi: nó ra một
 * bảng rỗng, và Gateway đổi thành `null` để Engine bật `co_ky_truoc: false`.
 * Màn hình khi ấy nói thẳng "chưa có dữ liệu dòng hàng tháng này" thay vì vẽ
 * một cột cao 0 — thứ đọc ra thành "năm ngoái không bán gì".
 */
const layCoCau = boc(true, async ({ request, env, rid }) => {
  const q = new URL(request.url).searchParams;
  const ky = q.get("ky");
  if (!laKy(ky)) throw new LoiXacThuc(400, "thieu-ky");
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");

  const kyTruocNam = namTruoc(ky);

  /* Kỳ năm trước hỏng thì KHÔNG kéo theo cả biểu đồ: cơ cấu tháng này vẫn
     đọc được mà không cần nó. Bắt lỗi ngay tại lời hứa, đúng lối bảng giá
     Tracking đã chọn ở `dungBangDonHang`. */
  const [kqNay, kqTruoc] = await Promise.all([
    dungBangDonHang(env, ky, null, rid),
    kyTruocNam
      ? dungBangDonHang(env, kyTruocNam, null, rid).catch((e) => {
        nhatKy({ rid, duong: "/api/co-cau", canh_bao: "ky-truoc-hong:"
          + ((e && (e.ly || e.message)) || "khong-ro") });
        return null;
      })
      : null,
  ]);

  /* "Có bảng" khác "có dữ liệu": một kỳ chưa nạp sổ vẫn ra một bảng hợp lệ
     với 0 ngày. Đưa nguyên nó cho Engine thì `co_ky_truoc` bật lên và màn
     hình vẽ một cột 0 — nên quy về `null` ngay tại đây. */
  const bangTruoc = kqTruoc && kqTruoc.bang && Array.isArray(kqTruoc.bang.ngay)
    && kqTruoc.bang.ngay.length ? kqTruoc.bang : null;

  let co_cau;
  try {
    co_cau = await env.REPORT_ENGINE.coCauNganhHang(kqNay.bang, bangTruoc);
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-co-cau:" + (e && e.message));
  }

  return {
    ky,
    ky_truoc: kyTruocNam,
    ...co_cau,
    /* Tracking hỏng thì không dòng nào có hãng, tức MỌI cột rơi vào "Chưa
       phân loại". Màn hình bắt buộc nói ra: một sự cố mạng không được phép
       kết luận "tháng này chưa phân loại được gì" thay người (CLAUDE.md). */
    loi_nguon_ma: kqNay.loi_nguon_ma,
  };
});

/* =================== ĐẨY SANG GOOGLE SHEET (13/09/2026) ===================
 *
 * Chủ dự án chốt: mỗi tháng tạo một Sheet mới cho từng nhân viên, dán link
 * vào tab line tương ứng, rồi 17h30 hằng ngày app tự ghi sang — cộng một nút
 * bấm tay cho lượt vừa tải sổ xong, khỏi phải chờ tới giờ.
 *
 * VÌ SAO LINK LÀ DỮ LIỆU SỬA ĐƯỢC TRÊN MÀN HÌNH, khác hẳn repo Marketing:
 * bên đó `SHEET_ID` nằm trong `wrangler.toml` và đổi nó phải qua một commit,
 * vì nhánh `mkt/*` cho MỌI nhân viên ghi thẳng từ trình duyệt — ai đổi được
 * ID là lặng lẽ đổi được đích đến của cả bảng giá. Bên này nhánh
 * `bc/quyetdinh` chỉ ghi được qua Gateway, và đường ghi dưới đây chỉ mở cho
 * vai `quantri`. Ba rào còn lại, chốt cùng chủ dự án trước khi làm: mỗi lượt
 * đổi link ghi nhật ký kèm uid, màn hình luôn hiện rõ đang đẩy sang file
 * nào, và link phải mang `#gid` nên không có chuyện đoán nhầm tab.
 *
 * Dữ liệu đi qua đây NẶNG hơn bảng giá bên Marketing — có tên khách, số điện
 * thoại, địa chỉ. Chốt chặn cuối vẫn là quyền chia sẻ của chính file Sheet;
 * không dòng mã nào ở đây che được việc bấm nhầm "Bất kỳ ai có liên kết".
 */

/** Đẩy MỘT (kỳ, line) sang Sheet đã khai. Dùng chung cho nút bấm tay và cho
 *  lượt chạy tự động — một đường duy nhất, để hai lối vào không thể lệch
 *  nhau về luật.
 *
 *  Trả `{ bo_qua: "..." }` khi line chưa khai link: đó KHÔNG phải lỗi, đó là
 *  trạng thái thường của một line chủ dự án chưa setup tháng này. */
async function dayMotLine(env, ky, line, rid) {
  const duong = DUONG_SHEET + "/" + ky + "/" + line;
  const cai = await docDb(duong, env);
  if (!cai.ok) throw new LoiXacThuc(503, "khong-doc-duoc-sheet-link:" + chiTietLoi(cai));
  const link = cai.val && cai.val.link;
  if (!link) return { bo_qua: "chua-khai-link", ky, line };

  const dia = phanTichLink(link);
  if (dia.loi) throw new LoiXacThuc(400, "link-hong:" + dia.loi, dia.loi);

  /* Dựng bảng bằng ĐÚNG đường màn hình đang dùng — không có đường thứ hai.
     Một đường thứ hai là chỗ để con số trên Sheet và con số trên màn hình
     lệch nhau mà không ai đối chiếu. */
  const kq = await dungBangDonHang(env, ky, line, rid);

  /* Nguồn giá hỏng thì DỪNG, không đẩy. Bảng vẫn hiện được trên màn hình
     (người xem thấy ngay mấy cột trống và biết vì sao), nhưng ghi xuống
     Sheet thì khác hẳn: nó ĐÈ mất bộ số đúng của lượt trước bằng một bộ
     thiếu giá vốn, và trên Sheet không có gì nói là thiếu. */
  if (kq.loi_nguon_ma) throw new LoiXacThuc(503, "nguon-gia-hong:" + kq.loi_nguon_ma);
  if (kq.loi_nguon_kpi) throw new LoiXacThuc(503, "nguon-kpi-hong:" + kq.loi_nguon_kpi);

  let khoi, boCuc;
  try {
    [khoi, boCuc] = await Promise.all([
      env.REPORT_ENGINE.dungKhoiSheet(kq.bang),
      env.REPORT_ENGINE.boCucSheet(),
    ]);
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-khoi-sheet:" + (e && e.message));
  }

  const ra = await daySangTab(env, { id: dia.id, gid: dia.gid, khoi: khoi.khoi },
                              { hangDau: khoi.hang_dau });

  /* Định dạng chạy SAU và không chặn kết quả: ô đã mang số đúng rồi, định
     dạng hỏng thì cùng lắm là cột ngày hiện ra 46235. Nuốt lỗi ở đây nhưng
     GHI nhật ký — im lặng hoàn toàn thì không ai biết vì sao bảng xấu. */
  if (khoi.so_dong) {
    try {
      await dinhDangCot(env, {
        id: dia.id, gid: dia.gid, cotNgay: boCuc.cot_ngay, cotTien: boCuc.cot_tien,
        hangDau: khoi.hang_dau, hangCuoi: khoi.hang_cuoi,
        /* Dải tô xám của từng ngày do ENGINE tính — nó là nơi duy nhất biết
           dòng trống chen vào đâu, nên cũng phải là nơi duy nhất biết mảng
           ngày bắt đầu và kết thúc ở hàng nào. Gateway đếm lại là hai bản
           đếm, và lệch một hàng thì mảng xám trượt khỏi dữ liệu. */
        bangNgay: khoi.bang_ngay,
      });
    } catch (e) {
      nhatKy({ rid, duong: "/api/day-sheet", ky, line,
               canh_bao: "dinh-dang-hong:" + (e && (e.vi || e.message)) });
    }
  }

  /* Dấu vết lượt đẩy nằm CẠNH link, để màn hình nói được "lần cuối lúc nào".
     `day_loi: null` xoá dấu lỗi của lượt trước — không xoá thì một lượt hỏng
     hôm qua còn kêu mãi sau khi đã sửa xong. */
  /* Báo SỐ DÒNG HÀNG THẬT (`khoi.so_dong`), không phải số hàng đã ghi —
     `ra.so_dong` đếm cả dòng trống ngăn ngày, và một con số như thế không
     khớp với bất cứ thứ gì chủ dự án đếm được trên sổ. */
  await vaDb(duong, { day_luc: { ".sv": "timestamp" }, day_loi: null,
                      day_so_dong: khoi.so_dong }, env);

  return { ky, line, ten_tab: ra.ten_tab, so_dong: khoi.so_dong };
}

/* =================== POST /api/sheet-link ===================
 * Khai (hoặc rút) link Sheet đích của một (kỳ, line).
 *
 * CHỈ QUẢN TRỊ — cùng mức `dat-kpi`: đổi link là đổi ĐÍCH ĐẾN của toàn bộ số
 * liệu một line, kèm tên khách và số điện thoại.
 */
const datSheetLink = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const line = than && typeof than.line === "string" ? than.line.trim() : "";
  if (!line || line.length > 60) throw new LoiXacThuc(400, "line-khong-hop-le");
  if (/[.#$[\]/]/.test(line)) throw new LoiXacThuc(400, "line-khong-hop-le");
  const ky = than && than.ky;
  if (!laKy(ky)) throw new LoiXacThuc(400, "ky-khong-hop-le");
  chanKyTuongLai(ky);

  const duong = DUONG_SHEET + "/" + ky + "/" + line;

  /* Ô trống = RÚT LẠI link, về "chưa setup tháng này" — xoá hẳn bản ghi chứ
     không ghi `link: null`, cùng quy ước `gia-dung` và `dat-cong` đã chọn. */
  if (than.link === null || than.link === "") {
    const x = await xoaDb(duong, env);
    if (!x.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-sheet-link:" + chiTietLoi(x));
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/sheet-link", ky, line, viec: "xoa" });
    return { ghi: true, ky, line, link: null };
  }

  const dia = phanTichLink(than.link);
  /* Từ chối NGAY lúc lưu, không đợi tới lượt đẩy mới hỏng: người dán link
     đang nhìn màn hình lúc này, còn lượt 17h30 thì không ai ngồi đó. */
  if (dia.loi) throw new LoiXacThuc(400, "link-hong:" + dia.loi, dia.loi);

  const link = String(than.link).trim();
  if (link.length > 500) throw new LoiXacThuc(400, "link-qua-dai");

  const r = await vaDb(duong, {
    link,
    /* Dấu vết đi CÙNG lượt ghi — ba rào đã chốt với chủ dự án, đây là rào
       thứ nhất: mỗi lượt đổi đích đến biết được của ai và lúc nào. */
    boi: nguoi.email || nguoi.uid,
    luc: { ".sv": "timestamp" },
    day_loi: null,
  }, env);
  if (!r.ok) throw new LoiXacThuc(503, "khong-ghi-duoc-sheet-link:" + chiTietLoi(r));

  nhatKy({ rid, uid: nguoi.uid, duong: "/api/sheet-link", ky, line, sheet_id: dia.id });
  return { ghi: true, ky, line, link };
});

/* =================== POST /api/day-sheet ===================
 * Đẩy ngay một (kỳ, line) — nút trên dải setup. Chỉ Quản trị.
 */
const daySheet = boc("quantri", async ({ nguoi, request, env, rid }) => {
  const than = await docThan(request);
  const line = than && typeof than.line === "string" ? than.line.trim() : "";
  if (!line || line.length > 60) throw new LoiXacThuc(400, "line-khong-hop-le");
  if (/[.#$[\]/]/.test(line)) throw new LoiXacThuc(400, "line-khong-hop-le");
  const ky = than && than.ky;
  if (!laKy(ky)) throw new LoiXacThuc(400, "ky-khong-hop-le");
  chanKyTuongLai(ky);

  try {
    const ra = await dayMotLine(env, ky, line, rid);
    nhatKy({ rid, uid: nguoi.uid, duong: "/api/day-sheet", ky, line,
             so_dong: ra.so_dong ?? null, bo_qua: ra.bo_qua ?? null });
    return ra;
  } catch (e) {
    /* Lỗi của Google có câu chữ dành cho người đọc (`LoiSheet.vi`) — đưa
       nguyên câu ấy ra màn hình, vì nó nói ĐÚNG việc phải làm ("chia sẻ file
       cho service account"). Khác hẳn lỗi nội bộ, thứ chỉ vào nhật ký.
       Ghi luôn xuống Firebase để lượt mở màn hình sau còn thấy. */
    if (e instanceof LoiSheet) {
      await vaDb(DUONG_SHEET + "/" + ky + "/" + line, { day_loi: e.vi }, env);
      throw new LoiXacThuc(e.ma === 503 ? 503 : 400, "sheet:" + e.vi, e.vi);
    }
    throw e;
  }
});

const API_ROUTES = new Map([
  ["GET /api/me", layMe],
  ["GET /api/bao-cao/suc-khoe", laySucKhoeCongTy],
  ["POST /api/tai-so", taiSo],
  ["POST /api/hoan-tac", hoanTac],
  ["POST /api/xoa-ky", xoaKy],
  ["GET /api/ban-luu", layBanLuu],
  ["GET /api/ky-co-don", layKyCoDon],
  ["GET /api/don-hang", layDonHang],
  ["GET /api/ma-bang-gia", layMaBangGia],
  ["POST /api/gan-ma", ganMa],
  ["GET /api/phan-loai/muc", layMucPhanLoai],
  ["POST /api/phan-loai", datPhanLoai],
  ["POST /api/sua-dong", suaDong],
  ["POST /api/dat-kpi", datKpi],
  ["POST /api/dat-cong", datCong],
  ["POST /api/gia-dung", datGiaDung],
  ["POST /api/nap-kpi", napKpi],
  ["POST /api/bonus", datBonus],
  ["POST /api/sheet-link", datSheetLink],
  ["POST /api/day-sheet", daySheet],
  ["GET /api/co-cau", layCoCau],
  ["GET /api/bao-hanh", layBaoHanh],
  ["POST /api/kich-hoat", datKichHoat],
  ["POST /api/bao-hanh/dang-nhap", datDangNhapBaoHanh],
  ["POST /api/bao-hanh/buoc", datBuocBaoHanh],
  ["GET /api/bao-hanh/anh", layAnhBaoHanh],
  ["POST /api/bao-hanh/anh", taiAnhBaoHanh],
]);

/** Những method một đường `/api/` nhận, hoặc `null` nếu đường đó không tồn
 *  tại. Đường lạ phải ra 404 ("không có gì ở đây"), KHÔNG phải 405 ("có,
 *  nhưng anh gõ sai cửa") — 405 cho đường lạ là tự khai đường nào có thật.
 *  HEAD đi kèm GET vì `xuLy` phục vụ HEAD bằng chính handler của GET. */
function methodChoPhep(duong) {
  let co = false;
  const ra = new Set();
  for (const k of API_ROUTES.keys()) {
    const cach = k.slice(0, k.indexOf(" "));
    if (k.slice(k.indexOf(" ") + 1) !== duong) continue;
    co = true;
    ra.add(cach);
    if (cach === "GET") ra.add("HEAD");
  }
  return co ? ra : null;
}

/* ═══════════ MỘT TÊN MIỀN DUY NHẤT — P7, 12/09/2026 ═══════════
 *
 * V2 nhận lại `reports.tinphatcrm.com` của V1, và Cloudflare Access bị BỎ:
 * đăng nhập Firebase của chính app này là lớp duy nhất. Hệ quả trực tiếp là
 * địa chỉ `*.workers.dev` mà Cloudflare cấp sẵn không còn được phục vụ app.
 *
 * Vì sao phải đóng nó, dù đường nào cũng đòi đúng một token Firebase như
 * nhau nên đây KHÔNG phải một lỗ quyền: hai địa chỉ cho cùng một app là hai
 * nơi phải nhớ mỗi lần siết bất cứ thứ gì ở tầng ngoài — WAF, rate limit,
 * hay chính Access nếu sau này đặt lại. Và cái bị quên luôn là cái Cloudflare
 * tự cấp, không phải cái người ta tự gõ vào ô DNS.
 *
 * Ba quyết định trong hàm này, cả ba đều có giá đã trả trước:
 *
 * · `CANONICAL_HOST` là DỮ LIỆU (`[vars]` của wrangler.toml), không phải hằng
 *   số trong mã — đổi tên miền không được là một lần sửa code.
 *
 * · Cờ "1" mà `CANONICAL_HOST` rỗng thì hàm KHÔNG chặn gì cả. Một tên miền gõ
 *   sai không được phép hạ cả app, và chặn ở đây không cứu được gì vì lúc ấy
 *   không còn địa chỉ nào để vào mà sửa. Cặp giá trị ấy được canh ở
 *   `kiem/dinh-tuyen.js` đọc thẳng wrangler.toml — tức lỗi cấu hình đỏ ở
 *   `npm test`, và `[build] command` làm `wrangler deploy` không chạy. Cửa
 *   chặn đứng trước lúc deploy, không đứng sau lúc có người dùng.
 *
 * · GET/HEAD được CHỈ ĐƯỜNG (301, giữ nguyên path + query) để một dấu trang
 *   cũ vẫn tới đúng nơi. Method khác ra 421 chứ KHÔNG chuyển hướng: một 301
 *   khiến client đổi POST thành GET, hoặc gửi lại nguyên thân request sang
 *   một origin khác — cả hai đều tệ hơn một lỗi nói thẳng.
 */
function chuyenVeTenMienChinh(request, env) {
  if (String(env.ENFORCE_CANONICAL_HOST ?? "0") !== "1") return null;
  const chinh = String(env.CANONICAL_HOST || "").trim().toLowerCase();
  if (!chinh) return null;

  const url = new URL(request.url);
  const hostGoc = url.hostname;
  if (hostGoc.toLowerCase() === chinh) return null;

  const method = request.method.toUpperCase();
  const chiDuong = method === "GET" || method === "HEAD";
  if (chiDuong) {
    url.protocol = "https:";
    url.hostname = chinh;
    url.port = "";
  }
  /* Ghi lại MỌI lượt gõ vào host cũ. Địa chỉ này lẽ ra đã chết, nên một dòng
     log ở đây không phải tiếng ồn — nó là cách duy nhất biết còn ai (hay còn
     cái gì tự động) đang gọi vào đó trước khi tắt hẳn. Khoá log không dấu,
     như mọi dòng `nhatKy` khác: chúng được lọc bằng máy qua `wrangler tail`. */
  nhatKy({ host_la: hostGoc, duong: url.pathname, cach: method,
           ma: chiDuong ? 301 : 421 });

  return chiDuong
    ? new Response(null, { status: 301, headers: { Location: url.toString() } })
    : new Response("Misdirected Request", { status: 421 });
}

async function xuLy(request, env) {
  /* Bước 0 — host nào được phục vụ. Đứng TRƯỚC cả cửa chặn đường dẫn có chủ
     ý: từ P7, `*.workers.dev` chỉ còn đúng một việc là chỉ sang địa chỉ
     thật, không trả lời thay app về bất cứ đường nào — kể cả để nói 404. */
  const hostLa = chuyenVeTenMienChinh(request, env);
  if (hostLa) return hostLa;

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const duong = url.pathname;

  for (const re of BLOCKED_PATHS) {
    if (re.test(duong)) return new Response("Not Found", { status: 404 });
  }

  if (duong.startsWith("/api/")) {
    /* Method nào được đi đường nào suy THẲNG từ `API_ROUTES`, không khai
       lại thành một danh sách thứ hai. P3 mở POST cho đúng hai đường (tải
       sổ, hoàn tác); mọi đường khác vẫn chỉ GET/HEAD như từ P1 — và chúng
       vẫn 405 mà không ai phải nhớ cập nhật thêm chỗ nào. Khai hai lần là
       hai lần trôi khỏi nhau, và chỗ trôi ở đây là một lỗ mở ra ngoài. */
    const duoc = methodChoPhep(duong);
    if (!duoc) return new Response("Not Found", { status: 404 });
    if (!duoc.has(method)) {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: [...duoc].join(", ") } });
    }
    const handler = API_ROUTES.get(method + " " + duong) || (method === "HEAD" && API_ROUTES.get("GET " + duong));
    if (!handler) return new Response("Not Found", { status: 404 });
    return handler(request, env);
  }

  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  return env.ASSETS.fetch(request);
}

/* =================== Lượt đẩy Sheet tự động (cron) ===================
 *
 * 17h30 giờ VN mỗi ngày — `wrangler.toml` khai `30 10 * * *` (UTC+7).
 *
 * Đẩy kỳ HIỆN TẠI và kỳ LIỀN TRƯỚC. Kỳ trước có mặt vì đầu tháng chủ dự án
 * còn sửa sổ tháng cũ vài hôm; chỉ đẩy kỳ hiện tại thì những lượt sửa ấy
 * nằm lại trên màn hình mà không bao giờ sang tới Sheet. Line nào chưa khai
 * link thì `dayMotLine` trả `bo_qua` — không phải lỗi, và cũng không gọi
 * Google lượt nào.
 *
 * "Hiện tại" tính theo giờ VN chứ không theo UTC: 17h30 VN là 10h30 UTC
 * cùng ngày, nhưng một lượt chạy tay lúc khuya sẽ lệch sang tháng trước nếu
 * lấy tháng theo UTC. Kỳ là một khái niệm của người dùng, nên đọc theo múi
 * giờ của người dùng.
 *
 * MỘT LINE HỎNG KHÔNG ĐƯỢC LÀM DỪNG CÁC LINE CÒN LẠI — chạy tuần tự và bắt
 * lỗi từng lượt. Lỗi ghi xuống `day_loi` cạnh link để lượt mở màn hình sau
 * còn thấy, và vào nhật ký để `wrangler tail` đọc được ngay.
 */

/** Kỳ "YYYY-MM" theo giờ VN, lùi `luiThang` tháng. */
function kyVN(luc, luiThang) {
  const d = new Date(luc + VN_LECH_MS);
  const m = d.getUTCMonth() - (luiThang || 0);
  const t = new Date(Date.UTC(d.getUTCFullYear(), m, 1));
  return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0");
}

async function dayTheoLich(env, luc, rid) {
  if (!env.REPORT_ENGINE) { nhatKy({ rid, duong: "cron/day-sheet", ly: "thieu-engine" }); return; }

  const bangLine = await docDb("bc/quyetdinh/line", env);
  if (!bangLine.ok || !bangLine.val || !Array.isArray(bangLine.val.thu_tu)) {
    nhatKy({ rid, duong: "cron/day-sheet", ly: "khong-doc-duoc-bang-line" });
    return;
  }

  let day = 0, boQua = 0, hong = 0;
  for (const ky of [kyVN(luc, 0), kyVN(luc, 1)]) {
    for (const line of bangLine.val.thu_tu) {
      try {
        const ra = await dayMotLine(env, ky, line, rid);
        if (ra.bo_qua) { boQua++; continue; }
        day++;
        nhatKy({ rid, duong: "cron/day-sheet", ky, line, so_dong: ra.so_dong });
      } catch (e) {
        hong++;
        const vi = e instanceof LoiSheet ? e.vi : ((e && (e.ly || e.message)) || "khong-ro");
        /* Ghi lỗi cạnh link, nuốt lỗi của chính lượt ghi ấy: không ghi được
           dấu lỗi thì vẫn phải chạy tiếp line sau. */
        try { await vaDb(DUONG_SHEET + "/" + ky + "/" + line, { day_loi: vi }, env); }
        catch (e2) { /* nhật ký bên dưới đã nói đủ */ }
        nhatKy({ rid, duong: "cron/day-sheet", ky, line, loi: vi });
      }
    }
  }
  nhatKy({ rid, duong: "cron/day-sheet", xong: true, day, bo_qua: boQua, hong });
}

export default {
  async fetch(request, env, ctx) {
    const res = await xuLy(request, env);
    return withSecurityHeaders(res);
  },

  /** Cloudflare gọi hàm này theo `[triggers] crons` của `wrangler.toml`. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dayTheoLich(env, (event && event.scheduledTime) || Date.now(),
                              crypto.randomUUID()));
  },
};
