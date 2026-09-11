/* Vỏ Worker của Report Engine — MỎNG, P1 chỉ chứng minh Gateway gọi được
 * Engine qua Service Binding. Nghiệp vụ thật (doanh thu, giá vốn, lợi
 * nhuận...) bắt đầu từ P2 — khi đó thêm hàm vào đây và tách phần tính toán
 * ra một file `nghiepvu.js` riêng, không import gì của Cloudflare, để còn
 * kiểm được bằng Node (sao lại mẫu price-engine bên Tracking).
 */
import { WorkerEntrypoint } from "cloudflare:workers";

/** Số phiên bản nghiệp vụ Engine — Gateway ghi vào nhật ký cùng mỗi kết quả
 *  khi có nghiệp vụ thật; P1 dùng nó chỉ để chứng minh dây đã nối. */
const PHIEN_BAN = "0.1.0-p1";

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
}
