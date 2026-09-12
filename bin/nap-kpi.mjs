/* Nạp BẢNG KPI / HỆ SỐ QUY ĐỔI (`bc/quyetdinh/kpi`) lên Firebase.
 *
 * Cùng lý do tách như `nap-line.mjs`: nhịp đổi KHÁC nhịp nạp sổ. Sổ nạp theo
 * tháng; KPI và hệ số quy đổi chỉ đổi khi chủ dự án đổi mục tiêu kinh doanh.
 * Và cùng tính chất: lượt nạp sổ chỉ PUT `bc/ky/<kỳ>`, không chạm
 * `bc/quyetdinh`, nên thứ tự chạy hai script không quan trọng.
 *
 * ── CHỈ ĐỂ NẠP LƯỢT ĐẦU ──────────────────────────────────────────────────
 * Sau lượt này, chủ dự án sửa KPI và hệ số NGAY TRÊN MÀN HÌNH (dải setup của
 * từng tab line, ghi qua `POST /api/dat-kpi`). Script này chỉ dùng để đặt bộ
 * số đầu tiên, hoặc để dựng lại từ hạt giống khi cần.
 *
 * PUT ĐÈ TRỌN nhánh, kể cả mọi bản ghi đè theo kỳ và mọi lượt sửa trên màn
 * hình. `--doc-lai` in ra phần sắp mất TRƯỚC khi ghi — đọc nó, đừng bỏ qua.
 *
 * ── CÁCH DÙNG ────────────────────────────────────────────────────────────
 *   # 1) Xem bộ số sắp ghi, KHÔNG ghi gì, không cần khoá
 *   node bin/nap-kpi.mjs
 *
 *   # 2) Ghi thật (cùng cặp khoá service account mà Gateway đang dùng)
 *   export FB_SA_EMAIL='firebase-adminsdk-...@tinphattracking.iam.gserviceaccount.com'
 *   export FB_SA_KEY="$(cat duong-dan-khoa.pem)"
 *   node bin/nap-kpi.mjs --ghi --doc-lai
 *
 * Sửa bộ số mặc định: sửa `BANG_KPI_HAT_GIONG` trong `engine/src/kpi.mjs`.
 */
import { BANG_KPI_HAT_GIONG, DUONG_BANG_KPI, kiemBangKpi } from "../engine/src/kpi.mjs";
import { BANG_LINE_HAT_GIONG } from "../engine/src/line.mjs";
import { docDb, ghiDb } from "../src/firebase.js";

function docThamSo(argv) {
  const co = argv.filter(a => a.startsWith("--"));
  const la = argv.filter(a => !a.startsWith("--"));
  if (la.length) {
    console.error("Script này không nhận tham số thường: " + la.join(", "));
    process.exit(2);
  }
  for (const c of co) {
    if (!["--ghi", "--doc-lai"].includes(c)) {
      console.error("Không hiểu tham số " + c + " — xem chú thích đầu file.");
      process.exit(2);
    }
  }
  return { ghi: co.includes("--ghi"), docLai: co.includes("--doc-lai") };
}

/* Hiện KPI bằng NGHÌN đồng — đúng đơn vị mọi cột tiền trên màn hình, và đúng
 * đơn vị chủ dự án gõ ("2.700.000" nghĩa là 2 tỷ 7). Nhánh lưu bằng ĐỒNG. */
const nghin = (d) => (d / 1000).toLocaleString("vi-VN");

async function main() {
  const { ghi, docLai } = docThamSo(process.argv.slice(2));
  const bang = BANG_KPI_HAT_GIONG;

  /* Kiểm TRƯỚC khi ghi. Một bộ số sai đẩy lên Firebase thì mọi lượt đọc về
     sau đều bỏ qua cột quy đổi, và chỗ sai nằm ở DỮ LIỆU nên bộ kiểm của
     repo không bắt được. */
  const van_de = kiemBangKpi(bang);
  if (van_de.length) {
    console.error("DỪNG: bảng KPI không hợp lệ, không ghi gì.");
    for (const v of van_de) console.error("  " + JSON.stringify(v));
    process.exit(3);
  }

  const md = bang.mac_dinh || {};
  console.log(`\n── Bộ số sắp ghi vào ${DUONG_BANG_KPI} ──`);
  console.log(`${Object.keys(md).length} line · KPI hiện bằng NGHÌN đồng\n`);

  /* Liệt kê theo `thu_tu` của bảng line, không theo thứ tự khoá object: một
     line khai trong bảng line mà THIẾU ở đây phải lộ ra, vì line đó sẽ không
     có mức KPI nào để so. */
  const thuTu = BANG_LINE_HAT_GIONG.thu_tu;
  for (const line of thuTu) {
    const m = md[line];
    if (!m) { console.log(`  ${line.padEnd(14)} ⚠ CHƯA khai KPI lẫn hệ số`); continue; }
    const gd = m.he_so_gia_dung_pt != null
      ? `  ·  gia dụng ${String(m.he_so_gia_dung_pt).replace(".", ",")}%` : "";
    console.log(`  ${line.padEnd(14)} KPI ${nghin(m.kpi).padStart(12)}`
      + `  ·  hệ số ${String(m.he_so_pt).replace(".", ",")}%${gd}`);
  }
  const la = Object.keys(md).filter(l => !thuTu.includes(l));
  if (la.length) console.log(`\n  ⚠ ${la.length} line có KPI mà KHÔNG có trong bảng line: ${la.join(", ")}`);

  const soKy = Object.keys(bang.ky || {}).length;
  console.log(`\n  ${soKy} kỳ có bản ghi đè riêng`
    + (soKy ? "" : " (bình thường — mặc định áp cho mọi kỳ)"));

  const env = {
    FB_SA_EMAIL: process.env.FB_SA_EMAIL,
    FB_SA_KEY: process.env.FB_SA_KEY,
    FB_DB_URL: process.env.FB_DB_URL,
  };

  /* Đọc bộ số ĐANG nằm trên Firebase trước khi ghi đè — nhánh này nay có
     người sửa qua màn hình, nên "phần sắp mất" là chuyện thật, không phải lo
     xa như lúc chỉ có script ghi. */
  if (docLai && env.FB_SA_EMAIL && env.FB_SA_KEY) {
    const kq = await docDb(DUONG_BANG_KPI, env);
    console.log(`\n── Bộ số ĐANG nằm trên Firebase ──`);
    if (!kq.ok) console.log(`  (không đọc được: ${kq.ma})`);
    else if (!kq.val) console.log("  (chưa có gì — đây là lượt nạp đầu tiên)");
    else {
      const cuMd = kq.val.mac_dinh || {};
      const cuKy = Object.keys(kq.val.ky || {});
      console.log(`  ${Object.keys(cuMd).length} line · ${cuKy.length} kỳ có ghi đè riêng`);
      /* Hai thứ ghi đè sẽ xoá, nói riêng từng thứ: mức mặc định đã sửa khác
         hạt giống, và TOÀN BỘ bản ghi đè theo kỳ. */
      const lech = Object.keys(cuMd).filter((l) => {
        const a = cuMd[l] || {}, b = md[l] || {};
        return a.kpi !== b.kpi || a.he_so_pt !== b.he_so_pt
          || (a.he_so_gia_dung_pt ?? null) !== (b.he_so_gia_dung_pt ?? null);
      });
      if (lech.length) {
        console.log(`  ⚠ ${lech.length} line trên Firebase đang KHÁC hạt giống`);
        console.log(`    (ghi đè là mất phần đã sửa): ${lech.join(", ")}`);
      }
      if (cuKy.length) {
        console.log(`  ⚠ ${cuKy.length} kỳ có bản ghi đè riêng sẽ bị XOÁ SẠCH: ${cuKy.join(", ")}`);
      }
    }
  }

  if (!ghi) {
    console.log("\n(chạy thử — chưa ghi gì. Thêm --ghi để đẩy lên Firebase.)");
    return;
  }
  if (!env.FB_SA_EMAIL || !env.FB_SA_KEY) {
    console.error("\nDỪNG: thiếu FB_SA_EMAIL/FB_SA_KEY. Không ghi gì.");
    process.exit(6);
  }

  const kq = await ghiDb(DUONG_BANG_KPI, bang, env);
  if (!kq.ok) {
    console.error(`\n✗ ghi ${DUONG_BANG_KPI}: ${kq.ma} (${kq.vi || ""})`);
    process.exit(7);
  }
  console.log(`\n✓ đã ghi ${DUONG_BANG_KPI}`);

  if (!docLai) return;

  // Đọc ngược để xác nhận — không tin lời script tự nói.
  const lai = await docDb(DUONG_BANG_KPI, env);
  if (!lai.ok || !lai.val) {
    console.error("✗ đọc lại không được: " + (lai.ma || "rỗng"));
    process.exit(8);
  }
  const sai = kiemBangKpi(lai.val);
  const soLine = Object.keys(lai.val.mac_dinh || {}).length;
  const khop = !sai.length && soLine === Object.keys(md).length;
  console.log(`${khop ? "✓" : "✗"} đọc lại: ${soLine} line`);
  if (!khop) {
    if (sai.length) for (const v of sai) console.error("  " + JSON.stringify(v));
    process.exit(8);
  }
}

main().catch(e => { console.error("Lỗi không lường được: " + (e && e.stack || e)); process.exit(1); });
