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
