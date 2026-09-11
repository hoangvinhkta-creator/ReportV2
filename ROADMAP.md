# ROADMAP — Báo cáo Kinh doanh V2

File này là **trạng thái sống**: mỗi session mới đọc file này TRƯỚC TIÊN để
biết đang ở phase nào, và cập nhật lại đúng phần "Trạng thái hiện tại" khi
kết thúc phiên làm việc. Lý do đầy đủ đằng sau từng quyết định nằm ở
`docs/audit/2026-09-11-audit-reports-tracking.md` — không chép lại ở đây,
chỉ trỏ tới.

Nguyên tắc làm việc: **mỗi phase là một lát cắt dọc**, kết thúc bằng một
thứ deploy được và mở bằng máy thật. Không mở phase kế tiếp khi phase hiện
tại chưa có bằng chứng chạy thật — không phải "code xong", mà là "chủ dự
án đã tự tay mở và xác nhận".

---

## Trạng thái hiện tại

**Đang ở: P1 — Nền móng rỗng, chạy thật.** Mã đã dựng và đẩy lên nhánh
`claude/reportv2-p1-foundation-djkhlo` (commit `cd0f987`, 2026-09-11) —
NHƯNG **chưa ra khỏi phase**: tiêu chí ra khỏi phase là "chủ dự án tự đăng
nhập được trên máy thật", và điều đó chưa xảy ra vì bốn bước hạ tầng dưới
đây còn cần người có quyền truy cập Cloudflare/Firebase làm tay.

Việc đã xong ở P1:
- Gateway Worker (`reportv2-gateway`): xác minh Firebase ID token, tra vai
  `quantri`/`quanly` trong `profiles/<uid>`, một endpoint `/api/me` chứng
  minh cả đường dây trình duyệt → Gateway → Engine.
- Report Engine (`reportv2-engine`): Worker riêng tư, không route công
  khai, không `workers.dev` — sao lại đúng mẫu `price-engine` đã chạy thật
  bên Tracking.
- Trang tĩnh `public/index.html`: đăng nhập email/mật khẩu, hiện tên người
  dùng, sáu thẻ xám "chưa có gì". Không nạp SDK Realtime Database — trình
  duyệt không có đường nào chạm thẳng RTDB.
- `firebase-rules/bc.rules.json`: fragment rules mới cho bốn nhánh `bc/`,
  kèm `firebase-rules/README.md` giải thích cách hợp nhất vào rules chung.
- `kiem/`: khung bộ kiểm chép từ Tracking + năm bộ kiểm P1 (xác thực token,
  Engine riêng tư, định tuyến/security header, hình dạng rules `bc/`, quét
  tĩnh LUẬT SỐ 1). `npm test`: 5 bộ, 116 đạt, 0 hỏng. `wrangler deploy
  --dry-run` xanh cho cả hai Worker.
- CI: `.github/workflows/kiem.yml` chạy `npm test` mỗi lần push.

**Bốn việc còn lại, CẦN CHỦ DỰ ÁN LÀM (phiên này không có quyền/khoá để tự
làm)** — xem chi tiết ở cuối `wrangler.toml` từng Worker và ở
`firebase-rules/README.md`:

1. **Nối hai Worker vào Cloudflare dashboard**, cùng account đang chạy
   Worker `tracking` (đã hỏi và được xác nhận dùng chung account). Tên
   Worker đã xác nhận: `reportv2-gateway` và `reportv2-engine`. Chưa có
   Secret nên có nối cũng chưa đăng nhập được — xem bước 2.
2. **Đặt hai Secret cho `reportv2-gateway`**: `FB_SA_EMAIL`, `FB_SA_KEY`
   (`wrangler secret put ...`) — tài khoản dịch vụ Firebase đọc
   `profiles/<uid>`. Thiếu thì `/api/me` trả 503 (đúng ý, không phải lỗi).
3. **Hợp nhất `firebase-rules/bc.rules.json` vào file rules chung** (hiện
   sống ở repo Tracking, dùng chung với Marketing) — xem
   `firebase-rules/README.md` cho từng bước và vì sao KHÔNG tự sửa thẳng
   từ đây.
4. **Dựng Cloudflare Access** cho `reportv2-gateway` trước khi có người
   dùng thật ngoài chủ dự án (CLAUDE.md/ROADMAP mục P1).

Sau khi xong bốn bước trên, việc còn lại chỉ là mở `*.workers.dev` bằng
điện thoại, đăng nhập bằng tài khoản đã có `perms.quantri` hoặc
`perms.quanly`, chụp lại màn hình sáu thẻ xám — đó mới là bằng chứng đủ để
đánh dấu P1 ✅ trong bảng dưới.

---

## Chín phase

| # | Tên | Ước lượng | Trạng thái |
|---|---|---|---|
| P0 | Chốt sáu quyết định | 1 buổi · không code | ✅ Xong — 11/09 |
| P1 | Nền móng rỗng, chạy thật | 1 tuần | ⬜ Chưa bắt đầu |
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

### P1 — Nền móng rỗng, chạy thật

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

**Ra khỏi phase khi:** chủ dự án tự đăng nhập được trên máy thật.

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

**Ra khỏi phase khi:** chủ dự án dùng bảng này thay Excel cho một kỳ.

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

1. Đọc `CLAUDE.md` (luật gốc).
2. Đọc file này, mục "Trạng thái hiện tại" — biết đang ở phase nào.
3. Làm đúng phase đó, không nhảy cóc.
4. Trước khi kết thúc phiên: cập nhật "Trạng thái hiện tại" + đổi ⬜ → ✅
   trong bảng nếu phase đã xong (có bằng chứng chủ dự án tự mở và xác
   nhận).
