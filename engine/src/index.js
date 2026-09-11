/* Vỏ Worker của Report Engine — MỎNG. Nghiệp vụ thật không nằm trong file
 * này: nó nằm ở các module thuần bên cạnh (`gop-ban-hang.mjs`), không import
 * gì của Cloudflare, để còn kiểm được bằng Node — đúng mẫu price-engine bên
 * Tracking. File này chỉ MỞ CỬA cho Gateway gọi qua Service Binding.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import { gopSoBanHang } from "./gop-ban-hang.mjs";
import { gopTheoLine } from "./line.mjs";
import { gopSucKhoeCongTy } from "./gop-theo-thoi-gian.mjs";

/** Số phiên bản nghiệp vụ Engine — Gateway ghi vào nhật ký cùng mỗi kết quả
 *  khi có nghiệp vụ thật; P1 dùng nó chỉ để chứng minh dây đã nối. */
const PHIEN_BAN = "0.3.0-p2b";

export default class extends WorkerEntrypoint {
  /* Worker nào cũng có fetch(). Của Engine thì luôn 404 — lớp chặn CUỐI,
   * phòng khi ai đó bật nhầm workers.dev trên dashboard. Trả 404 chứ không
   * phải 403: 403 là xác nhận "có cái gì đó ở đây". */
  async fetch() {
    return new Response("Not Found", { status: 404 });
  }

  /** Số phiên bản nghiệp vụ — endpoint /api/me của Gateway gọi hàm này để
   *  chứng minh đường dây Gateway → Engine chạy thật. */
  async phienBan() {
    return PHIEN_BAN;
  }

  /** Sổ chi tiết bán hàng (ma trận ô thô) → doanh số + số đơn theo
   *  (kỳ, nhân viên, ngày). Xem `gop-ban-hang.mjs` cho toàn bộ luật.
   *
   *  ĐẶT SẴN Ở ĐÂY TỪ P2 DÙ P2 CHƯA GỌI QUA ĐƯỜNG NÀY — có chủ ý. P2 nạp mốc
   *  legacy bằng script chạy tay (`bin/nap-so-legacy.mjs`), gọi thẳng module
   *  chung; P4 (tải file qua UI) mới gọi qua Service Binding. Hai Worker
   *  build SONG SONG khi merge (ROADMAP.md, bẫy số 4), nên hàm Engine phải
   *  lên TRƯỚC lượt merge nào cho Gateway gọi nó — lượt này là lượt "lên
   *  trước" đó.
   *
   *  Ném lỗi khi bố cục sổ không khớp. Để nó ném: Gateway phải trả lỗi cho
   *  người tải file, không phải trả một bảng rỗng (CLAUDE.md — "Nguồn hỏng
   *  thì BÁO LỖI"). */
  async gopSoBanHang(bang) {
    return gopSoBanHang(bang);
  }

  /** Cây `bc/ky` + bảng line → doanh số theo LINE × tháng, kèm tách theo từng
   *  nhân viên trong line. Xem `line.mjs` cho toàn bộ lý do.
   *
   *  Gateway gọi hàm này LÚC ĐỌC, mỗi lần màn hình xin số — KHÔNG ghi kết quả
   *  vào `bc/ky`. Nhờ vậy chủ dự án sửa bảng line (thêm người, đổi tên, dời
   *  một tên sang line khác) là số đổi ngay ở lượt đọc kế tiếp, không phải
   *  nạp lại 20 tháng sổ.
   *
   *  Ném lỗi khi bảng line không hợp lệ — bảng đó là DỮ LIỆU người sửa được
   *  trên Console, không đi qua bộ kiểm của repo, nên nó sai thì phải nổ chứ
   *  không được trả một bảng thiếu line (CLAUDE.md — "Nguồn hỏng thì BÁO
   *  LỖI"). */
  async gopTheoLine(cayKy, bangLine) {
    return gopTheoLine(cayKy, bangLine);
  }

  /** Cây `bc/ky` → dữ liệu cho "màn mở" (sức khoẻ kinh doanh toàn công ty,
   *  P2(b) bước 1): doanh số + số đơn theo ngày/tháng/năm, mỗi đơn vị tách
   *  theo năm để màn hình chồng "năm nay" lên "cùng kỳ năm ngoái". Xem
   *  `gop-theo-thoi-gian.mjs` cho toàn bộ luật.
   *
   *  Lên TRƯỚC lượt Gateway gọi nó (bẫy số 4, như `gopTheoLine` ở trên) —
   *  đúng lượt merge này. */
  async gopSucKhoeCongTy(cayKy) {
    return gopSucKhoeCongTy(cayKy);
  }
}
