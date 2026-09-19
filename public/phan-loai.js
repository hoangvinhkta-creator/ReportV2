/* PHÂN LOẠI THỦ CÔNG NGAY TRÊN BẢNG ĐƠN — chủ dự án chốt 19/09/2026.
 *
 * Bấm vào ô "Hãng" hoặc ô "Ngành hàng" của một dòng CHƯA có mã bảng giá →
 * một lớp phủ: hãng thì gõ vài ký tự ra gợi ý, ngành hàng thì trình chọn cố
 * định những ngành có sẵn. Quyết định áp cho MỌI dòng mang cùng câu tên
 * hàng, ở mọi kỳ.
 *
 * ── VÌ SAO MỘT LỚP PHỦ LÀM CẢ HAI Ô, KHÔNG PHẢI HAI LƯỢT ──
 *
 * Hai ô luôn được trả lời cùng một lúc: nhìn thấy "Tủ lạnh Hitachi 500L" thì
 * biết ngay cả hãng lẫn ngành. Tách làm hai lượt bấm là hai lần mở, hai lần
 * đọc lại đúng câu tên ấy, hai lượt ghi — đúng thứ "ít thao tác trùng lặp"
 * loại trừ. Bấm ô nào thì ô đó được đặt con trỏ trước, thế là đủ.
 *
 * ── LUẬT SỐ 1 ──
 *
 * File này KHÔNG có một luật phân loại nào. Danh sách hãng và ngành đến từ
 * `/api/phan-loai/muc` — tức từ `brand`/`category_label` CÓ THẬT trên bảng
 * giá Tracking. Nó không đoán hãng từ tên hàng, không gợi ý theo độ giống,
 * không cho gõ một hãng mới: gõ tự do CHÍNH LÀ một danh sách hãng thứ hai,
 * chỉ là nó lớn lên mỗi lần một dòng mà không ai thấy (CLAUDE.md).
 *
 * Thứ duy nhất nó tự làm là LỌC CHỮ trong ô tìm — tìm kiếm trên màn hình,
 * không phải luật nghiệp vụ. Và máy chủ vẫn đối chiếu lại danh sách ấy lúc
 * ghi, vì màn hình thì sửa được bằng Console.
 *
 * ── BỐN ĐIỀU KIỆN CỦA BẢNG ĐƠN VẪN NGUYÊN ──
 *
 * Cùng bốn điều kiện chủ dự án chốt cho màn gán mã (xem `gan-ma.js`): không
 * tải lại trang, không nhảy dòng, không biến dạng cột, mở ngay lúc bấm. Nên
 * lớp phủ này cũng là `position: fixed` nổi trên bảng, và lượt vá sau khi
 * ghi chỉ sửa `textContent` của đúng những ô liên quan.
 */
(function () {
  "use strict";

  /* Danh sách hãng/ngành tải MỘT LẦN mỗi phiên mở trang: nó đến từ bảng giá,
     và bảng giá không đổi giữa hai lượt bấm. `null` = chưa tải. */
  let muc = null;
  let dangTai = null;

  async function goi(duong, tuyChon) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("chua-dang-nhap");
    const token = await user.getIdToken();
    const r = await fetch(duong, {
      ...tuyChon,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(tuyChon && tuyChon.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const js = await r.json().catch(() => null);
    if (!r.ok) throw new Error((js && js.loi) || "Máy chủ không trả lời.");
    return js;
  }

  async function taiMuc() {
    if (muc) return muc;
    if (!dangTai) dangTai = goi("/api/phan-loai/muc").then((js) => {
      muc = { hang: (js && js.hang) || [], nganh: (js && js.nganh) || [] };
      return muc;
    }).catch((e) => { dangTai = null; throw e; });
    return dangTai;
  }

  const el = (the, lop, chu) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  };

  let dongPicker = null;
  function dongNeuDangMo() { if (dongPicker) dongPicker(); }

  /** Mở lớp phủ phân loại cho một câu tên hàng.
   *
   *  `khoa` là `khoa_ten` do Engine dựng và gắn sẵn vào ô — màn hình KHÔNG
   *  tự dựng khoá, vì công thức khoá là một luật khớp mã (LUẬT SỐ 1).
   *  `khiXong(hang, nganh)` chạy sau khi máy chủ đã nhận.
   *  `oTap` ("hang" | "nganh") quyết định ô nào được đặt con trỏ trước. */
  async function moPhanLoai(ten, khoa, hienTai, oTap, khiXong) {
    dongNeuDangMo();

    let chonHang = (hienTai && hienTai.hang) || null;
    let chonNganh = (hienTai && hienTai.nganh) || null;

    const phu = el("div", "phuGanMa");
    const hop = el("div", "hopGanMa hopPhanLoai");
    phu.appendChild(hop);

    hop.appendChild(el("div", "ganMaTieuDe", "Mặt hàng này thuộc hãng nào, ngành nào?"));
    hop.appendChild(el("div", "ganMaTen", ten));
    hop.appendChild(el("div", "ganMaNhac",
      "Máy KHÔNG tự đoán. Chỉ chọn được hãng và ngành ĐÃ CÓ trên bảng giá "
      + "Tracking. Quyết định áp cho mọi dòng mang đúng tên hàng này, ở mọi kỳ — "
      + "và mất hiệu lực nếu sau này tên hàng được gán mã."));

    /* ---- Hãng: gõ vài ký tự ra gợi ý ---- */
    hop.appendChild(el("p", "nhanPhanLoai", "Hãng"));
    const oTim = el("input", "ganMaTim");
    oTim.type = "text";
    oTim.placeholder = "Gõ vài ký tự tên hãng...";
    oTim.value = chonHang || "";
    hop.appendChild(oTim);
    const dsHang = el("div", "ganMaDs dsPhanLoai");
    hop.appendChild(dsHang);

    /* ---- Ngành hàng: trình chọn CỐ ĐỊNH ---- */
    hop.appendChild(el("p", "nhanPhanLoai", "Ngành hàng"));
    const oNganh = el("select", "chonNganhPhanLoai");
    hop.appendChild(oNganh);

    const tinh = el("div", "ganMaTinh", "Đang tải danh sách từ bảng giá...");
    hop.appendChild(tinh);

    const hangNut = el("div", "ganMaNut");
    const nutRut = el("button", "nutPhu", "✕ Rút lại phân loại");
    nutRut.title = "Xoá quyết định, dòng về lại chưa phân loại";
    const nutLuu = el("button", "nutPhu", "Lưu");
    const nutDong = el("button", "nutPhu", "Đóng");
    hangNut.appendChild(nutRut);
    hangNut.appendChild(nutDong);
    hangNut.appendChild(nutLuu);
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
    phu.addEventListener("mousedown", (e) => { if (e.target === phu) dong(); });
    nutDong.addEventListener("click", dong);

    /* ---- Gửi quyết định ---- */
    let danGui = false;
    async function gui(hang, nganh) {
      if (danGui) return;
      danGui = true;
      tinh.textContent = "Đang ghi...";
      tinh.className = "ganMaTinh";
      try {
        const js = await goi("/api/phan-loai", {
          method: "POST", body: JSON.stringify({ khoa, hang, nganh }),
        });
        dong();
        /* Dùng chuỗi MÁY CHỦ dội lại, không dùng chuỗi vừa chọn trên màn:
           máy chủ quy về cách viết chính tắc của bảng giá, và hai cách viết
           lệch hoa thường là hai hãng, hai màu, hai mảng trên biểu đồ. */
        khiXong(js.hang || null, js.nganh || null);
      } catch (e) {
        tinh.textContent = cauLoi(e.message);
        tinh.className = "ganMaTinh ganMaLoi";
        danGui = false;
      }
    }
    nutRut.addEventListener("click", () => gui(null, null));
    nutLuu.addEventListener("click", () => {
      if (!chonHang && !chonNganh) {
        tinh.textContent = "Chưa chọn gì. Chọn hãng hoặc ngành, hoặc bấm Rút lại.";
        tinh.className = "ganMaTinh ganMaLoi";
        return;
      }
      gui(chonHang, chonNganh);
    });

    /* ---- Danh sách, sau khi tải xong ---- */
    let bo;
    try {
      bo = await taiMuc();
    } catch (e) {
      tinh.textContent = "Chưa tải được danh sách từ bảng giá: " + cauLoi(e.message);
      tinh.className = "ganMaTinh ganMaLoi";
      return;
    }
    if (daDong) return;

    /* Ngành hàng: MỌI ngành có sẵn, một trình chọn cố định (chủ dự án chốt).
       Nó ngắn — vài chục mục — nên không cần ô tìm như hãng. */
    const trong = el("option", null, "— chưa chọn —");
    trong.value = "";
    oNganh.appendChild(trong);
    for (const n of bo.nganh) {
      const op = el("option", null, n);
      op.value = n;
      if (n === chonNganh) op.selected = true;
      oNganh.appendChild(op);
    }
    /* Ngành đang gán mà KHÔNG còn trên bảng giá (bảng giá đổi sau lượt gán):
       vẫn phải hiện ra, không thì trình chọn lặng lẽ nhảy về "chưa chọn" và
       một lượt Lưu vô tình xoá mất quyết định cũ. */
    if (chonNganh && bo.nganh.indexOf(chonNganh) < 0) {
      const op = el("option", null, chonNganh + " (không còn trên bảng giá)");
      op.value = chonNganh;
      op.selected = true;
      oNganh.appendChild(op);
    }
    oNganh.addEventListener("change", () => { chonNganh = oNganh.value || null; });

    const TOI_DA = 40;
    function veHang() {
      const q = oTim.value.trim().toLowerCase();
      dsHang.innerHTML = "";
      /* Gõ trùng khít tên một hãng thì coi như đã chọn hãng ấy — không bắt
         bấm thêm một lượt vào đúng cái mục vừa gõ ra. */
      const khit = bo.hang.find((h) => h.toLowerCase() === q);
      if (khit) chonHang = khit;
      else if (!q) chonHang = null;

      const hop2 = q ? bo.hang.filter((h) => h.toLowerCase().includes(q)) : bo.hang;
      if (!hop2.length) {
        tinh.textContent = "Không có hãng nào khớp. Hãng mới phải thêm bên Bảng giá "
          + "của Tracking trước, rồi quay lại chọn.";
        tinh.className = "ganMaTinh";
        return;
      }
      tinh.textContent = hop2.length > TOI_DA
        ? "Thấy " + hop2.length + " hãng — hiện " + TOI_DA + " mục đầu, gõ thêm để thu hẹp."
        : "Thấy " + hop2.length + " hãng.";
      tinh.className = "ganMaTinh";
      for (const h of hop2.slice(0, TOI_DA)) {
        const nut = el("button", "ganMaMuc" + (h === chonHang ? " dangChon" : ""));
        nut.appendChild(el("span", "ganMaMa", h));
        if (h === chonHang) nut.appendChild(el("span", "ganMaNhom", "đang chọn"));
        nut.addEventListener("click", () => {
          chonHang = h;
          oTim.value = h;
          veHang();
        });
        dsHang.appendChild(nut);
      }
    }
    oTim.addEventListener("input", veHang);
    veHang();
    if (oTap === "nganh") oNganh.focus();
    else { oTim.focus(); oTim.select(); }
  }

  /** Câu lỗi hiện ra trong lớp phủ.
   *
   *  Gateway KHÔNG đẩy mã lỗi nội bộ xuống trình duyệt (CLAUDE.md), nên thứ
   *  tới đây là câu chữ đã viết sẵn ở máy chủ — kể cả câu riêng cho ca "giá
   *  trị không có trên bảng giá", ca người dùng sẽ gặp thật và tự sửa được.
   *  Việc của hàm này chỉ là đừng để một chuỗi rỗng hiện ra thành một hộp
   *  báo lỗi không nói gì. */
  function cauLoi(cau) {
    return String(cau || "").trim() || "Chưa ghi được — thử lại sau ít phút.";
  }

  window.PhanLoai = { moPhanLoai, dongNeuDangMo };
})();
