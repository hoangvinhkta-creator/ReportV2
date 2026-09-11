/* Nạp BẢNG LINE (`bc/quyetdinh/line`) lên Firebase.
 *
 * Tách khỏi `nap-so-legacy.mjs` có chủ ý: hai lượt ghi này có NHỊP KHÁC NHAU.
 * Sổ bán hàng nạp theo kỳ (mỗi tháng một lần, hoặc một lượt nạp mốc legacy);
 * bảng line chỉ đổi khi NHÂN SỰ đổi — người vào, người nghỉ, đổi cách ghi tên.
 * Gộp hai việc vào một lệnh thì mỗi lần thêm một nhân viên lại phải chạy kèm
 * cả lượt nạp sổ, hoặc ngược lại — không cần thiết và dễ nhầm.
 *
 * Bảng line KHÔNG bị lượt nạp sổ đè: `nap-so-legacy.mjs` chỉ PUT vào
 * `bc/ky/<kỳ>`, không chạm `bc/quyetdinh` (CLAUDE.md — "Chỉnh sửa tay nằm
 * nhánh riêng, KHÔNG bị đè, và được hợp nhất lúc ĐỌC"). Nên thứ tự chạy hai
 * script không quan trọng.
 *
 * ── CÁCH DÙNG ────────────────────────────────────────────────────────────
 *   # 1) Xem bảng sắp ghi, KHÔNG ghi gì, không cần khoá
 *   node bin/nap-line.mjs
 *
 *   # 2) Ghi thật (cùng cặp khoá service account mà Gateway đang dùng)
 *   export FB_SA_EMAIL='firebase-adminsdk-...@tinphattracking.iam.gserviceaccount.com'
 *   export FB_SA_KEY="$(cat duong-dan-khoa.pem)"
 *   node bin/nap-line.mjs --ghi --doc-lai
 *
 * Sửa bảng: sửa `BANG_LINE_HAT_GIONG` trong `engine/src/line.mjs` rồi chạy
 * lại, HOẶC sửa thẳng `bc/quyetdinh/line` trên Firebase Console. Cách hai
 * không cần deploy gì — đó đúng là lý do bảng này là dữ liệu chứ không phải
 * code. Nhưng nhớ: PUT ở đây ĐÈ TRỌN bảng, nên sửa trên Console rồi chạy lại
 * script với hạt giống cũ là mất phần sửa đó. `--doc-lai` in ra bảng đang
 * thật sự nằm trên Firebase để đối chiếu trước khi ghi đè.
 */
import { BANG_LINE_HAT_GIONG, DUONG_BANG_LINE, kiemBangLine, LINE_KHAC } from "../engine/src/line.mjs";
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

async function main() {
  const { ghi, docLai } = docThamSo(process.argv.slice(2));
  const bang = BANG_LINE_HAT_GIONG;

  /* Kiểm TRƯỚC khi ghi, không phải sau. Một bảng sai đẩy lên Firebase là mọi
     lượt đọc về sau đều lỗi, và chỗ lỗi nằm ở dữ liệu nên bộ kiểm của repo
     không bắt được. */
  const van_de = kiemBangLine(bang);
  if (van_de.length) {
    console.error("DỪNG: bảng line không hợp lệ, không ghi gì.");
    for (const v of van_de) console.error("  " + JSON.stringify(v));
    process.exit(3);
  }

  const soTen = Object.keys(bang.cua_ten || {}).length;
  console.log(`\n── Bảng line sắp ghi vào ${DUONG_BANG_LINE} ──`);
  console.log(`${bang.thu_tu.length} line · ${soTen} tên nhân viên đã xếp\n`);

  // Nhóm tên theo line để đọc bằng mắt thấy ngay ai thuộc đâu.
  const theoLine = {};
  for (const [ten, line] of Object.entries(bang.cua_ten || {})) (theoLine[line] ||= []).push(ten);
  for (const line of bang.thu_tu) {
    const ten = (theoLine[line] || []).sort();
    console.log(`  ${line}`);
    if (ten.length) for (const t of ten) console.log(`      · ${t}`);
    else console.log(`      (chưa khai tên nào${line === LINE_KHAC ? " — line hứng, không cần khai" : ""})`);
    if (bang.ghi_chu && bang.ghi_chu[line]) console.log(`      ghi chú: ${bang.ghi_chu[line]}`);
  }

  const env = {
    FB_SA_EMAIL: process.env.FB_SA_EMAIL,
    FB_SA_KEY: process.env.FB_SA_KEY,
    FB_DB_URL: process.env.FB_DB_URL,
  };

  /* Đọc bảng ĐANG nằm trên Firebase trước khi ghi đè — để không lặng lẽ xoá
     mất phần chủ dự án đã sửa tay trên Console. */
  if (docLai && env.FB_SA_EMAIL && env.FB_SA_KEY) {
    const kq = await docDb(DUONG_BANG_LINE, env);
    console.log(`\n── Bảng ĐANG nằm trên Firebase ──`);
    if (!kq.ok) console.log(`  (không đọc được: ${kq.ma})`);
    else if (!kq.val) console.log("  (chưa có gì — đây là lượt nạp đầu tiên)");
    else {
      const cu = Object.keys(kq.val.cua_ten || {});
      console.log(`  ${(kq.val.thu_tu || []).length} line · ${cu.length} tên đã xếp`);
      const moi = new Set(Object.keys(bang.cua_ten || {}));
      const mat = cu.filter(t => !moi.has(t));
      if (mat.length) {
        console.log(`  ⚠ ${mat.length} tên đang có trên Firebase mà hạt giống KHÔNG có`);
        console.log(`    (ghi đè là mất): ${mat.join(", ")}`);
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

  const kq = await ghiDb(DUONG_BANG_LINE, bang, env);
  if (!kq.ok) {
    console.error(`\n✗ ghi ${DUONG_BANG_LINE}: ${kq.ma} (${kq.vi || ""})`);
    process.exit(7);
  }
  console.log(`\n✓ đã ghi ${DUONG_BANG_LINE}`);

  if (!docLai) return;

  // Đọc ngược để xác nhận — không tin lời script tự nói.
  const lai = await docDb(DUONG_BANG_LINE, env);
  if (!lai.ok || !lai.val) {
    console.error("✗ đọc lại không được: " + (lai.ma || "rỗng"));
    process.exit(8);
  }
  const sai = kiemBangLine(lai.val);
  const soTenLai = Object.keys(lai.val.cua_ten || {}).length;
  const khop = !sai.length
    && (lai.val.thu_tu || []).join("\x1f") === bang.thu_tu.join("\x1f")
    && soTenLai === soTen;
  console.log(`${khop ? "✓" : "✗"} đọc lại: ${(lai.val.thu_tu || []).length} line · ${soTenLai} tên`);
  if (!khop) {
    if (sai.length) for (const v of sai) console.error("  " + JSON.stringify(v));
    process.exit(8);
  }
}

main().catch(e => { console.error("Lỗi không lường được: " + (e && e.stack || e)); process.exit(1); });
