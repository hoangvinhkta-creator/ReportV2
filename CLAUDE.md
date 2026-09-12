# CLAUDE.md — Báo cáo Kinh doanh V2

## App này là gì

Công cụ nội bộ Tín Phát: nhập sổ bán hàng xuất từ MISA, trả ra doanh thu,
giá vốn, lợi nhuận, số liệu theo nhân viên và mặt hàng. Dùng chung Firebase
Realtime Database với hai app đang chạy: Tracking (bảng giá, tồn kho) và
Marketing. Người dùng: Quản trị và Quản lí.

**Trước khi làm bất cứ việc gì, đọc `ROADMAP.md`** — đó là trạng thái
sống, nói đang ở phase nào và việc tiếp theo là gì. File này chỉ có luật;
tiến độ nằm ở `ROADMAP.md`, không nằm ở đây.

Bối cảnh đầy đủ (audit hai repo cũ, lý do các quyết định dưới đây, lộ
trình chín phase): `docs/audit/2026-09-11-audit-reports-tracking.md`.

## LUẬT SỐ 1 — Nghiệp vụ nằm ở backend

Trình duyệt chỉ làm hai việc: hiển thị, và nhận thao tác của người dùng.

ĐƯỢC phép ở frontend:
- dựng giao diện, bảng, biểu đồ từ số ĐÃ TÍNH SẴN mà backend trả về
- đọc file .xlsx người dùng chọn rồi gửi lên
- kiểm tra hình thức trước khi gửi (ô trống, sai định dạng ngày)

KHÔNG được ở frontend, không có ngoại lệ:
- công thức tính tiền — giá vốn, lợi nhuận, hoa hồng, KPI, quy đổi
- luật phân loại, luật khớp mã hàng, luật chọn giá theo ngày bán
- đọc hay ghi thẳng Realtime Database
- bất kỳ khoá, token, chuỗi kết nối nào

Kiểm tra nhanh: mở Ctrl+U trên trang đã deploy. Nếu đọc được cách tính ra
một con số tiền, thì chỗ đó đặt sai.

## Kiến trúc — ba mảnh

```
trang tĩnh (public/)     chỉ hiển thị, gọi Gateway bằng Firebase ID token
      ↓
Gateway Worker           xác minh token, tra vai trong profiles/<uid>,
                         là NƠI DUY NHẤT chạm Firebase
      ↓  service binding (không route public, không workers.dev)
Engine Worker            nghiệp vụ và thuật toán
```

Ba nhánh dữ liệu, ba mức mở:

```
bc/ky/<kỳ>          số liệu đã tính sẵn    .read: quantri | quanly
bc/quyetdinh/…      chỉnh sửa tay          .read: quantri | quanly, ghi qua Gateway
bc/khach/<mã đơn>   tên, SĐT, địa chỉ      .read: false  .write: false
bc/imei/<imei>      bảng tra bảo hành      .read: false  .write: false
```

Hai nhánh cuối đóng với MỌI vai, kể cả admin — Firebase này dùng chung với
app Marketing. Chỉ tài khoản dịch vụ của Worker chạm được (nó đi vòng qua
rules; `min_ngay` bên Tracking đã chạy đúng kiểu này từ lâu). Trình duyệt
không bao giờ đọc thẳng hai nhánh đó; muốn tra thì hỏi Gateway.

## Nhập sổ — đè toàn kỳ, nhưng không mất chỉnh sửa tay

Nhập lại một kỳ thì ĐÈ nhánh `bc/ky`. Chỉnh sửa tay nằm nhánh riêng, KHÔNG
bị đè, và được hợp nhất lúc ĐỌC — không trộn lúc ghi. "Engine tính ra gì"
và "người quyết định gì" không bao giờ thành một con số không nhãn.

Khoá phải BỀN qua lần nhập lại. Không bao giờ dùng số thứ tự dòng.

```
quyết định về MỘT DÒNG     khoá = (số chứng từ, tên hàng chuẩn hoá,
                                   lần xuất hiện thứ mấy trong chứng từ)
quyết định về MỘT MẶT HÀNG khoá = tên hàng đã chuẩn hoá
                           → áp cho MỌI kỳ, kể cả kỳ chưa nhập
```

Sau mỗi lần đè, màn hình phải nói rõ có bao nhiêu quyết định cũ không còn
dòng nào để áp, kèm danh sách. Không im lặng bỏ qua.

## Khớp mã hàng — dùng lại của Tracking, đừng viết mới

Chỉ cần cho GIÁ VỐN/LỢI NHUẬN — **P4** trong `ROADMAP.md` ("Phân tích giá
vốn"), là nơi bài toán khớp tên hàng thật sự chạm vào lần đầu. Doanh số và
số đơn theo nhân viên/ngày (P2, P3, P5, P7) lấy thẳng từ sổ thô, KHÔNG cần
khớp mã hàng — đừng kéo cơ chế này vào sớm hơn P4.

Tên hàng trên sổ bán không khớp mã bảng giá thì ĐƯA VÀO HÀNG CHỜ cho người
gán tay. KHÔNG đoán, không so gần đúng, không Levenshtein, không "chắc là
cái này".

**Máy được khớp tự động đúng hai cách, không có cách thứ ba** (chủ dự án
chốt 12/09/2026, sau khi được hỏi thẳng giữa hai phương án):

1. Khoá tên hàng đã có quyết định trong `inv/map` của Tracking — đó là
   quyết định của NGƯỜI, không phải máy đoán. Luôn thắng cách 2.
2. Một mục bảng giá (mã, `name`, hoặc một `alt`) xuất hiện trong tên như
   một **cụm từ liên tiếp trọn vẹn**, và ra ĐÚNG MỘT mã. Tìm được 0 mã
   hoặc ≥2 mã thì xuống hàng chờ.

   Cách 2 có **hai dạng**, khác nhau đúng ở chỗ trần độ dài:

   - **Nguyên câu bằng sạch** — tên hàng chuẩn hoá BẰNG ĐÚNG một mục bảng
     giá. KHÔNG có trần độ dài.
   - **Cụm nằm trong câu** — mục bảng giá dài tối đa 8 từ mới được đem đi
     dò làm cụm con.

   Trần 8 từ sinh ra để một mục từ điển DÀI không nuốt mất mấy từ thường
   gặp trong câu văn xuôi của sổ. Với phép so nguyên câu thì mối lo ấy
   không tồn tại — không còn chữ nào thừa ra để mà nuốt — nên trần không
   áp vào đó. Một mục dài vì vậy CHỈ khớp được bằng sạch, không bao giờ
   làm cụm con trong một câu dài hơn.

   Vì sao cần dạng thứ nhất (gặp thật 12/09/2026): màn Tồn kho của
   Tracking có nhánh "thêm mã mới" ghi `board/<mã>` bằng NGUYÊN CÂU tên
   hàng trong file tồn — ví dụ `"GIÁ TREO TIVI ĐA NĂNG ERGOTEK E66 32 -
   80 INCH"`, mười từ. Dòng bán mang đúng y nguyên câu ấy mà vẫn rơi
   xuống hàng chờ; rồi ở hàng chờ gán tay cũng không xong, vì chính mặt
   hàng đó đang là dòng tồn kho hoạt động nên chốt NB-2 bên Tracking từ
   chối lượt ghi. Người dùng kẹt giữa hai màn hình còn con số thì đứng
   đó không ai đọc được.

Dòng này trước đây ghi "không rút mã từ tên". Bản đó đúng chữ nhưng vô
dụng trên dữ liệu thật: tên trên sổ MISA là văn xuôi (`"Chân máy giặt Đa
Năng - chiều"`), không bao giờ bằng một mã trần (`"SJ-X198V-DG"`), nên
so cả câu thì gần như mọi dòng đều phải gán tay. Chủ dự án duyệt việc
vượt; phần còn lại của kỷ luật KHÔNG đổi.

**Cách 2 chạy trên BIÊN TỪ, không bao giờ trên chuỗi con.** `65C6K` và
`65C6KS` là hai model khác nhau. Dò chuỗi con thì `"65C6KS"` chứa
`"65C6K"` — một chiếc tivi bị gán sang model khác, im lặng, và sai tiền.
Câu phải được cắt thành từ trước rồi mới so cả token. Có bài kiểm ghim
đúng ca này (`kiem/khop-ma.js`), kể cả ca hiểm nhất: mã dài KHÔNG có
trên bảng giá, lúc đó không có phép "nhiều mã" nào cứu.

Kèm một rào: cụm khớp phải có ít nhất một CHỮ SỐ. Mất một khớp đúng thì
dòng xuống gán tay; khớp sai thì sai tiền.

Màn gán đã có sẵn bên Tracking và được dựng đúng cho việc này. Hai lựa
chọn, không có lựa chọn thứ ba: một mã ĐÃ CÓ trên bảng giá, hoặc "bỏ qua".
Cần mã mới thì thêm bên Bảng giá trước rồi quay lại chọn.

## Nguồn dữ liệu giá

Giá vốn theo ngày bán đọc từ Tracking qua `POST /api/min-ngay`, khoá đi ở
header `X-Report-Key`. Bảng giá và nhãn thương hiệu đọc qua `GET /api/xuat/`.
KHÔNG dựng bộ phân loại thương hiệu thứ hai — Tracking đã có danh sách
đóng và khớp nguyên từ.

Nguồn hỏng thì BÁO LỖI, không bao giờ trả rỗng. Một sự cố mạng không được
phép nói "không có đơn nào" thay người.

## Quy ước viết

- Mọi văn xuôi trong repo viết tiếng Việt: chú thích, tài liệu, lý do.
- Giữ nguyên tiếng Anh: tên file, tên hàm, tên trường dữ liệu.
- Chú thích giải thích VÌ SAO, không mô tả lại code đang làm gì.
- Chạy `npm test` trước mỗi lần đẩy. Bộ kiểm hỏng là build hỏng.

## Làm từng bước

Mỗi lần làm một lát cắt DỌC — từ ô nhập xuống nơi lưu rồi quay lại màn
hình — rồi deploy để chủ dự án mở bằng máy thật. Không xây engine trước
rồi dựng giao diện sau; đó đúng là cách V1 hỏng.

Không chắc một quy tắc nghiệp vụ thì HỎI, đừng đoán rồi viết tiếp.

## Quy trình Git — merge thẳng, không hỏi lại, không review độc lập

Dự án nội bộ một người dùng. KHÔNG áp bộ governance kiểu V1 (ready gate,
completion gate, independent review, repair cycle) — chủ dự án đã từ chối
việc đó có chủ đích (xem `ROADMAP.md`, Q6).

Luật duy nhất: làm việc trên một nhánh, xong một lát cắt (theo đúng "Ra
khỏi phase khi" / "Bạn nhìn thấy gì" của phase đang làm trong
`ROADMAP.md`) và `npm test` xanh thì **tạo PR nhắm nhánh mặc định rồi
merge NGAY** — không hỏi lại, không chờ duyệt, không có bước review nào
chen giữa. Đây là thẩm quyền đã được trao trước, không phải việc cần xin
phép mỗi lần.

Chủ dự án review bằng cách **tự mở sản phẩm đã chạy thật** sau khi merge,
không review qua PR/diff. Phát hiện lỗi sau merge là một REPAIR bình
thường — sửa, `npm test` xanh, PR, merge tiếp. Không rollback nghi lễ,
không mở lại một chu trình duyệt nào.

Việc DUY NHẤT vẫn cần hỏi trước khi làm: bất cứ điều gì trong CLAUDE.md
này ghi KHÔNG được, hoặc một quyết định nghiệp vụ chưa có câu trả lời rõ
(xem "Làm từng bước" ở trên).
