/* PHÂN LOẠI THỦ CÔNG — hãng và ngành hàng cho dòng KHÔNG có mã bảng giá.
 * Chủ dự án chốt 19/09/2026.
 *
 * ── VÌ SAO CẦN, KHI ĐÃ CÓ MÀN GÁN MÃ ──
 *
 * Gán mã trả lời câu "câu tên này là mặt hàng NÀO trên bảng giá", và câu trả
 * lời ấy kéo theo cả giá vốn. Nhưng có những câu tên KHÔNG có mặt hàng nào
 * tương ứng để mà chỉ vào: hàng đã ngừng bán và rút khỏi bảng giá, hàng của
 * một kỳ cũ hai mươi tháng trước, hàng mà chốt NB-2 bên Tracking từ chối cho
 * ghi vì nó đang là dòng tồn kho hoạt động. Người dùng bấm "bỏ qua", và dòng
 * ấy ở lại cột NONE của biểu đồ cơ cấu mãi mãi.
 *
 * Đo trên tháng 01/2025 (19/09/2026): phân loại mới phủ chừng một phần ba.
 * Không có đường này thì hai phần ba ấy không có cách nào ra khỏi cột xám —
 * và một biểu đồ cơ cấu phủ 33% thì nói được rất ít.
 *
 * Nên đây là đường thứ hai, HẸP HƠN: nó KHÔNG cho ra mã, KHÔNG cho ra giá
 * vốn, không đụng tới `inv/map`. Nó chỉ trả lời đúng hai câu — hãng nào,
 * ngành nào — cho một câu tên hàng.
 *
 * ── DANH SÁCH VẪN LÀ DANH SÁCH ĐÓNG CỦA TRACKING ──
 *
 * CLAUDE.md cấm dựng bộ phân loại thương hiệu thứ hai. Luật ấy KHÔNG bị nới
 * ở đây: người dùng không gõ tự do một tên hãng mới, họ CHỌN trong đúng
 * những giá trị `brand` / `category_label` đang có thật trên bảng giá
 * Tracking (`mucPhanLoai()`). Chọn ngoài danh sách thì `apPhanLoaiTay` vẫn
 * áp — nó không phải chỗ canh — nhưng Gateway chặn ngay lượt ghi.
 *
 * Cái được dựng mới ở đây là một BẢNG QUYẾT ĐỊNH CỦA NGƯỜI, không phải một
 * bộ máy đoán. Máy vẫn không đoán một chữ nào.
 *
 * ── KHOÁ BỀN, VÀ ÁP CHO MỌI KỲ ──
 *
 * Khoá là `khoaTenHang(tên hàng)` — ĐÚNG công thức khoá của `inv/map`, dùng
 * lại chứ không viết bản thứ hai. Theo phân loại khoá của CLAUDE.md đây là
 * quyết định về MỘT MẶT HÀNG, nên nó áp cho MỌI kỳ, kể cả kỳ chưa nhập.
 *
 * Vì sao không khoá theo DÒNG: "Tủ lạnh Hitachi 500L" là hãng Hitachi ở mọi
 * dòng, mọi đơn, mọi tháng. Khoá theo dòng là bắt người dùng trả lời cùng
 * một câu hỏi bốn mươi lần trong một tháng, rồi lại bốn mươi lần ở tháng
 * sau — đúng thứ "ít thao tác trùng lặp" loại trừ.
 *
 * ── MÃ BẢNG GIÁ LUÔN THẮNG ──
 *
 * Dòng đã khớp ra mã thì hãng/ngành lấy từ bảng giá, và bảng phân loại tay
 * KHÔNG đè lên. Bảng giá là nguồn dùng chung của ba app; một bảng riêng của
 * Báo cáo mà đè được lên nó là hai app nói hai câu khác nhau về cùng một
 * mặt hàng, và không ai biết cho tới lúc số lệch.
 *
 * Hệ quả có chủ đích: gán mã cho một tên đã phân loại tay thì mã thắng, và
 * quyết định tay nằm im ở đó — không mất, không đè, vẫn áp trở lại nếu mã
 * bị rút. Nó được ĐẾM trong `tom_tat` để không âm thầm biến mất.
 */

import { khoaTenHang } from "./khop-ma.mjs";

const laObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const chu = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Những giá trị hãng / ngành hàng CÓ THẬT trên bảng giá Tracking.
 *
 *  Đây là danh sách cho trình chọn của màn hình — và cũng là danh sách
 *  Gateway đối chiếu khi ghi. Một chỗ, hai việc: nếu tách làm hai thì trình
 *  chọn và cửa ghi có thể trôi khỏi nhau, và triệu chứng là "chọn được mà
 *  không ghi được".
 *
 *  NÉM LỖI khi bảng giá rỗng hay sai kiểu, cùng kỷ luật `dungBoKhop`: một
 *  danh sách rỗng ở đây đọc lên thành "Tracking không có hãng nào", tức một
 *  kết luận nghiệp vụ thay cho một sự cố mạng (CLAUDE.md). */
export function mucPhanLoai(nguon) {
  const board = laObj(nguon) ? nguon.board : null;
  if (!laObj(board) || !Object.keys(board).length)
    throw new Error("phan-loai: bảng giá Tracking rỗng hoặc sai kiểu");

  const hang = new Map(), nganh = new Map();
  for (const ma of Object.keys(board)) {
    const row = board[ma];
    if (!laObj(row)) continue;
    /* Gom theo bản thường hoá để "SAMSUNG" và "Samsung" không thành hai mục
       trong trình chọn; giữ lại cách viết GẶP ĐẦU TIÊN làm mặt chữ hiện ra,
       vì đó cũng là cách viết `khopMaChoBangDon` gán cho dòng có mã — hai
       màn phải ra cùng một chuỗi, không thì một hãng thành hai mảng màu. */
    for (const [truong, bo] of [["brand", hang], ["category_label", nganh]]) {
      const v = chu(row[truong]);
      if (v && !bo.has(v.toLowerCase())) bo.set(v.toLowerCase(), v);
    }
  }
  const sapXep = (bo) => [...bo.values()]
    .sort((a, b) => a.localeCompare(b, "vi"));
  return { hang: sapXep(hang), nganh: sapXep(nganh) };
}

/** Một quyết định phân loại hợp lệ, hay `null`.
 *
 *  Thiếu CẢ HAI trường thì không phải một quyết định — đó là một ô rỗng còn
 *  sót lại sau lượt rút quyết định. Thiếu MỘT trường thì vẫn nhận: phân loại
 *  được hãng mà chưa chắc ngành (hay ngược lại) là chuyện thật, và bắt phải
 *  đủ đôi là đẩy người dùng tới chỗ gõ bừa cho xong. */
function docQuyetDinh(v) {
  if (!laObj(v)) return null;
  const hang = chu(v.hang), nganh = chu(v.nganh);
  if (!hang && !nganh) return null;
  return { hang, nganh };
}

/** Áp bảng phân loại tay lên một bảng đơn đã dựng. SỬA TẠI CHỖ.
 *
 *  `bangQuyetDinh` là nhánh `bc/quyetdinh/phan-loai` đọc nguyên: khoá tên
 *  hàng → `{ hang, nganh }`.
 *
 *  Chạy được ở CẢ đường không có bảng giá Tracking (Tracking hỏng, hay kỳ mà
 *  Gateway không đi lấy bảng giá): khoá tự tính lại từ tên hàng khi dòng
 *  chưa mang sẵn `khoa_ten`. Quyết định của người không có lý do gì phải
 *  biến mất chỉ vì một nhánh phụ không trả lời.
 *
 *  Trả bản kê: đã áp bao nhiêu dòng, và những quyết định nào KHÔNG có dòng
 *  nào để áp ("mồ côi" — CLAUDE.md bắt ĐẾM và GIỮ, không im lặng bỏ qua). */
export function apPhanLoaiTay(bang, bangQuyetDinh) {
  const qd = laObj(bangQuyetDinh) ? bangQuyetDinh : {};
  const khoaCo = new Set(Object.keys(qd));
  const daDung = new Set();
  let so_dong = 0, so_ten = 0;
  const tenDaDem = new Set();

  for (const ng of (bang && Array.isArray(bang.ngay) ? bang.ngay : [])) {
    for (const don of (Array.isArray(ng.don) ? ng.don : [])) {
      for (const d of (Array.isArray(don.dong) ? don.dong : [])) {
        /* Chiết khấu là một phép trừ của cả đơn, phụ phí cố định là tiền
           công — không cái nào là một mặt hàng để mà xếp vào ngành. Cùng lý
           do `khopMaChoBangDon` loại chúng khỏi hàng chờ gán mã. */
        if (d.la_chiet_khau || d.la_phu_phi_co_dinh) continue;
        /* Mã bảng giá LUÔN THẮNG — xem phần đầu file. */
        if (d.ma_bang_gia) continue;

        const khoa = d.khoa_ten || khoaTenHang(d.ma_san_pham);
        if (!khoaCo.has(khoa)) continue;
        const q = docQuyetDinh(qd[khoa]);
        if (!q) continue;

        daDung.add(khoa);
        if (q.hang) d.hang = q.hang;
        if (q.nganh) d.nganh_hang = q.nganh;
        d.phan_loai_tay = true;
        so_dong++;
        if (!tenDaDem.has(khoa)) { tenDaDem.add(khoa); so_ten++; }
      }
    }
  }

  /* Mồ côi: quyết định còn đó mà kỳ đang xem không có dòng nào mang tên ấy.
     KHÔNG xoá — nó tự áp trở lại khi dòng xuất hiện lại, y như `sua-tay`.
     Liệt kê đủ từng khoá, không cắt bớt: đây là bản kê để đối chiếu, và một
     danh sách bị cắt lặng lẽ là một phần việc không ai thấy. */
  const mo_coi = [...khoaCo].filter((k) => !daDung.has(k) && docQuyetDinh(qd[k])).sort();

  bang.tom_tat_phan_loai_tay = { so_dong, so_ten, mo_coi };
  return bang;
}

/** Khoá của một câu tên hàng — dùng lại ĐÚNG công thức của `inv/map`.
 *
 *  Mở lại ở đây chỉ để Gateway gọi một cái tên nói đúng việc nó đang làm;
 *  không có bản thứ hai của công thức. */
export const khoaPhanLoai = khoaTenHang;
