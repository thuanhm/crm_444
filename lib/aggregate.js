// Logic đọc file Excel CRM1.0 và tính điểm thi đua theo Công văn 7087/TGĐ-NHCT-KHDN5
//
// THIẾT KẾ QUAN TRỌNG:
// 1) Mỗi trong 5 file được xử lý ĐỘC LẬP thành một "partial" (phần dữ liệu đã tổng hợp theo
//    Phòng/RM, KHÔNG chứa tên khách hàng/CIF/MST). Các partial này được lưu lại theo từng file,
//    để khi admin chỉ cần sửa 1 file, hệ thống lấy lại 4 partial cũ của các file còn lại.
// 2) Đối chiếu Phòng giữa 4 file CRM và file danh sách biên chế dùng MÃ PHÒNG (không dùng tên
//    phòng) để tránh sai lệch do viết hoa/thường, dấu cách, viết tắt khác nhau. Tên phòng chỉ
//    dùng để HIỂN THỊ, không dùng để đối chiếu.
//
// Cấp RM (cá nhân, Mục 6.2 công văn — không chia cho ai vì đã là đơn vị nhỏ nhất):
//   Điểm RM = 30% x Số Lead/Opp có tương tác + 30% x Số Lead chuyển đổi sang Opp + 40% x Số Opp thành công
// (Dùng SỐ LƯỢNG tuyệt đối, không dùng tỷ lệ %, đúng tiêu chí nêu trong công văn.)
//
// Cấp Phòng (Mục 6.1 công văn — công thức có "/RM", tức chia bình quân theo số RM biên chế
// của phòng để so sánh công bằng giữa phòng đông người và phòng ít người):
//   Điểm Phòng = 30% x (Tổng Lead/Opp có tương tác ÷ Số RM) + 30% x (Tổng Lead chuyển đổi sang Opp ÷ Số RM)
//              + 40% x (Tổng Opp thành công ÷ Số RM)

export const NOT_ASSIGNED = ['Chờ phân giao', 'Chờ phân giao lại', 'Đang bàn giao'];

// Tăng số này mỗi khi thay đổi CẤU TRÚC của partial (ví dụ đổi khoá đối chiếu từ tên phòng
// sang mã phòng). Partial cũ không có đúng version này sẽ bị coi là "không dùng lại được",
// buộc admin phải tải lại file thay vì âm thầm dùng nhầm dữ liệu định dạng cũ.
export const PARTIAL_SCHEMA_VERSION = 3;

// Các tên cột có thể dùng để nhận diện RM trong file danh sách biên chế (PeopleSoft có thể xuất
// với tên cột khác nhau tuỳ đợt trích xuất).
const RM_ID_COLUMNS = [
  'RM quản lý', 'RM', 'Mã CB', 'Mã cán bộ', 'Mã nhân viên', 'User RM', 'Username', 'User name',
  'Email/AD', 'Email', 'AD', 'Mã đăng nhập',
];

// Nhãn hiển thị + thứ tự cố định cho 5 loại file.
export const FILE_TYPES = [
  { type: 'lead_status', label: 'Báo cáo trạng thái LEAD', expect: 'Lead code' },
  { type: 'opp_status', label: 'Báo cáo trạng thái OPP', expect: 'Opp code' },
  { type: 'lead_int', label: 'Tiếp cận tương tác LEAD', expect: 'Lead code' },
  { type: 'opp_int', label: 'Tiếp cận tương tác OPP', expect: 'Opp code' },
  { type: 'roster', label: 'Danh sách RM biên chế theo phòng (PeopleSoft)', expect: null, roster: true },
];

function trim(v) {
  return (v || '').toString().trim();
}

// ===== Đọc 4 file CRM (đều có cấu trúc: vài dòng tiêu đề, rồi 1 dòng header chứa "Tên phòng") =====

export function findHeaderIdx(aoa) {
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const row = aoa[i] || [];
    if (row.some((c) => (c || '').toString().trim() === 'Tên phòng')) return i;
  }
  return 3;
}

export function rowsFromAOA(aoa) {
  const hIdx = findHeaderIdx(aoa);
  const headers = (aoa[hIdx] || []).map((h) => (h || '').toString().trim());
  const rows = [];
  for (let i = hIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === undefined || c === null || c === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// ===== Đọc file danh sách biên chế RM (cấu trúc khác: 1 dòng header duy nhất, tên cột do
// PeopleSoft đặt, có thể khác nhau giữa các lần trích xuất) =====

function findHeaderRowGeneric(aoa, mustContainSubstrLower) {
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const row = (aoa[i] || []).map((c) => (c || '').toString().trim());
    if (row.some((cell) => mustContainSubstrLower.some((m) => cell.toLowerCase().includes(m)))) return i;
  }
  return -1;
}

export function rowsFromRosterAOA(aoa) {
  let hIdx = findHeaderRowGeneric(aoa, ['mã phòng']);
  if (hIdx === -1) hIdx = findHeaderIdx(aoa); // dự phòng: file có cấu trúc giống 4 file CRM
  const headers = (aoa[hIdx] || []).map((h) => (h || '').toString().trim());
  const rows = [];
  for (let i = hIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === undefined || c === null || c === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    rows.push(obj);
  }
  const maPhongCol = headers.find((h) => h.toLowerCase().includes('mã phòng'));
  const tenPhongCol = headers.find((h) => h.toLowerCase().includes('tên phòng'));
  const rmCol = headers.find((h) => RM_ID_COLUMNS.some((c) => c.toLowerCase() === h.toLowerCase()));
  return { headers, rows, maPhongCol, tenPhongCol, rmCol };
}

// Chuẩn hoá mã phòng về đúng định dạng dùng trong 4 file CRM ("444xx", 5 ký tự).
// File biên chế PeopleSoft thường xuất mã dạng "0444xx000" (9 ký tự: số 0 đầu + 444 + xx + 000).
export function normalizeMaPhong(raw) {
  const s = trim(raw);
  if (!s) return '';
  if (/^444\d{2}$/.test(s)) return s; // đã đúng định dạng CRM
  if (/^0444\d{2}000$/.test(s)) return s.slice(1, -3); // định dạng PeopleSoft chuẩn
  if (s.length === 9 && s.startsWith('0') && s.endsWith('000')) return s.slice(1, -3); // dự phòng
  return s; // không nhận diện được, giữ nguyên để còn cảnh báo lệch dữ liệu
}

// ===== Xây dựng "partial" (đã ẩn danh, không còn tên KH/CIF/MST) cho từng loại file =====
// Mỗi phòng được nhận diện bằng MÃ PHÒNG (key ổn định); Tên phòng chỉ đi kèm để hiển thị (label).

export function buildLeadStatusPartial(rows) {
  // Chỉ gắn được vào một RM cụ thể mới có ý nghĩa trong chương trình thi đua (mục tiêu chương
  // trình tính trên RM biên chế) — dòng không xác định được RM bị bỏ qua hoàn toàn, không cộng
  // vào bất kỳ đâu. Việc lọc RM có trong file biên chế hay không được thực hiện sau, ở bước gộp
  // (combinePartials), vì partial của từng file được xử lý độc lập, chưa biết roster.
  const rmMap = {};
  rows.forEach((r) => {
    const rm = trim(r['RM quản lý']);
    if (!rm) return;
    const maPhong = trim(r['Mã phòng']);
    const tenPhong = trim(r['Tên phòng']);
    const st = trim(r['Trạng thái']);
    const giao = NOT_ASSIGNED.includes(st) ? 0 : 1;
    const chuyen = st === 'Chuyển đổi' ? 1 : 0;
    if (!rmMap[rm]) rmMap[rm] = { key: rm, phong: maPhong, phongLabel: tenPhong, leadGiao: 0, leadChuyenDoi: 0 };
    if (maPhong) rmMap[rm].phong = maPhong;
    if (tenPhong) rmMap[rm].phongLabel = tenPhong;
    rmMap[rm].leadGiao += giao;
    rmMap[rm].leadChuyenDoi += chuyen;
  });
  return { rm: Object.values(rmMap) };
}

export function buildOppStatusPartial(rows) {
  const rmMap = {};
  rows.forEach((r) => {
    const rm = trim(r['RM quản lý']);
    if (!rm) return;
    const maPhong = trim(r['Mã phòng']);
    const tenPhong = trim(r['Tên phòng']);
    const st = trim(r['Trạng thái']);
    const tc = st === 'Thành công' ? 1 : 0;
    if (!rmMap[rm]) rmMap[rm] = { key: rm, phong: maPhong, phongLabel: tenPhong, oppTotal: 0, oppThanhCong: 0 };
    if (maPhong) rmMap[rm].phong = maPhong;
    if (tenPhong) rmMap[rm].phongLabel = tenPhong;
    rmMap[rm].oppTotal += 1;
    rmMap[rm].oppThanhCong += tc;
  });
  return { rm: Object.values(rmMap) };
}

export function buildLeadIntPartial(rows) {
  const rmMap = {}; // rm -> { phong, phongLabel, set(code) }
  rows.forEach((r) => {
    const rm = trim(r['RM quản lý']);
    const code = trim(r['Lead code']);
    if (!rm || !code) return;
    const maPhong = trim(r['Mã phòng']);
    const tenPhong = trim(r['Tên phòng']);
    if (!rmMap[rm]) rmMap[rm] = { phong: maPhong, phongLabel: tenPhong, set: new Set() };
    if (maPhong) rmMap[rm].phong = maPhong;
    if (tenPhong) rmMap[rm].phongLabel = tenPhong;
    rmMap[rm].set.add(code);
  });
  return {
    rm: Object.entries(rmMap).map(([key, v]) => ({ key, phong: v.phong, phongLabel: v.phongLabel, leadTuongTac: v.set.size })),
  };
}

export function buildOppIntPartial(rows) {
  const rmMap = {};
  rows.forEach((r) => {
    const rm = trim(r['RM quản lý']);
    const code = trim(r['Opp code']);
    if (!rm || !code) return;
    const maPhong = trim(r['Mã phòng']);
    const tenPhong = trim(r['Tên phòng']);
    if (!rmMap[rm]) rmMap[rm] = { phong: maPhong, phongLabel: tenPhong, set: new Set() };
    if (maPhong) rmMap[rm].phong = maPhong;
    if (tenPhong) rmMap[rm].phongLabel = tenPhong;
    rmMap[rm].set.add(code);
  });
  return {
    rm: Object.entries(rmMap).map(([key, v]) => ({ key, phong: v.phong, phongLabel: v.phongLabel, oppTuongTac: v.set.size })),
  };
}

export function buildRosterPartial(rows, maPhongCol, rmCol, tenPhongCol) {
  const map = {}; // maPhong -> Set(rmId)  (dùng tính Số RM biên chế/phòng)
  const labelMap = {}; // maPhong -> tenPhong
  const rmSet = new Set(); // toàn bộ RM có tên trong file biên chế
  const rmToPhong = {}; // rmId -> { maPhong, tenPhong } — nguồn CHUẨN cho phòng của từng RM

  if (rmCol) {
    rows.forEach((r) => {
      const rmId = trim(r[rmCol]);
      if (!rmId) return;
      rmSet.add(rmId);
      if (maPhongCol) {
        const maPhong = normalizeMaPhong(r[maPhongCol]);
        const tenPhong = tenPhongCol ? trim(r[tenPhongCol]) : '';
        if (maPhong) {
          if (!map[maPhong]) map[maPhong] = new Set();
          map[maPhong].add(rmId);
          if (tenPhong) labelMap[maPhong] = tenPhong;
          rmToPhong[rmId] = { maPhong, tenPhong };
        }
      }
    });
  }
  const rmCountMap = {};
  let tongRM = 0;
  for (const p in map) {
    rmCountMap[p] = map[p].size;
    tongRM += map[p].size;
  }
  return { meta: { tongRM }, rmCountMap, labelMap, rmList: Array.from(rmSet), rmToPhong };
}

// Xây dựng partial cho một loại file bất kỳ từ AOA (mảng-2-chiều đọc từ Excel).
export function buildPartialFromAOA(fileType, aoa) {
  let result;
  if (fileType === 'roster') {
    const { rows, maPhongCol, rmCol, tenPhongCol } = rowsFromRosterAOA(aoa);
    result = buildRosterPartial(rows, maPhongCol, rmCol, tenPhongCol);
  } else {
    const { rows } = rowsFromAOA(aoa);
    if (fileType === 'lead_status') result = buildLeadStatusPartial(rows);
    else if (fileType === 'opp_status') result = buildOppStatusPartial(rows);
    else if (fileType === 'lead_int') result = buildLeadIntPartial(rows);
    else if (fileType === 'opp_int') result = buildOppIntPartial(rows);
    else throw new Error('Loại file không hợp lệ: ' + fileType);
  }
  return { ...result, schemaVersion: PARTIAL_SCHEMA_VERSION };
}

// Kiểm tra nhanh xem AOA có đúng cấu trúc mong đợi không (dùng để cảnh báo sớm cho admin).
export function validateAOA(fileType, aoa) {
  if (fileType === 'roster') {
    const { maPhongCol, rmCol } = rowsFromRosterAOA(aoa);
    const warnings = [];
    if (!maPhongCol) warnings.push('Không tìm thấy cột "Mã phòng" (hoặc tương tự) trong file biên chế.');
    if (!rmCol) warnings.push('Không nhận diện được cột mã RM (RM quản lý, Email/AD, Mã CB, Mã nhân viên...).');
    return warnings;
  }
  const def = FILE_TYPES.find((f) => f.type === fileType);
  const { headers } = rowsFromAOA(aoa);
  const warnings = [];
  if (!headers.includes(def.expect)) warnings.push(`Không tìm thấy cột "${def.expect}".`);
  if (!headers.includes('RM quản lý')) warnings.push('Không tìm thấy cột "RM quản lý" — cần cột này để đối chiếu với file biên chế.');
  return warnings;
}

// Điểm RM: KHÔNG chia, dùng SỐ LƯỢNG tuyệt đối (đúng Mục 6.2 công văn — không dùng tỷ lệ %).
export function scoreRM(rmRawRows) {
  return rmRawRows
    .map((r) => ({
      ...r,
      diem: +(0.3 * ((r.leadTuongTac || 0) + (r.oppTuongTac || 0)) + 0.3 * (r.leadChuyenDoi || 0) + 0.4 * (r.oppThanhCong || 0)).toFixed(1),
    }))
    .sort((a, b) => b.diem - a.diem);
}

// Điểm Phòng: chia bình quân theo Số RM biên chế của phòng (đúng Mục 6.1 công văn).
export function scorePhong(phongRawRows, rmCountMap) {
  return phongRawRows
    .map((r) => {
      const soRM = rmCountMap[r.key] || 0;
      if (!soRM) return { ...r, soRM: 0, diem: null };
      const diem =
        0.3 * (((r.leadTuongTac || 0) + (r.oppTuongTac || 0)) / soRM) +
        0.3 * ((r.leadChuyenDoi || 0) / soRM) +
        0.4 * ((r.oppThanhCong || 0) / soRM);
      return { ...r, soRM, diem: +diem.toFixed(2) };
    })
    .sort((a, b) => {
      if (a.diem === null && b.diem === null) return 0;
      if (a.diem === null) return 1;
      if (b.diem === null) return -1;
      return b.diem - a.diem;
    });
}

// Gộp 5 partial thành kết quả cuối cùng. QUAN TRỌNG: mục tiêu chương trình thi đua tính trên RM
// biên chế, nên bước ĐẦU TIÊN là lọc chỉ giữ RM có tên trong file biên chế — Phòng và Chi nhánh
// đều được suy ra bằng cách CỘNG DỒN từ đúng tập RM hợp lệ này, không lấy từ dữ liệu thô chưa lọc.
export function combinePartials(parts) {
  const leadStatus = parts.lead_status;
  const oppStatus = parts.opp_status;
  const leadInt = parts.lead_int;
  const oppInt = parts.opp_int;
  const roster = parts.roster;

  // Bước 1: gộp dữ liệu RM từ cả 4 file (chưa lọc theo biên chế).
  const rmMapAll = {};
  function ensureRm(k, phong, phongLabel) {
    if (!rmMapAll[k]) {
      rmMapAll[k] = { key: k, phong: phong || '', phongLabel: phongLabel || phong || '', leadGiao: 0, leadChuyenDoi: 0, oppTotal: 0, oppThanhCong: 0, leadTuongTac: 0, oppTuongTac: 0 };
    }
    if (phong) rmMapAll[k].phong = phong;
    if (phongLabel) rmMapAll[k].phongLabel = phongLabel;
    return rmMapAll[k];
  }
  (leadStatus?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong, r.phongLabel);
    e.leadGiao += r.leadGiao;
    e.leadChuyenDoi += r.leadChuyenDoi;
  });
  (oppStatus?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong, r.phongLabel);
    e.oppTotal += r.oppTotal;
    e.oppThanhCong += r.oppThanhCong;
  });
  (leadInt?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong, r.phongLabel);
    e.leadTuongTac += r.leadTuongTac;
  });
  (oppInt?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong, r.phongLabel);
    e.oppTuongTac += r.oppTuongTac;
  });

  // Bước 2: LỌC chỉ giữ RM có trong file biên chế — đây là tập dữ liệu duy nhất dùng cho mọi
  // tính toán phía sau (RM, Phòng, Chi nhánh).
  const validRmSet = new Set(roster?.rmList || []);
  const rmToPhong = roster?.rmToPhong || {};
  const validRmRows = Object.values(rmMapAll)
    .filter((r) => validRmSet.has(r.key))
    .map((r) => {
      // Phòng của RM lấy theo file biên chế (nguồn chuẩn) nếu có, không thì dùng dữ liệu từ
      // chính giao dịch CRM làm dự phòng.
      const rosterPhong = rmToPhong[r.key];
      if (rosterPhong?.maPhong) {
        return { ...r, phong: rosterPhong.maPhong, phongLabel: rosterPhong.tenPhong || r.phongLabel };
      }
      return r;
    });

  // Bước 3: điểm RM tính trực tiếp trên tập đã lọc.
  const rm = scoreRM(validRmRows);

  // Bước 4: điểm Phòng = cộng dồn CHÍNH các RM hợp lệ thuộc phòng đó (không lấy từ dữ liệu thô).
  const phongMap = {};
  validRmRows.forEach((r) => {
    if (!r.phong) return;
    if (!phongMap[r.phong]) phongMap[r.phong] = { key: r.phong, label: r.phongLabel || r.phong, leadGiao: 0, leadChuyenDoi: 0, oppTotal: 0, oppThanhCong: 0, leadTuongTac: 0, oppTuongTac: 0 };
    const p = phongMap[r.phong];
    if (r.phongLabel) p.label = r.phongLabel;
    p.leadGiao += r.leadGiao;
    p.leadChuyenDoi += r.leadChuyenDoi;
    p.oppTotal += r.oppTotal;
    p.oppThanhCong += r.oppThanhCong;
    p.leadTuongTac += r.leadTuongTac;
    p.oppTuongTac += r.oppTuongTac;
  });
  if (roster?.labelMap) {
    Object.keys(phongMap).forEach((k) => {
      if ((!phongMap[k].label || phongMap[k].label === k) && roster.labelMap[k]) phongMap[k].label = roster.labelMap[k];
    });
  }
  const rmCountMap = roster?.rmCountMap || {};
  const phong = scorePhong(Object.values(phongMap), rmCountMap);

  // Bước 5: số liệu Chi nhánh = cộng dồn TOÀN BỘ tập RM hợp lệ (dùng cho thẻ thống kê công khai
  // và làm mốc điểm bình quân/RM ở tab Cảnh báo).
  const summary = validRmRows.reduce(
    (acc, r) => {
      acc.leadGiao += r.leadGiao;
      acc.leadChuyenDoi += r.leadChuyenDoi;
      acc.oppTong += r.oppTotal;
      acc.oppThanhCong += r.oppThanhCong;
      acc.leadTuongTac += r.leadTuongTac;
      acc.oppTuongTac += r.oppTuongTac;
      return acc;
    },
    { leadGiao: 0, leadChuyenDoi: 0, oppTong: 0, oppThanhCong: 0, leadTuongTac: 0, oppTuongTac: 0 }
  );
  summary.tongRM = roster?.meta?.tongRM || 0;

  return { phong, rm, summary };
}

// Gộp nhiều kỳ (lũy kế) — dùng cho chế độ "Lũy kế tất cả các kỳ" ở trang công khai.
// Input là danh sách các bản ghi thidua_data (mỗi bản ghi đã có phong/rm/summary tính sẵn).
export function combineData(list) {
  if (!list.length) return null;

  function combineRaw(field) {
    const map = {};
    list.forEach((d) => {
      (d[field] || []).forEach((r) => {
        if (!map[r.key]) {
          map[r.key] = {
            key: r.key,
            label: r.label,
            phong: r.phong,
            phongLabel: r.phongLabel,
            leadGiao: 0,
            leadTuongTac: 0,
            leadChuyenDoi: 0,
            oppTotal: 0,
            oppTuongTac: 0,
            oppThanhCong: 0,
            soRMList: [],
          };
        }
        const e = map[r.key];
        if (r.label) e.label = r.label;
        if (r.phong) e.phong = r.phong;
        if (r.phongLabel) e.phongLabel = r.phongLabel;
        e.leadGiao += r.leadGiao;
        e.leadTuongTac += r.leadTuongTac;
        e.leadChuyenDoi += r.leadChuyenDoi;
        e.oppTotal += r.oppTotal;
        e.oppTuongTac += r.oppTuongTac;
        e.oppThanhCong += r.oppThanhCong;
        if (field === 'phong' && r.soRM) e.soRMList.push(r.soRM);
      });
    });
    return Object.values(map);
  }

  const rmCombined = combineRaw('rm').map((e) => ({
    ...e,
    diem: +(0.3 * (e.leadTuongTac + e.oppTuongTac) + 0.3 * e.leadChuyenDoi + 0.4 * e.oppThanhCong).toFixed(1),
  }));
  rmCombined.sort((a, b) => b.diem - a.diem);

  const phongCombined = combineRaw('phong').map((e) => {
    const soRM = e.soRMList.length ? Math.round(e.soRMList.reduce((a, b) => a + b, 0) / e.soRMList.length) : 0;
    if (!soRM) return { ...e, soRM: 0, diem: null };
    const diem = 0.3 * ((e.leadTuongTac + e.oppTuongTac) / soRM) + 0.3 * (e.leadChuyenDoi / soRM) + 0.4 * (e.oppThanhCong / soRM);
    return { ...e, soRM, diem: +diem.toFixed(2) };
  });
  phongCombined.sort((a, b) => {
    if (a.diem === null && b.diem === null) return 0;
    if (a.diem === null) return 1;
    if (b.diem === null) return -1;
    return b.diem - a.diem;
  });

  const tongRMList = [];
  const summary = list.reduce(
    (acc, d) => {
      const s = d.summary || {};
      acc.leadGiao += s.leadGiao || 0;
      acc.leadTuongTac += s.leadTuongTac || 0;
      acc.leadChuyenDoi += s.leadChuyenDoi || 0;
      acc.oppTong += s.oppTong || 0;
      acc.oppTuongTac += s.oppTuongTac || 0;
      acc.oppThanhCong += s.oppThanhCong || 0;
      if (s.tongRM) tongRMList.push(s.tongRM);
      return acc;
    },
    { leadGiao: 0, leadTuongTac: 0, leadChuyenDoi: 0, oppTong: 0, oppTuongTac: 0, oppThanhCong: 0 }
  );
  // Số RM biên chế thường ít đổi giữa các tháng liền kề — lấy bình quân các kỳ có dữ liệu
  // thay vì cộng dồn (cộng dồn sẽ đếm trùng cùng một RM nhiều lần qua các tháng).
  summary.tongRM = tongRMList.length ? Math.round(tongRMList.reduce((a, b) => a + b, 0) / tongRMList.length) : 0;

  return { phong: phongCombined, rm: rmCombined, summary };
}

// Điểm bình quân/RM toàn chi nhánh — cùng công thức Mục 6.1 công văn nhưng gộp TOÀN CHI NHÁNH
// (không tách theo phòng), dùng làm mốc so sánh với điểm tuyệt đối của từng RM (Mục 6.2), vì
// hai đại lượng này cùng đơn vị "điểm/1 RM". Dùng cho tab Cảnh báo.
export function computeChiNhanhBenchmark(summary) {
  const soRM = summary?.tongRM || 0;
  if (!soRM) return { diemBinhQuan: 0, soRM: 0 };
  const diemBinhQuan =
    0.3 * (((summary.leadTuongTac || 0) + (summary.oppTuongTac || 0)) / soRM) +
    0.3 * ((summary.leadChuyenDoi || 0) / soRM) +
    0.4 * ((summary.oppThanhCong || 0) / soRM);
  return { diemBinhQuan: +diemBinhQuan.toFixed(2), soRM };
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}
