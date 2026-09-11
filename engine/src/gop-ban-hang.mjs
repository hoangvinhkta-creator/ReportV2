/* Nghiệp vụ P2/P4: từ các Ô THÔ của "Sổ chi tiết bán hàng" (MISA) ra
 * doanh số + số đơn theo (kỳ, nhân viên, ngày).
 *
 * ĐÂY LÀ MỘT HÀM DÙNG CHUNG, CÓ CHỦ Ý. P2 nạp mốc legacy bằng script chạy
 * tay (`bin/nap-so-legacy.mjs`), P4 nhận file người dùng tải lên qua Gateway
 * — cả hai gọi ĐÚNG `gopSoBanHang()` dưới đây. Viết hai bản là hai bản trôi
 * khỏi nhau, và lúc đó chuỗi thời gian trên biểu đồ P3 sẽ có một vết nối mà
 * không ai giải thích được (ROADMAP.md, P2 → P4).
 *
 * Vì sao đuôi `.mjs` chứ không `.js` như phần còn lại của repo: file này
 * phải chạy được ở HAI nơi — Worker (esbuild bundle) và Node (bộ kiểm
 * `kiem/gop-ban-hang.js` + script nạp). Gốc repo không có `"type":
 * "module"` (bộ kiểm dùng `require`), nên một file `.js` chứa `export` bắt
 * Node phải đoán lại kiểu module. `.mjs` nói thẳng "đây là ESM", không cần
 * thêm package.json riêng cho `engine/` (engine/wrangler.toml giải thích vì
 * sao thư mục đó cố ý không có package.json).
 *
 * TRÌNH DUYỆT KHÔNG BAO GIỜ CHẠY FILE NÀY (LUẬT SỐ 1). Ở P4, trình duyệt
 * chỉ đọc .xlsx ra ma trận ô rồi gửi lên; mọi luật — cột nào là gì, dòng
 * nào bỏ, tiền tính thế nào, một "đơn" là gì — nằm ở đây, phía máy chủ.
 */

/* ─────────────── Bố cục sổ — ĐÃ XÁC MINH, KHÔNG ĐOÁN ───────────────
 *
 * Xác minh 11/09/2026 trên file thật của chủ dự án (sổ 2026, 15.041 dòng):
 * tiêu đề ở hàng 4, hàng 5 là dòng mô tả phụ phải bỏ, dữ liệu từ hàng 6.
 * Khớp từng vị trí với `app/modules/importing/raw_reader.py` của Reports V1
 * — kể cả `nhan_vien` ở cột 12, đúng như ROADMAP.md "Bước 0" yêu cầu kiểm.
 *
 * Đọc hàng 1 làm tiêu đề (mặc định của mọi thư viện đọc bảng) là SAI: hàng 1
 * là tên báo cáo, hàng 2 là khoảng ngày. Đó là lý do có `kiemBoCuc()` bên
 * dưới — sai bố cục thì BÁO LỖI, không lặng lẽ trả số rỗng. */
export const HANG_TIEU_DE = 4;
export const HANG_TIEU_DE_PHU = 5;
export const HANG_DAU_DU_LIEU = 6;

/** Vị trí cột, đếm từ 0 — cùng bảng với `raw_reader.COLUMNS` của V1. */
export const COT = {
  ngay: 0,
  so_ct: 1,
  dien_giai: 2,
  ten_hang: 3,
  ma_khach: 4,
  ten_khach: 5,
  dia_chi: 6,
  dien_thoai: 7,
  so_luong: 8,
  don_gia: 9,
  doanh_so_ban: 10,
  chiet_khau: 11,
  nhan_vien: 12,
  giao_van: 13,
  luong_chuyen: 14,
  imei: 15,
  loi_nhuan: 16,
};

/* Bốn cột KHÔNG ĐƯỢC ĐỌC ở P2/P4. Không phải vì thiếu chỗ lưu, mà vì đây là
 * dữ liệu cá nhân khách hàng: nhánh `bc/khach` đóng với MỌI vai (CLAUDE.md),
 * và P2 không cần một chữ nào trong đó để ra doanh số/số đơn. `kiem/
 * nap-so-legacy.js` canh đúng danh sách này — thêm một lượt đọc vào đây là
 * một bài kiểm đỏ, không phải một chú thích bị bỏ qua. */
export const COT_PII = ["ten_khach", "dia_chi", "dien_thoai", "ma_khach"];

/** Ô "nhân viên" trống thì tiền đi về đâu. KHÔNG bỏ dòng: bỏ là tổng tháng
 *  lệch so với sổ mà không ai biết vì sao. KHÔNG gán bừa cho ai. Dồn vào một
 *  khoá riêng nhìn thấy được, để P5 (chỉnh sửa tay) có đúng một chỗ để gán
 *  lại. Tên khoá do chủ dự án chốt (ROADMAP.md P2, "Chuẩn hoá tên nhân
 *  viên") — đừng đổi cho "đẹp hơn", P3/P5 sẽ nhận ra đúng chuỗi này. */
export const NV_CHUA_GAN = "_chua_xac_dinh";

/* ─────────────── "Doanh số của một dòng" là gì ───────────────
 *
 * Hai luật, khác nhau đúng phần chiết khấu — 120.981.000 đ trên 20 tháng:
 *
 *   "cot-doanh-so-ban"  cột `Doanh số bán` nguyên văn. Cộng lại đúng bằng
 *                       dòng `Tổng cộng` mà chính sổ in ra
 *                       (369.778.152.568 đ cho 01/2025–08/2026).
 *   "tru-chiet-khau"    `Doanh số bán − Chiết khấu` → 369.657.171.568 đ.
 *
 * ĐANG DÙNG `tru-chiet-khau` — CHỦ DỰ ÁN CHỐT 11/09/2026: "doanh số sẽ phải
 * trừ đi chiết khấu". Reports V1 cũng trừ chiết khấu (`DEC-114`, ghi rõ
 * "Owner xác nhận trực tiếp 2026-08-23"), nên đây là hai lần xác nhận độc
 * lập của cùng một người về cùng một quy tắc.
 *
 * ── VÌ SAO LẤY GỐC LÀ CỘT `Doanh số bán`, KHÔNG PHẢI `SL × ĐG` ──
 * V1 tính gốc bằng `Số lượng × Đơn giá` (`normalizer.py` repo Reports). Trên
 * sổ thật hai cách gần như trùng khít: 15.035/15.035 dòng của sổ 2026 và
 * 25.081/25.083 dòng của sổ 2025 cho CÙNG một số.
 *
 * Đúng HAI dòng lệch, cả hai ở sổ 2025 (hàng 1130 và 1131, chứng từ BH43139,
 * ngày 14/01/2025): đơn giá có phần lẻ — 4.090.909,09 và 1.681.818,18, kiểu
 * số tính ngược từ giá đã gồm VAT. MISA làm tròn cột `Doanh số bán` về đồng
 * chẵn, còn phép nhân thì giữ phần lẻ. Tổng chênh của cả 20 tháng: 0,27 đ.
 *
 * Lấy gốc là cột của sổ vì ba lẽ: (1) đó là con số CHÍNH SỔ khẳng định dòng
 * đó bán được bao nhiêu, và là con số chủ dự án thấy khi mở file; (2) VND
 * không có đơn vị nhỏ hơn đồng, nên báo cáo không nên đẻ ra "…568,27 đ";
 * (3) 0,27 đ không đủ để đánh đổi lấy hai điều trên. Phép đối chiếu chéo với
 * V1 ở P8 cũng không hề gãy vì 0,27 đ.
 *
 * Hệ quả phải nhớ: con số này KHÔNG còn bằng dòng `Tổng cộng` mà sổ tự in
 * ra. Mở sổ so bằng mắt sẽ thấy "lệch" đúng bằng tổng chiết khấu — đó là
 * ĐÚNG, không phải lỗi.
 *
 * Đổi luật = sửa đúng hằng số này rồi CHẠY LẠI script nạp. Không có chỗ thứ
 * hai phải sửa theo, nhưng nhớ: `bc/ky` lưu số ĐÃ TÍNH, nên đổi hằng số mà
 * không nạp lại thì Firebase vẫn giữ số cũ. Cả hai luật đều có bài kiểm canh. */
export const LUAT_DOANH_SO = "tru-chiet-khau";

/* ─────────────── Chuẩn hoá ─────────────── */

/** Chữ trong sổ về một dạng so sánh được: NFC (tiếng Việt có hai cách mã
 *  hoá dấu — "Đức" tổ hợp và "Đức" dựng sẵn là HAI chuỗi khác nhau nếu không
 *  chuẩn hoá, và sẽ thành hai nhân viên khác nhau trên biểu đồ), gộp mọi
 *  cụm trắng thành một dấu cách, cắt hai đầu. */
export function chuanHoaChu(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).normalize("NFC").replace(/\s+/g, " ").trim();
  return s || null;
}

/** Chu chuẩn hoá rồi hạ chữ thường — chỉ dùng để SO tiêu đề, không dùng làm
 *  khoá dữ liệu (tên nhân viên phải giữ nguyên chữ hoa để còn hiện ra). */
const deSo = v => {
  const s = chuanHoaChu(v);
  return s === null ? "" : s.toLowerCase();
};

/* Ký tự Firebase cấm trong tên khoá. Tên nhân viên đi thẳng vào đường dẫn
 * `bc/ky/<kỳ>/<nhân viên>/<ngày>`, nên một cái dấu chấm trong tên là đủ làm
 * lượt ghi thất bại — hoặc tệ hơn, ghi vào một nhánh khác. Sổ 2026 không có
 * tên nào chứa ký tự cấm (đã kiểm 13/13 nhân viên), nên đây là tấm lưới
 * phòng xa, không phải phép sửa dữ liệu đang có.
 *
 * Kèm `?&%` — thiếu chúng từng để lọt một IMEI thật của sổ 2025
 * ("%F1518279574 ~ %E1330129573") qua khoá tương tự bên `dong-hang.mjs`
 * rồi bị `kiemDuong()` chặn SAU, làm hỏng cả lượt ghi. Tên nhân viên chưa
 * gặp ca này, nhưng khoá theo đúng danh sách `kiemDuong()` cấm — như
 * chính chú thích dưới đây đã định — để phòng xa nhất quán. */
const FIREBASE_CAM = /[.#$/[\]?&%]/g;

/* Ký tự điều khiển — Firebase cũng từ chối (xem `kiemDuong` ở src/firebase.js).
 * Dựng bằng `new RegExp` với chuỗi escape thay vì nhúng byte thật vào mã
 * nguồn: một file có byte 0x00–0x1F bị công cụ coi là nhị phân (grep bỏ qua
 * nó) và dễ bị editor nào đó xoá sạch khi lưu lại. */
const DIEU_KHIEN = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Tên nhân viên → khoá Firebase dùng được. Thay ký tự cấm bằng `~` chứ
 *  không bỏ đi: bỏ đi thì "A.B" và "AB" thành CÙNG một khoá, tức gộp nhầm
 *  hai người thành một. */
export function khoaNhanVien(ten) {
  const s = chuanHoaChu(ten);
  if (s === null) return NV_CHUA_GAN;
  // Ký tự điều khiển cũng bị Firebase từ chối (xem kiemDuong ở src/firebase.js).
  return s.replace(FIREBASE_CAM, "~").replace(DIEU_KHIEN, "~");
}

/* Excel đếm ngày từ 30/12/1899 (hệ 1900, kể cả lỗi năm nhuận 1900 mà Excel
 * cố ý giữ). Tính bằng UTC, không bằng giờ địa phương: máy chạy script ở
 * múi giờ nào cũng phải ra CÙNG một ngày, nếu không thì cùng một sổ nạp ở
 * hai máy ra hai kỳ khác nhau. */
const MOC_EXCEL = Date.UTC(1899, 11, 30);

/** Ô ngày của sổ → `{ ky: "YYYY-MM", ngay: "YYYY-MM-DD" }`, hoặc `null` nếu
 *  không đọc được. Nhận cả ba dạng thật gặp: `Date` (thư viện đã đổi sẵn),
 *  số sê-ri Excel (đọc thô), và chuỗi ISO. */
export function doiNgay(v) {
  if (v === null || v === undefined || v === "") return null;

  let d = null;
  if (v instanceof Date) {
    d = Number.isNaN(v.getTime()) ? null : v;
  } else if (typeof v === "number" && Number.isFinite(v)) {
    // Phần thập phân là giờ trong ngày — P2 chỉ cần ngày, cắt bỏ.
    if (v < 1) return null;
    d = new Date(MOC_EXCEL + Math.floor(v) * 86400000);
  } else {
    const s = chuanHoaChu(v);
    if (s === null) return null;
    // "2026-01-02" hoặc "2026-01-02 00:00:00" — lấy đúng 10 ký tự đầu.
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (Number.isNaN(d.getTime())) return null;
  }
  if (d === null) return null;

  const nam = d.getUTCFullYear();
  const thang = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ngay = String(d.getUTCDate()).padStart(2, "0");
  return { ky: `${nam}-${thang}`, ngay: `${nam}-${thang}-${ngay}`, nam };
}

/** Ô tiền/số lượng → số. Ô trống và số 0 là CÙNG một sự thật nghiệp vụ ở
 *  đây (không chiết khấu = chiết khấu 0), nên trống trả 0. Chữ không phải số
 *  trả `null` — để bên gọi báo ra, không âm thầm coi là 0. */
export function doiSo(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[\s ]/g, "").replace(/,/g, "");
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* Tiền VND có thể ra phần thập phân thật (tháng 03/2026 tổng là
 * ...862.240,xx do đơn giá lẻ), nên không làm tròn về số nguyên. Làm tròn 2
 * chữ số để cắt bụi dấu phẩy động: cộng 15.000 số hạng kiểu 8.000.000 thì
 * float64 vẫn đủ 12 chữ số có nghĩa, nhưng 0,000000001 dôi ra sẽ hiện lên
 * màn hình thành một con số trông như sai. */
const lamTron = x => Math.round(x * 100) / 100;

/* ─────────────── Kiểm bố cục trước khi trích ─────────────── */

/* Những ô tiêu đề PHẢI khớp. Không kiểm cả 17 cột: tiêu đề MISA có cột đổi
 * chữ theo phiên bản, kiểm hết là tự tạo ra lỗi giả. Năm cái neo này đủ để
 * phân biệt "sổ chi tiết bán hàng" với một workbook khác — và cái neo quan
 * trọng nhất là cột 12, đúng chỗ ROADMAP.md "Bước 0" bắt phải xác minh. */
const NEO_TIEU_DE = [
  { hang: HANG_TIEU_DE, cot: COT.ngay, chua: "ngày" },
  { hang: HANG_TIEU_DE, cot: COT.so_ct, chua: "số bh" },
  { hang: HANG_TIEU_DE, cot: COT.doanh_so_ban, chua: "doanh số bán" },
  { hang: HANG_TIEU_DE, cot: COT.nhan_vien, chua: "nvbh" },
  { hang: HANG_TIEU_DE_PHU, cot: COT.so_ct, chua: "số chứng từ" },
  { hang: HANG_TIEU_DE_PHU, cot: COT.nhan_vien, chua: "tên nhân viên bán hàng" },
];

/** Ma trận ô có đúng là "Sổ chi tiết bán hàng" không. Trả danh sách neo
 *  KHÔNG khớp — rỗng là khớp.
 *
 *  Vì sao phải có hàm này thay vì cứ trích: một workbook sai bố cục vẫn đọc
 *  ra được một mớ số (cột 10 vẫn có gì đó, cột 12 vẫn có gì đó), và kết quả
 *  là Firebase đầy số vô nghĩa mà không một dòng lỗi nào. CLAUDE.md: "Nguồn
 *  hỏng thì BÁO LỖI, không bao giờ trả rỗng." */
export function kiemBoCuc(bang) {
  const lech = [];
  for (const neo of NEO_TIEU_DE) {
    const hang = Array.isArray(bang) ? bang[neo.hang - 1] : null;
    const duoc = deSo(Array.isArray(hang) ? hang[neo.cot] : null);
    if (!duoc.includes(neo.chua)) {
      lech.push({ hang: neo.hang, cot: neo.cot, mong: neo.chua, duoc: duoc || "(trống)" });
    }
  }
  return lech;
}

/* ─────────────── Hàm dùng chung: gộp theo (kỳ, nhân viên, ngày) ─────────────── */

/** Trích và gộp sổ chi tiết bán hàng.
 *
 *  `bang`: ma trận ô THÔ, `bang[0]` là hàng 1 của sheet (không phải hàng
 *  tiêu đề — xem HANG_TIEU_DE). Mỗi hàng là một mảng ô theo đúng thứ tự cột.
 *
 *  Luật đếm đơn — MƯỢN của Reports V1, không phát minh lại
 *  (`tools/chart_gapfill/extract_daily_orders.py`): MỘT SỐ CHỨNG TỪ LÀ MỘT
 *  ĐƠN, dù nó có bao nhiêu dòng hàng. ROADMAP.md P2 nói "đếm distinct trong
 *  ngày, theo nhân viên", và trên sổ thật hai luật ra cùng một số vì không
 *  chứng từ nào trải trên hai ngày hay hai nhân viên (đã kiểm 11.069/11.069
 *  chứng từ của sổ 2026). Nếu một sổ về sau KHÔNG còn đúng thế, hàm này báo
 *  `don-nhieu-ngay` / `don-nhieu-nhan-vien` và kèm `so_don_tong_lech` —
 *  không im lặng để tổng công ty cộng đôi.
 *
 *  Trả `{ ky, tom_tat, canh_bao }`. Ném `Error` khi bố cục sai — đó là ca
 *  "nguồn hỏng", phải nổ, không phải trả rỗng.
 *
 *  KHÔNG đọc, không trả, không ghi một ô nào trong `COT_PII`. */
export function gopSoBanHang(bang) {
  if (!Array.isArray(bang)) throw new Error("gop-ban-hang: can mot ma tran o");

  const lech = kiemBoCuc(bang);
  if (lech.length) {
    const e = new Error("gop-ban-hang: bo cuc so khong khop");
    e.ma = "bo-cuc-khong-khop";
    e.lech = lech;
    throw e;
  }

  /* Gom trước, kết chốt sau. `o` giữ Set số chứng từ (để đếm distinct);
     `ky` là kết quả sạch sẽ sẽ ghi vào Firebase. */
  const o = new Map();              // "kỳ\x1fnv\x1fngày" → { doanh_so, don:Set }
  const ngayCuaDon = new Map();     // số chứng từ → Set ngày
  const nvCuaDon = new Map();       // số chứng từ → Set nhân viên
  const donToanBo = new Set();
  /* Bộ đếm theo tháng chạy SONG SONG và ĐỘC LẬP với cây ô, cộng thẳng từ
     từng dòng. Đây là vế thứ hai của phép đối chiếu NỘI BỘ mà chủ dự án chốt
     làm điều kiện ra khỏi P2 (ROADMAP.md): cộng các ngày lên phải ra đúng
     tổng tháng cộng thẳng từ dòng — không rơi dòng, không đếm trùng chứng từ.
     Cộng cùng một con số bằng hai đường rồi so, chứ không đọc lại một con số
     đã cộng một lần (thế thì không kiểm được gì). */
  const thangTrucTiep = new Map();  // kỳ → { doanh_so, so_dong, don:Set }
  const nhanVien = new Map();       // TÊN NHƯ SỔ GHI (chưa qua khoaNhanVien) → { so_dong, doanh_so }

  let dong_tong = 0;
  let dong_bo_thieu_so_ct = 0;
  const thieu_ngay = [];
  const thieu_nhan_vien = [];
  const tien_khong_doc_duoc = [];
  const ngay_bat_thuong = [];
  let tien_thieu_ngay = 0;

  for (let i = HANG_DAU_DU_LIEU - 1; i < bang.length; i++) {
    const h = bang[i];
    if (!Array.isArray(h)) continue;

    /* Không có số chứng từ = không có gì để nhập. Đây CŨNG là thứ bỏ đúng
       dòng `Tổng cộng` mà sổ tự in ở cuối — cộng cả dòng đó vào là gấp đôi
       doanh thu cả năm. Cùng luật với `raw_reader.read_raw_rows` của V1. */
    const so_ct = chuanHoaChu(h[COT.so_ct]);
    if (so_ct === null) { dong_bo_thieu_so_ct++; continue; }
    dong_tong++;

    // ---- tiền của dòng ----
    let tien;
    const ban = doiSo(h[COT.doanh_so_ban]);
    if (LUAT_DOANH_SO === "tru-chiet-khau") {
      const ck = doiSo(h[COT.chiet_khau]);
      tien = (ban === null || ck === null) ? null : ban - ck;
    } else {
      tien = ban;
    }
    if (tien === null) {
      // Không đoán là 0: một dòng tiền không đọc được phải nhìn thấy được.
      tien_khong_doc_duoc.push(so_ct);
      tien = 0;
    }

    // ---- nhân viên ----
    const nv_tho = chuanHoaChu(h[COT.nhan_vien]);
    if (nv_tho === null) thieu_nhan_vien.push(so_ct);
    const nv = khoaNhanVien(nv_tho);

    // ---- ngày ----
    const t = doiNgay(h[COT.ngay]);
    if (t === null) {
      /* Không có ngày thì không có kỳ nào để xếp vào. Báo ra KÈM số tiền,
         để phép đối chiếu tổng tháng giải thích được đúng phần thiếu thay vì
         chỉ thấy một khoảng lệch không tên. */
      thieu_ngay.push(so_ct);
      tien_thieu_ngay = lamTron(tien_thieu_ngay + tien);
      continue;
    }
    /* Ngày ngoài khoảng đời thật của công ty vẫn được GIỮ NGUYÊN (như V1
       quyết: "giữ nguyên ngày đã ghi") để tổng vẫn khớp sổ, nhưng phải báo —
       một cái 2024 hay 2031 lọt vào là lỗi gõ tay ở MISA. */
    if (t.nam < 2020 || t.nam > 2100) ngay_bat_thuong.push(so_ct);

    donToanBo.add(so_ct);
    if (!ngayCuaDon.has(so_ct)) ngayCuaDon.set(so_ct, new Set());
    ngayCuaDon.get(so_ct).add(t.ngay);
    if (!nvCuaDon.has(so_ct)) nvCuaDon.set(so_ct, new Set());
    nvCuaDon.get(so_ct).add(nv);

    let tt = thangTrucTiep.get(t.ky);
    if (!tt) { tt = { doanh_so: 0, so_dong: 0, don: new Set() }; thangTrucTiep.set(t.ky, tt); }
    tt.doanh_so = lamTron(tt.doanh_so + tien);
    tt.so_dong++;
    tt.don.add(so_ct);

    /* Báo cáo tên nhân viên (`tom_tat.nhan_vien`) phải là tên ĐÚNG NHƯ SỔ
       GHI, để chủ dự án so được với file kế toán (ROADMAP.md P2). Khoá theo
       `nv_tho ?? NV_CHUA_GAN`, KHÔNG theo `nv` (khoá Firebase đã bị thay dấu
       chấm/gạch chéo bằng "~") — một tên như "0865.909.033" báo ra thành
       "0865~909~033" thì không ai so khớp được với sổ sách nữa. */
    const nvBaoCao = nv_tho ?? NV_CHUA_GAN;
    let nvt = nhanVien.get(nvBaoCao);
    if (!nvt) { nvt = { so_dong: 0, doanh_so: 0 }; nhanVien.set(nvBaoCao, nvt); }
    nvt.so_dong++;
    nvt.doanh_so = lamTron(nvt.doanh_so + tien);

    const k = t.ky + "\x1f" + nv + "\x1f" + t.ngay;
    let cell = o.get(k);
    if (!cell) { cell = { doanh_so: 0, don: new Set() }; o.set(k, cell); }
    cell.doanh_so = lamTron(cell.doanh_so + tien);
    cell.don.add(so_ct);
  }

  // ---- kết chốt: cây bc/ky + tổng theo tháng ----
  const ky = {};
  const thang = {};
  let doanh_so_tong = 0;
  let so_don_cong_o = 0;

  // Sắp khoá để cây ghi ra Firebase ổn định giữa hai lần chạy (dễ so diff).
  for (const k of [...o.keys()].sort()) {
    const [kyThang, nv, ngay] = k.split("\x1f");
    const cell = o.get(k);
    const doanh_so = lamTron(cell.doanh_so);
    const so_don = cell.don.size;

    ((ky[kyThang] ||= {})[nv] ||= {})[ngay] = { doanh_so, so_don };

    const tt = (thang[kyThang] ||= { doanh_so: 0, so_don: 0, so_nhan_vien: 0, so_ngay: 0 });
    tt.doanh_so = lamTron(tt.doanh_so + doanh_so);
    tt.so_don += so_don;
    doanh_so_tong = lamTron(doanh_so_tong + doanh_so);
    so_don_cong_o += so_don;
  }
  for (const kyThang of Object.keys(thang)) {
    thang[kyThang].so_nhan_vien = Object.keys(ky[kyThang]).length;
    const ngay = new Set();
    for (const nv of Object.keys(ky[kyThang])) {
      for (const d of Object.keys(ky[kyThang][nv])) ngay.add(d);
    }
    thang[kyThang].so_ngay = ngay.size;
  }

  // ---- cảnh báo ----
  const canh_bao = [];
  const them = (ma, ds, kem) => {
    if (!ds.length) return;
    /* Chỉ kể tối đa 20 số chứng từ: một cảnh báo dài 5.000 dòng thì không ai
       đọc, và `so_luong` đã nói đủ quy mô. Số chứng từ KHÔNG phải dữ liệu cá
       nhân — tên/SĐT/địa chỉ khách không bao giờ vào đây. */
    canh_bao.push({ ma, so_luong: ds.length, vi_du: [...new Set(ds)].slice(0, 20), ...kem });
  };
  them("thieu-nhan-vien", thieu_nhan_vien);
  them("thieu-ngay", thieu_ngay, { doanh_so_khong_xep_duoc: lamTron(tien_thieu_ngay) });
  them("tien-khong-doc-duoc", tien_khong_doc_duoc);
  them("ngay-bat-thuong", ngay_bat_thuong);
  them("don-nhieu-ngay", [...ngayCuaDon].filter(([, s]) => s.size > 1).map(([d]) => d));
  them("don-nhieu-nhan-vien", [...nvCuaDon].filter(([, s]) => s.size > 1).map(([d]) => d));

  /* Bất biến: cộng `so_don` của mọi ô phải bằng số chứng từ distinct của cả
     sổ. Lệch nghĩa là có chứng từ nằm ở hai ô — tổng công ty đang cộng đôi.
     Báo ra thành số, không chỉ thành một dòng chữ. */
  const so_don_tong = donToanBo.size;
  if (so_don_cong_o !== so_don_tong) {
    canh_bao.push({
      ma: "so-don-cong-doi",
      so_luong: so_don_cong_o - so_don_tong,
      cong_o: so_don_cong_o,
      distinct_ca_so: so_don_tong,
    });
  }

  /* ── Đối chiếu NỘI BỘ: điều kiện ra khỏi P2 (ROADMAP.md) ──
     So hai con số được cộng bằng HAI ĐƯỜNG khác nhau cho từng tháng:
       · từ cây ô   — cộng `doanh_so` của mọi (nhân viên, ngày) trong tháng
       · từ dòng    — cộng thẳng tiền của từng dòng thuộc tháng đó
     Khớp nghĩa là phép gộp không làm rơi dòng nào và không cộng dòng nào hai
     lần. Số đơn so tương tự: cộng `so_don` của các ô phải bằng số chứng từ
     KHÁC NHAU của tháng.

     So đến 2 chữ số thập phân, không so bit: tiền VND có phần thập phân thật
     (đơn giá lẻ), và hai đường cộng theo hai thứ tự khác nhau. Lệch thật thì
     lệch cả đồng, không lệch một phần trăm xu. */
  const doi_chieu_noi_bo = { khop: true, thang: {} };
  const moiKy = new Set([...Object.keys(thang), ...thangTrucTiep.keys()]);
  for (const kyThang of [...moiKy].sort()) {
    const tuO = thang[kyThang] || { doanh_so: 0, so_don: 0 };
    const tuDong = thangTrucTiep.get(kyThang) || { doanh_so: 0, so_dong: 0, don: new Set() };
    const lech_doanh_so = lamTron(tuO.doanh_so - tuDong.doanh_so);
    const lech_so_don = tuO.so_don - tuDong.don.size;
    const khop = lech_doanh_so === 0 && lech_so_don === 0;
    if (!khop) doi_chieu_noi_bo.khop = false;
    doi_chieu_noi_bo.thang[kyThang] = {
      khop,
      doanh_so_tu_o: tuO.doanh_so,
      doanh_so_tu_dong: tuDong.doanh_so,
      lech_doanh_so,
      so_don_tu_o: tuO.so_don,
      so_don_tu_dong: tuDong.don.size,
      lech_so_don,
      so_dong: tuDong.so_dong,
    };
    if (khop) continue;
    canh_bao.push({
      ma: "doi-chieu-noi-bo-lech",
      so_luong: 1,
      ky: kyThang,
      lech_doanh_so,
      lech_so_don,
    });
  }

  /* Danh sách tên nhân viên ĐÚNG NHƯ SỔ GHI, kèm số dòng và doanh số. Chủ dự
     án đối chiếu danh sách này với danh sách nhân viên trong file kế toán rồi
     nói tên nào là biến thể của tên nào — `gopSoBanHang` KHÔNG TỰ ĐOÁN việc
     đó (ROADMAP.md P2: "đừng tự đoán ghép vào ai"). Sắp theo doanh số giảm
     dần để biến thể lạ của một người hay bán nổi lên ngay. */
  const nhan_vien = {};
  for (const [ten, v] of [...nhanVien].sort((a, b) => b[1].doanh_so - a[1].doanh_so)) {
    nhan_vien[ten] = { so_dong: v.so_dong, doanh_so: v.doanh_so };
  }

  return {
    ky,
    tom_tat: {
      luat_doanh_so: LUAT_DOANH_SO,
      dong_tong,
      dong_bo_thieu_so_ct,
      doanh_so_tong,
      so_don_tong,
      so_don_cong_o,
      thang,
      doi_chieu_noi_bo,
      nhan_vien,
    },
    canh_bao,
  };
}
