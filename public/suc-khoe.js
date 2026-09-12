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

  /** Tiền viết GỌN cho nhãn trục và nhãn cuối ô nhỏ: `2.000.000` → `2B`.
   *
   *  Chủ dự án chốt 12/09/2026, và lý do là DIỆN TÍCH: một nhãn "2.000.000"
   *  chiếm 64px bề ngang, tức lề trái của biểu đồ phải chừa chừng ấy cho mỗi
   *  mốc trục — đổi sang "2B" lấy lại gần nửa chỗ đó cho chính hình vẽ.
   *
   *  Nhận số ĐỒNG (như mọi chỗ khác trong file), trả B = tỷ, M = triệu,
   *  K = nghìn. Một chữ số thập phân là đủ để hai mốc liền nhau không trùng
   *  nhãn, mà không dài thêm mấy. Số ĐẦY ĐỦ vẫn còn nguyên ở `<title>` rê
   *  chuột — chỗ này chỉ gọn cách VIẾT, không bớt thông tin nào. */
  function gonTien(v) {
    const n = Number(v) || 0;
    const am = n < 0 ? "-" : "";
    const a = Math.abs(n);
    const viet = (x, hau) => am + (Math.round(x * 10) / 10).toLocaleString("vi-VN") + hau;
    if (a >= 1e9) return viet(a / 1e9, "B");
    if (a >= 1e6) return viet(a / 1e6, "M");
    if (a >= 1e3) return viet(a / 1e3, "K");
    return am + Math.round(a).toLocaleString("vi-VN");
  }
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

  /* Kỳ đang xem = xanh nhấn của cả trang. Kỳ trước = CÙNG họ xanh, nhạt hơn
   * — chủ dự án chốt 12/09/2026: liền nét, khác màu, mờ hơn, và "đồng bộ với
   * trang chủ thay vì màu cam như ảnh [mẫu]".
   *
   * Cặp này đã chạy qua bộ đo của kỹ năng dataviz (`validate_palette.js`,
   * chế độ light): đạt dải sáng, đạt sàn độ bão hoà, ΔE 19,9 ở mắt thường và
   * 13,7 ở ca tritan — trên ngưỡng an toàn. Nó chỉ cảnh báo tương phản nền
   * dưới 3:1 cho màu nhạt, và cảnh báo ấy được giải bằng CHÚ GIẢI luôn có
   * mặt cộng nhãn trực tiếp, đúng lối "relief required" mà bộ đo chấp nhận.
   * ĐỔI MÀU Ở ĐÂY THÌ ĐO LẠI — đừng chọn bằng mắt. */
  const MAU_NAY = "#2563eb";
  const MAU_TRUOC = "#7da2e3";

  /* `RONG` là bề rộng của HỆ TOẠ ĐỘ, không phải bề rộng trên màn: SVG khai
     `width: 100%` nên nó co giãn theo cột. `CAO_MAC_DINH` chỉ là bản lùi khi
     chưa đo được màn hình (trước lượt bố cục đầu tiên, hay trong bộ kiểm
     chạy trên DOM giả) — bình thường chiều cao được TÍNH theo chỗ còn lại
     của màn hình, xem `canhCaoKhoi()`. */
  const RONG = 640, CAO_MAC_DINH = 200;
  /* `LE_TRAI` 64 → 40: nhãn trục nay viết gọn ("2B" thay "2.000.000") nên
     không cần chừa chỗ cho một chuỗi bảy ký tự nữa. 24 đơn vị lấy lại đi
     thẳng vào bề ngang hình vẽ. */
  const LE_TRAI = 40, LE_PHAI = 14, LE_TREN = 12, LE_DUOI = 26;
  /* Lane riêng bên phải cho hai chấm "TB" (trung bình) — xem lý do ở
     `veBieuDo`. RONG_VE (vùng vẽ chuỗi thời gian) nhường bớt chỗ cho nó. */
  const RONG_TB = 30, KHOANG_TB = 18;
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
  /** Một ĐOẠN LIỀN (không có lỗ hổng) → đường cong trơn, dạng `C` của SVG.
   *
   *  Chủ dự án chốt 12/09/2026 (kèm một ảnh mẫu): đường phải "có độ cong nhất
   *  định".
   *
   *  ── VÌ SAO LÀ NỘI SUY ĐƠN ĐIỆU, KHÔNG PHẢI CATMULL-ROM ──
   *
   *  Bản đầu dùng Catmull-Rom (tay nắm suy từ hai điểm kề). Nó trơn, nó đi
   *  qua đúng mọi điểm — nhưng GIỮA hai điểm nó VỌT LỐ: đo trên chuỗi thử
   *  [100, 60, 80, 20, 50], đáy thật là 20 mà tay nắm kéo đường xuống tới
   *  15. Trên một biểu đồ tiền, đó là vẽ ra một con số KHÔNG CÓ TRONG SỔ —
   *  người đọc thấy một ngày thấp hơn ngày thấp nhất, hay một đỉnh cao hơn
   *  đỉnh thật, mà không có cách nào biết nó là do phép vẽ.
   *
   *  Fritsch–Carlson (nội suy Hermite ĐƠN ĐIỆU) sửa đúng chỗ ấy: nó kẹp độ
   *  dốc tại mỗi điểm sao cho đoạn cong không bao giờ ra ngoài khoảng giá
   *  trị của hai điểm đầu mút. Đường vẫn cong, chỉ là không bịa thêm.
   *
   *  Một đoạn chỉ có hai điểm thì không có gì để cong: nối thẳng. */
  function duongCong(dsX, dsY) {
    const n = dsX.length;
    if (n === 1) return "M" + dsX[0].toFixed(1) + "," + dsY[0].toFixed(1);

    /* Độ dốc của từng đoạn thẳng nối hai điểm liền nhau. */
    const dd = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = dsX[i + 1] - dsX[i];
      dd.push(dx === 0 ? 0 : (dsY[i + 1] - dsY[i]) / dx);
    }

    /* Độ dốc TẠI mỗi điểm: trung bình hai đoạn kề (hai đầu mút lấy luôn đoạn
       duy nhất cạnh nó).
       NGOẠI TRỪ điểm CỰC TRỊ — chỗ hai đoạn kề đổi chiều (một lên một xuống,
       hay một trong hai phẳng). Ở đó độ dốc phải bằng 0. Bỏ luật này là bỏ
       sót đúng cái ca đắt nhất: trên chuỗi thử [100,60,80,20,50], đáy thật
       là 20 nhưng đường vẫn võng xuống 15 vì nó còn "đà" đi xuống khi chạm
       đáy. Phép kẹp bên dưới KHÔNG cứu được ca ấy — nó chỉ co tay nắm khi
       hai đoạn CÙNG chiều. */
    const m = [dd[0]];
    for (let i = 1; i < n - 1; i++) {
      m.push(dd[i - 1] * dd[i] <= 0 ? 0 : (dd[i - 1] + dd[i]) / 2);
    }
    m.push(dd[n - 2]);

    /* Phép kẹp của Fritsch–Carlson. Hai luật, và cả hai đều là "đừng bịa":
       · đoạn phẳng (hai điểm bằng nhau) thì hai đầu phải phẳng theo, nếu
         không đường sẽ nhấp nhô giữa hai giá trị bằng nhau;
       · điểm nằm trong hình tròn bán kính 3 của (α, β) thì đường mới chắc
         chắn đơn điệu — ngoài đó thì co tay nắm lại đúng tỉ lệ. */
    for (let i = 0; i < n - 1; i++) {
      if (dd[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / dd[i], b = m[i + 1] / dd[i];
      const r = a * a + b * b;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * a * dd[i];
        m[i + 1] = t * b * dd[i];
      }
    }

    let d = "M" + dsX[0].toFixed(1) + "," + dsY[0].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const dx = (dsX[i + 1] - dsX[i]) / 3;
      d += " C" + (dsX[i] + dx).toFixed(1) + "," + (dsY[i] + m[i] * dx).toFixed(1)
        + " " + (dsX[i + 1] - dx).toFixed(1) + "," + (dsY[i + 1] - m[i + 1] * dx).toFixed(1)
        + " " + dsX[i + 1].toFixed(1) + "," + dsY[i + 1].toFixed(1);
    }
    return d;
  }

  /** Một chuỗi thời gian. `phu` = chuỗi so sánh (kỳ trước): CÙNG dạng đường
   *  liền, chỉ khác màu và mảnh hơn — chủ dự án chốt bỏ nét đứt 12/09/2026.
   *
   *  Bỏ nét đứt thì hai chuỗi chỉ còn phân biệt bằng MÀU, nên chú giải trở
   *  thành bắt buộc (nó đã luôn có mặt) và hai màu phải cách nhau đủ xa: cặp
   *  đang dùng đo được ΔE 19,9 ở mắt thường và 13,7 ở ca tritan — trên ngưỡng
   *  an toàn. Đừng đổi màu ở đây mà không đo lại. */
  function veChuoi(diem, layGiaTri, x, y, mau, phu, nhanDiem) {
    if (!diem.length) return "";
    /* Cắt thành các ĐOẠN LIỀN trước khi làm cong: một lỗ hổng (ngày không
       bán) phải ngắt đường, và phép cong chỉ được chạy trong lòng một đoạn —
       cong vắt qua lỗ hổng là bịa ra dữ liệu cho những ngày không có. */
    const doan = [];
    let cur = null, vtTruoc = null, cham = "";
    for (const p of diem) {
      const px = x(p.vt), py = y(layGiaTri(p));
      if (vtTruoc === null || p.vt - vtTruoc > 1) { cur = { x: [], y: [] }; doan.push(cur); }
      cur.x.push(px); cur.y.push(py);
      vtTruoc = p.vt;
      cham += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="'
        + (phu ? "1.8" : "2.2") + '" fill="' + mau + '">'
        + "<title>" + thoat(nhanDiem(p)) + "</title></circle>";
    }
    return '<path d="' + doan.map((g) => duongCong(g.x, g.y)).join(" ")
      + '" fill="none" stroke="' + mau + '" stroke-width="' + (phu ? "1.6" : "2")
      + '" stroke-linecap="round" stroke-linejoin="round"/>' + cham;
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
    /* Chiều cao hệ toạ độ do bên gọi đưa vào (đã tính từ chỗ còn lại của màn
       hình). Lề trên/dưới KHÔNG đổi theo — chúng chừa chỗ cho nhãn trục, thứ
       cao bao nhiêu là bấy nhiêu dù khung cao hay thấp; chỉ vùng vẽ giãn ra. */
    const CAO = c.cao || CAO_MAC_DINH;
    const CAO_VE = CAO - LE_TREN - LE_DUOI;
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

    /* `height: 100%` đi CÙNG viewBox đã tính đúng tỉ lệ của khung chứa: khi
       hai con số ấy khớp nhau thì hình lấp kín khung, không chừa dải trắng
       hai bên (`meet` của SVG luôn giữ tỉ lệ, nên viewBox lệch tỉ lệ là có
       dải trắng — thứ làm cột trái trông "hụt" so với cột phải). */
    return '<svg viewBox="0 0 ' + RONG + " " + CAO + '" width="100%" height="100%" role="img" aria-label="'
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
      + (coTruoc ? '<span><i style="background:' + MAU_TRUOC + '"></i>' + thoat(tenTruoc) + "</span>" : "")
      + "</div>";
  }

  /* HAI biểu đồ, KHÔNG gộp hai trục dọc vào một khung (chủ dự án chốt lúc
     duyệt mockup): tiền và số đơn khác đơn vị, chồng chung một khung là mời
     người đọc so hai đường không so được với nhau. */
  const BIEU_DO = [
    {
      ten: "Doanh số", donVi: "nghìn đồng",
      layGiaTri: (p) => p.doanh_so,
      nhanDoc: gonTien,
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

  /* Thấp hơn bản trước (56 → 44): mười ô xếp 3–4 cột là 3–4 HÀNG, nên mỗi
     ô cao thêm 12px là cả cụm cao thêm gần 50px — đúng phần làm cột phải
     vượt hẳn cột trái. Một đường xu hướng 32px vẫn đọc được hình dạng; đó
     là cả điểm của small multiples. */
  const RONG_MINI = 148, CAO_MINI = 44;
  const LE_MINI_TRAI = 4, LE_MINI_PHAI = 4, LE_MINI_TREN = 13, LE_MINI_DUOI = 4;
  const RONG_VE_MINI = RONG_MINI - LE_MINI_TRAI - LE_MINI_PHAI;

  /** MỘT ô của lưới — đường xu hướng theo 12 tháng của một line, trục dọc
   *  RIÊNG theo giá trị lớn nhất của CHÍNH line đó (không theo line khác):
   *  hình dạng luôn đọc được dù line to hay nhỏ — "ai to ai nhỏ" đã có
   *  vòng cơ cấu ở trên trả lời, ô này chỉ làm một việc là hình dạng.
   *
   *  Tháng nào line đó không có dòng nào (nhân viên nghỉ, chưa có kênh) là
   *  một KHOẢNG TRỐNG THẬT, không phải số 0 — ngắt đoạn giống mọi biểu đồ
   *  khác trong file này, để một line đã dừng bán không vẽ liền thành một
   *  đường phẳng ở đáy như thể vẫn đang bán với giá 0. */
  function veMiniDuong(ten, diem, bd, k) {
    if (!diem.length) {
      return '<div class="oMini oMiniRong"><p class="tenMini">' + thoat(ten) + "</p>"
        + '<p class="miniRong">Chưa có số ' + thoat(k.tenKyNgan) + "</p></div>";
    }
    /* Chiều cao hệ toạ độ của ô do `canhCaoKhoi()` tính theo chỗ thật. */
    const CAO_MINI = caoOMini;
    const CAO_VE_MINI = CAO_MINI - LE_MINI_TREN - LE_MINI_DUOI;
    const yMax = Math.max(1, ...diem.map(bd.layGiaTri));
    /* Trục ngang lấy `vtMax` của KHUNG chứ không cứng 12 (P6): cùng một ô
       này giờ vẽ cả 12 tháng của một năm lẫn 28–31 ngày của một tháng, và
       nó phải trải đúng bề rộng ấy — chia cho 11 khi đang vẽ 30 ngày là dồn
       cả tháng vào một phần ba khung. Mẫu số là `vtMax - 1` (khoảng cách
       giữa điểm đầu và điểm cuối), và chặn sàn 1 để một khung chỉ có đúng
       một vị trí không chia cho 0. */
    const nhip = Math.max(1, k.vtMax - 1);
    const x = (vt) => LE_MINI_TRAI + ((vt - 1) / nhip) * RONG_VE_MINI;
    const y = (v) => LE_MINI_TREN + CAO_VE_MINI - (v / yMax) * CAO_VE_MINI;

    const doan = [];
    let cur = null, cham = "", vtTruoc = null;
    for (const p of diem) {
      const px = x(p.vt), py = y(bd.layGiaTri(p));
      /* Cùng phép cắt đoạn + làm cong với biểu đồ lớn — hai khối nằm cạnh
         nhau trên cùng màn hình thì phải cùng một ngôn ngữ hình. */
      if (vtTruoc === null || p.vt - vtTruoc > 1) { cur = { x: [], y: [] }; doan.push(cur); }
      cur.x.push(px); cur.y.push(py);
      vtTruoc = p.vt;
      cham += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="'
        + (k.vtMax > 15 ? "1.4" : "2") + '" fill="' + MAU_NAY + '">'
        + "<title>" + thoat(ten + " · " + k.moTaNgan(p.vt) + ": " + bd.taDayDu(bd.layGiaTri(p)))
        + "</title></circle>";
    }

    /* Nhãn giá trị vị trí CUỐI CÙNG có số — "Lines -> value at the end"
       (dataviz skill), chọn lọc một nhãn chứ không ghi số lên từng điểm.
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
      + '<path d="' + doan.map((g) => duongCong(g.x, g.y)).join(" ")
      + '" fill="none" stroke="' + MAU_NAY + '" stroke-width="1.5" stroke-linecap="round"/>'
      + cham + nhanCuoi + "</svg>";

    return '<div class="oMini"><p class="tenMini">' + thoat(ten) + "</p>" + svg + "</div>";
  }

  /* CƠ CẤU THEO LINE (hai vòng khuyên lồng nhau) ĐÃ BỎ — chủ dự án chốt
   * 12/09/2026, cùng lượt dời biểu đồ sang màn báo cáo. Xoá hẳn chứ không
   * giữ lại sau một cờ: một khối 140 dòng không ai gọi sẽ mục đi trong im
   * lặng, và lượt sửa sau phải đọc nó để biết có được đụng vào không. Lịch
   * sử git giữ bản cũ nếu cần dựng lại.
   *
   * Bảng màu categorical theo line đi theo nó — nó chỉ sinh ra cho hai vòng
   * khuyên ấy; lưới nhỏ bên phải vẽ bằng một màu nhấn duy nhất. */

  /* ─────────── Điều phối ─────────── */

  /* `chiSo` DÙNG CHUNG cho biểu đồ lớn bên trái và lưới nhỏ bên phải — chủ
     dự án chốt 12/09/2026: "cụm này cũng thể hiện khung thời gian, kiểu biểu
     đồ đồng bộ với biểu đồ trên". Trước đây lưới có bộ chọn RIÊNG
     (`luoiChiSo`), nên hai khối cạnh nhau nói hai chỉ số khác nhau mà không
     có gì báo — chuyện chấp nhận được khi chúng ở hai chỗ xa nhau, không
     chấp nhận được khi chúng nằm sát cạnh nhau.

     `nam`/`thang` KHÔNG còn do file này chọn: chúng đến từ hàng nút năm/tháng
     của màn báo cáo, qua `window.SucKhoe.datKy()`. Một màn hình có HAI bộ
     chọn kỳ là chỗ chắc chắn có lúc chúng lệch nhau. */
  const trangThai = { donVi: "ngay", nam: null, thang: null, chiSo: 0 };
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
        tenKyNgan: "năm " + nam,
        moTaNgan: (vt) => "Tháng " + vt + "/" + nam,
        layLine: (L, ten) => layDiem(((L.theo_thang || {})[ten] || {})[nam]),
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
        tenKyNgan: "năm " + nam,
        moTaNgan: (vt) => "Quý " + vt + "/" + nam,
        /* Chủ dự án chốt "xu hướng line chỉ làm theo ngày + tháng" — nên ở
           đơn vị Quý cụm bên phải KHÔNG vẽ. `null` là tín hiệu ấy, và khối
           kia nói thẳng một câu thay vì lặng lẽ hiện lưới của một khung thời
           gian khác với biểu đồ bên trái. */
        layLine: null,
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
      tenKyNgan: "tháng " + th + "/" + nam,
      moTaNgan: (vt) => vt + "/" + String(th).padStart(2, "0") + "/" + nam,
      layLine: (L, ten) => layDiem((((L.theo_ngay_thang || {})[ten] || {})[nam] || {})[th]),
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
      /* Dọn luôn chú giải: nó nằm ngoài `#skVe` từ 12/09/2026 nên không tự
         biến mất theo, và một chú giải kể tên hai đường không hề được vẽ là
         mời người đọc đi tìm chúng. */
      const oCgRong = $("skChuGiai");
      if (oCgRong) oCgRong.innerHTML = "";
      return;
    }
    /* MỘT biểu đồ mỗi lúc, chọn bằng hai tab (chủ dự án chốt 12/09/2026:
       "gộp biểu đồ doanh số và số đơn vào 1 khung, có 2 tab chuyển đổi như
       biểu đồ Xu hướng theo Line đang làm"). Trước đây vẽ cả hai chồng dọc,
       nên khối biểu đồ cao gấp đôi và đẩy mọi thứ khác xuống dưới màn hình. */
    const bd = BIEU_DO[trangThai.chiSo] || BIEU_DO[0];
    const nhanKhung = bd.ten + " " + k.duoi;
    oVe.innerHTML = '<p class="tieuDeSk">' + thoat(nhanKhung)
      + ' <span class="donViCua">(' + thoat(bd.donVi) + ")</span></p>"
      + '<div class="khoiBieuDo" id="skHopVe">'
      + veBieuDo({
        diemNay, diemTruoc, namNay: nam, namTruoc,
        vtMin: k.vtMin, vtMax: k.vtMax, nhanTruc: k.nhanTruc, moTa: k.moTa,
        layGiaTri: bd.layGiaTri, nhanDoc: bd.nhanDoc, sanGiaTri: bd.sanGiaTri,
        taDayDu: bd.taDayDu, donViDiem: k.donViDiem,
        tenKyNay: k.tenKyCua(nam), tenKyTruoc: k.tenKyCua(namTruoc),
        nhanKhung, cao: caoHeToaDo,
      }) + "</div>";
    const oCg = $("skChuGiai");
    if (oCg) oCg.innerHTML = chuGiai("Năm " + nam, "Năm " + namTruoc, diemTruoc.length > 0);
  }

  /* ─────────── Cân chiều cao theo MÀN HÌNH THẬT ───────────
   *
   * Chủ dự án chốt 12/09/2026, hai việc đi liền nhau:
   *   1. hai cột phải cân nhau — trước đó lưới 10 ô bên phải cao gần gấp đôi
   *      biểu đồ bên trái, vì mỗi bên tự cao theo nội dung của mình;
   *   2. mở trang ra phải thấy CẢ bảng lẫn biểu đồ, không phải cuộn.
   *
   * Cả hai là MỘT bài toán: chia phần màn hình còn lại DƯỚI BẢNG cho khối
   * biểu đồ, rồi ép hai cột cùng đúng chiều cao ấy. Đo bằng
   * `getBoundingClientRect()` chứ không đoán bằng một con số px cố định —
   * cùng cách `dieuChinhCaoBang()` bên `don-hang.js` đang tính chiều cao
   * khung bảng đơn, và cùng lý do: chiều cao hàng tab, số line, cỡ chữ của
   * người dùng đều đổi được.
   */

  /** Khoảng chừa dưới đáy màn hình, dùng khi không đo được phần nằm DƯỚI
   *  khối (đệm đáy của khung trang). */
  const LE_DAY = 14;
  /** Sàn chiều cao khối. Màn rất thấp (laptop 768px, hay bảng nhiều line) thì
   *  thà cả trang cuộn thêm một chút còn hơn ép biểu đồ bẹp tới mức không
   *  đọc được — cùng kỷ luật sàn 260px của khung bảng đơn. */
  const SAN_KHOI = 200;
  /** TRẦN chiều cao khối — và đây là thứ THIẾU ở bản đầu, lỗi chủ dự án bắt
   *  được ngay khi mở thật ("vẫn không khác gì và thậm chí còn to hơn").
   *
   *  Bản đầu chỉ có sàn: `max(SAN, chỗ còn lại)`. Trên một màn CAO thì "chỗ
   *  còn lại" lên tới 600px, và biểu đồ ăn hết — nó phình to ra đúng lúc lẽ
   *  ra phải gọn lại. "Lấp đầy màn hình" không phải điều chủ dự án yêu cầu;
   *  điều họ yêu cầu là "thấy hết mà không phải cuộn", và một biểu đồ 600px
   *  không giúp gì cho việc ấy — nó chỉ đẩy mọi thứ khác đi.
   *
   *  Trần nới từ 300 lên 420 ở lượt dọn khoảng trống (12/09/2026): chú giải
   *  dời lên dải nút và mấy thẻ `<p>` rỗng thôi chiếm lề, nên khối gọn lại
   *  chừng 70px — chỗ ấy trả về cho chính hình vẽ thay vì nằm trống, đúng ý
   *  "mở rộng độ cao xuống thay vì để trống trải". Vẫn có trần, vì bài học
   *  của lượt trước còn nguyên: không trần thì trên màn cao nó lại ăn hết. */
  const TRAN_KHOI = 420;

  /** Chiều cao hệ toạ độ của biểu đồ trái, tính từ lần đo gần nhất. */
  let caoHeToaDo = CAO_MAC_DINH;
  /** Như trên, cho MỘT ô của lưới nhỏ — để cụm bên phải cũng lấp đầy cột thay
   *  vì xếp sát mép trên rồi bỏ trống phần dưới. */
  let caoOMini = CAO_MINI;
  /** Số ô lưới đang vẽ — cần để tính ra lưới đang có mấy HÀNG. */
  let soOMini = 0;
  let dangCanh = false;

  /* Ba số phải KHỚP với CSS của `.luoiXuHuong` / `.oMini` (khe hở, bề rộng ô
     tối thiểu, viền + đệm + dòng tên). Lệch một chút chỉ làm ô hơi thừa hoặc
     hơi thiếu chỗ, không làm sai số nào — nên chép ở đây là đánh đổi chấp
     nhận được, đổi lấy việc không phải đo từng ô một mỗi lượt vẽ. */
  const KHE_O = 8, O_HEP_NHAT = 115, VIEN_O = 14, CAO_TEN_O = 16;

  /** Đo chỗ còn lại rồi ép hai cột cùng chiều cao.
   *
   *  Gọi SAU mỗi lượt vẽ. Nếu phép đo cho ra một tỉ lệ khác hẳn tỉ lệ đang
   *  vẽ thì vẽ lại ĐÚNG MỘT lần nữa — `dangCanh` chặn vòng lặp, vì lượt vẽ
   *  lại cũng gọi lại chính hàm này. */
  function canhCaoKhoi() {
    const khoi = $("o-dashboard"), oVe = $("skVe"), oLuoi = $("skLuoiNho");
    if (!khoi || !oVe || !oLuoi) return;
    /* DOM giả của bộ kiểm không có hình học — `getBoundingClientRect` trả 0.
       Khi ấy giữ nguyên hình học mặc định, đúng hành vi trước lượt sửa này. */
    const hop = khoi.getBoundingClientRect ? khoi.getBoundingClientRect() : null;
    if (!hop || !window.innerHeight || !hop.height) return;

    /* Phần nằm DƯỚI khối (đệm đáy của khung trang) — đo thật thay vì đoán
       bằng `LE_DAY`: không trừ nó ra thì khối tính ra vừa khít đáy màn hình,
       nhưng đệm của khung trang vẫn đẩy trang dài thêm và người dùng VẪN
       phải cuộn. `LE_DAY` chỉ còn là bản lùi khi không đọc được tài liệu. */
    const gocTrang = document.documentElement;
    const duoiKhoi = gocTrang && gocTrang.scrollHeight
      ? Math.max(0, gocTrang.scrollHeight - (hop.top + (window.scrollY || 0)) - hop.height)
      : LE_DAY;

    /* Chỗ còn lại của màn hình cho khối, trừ tiếp phần đệm + dải nút của
       chính nó (đo bằng hiệu chiều cao, không cộng tay các hằng số CSS —
       chúng đổi được mà không ai báo). */
    const conLai = window.innerHeight - hop.top - duoiKhoi;
    const caoNgoai = hop.height - (oVe.parentElement ? oVe.parentElement.offsetHeight : hop.height);
    /* Kẹp GIỮA sàn và trần. Thiếu trần là lỗi của bản đầu — xem `TRAN_KHOI`. */
    const caoCot = Math.min(TRAN_KHOI, Math.max(SAN_KHOI, conLai - caoNgoai));

    oVe.style.height = caoCot + "px";
    oLuoi.style.height = caoCot + "px";

    /* Khung vẽ (phần còn lại của cột sau tiêu đề và chú giải) — `flex: 1`
       nên nó đúng bằng chỗ thừa, không phụ thuộc hình đang vẽ cao bao nhiêu. */
    const hopVe = $("skHopVe");
    if (!hopVe || !hopVe.clientHeight || !hopVe.clientWidth) return;
    /* viewBox phải CÙNG TỈ LỆ với khung, nếu không SVG tự chừa dải trắng. */
    const canCao = Math.round(RONG * hopVe.clientHeight / hopVe.clientWidth);
    /* Ô lưới: chia chiều cao cột cho số HÀNG thật (số cột suy từ bề rộng đo
       được), rồi quy sang chiều cao hệ toạ độ của một ô. Không làm bước này
       thì ô giữ nguyên cỡ cũ và cụm phải xếp sát mép trên, bỏ trống phần
       dưới — đúng chỗ chủ dự án khoanh đỏ. */
    let canO = caoOMini;
    const luoi = $("skLuoiGrid");
    if (luoi && luoi.clientWidth && luoi.clientHeight && soOMini > 0) {
      const cot = Math.max(1, Math.floor((luoi.clientWidth + KHE_O) / (O_HEP_NHAT + KHE_O)));
      const hang = Math.ceil(soOMini / cot);
      const rongO = (luoi.clientWidth - (cot - 1) * KHE_O) / cot - VIEN_O;
      const caoO = (luoi.clientHeight - (hang - 1) * KHE_O) / hang - VIEN_O - CAO_TEN_O;
      if (rongO > 0 && caoO > 0) {
        /* Kẹp: quá dẹt thì đường thành một vạch, quá cao thì một ô nuốt cả
           cụm khi chỉ có vài line. */
        canO = Math.min(90, Math.max(30, Math.round(RONG_MINI * caoO / rongO)));
      }
    }

    const lechVe = Math.abs(canCao - caoHeToaDo) >= 6;
    const lechO = Math.abs(canO - caoOMini) >= 4;
    if (dangCanh || (!lechVe && !lechO)) return;
    caoHeToaDo = canCao;
    caoOMini = canO;
    dangCanh = true;
    try {
      if (lechVe) veBieuDoHienTai();
      if (lechO) veKhoiLuoiNho();
    } finally { dangCanh = false; }
  }

  /** Hàng tab chỉ số [Doanh số] [Số đơn] — dùng CHUNG cho cả hai khối. */
  function veTabChiSo() {
    const hang = $("skTabChiSo");
    if (!hang) return;
    hang.innerHTML = "";
    BIEU_DO.forEach((m, i) => {
      const nut = document.createElement("button");
      nut.type = "button";
      nut.className = "tabNut" + (i === trangThai.chiSo ? " tabDang" : "");
      nut.textContent = m.ten;
      nut.addEventListener("click", () => { trangThai.chiSo = i; veLai(); });
      hang.appendChild(nut);
    });
  }

  function veKhoiLuoiNho() {
    const o = $("skLuoiNho");
    if (!o) return;
    if (!duLieu || !duLieu.line) { o.innerHTML = ""; return; }

    const L = duLieu.line;
    const k = dungKhung(trangThai.nam);
    const bd = BIEU_DO[trangThai.chiSo] || BIEU_DO[0];
    const thuTu = L.thu_tu || [];
    if (!thuTu.length) { o.innerHTML = ""; return; }
    const tenCuoi = thuTu[thuTu.length - 1];

    /* Chủ dự án chốt "xu hướng line chỉ làm theo ngày + tháng". Ở đơn vị Quý
       thì NÓI RA một câu thay vì (a) hiện lưới theo tháng — hai khối cạnh
       nhau nói hai khung thời gian khác nhau, người đọc so chúng là ra kết
       luận sai — hay (b) để trống trơn, thứ trông y như một lỗi. */
    if (!k.layLine) {
      o.innerHTML = '<p class="tieuDeSk">Xu hướng theo Line</p>'
        + '<p class="miniRong">Cụm này chỉ vẽ theo ngày và theo tháng. '
        + 'Chuyển biểu đồ bên trái về [Ngày] hoặc [Tháng] để xem.</p>';
      return;
    }

    /* Dữ liệu ngày × line là trường MỚI của Engine (P6). Giữa hai lượt deploy
       song song (bẫy số 4) bản Engine cũ còn đang chạy và chưa trả nó — nói
       thẳng một câu thay vì hiện mười ô trống trông như mười line đã ngừng
       bán. */
    if (trangThai.donVi === "ngay" && !L.theo_ngay_thang) {
      o.innerHTML = '<p class="tieuDeSk">Xu hướng theo Line</p>'
        + '<p class="miniRong">Máy chủ chưa trả số theo ngày cho từng line '
        + '(bản vừa cập nhật đang lên). Thử lại sau ít phút.</p>';
      return;
    }

    const dsLine = thuTu.map((ten) => ({ ten, diem: k.layLine(L, ten) }));

    /* Sắp GIẢM DẦN theo tổng của CHÍNH chỉ số đang xem, "Khác" luôn cuối —
       đổi chỉ số không làm lưới xáo trộn ngoài dự đoán. */
    dsLine.sort((a, b) => {
      if (a.ten === tenCuoi) return 1;
      if (b.ten === tenCuoi) return -1;
      const tong = (arr) => arr.reduce((t, p) => t + bd.layGiaTri(p), 0);
      return tong(b.diem) - tong(a.diem);
    });

    soOMini = dsLine.length;
    o.innerHTML = '<p class="tieuDeSk">Xu hướng theo Line · ' + thoat(k.duoi)
      + ' <span class="donViCua">(' + thoat(bd.donVi) + ")</span></p>"
      + '<div class="luoiXuHuong" id="skLuoiGrid">'
      + dsLine.map(({ ten, diem }) => veMiniDuong(ten, diem, bd, k)).join("")
      + "</div>";
  }

  /** Hàng tab đơn vị thời gian [Ngày] [Tháng] [Quý].
   *
   *  Ngày = tháng đang chọn ở hàng nút của màn báo cáo; Tháng và Quý = cả
   *  NĂM đang chọn (lúc đó nút tháng chỉ còn điều khiển bảng, không điều
   *  khiển biểu đồ — chủ dự án chốt 12/09/2026). */
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
    if (trangThai.nam === null) return;   // chưa ai báo kỳ sang — chưa vẽ gì
    veTabDonVi();
    veTabChiSo();
    veBieuDoHienTai();
    veKhoiLuoiNho();
    canhCaoKhoi();
  }

  /** Khung cố định của Dashboard, dựng một lần vào ô P3 chừa sẵn.
   *
   *  Dải nút phụ nằm NGAY DƯỚI hai biểu đồ, xếp hạng nằm dưới cùng: dải nút
   *  đổi kỳ cho cả khối, để nó sát biểu đồ thì bấm xong thấy ngay cái vừa
   *  đổi, không phải cuộn qua bảng xếp hạng mới tới chỗ bấm. */
  function dungKhungHtml() {
    const o = $("o-dashboard");
    if (!o) return false;
    /* Hai cột: biểu đồ lớn bên TRÁI, cụm lưới nhỏ bên PHẢI (chủ dự án chốt
       12/09/2026). Hai hàng tab đứng chung một dải trên cùng vì cả hai điều
       khiển CẢ HAI cột — để chúng nằm trong cột trái thì người đọc tưởng
       chúng chỉ đổi cột ấy. */
    o.innerHTML = '<div class="daiDieuKhien">'
      + '<div class="tabDonVi" id="skTabDonVi"></div>'
      + '<div class="tabDonVi" id="skTabChiSo"></div>'
      /* Chú giải nằm CÙNG hàng với hai dải nút, dồn sang mép phải (chủ dự án
         chốt 12/09/2026: "dồn lên 1 góc hoặc 1 hàng thay vì để rải rác từng
         dòng"). Trước đây nó là một hàng riêng dưới biểu đồ — tốn trọn một
         dòng chiều cao, trong khi nửa phải của hàng nút thì bỏ không. */
      + '<div class="chuGiaiSk" id="skChuGiai"></div>'
      + "</div>"
      + '<div class="haiCotBieuDo">'
      + '<div class="cotTrai" id="skVe"></div>'
      + '<div class="cotPhai" id="skLuoiNho"></div>'
      + "</div>"
      + '<p class="canhBao" id="skLoi"></p>';
    return true;
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
      /* `no-store`: Dashboard đọc CÙNG nguồn `bc/ky` mà lượt tải sổ và lượt
         xoá dòng đang sửa, nên một bản cache cũ ở đây là hai màn hình của
         cùng app nói hai con số khác nhau cho cùng một tháng. Cùng lỗi đã
         bắt được ở `/api/don-hang` ngày 12/09/2026. */
      const r = await fetch("/api/bao-cao/suc-khoe", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + token },
      });
      const than = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(than.loi || "HTTP " + r.status);
      duLieu = than;
      veLai();
    } catch (e) {
      oVe.innerHTML = "";
      $("skLuoiNho").innerHTML = "";
      oLoi.textContent = "Không lấy được số liệu biểu đồ: " + e.message;
    } finally {
      dangTai = false;
    }
  }

  /* ─────────── Cửa vào: màn báo cáo điều khiển khối này ───────────
   *
   * Tab [Biểu đồ] ĐÃ BỎ (chủ dự án chốt 12/09/2026) — biểu đồ nay nằm ngay
   * dưới bảng [Tổng hợp] của màn báo cáo. Nên `moTab()` cũ, thứ hoãn lượt
   * gọi `/api/bao-cao/suc-khoe` tới khi người dùng bấm sang tab, không còn
   * nghĩa: không còn tab nào để bấm.
   *
   * Thay vào đó `don-hang.js` gọi `datKy(nam, thang)` mỗi lần kỳ đang xem
   * đổi — và chính lượt gọi đầu tiên mở màn ra là lượt kích hoạt tải. Cửa
   * vào vẫn là MỘT hàm: file này không tự đoán kỳ bằng cách soi nút nào đang
   * sáng ở ngoài, để hai nhánh không buộc chặt vào nhau qua tên phần tử.
   *
   * KHÔNG còn `datMacDinh()`: kỳ mặc định là việc của màn báo cáo (nó đã tự
   * chọn năm/tháng mới nhất có sổ), và hai chỗ cùng đoán một mặc định là hai
   * chỗ sẽ đoán lệch nhau.
   */
  let nguoiDung = null;

  function taiNeuCan() {
    if (nguoiDung && !duLieu && trangThai.nam !== null) tai(nguoiDung);
  }

  window.SucKhoe = {
    /** Màn báo cáo báo sang: đang xem kỳ nào. `ky` dạng "2026-09". */
    datKy: function (ky) {
      if (typeof ky !== "string" || !/^\d{4}-\d{2}$/.test(ky)) return;
      const nam = Number(ky.slice(0, 4)), thang = Number(ky.slice(5, 7));
      if (trangThai.nam === nam && trangThai.thang === thang) return;
      trangThai.nam = nam;
      trangThai.thang = thang;
      if (duLieu) veLai(); else taiNeuCan();
    },
    /** Hiện/ẩn cả khối — chỉ tab [Tổng hợp] mới có biểu đồ (chủ dự án chốt
     *  12/09/2026). Ở tab của một line, bảng đơn 19 cột đã rất dài; thêm
     *  biểu đồ bên dưới là phải cuộn qua hàng trăm dòng mới thấy. */
    hien: function (co) {
      const o = $("o-dashboard");
      if (o) o.hidden = !co;
    },
  };

  /* Đổi cỡ cửa sổ là đổi chỗ còn lại — cùng lý do `don-hang.js` nghe `resize`
     cho khung bảng đơn. */
  window.addEventListener("resize", canhCaoKhoi);

  document.addEventListener("DOMContentLoaded", function () {
    firebase.auth().onAuthStateChanged(function (user) {
      nguoiDung = user || null;
      /* Đăng xuất thì quên sạch: người sau đăng nhập vào cùng trình duyệt
         không được thấy số của người trước. */
      if (!user) { duLieu = null; trangThai.nam = null; return; }
      taiNeuCan();
    });
  });
})();
