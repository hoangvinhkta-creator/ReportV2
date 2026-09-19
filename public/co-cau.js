/* BIỂU ĐỒ CƠ CẤU NGÀNH HÀNG × HÃNG — chủ dự án chốt 19/09/2026.
 *
 * Cột chồng, hai tầng ý nghĩa:
 *
 *   chiều cao cột = ngành hàng ấy chiếm bao nhiêu % doanh số của tháng
 *   ruột cột      = trong ngành ấy, hãng nào chiếm bao nhiêu
 *
 * Mỗi ngành có HAI cột đứng cạnh nhau: tháng đang xem, và cùng kỳ năm trước
 * (cột năm trước nhạt hơn). Bên phải là một CARD: chưa bấm gì thì nó là chú
 * giải màu; bấm vào một mảng thì nó hiện đủ số của đúng mảng ấy.
 *
 * ── BA LỖI CỦA BẢN ĐẦU, VÀ CÁCH SỬA (19/09/2026, sau khi mở thật) ──
 *
 * 1. KHUNG SVG SAI TỈ LỆ. Bản đầu khai `viewBox` cứng 1000×420 rồi để
 *    `preserveAspectRatio="meet"`. Khung thật của cột phải có tỉ lệ khác
 *    hẳn, nên trình duyệt thu hình cho vừa một chiều rồi chừa hai dải trắng
 *    ở chiều kia — đo trên ảnh chụp thật: biểu đồ chỉ chiếm chừng nửa chỗ
 *    đang có. Nay ĐO khung rồi tính `viewBox` theo đúng tỉ lệ ấy, y như
 *    biểu đồ doanh số bên trái vẫn làm từ P2(b).
 *
 * 2. TRỤC DỌC CỨNG 0–100%. Lý do viết hồi ấy ("co trục là mọi tháng trông
 *    giống nhau") nghe hợp lý nhưng sai trên dữ liệu thật: với 8–11 ngành,
 *    KHÔNG ngành nào có thể chiếm quá chừng 35%, nên hai phần ba phía trên
 *    là khoảng trắng vĩnh viễn. Nay trần = làm tròn lên bội số 5% ngay trên
 *    cột cao nhất, sàn 20% để tháng nào cũng có hình dạng ổn định.
 *
 * 3. MÀU BĂM TỪ TÊN. Về lý thì cùng tên ra cùng màu; về mắt thì hai hãng
 *    khác nhau đụng cùng một ô băm là chuyện thường, và khi ấy hai mảng
 *    cùng màu KHÔNG phải cùng một hãng. Nay màu lấy từ `window.MauHang` —
 *    một bảng khai tường minh, dùng chung với hàng tab của màn kích hoạt
 *    bảo hành.
 *
 * ── LUẬT SỐ 1 ──
 *
 * File này KHÔNG cộng một đồng nào. Phép gộp "top 8 ngành", "hãng dưới 5%
 * thành Khác", gộp nhãn ngành, phép đếm độ phủ — tất cả ở Engine
 * (`engine/src/co-cau.mjs`), và về đây đã thành đúng những cột phải vẽ kèm
 * số đã cộng sẵn. Thứ duy nhất nó tự tính là PHẦN TRĂM ĐỂ VẼ — một phép quy
 * đổi sang chiều cao pixel, không phải một con số người đọc ra.
 */
(function () {
  "use strict";

  const SVG = "http://www.w3.org/2000/svg";

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

  /* Bảng màu là MỘT bảng, ở `mau-hang.js`, dùng chung với hàng tab của màn
     kích hoạt bảo hành. Không có màu dự phòng viết ở đây: một bộ màu thứ hai
     — dù chỉ ba mã xám — là đúng thứ vừa gây ra lỗi "mỗi cột một màu khác",
     và nó sẽ chỉ hiện ra ở đúng lúc không ai đang nhìn. Thiếu file kia thì
     `veRuot()` nói một câu và dừng, không vẽ một biểu đồ nửa màu. */
  const mauHang = (ten) => window.MauHang.cua(ten);
  const mauKhac = () => window.MauHang.MAU_KHAC;
  const mauChuaPhanLoai = () => window.MauHang.MAU_CHUA_PHAN_LOAI;

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
  const thoat = (s) => String(s === null || s === undefined ? "" : s);

  function nhanKy(ky) {
    const m = String(ky || "").match(/^(\d{4})-(\d{2})$/);
    return m ? "T" + Number(m[2]) + "/" + m[1] : String(ky || "");
  }

  /* ═══════════ Trạng thái ═══════════
     Chỉ là trạng thái MÀN HÌNH — không lưu đâu cả. */
  const trangThai = {
    ky: null,
    kq: null,
    boChuaPhanLoai: false,   // nút [Chỉ phần đã phân loại]
    /* Mảng đang chọn, ghi theo TÊN chứ không theo phần tử DOM: biểu đồ được
       dựng lại ở mọi lượt vẽ, nên một tham chiếu DOM sẽ chết ngay lượt sau. */
    chon: null,              // { nganh, hang } — `hang` null = chọn cả cột
    dangTai: false,
  };

  let oVe = null, oTieuDe = null;
  /* Ô đang chứa SVG — giữ lại để `canhLai()` đo và vẽ lại đúng nó. */
  let oHinh = null;

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
    /* Đổi tháng thì bỏ mảng đang chọn: nó nói về tháng cũ, và giữ lại là
       card hiện số của một tháng khác với biểu đồ ngay bên cạnh. */
    trangThai.chon = null;
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

  function veRuot() {
    const kq = trangThai.kq;
    if (!oVe || !kq) return;
    oVe.innerHTML = "";

    if (!window.MauHang || !window.MauHang.cua) {
      oVe.appendChild(el("p", "canhBao",
        "Chưa tải được bảng màu (mau-hang.js) — tải lại trang."));
      return;
    }

    datTieuDe("Cơ cấu ngành hàng · " + thoat(nhanKy(kq.ky))
      + ' <span class="donViCua">(doanh số)</span>');

    oVe.appendChild(veDaiNut(kq));

    /* Tracking hỏng thì KHÔNG dòng nào có hãng — mọi thứ rơi vào cột chưa
       phân loại. Nói thẳng: một sự cố mạng không được phép kết luận "tháng
       này chưa phân loại được gì" thay người (CLAUDE.md). */
    if (kq.loi_nguon_ma) {
      oVe.appendChild(el("p", "bangConNo",
        "⚠ Chưa đọc được bảng giá Tracking lượt này, nên chưa xếp được dòng nào "
        + "vào ngành hàng. Biểu đồ trống vì lý do ĐÓ, không phải vì tháng này "
        + "không bán gì."));
      return;
    }

    /* Biểu đồ và card đứng CẠNH nhau trong một hàng: chủ dự án chốt "biểu đồ
       dồn một chút sang trái, chỗ bên phải là một card". */
    const hang = el("div", "khoiCoCau");
    oHinh = el("div", "veCoCau");
    hang.appendChild(oHinh);
    hang.appendChild(veCard(kq));
    oVe.appendChild(hang);
    oVe.appendChild(veChuGiaiDoPhu(kq));

    /* Vẽ SVG SAU khi khối đã nằm trong trang: `viewBox` tính từ bề rộng và
       chiều cao THẬT của ô, nên phải đo được chúng đã. Đây đúng là chỗ bản
       đầu sai — nó khai một tỉ lệ cứng và để trình duyệt tự chừa dải trắng. */
    veHinh(oHinh, kq);
  }

  function veDaiNut(kq) {
    const dai = el("div", "daiCoCau");

    /* KHÔNG còn nút [Doanh số]/[Số máy] (chủ dự án chốt 19/09/2026). Biểu đồ
       luôn nói về doanh số; số máy nay nằm trong card bên phải, cạnh doanh
       số của chính mảng được bấm — đọc cả hai cùng lúc còn hơn phải bấm qua
       lại giữa hai biểu đồ rồi tự nhớ. */

    /* Nút này chỉ có nghĩa khi còn phần chưa phân loại. Hiện nó ở tháng đã
       gán hết là một cái nút bấm vào không đổi gì. */
    const dp = kq.do_phu && kq.do_phu.nay;
    const con = dp && dp.doanh_so_pt;
    if (con !== null && con !== undefined && con < 100) {
      const b = el("button", "tabNut tabNho" + (trangThai.boChuaPhanLoai ? " tabDang" : ""),
        "Chỉ phần đã phân loại");
      b.type = "button";
      b.title = "Bỏ cột xám ra và lấy 100% = phần đã biết. Độ phủ vẫn ghi ở dưới.";
      b.addEventListener("click", () => {
        trangThai.boChuaPhanLoai = !trangThai.boChuaPhanLoai;
        veRuot();
      });
      dai.appendChild(b);
    }
    return dai;
  }

  /** Cột nào được vẽ, và mẫu số của phần trăm.
   *
   *  Hai cách đọc, chủ dự án chốt 19/09/2026:
   *   · mặc định — cột xám chưa phân loại đứng trên trục, 100% = cả tháng;
   *   · bật nút — bỏ cột xám, 100% = phần ĐÃ phân loại.
   *  Không cách nào nói dối, miễn là độ phủ luôn ghi ở dưới. */
  function chonCot(m) {
    const cot = trangThai.boChuaPhanLoai
      ? m.cot.filter((c) => !c.la_chua_phan_loai) : m.cot;
    const tong = trangThai.boChuaPhanLoai
      ? Math.max(0, m.tong - (m.chua_phan_loai || 0)) : m.tong;
    return { cot, tong };
  }

  /* Hệ toạ độ: bề ngang cố định, CHIỀU CAO tính theo tỉ lệ khung thật. */
  const RONG = 1000;
  const LE_TRAI = 46, LE_PHAI = 12, LE_TREN = 10, LE_DUOI = 54;
  /** Sàn của trần trục. Dưới ngưỡng này thì một tháng chỉ có một ngành duy
   *  nhất sẽ vẽ ra một cột chạm nóc, trông như "chiếm trọn" dù nó đúng là
   *  100% — nhưng mắt quen đọc cột chạm nóc là "kịch trần", không phải một
   *  tỉ lệ. Giữ một khoảng thở. */
  const SAN_TRAN_PT = 20;

  /** Trần trục dọc: làm tròn LÊN bội số 5% ngay trên cột cao nhất. */
  function tranTruc(ptMax) {
    const t = Math.ceil((Number(ptMax) || 0) / 5) * 5;
    return Math.max(SAN_TRAN_PT, Math.min(100, t));
  }

  function veHinh(oHinh, kq) {

    const bo = kq.theo_doanh_so;
    const A = chonCot(bo.nay), B = chonCot(bo.truoc);
    const ten = A.cot.map((c) => c.ten);

    /* Đo khung THẬT rồi tính chiều cao hệ toạ độ theo đúng tỉ lệ ấy — không
       có bước này thì SVG tự chừa dải trắng (lỗi số 1 ở đầu file). DOM giả
       của bộ kiểm không có hình học: rơi về một tỉ lệ mặc định hợp lý. */
    const w = oHinh.clientWidth || 0, h = oHinh.clientHeight || 0;
    const CAO = w && h ? Math.round(RONG * h / w) : 420;

    const svg = nut("svg");
    svg.setAttribute("viewBox", "0 0 " + RONG + " " + CAO);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "svgCoCau");
    oHinh.innerHTML = "";
    oHinh.appendChild(svg);

    if (!ten.length || !A.tong) {
      const t = nut("text", "coCauRong");
      t.setAttribute("x", RONG / 2); t.setAttribute("y", CAO / 2);
      t.setAttribute("text-anchor", "middle");
      t.textContent = "Tháng này chưa có dòng hàng nào để dựng cơ cấu.";
      svg.appendChild(t);
      return;
    }

    const rongVe = RONG - LE_TRAI - LE_PHAI;
    const caoVe = Math.max(40, CAO - LE_TREN - LE_DUOI);
    const oNganh = rongVe / ten.length;
    const leO = oNganh * 0.14, ranh = oNganh * 0.06;
    const rongCot = kq.co_ky_truoc
      ? (oNganh - leO * 2 - ranh) / 2
      : oNganh - leO * 2;

    /* Trần theo cột cao nhất của CẢ HAI tháng: lấy riêng tháng này thì cột
       năm trước cao hơn sẽ tràn ra khỏi khung. */
    let ptMax = 0;
    for (const c of A.cot) if (A.tong) ptMax = Math.max(ptMax, (c.gia_tri / A.tong) * 100);
    if (kq.co_ky_truoc) {
      for (const c of B.cot) if (B.tong) ptMax = Math.max(ptMax, (c.gia_tri / B.tong) * 100);
    }
    const tran = tranTruc(ptMax);

    const y = (pt) => LE_TREN + caoVe - (pt / tran) * caoVe;
    const buoc = tran / 4;
    for (let i = 0; i <= 4; i++) {
      const pt = Math.round(buoc * i * 10) / 10;
      const l = nut("line", "luoiCoCau");
      l.setAttribute("x1", LE_TRAI); l.setAttribute("x2", RONG - LE_PHAI);
      l.setAttribute("y1", y(pt)); l.setAttribute("y2", y(pt));
      svg.appendChild(l);
      const t = nut("text", "nhanTrucCoCau");
      t.setAttribute("x", LE_TRAI - 8); t.setAttribute("y", y(pt) + 4);
      t.setAttribute("text-anchor", "end");
      t.textContent = pt1(pt) + "%";
      svg.appendChild(t);
    }

    const timCot = (ds, t) => ds.find((c) => c.ten === t) || null;

    ten.forEach((tenNganh, i) => {
      const x0 = LE_TRAI + i * oNganh;
      veMotCot(svg, timCot(A.cot, tenNganh), A.tong, x0 + leO, rongCot, y, tran, false, kq.ky);
      if (kq.co_ky_truoc) {
        veMotCot(svg, timCot(B.cot, tenNganh), B.tong,
          x0 + leO + rongCot + ranh, rongCot, y, tran, true, kq.ky_truoc);
      }

      /* Nhãn ngành bấm được: bấm vào tên là xem cả cột, không phải một mảng.
         Tên dài đã được Engine viết tắt (LKK, Gia dụng, NONE) nên chỗ này
         hiếm khi phải cắt — vẫn cắt để một tên lạ dài bất thường không đè
         sang cột bên cạnh, và `title` giữ nguyên câu đầy đủ. */
      const c = timCot(A.cot, tenNganh);
      const t = nut("text", "nhanNganh"
        + (dangChon(tenNganh, null) ? " nhanDangChon" : ""));
      t.setAttribute("x", x0 + oNganh / 2);
      t.setAttribute("y", CAO - LE_DUOI + 20);
      t.setAttribute("text-anchor", "middle");
      const toiDa = Math.max(5, Math.floor(oNganh / 7.4));
      t.textContent = tenNganh.length > toiDa ? tenNganh.slice(0, toiDa - 1) + "…" : tenNganh;
      const tt = nut("title");
      tt.textContent = tenNganh + (c && c.ten_goc ? " (gồm: " + c.ten_goc.join(", ") + ")" : "");
      t.appendChild(tt);
      t.addEventListener("click", () => datChon(tenNganh, null));
      svg.appendChild(t);

      /* Tỉ trọng ghi bằng số dưới tên: mắt đọc chiều cao ra "khoảng một
         nửa", còn con số thật phải có ở đâu đó mà không cần rê chuột. */
      const pt = A.tong > 0 && c ? (c.gia_tri / A.tong) * 100 : 0;
      const t2 = nut("text", "nhanNganhPt");
      t2.setAttribute("x", x0 + oNganh / 2);
      t2.setAttribute("y", CAO - LE_DUOI + 36);
      t2.setAttribute("text-anchor", "middle");
      t2.textContent = pt1(pt) + "%";
      svg.appendChild(t2);
    });

    if (!kq.co_ky_truoc) {
      const t = nut("text", "coCauGhiChu");
      t.setAttribute("x", LE_TRAI); t.setAttribute("y", LE_TREN + 10);
      t.textContent = "Chưa có dòng hàng của " + nhanKy(kq.ky_truoc)
        + " để so cùng kỳ — chỉ hiện tháng này.";
      svg.appendChild(t);
    }
  }

  const dangChon = (nganh, hang) => !!trangThai.chon
    && trangThai.chon.nganh === nganh
    && (trangThai.chon.hang || null) === (hang || null);

  function datChon(nganh, hang) {
    if (dangChon(nganh, hang)) trangThai.chon = null;   // bấm lại là bỏ chọn
    else trangThai.chon = { nganh, hang: hang || null };
    veRuot();
  }

  function veMotCot(svg, c, tong, x, rong, y, tran, laTruoc, ky) {
    if (!c || !tong) return;
    const ptCot = (c.gia_tri / tong) * 100;
    if (ptCot <= 0) return;

    /* Ruột cột xếp từ DƯỚI lên, theo đúng thứ tự Engine trả về (hãng lớn
       trước). Hai cột cạnh nhau vì thế xếp cùng một thứ tự — đó là điều kiện
       để so được với nhau bằng mắt. */
    let duoi = y(0);
    const mang = c.hang && c.hang.length
      ? c.hang
      : [{ ten: c.ten, gia_tri: c.gia_tri, doanh_so: c.doanh_so, so_may: c.so_may,
           la_khac: false, la_tron: true }];

    for (const h of mang) {
      const pt = (h.gia_tri / tong) * 100;
      if (pt <= 0) continue;
      const cao = (pt / tran) * (y(0) - y(tran));
      const chon = !laTruoc && dangChon(c.ten, h.la_tron ? null : h.ten);
      const r = nut("rect", "mangCoCau" + (laTruoc ? " mangTruoc" : "")
        + (chon ? " mangDangChon" : ""));
      r.setAttribute("x", x);
      r.setAttribute("width", rong);
      r.setAttribute("y", duoi - cao);
      r.setAttribute("height", Math.max(0.5, cao));
      r.setAttribute("fill", c.la_chua_phan_loai ? mauChuaPhanLoai()
        : h.la_khac ? mauKhac() : mauHang(h.ten));
      r.appendChild(chuBay(c, h, pt, ptCot, ky));
      r.addEventListener("click", () => datChon(c.ten, h.la_tron ? null : h.ten));
      svg.appendChild(r);
      duoi -= cao;
    }
  }

  /** Nội dung rê chuột. Dùng `<title>` của SVG chứ không dựng một hộp nổi
   *  riêng: nó chạy được ở mọi trình duyệt, đọc được bằng trình đọc màn
   *  hình, và không có hộp nào để quên dọn khi vẽ lại. */
  function chuBay(c, h, pt, ptCot, ky) {
    const t = nut("title");
    const dong = [nhanKy(ky) + " · " + c.ten];
    if (c.ten_goc) dong.push("(gồm: " + c.ten_goc.join(", ") + ")");
    if (c.la_chua_phan_loai) {
      dong.push("Chưa gán mã bảng giá: " + gonTien(c.doanh_so)
        + " · " + soNguyen(c.so_may) + " máy · " + pt1(ptCot) + "% của tháng");
      dong.push("Gán mã bên tab Báo cáo bán hàng là chúng vào đúng ngành.");
    } else if (h.la_tron) {
      dong.push(gonTien(c.doanh_so) + " · " + soNguyen(c.so_may) + " máy · "
        + pt1(ptCot) + "% của tháng");
    } else {
      dong.push(h.ten + ": " + gonTien(h.doanh_so) + " · " + soNguyen(h.so_may) + " máy");
      dong.push(pt1(ptCot > 0 ? (pt / ptCot) * 100 : 0) + "% của " + c.ten
        + " · " + pt1(pt) + "% của cả tháng");
      if (h.la_khac && h.gom && h.gom.length) {
        dong.push("— gồm " + h.gom.length + " hãng:");
        for (const g of h.gom) {
          dong.push("   " + g.ten + ": " + gonTien(g.doanh_so) + " · "
            + soNguyen(g.so_may) + " máy");
        }
      }
    }
    dong.push("(bấm để ghim sang thẻ bên phải)");
    t.textContent = dong.join("\n");
    return t;
  }

  /* ═══════════ Card bên phải ═══════════ */

  function oMau(mau) {
    const s = el("span", "oMauHang");
    s.style.background = mau;
    return s;
  }

  function veCard(kq) {
    const card = el("div", "cardCoCau");
    if (trangThai.chon) card.appendChild(veChiTiet(kq));
    else card.appendChild(veChuGiaiMau(kq));
    return card;
  }

  /** Chưa bấm gì thì card LÀ chú giải màu.
   *
   *  Chủ dự án chốt "mỗi hãng 1 màu" — mà một bảng màu không có chú giải thì
   *  người đọc phải rê chuột từng mảng để biết màu nào là hãng nào, tức đúng
   *  cái công mà màu sinh ra để bỏ đi. */
  function veChuGiaiMau(kq) {
    const o = document.createElement("div");
    o.appendChild(el("p", "cardTieuDe", "Hãng trong tháng"));

    const A = chonCot(kq.theo_doanh_so.nay);
    /* Cộng theo hãng trên TOÀN bảng để xếp hạng chú giải — đây là phép cộng
       để SẮP XẾP một danh sách màu, không phải một con số hiện ra. Số hiện
       ra vẫn là số Engine đã tính, lấy nguyên từ từng mảng. */
    const tong = new Map();
    for (const c of A.cot) {
      if (c.la_chua_phan_loai) continue;
      for (const h of (c.hang || [])) {
        if (h.la_khac) continue;
        tong.set(h.ten, (tong.get(h.ten) || 0) + (Number(h.doanh_so) || 0));
      }
    }
    const ds = [...tong.entries()].sort((a, b) => b[1] - a[1]);

    if (!ds.length) {
      o.appendChild(el("p", "cardNhac", "Chưa có hãng nào được phân loại trong tháng này."));
      return o;
    }
    const ul = el("div", "dsMauHang");
    for (const [ten] of ds) {
      const d = el("div", "mucMauHang");
      d.appendChild(oMau(mauHang(ten)));
      d.appendChild(el("span", "tenMauHang", ten));
      d.addEventListener("click", () => timVaChon(kq, ten));
      ul.appendChild(d);
    }
    o.appendChild(ul);

    const ghi = el("div", "dsMauHang");
    for (const [mau, ten] of [[mauKhac(), "Hãng nhỏ, đã gộp"],
                              [mauChuaPhanLoai(), "Chưa gán mã (NONE)"]]) {
      const d = el("div", "mucMauHang mucMauPhu");
      d.appendChild(oMau(mau));
      d.appendChild(el("span", "tenMauHang", ten));
      ghi.appendChild(d);
    }
    o.appendChild(ghi);
    o.appendChild(el("p", "cardNhac", "Bấm vào một mảng trên biểu đồ để xem chi tiết."));
    return o;
  }

  /** Bấm một hãng ở chú giải → chọn mảng của hãng ấy ở ngành lớn nhất. */
  function timVaChon(kq, tenHang) {
    const A = chonCot(kq.theo_doanh_so.nay);
    let tot = null, lon = -1;
    for (const c of A.cot) {
      for (const h of (c.hang || [])) {
        if (h.ten !== tenHang || h.la_khac) continue;
        if ((Number(h.doanh_so) || 0) > lon) { lon = Number(h.doanh_so) || 0; tot = c.ten; }
      }
    }
    if (tot) datChon(tot, tenHang);
  }

  /** Bấm vào một mảng → mọi con số của đúng mảng ấy, tháng này so cùng kỳ.
   *
   *  Đây là chỗ chỉ tiêu SỐ MÁY sống, sau khi chủ dự án bỏ nút [Số máy]:
   *  doanh số và số lượng đứng cạnh nhau cho cùng một mảng, đọc một lượt. */
  function veChiTiet(kq) {
    const { nganh, hang } = trangThai.chon;
    const A = chonCot(kq.theo_doanh_so.nay), B = chonCot(kq.theo_doanh_so.truoc);
    const tim = (bo, tenN, tenH) => {
      const c = bo.cot.find((x) => x.ten === tenN);
      if (!c) return null;
      if (!tenH) return c;
      return (c.hang || []).find((x) => x.ten === tenH) || null;
    };
    const a = tim(A, nganh, hang), b = kq.co_ky_truoc ? tim(B, nganh, hang) : null;
    const cotA = A.cot.find((x) => x.ten === nganh) || null;

    const o = document.createElement("div");

    const dau = el("div", "cardDau");
    if (hang) dau.appendChild(oMau(mauHang(hang)));
    else if (cotA && cotA.la_chua_phan_loai) dau.appendChild(oMau(mauChuaPhanLoai()));
    dau.appendChild(el("span", "cardTieuDe", hang ? nganh + " · " + hang : nganh));
    const dong = el("button", "nutPhuNho", "✕");
    dong.type = "button";
    dong.title = "Bỏ chọn";
    dong.addEventListener("click", () => { trangThai.chon = null; veRuot(); });
    dau.appendChild(dong);
    o.appendChild(dau);

    if (!a) {
      o.appendChild(el("p", "cardNhac", "Mảng này không còn trong tháng đang xem."));
      return o;
    }

    o.appendChild(veKhoiSo("Doanh số", gonTien, a.doanh_so, b ? b.doanh_so : null, kq));
    o.appendChild(veKhoiSo("Số máy", soNguyen, a.so_may, b ? b.so_may : null, kq));

    /* Tỉ trọng: hai con số trả lời hai câu khác nhau — "trong ngành này nó
       lớn cỡ nào" và "so với cả tháng thì nó đáng kể không". */
    const tt = el("div", "cardKhoi");
    tt.appendChild(el("p", "cardNhanKhoi", "Tỉ trọng"));
    if (hang && cotA && cotA.doanh_so > 0) {
      tt.appendChild(veHangSo(pt1((a.doanh_so / cotA.doanh_so) * 100) + "%",
        "của " + nganh));
    }
    if (A.tong > 0) {
      tt.appendChild(veHangSo(pt1((a.doanh_so / A.tong) * 100) + "%", "của cả tháng"));
    }
    o.appendChild(tt);

    /* Mảng "Khác" thì liệt kê đủ từng hãng bên trong — chủ dự án chốt "thấy
       được đủ thông tin". */
    if (a.la_khac && a.gom && a.gom.length) {
      const g = el("div", "cardKhoi");
      g.appendChild(el("p", "cardNhanKhoi", "Gồm " + a.gom.length + " hãng"));
      for (const x of a.gom) {
        const d = el("div", "mucMauHang mucMauPhu");
        d.appendChild(oMau(mauHang(x.ten)));
        d.appendChild(el("span", "tenMauHang", x.ten));
        d.appendChild(el("span", "soMauHang", gonTien(x.doanh_so)));
        g.appendChild(d);
      }
      o.appendChild(g);
    }

    if (cotA && cotA.ten_goc) {
      o.appendChild(el("p", "cardNhac", "Cột này gộp: " + cotA.ten_goc.join(", ") + "."));
    }
    if (cotA && cotA.la_chua_phan_loai) {
      o.appendChild(el("p", "cardNhac",
        "Đây là phần chưa gán mã bảng giá. Gán mã bên tab Báo cáo bán hàng "
        + "là chúng vào đúng ngành."));
    }
    return o;
  }

  function veHangSo(gt, nhan) {
    const d = el("div", "cardHang");
    d.appendChild(el("span", "cardSo", gt));
    d.appendChild(el("span", "cardNhan", nhan));
    return d;
  }

  function veKhoiSo(ten, dinhDang, nay, truoc, kq) {
    const o = el("div", "cardKhoi");
    o.appendChild(el("p", "cardNhanKhoi", ten));
    o.appendChild(veHangSo(dinhDang(nay), nhanKy(kq.ky)));
    if (!kq.co_ky_truoc) {
      o.appendChild(el("p", "cardNhac", "Chưa có sổ " + nhanKy(kq.ky_truoc) + " để so."));
      return o;
    }
    o.appendChild(veHangSo(dinhDang(truoc || 0), nhanKy(kq.ky_truoc)));

    /* Chênh lệch: KHÔNG in "+∞%" khi năm trước bằng 0 — nói thẳng "năm
       trước không có" thay vì một con số không có nghĩa. */
    const d = el("div", "cardHang");
    if (!truoc) {
      d.appendChild(el("span", "cardSo cardMoi", nay ? "mới" : "—"));
      d.appendChild(el("span", "cardNhan", nay ? "năm trước không có" : ""));
    } else {
      const ch = ((nay - truoc) / truoc) * 100;
      const s = el("span", "cardSo " + (ch >= 0 ? "cardTang" : "cardGiam"),
        (ch >= 0 ? "+" : "−") + pt1(Math.abs(ch)) + "%");
      d.appendChild(s);
      d.appendChild(el("span", "cardNhan", "so cùng kỳ"));
    }
    o.appendChild(d);
    return o;
  }

  /** Độ phủ. Con số này là thứ giữ cho biểu đồ không nói dối: so một tháng
   *  đã gán kỹ với một tháng gán ít mà không có nó là bịa ra tăng trưởng. */
  function veChuGiaiDoPhu(kq) {
    const p = el("p", "chuGiaiCoCau");
    const dp = kq.do_phu || {};
    const a = dp.nay ? dp.nay.doanh_so_pt : null;
    const b = dp.truoc ? dp.truoc.doanh_so_pt : null;

    const noi = (nhan, v) => (v === null || v === undefined
      ? nhan + ": chưa có dòng hàng"
      : nhan + ": đã phân loại " + pt1(v) + "%");

    p.appendChild(el("span", null, noi(nhanKy(kq.ky), a)));
    if (kq.co_ky_truoc) p.appendChild(el("span", null, noi(nhanKy(kq.ky_truoc), b)));

    if (a !== null && b !== null && Math.abs(a - b) >= 15) {
      p.appendChild(el("span", "canhBaoDoPhu",
        "⚠ hai tháng lệch độ phủ " + pt1(Math.abs(a - b)) + " điểm — so tỉ trọng "
        + "giữa chúng chưa chắc đúng, gán thêm mã cho tháng phủ thấp trước"));
    }
    return p;
  }

  /** Dashboard vừa ép lại chiều cao hai cột → đo lại và vẽ lại hình.
   *
   *  Bắt buộc phải có, và đây là thứ tự gây ra nó: `veLai()` gọi `ve()`
   *  TRƯỚC rồi mới `canhCaoKhoi()`. Lượt vẽ đầu tiên vì vậy đo một cột chưa
   *  được ép chiều cao (`clientHeight` bằng 0 ở lượt mở trang đầu), và
   *  `viewBox` rơi về tỉ lệ mặc định — tức đúng cái dải trắng vừa sửa xong.
   *
   *  Chỉ vẽ lại HÌNH, không dựng lại card: card không phụ thuộc hình học, và
   *  dựng lại nó ở đây là mất mảng người dùng vừa bấm chọn. */
  function canhLai() {
    if (!oHinh || !trangThai.kq) return;
    if (oHinh.isConnected === false) return;
    veHinh(oHinh, trangThai.kq);
  }

  window.CoCau = { ve, canhLai };
})();
