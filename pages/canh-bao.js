import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { computeChiNhanhBenchmark } from '../lib/aggregate';

const WARNING_RATIO = 0.3; // cảnh báo khi điểm RM < 30% điểm bình quân/RM toàn chi nhánh

function severityClass(ratio) {
  // ratio = điểm RM / điểm bình quân chi nhánh (0..0.3 trong danh sách cảnh báo)
  if (ratio <= 0.1) return 'bad';
  if (ratio <= 0.2) return 'warn';
  return 'mid';
}

export default function CanhBao() {
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

  const benchmark = useMemo(() => computeChiNhanhBenchmark(data?.summary), [data]);
  const threshold = +(benchmark.diemBinhQuan * WARNING_RATIO).toFixed(2);

  const warningList = useMemo(() => {
    if (!data?.rm) return [];
    const q = query.trim().toLowerCase();
    return data.rm
      .filter((r) => r.diem !== null && r.diem !== undefined && r.diem < threshold)
      .filter((r) => (q ? r.key.toLowerCase().includes(q) || (r.phongLabel || '').toLowerCase().includes(q) : true))
      .sort((a, b) => a.diem - b.diem);
  }, [data, threshold, query]);

  const byPhong = useMemo(() => {
    const map = {};
    warningList.forEach((r) => {
      const p = r.phongLabel || r.phong || '—';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [warningList]);

  const s = data?.summary || {};
  const tyLeCanhBao = data?.rm?.length ? ((100 * warningList.length) / data.rm.length).toFixed(1) : '0.0';

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="eyebrow">VietinBank · Chi nhánh Bắc Nghệ An</div>
            <div className="title">Cảnh báo cán bộ điểm thi đua thấp</div>
            <div className="subtitle">
              Danh sách RM có điểm thi đua thấp hơn 30% điểm bình quân/RM toàn chi nhánh trong kỳ — xem xét trừ 2 điểm KPI + không xét thi đua năm 2026.
            </div>
          </div>
          <div className="nav">
            <Link href="/">Bảng xếp hạng</Link>
            <Link href="/canh-bao" className="active">
              Cảnh báo
            </Link>
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
            </select>
          </div>
          <div className="topright" style={{ marginLeft: 'auto' }}>
            <div className="search-box">
              <span className="field-label">Tìm cán bộ / phòng</span>
              <input
                type="text"
                placeholder="Nhập mã RM hoặc tên phòng..."
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
            </div>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="num">{benchmark.diemBinhQuan}</div>
                <div className="lbl">Điểm bình quân/RM toàn chi nhánh</div>
              </div>
              <div className="stat-card accent">
                <div className="num">{threshold}</div>
                <div className="lbl">Ngưỡng cảnh báo (30% bình quân)</div>
              </div>
              <div className="stat-card">
                <div className="num">{warningList.length}</div>
                <div className="lbl">Số RM bị cảnh báo</div>
              </div>
              <div className="stat-card">
                <div className="num">{tyLeCanhBao}%</div>
                <div className="lbl">Tỷ lệ RM bị cảnh báo</div>
              </div>
              <div className="stat-card">
                <div className="num">{(benchmark.soRM || 0).toLocaleString('vi-VN')}</div>
                <div className="lbl">Tổng số RM</div>
              </div>
            </div>

            {byPhong.length > 0 && (
              <>
                <div className="section-title">
                  <h2>Số RM bị cảnh báo theo Phòng</h2>
                  <span className="count-pill">{byPhong.length}</span>
                </div>
                <div className="panel">
                  <table>
                    <thead>
                      <tr>
                        <th>Phòng / PGD</th>
                        <th>Số RM bị cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byPhong.map(([phong, count]) => (
                        <tr key={phong}>
                          <td className="name-cell">{phong}</td>
                          <td className="mono">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="section-title">
              <h2>Danh sách cán bộ bị cảnh báo</h2>
              <span className="count-pill">{warningList.length}</span>
            </div>
            {warningList.length === 0 ? (
              <div className="panel">
                <div className="empty-state">
                  <div className="big">✅</div>
                  Không có RM nào dưới ngưỡng cảnh báo trong kỳ này.
                </div>
              </div>
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>#</th>
                      <th>Cán bộ (RM)</th>
                      <th>Phòng</th>
                      <th>Lead giao</th>
                      <th>Lead/Opp có tương tác</th>
                      <th>Lead → Opp</th>
                      <th>Opp thành công</th>
                      <th>Điểm thi đua</th>
                      <th>So với bình quân CN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warningList.map((r, i) => {
                      const ratio = benchmark.diemBinhQuan ? r.diem / benchmark.diemBinhQuan : 0;
                      return (
                        <tr key={r.key}>
                          <td className="rank">{i + 1}</td>
                          <td className="name-cell">{r.key}</td>
                          <td>{r.phongLabel || r.phong || '—'}</td>
                          <td className="mono">{r.leadGiao.toLocaleString('vi-VN')}</td>
                          <td className="mono">{(r.leadTuongTac + r.oppTuongTac).toLocaleString('vi-VN')}</td>
                          <td className="mono">{r.leadChuyenDoi}</td>
                          <td className="mono">{r.oppThanhCong}</td>
                          <td className="diem mono">{r.diem}</td>
                          <td>
                            <span className={`badge ${severityClass(ratio)}`}>{(ratio * 100).toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <footer>VietinBank Chi nhánh Bắc Nghệ An · Dữ liệu phục vụ chương trình thi đua CRM1.0 Transformation 2026</footer>
    </>
  );
}
