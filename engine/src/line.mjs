/* LINE — tầng phân tích doanh số CỐ ĐỊNH xuyên thời gian, nằm TRÊN tên nhân viên.
 *
 * Vấn đề nó giải: tên nhân viên trên sổ KHÔNG bền. Người nghỉ, người mới vào,
 * hotline được bàn giao, cách ghi tên đổi. Đã thấy thật trên sổ 2025+2026:
 * `Lê Văn Quân 0865111033` bán từ 03/2025 tới 08/2025 rồi nghỉ, và
 * `Tống Khánh Linh 0865111033` xuất hiện ở 02/2026 với CÙNG số hotline. Nếu
 * biểu đồ vẽ theo tên nhân viên thì một kênh bán liên tục sẽ hiện ra thành
 * hai cột rời nhau, đứt đúng chỗ đổi người — và không ai đọc được xu hướng.
 *
 * LINE là đơn vị bền: "Nội thành", "Fanpage", "Shopee"... Tên nhân viên chỉ
 * là nhãn đi vào một line. Thêm/bớt/đổi người = sửa bảng ánh xạ, KHÔNG sửa
 * code, KHÔNG nạp lại sổ.
 *
 * ── VÌ SAO BẢNG ÁNH XẠ LÀ DỮ LIỆU, KHÔNG PHẢI CODE ──────────────────────
 * Nó đổi theo nhân sự, không theo phiên bản phần mềm. Chôn vào code thì mỗi
 * lần có người vào/nghỉ phải sửa repo và chờ deploy — sai người chịu trách
 * nhiệm. Nên bảng nằm ở `bc/quyetdinh/line` trên Firebase, và bảng dưới đây
 * chỉ là HẠT GIỐNG để nạp lần đầu (`bin/nap-line.mjs`).
 *
 * Chọn `bc/quyetdinh/…` chứ không mở nhánh `bc/line` mới, hai lý do:
 *   1. Đúng nghĩa: đây là QUYẾT ĐỊNH CỦA NGƯỜI về cách phân loại, y như mục
 *      "Nhập sổ" của CLAUDE.md nói — quyết định tay nằm nhánh riêng, KHÔNG
 *      bị đè khi nạp lại sổ, và được hợp nhất lúc ĐỌC.
 *   2. Nhánh đó đã có rules đang chạy live (`.read` quantri|quanly,
 *      `.write: false` — chỉ service account ghi). Mở nhánh mới thì phải sửa
 *      rules rồi publish tay trên Console — thêm một bước có thể quên, đổi
 *      lấy con số 0 lợi ích.
 *
 * ── VÌ SAO GỘP LÚC ĐỌC, KHÔNG GỘP LÚC GHI ───────────────────────────────
 * `bc/ky/<kỳ>/<nhân viên>/<ngày>` giữ nguyên hạt (nhân viên, ngày) — đó là
 * SỰ THẬT THÔ của sổ. Line là một CÁCH NHÌN lên sự thật đó. Nếu ghi sẵn tổng
 * theo line vào `bc/ky` thì mỗi lần chủ dự án đổi ý về một cái tên là phải
 * nạp lại toàn bộ 20 tháng sổ. Gộp lúc đọc thì sửa bảng là số đổi ngay.
 *
 * TRÌNH DUYỆT KHÔNG BAO GIỜ CHẠY FILE NÀY (LUẬT SỐ 1 — "luật phân loại"
 * được CLAUDE.md kể tên tường minh trong danh sách CẤM ở frontend).
 */

/** Line hứng mọi tên chưa được xếp. Chủ dự án chốt: "line khác — dồn các
 *  nhân viên còn lại vào đây". */
export const LINE_KHAC = "Khác";

/** Đường dẫn bảng ánh xạ trên Firebase. Một chỗ khai, để script nạp và Engine
 *  đọc không bao giờ trỏ lệch nhau. */
export const DUONG_BANG_LINE = "bc/quyetdinh/line";

/* ─────────────── Hạt giống: bảng line chủ dự án chốt 11/09/2026 ───────────────
 *
 * `cua_ten` khoá theo KHOÁ NHÂN VIÊN (`khoaNhanVien()` của gop-ban-hang.mjs),
 * KHÔNG theo tên nguyên văn — cố ý, để join thẳng với khoá của
 * `bc/ky/<kỳ>/<nhân viên>` mà không phải đổi dạng ở giữa. Khác biệt duy nhất
 * hiện có: "Miền Bắc 0865.909.033" → "Miền Bắc 0865~909~033" (Firebase cấm
 * dấu chấm trong tên khoá).
 */
export const BANG_LINE_HAT_GIONG = {
  /* Vừa là THỨ TỰ HIỂN THỊ, vừa là DANH SÁCH LINE CHÍNH THỨC. Phải khai
     tường minh chứ không suy ra từ dữ liệu: "Shopee" tồn tại từ 09/2026 và
     trước đó chưa có dòng nào — suy từ dữ liệu thì nó biến mất khỏi báo cáo
     thay vì hiện ra với số 0. */
  thu_tu: [
    "Nội thành",
    "Tín Phát",
    "Miền Bắc",
    "Tổng kho",
    "Quyết chiến",
    "Đông Á",
    "Tân Á",
    "Fanpage",
    "Shopee",
    LINE_KHAC,
  ],

  /* Bối cảnh nhân sự của từng line — để người đọc báo cáo sau này hiểu vì sao
     một line đứt quãng hay mới xuất hiện, không phải đi hỏi lại. */
  ghi_chu: {
    "Nội thành": "Kênh do 4 người phụ trách; Lê Văn Quân đã nghỉ.",
    "Fanpage": "Tống Khánh Linh đã nghỉ; từ 09/2026 người mới ghi tên là 'Fanpage 0327339229'.",
    "Shopee": "Tên trên sổ là 'Shopee 0865111033'; chỉ bắt đầu có dòng từ 09/2026.",
    [LINE_KHAC]: "Năm tên nhỏ chủ dự án chốt để lại đây (kể cả dòng sổ trống ô nhân viên), cộng mọi tên mới chưa ai xếp line.",
  },

  cua_ten: {
    // Nội thành — 4 nguồn, vẫn xem tách được từng người qua `nguon`
    "Đức Hiệp": "Nội thành",
    "Mr Quý": "Nội thành",
    "Mr Vinh": "Nội thành",
    "Lê Văn Quân 0865111033": "Nội thành",

    "Tín Phát 0869931931": "Tín Phát",
    "Miền Bắc 0865~909~033": "Miền Bắc",
    "Vũ Hạnh Ly 0868345633": "Tổng kho",
    "Phước Thắng 0865909022": "Quyết chiến",
    "Lê Mạnh Hoàng 0865111533": "Đông Á",
    "Đức Kiên - Tân Á 0867666533": "Tân Á",

    /* Fanpage: khai SẴN tên người mới của 09/2026. Khai trước là cách chứng
       minh cơ chế chạy — sổ 09/2026 nạp vào sẽ rơi đúng line, không cần sửa
       gì thêm. */
    "Tống Khánh Linh 0865111033": "Fanpage",
    "Fanpage 0327339229": "Fanpage",

    /* Shopee: khai sẵn tên sẽ xuất hiện trên sổ từ 09/2026. Chưa có dòng nào
       — line vẫn tồn tại và hiện ra với số 0, vì `thu_tu` là danh sách khai
       tường minh chứ không suy từ dữ liệu. */
    "Shopee 0865111033": "Shopee",

    /* Khác — chủ dự án chốt 11/09/2026: năm tên này Ở LẠI "Khác", không tách
       line riêng. Khai TƯỜNG MINH thay vì để rơi vào Khác theo mặc định, và
       đây là khác biệt quan trọng: khai rồi thì chúng không còn bị kể trong
       `chua_xep`, nên danh sách `chua_xep` từ nay chỉ còn chứa tên THẬT SỰ
       mới — một nhân viên vào sau mà chưa ai xếp line. Để mặc định thì cảnh
       báo kêu mãi về năm tên đã có quyết định, và một tên mới lọt vào giữa
       đám đó sẽ không ai thấy. */
    "Thảo Linh": LINE_KHAC,
    "Lê Quang Trường 0589691228": LINE_KHAC,
    "Nguyễn Thị Minh Bảo": LINE_KHAC,
    "Đinh Thùy Dương": LINE_KHAC,
    /* Dòng sổ để TRỐNG ô nhân viên. Khai vào Khác để `chua_xep` sạch, KHÔNG
       làm mất việc của P5: cảnh báo `thieu-nhan-vien` của `gopSoBanHang()` là
       một cảnh báo KHÁC và vẫn kêu đủ 25 dòng mỗi lượt trích. */
    "_chua_xac_dinh": LINE_KHAC,
  },
};

/* ─────────────── Kiểm bảng trước khi dùng ─────────────── */

/** Bảng line có dùng được không. Trả danh sách vấn đề — rỗng là dùng được.
 *
 *  Vì sao phải kiểm: bảng này là DỮ LIỆU người sửa được trên Firebase, không
 *  phải code đi qua bộ kiểm. Một cái tên line gõ sai ("Nội Thành" hoa chữ T)
 *  sẽ lặng lẽ tạo ra một line thứ 11 mà không ai gọi tên được. */
export function kiemBangLine(bang) {
  const van_de = [];
  if (!bang || typeof bang !== "object") return [{ ma: "bang-rong" }];

  const thu_tu = bang.thu_tu;
  if (!Array.isArray(thu_tu) || !thu_tu.length) {
    van_de.push({ ma: "thieu-thu-tu" });
  } else {
    const thay = new Set();
    for (const line of thu_tu) {
      if (typeof line !== "string" || !line.trim()) van_de.push({ ma: "ten-line-rong" });
      else if (thay.has(line)) van_de.push({ ma: "line-trung", line });
      else thay.add(line);
    }
    /* Không có line hứng thì một tên lạ sẽ rơi vào hư không và tổng theo line
       không còn bằng tổng công ty. */
    if (!thay.has(LINE_KHAC)) van_de.push({ ma: "thieu-line-khac", can: LINE_KHAC });
  }

  const cua_ten = bang.cua_ten;
  if (cua_ten !== undefined && (typeof cua_ten !== "object" || cua_ten === null)) {
    van_de.push({ ma: "cua-ten-sai-dang" });
  } else if (cua_ten) {
    const hopLe = new Set(Array.isArray(thu_tu) ? thu_tu : []);
    for (const [ten, line] of Object.entries(cua_ten)) {
      if (!hopLe.has(line)) van_de.push({ ma: "line-khong-khai", ten, line });
    }
  }
  return van_de;
}

/** Một khoá nhân viên thuộc line nào. Chưa khai thì về `Khác` — nhưng bên gọi
 *  PHẢI báo ra danh sách chưa khai (xem `gopTheoLine`), không được im lặng:
 *  một nhân viên mới vào mà không ai khai line sẽ lặng lẽ tan vào "Khác" và
 *  doanh số của họ biến mất khỏi mọi line thật. */
export function xepLine(khoaNv, bang) {
  const m = bang && bang.cua_ten;
  const line = m ? m[khoaNv] : undefined;
  return typeof line === "string" && line ? line : LINE_KHAC;
}

/* ─────────────── Gộp theo line ─────────────── */

const lamTron = x => Math.round(x * 100) / 100;

/** Từ cây `bc/ky` (hạt nhân viên × ngày) ra doanh số theo LINE × tháng.
 *
 *  `cayKy`: `{ "<kỳ>": { "<khoá nhân viên>": { "<ngày>": {doanh_so, so_don} } } }`
 *  — đúng hình dạng `gopSoBanHang()` trả về và đúng hình dạng đọc từ Firebase.
 *
 *  Trả `{ thu_tu, line, thang, tom_tat, chua_xep }`, trong đó mỗi line có:
 *    · `thang`  — tổng theo từng kỳ
 *    · `nguon`  — tách theo TỪNG TÊN NHÂN VIÊN trong line đó. Chủ dự án yêu
 *                 cầu tường minh: "vẫn phải thể hiện rõ trong Nội thành có 4
 *                 nguồn này". Line là số để xem xu hướng; `nguon` là chỗ trả
 *                 lời "ai làm ra phần nào".
 *
 *  Về `so_don`: cộng thẳng `so_don` của các ô. Phép cộng này chỉ đúng khi
 *  KHÔNG có số chứng từ nào nằm ở hai nhân viên — và đó là bất biến
 *  `gopSoBanHang()` đang canh (cảnh báo `don-nhieu-nhan-vien`, hiện 0 ca trên
 *  cả hai sổ thật). Nếu bất biến đó vỡ thì con số ở đây cộng đôi, nên đừng
 *  tháo cảnh báo bên kia. */
export function gopTheoLine(cayKy, bang) {
  const van_de = kiemBangLine(bang);
  if (van_de.length) {
    const e = new Error("line: bang anh xa khong dung duoc");
    e.ma = "bang-line-khong-hop-le";
    e.van_de = van_de;
    throw e;
  }
  if (!cayKy || typeof cayKy !== "object") throw new Error("line: can cay bc/ky");

  const line = {};
  for (const ten of bang.thu_tu) {
    line[ten] = { doanh_so: 0, so_don: 0, thang: {}, nguon: {} };
  }
  const thang = {};
  const chua_xep = new Map();   // khoá nhân viên → { doanh_so, so_don }

  for (const ky of Object.keys(cayKy).sort()) {
    const theoNv = cayKy[ky];
    if (!theoNv || typeof theoNv !== "object") continue;

    for (const nv of Object.keys(theoNv)) {
      const theoNgay = theoNv[nv];
      if (!theoNgay || typeof theoNgay !== "object") continue;

      const tenLine = xepLine(nv, bang);
      const daKhai = !!(bang.cua_ten && bang.cua_ten[nv]);
      const L = line[tenLine] || (line[tenLine] = { doanh_so: 0, so_don: 0, thang: {}, nguon: {} });

      let ds = 0, don = 0;
      for (const ngay of Object.keys(theoNgay)) {
        const o = theoNgay[ngay] || {};
        ds = lamTron(ds + (Number(o.doanh_so) || 0));
        don += Number(o.so_don) || 0;
      }

      L.doanh_so = lamTron(L.doanh_so + ds);
      L.so_don += don;

      const lt = (L.thang[ky] ||= { doanh_so: 0, so_don: 0 });
      lt.doanh_so = lamTron(lt.doanh_so + ds);
      lt.so_don += don;

      const ng = (L.nguon[nv] ||= { doanh_so: 0, so_don: 0, thang: {} });
      ng.doanh_so = lamTron(ng.doanh_so + ds);
      ng.so_don += don;
      const ngt = (ng.thang[ky] ||= { doanh_so: 0, so_don: 0 });
      ngt.doanh_so = lamTron(ngt.doanh_so + ds);
      ngt.so_don += don;

      const tt = (thang[ky] ||= { doanh_so: 0, so_don: 0 });
      tt.doanh_so = lamTron(tt.doanh_so + ds);
      tt.so_don += don;

      if (!daKhai) {
        const c = chua_xep.get(nv) || { doanh_so: 0, so_don: 0 };
        c.doanh_so = lamTron(c.doanh_so + ds);
        c.so_don += don;
        chua_xep.set(nv, c);
      }
    }
  }

  let doanh_so_tong = 0, so_don_tong = 0;
  for (const k of Object.keys(thang)) {
    doanh_so_tong = lamTron(doanh_so_tong + thang[k].doanh_so);
    so_don_tong += thang[k].so_don;
  }

  /* Bất biến: cộng mọi line phải bằng tổng công ty. Lệch nghĩa là có nhân
     viên rơi ra ngoài mọi line — tức báo cáo theo line đang kể thiếu tiền. */
  let ds_line = 0, don_line = 0;
  for (const ten of Object.keys(line)) {
    ds_line = lamTron(ds_line + line[ten].doanh_so);
    don_line += line[ten].so_don;
  }
  const khop_tong = lamTron(ds_line - doanh_so_tong) === 0 && don_line === so_don_tong;

  return {
    thu_tu: [...bang.thu_tu],
    ghi_chu: bang.ghi_chu ? { ...bang.ghi_chu } : {},
    line,
    thang,
    tom_tat: { doanh_so_tong, so_don_tong, khop_tong },
    /* Sắp theo doanh số giảm dần: một tên lạ bán nhiều phải đập vào mắt
       trước một tên lạ bán một đơn. */
    chua_xep: [...chua_xep]
      .sort((a, b) => b[1].doanh_so - a[1].doanh_so)
      .map(([ten, v]) => ({ ten, ...v })),
  };
}
