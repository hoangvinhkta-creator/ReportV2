/* SỬA TAY MỘT DÒNG HÀNG — giá nhập, nơi nhập, và xoá dòng (P5).
 *
 * ── VÌ SAO QUYẾT ĐỊNH NẰM Ở NHÁNH RIÊNG ──
 *
 * CLAUDE.md chốt: nhập lại một kỳ thì ĐÈ trọn `bc/ky`/`bc/dong`, còn chỉnh
 * sửa tay nằm nhánh riêng, KHÔNG bị đè, và được hợp nhất lúc ĐỌC. Module này
 * là phần "hợp nhất lúc đọc".
 *
 * Cách ấy cho ra đúng hành vi chủ dự án mô tả mà không phải viết thêm luật
 * nào cho nó:
 *
 *   · Tải file mới → `bc/dong` mang số liệu mới nhất của sổ (ngày, SL, giá
 *     bán — sổ MISA là sự thật về những thứ đó), còn giá nhập và nơi nhập đã
 *     sửa tay vẫn nguyên vì chúng không nằm trong nhánh bị đè.
 *   · Dòng biến mất khỏi file mới → nó biến khỏi bảng, nhưng quyết định vẫn
 *     nằm đó. Lúc nào dòng xuất hiện lại thì giá đã nhập TỰ ÁP trở lại —
 *     không phải gõ lại (chủ dự án chốt 12/09/2026).
 *
 * Trộn lúc GHI thì mất cả hai: "Engine tính ra gì" và "người quyết định gì"
 * thành một con số không nhãn, và một lượt nhập lại là xoá sạch quyết định.
 *
 * ── KHOÁ ──
 *
 * Khoá dòng đúng công thức CLAUDE.md, do `dong-hang.mjs::khoaDong()` dựng:
 * (số chứng từ, tên hàng chuẩn hoá, lần xuất hiện thứ mấy trong chứng từ).
 * Bền qua mọi lần nhập lại, và KHÔNG bao giờ là số thứ tự dòng — MISA xuất
 * lại là số thứ tự đổi, và mọi quyết định sẽ trượt sang dòng khác.
 *
 * ── QUYẾT ĐỊNH MỒ CÔI ──
 *
 * Quyết định còn đó mà không dòng nào mang khoá ấy nữa thì phải NÓI RA, kèm
 * danh sách (CLAUDE.md: "Không im lặng bỏ qua"). Nó không bị xoá — dòng có
 * thể quay lại ở lượt nhập sau.
 */

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const lamTron = (x) => Math.round((Number(x) || 0) * 100) / 100;

/** Một ô `bc/quyetdinh/dong/<kỳ>/<khoá>` có thật sự nói điều gì không.
 *
 *  Ô rỗng (mọi trường vắng) là rác còn sót, không phải một quyết định — đếm
 *  nó vào "đã sửa tay" là tô xanh một dòng chưa ai động vào. */
export function coQuyetDinh(q) {
  if (!laObj(q)) return false;
  return q.xoa === true
    || typeof q.gia_nhap === "number"
    || (typeof q.noi_nhap === "string" && q.noi_nhap.trim() !== "");
}

/** Áp quyết định sửa tay lên một bảng đơn ĐÃ điền giá vốn.
 *
 *  Thứ tự bắt buộc: `dungBangDon` → `khopMaChoBangDon` → `dienGiaNhap` →
 *  hàm này. Sửa tay là lớp CUỐI vì nó phải thắng mọi con số máy tính ra —
 *  chủ dự án chốt "sửa tay luôn thắng", vĩnh viễn tới khi chính người ấy xoá.
 *
 *  Tính lại mọi tổng bị ảnh hưởng: lợi nhuận dòng, lợi nhuận và tổng bán của
 *  đơn, doanh số và số đơn của ngày, tóm tắt cả bảng. Không tính lại là bảng
 *  có một dòng đã biến mất mà tổng vẫn cộng nó — sai êm, đúng thứ đáng sợ
 *  nhất trên một bảng tiền. */
export function apDungSuaTay(bang, quyetDinh) {
  const qd = laObj(quyetDinh) ? quyetDinh : {};
  const daDung = new Set();          // khoá nào thật sự tìm thấy dòng để áp
  let soSuaTay = 0, soXoa = 0;

  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      const giu = [];
      for (const d of don.dong) {
        /* Dòng chiết khấu không có khoá bền (nó do Engine gộp ra, không phải
           một dòng của sổ) nên không sửa tay được. */
        const q = d.khoa ? qd[d.khoa] : null;
        if (!coQuyetDinh(q)) { giu.push(d); continue; }
        daDung.add(d.khoa);

        if (q.xoa === true) { soXoa++; continue; }

        soSuaTay++;
        d.da_sua_tay = true;
        if (typeof q.gia_nhap === "number") {
          d.gia_nhap = q.gia_nhap;
          d.nguon_gia = "sua-tay";
          d.ly_do_chua_gia = null;
        }
        if (typeof q.noi_nhap === "string" && q.noi_nhap.trim() !== "") {
          d.noi_nhap = q.noi_nhap.trim();
          d.nguon_noi_nhap = "sua-tay";
        }
        giu.push(d);
      }
      don.dong = giu;
    }
    /* Đơn không còn dòng hàng thật nào thì bỏ hẳn. Giữ lại một đơn chỉ còn
       mỗi dòng chiết khấu là để một khoản trừ lơ lửng không gắn với hàng
       nào — cộng lên thành một con số âm không giải thích được. */
    ng.don = ng.don.filter((don) => don.dong.some((d) => !d.la_chiet_khau));
  }
  bang.ngay = bang.ngay.filter((ng) => ng.don.length);

  tinhLaiTong(bang);

  /* Quyết định còn đó mà không dòng nào mang khoá ấy nữa. KHÔNG xoá chúng:
     dòng có thể quay lại ở lượt nhập sau, và khi ấy giá đã nhập tự áp lại. */
  const moCoi = [];
  for (const khoa of Object.keys(qd)) {
    if (daDung.has(khoa) || !coQuyetDinh(qd[khoa])) continue;
    moCoi.push({ khoa, gia_nhap: qd[khoa].gia_nhap ?? null,
      noi_nhap: qd[khoa].noi_nhap ?? null, xoa: qd[khoa].xoa === true });
  }
  moCoi.sort((a, b) => (a.khoa < b.khoa ? -1 : a.khoa > b.khoa ? 1 : 0));

  bang.tom_tat_sua_tay = { so_sua_tay: soSuaTay, so_xoa: soXoa, mo_coi: moCoi };
  return bang;
}

/** Cộng lại mọi tổng của bảng từ chính các dòng còn lại.
 *
 *  Cộng LẠI TỪ ĐẦU chứ không trừ dần: trừ dần thì mỗi đường sửa tay phải nhớ
 *  trừ đủ bốn chỗ (đơn, ngày, tóm tắt, số đơn), và quên một chỗ là một con số
 *  lệch nằm im. Cộng lại thì chỉ có một công thức, và nó đúng theo định
 *  nghĩa. */
function tinhLaiTong(bang) {
  let dsTong = 0, donTong = 0, dongTong = 0;
  for (const ng of bang.ngay) {
    let dsNgay = 0;
    for (const don of ng.don) {
      let tong = 0, loi = 0, duLoi = true;
      for (const d of don.dong) {
        tong = lamTron(tong + (Number(d.tong_ban) || 0));
        if (d.la_chiet_khau) { loi = lamTron(loi + (Number(d.loi_nhuan) || 0)); continue; }
        /* Sửa tay giá nhập xong thì lợi nhuận dòng phải tính lại — nó là
           hàm của giá nhập, không phải một con số độc lập. */
        /* Cặp BTL đã triệt tiêu nhau: SL 0 và tiền 0 nên lợi nhuận là 0 dù
           có giá vốn hay không. Xét TRƯỚC nhánh thiếu giá bên dưới. */
        if (d.btl_thong_bao) { d.loi_nhuan = 0; }
        else if (d.gia_nhap === null || d.gia_nhap === undefined) { d.loi_nhuan = null; duLoi = false; }
        /* Dòng BTL không truy ra được số tiền trả lại: xem `btl.mjs`. Công
           thức chung ở đây cho ra một số DƯƠNG, tức một lượt trả hàng làm
           tăng lãi — cùng lý do với nhánh tương ứng ở `khop-ma.mjs`. */
        else if (d.btl_chua_ro_tien) { d.loi_nhuan = null; duLoi = false; }
        else d.loi_nhuan = lamTron(Number(d.tong_ban) - d.gia_nhap * (Number(d.so_luong) || 0));
        if (d.loi_nhuan === null) duLoi = false;
        else loi = lamTron(loi + d.loi_nhuan);
      }
      don.tong_ban = tong;
      don.loi_nhuan = duLoi ? loi : null;
      dsNgay = lamTron(dsNgay + tong);
      dongTong += don.dong.length;
    }
    ng.doanh_so = dsNgay;
    ng.so_don = ng.don.length;
    dsTong = lamTron(dsTong + dsNgay);
    donTong += ng.don.length;
  }
  bang.tom_tat = { doanh_so: dsTong, so_don: donTong, so_dong: dongTong };
}

/* ═════════ TRỪ DÒNG ĐÃ XOÁ RA KHỎI `bc/ky` ═════════
 *
 * Chủ dự án chốt 12/09/2026: xoá một dòng thì trừ ở CẢ HAI — bảng đơn và
 * biểu đồ. Hai chỗ đọc hai nhánh khác nhau (`bc/dong` và `bc/ky`), nên nếu
 * chỉ trừ một bên thì hai màn hình nói hai con số khác nhau cho cùng một
 * tháng, và không ai biết bên nào đúng.
 *
 * `bc/ky` là số ĐÃ TÍNH SẴN lúc nạp sổ. Không nạp lại nó — nạp lại là để một
 * quyết định của người biến thành một con số không nhãn trong nhánh dữ liệu
 * thô. Thay vào đó tính phần phải TRỪ, rồi trừ lúc đọc.
 */

/** Phần phải trừ khỏi `bc/ky/<kỳ>`, gom theo (nhân viên đã khoá, ngày).
 *
 *  `khoaNv` là `khoaNhanVien` của `gop-ban-hang.mjs` — truyền vào chứ không
 *  import, để module này không kéo theo cả bộ đọc sổ chỉ vì một hàm khoá.
 *
 *  Doanh số của một dòng = `doanh_so − chiết khấu`, đúng `LUAT_DOANH_SO`
 *  đang bật (`tru-chiet-khau`). Dùng công thức khác ở đây là trừ một con số
 *  không cùng thang với con số đang nằm trong `bc/ky`.
 *
 *  SỐ ĐƠN chỉ giảm khi MỌI dòng của chứng từ ấy (trong cùng nhân viên, cùng
 *  ngày) đều bị xoá. Trừ một đơn vì mất một dòng là đếm thiếu đơn — đơn vẫn
 *  còn đó với những dòng khác. */
export function tinhTruDaXoa(dongCuaKy, quyetDinh, khoaNv) {
  const dong = laObj(dongCuaKy) ? dongCuaKy : {};
  const qd = laObj(quyetDinh) ? quyetDinh : {};

  const tru = {};                      // nv → ngày → { doanh_so, so_don }
  const conLai = new Map();            // nv|ngày|số ct → còn dòng nào không
  const daXoaCt = new Map();           // nv|ngày|số ct → có dòng nào bị xoá không

  for (const khoa of Object.keys(dong)) {
    const d = dong[khoa];
    if (!laObj(d)) continue;
    const nv = khoaNv(d.nhan_vien);
    const ct = nv + "\x1f" + d.ngay + "\x1f" + d.so_ct;
    const biXoa = laObj(qd[khoa]) && qd[khoa].xoa === true;

    if (biXoa) {
      daXoaCt.set(ct, true);
      const o = (tru[nv] ||= {})[d.ngay] ||= { doanh_so: 0, so_don: 0 };
      o.doanh_so = lamTron(o.doanh_so
        + (Number(d.doanh_so) || 0) - (Number(d.chiet_khau) || 0));
    } else {
      conLai.set(ct, true);
    }
  }

  for (const ct of daXoaCt.keys()) {
    if (conLai.has(ct)) continue;      // chứng từ vẫn còn dòng khác — đơn vẫn tính
    const [nv, ngay] = ct.split("\x1f");
    ((tru[nv] ||= {})[ngay] ||= { doanh_so: 0, so_don: 0 }).so_don += 1;
  }
  return tru;
}

/** Trừ phần đã tính vào một cây `bc/ky` nhiều kỳ, trả về cây MỚI.
 *
 *  KHÔNG sửa tại chỗ: cây đầu vào là thứ Gateway vừa đọc từ Firebase và có
 *  thể còn dùng cho việc khác trong cùng lượt gọi. Sửa tại chỗ một cấu trúc
 *  dùng chung là loại lỗi chỉ hiện ra khi có người thêm chỗ gọi thứ hai.
 *
 *  `truTheoKy` = `{ "<kỳ>": <kết quả tinhTruDaXoa> }`. Kỳ không có quyết
 *  định nào thì không có mặt, và khi ấy cây của kỳ đó đi qua nguyên vẹn. */
export function truVaoCayKy(cayKy, truTheoKy) {
  const cay = laObj(cayKy) ? cayKy : {};
  const tru = laObj(truTheoKy) ? truTheoKy : {};
  if (!Object.keys(tru).length) return cay;

  const ra = {};
  for (const ky of Object.keys(cay)) {
    const tKy = tru[ky];
    if (!laObj(tKy)) { ra[ky] = cay[ky]; continue; }
    const nvCu = laObj(cay[ky]) ? cay[ky] : {};
    const nvMoi = {};
    for (const nv of Object.keys(nvCu)) {
      const ngayCu = laObj(nvCu[nv]) ? nvCu[nv] : {};
      const tNv = laObj(tKy[nv]) ? tKy[nv] : {};
      const ngayMoi = {};
      for (const ngay of Object.keys(ngayCu)) {
        const o = ngayCu[ngay];
        const t = tNv[ngay];
        if (!laObj(o) || !laObj(t)) { ngayMoi[ngay] = o; continue; }
        const ds = lamTron((Number(o.doanh_so) || 0) - t.doanh_so);
        const sd = (Number(o.so_don) || 0) - t.so_don;
        /* Ô cạn sạch (mọi dòng của nhân viên ấy trong ngày ấy đều bị xoá)
           thì BỎ HẲN ô, không để lại một ô 0 đồng / 0 đơn. Một ô 0 đọc lên
           là "hôm ấy có đi làm mà không bán được gì" — khác hẳn "hôm ấy
           không còn dòng nào". */
        if (sd <= 0 && ds <= 0) continue;
        ngayMoi[ngay] = { ...o, doanh_so: ds, so_don: Math.max(0, sd) };
      }
      if (Object.keys(ngayMoi).length) nvMoi[nv] = ngayMoi;
    }
    ra[ky] = nvMoi;
  }
  return ra;
}
