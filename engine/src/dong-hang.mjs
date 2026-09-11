/* DÒNG HÀNG — hạt nhỏ nhất của sổ bán hàng, và mọi luật đi kèm nó.
 *
 * `gop-ban-hang.mjs` trả về TỔNG theo (kỳ, nhân viên, ngày). Đủ để vẽ biểu
 * đồ, không đủ để dựng bảng đơn hàng: một đơn (`BH72812`) có thể bán nhiều
 * món, mỗi món MISA in một dòng, và các cột chủ dự án yêu cầu — mã sản
 * phẩm, số lượng, giá bán, IMEI — chỉ tồn tại ở mức DÒNG. Trên sổ 08/2026:
 * 1.607 dòng hàng / 1.150 đơn, 26% số đơn có từ hai dòng trở lên, đơn nhiều
 * nhất `BH71909` có 25 dòng.
 *
 * File này KHÔNG tính lại doanh số. `gopSoBanHang()` vẫn là nguồn sự thật
 * duy nhất cho con số tiền; ở đây chỉ giữ lại từng dòng để hiển thị, để so
 * file mới với file cũ, và để P5 có chỗ neo quyết định chỉnh sửa tay.
 *
 * TRÌNH DUYỆT KHÔNG BAO GIỜ CHẠY FILE NÀY (LUẬT SỐ 1). Trình duyệt đọc
 * .xlsx ra ô thô rồi gửi lên; cột nào là gì, dòng nào bỏ, tiền tính thế nào
 * đều quyết ở đây.
 */

import {
  COT, HANG_DAU_DU_LIEU, NV_CHUA_GAN,
  chuanHoaChu, khoaNhanVien, doiNgay, doiSo, gopSoBanHang,
} from "./gop-ban-hang.mjs";
import { xepLine, LINE_KHAC } from "./line.mjs";

const lamTron = x => Math.round(x * 100) / 100;

/* ─────────────── Khoá dòng — phải BỀN qua mỗi lần nhập lại ───────────────
 *
 * CLAUDE.md chốt sẵn công thức: (số chứng từ, tên hàng chuẩn hoá, lần xuất
 * hiện thứ mấy trong chứng từ). KHÔNG bao giờ dùng số thứ tự dòng trong
 * file — MISA xuất lại là số thứ tự đổi, và mọi quyết định tay sẽ trượt
 * sang dòng khác mà không ai thấy.
 *
 * "Lần xuất hiện thứ mấy" là cần thiết chứ không phải phòng xa: `BH71909`
 * có bốn dòng CÙNG tên "Chân máy giặt Đa Năng - chiều" với số lượng khác
 * nhau. Đếm theo (chứng từ, tên) nên thứ tự các dòng KHÁC tên trong đơn có
 * đảo cũng không làm lệch khoá.
 */

/* Ký tự Firebase cấm trong tên khoá. Tên hàng thật có dấu chấm và dấu gạch
 * chéo rất nhiều — 1.360/27.299 dòng của ba sổ thật (ví dụ
 * "RS57DG400EM9/S"). Thay bằng "~" chứ không bỏ đi: bỏ đi thì "A.B" và "AB"
 * thành cùng một khoá, tức gộp nhầm hai mặt hàng thành một.
 *
 * PHẢI khớp CHÍNH XÁC danh sách `kiemDuong()` cấm ở `src/firebase.js` —
 * đó là cổng THẬT sự chặn trước mỗi lượt gọi Firebase, còn hàm này chỉ là
 * lớp làm sạch ở Engine. Từng thiếu `?&%` ở đây (chỉ chặn `.#$/[]`), và
 * lộ ra thật trên sổ 2025: một ô IMEI ghi "%F1518279574 ~ %E1330129573"
 * lọt qua `deKhoa()` nguyên vẹn, rồi bị `kiemDuong()` chặn ở vòng SAU —
 * làm CẢ LƯỢT ghi `bc/imei` hỏng vì một dòng, dù chỉ một ký tự sai. */
const FIREBASE_CAM = /[.#$/[\]?&%]/g;
const DIEU_KHIEN = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Một mẩu chữ → dùng được làm khoá Firebase. */
export function deKhoa(s) {
  const t = chuanHoaChu(s);
  if (t === null) return "";
  return t.replace(FIREBASE_CAM, "~").replace(DIEU_KHIEN, "~");
}

/* Khoá Firebase tối đa 768 byte, mà tên hàng dài nhất đo được trên sổ thật
 * là 190 KÝ TỰ tiếng Việt (~400 byte) — một ô "tên hàng" bị dùng làm ô ghi
 * chú thu hồi hàng. Cắt cho ngắn lại, nhưng cắt trần thì hai tên dài khác
 * nhau trong cùng một chứng từ sẽ đụng khoá, nên ghép thêm dấu vân của TOÀN
 * BỘ tên. */
const TEN_TOI_DA = 100;

/** Dấu vân FNV-1a 32 bit, viết base36. Không phải mã hoá — chỉ để hai tên
 *  dài khác nhau không rơi vào cùng một khoá sau khi cắt. */
function vanChu(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Khoá bền của một dòng hàng. */
export function khoaDong(so_ct, ten_hang, lan) {
  const ct = deKhoa(so_ct);
  const tenDay = chuanHoaChu(ten_hang) ?? "";
  const ten = tenDay.length > TEN_TOI_DA
    ? deKhoa(tenDay.slice(0, TEN_TOI_DA)) + "-" + vanChu(tenDay)
    : deKhoa(tenDay);
  return ct + "|" + ten + "|" + lan;
}

/* ─────────────── Trích dòng hàng từ ma trận ô ─────────────── */

/** Các trường của một dòng hàng được đem ra SO khi đối chiếu file mới với
 *  file cũ. Khai tường minh thành một danh sách chứ không so cả đối tượng:
 *  thêm một trường hiển thị mới sau này không được lặng lẽ biến thành "cả
 *  nghìn dòng vừa thay đổi". */
export const TRUONG_SO_SANH = [
  "ngay", "so_ct", "ten_hang", "so_luong", "don_gia",
  "doanh_so", "chiet_khau", "nhan_vien", "imei",
];

/** Sổ chi tiết bán hàng (ma trận ô thô) → từng dòng hàng, khách, IMEI.
 *
 *  Trả về ba cây RỜI NHAU, có chủ ý theo bảng phân quyền của CLAUDE.md:
 *    · `dong`  — không một chữ nào của khách. Vào `bc/dong`.
 *    · `khach` — tên/SĐT/địa chỉ, khoá theo (KỲ, số chứng từ) — hai tầng,
 *                không phẳng — để Gateway đọc được đúng một kỳ thay vì kéo
 *                cả lịch sử. Vào `bc/khach`, nhánh đóng với MỌI vai.
 *    · `imei`  — IMEI → đơn nào, để tra bảo hành. Vào `bc/imei`, cũng đóng.
 *
 *  Dòng thiếu số chứng từ bị bỏ — CÙNG luật với `gopSoBanHang()`, và đó
 *  cũng là thứ bỏ đúng dòng `Tổng cộng` sổ tự in ở cuối. Dòng có chứng từ
 *  nhưng không đọc được ngày thì không có kỳ nào để xếp vào; nó đã được
 *  `gopSoBanHang()` kêu bằng cảnh báo `thieu-ngay`, ở đây chỉ đếm lại để
 *  hai bên không nói hai con số khác nhau. */
export function trichDongHang(bang) {
  if (!Array.isArray(bang)) throw new Error("dong-hang: can mot ma tran o");

  const dong = {};     // kỳ → { khoá → bản ghi }
  const khach = {};    // kỳ → số chứng từ → { ten, dien_thoai, dia_chi }
  const imei = {};     // imei → { so_ct, ngay, ten_hang }
  const pham_vi = {};  // kỳ → { tu, den, so_ngay, so_dong, so_don }

  const demTrongDon = new Map();   // "so_ct\x1ften" → đã gặp mấy lần
  const ngayCuaKy = new Map();     // kỳ → Set ngày
  const donCuaKy = new Map();      // kỳ → Set số chứng từ
  let dong_khong_co_ky = 0;

  for (let i = HANG_DAU_DU_LIEU - 1; i < bang.length; i++) {
    const h = bang[i];
    if (!Array.isArray(h)) continue;

    const so_ct = chuanHoaChu(h[COT.so_ct]);
    if (so_ct === null) continue;

    const t = doiNgay(h[COT.ngay]);
    if (t === null) { dong_khong_co_ky++; continue; }

    const ten_hang = chuanHoaChu(h[COT.ten_hang]) ?? "";
    const dem = so_ct + "\x1f" + ten_hang;
    const lan = (demTrongDon.get(dem) || 0) + 1;
    demTrongDon.set(dem, lan);

    const ban = doiSo(h[COT.doanh_so_ban]);
    const ck = doiSo(h[COT.chiet_khau]);
    const sl = doiSo(h[COT.so_luong]);
    const dg = doiSo(h[COT.don_gia]);
    const nv_tho = chuanHoaChu(h[COT.nhan_vien]);
    const ma_imei = chuanHoaChu(h[COT.imei]);

    const ban_ghi = {
      ngay: t.ngay,
      so_ct,
      ten_hang,
      so_luong: sl === null ? 0 : sl,
      don_gia: dg === null ? 0 : dg,
      /* Giữ NGUYÊN cột `Doanh số bán` của sổ, chưa trừ chiết khấu. Chiết
         khấu ở lại trường riêng vì chủ dự án chốt cách thể hiện: chiết khấu
         là một DÒNG riêng của đơn (mã "Chiết khấu", giá nhập 0), không phải
         một phép trừ ẩn trong dòng hàng. Xem `dungBangDon()`. */
      doanh_so: ban === null ? 0 : ban,
      chiet_khau: ck === null ? 0 : ck,
      nhan_vien: khoaNhanVien(nv_tho),
    };
    if (ma_imei) ban_ghi.imei = ma_imei;

    (dong[t.ky] ||= {})[khoaDong(so_ct, ten_hang, lan)] = ban_ghi;

    if (!ngayCuaKy.has(t.ky)) { ngayCuaKy.set(t.ky, new Set()); donCuaKy.set(t.ky, new Set()); }
    ngayCuaKy.get(t.ky).add(t.ngay);
    donCuaKy.get(t.ky).add(so_ct);

    /* Thông tin khách khoá theo SỐ CHỨNG TỪ, không theo dòng: cả đơn là của
       một khách, và lưu lặp ở từng dòng chỉ làm nhánh PII phình ra. */
    const ten_khach = chuanHoaChu(h[COT.ten_khach]);
    const dien_thoai = chuanHoaChu(h[COT.dien_thoai]);
    const dia_chi = chuanHoaChu(h[COT.dia_chi]);
    if (ten_khach || dien_thoai || dia_chi) {
      /* Khoá theo (kỳ, số chứng từ) — KHÔNG khoá thẳng theo số chứng từ như
         bản đầu. Lý do: `bc/khach` bị Gateway đọc TOÀN BỘ mỗi lần màn "Đơn
         hàng" mở một kỳ (đo trên sổ thật: 151 KB/tháng, phẳng nghĩa là con
         số đó CỘNG DỒN mãi mãi — 12 tháng đã 1,76 MB, 36 tháng 5,29 MB, đọc
         hết cho một kỳ chỉ cần một tháng). Theo kỳ thì mỗi lượt đọc luôn
         bằng đúng một tháng, không phình theo thời gian. */
      const theoKy = (khach[t.ky] ||= {});
      const k = deKhoa(so_ct);
      const cu = theoKy[k];
      theoKy[k] = {
        ten: ten_khach ?? (cu ? cu.ten : null) ?? "",
        dien_thoai: dien_thoai ?? (cu ? cu.dien_thoai : null) ?? "",
        dia_chi: dia_chi ?? (cu ? cu.dia_chi : null) ?? "",
      };
    }

    if (ma_imei) imei[deKhoa(ma_imei)] = { so_ct, ngay: t.ngay, ten_hang };
  }

  for (const ky of Object.keys(dong).sort()) {
    const ngay = [...ngayCuaKy.get(ky)].sort();
    pham_vi[ky] = {
      tu: ngay[0],
      den: ngay[ngay.length - 1],
      so_ngay: ngay.length,
      so_dong: Object.keys(dong[ky]).length,
      so_don: donCuaKy.get(ky).size,
    };
  }

  return { dong, khach, imei, pham_vi, dong_khong_co_ky };
}

/** Một lượt tải sổ: gộp tổng VÀ trích dòng trong CÙNG một lần gọi.
 *
 *  Gộp làm một hàm vì ma trận ô của sổ một tháng nặng ~0,45 MB và của sổ cả
 *  năm ~7 MB: gọi Engine hai lượt là đẩy ngần ấy dữ liệu qua Service
 *  Binding hai lần, không đổi lấy điều gì. */
export function xuLySoBanHang(bang) {
  const gop = gopSoBanHang(bang);
  const trich = trichDongHang(bang);
  return {
    tom_tat: gop.tom_tat,
    canh_bao: gop.canh_bao,
    ky: gop.ky,
    dong: trich.dong,
    khach: trich.khach,
    imei: trich.imei,
    pham_vi: trich.pham_vi,
    dong_khong_co_ky: trich.dong_khong_co_ky,
  };
}

/* ─────────────── Phạm vi ngày của dữ liệu đang có ─────────────── */

/** `bc/ky/<kỳ>` (cây nhân viên × ngày) → khoảng ngày nó đang phủ.
 *
 *  Đọc từ `bc/ky` chứ không từ `bc/dong` có chủ ý: 20 kỳ legacy
 *  (01/2025–08/2026) được nạp bằng script và KHÔNG có dòng hàng nào, nhưng
 *  vẫn có đủ ngày. Lấy phạm vi từ `bc/dong` thì chúng trông như kỳ trống và
 *  lượt tải đè lên sẽ không được canh gì cả. */
export function phamViCayKy(cayKyMotKy) {
  if (!cayKyMotKy || typeof cayKyMotKy !== "object") return null;
  const ngay = new Set();
  for (const nv of Object.keys(cayKyMotKy)) {
    const theoNgay = cayKyMotKy[nv];
    if (!theoNgay || typeof theoNgay !== "object") continue;
    for (const d of Object.keys(theoNgay)) ngay.add(d);
  }
  if (!ngay.size) return null;
  const ds = [...ngay].sort();
  return { tu: ds[0], den: ds[ds.length - 1], so_ngay: ds.length };
}

/** File mới có được phép đè lên dữ liệu đang có không.
 *
 *  Luật chủ dự án chốt: "file mới luôn phủ lên file cũ; nếu không phủ thì
 *  file không hợp lệ" — nhưng áp theo TỪNG KỲ, không áp cho cả file:
 *
 *    · kỳ trong file mới, CHƯA có dữ liệu      → ghi mới, không canh gì
 *    · kỳ trong file mới, ĐÃ có dữ liệu        → khoảng ngày của file mới
 *                                                phải bao trọn khoảng cũ
 *    · kỳ đã có dữ liệu, KHÔNG có trong file mới → không đụng tới
 *
 *  Nhờ vậy tải riêng sổ tháng 10 không xoá mất tháng 9, còn một file
 *  1/9–15/10 vẫn đè được trọn tháng 9 rồi ghi mới tháng 10. Ngược lại, một
 *  file chỉ có 16–30/9 trong khi đang có trọn tháng 9 thì BỊ TỪ CHỐI — nếu
 *  cho ghi, 1–15/9 biến mất lặng lẽ và tổng tháng tụt mà không ai biết vì
 *  sao. */
export function kiemPhuSong(phamViMoi, phamViCu) {
  const thieu = [];
  for (const ky of Object.keys(phamViMoi || {}).sort()) {
    const cu = (phamViCu || {})[ky];
    if (!cu) continue;
    const moi = phamViMoi[ky];
    if (moi.tu <= cu.tu && moi.den >= cu.den) continue;
    thieu.push({ ky, cu: { tu: cu.tu, den: cu.den }, moi: { tu: moi.tu, den: moi.den } });
  }
  return { hop_le: thieu.length === 0, thieu };
}

/* ─────────────── Đối chiếu file mới với file cũ ─────────────── */

/* Chỉ kể tối đa ngần này ví dụ cho mỗi loại thay đổi. Một kỳ mới hoàn toàn
 * sinh ra 1.607 dòng "thêm" — in hết ra màn hình thì không ai đọc, và
 * `so_luong` đã nói đủ quy mô. */
const VI_DU_TOI_DA = 50;

function khacNhau(a, b) {
  const ra = [];
  for (const truong of TRUONG_SO_SANH) {
    const x = a[truong] === undefined ? null : a[truong];
    const y = b[truong] === undefined ? null : b[truong];
    if (x !== y) ra.push(truong);
  }
  return ra;
}

/** So một kỳ: dòng cũ đang có trên Firebase ↔ dòng mới vừa trích từ file.
 *
 *  `khoaDaSua` là tập khoá dòng đã bị người sửa tay (`bc/quyetdinh/dong`).
 *  Chủ dự án chốt: dòng chưa ai động vào thì ĐÈ BÌNH THƯỜNG; dòng đã sửa
 *  tay thì KHÔNG đè, giữ nguyên bản cũ và cảnh báo riêng để người kiểm lại.
 *
 *  Dòng biến mất khỏi file mới thì XOÁ THẲNG (chủ dự án chốt) — nếu về sau
 *  nó xuất hiện lại thì coi như một dòng mới độc lập. Ngoại lệ đúng một
 *  chỗ: dòng đã sửa tay mà biến mất thì GIỮ LẠI và cảnh báo, vì xoá nó là
 *  xoá luôn một quyết định của người mà không hỏi ai.
 *
 *  Trả `cay` — cây dòng CUỐI CÙNG để ghi đè trọn kỳ. Bên gọi không phải tự
 *  trộn lại: trộn ở hai chỗ là hai chỗ trôi khỏi nhau. */
export function doiChieuKy(dongCu, dongMoi, khoaDaSua) {
  const cu = dongCu && typeof dongCu === "object" ? dongCu : {};
  const moi = dongMoi && typeof dongMoi === "object" ? dongMoi : {};
  const daSua = khoaDaSua instanceof Set ? khoaDaSua : new Set(khoaDaSua || []);

  const cay = {};
  const them = [], doi = [], mat = [], bi_khoa = [];
  let giu = 0, demThem = 0, demDoi = 0, demMat = 0, demKhoa = 0;

  for (const khoa of Object.keys(moi).sort()) {
    const b = moi[khoa];
    const a = cu[khoa];
    if (a === undefined) {
      cay[khoa] = b;
      demThem++;
      if (them.length < VI_DU_TOI_DA) them.push({ khoa, so_ct: b.so_ct, ngay: b.ngay, ten_hang: b.ten_hang });
      continue;
    }
    const lech = khacNhau(a, b);
    if (!lech.length) { cay[khoa] = b; giu++; continue; }
    if (daSua.has(khoa)) {
      /* Giữ bản CŨ — đó là bản đã mang quyết định của người. */
      cay[khoa] = a;
      demKhoa++;
      if (bi_khoa.length < VI_DU_TOI_DA) {
        bi_khoa.push({ khoa, so_ct: a.so_ct, ngay: a.ngay, ten_hang: a.ten_hang,
                       ly_do: "da-sua-tay", doi_gi: lech });
      }
      continue;
    }
    cay[khoa] = b;
    demDoi++;
    if (doi.length < VI_DU_TOI_DA) {
      const truoc = {}, sau = {};
      for (const t of lech) { truoc[t] = a[t] ?? null; sau[t] = b[t] ?? null; }
      doi.push({ khoa, so_ct: b.so_ct, ngay: b.ngay, ten_hang: b.ten_hang, doi_gi: lech, truoc, sau });
    }
  }

  for (const khoa of Object.keys(cu).sort()) {
    if (moi[khoa] !== undefined) continue;
    const a = cu[khoa];
    if (daSua.has(khoa)) {
      cay[khoa] = a;
      demKhoa++;
      if (bi_khoa.length < VI_DU_TOI_DA) {
        bi_khoa.push({ khoa, so_ct: a.so_ct, ngay: a.ngay, ten_hang: a.ten_hang,
                       ly_do: "da-sua-tay-va-bien-mat", doi_gi: [] });
      }
      continue;
    }
    demMat++;
    if (mat.length < VI_DU_TOI_DA) mat.push({ khoa, so_ct: a.so_ct, ngay: a.ngay, ten_hang: a.ten_hang });
  }

  return {
    cay,
    them, doi, mat, bi_khoa,
    tom_tat: {
      them: demThem,
      doi: demDoi,
      mat: demMat,
      bi_khoa: demKhoa,
      giu,
      tong_sau_khi_ghi: Object.keys(cay).length,
    },
  };
}

/* ─────────────── Dựng bảng đơn hàng để hiển thị ─────────────── */

/** Mã hàng quy ước cho dòng chiết khấu gộp. Là DỮ LIỆU hiển thị, không phải
 *  một mặt hàng thật trên bảng giá — P4 không được đem nó đi khớp mã. */
export const MA_CHIET_KHAU = "Chiết khấu";

/** Sáu cột chưa có nguồn ở P3. Trả `null` tường minh thay vì bỏ trường:
 *  màn hình phải hiện "—" chứ không hiện 0, vì 0 đồng và "chưa biết" là hai
 *  chuyện khác nhau (ROADMAP.md P4 — "không hiện số 0 gây hiểu nhầm"). */
function oChuaCo() {
  return { noi_nhap: null, gia_nhap: null, hang: null, nganh_hang: null, ghi_chu: null };
}

/** Dòng hàng của một kỳ → bảng đơn hàng, nhóm theo ngày rồi theo số chứng từ.
 *
 *  Chiết khấu: sổ MISA rải chiết khấu ra TỪNG DÒNG của đơn (đã thấy thật —
 *  `BH72812` có 100.000 đ ở cả hai dòng). Chủ dự án chốt cách thể hiện:
 *  cộng toàn bộ lại thành ĐÚNG MỘT dòng `Chiết khấu` cuối đơn, giá nhập 0,
 *  giá bán mang dấu âm. Nhờ vậy cộng các dòng của đơn ra đúng
 *  `Σ doanh số − Σ chiết khấu` — đúng con số `gopSoBanHang()` đưa vào
 *  `bc/ky` và đúng con số biểu đồ đang vẽ.
 *
 *  Lợi nhuận để `null` ở mọi dòng hàng thật vì giá nhập chưa có (P4). Riêng
 *  dòng chiết khấu thì biết chắc: giá nhập 0 nên lợi nhuận = chính nó. */
export function dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem) {
  const dong = dongCuaKy && typeof dongCuaKy === "object" ? dongCuaKy : {};
  const khach = khachCuaKy && typeof khachCuaKy === "object" ? khachCuaKy : {};

  const theoNgay = new Map();   // ngày → Map(số chứng từ → { dong:[], chiet_khau })

  for (const khoa of Object.keys(dong)) {
    const d = dong[khoa];
    if (!d || typeof d !== "object") continue;
    const line = xepLine(d.nhan_vien, bangLine);
    if (lineMuonXem && line !== lineMuonXem) continue;

    if (!theoNgay.has(d.ngay)) theoNgay.set(d.ngay, new Map());
    const donCuaNgay = theoNgay.get(d.ngay);
    if (!donCuaNgay.has(d.so_ct)) {
      donCuaNgay.set(d.so_ct, { dong: [], chiet_khau: 0, nhan_vien: d.nhan_vien, line });
    }
    const don = donCuaNgay.get(d.so_ct);
    don.chiet_khau = lamTron(don.chiet_khau + (Number(d.chiet_khau) || 0));
    don.dong.push({
      khoa,
      ma_san_pham: d.ten_hang,
      so_luong: Number(d.so_luong) || 0,
      gia_ban: Number(d.don_gia) || 0,
      tong_ban: Number(d.doanh_so) || 0,
      loi_nhuan: null,
      imei: d.imei ?? null,
      la_chiet_khau: false,
      ...oChuaCo(),
    });
  }

  const ngay = [];
  let doanh_so_tong = 0, so_don_tong = 0, so_dong_tong = 0;

  for (const d of [...theoNgay.keys()].sort()) {
    const donCuaNgay = theoNgay.get(d);
    const don = [];
    let ds_ngay = 0;

    for (const so_ct of [...donCuaNgay.keys()].sort()) {
      const g = donCuaNgay.get(so_ct);
      /* Sắp dòng trong đơn theo tên hàng để hai lần mở cùng một đơn ra cùng
         một thứ tự — khoá Firebase không giữ thứ tự chèn. */
      g.dong.sort((a, b) => (a.ma_san_pham < b.ma_san_pham ? -1 : a.ma_san_pham > b.ma_san_pham ? 1 : 0));

      let tong = 0;
      for (const r of g.dong) tong = lamTron(tong + r.tong_ban);
      if (g.chiet_khau) {
        g.dong.push({
          khoa: null,
          ma_san_pham: MA_CHIET_KHAU,
          so_luong: 1,
          gia_ban: -g.chiet_khau,
          tong_ban: -g.chiet_khau,
          loi_nhuan: -g.chiet_khau,
          imei: null,
          la_chiet_khau: true,
          ...oChuaCo(),
          gia_nhap: 0,
        });
        tong = lamTron(tong - g.chiet_khau);
      }

      const kh = khach[deKhoa(so_ct)] || {};
      don.push({
        so_ct,
        line: g.line,
        nhan_vien: g.nhan_vien,
        ten_khach: kh.ten || null,
        dien_thoai: kh.dien_thoai || null,
        dia_chi: kh.dia_chi || null,
        tong_ban: tong,
        loi_nhuan: null,
        dong: g.dong,
      });
      ds_ngay = lamTron(ds_ngay + tong);
      so_dong_tong += g.dong.length;
    }

    ngay.push({ ngay: d, doanh_so: ds_ngay, so_don: don.length, don });
    doanh_so_tong = lamTron(doanh_so_tong + ds_ngay);
    so_don_tong += don.length;
  }

  return {
    line: lineMuonXem || null,
    ngay,
    tom_tat: { doanh_so: doanh_so_tong, so_don: so_don_tong, so_dong: so_dong_tong },
  };
}

/** Kỳ này có những line nào, mỗi line bao nhiêu đơn — để dựng tab con.
 *
 *  Liệt kê theo `thu_tu` của bảng line (danh sách CHÍNH THỨC), không suy từ
 *  dữ liệu: một line chưa có đơn nào vẫn phải hiện ra với số 0, đúng lý do
 *  `line.mjs` khai `thu_tu` tường minh. */
export function tomTatLine(dongCuaKy, bangLine) {
  const dong = dongCuaKy && typeof dongCuaKy === "object" ? dongCuaKy : {};
  const thu_tu = bangLine && Array.isArray(bangLine.thu_tu) ? bangLine.thu_tu : [LINE_KHAC];

  const bang = {};
  for (const ten of thu_tu) bang[ten] = { doanh_so: 0, so_don: 0, so_dong: 0 };

  const donCuaLine = new Map();
  for (const khoa of Object.keys(dong)) {
    const d = dong[khoa];
    if (!d || typeof d !== "object") continue;
    const line = xepLine(d.nhan_vien, bangLine);
    const o = bang[line] || (bang[line] = { doanh_so: 0, so_don: 0, so_dong: 0 });
    o.doanh_so = lamTron(o.doanh_so + (Number(d.doanh_so) || 0) - (Number(d.chiet_khau) || 0));
    o.so_dong++;
    if (!donCuaLine.has(line)) donCuaLine.set(line, new Set());
    donCuaLine.get(line).add(d.so_ct);
  }
  for (const [line, s] of donCuaLine) bang[line].so_don = s.size;

  return { thu_tu: thu_tu.filter(t => bang[t]), line: bang };
}
