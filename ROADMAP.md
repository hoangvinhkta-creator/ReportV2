# ROADMAP — Báo cáo Kinh doanh V2

File này là **trạng thái sống**: mỗi session mới đọc file này TRƯỚC TIÊN để
biết đang ở phase nào, và cập nhật lại đúng phần "Trạng thái hiện tại" khi
kết thúc phiên làm việc. Lý do đầy đủ đằng sau từng quyết định nằm ở
`docs/audit/2026-09-11-audit-reports-tracking.md` — không chép lại ở đây,
chỉ trỏ tới.

Nguyên tắc làm việc: **mỗi phase là một lát cắt dọc**, kết thúc bằng một
thứ deploy được và mở bằng máy thật. Không mở phase kế tiếp khi phase hiện
tại chưa có bằng chứng chạy thật — không phải "code xong", mà là "tự
deploy và tự xác nhận được đúng điều mô tả ở 'Bạn nhìn thấy gì'".

Không cần chờ chủ dự án duyệt trước khi merge (xem `CLAUDE.md` → "Quy
trình Git"): mỗi "Ra khỏi phase khi" dưới đây là điều kiện session TỰ xác
nhận rồi merge thẳng, không phải điều kiện chờ chủ dự án gật đầu. Chủ dự
án xem sản phẩm thật ở thời điểm của họ và yêu cầu repair nếu cần.

---

## Trạng thái hiện tại

**P1 XONG. P2 ĐÃ ĐÓNG (11/09/2026) — chủ dự án đã tự mở Dashboard mới
bằng máy thật và nghiệm thu.** Cả hai phần:

- **Phần (a) — trích + nạp:** dữ liệu 20 tháng (01/2025–08/2026) ĐÃ NẰM
  TRÊN FIREBASE, đã đọc ngược xác nhận khớp từng kỳ. Tầng LINE đã chốt,
  đã code, bảng ánh xạ đã nạp.
- **Phần (b) — biểu đồ:** Dashboard sức khoẻ kinh doanh — 2 biểu đồ
  Doanh số/Số đơn kèm chấm trung bình, vòng cơ cấu theo Line lồng hai kỳ,
  lưới nhỏ xu hướng theo Line + nút chuyển chỉ số. Toàn bộ merge qua PR
  #22, #23, #27, #28, #31, #34, #35, #37, #41, #42; dọn ba field cũ của
  Engine (`theo_ngay`, `theo_nam`, `hai_nam`) sau khi nghiệm thu ở PR #43.

P3 LƯỢT 1 — đường tải sổ qua trình duyệt + danh sách đơn hàng theo line —
ĐÃ MERGE THẲNG (11/09/2026, PR #24 + #25 + #26, cộng một lượt sửa
`bc/khach` theo kỳ + nút xoá kỳ ở mục "P3" dưới). CHỦ DỰ ÁN ĐÃ TỰ MỞ BẰNG
MÁY THẬT VÀ XÁC NHẬN Dashboard theo line hiển thị đúng (ảnh chụp màn hình
thật, sau khi publish rules và chạy lại `nap-line.mjs`).

**Việc tiếp theo:** P3 lượt 2 (sửa/xoá đơn + khoá chống đè + audit trail
— xem "P3 — lượt 2 còn lại" dưới), rồi P4 (giá vốn).**

**BỐ CỤC MÀN HÌNH ĐÃ CHỐT LẠI (11/09/2026, PR #28) — đọc trước khi sửa
`public/index.html`:** không còn lưới thẻ, không còn màn con nào để bấm ra
bấm vào. Đăng nhập xong là ra THẲNG trang báo cáo:

```
Báo cáo bán hàng            [Nhập sổ] [Đăng xuất]   ← nút trên thanh tiêu đề
[2025] [2026]                                       ← tab năm      (P3)
  [Dashboard] [Nội thành] [Tín Phát] …              ← tab con      (P3)
    ┌─ #o-dashboard ────────────────────────┐
    │ [Ngày] [Tháng] [Quý]                  │       ← tab đơn vị   (P2b)
    │ biểu đồ                               │
    │ [T1][T2]…[T12]  /  [2026][2025]  /  — │       ← dải phụ đổi theo tab
    └───────────────────────────────────────┘
    [T07] [T08] [T09]                               ← chọn tháng   (P3)
    bảng đơn hàng của line đang chọn                (P3)
```

Chọn line nào khác Dashboard thì P3 ẩn cả ô `#o-dashboard`. "Nhập sổ" vẫn
mở màn riêng `#manTaiLen` như cũ, chỉ khác chỗ bấm — màn đó nay có thêm
mục "Các kỳ đã có" (chọn kỳ, xoá kỳ) — xem "P3" dưới.

**Hai việc tay đã xong** (rules đã publish, `nap-line.mjs` đã chạy lại) —
xem lịch sử ở "P3 — lượt 1" nếu cần tra lại.

**Việc TRƯỚC MẶT tiếp theo:** P3 lượt 2 (nút sửa/xoá đơn + audit trail) —
xem "P3 — lượt 2 còn lại". Hoặc P2(b) bước 2, xem "Việc còn lại của P2
phần (b)".

Đường dây đã chạy thật đầu-đến-cuối: mở `*.workers.dev` → qua Cloudflare
Access → đăng nhập Firebase → Gateway xác minh token, tra vai, gọi Engine
qua Service Binding → màn chủ hiện tên người dùng và sáu thẻ xám.

### P2 — đã làm được gì (11/09/2026, cập nhật lần hai cùng ngày: đã có sổ 2025)

Đường trích ĐÃ CHẠY THẬT trên CẢ HAI sổ (2025 và 2026) và đã đối chiếu
chéo với một nguồn độc lập. Ba file:

| File | Việc |
|---|---|
| `engine/src/gop-ban-hang.mjs` | **hàm dùng chung** — mọi luật nghiệp vụ. P3 gọi lại ĐÚNG hàm này cho upload sống |
| `bin/doc-xlsx.mjs` | đọc .xlsx bằng Node thuần, 0 dependency (chỉ P2 cần — P3 đọc file ở trình duyệt) |
| `bin/nap-so-legacy.mjs` | script chạy tay: đọc sổ → gọi hàm chung → PUT `bc/ky/<kỳ>` |

**Bước 0 đã xác minh, không đoán — cho CẢ HAI sổ.** Sổ 2025 (25.089
hàng, `"Năm 2025"` ở hàng 2, ngày từ 01/01/2025 tới 31/12/2025) và sổ 2026
(15.041 hàng) ĐỀU đúng dạng chi tiết từng dòng: tiêu đề hàng 4, tiêu đề
phụ hàng 5, dữ liệu từ hàng 6, **cột `employee` ở vị trí 12** — khớp từng
vị trí với `app/modules/importing/raw_reader.py` của Reports V1. Nên
KHÔNG phải đi đường `PROVENANCE.md`. `kiemBoCuc()` canh đúng sáu ô tiêu
đề đó mỗi lần trích — sai bố cục thì NÉM LỖI, không trả bảng rỗng.

**Đối chiếu TOÀN BỘ 01/2025–08/2026 (20 tháng) — ba phép, cả ba khớp 0 lệch:**

| kỳ | doanh số (đ) | số đơn | nhân viên | ngày có số |
|---|---|---|---|---|
| 2025-01 | 25.805.173.727 | 1.928 | 8 | 26 |
| 2025-02 | 18.032.370.000 | 1.505 | 10 | 24 |
| 2025-03 | 13.140.995.600 | 1.216 | 9 | 31 |
| 2025-04 | 14.091.071.471 | 1.174 | 9 | 28 |
| 2025-05 | 17.231.685.529 | 1.447 | 9 | 30 |
| 2025-06 | 16.775.225.001 | 1.490 | 9 | 30 |
| 2025-07 | 19.273.841.000 | 1.709 | 11 | 31 |
| 2025-08 | 24.550.670.000 | 1.869 | 11 | 31 |
| 2025-09 | 15.769.679.000 | 1.286 | 11 | 28 |
| 2025-10 | 20.316.570.000 | 1.651 | 9 | 31 |
| 2025-11 | 23.606.103.000 | 1.871 | 12 | 30 |
| 2025-12 | 23.266.581.000 | 1.668 | 10 | 31 |
| 2026-01 | 25.474.986.000 | 1.864 | 11 | 31 |
| 2026-02 | 23.791.701.000 | 1.881 | 11 | 19 |
| 2026-03 | 15.580.262.240 | 1.351 | 10 | 31 |
| 2026-04 | 13.475.938.000 | 1.210 | 9 | 28 |
| 2026-05 | 14.664.828.000 | 1.182 | 9 | 30 |
| 2026-06 | 14.467.946.000 | 1.226 | 11 | 30 |
| 2026-07 | 14.523.075.000 | 1.205 | 10 | 31 |
| 2026-08 | 15.818.470.000 | 1.150 | 8 | 28 |
| **TỔNG** | **369.657.171.568** | **29.883** | | |

1. **Đối chiếu NỘI BỘ — đúng điều kiện ra khỏi phần (a).** Mỗi tháng được
   cộng bằng HAI đường độc lập: cộng `doanh_so` của mọi ô (nhân viên,
   ngày), và cộng thẳng tiền từng dòng của tháng đó. **20/20 tháng lệch
   0 đ và lệch 0 đơn** — không rơi dòng, không đếm trùng chứng từ. Phép
   này nằm trong `gopSoBanHang()` và **chặn lượt `--ghi`**: lệch thì
   script thoát, không ghi gì.
2. **Doanh số** — mỗi sổ tự khớp đúng dòng `Tổng cộng` mà chính nó in ra:
   231.933.845.328 đ (2025) và 137.844.307.240 đ (2026). Dòng đó bị bỏ
   khỏi phép cộng (không có số chứng từ), nên đây là đối chiếu thật.
3. **Số đơn** — 29.883 đơn, và **cả 579 ngày khớp từng ngày** (01/01/2025
   → 31/08/2026, không nghỉ ngày nào) với
   `data/chart_gapfill/daily_orders.jsonl` của Reports V1, một nguồn dựng
   độc lập từ cùng hai file sổ. V1 đã dự đoán trước 2025 sẽ ra đúng
   18.814 đơn (01/2025: 1.928 … 12/2025: 1.668) — và ra đúng như vậy.

**Sửa một lỗi thật, phát hiện nhờ dữ liệu 2025** (tên nhân viên
` Miền Bắc 0865.909.033` — có dấu chấm): `tom_tat.nhan_vien` từng khoá
theo bản đã qua `khoaNhanVien()` (khoá Firebase, dấu chấm bị thay bằng
`~`), nên báo cáo hiện ra `"0865~909~033"` — sai đúng cái mục đích của
báo cáo là "liệt kê tên NHƯ SỔ GHI" để so với file kế toán. Đã sửa: báo
cáo khoá theo tên thô (`chuanHoaChu`, chưa qua thay ký tự), cây `bc/ky`
vẫn dùng khoá đã thay `~` như cũ (bắt buộc, để ghi được vào Firebase).
Có bài kiểm canh riêng test 18.

**`LUAT_DOANH_SO` đã CHỐT (11/09/2026): `tru-chiet-khau`.** Chủ dự án nói
rõ "doanh số sẽ phải trừ đi chiết khấu". Reports V1 cũng trừ chiết khấu
(`DEC-114`) — hai lần xác nhận độc lập của cùng một người.

- `cot-doanh-so-ban` — cột `Doanh số bán` nguyên văn → 369.778.152.568 đ.
  Bằng đúng dòng `Tổng cộng` của mỗi sổ. **Không dùng nữa.**
- `tru-chiet-khau` (**đang bật**) — `Doanh số bán − Chiết khấu` →
  **369.657.171.568 đ**. Lệch 120.981.000 đ, đúng bằng tổng chiết khấu.

**Hệ quả phải nhớ:** con số trên màn hình KHÔNG còn bằng dòng `Tổng cộng`
của sổ. Mở sổ so bằng mắt sẽ thấy lệch đúng phần chiết khấu — đó là ĐÚNG.

**Gốc là cột `Doanh số bán`, KHÔNG phải `SL × ĐG` như V1.** Trên sổ thật
hai cách gần trùng khít: 15.035/15.035 dòng sổ 2026 và 25.081/25.083 dòng
sổ 2025 cho cùng một số. Đúng hai dòng lệch (hàng 1130–1131 sổ 2025, chứng
từ BH43139 ngày 14/01/2025): đơn giá có phần lẻ (4.090.909,09 và
1.681.818,18 — số tính ngược từ giá gồm VAT), MISA làm tròn cột `Doanh số
bán` về đồng chẵn còn phép nhân giữ phần lẻ. Tổng chênh cả 20 tháng:
**0,27 đ**. Lấy cột của sổ làm gốc vì đó là con số chính sổ khẳng định, và
vì VND không có đơn vị nhỏ hơn đồng — báo cáo không nên đẻ ra "…568,27 đ".

Đổi luật = sửa MỘT hằng số trong `gop-ban-hang.mjs` rồi CHẠY LẠI script
nạp (`bc/ky` lưu số đã tính, đổi hằng số mà không nạp lại thì Firebase vẫn
giữ số cũ). Cả hai luật đều có bài kiểm canh.

**25 dòng không có tên nhân viên** trên cả hai sổ (65.300.000 đ, 4 dòng ở
2025 + 21 dòng ở 2026, hầu hết 07–08/2026): KHÔNG bị bỏ, KHÔNG gán bừa
cho ai — dồn vào khoá `_chua_xac_dinh` để tổng tháng vẫn khớp sổ, và
script in ra danh sách số chứng từ. Đây đúng là việc P5 sẽ sửa tay.

**16 tên nhân viên trên cả hai sổ** (so với 14 tên chỉ thấy ở riêng sổ
2026). Script CHỈ LIỆT KÊ, không tự ghép — đúng yêu cầu "dùng danh sách CÓ
SẴN trong file kế toán, đừng tự đoán ghép vào ai".

**Câu hỏi tên trùng đã ĐÓNG (chủ dự án chốt 11/09/2026) — đừng hỏi lại:**

- `Thảo Linh` và `Tống Khánh Linh 0865111033` là **HAI NGƯỜI KHÁC NHAU**.
- `Tống Khánh Linh 0865111033` **hiểu là kênh Fanpage** — đúng như bảng
  line đang khai.

Nên không còn tên nào cần ghép. Bảng line đã phủ đủ 16/16 tên, `chua_xep`
rỗng.

Một quan sát vẫn đáng nhớ: `Miền Bắc 0865.909.033` (3,3 tỷ trong đúng
01–02/2025 rồi biến mất) nhiều khả năng là tên một KÊNH chứ không phải một
cá nhân — và nó đã có line riêng nên cách hiểu đó không ảnh hưởng số liệu.

### LINE — tầng phân tích cố định, chốt 11/09/2026

Chủ dự án chốt: **doanh số phân tích theo LINE, không theo tên nhân viên.**
Line cố định xuyên suốt 2025 → 2026 → về sau; tên nhân viên trong mỗi line
thì thêm/bớt/đổi được.

Lý do nghiệp vụ, đã thấy thật trên sổ: `Lê Văn Quân 0865111033` bán từ
03/2025 tới 08/2025 rồi nghỉ, `Tống Khánh Linh 0865111033` xuất hiện
02/2026 với CÙNG hotline. Vẽ theo tên nhân viên thì một kênh bán liên tục
hiện ra thành hai cột rời, đứt đúng chỗ đổi người.

**Mười line và người phụ trách:**

| # | Line | Nguồn (tên như sổ ghi) |
|---|---|---|
| 1 | Nội thành | Đức Hiệp, Mr Quý, Mr Vinh, Lê Văn Quân *(đã nghỉ)* |
| 2 | Tín Phát | Tín Phát 0869931931 |
| 3 | Miền Bắc | Miền Bắc 0865.909.033 |
| 4 | Tổng kho | Vũ Hạnh Ly 0868345633 |
| 5 | Quyết chiến | Phước Thắng 0865909022 |
| 6 | Đông Á | Lê Mạnh Hoàng 0865111533 |
| 7 | Tân Á | Đức Kiên - Tân Á 0867666533 |
| 8 | Fanpage | Tống Khánh Linh *(đã nghỉ)*, Fanpage 0327339229 *(người mới, từ 09/2026)* |
| 9 | Shopee | Shopee 0865111033 *(chưa có dòng nào tới 08/2026)* |
| 10 | Khác | Thảo Linh, Lê Quang Trường, Nguyễn Thị Minh Bảo, Đinh Thùy Dương, `_chua_xac_dinh` — **chốt để lại đây**, cộng mọi tên mới chưa ai xếp |

**Nội thành vẫn tách được 4 nguồn** — yêu cầu tường minh của chủ dự án.
`gopTheoLine()` luôn trả `nguon` (tách theo từng tên, theo từng tháng) bên
cạnh tổng của line, nên "kênh này do 4 người phụ trách" đọc được cả ở mức
line lẫn mức người.

**Bằng chứng quyết định rằng gộp theo TÊN là đúng, không theo hotline:**
số `0865111033` đã đi qua BA tên ở BA line khác nhau —
`Lê Văn Quân 0865111033` (Nội thành) → `Tống Khánh Linh 0865111033`
(Fanpage) → `Shopee 0865111033` (Shopee, từ 09/2026). Gộp theo hotline là
trộn doanh số của ba kênh vào một con số vô nghĩa. Có bài kiểm ghim đúng
việc này, để không ai "tối ưu" lại thành gộp theo số điện thoại.

**Bảng ánh xạ là DỮ LIỆU trên Firebase, không phải code** —
`bc/quyetdinh/line`. Nó đổi theo NHÂN SỰ, không theo phiên bản phần mềm;
chôn vào code thì mỗi lần có người vào/nghỉ phải sửa repo và chờ deploy.
Chọn `bc/quyetdinh/…` chứ không mở nhánh `bc/line` mới vì (a) đúng nghĩa
"quyết định của người", và (b) nhánh đó đã có rules live — mở nhánh mới
phải sửa rules rồi publish tay trên Console, thêm một bước có thể quên.
Hạt giống nạp lần đầu: `BANG_LINE_HAT_GIONG` trong `engine/src/line.mjs`,
ghi bằng `bin/nap-line.mjs --ghi --doc-lai`.

**Gộp line xảy ra LÚC ĐỌC, không lúc ghi.** `bc/ky/<kỳ>/<nhân viên>/<ngày>`
giữ nguyên hạt (nhân viên, ngày) — sự thật thô của sổ. Line là một CÁCH
NHÌN lên nó. Nếu ghi sẵn tổng theo line vào `bc/ky` thì mỗi lần đổi ý về
một cái tên là phải nạp lại 20 tháng sổ; gộp lúc đọc thì sửa bảng là số
đổi ngay ở lượt đọc kế tiếp. Đúng cơ chế CLAUDE.md mục "Nhập sổ" đã chốt.

**Hai việc này ĐỘC LẬP nhau:** lượt nạp sổ chỉ PUT `bc/ky/<kỳ>`, lượt nạp
bảng line chỉ PUT `bc/quyetdinh/line`. Không lượt nào đè lượt nào, thứ tự
chạy không quan trọng — nên bảng line KHÔNG chặn lượt ghi `bc/ky`.

**Doanh số theo line, toàn bộ 01/2025–08/2026** (cộng mọi line == tổng
công ty, đã canh bằng bất biến trong `gopTheoLine`):

| Line | doanh số (đ) | số đơn | nguồn |
|---|---|---|---|
| Nội thành | 237.780.423.600 | 20.266 | 4 |
| Tín Phát | 54.039.860.000 | 4.027 | 1 |
| Tổng kho | 24.090.308.727 | 1.841 | 1 |
| Quyết chiến | 18.260.579.001 | 1.182 | 1 |
| Đông Á | 17.326.110.240 | 1.243 | 1 |
| Tân Á | 11.501.664.000 | 870 | 1 |
| Miền Bắc | 3.341.256.000 | 248 | 1 |
| Khác | 3.187.120.000 | 196 | 5 |
| Fanpage | 129.850.000 | 10 | 1 |
| Shopee | 0 | 0 | 1 *(tên đã khai, chưa có dòng)* |
| **TỔNG** | **369.657.171.568** | **29.883** | |

**Năm tên ở "Khác" — chủ dự án chốt GIỮ NGUYÊN (11/09/2026):** `Thảo Linh`
(3.059.270.000 đ), `_chua_xac_dinh` (65.300.000 đ),
`Lê Quang Trường 0589691228` (34.800.000 đ), `Nguyễn Thị Minh Bảo`
(14.750.000 đ), `Đinh Thùy Dương` (13.200.000 đ).

Cả năm được khai TƯỜNG MINH vào `Khác`, không để rơi vào đó theo mặc định
— khác biệt thật: khai rồi thì `chua_xep` sạch, nên **một nhân viên mới
vào sau sẽ nổi lên một mình** thay vì lẫn vào đám đã có quyết định. Để mặc
định thì cảnh báo kêu mãi về năm tên đã chốt và tên mới sẽ không ai thấy.

Khai `_chua_xac_dinh` vào `Khác` KHÔNG làm mất việc của P5: cảnh báo
`thieu-nhan-vien` của `gopSoBanHang()` là một cảnh báo KHÁC, vẫn kêu đủ 25
dòng mỗi lượt trích.

Tên chưa khai vẫn KHÔNG được tan biến trong im lặng — `gopTheoLine` luôn
trả `chua_xep` kèm số tiền, và script nạp in danh sách đó mỗi lượt chạy.
Hiện danh sách đó RỖNG: cả 16 tên trên sổ đều đã có line.

### P2 phần (a) — dữ liệu đã nằm trên Firebase, NHƯNG CẦN NẠP LẠI MỘT LƯỢT

> ⚠️ **Số trên Firebase đang là số CŨ.** Lượt ghi đầu chạy khi
> `LUAT_DOANH_SO` còn là `cot-doanh-so-ban`. Sau đó chủ dự án chốt trừ
> chiết khấu, nên `bc/ky` hiện giữ số CHƯA TRỪ. `bc/ky` lưu số ĐÃ TÍNH,
> không tính lại lúc đọc — nên phải chạy lại đúng một lượt:
>
> ```
> node bin/nap-so-legacy.mjs --ghi --doc-lai <sổ 2025> <sổ 2026>
> ```
>
> Lượt này ĐÈ trọn từng kỳ nên chạy lại bao nhiêu lần cũng được, không
> cộng dồn. Bảng line (`bc/quyetdinh/line`) KHÔNG bị ảnh hưởng — nó không
> chứa số tiền nào, không cần nạp lại.
>
> Tổng đúng sau khi nạp lại: **369.657.171.568 đ · 29.883 đơn**.

**Lượt ghi đầu, chủ dự án tự chạy ngày 11/09/2026, cả hai lệnh xanh:**

```
node bin/nap-line.mjs --ghi --doc-lai
  → ✓ đã ghi bc/quyetdinh/line
  → ✓ đọc lại: 10 line · 18 tên

node bin/nap-so-legacy.mjs --ghi --doc-lai <sổ 2025> <sổ 2026>
  → 20/20 kỳ ghi xong, 20/20 kỳ đọc ngược khớp
  → "Mọi kỳ đọc lại khớp."
```

Nên `bc/ky/2025-01/…` tới `bc/ky/2026-08/…` và `bc/quyetdinh/line` đều có
số thật — đường ghi đã chứng minh chạy được đầu-cuối. Đây KHÔNG phải
"script tự nói là đã ghi": `--doc-lai` đọc ngược từng kỳ từ Firebase rồi so
lại tổng doanh số và số đơn. Chỉ còn phải chạy lại một lượt cho đúng luật
doanh số mới (xem khung cảnh báo trên).

Cách lấy khoá để chạy lại về sau (secret của Worker KHÔNG đọc lại được —
Cloudflare cố ý làm một chiều, `wrangler secret list` chỉ trả tên): tạo
khoá mới ở Firebase Console → Project settings → Service accounts →
Generate new private key. Tạo khoá mới KHÔNG vô hiệu hoá khoá cũ, nên
Worker đang chạy không bị ảnh hưởng. Tải file JSON về, rồi:

```
export FB_SA_EMAIL="$(node -e "console.log(require('./khoa.json').client_email)")"
export FB_SA_KEY="$(node -e "console.log(require('./khoa.json').private_key)")"
node bin/nap-line.mjs --doc-lai     # đọc thử, KHÔNG ghi gì — phép thử khoá an toàn
```

`.gitignore` đã chặn `khoa.json`, `*firebase-adminsdk*.json`, `*.pem` và
`*.xlsx` (xem `kiem/gitignore.js`) — nhưng vẫn xoá file khoá sau khi dùng.

### Việc còn lại của P2

1. **Nạp lại `bc/ky` một lượt** cho đúng `LUAT_DOANH_SO` mới — xem khung
   cảnh báo ở mục trên. Đây là việc của chủ dự án (cần khoá).
2. ~~Danh sách nhân viên chuẩn~~ — **ĐÓNG 11/09/2026.** Chủ dự án trả lời
   thẳng thay vì gửi file kế toán: `Thảo Linh` ≠ `Tống Khánh Linh`, và
   `Tống Khánh Linh` hiểu là Fanpage. Bảng line phủ đủ 16/16 tên, không
   còn tên nào chờ ghép.
3. **Phần (b) — biểu đồ — ĐANG LÀM ở nhánh riêng.** Xem mục "Hai nhánh
   chạy song song" ngay dưới.

**Phần (b) — bước 1 (Dashboard) ĐÃ MERGE (11/09/2026, PR #22 + #23, dựng
lại bố cục ở PR #27 + #28):** `engine/src/gop-theo-thoi-gian.mjs` (gộp
doanh số theo ngày/tháng/quý/năm, so cùng kỳ năm trước — thuần, không phụ
thuộc `line.mjs`) + RPC `gopSucKhoeCongTy()` ở Engine +
`GET /api/bao-cao/suc-khoe` ở Gateway + `public/suc-khoe.js` vẽ vào ô
`#o-dashboard` trong khung tab của P3. Ba tab **Ngày / Tháng / Quý** (bỏ
tab Năm — năm đã thành dải chọn riêng), mỗi tab chồng đường kỳ đang xem
lên đúng kỳ đó của năm trước. Toàn công ty, CHƯA lọc theo Line.

Hai điều chốt thêm lúc dựng lại (11/09/2026):

- **Biểu đồ ngày xem mỗi lần MỘT THÁNG.** Vẽ cả 366 ngày lên một trục thì
  "quá dày", không đọc được. Engine chia sẵn `theo_ngay_thang`, vị trí là
  NGÀY TRONG THÁNG để hai năm chồng đúng. Mặc định mở đúng tháng hiện tại;
  tháng chưa có số thì nút vẫn hiện nhưng bấm không được.
- **Dải nút phụ đổi theo tab**: Ngày → `[T1…T12]`, Tháng → `[2026][2025]`,
  Quý → không có (chờ giàu dữ liệu hơn rồi tính).

**Việc của P2 phần (b) — TẤT CẢ ĐÃ XONG, P2 ĐÓNG 11/09/2026:**
1. ~~Chủ dự án tự mở bằng máy thật, xác nhận số đúng~~ — **XONG.** Đây là
   điều kiện ra khỏi P2 (xem "Nguyên tắc làm việc" đầu file: deploy rồi tự
   xác nhận, không phải "code xong" là xong) — chủ dự án đã nghiệm thu.
2. ~~Biểu đồ **số đơn hàng**~~ — **XONG 11/09/2026 (PR #31).** Hai biểu đồ
   riêng xếp dọc trong `#o-dashboard`, dùng chung một dải tab đơn vị, một
   dải nút phụ và một chú giải; KHÔNG gộp hai trục dọc vào một khung. Không
   phải sửa Engine — `so_don` đã nằm sẵn cạnh `doanh_so` ở mọi ô.
   Kèm sửa trục dọc cho cả hai: bước chia làm tròn về 1/2/5 × 10ⁿ (trước ra
   `6.667`, `13.333`), ép bước NGUYÊN cho số đơn, và có sàn 3.000 đ cho
   trục tiền vì cả kỳ dưới 3.000 đ thì bốn mốc cùng ra "0" sau khi chia
   nghìn — ca có thật, sổ 09/2026 có đơn bị chiết khấu hết thành 0 đ.
3. ~~Gộp theo từng Line + bảng xếp hạng~~ — **XONG 11/09/2026 (PR #35 +
   #37), ĐỔI DẠNG NGAY SAU ĐÓ (cùng ngày).** `line.mjs::gopLineTheoThoiGian()`
   lọc `bc/ky` theo nhân viên của từng line rồi gộp qua đúng
   `gop-theo-thoi-gian.mjs` mà Dashboard dùng cho toàn công ty — một đường
   tính, không đẻ phép cộng thứ hai dễ lệch. KHÔNG đụng `gopTheoLine()` cũ:
   hàm kia gộp theo kỳ và tách từng nhân viên, hình dạng khác hẳn. Chỉ
   tháng + năm, không có ngày (xếp hạng theo ngày không ai đọc, mà ×10 line
   là gấp mười dữ liệu mỗi lượt mở). Engine KHÔNG đổi khi đổi dạng vẽ dưới
   đây — vẫn nguyên `gopLineTheoThoiGian()`.

   **Giao diện đổi từ thanh ngang sang HAI VÒNG KHUYÊN LỒNG NHAU** (chủ dự
   án chốt ngay sau khi thấy bảng xếp hạng, cùng 11/09/2026): vòng NGOÀI to
   = kỳ này, vòng TRONG nhỏ = kỳ trước, xếp theo chiều kim đồng hồ từ 12 giờ
   giảm dần, "Khác" luôn ở cuối dù % bao nhiêu. Cùng MỘT line phải cùng MỘT
   màu ở cả hai vòng để so được cơ cấu kỳ này lệch cơ cấu kỳ trước ở đúng
   line nào — tám hue categorical đã qua kiểm CVD của kỹ năng `dataviz`,
   gán CỐ ĐỊNH theo vị trí khai trong `thu_tu` (không theo doanh số hiện
   tại: đổi rank tháng này qua tháng khác không được đổi màu một line).
   Bảng line có tới 10 line mà categorical chỉ an toàn tới 8 — line thứ 9
   trở đi (kể cả "Khác", thường rơi đúng vào đây vì luôn khai cuối) dùng
   chung một màu xám trung tính, đúng luật "quá ~8 lớp thì gộp phần đuôi".
   Line = 0đ ở kỳ nào không vẽ lát ở vòng đó, nhưng vẫn có mặt trong chú
   giải (Shopee trước 09/2026 — biến mất khỏi chú giải thì tưởng công ty
   không còn kênh đó). Nhãn % ghi trực tiếp trên lát CHỌN LỌC (chỉ lát
   ≥10%), lát nhỏ nhường chỗ cho chú giải + rê chuột — đúng "không ghi số
   lên từng điểm" của kỹ năng dataviz.
4. ~~Chấm trung bình trên biểu đồ đường~~ — **XONG 11/09/2026.** Mỗi biểu
   đồ Doanh số/Số đơn có thêm hai chấm "TB" ở một lane riêng bên phải
   (KHÔNG gắn vào trục thời gian — trung bình không phải số của một ngày
   cụ thể): trung bình CHUỖI ĐANG VẼ của kỳ này (có thể chưa đủ ngày) so
   với trung bình CẢ kỳ trước (đã đủ) — chủ dự án chốt "so tốc độ hiện tại
   với mức đã chốt của kỳ trước". Số đơn giữ 1 số lẻ khi làm tròn hiển thị
   ("trung bình 4,3 đơn/ngày" có nghĩa thật, không như số đơn MỘT ngày —
   luôn nguyên); tiền làm tròn về đồng (VND không có đơn vị nhỏ hơn đồng).
5. ~~Lưới nhỏ (small-multiples) từng Line~~ — **XONG 11/09/2026.** Mỗi
   line một biểu đồ đường nhỏ (12 tháng của năm đang xem — `trangThai.nam`,
   KHÔNG ăn theo tab Ngày/Tháng/Quý ở trên, xu hướng cả năm là khái niệm
   riêng), đọc XU HƯỚNG riêng của nó — thứ vòng cơ cấu không nói được (vòng
   cơ cấu chỉ cho biết ai to ai nhỏ ở MỘT kỳ). Kèm nút chuyển **Doanh
   số/Số đơn** áp cho CẢ LƯỚI (không phải mỗi ô tự chọn — 10 line × 2 chỉ
   số cùng lúc là 20 ô, không ai đọc hết được); đổi nút thì thứ tự sắp xếp
   cũng tính lại theo đúng chỉ số đang xem. Số đã có sẵn trong khối `line`
   mà endpoint đang trả, không phải sửa Engine.

   Mỗi ô dùng TRỤC DỌC RIÊNG (theo giá trị lớn nhất của chính line đó):
   hình dạng luôn đọc được dù line to hay nhỏ, đổi lại không so được biên
   độ giữa hai ô — nhưng "ai to ai nhỏ" đã có vòng cơ cấu trả lời. Tháng
   nào line không có dòng nào (nghỉ, chưa có kênh) là NGẮT ĐOẠN, không vẽ
   liền một đường phẳng ở đáy như thể vẫn bán với giá 0 — dùng chung nguyên
   tắc "khoảng trống thật" với mọi biểu đồ khác trong file. Nhãn duy nhất
   là giá trị tháng CUỐI CÙNG có số ("Lines → value at the end", không ghi
   số lên từng tháng — dataviz).
6. ~~Dọn ba field cũ của Engine~~ — **XONG 11/09/2026 (PR #43).**
   `gopSucKhoeCongTy()` không còn trả `theo_ngay` (366 điểm), `theo_nam`,
   `hai_nam` — ba field của bản Dashboard đầu tiên, giữ lại có chủ ý cho
   khoảng giữa hai lượt deploy (bẫy số 4), bỏ đúng lúc đã hẹn: sau khi chủ
   dự án xác nhận bản mới chạy thật. Bỏ luôn `haiNamGanNhat()` (chỉ còn
   tồn tại để tính `hai_nam`, không còn ai gọi) — `cacNamCoSo()` vẫn giữ.

**P2 xem như đóng tại đây.** Việc tiếp theo của Dashboard (nếu chủ dự án
muốn) là P3/P4 dưới, không phải thêm việc mới vào P2 — một ý mới cho biểu
đồ thì mở thành một mục riêng ở "Trạng thái hiện tại", không chèn vào
danh sách đã đóng này.

Engine ĐÃ có sẵn `gopSoBanHang()`, `gopTheoLine()`, `gopSucKhoeCongTy()`,
`gopLineTheoThoiGian()` qua Service Binding (bẫy số 4: hàm Engine lên
trước, Gateway gọi ở lượt merge sau) — bất cứ hàm gộp-theo-Line mới nào lên
Engine ở MỘT lượt merge riêng, Gateway gọi nó ở lượt sau.

### P3 — tải sổ qua trình duyệt: LƯỢT 1 ĐÃ MERGE (11/09/2026)

Chủ dự án mở rộng phạm vi P3 ngay trong phiên (11/09/2026), nên P3 chia
**hai lượt merge**. Lượt 1 xong; lượt 2 còn lại ở cuối mục này.

**Bối cảnh: chủ dự án đã gửi ba sổ thật trong phiên** — sổ 2025 (25.089
hàng), sổ **08/2026** (1.613 hàng) và sổ **09/2026** (615 hàng, tới
20/09), cộng file báo cáo tay `Báo cáo Kinh doanh 2026.xlsx` (58 sheet
kiểu "08.2026 Tín Phát") làm mẫu bố cục. Mọi con số dưới đây đo trên
chính ba sổ đó, không phải số giả lập.

#### Phép kiểm mạnh nhất của P3 — đã chạy, khớp tuyệt đối

Đẩy sổ 08/2026 qua TRỌN đường upload (bộ đọc trong trình duyệt → POST
`/api/tai-so` → Engine → Firebase) rồi đọc ngược:

| Sổ | .xlsx | JSON gửi lên | đọc ở trình duyệt | trọn lượt Gateway | kết quả |
|---|---|---|---|---|---|
| 08/2026 | 0,23 MB | 0,45 MB | 95 ms | 112 ms | **15.818.470.000 đ · 1.150 đơn** |
| 09/2026 | 0,09 MB | 0,17 MB | 37 ms | 34 ms | **5.704.985.001 đ · 445 đơn** |

Con số 08/2026 **trùng khít từng đồng, từng đơn** với `bc/ky/2026-08` mà
script chạy tay của P2 đã nạp — hai đường khác hẳn nhau, cùng một hàm
`gopSoBanHang()`, cùng một con số.

#### Giới hạn kỹ thuật — đã đo, KHÔNG cắt lô

| Sổ | dòng | JSON ma trận | gzip | parse | gộp | CPU |
|---|---|---|---|---|---|---|
| 09/2026 (nửa tháng) | 609 | 0,17 MB | 0,04 MB | 0,9 ms | 6,2 ms | ~7 ms |
| một tháng đầy (mô phỏng) | 2.600 | 0,72 MB | 0,15 MB | 3,0 ms | 15,9 ms | ~19 ms |
| cả năm 2025 | 25.083 | 7,22 MB | 1,54 MB | 85 ms | 176 ms | ~261 ms |

Gói **Workers Paid** (trần 30 s CPU) nên một sổ tháng đi gọn trong MỘT
lượt POST. Cắt lô chỉ làm phức tạp đường ghi và phá luật "đè trọn kỳ
trong một lượt PUT" mà không giải quyết gì. Trần thân request đặt 24 MB.

#### Bốn quyết định nghiệp vụ chủ dự án chốt trong phiên

1. **`FANPAGE 0327339229` / `SHOPEE 0865111033` viết HOA.** Sổ 09/2026
   thật in HOA; bảng line khai chữ thường nên line Fanpage hiện 0 đ trong
   khi 15.700.000 đ rơi sang "Khác". Hai cách viết là MỘT, lấy dạng sổ
   ghi. **Phải chạy lại `node bin/nap-line.mjs --ghi --doc-lai`.**
2. **Chiết khấu là một DÒNG, không phải một phép trừ ẩn.** MISA rải chiết
   khấu ra từng dòng của đơn (`BH72812` sổ 08/2026: 100.000 đ ở cả hai
   dòng). Bảng đơn hàng gộp toàn bộ lại thành đúng MỘT dòng mã
   `Chiết khấu`, giá nhập 0, giá bán mang dấu âm. Cộng các dòng ra đúng
   con số `bc/ky` giữ — bảng đơn và biểu đồ không kể hai câu chuyện khác
   nhau.
3. **Luật đè áp theo TỪNG KỲ** (thay cho "đè trọn kỳ" đọc theo nghĩa cả
   file): kỳ chưa có dữ liệu → ghi mới; kỳ đã có → file mới phải phủ trọn
   khoảng ngày cũ, không phủ thì **từ chối CẢ LƯỢT**; kỳ vắng mặt trong
   file mới → không đụng tới. Tải riêng sổ T10 không xoá T9; file
   1/9–15/10 đè trọn T9 rồi ghi mới T10.
4. **Tiền hiện theo NGHÌN ĐỒNG** (`6.450` = 6.450.000 đ), đúng như file
   báo cáo tay. Giữ tới 3 số lẻ chứ không làm tròn: trên 27.299 dòng của
   ba sổ có 5 dòng không chẵn nghìn (`9.950.001 đ`, `4.090.909,09 đ`).

Và hai quyết định về phạm vi: dòng biến mất khỏi file mới thì **xoá thẳng**
(xuất hiện lại sau này là một dòng mới độc lập); **KHÔNG bơm ngược dòng
hàng cho 20 kỳ legacy** — chủ dự án chốt theo dõi kỳ cũ ở file tay, nên
tab đơn hàng của 2025 và 01–08/2026 rỗng là ĐÚNG, không phải lỗi.

#### Mười sáu cột của bảng đơn hàng — sáu cột chờ P4

`[ngày][số BH][nơi nhập][mã sản phẩm][SL][giá nhập][giá bán][tổng bán]`
`[lợi nhuận][tên khách][SĐT][địa chỉ][hãng][ngành hàng][IMEI][ghi chú]`

Sổ MISA **không có** `nơi nhập`, `hãng`, `ngành hàng`, `ghi chú`, và cột
`mã sản phẩm` của nó thật ra là TÊN hàng (`"Máy giặt LG FX1412N5G"`),
không phải mã. Bốn cột đó cộng `giá nhập`/`lợi nhuận` trả `null` TƯỜNG
MINH và màn hình hiện `—`, không hiện 0 — P4 lấy từ Tracking. Cột
`Lợi nhuận` MISA có in ra nhưng vô nghĩa (bằng đúng doanh số, giá vốn
chưa nhập vào MISA) nên không dùng.

#### Hai nhánh dữ liệu MỚI — ĐÃ PUBLISH lên rules đang chạy (11/09/2026)

| Nhánh | Chứa gì | `.read` / `.write` |
|---|---|---|
| `bc/dong/<kỳ>/<khoá dòng>` | từng dòng hàng — KHÔNG một chữ nào của khách | `false` / `false` |
| `bc/backup/<kỳ>/<mốc>` | ba bản lưu gần nhất của mỗi kỳ | `false` / `false` |

PII vẫn đi đúng chỗ cũ: tên/SĐT/địa chỉ → `bc/khach`, IMEI → `bc/imei`.
Đã kiểm trên sổ thật: **0 SĐT khách, 0 địa chỉ, 0 tên khách lọt vào
`bc/dong`**. Nội dung đã publish qua PR #33 bên repo Tracking (rules dùng
chung một project Firebase).

Dung lượng đo thật: một tháng ≈ 390 KB (`bc/dong`) + 45 KB (`bc/imei`).

**`bc/khach` đổi khoá SAU khi merge lượt 1 — SỬA NGAY TRONG NGÀY (11/09/2026):
`bc/khach/<số chứng từ>` (phẳng) → `bc/khach/<kỳ>/<số chứng từ>` (theo
kỳ).** Lượt 1 đọc TOÀN BỘ nhánh mỗi lần màn "Đơn hàng" mở MỘT kỳ — đo trên
sổ thật: 151 KB/tháng, phẳng thì con số đó cộng dồn mãi mãi (12 tháng đã
1,76 MB, 36 tháng 5,29 MB cho một lượt xem, dù chỉ cần đúng một tháng).
Ghi cũng đổi theo: PUT đè trọn `bc/khach/<kỳ>` cùng lúc với `bc/ky` và
`bc/dong`, KHÔNG còn PATCH phẳng — nhờ vậy một tác dụng phụ tốt: khách của
một dòng đã biến mất khỏi lượt tải mới không còn MỒ CÔI lại trong Firebase
(bản đầu để sót, vì PATCH chỉ thêm/sửa chứ không bao giờ xoá). `luuBanCu()`
và `/api/hoan-tac` cũng lưu/khôi phục theo — hoàn tác thiếu khách sẽ hiện
tên khách của LƯỢT SAU, trông như xong nhưng chỉ xong một nửa.

**Kỳ đã tải qua UI trước 11/09 (trưa) cần TẢI LẠI để `bc/khach` được xếp
đúng kỳ** — dữ liệu cũ vẫn nằm phẳng ở `bc/khach/<số chứng từ>` (mồ côi,
không nhánh nào đọc tới, vô hại) cho tới khi tải lại đúng kỳ đó.

#### Sáu đường ở Gateway, và khoá dòng

```
POST /api/tai-so      nhận ma trận ô → Engine → PUT bc/ky + bc/dong + bc/khach
POST /api/hoan-tac    quay một kỳ về một bản lưu (kể cả khách)
POST /api/xoa-ky      xoá TRỌN một kỳ — lưu bản cũ trước, hoàn tác được
GET  /api/ban-luu     ba bản lưu của một kỳ (chỉ NHÃN, không kèm cây dòng)
GET  /api/ky-co-don   kỳ nào có dòng hàng, gom theo năm → dựng tab
GET  /api/don-hang    bảng đơn hàng ĐÃ TÍNH SẴN của (kỳ, line)
```

**`POST /api/xoa-ky`** — thêm 11/09/2026 cùng lượt sửa `bc/khach`, giải
quyết một lỗ đã thấy trước: tải nhầm sổ (một dòng gõ sai ngày thành
"2031-03" chẳng hạn) sinh ra một kỳ rác nằm lại VĨNH VIỄN — kỳ mới tinh
không có bản lưu nên hoàn tác không giúp gì, và trước lượt này không có
cách nào gỡ nó khỏi tab năm bằng giao diện. Xoá vẫn LƯU BẢN CŨ trước (như
mọi thao tác đè khác), nên xoá một kỳ ĐÃ CÓ dữ liệu thật vẫn cứu được qua
chính `/api/hoan-tac` — không cần một đường cứu hộ riêng. Màn "Nhập sổ
bán hàng" có thêm mục "Các kỳ đã có" để chọn kỳ và bấm xoá.

Khoá dòng đúng công thức CLAUDE.md chốt: **(số chứng từ, tên hàng chuẩn
hoá, lần xuất hiện thứ mấy trong chứng từ)**. "Lần thứ mấy" là cần thật
chứ không phòng xa — `BH71909` sổ 08/2026 có BỐN dòng cùng tên
`"Chân máy giặt Đa Năng - chiều"` với số lượng khác nhau. Tên hàng thật
có dấu chấm/gạch chéo ở **1.360/27.299 dòng** và dài tới **190 ký tự**,
nên khoá thay ký tự Firebase cấm bằng `~` và cắt kèm dấu vân.

#### Ba chỗ đụng với P2(b) — đã xử đúng quy ước

- `src/index.js` cửa chặn method: nới POST cho **đúng hai đường**, suy
  thẳng từ `API_ROUTES` chứ không khai lại danh sách thứ hai. Mọi đường
  khác vẫn 405; đường lạ ra 404 chứ không 405. `kiem/dinh-tuyen.js` bài 1
  đã sửa cho khớp và **giữ nguyên phép canh cho mọi đường khác**.
- `API_ROUTES`: chỉ THÊM năm dòng vào cuối, không sắp xếp lại. Có bài kiểm
  ghim thứ tự để đường của P1 và P2(b) không bị dời.
- `public/index.html`: thêm ba thẻ `<script src>` và hai `<section>`.
  Toàn bộ logic ở `public/doc-xlsx.js`, `public/tai-len.js`,
  `public/don-hang.js`. Không đụng khối `<script>` inline.

#### Quy ước cho P2(b): ô `#o-dashboard`

Màn "Đơn hàng theo line" có tab năm → tab con (Dashboard + từng line) →
chọn tháng. Tab **Dashboard** chứa sẵn một ô trống `#o-dashboard` —
**P2(b) sở hữu nội dung ô đó**, P3 sở hữu khung tab. P3 không vẽ biểu đồ
nào ở đó, chỉ liệt kê line của tháng.

Có thêm hàng CHỌN THÁNG mà file tay không có, vì dữ liệu lưu theo kỳ và
một tháng nặng ~390 KB — mở thẳng cả năm là kéo về ~4,7 MB cho một lượt
xem.

**Hợp đồng đã chạy thật (P2(b) lắp vào 11/09/2026, PR #28) — P3 đọc kỹ
đoạn này trước lượt 2:**

- `public/suc-khoe.js` chỉ đụng BÊN TRONG `#o-dashboard`, không bật/tắt màn
  nào, không đụng `#tabNam` / `#tabLine` / `#tabThang` / `#veDonHang`.
  Muốn dời ô đi đâu trong khung thì cứ dời — nó tìm theo id, không theo
  chỗ đứng.
- Nó tự chạy bằng `firebase.auth().onAuthStateChanged`, không chờ ai gọi
  sang, và đọc `GET /api/bao-cao/suc-khoe` (nguồn là `bc/ky`, KHÁC nguồn
  `bc/dong` của bảng đơn hàng). Nên Dashboard có đủ 2025 + 2026 kể cả khi
  chưa kỳ nào được tải lên qua trình duyệt — cũng vì vậy nó tự giữ NĂM
  riêng ở dải `[2026][2025]`, không ăn theo tab năm của P3.
- **Đã sửa `public/don-hang.js`** (PR #28): bỏ `moMan()`/`dongMan()` phần
  bật tắt màn và bỏ dây vào thẻ `#theDonHang` — màn đó giờ LÀ trang chủ
  nên không còn thẻ để bấm mở, không còn nút "Quay lại". Thay bằng đúng
  một khối `onAuthStateChanged` ở cuối file. Phần còn lại của file không
  ai đụng vào.
- `kiem/id-co-that.js` canh mọi id mà JS đi tìm đều có thật trong
  `index.html` và không id nào khai trùng. Xoá một thẻ mà quên một chỗ
  `getElementById` là lỗi `npm test` không thấy được — nó chỉ nổ trên máy
  thật, đúng lúc đăng nhập.

#### Đọc .xlsx trong trình duyệt — không nới CSP

`public/doc-xlsx.js` là bản port của `bin/doc-xlsx.mjs` (đã chạy trên
40.118 dòng sổ thật ở P2), khác mỗi chỗ giải nén: `DecompressionStream`
thay cho `zlib`. Tự viết vì CSP chỉ cho script từ `'self'` và gstatic —
kéo SheetJS từ CDN là nới một lỗ thật trên bản deploy.

**Đã kiểm giống hệt bản Node trên cả bốn file thật**, kể cả sổ 25.089
hàng. `kiem/doc-xlsx-trinh-duyet.js` dựng một .xlsx thật trong bộ nhớ
(ZIP + deflate + SpreadsheetML) rồi so từng ô giữa hai bộ, và ghim luôn
LUẬT SỐ 1: file đó không được biết "cột 12 là nhân viên".

#### P3 — lượt 2 còn lại

Chủ dự án đã chốt nội dung, chưa code:

1. **Nút sửa / xoá đơn** trên bảng đơn hàng — để bỏ mã phụ kiện, mã vận
   chuyển khỏi doanh số, hoặc sửa giá nhập.
2. **Khoá chống đè** — cơ chế đã dựng sẵn và có bài kiểm ở lượt 1:
   `doiChieuKy()` nhận tập khoá đã sửa tay từ `bc/quyetdinh/dong/<kỳ>`,
   dòng nào đã sửa thì GIỮ BẢN CŨ và cảnh báo riêng thay vì bị đè. Lượt 2
   chỉ còn phải GHI vào nhánh đó và dựng giao diện. Khoá đặt ở mức DÒNG,
   cảnh báo gom theo ĐƠN (chủ dự án chốt).
3. **Audit trail** — ai sửa gì lúc nào.
4. Dòng đã sửa tay mà biến mất khỏi file mới thì **giữ lại + cảnh báo**
   (ngoại lệ duy nhất của luật "xoá thẳng") — xoá nó là xoá một quyết
   định của người mà không hỏi ai.

Và một quan sát từ sổ thật, để lượt 2 biết trước: hai đơn Shopee của
09/2026 (`BH74228`, `BH74234`, đều là tủ đông Sanaky) có **doanh số 0 đ**
nhưng vẫn đếm là 2 đơn. Cả tháng 9 có 18 dòng 0 đồng, 16 dòng còn lại rõ
ràng là quà tặng/phụ kiện. Chứng từ `BTL` (đoán là *bán trả lại*, 122
dòng ở sổ 2025) cũng 0 đ và vẫn đếm là đơn — số legacy đã tính như vậy
nên P3 giữ nguyên để không phá tính liên tục.

---

### Hai nhánh chạy SONG SONG — P2(b) và P3

Chủ dự án chốt 11/09/2026: **P2(b) (biểu đồ) và P3 (tải file) làm song
song, ở hai nhánh và hai session khác nhau.**

| | P2(b) — biểu đồ | P3 — tải file |
|---|---|---|
| Nhánh | `claude/p2b-bieu-do` | session mới tự đặt |
| Làm gì | ĐỌC `bc/ky` + bảng line → vẽ | NHẬN .xlsx → GHI `bc/ky` |
| Hướng dữ liệu | Firebase → màn hình | màn hình → Firebase |
| Dữ liệu | 20 tháng legacy đã có | từ 09/2026 trở đi |
| Method HTTP | GET | POST |

Hai việc này ngược chiều nhau nên gần như không đụng logic của nhau —
nhưng CÓ ba chỗ đụng file thật. Ai đọc file này trước khi code thì cả hai
nhánh merge được mà không phải gỡ rối.

#### Ba chỗ đụng, và ai sở hữu chỗ nào

**1. `src/index.js` — cửa chặn method. P3 SỞ HỮU.**
Gateway hiện từ chối MỌI method khác GET/HEAD bằng 405, ở cả hai nhánh
`/api/` và file tĩnh. P3 phải nới đúng một đường cho POST; P2(b) KHÔNG
đụng tới khối đó. `kiem/dinh-tuyen.js` đang canh "POST bị 405 ở khắp nơi"
(bài 1) — P3 sửa bộ kiểm đó cho khớp, P2(b) để nguyên.

**2. `src/index.js` — bảng `API_ROUTES`. Cả hai cùng thêm, mỗi bên MỘT dòng.**
Đây là một `Map`, thêm route là thêm một dòng. Va chạm git nếu có thì là
một dòng cạnh nhau, gỡ trong mười giây. Đừng sắp xếp lại bảng, đừng đổi
thứ tự các dòng đang có — đó mới là thứ biến một dòng thành cả khối.

**3. `public/index.html` — MỘT file, hai màn hình. Quy ước bắt buộc:**

- Mỗi màn một file `.js` RIÊNG trong `public/`: P2(b) dùng
  `public/suc-khoe.js`, P3 dùng `public/tai-len.js` +
  `public/don-hang.js` + `public/doc-xlsx.js`. Tên cụ thể không quan
  trọng, chỉ cần MỖI màn một file riêng, không màn nào viết chung vào
  khối `<script>` inline.
- `index.html` mỗi bên chỉ thêm **một thẻ `<script src>`** và **một thẻ
  chứa phần của mình**. Từ PR #28 chỉ còn HAI màn thật: trang báo cáo
  (`#manChu`, là trang chủ) và màn nhập sổ (`#manTaiLen`). P2(b) không có
  màn riêng nữa — nó sống trong ô `#o-dashboard` của trang báo cáo.
- KHÔNG viết logic màn mới vào khối `<script>` inline đang có. Khối đó là
  của phần đăng nhập, để yên.

`kiem/luat-so-1.js` đã được mở rộng sẵn (11/09/2026) để soi cả file `.js`
rời: mỗi file bị kiểm riêng "mọi `fetch()` vào `/api/`", "không chạm
Firebase thẳng", "không mang khoá", và phải được `index.html` nạp thật —
một file mồ côi cũng đỏ. Nên tách file KHÔNG làm hở lưới LUẬT SỐ 1.

#### Luật vẫn áp cho cả hai

- **Bẫy số 4 (hai Worker build song song).** Engine ĐÃ có sẵn
  `gopSoBanHang()` và `gopTheoLine()`, nên cả hai nhánh gọi được ngay,
  không nhánh nào phải chờ. Nhưng nếu một nhánh cần hàm Engine MỚI thì
  hàm đó phải merge TRƯỚC, ở một lượt riêng, rồi lượt sau Gateway mới gọi.
- **Nghiệp vụ ở Engine.** Không nhánh nào được tính tiền ở Gateway hay ở
  trình duyệt. P3 gọi lại ĐÚNG `gopSoBanHang()` — không viết bản thứ hai.
- **Merge thẳng, không chờ nhau.** Nhánh nào xong trước merge trước. Nhánh
  sau `git pull origin main` rồi đi tiếp.

Prompt mở session P3 đã viết sẵn: **`docs/prompt-P3.md`** — chép nguyên
khối trong đó vào một session mới.

### Hạ tầng đang sống — P2 nhận nguyên, không dựng lại

| Thứ | Giá trị | Ghi chú |
|---|---|---|
| Gateway | `reportv2-gateway` → `https://reportv2-gateway.hoangvinhkta.workers.dev` | phục vụ `public/`, endpoint `/api/me` |
| Engine | `reportv2-engine` | riêng tư, `workers_dev = false`, gọi qua binding `REPORT_ENGINE` |
| Secret trên Gateway | `FB_SA_EMAIL`, `FB_SA_KEY` | service account `firebase-adminsdk-fbsvc@tinphattracking...` |
| Cloudflare Access | app self-hosted, destination = **Workers** scope `reportv2-gateway` | đăng nhập bằng **One-time PIN**, allowlist theo TỪNG email (công ty không có domain email riêng) |
| Rules `bc/` | đã publish live | `bc/ky`, `bc/quyetdinh` `.read` theo `vai`; `bc/khach`, `bc/imei` đóng hẳn |
| CI | `.github/workflows/kiem.yml` | `npm test` mỗi lần push |

`npm test`: 11 bộ, 382 đạt, 0 hỏng.

### Năm cái bẫy đã trả giá ở P1 — đọc trước khi chạm vào chúng

1. **Quyền đọc từ `profiles/<uid>/vai`, KHÔNG phải `perms.quantri`.**
   Tracking dùng `vai` (một chuỗi: `quantri`/`quanly`/`saleadmin`/
   `marketing`/`sale`) làm nguồn sự thật; `perms` chỉ là bản chiếu bảy cờ
   (`admin`/`board`/`bedit`/`edit`/`compare`/`summary`/`mkt`) — **không có
   khoá nào tên `quantri`/`quanly` trong `perms`**. Nguồn: `VAI_KN` và
   `admSetVai()` trong `public/index.html` repo Tracking. Đoán sai chỗ này
   làm `/api/me` trả 403 với mọi tài khoản. Reports chỉ nhận `quantri` +
   `quanly` (quyết định chủ dự án — không nới theo
   `VAI_KN.saleadmin.baoCao`).

2. **KHÔNG BAO GIỜ sửa tay `profiles/<uid>` trong Firebase Console.** Ở P1
   việc này đã ghi đè mất hồ sơ thật của chủ dự án (mất `perms`, Tracking
   từ chối đọc `state`/`alias`/`dnhap`/`profiles` cho tài khoản đó). Muốn
   đổi quyền thì dùng chính màn Quản trị của Tracking — `admSetVai()` ghi
   `vai` + `perms` MỘT LƯỢT, không bao giờ lệch nhau. Tự ghi tay là tự tạo
   ra trạng thái nửa cũ nửa mới.

3. **`el.hidden` chết nếu CSS đặt `display` cho chính phần tử đó.** Luật
   của file CSS (author) luôn thắng luật `[hidden]{display:none}` của
   trình duyệt. Đã có tấm lưới `[hidden]{display:none!important}` trong
   `public/index.html` và `kiem/an-hien-man-hinh.js` canh — đừng gỡ.

4. **Merge vào `main` là deploy thật.** Hai Worker nối git integration
   (Cloudflare Workers Builds) — merge xong là Cloudflare tự build và đẩy
   lên production, không cần chạy tay. Cửa chặn nằm ở `[build] command =
   "npm test"` trong `wrangler.toml` — **cả hai file**, vì hai Worker build
   độc lập nên cửa của Gateway không che cho Engine. Bộ kiểm đỏ thì build
   dừng, deploy không chạy, bản đang chạy được giữ nguyên.
   `kiem/cua-chan-build.js` canh cả hai cửa còn đó — đừng gỡ, và đừng
   chuyển chúng lên ô "Build command" của dashboard (ô đó chỉ áp cho nhánh
   production, nhánh phụ không kế thừa — Tracking đã mất gần một giờ vì
   đúng chuyện này).

   **Cách nối trên dashboard.** Ô "Root directory" nằm trong khối *Build
   configuration* ở Settings → Builds của từng Worker — KHÔNG nằm ở wizard
   tạo Worker mới, nên rất dễ tưởng là không có (đã tưởng nhầm một lượt).

   | | Gateway | Engine |
   |---|---|---|
   | Root directory | `/` | `engine` |
   | Build command | (trống) | (trống) |
   | Deploy command | mặc định | mặc định |
   | Version command | mặc định | mặc định |

   Đặt Root directory đúng thì cả ba lệnh mặc định tự trỏ đúng Worker, và
   hết cảnh báo cam "Update wrangler.toml … name = …". Nếu buộc phải để
   Root directory = `/` cho Engine thì **cả** Deploy command **lẫn** Version
   command đều phải thêm `--config engine/wrangler.toml` — thiếu ở Version
   command là nó deploy nhầm sang Gateway.

   Còn một cảnh báo nữa phải để ý: *"This project is disconnected from your
   Git account"*. Repo hiện đúng tên nhưng uỷ quyền GitHub App đã rớt →
   build không chạy. Sửa ở nút **Manage** cạnh dòng Git repository.

   Muốn deploy tay (ví dụ lúc gỡ lỗi) thì vẫn được: `git pull origin main
   && wrangler deploy`, và `wrangler deploy --config engine/wrangler.toml`
   nếu đụng Engine (`cd engine && wrangler deploy` cũng chạy đúng — `npm`
   tự leo lên tìm `package.json`, đã thử cả hai lối).

   **Cạm bẫy của việc nối git: hai Worker build SONG SONG, không theo thứ
   tự.** Một lần merge đụng cả hai thì Gateway có thể lên trước Engine, và
   trong vài chục giây đó Gateway mới gọi một hàm Engine chưa tồn tại →
   lỗi thật cho người đang dùng. P1 không dính vì Engine chỉ có
   `phienBan()`, nhưng từ P2 (Engine bắt đầu có hàm nghiệp vụ thật) thì
   phải để ý: **thêm hàm mới vào Engine và merge TRƯỚC**, lượt merge sau
   mới cho Gateway gọi nó. Đổi tên hoặc xoá hàm Engine thì làm ngược lại.

5. **Thêm tên miền mới phải khai ở API key.** Browser key
   `AIzaSyD2W_zJSmFXVgtlnr3aGAbYbO07bhpWXds` (Google Cloud Console → APIs
   & Services → Credentials) giới hạn theo Website restrictions. Tên miền
   nào chưa nằm trong danh sách thì `signInWithPassword` trả **403**, và
   màn hình chỉ báo "sai email/mật khẩu" — dễ truy nhầm hàng giờ. Danh
   sách hiện có: `price.tinphatcrm.com`, `mkt.tinphatcrm.com`,
   `marketing.hoangvinhkta.workers.dev`,
   `https://reportv2-gateway.hoangvinhkta.workers.dev/*`.

### Việc còn treo, không chặn P2

- PR đồng bộ rules bên repo **Tracking** (nhánh
  `claude/reportv2-p1-foundation-djkhlo`) đang MỞ, chờ chủ dự án merge.
  Rules thật đã publish đúng trên Console rồi; PR này chỉ để file nguồn
  trong repo Tracking khớp với Console, tránh lần sau ai deploy rules từ
  repo đó làm mất nhánh `bc/`.

---

## Tám phase

**Sắp xếp lại 11/09/2026, lần ba cùng ngày** — sau khi P2 (bản cũ) đã
chạy thật và có kết quả (xem "Trạng thái hiện tại"). Chủ dự án gộp lại
theo đúng ba khối việc lớn, không tách nhỏ theo kỹ thuật nữa:

- **P2 = dữ liệu gốc + biểu đồ** — gộp P2 (mốc legacy) và P3 (biểu đồ) cũ
  làm MỘT: có dữ liệu nền rồi phải thấy được ngay bằng biểu đồ, không
  tách hai bước.
- **P3 = cơ chế tải file theo từng thời điểm, nối dài dữ liệu** — nội
  dung P4 cũ (upload UI), đổi tên cho đúng vai trò: đây là cách P2 "sống
  tiếp" theo thời gian, không phải một tính năng tách rời.
- **P4 = phân tích giá vốn, dựa trên dữ liệu P3** — nội dung P6 cũ, buộc
  tường minh vào dữ liệu SỐNG của P3 (không phải dữ liệu legacy của P2)
  — khớp đúng giới hạn dữ liệu thật đã biết: Tracking chỉ có `min_ngay`
  ổn định từ ~07/09/2026, đúng giai đoạn P3 mới bắt đầu tải sổ sống.

Các phase còn lại giữ nguyên nội dung, đổi số: chỉnh sửa tay (P5), sản
phẩm/thương hiệu tuỳ chọn (P6), khai tử V1 (P7).

| # | Tên | Ước lượng | Trạng thái |
|---|---|---|---|
| P0 | Chốt sáu quyết định | 1 buổi · không code | ✅ Xong — 11/09 |
| P1 | Nền móng rỗng, chạy thật | 1 tuần | ✅ Xong — 11/09 |
| P2 | Dữ liệu gốc (2025→08/2026) + biểu đồ | 2 tuần | ✅ Xong — 11/09, chủ dự án đã nghiệm thu |
| P3 | Cơ chế tải file doanh số theo thời điểm, nối dài dữ liệu | 1–2 tuần | 🟨 Lượt 1 đã merge — còn lượt 2 (sửa/xoá + audit) |
| P4 | Phân tích giá vốn, dựa trên dữ liệu P3 (chỉ từ ~07/09/2026) | 2 tuần | ⬜ Chưa bắt đầu |
| P5 | Chỉnh sửa tay + audit trail | 1 tuần | ⬜ Chưa bắt đầu |
| P6 | Sản phẩm, thương hiệu, cơ cấu — TUỲ CHỌN, không cam kết | — | ⬜ Chưa xác nhận cần |
| P7 | Khai tử V1 | 1 buổi | ⬜ Chưa bắt đầu |

---

### P0 — Chốt sáu quyết định ✅

Sáu quyết định (lưu đủ thông tin khách, vai Quản trị/Quản lí, tải file
.xlsx, đè toàn kỳ không mất chỉnh sửa tay, gán thủ công theo Tracking,
`workers.dev` lúc làm) đã chốt và nằm trong `CLAUDE.md`.

**Ra khỏi phase khi:** sáu quyết định ghi vào `CLAUDE.md` — đã làm.

---

### P1 — Nền móng rỗng, chạy thật ✅

Repo private (đã có). Dựng:

- Worker **Gateway** — xác minh Firebase ID token, tra vai trong
  `profiles/<uid>`. Là nơi DUY NHẤT chạm Firebase.
- Worker **Engine** riêng tư — nối Gateway bằng Service Binding, không
  route public, không `workers.dev` riêng.
- Nhánh rules mới, deny-by-default. Nhánh khách (`bc/khach`, `bc/imei`)
  khai tường minh `.read: false` / `.write: false`.
- `kiem/` chép khung bộ kiểm từ Tracking.
- CI chạy `npm test`, chặn build khi kiểm hỏng.
- Cloudflare Access dựng trước khi có người dùng thật.
- Một trang tĩnh: đăng nhập, thấy tên mình, thấy màn hình chủ với các thẻ
  bị khoá (chưa có tính năng nào bật).

Không một tính năng báo cáo nào ở phase này. Đây là phase chứng minh
**đường dây** chạy: trình duyệt → Gateway → quyền → Engine → dữ liệu →
màn hình.

**Bạn nhìn thấy gì:** mở web bằng điện thoại (qua `*.workers.dev`), đăng
nhập bằng tài khoản công ty, thấy tên mình và sáu thẻ xám ghi "chưa có
gì".

**Ra khỏi phase khi:** tự đăng nhập được trên bản deploy thật, đã merge —
**đã làm 11/09/2026**. Chi tiết hạ tầng đang sống và năm cái bẫy đã trả
giá: xem "Trạng thái hiện tại" ở đầu file.

---

### P2 — Dữ liệu gốc (2025 → 08/2026) + biểu đồ

Hai việc, một phase: (a) trích trực tiếp từ **"Sổ chi tiết bán hàng"**
2025 và 2026 (tới hết 08/2026) mà chủ dự án cung cấp — KHÔNG qua UI tải
file, nạp thẳng vào Firebase bằng script; (b) dựng biểu đồ đọc từ đúng dữ
liệu vừa nạp. Không tách hai bước — có dữ liệu nền rồi phải thấy được
ngay, đúng yêu cầu "có dữ liệu trước, không phải tải lên mới tính".

**Phần (a) — trích + nạp:**

**Bước 0 — xác minh nguồn trước khi trích, đừng giả định:** mở file, kiểm
có đúng cột `employee`/nhân viên + số chứng từ + ngày bán + tiền theo
từng DÒNG hay không (khớp `app/modules/importing/raw_reader.py` của
Reports V1, cột `employee` ở vị trí 12). Nếu khớp → đi theo đường dưới.
Nếu hoá ra là workbook kế toán dạng sheet-mỗi-nhân viên (không phải sổ
chi tiết từng dòng) → ĐỪNG đoán cách đọc, dừng lại đọc
`data/chart_gapfill/PROVENANCE.md` trong repo Reports V1 (chỉ tham khảo,
không sửa) — ở đó đã giải sẵn 7 biến thể bố cục và công thức chia lệch
nhau giữa sheet nhân viên/sheet kênh, và trong trường hợp đó KHÔNG có số
đơn (nguồn không cung cấp), chỉ có doanh số.

**Đường trích (khi đúng là sổ chi tiết từng dòng):**

- ngày bán
- số chứng từ (đếm distinct trong ngày, theo nhân viên → số đơn)
- nhân viên (cột có sẵn trên sổ)
- doanh số của dòng (cộng theo chứng từ, theo ngày, theo nhân viên)

**Chuẩn hoá tên nhân viên — dùng danh sách CÓ SẴN trong chính file kế
toán, không tự suy đoán.** Chủ dự án xác nhận file có danh sách nhân
viên; so khớp gần đúng (không phân biệt hoa/thường, không dấu) các biến
thể cách viết trong cột `employee` vào danh sách đó. Tên nào KHÔNG khớp
được rõ ràng → liệt kê riêng, báo cáo lại cho chủ dự án TRƯỚC khi ghi,
đừng tự đoán ghép vào ai. Dòng thiếu hẳn nhân viên (cột rỗng) → gộp vào
một khoá riêng `_chua_xac_dinh`, không bỏ dòng, không gán bừa cho ai.

**Tầng LINE (chốt 11/09/2026) — đơn vị phân tích chính thức.** Doanh số
xem theo LINE, không theo tên nhân viên: line cố định xuyên thời gian, tên
nhân viên trong line thì thêm/bớt/đổi được. Mười line, bảng ánh xạ nằm ở
`bc/quyetdinh/line` (DỮ LIỆU, không phải code), gộp LÚC ĐỌC bằng
`engine/src/line.mjs::gopTheoLine()`. Chi tiết đầy đủ + số thật: xem mục
"LINE" trong "Trạng thái hiện tại" ở đầu file.

**Gộp theo NHÂN VIÊN như file ghi tại thời điểm bán — KHÔNG theo hotline.**
Chủ dự án xác nhận: hotline được bàn giao giữa các nhân viên khi có người
nghỉ, và về lâu dài cần xem được hiệu suất liên tục theo hotline chứ
không vỡ vụn mỗi lần đổi người — NHƯNG file sổ bán hàng không có cột
hotline riêng, nên việc đó cần một bảng ánh xạ (nhân viên → hotline →
khoảng thời gian) chưa tồn tại. **Không tự suy đoán ánh xạ này.** P2 gộp
đúng theo tên nhân viên ghi trên từng dòng; việc xem theo hotline để dành
cho một phase sau, khi có bảng ánh xạ.

KHÔNG khớp mã hàng, KHÔNG cần Tracking, KHÔNG cần bảng giá — xem CLAUDE.md
mục "Khớp mã hàng". KHÔNG cần lưu tên/SĐT/địa chỉ khách cho việc này (dù
kiến trúc chung vẫn cho phép sau — Q1); PII đi qua bộ nhớ tiến trình rồi
bỏ, không log, không ghi ra file trung gian trong repo.

Ghi vào `bc/ky/<YYYY-MM>/<nhân viên>/<ngày>`: `{doanh_so, so_don}` — MỘT
THÁNG là một `<kỳ>`, đúng quy ước sẽ dùng cho P3 sau này (upload sống),
để phần biểu đồ ngay dưới đây đọc được liền mạch bất kể dữ liệu tới từ
đợt nạp này hay từ upload sống sau này. Viết logic gộp này thành MỘT hàm
dùng chung ở Engine — P3 sau này gọi lại đúng hàm đó cho dữ liệu sống,
không viết hai lần.

**Phần (b) — biểu đồ, đọc từ đúng dữ liệu phần (a) vừa nạp:**

**Kỹ thuật: chạy như script offline, không chạy trong runtime Worker.**
20 tháng sổ chi tiết có thể tới hàng chục nghìn dòng — Cloudflare Worker
giới hạn CPU/bộ nhớ khá chặt, không hợp để parse file lớn ngay trong
request. Trích + gộp bằng một script chạy trực tiếp trong phiên làm việc
(không deploy như Worker), rồi ghi kết quả vào Firebase qua REST API bằng
CHÍNH service account đã cấu hình (`FB_SA_EMAIL`/`FB_SA_KEY`) — tài khoản
dịch vụ đi vòng qua rules, không cần route HTTP mới nào.

**Đối chiếu: NỘI BỘ, không cần số tham chiếu ngoài.** Không có số tổng
tách riêng để so — kiểm tính nhất quán của chính phép cộng: tổng các
ngày trong một tháng phải bằng đúng tổng tháng tính trực tiếp từ toàn bộ
dòng của tháng đó (không rơi dòng, không đếm trùng số chứng từ). Chủ dự
án tự xem lại vài tháng trên sản phẩm thật sau khi merge, theo đúng quy
trình đã chốt — không phải điều kiện chặn merge.

**Bạn nhìn thấy gì:** biểu đồ doanh số + số đơn theo nhân viên, từ
01/2025 tới hôm nay, đọc từ `bc/ky` đã nạp; bấm vào một cột thấy chi tiết
ngày. Cuộn được lên tuần/tháng/quý/năm; so kỳ này với kỳ trước, cùng kỳ
năm trước. Không tính lại lúc mở trang — biểu đồ đọc thẳng số đã tính sẵn
ở bước trích.

**Ra khỏi phase khi:** đối chiếu nội bộ (ngày cộng lên tháng) khớp 0 lệch
cho toàn bộ 01/2025–08/2026, danh sách tên không khớp được (nếu có) đã
báo cáo rõ, VÀ biểu đồ hiển thị đúng số đó — so sánh tháng này với tháng
trước, quý này với quý trước ra đúng cho mọi nhân viên.

---

### P3 — Cơ chế tải file doanh số theo thời điểm, nối dài dữ liệu

Tải lên sổ bán hàng thô của **một kỳ hiện tại/tương lai** (từ tháng bắt
đầu dùng V2 hàng ngày trở đi) — qua UI thật trên trình duyệt, không phải
script chạy tay như P2. Gateway trích ĐÚNG hàm đã viết ở P2
(`gop-ban-hang.mjs` hoặc bản kế thừa) — cùng grain, cùng nhánh
`bc/ky/<YYYY-MM>/<nhân viên>/<ngày>`, nối liền vào chuỗi legacy mà không
cần đổi gì ở biểu đồ P2.

Đây là phase chứng minh đường dây UPLOAD chạy đầu-cuối (trình duyệt →
Gateway → Engine → Firebase → màn hình) — thứ P2 không cần vì P2 nạp
thẳng bằng script, không qua UI. Đây cũng là cách chính để dữ liệu "sống
tiếp" theo thời gian — mỗi kỳ mới tải lên là một lần nối dài chuỗi P2 đã
dựng, không phải một tính năng riêng.

**Bạn nhìn thấy gì:** nhập sổ tháng hiện tại, biểu đồ P2 nối tiếp liền
mạch từ tháng trước, không đứt gãy ở mốc chuyển từ legacy sang sống.

**Ra khỏi phase khi:** một kỳ tải qua UI đối chiếu khớp Excel, nối đúng
vào chuỗi thời gian đã có từ P2.

---

### P4 — Phân tích giá vốn, dựa trên dữ liệu P3 (chỉ từ ~07/09/2026)

Chủ dự án xác nhận vẫn cần giá vốn/lợi nhuận, nhưng xây dựa trên đúng dữ
liệu SỐNG của P3 — không phải dữ liệu legacy của P2. Đây khớp đúng một
giới hạn dữ liệu thật đã biết từ trước, không phải trùng hợp: hệ Min
theo ngày bán của Tracking (`min_ngay`) chỉ có bản ghi ổn định từ cron
chạy 20 phút/lượt bắt đầu khoảng 07/09/2026 (xem audit F-03/F-08 và ghi
chú "bản ngày cron chỉ từ 07/09" trong `PROJECT_PROGRESS.md` của Reports
V1) — đúng giai đoạn P3 mới bắt đầu có sổ sống để tải lên. Kỳ trong P2
(2025 → 08/2026) KHÔNG có giá vốn theo ngày để đối chiếu — không phải
lỗi, không phải việc chưa làm, là giới hạn của chính nguồn Tracking.

Nối vào hệ Min theo ngày bán đang có sẵn bên Tracking (`POST
/api/min-ngay`) — không viết lại. Mỗi dòng hàng có giá vốn theo đúng
ngày bán, hoặc nói rõ vì sao chưa có. Đây là nơi bài toán khớp tên hàng
(Q5 — gán thủ công kiểu Tracking) thật sự chạm vào lần đầu — và CHỈ ở
phase này, không ở P2/P3.

**Bạn nhìn thấy gì:** lợi nhuận của một kỳ đã tải qua P3 (≥ 07/09/2026),
cộng danh sách rõ ràng "N dòng chưa có giá vốn, vì lý do gì". Kỳ thuộc
P2 (legacy) ghi rõ "ngoài phạm vi dữ liệu Tracking", không hiện số 0 gây
hiểu nhầm.

**Ra khỏi phase khi:** lợi nhuận một kỳ thật đã tải qua P3 đối chiếu khớp
tay.

---

### P5 — Chỉnh sửa tay + audit trail

Sửa tay khi cột nhân viên trên sổ sai/thiếu (ghi nhầm người, để trống),
áp dụng cho cả dữ liệu legacy (P2) lẫn dữ liệu sống (P3). Mọi lần sửa ghi
kèm người sửa + thời điểm vào `bc/quyetdinh`, hợp nhất lúc đọc — đúng cơ
chế đè-không-mất ở mục 8 của audit. Đây là audit trail thật đầu tiên của
V2 (F-05 của V1 không có ai để ghi).

**Bạn nhìn thấy gì:** sửa một dòng gán sai nhân viên (kể cả trong dữ liệu
legacy), số liệu cập nhật ngay trên biểu đồ P2, và lịch sử ai sửa gì lúc
nào.

**Ra khỏi phase khi:** có ít nhất một sửa tay thật, sống qua một lần nhập
lại kỳ đó (không bị đè mất).

---

### P6 — Sản phẩm, thương hiệu, cơ cấu — TUỲ CHỌN, không cam kết

Chủ dự án xác nhận KHÔNG cần chi tiết từng mặt hàng cho nhu cầu hiện tại.
Phase này ở lại roadmap chỉ để không mất bối cảnh kỹ thuật (nhãn thương
hiệu/nhóm hàng đọc từ Tracking, `GET /api/xuat/`, danh sách đóng 40
hãng) — KHÔNG làm trừ khi chủ dự án yêu cầu rõ. Không tính vào ước lượng
tổng của lộ trình.

**Nếu được yêu cầu, bạn sẽ thấy gì:** mặt hàng nào tạo doanh thu, hãng
nào tạo lợi nhuận.

---

### P7 — Khai tử V1

Phần "di trú số 2025 → nay" đã làm ở P2 (qua sổ chi tiết bán hàng thô,
không qua PostgreSQL/JSONL của V1 — hai nguồn đó chỉ có tổng cả công ty,
không tách theo nhân viên). Bốn việc còn lại khi khai tử (xem
`docs/audit/...` mục 5):

1. Đối chiếu chéo một lần với PostgreSQL + JSONL của V1 (không phải
   nguồn trích chính, chỉ để xác nhận không lệch) trước khi tắt bất cứ
   gì.
2. Xoay `REPORT_API_KEY`.
3. Tắt Render service, PostgreSQL, R2 bucket.
4. Trỏ `reports.tinphatcrm.com` sang V2 (bật `ENFORCE_CANONICAL_HOST=1`).

Chạy song song hai hệ một kỳ đầy đủ trước khi tắt, để có một lần đối
chiếu thật.

**Ra khỏi phase khi:** Render, PostgreSQL, R2 đã tắt; khoá đã xoay; hoá
đơn hai nơi về 0.

---

## Cách một session mới bắt đầu

1. Đọc `CLAUDE.md` (luật gốc, kể cả mục "Quy trình Git").
2. Đọc file này, mục "Trạng thái hiện tại" — biết đang ở phase nào.
3. Làm đúng phase đó, không nhảy cóc.
4. Test xanh + tự deploy xác nhận được đúng điều "Bạn nhìn thấy gì" của
   phase → tạo PR, merge NGAY vào nhánh mặc định, không hỏi lại (xem
   `CLAUDE.md`).
5. Trước khi kết thúc phiên: cập nhật "Trạng thái hiện tại" + đổi ⬜ → ✅
   trong bảng. Chủ dự án review trên sản phẩm thật ở thời điểm của họ,
   không phải điều kiện để merge — phát hiện lỗi thì mở session mới yêu
   cầu repair đúng phase đó, không coi là mở lại từ đầu.
