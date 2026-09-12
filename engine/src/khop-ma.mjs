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

/** Ba khoản PHỤ PHÍ CỐ ĐỊNH trên sổ — không phải một mặt hàng bán ra, nên
 *  KHÔNG cần khớp mã bảng giá (chủ dự án chốt 12/09/2026). Giá vốn của
 *  chúng luôn CHÍNH BẰNG giá bán: "chi phí lắp đặt 500.000 đ" không có một
 *  giá mua vào 500.000 đ khác đứng sau nó — tiền công/tiền chênh thu về
 *  đúng bằng tiền công/tiền chênh đã chi, không sinh lãi cũng không lỗ.
 *
 *  Khớp theo CỤM TỪ xuất hiện Ở BẤT KỲ ĐÂU trong tên — không đòi đứng đầu
 *  câu — vì người bán hàng hay viết thêm mô tả sau nó ("Chi phí lắp đặt TV
 *  65 inch"). Dùng lại đúng phép chuẩn hoá `chuanTu()`/`catTu()` của bậc 3
 *  phía trên nên bỏ dấu, hoa/thường không làm trật khớp. KHÔNG đi qua
 *  `dungBoKhop()`/`cum`: đây không phải mã bảng giá, và không cần rào "phải
 *  có chữ số" của bậc 3 — "Chênh VAT" hợp lệ dù không một chữ số nào. */
const PHU_PHI_CO_DINH = [
  "Chi phí vận chuyển", "Chi phí lắp đặt", "Chênh VAT",
].map((nhan) => ({ nhan, tu: catTu(nhan) }));

/** Tên hàng có chứa một trong ba cụm phụ phí cố định không — trả nhãn khớp
 *  được (để hiện đúng chữ chủ dự án đặt tên), hoặc `null`. */
function timPhuPhiCoDinh(ten) {
  const tu = catTu(ten);
  for (const p of PHU_PHI_CO_DINH) {
    const n = p.tu.length;
    for (let i = 0; i + n <= tu.length; i++) {
      let khop = true;
      for (let j = 0; j < n; j++) {
        if (tu[i + j] !== p.tu[j]) { khop = false; break; }
      }
      if (khop) return p.nhan;
    }
  }
  return null;
}

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

  /* Từ điển thứ hai: NGUYÊN CÂU đã chuẩn hoá → mã chính, KHÔNG có trần độ dài.
     Cùng luật "hai mã cùng nhận ⟹ null" như `cum`.

     Vì sao phải có, và vì sao nó KHÔNG nới lỏng kỷ luật nào:

     Màn Tồn kho của Tracking có nhánh "thêm mã mới" ghi `board/<mã>` bằng
     NGUYÊN CÂU tên hàng trong file tồn. Gặp thật 12/09/2026: bảng giá có một
     mục mã là `"GIÁ TREO TIVI ĐA NĂNG ERGOTEK E66 32 - 80 INCH"` — mười từ,
     vượt trần `CUM_TOI_DA`, nên nó KHÔNG vào `cum` và dòng bán mang đúng y
     nguyên câu ấy vẫn rơi xuống hàng chờ. Mà ở hàng chờ thì gán tay cũng
     không xong: chính mặt hàng ấy đang là một dòng tồn kho hoạt động, nên
     chốt NB-2 bên Tracking từ chối lượt ghi và bảo "phân loại bên màn Tồn
     kho". Người dùng kẹt giữa hai màn hình, còn con số thì đứng đó không ai
     đọc được.

     Trần `CUM_TOI_DA` sinh ra để một mục từ điển DÀI không nuốt mất mấy từ
     thường gặp trong câu văn xuôi của sổ. Với phép so NGUYÊN CÂU thì mối lo
     ấy không tồn tại: không còn chữ nào thừa ra để mà nuốt — hoặc bằng sạch,
     hoặc không tính. Đây vẫn đúng cách 2 mà CLAUDE.md cho phép ("cụm từ liên
     tiếp trọn vẹn, ra đúng một mã"), chỉ là trường hợp chặt nhất của nó.

     Rào CHỮ SỐ thì GIỮ NGUYÊN. Nó không còn cần cho an toàn chuỗi con nữa,
     nhưng nhánh "thêm mã mới" kia cũng đẻ ra được một mục tên trần kiểu
     `"Tủ lạnh"`, và để một dòng bán ghi đúng hai chữ ấy khớp vào đó là gán
     một mặt hàng thật vào một mã rác. Giữ rào là giữ đúng đánh đổi đã chọn:
     mất một khớp thì dòng xuống gán tay, khớp sai thì sai tiền. */
  const nguyenCau = new Map();

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
      if (!tu.length) continue;
      const cauDay = tu.join(" ");
      if (/[0-9]/.test(cauDay)) {
        if (nguyenCau.has(cauDay)) {
          if (nguyenCau.get(cauDay) !== chinh) nguyenCau.set(cauDay, null);
        } else nguyenCau.set(cauDay, chinh);
      }

      if (tu.length > CUM_TOI_DA) continue;
      const c = cauDay;
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

  return { board, alias, phanLoai, cum, daiNhat, nguyenCau };
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

  /* Bậc 3a — NGUYÊN CÂU bằng sạch một mục bảng giá. Xét TRƯỚC phép dò cụm vì
     nó là bằng chứng chặt hơn hẳn: không phải "có một mã nằm đâu đó trong
     câu" mà là "câu này CHÍNH LÀ mục ấy". Không có trần độ dài — xem
     `nguyenCau` ở `dungBoKhop()`.

     Hai mã cùng nhận nguyên một câu thì XUỐNG HÀNG CHỜ luôn, không rơi tiếp
     xuống phép dò cụm: nhập nhằng ở bậc chặt nhất là nhập nhằng thật, và một
     phép dò lỏng hơn thì càng không gỡ được nó. */
  const cauDay = catTu(ten).join(" ");
  if (cauDay) {
    const v = bo.nguyenCau ? bo.nguyenCau.get(cauDay) : undefined;
    if (v === null) return { ma: null, nguon: null, khoa, ly_do: "nhieu-ma" };
    if (v !== undefined) return { ma: v, nguon: "tu-dong", khoa, ly_do: null };
  }

  /* Bậc 3b — khớp cụm liên tiếp trọn vẹn. Gom MỌI cụm khớp được rồi mới xét,
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

        /* Phụ phí cố định — cùng lý do bỏ qua với chiết khấu ở trên: không
           phải một mặt hàng, đưa vào hàng chờ gán mã là mời phân loại một
           khoản tiền công/tiền chênh không hề có trên bảng giá. */
        const phuPhi = timPhuPhiCoDinh(d.ma_san_pham);
        if (phuPhi) {
          d.ma_bang_gia = null; d.nguon_ma = "phu-phi-co-dinh";
          d.khoa_ten = null; d.ly_do_chua_ma = null;
          d.la_phu_phi_co_dinh = phuPhi;
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

/* THỨ TỰ ƯU TIÊN NHÀ CUNG CẤP cho cột "Nơi nhập" — chủ dự án chốt 12/09/2026.
 *
 * Một giá Min có thể do NHIỀU nguồn cùng giữ (hợp đồng `daily-min-v1` trả cả
 * danh sách ở `min_sources`). Khi ấy phải chọn một cái tên để hiện, và chọn
 * theo thứ tự này; nguồn không có tên trong danh sách xếp sau cùng, giữ
 * nguyên thứ tự Tracking trả về.
 *
 * "VIỆT HẢI" VÀ "VIỆT HÀN" LÀ HAI NCC KHÁC NHAU, hai cột cạnh nhau trên bảng
 * giá (chủ dự án xác nhận). Đây đúng lớp lỗi `65C6K`/`65C6KS` ở một chỗ khác:
 * ghép gần đúng hai cái tên ấy là gán sai nơi nhập, im lặng. Nên phép so là
 * so CẢ CHUỖI, chỉ bỏ qua hoa/thường và khoảng trắng thừa — KHÔNG bỏ dấu
 * tiếng Việt (bỏ dấu thì "Hải" và "Hàn" vẫn khác, nhưng bỏ dấu là mở cửa cho
 * một cặp tên khác va nhau sau này), KHÔNG so chuỗi con, KHÔNG so gần đúng.
 *
 * Danh sách này là DỮ LIỆU nghiệp vụ đặt trong code có chủ ý: nó đổi theo
 * quan hệ nhà cung cấp, không theo phiên bản phần mềm, và đổi một dòng ở đây
 * rẻ hơn nhiều so với mở một nhánh Firebase mới cho năm cái tên. Đổi thì sửa
 * đúng mảng này. */
export const NCC_UU_TIEN = [
  "Việt Hải", "Điện tử 179", "Thăng Long", "Trung Xuân", "Văn Quân",
];

const chuanNcc = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
const HANG_UU_TIEN = new Map(NCC_UU_TIEN.map((t, i) => [chuanNcc(t), i]));

/** `source_type` của nguồn TỒN KHO trong hợp đồng `daily-min-v1` — enum ĐÓNG
 *  bên Tracking (`SUPPLIER | INVENTORY`, `min-ngay.js` từ chối ghi giá trị
 *  khác). Nhận theo trường này chứ KHÔNG theo `source_id`: `source_id` của
 *  tồn kho là một hằng máy đọc (`TON_KHO`) mà Tracking đặt tên và có thể đổi,
 *  còn `source_type` là phần hợp đồng hai bên đã cam kết. */
const NGUON_TON_KHO = "INVENTORY";

/** Chữ hiện ở cột Nơi nhập cho hàng xuất từ kho. Hợp đồng trả `TON_KHO` —
 *  một MÃ, không phải chữ cho người đọc; đẩy thẳng nó ra bảng là bắt người
 *  dùng đọc tên biến của một app khác. */
export const NHAN_TON_KHO = "Kho";

/** Nơi nhập của một dòng: nơi hàng THẬT SỰ xuất đi hôm đó.
 *
 *  TỒN KHO THẮNG MỌI NHÀ CUNG CẤP — chủ dự án chốt 12/09/2026, và đây là một
 *  luật NGHIỆP VỤ chứ không phải một thứ tự cho đẹp: hàng đã nằm trong kho thì
 *  bắt buộc xuất từ kho, kể cả khi hôm ấy một NCC báo giá rẻ hơn. Giá thị
 *  trường giảm không làm số hàng đang nằm trong kho biến mất.
 *
 *  Chú ý: luật này chỉ đổi NHÃN. `gia_nhap` vẫn là giá Min của ngày bán, kể
 *  cả khi giá kho cao hơn — hai câu hỏi khác nhau ("lấy hàng ở đâu" và "giá
 *  vốn bao nhiêu") và chủ dự án chốt tách bạch đúng như vậy.
 *
 *  `min_sources` của hợp đồng là `[{source_type, source_id}]`, và hợp đồng
 *  BẢO ĐẢM mọi giá Min dương đều có ít nhất một nguồn (Tracking từ chối ghi
 *  một bản ghi `thieu-nguon-cho-gia`). Nên rỗng ở đây nghĩa là dòng ấy không
 *  có giá Min — và khi ấy nơi nhập cũng không có, đúng như chủ dự án chốt.
 *
 *  Hai đường nhận ra "hàng xuất từ kho", và cần CẢ HAI:
 *
 *    · `giaKho` — `inventory_unit_cost` của hợp đồng `min-2`: kho CÓ HÀNG hôm
 *      đó, bất kể giá kho đắt hay rẻ. Đây là đường chính.
 *    · `min_sources` có một mục `INVENTORY` — kho giữ đúng giá Min hôm đó.
 *      Đường này có từ `min-1` và vẫn cần: bản ghi ghi TRƯỚC lượt deploy
 *      `min-2` không mang `inventory_unit_cost`, nhưng nếu hôm ấy kho giữ Min
 *      thì nó vẫn có tên trong `min_sources`. Bỏ nhánh này là làm những ngày
 *      cũ tệ hơn cả trước khi có luật ưu tiên. */
function chonNoiNhap(nguon, giaKho) {
  const ds = Array.isArray(nguon) ? nguon.filter((x) => laObj(x)
    && typeof x.source_id === "string" && x.source_id.trim()) : [];
  if (!ds.length) return null;
  if (typeof giaKho === "number" && giaKho > 0) return NHAN_TON_KHO;
  if (ds.some((x) => x.source_type === NGUON_TON_KHO)) return NHAN_TON_KHO;
  let tot = null, hang = Infinity;
  for (let i = 0; i < ds.length; i++) {
    const h = HANG_UU_TIEN.has(chuanNcc(ds[i].source_id))
      ? HANG_UU_TIEN.get(chuanNcc(ds[i].source_id))
      : NCC_UU_TIEN.length + i;   // ngoài danh sách: giữ nguyên thứ tự Tracking trả
    if (h < hang) { hang = h; tot = ds[i].source_id; }
  }
  return tot;
}

/* BỎ `LY_DO_GIA` khỏi module này (12/09/2026). Nó là chữ CHO NGƯỜI ĐỌC, và
 * nó đã nằm sẵn ở `public/don-hang.js` — nơi duy nhất thật sự hiện chữ ra.
 * Bản ở đây chưa từng được import lần nào, nên nó chỉ là một bản thứ ba của
 * cùng một bảng, chờ trôi khỏi hai bản kia: đúng lúc Tracking thêm một trạng
 * thái mới thì người sửa dễ sửa nhầm bản chết này rồi tưởng đã xong.
 * (Chính chuyện ấy vừa xảy ra: cả ba bản đều thiếu `OUT_OF_STOCK`, một trạng
 * thái CÓ THẬT trong `TRANG_THAI_GIA` của hợp đồng.)
 *
 * Engine vẫn là nơi đặt ra MÃ lý do (`d.ly_do_chua_gia`) — chỉ phần dịch mã
 * ấy sang tiếng người là việc của màn hình, và đó là hiển thị, không phải
 * nghiệp vụ (LUẬT SỐ 1). */

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
        trang_thai_ngay: r.day_status ?? null, nguon: r.min_sources,
        /* `inventory_unit_cost` (hợp đồng `min-2` của Tracking): giá nhập phân
           bổ của hàng ĐANG TRONG KHO hôm đó, `null` khi kho không có hàng —
           và ĐỘC LẬP với việc kho có giữ Min hay không. Bản ghi cũ (trước
           `min-2`) không có khoá này, đọc lên thành `undefined`; cả hai đều
           rơi vào nhánh "không có hàng" bên dưới, tức quay về thứ tự NCC như
           trước. Đó là hướng an toàn: thà không nói gì còn hơn gán một nơi
           nhập không có bằng chứng. */
        kho: typeof r.inventory_unit_cost === "number" && r.inventory_unit_cost > 0
          ? Math.round(r.inventory_unit_cost * NGHIN) : null });
    else lyDo.set(k, r.price_status || "NO_DATA");
  }
  for (const e of Array.isArray(mn.errors) ? mn.errors : []) {
    if (!laObj(e)) continue;
    const k = khoa(e.product_code, e.effective_date);
    if (!gia.has(k) && !lyDo.has(k)) lyDo.set(k, e.reason || "NO_DATA");
  }

  let coGia = 0, chuaCoGia = 0, soDong0d = 0;
  const theoLyDo = {};
  /* NCC ưu tiên nào thật sự có mặt trong dữ liệu kỳ này. Một cái tên trong
     `NCC_UU_TIEN` không bao giờ khớp là một luật ưu tiên IM LẶNG không chạy —
     đúng lớp lỗi "hai nơi phải khớp mà không ai đối chiếu". Đếm ra để nó lộ
     mặt thay vì nằm im. */
  const nccDaThay = new Set();

  for (const ng of bang.ngay) {
    for (const don of ng.don) {
      /* Chứng từ BTL (bán trả lại) cũng 0 đồng nhưng KHÁC nghiệp vụ — hàng
         quay về kho thì giá vốn có thể phải cộng ngược chứ không trừ. Chủ dự
         án chốt 12/09/2026 để xử sau, nên ở đây BTL KHÔNG được gộp chung với
         dòng quà tặng: không đánh dấu, không bôi đỏ. */
      const laBTL = /^BTL/i.test(String(don.so_ct || ""));
      let loiNhuanDon = 0, duGia = true;
      for (const d of don.dong) {
        if (d.la_chiet_khau) {
          /* Chiết khấu đã biết chắc lợi nhuận của nó từ `dungBangDon()`
             (giá nhập 0 nên lợi nhuận = chính nó, mang dấu âm). */
          loiNhuanDon = lamTronDong(loiNhuanDon + (Number(d.loi_nhuan) || 0));
          continue;
        }

        if (d.la_phu_phi_co_dinh) {
          /* Giá nhập LUÔN bằng giá bán (chủ dự án chốt 12/09/2026) — không
             tra Tracking, không có "nơi nhập" (không phải một NCC giữ giá
             cho một mã hàng). Lợi nhuận ra 0 khi `tong_ban` đúng bằng
             `gia_ban × SL` như sổ vẫn ghi; công thức chung phía dưới tự lo
             việc đó, không cần gán cứng `loi_nhuan = 0`. */
          d.gia_nhap = d.gia_ban;
          d.noi_nhap = null;
          d.ly_do_chua_gia = null;
          d.loi_nhuan = lamTronDong(Number(d.tong_ban) - d.gia_ban * (Number(d.so_luong) || 0));
          loiNhuanDon = lamTronDong(loiNhuanDon + d.loi_nhuan);
          continue;
        }
        /* DÒNG 0 ĐỒNG (chủ dự án chốt 12/09/2026): có thể là quà tặng kèm
           cho khách. Nó vẫn có giá vốn, và vì doanh thu bằng 0 nên công thức
           chung `tổng bán − giá nhập × SL` tự cho ra một số ÂM — đúng "phép
           tính như dòng chiết khấu" mà chủ dự án mô tả, không cần nhánh
           riêng. Cờ này chỉ để màn hình bôi đỏ cho dễ soi. */
        /* `so_luong > 0` là điều kiện THỨ BA, thêm 12/09/2026 cùng lượt xử
           BTL: một dòng bị lượt trả hàng triệt tiêu về SL 0 / tiền 0 cũng
           "0 đồng" theo đúng nghĩa đen, nhưng nó không phải quà tặng và bôi
           đỏ nó là nói sai với người đọc. Quà tặng thật luôn có SL ≥ 1. */
        d.la_dong_0d = !laBTL && Number(d.tong_ban) === 0 && Number(d.so_luong) > 0;
        if (d.la_dong_0d) soDong0d++;

        /* Cặp "đơn mua ↔ bán trả lại" đã triệt tiêu nhau (`btl.mjs`): SL 0,
           tiền 0. Lợi nhuận bằng 0 dù có biết giá vốn hay không — nên dòng
           này KHÔNG được đếm vào "thiếu giá". Đếm nó là để một lượt trả hàng
           xoá mất lợi nhuận của CẢ ĐƠN chỉ vì một dòng đã về 0. */
        if (d.btl_thong_bao) { d.loi_nhuan = 0; continue; }

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
        /* Nơi nhập đi CÙNG giá, từ chính bản ghi của ngày bán — không tra
           lại ở đâu khác. `min_sources` là danh sách NCC đang giữ đúng giá
           Min hôm ấy, nên "nơi nhập nào chứa giá A ngày hôm ấy" đã nằm sẵn
           trong tay, không cần một lượt gọi thứ hai. */
        d.noi_nhap = chonNoiNhap(g.nguon, g.kho);
        /* Giá kho đi kèm ra màn hình khi nó KHÁC giá nhập: người đối chiếu
           tay sẽ thấy "Kho" ở cột Nơi nhập cạnh một con số giá nhập không
           phải giá kho, và nếu không nói gì thì đó trông y như một lỗi.
           `noi_nhap_tu_kho` là CỜ nói "chữ Kho kia do máy chọn": màn hình
           chỉ được giải thích khi cờ còn đúng, và `apDungSuaTay()` tắt nó
           ngay khi người dùng gõ đè một nơi nhập khác — nếu không, ô ghi
           "Tuấn Ngoan" mà tooltip vẫn nói "hàng xuất từ kho". */
        d.gia_ton_kho = g.kho;
        d.noi_nhap_tu_kho = d.noi_nhap === NHAN_TON_KHO;
        if (d.noi_nhap && HANG_UU_TIEN.has(chuanNcc(d.noi_nhap))) nccDaThay.add(chuanNcc(d.noi_nhap));
        d.ly_do_chua_gia = null;
        coGia++;
        if (d.btl_chua_ro_tien) {
          /* Dòng trả lại mà không truy ra được số tiền khách đã trả. Áp công
             thức chung ở đây cho ra `0 − giá vốn × (−1)` = một số DƯƠNG: một
             lượt trả hàng làm TĂNG lãi. Để trống và báo thiếu. */
          d.loi_nhuan = null;
          duGia = false;
          continue;
        }
        d.loi_nhuan = lamTronDong(Number(d.tong_ban) - g.dong * (Number(d.so_luong) || 0));
        loiNhuanDon = lamTronDong(loiNhuanDon + d.loi_nhuan);
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
    so_dong_0d: soDong0d,
    theo_ly_do: theoLyDo,
    /* Tên ưu tiên nào khai trong `NCC_UU_TIEN` mà cả kỳ không gặp lần nào.
       Rỗng là bình thường; có tên trong đây nghĩa là hoặc NCC ấy tháng này
       không giữ Min lần nào, hoặc TÊN ĐÃ VIẾT SAI và luật ưu tiên đang không
       chạy. Hai khả năng rất khác nhau, và cái thứ hai phải thấy được. */
    ncc_uu_tien_khong_gap: NCC_UU_TIEN.filter((t) => !nccDaThay.has(chuanNcc(t))),
  };
  return bang;
}

/* CÙNG phép làm tròn với `lamTron()` của `dong-hang.mjs` — cố ý chép đúng,
   không "chuẩn hơn". Hai module cùng cộng tiền trên một bảng; lệch phép làm
   tròn là hai cột cùng dòng không cộng lại được với nhau, và cái lệch ấy chỉ
   lộ ra ở con số tổng cuối tháng. Sổ thật có dòng lẻ tới phần trăm đồng
   (4.090.909,09 — giá tính ngược từ giá gồm VAT) nên phần lẻ được giữ. */
const lamTronDong = (n) => Math.round((Number(n) || 0) * 100) / 100;
