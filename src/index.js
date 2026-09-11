import { xacThuc, doiVaiBaoCao, LoiXacThuc } from './auth.js';
import { docDb } from './firebase.js';

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
    "img-src 'self' data:",
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
  if (type.includes("text/html")) out.headers.set("Cache-Control", "no-store, must-revalidate");
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

/**
 * Bọc một handler nghiệp vụ dưới `/api/`.
 * Thứ tự cố định, không đảo được: xác thực → phân quyền → chạy → nhật ký →
 * trả tối thiểu. Sao lại đúng nếp `boc()` của Worker `tracking` — cùng một
 * bài toán (một Gateway, nhiều endpoint sau này), một cách giải.
 *
 * @param canVai  true nếu endpoint đòi có vai báo cáo (quantri/quanly),
 *                false nếu chỉ cần đăng nhập + có hồ sơ
 * @param chay    async ({ nguoi, vai, request, env, rid }) => object trả về
 */
function boc(canVai, chay) {
  return async (request, env) => {
    const rid = crypto.randomUUID();
    const batDau = Date.now();
    let nguoi = null, vai = null;
    try {
      // Anh là ai — lấy từ chữ ký token, KHÔNG lấy từ query hay body.
      nguoi = await xacThuc(request, env);
      if (canVai) vai = doiVaiBaoCao(nguoi);

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
 * "Màn mở" (P2(b) bước 1) — sức khoẻ kinh doanh toàn công ty: doanh số +
 * số đơn theo ngày/tháng/năm, kèm cùng kỳ năm trước. Đọc thẳng `bc/ky`
 * (chưa lọc theo Line, chưa khớp mã hàng — những việc đó là các bước sau),
 * gộp qua Engine, trả cây kết quả ĐÃ TÍNH SẴN cho màn hình vẽ (LUẬT SỐ 1).
 *
 * Nguồn hỏng (đọc `bc/ky` lỗi, hoặc Engine ném lỗi) → 503, KHÔNG bao giờ
 * trả cây rỗng giả làm "chưa có đơn nào" (CLAUDE.md — "Nguồn hỏng thì BÁO
 * LỖI").
 */
const laySucKhoeCongTy = boc(true, async ({ env }) => {
  const cayKy = await docDb("bc/ky", env);
  if (!cayKy.ok) throw new LoiXacThuc(503, "khong-doc-duoc-bc-ky:" + cayKy.ma);
  if (!env.REPORT_ENGINE) throw new LoiXacThuc(503, "thieu-engine");
  try {
    return await env.REPORT_ENGINE.gopSucKhoeCongTy(cayKy.val || {});
  } catch (e) {
    throw new LoiXacThuc(503, "engine-loi-suc-khoe:" + (e && e.message));
  }
});

const API_ROUTES = new Map([
  ["GET /api/me", layMe],
  ["GET /api/bao-cao/suc-khoe", laySucKhoeCongTy],
]);

async function xuLy(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const duong = url.pathname;

  for (const re of BLOCKED_PATHS) {
    if (re.test(duong)) return new Response("Not Found", { status: 404 });
  }

  if (duong.startsWith("/api/")) {
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
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

export default {
  async fetch(request, env, ctx) {
    const res = await xuLy(request, env);
    return withSecurityHeaders(res);
  },
};
