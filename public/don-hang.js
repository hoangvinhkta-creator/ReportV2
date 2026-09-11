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
  /** Ô của bảng: `null` hiện "—" chứ không hiện 0. Sáu cột của P4 (giá nhập,
   *  lợi nhuận, nơi nhập, hãng, ngành hàng, ghi chú) chưa có nguồn, và "0
   *  đồng" với "chưa biết" là hai chuyện hoàn toàn khác nhau. */
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

  const trangThai = { nam: null, line: null, ky: null, dsKy: null, hienLine0: false };

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
  function nutDong(bieuTuong, nhan) {
    const td = el("td", "oIcon");
    const b = el("button", "nutIcon", bieuTuong);
    b.type = "button";
    b.disabled = true;
    b.title = nhan + " — mở ở lượt sau";
    b.setAttribute("aria-label", nhan);
    td.appendChild(b);
    return td;
  }

  /* ---- Vẽ bảng đơn hàng của một (kỳ, line) ---- */

  function veBang(kq) {
    const khung = $("veDonHang");
    khung.innerHTML = "";

    const b = kq.bang;
    if (!b.ngay.length) {
      khung.appendChild(el("p", "dangTai", "Line này chưa có đơn nào trong tháng đã chọn."));
      return;
    }

    const tt = el("p", "tomTatDon");
    tt.appendChild(el("b", null, nghinTron(b.tom_tat.doanh_so) + " nghìn đ"));
    tt.appendChild(document.createTextNode(" · " + soNguyen(b.tom_tat.so_don) + " đơn · "
      + soNguyen(b.tom_tat.so_dong) + " dòng"));
    khung.appendChild(tt);

    const boc = el("div", "bocBang");
    const bang = el("table", "bangDon");

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
          const tr = el("tr", d.la_chiet_khau ? "hangChietKhau" : (dauDon ? "hangDauDon" : null));
          /* Ngày và số BH chỉ ghi ở DÒNG ĐẦU của đơn — cùng cách file tay
             gộp ô, để mắt nhận ra ranh giới giữa hai đơn. */
          tr.appendChild(o(dauDon ? nhanNgayDay(ng.ngay) : "", "oNgay"));
          tr.appendChild(o(dauDon ? don.so_ct : "", "oCt"));
          tr.appendChild(o(d.noi_nhap));
          tr.appendChild(o(d.ma_san_pham, "oTen"));
          tr.appendChild(o(soNguyen(d.so_luong), "oSo"));
          tr.appendChild(o(d.gia_nhap === null ? null : nghin(d.gia_nhap), "oSo"));
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
          tr.appendChild(o(d.hang));
          tr.appendChild(o(d.nganh_hang));
          tr.appendChild(oHep(d.imei, "oImei"));
          tr.appendChild(nutDong("✏️", "Sửa dòng"));
          tr.appendChild(nutDong("🗑", "Xoá dòng"));
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
    bang.appendChild(tbody);
    boc.appendChild(bang);
    khung.appendChild(boc);

    khung.appendChild(el("p", "viDu", "Tiền hiện theo nghìn đồng (6.450 = 6.450.000 đ). "
      + "Giá nhập, lợi nhuận, doanh số quy đổi, nơi nhập, hãng, ngành hàng lấy từ Tracking ở P4/P5 "
      + "— nay còn trống. Chiết khấu của cả đơn gộp thành một dòng mang dấu âm. "
      + "Nút Sửa/Xoá dòng mở ở lượt sau."));
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

  async function taiKy() {
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

    ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
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

  /* Chỉ BẬT/TẮT chứ không dựng lại: `#o-dashboard` do suc-khoe.js (nhánh
     P2(b)) tự vẽ ngay lúc đăng nhập và vẽ bằng SVG có viewBox cố định, nên
     nằm trong khối đang ẩn vẫn ra đúng kích thước. Đổi sang "chỉ vẽ khi mở
     tab" là phải sửa suc-khoe.js — file của nhánh kia, quy ước là không
     đụng vào (ROADMAP.md). Giá phải trả: một lượt gọi API thừa mỗi lần đăng
     nhập nếu người dùng không mở tab Biểu đồ. */
  function doiManChinh(hienBieuDo) {
    $("manBaoCao").hidden = hienBieuDo;
    $("manBieuDo").hidden = !hienBieuDo;
    $("nutManBaoCao").classList.toggle("tabDang", !hienBieuDo);
    $("nutManBieuDo").classList.toggle("tabDang", hienBieuDo);
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
