# Nhánh rules `bc/` — hợp nhất vào rules chung, KHÔNG tự deploy từ đây

`bc.rules.json` trong thư mục này là nhánh rules MỚI cho Báo cáo Kinh doanh
V2, đúng bốn nhánh và đúng mức mở CLAUDE.md đã chốt:

| Nhánh | `.read` | `.write` |
|---|---|---|
| `bc/ky/<kỳ>` | `quantri` hoặc `quanly` | `false` (chỉ Worker, qua service account) |
| `bc/quyetdinh/…` | `quantri` hoặc `quanly` | `false` (ghi qua Gateway, service account đi vòng qua rules) |
| `bc/khach/<mã đơn>` | `false` | `false` |
| `bc/imei/<imei>` | `false` | `false` |

## Vì sao KHÔNG nằm sẵn trong file rules đang chạy

Firebase RTDB của Tín Phát dùng CHUNG cho Tracking, Marketing, và nay cả
Reports — CHỈ MỘT file rules cho cả project (xem
`docs/audit/2026-09-11-audit-reports-tracking.md` mục "Vì sao nhánh khách
không cấp quyền cho ai cả"). File đó hiện sống ở repo Tracking:
`firebase-database.rules.json`, và Tracking có bộ kiểm riêng canh nó
(`kiem/khoa-rules-doc.js`, `kiem/khoa-rules-ghi.js`).

Sửa thẳng file rules của một app đang chạy thật (Tracking) từ phiên làm
việc của repo NÀY là một thay đổi ảnh hưởng tới hệ thống dùng chung — không
làm mà không hỏi trước. Việc của repo này dừng lại ở CHUẨN BỊ ĐÚNG nội dung
cần thêm.

## Việc còn lại, người có quyền merge phải làm tay

1. Mở `firebase-database.rules.json` bên repo Tracking (hoặc Firebase
   Console → Realtime Database → Rules).
2. Thêm đúng khối `"bc": { ... }` trong `bc.rules.json` vào cấp cao nhất
   (`rules.bc`), cạnh các nhánh `state`, `board`, `profiles`... đang có —
   KHÔNG sửa gì trong các nhánh khác.
3. Kiểm bằng RTDB Rules Simulator (hoặc `firebase deploy --only database
   --dry-run` nếu có Firebase CLI) trước khi deploy thật.
4. Deploy. Rules chỉ đọc `profiles/<uid>/vai` — đúng trường Tracking đã
   dùng làm nguồn sự thật (`admSetVai()` trong `public/index.html` của repo
   Tracking ghi `vai` cùng lúc với chiếu ra `perms`). Giá trị phải đúng
   chuỗi `"quantri"` hoặc `"quanly"` thì `/api/me` mới trả vai đúng.

   **KHÔNG đọc `perms.quantri`/`perms.quanly`** — hai khoá đó không tồn tại
   trong mô hình quyền của Tracking (`perms` chỉ có bảy cờ: `admin`, `board`,
   `bedit`, `edit`, `compare`, `summary`, `mkt`, xem `VAI_KN`/`admSetVai()`
   trong `public/index.html` bên repo Tracking). Bản đầu của file này từng
   đọc sai hai khoá đó — đã sửa (xem lịch sử commit).

Không nhánh nào trong bốn nhánh trên có `.write` mở cho trình duyệt — Gateway
ghi bằng service account, đi vòng qua rules đúng như `min_ngay` bên Tracking
đã chạy production từ lâu.
