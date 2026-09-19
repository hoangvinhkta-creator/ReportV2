/* MÀN [KÍCH HOẠT BẢO HÀNH] — chủ dự án chốt 19/09/2026.
 *
 * Tab thứ hai của app, ngang hàng [Báo cáo bán hàng]. Nó KHÔNG phải một cách
 * xem doanh số khác: nó là một DANH SÁCH VIỆC. Mỗi dòng còn ở đây nghĩa là
 * còn một cái máy ngoài đời chưa được kích hoạt bảo hành trên cổng của hãng,
 * và bấm tick là nói "xong cái này rồi".
 *
 * Bốn khối, đúng thứ tự chủ dự án mô tả:
 *   1. thông tin đăng nhập cổng hãng (User · Pass · hướng dẫn đăng nhập)
 *   2. hướng dẫn kích hoạt từng bước, có nút thêm bước (chữ + ảnh)
 *   3. bảng máy chưa kích hoạt của tháng đang chọn, lọc theo hãng
 *   4. mỗi dòng một nút tick — tick xong là dòng rời khỏi danh sách
 *
 * ── LUẬT SỐ 1 ──
 *
 * File này KHÔNG có một luật nghiệp vụ nào. Nó không biết dòng nào là "một
 * cái máy đã bán", không biết hãng nào có cổng bảo hành, không tự lọc theo
 * hãng. Mười tab hãng, việc chia dòng vào từng tab, việc đếm, việc sắp thứ
 * tự — tất cả đến từ `GET /api/bao-hanh` (Engine: `bao-hanh.mjs`). Thứ duy
 * nhất file này tự làm là VẼ, và nhớ người dùng đang mở tab nào.
 *
 * ── BA ĐIỀU KIỆN "ÍT THAO TÁC TRÙNG LẶP" ──
 *
 * "kỳ dùng chung"      → không có bộ chọn tháng riêng; `datKy()` nhận kỳ từ
 *                        màn báo cáo, nên đổi tháng ở màn nào cũng ăn sang
 *                        màn kia.
 * "hướng dẫn đóng sẵn" → ba mươi bước không được đẩy bảng việc xuống dưới
 *                        mép màn hình ở mọi lượt vào.
 * "tick không tải lại" → mỗi lượt tick chỉ gửi đúng một lượt ghi, không kéo
 *                        lại cả tháng dữ liệu; dòng rời khỏi bảng tại chỗ.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const laQuanTri = () => window.VAI_BAO_CAO === "quantri";

  function el(the, lop, chu) {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  }

  const SVG = "http://www.w3.org/2000/svg";
  /** Icon nét mảnh, cùng nếp với `icon()` bên don-hang.js. */
  function icon(d, rong) {
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", rong || 2);
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.innerHTML = d;
    return s;
  }
  const HINH = {
    tick: '<path d="M4 12.5 9.5 18 20 6"/>',
    mui: '<path d="M9 5l7 7-7 7"/>',
    sua: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
    xoa: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    them: '<path d="M12 5v14M5 12h14"/>',
    mat: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    chep: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  };
  function nutIcon(hinh, nhan, lop) {
    const b = el("button", lop || "nutLoc");
    b.type = "button";
    b.appendChild(icon(HINH[hinh], 2));
    b.title = nhan;
    b.setAttribute("aria-label", nhan);
    return b;
  }

  /** Gọi Gateway — chỗ DUY NHẤT file này nói chuyện với "phía sau", và luôn
   *  kèm Firebase ID token (LUẬT SỐ 1). Sao đúng nếp `goi()` của gan-ma.js. */
  async function goi(duong, tuyChon) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    /* `json` là cờ của riêng hàm này, không phải một khoá của `fetch()` — nên
       tách nó ra thay vì để nó lọt vào tuỳ chọn gửi đi. Trình duyệt hôm nay
       bỏ qua khoá lạ, nhưng một tuỳ chọn "chỉ vô hại vì chưa ai dùng tên đó"
       là thứ hỏng vào một ngày không ai đoán trước. */
    const { json, headers, ...conLai } = tuyChon || {};
    const r = await fetch(duong, {
      ...conLai,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(headers || {}),
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
    });
    const js = await r.json().catch(() => null);
    if (!r.ok) throw new Error((js && js.loi) || "Máy chủ không trả lời.");
    return js;
  }
  const goiGhi = (duong, than) =>
    goi(duong, { method: "POST", json: true, body: JSON.stringify(than) });

  /* ---- Ảnh hướng dẫn ----
     `<img src>` KHÔNG gắn được header `Authorization`, mà đường ảnh thì đòi
     token như mọi đường khác của app (ảnh chụp màn hình cổng hãng đôi khi
     kèm chính tài khoản đang đăng nhập). Nên phải `fetch()` lấy byte rồi
     dựng `blob:` — đúng lý do CSP của app có `blob:` trong `img-src`.

     Nhớ lại theo KHOÁ ẢNH: khoá mang một mốc thời gian nên nó không bao giờ
     trỏ sang một tấm khác (sửa ảnh của một bước là sinh khoá mới). Không
     nhớ thì mỗi lượt đóng/mở hộp hướng dẫn lại tải lại cả ba mươi tấm. */
  const anhDaTai = new Map();
  async function urlAnh(khoa) {
    if (anhDaTai.has(khoa)) return anhDaTai.get(khoa);
    const hua = (async () => {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("Chưa đăng nhập.");
      const token = await user.getIdToken();
      const r = await fetch("/api/bao-hanh/anh?id=" + encodeURIComponent(khoa), {
        headers: { Authorization: "Bearer " + token },
      });
      if (!r.ok) throw new Error("Không tải được ảnh.");
      return URL.createObjectURL(await r.blob());
    })().catch((e) => { anhDaTai.delete(khoa); throw e; });
    anhDaTai.set(khoa, hua);
    return hua;
  }

  /** Gắn một tấm ảnh hướng dẫn vào chỗ đã dựng sẵn.
   *
   *  Ảnh tải KHÔNG đồng bộ, nhưng chỗ của nó phải có NGAY: dựng thẻ sau khi
   *  byte về thì cả danh sách bước nhảy chỗ đúng lúc người ta đang đọc. */
  function ganAnh(img, khoa) {
    urlAnh(khoa).then((u) => { img.src = u; }, () => {
      img.replaceWith(el("p", "viDu", "Không tải được ảnh của bước này."));
    });
  }

  /* ═══════════════ Trạng thái màn hình ═══════════════
     Chỉ là trạng thái của MÀN HÌNH — không có gì ở đây được lưu xuống đâu
     cả, và không được lưu: nó nói "tôi đang nhìn cái gì", không nói dữ liệu
     là gì. */
  const trangThai = {
    man: "bao-cao",   // "bao-cao" | "bao-hanh"
    ky: null,
    hang: null,       // tab hãng đang mở
    kq: null,         // phản hồi /api/bao-hanh gần nhất
    kyCuaKq: null,    // kết quả ấy của kỳ nào (để biết khi nào phải tải lại)
    hienDa: false,    // công tắc "Hiện cả đã kích hoạt"
    moBuoc: false,    // hộp hướng dẫn đang mở hay đóng
    dangTai: false,
  };

  /* ═══════════════ Tab cấp 1 ═══════════════ */

  const MAN = [
    { ma: "bao-cao", ten: "Báo cáo bán hàng" },
    { ma: "bao-hanh", ten: "Kích hoạt bảo hành" },
  ];

  function veTabMan() {
    const hang = $("tabMan");
    if (!hang) return;
    hang.innerHTML = "";
    for (const m of MAN) {
      const nut = el("button", "tabNut" + (trangThai.man === m.ma ? " tabDang" : ""), m.ten);
      nut.type = "button";
      nut.addEventListener("click", () => doiMan(m.ma));
      hang.appendChild(nut);
    }
  }

  function doiMan(ma) {
    if (trangThai.man === ma) return;
    trangThai.man = ma;
    veTabMan();
    const laBH = ma === "bao-hanh";
    $("manBaoCao").hidden = laBH;
    $("manBaoHanh").hidden = !laBH;

    /* Biểu đồ nằm TRONG #manBaoCao nên nó tự ẩn theo. Nhưng chiều cao của nó
       được ĐO khi vẽ, và đo một khối đang ẩn thì ra 0 — nên lúc quay về phải
       nhờ màn báo cáo đo lại. Gọi qua một cửa hẹp (`window.DonHang`), không
       sờ thẳng vào DOM của khối kia: đúng quy ước đã có từ P2(b). */
    if (!laBH && window.DonHang && window.DonHang.canhLaiBieuDo) {
      window.DonHang.canhLaiBieuDo();
    }
    if (laBH) taiNeuCan();
  }

  /* ═══════════════ Cửa vào từ màn báo cáo ═══════════════ */

  /** Màn báo cáo báo sang: đang xem kỳ nào.
   *
   *  KHÔNG tải ngay nếu người dùng đang ở màn báo cáo: lượt đọc này dựng lại
   *  cả bảng đơn của tháng (khớp mã + giá vốn), tức vài giây và nhiều lượt
   *  đọc — trả cái giá ấy cho một màn chưa ai mở là trả không. Chỉ ghi nhớ,
   *  và tải lúc người dùng thật sự bấm sang. */
  function datKy(ky) {
    if (typeof ky !== "string" || !/^\d{4}-\d{2}$/.test(ky)) return;
    if (trangThai.ky === ky) return;
    trangThai.ky = ky;
    if (trangThai.man === "bao-hanh") taiNeuCan();
  }

  function taiNeuCan() {
    if (!trangThai.ky) {
      $("veBaoHanh").innerHTML = "";
      $("tabHang").innerHTML = "";
      $("veBaoHanh").appendChild(el("p", "dangTai",
        "Năm này chưa có tháng nào được tải lên."));
      return;
    }
    if (trangThai.kyCuaKq === trangThai.ky || trangThai.dangTai) return;
    tai();
  }

  async function tai() {
    const loi = $("loiBaoHanh"), ve = $("veBaoHanh");
    loi.textContent = "";
    trangThai.dangTai = true;
    ve.innerHTML = '<p class="dangTai">Đang tải…</p>';
    try {
      const kq = await goi("/api/bao-hanh?ky=" + encodeURIComponent(trangThai.ky));
      trangThai.kq = kq;
      trangThai.kyCuaKq = trangThai.ky;
      /* Hãng đang mở giữ nguyên qua lượt đổi tháng — người dùng làm hết
         Samsung tháng 8 rồi sang tháng 9 thì vẫn đang ở Samsung, không bị
         quăng về tab đầu. */
      if (!trangThai.hang || kq.thu_tu.indexOf(trangThai.hang) < 0) {
        trangThai.hang = kq.thu_tu[0];
      }
      veTatCa();
    } catch (e) {
      ve.innerHTML = "";
      $("tabHang").innerHTML = "";
      loi.textContent = "Không lấy được danh sách kích hoạt: " + e.message;
    } finally {
      trangThai.dangTai = false;
    }
  }

  /* ═══════════════ Vẽ ═══════════════ */

  function veTatCa() {
    veTabHang();
    veRuot();
  }

  /** Mười tab hãng, mỗi tab kèm số máy CÒN PHẢI LÀM.
   *
   *  Con số nằm ngay trên nút, không phải trong bảng: người dùng vào đây để
   *  biết "hôm nay còn hãng nào phải làm", và câu trả lời ấy phải đọc được
   *  mà không cần bấm qua từng tab. Hãng không còn việc thì số biến mất (chứ
   *  không hiện số 0) — một hàng mười con số 0 là mười thứ mắt phải đọc để
   *  kết luận không có gì. */
  function veTabHang() {
    const hang = $("tabHang");
    hang.innerHTML = "";
    const kq = trangThai.kq;
    if (!kq) return;
    for (const ten of kq.thu_tu) {
      const dem = (kq.tom_tat_hang && kq.tom_tat_hang[ten]) || { chua: 0, da: 0 };
      const nut = el("button", "tabNut" + (trangThai.hang === ten ? " tabDang" : ""));
      nut.type = "button";
      nut.appendChild(document.createTextNode(ten));
      if (dem.chua) {
        const s = el("span", null, " " + dem.chua);
        s.style.opacity = ".75";
        nut.appendChild(s);
      }
      nut.title = dem.chua
        ? ten + ": còn " + dem.chua + " máy chưa kích hoạt"
        : ten + ": không còn máy nào chưa kích hoạt trong tháng này";
      nut.addEventListener("click", () => {
        if (trangThai.hang === ten) return;
        trangThai.hang = ten;
        /* Công tắc "hiện cả đã kích hoạt" KHÔNG mang sang hãng khác: nó là
           "tôi đang soi lại việc đã làm của hãng NÀY", không phải một thiết
           lập của người dùng. */
        trangThai.hienDa = false;
        veTatCa();
      });
      hang.appendChild(nut);
    }
  }

  function veRuot() {
    const ve = $("veBaoHanh");
    /* Đo vị trí cuộn TRƯỚC khi dựng lại, và trả về sau — đo ở chỗ gọi thì
       đường tick phải nhớ đo, và cái phải-nhớ nào rồi cũng có chỗ quên (đúng
       bài học `veKetQua()` bên don-hang.js).

       Vì sao bắt buộc: tick là thao tác lặp hàng chục lần, và mỗi lượt tick
       vẽ lại cả khối. Không giữ chỗ cuộn thì tick một dòng ở giữa tháng là
       bảng nhảy về đầu, rồi người dùng phải cuộn xuống tìm lại chỗ cũ — mỗi
       cái máy một lần. */
    const bocCu = ve.querySelector(".bocBang");
    const cuonCu = bocCu ? bocCu.scrollTop : 0;
    ve.innerHTML = "";
    const kq = trangThai.kq;
    if (!kq) return;

    /* Tracking hỏng thì KHÔNG dòng nào có hãng, tức mười tab cùng rỗng. Nói
       thẳng ra: một sự cố mạng không được phép nói "không còn máy nào phải
       kích hoạt" thay người (CLAUDE.md — "Nguồn hỏng thì BÁO LỖI"). */
    if (kq.loi_nguon_ma) {
      ve.appendChild(el("p", "bangConNo",
        "⚠ Chưa đọc được bảng giá Tracking lượt này, nên chưa xếp được dòng nào "
        + "vào hãng — danh sách bên dưới đang rỗng vì lý do ĐÓ, không phải vì "
        + "đã kích hoạt hết. Thử tải lại trang sau ít phút."));
    } else if (kq.tom_tat && kq.tom_tat.chua_ro_hang) {
      /* Chủ dự án chốt chỉ mười tab, nên dòng chưa gán mã không thuộc tab
         nào. Nó phải được NÓI RA — một cái máy biến mất khỏi danh sách việc
         trong im lặng là đúng lớp lỗi tab này sinh ra để chặn. */
      ve.appendChild(el("p", "bangConNo",
        "⚠ Còn " + kq.tom_tat.chua_ro_hang + " dòng chưa xếp được hãng (chưa gán mã "
        + "bảng giá, hoặc hãng ngoài mười hãng ở trên) nên không hiện ở tab nào. "
        + "Gán mã bên tab Báo cáo bán hàng là chúng tự vào đúng tab."));
    }

    const o = kq.hang && kq.hang[trangThai.hang];
    if (!o) return;
    const hd = (kq.huong_dan && kq.huong_dan[trangThai.hang])
      || { dang_nhap: {}, buoc: [] };

    ve.appendChild(veDaiDangNhap(hd.dang_nhap || {}));
    ve.appendChild(veHopBuoc(hd.buoc || []));
    ve.appendChild(veBang(o));

    const bocMoi = ve.querySelector(".bocBang");
    if (bocMoi && cuonCu) bocMoi.scrollTop = cuonCu;
  }

  /* ---- 1. Thông tin đăng nhập ---- */

  function veDaiDangNhap(dn) {
    const dai = el("div", "daiDangNhap");

    dai.appendChild(oKhoa("User", dn.user, false));
    dai.appendChild(oKhoa("Mật khẩu", dn.mat_khau, true));

    const cuoi = el("div", "cuoiDai");
    if (laQuanTri()) {
      const nut = nutIcon("sua", "Sửa thông tin đăng nhập của " + trangThai.hang);
      nut.addEventListener("click", () => moSuaDangNhap(dn));
      cuoi.appendChild(nut);
    }
    dai.appendChild(cuoi);

    if (dn.huong_dan) {
      dai.appendChild(el("p", "huongDanNhap", dn.huong_dan));
    } else if (laQuanTri()) {
      dai.appendChild(el("p", "huongDanNhap viDu",
        "Chưa có hướng dẫn đăng nhập cho hãng này."));
    }
    return dai;
  }

  /** Một ô User/Mật khẩu, kèm nút chép.
   *
   *  Mật khẩu ẩn sẵn sau dấu chấm và có nút hiện. Đây KHÔNG phải một lớp bảo
   *  mật — ai đã đăng nhập được app thì đọc được nhánh `bc/quyetdinh` (chủ
   *  dự án chốt để mật khẩu ở đó). Nó giải đúng một việc rất đời thường: màn
   *  này hay được chiếu lên màn hình lớn hoặc chụp gửi cho nhau, và mật khẩu
   *  cổng hãng không cần đi cùng mọi tấm ảnh ấy.
   *
   *  Nút CHÉP quan trọng hơn nút hiện: người dùng cần dán sang cửa sổ cổng
   *  hãng, không cần đọc. Chép được thì không phải hiện ra lần nào. */
  function oKhoa(nhan, giaTri, an) {
    const o = el("div", "oKhoa");
    o.appendChild(el("span", "nhanKhoa", nhan));
    const co = !!giaTri;
    const gt = el("span", "giaTri" + (co ? "" : " trong"),
      co ? (an ? "••••••••" : giaTri) : "chưa khai");
    o.appendChild(gt);
    if (!co) return o;

    if (an) {
      let dangHien = false;
      const nut = nutIcon("mat", "Hiện/ẩn mật khẩu");
      nut.addEventListener("click", () => {
        dangHien = !dangHien;
        gt.textContent = dangHien ? giaTri : "••••••••";
      });
      o.appendChild(nut);
    }
    const chep = nutIcon("chep", "Chép " + nhan.toLowerCase());
    chep.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(giaTri);
        chep.title = "Đã chép";
      } catch (e) {
        /* Trình duyệt từ chối (không phải ngữ cảnh an toàn, người dùng chặn
           quyền) thì bôi chọn sẵn để còn Ctrl+C — im lặng không làm gì là
           người dùng bấm lại mấy lần rồi mới hiểu là nút hỏng. */
        const r = document.createRange();
        r.selectNodeContents(gt);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        chep.title = "Trình duyệt chặn chép tự động — đã bôi chọn, bấm Ctrl+C";
      }
    });
    o.appendChild(chep);
    return o;
  }

  /* ---- 2. Hướng dẫn từng bước ---- */

  function veHopBuoc(buoc) {
    const hop = el("div", "hopBuoc" + (trangThai.moBuoc ? "" : " dongLai"));

    const dau = el("div", "dauBuoc");
    dau.appendChild(icon(HINH.mui, 2.4)).classList.add("muiTenBuoc");
    dau.appendChild(el("span", "tenDau", "Hướng dẫn kích hoạt"));
    dau.appendChild(el("span", "demBuoc",
      buoc.length ? buoc.length + " bước" : "chưa có bước nào"));
    const cuoi = el("div", "cuoiDau");
    if (laQuanTri()) {
      const them = nutIcon("them", "Thêm một bước hướng dẫn");
      them.addEventListener("click", (ev) => {
        ev.stopPropagation();   // bấm nút thêm không đóng/mở hộp
        moSuaBuoc(null);
      });
      cuoi.appendChild(them);
    }
    dau.appendChild(cuoi);
    dau.addEventListener("click", () => {
      trangThai.moBuoc = !trangThai.moBuoc;
      hop.classList.toggle("dongLai", !trangThai.moBuoc);
      if (trangThai.moBuoc) taiAnhTrongHop(hop);
    });
    hop.appendChild(dau);

    const ruot = el("div", "ruotBuoc");
    if (!buoc.length) {
      ruot.appendChild(el("p", "viDu", laQuanTri()
        ? "Chưa có bước nào. Bấm dấu + ở trên để thêm bước đầu tiên."
        : "Chưa có bước nào cho hãng này."));
    }
    buoc.forEach((b, i) => {
      const m = el("div", "mucBuoc");
      m.appendChild(el("div", "soBuoc", i + 1));
      const than = el("div", "thanBuoc");
      than.appendChild(el("p", "chuBuoc" + (b.chu ? "" : " trong"),
        b.chu || "(bước này chỉ có ảnh)"));
      if (b.anh) {
        const img = el("img", "anhBuoc");
        img.alt = "Ảnh hướng dẫn bước " + (i + 1);
        img.dataset.anh = b.anh;
        img.addEventListener("click", () => phongTo(b.anh));
        than.appendChild(img);
        /* Chỉ tải khi hộp ĐANG MỞ. Hộp đóng sẵn, nên tải ngay là kéo về ba
           mươi tấm ảnh cho một khối không ai đang nhìn — ở mọi lượt vẽ lại,
           tức ở mọi cái tick. Mở ra mới tải (`taiAnhTrongHop`). */
        if (trangThai.moBuoc) ganAnh(img, b.anh);
      }
      m.appendChild(than);
      if (laQuanTri()) {
        const nut = el("div", "nutBuoc");
        const sua = nutIcon("sua", "Sửa bước " + (i + 1));
        sua.addEventListener("click", () => moSuaBuoc(b));
        const xoa = nutIcon("xoa", "Xoá bước " + (i + 1));
        xoa.addEventListener("click", () => xoaBuoc(b, i + 1));
        nut.appendChild(sua);
        nut.appendChild(xoa);
        m.appendChild(nut);
      }
      ruot.appendChild(m);
    });
    hop.appendChild(ruot);
    return hop;
  }

  /** Tải nốt những tấm ảnh còn để trống trong một hộp hướng dẫn vừa mở. */
  function taiAnhTrongHop(hop) {
    for (const img of hop.querySelectorAll("img.anhBuoc:not([src])")) {
      if (img.dataset.anh) ganAnh(img, img.dataset.anh);
    }
  }

  function phongTo(khoa) {
    const phu = el("div", "phuAnh");
    const img = el("img");
    img.alt = "Ảnh hướng dẫn";
    phu.appendChild(img);
    ganAnh(img, khoa);
    const dong = () => { phu.remove(); document.removeEventListener("keydown", phim); };
    function phim(e) { if (e.key === "Escape") dong(); }
    phu.addEventListener("click", dong);
    document.addEventListener("keydown", phim);
    document.body.appendChild(phu);
  }

  /* ---- 3 + 4. Bảng máy chưa kích hoạt ---- */

  const COT_BH = ["Ngày", "Số BH", "Mã sản phẩm", "SL",
                  "Tên khách", "SĐT", "Địa chỉ", "Số imei"];

  /** "2026-09-03" → "03/09". Chỉ đổi cách VIẾT một chuỗi ngày, không phải
   *  một phép tính — cùng lối `ngayNgan()` bên don-hang.js. */
  function ngayNgan(d) {
    const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] : String(d || "");
  }

  function veBang(o) {
    const khoi = document.createElement("div");

    const dai = el("div", "daiBang");
    const dem = el("span");
    dem.appendChild(el("b", "demCon", o.chua.length));
    dem.appendChild(document.createTextNode(
      " máy " + trangThai.hang + " chưa kích hoạt trong tháng này"));
    dai.appendChild(dem);

    if (o.da.length) {
      const cuoi = el("div", "cuoiDai");
      const nut = el("button", "tabNut tabNho" + (trangThai.hienDa ? " tabDang" : ""),
        (trangThai.hienDa ? "✓ " : "") + "Hiện cả " + o.da.length + " máy đã kích hoạt");
      nut.type = "button";
      nut.title = "Bật lên để soi lại việc đã làm, hoặc bỏ tick một dòng lỡ tay";
      nut.addEventListener("click", () => { trangThai.hienDa = !trangThai.hienDa; veRuot(); });
      cuoi.appendChild(nut);
      dai.appendChild(cuoi);
    }
    khoi.appendChild(dai);

    const ds = trangThai.hienDa ? o.chua.concat(o.da) : o.chua;
    if (!ds.length) {
      khoi.appendChild(el("p", "dangTai", o.da.length
        ? "Xong cả rồi — " + o.da.length + " máy " + trangThai.hang
          + " của tháng này đều đã kích hoạt."
        : "Tháng này không có máy " + trangThai.hang + " nào."));
      return khoi;
    }

    const boc = el("div", "bocBang");
    const bang = el("table", "bangBaoHanh");
    const thead = el("thead");
    const trH = el("tr");
    trH.appendChild(el("th", null, "✓"));
    for (const c of COT_BH) trH.appendChild(el("th", null, c));
    thead.appendChild(trH);
    bang.appendChild(thead);

    const tbody = el("tbody");
    for (const m of ds) tbody.appendChild(veDong(m));
    bang.appendChild(tbody);
    boc.appendChild(bang);
    khoi.appendChild(boc);
    return khoi;
  }

  function veDong(m) {
    const tr = el("tr", m.da_kich_hoat ? "daXong" : null);

    const oT = el("td", "oTick");
    const nut = el("button", "nutTick" + (m.da_kich_hoat ? " daTick" : ""));
    nut.type = "button";
    nut.appendChild(icon(HINH.tick, 3));
    nut.title = m.da_kich_hoat
      ? "Đã kích hoạt" + (m.kich_hoat_boi ? " bởi " + m.kich_hoat_boi : "")
        + " — bấm để bỏ tick"
      : "Đánh dấu đã kích hoạt bảo hành cho máy này";
    /* Dòng không có khoá thì không tick được — nhưng vẫn HIỆN ra, vì nó vẫn
       là một cái máy phải kích hoạt. Giấu nó đi để bảng sạch là đúng lớp lỗi
       tab này sinh ra để chặn. */
    nut.disabled = !m.khoa;
    if (m.khoa) nut.addEventListener("click", () => tick(m, tr, nut));
    oT.appendChild(nut);
    tr.appendChild(oT);

    tr.appendChild(el("td", "oNgay", ngayNgan(m.ngay)));
    tr.appendChild(el("td", "oCt", m.so_ct));
    tr.appendChild(el("td", "oMaSp", m.ma_san_pham));
    tr.appendChild(el("td", "oSo", m.so_luong));
    tr.appendChild(el("td", null, m.ten_khach || "—"));
    tr.appendChild(el("td", null, m.dien_thoai || "—"));
    tr.appendChild(el("td", "oDiaChiBh", m.dia_chi || "—"));

    /* Cột IMEI: mỗi mã một dòng. Thiếu IMEI thì tô vàng như một ô còn nợ —
       đó là một việc phải làm (tìm lại tem máy), không phải một ô trống. */
    const oI = el("td", m.thieu_imei ? "thieuImei" : null);
    if (m.imei.length) {
      const d = el("div", "dsImei");
      for (const x of m.imei) d.appendChild(el("span", null, x));
      oI.appendChild(d);
      if (m.thieu_imei) {
        oI.appendChild(el("div", null, "thiếu " + (m.so_luong - m.imei.length) + " IMEI"));
      }
    } else {
      oI.textContent = "chưa có IMEI";
    }
    tr.appendChild(oI);
    return tr;
  }

  async function tick(m, tr, nut) {
    if (nut.disabled) return;
    const xong = !m.da_kich_hoat;
    nut.disabled = true;
    tr.classList.add("dangGhi");
    $("loiBaoHanh").textContent = "";
    try {
      await goiGhi("/api/kich-hoat", { ky: trangThai.kyCuaKq, khoa: m.khoa, xong });

      /* Dời mục giữa hai danh sách NGAY TẠI CHỖ, không gọi lại `/api/bao-hanh`.
         Đây KHÔNG phải một phép tính nghiệp vụ dựng lại trong trình duyệt:
         nó chỉ ghi sổ lại một sự thật máy chủ VỪA XÁC NHẬN xong ("ô này giờ
         có/không có dấu"). Luật vẫn ở Engine — lượt mở màn hình kế tiếp dựng
         lại đúng hai danh sách này từ đó.

         Vì sao không tải lại: một lượt `/api/bao-hanh` dựng lại cả bảng đơn
         của tháng (khớp mã + giá vốn), tức vài giây — mà tick là thao tác
         lặp hàng chục lần liên tiếp. Chờ vài giây sau mỗi cái tick là tính
         năng này không dùng được. */
      const o = trangThai.kq.hang[trangThai.hang];
      const tu = xong ? o.chua : o.da;
      const den = xong ? o.da : o.chua;
      const i = tu.indexOf(m);
      if (i >= 0) tu.splice(i, 1);
      m.da_kich_hoat = xong;
      const toi = firebase.auth().currentUser;
      m.kich_hoat_boi = xong ? ((toi && toi.email) || null) : null;
      den.push(m);
      trangThai.kq.tom_tat_hang[trangThai.hang] = { chua: o.chua.length, da: o.da.length };

      veTatCa();
    } catch (e) {
      tr.classList.remove("dangGhi");
      nut.disabled = false;
      $("loiBaoHanh").textContent = "Chưa ghi được: " + e.message;
    }
  }

  /* ═══════════════ Hộp nổi: sửa đăng nhập / sửa bước ═══════════════ */

  let dongHopDangMo = null;

  /** Khung hộp nổi dùng chung — cùng lớp phủ với màn gán mã (`.phuNoi` là
   *  alias CSS của `.phuGanMa`), nên hai hộp của cùng một app đọc lên như
   *  một thứ. */
  function moHop(tieuDe, dungRuot) {
    if (dongHopDangMo) dongHopDangMo();
    const phu = el("div", "phuNoi");
    const hop = el("div", "hopNoi");
    phu.appendChild(hop);
    hop.appendChild(el("div", "ganMaTieuDe", tieuDe));

    const tinh = el("div", "ganMaTinh");
    const hangNut = el("div", "ganMaNut");

    let daDong = false;
    const dong = () => {
      if (daDong) return;
      daDong = true;
      document.removeEventListener("keydown", phim);
      phu.remove();
      dongHopDangMo = null;
    };
    dongHopDangMo = dong;
    function phim(e) { if (e.key === "Escape") dong(); }
    document.addEventListener("keydown", phim);
    phu.addEventListener("mousedown", (e) => { if (e.target === phu) dong(); });

    const ruot = el("div");
    hop.appendChild(ruot);
    hop.appendChild(tinh);
    hop.appendChild(hangNut);
    document.body.appendChild(phu);

    dungRuot({ ruot, tinh, hangNut, dong });
    return dong;
  }

  function nutPhu(chu, khiBam) {
    const b = el("button", "nutPhu", chu);
    b.type = "button";
    b.addEventListener("click", khiBam);
    return b;
  }

  function moSuaDangNhap(dn) {
    moHop("Đăng nhập cổng bảo hành " + trangThai.hang, ({ ruot, tinh, hangNut, dong }) => {
      const oUser = el("input", "ganMaTim");
      oUser.type = "text";
      oUser.placeholder = "User";
      oUser.value = dn.user || "";
      /* `autocomplete="off"` ở cả hai ô: đây KHÔNG phải mật khẩu của người
         đang dùng máy, nên để trình duyệt hỏi "lưu mật khẩu này chứ?" là mời
         nó ghi một tài khoản dùng chung vào kho mật khẩu cá nhân. */
      oUser.autocomplete = "off";
      const oMk = el("input", "ganMaTim");
      oMk.type = "text";
      oMk.placeholder = "Mật khẩu";
      oMk.value = dn.mat_khau || "";
      oMk.autocomplete = "off";
      const oHd = el("textarea", "oChuBuoc");
      oHd.placeholder = "Hướng dẫn đăng nhập (địa chỉ cổng, lưu ý khi đăng nhập…)";
      oHd.value = dn.huong_dan || "";

      ruot.appendChild(el("div", "ganMaNhac", "Cả phòng đọc theo đúng bản này."));
      for (const x of [oUser, oMk, oHd]) {
        const b = el("div");
        b.style.marginBottom = "8px";
        b.appendChild(x);
        ruot.appendChild(b);
      }

      hangNut.appendChild(nutPhu("Đóng", dong));
      const luu = nutPhu("Lưu", async () => {
        luu.disabled = true;
        tinh.className = "ganMaTinh";
        tinh.textContent = "Đang lưu…";
        try {
          await goiGhi("/api/bao-hanh/dang-nhap", {
            hang: trangThai.hang, user: oUser.value,
            mat_khau: oMk.value, huong_dan: oHd.value,
          });
          /* Vá ngay vào kết quả đang giữ thay vì tải lại cả tháng: máy chủ
             vừa nhận đúng ba chuỗi này, và lượt mở kế tiếp vẫn đọc lại từ
             Firebase như thường. */
          const hd = trangThai.kq.huong_dan[trangThai.hang];
          hd.dang_nhap = { ...hd.dang_nhap, user: oUser.value.trim(),
                           mat_khau: oMk.value.trim(), huong_dan: oHd.value.trim() };
          dong();
          veRuot();
        } catch (e) {
          luu.disabled = false;
          tinh.className = "ganMaTinh ganMaLoi";
          tinh.textContent = e.message || "Chưa lưu được.";
        }
      });
      hangNut.appendChild(luu);
      oUser.focus();
    });
  }

  /** Hộp thêm/sửa MỘT bước — đúng hai thứ chủ dự án chốt: một ô chữ, và một
   *  chỗ tải ảnh. `b` là bước đang sửa, `null` là thêm mới. */
  function moSuaBuoc(b) {
    const dangSua = !!b;
    moHop(dangSua ? "Sửa bước hướng dẫn" : "Thêm bước hướng dẫn — " + trangThai.hang,
      ({ ruot, tinh, hangNut, dong }) => {
        let anhMoi = b ? b.anh : null;   // khoá ảnh sẽ ghi xuống
        let dangTaiAnh = false;

        const oChu = el("textarea", "oChuBuoc");
        oChu.placeholder = "Hướng dẫn bằng chữ cho bước này";
        oChu.value = b && b.chu ? b.chu : "";
        ruot.appendChild(oChu);

        const hangAnh = el("div");
        hangAnh.style.marginTop = "10px";
        const oFile = el("input");
        oFile.type = "file";
        oFile.accept = "image/png,image/jpeg,image/webp";
        hangAnh.appendChild(oFile);
        const xem = el("img", "xemAnhChon");
        xem.alt = "Ảnh hướng dẫn của bước này";
        xem.hidden = true;
        hangAnh.appendChild(xem);
        const boAnh = nutPhu("✕ Bỏ ảnh", () => {
          anhMoi = null;
          xem.hidden = true;
          boAnh.hidden = true;
          oFile.value = "";
        });
        boAnh.hidden = !anhMoi;
        hangAnh.appendChild(boAnh);
        ruot.appendChild(hangAnh);
        if (anhMoi) { xem.hidden = false; ganAnh(xem, anhMoi); }

        /* Ảnh tải lên NGAY lúc chọn file, không đợi bấm Lưu. Hai lý do: người
           dùng thấy đúng tấm ảnh sẽ được lưu trước khi chốt, và lượt bấm Lưu
           chỉ còn là một lượt ghi Firebase nhỏ — không phải một lượt tải 5 MB
           có thể hỏng sau khi người ta tưởng đã xong. */
        oFile.addEventListener("change", async () => {
          const f = oFile.files && oFile.files[0];
          if (!f) return;
          dangTaiAnh = true;
          tinh.className = "ganMaTinh";
          tinh.textContent = "Đang tải ảnh lên…";
          try {
            const js = await goi("/api/bao-hanh/anh?hang="
              + encodeURIComponent(trangThai.hang),
              { method: "POST", headers: { "Content-Type": f.type }, body: f });
            anhMoi = js.anh;
            xem.hidden = false;
            boAnh.hidden = false;
            /* Hiện THẲNG file vừa chọn thay vì tải ngược tấm vừa gửi lên: nó
               là đúng cùng một tấm, và đỡ một vòng mạng. */
            xem.src = URL.createObjectURL(f);
            tinh.textContent = "Đã tải ảnh lên.";
          } catch (e) {
            tinh.className = "ganMaTinh ganMaLoi";
            tinh.textContent = e.message || "Chưa tải được ảnh.";
            oFile.value = "";
          } finally {
            dangTaiAnh = false;
          }
        });

        hangNut.appendChild(nutPhu("Đóng", dong));
        const luu = nutPhu(dangSua ? "Lưu bước" : "Thêm bước", async () => {
          if (dangTaiAnh) {
            tinh.className = "ganMaTinh ganMaLoi";
            tinh.textContent = "Ảnh đang tải lên, chờ một chút.";
            return;
          }
          if (!oChu.value.trim() && !anhMoi) {
            tinh.className = "ganMaTinh ganMaLoi";
            tinh.textContent = "Bước phải có chữ hướng dẫn, hoặc một tấm ảnh, hoặc cả hai.";
            return;
          }
          luu.disabled = true;
          tinh.className = "ganMaTinh";
          tinh.textContent = "Đang lưu…";
          try {
            await goiGhi("/api/bao-hanh/buoc", {
              hang: trangThai.hang, id: dangSua ? b.id : null,
              chu: oChu.value, anh: anhMoi,
            });
            dong();
            /* Danh sách bước phải đọc lại từ máy chủ: số thứ tự của bước mới
               do Engine cấp, và thứ tự hiện ra là luật của nó. Đoán ở đây là
               dựng bản thứ hai của một luật đang chạy bên kia. */
            await taiLaiHuongDan();
          } catch (e) {
            luu.disabled = false;
            tinh.className = "ganMaTinh ganMaLoi";
            tinh.textContent = e.message || "Chưa lưu được.";
          }
        });
        hangNut.appendChild(luu);
        oChu.focus();
      });
  }

  async function xoaBuoc(b, so) {
    if (!window.confirm("Xoá bước " + so + "? Ảnh của bước này cũng bị xoá theo.")) return;
    $("loiBaoHanh").textContent = "";
    try {
      await goiGhi("/api/bao-hanh/buoc", { hang: trangThai.hang, id: b.id, xoa: true });
      await taiLaiHuongDan();
    } catch (e) {
      $("loiBaoHanh").textContent = "Chưa xoá được: " + e.message;
    }
  }

  /** Đọc lại hướng dẫn sau một lượt sửa bước.
   *
   *  Đi qua chính `/api/bao-hanh` (đường duy nhất trả hướng dẫn) nên nó kéo
   *  về cả danh sách máy — tốn hơn một đường riêng chỉ lấy hướng dẫn, nhưng
   *  sửa bước là việc làm vài lần rồi thôi, còn một endpoint nữa là một cửa
   *  nữa phải canh mãi mãi. Giữ nguyên tab hãng và trạng thái mở/đóng đang
   *  có: người vừa sửa bước 12 không nên bị quăng về đầu danh sách. */
  async function taiLaiHuongDan() {
    const kq = await goi("/api/bao-hanh?ky=" + encodeURIComponent(trangThai.kyCuaKq));
    trangThai.kq = kq;
    veTatCa();
  }

  /* ═══════════════ Nối dây ═══════════════ */

  window.BaoHanh = {
    /** Màn báo cáo báo sang: đang xem kỳ nào. */
    datKy,
    /** Màn bảo hành có đang mở không — màn báo cáo hỏi trước khi bật biểu đồ. */
    dangMo: function () { return trangThai.man === "bao-hanh"; },
  };

  document.addEventListener("DOMContentLoaded", function () {
    veTabMan();
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) return;
      /* Đăng xuất thì quên sạch: người sau đăng nhập vào cùng trình duyệt
         không được thấy mật khẩu cổng hãng lẫn tên khách của người trước.
         Thu hồi cả blob ảnh — chúng sống tới lúc đóng tab nếu không gọi. */
      for (const hua of anhDaTai.values()) {
        Promise.resolve(hua).then((u) => URL.revokeObjectURL(u), () => {});
      }
      anhDaTai.clear();
      trangThai.kq = null;
      trangThai.kyCuaKq = null;
      trangThai.ky = null;
      $("veBaoHanh").innerHTML = "";
      $("tabHang").innerHTML = "";
    });
  });
})();
