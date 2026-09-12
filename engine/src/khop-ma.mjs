/* KHỚP TÊN HÀNG TRÊN SỔ BÁN → MÃ TRÊN BẢNG GIÁ TRACKING.
 *
 * Đây là chỗ bài toán khớp tên hàng thật sự chạm vào lần đầu (CLAUDE.md, mục
 * "Khớp mã hàng" — chỉ từ P4, không sớm hơn). Sổ MISA KHÔNG có cột mã hàng:
 * thứ duy nhất nó nói về một mặt hàng là `ten_hang`, một câu văn xuôi kế toán
 * dài tới 190 ký tự. Nên mọi con đường đi từ một dòng sổ tới giá vốn đều phải
 * đi qua module này.
 *
 * ── BỐN BẬC, DỪNG Ở BẬC ĐẦU TIÊN CÓ CÂU TRẢ LỜI ──
 *
 *   1. `inv/map/<khoá>` là một mã   ⟹ QUYẾT ĐỊNH CỦA NGƯỜI, dùng luôn
 *   2. `inv/map/<khoá>` là `"-"`    ⟹ người đã nói "không phải sản phẩm"
 *   3. khớp cụm trọn trong tên      ⟹ TỰ ĐỘNG, và chỉ khi ra ĐÚNG MỘT mã
 *   4. 0 mã, hoặc ≥2 mã             ⟹ HÀNG CHỜ cho người gán tay
 *
 * Quyết định của người LUÔN thắng máy, kể cả `"-"`. Bậc 1 và 2 đọc chính
 * nhánh `inv/map` mà màn Tồn kho và PHB-01 của Tracking đang ghi — một bản đồ
 * nhận dạng dùng chung, không phải bản thứ hai của riêng Báo cáo.
 *
 * ── VÌ SAO KHỚP THEO TỪ CHỨ KHÔNG SO CẢ CÂU ──
 *
 * Chủ dự án chốt 12/09/2026, sau khi được hỏi thẳng giữa hai cách. So cả câu
 * thì an toàn tuyệt đối nhưng vô dụng: `"Chân máy giặt Đa Năng - chiều"` (câu
 * THẬT trên sổ) không bao giờ bằng một mã trần kiểu `"SJ-X198V-DG"`. Nên khớp
 * theo TỪ — nhưng là cụm từ TRỌN VẸN, liên tiếp.
 *
 * Điều này vượt một dòng CLAUDE.md từng ghi ("không rút mã từ tên"); chủ dự án
 * đã duyệt tường minh việc vượt, và dòng đó đã được sửa lại cho khớp thực tế.
 * Cái KHÔNG đổi là phần còn lại của kỷ luật ấy: không so gần đúng, không
 * Levenshtein, không "chắc là cái này".
 *
 * ── CHỖ DỄ HỎNG NHẤT, VÀ CÁCH NÓ ĐƯỢC CHẶN ──
 *
 * `65C6K` và `65C6KS` là HAI MÃ KHÁC NHAU (ca chủ dự án nêu đích danh). Dò
 * chuỗi con thì `"65C6KS"` chứa `"65C6K"` và một chiếc tivi bị gán sang model
 * khác — sai tiền, im lặng. Nên phép khớp chạy trên BIÊN TỪ: câu được cắt
 * thành từ trước, rồi so cả TOKEN. `[TIVI, TCL, 65C6KS]` không chứa token
 * `65C6K`, hết chuyện.
 *
 * Đây cũng là lý do `chuanTu()` (bỏ dấu về chữ gốc, ký tự lạ thành KHOẢNG
 * TRẮNG) tách hẳn khỏi `maHoa()` (xoá sạch ký tự lạ, không còn biên từ nào).
 * Dùng nhầm `maHoa()` cho phép khớp là mở lại đúng cửa dò chuỗi con.
 */

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Kỳ ĐẦU TIÊN có khớp mã và giá vốn. Trước mốc này KHÔNG khớp gì cả.
 *
 *  Chủ dự án chốt 12/09/2026, và nó trùng đúng một giới hạn dữ liệu thật:
 *  `min_ngay` của Tracking chỉ có bản ghi ổn định từ khoảng 07/09/2026 (cron
 *  20 phút/lượt bắt đầu quãng đó). Kỳ trước mốc KHÔNG có giá vốn theo ngày để
 *  đối chiếu — không phải việc chưa làm, là giới hạn của chính nguồn.
 *
 *  Nên với những kỳ ấy, hỏi "còn bao nhiêu dòng chưa có mã" là một câu hỏi vô
 *  nghĩa: gán xong cũng không ra được đồng giá vốn nào. Băng cảnh báo ở đó chỉ
 *  mời người ta làm một việc không dùng được. */
export const MOC_KHOP_MA = "2026-09";

/** Kỳ này có nằm trong phạm vi khớp mã / giá vốn không. */
export const kyCoKhopMa = (ky) => typeof ky === "string" && ky >= MOC_KHOP_MA;

/* Chuẩn hoá để TRA KHOÁ `inv/map`. Phải giống HỆT `normCode()` của Tracking
 * (`public/index.html`) và bản máy chủ trong `src/index.js` bên đó — lệch một
 * ký tự là quyết định gán tay rơi vào một ô khác ô Tracking đang đọc, và không
 * ai biết cho tới lúc giá vốn sai.
 *
 * Chú ý nết đặc thù: hàm này KHÔNG quy dấu tiếng Việt về chữ gốc, nó XOÁ HẲN
 * mọi ký tự ngoài A-Z0-9 — "Tủ lạnh" ra `TLNH` chứ không phải `TULANH`. Trông
 * như khiếm khuyết nhưng đây là hợp đồng ĐANG CHẠY THẬT bên Tracking; sửa cho
 * "đẹp hơn" là mất sạch mọi quyết định phân loại đã lưu.
 *
 * `POST /api/inv-map` của Tracking dội lại khoá do CHÍNH nó tính, nên Gateway
 * đối chiếu được khoá bên này với khoá bên kia ngay ở lượt ghi đầu — một bản
 * lệch lộ ra lúc đó, không phải lúc tiền đã sai. */
const maHoa = (c) => String(c == null ? "" : c).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Khoá tra `inv/map` của một câu tên hàng. */
export const khoaTenHang = (ten) => "N_" + maHoa(ten).slice(0, 80);

/* Chuẩn hoá để CẮT TỪ — khác hẳn `maHoa()` ở trên và khác có chủ đích. Dấu
 * tiếng Việt quy về chữ gốc, MỌI ký tự không phải chữ-số thành một khoảng
 * trắng. Nhờ vậy "SJ-X198V-DG" tách thành ba từ [SJ, X198V, DG] và biên từ
 * còn tồn tại để so. Cùng công thức với `chuanSo()` của Tracking. */
const chuanTu = (s) => String(s == null ? "" : s)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D")
  .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const catTu = (s) => { const c = chuanTu(s); return c ? c.split(" ") : []; };

/* Một mục từ điển dài hơn ngần này KHÔNG phải một mã, nó là một câu mô tả.
 * Chuyện này có thật: nhánh "thêm mã mới" của màn Tồn kho ghi `board/<mã>/name`
 * bằng nguyên câu tên hàng trong file tồn. Nhận những câu ấy vào từ điển là
 * quay lại khớp văn xuôi — đúng thứ vừa từ chối ở đầu file — và còn kéo chi
 * phí dò lên theo bình phương số từ. */
const CUM_TOI_DA = 8;

/** Mã phụ → mã chính. Cùng luật, cùng trần 4 chặng với `aliasOf()` của
 *  Tracking: trần đó chặn một vòng lặp alias trỏ vòng tròn treo cả lượt đọc. */
export function quyAlias(ma, bangAlias) {
  const m = laObj(bangAlias) ? bangAlias : {};
  let cur = String(ma == null ? "" : ma);
  for (let i = 0; i < 4 && m[cur] && m[cur] !== cur; i++) cur = m[cur];
  return cur;
}

/** Bộ khớp dựng MỘT LẦN cho mỗi lượt đọc, rồi dùng lại cho mọi dòng.
 *
 *  `nguon` là ba nhánh Tracking đã chiếu ra, đúng hình dạng `/api/xuat/` trả:
 *    `board`   `{ "<mã>": { name, alt:[…], brand, category_label } }`
 *    `alias`   `{ "<mã phụ>": "<mã chính>" }`
 *    `inv_map` `{ "<khoá>": "<mã>" | "-" }`
 *
 *  NÉM LỖI khi bảng giá rỗng hay sai kiểu — không bao giờ trả một bộ khớp
 *  rỗng. Bộ khớp rỗng cho ra "mọi dòng đều chưa khớp", và câu đó đọc lên là
 *  một KẾT LUẬN NGHIỆP VỤ chứ không phải một sự cố mạng (CLAUDE.md — "Nguồn
 *  hỏng thì BÁO LỖI, không bao giờ trả rỗng"). Bảng giá trống chưa từng là
 *  trạng thái thật; Tracking cũng trả 502 cho đúng ca này.
 *
 *  `inv_map` rỗng thì KHÁC — "chưa ai phân loại dòng nào" là một trạng thái
 *  thật và hợp lệ, nên nó được nhận. */
export function dungBoKhop(nguon) {
  const n = laObj(nguon) ? nguon : {};
  const board = n.board;
  if (!laObj(board) || !Object.keys(board).length)
    throw new Error("khop-ma: bảng giá Tracking rỗng hoặc sai kiểu");
  const alias = laObj(n.alias) ? n.alias : {};
  const phanLoai = laObj(n.inv_map) ? n.inv_map : {};

  /* Từ điển: cụm đã chuẩn hoá → mã chính. Giá trị `null` nghĩa là cụm ấy bị
     HAI mã khác nhau cùng nhận — không đoán, cụm đó vĩnh viễn không tự khớp
     được nữa. Cùng kỷ luật "khớp nhiều hơn một ⟹ null" mà `hangCua()` bên
     Tracking đã theo từ lâu. */
  const cum = new Map();
  let daiNhat = 0;

  for (const k of Object.keys(board)) {
    const row = board[k];
    if (!laObj(row)) continue;
    const chinh = quyAlias(k, alias);
    /* Mã chính phải còn trên bảng giá. Một alias trỏ tới mã đã bị xoá là dữ
       liệu cũ chưa dọn, không phải một mã dùng được. */
    if (!laObj(board[chinh])) continue;

    const alt = Array.isArray(row.alt) ? row.alt : [];
    for (const nhan of [k, row.name, ...alt]) {
      const tu = catTu(nhan);
      if (!tu.length || tu.length > CUM_TOI_DA) continue;
      const c = tu.join(" ");
      /* RÀO AN TOÀN — cụm phải có ít nhất một CHỮ SỐ. Mã model thật gần như
         luôn có số; một mục từ điển toàn chữ (một mã đặt tên kiểu "QUAT",
         hay một `name` chỉ có mỗi tên hãng) sẽ nuốt đúng những từ thường gặp
         trong câu văn xuôi của sổ. Bỏ chúng khỏi từ điển làm mất một số khớp
         đúng — và đó là cái giá đã chọn: mất một khớp thì dòng xuống gán tay,
         khớp sai thì sai tiền. */
      if (!/[0-9]/.test(c)) continue;
      if (cum.has(c)) { if (cum.get(c) !== chinh) cum.set(c, null); continue; }
      cum.set(c, chinh);
      if (tu.length > daiNhat) daiNhat = tu.length;
    }
  }

  return { board, alias, phanLoai, cum, daiNhat };
}

/** Một câu tên hàng → mã bảng giá, hoặc lý do chưa có.
 *
 *  Trả về `{ ma, nguon, khoa, ly_do }`:
 *    `nguon` — `"quyet-dinh"` người đã gán | `"tu-dong"` máy khớp được
 *              | `"bo-qua"` người đã nói không phải sản phẩm | `null`
 *    `ly_do` — chỉ có khi chưa ra mã: `"chua-khop"` | `"nhieu-ma"`
 *              | `"ma-da-xoa"` */
export function khopTenHang(ten, bo) {
  const khoa = khoaTenHang(ten);

  /* Bậc 1 & 2 — quyết định của người, thắng mọi phép khớp của máy. */
  const qd = bo.phanLoai[khoa];
  if (typeof qd === "string" && qd) {
    if (qd === "-") return { ma: null, nguon: "bo-qua", khoa, ly_do: null };
    const chinh = quyAlias(qd, bo.alias);
    /* Mã đã bị xoá khỏi bảng giá sau khi người ta gán: KHÔNG hiện một mã
       chết, và cũng không lặng lẽ tự khớp lại — người đã quyết định một
       lần, việc mã ấy biến mất là chuyện phải nói ra. */
    if (!laObj(bo.board[chinh]))
      return { ma: null, nguon: null, khoa, ly_do: "ma-da-xoa" };
    return { ma: chinh, nguon: "quyet-dinh", khoa, ly_do: null };
  }

  /* Bậc 3 — khớp cụm liên tiếp trọn vẹn. Gom MỌI cụm khớp được rồi mới xét,
     chứ không lấy cụm dài nhất: hai mã khác nhau cùng xuất hiện trong một câu
     ("Tivi Sony K-65S20M2 thay thế K-55S20M2") không phải bằng chứng cho bên
     nào cả. Nhiều cụm cùng trỏ về MỘT mã (`name` và một `alt` cùng khớp) thì
     vẫn là một mã — nên gom theo MÃ, không theo cụm. */
  const tu = catTu(ten);
  const thay = new Set();
  for (let i = 0; i < tu.length; i++) {
    const het = Math.min(tu.length, i + bo.daiNhat);
    for (let j = i + 1; j <= het; j++) {
      const v = bo.cum.get(tu.slice(i, j).join(" "));
      if (v === undefined) continue;
      if (v === null) return { ma: null, nguon: null, khoa, ly_do: "nhieu-ma" };
      thay.add(v);
    }
  }
  if (thay.size === 1)
    return { ma: [...thay][0], nguon: "tu-dong", khoa, ly_do: null };

  return { ma: null, nguon: null, khoa,
    ly_do: thay.size ? "nhieu-ma" : "chua-khop" };
}

/** Điền mã + hãng + ngành hàng vào một bảng đơn đã dựng, và đếm phần còn nợ.
 *
 *  SỬA TẠI CHỖ trên bảng vừa được `dungBangDon()` dựng ra trong cùng một lượt
 *  gọi — không phải trên dữ liệu dùng chung, nên không có ai khác đang cầm nó.
 *
 *  `hang` và `nganh_hang` lấy THẲNG từ `brand`/`category_label` của bảng giá.
 *  Đây là tra nhãn, không phải phân loại: Tracking đã có danh sách đóng và
 *  khớp nguyên từ, và CLAUDE.md cấm dựng bộ phân loại thương hiệu thứ hai.
 *  Tracking không dám khẳng định thì trả `null`, và `null` đi thẳng ra màn
 *  hình thành "—" — "chưa biết" chứ không phải một cái nhãn đoán.
 *
 *  `gia_nhap`, `loi_nhuan`, `noi_nhap` KHÔNG đụng tới ở đây: chúng cần
 *  `POST /api/min-ngay` và thuộc lát cắt sau. */
export function khopMaChoBangDon(bang, nguon, ky) {
  /* Kỳ ngoài phạm vi thì KHÔNG khớp gì cả, và nói thẳng lý do. Cố ý không
     chạy rồi trả "0 dòng khớp được": ở những kỳ ấy không có giá vốn theo ngày
     để đối chiếu, nên một bảng kê hàng chờ chỉ mời người ta gán một đống mã
     rồi vẫn không ra được đồng nào. Xem `MOC_KHOP_MA`. */
  if (ky !== undefined && !kyCoKhopMa(ky)) {
    bang.tom_tat_ma = { ngoai_pham_vi: true, tu_ky: MOC_KHOP_MA };
    return bang;
  }
  const bo = dungBoKhop(nguon);

  let tong = 0, tu_dong = 0, quyet_dinh = 0, bo_qua = 0;
  const conNo = new Map();   // khoá → { ten, khoa, ly_do, so_dong }

  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      for (const d of don.dong) {
        /* Dòng chiết khấu không phải một mặt hàng — nó là một phép trừ của cả
           đơn, gộp lại thành một dòng (`dungBangDon()`). Đưa nó vào hàng chờ
           gán mã là mời người dùng phân loại một con số. */
        if (d.la_chiet_khau) {
          d.ma_bang_gia = null; d.nguon_ma = "khong-phai-hang";
          d.khoa_ten = null; d.ly_do_chua_ma = null;
          continue;
        }

        tong++;
        const kq = khopTenHang(d.ma_san_pham, bo);
        d.ma_bang_gia = kq.ma;
        d.nguon_ma = kq.nguon;
        d.khoa_ten = kq.khoa;
        d.ly_do_chua_ma = kq.ly_do;

        if (kq.ma) {
          const row = bo.board[kq.ma];
          d.hang = row.brand ?? null;
          d.nganh_hang = row.category_label ?? null;
          if (kq.nguon === "tu-dong") tu_dong++; else quyet_dinh++;
        } else if (kq.nguon === "bo-qua") {
          bo_qua++;
        } else {
          const cu = conNo.get(kq.khoa);
          if (cu) cu.so_dong++;
          else conNo.set(kq.khoa,
            { ten: d.ma_san_pham, khoa: kq.khoa, ly_do: kq.ly_do, so_dong: 1 });
        }
      }
    }
  }

  /* Gom hàng chờ theo TÊN, không theo dòng: gán một tên là xong mọi dòng mang
     tên đó. Danh sách này KHÔNG cắt bớt — nó là hàng việc của người dùng, và
     một danh sách bị cắt lặng lẽ là một phần việc không ai thấy. */
  const chua_khop = [...conNo.values()].sort((a, b) => b.so_dong - a.so_dong);

  bang.tom_tat_ma = {
    tong_dong: tong,
    da_co_ma: tu_dong + quyet_dinh,
    tu_dong, quyet_dinh, bo_qua,
    chua_co_ma: chua_khop.reduce((s, x) => s + x.so_dong, 0),
    chua_khop,
  };
  return bang;
}

/* ═════════════ GIÁ NHẬP THEO ĐÚNG NGÀY BÁN ═════════════
 *
 * Một đơn bán ngày 01/09 phải mang giá vốn của ĐÚNG ngày 01/09 — không phải
 * giá của ngày người ta bấm nút nạp file. Bảng giá đổi mỗi đêm theo crawler,
 * nên "giá hiện tại" và "giá lúc bán" là hai con số khác nhau, và dùng nhầm
 * cái thứ nhất là sai lợi nhuận của cả tháng mà không có gì đỏ lên.
 *
 * TRACKING SỞ HỮU CON SỐ NÀY. Module này KHÔNG tính một Min thứ hai — nó chỉ
 * đọc bản ghi `POST /api/min-ngay` trả về và chiếu vào từng dòng. Đó là điều
 * kiện để hai hệ thống không bao giờ hiện hai giá vốn khác nhau cho cùng một
 * mã cùng một ngày.
 */

/* Đơn vị tiền của hợp đồng `daily-min-v1`. `min_price` đếm bằng NGHÌN đồng,
 * còn mọi con số trong Báo cáo đếm bằng ĐỒNG — quên phép nhân này là sai gấp
 * một nghìn lần, và sai êm: 5.250 đọc thành 5.250 đ trông vẫn như một cái giá
 * thật. Nên đơn vị được KIỂM chứ không tin: Tracking đổi đơn vị mà bên này
 * không hay thì phải nổ, không được lặng lẽ nhân nhầm. */
const DON_VI_MIN = "VND_THOUSAND";
const NGHIN = 1000;

/** Lý do một dòng chưa có giá vốn → câu cho người đọc. Mỗi mã lỗi của
 *  `daily-min-v1` một câu; mã lạ thì nói thẳng là lạ chứ không nuốt. */
export const LY_DO_GIA = {
  "chua-co-ma": "chưa gán mã bảng giá",
  SOURCE_UNAVAILABLE: "Tracking không quan sát được bảng giá ngày hôm đó",
  NO_DATA: "chưa có mốc giá nào của mã này tính tới ngày đó",
  INVALID_PRODUCT_CODE: "mã hàng không hợp lệ với hệ giá của Tracking",
};

/** Tập mã cần hỏi giá vốn cho một kỳ.
 *
 *  Gateway hỏi cái này TRƯỚC, rồi mới gọi `POST /api/min-ngay` — hợp đồng bên
 *  đó nhận một TẬP MÃ, không nhận "tất cả". Chạy thẳng trên cây dòng thay vì
 *  dựng cả bảng đơn: chỉ cần biết mã nào có mặt, không cần nhóm theo ngày và
 *  chứng từ, và dựng bảng rồi bắn qua Service Binding hai lượt là trả giá
 *  băng thông cho một danh sách vài trăm chuỗi.
 *
 *  KHÔNG lọc theo line: người dùng bấm đổi line liên tục trên cùng một kỳ, và
 *  một tập mã cho cả kỳ dùng lại được cho mọi line — lọc theo line là mỗi lần
 *  bấm một lượt gọi mạng mới cho phần lớn là cùng dữ liệu. */
export function maCanGiaVon(dongCuaKy, nguon, ky) {
  if (ky !== undefined && !kyCoKhopMa(ky)) return [];
  const dong = laObj(dongCuaKy) ? dongCuaKy : {};
  const bo = dungBoKhop(nguon);
  const ra = new Set();
  for (const khoa of Object.keys(dong)) {
    const d = dong[khoa];
    if (!laObj(d)) continue;
    const kq = khopTenHang(d.ten_hang, bo);
    if (kq.ma) ra.add(kq.ma);
  }
  return [...ra].sort();
}

/** Điền `gia_nhap` và `loi_nhuan` vào một bảng đơn ĐÃ khớp mã.
 *
 *  `minNgay` = `{ currency_unit, records, errors }` gộp từ mọi trang mà
 *  `POST /api/min-ngay` trả về. Mỗi cặp (mã, ngày) đã hỏi nằm ở `records`
 *  HOẶC `errors` — nhờ vậy bảng kê cuối luôn cân: không dòng nào biến mất
 *  khỏi cả hai phía.
 *
 *  LỢI NHUẬN của một dòng = `tổng bán − giá nhập × số lượng`. `tong_ban` là
 *  con số CHÍNH SỔ khẳng định dòng đó bán được bao nhiêu (không phải
 *  `giá bán × SL` — xem `gop-ban-hang.mjs`), nên lấy nó làm vế doanh thu giữ
 *  cho lợi nhuận cộng lại đúng bằng số bảng đang hiện. Chiết khấu của cả đơn
 *  nằm ở một dòng riêng mang dấu âm và đã có sẵn lợi nhuận của nó.
 *
 *  Dòng không có giá vốn để `loi_nhuan = null`, KHÔNG để 0: "lãi 0 đồng" và
 *  "chưa biết lãi bao nhiêu" là hai câu khác hẳn nhau, và trên một cột tiền
 *  thì nhầm hai thứ đó là nhầm tiền. */
export function dienGiaNhap(bang, minNgay) {
  const mn = laObj(minNgay) ? minNgay : {};
  if (mn.currency_unit && mn.currency_unit !== DON_VI_MIN)
    throw new Error("khop-ma: min-ngay đổi đơn vị tiền — " + mn.currency_unit);

  /* (mã, ngày) → giá đồng, hoặc lý do chưa có. Dựng một bản đồ phẳng thay vì
     dò tuyến tính cho từng dòng: một kỳ có hàng nghìn dòng và hàng nghìn bản
     ghi, dò lồng nhau là phép nhân hai con số ấy. */
  const gia = new Map();
  const lyDo = new Map();
  const khoa = (ma, ngay) => ma + "\x1f" + ngay;

  for (const r of Array.isArray(mn.records) ? mn.records : []) {
    if (!laObj(r)) continue;
    const k = khoa(r.product_code, r.effective_date);
    /* `min_price: null` là một bản ghi THẬT nói "ngày ấy không nguồn nào báo
       giá mã này" (`price_status: NO_DATA`) — khác hẳn việc cặp ấy không được
       trả về. Cả hai đều là chưa có giá, nhưng lý do khác nhau và người đọc
       cần thấy đúng lý do của mình. */
    if (typeof r.min_price === "number")
      gia.set(k, { dong: Math.round(r.min_price * NGHIN), ngay_quan_sat: r.observed_on ?? null,
        trang_thai_ngay: r.day_status ?? null });
    else lyDo.set(k, r.price_status || "NO_DATA");
  }
  for (const e of Array.isArray(mn.errors) ? mn.errors : []) {
    if (!laObj(e)) continue;
    const k = khoa(e.product_code, e.effective_date);
    if (!gia.has(k) && !lyDo.has(k)) lyDo.set(k, e.reason || "NO_DATA");
  }

  let coGia = 0, chuaCoGia = 0;
  const theoLyDo = {};

  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      let loiNhuanDon = 0, duGia = true;
      for (const d of don.dong) {
        if (d.la_chiet_khau) {
          /* Chiết khấu đã biết chắc lợi nhuận của nó từ `dungBangDon()`
             (giá nhập 0 nên lợi nhuận = chính nó, mang dấu âm). */
          loiNhuanDon = lamTronDong(loiNhuanDon + (Number(d.loi_nhuan) || 0));
          continue;
        }
        if (!d.ma_bang_gia) {
          d.ly_do_chua_gia = "chua-co-ma";
          chuaCoGia++; duGia = false;
          theoLyDo["chua-co-ma"] = (theoLyDo["chua-co-ma"] || 0) + 1;
          continue;
        }
        const k = khoa(d.ma_bang_gia, ng.ngay);
        const g = gia.get(k);
        if (!g) {
          const ly = lyDo.get(k) || "NO_DATA";
          d.ly_do_chua_gia = ly;
          chuaCoGia++; duGia = false;
          theoLyDo[ly] = (theoLyDo[ly] || 0) + 1;
          continue;
        }
        d.gia_nhap = g.dong;
        d.ngay_gia = g.ngay_quan_sat;
        d.trang_thai_ngay_gia = g.trang_thai_ngay;
        d.loi_nhuan = lamTronDong(Number(d.tong_ban) - g.dong * (Number(d.so_luong) || 0));
        d.ly_do_chua_gia = null;
        loiNhuanDon = lamTronDong(loiNhuanDon + d.loi_nhuan);
        coGia++;
      }
      /* Lợi nhuận của ĐƠN chỉ có nghĩa khi MỌI dòng hàng của nó đã có giá
         vốn. Thiếu một dòng mà vẫn cộng là đưa ra một con số nhỏ hơn sự thật
         và không nói rằng nó thiếu — đúng kiểu sai êm mà cả file này đang
         tránh. Thiếu thì để `null`, màn hình hiện "—". */
      don.loi_nhuan = duGia ? loiNhuanDon : null;
    }
  }

  bang.tom_tat_gia = {
    co_gia: coGia,
    chua_co_gia: chuaCoGia,
    theo_ly_do: theoLyDo,
  };
  return bang;
}

/* CÙNG phép làm tròn với `lamTron()` của `dong-hang.mjs` — cố ý chép đúng,
   không "chuẩn hơn". Hai module cùng cộng tiền trên một bảng; lệch phép làm
   tròn là hai cột cùng dòng không cộng lại được với nhau, và cái lệch ấy chỉ
   lộ ra ở con số tổng cuối tháng. Sổ thật có dòng lẻ tới phần trăm đồng
   (4.090.909,09 — giá tính ngược từ giá gồm VAT) nên phần lẻ được giữ. */
const lamTronDong = (n) => Math.round((Number(n) || 0) * 100) / 100;
