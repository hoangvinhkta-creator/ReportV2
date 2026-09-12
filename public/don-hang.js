/* Màn chủ (P3) — hai tab chính, rồi năm/tháng, rồi line, rồi bảng đơn.
 *
 * Bố cục chủ dự án chốt lại 11/09/2026:
 *
 *   [Báo cáo doanh số] [Biểu đồ]              ← tab CHÍNH
 *     [2025][2026]   [T1][T2]…[T12]          ← cùng MỘT hàng, cách nhau
 *     [Tổng hợp][Tín Phát][…][Ẩn/hiện line 0đ]
 *       bảng đơn hàng, nhóm theo ngày rồi theo số BH
 *
 * Ba điều đáng nói vì sau này dễ sửa nhầm:
 *
 * · Đủ 12 nút tháng, tháng không có dữ liệu thì `disabled`. Trước đây chỉ vẽ
 *   tháng CÓ dữ liệu, nên một năm mới nạp được hai tháng trông như thể cả
 *   năm chỉ có hai tháng — người dùng không phân biệt được "chưa tải" với
 *   "không có đơn".
 *
 * · Line doanh số 0 bị GIẤU sau một nút bật/tắt, và điều kiện giấu là
 *   "không đơn nào VÀ không dòng nào", chứ không phải "doanh số = 0". Shopee
 *   tháng 09/2026 có 2 đơn nhưng 0 đ; đó là dữ liệu thật cần nhìn thấy, giấu
 *   đi là giấu mất một sai lệch đáng ngờ.
 *
 * · Hàng CHỌN THÁNG không có trong file báo cáo tay, nhưng dữ liệu lưu theo
 *   kỳ (`bc/dong/<YYYY-MM>`), một tháng nặng ~390 KB. Mở thẳng cả năm là kéo
 *   về ~4,7 MB cho một lượt xem — chọn tháng giữ mỗi lượt mở ở đúng một lượt
 *   đọc.
 *
 * Ô `#o-dashboard` để TRỐNG cho nhánh P2(b) lắp biểu đồ vào (quy ước ghi ở
 * ROADMAP.md). File này không vẽ biểu đồ nào, chỉ bật/tắt cái hộp bọc nó.
 *
 * LUẬT SỐ 1: mọi con số trong bảng — tổng bán, lợi nhuận, dòng chiết khấu
 * gộp — đều do Engine tính sẵn và trả về (`engine/src/dong-hang.mjs`). File
 * này chỉ đọc field có sẵn và vẽ ra; chỗ duy nhất nó động vào số là chia
 * 1.000 để hiện theo nghìn đồng, và đó là ĐỊNH DẠNG chứ không phải nghiệp vụ.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* Tiền hiện theo nghìn đồng (`6.450` = 6.450.000 đ) — chủ dự án chốt
     11/09/2026. Đây là ĐỊNH DẠNG, không phải phép tính nghiệp vụ: con số
     gốc vẫn là đồng, do Engine tính.

     Hai hàm chứ không một, vì hai chỗ cần hai thứ khác nhau:

     · `nghin` — DÒNG HÀNG. Giữ tới 3 số lẻ. Trên 27.299 dòng của ba sổ
       thật có 5 dòng không chẵn nghìn (9.950.001 đ, 4.090.909,09 đ — số
       tính ngược từ giá gồm VAT). Làm tròn ở đây là bịa mất phần lẻ của
       chính sổ, và người đối chiếu từng dòng với MISA sẽ thấy lệch.

     · `nghinTron` — DÒNG TỔNG. Làm tròn về nghìn chẵn. Một cái đuôi ",001"
       ở dòng tổng của cả line không nói thêm điều gì mà chỉ làm số khó
       đọc — chủ dự án chốt sau khi thấy "4.047.885,001" trên bản thật. Chỉ
       đổi cách VIẾT: số trong Firebase không đổi một đồng nào. */
  function nghin(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
  }
  function nghinTron(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return Math.round(n / 1000).toLocaleString("vi-VN");
  }
  const soNguyen = (v) => (Number(v) || 0).toLocaleString("vi-VN");

  function nhanNgayDay(d) {
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(d || "");
  }

  function el(the, lop, chu) {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  }
  /** Ô của bảng: `null` hiện "—" chứ không hiện 0. "0 đồng" và "chưa biết" là
   *  hai chuyện hoàn toàn khác nhau, và nhầm hai thứ đó trên một cột tiền là
   *  nhầm tiền. (Cột Ghi chú đã có nguồn từ 12/09/2026 — cột `Diễn giải` của
   *  sổ; còn lại "Doanh số quy đổi" chờ chốt công thức.) */
  const o = (v, lop) => el("td", lop, v === null || v === undefined || v === "" ? "—" : v);

  /** Ô HẸP: chữ dài bị cắt bớt chứ không ngắt xuống dòng (chủ dự án chốt
   *  11/09/2026). Phải bọc trong một <span> khối thì `max-width` mới có tác
   *  dụng — bố cục bảng tự động bỏ qua `max-width` đặt thẳng lên <td>. Chữ
   *  đầy đủ giữ ở `title` để rê chuột còn đọc được. */
  function oHep(v, lop) {
    const rong = v === null || v === undefined || v === "" ? "—" : String(v);
    const td = el("td", "oHep " + lop);
    const s = el("span", null, rong);
    if (rong !== "—") s.title = rong;
    td.appendChild(s);
    return td;
  }

  /* 19 cột chủ dự án chốt 11/09/2026. "Doanh số quy đổi" chờ P4/P5 (công
     thức quy đổi là nghiệp vụ, nằm ở Engine — LUẬT SỐ 1), cùng với giá nhập,
     lợi nhuận, nơi nhập, hãng, ngành hàng. Hai cột icon cuối là Sửa/Xoá
     dòng, còn khoá cho tới P3 lượt 2. */
  const COT = ["Ngày", "Số BH", "Nơi nhập", "Mã sản phẩm", "SL", "Giá nhập", "Giá bán",
    "Tổng bán", "Lợi nhuận", "Doanh số quy đổi", "Ghi chú",
    "Tên khách hàng", "Số điện thoại", "Địa chỉ",
    "Hãng", "Ngành hàng", "IMEI", "Sửa", "Xoá"];

  /* Bề rộng CHỐT CỐ ĐỊNH cho từng cột, đi cùng `table-layout: fixed` (chủ dự
     án chốt 12/09/2026). Trước đây bề rộng do nội dung quyết định, nên đúng
     lúc P4 điền chữ vào những ô đang là "—" thì cả bảng nống ra và dịch chỗ —
     mà gán mã là việc làm liên tục trên cùng một màn hình, mỗi lần gán một
     cái giật bố cục là không dùng được. Cố định rồi thì điền gì vào cũng
     không xê dịch một pixel.

     Phải đúng 19 số, đúng thứ tự `COT` — `kiem/bo-cuc-man-chu.js` canh cặp. */
  const RONG_COT = [78, 78, 92, 240, 44, 82, 82, 90, 86, 96, 92,
    132, 94, 152, 92, 112, 112, 34, 34];

  const trangThai = { nam: null, line: null, ky: null, dsKy: null, hienLine0: false };

  /** Ghim đầu cột: đổi cách khung `.bocBang` cuộn, không đổi một dòng CSS
   *  `position: sticky` nào cả (chủ dự án chốt 12/09/2026 — "khi kéo có
   *  thể nhận diện được ô nào thuộc cột nào").
   *
   *  Đo bằng Playwright mới thấy: `.bocBang { overflow-x: auto }` MỘT MÌNH
   *  đã đủ để trình duyệt tự áp `overflow-y: auto` (luật phụ thuộc của CSS
   *  Overflow — hai trục không được lệch pha "một cái auto, một cái
   *  visible"). Hệ quả là `<th>` tuy đã khai `position: sticky` nhưng chỉ
   *  "dính" so với CHÍNH khung này — mà khung không cao theo tay lái, nó
   *  cao theo NỘI DUNG, nên không có gì để cuộn BÊN TRONG nó cả; người
   *  dùng cuộn cả TRANG thì đầu cột trôi tuột theo, đo được top đổi từ
   *  416px xuống −483px sau một lượt cuộn.
   *
   *  Sửa bằng cách cho khung một CHIỀU CAO TRẦN rồi để nó tự cuộn dọc BÊN
   *  TRONG — khi ấy sticky "dính" đúng vào khung đang cuộn thật. Phần
   *  TRÊN khung (tab tháng/line, dòng tổng doanh số, các băng cảnh báo)
   *  nằm ngoài vùng cuộn nên tự nhiên đứng yên — đúng luôn ý "ghim từ dòng
   *  tiêu đề trở lên", không cần một `position: sticky` thứ hai cho riêng
   *  chúng.
   *
   *  Tính bằng JS chứ không một con số CSS tĩnh: phần TRÊN khung dài ngắn
   *  khác nhau tuỳ kỳ đang mở (có băng lỗi nguồn giá, có băng BTL hay
   *  không…), một con số cố định đúng cho kỳ này sẽ sai cho kỳ khác. */
  function dieuChinhCaoBang() {
    const boc = document.querySelector("#veDonHang .bocBang");
    if (!boc) return;
    const dinh = boc.getBoundingClientRect().top;
    /* Sàn 260px: màn rất thấp (điện thoại nằm ngang) vẫn phải còn đủ chỗ
       để thấy vài dòng — thà cả trang cuộn thêm một chút còn hơn ép khung
       bảng bẹp dí không dùng được. */
    boc.style.maxHeight = Math.max(260, window.innerHeight - dinh - 12) + "px";
  }
  window.addEventListener("resize", dieuChinhCaoBang);

  async function goi(duong) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    const r = await fetch(duong, { headers: { Authorization: "Bearer " + token } });
    const than = await r.json().catch(() => ({}));
    /* Kèm `rid` — cầu nối an toàn tới đúng dòng log của lượt gọi này, xem
       chú thích đầy đủ ở hàm cùng tên trong tai-len.js. */
    if (!r.ok) throw new Error((than.loi || ("HTTP " + r.status)) + (than.rid ? " (mã: " + than.rid + ")" : ""));
    return than;
  }

  /** Nút Sửa/Xoá của một dòng. Còn `disabled` ở lượt này: máy khoá đã có và
   *  đã được kiểm (`doiChieuKy` giữ dòng đã sửa tay khỏi bị đè), nhưng đường
   *  ghi `bc/quyetdinh/dong/<kỳ>` là việc của P3 lượt 2. Hiện ra mờ để thấy
   *  trước chỗ chứ không giả vờ bấm được rồi im lặng không làm gì. */
  function nutDong(bieuTuong, nhan, bat, viec) {
    const td = el("td", "oIcon");
    const b = el("button", "nutIcon", bieuTuong);
    b.type = "button";
    b.disabled = !bat;
    b.title = bat ? nhan
      : nhan + " — dòng này không sửa được (chiết khấu, hoặc kỳ ngoài phạm vi)";
    b.setAttribute("aria-label", nhan);
    if (bat) b.dataset.viec = viec;
    td.appendChild(b);
    return td;
  }

  /* ---- Vẽ bảng đơn hàng của một (kỳ, line) ---- */

  /** Ô "Mã sản phẩm" — vẫn hiện NGUYÊN câu tên hàng như trước (chủ dự án
   *  chốt: dòng đã phân loại giữ y như cũ). Khác biệt duy nhất nằm ở dòng
   *  CHƯA phân loại: chữ mờ đi, gạch chân nhạt, con trỏ bàn tay — lướt mắt
   *  là thấy đúng chỗ còn nợ, không phải dò từng dòng.
   *
   *  Dòng đã có mã vẫn bấm được: một lượt khớp TỰ ĐỘNG có thể sai, và không
   *  cho sửa thì cái sai ấy nằm lại vĩnh viễn. Mã đang gán để ở `title`, chỗ
   *  duy nhất thêm được thông tin mà không đổi thứ đang hiện. */
  function oMaSanPham(d, trongPhamVi) {
    const td = el("td", "oTen oMa");
    const s = el("span", null, d.ma_san_pham);
    td.appendChild(s);

    /* Phụ phí cố định (Chi phí vận chuyển / lắp đặt / Chênh VAT) cùng một
       lối với chiết khấu: không phải mặt hàng, không cần phân loại, nên ô
       hiện phẳng — không vàng, không bấm được. */
    if (d.la_chiet_khau || d.la_phu_phi_co_dinh) { td.className = "oTen"; return td; }

    /* Kỳ ngoài phạm vi: ô hiện y như một ô chữ thường, không tô, không bấm
       được. Chốt ở MỘT CỜ của cả lượt đọc chứ không suy từ hình dạng từng
       dòng — lời hứa "tháng cũ không làm phiền" khi ấy không phụ thuộc vào
       việc mọi dòng có sạch trường khớp mã hay không. */
    if (trongPhamVi === false) { td.className = "oTen"; return td; }

    td.dataset.o = "ma";
    td.dataset.ten = d.ma_san_pham;
    if (d.khoa_ten) td.dataset.khoa = d.khoa_ten;

    if (d.ma_bang_gia) {
      td.dataset.ma = d.ma_bang_gia;
      td.title = "Mã bảng giá: " + d.ma_bang_gia
        + (d.nguon_ma === "tu-dong" ? " (máy tự khớp — bấm để sửa)" : " (đã gán tay — bấm để đổi)");
    } else if (d.nguon_ma === "bo-qua") {
      td.classList.add("maBoQua");
      td.title = "Đã đánh dấu không phải sản phẩm cần gán mã — bấm để đổi.";
    } else if (d.nguon_ma === null && d.ly_do_chua_ma) {
      td.classList.add("maChuaCo");
      td.title = LY_DO_MA[d.ly_do_chua_ma] || "Chưa có mã — bấm để phân loại.";
    } else {
      /* Nguồn Tracking hỏng nên phép khớp không chạy lượt này. KHÔNG tô như
         "chưa phân loại": ta không biết dòng này đã có mã hay chưa, và vẽ nó
         thành "chưa có" là để một sự cố mạng nói thay người. Băng cảnh báo
         phía trên đã nói rõ, ô này giữ nguyên như cũ và không bấm được. */
      delete td.dataset.o;
    }
    return td;
  }

  /** Ô "Nơi nhập" — NCC giữ giá Min của đúng ngày bán.
   *
   *  Chưa tra được giá Min thì cũng chưa có nơi nhập, và ô bôi đỏ (chủ dự án
   *  chốt). KHÔNG bịa một cái tên: một nơi nhập sai còn tệ hơn một ô trống,
   *  vì ô trống thì người đọc biết là mình chưa biết. */
  function oNoiNhap(d) {
    if (d.noi_nhap) return el("td", null, d.noi_nhap);
    /* Phụ phí cố định không có khái niệm "nơi nhập" (không phải một NCC
       giữ giá cho một mã hàng) — ô để trống, KHÔNG bôi đỏ như một dòng
       chưa tra được giá. */
    const khongCanNoiNhap = d.la_chiet_khau || d.la_phu_phi_co_dinh;
    const td = el("td", khongCanNoiNhap ? null : "oChuaRo", "—");
    if (!khongCanNoiNhap && d.ly_do_chua_gia)
      td.title = "Chưa tra được nơi nhập: " + (LY_DO_GIA[d.ly_do_chua_gia]
        || d.ly_do_chua_gia);
    return td;
  }

  /** Ô "SL". Bình thường chỉ là một con số; với chứng từ bán trả lại thì con
   *  số ấy (0 hoặc −1) là KẾT QUẢ của một luật nghiệp vụ, nên `title` phải
   *  nói luật ấy ra — 0 và −1 trông giống nhau tới mức không ai đoán được vì
   *  sao dòng này 0 còn dòng kia −1.
   *
   *  Cờ và số do Engine đặt (`engine/src/btl.mjs`); ô này chỉ đọc và vẽ. */
  function oSoLuong(d) {
    const td = el("td", "oSo", soNguyen(d.so_luong));
    if (!d.btl_trang_thai) return td;
    if (d.btl_chua_ro_tien) {
      /* Chưa trừ được đồng nào, và đó là việc CÒN PHẢI LÀM của người đọc —
         nên đỏ như mọi ô "chưa rõ thông tin" khác. */
      td.classList.add("oChuaRo");
      td.title = "Bán trả lại nhưng sổ không ghi số tiền (cả Doanh số bán lẫn Đơn giá "
        + "đều 0) — chưa trừ được đồng nào.";
    } else if (d.btl_thong_bao) {
      td.title = d.la_btl
        ? "Bán trả lại đơn " + (d.btl_doi_ct || "") + " của chính kỳ này. Doanh số của "
          + "đơn ấy cũng đang trong bảng nên hai dòng triệt tiêu nhau — đây chỉ là "
          + "dòng thông báo."
        : "Đã bị trả lại ở chứng từ " + (d.btl_doi_ct || "") + " trong chính kỳ này, "
          + "nên dòng này về 0 thay vì bị trừ hai lần.";
    } else {
      td.title = "Bán trả lại: không tìm thấy đơn gốc trong kỳ này — nhiều khả năng đơn "
        + "ở tháng khác và doanh số đã tính ở tháng ấy, nên lượt trừ nằm ở đây.";
    }
    return td;
  }

  /** Ô "Giá nhập". Chưa có giá thì hiện "—" và NÓI VÌ SAO ở `title` — ô trống
   *  không giải thích để người đọc tự đoán, mà mọi phỏng đoán trên một cột
   *  tiền đều tốn kém. Không bao giờ hiện 0: "giá vốn 0 đồng" và "chưa biết
   *  giá vốn" là hai câu khác hẳn nhau. */
  function oGiaNhap(d) {
    if (d.gia_nhap !== null && d.gia_nhap !== undefined) {
      const td = el("td", "oSo", nghin(d.gia_nhap));
      /* Giá trị THÔ (đồng) đi kèm ô. Lượt sửa seed ô nhập từ đây, KHÔNG từ
         chữ đang hiện: chữ ấy đã qua `nghin()` — một phép làm tròn để ĐỌC.
         Seed từ nó là để một phép làm tròn hiển thị chảy ngược vào đường
         ghi, và khi ấy chỉ cần mở ô sửa rồi bấm lưu là tiền đã khác. */
      td.dataset.dong = String(d.gia_nhap);
      /* Giá được MANG QUA từ một mốc trước là chuyện bình thường của hệ Min
         (chỉ ghi khi đổi), nhưng người đối chiếu tay cần biết con số này quan
         sát được ngày nào. */
      if (d.ngay_gia) td.title = "Giá Min của Tracking, mốc quan sát " + nhanNgayDay(d.ngay_gia)
        + (d.trang_thai_ngay_gia === "PROVISIONAL" ? " — ngày chưa chốt, giá còn có thể đổi" : "");
      return td;
    }
    const td = el("td", "oSo oChuaGia", "—");
    if (d.ly_do_chua_gia) td.title = "Chưa có giá vốn: " + (LY_DO_GIA[d.ly_do_chua_gia]
      || d.ly_do_chua_gia);
    return td;
  }

  /* Lý do kỹ thuật của hợp đồng `daily-min-v1` → câu người đọc hiểu. Giữ
     nguyên mã lạ thay vì nuốt: Tracking thêm một lý do mới thì nó phải hiện
     ra để còn biết mà bổ sung, chứ không biến thành một ô trống im lặng. */
  const LY_DO_GIA = {
    "chua-co-ma": "dòng này chưa được gán mã bảng giá.",
    SOURCE_UNAVAILABLE: "Tracking không quan sát được bảng giá ngày hôm đó.",
    NO_DATA: "chưa có mốc giá nào của mã này tính tới ngày bán.",
    INVALID_PRODUCT_CODE: "mã hàng không hợp lệ với hệ giá của Tracking.",
  };

  const LY_DO_MA = {
    "chua-khop": "Chưa có mã: không tìm thấy mã bảng giá nào trong tên hàng — bấm để phân loại.",
    "nhieu-ma": "Chưa có mã: tên hàng có nhiều hơn một mã bảng giá, máy không tự chọn — bấm để phân loại.",
    "ma-da-xoa": "Mã đã gán trước đây không còn trên bảng giá — bấm để chọn lại.",
  };

  /** Vá TẠI CHỖ mọi dòng mang cùng một câu tên hàng, sau khi Tracking đã
   *  nhận quyết định.
   *
   *  Đây là chỗ giữ lời hứa "không tải lại, không nhảy dòng": không gọi lại
   *  `taiKy()`, không dựng lại `<tbody>`, chỉ sửa `textContent` và class của
   *  đúng những ô liên quan. Vị trí cuộn, thứ tự dòng, bề rộng cột — không
   *  cái nào đụng tới. */
  function vaDongTheoKhoa(khoa, ma, muc) {
    const cacO = document.querySelectorAll('#veDonHang td[data-khoa="' + CSS.escape(khoa) + '"]');
    for (const td of cacO) {
      td.classList.remove("maChuaCo", "maBoQua");
      if (ma) {
        td.dataset.ma = ma;
        td.title = "Mã bảng giá: " + ma + " (đã gán tay — bấm để đổi)";
      } else {
        delete td.dataset.ma;
        td.classList.add("maBoQua");
        td.title = "Đã đánh dấu không phải sản phẩm cần gán mã — bấm để đổi.";
      }
      const tr = td.parentElement;
      if (!tr) continue;
      const tdHang = tr.querySelector('td[data-o="hang"]');
      const tdNganh = tr.querySelector('td[data-o="nganh"]');
      /* "Bỏ qua" không phải một mặt hàng, nên hai cột nhãn về lại "—". */
      if (tdHang) tdHang.textContent = (muc && muc.hang) || "—";
      if (tdNganh) tdNganh.textContent = (muc && muc.nhom) || "—";
    }
    demLaiConNo();
  }

  /** Đếm lại băng "còn N dòng chưa có mã" từ chính DOM đang hiện.
   *
   *  Đếm trên DOM chứ không trừ dần một biến: sau vài lượt gán, một biến đếm
   *  lệch đi là không cách nào biết, còn DOM thì luôn là thứ người dùng đang
   *  thật sự nhìn. */
  function demLaiConNo(hien) {
    const bn = $("bangConNo");
    if (!bn) return;
    if (hien === false) { bn.hidden = true; return; }

    const khung = $("veDonHang");
    const oNo = khung ? khung.querySelectorAll("td.maChuaCo") : [];
    const ten = new Set();
    for (const td of oNo) ten.add(td.dataset.khoa);

    bn.hidden = false;
    if (!oNo.length) {
      bn.textContent = "Mọi dòng trong bảng đều đã có mã bảng giá.";
      bn.className = "bangConNo xong";
      return;
    }
    bn.textContent = "Còn " + soNguyen(oNo.length) + " dòng chưa có mã bảng giá, thuộc "
      + soNguyen(ten.size) + " tên hàng. Bấm vào ô Mã sản phẩm của dòng đó để phân loại.";
    bn.className = "bangConNo";
  }

  /* ---- Chế độ SỬA một dòng ----
   *
   * Chủ dự án chốt 12/09/2026: hai ô Giá nhập và Nơi nhập KHOÁ cho tới khi
   * bấm nút Sửa dòng. Khoá mặc định là thứ giữ cho một cú bấm nhầm giữa hàng
   * nghìn ô không thành một lượt sửa tiền — và làm rõ rằng sửa tay là một
   * hành động có chủ ý, không phải một lượt gõ lướt qua.
   *
   * Sửa TẠI CHỖ, cùng kỷ luật với màn gán mã: không vẽ lại bảng, không tải
   * lại trang, nên vị trí cuộn và bố cục không đổi. Bề rộng cột đã chốt cố
   * định nên một ô đổi thành ô nhập cũng không đẩy được cột nào.
   */
  let dangSua = null;          // { tr, khoa, huy }

  function thoatSua() { if (dangSua) dangSua.huy(); }

  function moSua(tr) {
    if (dangSua && dangSua.tr === tr) return;
    thoatSua();

    const khoa = tr.dataset.khoaDong;
    if (!khoa) return;
    const tdGia = tr.querySelector('td[data-o="gia"]');
    const tdNoi = tr.querySelector('td[data-o="noi"]');
    if (!tdGia || !tdNoi) return;

    const cuGia = tdGia.textContent, lopGia = tdGia.className;
    const cuNoi = tdNoi.textContent, lopNoi = tdNoi.className;
    const cuTitleGia = tdGia.title, cuTitleNoi = tdNoi.title;

    /* Ô nhập nhận số theo NGHÌN đồng — đúng đơn vị cả bảng đang hiện, để
       người gõ không phải đổi đơn vị trong đầu giữa lúc đọc và lúc sửa.
       Engine nhận đồng, nên phép nhân 1.000 nằm đúng một chỗ: lúc gửi. */
    const oGia = el("input", "oSuaGia");
    oGia.type = "text";
    oGia.inputMode = "decimal";
    /* Seed từ giá trị THÔ, không từ chữ đang hiện — xem `oGiaNhap()`. */
    oGia.value = tdGia.dataset.dong === undefined ? "" : String(Number(tdGia.dataset.dong) / 1000);
    oGia.title = "Giá nhập, theo nghìn đồng";

    const oNoi = el("input", "oSuaNoi");
    oNoi.type = "text";
    oNoi.value = cuNoi === "—" ? "" : cuNoi;
    oNoi.title = "Nơi nhập";

    tdGia.textContent = ""; tdGia.className = "oSo"; tdGia.title = "";
    tdNoi.textContent = ""; tdNoi.className = ""; tdNoi.title = "";
    tdGia.appendChild(oGia);
    tdNoi.appendChild(oNoi);
    tr.classList.add("hangDangSua");

    /* Một phiên sửa có đúng BA cách kết thúc — lưu, huỷ, hoặc lưu rồi huỷ —
       và cả ba đều phải chỉ chạy MỘT LẦN. `phien.xong` chặn trùng: Enter gọi
       `luu()` rồi bản thân `luu()` gọi `traLai()` xoá input khỏi DOM, việc
       xoá ấy tự sinh một sự kiện `focusout` mà không có `phien.xong` sẽ gọi
       `luu()` lần hai; Escape cũng xoá input và sinh `focusout` y hệt, mà
       lần đó phải KHÔNG lưu — đó là lúc `phien.xong` được set TRƯỚC khi xoá. */
    const phien = { xong: false };

    const traLai = () => {
      phien.xong = true;
      tdGia.textContent = cuGia; tdGia.className = lopGia; tdGia.title = cuTitleGia;
      tdNoi.textContent = cuNoi; tdNoi.className = lopNoi; tdNoi.title = cuTitleNoi;
      tr.classList.remove("hangDangSua");
      dangSua = null;
    };
    dangSua = { tr, khoa, huy: traLai };

    oGia.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); luu(); }
      else if (e.key === "Escape") { e.preventDefault(); traLai(); }
    });
    oNoi.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); luu(); }
      else if (e.key === "Escape") { e.preventDefault(); traLai(); }
    });
    /* Rời khỏi CẢ HAI ô thì tự lưu, không bắt bấm Enter (chủ dự án chốt
       12/09/2026: "con trỏ chuột bấm đi chỗ khác ô tự lưu luôn"). Gắn ở
       DÒNG chứ không ở từng ô: chuyển tiêu điểm giữa ô Giá nhập và ô Nơi
       nhập của CÙNG một dòng không phải "rời dòng", nên phải xét
       `relatedTarget` có còn nằm trong `tr` không, không phải xét từng ô
       rời rạc. */
    tr.addEventListener("focusout", (e) => {
      if (phien.xong) return;
      const diNoiKhac = !e.relatedTarget || !tr.contains(e.relatedTarget);
      if (diNoiKhac) luu();
    });
    oGia.focus();
    oGia.select();

    async function luu() {
      if (phien.xong) return;
      const chuGia = oGia.value.trim();
      /* Ô để trống = RÚT LẠI quyết định, không phải "giá 0". Hai thứ khác
         hẳn nhau, và trên một cột tiền thì nhầm chúng là nhầm tiền. */
      let giaGui;
      if (chuGia === "") giaGui = null;
      else {
        const n = Number(chuGia.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n) || n < 0) { oGia.focus(); oGia.select(); return; }
        giaGui = Math.round(n * 1000);
      }
      const noiGui = oNoi.value.trim() === "" ? null : oNoi.value.trim();
      phien.xong = true;

      tr.classList.add("hangDangGui");
      try {
        await goiGhi("/api/sua-dong", { ky: trangThai.ky, khoa,
          gia_nhap: giaGui, noi_nhap: noiGui });
      } catch (e) {
        tr.classList.remove("hangDangGui");
        phien.xong = false;
        $("loiDonHang").textContent = "Không lưu được: " + e.message;
        return;
      }
      tr.classList.remove("hangDangGui");
      traLai();
      /* Sửa giá nhập thì lợi nhuận của dòng và của đơn đều đổi theo, và
         những con số ấy do ENGINE tính (LUẬT SỐ 1) — nên lượt này tải lại
         đúng bảng đang xem thay vì tự nhân trừ ở trình duyệt. `imLang`:
         không chớp "Đang tải…", không cuộn về gốc — người vừa bấm ra khỏi
         một ô sửa, không phải vừa đổi tháng. */
      taiKy({ imLang: true });
    }

    return { luu, huy: traLai };
  }

  async function xoaDongHang(tr) {
    const khoa = tr.dataset.khoaDong;
    if (!khoa) return;
    const ten = (tr.querySelector('td[data-o="ma"]') || {}).textContent || "dòng này";
    if (!window.confirm("Xoá " + ten + " khỏi báo cáo?\n\n"
      + "Dòng sẽ biến khỏi bảng, và doanh số của nó bị trừ khỏi cả biểu đồ. "
      + "Sổ gốc không đổi — bấm lại nút này trên dòng đó sau khi nhập lại sổ "
      + "là khôi phục được.")) return;
    tr.classList.add("hangDangGui");
    try {
      await goiGhi("/api/sua-dong", { ky: trangThai.ky, khoa, xoa: true });
    } catch (e) {
      tr.classList.remove("hangDangGui");
      $("loiDonHang").textContent = "Không xoá được: " + e.message;
      return;
    }
    /* Xoá đổi tổng của đơn, của ngày và của cả kỳ — bốn con số do Engine
       tính. Tải lại đúng bảng đang xem thay vì tự trừ ở trình duyệt.
       `imLang`: giữ nguyên cuộn, không chớp "Đang tải…" — cùng lý do ở
       `moSua()`. */
    taiKy({ imLang: true });
  }

  /** Gửi một lượt GHI. Tách khỏi `goi()` vì nó cần POST kèm thân. */
  async function goiGhi(duong, than) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    const r = await fetch(duong, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(than),
    });
    const kq = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((kq.loi || ("HTTP " + r.status))
      + (kq.rid ? " (mã: " + kq.rid + ")" : ""));
    return kq;
  }

  function veBang(kq) {
    const khung = $("veDonHang");
    khung.innerHTML = "";

    const b = kq.bang;
    if (!b.ngay.length) {
      demLaiConNo(false);
      khung.appendChild(el("p", "dangTai", "Line này chưa có đơn nào trong tháng đã chọn."));
      return;
    }

    const tt = el("p", "tomTatDon");
    tt.appendChild(el("b", null, nghinTron(b.tom_tat.doanh_so) + " nghìn đ"));
    tt.appendChild(document.createTextNode(" · " + soNguyen(b.tom_tat.so_don) + " đơn · "
      + soNguyen(b.tom_tat.so_dong) + " dòng"));
    khung.appendChild(tt);

    /* Nguồn bảng giá hỏng — nói THẲNG, và nói trước khi người dùng kịp đọc
       ba cột trống bên dưới thành "hàng này không có mã". Một sự cố mạng
       không được phép nói một kết luận nghiệp vụ thay người (CLAUDE.md). */
    if (kq.loi_nguon_ma) {
      khung.appendChild(el("p", "bangNguonHong",
        "Chưa đọc được bảng giá Tracking lượt này, nên ba cột Mã · Hãng · "
        + "Ngành hàng CHƯA BIẾT — khác với \"không có\". Doanh số và số đơn "
        + "bên dưới không bị ảnh hưởng. Thử tải lại trang sau ít phút."));
    }

    /* Kỳ trước mốc dữ liệu giá của Tracking: KHÔNG cảnh báo gì cả (chủ dự án
       chốt 12/09/2026 — ở đó gán mã xong cũng không ra được đồng giá vốn nào,
       nên một băng "còn N dòng chưa có mã" chỉ mời làm một việc không dùng
       được). Nhưng vẫn nói MỘT CÂU vì sao mấy cột kia trống: ô trống không
       giải thích và "không có" là hai chuyện khác nhau. Câu này màu xám,
       không phải cảnh báo. */
    if (kq.trong_pham_vi_ma === false) {
      khung.appendChild(el("p", "ghiChuPhamVi",
        "Kỳ này nằm ngoài phạm vi dữ liệu giá của Tracking (chỉ có từ tháng "
        + "09/2026), nên các cột Mã · Giá nhập · Lợi nhuận · Hãng · Ngành hàng "
        + "để trống. Doanh số và số đơn không bị ảnh hưởng."));
    }

    const boc = el("div", "bocBang");
    const bang = el("table", "bangDon");

    /* `<colgroup>` chứ không đặt bề rộng lên từng <th>: với
       `table-layout: fixed` trình duyệt lấy bề rộng của HÀNG ĐẦU TIÊN, mà
       hàng đầu của tbody là hàng tiêu đề ngày (một <td> colSpan=19). Khai ở
       colgroup thì không phụ thuộc hàng nào cả. */
    const cg = el("colgroup");
    for (const w of RONG_COT) {
      const c = el("col");
      c.style.width = w + "px";
      cg.appendChild(c);
    }
    bang.appendChild(cg);

    /* Bề rộng TOÀN BẢNG phải khai tường minh, bằng đúng tổng RONG_COT.
       Thiếu dòng này thì `table-layout: fixed` vẫn co cả bảng cho vừa khung
       bọc rồi chia lại bề rộng theo TỈ LỆ — và tỉ lệ thì phụ thuộc nội dung,
       nên cột vẫn nhích khi P4 điền chữ vào một ô đang trống. Đo thật trên
       Chromium: cột "Hãng" nhảy 47px → 49px sau một lượt gán, đúng cái
       "biến dạng cột" đang muốn hết. Khung `.bocBang` có `overflow-x: auto`
       nên bảng rộng hơn màn hình thì cuộn, không ép ai cả. */
    bang.style.width = RONG_COT.reduce((a, b) => a + b, 0) + "px";

    const thead = el("thead");
    const trTen = el("tr");
    for (const c of COT) trTen.appendChild(el("th", null, c));
    thead.appendChild(trTen);
    bang.appendChild(thead);

    const tbody = el("tbody");
    for (const ng of b.ngay) {
      /* Một hàng tiêu đề cho mỗi ngày — đúng cách file tay chia. Kèm luôn
         tổng của ngày để đọc dọc không phải tự cộng. */
      const trNgay = el("tr", "hangNgay");
      const tdNgay = el("td", null, nhanNgayDay(ng.ngay) + "  ·  " + soNguyen(ng.so_don)
        + " đơn  ·  " + nghinTron(ng.doanh_so) + " nghìn đ");
      tdNgay.colSpan = COT.length;
      trNgay.appendChild(tdNgay);
      tbody.appendChild(trNgay);

      for (const don of ng.don) {
        let dauDon = true;
        for (const d of don.dong) {
          /* Dòng 0 đồng (quà tặng kèm) bôi đỏ — chủ dự án chốt 12/09/2026. Cờ
             do Engine đặt, không suy từ `tong_ban === 0` ở đây: luật "0 đồng
             là gì" có ngoại lệ (chứng từ BTL) và ngoại lệ ấy là NGHIỆP VỤ,
             nên nó ở Engine (LUẬT SỐ 1). */
          const lop = [d.la_chiet_khau ? "hangChietKhau" : null,
            dauDon ? "hangDauDon" : null,
            d.la_dong_0d ? "hang0d" : null,
            /* Dòng dính tới một lượt bán trả lại — CẢ dòng gốc lẫn dòng BTL.
               Nền riêng chứ không dùng lại nền đỏ của dòng 0 đồng: hai thứ
               đều "0 đồng" nhưng là hai nghiệp vụ khác hẳn nhau. */
            d.btl_trang_thai ? "hangBTL" : null].filter(Boolean).join(" ");
          const tr = el("tr", lop || null);
          /* Ngày và số BH chỉ ghi ở DÒNG ĐẦU của đơn — cùng cách file tay
             gộp ô, để mắt nhận ra ranh giới giữa hai đơn. */
          tr.appendChild(o(dauDon ? nhanNgayDay(ng.ngay) : "", "oNgay"));
          tr.appendChild(o(dauDon ? don.so_ct : "", "oCt"));
          const tdNoi = oNoiNhap(d);
          tdNoi.dataset.o = "noi";
          tr.appendChild(tdNoi);
          tr.appendChild(oMaSanPham(d, kq.trong_pham_vi_ma));
          tr.appendChild(oSoLuong(d));
          const tdGia = oGiaNhap(d);
          tdGia.dataset.o = "gia";
          tr.appendChild(tdGia);
          tr.appendChild(o(nghin(d.gia_ban), "oSo"));
          tr.appendChild(o(nghin(d.tong_ban), "oSo"));
          tr.appendChild(o(d.loi_nhuan === null ? null : nghin(d.loi_nhuan), "oSo"));
          /* Quy đổi là một công thức nghiệp vụ — Engine tính, màn hình chỉ
             đọc field. Chưa có nguồn thì để "—", không bao giờ tự nhân ở đây. */
          tr.appendChild(o(d.doanh_so_quy_doi === null || d.doanh_so_quy_doi === undefined
            ? null : nghin(d.doanh_so_quy_doi), "oSo"));
          tr.appendChild(o(d.ghi_chu));
          tr.appendChild(oHep(dauDon ? don.ten_khach : "", "oKhach"));
          tr.appendChild(oHep(dauDon ? don.dien_thoai : "", "oDienThoai"));
          tr.appendChild(oHep(dauDon ? don.dia_chi : "", "oDiaChi"));
          const tdHang = o(d.hang); tdHang.dataset.o = "hang";
          const tdNganh = o(d.nganh_hang); tdNganh.dataset.o = "nganh";
          tr.appendChild(tdHang);
          tr.appendChild(tdNganh);
          tr.appendChild(oHep(d.imei, "oImei"));
          /* Hai nút mở từ P5. Dòng chiết khấu KHÔNG sửa được: nó do Engine
             gộp ra, không phải một dòng của sổ, nên không có khoá bền để
             gắn quyết định vào. */
          const suaDuoc = !d.la_chiet_khau && !!d.khoa && kq.trong_pham_vi_ma !== false;
          tr.appendChild(nutDong("✏️", "Sửa dòng", suaDuoc, "sua"));
          tr.appendChild(nutDong("🗑", "Xoá dòng", suaDuoc, "xoa"));
          if (d.khoa) tr.dataset.khoaDong = d.khoa;
          if (d.da_sua_tay) tr.classList.add("hangSuaTay");
          tbody.appendChild(tr);
          dauDon = false;
        }
        const trTong = el("tr", "hangTongDon");
        const tdTrong = el("td");
        tdTrong.colSpan = 7;
        trTong.appendChild(tdTrong);
        trTong.appendChild(el("td", "oSo", nghinTron(don.tong_ban)));
        const tdSau = el("td");
        tdSau.colSpan = COT.length - 8;
        trTong.appendChild(tdSau);
        tbody.appendChild(trTong);
      }
    }
    /* MỘT listener cho cả bảng, không gắn từng dòng: bảng một tháng có hàng
       nghìn ô, và gắn từng ô là hàng nghìn listener phải dọn mỗi lượt vẽ
       lại. Uỷ quyền cũng là thứ sống sót qua phép vá tại chỗ — ô được sửa
       không cần gắn lại gì. */
    tbody.addEventListener("click", function (e) {
      const nut = e.target.closest("button[data-viec]");
      if (nut && tbody.contains(nut)) {
        const tr = nut.closest("tr");
        if (!tr) return;
        if (nut.dataset.viec === "sua") moSua(tr);
        else xoaDongHang(tr);
        return;
      }
      const td = e.target.closest('td[data-o="ma"]');
      if (!td || !tbody.contains(td)) return;
      const khoa = td.dataset.khoa;
      if (!khoa) return;
      window.GanMa.moChonMa(td.dataset.ten, td.dataset.ma || null,
        (ma, muc) => vaDongTheoKhoa(khoa, ma, muc));
    });

    bang.appendChild(tbody);
    boc.appendChild(bang);
    khung.appendChild(boc);
    dieuChinhCaoBang();

    demLaiConNo(kq.trong_pham_vi_ma !== false && !kq.loi_nguon_ma);

    /* Băng BÁN TRẢ LẠI. Chỉ hiện khi kỳ này thật sự có chứng từ BTL — một
       dòng "0 lượt trả hàng" ở mọi tháng là nhiễu. Đếm do Engine trả về;
       màn hình không tự cộng lại (LUẬT SỐ 1). */
    const tb = b.tom_tat_btl;
    if (tb && tb.tren_bang) {
      const phan = [soNguyen(tb.so_dong_btl) + " chứng từ bán trả lại"];
      if (tb.khop) phan.push(soNguyen(tb.khop) + " khớp được đơn gốc trong kỳ (cả hai dòng về 0)");
      if (tb.khong_khop) phan.push(soNguyen(tb.khong_khop)
        + " không tìm thấy đơn gốc — trừ thẳng vào kỳ này");
      if (tb.khong_ro_tien) phan.push(soNguyen(tb.khong_ro_tien)
        + " KHÔNG truy ra được số tiền, chưa trừ được đồng nào");
      const p = el("p", tb.khong_ro_tien ? "bangConNo" : "ghiChuPhamVi", phan.join(" · ") + ".");
      khung.appendChild(p);
    }

    /* Chú giải MÀU nằm ngay dưới bảng, không giấu trong tooltip: ba màu là ba
       việc khác nhau, và người đọc không nên phải rê chuột mới biết đỏ nghĩa
       là gì. */
    khung.appendChild(el("p", "viDu", "Tiền hiện theo nghìn đồng (6.450 = 6.450.000 đ). "
      + "Giá nhập và nơi nhập lấy từ Tracking theo ĐÚNG NGÀY BÁN của từng dòng. "
      + "Ô vàng: chưa có mã bảng giá — bấm vào để gán, quyết định ghi sang Tracking "
      + "và áp cho mọi dòng cùng tên hàng ở mọi kỳ. "
      + "Dòng đỏ: bán 0 đồng (quà tặng kèm) — vẫn có giá vốn nên vẫn trừ vào lợi nhuận. "
      + "Nơi nhập đỏ: chưa tra được giá Min của ngày đó. "
      + "Chiết khấu của cả đơn gộp thành một dòng mang dấu âm. "
      + "Dòng nền xanh: có giá nhập hoặc nơi nhập do bạn tự sửa — sửa tay luôn "
      + "thắng số máy tính, và sống qua mỗi lần nhập lại sổ. "
      + "Bấm ✏️ để mở hai ô Giá nhập và Nơi nhập (bình thường chúng khoá); "
      + "bấm ra chỗ khác hoặc Enter để lưu, Esc để huỷ. Bấm 🗑 để xoá dòng khỏi "
      + "báo cáo — doanh số của nó bị trừ khỏi cả biểu đồ, sổ gốc không đổi. "
      + "Dòng nền xám: liên quan tới một lượt bán trả lại — rê chuột vào ô SL để "
      + "biết đơn gốc nằm trong kỳ này (cả hai dòng về 0) hay ở tháng khác (trừ −1). "
      + "Ghi chú lấy từ cột Diễn giải của sổ — tải lại sổ thì cột này mới có chữ. "
      + "Chi phí vận chuyển / lắp đặt / Chênh VAT tự nhận ra từ tên hàng, không "
      + "cần gán mã — giá nhập tự điền bằng đúng giá bán. "
      + "Doanh số quy đổi chờ chốt công thức."));
  }

  /* ---- Tab con: Tổng hợp + từng line ---- */

  /** Line "rỗng" = không đơn nào VÀ không dòng nào. Cố ý KHÔNG lấy
   *  `doanh_so === 0`: Shopee tháng 09/2026 có 2 đơn mà doanh số 0 đ — giấu
   *  nó đi là giấu mất đúng thứ cần soi. */
  const lineRong = (l) => !l || ((l.so_don || 0) === 0 && (l.so_dong || 0) === 0);

  function veTabLine(tom_tat_line) {
    const hang = $("tabLine");
    hang.innerHTML = "";

    /* Tab đầu tiên là [Tổng hợp] — chủ dự án chốt 11/09/2026. */
    const nutTh = el("button", "tabNut" + (trangThai.line === null ? " tabDang" : ""), "Tổng hợp");
    nutTh.type = "button";
    nutTh.addEventListener("click", () => { trangThai.line = null; taiKy(); });
    hang.appendChild(nutTh);

    /* Thứ tự lấy theo `thu_tu` của bảng line trên Firebase, không theo thứ tự
       gõ tay ở đâu đó trong file này: bảng line là DỮ LIỆU, đổi thứ tự hiển
       thị chỉ cần sửa `thu_tu` chứ không cần đụng vào mã. */
    let daGiau = 0;
    for (const ten of tom_tat_line.thu_tu) {
      const l = tom_tat_line.line[ten] || { so_don: 0, so_dong: 0 };
      /* Line đang mở thì luôn hiện, kể cả khi rỗng — nếu không, bấm vào một
         line rồi nó tự biến mất khỏi hàng tab là chuyện khó hiểu. */
      if (lineRong(l) && !trangThai.hienLine0 && trangThai.line !== ten) { daGiau++; continue; }
      const nut = el("button", "tabNut" + (trangThai.line === ten ? " tabDang" : ""),
        ten + " (" + soNguyen(l.so_don) + ")");
      nut.type = "button";
      nut.addEventListener("click", () => { trangThai.line = ten; taiKy(); });
      hang.appendChild(nut);
    }

    const soRong = tom_tat_line.thu_tu.filter((t) => lineRong(tom_tat_line.line[t])).length;
    if (soRong) {
      const nutAn = el("button", "tabNut tabNho",
        trangThai.hienLine0
          ? "Ẩn " + soNguyen(soRong) + " line chưa có đơn"
          : "Hiện thêm " + soNguyen(daGiau || soRong) + " line chưa có đơn");
      nutAn.type = "button";
      nutAn.addEventListener("click", () => {
        trangThai.hienLine0 = !trangThai.hienLine0;
        veTabLine(tom_tat_line);
      });
      hang.appendChild(nutAn);
    }
  }

  /** Đủ 12 nút tháng, tháng chưa có dữ liệu thì `disabled`. Vẽ thiếu tháng
   *  làm người dùng không phân biệt được "chưa tải lên" với "không có đơn". */
  function veThang() {
    const hang = $("tabThang");
    hang.innerHTML = "";
    if (!trangThai.nam) return;
    const coDuLieu = new Set(trangThai.dsKy.nam[trangThai.nam] || []);
    for (let t = 1; t <= 12; t++) {
      const ky = trangThai.nam + "-" + String(t).padStart(2, "0");
      const co = coDuLieu.has(ky);
      const nut = el("button", "tabNut tabNho" + (trangThai.ky === ky ? " tabDang" : ""), "T" + t);
      nut.type = "button";
      nut.disabled = !co;
      if (!co) nut.title = "Tháng " + t + "/" + trangThai.nam + " chưa có dòng hàng nào được tải lên";
      nut.addEventListener("click", () => { trangThai.ky = ky; taiKy(); });
      hang.appendChild(nut);
    }
  }

  function veTabNam() {
    const hang = $("tabNam");
    hang.innerHTML = "";
    for (const nam of trangThai.dsKy.thu_tu_nam) {
      const nut = el("button", "tabNut" + (trangThai.nam === nam ? " tabDang" : ""), nam);
      nut.type = "button";
      nut.addEventListener("click", () => {
        trangThai.nam = nam;
        trangThai.ky = (trangThai.dsKy.nam[nam] || [])[0] || null;
        taiKy();
      });
      hang.appendChild(nut);
    }
  }

  /** `tuyChon.imLang`: lượt gọi lại SAU một cú sửa/xoá tại chỗ (không phải
   *  đổi tháng/line/đăng nhập). Con số mới BẮT BUỘC lấy từ Engine (LUẬT SỐ
   *  1 — lợi nhuận, tổng đơn, tổng ngày đều đổi theo), nhưng người vừa bấm
   *  ra khỏi một ô sửa không nên thấy cả bảng chớp "Đang tải…" và cuộn về
   *  gốc — đó đúng là thứ chủ dự án chốt 12/09/2026 phải hết ("mất thời
   *  gian và thêm lượt tải data"). Bỏ băng "Đang tải…" và giữ lại đúng vị
   *  trí cuộn của khung bảng qua lượt vẽ lại. */
  async function taiKy(tuyChon) {
    const imLang = !!(tuyChon && tuyChon.imLang);
    const loi = $("loiDonHang"), ve = $("veDonHang");
    loi.textContent = "";
    veTabNam();
    veThang();

    if (!trangThai.ky) {
      ve.innerHTML = "";
      $("tabLine").innerHTML = "";
      ve.appendChild(el("p", "dangTai", "Năm này chưa có tháng nào được tải lên."));
      return;
    }

    const bocCu = imLang ? ve.querySelector(".bocBang") : null;
    const cuonCu = bocCu ? bocCu.scrollTop : 0;
    if (!imLang) ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
    try {
      const duong = "/api/don-hang?ky=" + encodeURIComponent(trangThai.ky)
        + (trangThai.line === null ? "" : "&line=" + encodeURIComponent(trangThai.line));
      const kq = await goi(duong);
      veTabLine(kq.tom_tat_line);
      if (trangThai.line === null) {
        /* Tab [Tổng hợp]. Đích cuối là chép lại sheet "Summary" của file báo
           cáo tay: Tổng đơn, Tổng SP, Doanh thu quy đổi, Tỉ suất lợi nhuận,
           Target, Thưởng, Lương… Phần lớn cột ấy CHƯA có nguồn dữ liệu nào
           (giá vốn ở P5, target/lương chưa có nhánh nào lưu), nên lượt này
           chỉ dựng đúng chỗ đứng của tab và giữ bảng line sẵn có. Không bịa
           cột rỗng cho đủ hình. */
        ve.innerHTML = "";
        const b = el("table", "bangNho");
        const tr = el("tr");
        for (const c of ["Line", "Doanh số (nghìn đ)", "Số đơn", "Dòng hàng"]) tr.appendChild(el("th", null, c));
        b.appendChild(tr);
        for (const ten of kq.tom_tat_line.thu_tu) {
          const l = kq.tom_tat_line.line[ten];
          const r = el("tr");
          r.appendChild(el("td", null, ten));
          r.appendChild(el("td", "oSo", nghinTron(l.doanh_so)));
          r.appendChild(el("td", "oSo", soNguyen(l.so_don)));
          r.appendChild(el("td", "oSo", soNguyen(l.so_dong)));
          b.appendChild(r);
        }
        ve.appendChild(b);
        ve.appendChild(el("p", "viDu", "Tab Tổng hợp sẽ dựng theo sheet “Summary” của file báo cáo "
          + "tay (tổng đơn, doanh thu quy đổi, tỉ suất lợi nhuận, target, thưởng, lương). "
          + "Các cột đó cần giá vốn (P5) và một nhánh lưu target/lương chưa có — lượt này mới xếp "
          + "chỗ cho tab."));
      } else {
        veBang(kq);
        if (imLang) {
          const bocMoi = ve.querySelector(".bocBang");
          if (bocMoi) bocMoi.scrollTop = cuonCu;
        }
      }
    } catch (e) {
      ve.innerHTML = "";
      loi.textContent = "Không lấy được đơn hàng: " + e.message;
    }
  }

  async function moMan() {
    const loi = $("loiDonHang"), ve = $("veDonHang");
    loi.textContent = "";
    ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
    try {
      trangThai.dsKy = await goi("/api/ky-co-don");
      if (!trangThai.dsKy.thu_tu_nam.length) {
        ve.innerHTML = "";
        $("tabNam").innerHTML = "";
        $("tabThang").innerHTML = "";
        /* Đây là trạng thái ĐÚNG cho 20 kỳ legacy (01/2025–08/2026): chúng
           được nạp bằng script ở P2 nên chỉ có tổng theo ngày, không có
           dòng hàng nào. Chủ dự án chốt 11/09/2026 KHÔNG bơm ngược — dòng
           hàng kỳ cũ vẫn theo dõi ở file tay. Nói thẳng ra thay vì để một
           bảng rỗng không giải thích gì. */
        ve.appendChild(el("p", "dangTai",
          "Chưa có kỳ nào được tải lên qua trình duyệt. Danh sách đơn hàng chỉ có từ kỳ đầu tiên "
          + "bạn tải lên ở màn “Nhập sổ bán hàng”; các kỳ trước đó (01/2025–08/2026) được nạp bằng "
          + "script nên chỉ có số tổng cho biểu đồ, không có dòng hàng."));
        return;
      }
      const namCuoi = trangThai.dsKy.thu_tu_nam[trangThai.dsKy.thu_tu_nam.length - 1];
      trangThai.nam = namCuoi;
      const dsKy = trangThai.dsKy.nam[namCuoi] || [];
      trangThai.ky = dsKy[dsKy.length - 1] || null;
      trangThai.line = null;
      await taiKy();
    } catch (e) {
      ve.innerHTML = "";
      loi.textContent = "Không lấy được danh sách kỳ: " + e.message;
    }
  }

  /* ---- Hai tab CHÍNH: [Báo cáo doanh số] | [Biểu đồ] ---- */

  /* Nội dung `#o-dashboard` là của suc-khoe.js — file này chỉ bật/tắt khối
     bọc và BÁO cho nó biết tab vừa mở.

     Báo, chứ không tự vẽ: suc-khoe.js hoãn lượt gọi
     `/api/bao-cao/suc-khoe` tới lần đầu người dùng mở tab [Biểu đồ], nên
     phần lớn lần đăng nhập không còn kéo về số liệu cả hai năm mà không ai
     xem. Gọi qua `window.SucKhoe.moTab()` — nó tự lo chuyện chỉ tải một
     lần; gọi lại mỗi lần bấm tab là vô hại. */
  function doiManChinh(hienBieuDo) {
    $("manBaoCao").hidden = hienBieuDo;
    $("manBieuDo").hidden = !hienBieuDo;
    $("nutManBaoCao").classList.toggle("tabDang", !hienBieuDo);
    $("nutManBieuDo").classList.toggle("tabDang", hienBieuDo);
    if (hienBieuDo && window.SucKhoe) window.SucKhoe.moTab();
  }

  /* Màn này GIỜ LÀ TRANG CHỦ (chủ dự án chốt 11/09/2026: bỏ lưới thẻ, đăng
     nhập xong ra thẳng [Báo cáo doanh số]), nên không còn thẻ để bấm mở và
     không còn nút "Quay lại" để đóng. Nghe thẳng Firebase Auth thay vì chờ
     khối <script> inline gọi sang — khối đó là của phần đăng nhập, quy ước
     là để yên (ROADMAP.md). */
  let daMo = false;
  document.addEventListener("DOMContentLoaded", function () {
    $("nutManBaoCao").addEventListener("click", () => doiManChinh(false));
    $("nutManBieuDo").addEventListener("click", () => doiManChinh(true));
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { daMo = false; return; }
      if (daMo) return;          // token tự làm mới không được kéo thêm một lượt tải
      daMo = true;
      doiManChinh(false);        // mỗi lần đăng nhập luôn quay về tab báo cáo
      moMan();
    });
  });
})();
