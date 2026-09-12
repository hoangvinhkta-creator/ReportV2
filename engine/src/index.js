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
  khoaTenHang, khopMaChoBangDon, dienGiaNhap, kyCoKhopMa, maCanGiaVon, cachVietMa,
} from "./khop-ma.mjs";
import { apDungSuaTay, tinhTruDaXoa, truVaoCayKy } from "./sua-tay.mjs";
import { ghepBTL, apDungBTL } from "./btl.mjs";
import { apDungKpi, hanhKpi, kiemBangKpi, BANG_KPI_HAT_GIONG } from "./kpi.mjs";
import { apDungBonus, LY_DO_BONUS } from "./bonus.mjs";
import { khoaNhanVien } from "./gop-ban-hang.mjs";

/** Số phiên bản nghiệp vụ Engine — Gateway ghi vào nhật ký cùng mỗi kết quả
 *  khi có nghiệp vụ thật; P1 dùng nó chỉ để chứng minh dây đã nối. */
const PHIEN_BAN = "0.11.0-hat-giong-kpi";

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
  async dungBangDonKemMa(dongCuaKy, khachCuaKy, bangLine, lineMuonXem, nguonTracking,
                         ky, minNgay, quyetDinh, bangKpi, giaDung, doanhSoLineKyTruoc,
                         bangCong, quyetDinhBonus) {
    const bang = khopMaChoBangDon(
      dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem), nguonTracking, ky);
    /* BÁN TRẢ LẠI chạy TRƯỚC `dienGiaNhap`: nó sửa SỐ LƯỢNG (về 0 hoặc −1),
       mà giá vốn thì nhân với số lượng. Phép ghép tự chạy trên TOÀN kỳ
       (`dongCuaKy`, chưa lọc line) để tab line nào cũng ra cùng một kết quả —
       xem `btl.mjs`. */
    apDungBTL(bang, ghepBTL(dongCuaKy, khachCuaKy));
    /* Giá vốn chỉ có nghĩa sau khi đã khớp mã, nên hai việc đi liền trong một
       lượt. `minNgay` vắng mặt (Gateway chưa lấy được, hoặc kỳ ngoài phạm vi)
       thì bỏ qua — cột Giá nhập ở lại "—", KHÔNG thành 0. */
    if (minNgay) dienGiaNhap(bang, minNgay);
    /* SỬA TAY LÀ LỚP CUỐI. Nó phải thắng mọi con số máy vừa tính ra — chủ dự
       án chốt "sửa tay luôn thắng". Chạy trước `dienGiaNhap` thì lượt điền tự
       động sẽ đè ngược lại chính quyết định của người. */
    apDungSuaTay(bang, quyetDinh);
    /* BONUS đứng SAU sửa tay và TRƯỚC quy đổi, và cả hai vế đều bắt buộc:
       sau sửa tay vì nó cộng vào `don.loi_nhuan` mà sửa tay đổi giá nhập tức
       đổi lợi nhuận; trước quy đổi vì quy đổi chia chính con số ấy. Đặt sai
       một vế là bonus không vào được doanh số quy đổi — đúng thứ chủ dự án
       yêu cầu nó phải vào. */
    apDungBonus(bang, quyetDinhBonus);
    /* DOANH SỐ QUY ĐỔI chạy CUỐI CÙNG, sau cả sửa tay — vì nó chia chính
       `loi_nhuan`, mà sửa tay thì đổi giá nhập, tức đổi lợi nhuận. Chạy trước
       sửa tay là quy đổi một con số đã bị người thay thế. */
    /* `doanhSoLineKyTruoc` đứng CUỐI, cùng lý do `ky` đứng cuối ở hàm dưới:
       hai Worker build SONG SONG khi merge (bẫy số 4 — ROADMAP.md), nên chèn
       vào giữa là bản Gateway cũ gọi lệch chỗ mọi tham số sau đó. Ở đuôi thì
       bản cũ vẫn gọi đúng, chỉ là chưa truyền — và cột "Vs. Tháng trước" để
       trống đúng một khoảng giữa hai lượt deploy, không sai số nào. */
    apDungKpi(bang, bangKpi, ky, giaDung,
      bangLine && Array.isArray(bangLine.thu_tu) ? bangLine.thu_tu : null,
      doanhSoLineKyTruoc, bangCong);
    return bang;
  }

  /** Bảng đơn cho kỳ NGOÀI phạm vi khớp mã — vẫn phải áp sửa tay.
   *
   *  Kỳ trước 09/2026 không có giá vốn theo ngày, nhưng một dòng bị XOÁ TAY
   *  thì vẫn phải biến khỏi bảng và khỏi mọi tổng. Gateway đi đường này khi
   *  nó không lấy dữ liệu Tracking (ngoài phạm vi, hoặc Tracking hỏng). */
  async dungBangDonSuaTay(dongCuaKy, khachCuaKy, bangLine, lineMuonXem, quyetDinh,
                          bangKpi, giaDung, ky, doanhSoLineKyTruoc, bangCong,
                          quyetDinhBonus) {
    /* BTL chạy ở CẢ đường này: nó là luật đọc SỔ, không phụ thuộc bảng giá
       Tracking. Kỳ ngoài phạm vi khớp mã vẫn phải trừ đúng một lượt trả hàng. */
    const bang = apDungBTL(
      dungBangDon(dongCuaKy, khachCuaKy, bangLine, lineMuonXem),
      ghepBTL(dongCuaKy, khachCuaKy));
    apDungSuaTay(bang, quyetDinh);
    /* BONUS đứng SAU sửa tay và TRƯỚC quy đổi, và cả hai vế đều bắt buộc:
       sau sửa tay vì nó cộng vào `don.loi_nhuan` mà sửa tay đổi giá nhập tức
       đổi lợi nhuận; trước quy đổi vì quy đổi chia chính con số ấy. Đặt sai
       một vế là bonus không vào được doanh số quy đổi — đúng thứ chủ dự án
       yêu cầu nó phải vào. */
    apDungBonus(bang, quyetDinhBonus);
    /* `ky` đứng CUỐI dù nó là tham số tự nhiên thứ nhất của phép tra hệ số:
       thêm vào giữa là đổi chữ ký một hàm Gateway đang gọi THẬT, tức tự
       chuốc bẫy số 4 vào người (ROADMAP.md — hai Worker build song song khi
       merge). Đuôi thì bản Gateway cũ vẫn gọi đúng, chỉ là chưa truyền.

       Đường này KHÔNG có lợi nhuận (kỳ ngoài phạm vi giá vốn) nên quy đổi ra
       null hết. Vẫn gọi, có chủ đích: `tom_tat_kpi` còn mang doanh số thuần
       theo line và MỨC KPI của từng line, nên tab [Tổng hợp] của một tháng
       cũ hiện được bảng thật kèm câu "chưa có quy đổi" — thay vì một ô trống
       không giải thích. */
    apDungKpi(bang, bangKpi, ky, giaDung,
      bangLine && Array.isArray(bangLine.thu_tu) ? bangLine.thu_tu : null,
      doanhSoLineKyTruoc, bangCong);
    return bang;
  }

  /** Phần doanh số / số đơn phải trừ khỏi `bc/ky/<kỳ>` vì đã xoá tay.
   *
   *  Tách khỏi `truVaoCayKy` vì hai việc ở hai chỗ: cái này cần `bc/dong` của
   *  ĐÚNG kỳ có quyết định (Gateway chỉ đọc những kỳ ấy, không đọc cả 20 kỳ),
   *  còn cái kia chạy trên cây `bc/ky` nhiều kỳ mà Dashboard đã có sẵn. */
  async tinhTruDaXoa(dongCuaKy, quyetDinh) {
    return tinhTruDaXoa(dongCuaKy, quyetDinh, khoaNhanVien);
  }

  /** Cây `bc/ky` nhiều kỳ đã TRỪ phần xoá tay — cho biểu đồ và bảng line.
   *
   *  Chủ dự án chốt 12/09/2026: xoá một dòng thì trừ ở CẢ HAI. Không trừ ở
   *  đây thì bảng đơn và biểu đồ nói hai con số khác nhau cho cùng một tháng,
   *  và không ai biết bên nào đúng. */
  async truVaoCayKy(cayKy, truTheoKy) {
    return truVaoCayKy(cayKy, truTheoKy);
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

  /** Điền CÁCH VIẾT cho danh sách mã của màn gán tay.
   *
   *  Gateway đã có sẵn `board` trong tay và chỉ cần thêm một chuỗi cho mỗi
   *  mục, nên trông như nó tự tính được. Nó KHÔNG được tự tính: phép quyết
   *  "chuỗi này có phải một cách viết của chính mã ấy không" chạy trên
   *  `maHoa()` — đúng công thức khoá `inv/map`, một LUẬT KHỚP MÃ. Chép nó
   *  sang Gateway là dựng bản thứ hai của một công thức mà cả hệ thống đang
   *  dựa vào để không gán nhầm mặt hàng (LUẬT SỐ 1, và cùng lý do
   *  `khoaTenHang` cũng phải hỏi qua đây).
   *
   *  Nhận `{ ma, ten }` chứ không nhận cả `board`: bảng giá ~400 KB, mà thứ
   *  hàm này cần chỉ là hai chuỗi mỗi dòng — và danh sách ấy Gateway vốn
   *  đang dựng sẵn để trả cho trình duyệt. */
  async cachVietDsMa(ds) {
    if (!Array.isArray(ds)) return [];
    return ds.map((m) => {
      const ma = m && m.ma;
      const gia = { [ma]: { name: m && m.ten } };
      return Object.assign({}, m, { hien: cachVietMa(ma, gia) });
    });
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

  /* ─────────── P5 — doanh số quy đổi + KPI theo line ───────────
   *
   * Hai hàm dưới đây lên TRƯỚC lượt Gateway gọi chúng (bẫy số 4). Lượt này
   * là lượt "lên trước"; Gateway nối vào ở lượt merge sau.
   */

  /** Hệ số và KPI đang áp cho một line trong một kỳ, đã hợp nhất mặc định
   *  với bản ghi đè riêng kỳ. Xem `kpi.mjs` cho luật hợp nhất theo TỪNG
   *  TRƯỜNG (đặt riêng KPI tháng 9 thì hệ số vẫn là mặc định).
   *
   *  Gateway gọi sau mỗi lượt GHI để dội lại đúng con số đang áp — màn hình
   *  không tự suy ra "vừa ghi thì chắc là bằng cái vừa gõ", vì luật hợp nhất
   *  là nghiệp vụ và nó ở đây (LUẬT SỐ 1). */
  async hanhKpi(bangKpi, line, ky) {
    return hanhKpi(bangKpi, line, ky);
  }

  /** Bảng KPI có dùng được không — danh sách vấn đề, rỗng là dùng được.
   *
   *  Gateway gọi TRƯỚC một lượt ghi để từ chối một bộ số không dùng được
   *  ngay tại cửa, thay vì để nó nằm trên Firebase rồi mỗi lượt đọc lại phải
   *  bỏ qua. Luật "thế nào là hợp lệ" chỉ có MỘT bản, ở đây. */
  async kiemBangKpi(bang) {
    return kiemBangKpi(bang);
  }

  /** Bộ số KPI / hệ số quy đổi MẶC ĐỊNH chủ dự án chốt 12/09/2026.
   *
   *  Có hàm này để nạp lượt đầu KHÔNG cần khoá service account trên máy ai
   *  cả: Gateway đã giữ `FB_SA_EMAIL`/`FB_SA_KEY` làm Secret, nên nó hỏi
   *  Engine bộ số rồi tự ghi. Trước đó việc nạp bắt buộc phải chạy
   *  `bin/nap-kpi.mjs` dưới máy, tức phải tải khoá riêng về — và chủ dự án
   *  không clone repo trên máy.
   *
   *  Bộ số ở ĐÂY chứ không chép sang Gateway: nó là một quyết định nghiệp vụ
   *  (mục tiêu kinh doanh của từng line), và `kiemBangKpi()` cùng `kiem/kpi.js`
   *  đang canh đúng bản này. Hai bản là hai bản trôi khỏi nhau, mà chỗ trôi ở
   *  đây là mục tiêu của cả công ty lệch đi một cách không ai thấy.
   *
   *  Trả BẢN SAO, không trả chính hằng số: RPC qua Service Binding tuần tự
   *  hoá rồi mới gửi nên bên kia không chạm được vào nó, nhưng một lượt gọi
   *  trong cùng tiến trình (bộ kiểm) thì chạm được — và một bài kiểm sửa
   *  nhầm hằng số sẽ làm bài kế tiếp hỏng theo cách rất khó lần. */
  async bangKpiHatGiong() {
    return JSON.parse(JSON.stringify(BANG_KPI_HAT_GIONG));
  }
}
