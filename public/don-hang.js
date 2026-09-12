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
  /** Phần trăm, một chữ số thập phân — cho "đạt bao nhiêu % KPI". Engine đã
   *  làm tròn tới hai số; một số thập phân là đủ để đọc và đủ để thấy chuyển
   *  động giữa hai lượt xem. */
  const so1 = (v) => (Number(v) || 0).toLocaleString("vi-VN", {
    minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
   *  nhầm tiền. (Từ P5 mọi cột đều có nguồn; "—" ở cột Doanh số quy đổi nghĩa
   *  là dòng đó chưa có lợi nhuận để chia, không phải quy đổi bằng 0.) */
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

  /* 19 cột chủ dự án chốt 11/09/2026. Từ P5 không còn cột nào chờ nguồn:
     "Doanh số quy đổi" nay có số thật (lợi nhuận ÷ hệ số của line, Engine
     tính — LUẬT SỐ 1).

     VẪN ĐÚNG 19 CỘT sau P5, và đó là một quyết định: ô tick "gia dụng" của
     tab Nội thành nằm TRONG ô Mã sản phẩm chứ không thành cột thứ 20 (chủ dự
     án chốt 12/09/2026). Một cột chỉ có mặt ở một tab sẽ làm `RONG_COT` và
     `COT` phải đổi theo tab đang xem — tức bề rộng cố định hết cố định, đúng
     thứ đã phải sửa ở P4. */
  const COT = ["Ngày", "Số BH", "Nơi nhập", "Mã sản phẩm", "SL", "Giá nhập", "Giá bán",
    "Tổng bán", "Lợi nhuận", "Doanh số quy đổi",
    "Tên khách hàng", "Số điện thoại", "Địa chỉ", "Ghi chú",
    "Hãng", "Ngành hàng", "IMEI", "Sửa", "Xoá"];

  /* Bề rộng CHỐT CỐ ĐỊNH cho từng cột, đi cùng `table-layout: fixed` (chủ dự
     án chốt 12/09/2026). Trước đây bề rộng do nội dung quyết định, nên đúng
     lúc P4 điền chữ vào những ô đang là "—" thì cả bảng nống ra và dịch chỗ —
     mà gán mã là việc làm liên tục trên cùng một màn hình, mỗi lần gán một
     cái giật bố cục là không dùng được. Cố định rồi thì điền gì vào cũng
     không xê dịch một pixel.

     Phải đúng 19 số, đúng thứ tự `COT` — `kiem/bo-cuc-man-chu.js` canh cặp. */
  const RONG_COT = [78, 78, 92, 240, 44, 82, 82, 90, 86, 96,
    132, 94, 152, 92, 92, 112, 112, 34, 34];

  /* `kpiRiengKy`: dải setup đang gõ cho RIÊNG kỳ đang xem, hay đang gõ mặc
     định cho mọi kỳ. Chỉ là trạng thái của màn hình — KHÔNG lưu ở đâu cả, và
     không được lưu: nó nói "tôi đang định đổi cái nào", không nói dữ liệu là
     gì. Về mặc định mỗi lần nạp trang, vì đặt mặc định là lượt sửa thường
     gặp, còn ghi đè một tháng là việc cố ý làm. */
  const trangThai = { nam: null, line: null, ky: null, dsKy: null, hienLine0: false,
    kpiRiengKy: false, moGiaDung: null };

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
  /** Ô tick "gia dụng" của MỘT MẶT HÀNG, chèn vào đầu ô Mã sản phẩm.
   *
   *  Chỉ dựng khi line đang xem CÓ hệ số gia dụng — và điều đó do Engine nói
   *  (`hanh.he_so_gia_dung_pt`), KHÔNG phải màn hình tự biết "Nội thành là
   *  line đặc biệt". Chủ dự án đổi ý cho một line khác cũng có hệ số gia dụng
   *  thì ô tick tự hiện ra ở đó, không phải sửa một dòng nào ở đây. Đó đúng
   *  tinh thần bảng line là DỮ LIỆU, không phải code.
   *
   *  KHÔNG có tiêu đề cột — chủ dự án chốt 12/09/2026 ("không cần ghi tiêu đề
   *  cột quá rõ, chỉ cần ô tick là tôi tự hiểu, vì chỉ có 2 người xem công cụ
   *  này"). Đổi lại bảng vẫn đúng 19 cột: không sinh một cột chỉ có mặt ở một
   *  tab, nên `kiem/bo-cuc-man-chu.js` không phải nới ra. */
  function tickGiaDung(d) {
    const h = el("input", "tickGd");
    h.type = "checkbox";
    h.checked = !!d.la_gia_dung;
    h.dataset.o = "gd";
    h.dataset.khoa = d.khoa_ten;
    const duoc = window.VAI_BAO_CAO === "quantri";
    h.disabled = !duoc;
    h.title = duoc
      ? "Mặt hàng này là GIA DỤNG — ăn hệ số quy đổi gia dụng thay vì hệ số "
        + "thường. Quyết định áp cho MỌI kỳ, kể cả kỳ chưa nhập: tick một lần, "
        + "tháng sau không phải tick lại."
      : "Chỉ Quản trị đánh dấu được mặt hàng gia dụng.";
    return h;
  }

  function oMaSanPham(d, trongPhamVi, hanh) {
    const td = el("td", "oTen oMa");
    /* Ô tick đứng TRƯỚC tên hàng, và chỉ khi line này có hệ số gia dụng. Đặt
       trước vì nó là thứ mắt cần quét dọc theo cột; đặt sau tên hàng thì nó
       rơi vào một vị trí khác nhau trên từng dòng (tên hàng dài ngắn khác
       nhau) và không còn quét dọc được. */
    if (hanh && hanh.he_so_gia_dung_pt !== null && hanh.he_so_gia_dung_pt !== undefined
        && d.khoa_ten && !d.la_chiet_khau && !d.la_phu_phi_co_dinh
        && trongPhamVi !== false) {
      td.appendChild(tickGiaDung(d));
      if (d.la_gia_dung) td.classList.add("laGiaDung");
    }
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
    if (d.noi_nhap) {
      const td = el("td", null, d.noi_nhap);
      /* "Kho" đứng cạnh một con số Giá nhập KHÔNG phải giá kho trông y như
         một lỗi — nên nói thẳng ra thay vì để người đối chiếu tay tự đoán.
         Cả hai con số đều do Engine tính; ô này chỉ đọc và ghép chữ.

         Hai điều kiện, và thiếu cái nào cũng thành một câu SAI trên màn hình
         tiền: chữ "Kho" phải do MÁY chọn (`noi_nhap_tu_kho` — sửa tay nơi
         nhập là Engine tắt cờ), và câu "giá nhập vẫn lấy giá Min" chỉ đúng
         khi chính con số ấy cũng do máy điền. */
      if (d.noi_nhap_tu_kho && d.gia_ton_kho !== null && d.gia_ton_kho !== undefined
          && d.gia_ton_kho !== d.gia_nhap) {
        td.title = "Hàng có sẵn trong kho nên xuất từ kho (giá nhập phân bổ "
          + nghin(d.gia_ton_kho) + " nghìn)."
          + (d.nguon_gia === "sua-tay" ? "" : " Cột Giá nhập vẫn lấy giá Min "
            + "của ngày bán, không lấy giá kho.");
      }
      return td;
    }
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
    /* ĐÃ phân loại mà vẫn chưa có giá vốn thì bôi ĐỎ, không để mờ (chủ dự án
       chốt 12/09/2026). Hai cảnh khác hẳn nhau về việc phải làm:

         · chưa gán mã   — việc đã hiện ở ô Mã vàng bên cạnh, ô này mờ đi cho
                           khỏi kêu hai lần cùng một chuyện
         · đã có mã rồi  — gán thêm lần nữa KHÔNG chữa được gì; nguyên nhân
                           nằm bên Tracking (ngày đó không quan sát được, hết
                           hàng, chưa có mốc giá). Đây mới là ô đáng soi, và
                           trước bản này nó mờ y như ô kia nên người dùng cứ
                           đi gán lại mã cho một dòng đã có mã. */
    const chuaGanMa = d.ly_do_chua_gia === "chua-co-ma" || !d.ly_do_chua_gia;
    const td = el("td", "oSo " + (chuaGanMa ? "oChuaGia" : "oChuaRo"), "—");
    if (d.ly_do_chua_gia) td.title = "Chưa có giá vốn: " + (LY_DO_GIA[d.ly_do_chua_gia]
      || d.ly_do_chua_gia)
      + (chuaGanMa ? "" : " — gán lại mã KHÔNG chữa được, nguyên nhân ở bên Tracking.");
    return td;
  }

  /* Lý do kỹ thuật của hợp đồng `daily-min-v1` → câu người đọc hiểu. Giữ
     nguyên mã lạ thay vì nuốt: Tracking thêm một lý do mới thì nó phải hiện
     ra để còn biết mà bổ sung, chứ không biến thành một ô trống im lặng. */
  const LY_DO_GIA = {
    "chua-co-ma": "dòng này chưa được gán mã bảng giá.",
    SOURCE_UNAVAILABLE: "Tracking không quan sát được bảng giá ngày hôm đó.",
    NO_DATA: "chưa có mốc giá nào của mã này tính tới ngày bán.",
    /* `OUT_OF_STOCK` là trạng thái THẬT của hợp đồng `daily-min-v1`
       (`TRANG_THAI_GIA` bên Tracking có ba giá trị, không phải hai) và là
       cảnh thường gặp: hôm ấy không NCC nào còn bán và kho cũng không có.
       Thiếu nó ở đây thì màn hình hiện nguyên chữ `OUT_OF_STOCK`. */
    OUT_OF_STOCK: "hôm đó mã này hết hàng ở mọi nguồn nên không có giá vốn.",
    INVALID_PRODUCT_CODE: "mã hàng không hợp lệ với hệ giá của Tracking.",
  };

  /* Cùng bốn lý do, nhưng viết NGẮN để ghép sau "N dòng …" trên băng tổng.
     Hai bản chứ không một: bản trên là một câu đứng sau "Chưa có giá vốn:"
     nên có dấu chấm và chủ ngữ ("dòng này…"); nhét nguyên nó vào băng sẽ ra
     "12 dòng dòng này chưa được gán mã bảng giá.". */
  const LY_DO_GIA_NGAN = {
    "chua-co-ma": "chưa gán mã bảng giá",
    SOURCE_UNAVAILABLE: "Tracking không quan sát được bảng giá ngày bán",
    NO_DATA: "chưa có mốc giá nào tính tới ngày bán",
    OUT_OF_STOCK: "hết hàng ở mọi nguồn hôm bán",
    INVALID_PRODUCT_CODE: "mã không hợp lệ với hệ giá Tracking",
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

  /** Đánh dấu (hay rút lại) MỘT MẶT HÀNG là gia dụng.
   *
   *  Khoá là `khoa_ten` do Engine gắn vào dòng — màn hình KHÔNG tự dựng khoá,
   *  vì công thức khoá là một luật khớp mã (LUẬT SỐ 1).
   *
   *  Đây là quyết định về MỘT MẶT HÀNG nên nó áp cho MỌI dòng cùng tên hàng,
   *  ở MỌI kỳ — kể cả những dòng người dùng chưa kéo xuống xem. Vì vậy lượt
   *  tải lại sau đó KHÔNG phải để "cho chắc": nó là cách duy nhất người vừa
   *  tick thấy được đủ phần mình vừa đổi, thay vì chỉ thấy đúng ô mình bấm.
   */
  async function guiGiaDung(tick) {
    const khoa = tick.dataset.khoa;
    if (!khoa) return;
    const bat = tick.checked;
    const tr = tick.closest("tr");
    if (tr) tr.classList.add("hangDangGui");
    try {
      await goiGhi("/api/gia-dung", { khoa, gia_dung: bat });
    } catch (e) {
      /* Trả ô tick về trạng thái THẬT khi ghi không được — để nó hiện trạng
         thái mình vừa bấm là nói một quyết định chưa hề được lưu. */
      tick.checked = !bat;
      if (tr) tr.classList.remove("hangDangGui");
      $("loiDonHang").textContent = "Không lưu được dấu gia dụng: " + e.message;
      return;
    }
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

  /* ================= Dải setup KPI / hệ số quy đổi (P5) =================
   *
   * Chủ dự án chốt 12/09/2026: "tạo cho tôi 1 trình setup ở mỗi tab nhân
   * viên bao gồm: KPI và Hệ số quy đổi. Riêng Tab Nội thành thì có thêm hệ số
   * Quy đổi gia dụng."
   *
   * LUẬT SỐ 1: ba ô này chỉ HIỆN số Engine trả về và GỬI số người gõ. Không
   * một phép tính tiền nào ở đây — kể cả phép chia ra doanh số quy đổi, kể cả
   * phép nhân 1.000 đổi nghìn-đồng sang đồng (Gateway làm, tại biên).
   */

  /** Ba ô của dải, khai một chỗ để vẽ và đọc không lệch nhau.
   *  `đv` là đơn vị GÕ VÀO, không phải đơn vị lưu: KPI gõ bằng nghìn đồng
   *  (chủ dự án gõ "2.700.000" cho 2 tỷ 7), nhánh Firebase lưu bằng đồng. */
  const O_KPI = [
    { khoa: "kpi", nhan: "KPI", dv: "nghìn đ", buoc: "1",
      gt: "Mục tiêu doanh số QUY ĐỔI của line trong tháng, tính bằng nghìn đồng." },
    { khoa: "he_so_pt", nhan: "Hệ số quy đổi", dv: "%", buoc: "0.1",
      gt: "Tỉ suất lợi nhuận mục tiêu của line. Doanh số quy đổi của mỗi dòng "
        + "= lợi nhuận dòng ÷ hệ số này. Bán đúng tỉ suất mục tiêu thì quy đổi "
        + "ra bằng đúng doanh số thuần." },
    { khoa: "he_so_gia_dung_pt", nhan: "Hệ số gia dụng", dv: "%", buoc: "0.1",
      gt: "Hệ số riêng cho những mặt hàng đã tick là gia dụng trong ô Mã sản phẩm." },
  ];

  /** Số cho ô nhập. KPI lưu bằng ĐỒNG, ô gõ bằng NGHÌN — chia 1.000 để HIỆN.
   *  Đây là phép đổi ĐƠN VỊ để đọc, không phải một công thức nghiệp vụ: nó
   *  không quyết định con số nào cả, chỉ quyết định dấu phẩy đứng ở đâu. */
  const soVaoO = (khoa, gt) =>
    gt === null || gt === undefined ? "" : String(khoa === "kpi" ? gt / 1000 : gt);

  function veDaiKpi(khung, kq) {
    /* Tab [Tổng hợp] không có dải setup: ở đó không có MỘT line nào để đặt hệ
       số cho. Mỗi line đặt ở tab của chính nó. */
    if (trangThai.line === null) return;

    const tkpi = kq.bang.tom_tat_kpi || null;
    const hanh = tkpi ? tkpi.hanh : null;
    const dai = el("div", "daiKpi");

    /* Nguồn KPI hỏng hoặc chưa nạp: nói THẲNG, và nói ở ĐÂY chứ không chỉ
       dưới bảng — người đang nhìn một ô KPI trống cần biết ngay vì sao nó
       trống. Ba trạng thái tách bạch (CLAUDE.md): chưa nạp / sai / đọc không
       được, ba câu khác nhau. */
    if (kq.loi_nguon_kpi) {
      dai.appendChild(el("span", "datKpi thieu",
        "Chưa đọc được bảng KPI lượt này, nên cột Doanh số quy đổi CHƯA BIẾT — "
        + "khác với \"bằng 0\". Thử tải lại trang sau ít phút."));
      khung.appendChild(dai);
      return;
    }
    if (tkpi && tkpi.van_de && tkpi.van_de.length) {
      dai.appendChild(el("span", "datKpi thieu",
        "Bảng KPI trên Firebase đang có " + soNguyen(tkpi.van_de.length)
        + " chỗ không dùng được, nên cột Doanh số quy đổi để trống. Chỗ sai: "
        + tkpi.van_de.map((v) => (v.vi || "?") + " (" + v.ma + ")").join(" · ")));
      khung.appendChild(dai);
      return;
    }

    const duoc = window.VAI_BAO_CAO === "quantri";
    for (const o of O_KPI) {
      const gt = hanh ? hanh[o.khoa] : null;
      /* Ô hệ số gia dụng CHỈ hiện ở line có nó — và "có nó" là việc của dữ
         liệu, không phải của mã này: line nào khai `he_so_gia_dung_pt` thì ô
         hiện ra. Chủ dự án hiện chỉ khai cho Nội thành. Nhờ vậy đổi ý về một
         line khác không phải sửa một dòng nào ở đây.

         NHƯNG chưa khai thì phải khai ĐƯỢC, và đây là một lỗi đã phải sửa:
         bản đầu ẩn ô này khi giá trị còn trống, nên một line chưa có hệ số
         gia dụng thì KHÔNG CÓ ĐƯỜNG NÀO đặt nó từ màn hình — con gà và quả
         trứng. Nay `trangThai.moGiaDung` mở ô trống ra cho đúng line đang
         xem, qua nút "+ thêm hệ số gia dụng" bên dưới. Xoá trắng ô là bỏ hệ
         số ấy đi, nên không cần nút xoá riêng. */
      if (o.khoa === "he_so_gia_dung_pt" && (gt === null || gt === undefined)
          && trangThai.moGiaDung !== trangThai.line) continue;

      const nhan = el("label");
      nhan.appendChild(document.createTextNode(o.nhan));
      const oN = el("input", "oKpi");
      oN.type = "number";
      oN.step = o.buoc;
      oN.min = "0";
      oN.dataset.o = o.khoa;
      oN.value = soVaoO(o.khoa, gt);
      oN.disabled = !duoc;
      /* Viền xanh = con số này là RIÊNG của kỳ đang xem, không phải mặc định.
         Không có dấu này thì người sửa không biết mình vừa đổi cho MỘT tháng
         hay cho MỌI tháng — chỗ bộ "mặc định + ghi đè" dễ hiểu nhầm nhất. */
      if (hanh && hanh.tu && hanh.tu[o.khoa] === "ky") oN.classList.add("rieng");
      oN.title = o.gt + (duoc ? "" : "\n\nChỉ Quản trị đặt được.")
        + (hanh && hanh.tu && hanh.tu[o.khoa] === "ky"
          ? "\n\nĐang là con số RIÊNG của tháng này." : "");
      nhan.appendChild(oN);
      nhan.appendChild(el("span", "ghiChuKpi", o.dv));
      dai.appendChild(nhan);
    }

    /* Phần trăm đạt — con số Engine tính, màn hình chỉ đọc. Đây là "KPI tính
       theo doanh số quy đổi" (chủ dự án chốt điểm 3) hiện thành chữ. */
    const cua = tkpi && tkpi.line ? tkpi.line[trangThai.line] : null;
    if (cua && cua.dat_pt !== null && cua.dat_pt !== undefined) {
      const nhan = el("span", "datKpi",
        "Đạt " + so1(cua.dat_pt) + "%  ·  quy đổi " + nghinTron(cua.doanh_so_quy_doi)
        + " nghìn đ");
      nhan.title = "Doanh số quy đổi của line chia cho KPI của line, trong tháng "
        + "đang xem. Engine tính, màn hình chỉ hiện.";
      dai.appendChild(nhan);
      /* Còn đơn chưa quy đổi được thì NÓI RA: con số "đạt" ở trên đang thiếu
         phần ấy, và một phần trăm thiếu mà không dán nhãn thiếu là đúng thứ
         CLAUDE.md cấm. */
      if (cua.don_thieu_quy_doi) {
        dai.appendChild(el("span", "ghiChuKpi",
          "(còn " + soNguyen(cua.don_thieu_quy_doi)
          + " đơn chưa đủ giá vốn nên chưa vào con số này)"));
      }
    } else if (cua) {
      dai.appendChild(el("span", "datKpi thieu",
        hanh && hanh.kpi === null ? "Chưa đặt KPI cho line này"
          : "Chưa tính được phần trăm đạt"));
    }

    /* Nút mở ô hệ số gia dụng cho line CHƯA có nó. Chỉ hiện khi chưa có và
       chưa mở — line đã có hệ số thì ô đã nằm sẵn ở trên, không cần nút. */
    if (duoc && (!hanh || hanh.he_so_gia_dung_pt === null
                 || hanh.he_so_gia_dung_pt === undefined)
        && trangThai.moGiaDung !== trangThai.line) {
      const nutGd = el("button", "nutNhoKpi", "+ thêm hệ số gia dụng");
      nutGd.type = "button";
      nutGd.title = "Mở ô hệ số quy đổi riêng cho những mặt hàng được tick là "
        + "gia dụng ở line này. Hiện chỉ Nội thành dùng tới.";
      nutGd.addEventListener("click", () => {
        trangThai.moGiaDung = trangThai.line;
        taiKy({ imLang: true });
      });
      dai.appendChild(nutGd);
    }

    /* Nút chuyển giữa "đặt mặc định" và "đặt riêng tháng này". Mặc định là
       chế độ thường — chủ dự án chốt "mặc định chung + ghi đè từng kỳ", và
       phần lớn lượt sửa là đổi mục tiêu chung. */
    if (duoc) {
      const rieng = !!(hanh && hanh.co_rieng_ky);
      const nut = el("button", "nutNhoKpi",
        trangThai.kpiRiengKy ? "⟵ đang đặt cho RIÊNG tháng này" : "Đặt riêng tháng này");
      nut.type = "button";
      nut.title = trangThai.kpiRiengKy
        ? "Con số gõ vào sẽ chỉ áp cho tháng " + trangThai.ky
          + ". Bấm để quay về đặt mặc định cho MỌI tháng."
        : "Bấm rồi gõ: con số sẽ chỉ áp cho tháng " + trangThai.ky
          + ", các tháng khác giữ mặc định.";
      nut.addEventListener("click", () => {
        trangThai.kpiRiengKy = !trangThai.kpiRiengKy;
        taiKy({ imLang: true });
      });
      dai.appendChild(nut);

      if (rieng) {
        const xoa = el("button", "nutNhoKpi", "✕ bỏ riêng tháng này");
        xoa.type = "button";
        xoa.title = "Xoá bản ghi đè của tháng " + trangThai.ky
          + " — line này quay về dùng mặc định.";
        xoa.addEventListener("click", () => boRiengKy(dai));
        dai.appendChild(xoa);
      }
    }

    /* MỘT listener cho cả dải, uỷ quyền — cùng lý do bảng đơn làm vậy, và nó
       sống sót qua mỗi lượt vẽ lại mà không phải dọn gì.
       `change` chứ không `input`: gõ "15000" sẽ bắn `input` năm lần, tức năm
       lượt ghi Firebase cho một con số. `change` bắn khi người dùng rời ô —
       đúng nhịp "rời khỏi dòng thì tự lưu" mà P4 đã chốt cho ô sửa tay. */
    dai.addEventListener("change", (e) => {
      const o = e.target.closest("input[data-o]");
      if (o && dai.contains(o)) guiKpi(dai, o);
    });

    /* GHI NGAY, nhưng VẼ LẠI MUỘN — và đây là một lỗi đã phải sửa trước khi
       đẩy, không phải một tối ưu.
       Vẽ lại ngay trong `guiKpi()` thì: gõ KPI xong nhấn Tab sang ô Hệ số,
       `change` bắn, lượt ghi xong gọi `taiKy()` dựng lại cả dải — và ô Hệ số
       người dùng VỪA nhảy vào bị xoá khỏi DOM giữa lúc họ đang gõ, nên mấy
       ký tự sau rơi vào hư không. Dải này là MỘT đơn vị sửa (hai, ba ô đi
       liền nhau), khác hẳn một dòng sửa tay của P4 nơi lượt lưu cũng là lượt
       đóng ô.
       Nên: mỗi ô vẫn lưu ngay khi rời nó (không mất dữ liệu), còn bảng chỉ
       dựng lại khi tiêu điểm rời hẳn KHỎI DẢI. `setTimeout(0)` vì lúc
       `focusout` bắn thì `activeElement` còn là <body>, chưa phải ô kế tiếp —
       đọc sớm một nhịp thì lần nào cũng tưởng người dùng đã đi ra. */
    /* Enter trong một ô số: trình duyệt KHÔNG tự nhả tiêu điểm, nên `change`
       bắn mà `focusout` thì không — người dùng thấy số đã lưu mà bảng bên dưới
       vẫn là số cũ, và không hiểu vì sao. Nhả tiêu điểm bằng tay để chuỗi
       "ghi xong thì vẽ lại" chạy đúng nhịp đã thiết kế.
       Cũng chặn `submit` mặc định — dải này không nằm trong <form> nào hôm
       nay, nhưng một lượt bọc lại sau này sẽ làm Enter nạp lại cả trang. */
    dai.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const o = e.target.closest("input[data-o]");
      if (!o || !dai.contains(o)) return;
      e.preventDefault();
      o.blur();
    });

    dai.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!dai.isConnected || dai.contains(document.activeElement)) return;
        if (!dai.dataset.canVeLai) return;
        delete dai.dataset.canVeLai;
        taiKy({ imLang: true });
      }, 0);
    });

    khung.appendChild(dai);
  }

  /** Gửi một con số của dải setup.
   *
   *  Ô trống = RÚT LẠI con số (`null`), không phải "gõ số 0". Hai thứ khác
   *  nhau, và Gateway đọc theo kiểu đúng như vậy: `null` rút lại, vắng mặt là
   *  không nhắc tới. */
  async function guiKpi(dai, o) {
    const tho = o.value.trim();
    const than = { line: trangThai.line };
    /* Có `ky` = ghi đè riêng kỳ ấy; vắng `ky` = đặt mặc định cho MỌI kỳ. Đúng
       hai chế độ của nút trên dải, không có chế độ thứ ba. */
    if (trangThai.kpiRiengKy) than.ky = trangThai.ky;
    than[o.dataset.o] = tho === "" ? null : Number(tho);

    dai.classList.add("dangGui");
    try {
      await goiGhi("/api/dat-kpi", than);
    } catch (e) {
      dai.classList.remove("dangGui");
      $("loiDonHang").textContent = "Không lưu được KPI: " + e.message;
      return;
    }
    dai.classList.remove("dangGui");
    /* Đổi hệ số là đổi MỌI con số quy đổi của bảng đang xem, cộng tổng line và
       phần trăm đạt — bốn con số do Engine tính, nên phải tải lại chứ không
       tự nhân ở trình duyệt (LUẬT SỐ 1). Nhưng KHÔNG tải ngay tại đây: xem
       `focusout` ở `veDaiKpi()` cho lý do đầy đủ (vẽ lại giữa lúc người dùng
       vừa nhảy sang ô kế tiếp sẽ ăn mất mấy ký tự họ gõ). Đặt cờ, để lượt rời
       dải lo việc vẽ.
       Cờ nằm trên `dataset` của chính dải chứ không ở một biến ngoài: dải bị
       dựng lại mỗi lượt vẽ, nên cờ phải chết cùng nó — một biến ngoài sống
       sót sẽ làm lượt vẽ sau tự gọi thêm một lượt vẽ nữa. */
    dai.dataset.canVeLai = "1";
  }

  /** Xoá bản ghi đè của kỳ đang xem — line quay về dùng mặc định. */
  async function boRiengKy(dai) {
    dai.classList.add("dangGui");
    try {
      /* Gửi cả ba trường về `null` trong MỘT lượt: `vaDb` là PATCH nên ba
         `null` xoá đúng ba khoá và để lại một nhánh rỗng, tức "không có bản
         ghi đè". Gửi ba lượt riêng thì có một khoảng mà kỳ này đang mang một
         bộ số nửa mặc định nửa riêng, và bảng đọc được đúng khoảng đó. */
      await goiGhi("/api/dat-kpi", {
        line: trangThai.line, ky: trangThai.ky,
        kpi: null, he_so_pt: null, he_so_gia_dung_pt: null,
      });
    } catch (e) {
      dai.classList.remove("dangGui");
      $("loiDonHang").textContent = "Không bỏ được bản ghi đè: " + e.message;
      return;
    }
    trangThai.kpiRiengKy = false;
    taiKy({ imLang: true });
  }

  /** Nạp bộ số KPI mặc định — lượt khởi tạo đầu tiên.
   *
   *  Bộ số nằm ở ENGINE, không ở đây (LUẬT SỐ 1: mục tiêu kinh doanh của từng
   *  line là một quyết định nghiệp vụ). Màn hình chỉ bấm và đọc kết quả — nó
   *  không biết một con số nào trong bộ ấy, và `kiem/kpi-gateway.js` canh
   *  đúng việc đó.
   *
   *  Gateway từ chối nếu nhánh đã có bộ số: đây là nút KHỞI TẠO, không phải
   *  nút đặt lại. Nên bấm nhầm hai lần cũng không xoá mất gì. */
  async function napBoSoKpi(nut) {
    nut.disabled = true;
    const truoc = nut.textContent;
    nut.textContent = "Đang nạp…";
    let kq;
    try {
      kq = await goiGhi("/api/nap-kpi", {});
    } catch (e) {
      nut.disabled = false;
      nut.textContent = truoc;
      $("loiDonHang").textContent = "Không nạp được bộ số: " + e.message;
      return;
    }
    if (!kq.ghi) {
      /* Từ chối CÓ LÝ DO, không phải lỗi — nói đúng câu thay vì một câu lỗi
         chung làm người dùng đi tìm sai chỗ. */
      nut.disabled = false;
      nut.textContent = truoc;
      $("loiDonHang").textContent = kq.ly_do === "da-co-bo-so"
        ? "Nhánh KPI đã có bộ số rồi — sửa thẳng trên dải setup của từng tab "
          + "line, không nạp lại."
        : "Không nạp được bộ số: " + (kq.ly_do || "không rõ");
      return;
    }
    /* Nạp xong là mọi con số quy đổi của bảng đổi theo — Engine tính, nên
       tải lại chứ không tự vá ở trình duyệt (LUẬT SỐ 1). Lượt này KHÔNG
       `imLang`: nó là một thay đổi lớn và cố ý, thấy băng "Đang tải…" ở đây
       là đúng chứ không phải nhiễu. */
    taiKy();
  }

  /* ================= Tab [Tổng hợp] (P5) =================
   *
   * Đích cuối là sheet "Summary" của file báo cáo tay. P5 lấp được hai cột
   * cuối cùng còn thiếu nguồn: doanh thu QUY ĐỔI và KPI. Target/thưởng/ngày
   * công/lương vẫn CHƯA có nhánh nào lưu — không bịa cột rỗng cho đủ hình.
   *
   * Mọi con số ở đây do Engine tính (`tom_tat_kpi`); màn hình không cộng lại
   * một phép nào, kể cả hàng TỔNG (LUẬT SỐ 1).
   */
  function veTongHop(ve, kq) {
    ve.innerHTML = "";
    /* Băng "còn N dòng chưa có mã" đếm những ô `td.maChuaCo` trong bảng đơn —
       mà tab này KHÔNG có bảng đơn. Không ẩn nó thì nó đứng lại với con số của
       tab line vừa xem, tức một câu nói về một bảng không còn trên màn hình.
       (Lỗi có sẵn từ P4, sửa ở đây vì đây đúng là nhánh đang viết lại.) */
    demLaiConNo(false);
    const tkpi = kq.bang.tom_tat_kpi || null;
    const cua = (tkpi && tkpi.line) || {};

    /* Ba lý do cột quy đổi trống, ba câu khác nhau — không bao giờ để một ô
       trống tự nói thay. Thứ tự: nguồn hỏng trước (người dùng không làm gì
       được), rồi bảng sai, rồi ngoài phạm vi (chuyện bình thường). */
    if (kq.loi_nguon_kpi) {
      ve.appendChild(el("p", "bangNguonHong",
        "Chưa đọc được bảng KPI lượt này, nên hai cột Doanh số quy đổi và "
        + "Đạt KPI CHƯA BIẾT — khác với \"bằng 0\". Doanh số thuần và số đơn "
        + "bên dưới không bị ảnh hưởng."));
    } else if (tkpi && tkpi.thieu_bang) {
      /* Nút KHỞI TẠO ngay cạnh câu giải thích, không bắt ai đi tìm ở đâu khác.
         Trước đây chỗ này chỉ bảo "chạy `node bin/nap-kpi.mjs`" — một lời
         hướng dẫn vô dụng với người không clone repo trên máy, và nó còn đòi
         tải khoá admin Firebase về chỉ để đặt 10 con số. Gateway đã giữ khoá
         làm Secret, nên nút này là đủ. */
      const hop = el("div", "napKpi");
      hop.appendChild(el("p", null,
        "Chưa có bộ số KPI nào, nên cột Doanh số quy đổi và Đạt KPI còn trống. "
        + "Bấm nút dưới để nạp bộ số mặc định chủ dự án đã chốt "
        + "(Nội thành 15 tỷ/2%/8% · Tín Phát 2,7 tỷ/7,5% · tám line còn lại "
        + "1,3 tỷ/5,5%). Sau đó sửa thẳng trên dải setup của từng tab line."));
      if (window.VAI_BAO_CAO === "quantri") {
        const nut = el("button", "nutNapKpi", "Nạp bộ số mặc định");
        nut.type = "button";
        nut.title = "Chỉ chạy được khi nhánh KPI còn rỗng — nó là nút khởi tạo, "
          + "không phải nút đặt lại, nên không thể xoá mất con số nào anh đã sửa.";
        nut.addEventListener("click", () => napBoSoKpi(nut));
        hop.appendChild(nut);
      } else {
        hop.appendChild(el("p", "viDu", "Chỉ Quản trị nạp được bộ số này."));
      }
      ve.appendChild(hop);
    } else if (tkpi && tkpi.van_de && tkpi.van_de.length) {
      ve.appendChild(el("p", "bangNguonHong",
        "Bảng KPI trên Firebase có " + soNguyen(tkpi.van_de.length)
        + " chỗ không dùng được nên quy đổi để trống. Chỗ sai: "
        + tkpi.van_de.map((v) => (v.vi || "?") + " (" + v.ma + ")").join(" · ")));
    } else if (kq.trong_pham_vi_ma === false) {
      ve.appendChild(el("p", "ghiChuPhamVi",
        "Kỳ này nằm ngoài phạm vi dữ liệu giá của Tracking (chỉ có từ tháng "
        + "09/2026). Quy đổi cần lợi nhuận, lợi nhuận cần giá vốn — nên hai "
        + "cột Doanh số quy đổi và Đạt KPI để trống. Doanh số thuần và số đơn "
        + "không bị ảnh hưởng."));
    }

    const b = el("table", "bangNho");
    const tr = el("tr");
    for (const c of ["Line", "Doanh số (nghìn đ)", "Số đơn", "Dòng hàng",
                     "Hệ số", "Doanh số quy đổi (nghìn đ)", "KPI (nghìn đ)", "Đạt"]) {
      tr.appendChild(el("th", null, c));
    }
    b.appendChild(tr);

    /* Thứ tự theo `thu_tu` của bảng line — danh sách line CHÍNH THỨC. Suy từ
       những line có đơn thì một line chưa chạy tháng này biến khỏi bảng thay
       vì hiện ra với số 0 và mức KPI của nó. */
    for (const ten of kq.tom_tat_line.thu_tu) {
      const l = kq.tom_tat_line.line[ten];
      const k = cua[ten] || null;
      const r = el("tr");
      r.appendChild(el("td", null, ten));
      r.appendChild(el("td", "oSo", nghinTron(l.doanh_so)));
      r.appendChild(el("td", "oSo", soNguyen(l.so_don)));
      r.appendChild(el("td", "oSo", soNguyen(l.so_dong)));
      /* Hệ số lấy từ bản kê Engine trả. Line không có đơn nào trong kỳ thì
         không có mục trong `tom_tat_kpi.line` — ô để "—", đúng nghĩa "chưa có
         dòng nào để quy đổi", không phải "chưa đặt hệ số". */
      const oHs = el("td", "oSo", k && k.he_so_pt !== null && k.he_so_pt !== undefined
        ? so1(k.he_so_pt) + "%" : "—");
      if (k && k.he_so_gia_dung_pt !== null && k.he_so_gia_dung_pt !== undefined) {
        oHs.textContent += " / " + so1(k.he_so_gia_dung_pt) + "%";
        oHs.title = "Hệ số thường / hệ số gia dụng. Dòng nào được tick là gia "
          + "dụng trong ô Mã sản phẩm thì ăn hệ số thứ hai.";
      }
      r.appendChild(oHs);
      const oQd = el("td", "oSo", k ? nghinTron(k.doanh_so_quy_doi) : "—");
      if (k && k.don_thieu_quy_doi) {
        /* Con số đang THIẾU phần của mấy đơn chưa đủ giá vốn — phải dán nhãn
           thiếu, không được để nó đọc như một con số đủ. */
        oQd.textContent += " *";
        oQd.title = "Còn " + soNguyen(k.don_thieu_quy_doi)
          + " đơn chưa đủ giá vốn nên chưa vào con số này.";
      }
      r.appendChild(oQd);
      r.appendChild(el("td", "oSo", k && k.kpi !== null && k.kpi !== undefined
        ? nghinTron(k.kpi) : "—"));
      /* "Chưa đặt KPI" và "đạt 0%" là hai câu khác nhau. */
      r.appendChild(el("td", "oSo", k && k.dat_pt !== null && k.dat_pt !== undefined
        ? so1(k.dat_pt) + "%" : "—"));
      b.appendChild(r);
    }

    /* Hàng TỔNG do Engine cộng (`tom_tat_kpi.tong`), không phải màn hình cộng
       lại — ngay cả một phép cộng cũng là một phép tính, và hai chỗ cộng là
       hai chỗ có thể lệch nhau mà không ai biết bên nào đúng. */
    const t = tkpi ? tkpi.tong : null;
    if (t) {
      const r = el("tr", "hangTongDon");
      r.appendChild(el("th", null, "TỔNG"));
      r.appendChild(el("td", "oSo", nghinTron(t.doanh_so)));
      r.appendChild(el("td", "oSo", soNguyen(t.so_don)));
      r.appendChild(el("td", "oSo", ""));
      r.appendChild(el("td", "oSo", ""));
      r.appendChild(el("td", "oSo", nghinTron(t.doanh_so_quy_doi)));
      r.appendChild(el("td", "oSo", t.kpi !== null && t.kpi !== undefined
        ? nghinTron(t.kpi) : "—"));
      const oDat = el("td", "oSo", t.dat_pt !== null && t.dat_pt !== undefined
        ? so1(t.dat_pt) + "%" : "—");
      /* Tổng KPI chỉ cộng line CÓ MẶT trong kỳ — so tổng quy đổi của 3 line
         với KPI của cả 10 line là một tỉ lệ vô nghĩa. Nói ra ở `title` để
         người đối chiếu tay không phải tự đoán. */
      oDat.title = "Tổng KPI chỉ cộng những line có đơn trong tháng này, "
        + "không cộng cả 10 line.";
      r.appendChild(oDat);
      b.appendChild(r);
    }

    ve.appendChild(b);
    ve.appendChild(el("p", "viDu",
      "Hệ số quy đổi và KPI của từng line đặt ở dải setup trên tab của chính "
      + "line đó. Doanh số quy đổi = lợi nhuận từng dòng ÷ hệ số của line, "
      + "Engine tính. Bốn cột còn lại của sheet “Summary” (target thưởng, "
      + "ngày công, lương) chưa có nhánh dữ liệu nào lưu."));
  }

  function veBang(kq) {
    const khung = $("veDonHang");
    khung.innerHTML = "";

    const b = kq.bang;
    const tkpi = b.tom_tat_kpi || null;
    const hanhKpi = tkpi ? tkpi.hanh : null;

    /* Dải setup dựng TRƯỚC phép kiểm "có đơn nào không": một line chưa có đơn
       trong tháng vẫn phải đặt được KPI cho nó — nếu không thì line mới (hoặc
       tháng đầu của một line) là chỗ duy nhất không đặt được mục tiêu. */
    veDaiKpi(khung, kq);

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
            d.btl_trang_thai ? "hangBTL" : null,
            /* Dòng LỖ — chiết khấu kéo xuống âm, hay bán dưới giá vốn. Cờ do
               Engine đặt: ba loại dòng âm THEO THIẾT KẾ (chiết khấu, quà tặng
               0đ, bán trả lại) đã bị loại ra ở đó, và việc loại ấy là phán
               đoán nghiệp vụ chứ không phải một phép so `< 0` (LUẬT SỐ 1). */
            d.la_lo ? "hangLo" : null].filter(Boolean).join(" ");
          const tr = el("tr", lop || null);
          /* Ngày và số BH chỉ ghi ở DÒNG ĐẦU của đơn — cùng cách file tay
             gộp ô, để mắt nhận ra ranh giới giữa hai đơn. */
          tr.appendChild(o(dauDon ? nhanNgayDay(ng.ngay) : "", "oNgay"));
          tr.appendChild(o(dauDon ? don.so_ct : "", "oCt"));
          const tdNoi = oNoiNhap(d);
          tdNoi.dataset.o = "noi";
          tr.appendChild(tdNoi);
          tr.appendChild(oMaSanPham(d, kq.trong_pham_vi_ma, hanhKpi));
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
          tr.appendChild(oHep(dauDon ? don.ten_khach : "", "oKhach"));
          tr.appendChild(oHep(dauDon ? don.dien_thoai : "", "oDienThoai"));
          tr.appendChild(oHep(dauDon ? don.dia_chi : "", "oDiaChi"));
          tr.appendChild(o(d.ghi_chu));
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
      /* Ô TICK GIA DỤNG phải chặn TRƯỚC phép dò ô Mã — nó nằm BÊN TRONG ô
         ấy, nên một cú bấm vào ô tick cũng khớp `td[data-o="ma"]` và sẽ mở
         màn gán mã đè lên. Người dùng tick một cái rồi phải đóng một hộp
         thoại không ai gọi: đúng kiểu hỏng nhỏ làm tính năng không dùng
         được. */
      const tick = e.target.closest('input[data-o="gd"]');
      if (tick && tbody.contains(tick)) {
        e.stopPropagation();
        guiGiaDung(tick);
        return;
      }
      const td = e.target.closest('td[data-o="ma"]');
      if (!td || !tbody.contains(td)) return;
      const khoa = td.dataset.khoa;
      if (!khoa) return;
      window.GanMa.moChonMa(td.dataset.ten, td.dataset.ma || null, (ma, muc) => {
        /* Vá TẠI CHỖ trước — mã, hãng, ngành hàng đổi ngay dưới con trỏ, không
           chờ mạng. Đây là phần giữ lời hứa "không nhảy dòng". */
        vaDongTheoKhoa(khoa, ma, muc);
        /* Rồi lấy GIÁ VỐN của mã vừa gán (chủ dự án chốt 12/09/2026: "phân
           loại xong quét Tracking và hiện giá nhập luôn thay vì phải F5").
           Bắt buộc phải hỏi lại máy chủ: giá theo ngày bán nằm ở
           `POST /api/min-ngay` của Tracking, mà mã vừa gán thì lượt tải trước
           chưa hề hỏi tới (LUẬT SỐ 1 — trình duyệt không tự tra giá).
           `imLang`: không chớp "Đang tải…", giữ nguyên vị trí cuộn. */
        taiKy({ imLang: true });
      });
    });

    bang.appendChild(tbody);
    boc.appendChild(bang);
    khung.appendChild(boc);
    dieuChinhCaoBang();

    demLaiConNo(kq.trong_pham_vi_ma !== false && !kq.loi_nguon_ma);

    /* Băng GIÁ VỐN — "N dòng chưa có giá vốn, vì lý do gì", đúng câu
       ROADMAP.md đòi ở mục "Bạn nhìn thấy gì" của P4.
       Trước đây lý do CHỈ nằm ở `title` của từng ô Giá nhập, nên muốn biết
       cả kỳ còn nợ bao nhiêu thì phải rê chuột từng dòng một — mà đây đúng
       là con số người đối chiếu tay cần thấy đầu tiên.
       Đếm và phân loại do Engine trả về (`tom_tat_gia`); màn hình chỉ đọc
       và ghép chữ, không tự cộng lại (LUẬT SỐ 1). */
    const tg = b.tom_tat_gia;
    if (tg && kq.trong_pham_vi_ma !== false && !kq.loi_nguon_ma
        && (tg.co_gia || tg.chua_co_gia)) {
      if (!tg.chua_co_gia) {
        khung.appendChild(el("p", "bangConNo xong",
          "Mọi dòng hàng trong bảng đều đã có giá vốn theo ngày bán."));
      } else {
        /* Xếp lý do theo SỐ DÒNG giảm dần: việc đáng làm trước đứng trước.
           Mã lạ giữ nguyên chữ của Tracking thay vì nuốt — hợp đồng bên kia
           thêm một lý do mới thì nó phải lộ ra để còn bổ sung. */
        const ly = Object.entries(tg.theo_ly_do || {})
          .sort((a, b2) => b2[1] - a[1])
          .map(([k, n]) => soNguyen(n) + " dòng " + (LY_DO_GIA_NGAN[k] || k));
        khung.appendChild(el("p", "bangConNo", "Còn " + soNguyen(tg.chua_co_gia)
          + " dòng chưa có giá vốn" + (ly.length ? ": " + ly.join(" · ") : "") + "."));
      }
    }

    /* Băng QUYẾT ĐỊNH MỒ CÔI — quyết định sửa tay còn đó mà không dòng nào
       mang khoá ấy nữa (dòng đã biến mất khỏi sổ ở một lượt nhập sau).

       CLAUDE.md đòi thẳng: "màn hình phải nói rõ có bao nhiêu quyết định cũ
       không còn dòng nào để áp, KÈM DANH SÁCH. Không im lặng bỏ qua." Engine
       tính sẵn `tom_tat_sua_tay.mo_coi` từ P5 và chú thích của nó cũng chép
       lại đúng câu ấy — nhưng tới 12/09/2026 vẫn chưa màn nào hiện ra.

       KHÔNG cắt bớt danh sách: đây là việc của người dùng (hoặc sổ thiếu
       dòng, hoặc quyết định gõ nhầm chứng từ), và một danh sách bị cắt lặng
       lẽ là một phần việc không ai thấy — cùng kỷ luật với hàng chờ gán mã. */
    const tst = b.tom_tat_sua_tay;
    if (tst && tst.mo_coi && tst.mo_coi.length) {
      const p = el("p", "bangConNo", soNguyen(tst.mo_coi.length)
        + " quyết định sửa tay không còn dòng nào để áp — dòng đã biến mất khỏi "
        + "sổ. Quyết định vẫn được GIỮ: lúc nào dòng xuất hiện lại thì nó tự áp "
        + "trở lại. Khoá: " + tst.mo_coi.map((x) => x.khoa).join(" · ") + ".");
      khung.appendChild(p);
    }

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

    /* KHÔNG còn chú giải màu dưới bảng (chủ dự án chốt 12/09/2026: "bỏ đi
       không cần"). Nó đã dài thành một đoạn văn mà không ai đọc tới lần thứ
       hai; ý nghĩa từng màu và từng nút nay nằm ở `title` của đúng ô mang
       màu ấy, tức đọc được ngay tại chỗ đang thắc mắc. */
  }

  /** Đổi chỗ đang xem (năm / tháng / line) rồi tải lại.
   *
   *  Đi qua MỘT cửa thay vì mỗi nút tự gán `trangThai` rồi gọi `taiKy()`: chế
   *  độ "đang đặt RIÊNG tháng này" của dải setup KPI phải tắt mỗi lần đổi
   *  chỗ, và để mỗi nút tự nhớ tắt nó là để một nút nào đó quên.
   *
   *  Vì sao phải tắt: bật chế độ ấy ở tab Tín Phát rồi bấm sang Nội thành,
   *  con số gõ tiếp sẽ thành bản ghi đè RIÊNG tháng này của Nội thành — trong
   *  khi người dùng tưởng mình đang đặt mặc định. Một mục tiêu kinh doanh đặt
   *  sai tầng là con số sai lặng lẽ ở đúng một tháng, loại sai khó thấy nhất.
   *  Mặc định là chế độ thường; ghi đè một tháng là việc phải cố ý làm lại. */
  function doiCho(moi) {
    Object.assign(trangThai, moi);
    trangThai.kpiRiengKy = false;
    /* Ô hệ số gia dụng vừa mở cho một line thì đóng lại khi đi sang chỗ khác —
       nó là "tôi đang định khai thêm cho line NÀY", không phải một trạng thái
       của dữ liệu. Giữ lại thì sang line khác lại thấy một ô trống mời gõ một
       hệ số line ấy không cần. */
    trangThai.moGiaDung = null;
    taiKy();
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
    nutTh.addEventListener("click", () => { doiCho({ line: null }); });
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
      nut.addEventListener("click", () => { doiCho({ line: ten }); });
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
      nut.addEventListener("click", () => { doiCho({ ky }); });
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
        doiCho({ nam, ky: (trangThai.dsKy.nam[nam] || [])[0] || null });
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
        veTongHop(ve, kq);
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
