/* CƠ CẤU NGÀNH HÀNG × HÃNG — chủ dự án chốt 19/09/2026.
 *
 * Một biểu đồ CỘT CHỒNG, và đúng hai tầng ý nghĩa:
 *
 *   chiều cao cột  = ngành hàng ấy chiếm bao nhiêu % của tháng
 *   ruột cột       = trong ngành ấy, hãng nào chiếm bao nhiêu
 *
 * Ví dụ chủ dự án đưa ra: tháng 8 tủ lạnh chiếm 50% → cột cao 50%; trong cột
 * ấy tủ lạnh Samsung chiếm 50% → màu Samsung tô nửa cột.
 *
 * Mỗi ngành có HAI cột đứng cạnh nhau: tháng đang xem, và cùng kỳ năm trước.
 *
 * ── VÌ SAO PHÉP GỘP NẰM Ở ĐÂY, KHÔNG Ở TRÌNH DUYỆT ──
 *
 * "Gộp tám ngành lớn, phần còn lại thành Khác" và "hãng dưới 5% gộp lại" đều
 * là phép CỘNG TIỀN rồi CHIA TỈ LỆ trên tiền — tức nghiệp vụ, tức Engine
 * (LUẬT SỐ 1 — CLAUDE.md). Trình duyệt nhận đúng những cột phải vẽ, kèm số
 * đã cộng sẵn, và chỉ việc đặt bút.
 *
 * ── MỘT TRỤC NGANG CHO CẢ HAI THÁNG ──
 *
 * Hai cột đứng cạnh nhau chỉ đọc được nếu chúng nói về CÙNG một ngành, và
 * mảng cùng màu trong hai cột phải là CÙNG một hãng. Nên danh sách ngành và
 * danh sách hãng của mỗi ngành được chốt MỘT LẦN cho cả hai tháng.
 *
 * Chốt theo TỔNG HAI THÁNG, không theo riêng tháng đang xem: một hãng bán
 * mạnh năm ngoái mà năm nay nghỉ hẳn sẽ bị dồn vào "Khác" nếu chỉ xếp hạng
 * theo tháng này — và đó đúng là hãng người ta mở biểu đồ ra để tìm.
 *
 * ── ĐỘ PHỦ: CON SỐ KHÔNG ĐƯỢC GIẤU ──
 *
 * Hãng và ngành hàng chỉ có ở dòng ĐÃ KHỚP MÃ bảng giá. Tháng nào còn nhiều
 * dòng chưa gán thì mọi ngành đều hụt — và hụt IM LẶNG, vì biểu đồ vẫn đủ
 * 100%. Đo thật trên tháng 01/2025 (19/09/2026): mười hãng cộng lại 797 máy
 * trong khi 1.575 dòng chưa xếp được hãng, tức phân loại mới được khoảng
 * một phần ba.
 *
 * Nên cột "Chưa phân loại" là một cột THẬT trên trục, cao đúng tỉ trọng của
 * nó, và `do_phu` đi kèm để màn hình nói ra bằng chữ. So một tháng đã gán kỹ
 * với một tháng gán ít mà không có hai thứ đó là vẽ ra một mức tăng trưởng
 * hoàn toàn bịa.
 */

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const lamTron = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Số ngành hàng đứng riêng trên trục ngang; phần còn lại gộp một cột.
 *
 *  Tám là con số chủ dự án chốt. Nó không phải một con số đẹp tuỳ tiện:
 *  `category_label` của Tracking là danh sách MỞ (người gõ tay bên Bảng
 *  giá), nên trục ngang có thể dài vài chục cột — và cột thứ ba mươi thì
 *  mỏng như sợi chỉ, không đọc được gì. */
export const SO_NGANH_TOI_DA = 8;

/** Hãng chiếm dưới ngần này phần trăm CỦA NGÀNH thì gộp vào "Khác".
 *
 *  Năm phần trăm: đủ nhỏ để không nuốt một hãng đáng kể, đủ lớn để một cột
 *  không vụn thành mười mảng mỏng mà mắt không phân biệt nổi màu. */
export const NGUONG_HANG_PT = 5;

export const NHAN_KHAC = "Khác";
export const NHAN_CHUA_PHAN_LOAI = "Chưa phân loại";
/** Dòng đã khớp mã (nên có ngành) nhưng bảng giá để trống `brand`.
 *
 *  Tách hẳn khỏi "Chưa phân loại": cái kia là CHƯA GÁN MÃ — việc của người
 *  dùng, gán xong là hết. Cái này là bảng giá thiếu nhãn hãng — việc bên
 *  Tracking. Gộp hai thứ lại là chỉ sai một chỗ mà đi sửa nhầm chỗ kia. */
export const NHAN_CHUA_RO_HANG = "Chưa rõ hãng";

/** Dòng này có được tính vào cơ cấu không.
 *
 *  Loại bốn thứ, mỗi thứ một lý do:
 *
 *   · `la_chiet_khau` — một phép trừ của cả đơn, không phải mặt hàng.
 *   · `la_phu_phi_co_dinh` — vận chuyển, lắp đặt, chênh VAT. Tiền công.
 *   · `tong_ban <= 0` — bắt trọn hàng BÁN TRẢ LẠI: dòng đã khớp bị
 *     `apDungBTL` hạ về 0, dòng chưa khớp mang số âm. Một cái máy đã quay
 *     về kho không nằm trong cơ cấu BÁN RA, và một mảng ÂM thì không có
 *     cách nào vẽ trong cột chồng phần trăm.
 *   · `so_luong <= 0` — lưới cuối, cho chỉ tiêu Số máy.
 *
 *  CỐ Ý khác `laMayDaBan` bên `bao-hanh.mjs` ở đúng một chỗ: bên đó quà tặng
 *  0 đồng VẪN được đếm (nó là một cái máy phải kích hoạt bảo hành), còn ở
 *  đây nó không góp đồng doanh số nào. Hai câu hỏi khác nhau thì hai luật
 *  khác nhau — gộp làm một là một trong hai màn sẽ sai. */
export function laDongTinhCoCau(d) {
  if (!laObj(d)) return false;
  if (d.la_chiet_khau) return false;
  if (d.la_phu_phi_co_dinh) return false;
  if ((Number(d.tong_ban) || 0) <= 0) return false;
  return (Number(d.so_luong) || 0) > 0;
}

/** Bảng đơn → tổng doanh số và số máy theo (ngành, hãng), chưa gộp gì.
 *
 *  Trả về một `Map` phẳng khoá `"<ngành>\x1f<hãng>"` để bước gộp bên dưới
 *  không phải lồng hai vòng lặp trên dữ liệu thật. */
function demTho(bang) {
  const o = new Map();
  let ds_tong = 0, may_tong = 0;
  let ds_chua = 0, may_chua = 0;

  const them = (nganh, hang, ds, may) => {
    const k = nganh + "\x1f" + hang;
    const c = o.get(k) || { nganh, hang, doanh_so: 0, so_may: 0 };
    c.doanh_so = lamTron(c.doanh_so + ds);
    c.so_may += may;
    o.set(k, c);
  };

  for (const ng of (bang && Array.isArray(bang.ngay) ? bang.ngay : [])) {
    for (const don of (Array.isArray(ng.don) ? ng.don : [])) {
      for (const d of (Array.isArray(don.dong) ? don.dong : [])) {
        if (!laDongTinhCoCau(d)) continue;
        const ds = Number(d.tong_ban) || 0;
        const may = Number(d.so_luong) || 0;
        ds_tong = lamTron(ds_tong + ds);
        may_tong += may;

        const nganh = typeof d.nganh_hang === "string" && d.nganh_hang.trim()
          ? d.nganh_hang.trim() : null;
        if (!nganh) { ds_chua = lamTron(ds_chua + ds); may_chua += may; continue; }

        const hang = typeof d.hang === "string" && d.hang.trim()
          ? d.hang.trim() : NHAN_CHUA_RO_HANG;
        them(nganh, hang, ds, may);
      }
    }
  }

  return { o, ds_tong, may_tong, ds_chua, may_chua };
}

/** Cộng một chiều của `demTho` lại theo ngành. */
function congTheoNganh(o, truong) {
  const r = new Map();
  for (const c of o.values()) r.set(c.nganh, lamTron((r.get(c.nganh) || 0) + c[truong]));
  return r;
}

/** Cơ cấu ngành hàng × hãng của MỘT chỉ tiêu, cho HAI tháng cùng lúc.
 *
 *  `truong` là `"doanh_so"` hoặc `"so_may"`. Dựng riêng cho từng chỉ tiêu
 *  chứ không dựng một lần rồi để màn hình đổi số: thứ hạng tám ngành lớn
 *  theo TIỀN khác hẳn thứ hạng theo SỐ MÁY (một cái tivi bằng mười cái
 *  quạt), nên hai chỉ tiêu là hai trục ngang khác nhau. Dùng chung một trục
 *  là một trong hai cách đọc sẽ xếp hạng sai.
 */
function dungMotChiTieu(truong, nay, truoc) {
  /* ── Chốt danh sách ngành, theo TỔNG HAI THÁNG ── */
  const nganhNay = congTheoNganh(nay.o, truong);
  const nganhTruoc = congTheoNganh(truoc.o, truong);
  const gop = new Map();
  for (const [k, v] of nganhNay) gop.set(k, lamTron((gop.get(k) || 0) + v));
  for (const [k, v] of nganhTruoc) gop.set(k, lamTron((gop.get(k) || 0) + v));

  const xepHang = [...gop.entries()]
    /* Bằng điểm thì so TÊN, không để thứ tự khoá quyết định: hai lượt mở
       cùng một tháng phải ra cùng một trục ngang. */
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const nganhRieng = xepHang.slice(0, SO_NGANH_TOI_DA).map(([k]) => k);
  const nganhGop = new Set(xepHang.slice(SO_NGANH_TOI_DA).map(([k]) => k));

  /* ── Chốt danh sách hãng của từng ngành, cũng theo tổng hai tháng ──
     Cùng lý do: mảng cùng màu ở hai cột phải là cùng một hãng, không thì
     hai cột cạnh nhau không so được với nhau. */
  const hangCua = new Map();   // ngành → [tên hãng đứng riêng]
  for (const ten of nganhRieng.concat(nganhGop.size ? [NHAN_KHAC] : [])) {
    const tong = new Map();
    let tongNganh = 0;
    for (const bo of [nay.o, truoc.o]) {
      for (const c of bo.values()) {
        const thuoc = ten === NHAN_KHAC ? nganhGop.has(c.nganh) : c.nganh === ten;
        if (!thuoc) continue;
        tong.set(c.hang, lamTron((tong.get(c.hang) || 0) + c[truong]));
        tongNganh = lamTron(tongNganh + c[truong]);
      }
    }
    const rieng = [...tong.entries()]
      .filter(([, v]) => tongNganh > 0 && (v / tongNganh) * 100 >= NGUONG_HANG_PT)
      .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k]) => k);
    hangCua.set(ten, rieng);
  }

  /* ── Dựng cột cho một tháng, theo đúng danh sách đã chốt ── */
  const dungCot = (m) => {
    const cot = [];
    const lay = (thuocNganh) => {
      const rieng = new Map(), gomKhac = [];
      let tong = 0;
      for (const c of m.o.values()) {
        if (!thuocNganh(c)) continue;
        tong = lamTron(tong + c[truong]);
        rieng.set(c.hang, lamTron((rieng.get(c.hang) || 0) + c[truong]));
      }
      return { rieng, gomKhac, tong };
    };

    const themCot = (ten, thuocNganh, la_khac) => {
      const { rieng, tong } = lay(thuocNganh);
      const dsHang = hangCua.get(ten) || [];
      const hang = [];
      let daKe = 0;
      for (const h of dsHang) {
        const v = rieng.get(h) || 0;
        hang.push({ ten: h, gia_tri: v, la_khac: false });
        daKe = lamTron(daKe + v);
      }
      /* Phần còn lại của cột gom thành MỘT mảng "Khác", nhưng giữ nguyên
         danh sách bên trong: chủ dự án chốt "di chuột vào đó thấy đủ thông
         tin", nên cái gộp là cách VẼ, không phải cách quên. */
      const conLai = [];
      for (const [h, v] of rieng) {
        if (dsHang.indexOf(h) >= 0) continue;
        if (v > 0) conLai.push({ ten: h, gia_tri: v });
      }
      const duKhac = lamTron(tong - daKe);
      if (duKhac > 0 || conLai.length) {
        conLai.sort((a, b) => (b.gia_tri - a.gia_tri)
          || (a.ten < b.ten ? -1 : a.ten > b.ten ? 1 : 0));
        hang.push({ ten: NHAN_KHAC, gia_tri: duKhac, la_khac: true, gom: conLai });
      }
      cot.push({ ten, gia_tri: tong, la_khac: !!la_khac, hang });
    };

    for (const ten of nganhRieng) themCot(ten, (c) => c.nganh === ten, false);
    if (nganhGop.size) themCot(NHAN_KHAC, (c) => nganhGop.has(c.nganh), true);

    /* Cột "Chưa phân loại" đứng CUỐI trục và không có ruột: nó không phải
       một ngành, nó là phần chưa biết. Cao đúng tỉ trọng thật của nó. */
    const chua = truong === "doanh_so" ? m.ds_chua : m.may_chua;
    const tongCaThang = truong === "doanh_so" ? m.ds_tong : m.may_tong;
    if (chua > 0) {
      cot.push({ ten: NHAN_CHUA_PHAN_LOAI, gia_tri: chua,
                 la_chua_phan_loai: true, hang: [] });
    }
    return { cot, tong: tongCaThang, chua_phan_loai: chua };
  };

  return { nay: dungCot(nay), truoc: dungCot(truoc) };
}

/** Phần trăm đã phân loại của một tháng, theo cả hai chỉ tiêu.
 *
 *  `null` khi tháng không có dòng nào — KHÔNG phải 0%: "không bán gì" và
 *  "bán mà chưa phân loại được gì" là hai chuyện khác hẳn, và màn hình nói
 *  hai câu khác nhau cho chúng. */
function doPhu(m) {
  const pt = (tong, chua) => (tong > 0 ? Math.round(((tong - chua) / tong) * 1000) / 10 : null);
  return {
    doanh_so_pt: pt(m.ds_tong, m.ds_chua),
    so_may_pt: pt(m.may_tong, m.may_chua),
  };
}

/** Hai bảng đơn (tháng đang xem, cùng kỳ năm trước) → mọi thứ biểu đồ cần.
 *
 *  `bangTruoc` vắng mặt (chưa nạp sổ tháng đó) thì vế "năm trước" ra rỗng và
 *  `co_ky_truoc: false` — màn hình nói thẳng "chưa có dữ liệu dòng hàng
 *  tháng này" thay vì vẽ một cột cao 0 trông như "năm ngoái không bán gì".
 */
export function coCauNganhHang(bangNay, bangTruoc) {
  const nay = demTho(bangNay);
  const coTruoc = !!bangTruoc;
  const truoc = coTruoc ? demTho(bangTruoc)
    : { o: new Map(), ds_tong: 0, may_tong: 0, ds_chua: 0, may_chua: 0 };

  return {
    co_ky_truoc: coTruoc,
    theo_doanh_so: dungMotChiTieu("doanh_so", nay, truoc),
    theo_so_may: dungMotChiTieu("so_may", nay, truoc),
    do_phu: { nay: doPhu(nay), truoc: coTruoc ? doPhu(truoc) : null },
    nguong: { so_nganh: SO_NGANH_TOI_DA, hang_pt: NGUONG_HANG_PT },
  };
}
