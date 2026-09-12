/* Vỏ Worker của Report Engine — MỎNG. Nghiệp vụ thật không nằm trong file
 * này: nó nằm ở các module thuần bên cạnh (`gop-ban-hang.mjs`), không import
 * gì của Cloudflare, để còn kiểm được bằng Node — đúng mẫu price-engine bên
 * Tracking. File này chỉ MỞ CỬA cho Gateway gọi qua Service Binding.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import { gopSoBanHang } from "./gop-ban-hang.mjs";
import { gopTheoLine, gopLineTheoThoiGian } from "./line.mjs";
import { gopSucKhoeCongTy } from "./gop-theo-thoi-gian.mjs";
import {
  xuLySoBanHang, phamViCayKy, kiemPhuSong, doiChieuKy, dungBangDon, tomTatLine,
} from "./dong-hang.mjs";
import {
  khoaTenHang, khopMaChoBangDon, dienGiaNhap, kyCoKhopMa, maCanGiaVon,
} from "./khop-ma.mjs";

/** Số phiên bản nghiệp vụ Engine — Gateway ghi vào nhật ký cùng mỗi kết quả
 *  khi có nghiệp vụ thật; P1 dùng nó chỉ để chứng minh dây đã nối. */
const PHIEN_BAN = "0.7.0-p4-gia-von";

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

  /** Cây `bc/ky` + bảng line → doanh số/số đơn của TỪNG LINE theo tháng và
   *  theo năm, cho bảng xếp hạng Line trên Dashboard. Xem `line.mjs`.
   *
   *  Tách khỏi `gopSucKhoeCongTy()` chứ không nhét thêm tham số vào đó: hàm
   *  kia không cần biết gì về line, và đổi chữ ký một hàm Gateway đang gọi
   *  thật là tự chuốc đúng bẫy số 4 vào người.
   *
   *  Lên TRƯỚC lượt Gateway gọi nó — đúng lượt merge này. */
  async gopLineTheoThoiGian(cayKy, bangLine) {
    return gopLineTheoThoiGian(cayKy, bangLine);
  }

  /* ─────────── P3 — tải sổ qua trình duyệt, nối dài dữ liệu ───────────
   *
   * Sáu hàm dưới đây lên TRƯỚC lượt Gateway gọi chúng (bẫy số 4 —
   * ROADMAP.md: hai Worker build SONG SONG khi merge, nên hàm Engine phải
   * có mặt ở một lượt merge riêng trước đó). Lượt này là lượt "lên trước".
   */

  /** Một lượt tải sổ: ma trận ô thô → tổng theo (kỳ, nhân viên, ngày) VÀ
   *  từng dòng hàng, khách, IMEI. Xem `dong-hang.mjs`.
   *
   *  Ném lỗi khi bố cục sổ sai — Gateway phải trả lỗi cho người tải file,
   *  không trả một bảng rỗng (CLAUDE.md — "Nguồn hỏng thì BÁO LỖI"). */
  async xuLySoBanHang(bang) {
    return xuLySoBanHang(bang);
  }

  /** `bc/ky/<kỳ>` đang có → khoảng ngày nó phủ, để canh lượt đè. */
  async phamViCayKy(cayKyMotKy) {
    return phamViCayKy(cayKyMotKy);
  }

  /** File mới có phủ trọn dữ liệu cũ của từng kỳ không. Không phủ thì cả
   *  lượt tải bị từ chối — nếu cho ghi, phần ngày thiếu biến mất lặng lẽ. */
  async kiemPhuSong(phamViMoi, phamViCu) {
    return kiemPhuSong(phamViMoi, phamViCu);
  }

  /** So dòng cũ ↔ dòng mới của một kỳ, và trả luôn cây dòng cuối cùng để
   *  ghi. Dòng đã sửa tay thì KHÔNG bị đè — quyết định của người không bao
   *  giờ thua một lượt tải file (CLAUDE.md — "Nhập sổ"). */
  async doiChieuKy(dongCu, dongMoi, khoaDaSua) {
    return doiChieuKy(dongCu, dongMoi, khoaDaSua);
  }

  /** Dòng hàng của một kỳ → bảng đơn hàng đã nhóm theo ngày và số chứng từ,
   *  đã gộp chiết khấu thành một dòng, đã tính sẵn mọi con số. Trình duyệt
   *  chỉ việc vẽ ra (LUẬT SỐ 1). */
  async dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem) {
    return dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem);
  }

  /** Kỳ này có những line nào, mỗi line bao nhiêu đơn — để dựng tab con. */
  async tomTatLine(dongCuaKy, bangLine) {
    return tomTatLine(dongCuaKy, bangLine);
  }

  /* ─────────── P4 — khớp mã sản phẩm với bảng giá Tracking ───────────
   *
   * Hai hàm dưới đây lên TRƯỚC lượt Gateway gọi chúng (bẫy số 4). Lượt này
   * là lượt "lên trước"; Gateway nối vào ở lượt merge sau.
   */

  /** Bảng đơn hàng ĐÃ ĐIỀN mã bảng giá, hãng, ngành hàng — cộng bản kê "còn
   *  bao nhiêu tên chưa có mã, vì lý do gì". Xem `khop-ma.mjs` cho bốn bậc
   *  khớp và lý do khớp theo biên từ.
   *
   *  `nguonTracking` = ba nhánh `/api/xuat/` đã chiếu ra (`board`, `alias`,
   *  `inv_map`) — Gateway đi lấy, Engine chỉ tính. Khoá `X-Report-Key` vì vậy
   *  không bao giờ có mặt trong Worker này.
   *
   *  GỘP với `dungBangDon()` thay vì thêm một hàm nhận lại bảng vừa dựng:
   *  đổi chữ ký một hàm Gateway đang gọi thật là tự chuốc bẫy số 4, còn bắn
   *  cả bảng qua Service Binding hai lượt là trả giá băng thông cho đúng một
   *  phép gộp. `dungBangDon()` cũ KHÔNG đổi một dòng nào.
   *
   *  Ném lỗi khi bảng giá Tracking rỗng hay sai kiểu — Gateway phải trả lỗi
   *  cho màn hình, không trả một bảng "mọi dòng đều chưa khớp" (CLAUDE.md —
   *  "Nguồn hỏng thì BÁO LỖI"). */
  async dungBangDonKemMa(dongCuaKy, khachCuaKy, bangLine, lineMuonXem, nguonTracking, ky, minNgay) {
    const bang = khopMaChoBangDon(
      dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem), nguonTracking, ky);
    /* Giá vốn chỉ có nghĩa sau khi đã khớp mã, nên hai việc đi liền trong một
       lượt. `minNgay` vắng mặt (Gateway chưa lấy được, hoặc kỳ ngoài phạm vi)
       thì bỏ qua — cột Giá nhập ở lại "—", KHÔNG thành 0. */
    if (minNgay) dienGiaNhap(bang, minNgay);
    return bang;
  }

  /** Kỳ này có nằm trong phạm vi khớp mã / giá vốn không.
   *
   *  Gateway hỏi TRƯỚC khi đi lấy dữ liệu Tracking: kỳ ngoài phạm vi thì
   *  không cần kéo bảng giá (~400 KB) lẫn Min theo ngày về làm gì. Mốc là
   *  một LUẬT NGHIỆP VỤ nên nó ở Engine, không chép sang Gateway. */
  async kyCoKhopMa(ky) {
    return kyCoKhopMa(ky);
  }

  /** Tập mã bảng giá cần hỏi Min theo ngày cho một kỳ.
   *
   *  Gateway gọi hàm này TRƯỚC `POST /api/min-ngay` — hợp đồng bên đó nhận
   *  một TẬP MÃ chứ không nhận "tất cả", và phép khớp tên → mã là luật nghiệp
   *  vụ nên nó ở Engine. */
  async maCanGiaVon(dongCuaKy, nguonTracking, ky) {
    return maCanGiaVon(dongCuaKy, nguonTracking, ky);
  }

  /** Khoá `inv/map` của một câu tên hàng.
   *
   *  Gateway hỏi Engine thay vì tự tính: công thức khoá là một LUẬT KHỚP MÃ,
   *  và luật thì ở Engine (LUẬT SỐ 1). Gateway dùng nó để đối chiếu với khoá
   *  mà `POST /api/inv-map` của Tracking dội lại — hai bên lệch công thức thì
   *  lộ ra ngay ở lượt ghi đầu tiên, không phải lúc giá vốn đã sai. */
  async khoaTenHang(ten) {
    return khoaTenHang(ten);
  }
}
