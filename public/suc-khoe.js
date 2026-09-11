/* DASHBOARD — sức khoẻ kinh doanh toàn công ty, vẽ vào ô `#o-dashboard`.
 *
 * Ô đó do nhánh P3 chừa sẵn trong khung tab của màn Báo cáo bán hàng (quy
 * ước ở ROADMAP.md: P3 sở hữu KHUNG, P2(b) sở hữu NỘI DUNG ô này). File này
 * không đụng gì bên ngoài ô — không bật/tắt màn hình, không vẽ tab năm hay
 * tab line của P3.
 *
 * Bố cục chủ dự án chốt 11/09/2026:
 *
 *   [Ngày] [Tháng] [Quý]        ← tab đơn vị
 *   [ biểu đồ ]
 *   [T1][T2]…[T12]              ← dải phụ, ĐỔI THEO TAB:
 *                                  Ngày  → 12 tháng
 *                                  Tháng → các năm có số
 *                                  Quý   → không có
 *
 * Vì sao tab Ngày xem mỗi lần một tháng: vẽ cả 366 ngày lên một trục thì
 * "quá dày", không đọc được. Engine đã chia sẵn chuỗi ngày theo tháng
 * (`theo_ngay_thang`), file này chỉ chọn đúng ngăn rồi vẽ.
 *
 * LUẬT SỐ 1: không một công thức tiền nào ở đây. "Ngày nào thuộc tháng/quý
 * nào", "năm trước là năm nào" đều do Engine tính sẵn
 * (`engine/src/gop-theo-thoi-gian.mjs`). Chỗ duy nhất file này động vào số
 * là CHIA 1.000 để hiện cho gọn — đó là định dạng, không phải nghiệp vụ.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ─────────── Thuần: định dạng + dựng chuỗi SVG (không đụng DOM) ─────────── */

  /* Trục dọc "làm gọn": 1.000.000.000 đ hiện thành 1.000.000 (bỏ ba số 0
   * cuối). Đơn vị hiểu ngầm là nghìn đồng, có ghi rõ ở chú giải để không ai
   * đọc nhầm thành đồng. */
  const lamGon = (v) => Math.round((Number(v) || 0) / 1000).toLocaleString("vi-VN");
  const tienDay = (v) => (Number(v) || 0).toLocaleString("vi-VN") + " đ";
  const soDon = (v) => (Number(v) || 0).toLocaleString("vi-VN");

  const thoat = (s) => String(s).replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  }[c]));

  /** Số ngày của một tháng — chỉ để biết trục ngang dài tới đâu (tháng 2 dừng
   *  ở 28/29 chứ không chừa chỗ trống tới 31). Đây là hình học của biểu đồ,
   *  không phải luật nghiệp vụ. */
  const soNgayTrongThang = (nam, thang) => new Date(Date.UTC(nam, thang, 0)).getUTCDate();

  /** `{ "<vị trí>": {doanh_so, so_don, khoa} }` → mảng đã sắp theo vị trí. */
  function layDiem(bangViTri) {
    if (!bangViTri) return [];
    return Object.keys(bangViTri).map(Number).sort((a, b) => a - b).map((vt) => ({
      vt,
      doanh_so: Number(bangViTri[vt].doanh_so) || 0,
      so_don: Number(bangViTri[vt].so_don) || 0,
      khoa: bangViTri[vt].khoa,
    }));
  }

  const MAU_NAY = "#2563eb";    // kỳ đang xem — màu nhấn
  const MAU_TRUOC = "#9ca3af";  // cùng kỳ năm trước — xám, không tranh màu nhấn

  /* Thấp hơn bản một-biểu-đồ: giờ có HAI biểu đồ xếp dọc, giữ nguyên chiều
     cao cũ là phải cuộn mới thấy hết dải nút tháng nằm dưới cùng. */
  const RONG = 640, CAO = 200;
  const LE_TRAI = 64, LE_PHAI = 14, LE_TREN = 12, LE_DUOI = 30;
  const CAO_VE = CAO - LE_TREN - LE_DUOI;
  const RONG_VE = RONG - LE_TRAI - LE_PHAI;

  /** Đỉnh trục dọc "đẹp": bước chia làm tròn về 1/2/5 × 10^n để nhãn ra số
   *  chẵn. Lấy thẳng giá trị lớn nhất làm đỉnh thì ba mốc chia ra những con
   *  số như 6.667 và 13.333 — đọc biểu đồ mà phải nhẩm là hỏng.
   *
   *  `nguyen` cho biểu đồ SỐ ĐƠN: đơn hàng không có nửa đơn, bước chia phải
   *  là số nguyên, không thì trục hiện "1, 1, 2" vì hai mốc lẻ cùng làm tròn
   *  về 1. */
  function dinhTruc(gtLonNhat, soBuoc, nguyen) {
    if (!(gtLonNhat > 0)) return soBuoc;
    let buoc = gtLonNhat / soBuoc;
    const bac = Math.pow(10, Math.floor(Math.log10(buoc)));
    buoc = ([1, 2, 5, 10].find((n) => n * bac >= buoc) || 10) * bac;
    if (nguyen) buoc = Math.max(1, Math.round(buoc));
    return buoc * soBuoc;
  }

  /** Vẽ MỘT chuỗi thành các đoạn path + chấm điểm.
   *
   *  Ngắt đoạn khi hai điểm liền nhau cách nhau hơn một vị trí: một khoảng
   *  trống thật trong sổ (ngày nghỉ, kỳ chưa nhập) không được nối liền thành
   *  một đường giả như thể hôm đó vẫn bán.
   *
   *  Có CHẤM ở từng điểm, không chỉ đường: chuỗi một điểm duy nhất (tab Quý
   *  đầu năm, hoặc một tháng mới có một ngày) mà chỉ vẽ đường thì không hiện
   *  ra gì cả — bản Dashboard đầu tiên đã vấp đúng lỗi đó. */
  function veChuoi(diem, layGiaTri, x, y, mau, netDut, nhanDiem) {
    if (!diem.length) return "";
    let d = "", vtTruoc = null, cham = "";
    for (const p of diem) {
      const px = x(p.vt), py = y(layGiaTri(p));
      d += (vtTruoc === null || p.vt - vtTruoc > 1 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1) + " ";
      vtTruoc = p.vt;
      cham += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="2.5" fill="' + mau + '">'
        + "<title>" + thoat(nhanDiem(p)) + "</title></circle>";
    }
    return '<path d="' + d.trim() + '" fill="none" stroke="' + mau + '" stroke-width="'
      + (netDut ? "2" : "2.5") + '"' + (netDut ? ' stroke-dasharray="5,4"' : "") + "/>" + cham;
  }

  /** Biểu đồ hai đường: kỳ đang xem chồng lên đúng kỳ đó của năm trước.
   *
   *  Nhận một ĐỐI TƯỢNG chứ không phải mười tham số xếp hàng — cùng một hàm
   *  giờ vẽ cả doanh số lẫn số đơn, chỉ khác `layGiaTri`/`nhanDoc`, và một
   *  danh sách mười tham số thì chỉ cần đảo nhầm hai cái là ra một biểu đồ
   *  trông vẫn bình thường nhưng sai.
   *
   *  · `layGiaTri(p)` — lấy con số nào của một điểm (doanh_so hay so_don)
   *  · `nhanDoc(v)`   — viết con số đó ra nhãn trục dọc
   *  · `nhanTruc(vt)` — nhãn trục ngang
   *  · `moTa(p, nam)` — câu hiện khi rê chuột (kể CẢ HAI con số, để rê ở
   *                     biểu đồ nào cũng đọc được đủ) */
  function veBieuDo(c) {
    const dinh = Math.max(c.dinhToiThieu || 0, dinhTruc(
      Math.max(0, ...c.diemNay.map((p) => c.layGiaTri(p)), ...c.diemTruoc.map((p) => c.layGiaTri(p))),
      3, c.nguyen));
    const x = (vt) => LE_TRAI
      + (c.vtMax > c.vtMin ? ((vt - c.vtMin) / (c.vtMax - c.vtMin)) * RONG_VE : RONG_VE / 2);
    const y = (v) => LE_TREN + CAO_VE - (v / dinh) * CAO_VE;

    // Bốn mốc lưới ngang, đều từ 0 tới đỉnh.
    let luoi = "";
    for (let i = 0; i <= 3; i++) {
      const gt = (dinh / 3) * i, gy = y(gt);
      luoi += '<line x1="' + LE_TRAI + '" x2="' + (RONG - LE_PHAI) + '" y1="' + gy.toFixed(1)
        + '" y2="' + gy.toFixed(1) + '" stroke="#e5e7eb" stroke-width="1"/>'
        + '<text x="' + (LE_TRAI - 8) + '" y="' + (gy + 4).toFixed(1)
        + '" font-size="10" fill="#6b7280" text-anchor="end">' + c.nhanDoc(gt) + "</text>";
    }
    const vtMin = c.vtMin, vtMax = c.vtMax, nhanTruc = c.nhanTruc;

    /* Nhãn trục ngang: nhiều nhất ~10 nhãn, chia đều theo MIỀN TRỤC chứ không
       theo điểm có dữ liệu — trục ngang giờ là 1..31 hoặc 1..12 nên vị trí
       nào cũng có nhãn được, kể cả ngày không bán được đơn nào. */
    const soViTri = vtMax - vtMin + 1;
    const buoc = Math.max(1, Math.ceil(soViTri / 12));
    const moc = [];
    for (let vt = vtMin; vt <= vtMax; vt += buoc) moc.push(vt);
    /* Mốc cuối luôn có nhãn: 12 tháng với bước 1 thì đã sẵn, nhưng một tháng
       30 ngày với bước 3 dừng ở 28 — trục kết thúc ở một con số không ghi là
       người xem không biết biểu đồ chạy tới đâu. */
    if (moc[moc.length - 1] !== vtMax) moc.push(vtMax);
    let nhan = "";
    for (const vt of moc) {
      nhan += '<text x="' + x(vt).toFixed(1) + '" y="' + (CAO - 8)
        + '" font-size="10" fill="#6b7280" text-anchor="middle">' + thoat(nhanTruc(vt)) + "</text>";
    }

    return '<svg viewBox="0 0 ' + RONG + " " + CAO + '" width="100%" role="img" aria-label="'
      + thoat(c.nhanKhung) + '">'
      + luoi + nhan
      + veChuoi(c.diemTruoc, c.layGiaTri, x, y, MAU_TRUOC, true, (p) => c.moTa(p, c.namTruoc))
      + veChuoi(c.diemNay, c.layGiaTri, x, y, MAU_NAY, false, (p) => c.moTa(p, c.namNay))
      + "</svg>";
  }

  /* MỘT chú giải cho CẢ HAI biểu đồ — hai đường của chúng là cùng hai kỳ,
     lặp lại chú giải hai lần chỉ tổ rối. Đơn vị trục dọc khác nhau nên ghi
     riêng ở tiêu đề từng biểu đồ, không ghi ở đây. */
  function chuGiai(tenNay, tenTruoc, coTruoc) {
    return '<div class="chuGiaiSk">'
      + '<span><i style="background:' + MAU_NAY + '"></i>' + thoat(tenNay) + "</span>"
      + (coTruoc ? '<span><i class="netDut" style="background:' + MAU_TRUOC + '"></i>' + thoat(tenTruoc) + "</span>" : "")
      + "</div>";
  }

  /* HAI biểu đồ, KHÔNG gộp hai trục dọc vào một khung (chủ dự án chốt lúc
     duyệt mockup): tiền và số đơn khác đơn vị, chồng chung một khung là mời
     người đọc so hai đường không so được với nhau. */
  const BIEU_DO = [
    {
      ten: "Doanh số", donVi: "nghìn đồng", nguyen: false,
      layGiaTri: (p) => p.doanh_so,
      nhanDoc: lamGon,
      /* Nhãn trục chia 1.000 rồi làm tròn, nên một kỳ mà doanh số cả kỳ
         dưới 3.000 đ sẽ ra bốn mốc cùng là "0". Nghe vô lý nhưng có thật:
         đơn bị chiết khấu hết thành 0 đ đã xuất hiện trong sổ 09/2026. Sàn
         này giữ trục luôn đọc được 0|1|2|3. */
      dinhToiThieu: 3000,
    },
    {
      ten: "Số đơn", donVi: "đơn", nguyen: true,
      layGiaTri: (p) => p.so_don,
      nhanDoc: (v) => Math.round(v).toLocaleString("vi-VN"),
    },
  ];

  /* ─────────── Điều phối ─────────── */

  const trangThai = { donVi: "ngay", nam: null, thang: null };
  let duLieu = null;     // kết quả /api/bao-cao/suc-khoe, nhớ lại để đổi tab không gọi lại
  let dangTai = false;

  const TEN_DON_VI = { ngay: "Ngày", thang: "Tháng", quy: "Quý" };

  /** Ngăn dữ liệu của một (đơn vị, năm). `duoi` là đuôi tiêu đề dùng chung
   *  cho cả hai biểu đồ ("theo ngày · tháng 9/2026"), `tenKy` là tên kỳ để
   *  nói khi chưa có số. */
  function dungKhung(nam) {
    const dv = trangThai.donVi;
    if (dv === "thang") {
      return {
        lay: (n) => layDiem((duLieu.theo_thang || {})[n]),
        vtMin: 1, vtMax: 12,
        nhanTruc: (vt) => "T" + vt,
        moTa: (p, n) => "Tháng " + p.vt + "/" + n + " · " + tienDay(p.doanh_so) + " · " + soDon(p.so_don) + " đơn",
        duoi: "theo tháng · năm " + nam,
        tenKy: "Năm " + nam,
      };
    }
    if (dv === "quy") {
      return {
        lay: (n) => layDiem((duLieu.theo_quy || {})[n]),
        vtMin: 1, vtMax: 4,
        nhanTruc: (vt) => "Q" + vt,
        moTa: (p, n) => "Quý " + p.vt + "/" + n + " · " + tienDay(p.doanh_so) + " · " + soDon(p.so_don) + " đơn",
        duoi: "theo quý · năm " + nam,
        tenKy: "Năm " + nam,
      };
    }
    const th = trangThai.thang;
    return {
      lay: (n) => layDiem(((duLieu.theo_ngay_thang || {})[n] || {})[th]),
      vtMin: 1,
      vtMax: Math.max(soNgayTrongThang(nam, th), soNgayTrongThang(nam - 1, th)),
      nhanTruc: (vt) => String(vt),
      moTa: (p, n) => p.vt + "/" + String(th).padStart(2, "0") + "/" + n + " · "
        + tienDay(p.doanh_so) + " · " + soDon(p.so_don) + " đơn",
      duoi: "theo ngày · tháng " + th + "/" + nam,
      tenKy: "Tháng " + th + "/" + nam,
    };
  }

  function veBieuDoHienTai() {
    const oVe = $("skVe");
    if (!oVe) return;
    const nam = trangThai.nam, namTruoc = nam - 1;
    const k = dungKhung(nam);
    const diemNay = k.lay(nam), diemTruoc = k.lay(namTruoc);

    if (!diemNay.length && !diemTruoc.length) {
      oVe.innerHTML = '<p class="dangTai">' + thoat(k.tenKy) + " — chưa có số nào cho kỳ này.</p>";
      return;
    }
    let html = "";
    for (const bd of BIEU_DO) {
      const nhanKhung = bd.ten + " " + k.duoi;
      html += '<div class="khoiBieuDo"><p class="tieuDeSk">' + thoat(nhanKhung)
        + ' <span class="donViCua">(' + thoat(bd.donVi) + ")</span></p>"
        + veBieuDo({
          diemNay, diemTruoc, namNay: nam, namTruoc,
          vtMin: k.vtMin, vtMax: k.vtMax, nhanTruc: k.nhanTruc, moTa: k.moTa,
          layGiaTri: bd.layGiaTri, nhanDoc: bd.nhanDoc, nguyen: bd.nguyen,
          nhanKhung,
        }) + "</div>";
    }
    oVe.innerHTML = html + chuGiai("Năm " + nam, "Năm " + namTruoc, diemTruoc.length > 0);
  }

  /** Dải nút phụ dưới biểu đồ — nội dung ĐỔI THEO TAB. */
  function veDaiPhu() {
    const hang = $("skDaiPhu");
    if (!hang) return;
    hang.innerHTML = "";
    if (trangThai.donVi === "quy") return;   // quý chưa cần chọn gì

    if (trangThai.donVi === "thang") {
      for (const nam of duLieu.cac_nam) {
        hang.appendChild(nutPhu(String(nam), nam === trangThai.nam, false, () => {
          trangThai.nam = nam; veLai();
        }));
      }
      return;
    }
    const cuaNam = (duLieu.theo_ngay_thang || {})[trangThai.nam] || {};
    for (let th = 1; th <= 12; th++) {
      const coSo = !!cuaNam[th];
      hang.appendChild(nutPhu("T" + th, th === trangThai.thang, !coSo, () => {
        trangThai.thang = th; veLai();
      }));
    }
  }

  function nutPhu(chu, dangChon, tat, khiBam) {
    const nut = document.createElement("button");
    nut.type = "button";
    nut.className = "tabNut tabNho" + (dangChon ? " tabDang" : "");
    nut.textContent = chu;
    /* Tháng không có số vẫn HIỆN nhưng bấm không được: ẩn hẳn thì người xem
       tưởng báo cáo thiếu tháng, còn bấm vào một tháng rỗng thì chỉ tổ mở ra
       một biểu đồ trắng. */
    if (tat) nut.disabled = true;
    else nut.addEventListener("click", khiBam);
    return nut;
  }

  function veTabDonVi() {
    const hang = $("skTabDonVi");
    if (!hang) return;
    hang.innerHTML = "";
    for (const dv of ["ngay", "thang", "quy"]) {
      const nut = document.createElement("button");
      nut.type = "button";
      nut.className = "tabNut" + (dv === trangThai.donVi ? " tabDang" : "");
      nut.textContent = TEN_DON_VI[dv];
      nut.addEventListener("click", () => { trangThai.donVi = dv; veLai(); });
      hang.appendChild(nut);
    }
  }

  function veLai() {
    veTabDonVi();
    veDaiPhu();
    veBieuDoHienTai();
  }

  /** Khung cố định của Dashboard, dựng một lần vào ô P3 chừa sẵn. */
  function dungKhungHtml() {
    const o = $("o-dashboard");
    if (!o) return false;
    o.innerHTML = '<div class="tabDonVi" id="skTabDonVi"></div>'
      + '<div id="skVe"></div>'
      + '<div class="tabDonVi daiPhu" id="skDaiPhu"></div>'
      + '<p class="canhBao" id="skLoi"></p>';
    return true;
  }

  /** Mặc định: đúng NĂM và THÁNG của hôm nay (chủ dự án chốt 11/09/2026).
   *  Năm hiện tại chưa có số thì mới lùi về năm mới nhất có số — không thì
   *  màn hình mở ra trống trơn mà không có cách nào bấm sang năm có số. */
  function datMacDinh() {
    const homNay = new Date();
    const namNay = homNay.getFullYear();
    const cacNam = duLieu.cac_nam || [];
    trangThai.nam = cacNam.includes(namNay) ? namNay : (cacNam[0] || namNay);
    trangThai.thang = trangThai.nam === namNay ? homNay.getMonth() + 1 : 12;
  }

  async function tai(user) {
    if (dangTai) return;
    if (!dungKhungHtml()) return;      // màn hình chưa có ô — không phải trang này
    dangTai = true;
    const oVe = $("skVe"), oLoi = $("skLoi");
    oLoi.textContent = "";
    oVe.innerHTML = '<p class="dangTai">Đang tải biểu đồ…</p>';
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/bao-cao/suc-khoe", { headers: { Authorization: "Bearer " + token } });
      const than = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(than.loi || "HTTP " + r.status);
      duLieu = than;
      datMacDinh();
      veLai();
    } catch (e) {
      oVe.innerHTML = "";
      $("skDaiPhu").innerHTML = "";
      oLoi.textContent = "Không lấy được số liệu biểu đồ: " + e.message;
    } finally {
      dangTai = false;
    }
  }

  /* Tự chạy khi đăng nhập xong — Dashboard là thứ đầu tiên người dùng thấy,
   * không còn phải bấm vào thẻ nào để mở. Nghe thẳng Firebase Auth thay vì
   * chờ khối <script> inline gọi sang: khối đó là của phần đăng nhập, quy
   * ước là để yên (ROADMAP.md). */
  document.addEventListener("DOMContentLoaded", function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) tai(user);
      else duLieu = null;
    });
  });
})();
