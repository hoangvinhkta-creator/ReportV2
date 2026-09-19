/* MÀU CỦA TỪNG HÃNG — MỘT bảng, dùng chung cho cả app.
 *
 * Chủ dự án chốt 19/09/2026: "mỗi hãng 1 màu thay vì mỗi hàng ở mỗi cột đang
 * là 1 màu khác nhau", và "những màu này gán luôn lên các nút chọn tab ở
 * kích hoạt bảo hành".
 *
 * Nên file này tồn tại: hai màn hình khác nhau (biểu đồ cơ cấu, tab hãng của
 * màn kích hoạt bảo hành) phải nói cùng một thứ tiếng về màu. Hai bảng màu
 * là hai bảng trôi khỏi nhau, và chỗ trôi ở đây là Samsung xanh ở biểu đồ mà
 * hồng ở hàng tab — tức người dùng mất đúng cái lợi vừa được chốt.
 *
 * ── VÌ SAO BẢN TRƯỚC HỎNG ──
 *
 * Bản đầu của biểu đồ băm TÊN HÃNG ra một trong mười hai màu. Về lý thì
 * Samsung luôn ra cùng một màu; về mắt thì không dùng được, vì hai hãng khác
 * nhau đụng cùng một ô băm là chuyện thường gặp với vài chục cái tên — và
 * khi ấy hai mảng cùng màu ở hai cột KHÔNG phải cùng một hãng, đúng thứ màu
 * sinh ra để nói. Bảng khai tường minh thì không có va chạm nào cho mười
 * hãng thật sự quan trọng.
 *
 * ── MÀU KHÔNG PHẢI NGHIỆP VỤ, NHƯNG DANH SÁCH HÃNG THÌ PHẢI ──
 *
 * File này CÓ gõ mười cái tên hãng, và đó là ngoại lệ có chủ đích với kỷ
 * luật "màn hình không khai lại danh sách hãng" (CLAUDE.md, LUẬT SỐ 1): một
 * bảng màu thì phải khoá theo một cái gì đó, và cái đó chỉ có thể là tên.
 *
 * Nhưng nó KHÔNG quyết định hãng nào tồn tại: danh sách thật vẫn đến từ
 * Engine ở mọi lượt đọc, và một hãng không có trong bảng dưới đây vẫn hiện
 * ra bình thường với một màu lấy từ dải dự phòng. Trôi ở đây là mất một màu
 * đẹp, không mất một dòng dữ liệu.
 *
 * `kiem/mau-hang.js` canh mười khoá dưới đây KHỚP ĐÚNG `HANG_BAO_HANH` của
 * Engine — nên bảng này không âm thầm lạc khỏi danh sách thật.
 *
 * ── GAM PASTEL ──
 *
 * Chủ dự án chốt: màn này mở cả buổi, màu bão hoà cạnh nhau mười mảng là
 * chói mắt. Mọi màu ở đây có độ sáng trong khoảng 170–240 (bài kiểm đo thật)
 * — đủ nhạt để nhìn lâu, đủ đậm để chữ đen đặt lên vẫn đọc được.
 */
(function () {
  "use strict";

  /* Mười hãng có cổng bảo hành. Sắc độ chọn tách nhau rõ, và bám màu thương
     hiệu thật ở chỗ bám được (Samsung xanh dương, LG đỏ, Daikin xanh lơ) để
     người dùng đoán được màu trước khi đọc chú giải. */
  const BANG = {
    "Samsung":   "#9fc3e8",   // xanh dương
    "LG":        "#f2aeae",   // đỏ hồng
    "Sony":      "#a9dbc8",   // xanh ngọc
    "Funiki":    "#f4d9a0",   // vàng
    "Toshiba":   "#c7b6e3",   // tím
    "Panasonic": "#bfe2a6",   // xanh lá
    "Casper":    "#f8c4a4",   // cam
    "Hitachi":   "#f0bcd8",   // hồng sen
    "Daikin":    "#9ed9e8",   // xanh lơ
    "Sharp":     "#d8c5a4",   // nâu be
  };

  /* Dải dự phòng cho hãng ngoài mười cái trên (bảng giá Tracking là danh
     sách mở). Tách hẳn khỏi bảng trên để một hãng lạ không bao giờ mượn
     đúng màu của một hãng đã khai. */
  const DU_PHONG = [
    "#b8d0e0", "#e8cfc0", "#cfe0b8", "#e0c0d8", "#c0d8e0", "#ded0b0",
  ];

  /** Phần gộp và phần chưa biết đều XÁM — mắt phải đọc ra ngay chúng không
   *  phải một hãng. Ba sắc xám khác nhau một chút để ba thứ ấy vẫn phân biệt
   *  được với nhau. */
  const MAU_KHAC = "#d6d8de";
  const MAU_CHUA_PHAN_LOAI = "#c2c5cc";
  const MAU_CHUA_RO_HANG = "#e3e5ea";

  /** Vân tay FNV-1a của tên — chỉ dùng cho hãng KHÔNG có trong bảng. Băm chứ
   *  không đếm thứ tự xuất hiện: đếm thứ tự thì cùng một hãng đổi màu khi nó
   *  đổi vị trí giữa hai tháng. */
  function van(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /** Màu của một hãng. Tên rỗng/không phải chuỗi → màu "chưa rõ hãng". */
  function cua(ten) {
    if (typeof ten !== "string" || !ten.trim()) return MAU_CHUA_RO_HANG;
    const t = ten.trim();
    if (BANG[t]) return BANG[t];
    /* Hoa/thường lệch nhau là chuyện có thật với chữ gõ tay bên bảng giá —
       dò thêm một vòng không phân biệt hoa thường trước khi rơi xuống dải
       dự phòng. */
    const k = t.toLowerCase();
    for (const h of Object.keys(BANG)) if (h.toLowerCase() === k) return BANG[h];
    return DU_PHONG[van(t) % DU_PHONG.length];
  }

  window.MauHang = {
    cua,
    MAU_KHAC,
    MAU_CHUA_PHAN_LOAI,
    MAU_CHUA_RO_HANG,
    /** Chỉ cho bộ kiểm đối chiếu với `HANG_BAO_HANH` của Engine. */
    _bang: BANG,
  };
})();
