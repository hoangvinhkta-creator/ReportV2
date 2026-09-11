/* "Màn mở" — sức khoẻ kinh doanh toàn công ty (P2(b) bước 1). File RIÊNG,
 * nạp bằng <script src> (CLAUDE.md — mỗi màn hình một file .js rời, không
 * gộp vào khối inline của index.html; xem kiem/luat-so-1.js phần "Chỗ 2").
 *
 * TOÀN BỘ những gì file này làm: gọi GET /api/bao-cao/suc-khoe kèm Firebase
 * ID token, rồi VẼ cây kết quả ĐÃ TÍNH SẴN mà Gateway/Engine trả về. Không
 * có công thức tiền nào ở đây — "ngày nào thuộc tháng/năm nào", "năm trước
 * là năm nào" đều do Engine tính (xem engine/src/gop-theo-thoi-gian.mjs),
 * file này chỉ đọc field có sẵn (LUẬT SỐ 1).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---- Số + nhãn: THUẦN, không đụng DOM — test được bằng Node độc lập ---- */

  /* Trục dọc "làm gọn": 1.000.000.000đ hiển thị 1.000.000 (chia 1.000, bỏ
   * ba số 0 cuối) — chủ dự án chốt lúc duyệt mockup, đơn vị hiểu ngầm là
   * "nghìn đồng", ghi rõ ở chú giải dưới biểu đồ để không ai đọc nhầm là
   * "đồng". */
  function lamGon(soTien) {
    return Math.round((Number(soTien) || 0) / 1000).toLocaleString("vi-VN");
  }

  /* "YYYY-MM-DD" -> "DD/MM" — trục ngày CHỈ hiện DD/MM, không hiện năm (hai
   * đường chồng lên nhau đã tự nói năm nào qua màu/chú giải). */
  function nhanNgay(khoa) {
    const m = String(khoa).match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? m[2] + "/" + m[1] : "";
  }

  /* "YYYY-MM" -> "MM" — cùng tinh thần gọn của trục ngày. */
  function nhanThang(khoa) {
    const m = String(khoa).match(/^\d{4}-(\d{2})$/);
    return m ? m[1] : "";
  }

  /* { [viTri]: {doanh_so,so_don,khoa} } của MỘT năm -> mảng đã sắp theo viTri. */
  function layDiem(theoDonVi, nam) {
    const o = theoDonVi && theoDonVi[nam];
    if (!o) return [];
    return Object.keys(o).map(Number).sort((a, b) => a - b)
      .map((vt) => ({ vt, doanh_so: o[vt].doanh_so, khoa: o[vt].khoa }));
  }

  const KHONG_AN_TOAN = /[<>&"']/g;
  const thoat = (s) => String(s).replace(KHONG_AN_TOAN, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const MAU_NAY = "#2563eb";   // năm nay — màu nhấn, trùng nút chính của trang
  const MAU_TRUOC = "#9ca3af"; // năm trước — xám, không cạnh tranh với màu nhấn

  /* Vẽ MỘT đường (mảng điểm {vt, doanh_so}) thành chuỗi "d" của path SVG,
   * ngắt đoạn khi hai điểm liền nhau cách nhau hơn 1 vị trí — một khoảng
   * trống thật trong dữ liệu không được vẽ liền thành một đường giả. */
  function duongSvg(diem, vtMin, vtMax, x, yMax, caoVe) {
    if (!diem.length) return "";
    const px = (vt) => x(vt, vtMin, vtMax);
    const py = (v) => caoVe - (yMax > 0 ? (v / yMax) * caoVe : 0);
    let d = "", dangMo = false;
    let vtTruoc = null;
    for (const p of diem) {
      const moDoan = vtTruoc === null || p.vt - vtTruoc > 1;
      d += (moDoan ? "M" : "L") + px(p.vt).toFixed(1) + "," + py(p.doanh_so).toFixed(1) + " ";
      vtTruoc = p.vt;
    }
    return d.trim();
  }

  /* Biểu đồ đường cho tab "ngày"/"tháng" — hai đường chồng theo vị trí
   * trong chu kỳ năm (đúng ngày/đúng tháng của năm trước nằm cùng cột X). */
  function veBieuDoDuong(theoDonVi, namNay, namTruoc, vtMax, nhanFn) {
    const diemNay = layDiem(theoDonVi, namNay);
    const diemTruoc = namTruoc != null ? layDiem(theoDonVi, namTruoc) : [];
    const yMax = Math.max(1, ...diemNay.map((p) => p.doanh_so), ...diemTruoc.map((p) => p.doanh_so));

    const RONG = 640, CAO = 220, LE_TRAI = 64, LE_DUOI = 28, LE_TREN = 10, LE_PHAI = 12;
    const caoVe = CAO - LE_TREN - LE_DUOI, rongVe = RONG - LE_TRAI - LE_PHAI;
    const x = (vt, min, max) => LE_TRAI + (max > min ? ((vt - min) / (max - min)) * rongVe : 0);

    const dNay = duongSvg(diemNay, 1, vtMax, x, yMax, caoVe);
    const dTruoc = duongSvg(diemTruoc, 1, vtMax, x, yMax, caoVe);

    // 4 mốc lưới ngang, đều từ 0 tới yMax.
    let luoi = "";
    for (let i = 0; i <= 3; i++) {
      const gt = (yMax / 3) * i;
      const y = LE_TREN + (caoVe - (gt / yMax) * caoVe);
      luoi += '<line x1="' + LE_TRAI + '" x2="' + (RONG - LE_PHAI) + '" y1="' + y.toFixed(1)
        + '" y2="' + y.toFixed(1) + '" stroke="#e5e7eb" stroke-width="1"/>'
        + '<text x="' + (LE_TRAI - 8) + '" y="' + (y + 4).toFixed(1)
        + '" font-size="10" fill="#6b7280" text-anchor="end">' + lamGon(gt) + '</text>';
    }

    // Nhãn trục ngang — nhiều nhất ~8 nhãn, chọn theo CHỈ SỐ trong danh sách
    // điểm THẬT SỰ CÓ DỮ LIỆU (không theo vị trí tuyệt đối trên trục): sổ
    // bán hàng có ngày trống (nghỉ, chưa nhập...), một mốc chia đều theo vị
    // trí tuyệt đối dễ rơi đúng vào ngày trống và không nhãn nào hiện ra cả.
    const timSanCoVt = (vt) => {
      const a = diemNay.find((p) => p.vt === vt);
      return a || diemTruoc.find((p) => p.vt === vt);
    };
    const tapVt = [...new Set([...diemNay, ...diemTruoc].map((p) => p.vt))].sort((a, b) => a - b);
    let nhanTruc = "";
    if (tapVt.length) {
      const buocChiSo = Math.max(1, Math.ceil(tapVt.length / 8));
      const chiSoHien = new Set();
      for (let i = 0; i < tapVt.length; i += buocChiSo) chiSoHien.add(i);
      chiSoHien.add(tapVt.length - 1); // luôn có nhãn ở mốc mới nhất
      for (const i of chiSoHien) {
        const p = timSanCoVt(tapVt[i]);
        const nx = x(p.vt, 1, vtMax);
        nhanTruc += '<text x="' + nx.toFixed(1) + '" y="' + (CAO - 6)
          + '" font-size="10" fill="#6b7280" text-anchor="middle">' + thoat(nhanFn(p.khoa)) + '</text>';
      }
    }

    return (
      '<svg viewBox="0 0 ' + RONG + ' ' + CAO + '" width="100%" role="img" aria-label="Biểu đồ doanh số theo thời gian">'
      + luoi + nhanTruc
      + (dTruoc ? '<path d="' + dTruoc + '" fill="none" stroke="' + MAU_TRUOC + '" stroke-width="2" stroke-dasharray="5,4"/>' : "")
      + (dNay ? '<path d="' + dNay + '" fill="none" stroke="' + MAU_NAY + '" stroke-width="2.5"/>' : "")
      + "</svg>"
    );
  }

  /* Tab "năm" — chỉ MỘT vị trí mỗi năm, đường kẻ không có nghĩa, chuyển
   * sang hai cột so trực tiếp năm nay / năm trước. */
  function veBieuDoNam(theoNam, namNay, namTruoc) {
    const nay = (theoNam[namNay] && theoNam[namNay][1] && theoNam[namNay][1].doanh_so) || 0;
    const truoc = namTruoc != null ? ((theoNam[namTruoc] && theoNam[namTruoc][1] && theoNam[namTruoc][1].doanh_so) || 0) : null;
    const max = Math.max(1, nay, truoc || 0);
    const RONG = 640, CAO = 220, LE_TREN = 20, LE_DUOI = 30, DAY_COT = 140;
    const caoVe = CAO - LE_TREN - LE_DUOI;
    const cot = (x, v, mau, nhan) => {
      const h = (v / max) * caoVe;
      return '<rect x="' + x + '" y="' + (LE_TREN + caoVe - h).toFixed(1) + '" width="' + DAY_COT
        + '" height="' + h.toFixed(1) + '" rx="4" fill="' + mau + '"/>'
        + '<text x="' + (x + DAY_COT / 2) + '" y="' + (LE_TREN + caoVe - h - 8).toFixed(1)
        + '" font-size="13" fill="#1f2430" text-anchor="middle" font-weight="600">' + lamGon(v) + '</text>'
        + '<text x="' + (x + DAY_COT / 2) + '" y="' + (CAO - 8)
        + '" font-size="12" fill="#4b5563" text-anchor="middle">' + thoat(nhan) + '</text>';
    };
    let svg = '<svg viewBox="0 0 ' + RONG + ' ' + CAO + '" width="100%" role="img" aria-label="So doanh số năm nay và năm trước">';
    svg += cot(220, nay, MAU_NAY, String(namNay));
    if (truoc != null) svg += cot(380, truoc, MAU_TRUOC, String(namTruoc));
    svg += "</svg>";
    return svg;
  }

  function chuGiai(namNay, namTruoc) {
    return (
      '<div class="chuGiaiSk">'
      + '<span><i style="background:' + MAU_NAY + '"></i>Năm ' + namNay + '</span>'
      + (namTruoc != null ? '<span><i style="background:' + MAU_TRUOC + ';border-style:dashed"></i>Năm ' + namTruoc + '</span>' : "")
      + '<span class="donViSk">Đơn vị trục dọc: nghìn đồng</span>'
      + "</div>"
    );
  }

  /* ---- Điều phối màn hình — phần duy nhất đụng DOM/fetch ---- */

  let duLieuSk = null;   // kết quả /api/bao-cao/suc-khoe, cache lại để đổi tab không gọi lại
  let donViHienTai = "ngay";

  function veTheoDonVi(donVi) {
    const veSk = $("veSucKhoe");
    if (!duLieuSk) return;
    const [namNay, namTruoc] = duLieuSk.hai_nam;
    if (donVi === "nam") {
      veSk.innerHTML = veBieuDoNam(duLieuSk.theo_nam, namNay, namTruoc) + chuGiai(namNay, namTruoc);
      return;
    }
    const theoDonVi = donVi === "thang" ? duLieuSk.theo_thang : duLieuSk.theo_ngay;
    const vtMax = donVi === "thang" ? 12 : 366;
    const nhanFn = donVi === "thang" ? nhanThang : nhanNgay;
    veSk.innerHTML = veBieuDoDuong(theoDonVi, namNay, namTruoc, vtMax, nhanFn) + chuGiai(namNay, namTruoc);
  }

  function chuyenTab(donVi) {
    donViHienTai = donVi;
    for (const nut of document.querySelectorAll("#tabDonViSk .tabNut")) {
      nut.classList.toggle("tabDang", nut.dataset.dv === donVi);
    }
    veTheoDonVi(donVi);
  }

  async function taiSucKhoe() {
    const loiSk = $("loiSucKhoe"), veSk = $("veSucKhoe");
    loiSk.textContent = "";
    veSk.innerHTML = '<p class="dangTai">Đang tải...</p>';
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("Chưa đăng nhập.");
      const token = await user.getIdToken();
      const r = await fetch("/api/bao-cao/suc-khoe", { headers: { Authorization: "Bearer " + token } });
      const than = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(than.loi || ("HTTP " + r.status));
      duLieuSk = than;
      chuyenTab(donViHienTai);
    } catch (e) {
      veSk.innerHTML = "";
      loiSk.textContent = "Không lấy được số liệu: " + e.message;
    }
  }

  function moManSucKhoe() {
    $("manChu").hidden = true;
    $("manSucKhoe").hidden = false;
    taiSucKhoe();
  }
  function dongManSucKhoe() {
    $("manSucKhoe").hidden = true;
    $("manChu").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const theBieuDo = $("theBieuDoKy");
    if (theBieuDo) {
      theBieuDo.addEventListener("click", moManSucKhoe);
      theBieuDo.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); moManSucKhoe(); }
      });
    }
    const nutQuay = $("nutQuaySucKhoe");
    if (nutQuay) nutQuay.addEventListener("click", dongManSucKhoe);
    for (const nut of document.querySelectorAll("#tabDonViSk .tabNut")) {
      nut.addEventListener("click", () => chuyenTab(nut.dataset.dv));
    }
  });
})();
