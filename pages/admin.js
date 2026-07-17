import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FILE_TYPES, buildPartialFromAOA, validateAOA, combinePartials, monthLabel, PARTIAL_SCHEMA_VERSION } from '../lib/aggregate';

function isUsable(existing) {
  return !!existing && existing.data?.schemaVersion === PARTIAL_SCHEMA_VERSION;
}

// Nạp thư viện xlsx (~500KB) chỉ khi admin thực sự bắt đầu xử lý file, thay vì tải sẵn ngay khi
// vào trang (kể cả trước khi đăng nhập) — giảm đáng kể dung lượng JS ban đầu của trang quản trị.
let xlsxModulePromise = null;
function loadXLSX() {
  if (!xlsxModulePromise) xlsxModulePromise = import('xlsx');
  return xlsxModulePromise;
}

function readFileAsAOA(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await loadXLSX();
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

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
            <th>Số lượng tương tác</th>
            <th>Lead→Opp</th>
            <th>Opp TC</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td className="rank">{i + 1}</td>
              <td className="name-cell">{kind === 'phong' ? r.label || r.key : r.key}</td>
              {kind === 'phong' && <td className="mono">{r.soRM || '—'}</td>}
              <td className="mono">{r.leadGiao}</td>
              <td className="mono">{r.leadTuongTac + r.oppTuongTac}</td>
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
  const [existingPartials, setExistingPartials] = useState({}); // { [fileType]: {data, uploadedAt} }
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingData, setPendingData] = useState(null); // { phong, rm, summary, changedPartials }
  const [msg, setMsg] = useState(null);
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

  useEffect(() => {
    if (!authed || !monthValue) return;
    loadExistingPartials(monthValue);
    setFiles([null, null, null, null, null]);
    setPendingData(null);
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue, authed]);

  async function loadExistingPartials(key) {
    setLoadingExisting(true);
    try {
      const r = await fetch(`/api/partials/${encodeURIComponent(key)}`);
      const res = await r.json();
      setExistingPartials(res.partials || {});
    } catch (err) {
      setExistingPartials({});
    } finally {
      setLoadingExisting(false);
    }
  }

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

    const missing = [];
    FILE_TYPES.forEach((def, i) => {
      if (!files[i] && !isUsable(existingPartials[def.type])) missing.push(def.label);
    });
    if (missing.length) {
      setMsg({
        type: 'error',
        text: `Thiếu dữ liệu cho: ${missing.join(', ')}. Đây là các file chưa từng tải cho kỳ này, hoặc đã tải từ trước khi hệ thống đổi cách đối chiếu theo mã phòng — cần chọn lại file.`,
      });
      return;
    }

    setProcessing(true);
    try {
      const warnings = [];
      const parts = {};
      const changedPartials = {};

      for (let i = 0; i < FILE_TYPES.length; i++) {
        const def = FILE_TYPES[i];
        if (files[i]) {
          const aoa = await readFileAsAOA(files[i]);
          const w = validateAOA(def.type, aoa);
          if (w.length) warnings.push(`File "${def.label}": ${w.join(' ')}`);
          const partial = buildPartialFromAOA(def.type, aoa);
          parts[def.type] = partial;
          changedPartials[def.type] = partial;
        } else {
          parts[def.type] = existingPartials[def.type].data;
        }
      }

      const combined = combinePartials(parts);
      const phongMissingHeadcount = combined.phong.filter((p) => !p.soRM).length;
      if (phongMissingHeadcount > 0) {
        warnings.push(
          `${phongMissingHeadcount} phòng có phát sinh Lead/Opp nhưng không có trong danh sách biên chế RM — điểm Phòng của các đơn vị này hiển thị "—".`
        );
      }

      setPendingData({ ...combined, changedPartials });

      if (warnings.length) setMsg({ type: 'error', text: warnings.join(' ') });
      else if (Object.keys(changedPartials).length === 0)
        setMsg({ type: 'success', text: 'Không có file nào thay đổi so với dữ liệu đã lưu — vẫn có thể bấm Lưu để cập nhật lại điểm.' });
      else
        setMsg({
          type: 'success',
          text: `Đã xử lý xong ${Object.keys(changedPartials).length}/5 file vừa chọn (các file còn lại dùng dữ liệu đã lưu trước đó). Kiểm tra bảng xem trước rồi bấm "Lưu vào bảng xếp hạng".`,
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
    const key = monthValue;
    const isNewMonth = !months.find((m) => m.key === key);
    if (!isNewMonth && !confirm(`Kỳ ${monthLabel(key)} đã có dữ liệu. Lưu sẽ cập nhật điểm mới nhất. Tiếp tục?`)) return;

    try {
      // Lưu từng partial đã thay đổi trước (để lần sau còn tái sử dụng được).
      for (const [fileType, partial] of Object.entries(pendingData.changedPartials)) {
        const r = await fetch(`/api/partials/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileType, partial }),
        });
        if (!r.ok) throw new Error('Lưu partial thất bại: ' + fileType);
      }

      // Lưu kết quả cuối cùng (phong/rm/summary) để hiển thị công khai.
      const r2 = await fetch(`/api/data/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phong: pendingData.phong, rm: pendingData.rm, summary: pendingData.summary }),
      });
      if (!r2.ok) {
        const res = await r2.json().catch(() => ({}));
        throw new Error(res.error || 'Lưu thất bại.');
      }

      setMsg({ type: 'success', text: `Đã lưu dữ liệu kỳ ${monthLabel(key)} vào bảng xếp hạng công khai.` });
      setPendingData(null);
      setFiles([null, null, null, null, null]);
      fileInputs.forEach((ref) => ref.current && (ref.current.value = ''));
      await loadExistingPartials(key);
      refreshMonths();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Lưu thất bại.' });
    }
  }

  async function removeMonth(key) {
    if (!confirm(`Xóa dữ liệu kỳ ${monthLabel(key)}? Hành động này không thể hoàn tác (bao gồm cả dữ liệu từng file đã lưu).`)) return;
    const r = await fetch(`/api/data/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (r.ok) {
      refreshMonths();
      if (key === monthValue) loadExistingPartials(key);
    } else alert('Xóa thất bại.');
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
            <Link href="/canh-bao">Cảnh báo</Link>
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
                <h3>Tải số liệu kỳ</h3>
                <div className="hint">
                  Chọn tháng áp dụng, rồi tải từng file cần cập nhật. <strong>Không bắt buộc chọn đủ 5 file mỗi lần</strong> —
                  nếu một file đã từng tải cho kỳ này, bấm "Xử lý số liệu" mà không chọn lại file đó, hệ thống sẽ tự
                  dùng dữ liệu đã lưu trước. Chỉ khi tạo kỳ hoàn toàn mới mới cần đủ cả 5 file lần đầu.
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
                  {FILE_TYPES.map((def, i) => {
                    const existing = existingPartials[def.type];
                    const usable = isUsable(existing);
                    const outdated = existing && !usable;
                    const hasNewFile = !!files[i];
                    let statusText = '—';
                    let statusOk = false;
                    if (hasNewFile) {
                      statusText = 'File mới';
                      statusOk = true;
                    } else if (usable) {
                      statusText = `Đã có (${formatDateTime(existing.uploadedAt)})`;
                      statusOk = true;
                    } else if (outdated) {
                      statusText = 'Dữ liệu cũ — cần tải lại';
                      statusOk = false;
                    } else if (loadingExisting) {
                      statusText = 'Đang kiểm tra...';
                    } else {
                      statusText = 'Chưa có, bắt buộc chọn';
                    }
                    return (
                      <div className="file-row" key={def.type}>
                        <div className="tag">{i + 1}</div>
                        <div className="info">
                          <div className="t">{def.label}</div>
                          <div className="s">
                            {hasNewFile
                              ? files[i].name
                              : outdated
                              ? 'File này được tải từ trước khi hệ thống đổi cách đối chiếu theo mã phòng — chọn lại file gốc để cập nhật'
                              : usable
                              ? 'Dùng lại dữ liệu đã lưu, hoặc chọn file mới để thay thế'
                              : 'Chưa chọn file'}
                          </div>
                        </div>
                        <label className="pick" htmlFor={`f${i}`}>
                          {existing ? 'Thay file' : 'Chọn file'}
                        </label>
                        <input
                          ref={fileInputs[i]}
                          id={`f${i}`}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => onPick(i, e.target.files[0])}
                        />
                        <div className={`status ${statusOk ? 'ok' : outdated ? 'warn' : ''}`}>{statusText}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="actions-row">
                  <button className="btn" onClick={processFiles} disabled={processing || loadingExisting}>
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
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => setMonthValue(m.key)}>
                            Sửa
                          </button>
                          <button
                            className="btn danger"
                            style={{ padding: '6px 10px', fontSize: 11.5 }}
                            onClick={() => removeMonth(m.key)}
                          >
                            Xóa
                          </button>
                        </div>
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
