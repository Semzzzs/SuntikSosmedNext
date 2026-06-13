import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Inbox, Zap, Clock } from 'lucide-react';

// Estimasi & atribut diparse dari nama service (fallback kalau data order belum cukup)
function parseInfo(name = '') {
  const n = name.toLowerCase();
  let speed = null;
  if (n.includes('instant')) speed = { label: 'Instant', icon: 'zap' };
  else if (/(\d+)\s*hour/.test(n)) speed = { label: name.match(/(\d+)\s*hours?/i)?.[0], icon: 'clock' };
  else if (/(\d+)\s*min/.test(n)) speed = { label: name.match(/(\d+)\s*min/i)?.[0], icon: 'clock' };
  else if (n.includes('fast')) speed = { label: 'Fast', icon: 'zap' };
  else if (n.includes('gradual') || n.includes('slow')) speed = { label: 'Gradual', icon: 'clock' };
  return { speed };
}

// Minimal order Completed sebelum estimasi real ditampilkan (hindari sampel kecil menyesatkan)
const MIN_SAMPLE = 3;

// Detik -> teks ringkas berbahasa Indonesia: "~12 menit", "~2 jam", "~1 hari"
function fmtDuration(sec) {
  if (sec < 90) return '~1 menit';
  const min = Math.round(sec / 60);
  if (min < 60) return `~${min} menit`;
  const hr = sec / 3600;
  if (hr < 24) return `~${hr < 2 ? hr.toFixed(1) : Math.round(hr)} jam`;
  const day = Math.round(hr / 24);
  return `~${day} hari`;
}

export default function ViewServices() {
  const [services, setServices] = useState([]);
  const [rate, setRate] = useState(17687);
  const [markup, setMarkup] = useState(1);
  const [rules, setRules] = useState({ categories: {}, services: {} });
  const [stats, setStats] = useState({}); // { [service_id]: { avg_seconds, sample_count } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({}); // { [category]: true } = ditutup

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [svcRes, mkRes, rateRes, statRes] = await Promise.all([
          fetch('/api/smm?action=services'),
          fetch('/api/smm?action=get_public_markup'),
          fetch('/api/rate'),
          fetch('/api/smm?action=service_stats'),
        ]);

        const svcData = await svcRes.json();
        if (!svcRes.ok) throw new Error(svcData?.error || 'Gagal memuat layanan');

        const mk = await mkRes.json().catch(() => ({}));
        const rt = await rateRes.json().catch(() => ({}));
        const st = await statRes.json().catch(() => ({}));

        if (!on) return;
        setServices(Array.isArray(svcData) ? svcData : []);
        if (mk?.markup) setMarkup(parseFloat(mk.markup) || 1);
        if (mk?.rules) setRules({ categories: mk.rules.categories || {}, services: mk.rules.services || {} });
        if (rt?.rate) setRate(rt.rate);
        if (st && typeof st === 'object') setStats(st);
      } catch (e) {
        if (on) setError(e.message);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  // Markup efektif: service-specific > kategori > global (sama seperti smm.js)
  const priceIDR = (svc) => {
    const eff = rules.services?.[String(svc.service)] ?? rules.categories?.[svc.category] ?? markup;
    const idr = parseFloat(svc.rate || 0) * rate * (eff || 1);
    return Math.round(idr);
  };

  // Filter + grouping per kategori
  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? services.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        String(s.service).includes(q))
      : services;

    const map = filtered.reduce((acc, s) => {
      const cat = s.category || 'Lainnya';
      (acc[cat] ||= []).push(s);
      return acc;
    }, {});
    return map;
  }, [services, search, rate, markup, rules]);

  const fmt = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Service List</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Semua layanan tersedia dengan harga terbaik.</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari layanan, kategori, atau ID..."
          style={{
            width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
            fontSize: 13.5, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--blue)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {loading && <SvcSkeleton />}

      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--red)', fontSize: 13.5 }}>{error}</div>
      )}

      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text3)' }}>
          <Inbox size={32} style={{ display: 'block', margin: '0 auto 12px' }} />
          <span style={{ fontSize: 13.5 }}>Tidak ada layanan yang cocok.</span>
        </div>
      )}

      {/* Tabel per kategori */}
      {!loading && !error && Object.entries(grouped).map(([cat, items]) => {
        const isOpen = !collapsed[cat];
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <button
              onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg2)', cursor: 'pointer', marginBottom: isOpen ? 8 : 0,
                fontFamily: "'Outfit',sans-serif",
              }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>
                {cat} <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 13 }}>({items.length})</span>
              </span>
              <ChevronDown size={18} style={{ color: 'var(--text3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {isOpen && (
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', color: 'var(--text3)', textAlign: 'left' }}>
                      <th style={thS}>ID</th>
                      <th style={thS}>Layanan</th>
                      <th style={{ ...thS, whiteSpace: 'nowrap' }}>Harga / 1K</th>
                      <th style={thS}>Min</th>
                      <th style={thS}>Max</th>
                      <th style={thS}>Estimasi</th>
                      <th style={thS}>Refill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(s => {
                      const { speed } = parseInfo(s.name);
                      const stat = stats[String(s.service)];
                      const hasReal = stat && stat.sample_count >= MIN_SAMPLE && stat.avg_seconds > 0;
                      return (
                        <tr key={s.service} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...tdS, color: 'var(--text3)' }}>{s.service}</td>
                          <td style={{ ...tdS, color: 'var(--text)', minWidth: 260 }}>{s.name}</td>
                          <td style={{ ...tdS, color: 'var(--blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(priceIDR(s))}</td>
                          <td style={{ ...tdS, color: 'var(--text2)' }}>{Number(s.min).toLocaleString('id-ID')}</td>
                          <td style={{ ...tdS, color: 'var(--text2)' }}>{Number(s.max).toLocaleString('id-ID')}</td>
                          <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                            {hasReal ? (
                              <span title={`Rata-rata dari ${stat.sample_count} order`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,.1)', padding: '3px 8px', borderRadius: 7, border: '1px solid rgba(5,150,105,.25)' }}>
                                <Clock size={11} /> {fmtDuration(stat.avg_seconds)}
                              </span>
                            ) : speed ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 7, border: '1px solid var(--border)' }}>
                                {speed.icon === 'zap' ? <Zap size={11} style={{ color: '#F59E0B' }} /> : <Clock size={11} style={{ color: 'var(--text3)' }} />}
                                {speed.label}
                              </span>
                            ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                            {s.refill
                              ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>♻️ Ya</span>
                              : <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const thS = { padding: '11px 14px', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.3px' };
const tdS = { padding: '11px 14px', verticalAlign: 'top' };

function SvcSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...Array(2)].map((_, g) => (
        <div key={g}>
          <div style={{ height: 44, borderRadius: 12, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', marginBottom: 8 }} />
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ height: 14, width: 40, borderRadius: 4, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                <div style={{ height: 14, flex: 1, borderRadius: 4, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                <div style={{ height: 14, width: 70, borderRadius: 4, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                <div style={{ height: 14, width: 40, borderRadius: 4, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}