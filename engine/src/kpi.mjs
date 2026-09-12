/* DOANH SỐ QUY ĐỔI VÀ KPI THEO LINE — P5.
 *
 * ── VÌ SAO HỆ SỐ QUY ĐỔI LÀ MỘT PHÉP CHIA, KHÔNG PHẢI MỘT PHÉP NHÂN ──
 *
 * Chủ dự án chốt 12/09/2026: `doanh số quy đổi = lợi nhuận ÷ hệ số`.
 *
 * Hệ số ấy chính là TỈ SUẤT LỢI NHUẬN MỤC TIÊU của line. Hệ quả đáng ghim,
 * vì nó là cách đọc con số ra nghĩa: bán ĐÚNG tỉ suất mục tiêu thì quy đổi
 * ra BẰNG ĐÚNG doanh số thuần; lãi dày hơn mục tiêu thì quy đổi vượt lên
 * trên doanh số thật; hạ giá để chạy số thì quy đổi tụt xuống dưới.
 *
 * Lý do nghiệp vụ (nguyên văn ý chủ dự án): một tủ lạnh 30 triệu lãi 1
 * triệu và một máy giặt 10 triệu cũng lãi 1 triệu — máy giặt đem lại tỉ
 * suất lớn hơn hẳn. Chấm theo doanh số thuần thì nhân viên chỉ chạy hàng
 * giá trị lớn, và còn được phép HẠ lợi nhuận để về số cho nhanh. Chia cho
 * hệ số là bỏ hẳn đường đó: một đồng lãi đổi ra bao nhiêu "doanh số" tuỳ
 * thuộc line ấy được kỳ vọng lãi bao nhiêu phần trăm.
 *
 * ── VÌ SAO KHÔNG CÓ LUẬT RIÊNG CHO BTL / CHIẾT KHẤU / QUÀ TẶNG / PHỤ PHÍ ──
 *
 * MỘT công thức duy nhất, áp cho mọi dòng. Không phải vì lười tách, mà vì
 * P4 đã đặt `loi_nhuan` của từng loại dòng về đúng con số nghiệp vụ của nó,
 * nên phép chia tự ra đúng kết quả mà không cần ai phân loại lại:
 *
 *   phụ phí cố định  giá nhập = giá bán  → lợi nhuận 0     → quy đổi 0
 *   BTL ghép được    "2 dòng thông báo"  → lợi nhuận 0     → quy đổi 0
 *   BTL không ghép   tiền âm             → lợi nhuận âm    → quy đổi âm
 *   chiết khấu gộp   âm theo thiết kế    → lợi nhuận âm    → quy đổi âm
 *   dòng 0 đồng      có giá vốn, bán 0đ  → lợi nhuận âm    → quy đổi âm
 *   chưa có giá vốn  không biết          → lợi nhuận null  → quy đổi null
 *
 * Ba dòng âm cuối TRỪ vào doanh số quy đổi của line, và đó là chủ ý: quà
 * tặng kèm và hàng trả lại là chi phí thật, chúng hạ tỉ suất thật. Thêm một
 * luật "bỏ qua dòng âm" ở đây là dựng bản luật thứ hai về "dòng nào tính
 * tiền", cạnh bản P4 đã có — và chỗ hai bản trôi khỏi nhau là chỗ tiền sai.
 *
 * `loi_nhuan === null` KHÔNG được hoá 0: "chưa biết lãi bao nhiêu" và "lãi
 * 0 đồng" là hai chuyện khác nhau, đúng lý do `dienGiaNhap()` đã để null.
 *
 * ── HỆ QUẢ VỀ PHẠM VI, CẦN BIẾT TRƯỚC KHI ĐỌC SỐ ──
 *
 * Chuỗi phụ thuộc: quy đổi ← lợi nhuận ← giá vốn ← khớp mã. Mà
 * `MOC_KHOP_MA = "2026-09"`. Nên kỳ trước 09/2026 KHÔNG có quy đổi, và đó
 * là giới hạn dữ liệu giá của Tracking, không phải việc chưa làm. Biểu đồ
 * không bị ảnh hưởng: chủ dự án chốt chart vẫn vẽ bằng doanh số THUẦN, cố ý
 * không kéo nguồn doanh số thứ hai vào đó.
 */

/** Đường dẫn hai nhánh trên Firebase. Khai MỘT chỗ để script nạp, Gateway
 *  đọc và Gateway ghi không bao giờ trỏ lệch nhau.
 *
 *  Cả hai nằm dưới `bc/quyetdinh` chứ không mở nhánh mới: (a) đúng nghĩa
 *  "quyết định của người", và (b) nhánh đó đã có rules live
 *  (`.read: quantri|quanly`, `.write: false`, ghi qua Gateway) nên nhánh con
 *  THỪA HƯỞNG sẵn — không phải sửa rules rồi publish tay trên Console, tức
 *  bớt đúng một bước có thể quên. Cùng lý do `bc/quyetdinh/line` đã chọn. */
export const DUONG_BANG_KPI = "bc/quyetdinh/kpi";
export const DUONG_GIA_DUNG = "bc/quyetdinh/gia-dung";

/* Cùng phép làm tròn với `dong-hang.mjs`, `khop-ma.mjs` và `btl.mjs` — CHÉP
 * đúng, có chủ đích. Một phép làm tròn khác ở đây là tổng của bảng đơn lệch
 * tổng của từng dòng đúng vài đồng, và không ai lần ra được vì sao. */
const lamTron = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Hệ số mặc định của tám line "còn lại" — chủ dự án chốt 12/09/2026:
 *  "Các nhân viên khác: KPI 1.300.000, hệ số quy đổi 5,5%". */
const KPI_KHAC = 1_300_000_000;
const HE_SO_KHAC = 5.5;

/* ─────────────── Hạt giống: bộ số chủ dự án chốt 12/09/2026 ───────────────
 *
 * ĐƠN VỊ, và đây là chỗ dễ sai 1.000 lần nên ghi thẳng ra:
 *
 *   `kpi`        lưu bằng ĐỒNG. Chủ dự án gõ "2.700.000" và nói rõ "2 tỷ 7
 *                đã được ghi gọn", tức ô nhập nói NGHÌN đồng — cùng đơn vị
 *                với mọi cột "nghìn đ" đang hiện. Gateway nhân 1.000 ở lượt
 *                ghi, nhánh này luôn là ĐỒNG. Cùng kỷ luật với `min_price`
 *                của Tracking ở P4: đơn vị được QUY ĐỔI ở biên, không bao
 *                giờ để hai đơn vị cùng sống trong một nhánh.
 *   `he_so_pt`   lưu bằng PHẦN TRĂM (7.5 nghĩa là 7,5%), không phải phân số
 *                (0.075). Hậu tố `_pt` không phải để cho đẹp: 7,5 và 0,075
 *                đều là số hợp lệ, nên nếu tên trường không nói đơn vị thì
 *                một lượt ghi lẫn dạng sẽ sai tiền 100 lần mà vẫn "chạy".
 *                `kiemBangKpi()` canh khoảng (0, 100] để bắt đúng ca ấy.
 *
 * `he_so_gia_dung_pt` CHỈ Nội thành có — chủ dự án chốt: riêng tab đó mới có
 * hệ số quy đổi gia dụng. Line không khai trường này thì mọi dòng của nó ăn
 * `he_so_pt`, kể cả dòng đã được tick là gia dụng. Cố ý không suy diễn sang
 * line khác: "chỉ chốt cho Nội thành" nghĩa là chỉ Nội thành.
 */
export const BANG_KPI_HAT_GIONG = {
  mac_dinh: {
    "Nội thành":   { kpi: 15_000_000_000, he_so_pt: 2,   he_so_gia_dung_pt: 8 },
    "Tín Phát":    { kpi:  2_700_000_000, he_so_pt: 7.5 },
    "Miền Bắc":    { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    "Tổng kho":    { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    "Quyết chiến": { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    "Đông Á":      { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    "Tân Á":       { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    "Fanpage":     { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    /* Shopee chưa có dòng nào tới 08/2026 nhưng VẪN khai KPI — chủ dự án
       chốt "mỗi line 1,3 tỷ, đủ cả 8". Khai sẵn thì tháng nó bắt đầu chạy
       là có ngay mức so, không phải nhớ ra mà thêm. */
    "Shopee":      { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
    /* "Khác" gộp 5 tên nhỏ, vẫn có KPI 1,3 tỷ như mọi line còn lại. */
    "Khác":        { kpi: KPI_KHAC, he_so_pt: HE_SO_KHAC },
  },
  /* Ghi đè theo từng kỳ: `ky["2026-09"]["Tín Phát"] = { kpi, he_so_pt }`.
     Rỗng là bình thường — mặc định áp cho mọi kỳ cho tới khi có người cố ý
     đặt riêng một tháng. */
  ky: {},
};

/* ─────────────── Kiểm bảng trước khi dùng ─────────────── */

const laSoDuong = (x) => typeof x === "number" && Number.isFinite(x) && x > 0;

/** Một bản ghi hệ số có dùng được không. Trả danh sách vấn đề. */
function kiemMotMuc(m, o, van_de) {
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    van_de.push({ ma: "muc-khong-phai-doi-tuong", vi: o });
    return;
  }
  /* `kpi` được phép vắng (line chưa đặt mức) nhưng KHÔNG được phép là 0 hay
     âm: chia-đạt-bao-nhiêu-phần-trăm cho một KPI bằng 0 ra vô cực, và một
     KPI âm thì không có nghĩa nào cả. Vắng mặt thì màn hình hiện "chưa đặt
     KPI" — một câu thật, khác hẳn "đạt ∞%". */
  if (m.kpi !== undefined && m.kpi !== null && !laSoDuong(m.kpi)) {
    van_de.push({ ma: "kpi-khong-hop-le", vi: o + ".kpi" });
  }
  for (const t of ["he_so_pt", "he_so_gia_dung_pt"]) {
    if (m[t] === undefined || m[t] === null) continue;
    if (!laSoDuong(m[t])) { van_de.push({ ma: "he-so-khong-hop-le", vi: o + "." + t }); continue; }
    /* Trần 100%: chốt đơn vị, không phải chốt nghiệp vụ. Một hệ số ghi lẫn
       dạng phân số (0.075 thay vì 7.5) vẫn lọt qua "số dương" và vẫn chia ra
       một con số trông bình thường — sai đúng 100 lần. Trần này không bắt
       được ca đó một mình, nhưng nó bắt ca ngược lại (gõ 750 thay vì 7,5) và
       nói thẳng nhánh này đo bằng phần trăm. */
    if (m[t] > 100) van_de.push({ ma: "he-so-vuot-100", vi: o + "." + t });
  }
}

/** Bảng KPI có dùng được không. Trả danh sách vấn đề — rỗng là dùng được.
 *
 *  Vì sao phải kiểm: bảng này là DỮ LIỆU người sửa được trên Firebase, nó
 *  KHÔNG đi qua bộ kiểm của repo. Cùng lý do `kiemBangLine()` tồn tại. Khác
 *  `kiemBangLine()` ở một chỗ: bảng KPI sai thì KHÔNG nổ cả bảng đơn —
 *  quy đổi là MỘT cột, còn doanh số/số đơn/khách hàng đọc được mà không cần
 *  nó. Bên gọi vì vậy nhận danh sách vấn đề và nói ra, chứ không ném. */
export function kiemBangKpi(bang) {
  const van_de = [];
  if (!bang || typeof bang !== "object" || Array.isArray(bang)) {
    return [{ ma: "bang-khong-phai-doi-tuong", vi: null }];
  }
  if (bang.mac_dinh !== undefined && bang.mac_dinh !== null) {
    if (typeof bang.mac_dinh !== "object" || Array.isArray(bang.mac_dinh)) {
      van_de.push({ ma: "mac-dinh-khong-phai-doi-tuong", vi: "mac_dinh" });
    } else {
      for (const line of Object.keys(bang.mac_dinh)) {
        kiemMotMuc(bang.mac_dinh[line], "mac_dinh." + line, van_de);
      }
    }
  }
  if (bang.ky !== undefined && bang.ky !== null) {
    if (typeof bang.ky !== "object" || Array.isArray(bang.ky)) {
      van_de.push({ ma: "ky-khong-phai-doi-tuong", vi: "ky" });
    } else {
      for (const k of Object.keys(bang.ky)) {
        const cua = bang.ky[k];
        if (!cua || typeof cua !== "object" || Array.isArray(cua)) {
          van_de.push({ ma: "ky-khong-phai-doi-tuong", vi: "ky." + k });
          continue;
        }
        for (const line of Object.keys(cua)) kiemMotMuc(cua[line], "ky." + k + "." + line, van_de);
      }
    }
  }
  return van_de;
}

/* ─────────────── Hệ số đang áp cho một line trong một kỳ ─────────────── */

/* Những khoá Gateway gắn kèm mỗi lượt ghi (audit trail). Chúng KHÔNG phải
 * hệ số, nên phép hợp nhất phải bỏ qua — nếu không, một bản ghi đè chỉ đặt
 * `kpi` sẽ kéo theo `boi`/`luc` của chính nó và che mất gì khác. */
const KHOA_DAU_VET = new Set(["boi", "luc"]);

const locMuc = (m) => {
  const ra = {};
  if (!m || typeof m !== "object") return ra;
  for (const k of Object.keys(m)) {
    if (KHOA_DAU_VET.has(k)) continue;
    if (m[k] === undefined || m[k] === null) continue;
    ra[k] = m[k];
  }
  return ra;
};

/** Hệ số và KPI đang áp cho `line` trong `ky`.
 *
 *  Hợp nhất THEO TỪNG TRƯỜNG, không phải "có bản ghi đè thì thay cả bản":
 *  đặt riêng KPI của tháng 9 mà không nhắc tới hệ số thì hệ số phải vẫn là
 *  mặc định, chứ không biến mất. Đó là điều làm bộ "mặc định chung + ghi đè
 *  từng kỳ" (chủ dự án chốt 12/09/2026) dùng được thật: anh chỉ gõ đúng thứ
 *  muốn đổi.
 *
 *  `tu` nói từng trường đến từ đâu — màn hình cần nói rõ "đang là mặc định"
 *  hay "riêng tháng này", nếu không người sửa không biết mình vừa đổi cho
 *  một tháng hay cho mọi tháng. */
export function hanhKpi(bangKpi, line, ky) {
  const b = bangKpi && typeof bangKpi === "object" ? bangKpi : {};
  const md = locMuc((b.mac_dinh || {})[line]);
  const rieng = locMuc(((b.ky || {})[ky] || {})[line]);

  const ra = { kpi: null, he_so_pt: null, he_so_gia_dung_pt: null, tu: {} };
  for (const t of ["kpi", "he_so_pt", "he_so_gia_dung_pt"]) {
    if (rieng[t] !== undefined) { ra[t] = rieng[t]; ra.tu[t] = "ky"; }
    else if (md[t] !== undefined) { ra[t] = md[t]; ra.tu[t] = "mac_dinh"; }
    else ra.tu[t] = null;
  }
  /* `co_rieng_ky`: có bản ghi đè cho đúng kỳ này hay không — để màn hình
     hiện được nút "bỏ riêng tháng này". Khác `tu`: một bản ghi đè chỉ đặt
     `kpi` vẫn là "có riêng kỳ này" dù `he_so_pt` đến từ mặc định. */
  ra.co_rieng_ky = Object.keys(rieng).length > 0;
  return ra;
}

/* ─────────────── Điền doanh số quy đổi vào bảng đơn ─────────────── */

/** Tick "gia dụng" của một dòng.
 *
 *  Quyết định về MỘT MẶT HÀNG (chủ dự án chốt 12/09/2026), nên khoá là
 *  `khoa_ten` — đúng công thức CLAUDE.md quy định cho loại quyết định này,
 *  và đúng khoá `khopMaChoBangDon()` đã gắn sẵn vào từng dòng. Hệ quả là nó
 *  áp cho MỌI kỳ, kể cả kỳ chưa nhập: tick "máy giặt" một lần là tháng sau
 *  không phải tick lại.
 *
 *  Một tick chưa khớp dòng nào KHÔNG phải "quyết định mồ côi" và không được
 *  cảnh báo — CLAUDE.md nói thẳng quyết định về một mặt hàng áp cho cả kỳ
 *  chưa nhập. Băng mồ côi của P4 chỉ dành cho quyết định về MỘT DÒNG
 *  (`bc/quyetdinh/dong`), nơi mất dòng thật là mất chỗ áp. */
const laGiaDung = (d, giaDung) => {
  if (!d || !d.khoa_ten) return false;
  const m = giaDung && giaDung[d.khoa_ten];
  return !!(m && m.gia_dung === true);
};

/** Điền `doanh_so_quy_doi` cho từng dòng, từng đơn, từng ngày và cả bảng;
 *  cộng bản kê KPI theo line.
 *
 *  Lấy hệ số theo `don.line` chứ không theo `bang.line`: ở tab [Tổng hợp]
 *  bảng chứa MỌI line cùng lúc, mỗi đơn phải ăn hệ số của chính line mình.
 *  Đi theo `bang.line` thì Tổng hợp sẽ quy đổi cả công ty bằng một hệ số duy
 *  nhất — một con số trông bình thường mà sai hoàn toàn.
 *
 *  Trả về bản kê theo line; cũng gắn luôn vào `bang.tom_tat_kpi` để Gateway
 *  không phải ghép lại. */
export function dienDoanhSoQuyDoi(bang, bangKpi, ky, giaDung) {
  if (!bang || !Array.isArray(bang.ngay)) return bang;

  const theoLine = new Map();
  /* Một line hỏi một lần rồi giữ lại: bảng một tháng có hàng nghìn dòng, và
     `hanhKpi()` dựng object mới mỗi lượt gọi. */
  const hanhCua = new Map();
  const layHanh = (line) => {
    if (!hanhCua.has(line)) hanhCua.set(line, hanhKpi(bangKpi, line, ky));
    return hanhCua.get(line);
  };

  let tongQuyDoi = null;

  for (const ng of bang.ngay) {
    let quyDoiNgay = null;
    for (const don of ng.don) {
      const h = layHanh(don.line);
      let quyDoiDon = null;
      for (const d of don.dong) {
        const gd = laGiaDung(d, giaDung);
        /* Hệ số gia dụng chỉ có ở line khai nó (Nội thành). Line khác tick
           rồi cũng ăn hệ số thường — xem `BANG_KPI_HAT_GIONG`. */
        const hs = (gd && h.he_so_gia_dung_pt !== null) ? h.he_so_gia_dung_pt : h.he_so_pt;
        d.la_gia_dung = gd;
        /* Ba lý do để null, và cả ba đều là "chưa biết", không phải "bằng 0":
           chưa có giá vốn nên chưa có lợi nhuận; line chưa khai hệ số; hệ số
           không dùng được. Hoá 0 ở đây là để một ô trống nói "line này không
           đem lại đồng quy đổi nào" thay người. */
        if (d.loi_nhuan === null || d.loi_nhuan === undefined
            || !laSoDuong(hs) || hs > 100) {
          d.doanh_so_quy_doi = null;
          continue;
        }
        d.doanh_so_quy_doi = lamTron(Number(d.loi_nhuan) * 100 / hs);
        quyDoiDon = lamTron((quyDoiDon || 0) + d.doanh_so_quy_doi);
      }
      /* Tổng của ĐƠN chỉ có nghĩa khi MỌI dòng của đơn đã quy đổi được —
         cùng luật `don.loi_nhuan` của P4 ("thiếu một dòng → null"). Cộng
         phần biết được rồi gọi nó là tổng của đơn là nói một con số thiếu mà
         không dán nhãn thiếu. */
      const duQuyDoi = don.dong.every((d) => d.doanh_so_quy_doi !== null);
      don.doanh_so_quy_doi = duQuyDoi ? (quyDoiDon || 0) : null;

      const o = theoLine.get(don.line)
        || { doanh_so: 0, so_don: 0, so_dong: 0, doanh_so_quy_doi: 0, don_thieu_quy_doi: 0 };
      o.doanh_so = lamTron(o.doanh_so + (Number(don.tong_ban) || 0));
      o.so_don++;
      o.so_dong += don.dong.length;
      /* Tổng của LINE cộng mọi dòng quy đổi được, kể cả khi đơn chứa nó còn
         thiếu dòng khác — khác hẳn luật của `don`. Cố ý: đây là con số người
         dùng đối chiếu KPI, và "bỏ cả đơn vì một dòng chưa có giá" làm nó
         tụt mà không ai biết tụt bao nhiêu. `don_thieu_quy_doi` đếm số đơn
         chưa đủ, để màn hình nói thẳng tổng này còn nợ bao nhiêu đơn. */
      for (const d of don.dong) {
        if (d.doanh_so_quy_doi === null) continue;
        o.doanh_so_quy_doi = lamTron(o.doanh_so_quy_doi + d.doanh_so_quy_doi);
        quyDoiNgay = lamTron((quyDoiNgay || 0) + d.doanh_so_quy_doi);
        tongQuyDoi = lamTron((tongQuyDoi || 0) + d.doanh_so_quy_doi);
      }
      if (!duQuyDoi) o.don_thieu_quy_doi++;
      theoLine.set(don.line, o);
    }
    ng.doanh_so_quy_doi = quyDoiNgay;
  }

  bang.tom_tat.doanh_so_quy_doi = tongQuyDoi;

  /* Bản kê KPI: thêm mức KPI và phần trăm đạt cho từng line có mặt. */
  const line = {};
  for (const [ten, o] of theoLine) {
    const h = layHanh(ten);
    line[ten] = {
      ...o,
      kpi: h.kpi,
      he_so_pt: h.he_so_pt,
      he_so_gia_dung_pt: h.he_so_gia_dung_pt,
      /* Đạt bao nhiêu phần trăm KPI. `null` khi line chưa đặt KPI — màn hình
         hiện "chưa đặt KPI", không hiện "0%" (hai câu khác nhau hẳn). */
      dat_pt: laSoDuong(h.kpi) ? lamTron(o.doanh_so_quy_doi * 100 / h.kpi) : null,
    };
  }

  bang.tom_tat_kpi = {
    line,
    /* Hệ số đang áp cho line đang xem — dải setup trên màn hình đọc đúng ô
       này. `null` ở tab [Tổng hợp]: ở đó không có một hệ số nào để sửa. */
    hanh: bang.line ? layHanh(bang.line) : null,
  };
  return bang;
}

/** Tổng KPI và tổng quy đổi của CẢ công ty, theo thứ tự line chính thức.
 *
 *  Tách khỏi `dienDoanhSoQuyDoi()` vì nó cần `thu_tu` của bảng line — danh
 *  sách line CHÍNH THỨC, khai tường minh (xem `line.mjs`). Suy thứ tự từ
 *  những line có đơn thì một line chưa chạy tháng này sẽ biến khỏi bảng
 *  [Tổng hợp] thay vì hiện ra với số 0 và mức KPI của nó. */
export function gopKpiToanCongTy(tomTatKpi, thuTu) {
  const cua = (tomTatKpi && tomTatKpi.line) || {};
  const ds = Array.isArray(thuTu) ? thuTu : Object.keys(cua);

  let kpi = 0, quy_doi = 0, doanh_so = 0, so_don = 0, co_kpi = false;
  for (const ten of ds) {
    const o = cua[ten];
    if (!o) continue;
    doanh_so = lamTron(doanh_so + (o.doanh_so || 0));
    quy_doi = lamTron(quy_doi + (o.doanh_so_quy_doi || 0));
    so_don += o.so_don || 0;
    if (laSoDuong(o.kpi)) { kpi = lamTron(kpi + o.kpi); co_kpi = true; }
  }
  return {
    doanh_so, so_don,
    doanh_so_quy_doi: quy_doi,
    kpi: co_kpi ? kpi : null,
    dat_pt: co_kpi && kpi > 0 ? lamTron(quy_doi * 100 / kpi) : null,
  };
}

/* ─────────────── Một cửa cho vỏ Worker gọi ─────────────── */

/** Áp KPI lên một bảng đơn đã dựng: kiểm bảng, điền quy đổi, cộng tổng.
 *
 *  Gói ba việc lại thành MỘT hàm vì `dungBangDonKemMa()` và
 *  `dungBangDonSuaTay()` đều phải làm đủ cả ba, và hai bản sao của cùng một
 *  thứ tự gọi là đúng chỗ để chúng trôi khỏi nhau.
 *
 *  KHÔNG NÉM, kể cả khi bảng KPI sai — khác hẳn `gopTheoLine()` với bảng
 *  line. Lý do: quy đổi là MỘT cột, còn doanh số, số đơn, khách hàng, giá
 *  vốn đều đọc được mà không cần nó. Chặn cả bảng đơn vì một nhánh phụ sai
 *  là lấy đi nhiều hơn phần bị mất. Nhưng cũng KHÔNG im lặng trả quy đổi
 *  rỗng: `van_de`/`thieu_bang` đi kèm để màn hình nói thẳng vì sao cột ấy
 *  trống — đúng ba trạng thái tách bạch của CLAUDE.md ("có / không có /
 *  CHƯA BIẾT vì nguồn hỏng"). */
export function apDungKpi(bang, bangKpi, ky, giaDung, thuTu) {
  /* Vắng hẳn bảng KPI và bảng KPI SAI là hai chuyện khác nhau, nên báo bằng
     hai trường khác nhau. Vắng là trạng thái bình thường trước lượt nạp hạt
     giống đầu tiên; sai là một nhánh dữ liệu có người sửa tay làm hỏng. */
  const thieu_bang = bangKpi === null || bangKpi === undefined;
  const van_de = thieu_bang ? [] : kiemBangKpi(bangKpi);
  const dung = thieu_bang || van_de.length ? null : bangKpi;

  dienDoanhSoQuyDoi(bang, dung, ky, giaDung);
  bang.tom_tat_kpi.tong = gopKpiToanCongTy(bang.tom_tat_kpi, thuTu);
  bang.tom_tat_kpi.thieu_bang = thieu_bang;
  bang.tom_tat_kpi.van_de = van_de;
  return bang;
}
