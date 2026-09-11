/* Vỏ Worker của Report Engine — MỎNG. Nghiệp vụ thật không nằm trong file
 * này: nó nằm ở các module thuần bên cạnh (`gop-ban-hang.mjs`), không import
 * gì của Cloudflare, để còn kiểm được bằng Node — đúng mẫu price-engine bên
 * Tracking. File này chỉ MỞ CỬA cho Gateway gọi qua Service Binding.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import { gopSoBanHang } from "./gop-ban-hang.mjs";

/** Số phiên bản nghiệp vụ Engine — Gateway ghi vào nhật ký cùng mỗi kết quả
 *  khi có nghiệp vụ thật; P1 dùng nó chỉ để chứng minh dây đã nối. */
const PHIEN_BAN = "0.2.0-p2";

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
}
