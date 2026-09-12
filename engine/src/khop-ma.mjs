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
export function khopMaChoBangDon(bang, nguon) {
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
