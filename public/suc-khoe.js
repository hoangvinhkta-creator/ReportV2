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
  /* Lane riêng bên phải cho hai chấm "TB" (trung bình) — xem lý do ở
     `veBieuDo`. RONG_VE (vùng vẽ chuỗi thời gian) nhường bớt chỗ cho nó. */
  const RONG_TB = 30, KHOANG_TB = 18;
  const CAO_VE = CAO - LE_TREN - LE_DUOI;
  const RONG_VE = RONG - LE_TRAI - LE_PHAI - RONG_TB - KHOANG_TB;

  /* Bước chia "đẹp" cho trục dọc. Bước KHÔNG NGUYÊN bị bỏ (2,5 chỉ dùng được
     từ 25 trở lên): số đơn không có nửa đơn, và một bước 2,5 đ thì nhãn tiền
     chia nghìn xong cũng chỉ ra rác. */
  const BUOC_DEP = [1, 2, 2.5, 5];
  const MOC_IT_NHAT = 3, MOC_NHIEU_NHAT = 5;

  /** Đỉnh trục dọc + số mốc chia.
   *
   *  Trả cả `soBuoc` chứ không chỉ đỉnh, vì SỐ MỐC PHẢI CO GIÃN ĐƯỢC. Bản
   *  trước ép đúng 3 mốc nên bước chia bị làm tròn rất thô: doanh số ngày
   *  cao nhất ~2 tỉ thì bước 667 triệu bị đẩy lên 1 tỉ, đỉnh thành 3 tỉ —
   *  đường thật chỉ cao hai phần ba khung, nhìn mất cân đối (chủ dự án báo
   *  11/09/2026). Cho số mốc chạy 3..5 rồi lấy BƯỚC NHỎ NHẤT vừa đủ thì
   *  chính ca đó ra bước 500 triệu × 4 mốc = đỉnh đúng 2 tỉ, không dư một
   *  khoảng nào.
   *
   *  Duyệt bước từ nhỏ tới lớn nên luôn lấy được đỉnh sát nhất. */
  function dinhTruc(gtLonNhat) {
    if (!(gtLonNhat > 0)) return { dinh: MOC_IT_NHAT, soBuoc: MOC_IT_NHAT };
    const muDau = Math.max(0, Math.floor(Math.log10(gtLonNhat)) - 1);
    for (let mu = muDau; mu <= muDau + 3; mu++) {
      for (const m of BUOC_DEP) {
        const buoc = m * Math.pow(10, mu);
        if (!Number.isInteger(buoc)) continue;
        const soBuoc = Math.ceil(gtLonNhat / buoc);
        if (soBuoc >= MOC_IT_NHAT && soBuoc <= MOC_NHIEU_NHAT) return { dinh: buoc * soBuoc, soBuoc };
      }
    }
    /* Giá trị quá nhỏ để chia được 3 mốc số nguyên (1 hay 2 đơn cả kỳ). */
    return { dinh: Math.max(gtLonNhat, MOC_IT_NHAT), soBuoc: MOC_IT_NHAT };
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
    const gtLonNhat = Math.max(
      c.sanGiaTri || 0,
      ...c.diemNay.map((p) => c.layGiaTri(p)), ...c.diemTruoc.map((p) => c.layGiaTri(p)));
    const { dinh, soBuoc } = dinhTruc(gtLonNhat);
    const x = (vt) => LE_TRAI
      + (c.vtMax > c.vtMin ? ((vt - c.vtMin) / (c.vtMax - c.vtMin)) * RONG_VE : RONG_VE / 2);
    const y = (v) => LE_TREN + CAO_VE - (v / dinh) * CAO_VE;

    // Mốc lưới ngang, đều từ 0 tới đỉnh — số mốc do `dinhTruc` chọn.
    let luoi = "";
    for (let i = 0; i <= soBuoc; i++) {
      const gt = (dinh / soBuoc) * i, gy = y(gt);
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

    /* Chấm "TB" — trung bình CỦA CHUỖI ĐANG VẼ: mấy ngày ĐÃ CÓ của kỳ này,
       so với trung bình CẢ kỳ trước (đủ ngày) — chủ dự án chốt 11/09/2026,
       "trung bình doanh số hiện tại so với trung bình toàn kỳ của kỳ trước".
       So "tốc độ hiện tại" với "mức đã chốt của kỳ trước", không phải so
       hai con số cùng đầy đủ như nhau.

       Đặt ở một LANE RIÊNG bên phải, không gắn vào một vị trí trên trục
       thời gian: trung bình không phải số của một ngày cụ thể, gắn nó vào
       trục ngày sẽ làm người xem hiểu lầm đó là số của đúng ngày đó. */
    const trungBinh = (diem) => diem.length
      ? diem.reduce((tong, p) => tong + c.layGiaTri(p), 0) / diem.length
      : null;
    const tbNay = trungBinh(c.diemNay), tbTruoc = trungBinh(c.diemTruoc);
    const xTb = RONG - LE_PHAI - RONG_TB / 2;
    const xPhanCach = LE_TRAI + RONG_VE + KHOANG_TB / 2;

    let khoiTb = '<line x1="' + xPhanCach.toFixed(1) + '" x2="' + xPhanCach.toFixed(1)
      + '" y1="' + LE_TREN + '" y2="' + (LE_TREN + CAO_VE) + '" stroke="#e5e7eb" stroke-width="1"/>'
      + '<text x="' + xTb.toFixed(1) + '" y="' + (CAO - 8)
      + '" font-size="10" fill="#6b7280" text-anchor="middle">TB</text>';
    /* `layNhan` là HÀM, không phải chuỗi đã dựng sẵn — `tb` có thể là `null`
       (kỳ chưa có ngày nào), và `c.taDayDu(null)` sẽ ném lỗi (gọi
       toLocaleString trên null). Chỉ gọi nó SAU khi đã biết `tb` không
       null, không phải trước khi truyền vào `chamTb`. */
    const chamTb = (tb, mau, layNhan) => {
      if (tb === null) return "";
      const cy = y(tb);
      return '<circle cx="' + xTb.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="' + mau
        + '" stroke="#fff" stroke-width="2"><title>' + thoat(layNhan()) + "</title></circle>";
    };
    khoiTb += chamTb(tbTruoc, MAU_TRUOC,
      () => "Trung bình mỗi " + c.donViDiem + " · " + c.tenKyTruoc + ": " + c.taDayDu(tbTruoc));
    khoiTb += chamTb(tbNay, MAU_NAY,
      () => "Trung bình mỗi " + c.donViDiem + " · " + c.tenKyNay + ": " + c.taDayDu(tbNay));

    return '<svg viewBox="0 0 ' + RONG + " " + CAO + '" width="100%" role="img" aria-label="'
      + thoat(c.nhanKhung) + '">'
      + luoi + nhan
      + veChuoi(c.diemTruoc, c.layGiaTri, x, y, MAU_TRUOC, true, (p) => c.moTa(p, c.namTruoc))
      + veChuoi(c.diemNay, c.layGiaTri, x, y, MAU_NAY, false, (p) => c.moTa(p, c.namNay))
      + khoiTb
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
      ten: "Doanh số", donVi: "nghìn đồng",
      layGiaTri: (p) => p.doanh_so,
      nhanDoc: lamGon,
      /* Trung bình (tổng chia số ngày) hầu như luôn ra số lẻ — làm tròn về
         đồng trước khi viết ra: VND không có đơn vị nhỏ hơn đồng, một
         chấm "TB" ghi "…800,889 đ" chỉ gây khó đọc, không thêm thông tin. */
      taDayDu: (v) => tienDay(Math.round(v)),
      /* Nhãn trục chia 1.000 rồi làm tròn, nên một kỳ mà doanh số cả kỳ
         dưới 3.000 đ sẽ ra các mốc cùng là "0". Nghe vô lý nhưng có thật:
         đơn bị chiết khấu hết thành 0 đ đã xuất hiện trong sổ 09/2026. Sàn
         này giữ trục luôn đọc được 0|1|2|3. */
      sanGiaTri: 3000,
    },
    {
      ten: "Số đơn", donVi: "đơn",
      layGiaTri: (p) => p.so_don,
      nhanDoc: (v) => Math.round(v).toLocaleString("vi-VN"),
      /* Trung bình số đơn có phần lẻ có nghĩa thật ("trung bình 4,3
         đơn/ngày") — không làm tròn như số đơn của MỘT ngày, đó luôn là số
         nguyên. */
      taDayDu: (v) => v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " đơn",
    },
  ];

  /* ─────────── Lưới nhỏ (small multiples) — xu hướng theo Line ─────────── */

  const RONG_MINI = 148, CAO_MINI = 56;
  const LE_MINI_TRAI = 4, LE_MINI_PHAI = 4, LE_MINI_TREN = 16, LE_MINI_DUOI = 4;
  const RONG_VE_MINI = RONG_MINI - LE_MINI_TRAI - LE_MINI_PHAI;
  const CAO_VE_MINI = CAO_MINI - LE_MINI_TREN - LE_MINI_DUOI;

  /** MỘT ô của lưới — đường xu hướng theo 12 tháng của một line, trục dọc
   *  RIÊNG theo giá trị lớn nhất của CHÍNH line đó (không theo line khác):
   *  hình dạng luôn đọc được dù line to hay nhỏ — "ai to ai nhỏ" đã có
   *  vòng cơ cấu ở trên trả lời, ô này chỉ làm một việc là hình dạng.
   *
   *  Tháng nào line đó không có dòng nào (nhân viên nghỉ, chưa có kênh) là
   *  một KHOẢNG TRỐNG THẬT, không phải số 0 — ngắt đoạn giống mọi biểu đồ
   *  khác trong file này, để một line đã dừng bán không vẽ liền thành một
   *  đường phẳng ở đáy như thể vẫn đang bán với giá 0. */
  function veMiniDuong(ten, diem, bd, nam) {
    if (!diem.length) {
      return '<div class="oMini oMiniRong"><p class="tenMini">' + thoat(ten) + "</p>"
        + '<p class="miniRong">Chưa có số năm ' + nam + "</p></div>";
    }
    const yMax = Math.max(1, ...diem.map(bd.layGiaTri));
    const x = (vt) => LE_MINI_TRAI + ((vt - 1) / 11) * RONG_VE_MINI;   // luôn 1..12, cố định
    const y = (v) => LE_MINI_TREN + CAO_VE_MINI - (v / yMax) * CAO_VE_MINI;

    let d = "", cham = "", vtTruoc = null;
    for (const p of diem) {
      const px = x(p.vt), py = y(bd.layGiaTri(p));
      d += (vtTruoc === null || p.vt - vtTruoc > 1 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1) + " ";
      vtTruoc = p.vt;
      cham += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="2" fill="' + MAU_NAY + '">'
        + "<title>" + thoat(ten + " · Tháng " + p.vt + "/" + nam + ": " + bd.taDayDu(bd.layGiaTri(p))) + "</title></circle>";
    }

    /* Nhãn giá trị tháng CUỐI CÙNG có số — "Lines -> value at the end"
       (dataviz skill), chọn lọc một nhãn chứ không ghi số lên từng tháng.
       Neo chữ theo NỬA nào của khung mà điểm cuối rơi vào, không thì
       tháng 11-12 sẽ đẩy nhãn tràn ra ngoài viewBox. */
    const cuoi = diem[diem.length - 1];
    const pxCuoi = x(cuoi.vt), pyCuoi = y(bd.layGiaTri(cuoi));
    const neoPhai = pxCuoi > LE_MINI_TRAI + RONG_VE_MINI / 2;
    const nhanCuoi = '<text x="' + (pxCuoi + (neoPhai ? -3 : 3)).toFixed(1) + '" y="' + (pyCuoi - 5).toFixed(1)
      + '" font-size="9" font-weight="600" fill="#1f2430" text-anchor="' + (neoPhai ? "end" : "start") + '">'
      + bd.nhanDoc(bd.layGiaTri(cuoi)) + "</text>";

    const nenDuoi = LE_MINI_TREN + CAO_VE_MINI;
    const svg = '<svg viewBox="0 0 ' + RONG_MINI + " " + CAO_MINI + '" width="100%" role="img" aria-label="Xu hướng '
      + thoat(ten) + '">'
      + '<line x1="' + LE_MINI_TRAI + '" x2="' + (RONG_MINI - LE_MINI_PHAI) + '" y1="' + nenDuoi + '" y2="' + nenDuoi
      + '" stroke="#e5e7eb" stroke-width="1"/>'
      + '<path d="' + d.trim() + '" fill="none" stroke="' + MAU_NAY + '" stroke-width="1.75"/>'
      + cham + nhanCuoi + "</svg>";

    return '<div class="oMini"><p class="tenMini">' + thoat(ten) + "</p>" + svg + "</div>";
  }

  /* ─────────── Cơ cấu theo Line — hai vòng khuyên lồng nhau ─────────── */

  /* Tám hue categorical đã qua kiểm CVD (kỹ năng dataviz, palette chuẩn) —
   * thứ tự SLOT CỐ ĐỊNH theo đúng vị trí khai trong `thu_tu`, KHÔNG theo
   * doanh số hiện tại: đổi rank tháng này qua tháng khác không được đổi
   * màu một line, không thì màu hết còn nghĩa để nhận ra "đây luôn là Tín
   * Phát". Bảng line có tới 10 line (kể cả "Khác") mà categorical chỉ an
   * toàn tới 8 — đúng luật "quá ~8 lớp thì gộp phần đuôi": line thứ 9 trở
   * đi (kể cả "Khác") dùng chung một màu xám trung tính.
   */
  const MAU_COCAU = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const MAU_COCAU_KHAC = "#b6b4ab";

  function mauCuaLine(ten, thuTu) {
    const idx = thuTu.indexOf(ten);
    return (idx >= 0 && idx < MAU_COCAU.length) ? MAU_COCAU[idx] : MAU_COCAU_KHAC;
  }

  /** Chữ trắng hay chữ đậm trên một nền màu — theo độ sáng tương đối, để
   *  nhãn % ghi ngay trên lát màu nào cũng đọc được. */
  function mauChuTrenNen(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const doSang = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return doSang > 0.6 ? "#0b0b0b" : "#ffffff";
  }

  const RONG_CC = 260, CAO_CC = 260, CX_CC = 130, CY_CC = 130;
  const R_NGOAI = 118, DAY_VONG = 32, KHE_VONG = 5;
  const R_TRONG_NGOAI = R_NGOAI - DAY_VONG;          // bán kính TRONG của vòng ngoài (kỳ này)
  const R_TRONG = R_TRONG_NGOAI - KHE_VONG;          // bán kính NGOÀI của vòng trong (kỳ trước)
  const R_TRONG_TRONG = R_TRONG - DAY_VONG;
  const KHE_GOC_PX = 2;   // khoảng trống giữa hai lát, tính bằng px cạnh nhau ở bán kính ngoài vòng đó

  /** Điểm trên vòng tròn tại bán kính `r`, góc `gocDo` ĐO THEO CHIỀU KIM
   *  ĐỒNG HỒ TỪ 12 GIỜ — đúng cách chủ dự án tả bố cục (11/09/2026). */
  function toaDoTron(r, gocDo) {
    const rad = (gocDo * Math.PI) / 180;
    return [CX_CC + r * Math.sin(rad), CY_CC - r * Math.cos(rad)];
  }

  /** Đường viền một lát hình khuyên, từ góc a0 tới a1 (độ). */
  function duongLatTron(rTrong, rNgoai, a0, a1) {
    const lonHon = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = toaDoTron(rNgoai, a0), [x1, y1] = toaDoTron(rNgoai, a1);
    const [x2, y2] = toaDoTron(rTrong, a1), [x3, y3] = toaDoTron(rTrong, a0);
    return "M" + x0.toFixed(2) + "," + y0.toFixed(2)
      + " A" + rNgoai.toFixed(2) + "," + rNgoai.toFixed(2) + " 0 " + lonHon + " 1 " + x1.toFixed(2) + "," + y1.toFixed(2)
      + " L" + x2.toFixed(2) + "," + y2.toFixed(2)
      + " A" + rTrong.toFixed(2) + "," + rTrong.toFixed(2) + " 0 " + lonHon + " 0 " + x3.toFixed(2) + "," + y3.toFixed(2)
      + " Z";
  }

  /** MỘT vòng khuyên (một kỳ) — xếp các line theo chiều kim đồng hồ, GIẢM
   *  DẦN từ 12 giờ (chủ dự án chốt 11/09/2026), line cuối bảng ("Khác")
   *  luôn ở cuối dù doanh số bao nhiêu — cùng luật "Line khác xếp cuối"
   *  đã áp cho bảng xếp hạng cũ. Line = 0đ ở kỳ này không vẽ lát nào (một
   *  lát 0 độ không có gì để nhìn), nhưng vẫn có mặt trong chú giải.
   *
   *  `layGiaTri(h)` đọc doanh_so của MỘT kỳ trên một dòng `hang`; dùng
   *  chung hàm này cho cả vòng ngoài (nay) và vòng trong (truoc), chỉ đổi
   *  cái đọc số — hai vòng không phải hai đường tính khác nhau. */
  function veMotVongTron(hang, layGiaTri, layMoTa, rTrong, rNgoai, thuTu, tenCuoi) {
    const cacDong = hang.filter((h) => layGiaTri(h) > 0);
    if (!cacDong.length) {
      // Không có số kỳ này — vẽ viền rỗng để biết "có vòng nhưng trống",
      // không phải một khoảng trắng vô nghĩa không rõ là thiếu hay hỏng.
      return '<circle cx="' + CX_CC + '" cy="' + CY_CC + '" r="' + ((rTrong + rNgoai) / 2).toFixed(1)
        + '" fill="none" stroke="#e5e7eb" stroke-width="' + (rNgoai - rTrong).toFixed(1) + '"/>';
    }
    cacDong.sort((a, b) => {
      if (a.ten === tenCuoi) return 1;
      if (b.ten === tenCuoi) return -1;
      return layGiaTri(b) - layGiaTri(a);
    });
    const tong = cacDong.reduce((t, h) => t + layGiaTri(h), 0);
    const kheDo = (KHE_GOC_PX / (2 * Math.PI * rNgoai)) * 360;

    let goc = 0, than = "";
    for (const h of cacDong) {
      const rong = (layGiaTri(h) / tong) * 360;
      const a0 = goc + kheDo / 2, a1 = goc + rong - kheDo / 2;
      if (a1 > a0) {
        const mau = mauCuaLine(h.ten, thuTu);
        const phanTram = Math.round((layGiaTri(h) / tong) * 100);
        than += '<path d="' + duongLatTron(rTrong, rNgoai, a0, a1) + '" fill="' + mau + '">'
          + "<title>" + thoat(layMoTa(h) + " · " + phanTram + "%") + "</title></path>";
        /* Nhãn % trực tiếp — CHỌN LỌC: chỉ lát đủ lớn (>=10%) mới ghi số
           ngay trên đó, lát nhỏ nhường chỗ cho chú giải + rê chuột (không
           ghi số lên từng lát — dataviz skill). */
        if (rong >= 36) {
          const [xg, yg] = toaDoTron((rTrong + rNgoai) / 2, goc + rong / 2);
          than += '<text x="' + xg.toFixed(1) + '" y="' + (yg + 4).toFixed(1)
            + '" font-size="11" font-weight="600" text-anchor="middle" fill="' + mauChuTrenNen(mau) + '">'
            + phanTram + "%</text>";
        }
      }
      goc += rong;
    }
    return than;
  }

  /** Hai vòng khuyên lồng nhau: kỳ này (ngoài, to) — kỳ trước (trong, nhỏ)
   *  — chủ dự án chốt 11/09/2026, thay cho bảng xếp hạng cột ngang cũ.
   *  Cùng MỘT bảng màu cho cả hai vòng (màu theo line, không theo kỳ) để
   *  so được cơ cấu kỳ này lệch cơ cấu kỳ trước ở đúng line nào. */
  function veCoCau(hang, thuTu) {
    const tenCuoi = thuTu[thuTu.length - 1];

    const vongTrong = veMotVongTron(hang, (h) => h.truoc.doanh_so, (h) => h.moTaTruoc,
      R_TRONG_TRONG, R_TRONG, thuTu, tenCuoi);
    const vongNgoai = veMotVongTron(hang, (h) => h.nay.doanh_so, (h) => h.moTaNay,
      R_TRONG_NGOAI, R_NGOAI, thuTu, tenCuoi);

    const svg = '<svg viewBox="0 0 ' + RONG_CC + " " + CAO_CC + '" width="240" height="240" role="img"'
      + ' aria-label="Cơ cấu doanh số theo line — vòng ngoài kỳ này, vòng trong kỳ trước">'
      + vongTrong + vongNgoai + "</svg>";

    /* Chú giải — CÙNG thứ tự với vòng ngoài (giảm dần, "Khác" cuối), để đọc
       từ trên xuống khớp với đọc vòng tròn theo chiều kim đồng hồ. Liệt kê
       CẢ line chưa có số kỳ này (0%) — biến mất khỏi chú giải thì người
       xem tưởng công ty không còn kênh đó, đúng lỗi "Shopee" đã sửa ở bảng
       xếp hạng cũ. */
    const tongNay = hang.reduce((t, h) => t + h.nay.doanh_so, 0);
    const tongTruoc = hang.reduce((t, h) => t + h.truoc.doanh_so, 0);
    const daXep = [...hang].sort((a, b) => {
      if (a.ten === tenCuoi) return 1;
      if (b.ten === tenCuoi) return -1;
      return b.nay.doanh_so - a.nay.doanh_so;
    });
    let chuGiai = '<div class="chuGiaiCoCau">';
    for (const h of daXep) {
      const ptNay = tongNay > 0 ? Math.round((h.nay.doanh_so / tongNay) * 100) : 0;
      const ptTruoc = tongTruoc > 0 ? Math.round((h.truoc.doanh_so / tongTruoc) * 100) : 0;
      chuGiai += '<span><i style="background:' + mauCuaLine(h.ten, thuTu) + '"></i>'
        + thoat(h.ten) + '<b>' + ptNay + '%</b><span class="ptTruocCc">(' + ptTruoc + '%)</span></span>';
    }
    chuGiai += "</div>";

    return '<div class="khoiCoCau">' + svg + chuGiai + "</div>";
  }

  /* ─────────── Điều phối ─────────── */

  const trangThai = { donVi: "ngay", nam: null, thang: null, luoiChiSo: 0 };
  let duLieu = null;     // kết quả /api/bao-cao/suc-khoe, nhớ lại để đổi tab không gọi lại
  let dangTai = false;

  const TEN_DON_VI = { ngay: "Ngày", thang: "Tháng", quy: "Quý" };

  /** Ngăn dữ liệu của một (đơn vị, năm). `duoi` là đuôi tiêu đề dùng chung
   *  cho cả hai biểu đồ ("theo ngày · tháng 9/2026"). `tenKyCua(n)` là HÀM
   *  (không phải chuỗi cố định) vì chấm "TB" cần gọi nó cho CẢ nam lẫn
   *  namTruoc, không chỉ năm đang xem. */
  function dungKhung(nam) {
    const dv = trangThai.donVi;
    if (dv === "thang") {
      return {
        lay: (n) => layDiem((duLieu.theo_thang || {})[n]),
        vtMin: 1, vtMax: 12,
        nhanTruc: (vt) => "T" + vt,
        moTa: (p, n) => "Tháng " + p.vt + "/" + n + " · " + tienDay(p.doanh_so) + " · " + soDon(p.so_don) + " đơn",
        duoi: "theo tháng · năm " + nam,
        tenKyCua: (n) => "Năm " + n,
        donViDiem: "tháng",
      };
    }
    if (dv === "quy") {
      return {
        lay: (n) => layDiem((duLieu.theo_quy || {})[n]),
        vtMin: 1, vtMax: 4,
        nhanTruc: (vt) => "Q" + vt,
        moTa: (p, n) => "Quý " + p.vt + "/" + n + " · " + tienDay(p.doanh_so) + " · " + soDon(p.so_don) + " đơn",
        duoi: "theo quý · năm " + nam,
        tenKyCua: (n) => "Năm " + n,
        donViDiem: "quý",
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
      tenKyCua: (n) => "Tháng " + th + "/" + n,
      donViDiem: "ngày",
    };
  }

  function veBieuDoHienTai() {
    const oVe = $("skVe");
    if (!oVe) return;
    const nam = trangThai.nam, namTruoc = nam - 1;
    const k = dungKhung(nam);
    const diemNay = k.lay(nam), diemTruoc = k.lay(namTruoc);

    if (!diemNay.length && !diemTruoc.length) {
      oVe.innerHTML = '<p class="dangTai">' + thoat(k.tenKyCua(nam)) + " — chưa có số nào cho kỳ này.</p>";
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
          layGiaTri: bd.layGiaTri, nhanDoc: bd.nhanDoc, sanGiaTri: bd.sanGiaTri,
          taDayDu: bd.taDayDu, donViDiem: k.donViDiem,
          tenKyNay: k.tenKyCua(nam), tenKyTruoc: k.tenKyCua(namTruoc),
          nhanKhung,
        }) + "</div>";
    }
    oVe.innerHTML = html + chuGiai("Năm " + nam, "Năm " + namTruoc, diemTruoc.length > 0);
  }

  /** Cơ cấu theo Line cho ĐÚNG kỳ mà hai biểu đồ trên đang vẽ.
   *
   *  Tab Ngày đang xem tháng nào thì cơ cấu tháng đó; tab Tháng và tab Quý
   *  đang xem cả năm thì cơ cấu cả năm. Cùng một kỳ với biểu đồ ngay trên
   *  nó — nếu lệch kỳ thì người đọc so hai khối với nhau là ra kết luận sai.
   *
   *  Không vẽ gì nếu `line` chưa có trong dữ liệu: giữa hai lượt deploy
   *  (bẫy số 4) bản Gateway cũ còn đang chạy và chưa trả khối này. Thà thiếu
   *  một khối còn hơn cả Dashboard nổ. */
  function veKhoiCoCau() {
    const o = $("skCoCau");
    if (!o) return;
    if (!duLieu || !duLieu.line) { o.innerHTML = ""; return; }

    const L = duLieu.line;
    const nam = trangThai.nam, namTruoc = nam - 1;
    const theoNgay = trangThai.donVi === "ngay";
    const th = trangThai.thang;

    const layO = (ten, n) => {
      const c = theoNgay
        ? (((L.theo_thang || {})[ten] || {})[n] || {})[th]
        : ((L.theo_nam || {})[ten] || {})[n];
      return c ? { doanh_so: c.doanh_so, so_don: c.so_don } : { doanh_so: 0, so_don: 0 };
    };
    const tenKy = (n) => (theoNgay ? "tháng " + th + "/" + n : "năm " + n);

    const hang = (L.thu_tu || []).map((ten) => {
      const nay = layO(ten, nam), truoc = layO(ten, namTruoc);
      return {
        ten, nay, truoc,
        moTaNay: ten + " · " + tenKy(nam) + " · " + tienDay(nay.doanh_so) + " · " + soDon(nay.so_don) + " đơn",
        moTaTruoc: ten + " · " + tenKy(namTruoc) + " · " + tienDay(truoc.doanh_so) + " · " + soDon(truoc.so_don) + " đơn",
      };
    });
    if (!hang.length) { o.innerHTML = ""; return; }

    /* Sắp xếp (giảm dần theo doanh số, "Khác" luôn cuối) nằm TRONG
       `veCoCau()` — vòng ngoài và vòng trong có thể ra hai thứ tự khác
       nhau (kỳ này bán khác kỳ trước), nên mỗi vòng phải tự sắp lấy theo
       đúng số của chính nó. */
    o.innerHTML = '<p class="tieuDeSk">Cơ cấu theo Line · ' + thoat(tenKy(nam))
      + " so với " + thoat(tenKy(namTruoc)) + "</p>"
      + veCoCau(hang, L.thu_tu);
  }

  /** Lưới nhỏ — xu hướng theo THÁNG của TỪNG line trong năm đang xem, cạnh
   *  nhau để so hình dạng: line nào đang lên, đang xuống, đứt gãy đột ngột
   *  (nhân viên nghỉ), hay chỉ mới xuất hiện. Vòng cơ cấu ở trên đã trả lời
   *  "ai to ai nhỏ Ở MỘT KỲ" — lưới này trả lời "line đó đang đi về đâu",
   *  việc vòng cơ cấu không nói được.
   *
   *  Luôn dùng NĂM ĐANG XEM (`trangThai.nam`), KHÔNG theo tab đơn vị: xu
   *  hướng cả năm là một khái niệm riêng, không ăn theo "đang xem theo
   *  ngày/tháng/quý" của hai biểu đồ phía trên.
   *
   *  Có nút chuyển Doanh số/Số đơn — CẢ LƯỚI đổi theo, không phải mỗi ô tự
   *  chọn: 10 line × 2 chỉ số cùng lúc là 20 ô, không ai đọc hết được. */
  function veKhoiLuoiNho() {
    const o = $("skLuoiNho");
    if (!o) return;
    if (!duLieu || !duLieu.line) { o.innerHTML = ""; return; }

    const L = duLieu.line;
    const nam = trangThai.nam;
    const bd = BIEU_DO[trangThai.luoiChiSo] || BIEU_DO[0];
    const thuTu = L.thu_tu || [];
    if (!thuTu.length) { o.innerHTML = ""; return; }
    const tenCuoi = thuTu[thuTu.length - 1];

    const dsLine = thuTu.map((ten) => ({
      ten, diem: layDiem(((L.theo_thang || {})[ten] || {})[nam]),
    }));

    /* Sắp GIẢM DẦN theo tổng cả năm của CHÍNH chỉ số đang xem, "Khác" luôn
       cuối — cùng luật đã áp cho vòng cơ cấu, để đổi chỉ số không làm lưới
       xáo trộn lộn xộn ngoài dự đoán. */
    dsLine.sort((a, b) => {
      if (a.ten === tenCuoi) return 1;
      if (b.ten === tenCuoi) return -1;
      const tong = (arr) => arr.reduce((t, p) => t + bd.layGiaTri(p), 0);
      return tong(b.diem) - tong(a.diem);
    });

    o.innerHTML = '<p class="tieuDeSk">Xu hướng theo Line · năm ' + nam
      + ' <span class="donViCua">(' + thoat(bd.donVi) + ")</span></p>"
      + '<div class="tabDonVi" id="skLuoiChiSo"></div>'
      + '<div class="luoiXuHuong" id="skLuoiGrid"></div>';

    const oChiSo = $("skLuoiChiSo");
    oChiSo.innerHTML = "";   // đề phòng trình duyệt không coi id trong innerHTML mới là một phần tử khác hẳn
    BIEU_DO.forEach((m, i) => {
      const nut = document.createElement("button");
      nut.type = "button";
      nut.className = "tabNut" + (i === trangThai.luoiChiSo ? " tabDang" : "");
      nut.textContent = m.ten;
      nut.addEventListener("click", () => { trangThai.luoiChiSo = i; veKhoiLuoiNho(); });
      oChiSo.appendChild(nut);
    });

    const oGrid = $("skLuoiGrid");
    oGrid.innerHTML = dsLine.map(({ ten, diem }) => veMiniDuong(ten, diem, bd, nam)).join("");
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
    veKhoiCoCau();
    veKhoiLuoiNho();
  }

  /** Khung cố định của Dashboard, dựng một lần vào ô P3 chừa sẵn.
   *
   *  Dải nút phụ nằm NGAY DƯỚI hai biểu đồ, xếp hạng nằm dưới cùng: dải nút
   *  đổi kỳ cho cả khối, để nó sát biểu đồ thì bấm xong thấy ngay cái vừa
   *  đổi, không phải cuộn qua bảng xếp hạng mới tới chỗ bấm. */
  function dungKhungHtml() {
    const o = $("o-dashboard");
    if (!o) return false;
    o.innerHTML = '<div class="tabDonVi" id="skTabDonVi"></div>'
      + '<div id="skVe"></div>'
      + '<div class="tabDonVi daiPhu" id="skDaiPhu"></div>'
      + '<div id="skCoCau" class="khoiCoCauBoc"></div>'
      + '<div id="skLuoiNho" class="khoiLuoiNhoBoc"></div>'
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
      $("skCoCau").innerHTML = "";
      $("skLuoiNho").innerHTML = "";
      oLoi.textContent = "Không lấy được số liệu biểu đồ: " + e.message;
    } finally {
      dangTai = false;
    }
  }

  /* Vẽ LẦN ĐẦU khi người dùng mở tab [Biểu đồ], không phải lúc đăng nhập.
   *
   * Trước đây khối này gọi thẳng `tai(user)` trong `onAuthStateChanged`, vì
   * hồi đó Dashboard LÀ thứ đầu tiên người dùng thấy. Từ lúc bố cục đổi
   * (11/09/2026) biểu đồ nằm sau tab [Biểu đồ] và ẩn sẵn, nên lượt gọi
   * `/api/bao-cao/suc-khoe` ngay lúc đăng nhập là một lượt đọc `bc/ky` của
   * cả hai năm mà phần lớn lần đăng nhập không ai xem tới.
   *
   * `don-hang.js` (chủ của khung tab) gọi `window.SucKhoe.moTab()` mỗi lần
   * mở tab. Cửa vào duy nhất là hàm đó — file này không tự đoán trạng thái
   * tab bằng cách soi `hidden` của một id ở ngoài, để hai nhánh không buộc
   * chặt vào nhau qua tên phần tử.
   */
  let daMoTab = false;       // tab [Biểu đồ] đã từng được mở trong phiên này chưa
  let nguoiDung = null;

  /* Chỉ tải khi ĐỦ ba điều: tab đã mở, đã có người đăng nhập, và chưa có số.
     `duLieu` vừa là bộ nhớ đệm vừa là cái chặn — `onAuthStateChanged` còn
     nổ lại mỗi lần token tự làm mới, không có nó là mỗi giờ thêm một lượt
     gọi thừa. */
  function taiNeuCan() {
    if (daMoTab && nguoiDung && !duLieu) tai(nguoiDung);
  }

  window.SucKhoe = {
    moTab: function () { daMoTab = true; taiNeuCan(); },
  };

  document.addEventListener("DOMContentLoaded", function () {
    firebase.auth().onAuthStateChanged(function (user) {
      nguoiDung = user || null;
      /* Đăng xuất thì quên sạch: người sau đăng nhập vào cùng trình duyệt
         không được thấy số của người trước. */
      if (!user) { duLieu = null; daMoTab = false; return; }
      taiNeuCan();
    });
  });
})();
