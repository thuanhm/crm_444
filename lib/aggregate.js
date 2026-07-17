// Logic đọc file Excel CRM1.0 và tính điểm thi đua theo Công văn 7087/TGĐ-NHCT-KHDN5
//
// Cấp RM (cá nhân, Mục 6.2 công văn — không chia cho ai vì đã là đơn vị nhỏ nhất):
//   Điểm RM = 30% x Số Lead/Opp có tương tác + 30% x Số Lead chuyển đổi sang Opp + 40% x Số Opp thành công
//
// Cấp Phòng (Mục 6.1 công văn — công thức có "/RM", tức chia bình quân theo số RM biên chế
// của phòng để so sánh công bằng giữa phòng đông người và phòng ít người):
//   Điểm Phòng = 30% x (Tổng Lead/Opp có tương tác ÷ Số RM) + 30% x (Tổng Lead chuyển đổi sang Opp ÷ Số RM)
//              + 40% x (Tổng Opp thành công ÷ Số RM)
// Số RM của Phòng lấy từ file danh sách biên chế RM theo phòng (trích PeopleSoft), KHÔNG suy ra
// từ số RM có phát sinh Lead/Opp trong kỳ, để đúng bản chất công văn.

export const NOT_ASSIGNED = ['Chờ phân giao', 'Chờ phân giao lại', 'Đang bàn giao'];

// Các tên cột có thể dùng để nhận diện RM trong file danh sách biên chế (PeopleSoft có thể xuất
// với tên cột khác nhau tuỳ đợt trích xuất).
const RM_ID_COLUMNS = ['RM quản lý', 'RM', 'Mã CB', 'Mã cán bộ', 'Mã nhân viên', 'User RM', 'Username', 'User name'];

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

// Đọc file "Danh sách RM biên chế theo phòng" (trích PeopleSoft). Chấp nhận nhiều tên cột RM
// khác nhau — tự nhận diện cột đầu tiên khớp với RM_ID_COLUMNS.
export function rowsFromRosterAOA(aoa) {
  const { headers, rows } = rowsFromAOA(aoa);
  const rmCol = headers.find((h) => RM_ID_COLUMNS.includes(h)) || null;
  return { headers, rows, rmCol };
}

// Đếm số RM biên chế (không trùng) theo từng phòng từ file danh sách biên chế.
export function countRMByPhong(rosterRows, rmCol) {
  const map = {}; // phong -> Set(rmId)
  if (!rmCol) return {};
  rosterRows.forEach((r) => {
    const phong = (r['Tên phòng'] || '').toString().trim();
    const rmId = (r[rmCol] || '').toString().trim();
    if (!phong || !rmId) return;
    if (!map[phong]) map[phong] = new Set();
    map[phong].add(rmId);
  });
  const result = {};
  for (const p in map) result[p] = map[p].size;
  return result;
}

// Tính các chỉ số thô (chưa tính điểm) theo Phòng hoặc theo RM từ 4 file CRM1.0.
export function aggregate(leadStatusRows, oppStatusRows, leadIntRows, oppIntRows, groupField) {
  const map = {};
  function ensure(key) {
    if (!map[key]) {
      map[key] = {
        key,
        leadGiao: 0,
        leadChuyenDoi: 0,
        leadTuongTac: new Set(),
        oppTuongTac: new Set(),
        oppThanhCong: 0,
        oppTotal: 0,
        phongCount: {},
      };
    }
    return map[key];
  }

  leadStatusRows.forEach((r) => {
    const k = (r[groupField] || '').toString().trim();
    if (!k) return;
    const st = (r['Trạng thái'] || '').toString().trim();
    const e = ensure(k);
    if (!NOT_ASSIGNED.includes(st)) e.leadGiao++;
    if (st === 'Chuyển đổi') e.leadChuyenDoi++;
    const ph = (r['Tên phòng'] || '').toString().trim();
    if (groupField === 'RM quản lý' && ph) e.phongCount[ph] = (e.phongCount[ph] || 0) + 1;
  });

  oppStatusRows.forEach((r) => {
    const k = (r[groupField] || '').toString().trim();
    if (!k) return;
    const st = (r['Trạng thái'] || '').toString().trim();
    const e = ensure(k);
    e.oppTotal++;
    if (st === 'Thành công') e.oppThanhCong++;
    const ph = (r['Tên phòng'] || '').toString().trim();
    if (groupField === 'RM quản lý' && ph) e.phongCount[ph] = (e.phongCount[ph] || 0) + 1;
  });

  leadIntRows.forEach((r) => {
    const k = (r[groupField] || '').toString().trim();
    if (!k) return;
    const e = ensure(k);
    const code = (r['Lead code'] || '').toString().trim();
    if (code) e.leadTuongTac.add(code);
  });

  oppIntRows.forEach((r) => {
    const k = (r[groupField] || '').toString().trim();
    if (!k) return;
    const e = ensure(k);
    const code = (r['Opp code'] || '').toString().trim();
    if (code) e.oppTuongTac.add(code);
  });

  return Object.values(map).map((e) => {
    const leadTuongTacN = e.leadTuongTac.size;
    const oppTuongTacN = e.oppTuongTac.size;
    let phong = '';
    if (groupField === 'RM quản lý') {
      let max = -1;
      for (const p in e.phongCount) {
        if (e.phongCount[p] > max) {
          max = e.phongCount[p];
          phong = p;
        }
      }
    }
    return {
      key: e.key,
      phong,
      leadGiao: e.leadGiao,
      leadTuongTac: leadTuongTacN,
      tyLe: e.leadGiao ? +(100 * (leadTuongTacN / e.leadGiao)).toFixed(1) : 0,
      leadChuyenDoi: e.leadChuyenDoi,
      oppTotal: e.oppTotal,
      oppTuongTac: oppTuongTacN,
      oppThanhCong: e.oppThanhCong,
    };
  });
}

// Điểm RM: KHÔNG chia, dùng số tuyệt đối (đúng Mục 6.2 công văn).
export function scoreRM(rmRawRows) {
  return rmRawRows
    .map((r) => ({
      ...r,
      diem: +(0.3 * (r.leadTuongTac + r.oppTuongTac) + 0.3 * r.leadChuyenDoi + 0.4 * r.oppThanhCong).toFixed(1),
    }))
    .sort((a, b) => b.diem - a.diem);
}

// Điểm Phòng: chia bình quân theo Số RM biên chế của phòng (đúng Mục 6.1 công văn).
// Nếu phòng không có trong file biên chế (thiếu dữ liệu), diem = null và đẩy xuống cuối bảng
// thay vì loại bỏ, để admin còn nhìn thấy và bổ sung dữ liệu.
export function scorePhong(phongRawRows, rmCountMap) {
  return phongRawRows
    .map((r) => {
      const soRM = rmCountMap[r.key] || 0;
      if (!soRM) {
        return { ...r, soRM: 0, diem: null };
      }
      const diem =
        0.3 * ((r.leadTuongTac + r.oppTuongTac) / soRM) + 0.3 * (r.leadChuyenDoi / soRM) + 0.4 * (r.oppThanhCong / soRM);
      return { ...r, soRM, diem: +diem.toFixed(2) };
    })
    .sort((a, b) => {
      if (a.diem === null && b.diem === null) return 0;
      if (a.diem === null) return 1;
      if (b.diem === null) return -1;
      return b.diem - a.diem;
    });
}

export function buildSummary(leadStatusRows, oppStatusRows, leadIntRows, oppIntRows, rmCountMap) {
  const tongRM = rmCountMap ? Object.values(rmCountMap).reduce((a, b) => a + b, 0) : 0;
  return {
    leadGiao: leadStatusRows.filter((r) => !NOT_ASSIGNED.includes((r['Trạng thái'] || '').toString().trim())).length,
    leadTong: leadStatusRows.length,
    leadTuongTac: new Set(leadIntRows.map((r) => (r['Lead code'] || '').toString().trim()).filter(Boolean)).size,
    leadChuyenDoi: leadStatusRows.filter((r) => (r['Trạng thái'] || '').toString().trim() === 'Chuyển đổi').length,
    oppTong: oppStatusRows.length,
    oppTuongTac: new Set(oppIntRows.map((r) => (r['Opp code'] || '').toString().trim()).filter(Boolean)).size,
    oppThanhCong: oppStatusRows.filter((r) => (r['Trạng thái'] || '').toString().trim() === 'Thành công').length,
    tongRM,
  };
}

// Gộp nhiều kỳ (lũy kế). Với RM: cộng dồn số tuyệt đối rồi tính lại điểm (không chia).
// Với Phòng: cộng dồn số tuyệt đối, còn "Số RM" lấy bình quân các kỳ có dữ liệu biên chế
// (giả định biên chế ít thay đổi giữa các tháng) rồi tính lại điểm theo bình quân đó.
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
    const diem =
      0.3 * ((e.leadTuongTac + e.oppTuongTac) / soRM) + 0.3 * (e.leadChuyenDoi / soRM) + 0.4 * (e.oppThanhCong / soRM);
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
