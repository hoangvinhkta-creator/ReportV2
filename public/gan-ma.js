/* GÁN MÃ SẢN PHẨM NGAY TRÊN BẢNG ĐƠN HÀNG (P4, lát cắt 1).
 *
 * Bấm vào ô "Mã sản phẩm" → chọn một mã đã có trên bảng giá, hoặc "bỏ qua".
 * Quyết định đi sang Tracking (`inv/map`) và có hiệu lực cho MỌI dòng mang
 * cùng câu tên hàng, ở mọi kỳ.
 *
 * ── BỐN ĐIỀU KIỆN CHỦ DỰ ÁN CHỐT, VÀ CÁCH TỪNG CÁI ĐƯỢC GIỮ ──
 *
 * "không tải lại trang"  → mọi thứ chạy trong chỗ; không `location.reload()`,
 *                          không gọi lại `taiKy()`.
 * "không nhảy dòng"      → KHÔNG vẽ lại bảng. Chỉ sửa `textContent` và
 *                          `className` của đúng những ô liên quan, nên vị trí
 *                          cuộn và thứ tự dòng không đổi một pixel.
 * "không biến dạng cột"  → bề rộng cột chốt cố định bằng `<colgroup>` +
 *                          `table-layout: fixed` (don-hang.js). Điền chữ vào
 *                          một ô đang trống không còn nống được cột nữa.
 * "ngay lúc bấm chuột"   → ô chọn là một lớp phủ `position: fixed` NỔI TRÊN
 *                          bảng, không phải một widget nhét vào trong <td>.
 *                          Mọi thứ phình ra bên trong ô đều đẩy bố cục.
 *
 * LUẬT SỐ 1: file này KHÔNG có một luật khớp mã nào. Nó gửi câu tên hàng
 * lên, nhận về mã; khoá `inv/map` do Engine tính và Tracking xác nhận. Thứ
 * duy nhất nó tự làm là lọc chữ trong ô tìm kiếm — đó là tìm kiếm trên màn
 * hình, không phải luật nghiệp vụ.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* Danh sách mã tải MỘT LẦN cho mỗi phiên mở trang: bảng giá có hàng nghìn
     mã và nó không đổi giữa hai lượt bấm. `null` = chưa tải. */
  let dsMa = null;
  let dangTai = null;

  async function goi(duong, tuyChon) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("chua-dang-nhap");
    const token = await user.getIdToken();
    const r = await fetch(duong, {
      ...tuyChon,
      headers: {
        Authorization: "Bearer " + token,
        ...(tuyChon && tuyChon.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const js = await r.json().catch(() => null);
    if (!r.ok) throw new Error((js && js.loi) || "Máy chủ không trả lời.");
    return js;
  }

  async function taiDsMa() {
    if (dsMa) return dsMa;
    if (!dangTai) dangTai = goi("/api/ma-bang-gia").then((js) => {
      dsMa = (js && js.ds) || [];
      return dsMa;
    }).catch((e) => { dangTai = null; throw e; });
    return dangTai;
  }

  /* ---- Lớp phủ chọn mã ---- */

  let dongPicker = null;   // hàm đóng lớp phủ đang mở

  function dongNeuDangMo() { if (dongPicker) dongPicker(); }

  /** Mở ô chọn mã cho một câu tên hàng.
   *
   *  `khiXong(ma, muc)` được gọi sau khi Tracking đã nhận — `muc` là dòng
   *  trong danh sách mã (có `hang`/`nhom` để vá hai cột kia), hoặc `null`
   *  khi người dùng chọn "bỏ qua". */
  async function moChonMa(ten, maHienTai, khiXong) {
    dongNeuDangMo();

    const phu = document.createElement("div");
    phu.className = "phuGanMa";
    const hop = document.createElement("div");
    hop.className = "hopGanMa";
    phu.appendChild(hop);

    const tieuDe = document.createElement("div");
    tieuDe.className = "ganMaTieuDe";
    tieuDe.textContent = "Tên hàng này là mã nào trên bảng giá?";
    hop.appendChild(tieuDe);

    const cauTen = document.createElement("div");
    cauTen.className = "ganMaTen";
    cauTen.textContent = ten;
    hop.appendChild(cauTen);

    const nhac = document.createElement("div");
    nhac.className = "ganMaNhac";
    nhac.textContent = "Máy KHÔNG tự đoán. Quyết định này ghi sang bảng phân loại "
      + "của Tracking và áp cho mọi dòng mang đúng tên hàng này.";
    hop.appendChild(nhac);

    const oTim = document.createElement("input");
    oTim.type = "text";
    oTim.className = "ganMaTim";
    oTim.placeholder = "Gõ mã hoặc tên trên bảng giá...";
    hop.appendChild(oTim);

    const tinh = document.createElement("div");
    tinh.className = "ganMaTinh";
    tinh.textContent = "Đang tải bảng giá...";
    hop.appendChild(tinh);

    const ds = document.createElement("div");
    ds.className = "ganMaDs";
    hop.appendChild(ds);

    const hangNut = document.createElement("div");
    hangNut.className = "ganMaNut";
    const nutBo = document.createElement("button");
    nutBo.className = "nutPhu";
    nutBo.textContent = "✕ Bỏ qua tên hàng này";
    nutBo.title = "Không phải sản phẩm cần gán mã";
    const nutDong = document.createElement("button");
    nutDong.className = "nutPhu";
    nutDong.textContent = "Đóng";
    hangNut.appendChild(nutBo);
    hangNut.appendChild(nutDong);
    hop.appendChild(hangNut);

    document.body.appendChild(phu);

    let daDong = false;
    const dong = () => {
      if (daDong) return;
      daDong = true;
      document.removeEventListener("keydown", nghePhim);
      phu.remove();
      dongPicker = null;
    };
    dongPicker = dong;

    function nghePhim(e) { if (e.key === "Escape") dong(); }
    document.addEventListener("keydown", nghePhim);
    /* Bấm ra ngoài hộp thì đóng — nhưng KHÔNG đóng khi bấm bên trong, kể cả
       khi con trỏ nhả chuột ra ngoài lúc đang bôi chọn chữ trong ô tìm. */
    phu.addEventListener("mousedown", (e) => { if (e.target === phu) dong(); });
    nutDong.addEventListener("click", dong);

    /* ---- Gửi quyết định ---- */
    let danGui = false;
    async function chon(ma, muc) {
      if (danGui) return;
      danGui = true;
      tinh.textContent = "Đang ghi sang Tracking...";
      tinh.className = "ganMaTinh";
      try {
        const js = await goi("/api/gan-ma", {
          method: "POST", body: JSON.stringify({ ten, ma }),
        });
        /* Tracking từ chối (mã đã xoá, đang ở Tồn kho…) — nói RÕ lý do ngay
           trong lớp phủ và để nó mở, vì người dùng còn phải chọn lại. */
        if (!js.ghi) {
          tinh.textContent = js.cau || "Chưa ghi được.";
          tinh.className = "ganMaTinh ganMaLoi";
          danGui = false;
          return;
        }
        dong();
        khiXong(ma === "-" ? null : ma, muc || null);
      } catch (e) {
        tinh.textContent = e.message || "Chưa ghi được.";
        tinh.className = "ganMaTinh ganMaLoi";
        danGui = false;
      }
    }

    nutBo.addEventListener("click", () => chon("-", null));

    /* ---- Danh sách mã ---- */
    let tatCa;
    try {
      tatCa = await taiDsMa();
    } catch (e) {
      tinh.textContent = "Chưa tải được bảng giá: " + (e.message || "");
      tinh.className = "ganMaTinh ganMaLoi";
      return;
    }
    if (daDong) return;

    const TOI_DA = 60;
    function ve() {
      const q = oTim.value.trim().toUpperCase();
      ds.innerHTML = "";
      if (!q) {
        tinh.textContent = tatCa.length.toLocaleString("vi-VN")
          + " mã trên bảng giá — gõ để tìm.";
        tinh.className = "ganMaTinh";
        return;
      }
      const hop2 = tatCa.filter((m) =>
        String(m.ma).toUpperCase().includes(q) || String(m.ten).toUpperCase().includes(q));
      if (!hop2.length) {
        tinh.textContent = "Không có mã nào khớp. Cần mã mới thì thêm bên Bảng giá "
          + "của Tracking trước, rồi quay lại chọn.";
        tinh.className = "ganMaTinh";
        return;
      }
      tinh.textContent = hop2.length > TOI_DA
        ? "Thấy " + hop2.length + " mã — hiện " + TOI_DA + " mã đầu, gõ thêm để thu hẹp."
        : "Thấy " + hop2.length + " mã.";
      tinh.className = "ganMaTinh";
      for (const m of hop2.slice(0, TOI_DA)) {
        const nut = document.createElement("button");
        nut.className = "ganMaMuc" + (m.ma === maHienTai ? " dangChon" : "");
        const t1 = document.createElement("span");
        t1.className = "ganMaMa";
        t1.textContent = m.ten;
        const t2 = document.createElement("span");
        t2.className = "ganMaNhom";
        t2.textContent = (m.nhom || "Chưa phân loại")
          + (m.ma === maHienTai ? " · đang chọn" : "");
        nut.appendChild(t1);
        nut.appendChild(t2);
        nut.addEventListener("click", () => chon(m.ma, m));
        ds.appendChild(nut);
      }
    }
    oTim.addEventListener("input", ve);
    ve();
    oTim.focus();
  }

  window.GanMa = { moChonMa, dongNeuDangMo };
})();
