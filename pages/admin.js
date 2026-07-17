import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { rowsFromAOA, rowsFromRosterAOA, countRMByPhong, aggregate, scorePhong, scoreRM, buildSummary, monthLabel } from '../lib/aggregate';

const FILE_DEFS = [
  { label: 'Báo cáo trạng thái LEAD', expect: 'Lead code' },
  { label: 'Báo cáo trạng thái OPP', expect: 'Opp code' },
  { label: 'Tiếp cận tương tác LEAD', expect: 'Lead code' },
  { label: 'Tiếp cận tương tác OPP', expect: 'Opp code' },
  { label: 'Danh sách RM biên chế theo phòng (PeopleSoft)', expect: null, roster: true },
];

function readFileAsAOA(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        resolve(aoa);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function MiniTable({ rows, kind }) {
  const nameHeader = kind === 'phong' ? 'Phòng / PGD' : 'Cán bộ (RM)';
  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th style={{ width: 30 }}>#</th>
            <th>{nameHeader}</th>
            {kind === 'phong' && <th>Số RM</th>}
            <th>Lead giao</th>
            <th>Tương tác</th>
            <th>Tỷ lệ</th>
            <th>Lead→Opp</th>
            <th>Opp TC</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td className="rank">{i + 1}</td>
              <td className="name-cell">{r.key}</td>
              {kind === 'phong' && <td className="mono">{r.soRM || '—'}</td>}
              <td className="mono">{r.leadGiao}</td>
              <td className="mono">{r.leadTuongTac + r.oppTuongTac}</td>
              <td className="mono">{r.tyLe}%</td>
              <td className="mono">{r.leadChuyenDoi}</td>
              <td className="mono">{r.oppThanhCong}</td>
              <td className="diem mono">{r.diem === null || r.diem === undefined ? '—' : r.diem}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [monthValue, setMonthValue] = useState(new Date().toISOString().slice(0, 7));
  const [files, setFiles] = useState([null, null, null, null, null]);
  const [processing, setProcessing] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [msg, setMsg] = useState(null); // {type, text}
  const [months, setMonths] = useState([]);
  const fileInputs = [useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((res) => {
        setAuthed(!!res.authed);
        setChecking(false);
        if (res.authed) refreshMonths();
      })
      .catch(() => setChecking(false));
  }, []);

  async function refreshMonths() {
    const r = await fetch('/api/months');
    const res = await r.json();
    setMonths(res.months || []);
  }

  async function doLogin(e) {
    e?.preventDefault();
    setLoginError('');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (r.ok) {
      setAuthed(true);
      refreshMonths();
    } else {
      const res = await r.json().catch(() => ({}));
      setLoginError(res.error || 'Đăng nhập thất bại.');
    }
  }

  async function doLogout() {
    await fetch('/api/logout', { method: 'POST' });
    setAuthed(false);
    setPassword('');
  }

  function onPick(idx, file) {
    const next = [...files];
    next[idx] = file || null;
    setFiles(next);
    setPendingData(null);
    setMsg(null);
  }

  async function processFiles() {
    setMsg(null);
    if (!monthValue) {
      setMsg({ type: 'error', text: 'Vui lòng chọn tháng áp dụng.' });
      return;
    }
    if (files.some((f) => !f)) {
      setMsg({ type: 'error', text: 'Vui lòng tải đủ cả 5 file Excel.' });
      return;
    }
    setProcessing(true);
    try {
      const aoas = await Promise.all(files.map(readFileAsAOA));

      const parsed4 = aoas.slice(0, 4).map((a) => rowsFromAOA(a));
      const roster = rowsFromRosterAOA(aoas[4]);

      const warnings = [];
      parsed4.forEach((p, i) => {
        if (!p.headers.includes(FILE_DEFS[i].expect)) {
          warnings.push(`File #${i + 1} không tìm thấy cột "${FILE_DEFS[i].expect}" — kiểm tra lại đúng loại báo cáo.`);
        }
      });
      if (!roster.headers.includes('Tên phòng')) {
        warnings.push('File #5 không tìm thấy cột "Tên phòng" — kiểm tra lại file danh sách biên chế.');
      }
      if (!roster.rmCol) {
        warnings.push(
          'File #5 không nhận diện được cột mã RM (thử các tên: RM quản lý, RM, Mã CB, Mã nhân viên, User RM...). Điểm Phòng sẽ không tính được cho đến khi bổ sung.'
        );
      }

      const [leadStatusRows, oppStatusRows, leadIntRows, oppIntRows] = parsed4.map((p) => p.rows);

      const rmCountMap = countRMByPhong(roster.rows, roster.rmCol);
      const phongRaw = aggregate(leadStatusRows, oppStatusRows, leadIntRows, oppIntRows, 'Tên phòng');
      const rmRaw = aggregate(leadStatusRows, oppStatusRows, leadIntRows, oppIntRows, 'RM quản lý');

      const phong = scorePhong(phongRaw, rmCountMap);
      const rm = scoreRM(rmRaw);
      const summary = buildSummary(leadStatusRows, oppStatusRows, leadIntRows, oppIntRows, rmCountMap);

      const phongMissingHeadcount = phong.filter((p) => !p.soRM).length;
      if (phongMissingHeadcount > 0) {
        warnings.push(
          `${phongMissingHeadcount} phòng có phát sinh Lead/Opp nhưng không có trong danh sách biên chế RM — điểm Phòng của các đơn vị này hiển thị "—".`
        );
      }

      setPendingData({ month: monthValue, phong, rm, summary });

      if (warnings.length) setMsg({ type: 'error', text: warnings.join(' ') });
      else
        setMsg({
          type: 'success',
          text: `Đã xử lý thành công ${leadStatusRows.length} Lead và ${oppStatusRows.length} Opp, ${Object.values(
            rmCountMap
          ).reduce((a, b) => a + b, 0)} RM biên chế. Kiểm tra bảng xem trước rồi bấm "Lưu vào bảng xếp hạng".`,
        });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Có lỗi khi đọc file: ' + err.message + '. Kiểm tra lại định dạng file Excel.' });
    } finally {
      setProcessing(false);
    }
  }

  async function saveMonth() {
    if (!pendingData) return;
    const key = pendingData.month;
    const exists = months.find((m) => m.key === key);
    if (exists && !confirm(`Kỳ ${monthLabel(key)} đã có dữ liệu. Bạn có muốn ghi đè không?`)) return;

    const r = await fetch(`/api/data/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingData),
    });
    if (r.ok) {
      setMsg({ type: 'success', text: `Đã lưu dữ liệu kỳ ${monthLabel(key)} vào bảng xếp hạng công khai.` });
      setPendingData(null);
      setFiles([null, null, null, null, null]);
      fileInputs.forEach((ref) => ref.current && (ref.current.value = ''));
      refreshMonths();
    } else {
      const res = await r.json().catch(() => ({}));
      setMsg({ type: 'error', text: res.error || 'Lưu thất bại.' });
    }
  }

  async function removeMonth(key) {
    if (!confirm(`Xóa dữ liệu kỳ ${monthLabel(key)}? Hành động này không thể hoàn tác.`)) return;
    const r = await fetch(`/api/data/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (r.ok) refreshMonths();
    else alert('Xóa thất bại.');
  }

  if (checking) return null;

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="eyebrow">VietinBank · Chi nhánh Bắc Nghệ An</div>
            <div className="title">Quản trị dữ liệu thi đua CRM1.0</div>
            <div className="subtitle">Tải số liệu Excel hằng tháng, hệ thống tự tính điểm theo Công văn 7087.</div>
          </div>
          <div className="nav">
            <Link href="/">Bảng xếp hạng</Link>
            <Link href="/admin" className="active">
              Quản trị
            </Link>
          </div>
        </div>
      </div>

      <div className="wrap">
        {!authed ? (
          <form className="login-box" onSubmit={doLogin}>
            <div style={{ fontSize: 30 }}>🔒</div>
            <h3>Đăng nhập quản trị</h3>
            <p>Nhập mật khẩu quản trị để tải lên số liệu CRM1.0 hằng tháng.</p>
            <input
              type="password"
              placeholder="Mật khẩu quản trị"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn" style={{ width: '100%' }} type="submit">
              Đăng nhập
            </button>
            {loginError && <div className="msg error">{loginError}</div>}
          </form>
        ) : (
          <>
            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className="field-label">Đăng nhập với vai trò</span>
                <strong>Trưởng phòng Kế hoạch Tổng hợp</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={doLogout}>
                  Đăng xuất
                </button>
              </div>
            </div>

            <div className="admin-grid">
              <div className="upload-panel">
                <h3>Tải số liệu kỳ mới</h3>
                <div className="hint">
                  Chọn tháng áp dụng và tải đủ 5 file Excel: 4 file xuất từ hệ thống CRM1.0 và 1 file danh sách biên
                  chế RM theo phòng (trích PeopleSoft). Điểm RM tính theo số tuyệt đối: 30% × Lead/Opp có tương tác +
                  30% × Lead chuyển đổi sang Opp + 40% × Opp thành công. Điểm Phòng chia bình quân theo số RM biên chế
                  của phòng để so sánh công bằng giữa các phòng có quy mô khác nhau, đúng công thức Mục 6.1 Công văn
                  7087.
                </div>

                <div>
                  <span className="field-label">Tháng áp dụng</span>
                  <input
                    type="month"
                    style={{ width: '100%' }}
                    value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  {FILE_DEFS.map((def, i) => (
                    <div className="file-row" key={i}>
                      <div className="tag">{i + 1}</div>
                      <div className="info">
                        <div className="t">{def.label}</div>
                        <div className="s">{files[i] ? files[i].name : 'Chưa chọn file'}</div>
                      </div>
                      <label className="pick" htmlFor={`f${i}`}>
                        Chọn file
                      </label>
                      <input
                        ref={fileInputs[i]}
                        id={`f${i}`}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => onPick(i, e.target.files[0])}
                      />
                      <div className={`status ${files[i] ? 'ok' : ''}`}>{files[i] ? 'Sẵn sàng' : '—'}</div>
                    </div>
                  ))}
                </div>

                <div className="actions-row">
                  <button className="btn" onClick={processFiles} disabled={processing}>
                    {processing ? 'Đang xử lý...' : 'Xử lý số liệu'}
                  </button>
                  <button className="btn secondary" onClick={saveMonth} disabled={!pendingData}>
                    Lưu vào bảng xếp hạng
                  </button>
                </div>

                {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

                {pendingData && (
                  <div style={{ marginTop: 18 }}>
                    <div className="section-title">
                      <h2 style={{ fontSize: 14 }}>Xem trước — Top 5 Phòng</h2>
                    </div>
                    <MiniTable rows={pendingData.phong.slice(0, 5)} kind="phong" />
                    <div className="section-title">
                      <h2 style={{ fontSize: 14 }}>Xem trước — Top 5 Cán bộ</h2>
                    </div>
                    <MiniTable rows={pendingData.rm.slice(0, 5)} kind="rm" />
                  </div>
                )}
              </div>

              <div className="months-list">
                <h3>Các kỳ đã có số liệu</h3>
                {!months.length ? (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa có dữ liệu nào được tải lên.</div>
                ) : (
                  months
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div className="month-item" key={m.key}>
                        <div>
                          <div className="m">{m.label}</div>
                          <div className="r">Kỳ: {m.key}</div>
                        </div>
                        <button
                          className="btn danger"
                          style={{ padding: '6px 10px', fontSize: 11.5 }}
                          onClick={() => removeMonth(m.key)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <footer>Nội bộ VietinBank Chi nhánh Bắc Nghệ An · Dữ liệu phục vụ chương trình thi đua CRM1.0 Transformation 2026</footer>
    </>
  );
}
