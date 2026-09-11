# Prompt mở session P3 — tải sổ theo thời điểm, nối dài dữ liệu

Chép nguyên khối trong ô dưới vào một session Claude Code MỚI trên repo
`hoangvinhkta-creator/ReportV2`. Viết sẵn 11/09/2026, ngay sau khi P2 phần
(a) xong và P2 phần (b) tách nhánh riêng.

**Trước khi dùng, đọc `ROADMAP.md` mục "Hai nhánh chạy SONG SONG — P2(b)
và P3"** — ba chỗ đụng file và ai sở hữu chỗ nào nằm ở đó.

---

```
Repo: hoangvinhkta-creator/ReportV2 (nhánh main)

Đọc CLAUDE.md và ROADMAP.md ở gốc repo trước, theo đúng thứ tự đó. Trong
ROADMAP.md, đọc kỹ hai mục: "Hai nhánh chạy SONG SONG — P2(b) và P3", và
"Năm cái bẫy đã trả giá ở P1".

Việc cần làm: P3 — Cơ chế tải file doanh số theo thời điểm, nối dài dữ
liệu. Mục tiêu: từ tháng 09/2026 trở đi, sổ bán hàng được tải lên QUA
TRÌNH DUYỆT, không phải bằng script chạy tay như P2.

BỐI CẢNH ĐÃ CÓ — nhận nguyên, đừng dựng lại:

- `engine/src/gop-ban-hang.mjs` — hàm gộp dùng chung, ĐÃ CHẠY THẬT trên
  40.118 dòng của hai sổ 2025+2026. Mọi luật nghiệp vụ nằm ở đây: bố cục
  sổ, cột nào là gì, dòng nào bỏ, tiền tính thế nào, một "đơn" là gì.
  P3 GỌI LẠI ĐÚNG HÀM NÀY. Không viết bản thứ hai — đó là cả lý do nó
  được tách ra từ P2.
- `engine/src/line.mjs` — tầng LINE (10 kênh cố định xuyên thời gian,
  bảng ánh xạ ở `bc/quyetdinh/line`). Sổ 09/2026 nạp vào sẽ tự rơi đúng
  line vì tên nhân viên mới đã khai sẵn (`Fanpage 0327339229`,
  `Shopee 0865111033`). Không phải sửa gì ở tầng này.
- Engine đã MỞ SẴN `gopSoBanHang()` và `gopTheoLine()` qua Service
  Binding. Gateway gọi được ngay, không phải chờ lượt merge nào.
- `bc/ky/2025-01/…` tới `bc/ky/2026-08/…` đã có số thật trên Firebase.
  P3 phải NỐI TIẾP vào đúng chuỗi đó, cùng hạt
  `bc/ky/<YYYY-MM>/<nhân viên>/<ngày>` = `{doanh_so, so_don}`.

VIỆC CỦA P3:

1. Trình duyệt cho chọn file .xlsx, đọc nó ra MA TRẬN Ô THÔ rồi gửi lên
   Gateway. CLAUDE.md cho phép trình duyệt đọc file — nhưng CHỈ đọc ra ô,
   KHÔNG được diễn giải: cột nào là nhân viên, dòng nào bỏ, tiền tính thế
   nào đều là việc của Engine. Trình duyệt không biết cột 12 là gì.
2. Gateway nhận, xác minh token + vai (quantri/quanly như `/api/me` đang
   làm), gọi Engine `gopSoBanHang()`, rồi PUT trọn kỳ vào `bc/ky/<kỳ>`.
3. Đè toàn kỳ, đúng CLAUDE.md mục "Nhập sổ": tải lại một kỳ thì ĐÈ, không
   cộng dồn. Chỉnh sửa tay ở `bc/quyetdinh` KHÔNG bị đè.
4. Màn hình phải nói rõ sau mỗi lượt tải: mấy dòng đọc được, mấy dòng bỏ,
   tổng doanh số, số đơn, và MỌI cảnh báo `gopSoBanHang()` trả về (thiếu
   nhân viên, thiếu ngày, tiền không đọc được, đối chiếu nội bộ lệch).
   Đối chiếu nội bộ lệch thì KHÔNG ĐƯỢC GHI — script chạy tay đang chặn
   đúng như vậy, đường upload phải chặn y hệt.

BA CHỖ ĐỤNG VỚI NHÁNH P2(b) ĐANG CHẠY SONG SONG — đọc kỹ mục "Hai nhánh
chạy SONG SONG" trong ROADMAP.md rồi hãy sửa:

- `src/index.js` cửa chặn method: Gateway đang trả 405 cho MỌI method
  khác GET/HEAD. P3 SỞ HỮU chỗ này, phải nới đúng một đường cho POST.
  `kiem/dinh-tuyen.js` bài 1 đang canh "POST bị 405 ở khắp nơi" — sửa bộ
  kiểm đó cho khớp, và giữ nguyên phép canh cho mọi đường KHÁC.
- `src/index.js` bảng `API_ROUTES`: chỉ THÊM một dòng. Đừng sắp xếp lại
  bảng, đừng đổi thứ tự dòng đang có.
- `public/index.html`: chỉ thêm MỘT thẻ `<script src="tai-len.js">` và
  MỘT `<section id="man-tai-len" hidden>`. Toàn bộ logic vào
  `public/tai-len.js`. KHÔNG viết vào khối `<script>` inline đang có.
  `kiem/luat-so-1.js` đã soi sẵn file .js rời, nên tách file không làm hở
  lưới.

GIỚI HẠN KỸ THUẬT PHẢI TÍNH TRƯỚC: một sổ tháng khoảng 1.500–2.600 dòng
(~2 MB .xlsx). Worker có giới hạn CPU/bộ nhớ cho mỗi request — ROADMAP đã
ghi rõ lý do P2 cố ý KHÔNG parse file trong Worker. Hãy tự đo và tự quyết:
gửi ma trận ô lên (JSON có thể vài MB) có lọt không, hay phải cắt lô. Đo
thật trên một sổ thật rồi hãy chốt, đừng đoán.

Chủ dự án CHƯA có sổ 09/2026 (tháng 9 chưa hết). Nên hãy kiểm bằng sổ
08/2026 đang có — tải lên rồi đối chiếu: kết quả phải TRÙNG KHÍT với số
đang nằm ở `bc/ky/2026-08` (đã nạp bằng script). Đó là phép kiểm mạnh
nhất cho P3: hai đường khác nhau (script chạy tay và upload qua UI) phải
ra cùng một con số, vì cả hai gọi cùng một hàm.

Không chắc một quy tắc nghiệp vụ thì HỎI, đừng đoán rồi viết tiếp.
Test xanh + tự xác nhận được đúng "Bạn nhìn thấy gì" của P3 → tạo PR,
merge NGAY vào main theo "Quy trình Git" trong CLAUDE.md, không hỏi lại.
Trước khi kết thúc phiên: cập nhật "Trạng thái hiện tại" trong ROADMAP.md.
```

---

## Ghi chú cho chủ dự án

**Khi nào mở session này:** mở được ngay, không phải chờ P2(b). Hai nhánh
độc lập.

**Một việc nên làm trước:** nạp lại `bc/ky` cho đúng `LUAT_DOANH_SO` mới
(`tru-chiet-khau`) — xem khung cảnh báo ở ROADMAP.md. Nếu chưa nạp lại,
phép kiểm cuối của P3 ("tải sổ 08/2026 lên phải trùng khít số đang có")
sẽ lệch đúng phần chiết khấu, và session P3 sẽ tưởng mình sai.
