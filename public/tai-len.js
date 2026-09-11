/* Màn "Nhập sổ bán hàng" (P3). File RIÊNG, nạp bằng <script src> — quy ước
 * CLAUDE.md/ROADMAP.md cho hai nhánh chạy song song, và `kiem/luat-so-1.js`
 * soi từng file .js rời một.
 *
 * TOÀN BỘ những gì file này làm:
 *   1. nhận file .xlsx người dùng chọn, nhờ `doc-xlsx.js` đọc ra MA TRẬN Ô
 *   2. POST /api/tai-so kèm Firebase ID token
 *   3. VẼ kết quả ĐÃ TÍNH SẴN mà Gateway trả về
 *
 * Không một công thức tiền nào ở đây, và cũng không một luật nào về sổ: file
 * này không biết cột nào là nhân viên, không biết dòng nào phải bỏ, không
 * biết "một đơn" là gì. Nó gửi nguyên ma trận ô lên và đọc lại số Engine
 * tính ra (LUẬT SỐ 1 — CLAUDE.md).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---- Định dạng: RÚT GỌN theo nghìn đồng, chủ dự án chốt 11/09/2026 ----
   *
   * "6.450" nghĩa là 6.450.000 đ, đúng như file báo cáo tay đang dùng. Đây
   * là ĐỊNH DẠNG, không phải phép tính nghiệp vụ: con số gốc vẫn là đồng,
   * do Engine tính, và chia 1.000 chỉ đổi cách viết ra màn hình.
   *
   * Giữ tới 3 số lẻ chứ không làm tròn về nghìn chẵn: trên 27.299 dòng của
   * ba sổ thật có 5 dòng không chẵn nghìn (9.950.001 đ, 4.090.909,09 đ — số
   * tính ngược từ giá gồm VAT). Làm tròn là bịa mất phần lẻ của chính sổ. */
  function nghin(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
  }

  /* Dòng TỔNG làm tròn về nghìn chẵn — cùng luật với màn đơn hàng
     (`don-hang.js`). Màn này chỉ có số tổng, không có dòng hàng nào, nên
     mọi chỗ hiện tiền ở đây đều dùng hàm này. */
  function nghinTron(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return Math.round(n / 1000).toLocaleString("vi-VN");
  }

  const soNguyen = (v) => (Number(v) || 0).toLocaleString("vi-VN");

  /** "YYYY-MM" → "tháng 09/2026". */
  function nhanKy(ky) {
    const m = String(ky).match(/^(\d{4})-(\d{2})$/);
    return m ? "tháng " + m[2] + "/" + m[1] : String(ky);
  }

  /** "YYYY-MM-DD" → "11/09". */
  function nhanNgay(d) {
    const m = String(d).match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? m[2] + "/" + m[1] : String(d || "");
  }

  /* Câu giải thích cho từng mã cảnh báo Engine trả về. Engine trả MÃ chứ
   * không trả câu chữ — mã là thứ bộ kiểm ghim được, câu chữ là việc của
   * màn hình. Mã lạ (Engine thêm cảnh báo mới mà màn hình chưa biết) vẫn
   * phải hiện ra nguyên mã, không được nuốt. */
  const CAU_CANH_BAO = {
    "thieu-nhan-vien": "dòng không ghi tên nhân viên — tiền vẫn được tính, dồn vào “_chua_xac_dinh”",
    "thieu-ngay": "dòng không đọc được ngày bán — KHÔNG xếp được vào kỳ nào",
    "tien-khong-doc-duoc": "dòng không đọc được số tiền — tạm tính 0",
    "ngay-bat-thuong": "dòng có ngày ngoài khoảng hợp lý — nhiều khả năng gõ nhầm ở MISA",
    "don-nhieu-ngay": "một số chứng từ nằm ở hai ngày khác nhau",
    "don-nhieu-nhan-vien": "một số chứng từ nằm ở hai nhân viên khác nhau",
    "so-don-cong-doi": "số đơn cộng theo ô không bằng số chứng từ khác nhau của cả sổ",
    "doi-chieu-noi-bo-lech": "cộng theo ngày KHÔNG bằng cộng theo dòng",
  };

  /* ---- Dựng DOM bằng textContent, không bằng chuỗi HTML ----
   * Bảng này hiện tên khách, địa chỉ, tên hàng — chữ do người khác gõ vào
   * MISA. Ghép thẳng vào innerHTML là mở đường cho một ô tên khách chứa thẻ
   * script. textContent không bao giờ diễn giải chữ thành HTML. */
  function el(the, lop, chu) {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  }

  let dangChay = false;

  /* ---- Vẽ kết quả một lượt tải ---- */

  function veCanhBao(khung, canh_bao) {
    if (!canh_bao || !canh_bao.length) return;
    const h = el("div", "khoiKq");
    h.appendChild(el("h3", null, "Cảnh báo từ sổ"));
    const ul = el("ul", "dsCanhBao");
    for (const c of canh_bao) {
      const li = el("li");
      li.appendChild(el("b", null, soNguyen(c.so_luong) + " × "));
      li.appendChild(document.createTextNode(CAU_CANH_BAO[c.ma] || c.ma));
      if (c.vi_du && c.vi_du.length) {
        li.appendChild(el("span", "viDu", " — ví dụ: " + c.vi_du.slice(0, 8).join(", ")));
      }
      if (c.doanh_so_khong_xep_duoc) {
        li.appendChild(el("span", "viDu", " — " + nghinTron(c.doanh_so_khong_xep_duoc) + " nghìn đ không xếp được kỳ"));
      }
      ul.appendChild(li);
    }
    h.appendChild(ul);
    khung.appendChild(h);
  }

  function bangThayDoi(ten, ds, cot) {
    const h = el("details", "khoiDoi");
    h.appendChild(el("summary", null, ten));
    const b = el("table", "bangNho");
    const tr = el("tr");
    for (const c of cot) tr.appendChild(el("th", null, c));
    b.appendChild(tr);
    for (const d of ds) {
      const r = el("tr");
      r.appendChild(el("td", null, nhanNgay(d.ngay)));
      r.appendChild(el("td", null, d.so_ct));
      r.appendChild(el("td", null, d.ten_hang));
      if (cot.length > 3) {
        const doi_gi = (d.doi_gi || []).join(", ");
        let chi = doi_gi;
        if (d.truoc && d.sau) {
          chi = (d.doi_gi || []).map(t =>
            t + ": " + (d.truoc[t] === null ? "—" : d.truoc[t]) + " → " + (d.sau[t] === null ? "—" : d.sau[t])
          ).join("; ");
        }
        r.appendChild(el("td", null, chi || d.ly_do || ""));
      }
      b.appendChild(r);
    }
    h.appendChild(b);
    return h;
  }

  function veMotKy(khung, k) {
    const h = el("div", "khoiKq");
    h.appendChild(el("h3", null, nhanKy(k.ky) + (k.la_ky_moi ? " — kỳ mới" : " — đã ghi đè")));

    const dl = el("dl", "soLieu");
    const them = (nhan, giaTri) => { dl.appendChild(el("dt", null, nhan)); dl.appendChild(el("dd", null, giaTri)); };
    them("Doanh số", nghinTron(k.thang.doanh_so) + " nghìn đ");
    them("Số đơn", soNguyen(k.thang.so_don));
    them("Dòng hàng", soNguyen(k.pham_vi.so_dong));
    them("Khoảng ngày", nhanNgay(k.pham_vi.tu) + " → " + nhanNgay(k.pham_vi.den)
      + " (" + k.pham_vi.so_ngay + " ngày có đơn)");
    them("Nhân viên", soNguyen(k.thang.so_nhan_vien));
    h.appendChild(dl);

    const d = k.doi_chieu || {};
    const tomTat = el("p", "tomTatDoi");
    tomTat.appendChild(el("b", null, soNguyen(d.them) + " dòng mới"));
    tomTat.appendChild(document.createTextNode(" · "));
    tomTat.appendChild(el("b", null, soNguyen(d.doi) + " dòng thay đổi"));
    tomTat.appendChild(document.createTextNode(" · "));
    tomTat.appendChild(el("b", null, soNguyen(d.mat) + " dòng biến mất"));
    tomTat.appendChild(document.createTextNode(" · " + soNguyen(d.giu) + " dòng giữ nguyên"));
    h.appendChild(tomTat);

    if (d.bi_khoa) {
      /* Đây là thứ chủ dự án muốn thấy nổi bật nhất: dòng đã chỉnh sửa tay
         KHÔNG bị file mới đè, và phải được kiểm lại bằng mắt. */
      const c = el("p", "canhBaoDam",
        "⚠ " + soNguyen(d.bi_khoa) + " dòng đã chỉnh sửa tay nên KHÔNG bị đè — kiểm lại xem file mới có đúng không.");
      h.appendChild(c);
    }

    if (k.doi && k.doi.length) h.appendChild(bangThayDoi("Dòng thay đổi (" + soNguyen(d.doi) + ")", k.doi, ["Ngày", "Số BH", "Mã sản phẩm", "Đổi gì"]));
    if (k.mat && k.mat.length) h.appendChild(bangThayDoi("Dòng biến mất (" + soNguyen(d.mat) + ")", k.mat, ["Ngày", "Số BH", "Mã sản phẩm"]));
    if (k.bi_khoa && k.bi_khoa.length) h.appendChild(bangThayDoi("Dòng bị khoá (" + soNguyen(d.bi_khoa) + ")", k.bi_khoa, ["Ngày", "Số BH", "Mã sản phẩm", "Vì sao"]));

    khung.appendChild(h);
  }

  function veKetQua(kq) {
    const khung = $("kqTaiLen");
    khung.innerHTML = "";

    if (!kq.ghi) {
      const h = el("div", "khoiKq khoiTuChoi");
      h.appendChild(el("h3", null, "KHÔNG ghi gì cả"));
      h.appendChild(el("p", null, kq.cau || "Lượt tải bị từ chối."));
      if (kq.thieu && kq.thieu.length) {
        const ul = el("ul", "dsCanhBao");
        for (const t of kq.thieu) {
          ul.appendChild(el("li", null, nhanKy(t.ky) + ": đang có "
            + nhanNgay(t.cu.tu) + "→" + nhanNgay(t.cu.den) + ", file mới chỉ có "
            + nhanNgay(t.moi.tu) + "→" + nhanNgay(t.moi.den)));
        }
        h.appendChild(ul);
      }
      khung.appendChild(h);
      if (kq.canh_bao) veCanhBao(khung, kq.canh_bao);
      return;
    }

    const dau = el("div", "khoiKq khoiXong");
    dau.appendChild(el("h3", null, "Đã ghi xong"));
    dau.appendChild(el("p", null,
      soNguyen(kq.tom_tat.dong_tong) + " dòng đọc được · "
      + soNguyen(kq.tom_tat.dong_bo_thieu_so_ct) + " dòng bỏ (không có số chứng từ) · tổng "
      + nghinTron(kq.tom_tat.doanh_so_tong) + " nghìn đ · " + soNguyen(kq.tom_tat.so_don_tong) + " đơn"));
    if (kq.dong_khong_co_ky) {
      dau.appendChild(el("p", "canhBaoDam",
        "⚠ " + soNguyen(kq.dong_khong_co_ky) + " dòng không đọc được ngày nên không vào kỳ nào."));
    }
    khung.appendChild(dau);

    for (const k of kq.ky_da_ghi || []) veMotKy(khung, k);
    veCanhBao(khung, kq.canh_bao);

    if (kq.ky_da_ghi && kq.ky_da_ghi.length) veBanLuu(kq.ky_da_ghi[kq.ky_da_ghi.length - 1].ky);
  }

  /* ---- Bản lưu + hoàn tác ---- */

  async function goi(duong, tuyChon) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Chưa đăng nhập.");
    const token = await user.getIdToken();
    const o = Object.assign({ headers: {} }, tuyChon || {});
    o.headers = Object.assign({}, o.headers, { Authorization: "Bearer " + token });
    const r = await fetch(duong, o);
    const than = await r.json().catch(() => ({}));
    /* Kèm `rid` vào câu lỗi hiện cho người dùng — Gateway ghi một dòng log
       có cấu trúc cho MỖI lỗi (`ma`, `ly`, `rid`), nhưng chi tiết đó không
       bao giờ ra khỏi log (CLAUDE.md — không lộ mã lỗi nội bộ). `rid` là
       cầu nối AN TOÀN duy nhất: không nói lỗi gì, chỉ nói "tra dòng log
       nào" — nên người đọc log tìm ra nguyên nhân mà không cần đoán, và
       không phải đăng nhập Cloudflare Dashboard để dò cả nghìn dòng log. */
    if (!r.ok) throw new Error((than.loi || ("HTTP " + r.status)) + (than.rid ? " (mã: " + than.rid + ")" : ""));
    return than;
  }

  async function veBanLuu(ky) {
    const khung = $("banLuu");
    khung.innerHTML = "";
    let ds;
    try { ds = await goi("/api/ban-luu?ky=" + encodeURIComponent(ky)); }
    catch (e) { khung.appendChild(el("p", "canhBao", "Không đọc được danh sách bản lưu: " + e.message)); return; }
    if (!ds.ban || !ds.ban.length) return;

    const h = el("div", "khoiKq");
    h.appendChild(el("h3", null, "Bản lưu của " + nhanKy(ky)));
    h.appendChild(el("p", "viDu", "Giữ ba bản gần nhất. Quay lại một bản là khôi phục trọn kỳ về đúng lúc đó — "
      + "bản hiện tại được lưu trước khi quay, nên quay nhầm vẫn quay lại được."));
    for (const b of ds.ban) {
      const dong = el("div", "motBanLuu");
      dong.appendChild(el("span", null,
        (b.luc ? new Date(b.luc).toLocaleString("vi-VN") : b.moc)
        + (b.truoc_khi ? " · trước khi tải " + b.truoc_khi : "") + (b.boi ? " · " + b.boi : "")));
      const nut = el("button", "nutNho", "Quay lại bản này");
      nut.type = "button";
      nut.addEventListener("click", () => hoanTac(ky, b.moc, nut));
      dong.appendChild(nut);
      h.appendChild(dong);
    }
    khung.appendChild(h);
  }

  async function hoanTac(ky, moc, nut) {
    if (!window.confirm("Quay " + nhanKy(ky) + " về bản lưu này? Số liệu hiện tại của kỳ đó sẽ bị thay.")) return;
    nut.disabled = true;
    try {
      const kq = await goi("/api/hoan-tac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ky: ky, moc: moc }),
      });
      $("loiTaiLen").textContent = "";
      $("kqTaiLen").innerHTML = "";
      const h = el("div", "khoiKq khoiXong");
      h.appendChild(el("h3", null, kq.xong ? "Đã quay về bản lưu" : "Không quay được"));
      h.appendChild(el("p", null, kq.xong
        ? (nhanKy(ky) + " đã trở về trạng thái lúc " + (kq.luc ? new Date(kq.luc).toLocaleString("vi-VN") : moc) + ".")
        : (kq.cau || "")));
      $("kqTaiLen").appendChild(h);
      veBanLuu(ky);
    } catch (e) {
      $("loiTaiLen").textContent = "Không quay lại được: " + e.message;
    } finally {
      nut.disabled = false;
    }
  }

  /* ---- Xoá trọn một kỳ ----
   *
   * Cứu cho ca: tải nhầm sổ, một dòng gõ sai ngày thành "2031-03" chẳng
   * hạn, kỳ rác đó nằm lại VĨNH VIỄN vì không kỳ nào tự "hết hạn" — nó
   * không có bản lưu (kỳ mới tinh) nên hoàn tác cũng không giúp gì.
   *
   * `/api/xoa-ky` tự lưu bản cũ TRƯỚC khi xoá, nên xoá nhầm một kỳ ĐÃ CÓ
   * dữ liệu thật vẫn cứu được qua chính "Bản lưu" ở trên — không cần một
   * đường cứu hộ riêng.
   */

  async function veQuanLyKy() {
    const khung = $("quanLyKy");
    khung.innerHTML = '<p class="dangTai">Đang tải danh sách kỳ…</p>';
    let ds;
    try { ds = await goi("/api/ky-co-don"); }
    catch (e) { khung.innerHTML = ""; khung.appendChild(el("p", "canhBao", "Không đọc được danh sách kỳ: " + e.message)); return; }

    khung.innerHTML = "";
    if (!ds.ky.length) {
      khung.appendChild(el("p", "dangTai", "Chưa có kỳ nào."));
      return;
    }

    const h = el("div", "khoiKq");
    h.appendChild(el("h3", null, "Các kỳ đã có"));
    for (const nam of ds.thu_tu_nam) {
      const dong = el("div", "motBanLuu");
      dong.appendChild(el("span", null, nam + ": " + ds.nam[nam].map(nhanKy).join(", ")));
      h.appendChild(dong);
    }
    h.appendChild(el("p", "viDu", "Xoá một kỳ — chỉ dùng cho kỳ tải NHẦM. Bản cũ được lưu lại trước khi xoá, "
      + "quay lại được qua mục “Bản lưu” ở trên."));

    const chonKy = el("div", "hangChon");
    const oChon = document.createElement("select");
    oChon.className = "nutNho";
    for (const ky of ds.ky) {
      const opt = document.createElement("option");
      opt.value = ky; opt.textContent = nhanKy(ky);
      oChon.appendChild(opt);
    }
    chonKy.appendChild(oChon);
    const nutXoa = el("button", "nutNho", "Xoá kỳ này");
    nutXoa.type = "button";
    nutXoa.addEventListener("click", () => xoaMotKy(oChon.value, nutXoa));
    chonKy.appendChild(nutXoa);
    h.appendChild(chonKy);

    khung.appendChild(h);
  }

  async function xoaMotKy(ky, nut) {
    if (!ky) return;
    if (!window.confirm("XOÁ TRỌN " + nhanKy(ky) + "? Toàn bộ doanh số, đơn hàng, dòng hàng của kỳ này "
      + "sẽ biến mất khỏi các màn hình — chỉ dùng khi tải nhầm. Bản cũ được lưu lại, quay lại được sau.")) return;
    nut.disabled = true;
    try {
      const kq = await goi("/api/xoa-ky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ky: ky }),
      });
      $("loiTaiLen").textContent = "";
      $("kqTaiLen").innerHTML = "";
      const h = el("div", "khoiKq khoiXong");
      h.appendChild(el("h3", null, kq.xong ? "Đã xoá" : "Không xoá được"));
      h.appendChild(el("p", null, kq.xong ? (nhanKy(ky) + " đã xoá.") : (kq.cau || "")));
      $("kqTaiLen").appendChild(h);
      await veQuanLyKy();
      if (kq.xong) veBanLuu(ky);
    } catch (e) {
      $("loiTaiLen").textContent = "Không xoá được: " + e.message;
    } finally {
      nut.disabled = false;
    }
  }

  /* ---- Lượt tải ---- */

  async function taiLen() {
    if (dangChay) return;
    const oFile = $("oFileSo");
    const f = oFile.files && oFile.files[0];
    const loi = $("loiTaiLen"), trangThai = $("trangThaiTaiLen");
    loi.textContent = "";
    if (!f) { loi.textContent = "Chọn một file .xlsx trước đã."; return; }
    if (!/\.xlsx$/i.test(f.name)) { loi.textContent = "Chỉ nhận file .xlsx xuất từ MISA."; return; }

    dangChay = true;
    $("nutTaiLen").disabled = true;
    $("kqTaiLen").innerHTML = "";
    $("banLuu").innerHTML = "";
    try {
      trangThai.textContent = "Đang đọc file…";
      const u8 = new Uint8Array(await f.arrayBuffer());
      const doc = await window.DocXlsx.docBangTuXlsx(u8);

      trangThai.textContent = "Đang gửi lên (" + doc.bang.length + " hàng)…";
      const kq = await goi("/api/tai-so", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ten_file: f.name, bang: doc.bang }),
      });

      trangThai.textContent = "";
      veKetQua(kq);
      if (kq.ghi) veQuanLyKy();
    } catch (e) {
      trangThai.textContent = "";
      loi.textContent = e.message;
    } finally {
      dangChay = false;
      $("nutTaiLen").disabled = false;
    }
  }

  function moMan() {
    $("manChu").hidden = true;
    $("manTaiLen").hidden = false;
    veQuanLyKy();
  }
  function dongMan() {
    $("manTaiLen").hidden = true;
    $("manChu").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const the = $("theNhapSo");
    if (the) {
      the.addEventListener("click", moMan);
      the.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); moMan(); }
      });
    }
    const quay = $("nutQuayTaiLen");
    if (quay) quay.addEventListener("click", dongMan);
    const nut = $("nutTaiLen");
    if (nut) nut.addEventListener("click", taiLen);
  });
})();
