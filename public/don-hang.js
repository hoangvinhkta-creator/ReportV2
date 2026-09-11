/* Màn "Đơn hàng" (P3) — tab theo NĂM, tab con theo LINE, bảng chia theo NGÀY.
 *
 * Bố cục chủ dự án chốt 11/09/2026, lấy theo đúng file báo cáo tay đang
 * dùng (`Báo cáo Kinh doanh 2026.xlsx`, 58 sheet kiểu "08.2026 Tín Phát"):
 *
 *   [2025] [2026]                      ← tab năm
 *     [Dashboard] [Nội thành] [...]    ← tab con: Dashboard + từng line
 *       [T07] [T08] [T09]              ← chọn tháng
 *       bảng đơn hàng, nhóm theo ngày rồi theo số BH
 *
 * Vì sao có thêm hàng CHỌN THÁNG mà file tay không có: dữ liệu lưu theo kỳ
 * (`bc/dong/<YYYY-MM>`), một tháng nặng ~390 KB. Mở thẳng cả năm là kéo về
 * ~4,7 MB cho một lượt xem — hàng tháng giữ mỗi lượt mở ở đúng một lượt đọc.
 *
 * Ô `#o-dashboard` để TRỐNG cho nhánh P2(b) lắp biểu đồ vào (quy ước ghi ở
 * ROADMAP.md). File này không vẽ biểu đồ nào.
 *
 * LUẬT SỐ 1: mọi con số trong bảng — tổng bán, lợi nhuận, dòng chiết khấu
 * gộp — đều do Engine tính sẵn và trả về (`engine/src/dong-hang.mjs`). File
 * này chỉ đọc field có sẵn và vẽ ra; chỗ duy nhất nó động vào số là chia
 * 1.000 để hiện theo nghìn đồng, và đó là ĐỊNH DẠNG chứ không phải nghiệp vụ.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function nghin(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
  }
  const soNguyen = (v) => (Number(v) || 0).toLocaleString("vi-VN");

  function nhanNgayDay(d) {
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(d || "");
  }
  const thangCuaKy = (ky) => "T" + String(ky).slice(5, 7);

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

  /* 16 cột chủ dự án chốt. Sáu cột cuối bảng dưới đây chờ P4/P5 điền. */
  const COT = ["Ngày", "Số BH", "Nơi nhập", "Mã sản phẩm", "SL", "Giá nhập", "Giá bán",
    "Tổng bán", "Lợi nhuận", "Tên khách hàng", "Số điện thoại", "Địa chỉ",
    "Hãng", "Ngành hàng", "IMEI", "Ghi chú"];

  const trangThai = { nam: null, line: null, ky: null, dsKy: null };

  async function goi(duong) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    const r = await fetch(duong, { headers: { Authorization: "Bearer " + token } });
    const than = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(than.loi || ("HTTP " + r.status));
    return than;
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
    tt.appendChild(el("b", null, nghin(b.tom_tat.doanh_so) + " nghìn đ"));
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
        + " đơn  ·  " + nghin(ng.doanh_so) + " nghìn đ");
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
          tr.appendChild(o(dauDon ? don.ten_khach : ""));
          tr.appendChild(o(dauDon ? don.dien_thoai : ""));
          tr.appendChild(o(dauDon ? don.dia_chi : "", "oDiaChi"));
          tr.appendChild(o(d.hang));
          tr.appendChild(o(d.nganh_hang));
          tr.appendChild(o(d.imei));
          tr.appendChild(o(d.ghi_chu));
          tbody.appendChild(tr);
          dauDon = false;
        }
        const trTong = el("tr", "hangTongDon");
        const tdTrong = el("td");
        tdTrong.colSpan = 7;
        trTong.appendChild(tdTrong);
        trTong.appendChild(el("td", "oSo", nghin(don.tong_ban)));
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
      + "Giá nhập, lợi nhuận, nơi nhập, hãng, ngành hàng lấy từ Tracking ở P4 — nay còn trống. "
      + "Chiết khấu của cả đơn gộp thành một dòng mang dấu âm."));
  }

  /* ---- Tab con: Dashboard + từng line ---- */

  function veTabLine(tom_tat_line) {
    const hang = $("tabLine");
    hang.innerHTML = "";

    const nutDash = el("button", "tabNut" + (trangThai.line === null ? " tabDang" : ""), "Dashboard");
    nutDash.type = "button";
    nutDash.addEventListener("click", () => { trangThai.line = null; taiKy(); });
    hang.appendChild(nutDash);

    for (const ten of tom_tat_line.thu_tu) {
      const l = tom_tat_line.line[ten] || { so_don: 0 };
      const nut = el("button", "tabNut" + (trangThai.line === ten ? " tabDang" : ""),
        ten + " (" + soNguyen(l.so_don) + ")");
      nut.type = "button";
      nut.addEventListener("click", () => { trangThai.line = ten; taiKy(); });
      hang.appendChild(nut);
    }
  }

  function veThang() {
    const hang = $("tabThang");
    hang.innerHTML = "";
    const ds = (trangThai.dsKy.nam[trangThai.nam] || []);
    for (const ky of ds) {
      const nut = el("button", "tabNut" + (trangThai.ky === ky ? " tabDang" : ""), thangCuaKy(ky));
      nut.type = "button";
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
    $("oDashboardBoc").hidden = trangThai.line !== null;

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
        /* Tab Dashboard: chỉ liệt kê line của tháng. Biểu đồ là của P2(b),
           lắp vào `#o-dashboard` — không vẽ chồng lên nhau. */
        ve.innerHTML = "";
        const b = el("table", "bangNho");
        const tr = el("tr");
        for (const c of ["Line", "Doanh số (nghìn đ)", "Số đơn", "Dòng hàng"]) tr.appendChild(el("th", null, c));
        b.appendChild(tr);
        for (const ten of kq.tom_tat_line.thu_tu) {
          const l = kq.tom_tat_line.line[ten];
          const r = el("tr");
          r.appendChild(el("td", null, ten));
          r.appendChild(el("td", "oSo", nghin(l.doanh_so)));
          r.appendChild(el("td", "oSo", soNguyen(l.so_don)));
          r.appendChild(el("td", "oSo", soNguyen(l.so_dong)));
          b.appendChild(r);
        }
        ve.appendChild(b);
      } else {
        veBang(kq);
      }
    } catch (e) {
      ve.innerHTML = "";
      loi.textContent = "Không lấy được đơn hàng: " + e.message;
    }
  }

  async function moMan() {
    $("manChu").hidden = true;
    $("manDonHang").hidden = false;
    const loi = $("loiDonHang"), ve = $("veDonHang");
    loi.textContent = "";
    ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
    try {
      trangThai.dsKy = await goi("/api/ky-co-don");
      if (!trangThai.dsKy.thu_tu_nam.length) {
        ve.innerHTML = "";
        $("tabNam").innerHTML = "";
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

  function dongMan() {
    $("manDonHang").hidden = true;
    $("manChu").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const the = $("theDonHang");
    if (the) {
      the.addEventListener("click", moMan);
      the.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); moMan(); }
      });
    }
    const quay = $("nutQuayDonHang");
    if (quay) quay.addEventListener("click", dongMan);
  });
})();
