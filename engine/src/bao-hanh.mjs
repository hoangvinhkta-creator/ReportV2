/* KÍCH HOẠT BẢO HÀNH — danh sách máy đã bán mà chưa kích hoạt bảo hành
 * trên cổng của hãng.
 *
 * Chủ dự án chốt 19/09/2026. Tab này KHÔNG phải một cách xem doanh số khác:
 * nó là một DANH SÁCH VIỆC. Mỗi dòng còn ở đây nghĩa là còn một cái máy
 * ngoài đời chưa được kích hoạt, và bấm tick là nói "xong cái này rồi".
 *
 * ── VÌ SAO NGHIỆP VỤ NẰM Ở ĐÂY, KHÔNG Ở TRÌNH DUYỆT ──
 *
 * Ba luật dưới đây đều là luật NGHIỆP VỤ (LUẬT SỐ 1 — CLAUDE.md), nên chúng
 * ở Engine chứ không ở `public/bao-hanh.js`:
 *
 *   1. dòng nào là "một cái máy đã bán" (loại chiết khấu, phụ phí, hàng trả
 *      lại — xem `laMayDaBan`);
 *   2. dòng ấy thuộc hãng nào (đọc `d.hang`, thứ `khop-ma.mjs` lấy THẲNG từ
 *      `brand` của bảng giá Tracking — không có bộ phân loại thứ hai);
 *   3. dòng ấy đã kích hoạt chưa (tra `bc/quyetdinh/kich-hoat/<kỳ>`).
 *
 * Trình duyệt chỉ nhận danh sách đã chia sẵn theo hãng và vẽ ra.
 *
 * ── DANH SÁCH HÃNG LÀ MỘT QUYẾT ĐỊNH, KHÔNG PHẢI MỘT PHÉP SUY ──
 *
 * `HANG_BAO_HANH` liệt kê tường minh mười hãng chủ dự án chốt, không suy từ
 * dữ liệu. Suy từ dữ liệu thì tháng nào không bán Hitachi là tab Hitachi
 * biến mất — mà "tháng này không có máy Hitachi nào phải kích hoạt" mới là
 * điều người dùng cần đọc được, và nó phải hiện ra thành con số 0 chứ không
 * phải thành một khoảng trống.
 *
 * ── DÒNG CHƯA CÓ HÃNG ĐI ĐÂU ──
 *
 * Chủ dự án chốt 19/09/2026: CHỈ mười tab, không thêm tab "chưa rõ hãng".
 * Nhưng dòng chưa gán mã thì `d.hang` là `null` (chưa khớp bảng giá) nên nó
 * không rơi vào tab nào cả — và một dòng biến mất trong im lặng ở một danh
 * sách việc là đúng thứ CLAUDE.md cấm. Nên chúng được ĐẾM (`chua_ro_hang`)
 * để màn hình nói được một câu thật: "còn N dòng chưa gán mã nên chưa xếp
 * được hãng". Gán mã xong là dòng tự nhảy vào đúng tab, không phải làm gì
 * thêm.
 */

/** Mười hãng có cổng kích hoạt bảo hành (chủ dự án chốt 19/09/2026).
 *
 *  Thứ tự ở đây LÀ thứ tự tab con trên màn hình — chủ dự án đọc theo thứ tự
 *  này, không theo bảng chữ cái. */
export const HANG_BAO_HANH = [
  "Samsung", "LG", "Sony", "Funiki", "Toshiba",
  "Panasonic", "Casper", "Hitachi", "Daikin", "Sharp",
];

/** Khoá so sánh tên hãng: bỏ dấu cách, bỏ hoa/thường.
 *
 *  KHÔNG phải một phép "đoán hãng" — hai vế đem so đều đã là tên hãng rồi
 *  (một vế từ `brand` của bảng giá Tracking, một vế từ `HANG_BAO_HANH` ngay
 *  trên). Việc duy nhất nó làm là để `"LG"` của bảng giá khớp `"LG"` ở đây
 *  kể cả khi một bên lỡ viết `"lg"` hay `" LG "`. Bảng giá là dữ liệu người
 *  gõ tay bên Tracking, nên chênh một dấu cách là chuyện có thật.
 *
 *  Cố ý KHÔNG bỏ dấu tiếng Việt và KHÔNG so gần đúng: mười tên trên đều là
 *  chữ Latin không dấu, còn so gần đúng là mở cửa cho đúng lớp lỗi
 *  CLAUDE.md cấm ở phần khớp mã hàng. */
export function khoaHang(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\s+/g, "").toLowerCase();
}

/** Tên hãng CHÍNH THỨC của một chuỗi, hoặc `null` nếu không thuộc mười hãng.
 *
 *  Trả về đúng cách viết trong `HANG_BAO_HANH` để cả màn hình lẫn khoá
 *  Firebase chỉ có một cách viết duy nhất — hai cách viết là hai nhánh dữ
 *  liệu cho cùng một hãng. */
export function hangChinhThuc(s) {
  const k = khoaHang(s);
  if (!k) return null;
  for (const h of HANG_BAO_HANH) if (khoaHang(h) === k) return h;
  return null;
}

/** Dòng này có phải MỘT CÁI MÁY ĐÃ BÁN — thứ duy nhất cần kích hoạt bảo hành?
 *
 *  Bốn loại bị loại ra, mỗi loại một lý do khác nhau:
 *
 *   · `la_chiet_khau` — không phải mặt hàng, là một phép trừ của cả đơn
 *     (`dong-hang.mjs` gộp thành một dòng).
 *   · `la_phu_phi_co_dinh` — vận chuyển, lắp đặt, chênh VAT. Là tiền công,
 *     không phải máy.
 *   · dính vào một lượt BÁN TRẢ LẠI (`btl_trang_thai` có mặt) — cả dòng bán
 *     lẫn dòng trả đều bị đánh dấu. Máy đã quay về kho thì không ai đi kích
 *     hoạt bảo hành cho nó.
 *   · `so_luong <= 0` — lưới cuối, bắt cả những dòng BTL mà `apDungBTL` hạ
 *     số lượng về 0 hoặc −1.
 *
 *  CỐ Ý KHÔNG loại dòng 0 đồng: quà tặng kèm vẫn là một cái máy có IMEI,
 *  vẫn phải kích hoạt bảo hành cho khách. Lọc theo tiền ở đây là để lọt đúng
 *  những máy dễ quên nhất. */
export function laMayDaBan(d) {
  if (!d || typeof d !== "object") return false;
  if (d.la_chiet_khau) return false;
  if (d.la_phu_phi_co_dinh) return false;
  if (d.btl_trang_thai) return false;
  return (Number(d.so_luong) || 0) > 0;
}

/** Tách một ô IMEI thành từng mã rời.
 *
 *  Sổ MISA ghi nhiều IMEI của cùng một dòng trong MỘT ô, ngăn nhau bằng đủ
 *  kiểu dấu — đã gặp thật `"%F1518279574 ~ %E1330129573"` trên sổ 2025 (xem
 *  `dong-hang.mjs`). Màn hình cần đếm được "dòng này khai đủ IMEI chưa", nên
 *  phép tách phải ở đây chứ không ở trình duyệt.
 *
 *  KHÔNG sửa, không bỏ ký tự lạ của từng mã: ô IMEI là thứ người dùng đối
 *  chiếu bằng mắt với cái tem trên máy, nên nó phải hiện ra ĐÚNG như trong
 *  sổ. Việc duy nhất làm ở đây là cắt và bỏ khoảng trắng thừa. */
export function tachImei(s) {
  if (s === null || s === undefined) return [];
  return String(s).split(/[~,;\n\r\/]+/).map((x) => x.trim()).filter(Boolean);
}

/** Một ô `bc/quyetdinh/kich-hoat/<kỳ>/<khoá>` có nói "đã kích hoạt" không.
 *
 *  Nhận cả `true` trần lẫn `{ luc, boi }`: bản ghi đầu tiên của một khoá do
 *  Gateway viết dạng đối tượng, nhưng một ô sửa tay trên Firebase Console
 *  rất dễ thành `true` — và hiểu nhầm nó thành "chưa kích hoạt" là bắt người
 *  dùng làm lại một việc đã xong. `false`/`null` là chưa. */
export function daKichHoat(o) {
  if (o === null || o === undefined || o === false) return false;
  if (o === true) return true;
  return typeof o === "object";
}

/** Bảng đơn đã dựng + quyết định kích hoạt → danh sách máy chưa kích hoạt,
 *  chia sẵn theo mười hãng.
 *
 *  @param bang    kết quả `dungBangDonKemMa()` — đã khớp mã (nên có `hang`),
 *                 đã áp BTL, đã áp sửa tay. Nhận bảng ĐÃ DỰNG chứ không dựng
 *                 lại từ `bc/dong`: dựng lại là bản thứ hai của cùng một
 *                 chuỗi luật, và hai bản thì trôi khỏi nhau — lúc ấy tab bảo
 *                 hành và tab báo cáo nói hai sự thật khác nhau về cùng một
 *                 dòng.
 *  @param qd      nhánh `bc/quyetdinh/kich-hoat/<kỳ>` (khoá dòng → bản ghi).
 *
 *  Trả về CẢ MƯỜI hãng, kể cả hãng không có dòng nào — xem lý do ở đầu file.
 *  Mỗi hãng có đủ hai danh sách (`chua`, `da`) vì màn hình có nút "Hiện cả
 *  đã kích hoạt" để bỏ tick nhầm (chủ dự án chốt 19/09/2026); lọc sẵn ở đây
 *  thì trình duyệt không phải tự quyết định dòng nào thuộc danh sách nào. */
export function dsKichHoat(bang, qd) {
  const quyet = qd && typeof qd === "object" ? qd : {};

  const hang = {};
  for (const h of HANG_BAO_HANH) hang[h] = { chua: [], da: [] };

  let chua_ro_hang = 0, tong_may = 0;

  for (const ng of (bang && Array.isArray(bang.ngay) ? bang.ngay : [])) {
    for (const don of (Array.isArray(ng.don) ? ng.don : [])) {
      for (const d of (Array.isArray(don.dong) ? don.dong : [])) {
        if (!laMayDaBan(d)) continue;
        tong_may++;

        const ten = hangChinhThuc(d.hang);
        if (!ten) { chua_ro_hang++; continue; }

        const o = d.khoa ? quyet[d.khoa] : null;
        const xong = daKichHoat(o);
        const imei = tachImei(d.imei);

        /* Chỉ những trường màn hình THẬT SỰ vẽ ra, không bắn cả dòng sang.
           Dòng đầy đủ mang giá nhập, lợi nhuận, quy đổi — tiền của cả công
           ty — mà tab này không hiện đồng nào trong số đó. Gửi thừa là mở
           rộng bề mặt lộ dữ liệu cho đúng không việc gì. */
        const muc = {
          khoa: d.khoa ?? null,
          ngay: ng.ngay,
          so_ct: don.so_ct,
          ma_san_pham: d.ma_hien || d.ma_san_pham,
          ten_hang: d.ma_san_pham,
          so_luong: Number(d.so_luong) || 0,
          ten_khach: don.ten_khach ?? null,
          dien_thoai: don.dien_thoai ?? null,
          dia_chi: don.dia_chi ?? null,
          imei,
          /* `thieu_imei`: số lượng 2 mà sổ chỉ khai 1 IMEI thì vẫn là thiếu.
             Đây là con số người dùng phải đi tìm lại, nên nó được tính ra
             chứ không để màn hình tự suy. */
          thieu_imei: imei.length < (Number(d.so_luong) || 0),
          da_kich_hoat: xong,
          kich_hoat_luc: xong && o && typeof o === "object" ? (o.luc ?? null) : null,
          kich_hoat_boi: xong && o && typeof o === "object" ? (o.boi ?? null) : null,
        };

        hang[ten][xong ? "da" : "chua"].push(muc);
      }
    }
  }

  const tom_tat_hang = {};
  let chua = 0, da = 0;
  for (const h of HANG_BAO_HANH) {
    /* Sắp theo NGÀY rồi tới số chứng từ: người dùng làm việc theo thứ tự bán
       ra, và hai lần mở cùng một tháng phải ra cùng một thứ tự — khoá
       Firebase không giữ thứ tự chèn. */
    hang[h].chua.sort(sapXep);
    hang[h].da.sort(sapXep);
    tom_tat_hang[h] = { chua: hang[h].chua.length, da: hang[h].da.length };
    chua += hang[h].chua.length;
    da += hang[h].da.length;
  }

  return {
    thu_tu: HANG_BAO_HANH.slice(),
    hang,
    tom_tat: { tong_may, chua, da, chua_ro_hang },
    tom_tat_hang,
  };
}

function sapXep(a, b) {
  if (a.ngay !== b.ngay) return a.ngay < b.ngay ? -1 : 1;
  if (a.so_ct !== b.so_ct) return a.so_ct < b.so_ct ? -1 : 1;
  return a.ma_san_pham < b.ma_san_pham ? -1 : a.ma_san_pham > b.ma_san_pham ? 1 : 0;
}

/* ─────────────── Hướng dẫn kích hoạt của từng hãng ─────────────── */

/** Trần số bước một hãng được khai.
 *
 *  Không phải để tiết kiệm chỗ: mỗi bước kéo theo một tấm ảnh, và một nhánh
 *  phình vô hạn thì lượt mở màn hình chậm dần mà không ai thấy nó chậm từ
 *  lúc nào. Ba mươi bước đã dài gấp nhiều lần một quy trình kích hoạt thật. */
export const BUOC_TOI_DA = 30;

/** Bản ghi hướng dẫn của một hãng, đã dọn sạch để trả ra màn hình.
 *
 *  Nhánh `bc/quyetdinh/bao-hanh/<hãng>` là dữ liệu người gõ và sửa được
 *  thẳng trên Firebase Console, nên nó KHÔNG được tin: thiếu trường, sai
 *  kiểu, thừa khoá lạ đều là chuyện có thật. Hàm này là chỗ DUY NHẤT quyết
 *  định "một hướng dẫn trông như thế nào", nên màn hình không bao giờ phải
 *  đoán.
 *
 *  Các bước sắp theo `thu_tu` rồi tới khoá — `thu_tu` trùng nhau (hai lượt
 *  thêm bước cùng lúc) thì khoá làm vế quyết định, để thứ tự không nhảy
 *  giữa hai lượt mở. */
export function donHuongDan(o) {
  const n = o && typeof o === "object" ? o : {};
  const dn = n.dang_nhap && typeof n.dang_nhap === "object" ? n.dang_nhap : {};
  const buocTho = n.buoc && typeof n.buoc === "object" ? n.buoc : {};

  const buoc = Object.keys(buocTho)
    .map((id) => {
      const b = buocTho[id];
      if (!b || typeof b !== "object") return null;
      return {
        id,
        thu_tu: Number(b.thu_tu) || 0,
        chu: b.chu ? String(b.chu) : "",
        anh: b.anh ? String(b.anh) : null,
        sua_luc: b.sua_luc ?? null,
        sua_boi: b.sua_boi ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.thu_tu !== b.thu_tu ? a.thu_tu - b.thu_tu
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    dang_nhap: {
      user: dn.user ? String(dn.user) : "",
      mat_khau: dn.mat_khau ? String(dn.mat_khau) : "",
      huong_dan: dn.huong_dan ? String(dn.huong_dan) : "",
      sua_luc: dn.sua_luc ?? null,
      sua_boi: dn.sua_boi ?? null,
    },
    buoc,
  };
}

/** Số thứ tự cho một bước MỚI thêm vào cuối.
 *
 *  Đánh số cách nhau 10 có chủ đích: chèn một bước vào giữa hai bước cũ sau
 *  này chỉ cần một số lẻ ở khoảng giữa, không phải đánh số lại cả dãy — mà
 *  đánh số lại cả dãy là một lượt ghi nhiều ô, tức nhiều chỗ hỏng nửa chừng. */
export function thuTuTiepTheo(buoc) {
  const ds = Array.isArray(buoc) ? buoc : [];
  let max = 0;
  for (const b of ds) max = Math.max(max, Number(b && b.thu_tu) || 0);
  return max + 10;
}

/* ─────────────── Xuất Excel theo form của hãng (27/09/2026) ─────────────── */

/** Hãng có nút xuất Excel, và form của từng hãng.
 *
 *  Chủ dự án chốt 27/09/2026: CHỈ LG, theo đúng file mẫu
 *  `import_sellout_template.xlsx` của cổng LG — một sheet, dòng 1 là chín
 *  tiêu đề, dữ liệu từ dòng 2. Tiêu đề chép NGUYÊN VĂN từ file mẫu, kể cả
 *  dấu xuống dòng trong ô Sell Out Date: cổng hãng đọc file theo tiêu đề,
 *  và lệch một ký tự là một lượt tải lên bị từ chối mà không ai hiểu vì sao.
 *
 *  Khai ở Engine chứ không ở trình duyệt: form nào, mã cửa hàng nào, cột nào
 *  lấy từ trường nào đều là luật nghiệp vụ. Trình duyệt chỉ nhận ma trận ô
 *  đã điền sẵn rồi đóng thành file. Hãng không có mục ở đây thì màn hình
 *  không có nút xuất — thêm hãng thứ hai là thêm một mục, không sửa màn hình. */
export const XUAT_EXCEL = {
  LG: {
    /* Mã cửa hàng Tín Phát trên cổng LG — chủ dự án chốt: MỌI dòng đều là mã
       này, không có dòng nào khác. */
    store_code: "EASV8721",
    ten_sheet: "Sheet1",
    cot: [
      "(*) Store Code", "(*) Model", "(*) Serial No", "End User Cell",
      "End User Name", "End User Address", "(*) Sell Out Date\n(yyyymmdd)",
      "Remark", "(Cột Ngày fix EOW, tùy chọn)",
    ],
    /* Độ rộng cột chép từ file mẫu — để file xuất ra mở lên trông đúng như
       file người dùng đã quen, không phải một bảng co cụm chín cột hẹp. */
    rong_cot: [15, 10.5, 13.2, 13.7, 16, 18.2, 17.3, 17.7, 25.5],
  },
};

/** Trần danh sách model không kích hoạt hàng loạt, và trần độ dài một model.
 *
 *  Nhánh này đọc TRỌN ở mọi lượt mở màn hình (nó nằm dưới
 *  `bc/quyetdinh/bao-hanh`), nên một ô người dán nhầm cả bảng giá vào sẽ làm
 *  chậm mọi lượt mở sau đó. Hai trăm model đã gấp nhiều lần số chương trình
 *  đặc biệt chạy cùng lúc. */
export const MODEL_LOAI_TRU_TOI_DA = 200;
export const DAI_MODEL_TOI_DA = 60;

/** Tên hãng CHÍNH THỨC nếu hãng ấy có nút xuất Excel, không thì `null`. */
export function hangXuatExcel(s) {
  const ten = hangChinhThuc(s);
  return ten && XUAT_EXCEL[ten] ? ten : null;
}

/** Khoá so sánh một model: bỏ khoảng trắng hai đầu, gộp khoảng trắng giữa,
 *  bỏ hoa/thường.
 *
 *  So NGUYÊN MÃ, không tiền tố, không chuỗi con, không gần đúng (CLAUDE.md —
 *  phần khớp mã hàng). `65UR8050PSB` trong danh sách loại trừ KHÔNG được kéo
 *  theo `65UR8050PSA`: một model lọt khỏi file là một cái máy phải kích hoạt
 *  tay mà vẫn còn nằm trong danh sách việc — thấy được. Còn một model bị
 *  loại nhầm vì trùng tiền tố thì cũng thấy được, nhưng là sai theo cả một
 *  dòng sản phẩm mỗi lần xuất. */
export function khoaModel(s) {
  if (s === null || s === undefined) return "";
  return String(s).trim().replace(/\s+/g, " ").toUpperCase();
}

/** Danh sách người gõ (mảng, hoặc một khối chữ mỗi dòng một model, ngăn
 *  bằng xuống dòng / dấu phẩy / chấm phẩy) → danh sách đã dọn để ghi xuống.
 *
 *  Giữ cách viết người gõ ở lần đầu tiên gặp, bỏ trùng theo `khoaModel`, và
 *  giữ nguyên thứ tự: đó là thứ tự người dùng đọc lại danh sách của mình.
 *
 *  Trả `{ ds, loi }` — `loi` khác `null` khi vượt trần. KHÔNG cắt bớt cho
 *  vừa: cắt im lặng là một model người dùng tưởng đã loại trừ vẫn đi vào
 *  file, rồi được kích hoạt hàng loạt đúng thứ chương trình đặc biệt cấm. */
export function chuanHoaDsModel(tho) {
  const ds = gomModel(tho);
  if (ds.some((m) => m.length > DAI_MODEL_TOI_DA)) return { ds: null, loi: "model-qua-dai" };
  if (ds.length > MODEL_LOAI_TRU_TOI_DA) return { ds: null, loi: "qua-nhieu-model" };
  return { ds, loi: null };
}

/** Cắt, dọn, bỏ trùng — KHÔNG áp trần. Lượt ghi áp trần (`chuanHoaDsModel`),
 *  lượt đọc thì không (`donModelLoaiTru`). */
function gomModel(tho) {
  const manh = Array.isArray(tho)
    ? tho.map((x) => (typeof x === "string" ? x : ""))
    : typeof tho === "string" ? tho.split(/[\n\r,;]+/) : [];
  const daCo = new Set();
  const ds = [];
  for (const m of manh) {
    const sach = m.replace(/[\u0000-\u001F]/g, " ").trim().replace(/\s+/g, " ");
    if (!sach) continue;
    const k = khoaModel(sach);
    if (daCo.has(k)) continue;
    daCo.add(k);
    ds.push(sach);
  }
  return ds;
}

/** Nhánh `bc/quyetdinh/bao-hanh/<hãng>/model_loai_tru` thô → bản đã dọn.
 *
 *  `ds` nhận cả mảng lẫn đối tượng khoá số: Firebase trả một mảng thưa (sửa
 *  tay trên Console, xoá một phần tử ở giữa) thành đối tượng `{"0":…, "2":…}`,
 *  và đọc nhầm nó thành "không có model nào" là xuất đúng những model đang
 *  bị cấm kích hoạt hàng loạt. */
export function donModelLoaiTru(o) {
  const n = o && typeof o === "object" ? o : {};
  let tho = n.ds;
  if (tho && typeof tho === "object" && !Array.isArray(tho)) {
    tho = Object.keys(tho).sort((a, b) => Number(a) - Number(b)).map((k) => tho[k]);
  }
  return {
    /* Đọc thì KHÔNG từ chối vì vượt trần — trần là việc của lượt ghi. Một
       nhánh lỡ dài hơn trần (sửa tay trên Console) vẫn phải được áp đủ. */
    ds: gomModel(Array.isArray(tho) ? tho : []),
    sua_luc: n.sua_luc ?? null,
    sua_boi: n.sua_boi ?? null,
  };
}

/** Ngày xuất theo giờ Việt Nam, dạng `yyyymmdd`.
 *
 *  Chủ dự án chốt 27/09/2026: Sell Out Date là ngày BẤM XUẤT, ghi thành CHỮ
 *  cố định — không phải công thức `TODAY()`, thứ tự đổi ngày mỗi lần mở lại
 *  file. Tính theo UTC+7 chứ không theo đồng hồ UTC của Worker: xuất lúc
 *  6 giờ sáng ở Hà Nội là còn "hôm qua" theo UTC, và cổng hãng sẽ ghi ngày
 *  bán lệch một ngày. */
export function ngayXuatVN(ms) {
  const d = new Date(Number(ms) + 7 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
}

/** Danh sách máy chưa kích hoạt của một hãng → ma trận ô theo form hãng.
 *
 *  @param chua     `dsKichHoat(...).hang[<hãng>].chua` — CHỈ dòng chưa tick
 *                  (chủ dự án chốt: đã tick là đã xong, không xuất lại).
 *  @param hang     tên hãng chính thức, phải có trong `XUAT_EXCEL`.
 *  @param loaiTru  kết quả `donModelLoaiTru()`.
 *  @param ms       mốc thời gian lúc bấm xuất.
 *
 *  Mỗi IMEI một dòng (chủ dự án chốt): khách mua hai máy trong một số BH là
 *  hai dòng trong file.
 *
 *  Ba loại dòng KHÔNG vào file, và KHÔNG được tick — chúng ở lại danh sách
 *  việc, và được ĐẾM để màn hình nói ra:
 *
 *   · model nằm trong danh sách loại trừ — chương trình đặc biệt, phải kích
 *     hoạt tay;
 *   · thiếu IMEI, kể cả thiếu MỘT PHẦN (số lượng 2 mà sổ chỉ khai 1 IMEI).
 *     Chủ dự án chốt bỏ dòng không có IMEI. Dòng thiếu một phần cũng bỏ trọn:
 *     tick là tick cả dòng, nên xuất một nửa rồi tick là cái máy còn lại rời
 *     khỏi danh sách việc mà chưa ai kích hoạt nó;
 *   · không có khoá dòng — không tick được, nên xuất nó là lần xuất sau nó
 *     lại vào file, và cổng hãng nhận cùng một IMEI hai lần.
 *
 *  Trả `null` nếu hãng không có form. */
export function dongXuatExcel(chua, hang, loaiTru, ms) {
  const form = XUAT_EXCEL[hang];
  if (!form) return null;

  const cam = new Set(((loaiTru && loaiTru.ds) || []).map(khoaModel));
  const ngay = ngayXuatVN(ms);
  const dong = [], khoa_tick = [];
  const bo_qua = { loai_tru: 0, thieu_imei: 0, khong_khoa: 0 };

  for (const m of Array.isArray(chua) ? chua : []) {
    if (!m || m.da_kich_hoat) continue;
    if (cam.has(khoaModel(m.ma_san_pham))) { bo_qua.loai_tru++; continue; }
    const imei = Array.isArray(m.imei) ? m.imei : [];
    if (!imei.length || m.thieu_imei) { bo_qua.thieu_imei++; continue; }
    if (!m.khoa) { bo_qua.khong_khoa++; continue; }

    for (const so of imei) {
      dong.push([
        form.store_code,
        m.ma_san_pham || "",
        so,
        m.dien_thoai || "",
        "",   // End User Name — chủ dự án chốt để trống
        "",   // End User Address — để trống
        ngay,
        "",   // Remark
        "",   // Cột Ngày fix EOW — để trống
      ]);
    }
    khoa_tick.push(m.khoa);
  }

  return {
    hang,
    ten_sheet: form.ten_sheet,
    cot: form.cot.slice(),
    rong_cot: form.rong_cot.slice(),
    ngay_xuat: ngay,
    dong,
    khoa_tick,
    bo_qua,
  };
}

/** Gắn cờ `loai_tru_xuat` lên từng dòng của những hãng có nút xuất Excel,
 *  và trả về danh sách loại trừ đã dọn của từng hãng ấy.
 *
 *  Cờ ĐI TỪ ĐÂY chứ không để màn hình tự so: "model này có nằm trong danh
 *  sách không" là cùng phép so `dongXuatExcel` dùng lúc xuất, và hai phép so
 *  ở hai nơi là hai phép trôi khỏi nhau — lúc ấy bảng nói "kích hoạt tay"
 *  mà file vẫn mang dòng đó. */
export function ganLoaiTruXuat(ds, huongDanTho) {
  const tho = huongDanTho && typeof huongDanTho === "object" ? huongDanTho : {};
  const xuat_excel = {};
  for (const h of Object.keys(XUAT_EXCEL)) {
    const lt = donModelLoaiTru(tho[h] && tho[h].model_loai_tru);
    xuat_excel[h] = { model_loai_tru: lt };
    const cam = new Set(lt.ds.map(khoaModel));
    const o = ds && ds.hang && ds.hang[h];
    if (!o) continue;
    for (const m of o.chua.concat(o.da)) m.loai_tru_xuat = cam.has(khoaModel(m.ma_san_pham));
  }
  return xuat_excel;
}
