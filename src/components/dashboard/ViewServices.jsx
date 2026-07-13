import { useState, useEffect, useMemo, useRef, useCallback, forwardRef } from 'react';
import { Search, Inbox, Zap, Clock } from 'lucide-react';
import { VariableSizeList } from 'react-window';
import { cleanName, cleanCategory, serviceCode } from '@/lib/platforms';

// Estimasi & atribut diparse dari nama service (fallback kalau data order belum cukup)
function parseInfo(name = '') {
  const n = name.toLowerCase();
  let speed = null;
  if (n.includes('instant')) speed = { label: 'Instant', icon: 'zap' };
  else if (/(\d+)\s*hour/i.test(name)) speed = { label: name.match(/(\d+)\s*hours?/i)?.[0], icon: 'clock' };
  else if (/(\d+)\s*min/i.test(name)) speed = { label: name.match(/(\d+)\s*min/i)?.[0], icon: 'clock' };
  else if (n.includes('fast')) speed = { label: 'Fast', icon: 'zap' };
  else if (n.includes('gradual') || n.includes('slow')) speed = { label: 'Gradual', icon: 'clock' };
  return { speed };
}

// Minimal order Completed sebelum estimasi real ditampilkan (hindari sampel kecil menyesatkan)
const MIN_SAMPLE = 3;

// Tinggi tiap jenis baris (px) untuk virtualizer.
const ROW_H = 56;      // baris service
const HEADER_H = 44;   // baris pemisah kategori
const LIST_H = 640;    // tinggi area scroll virtual

// Layout kolom — dipakai header tabel & tiap baris (grid sama persis biar lurus).
const GRID = '92px minmax(220px,1fr) 110px 80px 110px 120px 70px';

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

// Wrapper scroll khusus utk react-window: cegah scroll "bocor"/chaining ke
// halaman induk pas mentok di ujung list (penyebab utama scroll kacau di
// Android/iOS), plus locking gesture jadi vertical-only dan momentum scroll iOS.
const ListOuter = forwardRef(function ListOuter({ style, ...rest }, ref) {
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        ...style,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
        overflowX: 'auto',
      }}
    />
  );
});

export default function ViewServices() {
  const [services, setServices] = useState([]);
  const [rate, setRate] = useState(17687);
  const [markup, setMarkup] = useState(1);
  const [rules, setRules] = useState({ categories: {}, services: {}, providers: {} });
  const [stats, setStats] = useState({}); // { [service_id]: { avg_seconds, sample_count } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  // Search di-debounce: filtering berat (ribuan service) hanya jalan dari nilai ini.
  const [deferredSearch, setDeferredSearch] = useState('');

  const listRef = useRef(null);

  // Debounce: salin `search` -> `deferredSearch` setelah jeda mengetik.
  useEffect(() => {
    const t = setTimeout(() => setDeferredSearch(search), 220);
    return () => clearTimeout(t);
  }, [search]);

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
        if (mk?.rules) setRules({ categories: mk.rules.categories || {}, services: mk.rules.services || {}, providers: mk.rules.providers || {} });
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
  const priceIDR = useCallback((svc) => {
    const eff = rules.services?.[String(svc.service)] ?? rules.categories?.[svc.category] ?? rules.providers?.[svc._provider || String(svc.service).split(':')[0]] ?? markup;
    // ⚡ Faktor konversi: service USD (SMMSOC) -> kali kurs USD->IDR.
    //    Service IDR (BuzzerPanel) -> faktor 1 (harga sudah Rupiah).
    const fx = String(svc.currency || 'USD').toUpperCase() === 'IDR' ? 1 : rate;
    return Math.round(parseFloat(svc.rate || 0) * fx * (eff || 1));
  }, [rules, markup, rate]);

  // Haystack pencarian per service, dihitung SEKALI saat services berubah.
  const searchable = useMemo(() =>
    services.map(s => ({
      s,
      key: [s.name || '', s.category || '', String(s.service || ''), String(s._rawId ?? ''), serviceCode(s)]
        .join(' ').toLowerCase(),
    })),
    [services]);

  // Susun FLAT list: [{type:'header',cat,count}, {type:'row',svc}, ...] sudah ter-sort
  // per kategori. Pakai deferredSearch (debounce) agar tak jalan tiap keystroke.
  const flatRows = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const filtered = q ? searchable.filter(e => e.key.includes(q)).map(e => e.s) : services;

    // group per kategori bersih
    const map = new Map();
    for (const s of filtered) {
      const cat = cleanCategory(s.category) || 'Lainnya';
      let bucket = map.get(cat);
      if (!bucket) { bucket = []; map.set(cat, bucket); }
      bucket.push(s);
    }
    const cats = [...map.entries()];
    for (const [, items] of cats) items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
    cats.sort((a, b) => a[0].localeCompare(b[0], 'id'));

    // flatten: header diikuti baris-barisnya
    const rows = [];
    for (const [cat, items] of cats) {
      rows.push({ type: 'header', cat, count: items.length });
      for (const s of items) rows.push({ type: 'row', svc: s });
    }
    return rows;
  }, [services, searchable, deferredSearch]);

  // Reset cache ukuran tiap struktur list berubah (header/row beda tinggi).
  useEffect(() => {
    if (listRef.current) listRef.current.resetAfterIndex(0);
  }, [flatRows]);

  const searching = deferredSearch.trim().length > 0;
  const totalRows = useMemo(() => flatRows.filter(r => r.type === 'row').length, [flatRows]);
  const totalCats = useMemo(() => flatRows.filter(r => r.type === 'header').length, [flatRows]);
  const fmt = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

  const itemSize = useCallback((i) => flatRows[i]?.type === 'header' ? HEADER_H : ROW_H, [flatRows]);

  // Render satu item virtual (header ATAU baris service).
  const Row = useCallback(({ index, style }) => {
    const item = flatRows[index];
    if (!item) return null;

    if (item.type === 'header') {
      return (
        <div style={{ ...style, minWidth: 802, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontFamily: "'Outfit',sans-serif" }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{item.cat}</span>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text3)' }}>({item.count})</span>
        </div>
      );
    }

    const s = item.svc;
    const { speed } = parseInfo(s.name);
    const stat = stats[String(s.service)] ?? (s._rawId ? stats[String(s._rawId)] : undefined);
    const hasReal = stat && stat.sample_count >= MIN_SAMPLE && stat.avg_seconds > 0;

    return (
      <div style={{ ...style, minWidth: 802, display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid var(--border)', fontSize: 12.5, boxSizing: 'border-box' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--text3)' }}>{serviceCode(s)}</span>
        <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cleanName(s.name) || s.name}>{cleanName(s.name) || s.name}</span>
        <span style={{ color: 'var(--blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(priceIDR(s))}</span>
        <span style={{ color: 'var(--text2)' }}>{Number(s.min).toLocaleString('id-ID')}</span>
        <span style={{ color: 'var(--text2)' }}>{Number(s.max).toLocaleString('id-ID')}</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          {hasReal ? (
            <span title={`Rata-rata dari ${stat.sample_count} order`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,.1)', padding: '3px 8px', borderRadius: 7, border: '1px solid rgba(5,150,105,.25)' }}>
              <Clock size={11} /> {fmtDuration(stat.avg_seconds)}
            </span>
          ) : speed ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 7, border: '1px solid var(--border)' }}>
              {speed.icon === 'zap' ? <Zap size={11} style={{ color: '#F59E0B' }} /> : <Clock size={11} style={{ color: 'var(--text3)' }} />}
              {speed.label}
            </span>
          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          {s.refill
            ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>♻️ Ya</span>
            : <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)' }}>—</span>}
        </span>
      </div>
    );
  }, [flatRows, stats, priceIDR]);

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Service List</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>
          {loading ? 'Memuat layanan…' : `${totalRows.toLocaleString('id-ID')} layanan · ${totalCats.toLocaleString('id-ID')} kategori`}
        </p>
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
        {search !== deferredSearch && (
          <span aria-hidden className="spin" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--blue)' }} />
        )}
      </div>

      {loading && <SvcSkeleton />}

      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--red)', fontSize: 13.5 }}>{error}</div>
      )}

      {!loading && !error && flatRows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text3)' }}>
          <Inbox size={32} style={{ display: 'block', margin: '0 auto 12px' }} />
          <span style={{ fontSize: 13.5 }}>Tidak ada layanan yang cocok.</span>
        </div>
      )}

      {/* Tabel flat virtualized */}
      {!loading && !error && flatRows.length > 0 && (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div
            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
            onScroll={e => { if (listRef.current) listRef.current._outerRef.scrollLeft = e.currentTarget.scrollLeft; }}
          >
            {/* Header kolom */}
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.3px', minWidth: 802 }}>
              <span>ID</span><span>Layanan</span><span>Harga / 1K</span><span>Min</span><span>Max</span><span>Estimasi</span><span>Refill</span>
            </div>
          </div>
          <VariableSizeList
            ref={listRef}
            height={Math.min(LIST_H, flatRows.length * ROW_H + HEADER_H)}
            itemCount={flatRows.length}
            itemSize={itemSize}
            width="100%"
            overscanCount={6}
            outerElementType={ListOuter}
            onScroll={({ scrollOffset, scrollUpdateWasRequested }) => { }}
          >
            {Row}
          </VariableSizeList>
        </div>
      )}
    </div>
  );
}

function SvcSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{ height: 40, borderRadius: 8, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.06}s` }} />
      ))}
    </div>
  );
}