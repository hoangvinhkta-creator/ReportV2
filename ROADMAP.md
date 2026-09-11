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

**P1 XONG (11/09/2026). Việc tiếp theo: P2 — Mốc legacy: doanh số + số
đơn theo nhân viên/ngày, 2025 → hết 08/2026.**

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

`npm test`: 7 bộ, 127 đạt, 0 hỏng.

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
   "npm test"` trong `wrangler.toml`: bộ kiểm đỏ thì build dừng, deploy
   không chạy, bản đang chạy được giữ nguyên. `kiem/cua-chan-build.js`
   canh cửa ấy còn đó — đừng gỡ, và đừng chuyển nó lên ô "Build command"
   của dashboard (ô đó chỉ áp cho nhánh production, nhánh phụ không kế
   thừa — Tracking đã mất gần một giờ vì đúng chuyện này).

   Muốn deploy tay (ví dụ lúc gỡ lỗi) thì vẫn được: `git pull origin main
   && wrangler deploy`, và `cd engine && wrangler deploy` nếu đụng Engine.

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

## Chín phase

**Sắp xếp lại 11/09/2026, lần hai cùng ngày.** Lần một: chuyển trọng tâm
sang doanh số + số đơn theo (nhân viên, ngày) — KHÔNG cần chi tiết dòng
hàng hay khách hàng (xem lý do vẫn đúng ở dưới). Lần hai: chủ dự án xác
nhận sẽ cung cấp **"Sổ chi tiết bán hàng"** năm 2025 và 2026 (tới hết
08/2026) — ĐÚNG hai file Reports V1 đã từng dùng để đếm số đơn
(`tools/chart_gapfill/extract_daily_orders.py`, đọc qua `raw_reader.
read_raw_rows` — cùng hàm có cột `employee`). Hai file này cho CẢ doanh số
lẫn số đơn, theo nhân viên, cho toàn bộ 01/2025–08/2026 — tốt hơn giả định
ban đầu (không phải chỉ workbook kế toán revenue-only).

Việc "nạp mốc legacy trước, không phải tải-lên-rồi-mới-tính" (yêu cầu
tường minh của chủ dự án) không cần dựng UI tải file — đó là một lát cắt
NHỎ HƠN và làm TRƯỚC được, nên được đôn lên P2. Phase "một kỳ thật, đi hết
đường" (upload UI cho kỳ hiện tại/tương lai) lùi xuống P4, nối tiếp trên
đúng hình dạng dữ liệu mà P2 đã chốt. "Giá vốn/lợi nhuận" và "sản phẩm/
thương hiệu" giữ nguyên lý do đã nêu ở lần sắp xếp thứ nhất.

| # | Tên | Ước lượng | Trạng thái |
|---|---|---|---|
| P0 | Chốt sáu quyết định | 1 buổi · không code | ✅ Xong — 11/09 |
| P1 | Nền móng rỗng, chạy thật | 1 tuần | ✅ Xong — 11/09 |
| P2 | Mốc legacy: doanh số + số đơn theo nhân viên/ngày, 2025→08/2026 | 1 tuần | ⬜ Chưa bắt đầu |
| P3 | Biểu đồ và so sánh kỳ | 1 tuần | ⬜ Chưa bắt đầu |
| P4 | Một kỳ SỐNG thật, đi hết đường (upload UI, kỳ hiện tại/tương lai) | 1–2 tuần | ⬜ Chưa bắt đầu |
| P5 | Chỉnh sửa tay + audit trail | 1 tuần | ⬜ Chưa bắt đầu |
| P6 | Giá vốn và lợi nhuận (chỉ từ ~07/09/2026) | 2 tuần | ⬜ Chưa bắt đầu |
| P7 | Sản phẩm, thương hiệu, cơ cấu — TUỲ CHỌN, không cam kết | — | ⬜ Chưa xác nhận cần |
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

### P2 — Mốc legacy: doanh số + số đơn theo nhân viên/ngày, 2025 → 08/2026

Trích trực tiếp từ **"Sổ chi tiết bán hàng"** 2025 và 2026 (tới hết
08/2026) mà chủ dự án cung cấp — KHÔNG qua UI tải file, nạp thẳng vào
Firebase trước khi P4 (upload sống) tồn tại. Đây là mốc để đối chiếu và
vẽ biểu đồ ngay, đúng yêu cầu "có dữ liệu trước, không phải tải lên mới
tính".

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

KHÔNG khớp mã hàng, KHÔNG cần Tracking, KHÔNG cần bảng giá — xem CLAUDE.md
mục "Khớp mã hàng". KHÔNG cần lưu tên/SĐT/địa chỉ khách cho việc này (dù
kiến trúc chung vẫn cho phép sau — Q1); PII đi qua bộ nhớ tiến trình rồi
bỏ, không log, không ghi ra file trung gian trong repo.

Ghi vào `bc/ky/<YYYY-MM>/<nhân viên>/<ngày>`: `{doanh_so, so_don}` — MỘT
THÁNG là một `<kỳ>`, đúng quy ước sẽ dùng cho P4 sau này, để P3 (biểu đồ)
đọc được liền mạch bất kể dữ liệu tới từ đợt nạp này hay từ upload sống
sau này. Viết logic gộp này thành MỘT hàm dùng chung ở Engine — P4 sau
này gọi lại đúng hàm đó cho dữ liệu sống, không viết hai lần.

Đối chiếu công ty theo THÁNG với `MONTH_TOTAL` mà chủ dự án có (Excel/sổ
sách) trước khi coi là xong.

**Bạn nhìn thấy gì:** một script/endpoint chạy một lần, nạp xong đọc lại
được `bc/ky/2025-01/...` tới `bc/ky/2026-08/...`, mỗi nhân viên mỗi ngày
có số.

**Ra khỏi phase khi:** tổng công ty theo từng tháng (01/2025–08/2026)
đối chiếu khớp 0 lệch với số chủ dự án đang có.

---

### P3 — Biểu đồ và so sánh kỳ

Vẽ từ `bc/ky` đã tính sẵn ở P2, không tính lại lúc mở trang. Theo nhân
viên, cuộn lên tuần/tháng/quý/năm. So kỳ này với kỳ trước, cùng kỳ năm
trước. Chạy được ngay trên dữ liệu legacy của P2 — không cần chờ P4.

**Bạn nhìn thấy gì:** biểu đồ doanh số + số đơn theo nhân viên, từ
01/2025 tới hôm nay; bấm vào một cột thấy chi tiết ngày.

**Ra khỏi phase khi:** so sánh tháng này với tháng trước, quý này với quý
trước, ra đúng số cho mọi nhân viên.

---

### P4 — Một kỳ SỐNG thật, đi hết đường

Tải lên sổ bán hàng thô của **một kỳ hiện tại/tương lai** (từ tháng bắt
đầu dùng V2 hàng ngày trở đi). Trình duyệt đọc file và gửi lên; Gateway
trích ĐÚNG hàm đã viết ở P2 — cùng grain, cùng nhánh `bc/ky/<YYYY-MM>/
<nhân viên>/<ngày>`, nối liền vào chuỗi legacy mà không cần đổi gì ở P3.

Đây là phase chứng minh đường dây UPLOAD chạy đầu-cuối (trình duyệt →
Gateway → Engine → Firebase → màn hình) — thứ P2 không cần vì P2 nạp
thẳng, không qua UI.

**Bạn nhìn thấy gì:** nhập sổ tháng hiện tại, biểu đồ P3 nối tiếp liền
mạch từ tháng trước, không đứt gãy ở mốc chuyển từ legacy sang sống.

**Ra khỏi phase khi:** một kỳ tải qua UI đối chiếu khớp Excel, nối đúng
vào chuỗi thời gian đã có từ P2/P3.

---

### P5 — Chỉnh sửa tay + audit trail

Sửa tay khi cột nhân viên trên sổ sai/thiếu (ghi nhầm người, để trống),
áp dụng cho cả dữ liệu legacy (P2) lẫn dữ liệu sống (P4). Mọi lần sửa ghi
kèm người sửa + thời điểm vào `bc/quyetdinh`, hợp nhất lúc đọc — đúng cơ
chế đè-không-mất ở mục 8 của audit. Đây là audit trail thật đầu tiên của
V2 (F-05 của V1 không có ai để ghi).

**Bạn nhìn thấy gì:** sửa một dòng gán sai nhân viên (kể cả trong dữ liệu
legacy), số liệu cập nhật ngay trên biểu đồ P3, và lịch sử ai sửa gì lúc
nào.

**Ra khỏi phase khi:** có ít nhất một sửa tay thật, sống qua một lần nhập
lại kỳ đó (không bị đè mất).

---

### P6 — Giá vốn và lợi nhuận (chỉ áp dụng từ ~07/09/2026)

Chủ dự án xác nhận vẫn cần giá vốn/lợi nhuận, nhưng CHỈ từ khoảng
07/09/2026 trở đi — đây không phải lựa chọn tuỳ ý mà là giới hạn DỮ LIỆU
THẬT: hệ Min theo ngày bán của Tracking (`min_ngay`) chỉ có bản ghi ổn
định từ cron chạy 20 phút/lượt bắt đầu khoảng mốc đó (xem audit F-03/F-08
và ghi chú "bản ngày cron chỉ từ 07/09" trong `PROJECT_PROGRESS.md` của
Reports V1). Kỳ trước mốc đó KHÔNG có giá vốn theo ngày để đối chiếu —
không phải lỗi, không phải việc chưa làm.

Nối vào hệ Min theo ngày bán đang có sẵn bên Tracking (`POST
/api/min-ngay`) — không viết lại. Mỗi dòng hàng có giá vốn theo đúng
ngày bán, hoặc nói rõ vì sao chưa có. Đây là nơi bài toán khớp tên hàng
(Q5 — gán thủ công kiểu Tracking) thật sự chạm vào lần đầu — và CHỈ ở
phase này, không ở P2/P3/P4.

**Bạn nhìn thấy gì:** lợi nhuận của một kỳ ≥ 07/09/2026, cộng danh sách
rõ ràng "N dòng chưa có giá vốn, vì lý do gì". Kỳ trước mốc đó ghi rõ
"ngoài phạm vi dữ liệu Tracking", không hiện số 0 gây hiểu nhầm.

**Ra khỏi phase khi:** lợi nhuận một kỳ thật ≥ 07/09/2026 đối chiếu khớp
tay.

---

### P7 — Sản phẩm, thương hiệu, cơ cấu — TUỲ CHỌN, không cam kết

Chủ dự án xác nhận KHÔNG cần chi tiết từng mặt hàng cho nhu cầu hiện tại.
Phase này ở lại roadmap chỉ để không mất bối cảnh kỹ thuật (nhãn thương
hiệu/nhóm hàng đọc từ Tracking, `GET /api/xuat/`, danh sách đóng 40
hãng) — KHÔNG làm trừ khi chủ dự án yêu cầu rõ. Không tính vào ước lượng
tổng của lộ trình.

**Nếu được yêu cầu, bạn sẽ thấy gì:** mặt hàng nào tạo doanh thu, hãng
nào tạo lợi nhuận.

---

### P8 — Khai tử V1

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
