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
 * THỨ TỰ trong cột thì không: mỗi cột tự xếp lớn → bé từ đáy lên (chủ dự án
 * chốt 19/09/2026). Cùng TẬP hãng và cùng MÀU là đủ để hai cột so được với
 * nhau; bắt chúng cùng thứ tự nữa thì mỗi cột riêng lẻ trông lộn xộn.
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
/** Nhãn của cột chưa gán mã. Chủ dự án chốt viết tắt 19/09/2026 — trục ngang
 *  chỉ có chừng bảy chữ cho mỗi cột, và "Chưa phân loại" bị cắt thành
 *  "Chưa phân lo…". Câu đầy đủ vẫn nằm ở phần rê chuột và ở dòng độ phủ
 *  dưới biểu đồ, nên không có chỗ nào để hiểu nhầm. */
export const NHAN_CHUA_PHAN_LOAI = "NONE";

/** GỘP / ĐỔI NHÃN NGÀNH HÀNG — chủ dự án chốt 19/09/2026.
 *
 *  `category_label` của Tracking là chữ người gõ tay, và trên trục ngang mỗi
 *  cột chỉ có chừng bảy chữ. Ba cái tên thật bị cắt cụt ngoài đời
 *  ("Lọc không khí kh…", "Gia dụng - B…") nên chủ dự án chốt viết tắt.
 *
 *  Khớp theo CHUỖI ĐÃ CHUẨN HOÁ (bỏ dấu, bỏ ký tự lạ) chứ không so nguyên
 *  văn: tên thật có thể mang đủ kiểu đuôi ("Gia dụng - Bosch", "Gia dụng -
 *  Electrolux") và bảng này không nên phải biết trước từng cái.
 *
 *  ĐÂY LÀ PHÉP GỘP, KHÔNG CHỈ ĐỔI NHÃN: hai ngành cùng rơi vào một nhãn thì
 *  số của chúng CỘNG LẠI thành một cột. "LKK chung cho cả lọc không khí và
 *  hút ẩm" đúng là điều chủ dự án yêu cầu. Cột gộp giữ `ten_goc` — danh sách
 *  tên thật — để phần rê chuột nói ra nó gồm những gì.
 *
 *  Thứ tự trong mảng LÀ thứ tự xét: luật đầu tiên khớp thì thắng. */
const GOP_NGANH = [
  { nhan: "LKK", khop: (k) => k.includes("lockhongkhi") || k.includes("hutam") },
  { nhan: "Gia dụng", khop: (k) => k.startsWith("giadung") },
];

/* Bỏ dấu tiếng Việt rồi xoá sạch ký tự ngoài a-z0-9 — chỉ để TRA BẢNG trên,
   không dùng cho bất kỳ phép khớp mã hàng nào. */
function khoaNganh(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Nhãn hiển thị của một ngành — sau khi áp bảng gộp. */
export function nhanNganh(ten) {
  const k = khoaNganh(ten);
  if (!k) return ten;
  for (const l of GOP_NGANH) if (l.khop(k)) return l.nhan;
  return ten;
}
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
  /* nhãn sau khi gộp → những tên THẬT đã dồn vào đó, cho phần rê chuột. */
  const tenGoc = {};
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

        const nganhTho = typeof d.nganh_hang === "string" && d.nganh_hang.trim()
          ? d.nganh_hang.trim() : null;
        if (!nganhTho) { ds_chua = lamTron(ds_chua + ds); may_chua += may; continue; }

        /* Gộp/đổi nhãn NGAY TẠI ĐÂY, trước mọi phép cộng: gộp sau khi đã xếp
           hạng thì hai ngành nhỏ gộp lại có thể vượt cả tám ngành đứng riêng
           mà không được lên trục. */
        const nganh = nhanNganh(nganhTho);
        if (nganh !== nganhTho) (tenGoc[nganh] ||= new Set()).add(nganhTho);

        const hang = typeof d.hang === "string" && d.hang.trim()
          ? d.hang.trim() : NHAN_CHUA_RO_HANG;
        them(nganh, hang, ds, may);
      }
    }
  }

  return { o, ds_tong, may_tong, ds_chua, may_chua, tenGoc };
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

    /* Cộng CẢ HAI chỉ tiêu cho mọi mảng, không chỉ chỉ tiêu đang vẽ.
       Chủ dự án chốt 19/09/2026: bấm vào một mảng thì card bên phải hiện
       "số lượng VÀ doanh số, hiện tại so với cùng kỳ" — bốn con số cho đúng
       một mảng. Tra chúng ở cấu trúc của chỉ tiêu kia thì hỏng ngay ca
       thường gặp nhất: một hãng đứng riêng ở bảng doanh số có thể đã bị gộp
       vào "Khác" ở bảng số máy, và card sẽ không tìm thấy nó. */
    const lay = (thuocNganh) => {
      const rieng = new Map();
      const tong = { doanh_so: 0, so_may: 0 };
      for (const c of m.o.values()) {
        if (!thuocNganh(c)) continue;
        tong.doanh_so = lamTron(tong.doanh_so + c.doanh_so);
        tong.so_may += c.so_may;
        const cu = rieng.get(c.hang) || { doanh_so: 0, so_may: 0 };
        cu.doanh_so = lamTron(cu.doanh_so + c.doanh_so);
        cu.so_may += c.so_may;
        rieng.set(c.hang, cu);
      }
      return { rieng, tong };
    };

    const themCot = (ten, thuocNganh, la_khac) => {
      const { rieng, tong } = lay(thuocNganh);
      const dsHang = hangCua.get(ten) || [];
      const hang = [];
      const daKe = { doanh_so: 0, so_may: 0 };
      for (const h of dsHang) {
        const v = rieng.get(h) || { doanh_so: 0, so_may: 0 };
        hang.push({ ten: h, gia_tri: v[truong],
                    doanh_so: v.doanh_so, so_may: v.so_may, la_khac: false });
        daKe.doanh_so = lamTron(daKe.doanh_so + v.doanh_so);
        daKe.so_may += v.so_may;
      }
      /* Phần còn lại của cột gom thành MỘT mảng "Khác", nhưng giữ nguyên
         danh sách bên trong: chủ dự án chốt "di chuột vào đó thấy đủ thông
         tin", nên cái gộp là cách VẼ, không phải cách quên. */
      const conLai = [];
      for (const [h, v] of rieng) {
        if (dsHang.indexOf(h) >= 0) continue;
        if (v.doanh_so > 0 || v.so_may > 0) {
          conLai.push({ ten: h, gia_tri: v[truong], doanh_so: v.doanh_so, so_may: v.so_may });
        }
      }
      const du = { doanh_so: lamTron(tong.doanh_so - daKe.doanh_so),
                   so_may: tong.so_may - daKe.so_may };
      if (du[truong] > 0 || conLai.length) {
        conLai.sort((a, b) => (b.gia_tri - a.gia_tri)
          || (a.ten < b.ten ? -1 : a.ten > b.ten ? 1 : 0));
        hang.push({ ten: NHAN_KHAC, gia_tri: du[truong],
                    doanh_so: du.doanh_so, so_may: du.so_may,
                    la_khac: true, gom: conLai });
      }
      /* ── THỨ TỰ RUỘT CỘT: LỚN → BÉ, TỪ ĐÁY LÊN ĐỈNH ──
         Chủ dự án chốt 19/09/2026, sau khi mở thật: "sắp xếp cơ cấu trong
         cột đang lộn xộn, tôi muốn cơ cấu từ lớn đến bé sắp xếp theo chiều
         từ dưới lên đỉnh cột".

         Bản trước xếp ruột cột theo `dsHang` — thứ hạng tính trên TỔNG HAI
         THÁNG. Về lý nó giữ cho hai cột cạnh nhau xếp cùng một thứ tự; về
         mắt thì mỗi cột riêng lẻ trông đúng là lộn xộn, vì một hãng lớn của
         tháng này có thể đứng dưới một hãng nó lớn gấp năm lần, chỉ vì năm
         ngoái hãng kia bán mạnh.

         Nay MỖI CỘT tự xếp theo giá trị CỦA CHÍNH NÓ. Cái mất đi là "hai
         cột cùng thứ tự"; cái giữ lại — và là cái thật sự khiến hai cột so
         được với nhau — là hai cột có CÙNG TẬP HÃNG và mỗi hãng MỘT màu cố
         định (`public/mau-hang.js`). Mắt dò theo màu, không dò theo vị trí.

         Bằng điểm thì so TÊN: hai lượt mở cùng một tháng phải ra cùng một
         hình, không phụ thuộc thứ tự khoá Firebase. */
      hang.sort((a, b) => (b.gia_tri - a.gia_tri)
        || (a.ten < b.ten ? -1 : a.ten > b.ten ? 1 : 0));

      const o = { ten, gia_tri: tong[truong],
                  doanh_so: tong.doanh_so, so_may: tong.so_may,
                  la_khac: !!la_khac, hang };
      /* Cột gộp từ nhiều ngành thật thì nói ra gồm những gì — không thì
         "LKK" là một nhãn không ai biết đang cộng của cái gì. */
      const goc = m.tenGoc && m.tenGoc[ten];
      if (goc && goc.size) o.ten_goc = [...goc].sort();
      cot.push(o);
    };

    for (const ten of nganhRieng) themCot(ten, (c) => c.nganh === ten, false);
    if (nganhGop.size) themCot(NHAN_KHAC, (c) => nganhGop.has(c.nganh), true);

    /* Cột "Chưa phân loại" đứng CUỐI trục và không có ruột: nó không phải
       một ngành, nó là phần chưa biết. Cao đúng tỉ trọng thật của nó. */
    const chua = truong === "doanh_so" ? m.ds_chua : m.may_chua;
    const tongCaThang = truong === "doanh_so" ? m.ds_tong : m.may_tong;
    if (chua > 0) {
      cot.push({ ten: NHAN_CHUA_PHAN_LOAI, gia_tri: chua,
                 doanh_so: m.ds_chua, so_may: m.may_chua,
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

  const theo_doanh_so = dungMotChiTieu("doanh_so", nay, truoc);

  /* CHỈ CÓ SỐ CỦA NĂM TRƯỚC — kỳ chưa tới (chủ dự án chốt 19/09/2026: mở
     khoá tab tháng 10, 11, 12 để "xem được xu hướng sắp tới").
     
     Nhận ra bằng DỮ LIỆU chứ không bằng ngày tháng: kỳ này không có đồng
     nào, kỳ năm trước thì có. Engine không biết hôm nay là ngày mấy, và
     không cần biết — "tháng nào chưa tới" là phép lịch, và nó nằm ở Gateway
     cùng chỗ với `kyTruoc`/`namTruoc`.
     
     Khác hẳn `co_ky_truoc === false`: ở đó là "chưa có sổ năm trước để so",
     còn ở đây là "chưa có sổ tháng này, nhưng năm trước thì có". Hai câu
     khác nhau, và màn hình vẽ hai thứ khác nhau — một bên báo thiếu, một
     bên vẽ đúng một cột năm trước cho mỗi ngành. */
  const chi_ky_truoc = coTruoc && theo_doanh_so.nay.tong <= 0
    && theo_doanh_so.truoc.tong > 0;

  return {
    co_ky_truoc: coTruoc,
    chi_ky_truoc,
    theo_doanh_so,
    theo_so_may: dungMotChiTieu("so_may", nay, truoc),
    do_phu: { nay: doPhu(nay), truoc: coTruoc ? doPhu(truoc) : null },
    nguong: { so_nganh: SO_NGANH_TOI_DA, hang_pt: NGUONG_HANG_PT },
  };
}
