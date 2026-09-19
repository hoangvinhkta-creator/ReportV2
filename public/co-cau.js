/* BIỂU ĐỒ CƠ CẤU NGÀNH HÀNG × HÃNG — chủ dự án chốt 19/09/2026.
 *
 * Cột chồng, hai tầng ý nghĩa, đúng như chủ dự án mô tả:
 *
 *   chiều cao cột = ngành hàng ấy chiếm bao nhiêu % doanh số của tháng
 *   ruột cột      = trong ngành ấy, hãng nào chiếm bao nhiêu
 *
 * "Tháng 8 tủ lạnh chiếm 50% → cột cao 50%; trong cột, tủ lạnh Samsung
 * chiếm 50% → màu Samsung tô nửa cột."
 *
 * Mỗi ngành có HAI cột đứng cạnh nhau: tháng đang xem, và cùng kỳ năm
 * trước (cột năm trước nhạt hơn).
 *
 * ── LUẬT SỐ 1 ──
 *
 * File này KHÔNG cộng một đồng nào. Phép gộp "top 8 ngành", "hãng dưới 5%
 * thành Khác", phép chia tỉ lệ, phép đếm độ phủ — tất cả ở Engine
 * (`engine/src/co-cau.mjs`), và về đây đã thành đúng những cột phải vẽ kèm
 * số đã cộng sẵn. Việc của file này là ĐẶT BÚT: chọn màu, xếp chỗ, và bắt
 * chuột.
 *
 * Thứ duy nhất nó tự tính là PHẦN TRĂM ĐỂ VẼ (`gia_tri / tong`) — đó là một
 * phép quy đổi sang chiều cao pixel, không phải một con số người đọc ra.
 *
 * ── MÀU ──
 *
 * Gam pastel, chủ dự án chốt: màn này mở cả buổi, màu bão hoà cạnh nhau
 * mười mảng là chói mắt. Màu gán theo TÊN HÃNG chứ không theo vị trí trong
 * cột — Samsung phải là một màu ở mọi ngành và ở cả hai cột, không thì hai
 * cột cạnh nhau hết so được với nhau.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";

  /** Bảng màu pastel. Mười hai màu đủ tách nhau về sắc độ để cạnh nhau vẫn
   *  phân biệt được, và đều nhạt ngang nhau nên không màu nào tự nhảy lên
   *  trước mắt.
   *
   *  "Khác" và "Chưa rõ hãng" KHÔNG lấy màu trong bảng này: chúng là những
   *  mảng phải đọc ra ngay là "phần gộp", nên chúng xám. */
  const MAU = [
    "#a7c7e7", "#f6c7b6", "#b7dfc0", "#e7c6e0", "#f2dda4", "#b9c9e8",
    "#f0b9b9", "#a8dcd9", "#d9c7a7", "#c9b8e4", "#bfe0a8", "#f2c6d4",
  ];
  const MAU_KHAC = "#d6d8de";
  const MAU_CHUA_PHAN_LOAI = "#c2c5cc";

  /** Màu của một hãng — chốt theo TÊN, bền qua mọi cột và cả hai tháng.
   *
   *  Vân tay FNV-1a của tên, không phải thứ tự xuất hiện: xếp theo thứ tự
   *  thì Samsung là màu #1 ở cột Tủ lạnh và màu #3 ở cột Tivi, và người đọc
   *  không còn quét màu dọc được nữa. */
  function mauHang(ten) {
    let h = 0x811c9dc5;
    for (let i = 0; i < ten.length; i++) {
      h ^= ten.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return MAU[h % MAU.length];
  }

  function el(the, lop, chu) {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  }
  function nut(the, lop) {
    const n = document.createElementNS(SVG, the);
    if (lop) n.setAttribute("class", lop);
    return n;
  }
  const thoat = (s) => String(s === null || s === undefined ? "" : s);

  /** Tiền gọn: 1.234.567 → "1,2 tr". Chỉ là CÁCH VIẾT một con số máy chủ đã
   *  tính, không phải một phép quy đổi nghiệp vụ. */
  function gonTien(v) {
    const n = Number(v) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(".", ",") + " tỷ";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + " tr";
    if (n >= 1e3) return Math.round(n / 1e3) + " ng";
    return String(Math.round(n));
  }
  const soNguyen = (v) => (Number(v) || 0).toLocaleString("vi-VN");
  const pt1 = (v) => (Math.round(v * 10) / 10).toString().replace(".", ",");

  /* ═══════════ Trạng thái ═══════════
     Chỉ là trạng thái MÀN HÌNH — không lưu đâu cả. */
  const trangThai = {
    ky: null,
    kq: null,
    chiTieu: "doanh_so",   // "doanh_so" | "so_may"
    boChuaPhanLoai: false, // nút [Chỉ phần đã phân loại]
    dangTai: false,
  };

  let oVe = null, oTieuDe = null;

  async function goi(duong) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    const r = await fetch(duong, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token },
    });
    const js = await r.json().catch(() => null);
    if (!r.ok) throw new Error((js && js.loi) || "Máy chủ không trả lời.");
    return js;
  }

  /** Màn báo cáo gọi vào đây mỗi lượt vẽ lại Dashboard. */
  function ve(elVe, elTieuDe, ky) {
    oVe = elVe; oTieuDe = elTieuDe;
    if (!oVe) return;
    if (!ky) { oVe.innerHTML = ""; datTieuDe(""); return; }
    if (trangThai.ky === ky && trangThai.kq) { veRuot(); return; }
    trangThai.ky = ky;
    trangThai.kq = null;
    tai(ky);
  }

  function datTieuDe(chu) { if (oTieuDe) oTieuDe.innerHTML = chu; }

  async function tai(ky) {
    if (trangThai.dangTai) return;
    trangThai.dangTai = true;
    oVe.innerHTML = '<p class="dangTai">Đang tải cơ cấu…</p>';
    datTieuDe("Cơ cấu ngành hàng");
    try {
      const kq = await goi("/api/co-cau?ky=" + encodeURIComponent(ky));
      /* Người dùng đã bấm sang tháng khác trong lúc chờ — bỏ kết quả cũ,
         không vẽ đè lên tháng đang mở. */
      if (trangThai.ky !== ky) return;
      trangThai.kq = kq;
      veRuot();
    } catch (e) {
      oVe.innerHTML = "";
      oVe.appendChild(el("p", "canhBao", "Không lấy được cơ cấu ngành hàng: " + e.message));
    } finally {
      trangThai.dangTai = false;
    }
  }

  /* ═══════════ Vẽ ═══════════ */

  function nhanKy(ky) {
    const m = String(ky || "").match(/^(\d{4})-(\d{2})$/);
    return m ? "T" + Number(m[2]) + "/" + m[1] : String(ky || "");
  }

  function veRuot() {
    const kq = trangThai.kq;
    if (!oVe || !kq) return;
    oVe.innerHTML = "";

    const bo = trangThai.chiTieu === "so_may" ? kq.theo_so_may : kq.theo_doanh_so;
    const laTien = trangThai.chiTieu === "doanh_so";

    datTieuDe("Cơ cấu ngành hàng · " + thoat(nhanKy(kq.ky))
      + ' <span class="donViCua">(' + (laTien ? "doanh số" : "số máy") + ")</span>");

    oVe.appendChild(veDaiNut(kq));

    /* Tracking hỏng thì KHÔNG dòng nào có hãng — mọi thứ rơi vào "Chưa phân
       loại". Nói thẳng: một sự cố mạng không được phép kết luận "tháng này
       chưa phân loại được gì" thay người (CLAUDE.md). */
    if (kq.loi_nguon_ma) {
      oVe.appendChild(el("p", "bangConNo",
        "⚠ Chưa đọc được bảng giá Tracking lượt này, nên chưa xếp được dòng nào "
        + "vào ngành hàng. Biểu đồ trống vì lý do ĐÓ, không phải vì tháng này "
        + "không bán gì."));
      return;
    }

    const khung = el("div", "khoiCoCau");
    khung.appendChild(veSvg(bo, kq, laTien));
    oVe.appendChild(khung);
    oVe.appendChild(veChuGiaiDoPhu(kq, laTien));
  }

  function veDaiNut(kq) {
    const dai = el("div", "daiCoCau");

    const nhom = el("div", "tabDonVi");
    for (const [ma, ten] of [["doanh_so", "Doanh số"], ["so_may", "Số máy"]]) {
      const b = el("button", "tabNut tabNho" + (trangThai.chiTieu === ma ? " tabDang" : ""), ten);
      b.type = "button";
      b.addEventListener("click", () => {
        if (trangThai.chiTieu === ma) return;
        trangThai.chiTieu = ma;
        veRuot();
      });
      nhom.appendChild(b);
    }
    dai.appendChild(nhom);

    /* Nút thứ hai chỉ có nghĩa khi còn phần chưa phân loại. Hiện nó ở tháng
       đã gán hết là một cái nút bấm vào không đổi gì. */
    const dp = kq.do_phu && kq.do_phu.nay;
    const con = dp && (trangThai.chiTieu === "doanh_so" ? dp.doanh_so_pt : dp.so_may_pt);
    if (con !== null && con !== undefined && con < 100) {
      const b = el("button", "tabNut tabNho" + (trangThai.boChuaPhanLoai ? " tabDang" : ""),
        "Chỉ phần đã phân loại");
      b.type = "button";
      b.title = "Bỏ cột xám ra và lấy 100% = phần đã biết. Độ phủ vẫn ghi ở dưới.";
      b.addEventListener("click", () => {
        trangThai.boChuaPhanLoai = !trangThai.boChuaPhanLoai;
        veRuot();
      });
      const cuoi = el("div", "cuoiDaiCoCau");
      cuoi.appendChild(b);
      dai.appendChild(cuoi);
    }
    return dai;
  }

  /** Cột nào được vẽ, và mẫu số của phần trăm.
   *
   *  Hai cách đọc, chủ dự án chốt 19/09/2026:
   *   · mặc định — cột xám "Chưa phân loại" đứng trên trục, 100% = cả tháng;
   *   · bật nút — bỏ cột xám, 100% = phần ĐÃ phân loại.
   *  Không cách nào nói dối, miễn là độ phủ luôn ghi ở dưới. */
  function chonCot(m) {
    const cot = trangThai.boChuaPhanLoai
      ? m.cot.filter((c) => !c.la_chua_phan_loai) : m.cot;
    const tong = trangThai.boChuaPhanLoai
      ? Math.max(0, m.tong - (m.chua_phan_loai || 0)) : m.tong;
    return { cot, tong };
  }

  const RONG = 1000, CAO = 420;
  const LE_TRAI = 42, LE_PHAI = 10, LE_TREN = 14, LE_DUOI = 58;

  function veSvg(bo, kq, laTien) {
    const A = chonCot(bo.nay), B = chonCot(bo.truoc);
    const ten = A.cot.map((c) => c.ten);

    const svg = nut("svg");
    svg.setAttribute("viewBox", "0 0 " + RONG + " " + CAO);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "svgCoCau");

    if (!ten.length || !A.tong) {
      const t = nut("text");
      t.setAttribute("x", RONG / 2); t.setAttribute("y", CAO / 2);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "coCauRong");
      t.textContent = "Tháng này chưa có dòng hàng nào để dựng cơ cấu.";
      svg.appendChild(t);
      return svg;
    }

    const rongVe = RONG - LE_TRAI - LE_PHAI;
    const caoVe = CAO - LE_TREN - LE_DUOI;
    const oNganh = rongVe / ten.length;
    /* Hai cột trong một ô, cách nhau một rãnh mảnh; hai bên ô chừa lề để
       hai ngành cạnh nhau không dính vào nhau. */
    const leO = oNganh * 0.16, ranh = oNganh * 0.06;
    const rongCot = (oNganh - leO * 2 - ranh) / 2;

    /* Trục dọc 0–100%, vạch mỗi 25%. Luôn 100% dù cột cao nhất chỉ 40%: đây
       là biểu đồ CƠ CẤU, và co trục theo cột cao nhất là mọi tháng trông
       giống nhau bất kể tỉ trọng thật. */
    const y = (pt) => LE_TREN + caoVe - (pt / 100) * caoVe;
    for (let pt = 0; pt <= 100; pt += 25) {
      const l = nut("line", "luoiCoCau");
      l.setAttribute("x1", LE_TRAI); l.setAttribute("x2", RONG - LE_PHAI);
      l.setAttribute("y1", y(pt)); l.setAttribute("y2", y(pt));
      svg.appendChild(l);
      const t = nut("text", "nhanTrucCoCau");
      t.setAttribute("x", LE_TRAI - 8); t.setAttribute("y", y(pt) + 4);
      t.setAttribute("text-anchor", "end");
      t.textContent = pt + "%";
      svg.appendChild(t);
    }

    const timCot = (ds, t) => ds.find((c) => c.ten === t) || null;

    ten.forEach((tenNganh, i) => {
      const x0 = LE_TRAI + i * oNganh;
      veMotCot(svg, timCot(A.cot, tenNganh), A.tong, x0 + leO, rongCot, y, false, laTien, kq.ky);
      if (kq.co_ky_truoc) {
        veMotCot(svg, timCot(B.cot, tenNganh), B.tong,
          x0 + leO + rongCot + ranh, rongCot, y, true, laTien, kq.ky_truoc);
      }

      /* Nhãn ngành: cắt bớt nếu dài hơn ô. Xoay chữ là thứ đọc ra khó hơn
         hẳn một cái tên bị cắt đuôi có `title` đầy đủ. */
      const t = nut("text", "nhanNganh");
      t.setAttribute("x", x0 + oNganh / 2);
      t.setAttribute("y", CAO - LE_DUOI + 20);
      t.setAttribute("text-anchor", "middle");
      const toiDa = Math.max(6, Math.floor(oNganh / 7.2));
      t.textContent = tenNganh.length > toiDa ? tenNganh.slice(0, toiDa - 1) + "…" : tenNganh;
      const tt = nut("title");
      tt.textContent = tenNganh;
      t.appendChild(tt);
      svg.appendChild(t);

      /* Tỉ trọng ghi bằng số dưới tên: mắt đọc chiều cao ra "khoảng một
         nửa", còn con số thật thì phải có ở đâu đó mà không cần rê chuột. */
      const c = timCot(A.cot, tenNganh);
      const pt = A.tong > 0 && c ? (c.gia_tri / A.tong) * 100 : 0;
      const t2 = nut("text", "nhanNganhPt");
      t2.setAttribute("x", x0 + oNganh / 2);
      t2.setAttribute("y", CAO - LE_DUOI + 36);
      t2.setAttribute("text-anchor", "middle");
      t2.textContent = pt1(pt) + "%";
      svg.appendChild(t2);
    });

    /* Cùng kỳ năm trước chưa nạp sổ — nói thẳng, không để người đọc tự hỏi
       vì sao mỗi ngành chỉ có một cột. */
    if (!kq.co_ky_truoc) {
      const t = nut("text", "coCauGhiChu");
      t.setAttribute("x", LE_TRAI); t.setAttribute("y", LE_TREN + 2);
      t.textContent = "Chưa có dòng hàng của " + nhanKy(kq.ky_truoc)
        + " để so cùng kỳ — chỉ hiện tháng này.";
      svg.appendChild(t);
    }
    return svg;
  }

  function veMotCot(svg, c, tong, x, rong, y, laTruoc, laTien, ky) {
    if (!c || !tong) return;
    const ptCot = (c.gia_tri / tong) * 100;
    if (ptCot <= 0) return;

    /* Ruột cột xếp từ DƯỚI lên, theo đúng thứ tự Engine trả về (hãng lớn
       trước). Hai cột cạnh nhau vì thế xếp cùng một thứ tự — đó là điều kiện
       để so được với nhau bằng mắt. */
    let duoi = y(0);
    const mang = c.hang && c.hang.length
      ? c.hang
      : [{ ten: c.ten, gia_tri: c.gia_tri, la_khac: false, la_tron: true }];

    for (const h of mang) {
      const pt = (h.gia_tri / tong) * 100;
      if (pt <= 0) continue;
      const cao = (pt / 100) * (y(0) - y(100));
      const r = nut("rect", "mangCoCau" + (laTruoc ? " mangTruoc" : ""));
      r.setAttribute("x", x);
      r.setAttribute("width", rong);
      r.setAttribute("y", duoi - cao);
      r.setAttribute("height", Math.max(0.5, cao));
      r.setAttribute("fill", c.la_chua_phan_loai ? MAU_CHUA_PHAN_LOAI
        : h.la_khac ? MAU_KHAC : mauHang(h.ten));
      r.appendChild(chuBay(c, h, pt, ptCot, laTien, ky));
      svg.appendChild(r);
      duoi -= cao;
    }
  }

  /** Nội dung rê chuột. Dùng `<title>` của SVG chứ không dựng một hộp nổi
   *  riêng: nó chạy được ở mọi trình duyệt, đọc được bằng trình đọc màn
   *  hình, và không có một hộp nào để quên dọn khi vẽ lại.
   *
   *  Mảng "Khác" liệt kê ĐỦ từng hãng bên trong — chủ dự án chốt "di chuột
   *  vào khu vực đó sẽ thấy được đủ thông tin". */
  function chuBay(c, h, pt, ptCot, laTien, ky) {
    const t = nut("title");
    const so = (v) => (laTien ? gonTien(v) : soNguyen(v) + " máy");
    const dong = [nhanKy(ky) + " · " + c.ten];
    if (c.la_chua_phan_loai) {
      dong.push("Chưa gán mã bảng giá: " + so(c.gia_tri) + " · " + pt1(ptCot) + "% của tháng");
      dong.push("Gán mã bên tab Báo cáo bán hàng là chúng vào đúng ngành.");
    } else if (h.la_tron) {
      dong.push(so(c.gia_tri) + " · " + pt1(ptCot) + "% của tháng");
    } else {
      dong.push(h.ten + ": " + so(h.gia_tri));
      dong.push(pt1(ptCot > 0 ? (pt / ptCot) * 100 : 0) + "% của " + c.ten
        + " · " + pt1(pt) + "% của cả tháng");
      if (h.la_khac && h.gom && h.gom.length) {
        dong.push("— gồm " + h.gom.length + " hãng:");
        for (const g of h.gom) dong.push("   " + g.ten + ": " + so(g.gia_tri));
      }
    }
    t.textContent = dong.join("\n");
    return t;
  }

  /** Độ phủ + chú giải. Con số này là thứ giữ cho biểu đồ không nói dối:
   *  so một tháng đã gán kỹ với một tháng gán ít mà không có nó là bịa ra
   *  một mức tăng trưởng. */
  function veChuGiaiDoPhu(kq, laTien) {
    const p = el("p", "chuGiaiCoCau");
    const dp = kq.do_phu || {};
    const lay = (o) => (o ? (laTien ? o.doanh_so_pt : o.so_may_pt) : null);
    const a = lay(dp.nay), b = lay(dp.truoc);

    const noi = (nhan, v) => (v === null || v === undefined
      ? nhan + ": chưa có dòng hàng"
      : nhan + ": đã phân loại " + pt1(v) + "%");

    p.appendChild(el("span", null, noi(nhanKy(kq.ky), a)));
    if (kq.co_ky_truoc) p.appendChild(el("span", null, noi(nhanKy(kq.ky_truoc), b)));

    /* Hai tháng lệch độ phủ quá xa thì so chúng với nhau là so hai thứ đo
       bằng hai cái thước. Nói ra, đừng để người đọc tự phát hiện. */
    if (a !== null && b !== null && Math.abs(a - b) >= 15) {
      const c = el("span", "canhBaoDoPhu",
        "⚠ hai tháng lệch độ phủ " + pt1(Math.abs(a - b)) + " điểm — so tỉ trọng "
        + "giữa chúng chưa chắc đúng, gán thêm mã cho tháng phủ thấp trước");
      p.appendChild(c);
    }
    return p;
  }

  window.CoCau = { ve };
})();
