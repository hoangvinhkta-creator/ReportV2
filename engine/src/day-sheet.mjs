/* ĐẨY SANG GOOGLE SHEET — dựng ma trận ô từ bảng đơn hàng của một line.
 *
 * Chủ dự án chốt 13/09/2026: mỗi tháng tạo một Sheet mới cho từng nhân viên,
 * dán link vào tab line tương ứng, rồi mỗi ngày app tự ghi sang. Bố cục cột
 * là bố cục các sheet nhân viên anh đã dùng suốt 2026 (file "Báo cáo Kinh
 * doanh 2026").
 *
 * VÌ SAO FILE NÀY Ở ENGINE, KHÔNG Ở GATEWAY, VÀ TUYỆT ĐỐI KHÔNG Ở TRÌNH
 * DUYỆT (LUẬT SỐ 1):
 *
 *   · quyết định cột nào lấy trường nào là một luật nghiệp vụ;
 *   · phép chia 1.000 (đồng → nghìn đồng) là một phép ĐỔI ĐƠN VỊ trên tiền;
 *   · luật "chỉ dòng đầu của đơn mới mang ngày/số BH/khách" quyết định con
 *     số `count()` trong công thức của chủ dự án ra SỐ ĐƠN hay SỐ DÒNG.
 *
 * Repo Marketing có một đường đẩy Sheet đi NGƯỢC chiều — trình duyệt dựng
 * dòng, Worker chỉ chuyển tiếp (`src/sheet.js` bên đó). Đừng chép sang đây:
 * bên ấy làm vậy để tránh dựng bản sao thứ ba của `vanTay`/`cOf()`, còn bên
 * này thì chính CLAUDE.md cấm chiều đó. Hai repo, hai bài toán ngược nhau.
 */

/* ─────────────── Bố cục cột, chốt 13/09/2026 ───────────────
 *
 * Chủ dự án gửi ảnh hàng tiêu đề và chốt từng cột. `null` = Ô KHÔNG ĐƯỢC
 * ĐỤNG TỚI — không phải "ghi ô rỗng". K–N là chỗ anh để dành cho cột tay
 * (Giao hàng, Chi phí giao, Giá thực nhập, Lợi nhuận gộp của file cũ); ghi
 * rỗng đè lên đó là xoá mất thứ anh vừa gõ, im lặng.
 *
 * Bốn cột của bảng đơn KHÔNG có chỗ trên Sheet và bị bỏ theo đúng chỉ thị
 * ("cột nào tab không có thì không cần đẩy"): Ghi chú, Ngành hàng, và hai
 * nút Sửa/Xoá. Cột Quy đổi thì NGƯỢC LẠI — file cũ không có, chủ dự án chốt
 * thêm vào J.
 */
export const COT_SHEET = [
  "Ngày", "Số BH", "Nơi nhập", "Mã Sản phẩm", "Số lượng",
  "Giá nhập TT", "Giá bán", "Tổng bán", "Lợi nhuận", "Quy đổi",
  null, null, null, null,
  "Tên khách hàng", "Số điện thoại", "Địa chỉ", "Hãng", "IMEI",
];

/** Chỉ số cột (đếm từ 0) mang TIỀN — chia 1.000 khi đẩy, và Gateway phủ
 *  định dạng `#,##0` lên đúng những cột này. Khai MỘT chỗ để hai việc ấy
 *  không thể lệch nhau. */
export const COT_TIEN = [5, 6, 7, 8, 9];

/** Chỉ số cột mang NGÀY — Gateway phủ định dạng `dd/mm/yyyy`. */
export const COT_NGAY = 0;

/** Hàng đầu tiên được ghi (đếm từ 1, theo cách Sheets đánh số).
 *
 *  Dòng 1 là công thức tổng của chủ dự án — `Summary` của anh trỏ thẳng vào
 *  đó (`'01.2026 Ly'!$B$1` …). Dòng 2 là hàng tiêu đề anh tự gõ. Cả hai
 *  KHÔNG BAO GIỜ bị lượt đẩy chạm vào; đó là điều kiện để "ghi đè số liệu
 *  không liên quan gì tới Summary" đúng như anh chốt. */
export const HANG_DAU = 3;

/* Trần một lượt đẩy. Line dày nhất đo trên sổ thật là Nội thành ~1.600 dòng
   hàng một tháng; để rộng gấp ba cho còn chỗ lớn lên. Có trần vì một lượt
   hỏng không được phép ngốn hết CPU của Worker — lưới chặn, không phải giới
   hạn nghiệp vụ. */
export const TRAN_DONG = 5000;

/* Mốc số sê-ri ngày của bảng tính: 30/12/1899. Cùng hằng số `gop-ban-hang.mjs`
   dùng để ĐỌC ngày từ .xlsx — ở đây đi ngược lại, và cố ý giữ nguyên con số
   ấy chứ không làm tròn thành 1900: Sheets và Excel dùng chung cái mốc lệch
   hai ngày này, và "sửa" nó là mọi ngày lệch đi hai hôm. */
const MOC_SERIAL = Date.UTC(1899, 11, 30);

/** "YYYY-MM-DD" → số sê-ri ngày của bảng tính, hoặc `null`.
 *
 *  Gửi SỐ chứ không gửi chuỗi "13/09/2026", và đây là một quyết định an
 *  toàn chứ không phải thẩm mỹ: gửi chuỗi thì phải dùng `USER_ENTERED` để
 *  Sheets chịu hiểu nó là ngày, mà `USER_ENTERED` cũng diễn giải luôn mọi ô
 *  bắt đầu bằng `=`, `+`, `-` thành CÔNG THỨC. Tên hàng trên sổ MISA có ô
 *  bắt đầu bằng dấu trừ. Gửi số + `RAW` thì mọi ô chữ vào Sheet nguyên văn,
 *  không ô nào thành công thức, và ngày vẫn là ngày thật cộng trừ được. */
export function serialNgay(ngay) {
  if (typeof ngay !== "string") return null;
  const m = ngay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(t)) return null;
  return Math.round((t - MOC_SERIAL) / 86400000);
}

/** Đồng → nghìn đồng, giữ tới 3 số lẻ.
 *
 *  Giữ phần lẻ chứ không làm tròn: trên 27.299 dòng của ba sổ thật có 5 dòng
 *  không chẵn nghìn (4.090.909,09 đ — số tính ngược từ giá gồm VAT). Làm
 *  tròn ở đây là bịa mất phần lẻ của chính sổ, và người đối chiếu từng dòng
 *  với MISA sẽ thấy lệch mà không hiểu vì sao. Cùng luật `nghin()` của màn
 *  hình đang dùng. */
function sangNghin(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n) / 1000;
}

/** Ô chữ: rỗng/không có → `null` (Gateway ghi ô trống). */
function chu(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Bảng đơn hàng của MỘT line → các khối ô để ghi sang Sheet.
 *
 * Trả về từng KHỐI liền mạch thay vì một ma trận 19 cột, vì K–N phải được
 * bỏ qua chứ không ghi đè: một lượt `values.update` trên dải A:S sẽ xoá
 * trắng bốn cột ấy dù mình gửi `null`. Hai khối = hai dải rời (A:J và O:S),
 * và khoảng giữa không có lệnh nào chạm tới.
 *
 * @param bang kết quả `dungBangDonKemMa` / `dungBangDonSuaTay`
 * @returns {{khoi: Array<{cot_dau: string, cot_cuoi: string, dong: any[][]}>,
 *            so_dong: number, hang_dau: number, hang_cuoi: number}}
 */
export function dungKhoiSheet(bang) {
  const ngay = bang && Array.isArray(bang.ngay) ? bang.ngay : [];

  const hang = [];
  const bang_ngay = [];   // dải hàng của từng ngày, để tô xám
  const RONG = 15;        // 10 ô khối trái + 5 ô khối phải
  let soDongThat = 0;     // đếm riêng, KHÔNG suy từ hang.length

  for (const n of ngay) {
    /* Một DÒNG TRỐNG ngăn giữa hai ngày (chủ dự án chốt 13/09/2026, gửi kèm
       ảnh mẫu). Chỉ chen GIỮA: không có dòng trống trước ngày đầu, sau ngày
       cuối, hay quanh một ngày rỗng.

       Chèn LƯỜI — ngay trước dòng hàng đầu tiên của ngày, không phải ở đầu
       vòng lặp. Chèn ở đầu vòng lặp thì một ngày không có dòng nào (về lý
       thuyết `dungBangDon` không sinh ra, nhưng đừng để cấu trúc phụ thuộc
       vào điều đó) sẽ đẻ ra HAI dòng trống liền nhau, và mọi dải tô xám bên
       dưới trượt đi một hàng. */
    let tuHang = 0;
    const moNgay = () => {
      if (tuHang) return;
      /* Dòng trống là một hàng toàn `null` chứ không phải mảng rỗng — phải
         giữ ĐÚNG bề rộng thì hàng kế tiếp mới rơi đúng cột. */
      if (hang.length) hang.push(new Array(RONG).fill(null));
      tuHang = HANG_DAU + hang.length;
    };

    const don = Array.isArray(n.don) ? n.don : [];
    for (const d of don) {
      const dong = Array.isArray(d.dong) ? d.dong : [];
      for (let i = 0; i < dong.length; i++) {
        const r = dong[i];
        moNgay();
        soDongThat++;
        /* Chủ dự án chốt: ngày · số BH · tên khách · SĐT · địa chỉ CHỈ nằm
           ở dòng đầu của đơn, các dòng hàng sau để trống — y như file cũ.
           Nhờ vậy đếm cột B ra đúng SỐ ĐƠN, và nhìn bằng mắt thấy ngay đơn
           nào nhiều món. Lặp ở mọi dòng thì cả hai điều đó mất. */
        const dau = i === 0;
        hang.push([
          /* A */ dau ? serialNgay(n.ngay) : null,
          /* B */ dau ? chu(d.so_ct) : null,
          /* C */ chu(r.noi_nhap),
          /* D */ chu(r.ma_hien || r.ma_bang_gia || r.ma_san_pham),
          /* E */ r.so_luong === null || r.so_luong === undefined
            ? null : Number(r.so_luong),
          /* F */ sangNghin(r.gia_nhap),
          /* G */ sangNghin(r.gia_ban),
          /* H */ sangNghin(r.tong_ban),
          /* I */ sangNghin(r.loi_nhuan),
          /* J */ sangNghin(r.doanh_so_quy_doi),
          /* O */ dau ? chu(d.ten_khach) : null,
          /* P */ dau ? chu(d.dien_thoai) : null,
          /* Q */ dau ? chu(d.dia_chi) : null,
          /* R */ chu(r.hang),
          /* S */ chu(r.imei),
        ]);
      }
    }

    /* `tuHang` còn 0 nghĩa là ngày ấy không có dòng nào — không có mảng nào
       để tô, và cũng chưa chen dòng trống nào. Không đẩy một dải rỗng vào
       `bang_ngay`: dải `tu > den` là yêu cầu tô ngược, Google từ chối CẢ
       lượt định dạng chứ không bỏ qua mỗi dải ấy. */
    if (tuHang) bang_ngay.push({ tu: tuHang, den: HANG_DAU + hang.length - 1 });
  }

  /* Ném chứ không cắt bớt. Cắt bớt là đẩy sang Sheet một tháng THIẾU dòng mà
     trên Sheet không có gì nói là thiếu — đúng loại sai im lặng CLAUDE.md
     cấm. Chạm trần ở đây gần như chắc chắn là dữ liệu bất thường, và người
     ta cần biết điều đó chứ không cần một bảng cụt. */
  if (hang.length > TRAN_DONG) {
    throw new Error("day-sheet: qua nhieu dong (" + hang.length + " > " + TRAN_DONG + ")");
  }

  /* `so_dong` là số dòng HÀNG THẬT — thứ đi ra màn hình ("Xong — N dòng").
     Đếm cả dòng trống vào đó là báo cho chủ dự án một con số không khớp với
     bất cứ thứ gì anh đếm được trên sổ. `tong_hang` mới là thứ dùng để tính
     dải ô, và hai con số này lệch nhau đúng bằng số ngày trừ một. */
  return {
    khoi: [
      { cot_dau: "A", cot_cuoi: "J", dong: hang.map((h) => h.slice(0, 10)) },
      { cot_dau: "O", cot_cuoi: "S", dong: hang.map((h) => h.slice(10, 15)) },
    ],
    so_dong: soDongThat,
    tong_hang: hang.length,
    bang_ngay,
    hang_dau: HANG_DAU,
    hang_cuoi: HANG_DAU + hang.length - 1,
  };
}
