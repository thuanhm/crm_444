// Logic đọc file Excel CRM1.0 và tính điểm thi đua theo Công văn 7087/TGĐ-NHCT-KHDN5
//
// THIẾT KẾ QUAN TRỌNG: mỗi trong 5 file được xử lý ĐỘC LẬP thành một "partial" (phần dữ liệu
// đã tổng hợp theo Phòng/RM, KHÔNG chứa tên khách hàng/CIF/MST). Các partial này được lưu lại
// theo từng file, để khi admin chỉ cần sửa 1 file, hệ thống lấy lại 4 partial cũ của các file
// còn lại (không cần tải lại), rồi gộp cả 5 partial thành kết quả cuối cùng.
//
// Cấp RM (cá nhân, Mục 6.2 công văn — không chia cho ai vì đã là đơn vị nhỏ nhất):
//   Điểm RM = 30% x Số Lead/Opp có tương tác + 30% x Số Lead chuyển đổi sang Opp + 40% x Số Opp thành công
//
// Cấp Phòng (Mục 6.1 công văn — công thức có "/RM", tức chia bình quân theo số RM biên chế
// của phòng để so sánh công bằng giữa phòng đông người và phòng ít người):
//   Điểm Phòng = 30% x (Tổng Lead/Opp có tương tác ÷ Số RM) + 30% x (Tổng Lead chuyển đổi sang Opp ÷ Số RM)
//              + 40% x (Tổng Opp thành công ÷ Số RM)

export const NOT_ASSIGNED = ['Chờ phân giao', 'Chờ phân giao lại', 'Đang bàn giao'];

const RM_ID_COLUMNS = ['RM quản lý', 'RM', 'Mã CB', 'Mã cán bộ', 'Mã nhân viên', 'User RM', 'Username', 'User name'];

// Nhãn hiển thị + thứ tự cố định cho 5 loại file.
export const FILE_TYPES = [
  { type: 'lead_status', label: 'Báo cáo trạng thái LEAD', expect: 'Lead code' },
  { type: 'opp_status', label: 'Báo cáo trạng thái OPP', expect: 'Opp code' },
  { type: 'lead_int', label: 'Tiếp cận tương tác LEAD', expect: 'Lead code' },
  { type: 'opp_int', label: 'Tiếp cận tương tác OPP', expect: 'Opp code' },
  { type: 'roster', label: 'Danh sách RM biên chế theo phòng (PeopleSoft)', expect: null, roster: true },
];

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

export function rowsFromRosterAOA(aoa) {
  const { headers, rows } = rowsFromAOA(aoa);
  const rmCol = headers.find((h) => RM_ID_COLUMNS.includes(h)) || null;
  return { headers, rows, rmCol };
}

function trim(v) {
  return (v || '').toString().trim();
}

// ===== Xây dựng "partial" (đã ẩn danh, không còn tên KH/CIF/MST) cho từng loại file =====

export function buildLeadStatusPartial(rows) {
  const phongMap = {};
  const rmMap = {};
  let leadGiaoTotal = 0;
  let leadChuyenDoiTotal = 0;
  rows.forEach((r) => {
    const phong = trim(r['Tên phòng']);
    const rm = trim(r['RM quản lý']);
    const st = trim(r['Trạng thái']);
    const giao = NOT_ASSIGNED.includes(st) ? 0 : 1;
    const chuyen = st === 'Chuyển đổi' ? 1 : 0;
    leadGiaoTotal += giao;
    leadChuyenDoiTotal += chuyen;
    if (phong) {
      if (!phongMap[phong]) phongMap[phong] = { key: phong, leadGiao: 0, leadChuyenDoi: 0 };
      phongMap[phong].leadGiao += giao;
      phongMap[phong].leadChuyenDoi += chuyen;
    }
    if (rm) {
      if (!rmMap[rm]) rmMap[rm] = { key: rm, phong, leadGiao: 0, leadChuyenDoi: 0 };
      if (phong) rmMap[rm].phong = phong;
      rmMap[rm].leadGiao += giao;
      rmMap[rm].leadChuyenDoi += chuyen;
    }
  });
  return {
    meta: { leadTong: rows.length, leadGiao: leadGiaoTotal, leadChuyenDoi: leadChuyenDoiTotal },
    phong: Object.values(phongMap),
    rm: Object.values(rmMap),
  };
}

export function buildOppStatusPartial(rows) {
  const phongMap = {};
  const rmMap = {};
  let oppThanhCongTotal = 0;
  rows.forEach((r) => {
    const phong = trim(r['Tên phòng']);
    const rm = trim(r['RM quản lý']);
    const st = trim(r['Trạng thái']);
    const tc = st === 'Thành công' ? 1 : 0;
    oppThanhCongTotal += tc;
    if (phong) {
      if (!phongMap[phong]) phongMap[phong] = { key: phong, oppTotal: 0, oppThanhCong: 0 };
      phongMap[phong].oppTotal += 1;
      phongMap[phong].oppThanhCong += tc;
    }
    if (rm) {
      if (!rmMap[rm]) rmMap[rm] = { key: rm, phong, oppTotal: 0, oppThanhCong: 0 };
      if (phong) rmMap[rm].phong = phong;
      rmMap[rm].oppTotal += 1;
      rmMap[rm].oppThanhCong += tc;
    }
  });
  return {
    meta: { oppTong: rows.length, oppThanhCong: oppThanhCongTotal },
    phong: Object.values(phongMap),
    rm: Object.values(rmMap),
  };
}

export function buildLeadIntPartial(rows) {
  const phongMap = {}; // phong -> Set(code)
  const rmMap = {}; // rm -> { phong, set }
  const globalSet = new Set();
  rows.forEach((r) => {
    const phong = trim(r['Tên phòng']);
    const rm = trim(r['RM quản lý']);
    const code = trim(r['Lead code']);
    if (!code) return;
    globalSet.add(code);
    if (phong) {
      if (!phongMap[phong]) phongMap[phong] = new Set();
      phongMap[phong].add(code);
    }
    if (rm) {
      if (!rmMap[rm]) rmMap[rm] = { phong, set: new Set() };
      if (phong) rmMap[rm].phong = phong;
      rmMap[rm].set.add(code);
    }
  });
  return {
    meta: { leadTuongTac: globalSet.size },
    phong: Object.entries(phongMap).map(([key, set]) => ({ key, leadTuongTac: set.size })),
    rm: Object.entries(rmMap).map(([key, v]) => ({ key, phong: v.phong, leadTuongTac: v.set.size })),
  };
}

export function buildOppIntPartial(rows) {
  const phongMap = {};
  const rmMap = {};
  const globalSet = new Set();
  rows.forEach((r) => {
    const phong = trim(r['Tên phòng']);
    const rm = trim(r['RM quản lý']);
    const code = trim(r['Opp code']);
    if (!code) return;
    globalSet.add(code);
    if (phong) {
      if (!phongMap[phong]) phongMap[phong] = new Set();
      phongMap[phong].add(code);
    }
    if (rm) {
      if (!rmMap[rm]) rmMap[rm] = { phong, set: new Set() };
      if (phong) rmMap[rm].phong = phong;
      rmMap[rm].set.add(code);
    }
  });
  return {
    meta: { oppTuongTac: globalSet.size },
    phong: Object.entries(phongMap).map(([key, set]) => ({ key, oppTuongTac: set.size })),
    rm: Object.entries(rmMap).map(([key, v]) => ({ key, phong: v.phong, oppTuongTac: v.set.size })),
  };
}

export function buildRosterPartial(rosterRows, rmCol) {
  const map = {}; // phong -> Set(rmId)
  if (rmCol) {
    rosterRows.forEach((r) => {
      const phong = trim(r['Tên phòng']);
      const rmId = trim(r[rmCol]);
      if (!phong || !rmId) return;
      if (!map[phong]) map[phong] = new Set();
      map[phong].add(rmId);
    });
  }
  const rmCountMap = {};
  let tongRM = 0;
  for (const p in map) {
    rmCountMap[p] = map[p].size;
    tongRM += map[p].size;
  }
  return { meta: { tongRM }, rmCountMap };
}

// Xây dựng partial cho một loại file bất kỳ từ AOA (mảng-2-chiều đọc từ Excel).
export function buildPartialFromAOA(fileType, aoa) {
  if (fileType === 'roster') {
    const { rows, rmCol } = rowsFromRosterAOA(aoa);
    return buildRosterPartial(rows, rmCol);
  }
  const { rows } = rowsFromAOA(aoa);
  if (fileType === 'lead_status') return buildLeadStatusPartial(rows);
  if (fileType === 'opp_status') return buildOppStatusPartial(rows);
  if (fileType === 'lead_int') return buildLeadIntPartial(rows);
  if (fileType === 'opp_int') return buildOppIntPartial(rows);
  throw new Error('Loại file không hợp lệ: ' + fileType);
}

// Kiểm tra nhanh xem AOA có đúng cấu trúc mong đợi không (dùng để cảnh báo sớm cho admin).
export function validateAOA(fileType, aoa) {
  const def = FILE_TYPES.find((f) => f.type === fileType);
  if (fileType === 'roster') {
    const { headers, rmCol } = rowsFromRosterAOA(aoa);
    const warnings = [];
    if (!headers.includes('Tên phòng')) warnings.push('Không tìm thấy cột "Tên phòng".');
    if (!rmCol) warnings.push('Không nhận diện được cột mã RM (RM quản lý, RM, Mã CB, Mã nhân viên...).');
    return warnings;
  }
  const { headers } = rowsFromAOA(aoa);
  const warnings = [];
  if (!headers.includes(def.expect)) warnings.push(`Không tìm thấy cột "${def.expect}".`);
  return warnings;
}

// Điểm RM: KHÔNG chia, dùng số tuyệt đối (đúng Mục 6.2 công văn).
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

// Gộp 5 partial (đã tính sẵn hoặc lấy lại từ lần tải trước) thành kết quả cuối cùng
// (phong, rm, summary) — giống hệt như tính từ 5 file gốc cùng lúc, nhưng không cần có
// đủ 5 file trong cùng một lượt xử lý.
export function combinePartials(parts) {
  const phongMap = {};
  const rmMap = {};

  function ensurePhong(k) {
    if (!phongMap[k]) phongMap[k] = { key: k, leadGiao: 0, leadChuyenDoi: 0, oppTotal: 0, oppThanhCong: 0, leadTuongTac: 0, oppTuongTac: 0 };
    return phongMap[k];
  }
  function ensureRm(k, phong) {
    if (!rmMap[k]) rmMap[k] = { key: k, phong: phong || '', leadGiao: 0, leadChuyenDoi: 0, oppTotal: 0, oppThanhCong: 0, leadTuongTac: 0, oppTuongTac: 0 };
    if (phong) rmMap[k].phong = phong;
    return rmMap[k];
  }

  const leadStatus = parts.lead_status;
  const oppStatus = parts.opp_status;
  const leadInt = parts.lead_int;
  const oppInt = parts.opp_int;
  const roster = parts.roster;

  (leadStatus?.phong || []).forEach((r) => {
    const e = ensurePhong(r.key);
    e.leadGiao += r.leadGiao;
    e.leadChuyenDoi += r.leadChuyenDoi;
  });
  (leadStatus?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong);
    e.leadGiao += r.leadGiao;
    e.leadChuyenDoi += r.leadChuyenDoi;
  });

  (oppStatus?.phong || []).forEach((r) => {
    const e = ensurePhong(r.key);
    e.oppTotal += r.oppTotal;
    e.oppThanhCong += r.oppThanhCong;
  });
  (oppStatus?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong);
    e.oppTotal += r.oppTotal;
    e.oppThanhCong += r.oppThanhCong;
  });

  (leadInt?.phong || []).forEach((r) => {
    const e = ensurePhong(r.key);
    e.leadTuongTac += r.leadTuongTac;
  });
  (leadInt?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong);
    e.leadTuongTac += r.leadTuongTac;
  });

  (oppInt?.phong || []).forEach((r) => {
    const e = ensurePhong(r.key);
    e.oppTuongTac += r.oppTuongTac;
  });
  (oppInt?.rm || []).forEach((r) => {
    const e = ensureRm(r.key, r.phong);
    e.oppTuongTac += r.oppTuongTac;
  });

  Object.values(phongMap).forEach((e) => {
    e.tyLe = e.leadGiao ? +(100 * (e.leadTuongTac / e.leadGiao)).toFixed(1) : 0;
  });
  Object.values(rmMap).forEach((e) => {
    e.tyLe = e.leadGiao ? +(100 * (e.leadTuongTac / e.leadGiao)).toFixed(1) : 0;
  });

  const rmCountMap = roster?.rmCountMap || {};
  const phong = scorePhong(Object.values(phongMap), rmCountMap);
  const rm = scoreRM(Object.values(rmMap));

  const summary = {
    leadGiao: leadStatus?.meta?.leadGiao || 0,
    leadTong: leadStatus?.meta?.leadTong || 0,
    leadTuongTac: leadInt?.meta?.leadTuongTac || 0,
    leadChuyenDoi: leadStatus?.meta?.leadChuyenDoi || 0,
    oppTong: oppStatus?.meta?.oppTong || 0,
    oppTuongTac: oppInt?.meta?.oppTuongTac || 0,
    oppThanhCong: oppStatus?.meta?.oppThanhCong || 0,
    tongRM: roster?.meta?.tongRM || 0,
  };

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
            phong: r.phong,
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
        e.leadGiao += r.leadGiao;
        e.leadTuongTac += r.leadTuongTac;
        e.leadChuyenDoi += r.leadChuyenDoi;
        e.oppTotal += r.oppTotal;
        e.oppTuongTac += r.oppTuongTac;
        e.oppThanhCong += r.oppThanhCong;
        if (r.phong) e.phong = r.phong;
        if (field === 'phong' && r.soRM) e.soRMList.push(r.soRM);
      });
    });
    return Object.values(map).map((e) => {
      e.tyLe = e.leadGiao ? +(100 * (e.leadTuongTac / e.leadGiao)).toFixed(1) : 0;
      return e;
    });
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

  const summary = list.reduce(
    (acc, d) => {
      const s = d.summary || {};
      acc.leadGiao += s.leadGiao || 0;
      acc.leadTong += s.leadTong || 0;
      acc.leadTuongTac += s.leadTuongTac || 0;
      acc.leadChuyenDoi += s.leadChuyenDoi || 0;
      acc.oppTong += s.oppTong || 0;
      acc.oppTuongTac += s.oppTuongTac || 0;
      acc.oppThanhCong += s.oppThanhCong || 0;
      return acc;
    },
    { leadGiao: 0, leadTong: 0, leadTuongTac: 0, leadChuyenDoi: 0, oppTong: 0, oppTuongTac: 0, oppThanhCong: 0 }
  );

  return { phong: phongCombined, rm: rmCombined, summary };
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}
