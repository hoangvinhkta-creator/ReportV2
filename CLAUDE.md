# CLAUDE.md — Báo cáo Kinh doanh V2

## App này là gì

Công cụ nội bộ Tín Phát: nhập sổ bán hàng xuất từ MISA, trả ra doanh thu,
giá vốn, lợi nhuận, số liệu theo nhân viên và mặt hàng. Dùng chung Firebase
Realtime Database với hai app đang chạy: Tracking (bảng giá, tồn kho) và
Marketing. Người dùng: Quản trị và Quản lí.

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

Tên hàng trên sổ bán không khớp mã bảng giá thì ĐƯA VÀO HÀNG CHỜ cho người
gán tay. KHÔNG đoán, không so gần đúng, không rút mã từ tên.

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
