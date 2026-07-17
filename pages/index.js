import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

function rankBadge(i) {
  if (i === 0) return <span className="medal">🥇</span>;
  if (i === 1) return <span className="medal">🥈</span>;
  if (i === 2) return <span className="medal">🥉</span>;
  return i + 1;
}

function DataTable({ rows, kind }) {
  if (!rows.length) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="big">—</div>
          Chưa có dữ liệu phù hợp.
        </div>
      </div>
    );
  }
  const nameHeader = kind === 'phong' ? 'Phòng / PGD' : 'Cán bộ (RM)';
  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th>
            <th>{nameHeader}</th>
            {kind === 'rm' && <th>Phòng</th>}
            {kind === 'phong' && <th>Số RM</th>}
            <th>Lead giao</th>
            <th>Lead/Opp có tương tác</th>
            <th>Lead → Opp</th>
            <th>Opp thành công</th>
            <th>Điểm thi đua</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td className="rank">{r.diem === null ? '—' : rankBadge(i)}</td>
              <td className="name-cell">{kind === 'phong' ? r.label || r.key : r.key}</td>
              {kind === 'rm' && <td>{r.phongLabel || r.phong || '—'}</td>}
              {kind === 'phong' && <td className="mono">{r.soRM || '—'}</td>}
              <td className="mono">{r.leadGiao.toLocaleString('vi-VN')}</td>
              <td className="mono">{(r.leadTuongTac + r.oppTuongTac).toLocaleString('vi-VN')}</td>
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

export default function Home() {
  const [months, setMonths] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/months')
      .then((r) => r.json())
      .then((res) => {
        const list = res.months || [];
        setMonths(list);
        if (list.length) setSelected(list[list.length - 1].key);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/data/${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!data) return { phong: [], rm: [] };
    const q = query.trim().toLowerCase();
    const filt = (arr) =>
      q
        ? arr.filter(
            (r) =>
              r.key.toLowerCase().includes(q) ||
              (r.label || '').toLowerCase().includes(q) ||
              (r.phong || '').toLowerCase().includes(q) ||
              (r.phongLabel || '').toLowerCase().includes(q)
          )
        : arr;
    return { phong: filt(data.phong || []), rm: filt(data.rm || []) };
  }, [data, query]);

  const s = data?.summary || {};
  const tyLeChung = s.leadGiao ? ((100 * s.leadTuongTac) / s.leadGiao).toFixed(1) : '0.0';

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="eyebrow">VietinBank · Chi nhánh Bắc Nghệ An</div>
            <div className="title">CRM1.0 Transformation 2026 — Đổi hành vi, tăng hiệu quả</div>
            <div className="subtitle">
              Bảng điểm thi đua triển khai CRM 1.0 — cập nhật theo từng kỳ tháng, tính theo
              Phòng/PGD và cán bộ RM.
            </div>
          </div>
          <div className="nav">
            <Link href="/" className="active">
              Bảng xếp hạng
            </Link>
            <Link href="/canh-bao">Cảnh báo</Link>
            <Link href="/admin">Quản trị</Link>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="toolbar">
          <div>
            <span className="field-label">Kỳ xét thưởng</span>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {!months.length && <option value="">Chưa có dữ liệu</option>}
              {months
                .slice()
                .reverse()
                .map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              {months.length > 0 && <option value="__all__">Lũy kế tất cả các kỳ</option>}
            </select>
          </div>
          <div className="topright" style={{ marginLeft: 'auto' }}>
            <div className="search-box">
              <span className="field-label">Tìm phòng / cán bộ</span>
              <input
                type="text"
                placeholder="Nhập tên phòng hoặc mã RM..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="panel">
            <div className="empty-state">Đang tải dữ liệu...</div>
          </div>
        ) : !selected || !data ? (
          <div className="panel">
            <div className="empty-state">
              <div className="big">📊</div>
              Chưa có dữ liệu kỳ nào được tải lên.
              <br />
              Vui lòng liên hệ Phòng Kế hoạch Tổng hợp để cập nhật.
            </div>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="num">{(s.leadGiao || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Lead đã phân giao RM</div>
              </div>
              <div className="stat-card">
                <div className="num">{(s.leadTuongTac || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Lead có tương tác</div>
              </div>
              <div className="stat-card accent">
                <div className="num">{tyLeChung}%</div>
                <div className="lbl">Tỷ lệ tiếp cận chung</div>
              </div>
              <div className="stat-card">
                <div className="num">{(s.leadChuyenDoi || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Lead chuyển đổi → Opp</div>
              </div>
              <div className="stat-card">
                <div className="num">{(s.oppThanhCong || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Opp thành công</div>
              </div>
              <div className="stat-card">
                <div className="num">{(s.tongRM || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Tổng số RM</div>
              </div>
            </div>

            <div className="section-title">
              <h2>Xếp hạng theo Phòng / PGD</h2>
              <span className="count-pill">{filtered.phong.length}</span>
            </div>
            <DataTable rows={filtered.phong} kind="phong" />

            <div className="section-title">
              <h2>Xếp hạng theo Cán bộ (RM)</h2>
              <span className="count-pill">{filtered.rm.length}</span>
            </div>
            <DataTable rows={filtered.rm} kind="rm" />
          </>
        )}
      </div>

      <footer>VietinBank Chi nhánh Bắc Nghệ An · Dữ liệu phục vụ chương trình thi đua CRM1.0 Transformation 2026</footer>
    </>
  );
}
