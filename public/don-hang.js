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
  /** Hai chữ số thập phân — cho hệ số thưởng (0,15% và 0,45% chỉ khác nhau ở
   *  chữ số thứ hai, nên `so1` sẽ làm hai bậc trông giống hệt nhau). */
  const so2 = (v) => (Number(v) || 0).toLocaleString("vi-VN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  /** Một mốc tiền lớn, viết theo TỈ để đọc được bằng mắt: 1.500.000.000 đ →
   *  "1,5 tỷ". Mốc thưởng nóng của cách A là một số lẻ (3.115.384.615 đ) nên
   *  giữ tới 3 chữ số thập phân — "3,115 tỷ" vẫn đọc được, còn "3 tỷ" thì sai
   *  hẳn con số. */
  const tyDong = (v) => (Number(v) || 0) / 1e9 === 0 ? "0"
    : ((Number(v) || 0) / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 3 }) + " tỷ";
  const so1 = (v) => (Number(v) || 0).toLocaleString("vi-VN", {
    minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function nhanNgayDay(d) {
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(d || "");
  }

  /** Ngày cho CỘT "Ngày" của bảng đơn: chỉ `DD/MM` (chủ dự án chốt
   *  12/09/2026). Năm là chữ lặp lại ở mọi dòng của một bảng mà cả bảng
   *  vốn đã là một tháng — nút tháng ngay trên đầu nói rõ tháng nào, năm
   *  nào. Bỏ nó đi là bỏ đúng phần không mang tin.
   *
   *  Hàng BĂNG NGÀY (`hangNgay`) vẫn giữ `nhanNgayDay` đủ năm: nó xuất hiện
   *  MỘT lần cho mỗi ngày chứ không lặp theo dòng, nên chỗ ấy năm không tốn
   *  gì; và nó là chỗ duy nhất còn neo được bảng vào một mốc thời gian thật
   *  khi ai đó chụp màn hình gửi đi. */
  function nhanNgayCot(d) {
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] : String(d || "");
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
    "Tổng bán", "Lợi nhuận", "Quy đổi",
    "Tên khách hàng", "Số điện thoại", "Địa chỉ", "Ghi chú",
    "Hãng", "Ngành hàng", "IMEI", "Sửa", "Xoá"];

  /* Bề rộng CHỐT CỐ ĐỊNH cho từng cột, đi cùng `table-layout: fixed` (chủ dự
     án chốt 12/09/2026). Trước đây bề rộng do nội dung quyết định, nên đúng
     lúc P4 điền chữ vào những ô đang là "—" thì cả bảng nống ra và dịch chỗ —
     mà gán mã là việc làm liên tục trên cùng một màn hình, mỗi lần gán một
     cái giật bố cục là không dùng được. Cố định rồi thì điền gì vào cũng
     không xê dịch một pixel.

     Phải đúng 19 số, đúng thứ tự `COT` — `kiem/bo-cuc-man-chu.js` canh cặp. */
  /* Cột Ngày nới 58 → 104 (15/09/2026). Băng ngày nay nằm TRONG cột này chứ
     không còn là một ô `colSpan` trải hết bảng, nên nó phải chứa đủ mũi tên
     đóng/mở (12px + 6px lề) cộng nhãn ngày ĐỦ NĂM in đậm ("01/08/2026",
     ~68px ở cỡ chữ 12) cộng 16px đệm hai bên — tức ~102px. Bảng khai
     `table-layout: fixed` và mọi ô `overflow: hidden`, nên thiếu chỗ không
     xuống dòng mà CẮT ĐUÔI: để 58 thì mỗi băng ngày hiện ra "01/08/2…".

     Giữ nhãn đủ năm thay vì rút về DD/MM cho vừa cột hẹp: đó là chốt
     12/09/2026 của chủ dự án — băng ngày là chỗ duy nhất còn neo bảng vào
     một mốc thời gian thật khi ai đó chụp màn hình gửi đi. Nới cột là cái
     giá rẻ hơn hẳn việc bỏ mốc ấy. */
  const RONG_COT = [104, 78, 92, 200, 44, 100, 82, 90, 104, 96,
    132, 108, 132, 150, 92, 112, 84, 34, 34];

  /* `kpiRiengKy`: dải setup đang gõ cho RIÊNG kỳ đang xem, hay đang gõ mặc
     định cho mọi kỳ. Chỉ là trạng thái của màn hình — KHÔNG lưu ở đâu cả, và
     không được lưu: nó nói "tôi đang định đổi cái nào", không nói dữ liệu là
     gì. Về mặc định mỗi lần nạp trang, vì đặt mặc định là lượt sửa thường
     gặp, còn ghi đè một tháng là việc cố ý làm. */
  const trangThai = { nam: null, line: null, ky: null, dsKy: null, hienLine0: false,
    kpiRiengKy: false, moGiaDung: null, loc: null, ngayMo: new Set() };

  /** BA BỘ LỌC trên đầu cột (chủ dự án chốt 12/09/2026). Mỗi cái trả lời một
   *  câu hỏi "còn việc gì phải làm trên bảng này", nên cả ba đều là DANH SÁCH
   *  VIỆC chứ không phải một cách xem số khác.
   *
   *  `hop()` chỉ ĐỌC cờ Engine đã đặt sẵn, không tự phán đoán — và ba chỗ đều
   *  quan trọng:
   *
   *   · `ly_do_chua_ma` chỉ có giá trị khi thật sự chưa có quyết định nào.
   *     Dòng đã đánh "bỏ qua" KHÔNG lọt vào đây: bỏ qua là một quyết định
   *     của người, không phải một việc còn treo. Chiết khấu và phụ phí cố
   *     định cũng không, vì Engine đặt `null` cho chúng — chúng không phải
   *     mặt hàng.
   *
   *   · `la_lo` chứ KHÔNG phải `loi_nhuan < 0`. Ba loại dòng âm THEO THIẾT
   *     KẾ — chiết khấu, quà tặng 0 đồng, bán trả lại — đã bị Engine loại ra
   *     khỏi cờ này. So `< 0` ở đây là dựng lại một luật nghiệp vụ ngay
   *     trong trình duyệt (LUẬT SỐ 1) và cho ra một danh sách việc đầy những
   *     dòng không có việc gì. Đây đúng là cờ đang tô đỏ những dòng ấy, nên
   *     "lọc" = "chỉ hiện mấy dòng đỏ tôi đang thấy".
   *
   *   · `gia_nhap` rỗng gồm cả `undefined` (kỳ ngoài phạm vi khớp mã, Engine
   *     không đặt trường này chút nào) lẫn `null` (trong phạm vi mà chưa tra
   *     ra giá). Cả hai đều là "chưa có giá nhập" theo đúng nghĩa người dùng
   *     hỏi. */
  /** Cảnh báo và bộ lọc chỉ dành cho QUẢN TRỊ (chủ dự án chốt 12/09/2026).
   *
   *  Quản lí xem báo cáo, không nhận việc: mọi thứ tô đỏ/vàng trên bảng đều
   *  là "còn phải làm gì" — chưa phân loại, chưa có giá vốn, dòng lỗ — và ba
   *  bộ lọc chính là ba câu hỏi ấy. Với người không có quyền sửa, chúng chỉ
   *  là màu mè gây lo, còn nút lọc thì mời bấm vào một việc họ không làm
   *  được.
   *
   *  Đây KHÔNG phải một lớp bảo mật, và không được đọc thành thế: số liệu
   *  vẫn y nguyên trong phản hồi, chỉ khác cách vẽ. Cửa thật nằm ở Gateway
   *  (`boc("quantri", …)` cho ba đường ghi KPI) và ở rules Firebase. Giấu
   *  màu ở trình duyệt là chuyện TRÌNH BÀY, không phải chuyện quyền. */
  const laQuanTri = () => window.VAI_BAO_CAO === "quantri";
  const duocLoc = laQuanTri;

  /** Lớp cảnh báo, hoặc `null` nếu vai này không được thấy cảnh báo.
   *  Dùng ở MỌI chỗ tô cảnh báo, để không có chỗ nào quên. */
  const lopCanhBao = (lop) => (duocLoc() ? lop : null);

  const LOC = {
    ma: { cot: "Mã sản phẩm", nhan: "Chỉ hiện dòng CHƯA PHÂN LOẠI",
      hop: (d) => !!d.ly_do_chua_ma },
    gia: { cot: "Giá nhập", nhan: "Chỉ hiện dòng CHƯA CÓ GIÁ NHẬP",
      hop: (d) => d.gia_nhap === null || d.gia_nhap === undefined },
    lo: { cot: "Lợi nhuận", nhan: "Chỉ hiện dòng LỖ",
      hop: (d) => !!d.la_lo },
  };

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
    /* `cache: "no-store"` dù Gateway đã trả `Cache-Control: no-store`, và đây
       KHÔNG phải dư thừa: header mới chỉ chặn những lượt cache TỪ NAY: những
       bản đã nằm trong cache của trình duyệt TRƯỚC lượt sửa ấy vẫn còn đó và
       vẫn được dùng lại. Tuỳ chọn này bỏ qua chúng, nên máy chủ dự án không
       phải xoá cache bằng tay mới thấy số đúng. */
    const r = await fetch(duong, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token },
    });
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
  /* ICON VẼ THEO LINE, một màu — chủ dự án chốt 13/09/2026, thay cho emoji.
   *
   *  Emoji do HỆ ĐIỀU HÀNH vẽ: mỗi máy một hình, luôn nhiều màu, và không
   *  nhận thuộc tính `color` nên không bao giờ hoà được với bảng — đúng chỗ
   *  ✏️ 🗑 đang chọi lại tông xám của mọi thứ quanh nó.
   *
   *  `stroke="currentColor"` là cả điểm: icon đổi màu theo trạng thái của
   *  nút chứa nó (xám lúc nghỉ, xanh lúc rê, đỏ ở nút Xoá), nên chỉ có MỘT
   *  bản hình cho mọi trạng thái. Dựng bằng `innerHTML` với chuỗi hằng viết
   *  ngay tại đây, không nhận dữ liệu nào từ ngoài. */
  const ICON = {
    sua: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    xoa: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'
       + '<path d="M10 11v6M14 11v6"/>',
    loc: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
    cong: '<path d="M12 5v14M5 12h14"/>',
    mo: '<path d="M9 6l6 6-6 6"/>',
  };

  /** Một icon line. `to` = bề dày nét, để icon nhỏ không bị đặc lại. */
  function icon(ten, to) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", String(to || 2));
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICON[ten] || "";
    return svg;
  }

  function nutDong(bieuTuong, nhan, bat, viec) {
    const td = el("td", "oIcon");
    const b = el("button", "nutIcon" + (bieuTuong === "xoa" ? " nutXoa" : ""));
    b.appendChild(icon(bieuTuong));
    b.type = "button";
    b.disabled = !bat;
    b.title = bat ? nhan
      : nhan + " — dòng này không sửa được (chiết khấu, hoặc kỳ ngoài phạm vi)";
    b.setAttribute("aria-label", nhan);
    if (bat) b.dataset.viec = viec;
    td.appendChild(b);
    return td;
  }

  /** Nút lọc của MỘT cột. Bấm lần nữa là tắt; bật cái này thì cái kia tắt.
   *
   *  Chọn MỘT-TRONG-BA chứ không cho chồng nhau, và đó là một lựa chọn chứ
   *  không phải sự lười: giao của "chưa phân loại" với "lỗ" gần như luôn
   *  rỗng (chưa phân loại thì chưa có giá vốn, chưa có giá vốn thì lợi nhuận
   *  chưa biết chứ không âm), nên một bảng trống hiện ra sau hai cú bấm hợp
   *  lệ đọc lên y hệt một cái hỏng. Ba câu hỏi này vốn hỏi lần lượt, không
   *  hỏi cùng lúc. */
  function nutLoc(khoa) {
    const b = el("button", "nutLoc" + (trangThai.loc === khoa ? " locDang" : ""));
    b.appendChild(icon("loc", 2.2));
    b.type = "button";
    b.title = trangThai.loc === khoa ? "Đang lọc — bấm để bỏ lọc" : LOC[khoa].nhan;
    b.setAttribute("aria-label", LOC[khoa].nhan);
    b.setAttribute("aria-pressed", trangThai.loc === khoa ? "true" : "false");
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      trangThai.loc = trangThai.loc === khoa ? null : khoa;
      /* Vẽ lại từ dữ liệu ĐANG CÓ, không gọi lại máy chủ: lọc là phép ẩn
         dòng, không phải phép tính — không con số nào đổi. Gọi lại là bắt
         người dùng chờ một vòng mạng cho đúng thứ đang nằm sẵn trong tay. */
      if (bangCuoi) veKetQua(bangCuoi);
    });
    return b;
  }

  /** Ô LÝ DO bonus — nằm dưới đúng cột Ghi chú của hàng tổng đơn. */
  function oLyDoBonus(don) {
    const td = el("td", "oLyDoBonus", don.bonus ? don.bonus.ly_do : "");
    td.dataset.o = "lydo";
    if (don.bonus && don.bonus.boi) {
      td.title = "Bonus do " + don.bonus.boi + " cộng"
        + (don.bonus.luc ? " lúc " + new Date(don.bonus.luc).toLocaleString("vi-VN") : "")
        + ".";
    }
    return td;
  }

  /** Mở chế độ SỬA BONUS ngay trong hai ô của hàng tổng đơn.
   *
   *  Chủ dự án chốt 13/09/2026: bản trước bung một hộp thoại nổi đè lên bảng
   *  ("tù quá") — nó che mất chính cái đơn đang cộng cho, và số tiền thì gõ ở
   *  một chỗ khác hẳn cột nó sẽ hiện ra. Nay sửa TẠI CHỖ, đúng khuôn mà lượt
   *  sửa Giá nhập/Nơi nhập của P4 đã chạy: ô số ở cột Lợi nhuận, ô lý do ở
   *  cột Ghi chú, rời khỏi HÀNG là tự lưu.
   *
   *  Xoá bonus = xoá trắng ô số (hoặc gõ 0). Không cần nút Xoá riêng, và ô
   *  quay về dấu `+` — đúng câu chủ dự án đòi.
   *
   *  Bốn lý do mặc định đọc từ ENGINE (`kq.bang.ly_do_bonus`), không gõ cứng
   *  ở đây: thêm một lý do phải là sửa đúng một chỗ. Vẫn gõ được lý do khác —
   *  bốn cái kia là phím tắt cho bốn ca hay gặp, không phải bộ phân loại đóng. */
  function moBonus(nut, kq) {
    const so_ct = nut.dataset.soCt;
    if (!so_ct || nut.disabled) return;
    const tr = nut.closest("tr");
    if (!tr || tr.classList.contains("dangSuaBonus")) return;
    if (dangSua && dangSua.huy) dangSua.huy();
    tr.classList.add("dangSuaBonus");

    const tdTien = nut.parentElement;
    const tdLyDo = tr.querySelector('td[data-o="lydo"]');
    const cuTien = tdTien.innerHTML, cuLyDo = tdLyDo.textContent;
    const soCu = tdTien.querySelector(".soBonus");
    const tienCu = soCu ? soCu.textContent.replace(/[^\d,]/g, "").replace(",", ".") : "";

    const dsLyDo = (kq.bang && Array.isArray(kq.bang.ly_do_bonus))
      ? kq.bang.ly_do_bonus : [];

    tdTien.innerHTML = "";
    const oTien = el("input", "oSuaGia");
    oTien.type = "text";
    oTien.inputMode = "decimal";
    oTien.value = tienCu;
    oTien.placeholder = "50";
    oTien.title = "Cộng thêm vào lợi nhuận của đơn, theo nghìn đồng. "
      + "Xoá trắng ô này là bỏ bonus.";
    tdTien.appendChild(oTien);

    tdLyDo.textContent = "";
    const chon = el("select", "oSuaLyDo");
    for (const t of [...dsLyDo, "Khác…"]) chon.appendChild(el("option", null, t));
    const oKhac = el("input", "oSuaGia oKhac");
    oKhac.type = "text";
    oKhac.placeholder = "Lý do";
    oKhac.hidden = true;
    /* Lý do cũ ngoài bốn cái mặc định thì mở sẵn ô gõ tay và điền lại — nếu
       không, mở ra sửa số tiền là lý do lặng lẽ bị thay bằng lựa chọn đầu
       danh sách. */
    if (cuLyDo && !dsLyDo.includes(cuLyDo)) {
      chon.value = "Khác…"; oKhac.hidden = false; oKhac.value = cuLyDo;
    } else if (cuLyDo) chon.value = cuLyDo;
    chon.addEventListener("change", () => {
      oKhac.hidden = chon.value !== "Khác…";
      if (!oKhac.hidden) oKhac.focus();
    });
    tdLyDo.appendChild(chon);
    tdLyDo.appendChild(oKhac);

    const phien = { xong: false };
    const traLai = () => {
      phien.xong = true;
      tdTien.innerHTML = cuTien;
      tdLyDo.textContent = cuLyDo;
      tr.classList.remove("dangSuaBonus");
      dangSua = null;
    };
    dangSua = { tr, huy: traLai };

    async function luu() {
      if (phien.xong) return;
      const chu = oTien.value.trim().replace(/\s/g, "").replace(",", ".");
      const n = chu === "" ? 0 : Number(chu);
      if (!Number.isFinite(n) || n < 0) { oTien.focus(); oTien.select(); return; }

      /* Xoá trắng (hoặc 0) = BỎ bonus. Gửi `tien: null` — Gateway xoá hẳn bản
         ghi, và ô quay về dấu `+`. */
      const than = n === 0 ? { tien: null } : null;
      if (!than) {
        const ly_do = (chon.value === "Khác…" ? oKhac.value : chon.value).trim();
        if (!ly_do) {
          /* Đúng câu chủ dự án đòi: nhập tiền thì phải nhập cả lý do, thiếu
             thì cảnh báo NGAY — không gửi đi rồi chờ một lỗi đỏ từ máy chủ. */
          tdLyDo.classList.add("thieuLyDo");
          $("loiDonHang").textContent = "Phải chọn hoặc gõ lý do được cộng bonus.";
          (oKhac.hidden ? chon : oKhac).focus();
          return;
        }
        tdLyDo.classList.remove("thieuLyDo");
      }
      phien.xong = true;
      tr.classList.add("hangDangGui");
      let kq2;
      try {
        kq2 = await goiGhi("/api/bonus", { ky: trangThai.ky, so_ct, line: trangThai.line,
          ...(than || { tien: Math.round(n * 1000),
            ly_do: (chon.value === "Khác…" ? oKhac.value : chon.value).trim() }) });
      } catch (e) {
        tr.classList.remove("hangDangGui");
        phien.xong = false;
        $("loiDonHang").textContent = "Không lưu được bonus: " + e.message;
        return;
      }
      tr.classList.remove("hangDangGui");
      traLai();
      apBangMoi(kq2);
    }

    /* Rời khỏi CẢ HÀNG thì tự lưu — cùng nếp với lượt sửa Giá nhập của P4.
       Xét `relatedTarget` còn nằm trong `tr` hay không, không xét từng ô:
       nhảy từ ô tiền sang ô lý do không phải "rời". */
    tr.addEventListener("focusout", (e) => {
      if (phien.xong) return;
      if (!e.relatedTarget || !tr.contains(e.relatedTarget)) luu();
    });
    for (const x of [oTien, oKhac]) {
      x.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); luu(); }
        else if (ev.key === "Escape") { ev.preventDefault(); traLai(); }
      });
    }
    oTien.focus();
    oTien.select();
  }

  /** Ô BONUS trên hàng tổng của một đơn — chủ dự án chốt 12/09/2026.
   *
   *  "Một số đơn nếu khách qua kho lấy, hoặc có thưởng, nhân viên sẽ được
   *  cộng một ít vào lợi nhuận để có thêm doanh số quy đổi."
   *
   *  Con số hiện ra là con số ENGINE trả về (`don.bonus.tien`), không phải
   *  con số vừa gõ: quy đổi của nó do Engine chia theo hệ số của line (LUẬT
   *  SỐ 1), nên hiện lại thứ Engine đã nhận mới chắc hai bên nói cùng một
   *  con số.
   *
   *  Quản lí thấy con số nhưng không thấy nút: cộng bonus là sửa lương, cùng
   *  mức khoá với đặt KPI. */
  function oBonus(don) {
    const td = el("td", "oSo oBonus");
    /* NÚT ĐỨNG TRƯỚC SỐ (chủ dự án chốt 13/09/2026). Đặt sau số thì bề rộng
       của nút bị cộng vào phần bên phải, nên con số bonus lùi trái đúng bằng
       một cái nút và KHÔNG còn thẳng hàng với mọi con số khác của cột — đó
       là "biến dạng dòng" chủ dự án thấy. Nút bên trái thì mép phải của số
       vẫn là mép phải của ô, y như mọi hàng khác.
       Nút dựng TRƯỚC cả nhánh sớm, để hàng không có bonus cũng chừa đúng
       ngần ấy chỗ bên trái — nếu không, hàng có và hàng không có bonus lệch
       nhau. */
    if (!laQuanTri()) {
      if (don.bonus) {
        const so = el("span", "soBonus", "+" + nghin(don.bonus.tien));
        so.title = "Bonus đã cộng vào lợi nhuận của đơn này: " + don.bonus.ly_do;
        td.appendChild(so);
      }
      return td;
    }
    const b = el("button", "nutBonus");
    b.appendChild(icon(don.bonus ? "sua" : "cong", 2.4));
    b.type = "button";
    b.title = don.bonus ? "Sửa hoặc xoá bonus của đơn này"
      : "Cộng thêm lợi nhuận cho đơn này (khách qua kho lấy, NCC giao hộ…)";
    b.setAttribute("aria-label", b.title);
    b.dataset.soCt = don.so_ct;
    td.appendChild(b);
    if (don.bonus) {
      const so = el("span", "soBonus", "+" + nghin(don.bonus.tien));
      so.title = "Bonus đã cộng vào lợi nhuận của đơn này: " + don.bonus.ly_do;
      td.appendChild(so);
    }
    return td;
  }

  /* Kết quả `/api/don-hang` gần nhất, giữ lại để bật/tắt bộ lọc vẽ lại được
     mà không phải hỏi máy chủ. KHÔNG dùng nó cho việc gì khác — nó là bản
     chụp, và một bản chụp đem đi trả lời câu hỏi khác là số cũ. */
  let bangCuoi = null;

  /* ---- Vẽ bảng đơn hàng của một (kỳ, line) ---- */

  /** Ô "Mã sản phẩm".
   *
   *  ĐÃ KHỚP MÃ thì hiện MÃ NGẮN của bảng giá, không hiện câu tên kế toán
   *  (chủ dự án chốt 12/09/2026: `"Tivi Samsung 65U8500F"` đã khớp `65U8500F`
   *  thì chỉ hiện `65U8500F`). Lý do nó tốt hơn: cột này rộng 240px mà câu
   *  tên kế toán thường dài hơn thế nên bị cắt đuôi — đúng đoạn đuôi mang
   *  model, tức phần duy nhất phân biệt hai dòng với nhau. Mã ngắn thì vừa
   *  trọn, và nó là cùng một thứ chữ người dùng đang đọc bên Tracking.
   *
   *  CHƯA KHỚP thì vẫn hiện nguyên câu tên — đó là tất cả những gì ta biết về
   *  dòng ấy, và cũng là chữ người dùng cần đọc để gán tay.
   *
   *  Câu tên đầy đủ KHÔNG mất: nó ở `title` (rê chuột là thấy) và ở
   *  `dataset.ten`. Chỗ thứ hai là BẮT BUỘC, không phải để dự phòng — màn gán
   *  mã khoá theo TÊN HÀNG, nên gửi mã ngắn thay cho tên là ghi quyết định
   *  vào một ô khác ô Engine sẽ đọc.
   *
   *  Dòng đã có mã vẫn bấm được: một lượt khớp TỰ ĐỘNG có thể sai, và không
   *  cho sửa thì cái sai ấy nằm lại vĩnh viễn. */
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
    const duoc = laQuanTri();
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
    /* Chữ HIỆN RA: mã ngắn nếu đã khớp, nguyên câu tên nếu chưa.
       Dựng sau ô tick và trước mọi nhánh trả về sớm, để nhánh nào cũng có
       đúng một <span> chữ — ô rỗng là một dòng không đọc được.

       `ma_hien` là CÁCH VIẾT của mã (`RT268WE-PMV(68)`), `ma_bang_gia` là mã
       thật đã chuẩn hoá (`RT268WEPMV68`) — chính là khoá `board/<mã>` bên
       Tracking. Hiện cách viết, đúng thứ màn Bảng giá bên đó đang hiện; chủ
       dự án bắt được lệch này 12/09/2026. Engine quyết cách viết nào dùng
       được (LUẬT SỐ 1), màn hình chỉ đọc field — và rơi về mã thật nếu
       Engine bản cũ chưa gửi field ấy. */
    const s = el("span", null, d.ma_hien || d.ma_bang_gia || d.ma_san_pham);
    if (d.ma_bang_gia) s.classList.add("maNgan");
    td.appendChild(s);

    /* Phụ phí cố định (Chi phí vận chuyển / lắp đặt / Chênh VAT) cùng một
       lối với chiết khấu: không phải mặt hàng, không cần phân loại, nên ô
       hiện phẳng — không vàng, không bấm được. Hai loại này không bao giờ có
       `ma_bang_gia` nên vẫn hiện nguyên câu, đúng như cần. */
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
      /* `title` nay mang CÂU TÊN ĐẦY ĐỦ — thứ vừa thôi hiện ra. Trước đây nó
         mang chính cái mã, mà mã thì đã nằm ngay trước mắt rồi; nhắc lại một
         thứ đang đọc được và bỏ mất thứ không đọc được là đúng chiều ngược. */
      td.title = d.ma_san_pham + "\n\nMã bảng giá: " + (d.ma_hien || d.ma_bang_gia)
        + (d.nguon_ma === "tu-dong" ? " (máy tự khớp — bấm để sửa)" : " (đã gán tay — bấm để đổi)");
    } else if (d.nguon_ma === "bo-qua") {
      if (duocLoc()) td.classList.add("maBoQua");
      td.title = "Đã đánh dấu không phải sản phẩm cần gán mã — bấm để đổi.";
    } else if (d.nguon_ma === null && d.ly_do_chua_ma) {
      if (duocLoc()) td.classList.add("maChuaCo");
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
      /* Tên NCC đang đứng đây là một PHỎNG ĐOÁN: bản ghi giá của ngày này có
         trước khi Tracking ghi tồn kho theo ngày (12/09/2026), nên máy không
         biết hôm ấy kho có hàng hay không và đành lấy NCC giữ giá Min. Nói ra
         chứ không để nó đọc như một câu chắc chắn (chủ dự án chốt 18/09/2026).
         Cờ do Engine đặt từ `inventory_known` của hợp đồng; sửa tay là Engine
         tắt — chữ của người không phải phỏng đoán của máy. */
      if (d.kho_chua_ro) {
        td.classList.add("noiNhapChuaRo");
        td.title = "Chưa biết hôm ấy kho có hàng hay không — bản ghi giá của "
          + "ngày này có trước khi Tracking ghi tồn kho theo ngày (12/09/2026), "
          + "nên nơi nhập tạm lấy theo NCC giữ giá Min. Chạy lượt vá tồn kho "
          + "bên Tracking là ô này tự đúng.";
      }
      return td;
    }
    /* Phụ phí cố định không có khái niệm "nơi nhập" (không phải một NCC
       giữ giá cho một mã hàng) — ô để trống, KHÔNG bôi đỏ như một dòng
       chưa tra được giá. */
    const khongCanNoiNhap = d.la_chiet_khau || d.la_phu_phi_co_dinh;
    const td = el("td", khongCanNoiNhap ? null : lopCanhBao("oChuaRo"), "—");
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
    const td = el("td", ("oSo " + lopCanhBao(chuaGanMa ? "oChuaGia" : "oChuaRo")).trim(), "—");
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
    /* Cách viết của mã, do Engine tính và đi kèm mục vừa chọn. Rơi về `ma`
       (mã thật đã chuẩn hoá) nếu khuyết — thà hiện đúng thứ lượt tải sau sẽ
       hiện còn hơn đoán một cách viết ở đây: `maHoa()` là luật khớp mã, màn
       hình không được giữ bản sao của nó (LUẬT SỐ 1). */
    const hien = (muc && muc.hien) || null;
    const cacO = document.querySelectorAll('#veDonHang td[data-khoa="' + CSS.escape(khoa) + '"]');
    for (const td of cacO) {
      td.classList.remove("maChuaCo", "maBoQua");
      /* Chữ trong ô phải đổi theo Ở ĐÂY, không chờ lượt tải lại. Cả điểm của
         `vaDongTheoKhoa()` là giữ lời hứa "không nhảy dòng": người vừa gán mã
         phải thấy ngay ô đổi sang mã ngắn dưới con trỏ. Chờ mạng thì có một
         khoảng ô vẫn hiện câu tên dài trong khi quyết định đã xong rồi.
         `nhan` là <span> duy nhất của ô — ô tick gia dụng là <input>. */
      const nhan = td.querySelector("span");
      if (ma) {
        td.dataset.ma = ma;
        /* Cách viết do màn gán mã đưa sang (`muc.hien`, Engine tính) — phải
           là CHÍNH chuỗi lượt tải sau sẽ hiện, nếu không ô nhấp một cái sang
           chữ khác ngay dưới con trỏ và người dùng tưởng mình gán nhầm. */
        const chu = hien || ma;
        if (nhan) { nhan.textContent = chu; nhan.classList.add("maNgan"); }
        /* `dataset.ten` KHÔNG đổi — nó giữ câu tên đầy đủ, và màn gán mã khoá
           theo tên hàng nên đổi nó là ghi quyết định kế tiếp vào sai ô. */
        td.title = (td.dataset.ten || "") + "\n\nMã bảng giá: " + chu
          + " (đã gán tay — bấm để đổi)";
      } else {
        delete td.dataset.ma;
        td.classList.add("maBoQua");
        /* "Bỏ qua" là không có mã nào, nên ô về lại câu tên đầy đủ — đó lại là
           tất cả những gì ta biết về dòng ấy. */
        if (nhan && td.dataset.ten) {
          nhan.textContent = td.dataset.ten;
          nhan.classList.remove("maNgan");
        }
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

  /** Băng "còn N dòng chưa có mã" ĐÃ BỎ (chủ dự án chốt 12/09/2026) — xem
   *  chú thích dài ở chỗ vẽ bảng. Hàm giữ lại đúng phần TẮT nó, vì thẻ
   *  `#bangConNo` vẫn nằm trong `index.html` và vẫn phải chắc chắn không
   *  bao giờ hiện ra. Xoá cả hàm thì bốn chỗ gọi phải sửa theo, và một
   *  trong bốn chỗ ấy lỡ sót là băng cũ sống lại. */
  function demLaiConNo() {
    const bn = $("bangConNo");
    if (bn) { bn.hidden = true; bn.textContent = ""; }
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
      let kq;
      try {
        kq = await goiGhi("/api/sua-dong", { ky: trangThai.ky, khoa,
          gia_nhap: giaGui, noi_nhap: noiGui, line: trangThai.line });
      } catch (e) {
        tr.classList.remove("hangDangGui");
        phien.xong = false;
        $("loiDonHang").textContent = "Không lưu được: " + e.message;
        return;
      }
      tr.classList.remove("hangDangGui");
      traLai();
      apBangMoi(kq);
    }

    return { luu, huy: traLai };
  }

  async function xoaDongHang(tr) {
    const khoa = tr.dataset.khoaDong;
    if (!khoa) return;
    /* Câu hỏi xác nhận XOÁ dùng TÊN ĐẦY ĐỦ (`dataset.ten`), không dùng chữ
       đang hiện trong ô — từ 12/09/2026 ô ấy hiện mã ngắn. Hai câu tên kế
       toán khác nhau có thể cùng khớp về MỘT mã (`"Tivi Samsung 65U8500F"` và
       `"TV Samsung 65U8500F chính hãng"`), nên một câu hỏi "Xoá 65U8500F?" là
       câu hỏi không chỉ đúng vào dòng nào. Đây là lượt xoá tiền khỏi báo cáo —
       chỗ duy nhất trong app đáng dài dòng. */
    const oMa = tr.querySelector('td[data-o="ma"]');
    const ten = (oMa && (oMa.dataset.ten || oMa.textContent)) || "dòng này";
    if (!window.confirm("Xoá " + ten + " khỏi báo cáo?\n\n"
      + "Dòng sẽ biến khỏi bảng, và doanh số của nó bị trừ khỏi cả biểu đồ. "
      + "Sổ gốc không đổi — bấm lại nút này trên dòng đó sau khi nhập lại sổ "
      + "là khôi phục được.")) return;
    tr.classList.add("hangDangGui");
    let kq;
    try {
      kq = await goiGhi("/api/sua-dong", { ky: trangThai.ky, khoa, xoa: true,
        line: trangThai.line });
    } catch (e) {
      tr.classList.remove("hangDangGui");
      $("loiDonHang").textContent = "Không xoá được: " + e.message;
      return;
    }
    apBangMoi(kq);
  }

  /** Dùng bảng mà lượt GHI vừa trả về, thay cho một vòng mạng thứ hai.
   *
   *  Sửa giá nhập đổi lợi nhuận của dòng, của đơn, của ngày, quy đổi, tỉ lệ
   *  tồn kho và tổng cả kỳ — sáu con số do ENGINE tính, nên trình duyệt
   *  không được tự nhân trừ (LUẬT SỐ 1). Bản trước vì thế gọi lại
   *  `GET /api/don-hang` và người sửa một ô phải ngồi chờ trọn một vòng mạng
   *  THỨ HAI. Nay máy chủ trả luôn bảng đã tính lại trong chính phản hồi
   *  ghi: một lượt bấm = một vòng mạng, mà con số vẫn là con số Engine tính.
   *
   *  HAI ca rơi về đường cũ, và cả hai đều là ca thật:
   *
   *   · máy chủ không kèm được bảng (dựng lại hỏng, hoặc Gateway bản cũ giữa
   *     hai lượt deploy) — `bang_moi` khuyết, gọi lại GET như trước;
   *   · người dùng đã ĐỔI TAB hoặc ĐỔI THÁNG trong lúc lượt ghi đang bay.
   *     Bảng trả về khi ấy là của chỗ CŨ; vẽ nó ra là ném người dùng ngược
   *     về nơi họ vừa rời, với số của một line khác. Đối chiếu (kỳ, line)
   *     rồi mới vẽ. */
  function apBangMoi(kq) {
    const b = kq && kq.bang_moi;
    const dungCho = b && kq.ky === trangThai.ky
      && (b.bang ? b.bang.line : null) === trangThai.line;
    if (dungCho) veKetQua(b);
    else taiKy({ imLang: true });
    if (window.SucKhoe && window.SucKhoe.canhLai) window.SucKhoe.canhLai();
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
    { khoa: "kpi", nhan: "KPI", dv: null, buoc: "1", phanCach: true,
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

  /** Chấm phân cách hàng nghìn cho ô KPI (chủ dự án chốt 13/09/2026).
   *
   *  CHỈ ô KPI. Hai ô hệ số là phần trăm một-hai chữ số có phần lẻ (`7,5`) —
   *  chấm ở đó vô nghĩa, và tệ hơn: `7.5` đọc ra "bảy nghìn năm" hay "bảy
   *  phẩy năm" tuỳ người, đúng kiểu mơ hồ không được có trên một ô tiền.
   *
   *  Ô đổi sang `type="text"`: `type="number"` KHÔNG hiện được dấu phân cách
   *  (trình duyệt tự chuẩn hoá giá trị và vứt mọi ký tự lạ). Đổi lại phải tự
   *  chặn ký tự không phải số ở `guiKpi` — nó vốn đã làm thế.
   *
   *  Định dạng lúc RỜI ô, gỡ ra lúc VÀO ô. Định dạng ngay trong lúc gõ thì
   *  mỗi lần chèn một dấu chấm là con trỏ nhảy về cuối, nên sửa một chữ số ở
   *  giữa thành ra không sửa được. */
  const chamNghin = (chu) => {
    const so = String(chu).replace(/[^\d]/g, "");
    return so ? so.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
  };

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

    const duoc = laQuanTri();
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
      if (o.phanCach) {
        oN.type = "text";
        oN.inputMode = "numeric";
        oN.value = chamNghin(soVaoO(o.khoa, gt));
        oN.addEventListener("focus", () => { oN.value = oN.value.replace(/\./g, ""); });
        oN.addEventListener("blur", () => { oN.value = chamNghin(oN.value); });
        /* Cờ đi CÙNG ô, không suy lại từ tên trường ở chỗ đọc: chỗ đọc mà tự
           đoán "ô nào có dấu phân cách" là hai nơi phải khớp nhau, và lệch
           một nơi thì hoặc `1.500.000` thành `NaN`, hoặc `7.5` thành `75`. */
        oN.dataset.phanCach = "1";
      } else {
        oN.type = "number";
        oN.step = o.buoc;
        oN.min = "0";
        oN.value = soVaoO(o.khoa, gt);
      }
      oN.dataset.o = o.khoa;
      oN.disabled = !duoc;
      /* Viền xanh = con số này là RIÊNG của kỳ đang xem, không phải mặc định.
         Không có dấu này thì người sửa không biết mình vừa đổi cho MỘT tháng
         hay cho MỌI tháng — chỗ bộ "mặc định + ghi đè" dễ hiểu nhầm nhất. */
      if (hanh && hanh.tu && hanh.tu[o.khoa] === "ky") oN.classList.add("rieng");
      oN.title = o.gt + (duoc ? "" : "\n\nChỉ Quản trị đặt được.")
        + (hanh && hanh.tu && hanh.tu[o.khoa] === "ky"
          ? "\n\nĐang là con số RIÊNG của tháng này." : "");
      nhan.appendChild(oN);
      if (o.dv) nhan.appendChild(el("span", "ghiChuKpi", o.dv));
      dai.appendChild(nhan);
    }

    /* Phần trăm đạt — con số Engine tính, màn hình chỉ đọc. Đây là "KPI tính
       theo doanh số quy đổi" (chủ dự án chốt điểm 3) hiện thành chữ. */
    const cua = tkpi && tkpi.line ? tkpi.line[trangThai.line] : null;
    if (cua && cua.dat_pt !== null && cua.dat_pt !== undefined) {
      /* Con số "quy đổi NNN" bị BỎ khỏi dòng này (chủ dự án chốt 13/09/2026):
         hàng TỔNG mới thêm dưới tiêu đề bảng đã hiện đúng con số ấy ở cột
         Quy đổi, và băng mỗi ngày cũng đã có "QĐ …" riêng — một con số in
         hai lần ở hai chỗ khác nhau chỉ tổ nghi ngờ hai chỗ có khớp nhau
         không. Dải KPI chỉ còn giữ đúng việc của nó: phần trăm ĐẠT. */
      const nhan = el("span", "datKpi", "Đạt " + so1(cua.dat_pt) + "%");
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

  /* ================= Dải đẩy sang Google Sheet (13/09/2026) =================
   *
   * Chủ dự án chốt: mỗi tháng tạo một Sheet mới cho từng nhân viên, dán link
   * vào đây một lần, rồi 17h30 hằng ngày app tự ghi sang.
   *
   * LUẬT SỐ 1: ô này chỉ NHẬN một chuỗi và GỬI nó đi. Không một ô nào của
   * bảng được dựng ở đây — Engine dựng toàn bộ ma trận
   * (`engine/src/day-sheet.mjs`), kể cả phép chia 1.000 và luật "chỉ dòng
   * đầu của đơn mang ngày/số BH/khách". Trình duyệt còn không biết Sheet có
   * bao nhiêu cột.
   *
   * Kiểm hình thức link thì ĐƯỢC làm ở đây (CLAUDE.md cho phép "kiểm tra
   * hình thức trước khi gửi") — nhưng Gateway vẫn kiểm lại, và Gateway mới
   * là chỗ quyết định. Bản ở đây chỉ để người dán biết ngay mình thiếu #gid
   * mà không phải đợi một vòng mạng. */

  /** Ngày giờ ngắn cho dấu "đã đẩy lúc" — định dạng, không phải nghiệp vụ. */
  function lucNgan(ms) {
    const d = new Date(Number(ms));
    if (!Number.isFinite(d.getTime())) return null;
    const hai = (n) => String(n).padStart(2, "0");
    return hai(d.getDate()) + "/" + hai(d.getMonth() + 1) + " "
      + hai(d.getHours()) + ":" + hai(d.getMinutes());
  }

  function veDaiSheet(khung, kq) {
    if (trangThai.line === null) return;
    /* Chỉ Quản trị thấy dải này. Quản lí ĐỌC được link (rules mở cho cả hai
       vai) nhưng không đổi và không đẩy được, nên hiện ra một dải chỉ để
       khoá lại là thêm nhiễu cho người không có việc gì ở đó — khác hẳn dải
       KPI, nơi con số hiển thị mới là thứ đáng đọc. */
    if (!laQuanTri()) return;

    const cai = kq.sheet || null;
    const dai = el("div", "daiSheet");

    const nhan = el("label");
    nhan.appendChild(el("span", "nhanSheet", "Sheet tháng này"));
    const oL = el("input", "oSheet");
    oL.type = "url";
    oL.placeholder = "Dán link Google Sheet của " + trangThai.line
      + " tháng " + trangThai.ky + " (link phải có #gid)";
    oL.value = (cai && cai.link) || "";
    oL.title = "Mở ĐÚNG tab cần ghi rồi copy link trên thanh địa chỉ.\n"
      + "App ghi từ dòng 3 xuống, cột A–J và O–S.\n"
      + "Dòng 1 (công thức của bạn), dòng 2 (tiêu đề) và cột K–N không bị chạm tới.\n\n"
      + "Xoá trắng ô này là bỏ setup của tháng — tháng này sẽ không đẩy đi đâu nữa.";
    nhan.appendChild(oL);
    dai.appendChild(nhan);

    const nut = el("button", "nutNhoKpi", "Đẩy sang Sheet");
    nut.type = "button";
    nut.disabled = !(cai && cai.link);
    nut.title = cai && cai.link
      ? "Ghi ngay bộ số đang xem sang Sheet. Lượt tự động vẫn chạy 17h30 mỗi ngày."
      : "Dán link ở ô bên trái trước đã.";
    nut.addEventListener("click", () => dayNgay(dai, nut));
    dai.appendChild(nut);

    /* Dấu vết lượt đẩy gần nhất — hai trạng thái tách bạch, không gộp làm
       một: đẩy hỏng thì phải thấy CÂU LỖI, không phải thấy một dấu "đã đẩy"
       cũ mèm rồi tưởng mọi thứ vẫn chạy. */
    if (cai && cai.day_loi) {
      dai.appendChild(el("span", "sheetLoi", "Lượt đẩy gần nhất hỏng: " + cai.day_loi));
    } else if (cai && cai.day_luc) {
      const l = lucNgan(cai.day_luc);
      if (l) dai.appendChild(el("span", "ghiChuKpi", "Đã đẩy lúc " + l));
    } else if (cai && cai.link) {
      dai.appendChild(el("span", "ghiChuKpi", "Chưa đẩy lần nào"));
    }

    dai.addEventListener("change", (e) => {
      if (e.target === oL) guiSheetLink(dai, oL);
    });
    /* Enter = lưu ngay, cùng nhịp dải KPI: `change` chỉ bắn khi rời ô, mà
       người dán link xong thường bấm Enter rồi ngồi nhìn. */
    dai.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target === oL) { e.preventDefault(); oL.blur(); }
    });

    khung.appendChild(dai);
  }

  /** Lưu (hoặc rút) link Sheet của (kỳ, line) đang xem. */
  async function guiSheetLink(dai, oL) {
    const link = oL.value.trim();
    /* Kiểm hình thức TRƯỚC khi đi mạng — nhưng chỉ đúng hai điều kiện hiển
       nhiên, và Gateway vẫn kiểm lại đủ. Đây là phép lịch sự với người đang
       gõ, không phải một cửa chặn. */
    if (link && !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(link)) {
      $("loiDonHang").textContent = "Link phải là một bảng tính Google.";
      return;
    }
    if (link && !/[#?&]gid=\d+/.test(link)) {
      $("loiDonHang").textContent = "Link thiếu #gid — mở đúng tab cần ghi rồi "
        + "copy lại link trên thanh địa chỉ.";
      return;
    }

    dai.classList.add("dangGui");
    try {
      await goiGhi("/api/sheet-link", {
        line: trangThai.line, ky: trangThai.ky, link: link === "" ? null : link,
      });
    } catch (e) {
      dai.classList.remove("dangGui");
      $("loiDonHang").textContent = "Không lưu được link Sheet: " + e.message;
      return;
    }
    dai.classList.remove("dangGui");
    $("loiDonHang").textContent = "";
    /* Vẽ lại để nút "Đẩy sang Sheet" mở/khoá theo đúng trạng thái vừa lưu —
       dải này chỉ có MỘT ô nên không vướng bài học "vẽ lại muộn" của dải
       KPI (ở đó tiêu điểm còn nhảy sang ô kế tiếp). */
    taiKy({ imLang: true });
  }

  /** Đẩy ngay (kỳ, line) đang xem sang Sheet. */
  async function dayNgay(dai, nut) {
    nut.disabled = true;
    const truoc = nut.textContent;
    nut.textContent = "Đang đẩy…";
    $("loiDonHang").textContent = "";
    try {
      const kq = await goiGhi("/api/day-sheet", {
        line: trangThai.line, ky: trangThai.ky,
      });
      nut.textContent = kq.bo_qua
        ? "Chưa khai link"
        : "Xong — " + soNguyen(kq.so_dong) + " dòng sang \"" + kq.ten_tab + "\"";
    } catch (e) {
      nut.textContent = truoc;
      nut.disabled = false;
      /* Câu lỗi của Google đi thẳng ra đây (Gateway đã dịch sang việc phải
         làm) — đó là thứ duy nhất giúp sửa được "chưa chia sẻ file". */
      $("loiDonHang").textContent = "Đẩy sang Sheet hỏng: " + e.message;
      return;
    }
    /* Vẽ lại sau một nhịp để người bấm kịp đọc câu "Xong — N dòng". */
    setTimeout(() => { if (dai.isConnected) taiKy({ imLang: true }); }, 2500);
  }

  /** Gửi một con số của dải setup.
   *
   *  Ô trống = RÚT LẠI con số (`null`), không phải "gõ số 0". Hai thứ khác
   *  nhau, và Gateway đọc theo kiểu đúng như vậy: `null` rút lại, vắng mặt là
   *  không nhắc tới. */
  async function guiKpi(dai, o) {
    /* Bỏ dấu phân cách trước khi đọc số — CHỈ ở ô thật sự có nó.
       Ô KPI hiện `1.500.000`, mà `Number("1.500.000")` ra `NaN`, và một `NaN`
       đi vào đường ghi KPI là hỏng mọi con số quy đổi của line.
       Nhưng bỏ chấm ở MỌI ô thì tệ hơn hẳn: hai ô hệ số là `type="number"`,
       và `.value` của chúng luôn dùng DẤU CHẤM làm dấu thập phân (`"7.5"`)
       bất kể trình duyệt hiện ra `7,5`. Bỏ chấm ở đó là hệ số 7,5% lặng lẽ
       thành 75% — sai gấp mười trên mọi con số quy đổi của line. */
    const tho = o.dataset.phanCach
      ? o.value.trim().replace(/\./g, "")
      : o.value.trim();
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

  /** Gửi ngày công của MỘT line trong kỳ đang xem.
   *
   *  Ô trống = XOÁ hẳn con số (`null`), về lại "chưa nhập" — KHÔNG phải gõ số
   *  0 ("tháng này không đi làm ngày nào"). Hai câu khác nhau và cột Lương
   *  cứng hiện hai thứ khác nhau ("—" so với "0"), nên Gateway đọc theo KIỂU
   *  đúng như vậy. Cùng quy ước `guiKpi` ở trên.
   *
   *  Ghi ngay, VẼ LẠI MUỘN — cờ trên `dataset` của bảng, lượt rời bảng mới
   *  dựng lại. Xem `focusout` ở `veTongHop()` cho lý do đầy đủ. */
  async function guiCong(b, o) {
    const tho = o.value.trim();
    b.classList.add("dangGui");
    try {
      await goiGhi("/api/dat-cong", {
        line: o.dataset.line,
        ky: trangThai.ky,
        ngay_cong: tho === "" ? null : Number(tho),
      });
    } catch (e) {
      b.classList.remove("dangGui");
      $("loiDonHang").textContent = "Không lưu được ngày công: " + e.message;
      return;
    }
    b.classList.remove("dangGui");
    /* Đổi ngày công là đổi lương cứng, phụ cấp, tổng lương của line ấy CỘNG
       cả ba con số của hàng TỔNG — sáu con số do Engine tính, nên phải tải
       lại chứ không tự nhân ở trình duyệt (LUẬT SỐ 1). */
    b.dataset.canVeLai = "1";
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
      if (laQuanTri()) {
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

    /* 15 cột, đúng thứ tự chủ dự án chốt 12/09/2026 (P6). Khai thành MỘT
       danh sách chứ không rải ra từng `el("th")`: thứ tự cột là thứ được
       `kiem/tong-hop.js` canh, và một danh sách đọc được bằng mắt thì lượt
       sửa sau khó chèn nhầm chỗ hơn.

       `lop` đi kèm để cột "Doanh số quy đổi" được tô — chủ dự án yêu cầu
       highlight đúng cột đó. `gt` là phần giải thích, nằm ở `title` của ô
       tiêu đề thay vì một đoạn chú giải dưới bảng (cùng lối đã chọn ở P4 khi
       bỏ dải chú giải màu). */
    const COT_TONG_HOP = [
      { ten: "Line", lop: "oLine" },
      { ten: "Số đơn" },
      { ten: "Số sản phẩm",
        gt: "Tổng SỐ LƯỢNG bán ra, không phải số dòng hàng. Dòng chiết khấu "
          + "và dòng phụ phí (vận chuyển, lắp đặt, Chênh VAT) không được đếm "
          + "— chúng không phải mặt hàng." },
      { ten: "Doanh số thuần",
        gt: "Nghìn đồng. Doanh số bán trừ chiết khấu. Đây cũng là cột dùng để sắp thứ tự "
          + "các line trong bảng này." },
      { ten: "Lợi nhuận",
        gt: "Nghìn đồng. Cộng lợi nhuận của mọi dòng đã biết giá vốn, kể cả dòng âm "
          + "(trả lại, quà tặng, chiết khấu)." },
      { ten: "Quy đổi", lop: "oQuyDoi",
        gt: "Nghìn đồng. Lợi nhuận từng dòng ÷ hệ số quy đổi của line. Đặt hệ số ở dải "
          + "setup trên tab của chính line đó." },
      { ten: "Tỉ suất LN",
        gt: "Lợi nhuận chia cho Doanh số thuần của chính line đó, trong tháng "
          + "đang xem. Đối chiếu tay được: lấy đúng hai cột ngay bên trái chia "
          + "cho nhau. Âm nghĩa là tháng ấy lỗ — không phải lỗi." },
      { ten: "Tỉ lệ tồn kho",
        gt: "Doanh số thuần của những dòng có Nơi nhập = “Kho”, chia cho doanh "
          + "số thuần của line. Đối chiếu tay được: lọc cột Nơi nhập trong tab "
          + "của line rồi cộng cột Tổng bán." },
      { ten: "KPI", gt: "Nghìn đồng." },
      { ten: "Đạt", gt: "Doanh số quy đổi ÷ KPI." },
      /* Hai cột so sánh mang HAI ô mỗi hàng — trái là so cả tháng, phải là
         so tới hôm nay (chủ dự án chốt 17/09/2026: "chia thành 2 cột rõ ràng
         tránh lệch lề"). `span: 2` cho tiêu đề trải ngang hai cột con; hai
         cột con KHÔNG có tên riêng, đúng chốt của anh.

         Bản trước nhét hai con số vào MỘT ô ngăn bằng "/" — chúng lệch lề
         nhau vì độ dài số khác nhau, và một cột số mà mỗi hàng bắt đầu ở một
         chỗ thì mắt không lướt dọc được. */
      { ten: "Vs. Tháng trước", span: 2,
        gt: "Doanh số thuần tháng này so với CHÍNH line đó tháng liền trước, "
          + "tính bằng phần trăm chênh. Ô trái: so cả tháng. Ô phải: so cùng "
          + "số ngày, tính tới hôm nay." },
      { ten: "Vs. Năm trước", span: 2,
        gt: "Doanh số thuần tháng này so với CÙNG THÁNG năm trước của chính "
          + "line đó. Đây là cột nhìn qua được mùa vụ — tháng 2 luôn thấp hơn "
          + "tháng 1 vì Tết, nên so với tháng liền trước thì năm nào cũng ra "
          + "một con số âm không nói lên điều gì. Ô trái: cả tháng. Ô phải: "
          + "tới hôm nay." },
      { ten: "Thưởng", lop: "oPhu",
        gt: "Nghìn đồng. Doanh số quy đổi × hệ số thưởng của bậc đang đạt, cộng thưởng "
          + "nóng nếu chạm mốc. Bậc lấy theo HỆ SỐ QUY ĐỔI của line: 7,5% là "
          + "cách A, 5,5% là cách B. Cột Ghi chú nói rõ line này ăn hệ số nào." },
      { ten: "Ngày công", lop: "oPhu",
        gt: "Quản trị gõ tay theo thực tế, riêng từng tháng. Bỏ trống là CHƯA "
          + "NHẬP — khác với gõ số 0." },
      { ten: "Lương cứng", lop: "oPhu",
        gt: "Nghìn đồng. 4.500 cho 26 ngày công, chia đều theo ngày cả khi thiếu lẫn khi "
          + "vượt." },
      { ten: "Phụ cấp", lop: "oPhu",
        gt: "Nghìn đồng. 30 một ngày công, TRẦN ở 26 ngày — làm thêm ngày thì được thêm "
          + "lương cứng, không được thêm phụ cấp." },
      { ten: "Tổng lương", lop: "oPhu",
        gt: "Nghìn đồng. Thưởng + Lương cứng + Phụ cấp." },
      { ten: "Ghi chú", lop: "oPhu",
        gt: "Hệ số thưởng line này thực sự được tính, và phần thưởng nóng đã "
          + "nằm trong cột Thưởng (nếu có)." },
    ];

    const b = el("table", "bangNho bangTongHop");
    const tr = el("tr");
    for (const c of COT_TONG_HOP) {
      const th = el("th", c.lop || null, c.ten);
      if (c.span) th.colSpan = c.span;
      if (c.gt) th.title = c.gt;
      if (c.cho) { th.classList.add("oCho"); th.title = CHO_CONG_THUC; }
      tr.appendChild(th);
    }
    b.appendChild(tr);

    const luong = (tkpi && tkpi.luong) || null;
    const luongCua = (luong && luong.line) || {};
    /* Chỉ Quản trị gõ được ngày công — cùng mức với KPI, vì nó là vế nhân của
       lương cứng và phụ cấp. Quản lí vẫn đọc được con số. */
    const duocNhap = laQuanTri();

    /* Thứ tự line: DOANH SỐ THUẦN GIẢM DẦN, do Engine sắp
       (`tom_tat_kpi.thu_tu`) — không sắp ở đây, vì "sắp theo cái gì" là một
       luật đọc số (LUẬT SỐ 1). Lùi về `tom_tat_line.thu_tu` khi bản Engine
       đang chạy chưa có trường đó: giữa hai lượt deploy song song (bẫy số 4)
       bảng vẫn đủ line, chỉ là chưa sắp lại. */
    const thuTu = (tkpi && Array.isArray(tkpi.thu_tu) && tkpi.thu_tu.length)
      ? tkpi.thu_tu : kq.tom_tat_line.thu_tu;
    /* Bảng RIÊNG cho cột "Vs. Tháng trước", vì nó phủ cả line tháng này
       không có đơn nào — mà đúng những line ấy mới là chỗ con số −100% đáng
       nhìn nhất (xem `vsThangTruocTheoLine` bên Engine). */
    const vsCua = (tkpi && tkpi.vs_line) || {};
    /* Cùng lý do bảng riêng như `vs_line`: nó phủ cả line tháng này không có
       đơn nào. Để `{}` khi bản Engine đang chạy chưa có trường ấy — giữa hai
       lượt deploy song song (bẫy số 4) cột chỉ trống, không nổ. */
    const vsNamCua = (tkpi && tkpi.vs_line_nam) || {};
    /* Phần trăm thời gian đã trôi của tháng — MỘT con số cho cả bảng, Engine
       tính (`tien_do_pt`). `null` ở tháng đã đóng sổ, và cột Đạt hiểu đúng
       `null` là "không xét tiến độ". */
    const tienDo = tkpi ? tkpi.tien_do_pt : null;

    for (const ten of thuTu) {
      /* Line KHÔNG có đơn nào và KHÔNG có dòng nào thì giấu — cùng luật và
         cùng công tắc ("Hiện thêm N line chưa có đơn") với hàng tab ngay
         trên bảng. Chủ dự án chốt 12/09/2026: ba line đang 0 đồng chỉ chiếm
         chỗ, và giấu chúng ở hàng tab mà vẫn để trong bảng là hai màn hình
         nói hai chuyện. Không chôn tên line nào: vắng mặt trong
         `tom_tat_kpi.line` ĐÃ LÀ "không có đơn nào" — bản kê ấy chỉ gom line
         thực sự có đơn. Đọc từ đó chứ không từ `tom_tat_line` để cả bảng
         vẫn chỉ có MỘT nguồn số. */
      if (!trangThai.hienLine0 && !cua[ten]) continue;
      /* MỌI con số của hàng này đọc từ `tom_tat_kpi.line` — nguồn DUY NHẤT
         của tab [Tổng hợp]. Bản trước P6 lấy doanh số/số đơn từ
         `tom_tat_line`, thứ cộng thẳng `bc/dong` THÔ: một dòng đã xoá tay vẫn
         nằm trong đó, nên cột Doanh số ở đây kể nhiều tiền hơn chính tab của
         line ấy, và không có cách nào nhìn ra. `tom_tat_kpi` cộng sau khi đã
         áp BTL và sửa tay, nên hai màn hình về lại một con số. */
      const k = cua[ten] || null;
      const r = el("tr");
      r.appendChild(el("td", null, ten));
      /* Line không có đơn nào trong kỳ: số đơn/số sản phẩm/doanh số là 0 —
         một sự thật, không phải "chưa biết" — còn các cột suy ra từ chúng để
         "—". */
      r.appendChild(el("td", "oSo", soNguyen(k ? k.so_don : 0)));
      r.appendChild(el("td", "oSo", soNguyen(k ? k.so_san_pham : 0)));
      r.appendChild(el("td", "oSo", nghinTron(k ? k.doanh_so : 0)));

      const oLn = el("td", "oSo", k ? nghinTron(k.loi_nhuan) : "—");
      if (k && k.don_thieu_loi_nhuan) {
        /* Con số đang THIẾU phần của mấy đơn chưa đủ giá vốn — dán nhãn
           thiếu, không để nó đọc như một con số đủ. */
        oLn.textContent += " *";
        oLn.title = "Còn " + soNguyen(k.don_thieu_loi_nhuan)
          + " đơn chưa đủ giá vốn nên chưa vào con số này.";
      }
      r.appendChild(oLn);

      const oQd = el("td", "oSo oQuyDoi", k ? nghinTron(k.doanh_so_quy_doi) : "—");
      if (k && k.don_thieu_quy_doi) {
        oQd.textContent += " *";
        oQd.title = "Còn " + soNguyen(k.don_thieu_quy_doi)
          + " đơn chưa đủ giá vốn nên chưa vào con số này.";
      }
      r.appendChild(oQd);

      r.appendChild(oTySuat(k));
      r.appendChild(oTonKho(k));

      r.appendChild(el("td", "oSo", k && k.kpi !== null && k.kpi !== undefined
        ? nghinTron(k.kpi) : "—"));
      r.appendChild(oDat(k, tienDo));
      oVsThangTruoc(r, vsCua[ten] || null);
      oVsNamTruoc(r, vsNamCua[ten] || null);
      oLuong(r, luongCua[ten] || null, ten, k, duocNhap);
      b.appendChild(r);
    }

    /* Hàng TỔNG do Engine cộng (`tom_tat_kpi.tong`), không phải màn hình cộng
       lại — ngay cả một phép cộng cũng là một phép tính, và hai chỗ cộng là
       hai chỗ có thể lệch nhau mà không ai biết bên nào đúng. */
    const t = tkpi ? tkpi.tong : null;
    if (t) {
      const r = el("tr", "hangTongDon");
      r.appendChild(el("th", null, "TỔNG"));
      r.appendChild(el("td", "oSo", soNguyen(t.so_don)));
      r.appendChild(el("td", "oSo", soNguyen(t.so_san_pham)));
      r.appendChild(el("td", "oSo", nghinTron(t.doanh_so)));
      r.appendChild(el("td", "oSo", nghinTron(t.loi_nhuan)));
      r.appendChild(el("td", "oSo oQuyDoi", nghinTron(t.doanh_so_quy_doi)));
      r.appendChild(oTySuat(t));
      r.appendChild(oTonKho(t));
      r.appendChild(el("td", "oSo", t.kpi !== null && t.kpi !== undefined
        ? nghinTron(t.kpi) : "—"));
      const tdDat = oDat(t, tienDo);
      /* Tổng KPI chỉ cộng line CÓ MẶT trong kỳ — so tổng quy đổi của 3 line
         với KPI của cả 10 line là một tỉ lệ vô nghĩa. Nói ra ở `title` để
         người đối chiếu tay không phải tự đoán. */
      tdDat.title = "Tổng KPI chỉ cộng những line có đơn trong tháng này, "
        + "không cộng cả 10 line.";
      r.appendChild(tdDat);
      oVsThangTruoc(r, t);
      oVsNamTruoc(r, t);

      /* Hàng TỔNG cộng ba cột TIỀN, bỏ trống Ngày công và Ghi chú: cộng ngày
         công của nhiều line ra một con số không có nghĩa nào (26 + 26 + 24 =
         76 "ngày" của ai?), và một dòng ghi chú gộp mười line cũng vậy. */
      const tl = (luong && luong.tong) || null;
      r.appendChild(el("td", "oSo oPhu", tl ? nghinTron(tl.thuong) : "—"));
      r.appendChild(el("td", "oSo oPhu", ""));
      r.appendChild(el("td", "oSo oPhu", tl ? nghinTron(tl.luong_cung) : "—"));
      r.appendChild(el("td", "oSo oPhu", tl ? nghinTron(tl.phu_cap) : "—"));
      r.appendChild(el("td", "oSo oPhu", tl ? nghinTron(tl.tong_luong) : "—"));
      r.appendChild(el("td", "oPhu", ""));
      b.appendChild(r);
    }

    const boc = el("div", "bocBangNho");
    boc.appendChild(b);
    ve.appendChild(boc);
    /* KHÔNG còn đoạn giải thích dưới bảng (chủ dự án chốt 12/09/2026). Mọi
       câu giải thích nay nằm ở `title` của đúng ô mang ý nghĩa ấy — cùng lối
       đã chọn ở P4 khi bỏ dải chú giải màu, và cùng lý do: một đoạn văn dưới
       bảng thì không ai đọc, còn tooltip thì hiện ra đúng lúc người ta đang
       hỏi về đúng ô đó. Đơn vị "nghìn đồng" vì vậy đứng đầu `title` của mỗi
       cột tiền — nó không còn chỗ nào khác để nói. */

    /* Ô ngày công lưu NGAY khi rời ô, nhưng bảng chỉ dựng lại khi tiêu điểm
       rời hẳn KHỎI BẢNG — đúng bài học đã trả giá ở dải setup KPI (P5): cả
       cột ngày công là MỘT đơn vị sửa (gõ xong line này thì Tab xuống line
       kế), nên vẽ lại ngay sau mỗi ô sẽ xoá mất ô người dùng vừa nhảy vào và
       ăn mất mấy ký tự họ đang gõ. */
    b.addEventListener("change", (e) => {
      const o = e.target.closest("input[data-line]");
      if (o && b.contains(o)) guiCong(b, o);
    });
    /* Enter trong ô số KHÔNG tự nhả tiêu điểm, nên `change` bắn mà `focusout`
       thì không — người dùng thấy số đã lưu mà bảng vẫn là số cũ. Nhả bằng
       tay để chuỗi "ghi xong thì vẽ lại" chạy đúng nhịp. */
    b.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const o = e.target.closest("input[data-line]");
      if (!o || !b.contains(o)) return;
      e.preventDefault();
      o.blur();
    });
    b.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!b.isConnected || b.contains(document.activeElement)) return;
        if (!b.dataset.canVeLai) return;
        delete b.dataset.canVeLai;
        taiKy({ imLang: true });
      }, 0);
    });
  }

  /** Ô "Đạt" — kèm highlight ba mức khi vượt KPI.
   *
   *  Chủ dự án chốt 12/09/2026: "đạt 100% highlight xanh, 110% và 120% cũng
   *  highlight nhưng màu khác". Tô ở ĐÂY chứ không tô cả hàng: cột "Doanh số
   *  quy đổi" đã có nền tô riêng, tô cả hàng sẽ đè lên nó và xoá mất tín hiệu
   *  cũ. Ba mốc cũng đúng ba mốc đổi bậc thưởng, nên màu ở đây đọc được thành
   *  "line này vừa lên một bậc thưởng". */
  function oDat(k, tienDo) {
    if (!k || k.dat_pt === null || k.dat_pt === undefined) {
      /* "Chưa đặt KPI" và "đạt 0%" là hai câu khác nhau. */
      return el("td", "oSo", "—");
    }
    const d = k.dat_pt;
    /* Ba mức cũ giữ nguyên. THÊM một mức thứ tư, XANH NHẠT HƠN HẲN, cho
       line chưa đạt 100% nhưng đang theo kịp thời gian đã trôi của tháng
       (chủ dự án chốt 17/09/2026: "ngày 15 là đã 50% thời gian của tháng
       rồi, nếu KPI đạt 50% thì tức là kịp tiến độ").

       Nhạt hơn hẳn là CÓ CHỦ Ý: "đang ổn giữa chừng" và "đã vượt KPI" là hai
       tin khác nhau, và cùng một sắc xanh thì nhìn lướt hoá thành một.

       `tienDo` là `null` khi kỳ đang xem không chứa hôm nay — tháng đã đóng
       sổ thì "kịp tiến độ" chính là "đạt 100%", thứ mức `dat100` đã nói. */
    const kip = tienDo !== null && tienDo !== undefined && d < 100 && d >= tienDo;
    const lop = d >= 120 ? "dat120" : d >= 110 ? "dat110" : d >= 100 ? "dat100"
      : kip ? "datTienDo" : "";
    const td = el("td", "oSo " + lop, so1(d) + "%");
    if (kip) {
      td.title = "Kịp tiến độ: tháng đã trôi " + so1(tienDo)
        + "% thời gian, quy đổi đã đạt " + so1(d) + "% KPI.";
    }
    return td;
  }

  /** Sáu ô cuối: Thưởng · Ngày công · Lương cứng · Phụ cấp · Tổng lương · Ghi chú.
   *
   *  Dựng một chỗ để hàng nào cũng đúng số ô — lệch một ô là mọi con số từ đó
   *  trở đi đọc sang sai tên cột. */
  function oLuong(r, lg, ten, k, duocNhap) {
    const co = !!(lg && lg.cach);

    const oThuong = el("td", "oSo oPhu", co ? nghinTron(lg.thuong) : "—");
    if (co && lg.thuong === null) {
      oThuong.title = "Tháng này chưa có doanh số quy đổi (kỳ trước 09/2026 "
        + "không có giá vốn) nên chưa tính được thưởng — khác với không được "
        + "thưởng đồng nào.";
    } else if (co && k && k.don_thieu_quy_doi) {
      /* Thưởng chia trên doanh số quy đổi, nên nó thừa hưởng đúng cảnh báo
         của cột ấy: còn đơn thiếu giá vốn thì con số này là SÀN. */
      oThuong.textContent += " *";
      oThuong.title = "Còn " + soNguyen(k.don_thieu_quy_doi)
        + " đơn chưa đủ giá vốn nên chưa vào doanh số quy đổi, tức chưa vào "
        + "con số thưởng này.";
    }
    r.appendChild(oThuong);

    r.appendChild(oNgayCong(lg, ten, co, duocNhap));

    for (const t of ["luong_cung", "phu_cap", "tong_luong"]) {
      const td = el("td", "oSo oPhu", co ? nghinTron(lg[t]) : "—");
      if (co && lg[t] === null && lg.ngay_cong === null) {
        td.title = "Chưa nhập ngày công cho line này ở tháng đang xem.";
      }
      r.appendChild(td);
    }

    r.appendChild(oGhiChuLuong(lg, co));
  }

  /** Ô Ngày công — ô NHẬP cho Quản trị, chữ thường cho Quản lí. */
  function oNgayCong(lg, ten, co, duocNhap) {
    if (!co) {
      const td = el("td", "oSo oPhu", "—");
      td.title = "Line này chưa tính lương nên không cần ngày công.";
      return td;
    }
    const td = el("td", "oSo oCong oPhu");
    if (!duocNhap) {
      td.textContent = lg.ngay_cong === null ? "—" : so1(lg.ngay_cong);
      td.title = "Chỉ Quản trị nhập được ngày công.";
      return td;
    }
    const o = el("input", "oNgayCong");
    o.type = "number";
    o.step = "0.5";
    o.min = "0";
    o.max = "31";
    o.dataset.line = ten;
    o.value = lg.ngay_cong === null ? "" : String(lg.ngay_cong);
    o.title = "Gõ số ngày công thực tế của tháng đang xem. Xoá trắng ô là bỏ "
      + "hẳn con số (về “chưa nhập”), khác với gõ số 0.";
    td.appendChild(o);
    return td;
  }

  /** Cột Ghi chú — hệ số thực được tính, và thưởng nóng đã nằm trong cột
   *  Thưởng nếu có.
   *
   *  Chủ dự án chốt: "ghi rõ hệ số nhân viên được tính thực tế, và số tiền
   *  thưởng đã bao gồm thưởng theo mốc 1 tỉ 5 / 2 tỉ (nếu đạt — còn không đạt
   *  thì không ghi gì)". Engine trả về từng mảnh rời (`cach`,
   *  `he_so_thuong_pt`, `moc_nong`, `nguong_nong`, `thuong_nong`); ghép chúng
   *  thành câu là việc của màn hình, không phải phép tính. */
  function oGhiChuLuong(lg, co) {
    if (!co) {
      const td = el("td", "oGhiChuLuong oPhu", "—");
      td.title = "Hệ số quy đổi của line này không phải 7,5% (cách A) hay 5,5% "
        + "(cách B) nên tạm chưa tính lương. Đổi hệ số trên dải setup của tab "
        + "line là nó vào cách tương ứng ngay.";
      return td;
    }
    if (lg.he_so_thuong_pt === null) {
      return el("td", "oGhiChuLuong oPhu", "chưa tính được thưởng");
    }
    /* Chỉ còn TỈ SUẤT, bỏ chữ "Cách A/Cách B" (chủ dự án chốt 12/09/2026).
       Tên bậc không thêm gì cho người đọc mà chính hệ số đã nói — 0,45% chỉ
       có ở cách B, 0,25% chỉ có ở cách A. */
    let chu = so2(lg.he_so_thuong_pt) + "%";
    if (lg.moc_nong) {
      chu += " · đã gồm " + nghinTron(lg.thuong_nong)
        + " thưởng mốc " + tyDong(lg.nguong_nong);
    }
    const td = el("td", "oGhiChuLuong oPhu", chu);
    td.title = "Hệ số thưởng đang áp cho line này"
      + (lg.moc_nong
        ? ", và khoản thưởng nóng đã CỘNG SẴN vào cột Thưởng (không phải một "
          + "khoản tính riêng)."
        : ". Chưa chạm mốc thưởng nóng nào.");
    return td;
  }

  /** Ô "Tỉ lệ tồn kho". Ba trạng thái, ba câu khác nhau — `null` KHÔNG được
   *  hiện thành 0%: "chưa biết dòng nào xuất từ kho" và "không đồng nào từ
   *  kho" là hai kết luận nghiệp vụ trái ngược nhau. */
  function oTonKho(k) {
    if (!k || k.ty_le_ton_kho_pt === null || k.ty_le_ton_kho_pt === undefined) {
      const td = el("td", "oSo", "—");
      if (k) {
        td.title = "Chưa dòng nào của line này biết Nơi nhập — kỳ trước tháng "
          + "09/2026 không có dữ liệu giá vốn của Tracking, nên cũng không "
          + "biết hàng xuất từ đâu.";
      }
      return td;
    }
    const td = el("td", "oSo", so1(k.ty_le_ton_kho_pt) + "%");
    if (k.doanh_so_chua_ro_nguon) {
      /* Còn hàng chưa biết nguồn thì tỉ lệ này là SÀN, không phải con số
         cuối — nói thẳng ra, thay vì để nó đọc như đã đủ. */
      td.textContent += " *";
      td.title = "Còn " + nghinTron(k.doanh_so_chua_ro_nguon)
        + " nghìn đ hàng chưa biết Nơi nhập (chưa gán mã, hoặc chưa có giá "
        + "vốn), nên tỉ lệ thật có thể cao hơn con số này.";
    }
    return td;
  }

  /** Ô "Tỉ suất LN" — lợi nhuận ÷ doanh số thuần (chủ dự án chốt 15/09/2026).
   *
   *  Con số do ENGINE chia, màn hình chỉ đọc (LUẬT SỐ 1): một phép chia trên
   *  hai cột tiền vẫn là một công thức tính tiền, và làm nó ở đây là mở đúng
   *  cái cửa CLAUDE.md đóng. */
  function oTySuat(k) {
    const v = k ? k.ty_suat_loi_nhuan_pt : undefined;
    if (v === null || v === undefined) {
      const td = el("td", "oSo", "—");
      /* Chưa bán gì thì không có gì để chia — khác hẳn "bán mà không lãi
         đồng nào", thứ hiện ra đúng 0,0%. */
      if (k) td.title = "Line này chưa có doanh số trong tháng, nên không có gì để chia.";
      return td;
    }
    const td = el("td", "oSo" + (k && k.ty_suat_duoi_he_so ? " tySuatThap" : ""),
      so1(v) + "%");
    if (k && k.ty_suat_duoi_he_so) {
      /* Cờ do ENGINE đặt, màn hình không tự so hai số (LUẬT SỐ 1) — xem
         `duoiHeSo()` bên `kpi.mjs`. */
      td.title = "Thấp hơn hệ số quy đổi của line (" + so1(k.he_so_pt)
        + "%) — tức bán dưới tỉ suất mục tiêu.";
    }
    if (k && k.don_thieu_loi_nhuan) {
      /* Tử số đang thiếu phần của mấy đơn chưa đủ giá vốn, nên tỉ suất là
         con số SÀN — cùng quy ước dấu "*" của cột Lợi nhuận ngay bên trái. */
      td.textContent += " *";
      td.title = "Còn " + soNguyen(k.don_thieu_loi_nhuan)
        + " đơn chưa đủ giá vốn nên chưa vào lợi nhuận, tỉ suất thật có thể cao hơn.";
    }
    return td;
  }

  /** Ô so sánh với một MỐC thời gian. Ba lý do trống, ba câu khác nhau.
   *
   *  Một hàm cho cả "Vs. Tháng trước" lẫn "So với năm trước": hai cột khác
   *  nhau đúng ở cái mốc đem ra so, còn ba trạng thái (chưa có số / mốc bằng
   *  0 / có số) thì giống hệt. Hai bản sao là hai chỗ để ba trạng thái ấy
   *  trôi khỏi nhau, và chỗ trôi sẽ là một cột nói "—" còn cột kia nói "mới"
   *  cho cùng một line. */
  /** HAI ô cho một cột so sánh: trái là so cả tháng, phải là so tới hôm nay.
   *
   *  Hai `<td>` THẬT chứ không hai `<span>` trong một ô (chủ dự án chốt
   *  17/09/2026). Hai span thì độ dài số khác nhau đẩy nhau lệch lề, và một
   *  cột số mà mỗi hàng bắt đầu ở một chỗ thì mắt không lướt dọc được. Hai ô
   *  thật thì trình duyệt canh cột, không phải mình canh.
   *
   *  Ô phải để TRỐNG khi Engine không gắn vế MTD (kỳ đã đóng sổ) — trống chứ
   *  không "—": "—" nghĩa là có chỗ cho một con số mà chưa biết nó, còn ở
   *  đây thì tháng đã xong nên vế ấy không tồn tại. */
  function oSoSanh(r, k, tenMoc, tenChenh, cauChuaCo, cauMoi, nhanMoc) {
    r.appendChild(oChenh(k, tenMoc, tenChenh, cauChuaCo, cauMoi, nhanMoc));

    if (k && k[tenMoc + "_mtd"] !== undefined) {
      /* Tên trường vế MTD chèn `_mtd` TRƯỚC hậu tố `_pt`:
         `vs_thang_truoc_pt` → `vs_thang_truoc_mtd_pt`. Đúng tên Engine đặt —
         `kiem/tong-hop.js` canh cặp tên này ở cả hai đầu. */
      r.appendChild(oChenh(k, tenMoc + "_mtd", tenChenh.replace(/_pt$/, "_mtd_pt"),
        cauChuaCo, cauMoi, nhanMoc + " (tới hôm nay)"));
    } else {
      r.appendChild(el("td", "oSo", ""));
    }
  }

  /** Một ô phần trăm chênh. Ba lý do trống, ba câu khác nhau.
   *
   *  KHÔNG còn mũi tên ▲▼ (chủ dự án chốt 17/09/2026): màu đã nói đúng điều
   *  mũi tên nói, và bỏ nó đi thì con số bắt đầu ngay ở mép ô nên cả cột
   *  thẳng lề. Dấu `+`/`−` của chính con số vẫn còn, nên ô vẫn đọc được cả
   *  khi in đen trắng.
   *
   *  Màu đặt trên `<td>` chứ không `<span>` — và đây là một lỗi đã phải sửa:
   *  bản trước bọc con số vào `<span class="vsTang">` trong khi CSS khai
   *  `.bangTongHop td.vsTang`, nên class gắn đúng mà không luật nào khớp và
   *  cả hai cột đen sì. Bài kiểm DOM không bắt được vì nó chỉ soi tên class. */
  function oChenh(k, tenMoc, tenChenh, cauChuaCo, cauMoi, nhanMoc) {
    const moc = k ? k[tenMoc] : undefined;
    if (!k || moc === null || moc === undefined) {
      const td = el("td", "oSo", "—");
      if (k) td.title = cauChuaCo;
      return td;
    }
    if (k[tenChenh] === null || k[tenChenh] === undefined) {
      /* Mốc bằng 0 mà tháng này có số: không chia được, nhưng cũng KHÔNG
         phải "chưa biết" — nói đúng chuyện đã xảy ra. */
      const td = el("td", "oSo", "mới");
      td.title = cauMoi;
      return td;
    }
    const v = k[tenChenh];
    const td = el("td", "oSo " + (v < 0 ? "vsGiam" : v > 0 ? "vsTang" : ""),
      (v > 0 ? "+" : "") + so1(v) + "%");
    td.title = nhanMoc + ": " + nghinTron(moc) + " nghìn đ.";
    return td;
  }

  const oVsThangTruoc = (r, k) => oSoSanh(r, k, "doanh_so_ky_truoc", "vs_thang_truoc_pt",
    "Chưa có số của tháng liền trước để so.",
    "Tháng liền trước line này chưa có doanh số nào, nên không có gì để chia.",
    "Tháng liền trước");

  const oVsNamTruoc = (r, k) => oSoSanh(r, k, "doanh_so_nam_truoc", "vs_nam_truoc_pt",
    "Chưa có số của cùng tháng năm trước để so — sổ chỉ có từ 01/2025.",
    "Cùng tháng năm trước line này chưa có doanh số nào, nên không có gì để chia.",
    "Cùng tháng năm trước");

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
    /* Dải Sheet cũng dựng TRƯỚC phép kiểm "có đơn nào không", và cùng lý do:
       một line chưa có đơn vẫn phải dán được link cho tháng này. Thêm một lý
       do riêng — đẩy một line RỖNG là việc có nghĩa: nó xoá sạch dải dữ liệu
       cũ trên Sheet, đúng thứ cần khi một đơn bị xoá hết. */
    veDaiSheet(khung, kq);

    if (!b.ngay.length) {
      demLaiConNo(false);
      khung.appendChild(el("p", "dangTai", "Line này chưa có đơn nào trong tháng đã chọn."));
      return;
    }

    const tt = el("p", "tomTatDon");
    tt.appendChild(el("b", null, nghinTron(b.tom_tat.doanh_so)));
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

    /* ── BỘ LỌC ──
       Đang lọc thì bảng thành một DANH SÁCH VIỆC phẳng: không băng ngày,
       không hàng tổng đơn, không hàng tổng cả bảng. Ba thứ ấy mang tổng do
       Engine cộng trên TOÀN BỘ dòng/đơn/ngày; để chúng đứng cạnh một tập
       dòng đã lọc là in ra một con số không khớp với những gì đang nhìn
       thấy, và người đọc không có cách nào biết con số ấy đang nói về tập
       nào. Thà bỏ hẳn còn hơn in một số đúng ở chỗ nó đọc thành sai.

       Khai SỚM — trước khi dựng cả bảng — vì cả hàng tiêu đề (nút lọc) lẫn
       hàng tổng của cả bảng đều cần biết đang lọc theo cái gì. */
    const loc = trangThai.loc ? LOC[trangThai.loc] : null;

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

    /* Đếm cho phép BÔI ĐỎ TÊN CỘT. Đếm trên MỌI dòng của bảng, kể cả dòng
       đang bị bộ lọc khác ẩn đi: cột đỏ trả lời "cột này còn ô thiếu
       không", một câu về cả bảng — nếu nó đổi theo bộ lọc đang bật thì lọc
       "chưa có giá" sẽ làm cột Mã hết đỏ và người dùng tưởng đã xong. */
    const demCanhBaoCot = {};
    for (const k of Object.keys(LOC)) demCanhBaoCot[k] = 0;
    for (const ng2 of b.ngay) {
      for (const don2 of ng2.don) {
        for (const d2 of don2.dong) {
          for (const k of Object.keys(LOC)) if (LOC[k].hop(d2)) demCanhBaoCot[k]++;
        }
      }
    }

    const thead = el("thead");
    const trTen = el("tr");
    /* Nút lọc nằm TRONG đầu cột nó lọc (chủ dự án chốt 12/09/2026) — không
       gom thành một dải riêng phía trên. Đứng ngay trên cột thì không phải
       giải thích nó lọc theo cái gì; một dải riêng thì phải đặt tên cho từng
       nút, và ba cái tên ấy lại là ba chỗ nữa để trôi khỏi sự thật. */
    const theoCot = {};
    for (const k of Object.keys(LOC)) theoCot[LOC[k].cot] = k;
    for (const c of COT) {
      const th = el("th");
      /* Nhãn và nút nằm trong MỘT hàng ngang, không `float`. Bản đầu dùng
         `float: right` và nó làm đúng thứ chủ dự án kêu — nút bị đẩy xuống
         dòng thứ hai ở cột hẹp, hàng tiêu đề cao lên, cột trông biến dạng.
         Hàng ngang thì nhãn co lại (ellipsis) còn nút giữ nguyên kích thước,
         nên bề rộng cột không quyết định gì nữa.

         Bọc trong một <div> chứ không đặt `display:flex` lên chính <th>: một
         ô bảng chuyển sang flex là rơi khỏi bố cục bảng, và cả `<colgroup>`
         lẫn `table-layout: fixed` hết tác dụng — mất đúng thứ P4 phải sửa. */
      const hang = el("div", "oDauCot");
      hang.appendChild(el("span", "tenCot", c));
      const k = theoCot[c];
      if (k && duocLoc()) hang.appendChild(nutLoc(k));
      /* TÊN CỘT ĐỎ = cột này còn ô thiếu (chủ dự án chốt 12/09/2026, thay
         cho hai băng chữ dưới bảng). Con số đếm từ chính những dòng vừa
         dựng, nên nó không thể lệch với bảng — đó đúng là chỗ hai băng cũ
         hỏng. Kèm số vào `title` để rê chuột biết còn bao nhiêu; không in
         ra cạnh tên vì cột hẹp và một con số ở đó lại đẩy nhãn xuống dòng. */
      if (k && duocLoc() && demCanhBaoCot[k]) {
        th.classList.add("cotCanhBao");
        hang.title = soNguyen(demCanhBaoCot[k]) + " dòng "
          + LOC[k].nhan.replace("Chỉ hiện dòng ", "").toLowerCase()
          + ". Bấm nút bên cạnh để chỉ hiện những dòng ấy.";
      }
      th.appendChild(hang);
      if (k) th.dataset.loc = k;
      trTen.appendChild(th);
    }
    thead.appendChild(trTen);

    /* ── HÀNG TỔNG CỦA CẢ BẢNG, NGAY DƯỚI HÀNG TIÊU ĐỀ ──
       Chủ dự án chốt 13/09/2026: "ngay dưới dòng tên dòng, cho thêm 1 dòng
       tổng có thông tin tổng của các cột". Đứng đúng LƯỚI 19 CỘT như mọi
       dòng khác — dùng chung <colgroup> nên mỗi con số nằm NGAY DƯỚI cột
       của nó, đọc được không cần đối chiếu ngang, khác hẳn một dòng chữ tự
       do như băng ngày.

       Đọc từ `tkpi.line[trangThai.line]` — CHÍNH bản kê Engine đã tính cho
       dải KPI phía trên, KHÔNG cộng lại ở đây: SL, Tổng bán, Lợi nhuận, Quy
       đổi đều là số ĐÃ CÓ SẴN. Tính hai lần ở hai chỗ là hai chỗ có thể lệch
       nhau mà không ai biết bên nào đúng (LUẬT SỐ 1) — cùng lý do "Đạt %"
       ở dải KPI vừa bỏ chữ "quy đổi" đi, để con số ấy chỉ còn đúng MỘT nơi
       hiện ra: hàng này.

       `tongLine` có thể `null` (line không có đơn nào trong tháng, hoặc
       nguồn KPI hỏng) — khi ấy bỏ hẳn hàng, không hiện một hàng toàn "—". */
    const tongLine = tkpi && tkpi.line ? tkpi.line[trangThai.line] : null;
    if (!loc && tongLine) {
      /* Ba con số phụ thuộc Tracking (giá nhập, lợi nhuận, quy đổi) hiện "—"
         khi kỳ ngoài phạm vi khớp mã hoặc nguồn giá hỏng lượt này — CHƯA
         BIẾT khác "bằng 0" (CLAUDE.md). `kq.trong_pham_vi_ma`/`kq.loi_nguon_ma`
         là hai cờ ĐÃ CÓ, dùng chung với mọi ô Giá nhập khác trên bảng, không
         phải một phép đoán mới ở đây.

         Còn biết được MỘT PHẦN thì hiện số kèm "*", đúng quy ước băng ngày
         và dải KPI đang dùng — không bịa một quy ước thứ hai cho cùng một
         ý nghĩa. */
      const thieuNguon = kq.trong_pham_vi_ma === false || !!kq.loi_nguon_ma;
      const soHoacGach = (so, thieu) => thieuNguon ? "—" : nghinTron(so) + (thieu ? " *" : "");

      const mKy = String(trangThai.ky || "").match(/^(\d{4})-(\d{2})$/);
      const GT_TONG = {
        "Ngày": mKy ? mKy[2] + "/" + mKy[1] : "",
        "Số BH": soNguyen(tongLine.so_don),
        "SL": soNguyen(tongLine.so_san_pham),
        "Giá nhập": soHoacGach(tongLine.tong_gia_nhap, tongLine.dong_thieu_gia_nhap),
        "Giá bán": nghinTron(tongLine.tong_gia_ban),
        "Tổng bán": nghinTron(tongLine.doanh_so),
        "Lợi nhuận": soHoacGach(tongLine.loi_nhuan, tongLine.don_thieu_loi_nhuan),
        "Quy đổi": soHoacGach(tongLine.doanh_so_quy_doi, tongLine.don_thieu_quy_doi),
      };
      const LOP_SO = new Set(["Số BH", "SL", "Giá nhập", "Giá bán",
        "Tổng bán", "Lợi nhuận", "Quy đổi"]);

      const trTong = el("tr", "hangTongBang");
      for (const c of COT) {
        const gt = GT_TONG[c];
        const td = el("td", LOP_SO.has(c) ? "oSo" : null, gt === undefined ? "" : gt);
        if (c === "Giá nhập" && thieuNguon) {
          td.title = "Kỳ này nằm ngoài phạm vi dữ liệu giá của Tracking, hoặc "
            + "nguồn giá hỏng lượt này.";
        } else if (c === "Giá nhập" && tongLine.dong_thieu_gia_nhap) {
          td.title = "Còn " + soNguyen(tongLine.dong_thieu_gia_nhap)
            + " dòng chưa có giá nhập, nên đây là con số SÀN.";
        } else if (c === "Lợi nhuận" && !thieuNguon && tongLine.don_thieu_loi_nhuan) {
          td.title = "Còn " + soNguyen(tongLine.don_thieu_loi_nhuan)
            + " đơn chưa đủ giá vốn, nên đây là con số SÀN.";
        } else if (c === "Quy đổi" && !thieuNguon && tongLine.don_thieu_quy_doi) {
          td.title = "Còn " + soNguyen(tongLine.don_thieu_quy_doi)
            + " đơn chưa quy đổi được, nên đây là con số SÀN.";
        }
        trTong.appendChild(td);
      }
      thead.appendChild(trTong);
    }

    bang.appendChild(thead);

    const tbody = el("tbody");
    let soKhop = 0;
    for (const ng of b.ngay) {
      /* Một hàng tiêu đề cho mỗi ngày — đúng cách file tay chia. Kèm luôn
         tổng của ngày để đọc dọc không phải tự cộng. */
      /* Mỗi ngày là một TRÌNH THẢ XUỐNG (chủ dự án chốt 13/09/2026), đóng
         sẵn: một tháng có ~500 dòng, mở hết ra thì phải cuộn mới biết tháng
         có mấy ngày. Đóng lại thì cả tháng đọc được trong một màn hình, và
         mở đúng ngày muốn soi.

         Dùng một HÀNG BẢNG bấm được chứ không phải `<details>`: `<details>`
         đặt trong `<tbody>` là HTML không hợp lệ, và trình duyệt sẽ ném nó
         ra ngoài bảng — cột lệch hết. */
      const trNgay = el("tr", "hangNgay");

      /* Băng ngày xếp thẳng theo ĐÚNG CỘT của bảng chi tiết bên dưới (chủ dự
         án chốt 15/09/2026): ngày ở cột Ngày, số đơn ở cột Số BH, doanh số ở
         cột Tổng bán, lợi nhuận ở cột Lợi nhuận, quy đổi ở cột Quy đổi.

         Bản trước là MỘT ô `colSpan` trải hết bề ngang, bên trong có một lưới
         bốn cột cố định riêng. Lưới ấy giữ được các băng ngày thẳng hàng VỚI
         NHAU, nhưng không thẳng với bảng bên dưới — nên mắt vẫn phải nhảy
         ngang để đối chiếu "doanh số của ngày" với cột Tổng bán. Nay dùng ô
         thật, nên hai thứ ấy nằm đúng trên một trục.

         Hệ quả gọn kèm theo: BỎ nhãn "LN" và "QĐ". Chúng sinh ra chỉ để phân
         biệt bốn con số trong một chuỗi nối; đứng dưới đúng tên cột rồi thì
         chúng thành chữ thừa (chủ dự án chốt cùng ngày).

         Mọi colSpan tính TỪ `COT.indexOf(...)`, không gõ cứng — cùng luật
         hàng TỔNG của đơn đang theo, và `kiem/bo-cuc-man-chu.js` canh. Gõ
         cứng là lần thêm hay dời cột kế tiếp băng ngày lệch sang cột khác mà
         không có gì đỏ lên. */
      const iBH = COT.indexOf("Số BH");
      const iTong = COT.indexOf("Tổng bán");
      const iLn = COT.indexOf("Lợi nhuận");
      const iQd = COT.indexOf("Quy đổi");

      /* Ô Ngày — mũi tên đóng/mở và nhãn ngày. */
      const tdNgay = el("td", "oNgayBang");
      const muiTen = icon("mo", 2.4);
      muiTen.classList.add("muiTenNgay");
      tdNgay.appendChild(muiTen);
      tdNgay.appendChild(el("span", "chuNgay", nhanNgayDay(ng.ngay)));
      trNgay.appendChild(tdNgay);

      /* Bốn con số ENGINE tính, màn hình chỉ đọc. Dấu "*" ở lợi nhuận nghĩa
         là còn đơn chưa đủ giá vốn — cùng quy ước với cột Tỉ lệ tồn kho,
         không phải một dấu mới. */
      trNgay.appendChild(el("td", "oSo", soNguyen(ng.so_don) + " đơn"));
      /* Khoảng giữa Số BH và Tổng bán: Nơi nhập · Mã sản phẩm · SL · Giá
         nhập · Giá bán — không con số nào của băng ngày thuộc về chúng. */
      const tdGiua = el("td");
      tdGiua.colSpan = iTong - iBH - 1;
      trNgay.appendChild(tdGiua);

      trNgay.appendChild(el("td", "oSo", nghinTron(ng.doanh_so)));
      trNgay.appendChild(el("td", "oSo",
        nghinTron(ng.loi_nhuan || 0) + (ng.don_thieu_loi_nhuan ? " *" : "")));
      trNgay.appendChild(el("td", "oSo oQuyDoi",
        ng.doanh_so_quy_doi === null || ng.doanh_so_quy_doi === undefined
          ? "—" : nghinTron(ng.doanh_so_quy_doi)));

      /* Phần đuôi: từ sau Quy đổi tới hết bảng. */
      const tdSau = el("td");
      tdSau.colSpan = COT.length - iQd - 1;
      trNgay.appendChild(tdSau);

      /* Tô CẢ BĂNG khi ngày ấy còn đơn chưa đủ thông tin (chủ dự án chốt
         13/09/2026) — đóng lại rồi thì dấu "*" bên trong một dòng chữ dài
         không đủ để mắt bắt được ngày nào còn việc. Cả băng đổi màu thì
         lướt dọc một tháng là thấy ngay.

         Đi qua `lopCanhBao()` như mọi cảnh báo khác: Quản lí xem báo cáo,
         không nhận việc. */
      if (ng.don_thieu_loi_nhuan) {
        const lop = lopCanhBao("ngayThieu");
        if (lop) trNgay.classList.add(lop);
        /* `title` đặt lên CẢ HÀNG, không lên một ô: hàng nay có bảy ô rời
           thay vì một ô gộp, nên gắn vào một ô là câu giải thích chỉ hiện ra
           khi rê đúng ô ấy. */
        trNgay.title = "Còn " + soNguyen(ng.don_thieu_loi_nhuan)
          + " đơn chưa đủ giá vốn, nên lợi nhuận của ngày là con số SÀN.";
      }
      /* Gom hàng của cả ngày rồi mới quyết định có in băng ngày hay không:
         lọc xong mà ngày ấy không còn dòng nào thì một băng ngày trơ trọi
         không có gì bên dưới là dòng nhiễu thuần tuý. */
      const hangNgay = [];

      for (const don of ng.don) {
        let dauDon = true;
        const hangDon = [];
        for (const d of don.dong) {
          if (loc && !loc.hop(d)) continue;
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
            d.la_lo ? lopCanhBao("hangLo") : null].filter(Boolean).join(" ");
          const tr = el("tr", lop || null);
          /* Ngày và số BH chỉ ghi ở DÒNG ĐẦU của đơn — cùng cách file tay
             gộp ô, để mắt nhận ra ranh giới giữa hai đơn. */
          tr.appendChild(o(dauDon ? nhanNgayCot(ng.ngay) : "", "oNgay"));
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
          tr.appendChild(nutDong("sua", "Sửa dòng", suaDuoc, "sua"));
          tr.appendChild(nutDong("xoa", "Xoá dòng", suaDuoc, "xoa"));
          if (d.khoa) tr.dataset.khoaDong = d.khoa;
          if (d.da_sua_tay) tr.classList.add("hangSuaTay");
          hangDon.push(tr);
          soKhop++;
          dauDon = false;
        }
        if (!hangDon.length) continue;
        for (const t of hangDon) hangNgay.push(t);
        if (loc) continue;
        const trTong = el("tr", "hangTongDon");
        const tdTrong = el("td");
        tdTrong.colSpan = 7;
        trTong.appendChild(tdTrong);
        trTong.appendChild(el("td", "oSo", nghinTron(don.tong_ban)));
        /* Ô BONUS đứng dưới đúng cột "Lợi nhuận" — chủ dự án chỉ đúng ô ấy
           trên ảnh 12/09/2026. Trước đây cả phần đuôi hàng tổng là MỘT ô
           colSpan, nên phải cắt nó ra: một ô cho Lợi nhuận, phần còn lại
           gộp tiếp và mang câu lý do. */
        trTong.appendChild(oBonus(don));
        /* Lý do đứng dưới đúng cột GHI CHÚ (chủ dự án chốt 13/09/2026) — bản
           trước nhét nó vào ô gộp bắt đầu từ cột Quy đổi, tức một câu chữ
           nằm đè lên vùng của bốn cột tiền. Ghi chú mới là chỗ của nó, và
           cột ấy vốn đã rộng cho chữ.

           Ba ô gộp hai bên tính TỪ `COT.length` chứ không gõ cứng: thêm một
           cột là mọi thứ tự động dịch theo. */
        const tdGiua = el("td");
        tdGiua.colSpan = COT.indexOf("Ghi chú") - COT.indexOf("Lợi nhuận") - 1;
        trTong.appendChild(tdGiua);
        trTong.appendChild(oLyDoBonus(don));
        const tdSau = el("td");
        tdSau.colSpan = COT.length - COT.indexOf("Ghi chú") - 1;
        trTong.appendChild(tdSau);
        hangNgay.push(trTong);
      }

      if (!hangNgay.length) continue;
      if (loc) {
        /* Đang lọc thì KHÔNG có trình thả xuống nào: bảng là một danh sách
           việc phẳng, và bắt người dùng mở từng ngày mới thấy việc là đúng
           thứ bộ lọc sinh ra để tránh. */
        for (const t of hangNgay) tbody.appendChild(t);
        continue;
      }
      /* Ngày nào ĐANG MỞ được nhớ qua mỗi lượt vẽ lại. Thiếu chỗ này thì
         nhập xong một cái bonus là cả bảng dựng lại và mọi ngày đóng sập —
         người vừa gõ bị ném về đầu tháng, đúng lỗi chủ dự án gặp
         13/09/2026. Nhớ theo NGÀY chứ không theo vị trí: lọc hay đổi line
         làm thứ tự đổi, còn `2026-09-01` thì không đổi. */
      const dangMo = trangThai.ngayMo.has(ng.ngay);
      tbody.appendChild(trNgay);
      for (const t of hangNgay) { t.hidden = !dangMo; tbody.appendChild(t); }
      if (!dangMo) trNgay.classList.add("dongLai");
      trNgay.addEventListener("click", () => {
        const mo = trNgay.classList.toggle("dongLai");
        for (const t of hangNgay) t.hidden = mo;
        if (mo) trangThai.ngayMo.delete(ng.ngay);
        else trangThai.ngayMo.add(ng.ngay);
        /* Chiều cao bảng đổi → chỗ còn lại cho biểu đồ cũng đổi. Không gọi
           lại thì mở một ngày ra là bảng tràn xuống dưới biểu đồ. */
        dieuChinhCaoBang();
        if (window.SucKhoe && window.SucKhoe.canhLai) window.SucKhoe.canhLai();
      });
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
      const nb = e.target.closest("button.nutBonus");
      if (nb && tbody.contains(nb)) {
        e.stopPropagation();
        moBonus(nb, kq);
        return;
      }
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

    /* KHÔNG có băng "Đang lọc: …" (chủ dự án chốt 12/09/2026: "nhìn icon là
       đủ hiểu rồi"). Nút lọc đang sáng xanh trên đúng cột nó lọc — đó vốn đã
       là câu trả lời cho "đang lọc theo cái gì", và một dòng chữ nhắc lại nó
       chỉ đẩy bảng xuống thêm một dòng. Bấm lại chính nút ấy là bỏ lọc.

       Ca DUY NHẤT còn phải nói bằng chữ: lọc xong không còn dòng nào. Một
       bảng trống không tự nói được vì sao nó trống, và nó đọc y hệt một
       line chưa có đơn — hoặc một cái hỏng. */
    if (loc && !soKhop) {
      khung.appendChild(el("p", "bangLoc",
        "Không dòng nào " + loc.nhan.replace("Chỉ hiện dòng ", "").toLowerCase()
        + ". Bấm lại nút lọc trên cột " + loc.cot + " để xem cả bảng."));
    }

    bang.appendChild(tbody);
    boc.appendChild(bang);
    khung.appendChild(boc);
    dieuChinhCaoBang();

    /* HAI BĂNG CẢNH BÁO DƯỚI BẢNG ĐÃ BỎ — chủ dự án chốt 12/09/2026
       ("dòng cảnh báo ở dưới không cập nhật theo thực tế nên hãy bỏ luôn").

       Chúng SAI thật, và đây là lý do, để đừng ai dựng lại: cả hai đọc
       `tom_tat_gia` / `tom_tat_sua_tay` mà Engine tính TRONG `dienGiaNhap()`,
       tức TRƯỚC lượt áp sửa tay ở cuối chuỗi. Một dòng chủ dự án đã tự gõ
       giá nhập vào vẫn bị đếm là "chưa có giá vốn" mãi mãi. Ảnh 12/09/2026:
       băng dưới nói "còn 6 dòng chưa có giá vốn" trong khi bộ lọc — chạy
       trên đúng những dòng đang hiện — tìm ra 0. Một con số cãi nhau với
       chính cái bảng ngay trên nó thì không sửa được bằng cách sửa câu chữ.

       Thay bằng: BÔI ĐỎ TÊN CỘT (`demCanhBaoCot` ngay dưới). Con số ấy đếm
       từ CHÍNH những dòng vừa vẽ ra, nên nó không thể lệch với bảng — và
       cột đỏ nói đúng thứ cần nói: "cột này còn ô thiếu, bấm nút lọc bên
       cạnh để xem". */
    demLaiConNo(false);

    /* Băng QUYẾT ĐỊNH MỒ CÔI ĐÃ BỎ — chủ dự án chốt 12/09/2026 ("bỏ các ghi
       chú về sửa tay ở dưới cùng"), sau khi nhìn nó ngoài đời: 22 khoá dòng
       in liền một mạch thành sáu dòng chữ dày đặc dưới mỗi bảng, ngày nào
       cũng thế, và không ai đọc tới lần thứ hai.

       Đây là một chốt ĐÈ LÊN câu trong CLAUDE.md ("màn hình phải nói rõ có
       bao nhiêu quyết định cũ không còn dòng nào để áp, kèm danh sách") —
       chốt ấy đã được ghi lại vào chính CLAUDE.md cùng ngày, không im lặng
       bỏ qua một luật đang viết ngược lại.

       Dữ liệu KHÔNG mất: Engine vẫn tính `tom_tat_sua_tay.mo_coi` đầy đủ
       (`kiem/sua-tay.js` vẫn canh), quyết định vẫn được giữ và vẫn tự áp
       trở lại lúc dòng xuất hiện lại. Thứ bỏ đi chỉ là chỗ in nó ra. */
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
    /* Bộ lọc là "tôi đang soi việc còn treo của BẢNG NÀY", không phải một
       thiết lập của người dùng. Mang nó sang tab khác thì mở một line mới ra
       thấy bảng gần như trống mà không hiểu vì sao — nhất là khi line ấy
       không còn dòng nào khớp và bảng rỗng hoàn toàn. */
    trangThai.loc = null;
    /* Ngày đang mở là chuyện của BẢNG ĐANG XEM. Mang sang tháng khác thì
       `2026-09-01` không tồn tại ở đó, còn mang sang line khác thì mở ra một
       ngày người dùng chưa hề bấm. */
    trangThai.ngayMo = new Set();
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
  /** Vẽ một kết quả `/api/don-hang` ra màn hình.
   *
   *  Tách khỏi `taiKy()` vì từ 12/09/2026 kết quả ấy còn đến từ một chỗ NỮA:
   *  phản hồi của `POST /api/sua-dong` mang luôn bảng đã tính lại (xem
   *  `luu()`). Hai đường vẽ phải đi qua đúng một hàm — hai bản vẽ là hai bản
   *  trôi khỏi nhau, và chỗ trôi ở đây là con số hiện sau khi sửa khác con số
   *  hiện sau khi tải lại.
   *
   *  Vị trí cuộn được đo NGAY TRONG hàm, trước khi `<tbody>` bị dựng lại: đo
   *  ở chỗ gọi thì đường ghi phải nhớ đo, và cái phải-nhớ nào rồi cũng có chỗ
   *  quên. */
  function veKetQua(kq) {
    bangCuoi = kq;
    const ve = $("veDonHang");
    const bocCu = ve.querySelector(".bocBang");
    const cuonCu = bocCu ? bocCu.scrollTop : 0;
    veTabLine(kq.tom_tat_line);
    if (trangThai.line === null) {
      veTongHop(ve, kq);
      return;
    }
    veBang(kq);
    const bocMoi = ve.querySelector(".bocBang");
    if (bocMoi && cuonCu) bocMoi.scrollTop = cuonCu;
  }

  async function taiKy(tuyChon) {
    const imLang = !!(tuyChon && tuyChon.imLang);
    const loi = $("loiDonHang"), ve = $("veDonHang");
    loi.textContent = "";
    veTabNam();
    veThang();
    /* Báo kỳ sang khối biểu đồ NGAY ĐÂY, trước lượt gọi máy chủ của bảng —
       hai khối tự tải phần của mình, không khối nào phải chờ khối kia. Đổi
       tháng thì biểu đồ vẽ lại cùng lúc bảng đang tải, không phải sau. */
    baoBieuDo();
    /* Và báo sang màn [Kích hoạt bảo hành] — hai màn DÙNG CHUNG một kỳ (chủ
       dự án chốt 19/09/2026), nên đổi tháng ở đây là đổi cho cả bên kia. Nó
       tự quyết định có tải lại ngay hay không; đang đứng ở màn này thì nó
       chỉ ghi nhớ, vì lượt đọc ấy dựng lại cả bảng đơn của tháng. */
    if (window.BaoHanh && window.BaoHanh.datKy && trangThai.ky) {
      window.BaoHanh.datKy(trangThai.ky);
    }

    if (!trangThai.ky) {
      ve.innerHTML = "";
      $("tabLine").innerHTML = "";
      ve.appendChild(el("p", "dangTai", "Năm này chưa có tháng nào được tải lên."));
      return;
    }

    if (!imLang) ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
    try {
      const duong = "/api/don-hang?ky=" + encodeURIComponent(trangThai.ky)
        + (trangThai.line === null ? "" : "&line=" + encodeURIComponent(trangThai.line));
      veKetQua(await goi(duong));
    } catch (e) {
      ve.innerHTML = "";
      loi.textContent = "Không lấy được đơn hàng: " + e.message;
    }
    /* Bảng vừa đổi chiều cao → chỗ còn lại cho biểu đồ cũng đổi. Lượt đo
       TRƯỚC lượt gọi máy chủ (trong `baoBieuDo`) nhìn thấy một trang chưa
       có bảng, nên nó luôn rộng tay quá mức — đây là lượt đo ĐÚNG. */
    if (window.SucKhoe && window.SucKhoe.canhLai) window.SucKhoe.canhLai();
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

  /* ---- Biểu đồ: nằm ngay dưới bảng, cùng kỳ với bảng ----
   *
   * Tab [Biểu đồ] đã BỎ (chủ dự án chốt 12/09/2026) — không còn màn nào để
   * bật/tắt, nên `doiManChinh()` cũ cũng bỏ theo.
   *
   * Hai việc còn lại, và chúng đi qua ĐÚNG hai hàm của `window.SucKhoe`:
   *   · báo kỳ đang xem mỗi lần đổi năm/tháng → biểu đồ vẽ lại theo bảng;
   *   · bật/tắt cả khối → chỉ tab [Tổng hợp] mới có biểu đồ.
   *
   * Gọi qua một cửa hẹp chứ không sửa thẳng DOM của khối kia: hai nhánh
   * không buộc chặt vào nhau qua tên phần tử, đúng quy ước đã có từ P2(b).
   * Thiếu hẳn `window.SucKhoe` (file chưa tải xong) cũng không được làm hỏng
   * màn báo cáo — nên mọi lượt gọi đều qua hàm bọc này. */
  function baoBieuDo() {
    if (!window.SucKhoe) return;
    /* `trangThai.ky` rỗng nghĩa là năm đang chọn chưa có tháng nào — lúc ấy
       biểu đồ chưa từng được nạp, nên bật khối lên chỉ để lộ một hộp trắng
       rỗng. Ẩn cả khi đang ở [Tổng hợp]. */
    window.SucKhoe.hien(trangThai.line === null && !!trangThai.ky);
    if (trangThai.ky) window.SucKhoe.datKy(trangThai.ky);
  }

  /* Cửa DUY NHẤT theo chiều ngược lại, mở 19/09/2026 cho màn [Kích hoạt bảo
     hành]. Khối biểu đồ nằm trong `#manBaoCao`, nên lúc người dùng sang màn
     kia nó bị ẩn theo — mà chiều cao của nó được ĐO lúc vẽ, và đo một khối
     đang ẩn thì ra 0. Nên lúc quay về, màn kia gọi hàm này để đo lại.

     Một hàm gọi sang, không phải một lượt sửa DOM chéo nhau: cùng quy ước
     `window.SucKhoe` đã có từ P2(b). */
  window.DonHang = {
    canhLaiBieuDo: function () { baoBieuDo(); },
  };

  /* Màn này GIỜ LÀ TRANG CHỦ (chủ dự án chốt 11/09/2026: bỏ lưới thẻ, đăng
     nhập xong ra thẳng báo cáo), nên không còn thẻ để bấm mở và không còn
     nút "Quay lại" để đóng. Nghe thẳng Firebase Auth thay vì chờ khối
     <script> inline gọi sang — khối đó là của phần đăng nhập, quy ước là để
     yên (ROADMAP.md). */
  let daMo = false;
  document.addEventListener("DOMContentLoaded", function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { daMo = false; return; }
      if (daMo) return;          // token tự làm mới không được kéo thêm một lượt tải
      daMo = true;
      moMan();
    });
  });
})();
