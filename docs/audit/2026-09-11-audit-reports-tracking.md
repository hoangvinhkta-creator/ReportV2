# Kiểm toán kỹ thuật — Reports & Tracking, và lộ trình dựng lại V2

**Ngày:** 2026-09-11
**Phạm vi:** đọc toàn bộ `hoangvinhkta-creator/Reports` (@ `5521192`) và
`hoangvinhkta-creator/Tracking` (@ `392c623`), không chạy code, không sửa
một dòng nào.

**Repo `Reports` (V1) từ nay chỉ để tham chiếu** — không dùng, không sửa.
Mọi phát triển tiếp theo đi vào repo này (`ReportV2`). Tài liệu dưới đây là
bản ghi chẩn đoán tại thời điểm quyết định đó, và các quyết định đã chốt ở
mục 7 là nguồn sự thật cho `CLAUDE.md` ở gốc repo.

---

## 1. Hai repo đang ở đâu

Số đo trực tiếp từ mã nguồn, không lấy từ tài liệu.

| Hạng mục | Reports (V1) | Tracking |
|---|---|---|
| Nền công nghệ | Python 3.11 · Flask · Jinja | Cloudflare Worker · HTML tĩnh |
| Mã ứng dụng | 48.556 dòng / 151 file .py | 18.539 dòng / 12 file |
| Mã kiểm thử | 65.279 dòng | 89 file `kiem/` |
| Bộ kiểm | 3.681 pytest · 25 DOM · 35 Playwright | 69 bộ · 3.256 khẳng định |
| CI thật sự chạy gì | Chỉ validator governance — **không chạy test** | `npm test` mỗi lần push, và chặn cả build Cloudflare |
| Nơi chạy | Render (Docker) + Cloudflare Access | Cloudflare Workers + Access + 2 Engine riêng tư |
| Nơi lưu | PostgreSQL + R2 + file trong repo | Firebase RTDB (chung với app Marketing) |
| Giao diện | 32 template · 51 route · 3 tab | 1 file `index.html` · 1 màn hình chủ 6 thẻ |
| Tài liệu quản trị | 139 session · 126 DEC · 27.612 dòng | 7 file .md |

Reports V1 lớn gấp gần ba lần Tracking về mã, gấp bốn lần về kiểm thử, và
toàn bộ khối đó được viết trong khoảng ba tuần. Tracking mất hơn hai tuần
cho một khối nhỏ hơn nhiều nhưng đã chạy thật, có người dùng thật, và có CI
chặn được bản hỏng.

## 2. Dữ liệu đang chảy thế nào

Điều quan trọng nhất: **Reports chưa bao giờ chạm Firebase.**

```
Sổ bán hàng (.xlsx)
      │
      ▼
Reports V1 (Flask · Render, 51 route, không đăng nhập, PostgreSQL + R2)
      │  GET /api/xuat/<5 nhánh>  +  header X-Report-Key
      │  POST /api/min-ngay
      ▼
Worker Tracking (price.tinphatcrm.com — giữ service account,
                  chiếu dữ liệu rồi mới trả)
      │
      ▼
Firebase RTDB (board · alias · inv · min_ngay · profiles)
```

Reports KHÔNG có credential Firebase, không Auth, không App Check — mọi
thứ đi qua đúng một header trên đúng hai đường HTTP.

Đây là điểm kiến trúc **làm đúng nhất** của hệ thống hiện tại, và nó đáng
giữ nguyên cho V2: Tracking giữ service account, chiếu ra đúng năm nhánh
trong một danh sách đóng, trả `502` khi nguồn hỏng chứ không bao giờ trả
`200 {}`. Reports không có cách nào đọc `profiles` hay `devices` kể cả khi
bị chiếm quyền.

## 3. Vì sao V1 rối

Mười một phát hiện, xếp theo mức độ ảnh hưởng tới quyết định bỏ hay giữ.

### F-01 — Cao — 51 route, 3 tab — hơn 30 trang không ai vào được

Thanh điều hướng đã bị rút xuống ba mục (Báo cáo / Nhân viên / Dữ liệu),
nhưng không route nào bị xoá. Chính chú thích trong mã thừa nhận điều đó.
Kết quả: một nửa ứng dụng vẫn sống, vẫn phải kiểm thử, vẫn có thể trả số
sai — mà không nằm trong đường đi của ai cả.

```
app/web/server.py            51 × @app.get/@app.post
templates/layout.html        3 × thẻ <a> trong <nav>
chú thích tại chỗ:  "vẫn còn nguyên route — không bị xoá —
                     chỉ không còn là tab thường trực"
```

### F-02 — Cao — Hai thế hệ trang trả lời cùng một câu hỏi

Nhóm cũ (`/tong-quan`, `/ban-hang`, `/san-pham`, `/nhan-vien`,
`/doanh-so-ngay`, `/lich-su`) và nhóm mới `/kinh-doanh/*` — 20 route, cộng
thêm 5 route `/kinh-doanh/phan-tich/*` — cùng nói về doanh thu, nhân viên
và cơ cấu. Người dùng không biết con số nào là thật; người viết mã phải
sửa hai chỗ mỗi lần đổi một quy tắc.

### F-03 — Cao — Mỗi lần chạy báo cáo là một lần kéo lại toàn bộ dữ liệu Tracking

Kiến trúc "pull on report run" cố ý không giữ bản sao nào. Hệ quả đo được
trên production: một lần chạy sổ mất từ 44 giây đến 277 giây chỉ riêng
phần gọi Tracking — và đó là lý do Tracking phải sửa gấp thành đọc mã song
song theo lô hôm 11/09.

```
log reports.timing (production):  tracking_ms = 44.000 → 277.000
Tracking PR #31:  "đọc mã song song theo lô trong xuatMinNgay(), sửa 524"
```

### F-04 — Cao — Ứng dụng không có đăng nhập

Không có route đăng nhập, không có session, không có kiểm tra danh tính ở
bất kỳ đâu trong `app/`. Toàn bộ kiểm soát truy cập nằm ở Cloudflare Access
phía trước tên miền. Một cấu hình Access sai là mở toàn bộ lương, hoa
hồng, giá nhập và thông tin khách hàng — và không có lớp thứ hai nào chặn
lại.

```
grep login|session|authenticate trên app/  →  0 kết quả
so sánh: Tracking có src/auth.js kiểm chữ ký Firebase ID token
         + kiểm nhánh devices + Access + App Check
```

### F-05 — Cao — Audit trail có đủ cột, nhưng không có danh tính để ghi vào

Lược đồ có 13 cột ghi người thực hiện (`entered_by`, `classified_by`,
`excluded_by`…) và chúng thật sự được ghi — cấu trúc đúng và dùng lại
được. Vấn đề nằm ở giá trị: nó đến từ một biến môi trường cố định, mặc
định là chuỗi `owner-web`. Mọi quyết định trong toàn hệ thống vì vậy mang
cùng một tên người. Đây là hệ quả trực tiếp của F-04 — không có đăng nhập
thì không có ai để ghi.

```
tools/db/schema.py             13 cột *_by, đều nullable
identity_gateway.actor_of()    env["REPORTS_IDENTITY_ACTOR"] or "owner-web"
```

### F-06 — Trung bình — 3.681 bài kiểm không bao giờ chạy tự động

Workflow CI duy nhất chỉ chạy các validator governance. Bộ pytest và
Playwright chỉ chạy khi có người nhớ gõ lệnh. Tracking làm ngược lại và
làm đúng: `npm test` nằm trong build command của Cloudflare, bộ kiểm hỏng
là build hỏng, bản cũ ở nguyên.

```
.github/workflows/governance.yml  →  grep pytest = 0
```

### F-07 — Trung bình — Số liệu 2025 → nay nằm rải ba nơi khác loại

Doanh thu theo ngày của 579 ngày (từ 02/01/2025) nằm trong một file JSONL
**commit thẳng vào repo**. Số 2026 nằm trong PostgreSQL. Artifact Excel
nằm trong R2. Không nơi nào là nguồn sự thật đầy đủ, và phần nằm trong
repo sẽ biến mất cùng repo khi bỏ V1.

```
data/chart_gapfill/daily_revenue.jsonl   579 dòng, từ 2025-01-02
data/chart_gapfill/daily_orders.jsonl    579 dòng
PostgreSQL (Render, Virginia)            dữ liệu 2026
R2 bucket reports-web-runs               artifact theo run_id
```

### F-08 — Trung bình — Có thao tác vận hành bắt buộc mà giao diện không có nút

Sổ 01–03/09 chạy ra rỗng vì chưa ai gọi `POST /api/min-ngay/dung-lai`.
Đường duy nhất để gọi là dán một đoạn lệnh vào Console trình duyệt. Một hệ
thống mà người vận hành phải mở Console mới dùng được thì chưa xong, dù
mọi bài kiểm đều xanh.

### F-09 — Trung bình — Quy trình quản trị ăn phần lớn thời gian

139 hồ sơ phiên, 126 quyết định, 27.612 dòng tài liệu trạng thái, 68 file
luật — cho một sản phẩm ba tuần tuổi mà giao diện vẫn chưa dùng được. Bản
thân bộ luật không sai; vấn đề là nó được áp ở mức TEAM cho một dự án một
người, nên mỗi tính năng nhỏ phải đi qua ready gate, completion gate,
independent review và repair cycle.

### F-10 — Trung bình — Bài toán khớp tên hàng chưa được giải, chỉ được bọc

25 file trong `app/modules/product/identity/` tồn tại chỉ để trả lời "dòng
hàng này trên sổ bán là mã nào trong bảng giá". Đây là bài toán gốc thật,
nhưng nó đang được giải bằng cách chồng thêm lớp (registry, journal, drift,
rejection, cross_system…) thay vì bằng một quy ước nhập liệu ở đầu nguồn.

### F-11 — Thấp — Một file 5.327 dòng giữ toàn bộ tầng web

Cả 51 route nằm trong một hàm factory duy nhất của `app/web/server.py`. Mã
được chú thích rất kỹ — kỹ hơn hầu hết mã sản xuất — nhưng kích thước đó
khiến mọi thay đổi đều chạm vào vùng có rủi ro lan rộng.

## 4. Ba mục tiêu V2, đánh giá từng cái

### ① Trang tĩnh, nghiệp vụ nằm ở backend

Khả thi, và đã có khuôn mẫu chạy thật. `QUY-CHUAN.md` mục 6.1 (repo
Tracking) đã viết sẵn danh sách khởi tạo cho một công cụ mới, rút ra từ
tám lần vấp của Tracking. Dùng nguyên danh sách đó.

Một đính chính quan trọng: Tracking hôm nay **chưa phải** mô hình "backend
giữ hết". Trình duyệt đọc và ghi thẳng Realtime Database ở 51 chỗ, và lớp
chặn là rules. Chỉ phần *thuật toán* (đọc bảng giá, so sánh, tính chốt,
đọc tồn) mới nằm sau Worker riêng tư.

Với Reports V2 thì mức đó **chưa đủ**, vì dữ liệu nặng hơn hẳn: lợi nhuận
từng dòng, lương và hoa hồng từng người, tên/số điện thoại/địa chỉ khách,
IMEI. Khuyến nghị: V2 **không đọc thẳng RTDB từ trình duyệt**. Mọi thứ đi
qua Worker Gateway, frontend chỉ nhận số đã tính sẵn và đã lọc theo vai.

### ② Làm từng bước, xem kết quả thật rồi mới đi tiếp

Đây chính là điều V1 làm sai nhất. V1 xây engine, pipeline, product
identity, price resolution, conversion, adjustment — rồi mới dựng giao
diện, và lúc dựng xong thì giao diện không khớp với cách người ta thật sự
làm việc.

Cách chữa cụ thể cho V2: mỗi phase là một **lát cắt dọc** — từ ô nhập liệu
xuống tới nơi lưu rồi quay lại màn hình — chứ không phải một tầng ngang.
Mỗi lát cắt lên production thật, mở bằng máy thật, rồi mới mở lát tiếp
theo. Phase nào không trả được một thứ nhìn thấy được thì phase đó chia
nhỏ nữa.

### ③ Dùng chung backend Firebase với Tracking

Khả thi, với bốn rủi ro đã tính vào thiết kế ở mục 8:

- **Firebase này không chỉ của Tracking** — dùng chung một Firebase, một
  hệ quyền, một site key App Check, một bản rules với app Marketing.
- **Realtime Database không có phép tổng hợp** — không có `GROUP BY`.
  Tính lúc đọc là kéo cả kỳ về mỗi lần mở trang, đúng cái bẫy đã làm V1
  chạy 277 giây. Lối đúng: tính sẵn lúc ghi.
- **Bảng vai là bản sao y giữa hai repo** — `VAI_KN` (5 vai × 12 khả năng)
  đối chiếu chéo bằng `kiem/vai-tro.js` với repo Marketing. Thêm một khả
  năng cho V2 nghĩa là sửa cả hai repo.
- **Quyền đọc lan xuống toàn cây con** — `.read` mở ở nhánh cha là mở cả
  cây bên dưới, và một `.read: false` ở nhánh con không rút lại được.
  Tracking đã ngã đúng chỗ này với `mkt/*` (mục R6 trong `TIEN-DO.md`).

## 5. Bỏ Reports V1 thì phải gỡ rules gì

**Câu trả lời ngắn: không có rules nào để gỡ.**

Reports chưa bao giờ có mặt trong `firebase-database.rules.json`. Nó
không có tài khoản Firebase, không có ID token, không có App Check. Nó
gọi đúng hai đường HTTP của Worker bằng một header. Vì vậy nỗi lo "rules
thừa" không tồn tại — đây là kết quả của một quyết định kiến trúc đúng từ
đầu, và nó cũng có nghĩa là việc cắt V1 rẻ hơn tưởng rất nhiều.

Cái *thật sự* tồn tại bên Tracking vì Reports là mã và lịch chạy, không
phải rules. Và gần như toàn bộ số đó **V2 vẫn cần** — nên đừng xoá.

| Thứ tồn tại vì Reports | Ở đâu | Quy mô | Xử lý |
|---|---|---|---|
| Khối xuất dữ liệu chỉ-đọc (`xuatBaoCao`, `chieuBoard`, `HANG`, `nhomCua`…) | `src/index.js` ~473–1004 | ≈530 dòng | **Giữ nguyên** |
| Hệ Min theo ngày bán — chụp, chốt, sửa, dựng lại | `src/min-ngay.js` | 1.305 dòng | **Giữ nguyên** |
| 5 nhánh rules `min_ngay*` (`.write: false`, chỉ Worker ghi) | `firebase-database.rules.json` | 5 nhánh | **Giữ nguyên** |
| Cron chụp Min mỗi 20 phút | `wrangler.toml` `[triggers]` | 1 dòng lịch | **Giữ nguyên** |
| Bộ kiểm hợp đồng xuất dữ liệu | `kiem/xuat-baocao.js`, `min-ngay.js`, `dung-lai-min-ngay.js` | 1.852 dòng | **Giữ nguyên** |
| Secret `REPORT_API_KEY` | Worker `tracking` · Render env của V1 | 1 khoá | **Xoay khoá** |
| Cloudflare Access policy Bypass cho path `api` | Cloudflare dashboard | 1 policy | Giữ — CRM dùng chung |
| Render web service + PostgreSQL + R2 bucket | Render · Cloudflare R2 | 3 dịch vụ | Tắt sau khi trích dữ liệu |
| Access application + DNS `reports.tinphatcrm.com` | Cloudflare | 2 bản ghi | Gỡ, hoặc trỏ sang V2 |

**Bốn việc thật sự phải làm khi khai tử V1:**

1. Trích toàn bộ số 2025–2026 ra khỏi PostgreSQL và khỏi
   `data/chart_gapfill/*.jsonl` **trước** khi tắt bất cứ thứ gì. Đây là
   việc duy nhất không hoàn tác được.
2. Xoay `REPORT_API_KEY` — khoá cũ đang nằm trong biến môi trường Render
   của V1. Xoay chứ đừng xoá: xoá là V2 cũng không gọi được.
3. Tắt Render service, PostgreSQL và R2 bucket — kiểm tra hoá đơn đang
   chảy ở cả hai nơi.
4. Quyết định tên miền: `reports.tinphatcrm.com` trỏ sang V2 hay để V2
   mang tên khác. Nếu giữ tên cũ thì đừng gỡ Access application, chỉ đổi
   origin.

Lưu ý cho tương lai: hợp đồng Min theo ngày đã có trường phiên bản, và bên
đọc **từ chối đọc bản nó không hiểu** thay vì đọc sai. Nếu V2 cần đổi hình
dạng dữ liệu, nâng số phiên bản chứ đừng sửa tại chỗ — cơ chế đó đã được
dựng sẵn, cứ dùng.

## 6. Chín phase

Mỗi phase là một lát cắt dọc và kết thúc bằng một thứ mở được bằng máy
thật.

| Phase | Tên | Ước lượng | Trạng thái |
|---|---|---|---|
| **P0** | Chốt sáu quyết định | 1 buổi · không code | **Đã xong · 11/09** |
| **P1** | Nền móng rỗng, chạy thật | 1 tuần | Chưa bắt đầu |
| **P2** | Một con số thật, đi hết đường | 1–2 tuần | Chưa bắt đầu |
| **P3** | Giá vốn và lợi nhuận | 2 tuần | Chưa bắt đầu |
| **P4** | Nhân viên | 1–2 tuần | Chưa bắt đầu |
| **P5** | Biểu đồ và so sánh kỳ | 1 tuần | Chưa bắt đầu |
| **P6** | Sản phẩm, thương hiệu, cơ cấu | 1–2 tuần | Chưa bắt đầu |
| **P7** | Di trú số 2025 → nay | 1 tuần | Chưa bắt đầu |
| **P8** | Khai tử V1 | 1 buổi | Chưa bắt đầu |

**P0 — Chốt sáu quyết định.** Đã xong, xem mục 7. Ra khỏi phase khi sáu
quyết định được ghi vào `CLAUDE.md` — đã làm.

**P1 — Nền móng rỗng, chạy thật.** Repo private mới. Worker Gateway (xác
minh Firebase ID token, đọc vai từ `profiles`) + Worker Engine riêng tư
nối bằng Service Binding, không route public. Nhánh rules mới
deny-by-default, trong đó nhánh khách khai tường minh `.read: false` /
`.write: false`. `kiem/` chép từ Tracking. CI chạy `npm test` và chặn
build. Cloudflare Access dựng trước khi có người dùng thật. Một trang
tĩnh: đăng nhập, thấy tên mình, thấy màn hình chủ với các thẻ bị khoá.
Không một tính năng báo cáo nào ở phase này — đây là phase chứng minh
**đường dây** chạy: trình duyệt → Gateway → quyền → Engine → dữ liệu →
màn hình.
*Bạn nhìn thấy gì:* mở web bằng điện thoại, đăng nhập bằng tài khoản công
ty, thấy tên mình và sáu thẻ xám ghi "chưa có gì".

**P2 — Một con số thật, đi hết đường.** Tải lên sổ bán của **một kỳ**.
Trình duyệt đọc file .xlsx và gửi lên; Gateway tách làm hai chỗ ghi — số
liệu vào `bc/ky`, thông tin khách cùng bảng tra IMEI vào nhánh đóng — rồi
trả về đúng **một** con số: doanh thu của kỳ đó. Phase này bé đến mức
trông như lãng phí, và nó là phase quan trọng nhất: nó chốt hình dạng dữ
liệu, cách tính sẵn lúc ghi, và cách đưa sổ vào — ba thứ mà V1 chốt sai và
phải sống với suốt ba tuần.
*Bạn nhìn thấy gì:* nhập sổ tháng 9, màn hình hiện doanh thu tháng 9, đối
chiếu được với Excel trong một phút.

**P3 — Giá vốn và lợi nhuận.** Nối vào hệ Min theo ngày bán đang có sẵn —
phần này Tracking đã làm xong và đã chạy production, không viết lại. Mỗi
dòng hàng có giá vốn theo đúng ngày bán, hoặc nói rõ vì sao chưa có. Đây
cũng là nơi bài toán khớp tên hàng (F-10) xuất hiện.
*Bạn nhìn thấy gì:* doanh thu, giá vốn, lợi nhuận của kỳ — và một danh
sách rõ ràng "N dòng chưa có giá vốn, vì lý do gì".

**P4 — Nhân viên.** Gán dòng hàng cho nhân viên, tổng theo người, target
tháng. Mọi lần sửa ghi kèm người sửa và thời điểm — lấp đúng khoảng trống
F-05.
*Bạn nhìn thấy gì:* bảng nhân viên với doanh số, lợi nhuận, target, và
lịch sử ai sửa gì lúc nào.

**P5 — Biểu đồ và so sánh kỳ.** Chỉ sau khi con số đã đúng và đã được
nghiệm thu. Biểu đồ vẽ từ nhánh tổng hợp đã tính sẵn ở P2, không tính lại
lúc mở trang.
*Bạn nhìn thấy gì:* một biểu đồ doanh thu theo ngày, bấm vào một cột thì
thấy cột đó gồm những gì.

**P6 — Sản phẩm, thương hiệu, cơ cấu.** Các lát báo cáo còn lại. Nhãn
thương hiệu và nhóm hàng đã có sẵn trong khối xuất dữ liệu của Tracking
(danh sách đóng 40 hãng, khớp nguyên từ) — dùng lại, đừng dựng bộ phân
loại thứ hai.
*Bạn nhìn thấy gì:* mặt hàng nào tạo doanh thu, hãng nào tạo lợi nhuận.

**P7 — Di trú số 2025 → nay.** Trích từ PostgreSQL của V1 và từ file
JSONL trong repo cũ, nạp vào nhánh mới, đối chiếu từng tháng với bản Excel
gốc. Chỉ làm sau khi P2–P6 đã chứng minh hình dạng dữ liệu đúng.
*Bạn nhìn thấy gì:* biểu đồ chạy liền mạch từ tháng 1/2025 tới hôm nay, và
một bảng đối chiếu tháng-với-tháng lệch 0.

**P8 — Khai tử V1.** Bốn việc ở mục 5. Chạy song song hai hệ một kỳ đầy
đủ trước khi tắt, để có một lần đối chiếu thật.
*Ra khỏi phase khi:* Render, PostgreSQL và R2 đã tắt; khoá đã xoay; hoá
đơn hai nơi đã về 0.

## 7. Sáu quyết định đã chốt

Chốt ngày 11/09/2026. Không còn điểm treo.

**Q1 — Lưu đầy đủ thông tin khách.** Cần cho tính năng kích hoạt bảo hành
sau này.
*Hệ quả:* dữ liệu khách nằm ở nhánh riêng, khai `.read: false` và
`.write: false` — không cấp cho vai nào cả, kể cả `admin`. Tài khoản dịch
vụ của Worker đi vòng qua rules, nên chỉ Worker chạm được; trình duyệt
không bao giờ đọc thẳng nhánh này. Muốn tra bảo hành thì hỏi Gateway,
Gateway kiểm vai rồi trả đúng một bản ghi. Chi tiết ở mục 8.

**Q2 — Quản trị và Quản lí xem được báo cáo.**
*Hệ quả:* thêm một khả năng mới vào bảng `VAI_KN`, bật cho `quantri` và
`quanly`. Bảng này là bản sao y với repo Marketing và có bài kiểm đối
chiếu chéo — phải sửa cả hai repo trong cùng một lượt.

**Q3 — Nhập sổ bằng cách tải file .xlsx lên.**
*Hệ quả:* trình duyệt đọc file .xlsx rồi gửi lên JSON, Worker không phải
mang thư viện đọc xlsx. Theo Q1 thì gửi lên đủ cả cột khách; Gateway tách
làm hai chỗ ghi — số liệu vào nhánh báo cáo, thông tin khách vào nhánh
đóng. Đọc cột là thao tác, không phải nghiệp vụ: mọi luật giá vốn, lợi
nhuận, KPI vẫn ở backend, và Worker vẫn kiểm hình dạng dữ liệu chứ không
tin frontend.

**Q4 — Nhập lại thì đè toàn kỳ.** Chỉnh sửa tay không bị mất — xem mục 8.
*Hệ quả:* đè chỉ chạm nhánh sổ gốc. Quyết định của người nằm nhánh riêng,
hợp nhất lúc đọc.

**Q5 — Gán thủ công theo đúng cách Tracking đang gán biến thể mới.**
*Hệ quả:* không viết lại gì cả — màn hình đó đã tồn tại và được dựng đúng
cho Reports. Nó ghi một ô duy nhất `/inv/map/<khoá>`, khoá là tên hàng
viết hoa bỏ hết ký tự không phải chữ số. Hai lựa chọn, không có lựa chọn
thứ ba: một mã đã có trên bảng giá, hoặc "bỏ qua". Cần mã mới thì thêm
bên Bảng giá trước rồi quay lại chọn. Đã có 625 dòng bộ kiểm soi từng
đường ghi. Cải tiến duy nhất cho V2: thay vì tự dán danh sách vào, V2 tự
đẩy sang.

**Q6 — `*.workers.dev` lúc làm, tên miền cũ ở P8.** V2 không áp bộ quy
chuẩn của V1 — chỉ một file `CLAUDE.md`.
*Hệ quả:* đặt `ENFORCE_CANONICAL_HOST = "0"` lúc làm, để Access phía
trước, đến P8 đổi route và bật cờ về `"1"`. Không migrate nền tảng. Bản
`CLAUDE.md` nằm ở gốc repo này. Vì Firebase nay giữ thông tin khách, repo
này để private.

### Vì sao nhánh khách không cấp quyền cho ai cả

Firebase này dùng chung với app Marketing — cùng một file rules, cùng một
hệ quyền. Gác nhánh khách bằng quyền `admin` nghĩa là quản trị viên
Marketing chạm tới.

Rules gốc đang là `.read: false` / `.write: false`, và mọi nhánh không
khai tường minh đều thừa hưởng hai chữ đó. Nhưng **tài khoản dịch vụ của
Worker đi vòng qua rules** — không phải suy đoán: `min_ngay` khai
`".write": false` mà cron vẫn ghi vào nó mỗi 20 phút qua `ghiDb`, đã chạy
production. Nên "đóng với mọi người, mở với Worker" là một trạng thái có
thật, không phải một mong muốn.

Vẫn nên khai tường minh `".read": false, ".write": false` dù không khai
cũng đã đóng — để người đọc rules sau này biết đó là chủ ý chứ không phải
quên.

**Rủi ro còn lại, nói thẳng:** khoá service account (`FB_SA_EMAIL`/
`FB_SA_KEY`) là hạ tầng dùng chung. Ai deploy được Worker trong tài khoản
Cloudflare đó, hoặc ai có khoá đó, đọc được tất cả. Không tránh được nếu
dùng chung một Firebase — chỉ có cách giữ khoá cho chặt.

## 8. Đè toàn kỳ mà không mất chỉnh sửa tay

V1 đã giải đúng chỗ này. Chép nguyên, đừng nghĩ lại.

**Tách hai tầng.** Sổ gốc từ MISA là một tầng — đè toàn kỳ thoải mái.
Quyết định của người là tầng riêng, không bao giờ bị đè, và được hợp nhất
lúc **đọc** chứ không trộn lúc ghi. "Engine tính ra gì" và "người quyết
định gì" không bao giờ bị trộn thành một con số không nhãn.

**Điều kiện sống còn: khoá phải bền qua lần nhập lại.** Không được dùng
"dòng thứ N của file" — nhập lại là lệch hết. V1 dùng bộ ba (số chứng từ,
tên hàng đã chuẩn hoá, lần xuất hiện thứ mấy trong chứng từ đó). Dùng lại
nguyên.

| Loại quyết định | Ví dụ | Khoá theo | Sống bao lâu |
|---|---|---|---|
| Về **một dòng** | Sửa giá nhập của đơn BH123 | Bộ ba khoá nghiệp vụ | Qua mọi lần nhập lại kỳ đó |
| Về **một mặt hàng** hoặc một quy tắc | "Phí vận chuyển" là phụ phí; tên hàng này = mã bảng giá kia | Tên hàng đã chuẩn hoá | **Mọi kỳ**, kể cả kỳ chưa nhập |

### Ba nhánh, ba mức mở

Quyết định Q1 (lưu đủ thông tin khách) và Q4 (đè toàn kỳ) gặp nhau ở đây:
chỉ nhánh số liệu bị đè, hai nhánh còn lại thì không, và nhánh khách không
mở cho bất kỳ vai nào.

| Nhánh | Chứa gì | Rules | Khi nhập đè |
|---|---|---|---|
| `bc/ky/<kỳ>` | Số liệu báo cáo đã tính sẵn | `.read` cho `quantri` / `quanly` | **Bị đè** |
| `bc/quyetdinh/…` | Chỉnh sửa tay của người | `.read` cho `quantri` / `quanly`, ghi qua Gateway | Không bị đè |
| `bc/khach/<mã đơn>`<br>`bc/imei/<imei>` | Tên, SĐT, địa chỉ · bảng tra IMEI | `.read: false` · `.write: false` — chỉ Worker | Bị ghi đè theo đơn |

Về nhánh `bc/imei`: Realtime Database không có chỉ mục phụ, nên muốn tra
bảo hành theo IMEI thì phải ghi sẵn bảng tra ngay lúc nhập sổ. Làm từ P2
thì gần như miễn phí; làm sau thì phải nhập lại toàn bộ.

Phụ phí thuộc loại hai: gán một lần cho "Phí vận chuyển", từ đó mọi kỳ sau
tự có, không phải làm lại. Sửa giá nhập một đơn cụ thể thuộc loại một.
Loại hai nên chiếm đa số việc làm tay — mỗi lần gán là gán một lần cho mãi
mãi, và nó cũng chính là cơ chế của Q5.

**Một chi tiết của V1 rất đáng chép:** V1 tính dấu vân tay cho mỗi dòng
chỉ trên các trường nghiệp vụ — ngày bán, tên hàng, số lượng, giá bán,
chiết khấu, IMEI, nhân viên — và cố tình loại trừ tên khách, số điện
thoại, địa chỉ, cùng vị trí dòng trong file. Nghĩa là kế toán sửa tên
khách hay chèn thêm một dòng phía trên thì hệ thống không coi là "dòng
bán này đã bị sửa". Rất hợp với quyết định Q1.

**Việc còn lại sau mỗi lần đè:** màn hình phải nói rõ "có N quyết định cũ
không còn dòng nào để áp" — dòng đã bị sửa hoặc xoá bên MISA — và đưa ra
danh sách để xem. Im lặng bỏ qua là cách một con số sai sống sót qua nhiều
kỳ.

## 9. Ba điều đáng mang sang, ba điều nên bỏ lại

**Mang sang:**

| Mang sang | Vì sao |
|---|---|
| Ranh giới Tracking giữ service account, chiếu dữ liệu rồi mới trả | Đã chạy thật, đã có bộ kiểm, và là lý do việc cắt V1 gần như không tốn gì |
| Kỷ luật fail-closed: hỏng thì trả lỗi, không bao giờ trả rỗng | Một sự cố mạng không được phép nói "không có đơn nào" thay người |
| Chú thích giải thích *vì sao* ngay trong mã | Đây là thứ V1 làm tốt nhất |

**Bỏ lại:**

| Bỏ lại | Vì sao |
|---|---|
| Bộ governance 68 file với ready gate / completion gate / independent review | Áp mức TEAM cho dự án một người. V2 chỉ giữ một file `CLAUDE.md` |
| Kiến trúc kéo dữ liệu mỗi lần chạy | Đã đo được 44–277 giây một lần chạy. Tính sẵn lúc ghi |
| Xây engine trước, dựng giao diện sau | Chính là lý do tài liệu này tồn tại |

---

*Kiểm toán đọc-only trên `hoangvinhkta-creator/Reports` @ `5521192` và
`hoangvinhkta-creator/Tracking` @ `392c623`, ngày 11/09/2026. Mọi con số
trong tài liệu này lấy trực tiếp từ mã nguồn và cấu hình, không lấy từ tài
liệu mô tả. Không có dòng mã nào ở hai repo đó bị sửa.*
