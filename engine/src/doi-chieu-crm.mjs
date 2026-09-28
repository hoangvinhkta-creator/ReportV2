/* ĐỐI CHIẾU ĐƠN CRM ↔ SỔ BÁN HÀNG — chủ dự án chốt 28/09/2026.
 *
 * Việc của file này: cầm bảng đơn Engine đã dựng xong (mọi lớp — khớp mã,
 * giá vốn, sửa tay — đã áp) và các đơn CRM Gateway vừa đọc về, rồi đặt lên
 * từng dòng một cờ "CRM nói gì, sổ nói gì, có khớp không". Không đổi một con
 * số nào của bảng: "sổ nói gì" và "CRM nói gì" là hai con số có nhãn, không
 * bao giờ trộn thành một (cùng luật CLAUDE.md đặt cho sửa tay).
 *
 * Vì sao cần: giá nhập bên CRM là số NHÂN VIÊN TỰ GÕ, còn giá nhập bên sổ là
 * số Report tra từ Tracking (hoặc người sửa tay). Hai con số ấy lệch nhau
 * thì hoặc nhân viên khai sai, hoặc thuật toán của Report chạy sai — cả hai
 * đều đáng một người nhìn vào.
 *
 * Những câu trả lời chủ dự án chốt trước khi viết (28/09/2026):
 *
 *   1. Hai đơn tìm nhau bằng SỐ BH — `orders/<id>.misa` bên CRM là đúng số
 *      chứng từ MISA mà sổ ghi. Trong một đơn, dòng tìm nhau bằng MÃ BẢNG
 *      GIÁ; dòng sổ chưa có mã thì bằng TÊN HÀNG MISA. Không ghép được là
 *      một cảnh báo riêng, KHÔNG đoán. Cùng một mã nhiều dòng thì cộng SL
 *      lại rồi mới so.
 *   2. So cả giá nhập, kể cả lệch vài nghìn — đó chính là thứ cần bắt.
 *   3. Lệch là lệch TUYỆT ĐỐI, không có ngưỡng dung sai.
 *   4. Chiết khấu cả đơn bên CRM so với dòng "Chiết khấu" riêng của sổ —
 *      hai thứ ấy là một.
 *   5. Đối chiếu CHÉO: sổ có mà CRM không, và CRM có mà sổ không.
 */
import { chuanHoaChu } from "./gop-ban-hang.mjs";
import { kyCoGiaVon } from "./khop-ma.mjs";

/** Kỳ đầu tiên được đối chiếu. Trường `misa` bên CRM chỉ tự điền từ Đợt 9
 *  của CRM (09/2026, chứng từ đầu tiên đo được là BH74545). Đối chiếu một kỳ
 *  cũ hơn thì MỌI đơn đều "không có bên CRM" — đúng chữ, nhưng là một danh
 *  sách hàng trăm cảnh báo không ai làm gì được. */
export const MOC_DOI_CHIEU_CRM = "2026-09";

/** Dạng số chứng từ CRM chấp nhận — cùng regex `misaOnResult()` bên CRM
 *  dùng để từ chối mã sai dạng. Chứng từ khác dạng (BTL, phiếu khác) không
 *  bao giờ đi ra từ CRM, nên không có gì để đối chiếu. */
const LA_SO_BH = /^BH(\d+)$/;

/** Hai số BH cách nhau quá khoảng này thì tách thành hai lượt tra. Một số BH
 *  gõ nhầm (BH1) kéo khoảng [BH1, BH74999] là kéo về cả CRM. */
const KHOANG_CACH_TOI_DA = 500;

/** Giờ Việt Nam lệch UTC 7 tiếng, không có giờ mùa hè. */
const LECH_VN_MS = 7 * 3600 * 1000;

export function kyCoDoiChieuCrm(ky) {
  return typeof ky === "string" && /^\d{4}-\d{2}$/.test(ky) && ky >= MOC_DOI_CHIEU_CRM;
}

/* ─────────────── Kế hoạch tra CRM ─────────────── */

/** Gateway phải tra những gì bên CRM cho kỳ này.
 *
 *  Nhận `bc/dong/<kỳ>` (đối tượng) HOẶC danh sách khoá của nó (lượt đọc
 *  nông — lượt hỏi định kỳ không kéo cả 390 KB về chỉ để biết số BH). Khoá
 *  dòng bắt đầu bằng số chứng từ rồi tới `|` (`khoaDong`), và số BH không
 *  chứa ký tự nào bị `deKhoa` thay, nên đọc thẳng được từ khoá.
 *
 *  Trả:
 *   · `khoang` — các cặp [BH đầu, BH cuối] để tra `orderBy="misa"`. Tách
 *     theo SỐ CHỮ SỐ trước: Firebase so chuỗi, nên "BH100000" đứng TRƯỚC
 *     "BH99999" và một khoảng trộn hai độ dài là một khoảng rỗng.
 *   · `tu`/`den` — mốc ms của tháng theo giờ VN, để tra đơn CRM có ngày giao
 *     trong kỳ (chiều "CRM có mà sổ không" cần cả những đơn có số BH nằm
 *     ngoài mọi khoảng trên, lẫn những đơn chưa có số BH nào). */
export function keHoachCrm(dongHoacKhoa, ky) {
  if (!kyCoDoiChieuCrm(ky)) return { co: false, khoang: [], tu: null, den: null };
  const khoa = Array.isArray(dongHoacKhoa) ? dongHoacKhoa
    : (dongHoacKhoa && typeof dongHoacKhoa === "object" ? Object.keys(dongHoacKhoa) : []);

  const theoDoDai = new Map();   // số chữ số → [số]
  for (const k of khoa) {
    const ct = String(k).split("|")[0];
    const m = LA_SO_BH.exec(ct);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isSafeInteger(n)) continue;
    if (!theoDoDai.has(m[1].length)) theoDoDai.set(m[1].length, new Set());
    theoDoDai.get(m[1].length).add(n);
  }

  const khoang = [];
  for (const [doDai, tap] of [...theoDoDai].sort((a, b) => a[0] - b[0])) {
    const ds = [...tap].sort((a, b) => a - b);
    const viet = (n) => "BH" + String(n).padStart(doDai, "0");
    let dau = ds[0], truoc = ds[0];
    for (let i = 1; i <= ds.length; i++) {
      const n = ds[i];
      if (i === ds.length || n - truoc > KHOANG_CACH_TOI_DA) {
        khoang.push([viet(dau), viet(truoc)]);
        dau = n;
      }
      truoc = n;
    }
  }

  const [nam, thang] = ky.split("-").map(Number);
  const tu = Date.UTC(nam, thang - 1, 1) - LECH_VN_MS;
  const den = Date.UTC(nam, thang, 1) - LECH_VN_MS - 1;
  return { co: true, khoang, tu, den };
}

/* ─────────────── Đọc một đơn CRM ─────────────── */

/** Tiền bên CRM lưu theo NGHÌN đồng (`misaDong()` bên CRM nhân 1.000 trước
 *  khi gõ vào MISA). Sổ và Report tính bằng đồng. */
const dongTuNghin = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) : 0;
};

/** Dòng hàng của một đơn CRM — bản sao ĐÚNG luật `ordLines()` bên CRM,
 *  gồm cả dạng đơn cũ một-mặt-hàng không có mảng `lines`. Lệch luật này là
 *  đọc một đơn khác với cái CRM đang hiện cho nhân viên. */
function dongCrm(od) {
  if (Array.isArray(od.lines) && od.lines.length) return od.lines.filter((l) => l && typeof l === "object");
  if (od.lines && typeof od.lines === "object" && !Array.isArray(od.lines)) {
    /* Firebase trả mảng thưa thành đối tượng khoá số. */
    const ds = Object.keys(od.lines).sort((a, b) => Number(a) - Number(b))
      .map((k) => od.lines[k]).filter((l) => l && typeof l === "object");
    if (ds.length) return ds;
  }
  const qty = Number(od.qty) || 0;
  return [{
    item: od.item || "",
    qty: qty || 1,
    unitPrice: Number(od.unitPrice) || (qty ? Math.round((Number(od.price) || 0) / qty) : Number(od.price)) || 0,
    unitCost: Number(od.unitCost) || (qty ? Math.round((Number(od.costPrice) || 0) / qty) : Number(od.costPrice)) || 0,
  }];
}

const chuanMa = (s) => {
  const t = chuanHoaChu(s);
  return t ? t.toUpperCase().replace(/\s+/g, "") : null;
};
const chuanTen = (s) => {
  const t = chuanHoaChu(s);
  return t ? t.toLowerCase() : null;
};

/** Ngày dd/mm/yyyy theo giờ VN của một mốc ms — cùng thứ CRM gõ vào ô
 *  "Ngày hạch toán" của MISA (`fmtDay(expectDeliver || created)`). */
function ngayVN(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n + LECH_VN_MS);
  const p = (x) => String(x).padStart(2, "0");
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
}

function docDonCrm(id, od, nguoi) {
  const dong = dongCrm(od).map((l) => ({
    ma: chuanHoaChu(l.item) || "",
    ma_chuan: chuanMa(l.item),
    ten_chuan: chuanTen(l.misaName),
    sl: Number(l.qty) || 0,
    gia_ban: dongTuNghin(l.unitPrice),
    /* 0 hay rỗng = nhân viên KHÔNG khai giá nhập. Giữ `null` để nó thành
       "thiếu", không thành "giá nhập bằng 0" — hai chuyện khác nhau. */
    gia_nhap: Number(l.unitCost) > 0 ? dongTuNghin(l.unitCost) : null,
  }));
  return {
    id,
    so_bh: typeof od.misa === "string" ? od.misa.trim().toUpperCase() : "",
    nguoi: (nguoi && nguoi[od.owner]) || od.owner || null,
    trang_thai: od.status || null,
    huy: od.status === "cancel",
    ngay: ngayVN(od.expectDeliver || od.created),
    chiet_khau: dongTuNghin(od.discount),
    dong,
  };
}

/* ─────────────── So sánh ─────────────── */

/** Tiền làm tròn tới xu để so. Sổ có dòng không chẵn đồng (4.090.909,09 đ
 *  — giá tính ngược từ giá gồm VAT); so số thực trần thì một phép cộng dồn
 *  lệch ở chữ số thứ mười lăm cũng thành "lệch". */
const xu = (v) => Math.round((Number(v) || 0) * 100);

/** So hai nhóm (một bên sổ, một bên CRM) cùng một mặt hàng trong một đơn.
 *  Mỗi bên: { sl, ban (xu, Σ SL×đơn giá), nhap (xu) | null }.
 *
 *  Đơn giá so bằng NHÂN CHÉO chứ không chia: `ban_A × sl_B = ban_B × sl_A`.
 *  Chia ra bình quân là đẻ số lẻ vô hạn (100.000 ÷ 3), và "bằng tuyệt đối"
 *  trên một số lẻ vô hạn là so hai lần làm tròn chứ không so hai con số. */
function soNhom(r, c) {
  const soDonGia = (a, b) => {
    if (a.sl === 0 || b.sl === 0) return a.tien === b.tien;
    return a.tien * b.sl === b.tien * a.sl;
  };
  const donGia = (x) => (x.sl ? Math.round(x.tien / x.sl) / 100 : x.tien / 100);

  const sl = { tt: r.sl === c.sl ? "khop" : "lech", report: r.sl, crm: c.sl };
  const gia_ban = {
    tt: soDonGia({ sl: r.sl, tien: r.ban }, { sl: c.sl, tien: c.ban }) ? "khop" : "lech",
    report: donGia({ sl: r.sl, tien: r.ban }), crm: donGia({ sl: c.sl, tien: c.ban }),
  };
  let gia_nhap;
  if (r.nhap === null || c.nhap === null) {
    gia_nhap = { tt: "thieu",
      report: r.nhap === null ? null : donGia({ sl: r.sl, tien: r.nhap }),
      crm: c.nhap === null ? null : donGia({ sl: c.sl, tien: c.nhap }) };
  } else {
    gia_nhap = {
      tt: soDonGia({ sl: r.sl, tien: r.nhap }, { sl: c.sl, tien: c.nhap }) ? "khop" : "lech",
      report: donGia({ sl: r.sl, tien: r.nhap }), crm: donGia({ sl: c.sl, tien: c.nhap }),
    };
  }
  return { sl, gia_nhap, gia_ban };
}

function cong(ds, laSo) {
  const g = { sl: 0, ban: 0, nhap: 0 };
  for (const x of ds) {
    const sl = Number(laSo ? x.so_luong : x.sl) || 0;
    const gb = Number(x.gia_ban) || 0;
    const gn = x.gia_nhap;
    g.sl += sl;
    g.ban += xu(gb * sl);
    if (g.nhap !== null) {
      if (gn === null || gn === undefined || !Number.isFinite(Number(gn))) g.nhap = null;
      else g.nhap += xu(Number(gn) * sl);
    }
  }
  return g;
}

/** Ghép dòng sổ với dòng CRM của MỘT đơn. Đặt `d.crm` lên từng dòng sổ và
 *  trả những dòng CRM không tìm được đôi.
 *
 *  Hai lượt, đúng thứ tự chủ dự án chốt: mã bảng giá trước, tên hàng MISA
 *  sau cho phần còn lại. Cả hai đều là phép BẰNG sau chuẩn hoá — không so
 *  gần đúng, không chứa nhau. */
function ghepDong(dongSo, dongCrmDs, coGiaNhap) {
  const conCrm = dongCrmDs.map((c, i) => ({ c, i, dung: false }));
  const conSo = [];

  const gan = (nhomSo, nhomCrm) => {
    const r = cong(nhomSo, true);
    const c = cong(nhomCrm.map((x) => x.c), false);
    if (!coGiaNhap) r.nhap = null;
    const kq = soNhom(r, c);
    if (!coGiaNhap) kq.gia_nhap = { tt: "bo_qua", report: null, crm: kq.gia_nhap.crm };
    for (const d of nhomSo) d.crm = kq;
    for (const x of nhomCrm) x.dung = true;
  };

  /* Lượt 1 — mã bảng giá. */
  const theoMa = new Map();
  for (const d of dongSo) {
    const m = chuanMa(d.ma_bang_gia);
    if (!m) { conSo.push(d); continue; }
    if (!theoMa.has(m)) theoMa.set(m, []);
    theoMa.get(m).push(d);
  }
  for (const [m, nhom] of theoMa) {
    const khop = conCrm.filter((x) => !x.dung && x.c.ma_chuan === m);
    if (khop.length) gan(nhom, khop);
    else conSo.push(...nhom);
  }

  /* Lượt 2 — tên hàng MISA, chỉ cho phần chưa ghép được. */
  const theoTen = new Map();
  const conLai = [];
  for (const d of conSo) {
    const t = chuanTen(d.ma_san_pham);
    if (!t) { conLai.push(d); continue; }
    if (!theoTen.has(t)) theoTen.set(t, []);
    theoTen.get(t).push(d);
  }
  for (const [t, nhom] of theoTen) {
    const khop = conCrm.filter((x) => !x.dung && x.c.ten_chuan === t);
    if (khop.length) gan(nhom, khop);
    else conLai.push(...nhom);
  }

  for (const d of conLai) d.crm = { tt: "chi_report" };
  return conCrm.filter((x) => !x.dung).map((x) => ({
    ma: x.c.ma, sl: x.c.sl, gia_ban: x.c.gia_ban, gia_nhap: x.c.gia_nhap,
  }));
}

const laLech = (o) => o && o.tt !== "khop" && o.tt !== "bo_qua";

/** Đặt cờ đối chiếu CRM lên bảng đơn.
 *
 *  `crm` = { don: { <id>: đơn CRM đã lọc trường }, nguoi: { <id>: tên } } —
 *  Gateway đọc về, KHÔNG kèm tên/SĐT/địa chỉ khách của CRM.
 *  `tuyChon.co_gia_nhap` = kỳ này sổ có giá nhập thật (có giá vốn theo ngày
 *  VÀ Tracking trả lời lượt này). Không có thì cột giá nhập "bỏ qua" chứ
 *  không "thiếu": một sự cố mạng bên Tracking không được biến cả tháng thành
 *  cảnh báo nhân viên khai sai.
 *
 *  Trả chính `bang`, thêm:
 *   · `don.crm` — { tt: khop|lech|khong_co_crm, id, nguoi, trang_thai, huy,
 *     trung, chiet_khau, chi_crm } cho mọi đơn số BH;
 *   · `dong.crm` — { sl, gia_nhap, gia_ban } mỗi cái { tt, report, crm }
 *     (tt: khop | lech | thieu | bo_qua), hoặc { tt: "chi_report" } khi dòng
 *     không có bên CRM, hoặc { tt: "btl" } cho dòng dính bán trả lại;
 *   · `bang.crm` — tổng kết, và ở tab [Tổng hợp] thêm hai danh sách chiều
 *     ngược: đơn CRM không có trên sổ, và đơn CRM đã giao chưa có số BH. */
export function doiChieuCrm(bang, crm, ky, tuyChon) {
  if (!bang || !Array.isArray(bang.ngay)) return bang;
  if (!kyCoDoiChieuCrm(ky)) return bang;
  const coGiaNhap = !!(tuyChon && tuyChon.co_gia_nhap) && kyCoGiaVon(ky);

  const donTho = crm && crm.don && typeof crm.don === "object" ? crm.don : {};
  const nguoi = crm && crm.nguoi && typeof crm.nguoi === "object" ? crm.nguoi : {};

  /* Số BH → đơn CRM. Hai đơn CRM cùng một số BH là chính CRM đang sai (nó
     có chốt chặn, nhưng chốt ở trình duyệt) — đánh dấu `trung`, không chọn
     bừa một đơn rồi im. */
  const theoBh = new Map();
  const tatCa = [];
  for (const id of Object.keys(donTho).sort()) {
    const od = donTho[id];
    if (!od || typeof od !== "object") continue;
    const d = docDonCrm(id, od, nguoi);
    tatCa.push(d);
    if (!LA_SO_BH.test(d.so_bh)) continue;
    if (!theoBh.has(d.so_bh)) theoBh.set(d.so_bh, []);
    theoBh.get(d.so_bh).push(d);
  }

  /* Gom đơn sổ theo số BH TRƯỚC khi so: một chứng từ có dòng rải hai ngày
     thì bảng tách thành hai "đơn", mà CRM chỉ có một. So từng nửa là báo lệch
     SL cho một đơn hoàn toàn khớp. */
  const donSo = new Map();
  for (const ng of bang.ngay) {
    for (const don of ng.don || []) {
      if (!LA_SO_BH.test(String(don.so_ct || ""))) continue;
      if (!donSo.has(don.so_ct)) donSo.set(don.so_ct, []);
      donSo.get(don.so_ct).push(don);
    }
  }

  let so_don_khop = 0, so_don_lech = 0, so_don_khong_co_crm = 0;
  for (const [soBh, dsDon] of donSo) {
    const dsCrm = theoBh.get(soBh) || [];
    if (!dsCrm.length) {
      for (const don of dsDon) don.crm = { tt: "khong_co_crm" };
      so_don_khong_co_crm++;
      continue;
    }
    const c = dsCrm[0];
    const moiDong = dsDon.flatMap((don) => don.dong || []);
    const dongHang = [];
    let ckSo = 0;
    for (const d of moiDong) {
      if (d.la_chiet_khau) { ckSo += -(Number(d.gia_ban) || 0); continue; }
      /* Dòng dính bán trả lại: sổ đã sửa SL của nó về 0 hoặc −1, nên nó
         không còn nói về lượt bán CRM ghi nữa. Không so, không kể là lệch. */
      if (d.btl_trang_thai) { d.crm = { tt: "btl" }; continue; }
      dongHang.push(d);
    }
    const chi_crm = ghepDong(dongHang, c.dong, coGiaNhap);

    const ck = { tt: xu(ckSo) === xu(c.chiet_khau) ? "khop" : "lech",
      report: ckSo, crm: c.chiet_khau };
    for (const d of moiDong) if (d.la_chiet_khau) d.crm = { gia_ban: ck };

    const lech = c.huy || dsCrm.length > 1 || chi_crm.length > 0 || ck.tt !== "khop"
      || dongHang.some((d) => d.crm.tt === "chi_report"
        || laLech(d.crm.sl) || laLech(d.crm.gia_nhap) || laLech(d.crm.gia_ban));
    const ketQua = {
      tt: lech ? "lech" : "khop",
      id: c.id, nguoi: c.nguoi, trang_thai: c.trang_thai, huy: c.huy,
      trung: dsCrm.length > 1 ? dsCrm.map((x) => x.id) : null,
      chiet_khau: ck, chi_crm,
    };
    for (const don of dsDon) don.crm = ketQua;
    if (lech) so_don_lech++; else so_don_khop++;
  }

  const tomTat = { so_don_khop, so_don_lech, so_don_khong_co_crm };

  /* Chiều ngược chỉ có nghĩa ở bảng CẢ KỲ. Ở tab một line, một đơn CRM
     không có trong bảng có thể chỉ là đơn của line khác — mà CRM không biết
     line, nên không có cách nào lọc cho đúng. */
  if (bang.line === null || bang.line === undefined) {
    const chi_crm = [], chua_bh = [];
    for (const d of tatCa) {
      if (d.huy) continue;
      const tong = d.dong.reduce((a, x) => a + x.gia_ban * x.sl, 0) - d.chiet_khau;
      const gon = { id: d.id, so_bh: d.so_bh || null, nguoi: d.nguoi, ngay: d.ngay,
        trang_thai: d.trang_thai, tong,
        dong: d.dong.map((x) => ({ ma: x.ma, sl: x.sl, gia_ban: x.gia_ban, gia_nhap: x.gia_nhap })) };
      if (LA_SO_BH.test(d.so_bh)) {
        if (!donSo.has(d.so_bh)) chi_crm.push(gon);
      } else if (d.trang_thai === "done") {
        chua_bh.push(gon);
      }
    }
    const theoSo = (a, b) => (a.so_bh || "").localeCompare(b.so_bh || "") || a.id.localeCompare(b.id);
    tomTat.chi_crm = chi_crm.sort(theoSo);
    tomTat.chua_bh = chua_bh.sort(theoSo);
  }

  bang.crm = tomTat;
  return bang;
}
