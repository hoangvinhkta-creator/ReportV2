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

**P1 XONG (11/09/2026). P2 ĐANG LÀM — mã xong, đã merge, đối chiếu nội bộ
khớp 0 lệch trên phần dữ liệu đang có. Còn CHỜ BA THỨ mới ra khỏi phase
được (xem "P2 — còn thiếu gì" ngay dưới).**

Đường dây đã chạy thật đầu-đến-cuối: mở `*.workers.dev` → qua Cloudflare
Access → đăng nhập Firebase → Gateway xác minh token, tra vai, gọi Engine
qua Service Binding → màn chủ hiện tên người dùng và sáu thẻ xám.

### P2 — đã làm được gì (11/09/2026)

Đường trích ĐÃ CHẠY THẬT trên sổ 2026 và đã đối chiếu chéo với một nguồn
độc lập. Ba file mới:

| File | Việc |
|---|---|
| `engine/src/gop-ban-hang.mjs` | **hàm dùng chung** — mọi luật nghiệp vụ. P4 gọi lại ĐÚNG hàm này |
| `bin/doc-xlsx.mjs` | đọc .xlsx bằng Node thuần, 0 dependency (chỉ P2 cần — P4 đọc file ở trình duyệt) |
| `bin/nap-so-legacy.mjs` | script chạy tay: đọc sổ → gọi hàm chung → PUT `bc/ky/<kỳ>` |

**Bước 0 đã xác minh, không đoán:** sổ ĐÚNG là dạng chi tiết từng dòng.
Tiêu đề hàng 4, tiêu đề phụ hàng 5, dữ liệu từ hàng 6, **cột `employee` ở
vị trí 12** — khớp từng vị trí với `app/modules/importing/raw_reader.py`
của Reports V1. Nên KHÔNG phải đi đường `PROVENANCE.md` (workbook kế toán
dạng sheet-mỗi-nhân viên). `kiemBoCuc()` nay canh đúng sáu ô tiêu đề đó
mỗi lần trích — sai bố cục thì NÉM LỖI, không trả bảng rỗng.

**Đối chiếu sổ 2026 (01–08/2026) — ba phép, cả ba khớp 0 lệch:**

| kỳ | doanh số (đ) | số đơn | nhân viên | ngày có số |
|---|---|---|---|---|
| 2026-01 | 25.485.686.000 | 1.864 | 11 | 31 |
| 2026-02 | 23.798.651.000 | 1.881 | 11 | 19 |
| 2026-03 | 15.585.862.240 | 1.351 | 10 | 31 |
| 2026-04 | 13.479.338.000 | 1.210 | 9 | 28 |
| 2026-05 | 14.668.728.000 | 1.182 | 9 | 30 |
| 2026-06 | 14.474.146.000 | 1.226 | 11 | 30 |
| 2026-07 | 14.527.576.000 | 1.205 | 10 | 31 |
| 2026-08 | 15.824.320.000 | 1.150 | 8 | 28 |
| **TỔNG** | **137.844.307.240** | **11.069** | | |

1. **Đối chiếu NỘI BỘ — đúng điều kiện ra khỏi phase.** Mỗi tháng được
   cộng bằng HAI đường độc lập: cộng `doanh_so` của mọi ô (nhân viên,
   ngày), và cộng thẳng tiền từng dòng của tháng đó. **8/8 tháng lệch 0 đ
   và lệch 0 đơn** — không rơi dòng, không đếm trùng chứng từ. Phép này
   nằm trong `gopSoBanHang()` và **chặn lượt `--ghi`**: lệch thì script
   thoát, không ghi gì. Có bài kiểm chứng minh nó thật sự bắt được lỗi
   (dựng một sổ đếm trùng rồi xem nó đỏ), không chỉ luôn nói "khớp".
2. **Doanh số** — tổng 137.844.307.240 đ bằng ĐÚNG dòng `Tổng cộng` mà
   chính sổ in ra ở hàng cuối. Dòng đó bị bỏ khỏi phép cộng (nó không có
   số chứng từ), nên đây là một phép đối chiếu thật, không phải vòng tròn.
3. **Số đơn** — 11.069 đơn, và **cả 228 ngày khớp từng ngày** với
   `data/chart_gapfill/daily_orders.jsonl` của Reports V1, một nguồn dựng
   độc lập từ cùng hai file sổ. Đây là bằng chứng mạnh nhất hiện có rằng
   luật đếm đơn ở đây trùng luật V1 đang dùng.

**Một quyết định nghiệp vụ CHƯA CHỐT — `LUAT_DOANH_SO`.** Sổ cho hai cách
đọc "doanh số của một dòng", lệch nhau **47.101.000 đ** trên 8 tháng:

- `cot-doanh-so-ban` (**đang bật**) — cột `Doanh số bán` nguyên văn →
  137.844.307.240 đ. Tự nhất quán với dòng `Tổng cộng` của chính sổ.
- `tru-chiet-khau` — `Số lượng × Đơn giá − Chiết khấu` → 137.797.206.240 đ.
  Đây là luật V1 (`DEC-114`, ghi rõ "Owner xác nhận trực tiếp 2026-08-23").

Đã kiểm: `Doanh số bán` == `Số lượng × Đơn giá` ở CẢ 15.035 dòng, nên hai
luật chỉ khác đúng phần chiết khấu. Đổi luật = sửa MỘT hằng số trong
`gop-ban-hang.mjs` rồi chạy lại script — không có chỗ thứ hai phải sửa
theo, và cả hai luật đều có bài kiểm canh. Chủ dự án không có số tổng tách
riêng để so (nên điều kiện ra phase đã đổi sang đối chiếu nội bộ), nên đây
là việc họ tự xem lại trên sản phẩm thật rồi nói nếu thấy sai.

**21 dòng không có tên nhân viên** (57.200.000 đ, tập trung ở 07–08/2026):
KHÔNG bị bỏ, KHÔNG gán bừa cho ai — dồn vào khoá `_chua_xac_dinh` (tên
khoá chủ dự án chốt) để tổng tháng vẫn khớp sổ, và script in ra danh sách
số chứng từ. Đây đúng là việc P5 sẽ sửa tay.

**14 tên nhân viên trên sổ 2026, script CHỈ LIỆT KÊ — không tự ghép.**
Đúng theo yêu cầu "dùng danh sách CÓ SẴN trong file kế toán, đừng tự đoán
ghép vào ai": script in danh sách tên kèm số dòng và doanh số, sắp theo
doanh số giảm dần. Hai chỗ đáng chú ý khi chủ dự án soi lại:

- **`Tống Khánh Linh 0865111033` và `Lê Văn Quân 0865111033` dùng CÙNG
  một số hotline.** Đúng hiện tượng bàn giao hotline mà chủ dự án mô tả.
  P2 gộp theo TÊN như sổ ghi, không theo hotline — chờ bảng ánh xạ.
- `Thảo Linh` (796.430.000 đ) và `Tống Khánh Linh 0865111033`
  (129.850.000 đ) có thể là một người viết hai cách, hoặc hai người khác
  nhau. **Không đoán** — cần chủ dự án nói.

Bốn tên `Mr Quý`, `Mr Vinh`, `Đức Hiệp`, `Tín Phát 0869931931` không có
họ tên đầy đủ, nên không tự khớp được vào danh sách kế toán.

### P2 — còn thiếu gì để ra khỏi phase

**Đối chiếu nội bộ — điều kiện ra khỏi phase — đã khớp 0 lệch cho phần dữ
liệu đang có (01–08/2026).** Ba việc còn lại:

1. **Sổ 2025 chưa có.** Hai file đính kèm ở phiên 11/09 là **cùng một
   file** (trùng MD5 `dfa41b86…`, cùng 2.056.416 byte), và cả hai là sổ
   **2026** (`Từ ngày 01/01/2026`, 01–08/2026). Đường trích không phụ
   thuộc năm nào, nên gửi lại đúng file 2025 là chạy được ngay. Đã biết
   trước con số phải ra: `daily_orders.jsonl` của V1 nói 2025 có **18.814
   đơn** (01/2025: 1.928 … 12/2025: 1.668) — nạp xong so lại là biết ngay
   đúng/sai.
2. **Chưa ghi vào Firebase.** Phiên làm việc không có
   `FB_SA_EMAIL`/`FB_SA_KEY` (đó là Secret của Worker, không nằm trong
   repo — đúng như phải vậy). Script đã chạy xong phần trích và in bảng
   đối chiếu ở chế độ **chạy thử** (mặc định, không cần khoá). Lượt ghi
   thật cần chủ dự án chạy trên máy có khoá:

   ```
   export FB_SA_EMAIL='firebase-adminsdk-fbsvc@tinphattracking.iam.gserviceaccount.com'
   export FB_SA_KEY="$(cat khoa.pem)"
   node bin/nap-so-legacy.mjs --ghi --doc-lai "so-2025.xlsx" "so-2026.xlsx"
   ```

   `--doc-lai` đọc ngược từng kỳ vừa ghi và so lại tổng — "đã ghi" không
   phải là một dòng chữ script tự in ra.
3. **Danh sách nhân viên chuẩn chưa có.** Chủ dự án chốt: chuẩn hoá tên
   dựa vào danh sách CÓ SẴN trong **file kế toán** (`Báo cáo Kinh doanh
   2025/2026.xlsx`) — file đó KHÔNG được gửi trong phiên này, và không có
   trong repo nào (`.gitignore: *.xlsx` bên Reports V1). Nên script làm
   đúng nửa việc thuộc về nó: **liệt kê 14 tên như sổ ghi, kèm số dòng và
   doanh số, và không tự ghép tên nào với tên nào** (có bài kiểm canh việc
   không tự so gần đúng). Cần chủ dự án nói tên nào là biến thể của tên
   nào, hoặc gửi file kế toán để đọc danh sách.

### Hạ tầng đang sống — P2 nhận nguyên, không dựng lại

| Thứ | Giá trị | Ghi chú |
|---|---|---|
| Gateway | `reportv2-gateway` → `https://reportv2-gateway.hoangvinhkta.workers.dev` | phục vụ `public/`, endpoint `/api/me` |
| Engine | `reportv2-engine` | riêng tư, `workers_dev = false`, gọi qua binding `REPORT_ENGINE` |
| Secret trên Gateway | `FB_SA_EMAIL`, `FB_SA_KEY` | service account `firebase-adminsdk-fbsvc@tinphattracking...` |
| Cloudflare Access | app self-hosted, destination = **Workers** scope `reportv2-gateway` | đăng nhập bằng **One-time PIN**, allowlist theo TỪNG email (công ty không có domain email riêng) |
| Rules `bc/` | đã publish live | `bc/ky`, `bc/quyetdinh` `.read` theo `vai`; `bc/khach`, `bc/imei` đóng hẳn |
| CI | `.github/workflows/kiem.yml` | `npm test` mỗi lần push |

`npm test`: 9 bộ, 291 đạt, 0 hỏng.

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
