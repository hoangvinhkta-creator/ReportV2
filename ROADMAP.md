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

**P1 XONG (11/09/2026). Việc tiếp theo: P2 — Một con số thật, đi hết
đường.**

Đường dây đã chạy thật đầu-đến-cuối: mở `*.workers.dev` → qua Cloudflare
Access → đăng nhập Firebase → Gateway xác minh token, tra vai, gọi Engine
qua Service Binding → màn chủ hiện tên người dùng và sáu thẻ xám.

### Hạ tầng đang sống — P2 nhận nguyên, không dựng lại

| Thứ | Giá trị | Ghi chú |
|---|---|---|
| Gateway | `reportv2-gateway` → `https://reportv2-gateway.hoangvinhkta.workers.dev` | phục vụ `public/`, endpoint `/api/me` |
| Engine | `reportv2-engine` | riêng tư, `workers_dev = false`, gọi qua binding `REPORT_ENGINE` |
| Secret trên Gateway | `FB_SA_EMAIL`, `FB_SA_KEY` | service account `firebase-adminsdk-fbsvc@tinphattracking...` |
| Cloudflare Access | app self-hosted, destination = **Workers** scope `reportv2-gateway` | đăng nhập bằng **One-time PIN**, allowlist theo TỪNG email (công ty không có domain email riêng) |
| Rules `bc/` | đã publish live | `bc/ky`, `bc/quyetdinh` `.read` theo `vai`; `bc/khach`, `bc/imei` đóng hẳn |
| CI | `.github/workflows/kiem.yml` | `npm test` mỗi lần push |

`npm test`: 6 bộ, 122 đạt, 0 hỏng.

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

4. **Merge KHÔNG phải deploy.** Hai Worker deploy bằng `wrangler deploy`
   chạy tay từ máy chủ dự án, KHÔNG nối git integration. Sau mỗi lần merge
   phải `git pull origin main && wrangler deploy` (và `cd engine &&
   wrangler deploy` nếu đụng Engine). Deploy Engine TRƯỚC Gateway nếu cả
   hai cùng đổi — Gateway khai `[[services]]` trỏ vào Engine.

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

## Chín phase

| # | Tên | Ước lượng | Trạng thái |
|---|---|---|---|
| P0 | Chốt sáu quyết định | 1 buổi · không code | ✅ Xong — 11/09 |
| P1 | Nền móng rỗng, chạy thật | 1 tuần | ✅ Xong — 11/09 |
| P2 | Một con số thật, đi hết đường | 1–2 tuần | ⬜ Chưa bắt đầu |
| P3 | Giá vốn và lợi nhuận | 2 tuần | ⬜ Chưa bắt đầu |
| P4 | Nhân viên | 1–2 tuần | ⬜ Chưa bắt đầu |
| P5 | Biểu đồ và so sánh kỳ | 1 tuần | ⬜ Chưa bắt đầu |
| P6 | Sản phẩm, thương hiệu, cơ cấu | 1–2 tuần | ⬜ Chưa bắt đầu |
| P7 | Di trú số 2025 → nay | 1 tuần | ⬜ Chưa bắt đầu |
| P8 | Khai tử V1 | 1 buổi | ⬜ Chưa bắt đầu |

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

### P2 — Một con số thật, đi hết đường

Tải lên sổ bán của **một kỳ**. Trình duyệt đọc file .xlsx và gửi lên;
Gateway tách làm hai chỗ ghi:

- số liệu → `bc/ky/<kỳ>`
- thông tin khách + bảng tra IMEI → nhánh đóng (`bc/khach`, `bc/imei`)

Trả về đúng **một** con số: doanh thu của kỳ đó.

Phase này bé đến mức trông như lãng phí, và nó là phase quan trọng nhất:
nó chốt hình dạng dữ liệu, cách tính sẵn lúc ghi, và cách đưa sổ vào — ba
thứ mà V1 chốt sai và phải sống với suốt ba tuần.

**Bạn nhìn thấy gì:** nhập sổ tháng 9, màn hình hiện doanh thu tháng 9,
đối chiếu được với Excel trong một phút.

**Ra khỏi phase khi:** một kỳ thật đối chiếu khớp với Excel gốc.

---

### P3 — Giá vốn và lợi nhuận

Nối vào hệ Min theo ngày bán đang có sẵn bên Tracking (`POST
/api/min-ngay`) — không viết lại. Mỗi dòng hàng có giá vốn theo đúng
ngày bán, hoặc nói rõ vì sao chưa có.

Đây là nơi bài toán khớp tên hàng (Q5 — gán thủ công kiểu Tracking) thật
sự chạm vào lần đầu.

**Bạn nhìn thấy gì:** doanh thu, giá vốn, lợi nhuận của kỳ — và một danh
sách rõ ràng "N dòng chưa có giá vốn, vì lý do gì".

**Ra khỏi phase khi:** lợi nhuận một kỳ thật đối chiếu khớp tay.

---

### P4 — Nhân viên

Gán dòng hàng cho nhân viên, tổng theo người, target tháng. Mọi lần sửa
ghi kèm người sửa và thời điểm vào `bc/quyetdinh` — đây là màn hình audit
trail thật đầu tiên của V2 (F-05 của V1 không có).

**Bạn nhìn thấy gì:** bảng nhân viên với doanh số, lợi nhuận, target, và
lịch sử ai sửa gì lúc nào.

**Ra khỏi phase khi:** bảng chạy thật, đủ số liệu để thay Excel cho một
kỳ — đã merge, chờ chủ dự án dùng thử.

---

### P5 — Biểu đồ và so sánh kỳ

Chỉ sau khi con số đã đúng và đã được nghiệm thu. Biểu đồ vẽ từ
`bc/ky` đã tính sẵn ở P2, không tính lại lúc mở trang.

**Bạn nhìn thấy gì:** một biểu đồ doanh thu theo ngày, bấm vào một cột
thì thấy cột đó gồm những gì.

**Ra khỏi phase khi:** so sánh tháng này với tháng trước ra đúng số.

---

### P6 — Sản phẩm, thương hiệu, cơ cấu

Các lát báo cáo còn lại. Nhãn thương hiệu và nhóm hàng đọc từ Tracking
(`GET /api/xuat/`, danh sách đóng 40 hãng) — không dựng bộ phân loại thứ
hai.

**Bạn nhìn thấy gì:** mặt hàng nào tạo doanh thu, hãng nào tạo lợi nhuận.

**Ra khỏi phase khi:** mọi báo cáo cần dùng hàng ngày đã có mặt.

---

### P7 — Di trú số 2025 → nay

Trích từ PostgreSQL của V1 và từ `data/chart_gapfill/*.jsonl` (repo
Reports cũ), nạp vào `bc/ky`, đối chiếu từng tháng với Excel gốc. Chỉ làm
sau khi P2–P6 đã chứng minh hình dạng dữ liệu đúng — nạp trước là nạp lại
lần hai.

**Bạn nhìn thấy gì:** biểu đồ chạy liền mạch từ tháng 1/2025 tới hôm nay,
bảng đối chiếu tháng-với-tháng lệch 0.

**Ra khỏi phase khi:** đối chiếu 2025–2026 lệch 0 trên toàn bộ các tháng.

---

### P8 — Khai tử V1

Bốn việc (xem `docs/audit/...` mục 5):

1. Trích số 2025–2026 ra khỏi PostgreSQL + JSONL trước khi tắt bất cứ gì.
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
