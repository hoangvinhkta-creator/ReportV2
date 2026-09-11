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

**P1 XONG (11/09/2026). P2 phần (a) — trích + nạp — CÓ ĐỦ DỮ LIỆU và đối
chiếu khớp 0 lệch cho TOÀN BỘ 01/2025–08/2026. Tầng LINE (phân tích theo
kênh, cố định xuyên thời gian) đã chốt và đã code — xem "LINE" ngay dưới.
Còn CHỜ khoá service account để ghi, và phần (b) — biểu đồ — CHƯA LÀM
(xem "P2 — còn thiếu gì").**

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
| 2025-01 | 25.810.873.727 | 1.928 | 8 | 26 |
| 2025-02 | 18.035.390.000 | 1.505 | 10 | 24 |
| 2025-03 | 13.142.945.600 | 1.216 | 9 | 31 |
| 2025-04 | 14.095.335.000 | 1.174 | 9 | 28 |
| 2025-05 | 17.235.272.000 | 1.447 | 9 | 30 |
| 2025-06 | 16.778.365.001 | 1.490 | 9 | 30 |
| 2025-07 | 19.281.441.000 | 1.709 | 11 | 31 |
| 2025-08 | 24.560.420.000 | 1.869 | 11 | 31 |
| 2025-09 | 15.775.529.000 | 1.286 | 11 | 28 |
| 2025-10 | 20.323.640.000 | 1.651 | 9 | 31 |
| 2025-11 | 23.615.003.000 | 1.871 | 12 | 30 |
| 2025-12 | 23.279.631.000 | 1.668 | 10 | 31 |
| 2026-01 | 25.485.686.000 | 1.864 | 11 | 31 |
| 2026-02 | 23.798.651.000 | 1.881 | 11 | 19 |
| 2026-03 | 15.585.862.240 | 1.351 | 10 | 31 |
| 2026-04 | 13.479.338.000 | 1.210 | 9 | 28 |
| 2026-05 | 14.668.728.000 | 1.182 | 9 | 30 |
| 2026-06 | 14.474.146.000 | 1.226 | 11 | 30 |
| 2026-07 | 14.527.576.000 | 1.205 | 10 | 31 |
| 2026-08 | 15.824.320.000 | 1.150 | 8 | 28 |
| **TỔNG** | **369.778.152.568** | **29.883** | | |

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

**Một quyết định nghiệp vụ CHƯA CHỐT — `LUAT_DOANH_SO`.** Sổ cho hai cách
đọc "doanh số của một dòng", lệch nhau **120.981.000 đ** trên cả 20 tháng
(47.101.000 đ chỉ riêng 2026, cộng thêm 73.880.000 đ của 2025):

- `cot-doanh-so-ban` (**đang bật**) — cột `Doanh số bán` nguyên văn →
  369.778.152.568 đ. Tự nhất quán với dòng `Tổng cộng` của mỗi sổ.
- `tru-chiet-khau` — `Số lượng × Đơn giá − Chiết khấu` → 369.657.171.568 đ.
  Đây là luật V1 (`DEC-114`, ghi rõ "Owner xác nhận trực tiếp 2026-08-23").

Đổi luật = sửa MỘT hằng số trong `gop-ban-hang.mjs` rồi chạy lại script —
cả hai luật đều có bài kiểm canh. Chủ dự án không có số tổng tách riêng để
so (điều kiện ra phase là đối chiếu nội bộ), nên đây là việc họ tự xem lại
trên sản phẩm thật rồi nói nếu thấy sai.

**25 dòng không có tên nhân viên** trên cả hai sổ (65.300.000 đ, 4 dòng ở
2025 + 21 dòng ở 2026, hầu hết 07–08/2026): KHÔNG bị bỏ, KHÔNG gán bừa
cho ai — dồn vào khoá `_chua_xac_dinh` để tổng tháng vẫn khớp sổ, và
script in ra danh sách số chứng từ. Đây đúng là việc P5 sẽ sửa tay.

**16 tên nhân viên trên cả hai sổ, script CHỈ LIỆT KÊ — không tự ghép**
(so với 14 tên chỉ thấy ở riêng sổ 2026). Đúng theo yêu cầu "dùng danh
sách CÓ SẴN trong file kế toán, đừng tự đoán ghép vào ai": script in danh
sách tên kèm số dòng và doanh số, sắp theo doanh số giảm dần. Ba chỗ đáng
chú ý khi chủ dự án soi lại:

- **`Tống Khánh Linh 0865111033` và `Lê Văn Quân 0865111033` dùng CÙNG
  một số hotline.** Đúng hiện tượng bàn giao hotline mà chủ dự án mô tả.
  P2 gộp theo TÊN như sổ ghi, không theo hotline — chờ bảng ánh xạ.
- `Thảo Linh` (3.059.270.000 đ, cả hai sổ) và `Tống Khánh Linh
  0865111033` (129.850.000 đ) có thể là một người viết hai cách, hoặc
  hai người khác nhau. **Không đoán** — cần chủ dự án nói.
- Hai tên MỚI chỉ thấy ở sổ 2025: `Miền Bắc 0865.909.033` (3.341.556.000
  đ — có thể là tên một khu vực/nhóm, không phải một cá nhân) và `Đinh
  Thùy Dương` (13.200.000 đ).

Bốn tên `Mr Quý`, `Mr Vinh`, `Đức Hiệp`, `Tín Phát 0869931931` không có
họ tên đầy đủ, nên không tự khớp được vào danh sách kế toán.

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
| Nội thành | 237.782.673.600 | 20.266 | 4 |
| Tín Phát | 54.062.560.000 | 4.027 | 1 |
| Tổng kho | 24.153.018.727 | 1.841 | 1 |
| Quyết chiến | 18.275.399.001 | 1.182 | 1 |
| Đông Á | 17.341.660.240 | 1.243 | 1 |
| Tân Á | 11.504.115.000 | 870 | 1 |
| Miền Bắc | 3.341.556.000 | 248 | 1 |
| Khác | 3.187.320.000 | 196 | 5 |
| Fanpage | 129.850.000 | 10 | 1 |
| Shopee | 0 | 0 | 1 *(tên đã khai, chưa có dòng)* |
| **TỔNG** | **369.778.152.568** | **29.883** | |

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

### P2 — còn thiếu gì để ra khỏi phase

**Phần (a) — trích + nạp — đối chiếu nội bộ đã khớp 0 lệch cho TOÀN BỘ
01/2025–08/2026.** Việc còn lại của phần (a) — chỉ còn CHỜ KHOÁ:

1. **Chưa ghi vào Firebase.** Không có phiên làm việc nào tới nay có
   `FB_SA_EMAIL`/`FB_SA_KEY` (đó là Secret của Worker, không nằm trong
   repo — đúng như phải vậy). Script đã chạy xong phần trích và in bảng
   đối chiếu ở chế độ **chạy thử** (mặc định, không cần khoá) cho cả hai
   sổ cùng lúc. Lượt ghi thật cần chủ dự án chạy trên máy có khoá:

   ```
   export FB_SA_EMAIL='firebase-adminsdk-fbsvc@tinphattracking.iam.gserviceaccount.com'
   export FB_SA_KEY="$(cat khoa.pem)"
   node bin/nap-so-legacy.mjs --ghi --doc-lai "So chi tiet ban hang 2025.xlsx" "So chi tiet ban hang 2026.xlsx"
   ```

   `--doc-lai` đọc ngược từng kỳ vừa ghi và so lại tổng — "đã ghi" không
   phải là một dòng chữ script tự in ra.
2. **Danh sách nhân viên chuẩn chưa có.** Chủ dự án chốt: chuẩn hoá tên
   dựa vào danh sách CÓ SẴN trong **file kế toán** (`Báo cáo Kinh doanh
   2025/2026.xlsx`) — file đó KHÔNG được gửi và không có trong repo nào
   (`.gitignore: *.xlsx` bên Reports V1). Nên script làm đúng nửa việc
   thuộc về nó: **liệt kê 16 tên như sổ ghi, kèm số dòng và doanh số,
   không tự ghép tên nào với tên nào**. Cần chủ dự án nói tên nào là biến
   thể của tên nào (ba chỗ nêu trên), hoặc gửi file kế toán để đọc danh
   sách.

   *Tầng LINE làm việc này BỚT GẤP:* biểu đồ vẽ theo line, và line đã bền
   xuyên thời gian rồi. Hai cách viết của cùng một người, nếu cả hai đều
   được xếp vào đúng một line, thì ra cùng một cột — tên trùng chỉ còn ảnh
   hưởng tới phần tách `nguon` bên trong line.
3. ~~Năm tên chưa xếp line~~ — **XONG 11/09/2026**: chủ dự án chốt giữ cả
   năm ở "Khác", và đã khai tường minh. `chua_xep` hiện RỖNG. Bảng line
   sẵn sàng nạp bằng `node bin/nap-line.mjs --ghi --doc-lai` (lượt ghi
   riêng, không liên quan tới lượt ghi `bc/ky`).

**Phần (b) — biểu đồ — CHƯA BẮT ĐẦU.** Đọc từ `bc/ky` + `bc/quyetdinh/line`
sau khi đã ghi, gọi `gopTheoLine()` ở Engine, dựng biểu đồ doanh số + số
đơn **theo LINE** từ 01/2025 tới hôm nay (bấm vào một line thì mở ra
`nguon` — từng nhân viên trong line đó), cuộn được lên
tuần/tháng/quý/năm, so kỳ này với kỳ trước/cùng kỳ năm trước. Đây là việc
TRƯỚC MẶT tiếp theo, và cần dữ liệu đã NẰM Ở FIREBASE trước (việc 1 ở
trên) — không đọc thẳng từ script chạy tay.

Việc Gateway cần thêm ở phần (b): một endpoint đọc `bc/ky` + bảng line rồi
gọi Engine. Engine ĐÃ có sẵn `gopSoBanHang()` và `gopTheoLine()` qua
Service Binding — theo đúng bẫy số 4 (hàm Engine lên trước, Gateway gọi ở
lượt merge sau), nên phần (b) chỉ còn phải thêm phía Gateway + trang tĩnh.

### Hạ tầng đang sống — P2 nhận nguyên, không dựng lại

| Thứ | Giá trị | Ghi chú |
|---|---|---|
| Gateway | `reportv2-gateway` → `https://reportv2-gateway.hoangvinhkta.workers.dev` | phục vụ `public/`, endpoint `/api/me` |
| Engine | `reportv2-engine` | riêng tư, `workers_dev = false`, gọi qua binding `REPORT_ENGINE` |
| Secret trên Gateway | `FB_SA_EMAIL`, `FB_SA_KEY` | service account `firebase-adminsdk-fbsvc@tinphattracking...` |
| Cloudflare Access | app self-hosted, destination = **Workers** scope `reportv2-gateway` | đăng nhập bằng **One-time PIN**, allowlist theo TỪNG email (công ty không có domain email riêng) |
| Rules `bc/` | đã publish live | `bc/ky`, `bc/quyetdinh` `.read` theo `vai`; `bc/khach`, `bc/imei` đóng hẳn |
| CI | `.github/workflows/kiem.yml` | `npm test` mỗi lần push |

`npm test`: 10 bộ, 372 đạt, 0 hỏng.

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
| P2 | Dữ liệu gốc (2025→08/2026) + biểu đồ | 2 tuần | 🟨 Đang làm — xem "Trạng thái hiện tại" |
| P3 | Cơ chế tải file doanh số theo thời điểm, nối dài dữ liệu | 1–2 tuần | ⬜ Chưa bắt đầu |
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
