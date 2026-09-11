/* P2 — nạp MỐC LEGACY: "Sổ chi tiết bán hàng" 2025 + 2026 → bc/ky.
 *
 * Chạy MỘT LẦN, bằng tay, không qua UI (UI tải file là P4 — ROADMAP.md).
 * Chọn script thay vì một endpoint admin tạm trên Gateway, và đây là lý do:
 * một endpoint tạm phải tự lo xác thực, phải nhớ tháo ra sau khi dùng, và
 * mở thêm một bề mặt công khai trên đúng Worker đang phục vụ người thật. Một
 * script thì không tồn tại cho tới lúc có người gọi nó.
 *
 * Nghiệp vụ KHÔNG nằm ở đây. Mọi luật — cột nào là gì, dòng nào bỏ, tiền
 * tính thế nào, một "đơn" là gì — nằm ở `engine/src/gop-ban-hang.mjs`, và P4
 * sẽ gọi ĐÚNG hàm đó cho dữ liệu tải lên sống. File này chỉ làm ba việc:
 * đọc file, gọi hàm chung, đẩy kết quả lên Firebase.
 *
 * ── DỮ LIỆU CÁ NHÂN ──────────────────────────────────────────────────────
 * Sổ có tên, số điện thoại, địa chỉ khách hàng. Bốn cột đó KHÔNG được đọc
 * (`COT_PII`), không được in ra, không được ghi ra file trung gian nào. Ô của
 * sổ chỉ đi qua bộ nhớ tiến trình rồi bị bỏ khi tiến trình thoát. Thứ duy
 * nhất script này ghi ra là `{doanh_so, so_don}` theo (kỳ, nhân viên, ngày).
 *
 * ── CÁCH DÙNG ────────────────────────────────────────────────────────────
 *   # 1) Thử trước, KHÔNG ghi gì, không cần khoá — xem bảng đối chiếu tháng
 *   node bin/nap-so-legacy.mjs "So chi tiet ban hang 2025.xlsx" \
 *                              "So chi tiet ban hang 2026.xlsx"
 *
 *   # 2) Ghi thật (cần service account — CÙNG cặp khoá Gateway đang dùng)
 *   export FB_SA_EMAIL='firebase-adminsdk-...@tinphattracking.iam.gserviceaccount.com'
 *   export FB_SA_KEY="$(cat duong-dan-khoa.pem)"
 *   node bin/nap-so-legacy.mjs --ghi --doc-lai so-2025.xlsx so-2026.xlsx
 *
 * `--ghi` là BẮT BUỘC để chạm Firebase: mặc định chạy thử, vì một lượt PUT
 * vào `bc/ky/<kỳ>` ĐÈ TRỌN cả kỳ đó (đúng thiết kế — CLAUDE.md "Nhập sổ").
 * `--doc-lai` đọc ngược từng kỳ vừa ghi và so lại tổng, để "đã ghi" không
 * chỉ là một dòng chữ script tự in ra.
 *
 * Node in một cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` khi nạp `src/
 * firebase.js` (file ESM trong repo không khai `"type": "module"` vì bộ kiểm
 * dùng `require`). Vô hại, không phải lỗi.
 */
import { readFileSync } from "node:fs";
import { docBangTuXlsx } from "./doc-xlsx.mjs";
import { gopSoBanHang } from "../engine/src/gop-ban-hang.mjs";
import { docDb, ghiDb } from "../src/firebase.js";

const dinhDang = n => (typeof n === "number" ? n.toLocaleString("vi-VN") : String(n));

function docThamSo(argv) {
  const so = [], co = [];
  for (const a of argv) (a.startsWith("--") ? co : so).push(a);
  for (const c of co) {
    if (!["--ghi", "--doc-lai"].includes(c)) {
      console.error("Không hiểu tham số " + c + " — xem chú thích đầu file.");
      process.exit(2);
    }
  }
  return { so, ghi: co.includes("--ghi"), docLai: co.includes("--doc-lai") };
}

/* Gộp cây của nhiều sổ. Một kỳ nằm ở HAI sổ là ca duy nhất script từ chối
 * chạy, có chủ ý: `so_don` đếm số chứng từ KHÁC NHAU, nên cộng hai con số
 * đếm của cùng một kỳ là cộng đôi mọi chứng từ xuất hiện ở cả hai sổ — và
 * không cách nào phát hiện từ hai con số đã đếm rồi. Sổ 2025 và sổ 2026 của
 * chủ dự án không chồng kỳ nào, nên đây là tấm lưới, không phải trở ngại.
 * Cần nạp một kỳ có mặt ở hai sổ thì phải gộp từ DÒNG THÔ, không từ kết quả
 * đã gộp. */
function gopNhieuSo(ketQua) {
  const cay = {}, chu = {};
  for (const { ten, r } of ketQua) {
    for (const kyThang of Object.keys(r.ky)) {
      if (chu[kyThang]) {
        console.error(
          `\nDỪNG: kỳ ${kyThang} có mặt ở CẢ HAI sổ (${chu[kyThang]} và ${ten}).\n` +
          "Cộng số đơn của hai lần gộp là cộng đôi chứng từ trùng. Hãy gửi\n" +
          "một sổ duy nhất chứa trọn kỳ đó, hoặc bỏ một trong hai file.");
        process.exit(3);
      }
      chu[kyThang] = ten;
      cay[kyThang] = r.ky[kyThang];
    }
  }
  return cay;
}

async function main() {
  const { so, ghi, docLai } = docThamSo(process.argv.slice(2));
  if (!so.length) {
    console.error("Thiếu đường dẫn file sổ. Xem chú thích đầu bin/nap-so-legacy.mjs.");
    process.exit(2);
  }

  const ketQua = [];
  for (const duong of so) {
    console.log("\n── " + duong);
    let bang, ten_sheet;
    try {
      ({ bang, ten_sheet } = docBangTuXlsx(readFileSync(duong)));
    } catch (e) {
      console.error("  KHÔNG ĐỌC ĐƯỢC: " + e.message);
      process.exit(4);
    }
    console.log(`  sheet "${ten_sheet}" · ${bang.length} hàng`);

    let r;
    try {
      r = gopSoBanHang(bang);
    } catch (e) {
      /* Bố cục sai = KHÔNG PHẢI sổ chi tiết bán hàng. Dừng, không đoán cách
         đọc khác (ROADMAP.md P2, "Bước 0"). */
      console.error("  KHÔNG TRÍCH ĐƯỢC: " + e.message);
      if (e.lech) for (const l of e.lech) {
        console.error(`    hàng ${l.hang} cột ${l.cot}: mong "${l.mong}", gặp "${l.duoc}"`);
      }
      process.exit(5);
    }

    const t = r.tom_tat;
    console.log(`  ${dinhDang(t.dong_tong)} dòng bán · ${dinhDang(t.dong_bo_thieu_so_ct)} dòng bỏ (không số chứng từ, kể cả dòng "Tổng cộng" của sổ)`);
    console.log(`  doanh số ${dinhDang(t.doanh_so_tong)} đ · ${dinhDang(t.so_don_tong)} đơn · luật doanh số: ${t.luat_doanh_so}`);
    for (const c of r.canh_bao) {
      console.log(`  ⚠ ${c.ma}: ${dinhDang(c.so_luong)}` +
        (c.doanh_so_khong_xep_duoc !== undefined
          ? ` (${dinhDang(c.doanh_so_khong_xep_duoc)} đ không xếp được vào kỳ nào)` : "") +
        (c.vi_du ? ` — ví dụ: ${c.vi_du.slice(0, 5).join(", ")}` : ""));
    }
    ketQua.push({ ten: duong, r });
  }

  // ── Bảng đối chiếu theo THÁNG: đây là thứ chủ dự án so tay ──────────────
  const cay = gopNhieuSo(ketQua);
  const thang = {};
  for (const { r } of ketQua) Object.assign(thang, r.tom_tat.thang);

  console.log("\n── Đối chiếu theo tháng (tổng công ty) ──");
  console.log("kỳ        doanh số (đ)         số đơn   nhân viên   ngày");
  let tongDs = 0, tongDon = 0;
  for (const k of Object.keys(thang).sort()) {
    const m = thang[k];
    console.log(`${k}  ${dinhDang(m.doanh_so).padStart(18)}  ${String(m.so_don).padStart(8)}  ${String(m.so_nhan_vien).padStart(9)}  ${String(m.so_ngay).padStart(5)}`);
    tongDs += m.doanh_so; tongDon += m.so_don;
  }
  console.log(`TỔNG      ${dinhDang(Math.round(tongDs * 100) / 100).padStart(18)}  ${String(tongDon).padStart(8)}`);

  if (!ghi) {
    console.log("\n(chạy thử — chưa ghi gì. Thêm --ghi để đẩy lên Firebase.)");
    return;
  }

  // ── Ghi: MỘT lượt PUT cho MỘT kỳ, đè trọn kỳ đó ────────────────────────
  const env = {
    FB_SA_EMAIL: process.env.FB_SA_EMAIL,
    FB_SA_KEY: process.env.FB_SA_KEY,
    FB_DB_URL: process.env.FB_DB_URL,
  };
  if (!env.FB_SA_EMAIL || !env.FB_SA_KEY) {
    console.error("\nDỪNG: thiếu FB_SA_EMAIL/FB_SA_KEY. Không ghi gì.");
    process.exit(6);
  }

  console.log("\n── Ghi vào bc/ky ──");
  for (const k of Object.keys(cay).sort()) {
    const duong = "bc/ky/" + k;
    const kq = await ghiDb(duong, cay[k], env);
    if (!kq.ok) {
      /* Dừng ngay ở kỳ đầu tiên lỗi, không chạy tiếp: chạy tiếp là để lại
         một dải kỳ nửa ghi nửa không mà không ai biết ranh giới ở đâu. */
      console.error(`  ✗ ${duong}: ${kq.ma} (${kq.vi || ""})`);
      process.exit(7);
    }
    console.log(`  ✓ ${duong} · ${Object.keys(cay[k]).length} nhân viên`);
  }

  if (!docLai) return;

  // ── Đọc ngược để xác nhận, không tin lời script tự nói ──────────────────
  console.log("\n── Đọc lại từ Firebase và so tổng ──");
  let lech = 0;
  for (const k of Object.keys(cay).sort()) {
    const kq = await docDb("bc/ky/" + k, env);
    if (!kq.ok) { console.error(`  ✗ ${k}: đọc lại lỗi ${kq.ma}`); lech++; continue; }
    let ds = 0, don = 0;
    for (const nv of Object.keys(kq.val || {})) {
      for (const ngay of Object.keys(kq.val[nv])) {
        ds += Number(kq.val[nv][ngay].doanh_so) || 0;
        don += Number(kq.val[nv][ngay].so_don) || 0;
      }
    }
    ds = Math.round(ds * 100) / 100;
    const mong = thang[k];
    const khop = ds === mong.doanh_so && don === mong.so_don;
    if (!khop) lech++;
    console.log(`  ${khop ? "✓" : "✗"} ${k} · ${dinhDang(ds)} đ · ${don} đơn` +
      (khop ? "" : ` — MONG ${dinhDang(mong.doanh_so)} đ / ${mong.so_don} đơn`));
  }
  if (lech) {
    console.error(`\n${lech} kỳ đọc lại KHÔNG khớp.`);
    process.exit(8);
  }
  console.log("\nMọi kỳ đọc lại khớp.");
}

main().catch(e => { console.error("Lỗi không lường được: " + (e && e.stack || e)); process.exit(1); });
