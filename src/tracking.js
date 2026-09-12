/* ĐƯỜNG SANG TRACKING — bảng giá, bảng gộp mã, bản đồ phân loại.
 *
 * Đây là NƠI DUY NHẤT của Gateway nói chuyện với Tracking, và là nơi duy
 * nhất khoá `X-Report-Key` xuất hiện. Engine không biết gì về khoá này:
 * Gateway đi lấy, Engine chỉ tính (LUẬT SỐ 1 — Engine là nghiệp vụ thuần,
 * và một khoá bí mật nằm trong Worker nghiệp vụ là một chỗ để quên).
 *
 * Khoá đi ở HEADER, không bao giờ trên URL: khoá trên URL lọt vào log máy
 * chủ, lịch sử trình duyệt và `Referer`. Cùng lý do Tracking đã chọn header
 * cho `/api/xuat/` và `/api/min-ngay`.
 *
 * ── FAIL CLOSED, KHÔNG BAO GIỜ TRẢ RỖNG ──
 *
 * Đọc hỏng thì NÉM LỖI. Một bảng giá rỗng đọc lên bên này thành "không mã
 * nào khớp được", và câu đó là một KẾT LUẬN NGHIỆP VỤ chứ không phải một sự
 * cố mạng (CLAUDE.md). Chính Tracking cũng trả 502 chứ không trả `200 {}`
 * cho đúng ca này — hai bên cùng một kỷ luật.
 *
 * `inv_map` rỗng thì KHÁC và được nhận: "chưa ai phân loại dòng nào" là một
 * trạng thái thật, hợp lệ, của một hệ vừa bắt đầu.
 */

const MAC_DINH_GOC = "https://price.tinphatcrm.com";

/** Lỗi của đường sang Tracking. Tách một lớp riêng để chỗ gọi phân biệt
 *  được "Tracking không trả lời" với "Firebase không trả lời" — hai sự cố
 *  khác nhau, hai việc phải làm khác nhau. */
export class LoiTracking extends Error {
  constructor(ly) { super(ly); this.ly = ly; }
}

/* Bộ nhớ tạm cho BẢNG GIÁ và BẢNG GỘP MÃ — hai nhánh đổi theo tuần, không
 * theo phút, mà bảng giá thật có ~3.500 mã (≈400 KB mỗi lượt). Kéo lại trọn
 * bộ mỗi lần người dùng bấm sang tháng khác là trả tiền băng thông cho một
 * thứ gần như không đổi.
 *
 * `inv_map` CỐ Ý KHÔNG được nhớ tạm: nó là thứ người dùng vừa sửa xong ở
 * lượt bấm trước, và hiện lại bản cũ sau khi vừa gán mã là làm người ta
 * tưởng lượt gán vừa rồi trượt.
 *
 * Nhớ tạm nằm ở phạm vi module nên nó theo từng isolate của Worker và tự
 * biến mất — cố ý: đây là bộ đệm giảm tải, không phải nguồn sự thật. */
let _dem = null;              // { luc, board, alias }
const DEM_HAN = 60_000;

/** Xoá bộ đệm — gọi sau khi chính ta vừa làm bảng giá đổi. */
export function xoaDem() { _dem = null; }

function goc(env) {
  return String(env.TRACKING_URL || MAC_DINH_GOC).replace(/\/+$/, "");
}

async function goiTracking(env, duong, tuyChon) {
  const khoa = env.REPORT_API_KEY;
  /* Chưa đặt Secret thì đóng, không mở — và nói rõ là THIẾU CẤU HÌNH chứ
     không phải "Tracking hỏng", để người vận hành không đi tìm nhầm chỗ. */
  if (!khoa) throw new LoiTracking("thieu-report-api-key");

  let r;
  try {
    r = await fetch(goc(env) + duong, {
      ...tuyChon,
      headers: { "X-Report-Key": khoa, ...((tuyChon && tuyChon.headers) || {}) },
    });
  } catch (e) {
    throw new LoiTracking("khong-goi-duoc-tracking");
  }
  let than = null;
  try { than = await r.json(); } catch (e) { than = null; }
  if (!r.ok) throw new LoiTracking("tracking-tra-" + r.status
    + (than && than.ly ? ":" + than.ly : ""));
  return than;
}

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Ba nhánh Tracking mà phép khớp mã cần, đúng hình dạng `khop-ma.mjs` đợi.
 *
 *  Ném `LoiTracking` khi bảng giá không dùng được. KHÔNG bao giờ trả một bộ
 *  rỗng — xem đầu file. */
export async function docNguonTracking(env) {
  const con = _dem && (Date.now() - _dem.luc < DEM_HAN) ? _dem : null;

  /* `inv_map` luôn tươi; bảng giá và bảng gộp mã đi qua bộ đệm. Gọi song
     song những nhánh thật sự phải ra mạng. */
  const [board, alias, invMap] = await Promise.all([
    con ? con.board : goiTracking(env, "/api/xuat/board"),
    con ? con.alias : goiTracking(env, "/api/xuat/alias"),
    goiTracking(env, "/api/xuat/inv_map"),
  ]);

  if (!laObj(board) || !Object.keys(board).length)
    throw new LoiTracking("bang-gia-rong");

  const bangAlias = laObj(alias) && laObj(alias.map) ? alias.map : {};
  const bangPhanLoai = laObj(invMap) && laObj(invMap.map) ? invMap.map : {};

  if (!con) _dem = { luc: Date.now(), board, alias };
  return { board, alias: bangAlias, inv_map: bangPhanLoai };
}

/** Danh sách mã cho ô chọn của màn gán tay — CHỈ ba trường màn hình cần.
 *
 *  Dựng mới từ danh sách trắng chứ không chuyển tiếp nguyên văn thứ Tracking
 *  trả: hôm nay `/api/xuat/board` đã chiếu sạch giá vốn rồi, nhưng hợp đồng
 *  đó là của repo kia và có thể nới ra mà bên này không hay. Một danh sách
 *  trắng ở đây làm việc "bảng giá bên kia thêm trường" không bao giờ thành
 *  "Báo cáo vô tình đẩy trường mới ra trình duyệt". */
export async function docMaBangGia(env) {
  const { board } = await docNguonTracking(env);
  const ds = [];
  for (const ma of Object.keys(board)) {
    const row = board[ma];
    if (!laObj(row)) continue;
    /* `hang`/`nhom` đi kèm để màn hình vá được hai cột Hãng/Ngành hàng ngay
       tại chỗ sau khi gán, không phải tải lại cả bảng. */
    ds.push({ ma, ten: String(row.name || ma),
      hang: row.brand ?? null, nhom: row.category_label ?? null });
  }
  ds.sort((a, b) => (a.ten < b.ten ? -1 : a.ten > b.ten ? 1 : 0));

  /* `hien` — CÁCH VIẾT của mã, để màn hình vá được ô ngay sau khi gán tay mà
     không phải tải lại cả bảng. Engine tính, không phải chỗ này: phép quyết
     dựa trên `maHoa()`, đúng công thức khoá `inv/map` (LUẬT SỐ 1 — xem chú
     thích ở `cachVietDsMa`). Engine chưa nối được thì bỏ qua, `hien` khuyết
     và màn hình rơi về `ma` — mất một chi tiết hiển thị, không mất chức
     năng nào. */
  if (env.REPORT_ENGINE) {
    try { return await env.REPORT_ENGINE.cachVietDsMa(ds); }
    catch (e) { /* để nguyên `ds` */ }
  }
  return ds;
}

/** Ghi một quyết định phân loại sang Tracking.
 *
 *  Gửi `ten`, KHÔNG gửi khoá: Tracking tính khoá bằng chính `invKeyOfName()`
 *  của nó rồi dội lại, nên công thức khoá chỉ có một thẩm quyền. Chỗ gọi đối
 *  chiếu khoá dội về với khoá Engine tự tính — hai repo lệch công thức thì
 *  lộ ra ngay ở lượt ghi đầu, không phải lúc giá vốn đã sai.
 *
 *  Ba chốt (mã có thật, mã còn dùng, NB-2 dòng tồn đang hoạt động) nằm ở
 *  PHÍA TRACKING — bên này không chép lại, chỉ chuyển lời từ chối thành câu
 *  cho người đọc. */
export async function ghiPhanLoai(env, ten, ma) {
  const than = await goiTracking(env, "/api/inv-map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ten, ma }),
  });
  if (!laObj(than) || typeof than.khoa !== "string")
    throw new LoiTracking("tracking-tra-thieu-khoa");
  return { khoa: than.khoa, ma: than.ma };
}

/** Lời từ chối của Tracking → câu cho người dùng đọc.
 *
 *  Mỗi câu phải nói được BƯỚC TIẾP THEO, không chỉ nói "hỏng": người đang
 *  đứng trước bảng đơn hàng cần biết mình phải làm gì, và ba trong số này
 *  có việc rất cụ thể để làm. */
export function cauLoiPhanLoai(ly) {
  const s = String(ly || "");
  if (/dang-o-ton-kho/.test(s))
    return "Mặt hàng này đang có trong Tồn kho của Tracking. Hãy phân loại bên "
      + "màn Tồn kho để hệ thống tính lại giá vốn đúng chỗ.";
  if (/ma-khong-co-tren-bang-gia/.test(s))
    return "Mã này không còn trên bảng giá — chọn lại, hoặc thêm mã bên Bảng giá trước.";
  if (/ma-khong-dung-nua/.test(s))
    return "Mã này đã được xếp vào nhóm \"Không sử dụng\" bên Tracking — chọn mã khác.";
  if (/ten-khong-phan-loai-duoc/.test(s))
    return "Tên hàng này không có ký tự chữ-số nào để làm khoá — không phân loại được.";
  if (/thieu-report-api-key/.test(s))
    return "Chưa cấu hình khoá đọc Tracking cho máy chủ Báo cáo. Báo người quản trị.";
  return "Chưa ghi được sang Tracking. Thử lại sau ít phút.";
}

/* ============ MIN THEO NGÀY BÁN ============
 *
 * `POST /api/min-ngay`, cùng khoá, cùng lối máy-với-máy. Hợp đồng
 * `daily-min-v1` — đọc `Tracking/src/min-ngay.js` đầu file cho toàn bộ luật.
 *
 * Ba trần của hợp đồng mà lớp này phải tôn trọng, không lách:
 *   · 100 mã một trang  → phân trang bằng `cursor`
 *   · 62 ngày một lượt  → một kỳ là một tháng, luôn dưới trần
 *   · 409 khi nguồn đang ghi hoặc trang đọc không nhất quán → THỬ LẠI
 *
 * 409 KHÔNG phải lỗi để báo người dùng: Tracking cố ý từ chối cả trang thay
 * vì trả một ảnh ghép của hai trạng thái database. Đúng việc phải làm là chờ
 * một nhịp rồi hỏi lại; báo lỗi ở đây là biến một cơ chế an toàn thành một sự
 * cố trước mắt người dùng.
 */

const TRAN_MA_TRANG = 100;
const LAN_THU_LAI = 3;

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ngày đầu và ngày cuối của một kỳ `YYYY-MM`. Số học lịch, không phải nghiệp
 *  vụ — nên nó ở đây chứ không phải ở Engine. `Date.UTC(y, m, 0)` là ngày cuối
 *  của tháng `m` (tháng đếm từ 1 ở đây, từ 0 ở Date). */
export function khoangNgayCuaKy(ky) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ky || ""));
  if (!m) throw new LoiTracking("ky-khong-hop-le");
  const nam = Number(m[1]), thang = Number(m[2]);
  const cuoi = new Date(Date.UTC(nam, thang, 0)).getUTCDate();
  return { tu: ky + "-01", den: ky + "-" + String(cuoi).padStart(2, "0") };
}

/* Nhớ tạm Min theo KỲ. Đổi tháng hoặc đổi line là một lượt đọc mới, mà tập mã
   của cùng một kỳ thì không đổi giữa hai lượt bấm ấy — kéo lại vài nghìn bản
   ghi mỗi lần bấm là trả tiền băng thông cho đúng một dữ liệu vừa lấy xong.
   Hạn ngắn để ngày đang chạy (còn PROVISIONAL, giá còn đổi) không bị giữ lâu. */
let _demMin = new Map();       // kỳ → { luc, than }
const DEM_MIN_HAN = 60_000;

export function xoaDemMin() { _demMin = new Map(); }

/** Min theo ngày cho một tập mã trong trọn một kỳ.
 *
 *  Gộp mọi trang thành MỘT `{ currency_unit, records, errors }`. Gộp ở đây chứ
 *  không để Engine lo: phân trang là chi tiết của đường mạng, còn Engine thì
 *  chỉ nên thấy "đây là toàn bộ câu trả lời cho tập mã đã hỏi".
 *
 *  KHÔNG cắt bớt `errors`. Mỗi cặp (mã, ngày) đã hỏi nằm ở `records` hoặc
 *  `errors`; bỏ bớt một bên là làm hỏng đúng tính chất khiến bảng kê cuối cân
 *  được, và một dòng thiếu giá vốn sẽ không còn nói được vì sao.
 *
 *  Tập mã rỗng thì KHÔNG gọi mạng — `product_codes` rỗng là 400 bên Tracking,
 *  và "kỳ này chưa mã nào được khớp" là một trạng thái thật, không phải lỗi. */
export async function docMinNgay(env, ky, dsMa) {
  const ma = [...new Set((dsMa || []).filter((x) => typeof x === "string" && x))].sort();
  if (!ma.length) return { currency_unit: null, records: [], errors: [] };

  const con = _demMin.get(ky);
  if (con && Date.now() - con.luc < DEM_MIN_HAN && con.soMa === ma.length) return con.than;

  const { tu, den } = khoangNgayCuaKy(ky);
  const records = [], errors = [];
  let donVi = null, cursor = null, trang = 0;

  /* Trần vòng lặp tính từ chính số mã — không để một `next_cursor` hỏng kéo
     Worker chạy vô hạn tới lúc bị cắt. */
  const tranTrang = Math.ceil(ma.length / TRAN_MA_TRANG) + 2;

  do {
    let than = null;
    for (let lan = 0; lan < LAN_THU_LAI; lan++) {
      try {
        than = await goiTracking(env, "/api/min-ngay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date_from: tu, date_to: den, product_codes: ma,
            ...(cursor ? { cursor } : {}) }),
        });
        break;
      } catch (e) {
        /* 409 = nguồn đang ghi, hoặc trang vừa đọc là ảnh ghép. Chờ rồi hỏi
           lại; các lỗi khác ném thẳng. Lượt cuối cũng ném — thử mãi là biến
           một sự cố kéo dài thành một request treo. */
        const laXungDot = e instanceof LoiTracking && /tracking-tra-409/.test(e.ly);
        if (!laXungDot || lan === LAN_THU_LAI - 1) throw e;
        await nghi(300 * (lan + 1));
      }
    }

    if (!laObj(than)) throw new LoiTracking("min-ngay-tra-rac");
    /* Đơn vị tiền phải NHẤT QUÁN giữa mọi trang. Lệch giữa chừng nghĩa là hai
       trang đến từ hai bản hợp đồng khác nhau — gộp lại là trộn hai thang đo
       tiền vào một mảng. */
    if (donVi === null) donVi = than.currency_unit ?? null;
    else if (than.currency_unit !== donVi) throw new LoiTracking("min-ngay-lech-don-vi");

    if (Array.isArray(than.records)) records.push(...than.records);
    if (Array.isArray(than.errors)) errors.push(...than.errors);
    cursor = than.next_cursor || null;
    trang++;
  } while (cursor && trang < tranTrang);

  const ra = { currency_unit: donVi, records, errors };
  _demMin.set(ky, { luc: Date.now(), soMa: ma.length, than: ra });
  return ra;
}
