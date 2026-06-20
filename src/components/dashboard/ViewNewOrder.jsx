import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle, Search, ChevronDown, X, ArrowRight, CreditCard, Package, Activity, Clock, BarChart3, ShieldCheck } from 'lucide-react';
import { useApi, useSmmApi } from '@/context/ApiContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { cleanName, cleanCategory, detectPlatform, PlatformIcons, visiblePlatforms, serviceCode, resolveServiceInput, isCustomCommentsSvc } from '@/lib/platforms';

// Custom searchable dropdown
function SearchSelect({ options, value, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => !q ||
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    o.value.includes(q)
  );
  const visible = filtered.slice(0, 1000); // tampilkan semua; cap 1000 hanya pengaman performa kategori sangat besar
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled} onClick={() => { setOpen(v => !v); setQ(''); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 13.5, color: selected ? 'var(--text)' : 'var(--text3)', fontWeight: selected ? 600 : 400, opacity: disabled ? 0.5 : 1, textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{ color: 'var(--text3)', flexShrink: 0, marginLeft: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 12, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Ketik nama atau ID service..." className="svc-search-input" style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: "'Outfit',sans-serif", background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
            </div>
            {!q && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, paddingLeft: 2 }}>{options.length} layanan — ketik untuk cari</div>}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }} className="ns">
            {filtered.length === 0 && <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Tidak ditemukan</div>}
            {visible.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                style={{ padding: '9px 14px', fontSize: 12.5, fontWeight: o.value === value ? 700 : 400, color: o.value === value ? 'var(--blue)' : 'var(--text)', cursor: 'pointer', background: o.value === value ? 'var(--blue-l)' : 'transparent', transition: 'background .1s', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg2)'; }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}>{o.label}</span>
                  {o.sub && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, fontFamily: 'monospace', marginTop: 1 }}>{o.sub}</span>}
                </div>
              </div>
            ))}
            {filtered.length > visible.length && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                +{filtered.length - visible.length} lagi — ketik untuk filter lebih spesifik
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViewNewOrder({ user, setMenu }) {
  const [tab, setTab] = useState('New Order');
  const [qty, setQty] = useState('');
  const [comments, setComments] = useState(''); // daftar komentar custom (1 per baris)
  const [link, setLink] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [services, setServices] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loadingServices, setLoadingServices] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState('');
  const { dark } = useTheme();
  const { apiUrl, apiKey, setConfig } = useApi();
  const [apiKeyLocal, setApiKeyLocal] = useState(apiKey);
  const effectiveApiKey = apiKeyLocal || apiKey;
  const api = useSmmApi();
  const [rate, setRate] = useState(17687); // fallback IDR rate
  const [markup, setMarkup] = useState(1); // markup global dari admin, default 1x (no markup)
  const [markupRules, setMarkupRules] = useState({ categories: {}, services: {}, providers: {} }); // markup per-service/kategori/provider
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [orderCount, setOrderCount] = useState(null);
  const [completedCount, setCompletedCount] = useState(null);

  // Deteksi apakah service butuh username atau link
  const getInputType = (service) => {
    if (!service) return { type: 'link', label: 'Link', placeholder: 'https://...' };
    const name = (service.name || '').toLowerCase();
    const cat = (service.category || '').toLowerCase();
    if (name.includes('username') || name.includes('user name'))
      return { type: 'username', label: 'Username', placeholder: '@username (tanpa @)' };
    if (name.includes('followers') || name.includes('subscriber') || name.includes('fans') || cat.includes('follower'))
      return { type: 'username', label: 'Username / Link Profil', placeholder: '@username atau https://...' };
    if (name.includes('comment') || name.includes('komentar'))
      return { type: 'link', label: 'Link Post', placeholder: 'https://...' };
    if (name.includes('like') || name.includes('views') || name.includes('play') || name.includes('watch'))
      return { type: 'link', label: 'Link Post / Video', placeholder: 'https://...' };
    return { type: 'link', label: 'Link', placeholder: 'https://... atau @username' };
  };

  useEffect(() => {
    fetch('/api/rate').then(r => r.json()).then(d => { if (d.rate) setRate(d.rate); }).catch(() => { });
  }, []);

  // Load markup + rules via server endpoint (pakai service role, lolos RLS).
  // smm_api_url tetap dari Supabase (bukan rahasia).
  useEffect(() => {
    const loadSettings = async () => {
      // markup global + per-service/kategori dari server (konsisten dgn /api/smm)
      try {
        const r = await fetch('/api/smm?action=get_public_markup');
        const d = await r.json();
        if (d?.markup) setMarkup(parseFloat(d.markup));
        if (d?.rules) setMarkupRules(d.rules);
      } catch { }
      // smm_api_url (non-rahasia) — boleh dari Supabase
      try {
        const { data } = await supabase.from('settings').select('key, value').in('key', ['smm_api_url']);
        data?.forEach(row => { if (row.key === 'smm_api_url' && row.value) setConfig(row.value); });
      } catch { }
    };
    loadSettings();
  }, []);

  // Balance — dari Supabase. Dibuat reusable supaya bisa di-refresh setelah order.
  // Saldo dipotong server-side (RPC), jadi habis order kita cukup baca ulang ledger.
  const refreshBalance = useCallback(async () => {
    try {
      // ✅ Fix: email dari session Supabase, bukan sessionStorage yang bisa dimanipulasi
      const { data: { session } } = await supabase.auth.getSession();
      const authEmail = session?.user?.email;
      if (!authEmail) { setBalance(0); return; }
      const { data } = await supabase
        .from('transactions')
        .select('type, amount, status')
        .eq('email', authEmail);
      if (!data) { setBalance(0); return; }
      const masuk = data.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
      const keluar = data.filter(t => ['order', 'purchase'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
      setBalance(Math.max(0, masuk - keluar));
    } catch { setBalance(0); }
  }, []);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Order count — dari Supabase
  useEffect(() => {
    const loadOrderCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) return;
        const { data } = await supabase
          .from('transactions')
          .select('order_id, description, status')
          .eq('email', email)
          .eq('type', 'order');
        const valid = (data || []).filter(t =>
          (t.order_id && /^\d+$/.test(String(t.order_id))) ||
          (t.description && t.description.startsWith('Order #'))
        );
        setOrderCount(valid.length);
        // Pesanan berhasil = order valid yang status transaksinya 'success'
        // (saldo terpotong & order terkirim ke provider). Order pending/gagal tidak dihitung.
        setCompletedCount(valid.filter(t => t.status === 'success').length);
      } catch { setOrderCount(0); setCompletedCount(0); }
    };
    loadOrderCount();
  }, []);

  // Services — fetch via /api/smm proxy (server punya API key)
  // ✅ Fix: hapus guard apiUrl/effectiveApiKey — /api/smm baca SMM_API_KEY dari env server
  // Client tidak perlu tahu API key, cukup kirim auth token user
  useEffect(() => {
    const CACHE_KEY = 'smm_services_cache_v2';
    const TS_KEY = 'smm_services_cache_ts';
    const TTL = 1000 * 60 * 60 * 6; // 6 jam — anggap masih segar, skip refetch
    // 1. Tampilkan cache dulu kalau ada → instan, tanpa "Memuat layanan..."
    //    Pakai localStorage (persist lintas tab/session), bukan sessionStorage.
    let hasCache = false;
    let cacheFresh = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        const ts = Number(localStorage.getItem(TS_KEY) || 0);
        if (Array.isArray(cached) && cached.length) {
          setServices(cached);
          hasCache = true;
          cacheFresh = Date.now() - ts < TTL;
        }
      } catch { }
    }
    // 2. Kalau cache masih segar, jangan refetch sama sekali → hemat waktu & beban provider.
    if (cacheFresh) { setLoadingServices(false); return; }
    // 3. Spinner hanya muncul saat belum ada cache (load pertama benar-benar kosong)
    if (!hasCache) setLoadingServices(true);
    setError('');
    // 4. Revalidate di belakang — data terbaru tetap di-fetch & cache diperbarui
    api.getServices()
      .then(svcs => {
        const arr = Array.isArray(svcs) ? svcs : [];
        setServices(arr);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
          localStorage.setItem(TS_KEY, String(Date.now()));
        } catch { }
      })
      .catch(e => { if (!hasCache) setError(e.message); }) // jangan timpa data cache kalau revalidate gagal
      .finally(() => { setLoadingServices(false); });
  }, []);

  const handleOrder = async () => {
    if (!selectedService) { setError('Pilih layanan dulu.'); return; }

    // Deteksi layanan Custom Comments (butuh daftar komentar, bukan quantity)
    const isCustomComments = isCustomCommentsSvc(selectedService);

    // Daftar komentar (1 per baris). Quantity untuk custom comments = jumlah baris.
    const commentList = comments.split('\n').map(s => s.trim()).filter(Boolean);
    const effectiveQty = isCustomComments ? commentList.length : parseInt(qty);

    // Validasi field
    if (!link) { setError('Lengkapi link/username dulu.'); return; }
    if (isCustomComments) {
      if (commentList.length === 0) { setError('Isi minimal satu komentar (satu komentar per baris).'); return; }
    } else if (!qty) {
      setError('Lengkapi jumlah (quantity) dulu.'); return;
    }

    // Validasi min/max berdasar jumlah komentar / quantity
    const minV = Number(selectedService.min) || 0;
    const maxV = Number(selectedService.max) || Infinity;
    if (effectiveQty < minV || effectiveQty > maxV) {
      setError(`Jumlah harus antara ${minV} dan ${maxV}.${isCustomComments ? ` Kamu menulis ${commentList.length} komentar.` : ''}`);
      return;
    }

    // Validasi saldo sebelum order
    const totalIDRCheck = Math.round(effectiveQty * parseFloat(selectedService.rate || 0) / 1000 * fxFor(selectedService) * resolveMarkup(selectedService));
    if (balance !== null && totalIDRCheck > balance) {
      setError(`Saldo tidak cukup. Saldo kamu Rp ${Math.round(balance).toLocaleString('id-ID')}, dibutuhkan Rp ${totalIDRCheck.toLocaleString('id-ID')}.`);
      return;
    }
    setOrderLoading(true); setError(''); setOrderResult(null);
    try {
      // Custom Comments → kirim daftar komentar; lainnya → kirim quantity biasa.
      const res = isCustomComments
        ? await api.addOrder(selectedService.service, link, effectiveQty, { comments: commentList.join('\n') })
        : await api.addOrder(selectedService.service, link, effectiveQty);
      setOrderResult({ success: true, orderId: res.order, msg: `Order #${res.order} berhasil dibuat!` });
      // Simpan order ID ke sessionStorage
      if (typeof window !== 'undefined' && res.order) {
        const userKey = `smm_orders_${user?.email || 'guest'}`;
        const existing = JSON.parse(localStorage.getItem(userKey) || '[]');
        const orderObj = {
          orderId: String(res.order),
          email: user?.email || 'guest',
          service: selectedService.service,
          serviceName: selectedService.name,
          link,
          qty: effectiveQty,
          rate: selectedService.rate,
          comments: isCustomComments ? commentList : undefined,
          createdAt: new Date().toISOString(),
        };
        if (!existing.find(o => (typeof o === 'object' ? o.orderId : o) === String(res.order))) {
          existing.unshift(orderObj);
          localStorage.setItem(userKey, JSON.stringify(existing.slice(0, 200)));
        }
        // backward compat sessionStorage
        const session = JSON.parse(sessionStorage.getItem('smm_order_ids') || '[]');
        if (!session.includes(String(res.order))) {
          session.unshift(String(res.order));
          sessionStorage.setItem('smm_order_ids', JSON.stringify(session.slice(0, 100)));
        }
        // ✅ Saldo & baris transaksi 'order' SUDAH ditangani server (RPC debit + enrich).
        //    Client tidak boleh insert transaksi sendiri (dobel potong + diblok RLS).
        //    Cukup baca ulang saldo dari ledger biar angka di UI sinkron.
        await refreshBalance();
      }
      setLink(''); setQty(''); setComments(''); setSelectedService(null);
    } catch (e) { setError(e.message); }
    setOrderLoading(false);
  };

  const handleBulkOrder = async () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) { setError('Masukkan minimal 1 baris order.'); return; }
    setBulkLoading(true); setError(''); setBulkResults([]);
    const results = [];
    for (const line of lines) {
      const [serviceId, orderLink, orderQty] = line.split('|').map(s => s.trim());
      if (!serviceId || !orderLink || !orderQty) {
        results.push({ line, status: 'error', msg: 'Format salah (harus: service_id|link|quantity)' });
        continue;
      }

      // Resolve input ke id internal. Terima kode alias ("B519"), id mentah
      // ("519"), atau id internal. Pesan ambigu pakai kode alias (bukan nama provider).
      const resolved = resolveServiceInput(serviceId, services);
      if (resolved.ambiguous) {
        results.push({ line, status: 'error', msg: `Kode ${serviceId} cocok ke beberapa layanan. Pakai salah satu: ${resolved.ambiguous.join(', ')}` });
        continue;
      }
      if (!resolved.id) {
        results.push({ line, status: 'error', msg: `Service ${serviceId} tidak ditemukan.` });
        continue;
      }
      const resolvedId = resolved.id;

      try {
        const res = await api.addOrder(resolvedId, orderLink, orderQty);
        if (typeof window !== 'undefined' && res.order) {
          const existing = JSON.parse(sessionStorage.getItem('smm_order_ids') || '[]');
          if (!existing.includes(String(res.order))) {
            existing.unshift(String(res.order));
            sessionStorage.setItem('smm_order_ids', JSON.stringify(existing.slice(0, 100)));
          }
        }
        // ✅ Saldo & baris transaksi 'order' ditangani server per-baris (RPC).
        //    Karena server motong saldo atomik tiap request, bulk over-spend gak mungkin lagi.
        results.push({ line, status: 'success', msg: `Order #${res.order} berhasil!` });
      } catch (e) {
        results.push({ line, status: 'error', msg: e.message });
      }
    }
    setBulkResults(results);
    await refreshBalance();
    setBulkLoading(false);
  };

  // Pra-hitung sekali per perubahan `services`: kategori bersih + platform per service.
  // Memoized supaya 30rb+ service nggak diproses ulang tiap render (tiap ketik qty/link).
  const enriched = useMemo(() => services.map(s => {
    const cleanCat = cleanCategory(s.category) || 'Lainnya';
    return { svc: s, cleanCat, platform: detectPlatform(cleanCat, s.name) };
  }), [services]);

  // Filter platform: cocokkan platform yang TERDETEKSI per service (bukan substring kasar).
  const platformFilteredEnriched = useMemo(
    () => !selectedPlatform ? enriched : enriched.filter(e => e.platform === selectedPlatform),
    [enriched, selectedPlatform]
  );
  const platformFilteredServices = useMemo(
    () => platformFilteredEnriched.map(e => e.svc),
    [platformFilteredEnriched]
  );

  // Pencarian tab Search: cari ke SELURUH service (semua provider), LEPAS dari
  // filter platform/kategori tab New Order. Match nama / id prefixed / id mentah /
  // kategori / provider. Di-cap 200 biar query luas nggak render ribuan baris.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const s of services) {
      if (
        (s.name || '').toLowerCase().includes(q) ||
        String(s.service).toLowerCase().includes(q) ||
        String(s._rawId ?? '').includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        serviceCode(s).toLowerCase().includes(q)
      ) {
        out.push(s);
        if (out.length >= 200) break;
      }
    }
    return out;
  }, [services, searchQuery]);

  const price = selectedService ? (parseFloat(selectedService.rate || 0) / 1000) : 0;
  const toIDR = (usd) => Math.round(usd * rate);

  // Markup efektif untuk sebuah service: service → kategori → global (sama logika dengan server /api/smm)
  const resolveMarkup = (svc) => {
    if (!svc) return markup;
    const sid = String(svc.service);
    if (markupRules.services && markupRules.services[sid] != null) return parseFloat(markupRules.services[sid]);
    if (svc.category && markupRules.categories && markupRules.categories[svc.category] != null) return parseFloat(markupRules.categories[svc.category]);
    const prov = svc._provider || String(svc.service).split(':')[0];
    if (prov && markupRules.providers && markupRules.providers[prov] != null) return parseFloat(markupRules.providers[prov]);
    return markup;
  };

  // ⚡ Faktor konversi harga ke IDR berdasar currency provider.
  //   - Service USD (mis. SMMSOC): rate-nya per 1000 dalam USD -> kali kurs USD->IDR.
  //   - Service IDR (mis. BuzzerPanel): rate sudah Rupiah -> faktor 1 (JANGAN dikali kurs).
  //   Field `currency` dikirim server dari providers.js. Default 'USD' untuk
  //   data lama tanpa field (kompatibilitas service SMMSOC sebelum multi-provider).
  const fxFor = (svc) => {
    const cur = String(svc?.currency || 'USD').toUpperCase();
    return cur === 'IDR' ? 1 : (rate || 17687);
  };
  const formatIDR = (usd) => {
    const val = toIDR(usd);
    return val > 0 ? `Rp ${val.toLocaleString('id-ID')}` : 'Rp 0';
  };
  // Kategori untuk dropdown: kunci = kategori bersih (cleanCategory) dari service
  // yang lolos filter platform → near-duplicate nyatu, di-sort A–Z biar rapih.
  const categories = useMemo(
    () => [...new Set(platformFilteredEnriched.map(e => e.cleanCat))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'id')),
    [platformFilteredEnriched]
  );

  // Hitung jumlah service per platform → tombol platform yang kosong disembunyiin.
  const platformCounts = useMemo(() => {
    const m = {};
    for (const e of enriched) m[e.platform] = (m[e.platform] || 0) + 1;
    return m;
  }, [enriched]);
  const shownPlatforms = useMemo(() => visiblePlatforms(platformCounts), [platformCounts]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Shimmer bar kecil untuk angka yang masih loading (ganti "...")
  const Shimmer = ({ w = 60, h = 22 }) => (
    <span style={{ display: 'inline-block', width: w, height: h, borderRadius: 6, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', verticalAlign: 'middle' }} />
  );
  // Blok skeleton (bar abu-abu ber-pulse). w angka = px, default 100%.
  const Sk = ({ w = '100%', h = 14, r = 10, mb = 0, delay = 0 }) => (
    <div style={{ width: w, height: h, borderRadius: r, marginBottom: mb, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${delay}s` }} />
  );

  return (
    <div className="fu" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Banner API hanya untuk admin — dihapus dari tampilan user */}

      {/* Welcome banner — gradient biru soft ala smmspot */}
      <div className="ns-welcome" style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: isMobile ? '22px 20px' : '30px 32px', marginBottom: 18 }}>
        <div className="ns-welcome-blob ns-welcome-blob-a" />
        <div className="ns-welcome-blob ns-welcome-blob-b" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.02em' }}>Halo, {user?.name?.split(' ')[0] || 'User'} 👋</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13.5, maxWidth: 460, lineHeight: 1.55 }}>Kelola media sosialmu dengan mudah — pilih layanan, isi link, dan order langsung jalan.</p>
        </div>
      </div>

      {/* Hero card — Total Layanan, BUKAN saldo (saldo udah ada di sidebar desktop, biar gak dobel) */}
      <div className="bento-grad bento-shine" style={{ borderRadius: 18, padding: isMobile ? '18px 18px 16px' : '22px 24px 20px', marginBottom: 10 }}>
        <div className="bento-sweep" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.78)', fontWeight: 600, marginBottom: 4 }}>Total Layanan Tersedia</div>
            <div className="tnum" style={{ fontSize: 'clamp(20px, 6.5vw, 27px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {services.length > 0 ? services.length.toLocaleString('id-ID') : (loadingServices ? <Shimmer w={70} /> : '—')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>Instagram, TikTok, Facebook & lainnya</div>
          </div>
          <div className="bento-ico" style={{ width: 46, height: 46, flexShrink: 0 }}>
            <Package size={22} />
          </div>
        </div>
        <button onClick={() => document.getElementById('ns-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ width: '100%', marginTop: 16, padding: '11px 16px', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: '#fff' }}>
          Buat Order <ArrowRight size={14} />
        </button>
      </div>

      {/* 3 stat lain — ringkas, jadi info sekunder di bawah hero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: 18 }} className="ns-stat-grid">
        {[
          { icon: <CreditCard size={18} />, iconColor: 'var(--blue)', label: 'Saldo', value: balance !== null ? `${(typeof balance === 'number' ? balance : Math.round(parseFloat(balance || 0) * rate)).toLocaleString('id-ID')}` : <Shimmer w={60} />, target: 'Add Funds' },
          { icon: <Activity size={18} />, iconColor: 'var(--red)', label: 'Pesanan', value: orderCount !== null ? orderCount : <Shimmer w={28} />, target: 'My Orders' },
          { icon: <CheckCircle size={18} />, iconColor: 'var(--green)', label: 'Berhasil', value: completedCount !== null ? completedCount : <Shimmer w={28} />, target: 'My Orders' },
        ].map((s, i) => (
          <button key={i} onClick={() => setMenu(s.target)} className="card bento-card ns-stat-card" style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderRadius: 14, cursor: 'pointer', background: 'var(--white)' }}>
            <span style={{ color: s.iconColor, display: 'flex' }}>{s.icon}</span>
            <div className="ns-stat-val tnum" style={{ fontSize: 'clamp(13px, 4.2vw, 16px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1.1 }}>{s.value}</div>
            <div className="ns-stat-label" style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, lineHeight: 1.2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={14} /></button>
        </div>
      )}
      {orderResult?.success && (
        <div style={{ background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>{orderResult.msg}</span>
          <button onClick={() => setOrderResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)' }}><X size={14} /></button>
        </div>
      )}

      {/* Layout 2 kolom: form kiri + panel info kanan */}
      <div className="ns-order-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>

        {/* Order form */}
        <div id="ns-order-form" className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><ShoppingCart size={18} /></div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Place your order</h2>
            {loadingServices && services.length === 0 && <span style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTop: '2px solid var(--blue)', borderRadius: '50%' }} className="spin" />}
            {loadingServices && services.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Memuat layanan...</span>
            )}
          </div>

          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 4, gap: 2, marginBottom: 20 }}>
            {['New Order', 'Search', 'Bulk Order'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--white)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text3)', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .18s' }}>{t}</button>
            ))}
          </div>

          {tab === 'New Order' && loadingServices && services.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 14 }}>
              {/* Platform */}
              <div>
                <Sk w={70} h={13} mb={10} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[64, 96, 86, 72, 80, 90, 70, 88].map((w, i) => <Sk key={i} w={w} h={40} r={12} delay={i * 0.06} />)}
                </div>
              </div>
              {/* Choose Category */}
              <div><Sk w={120} h={13} mb={8} /><Sk h={46} r={12} delay={0.1} /></div>
              {/* Choose Service */}
              <div><Sk w={110} h={13} mb={8} /><Sk h={46} r={12} delay={0.15} /></div>
              {/* Link */}
              <div><Sk w={46} h={13} mb={8} /><Sk h={46} r={12} delay={0.2} /></div>
              {/* Quantity */}
              <div><Sk w={78} h={13} mb={8} /><Sk h={46} r={12} delay={0.25} /></div>
              {/* Total + tombol */}
              <Sk h={58} r={12} delay={0.3} />
              <Sk h={50} r={12} delay={0.35} />
            </div>
          )}
          {tab === 'New Order' && !(loadingServices && services.length === 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Platform Filter */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Platform</label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {shownPlatforms.map(p => {
                    const isActive = selectedPlatform === p.id;
                    return (
                      <button key={p.id} onClick={() => {
                        setSelectedPlatform(p.id);
                        setSelectedService(null);
                        // Auto-select kategori pertama (alfabetis) milik platform ini,
                        // pakai deteksi platform yang sama dgn daftar kategori → konsisten.
                        if (p.id) {
                          const cats = [...new Set(
                            enriched.filter(e => e.platform === p.id).map(e => e.cleanCat)
                          )].sort((a, b) => a.localeCompare(b, 'id'));
                          setSelectedCategory(cats[0] || '');
                        } else {
                          setSelectedCategory('');
                        }
                      }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px',
                          borderRadius: 10, border: `1.5px solid ${isActive ? p.color : 'var(--border)'}`,
                          background: isActive ? (dark ? p.darkBg : p.bg) : 'var(--bg2)',
                          cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                          fontWeight: isActive ? 700 : 600, fontSize: 12,
                          color: isActive ? (p.id === 'twitter' && dark ? '#fff' : p.color) : 'var(--text2)',
                          transition: 'all .15s', width: '100%',
                          boxShadow: isActive ? `0 2px 8px ${p.color}30` : 'none',
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.color = p.color; } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; } }}>
                        <span style={{ display: 'flex', flexShrink: 0 }}>{PlatformIcons[p.icon]}</span>
                        {!isMobile && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{p.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>Choose Category</label>
                <SearchSelect
                  options={[{ value: '', label: 'Semua Kategori' }, ...categories.map(c => ({ value: c, label: c }))]}
                  value={selectedCategory}
                  onChange={v => { setSelectedCategory(v); setSelectedService(null); }}
                  placeholder="— Pilih Kategori —"
                  disabled={loadingServices}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>Choose Service</label>
                <SearchSelect
                  options={(selectedCategory
                    ? platformFilteredEnriched.filter(e => e.cleanCat === selectedCategory)
                    : platformFilteredEnriched)
                    .slice()
                    .sort((a, b) => (a.svc.name || '').localeCompare(b.svc.name || '', 'id'))
                    .map(e => ({ value: String(e.svc.service), label: cleanName(e.svc.name) || e.svc.name || `#${e.svc._rawId || e.svc.service}`, sub: `#${e.svc._rawId || e.svc.service}` }))}
                  value={selectedService ? String(selectedService.service) : ''}
                  onChange={v => { const svc = services.find(s => String(s.service) === v) || null; setSelectedService(svc); setComments(''); if (svc) setQty(String(svc.min)); }}
                  placeholder="— Pilih Service —"
                  disabled={loadingServices}
                />
              </div>
              {selectedService && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Harga & Min Max */}
                  <div style={{ background: 'var(--blue-l)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Harga layanan</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>
                        Rp {Math.round(parseFloat(selectedService.rate || 0) * fxFor(selectedService) * resolveMarkup(selectedService)).toLocaleString('id-ID')}
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginLeft: 4 }}>/ 1.000</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Min — Max</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {Number(selectedService.min).toLocaleString('id-ID')} — {Number(selectedService.max).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  {/* Deskripsi gaya smmsoc — utamakan field resmi API, fallback ke parse nama */}
                  {(() => {
                    const n = selectedService.name || '';
                    const desc = selectedService.description || selectedService.desc || '';
                    const lines = [];

                    // ── Link/input type: utamakan field "type" dari API ──
                    const apiType = String(selectedService.type || '').toLowerCase();
                    let linkType;
                    if (apiType.includes('comment') || n.toLowerCase().includes('comment')) {
                      linkType = 'Post Link + Custom Comments';
                    } else if (apiType.includes('mention') || apiType.includes('package')) {
                      linkType = 'Link / Username';
                    } else if (n.toLowerCase().includes('follower') || n.toLowerCase().includes('subscriber') || n.toLowerCase().includes('member')) {
                      linkType = 'Username / Profile Link';
                    } else if (n.toLowerCase().includes('like') || n.toLowerCase().includes('view') || n.toLowerCase().includes('play')) {
                      linkType = 'Post / Video Link';
                    } else {
                      linkType = 'Link / Username';
                    }
                    lines.push(`- Link: ${linkType}`);

                    // ── Lokasi & kualitas: hanya dari nama (tidak ada field resminya) ──
                    if (n.match(/global/i)) lines.push('- Location: Global');
                    else if (n.match(/indonesia|indo/i)) lines.push('- Location: Indonesia');
                    if (n.match(/hq|high.?quality/i)) lines.push('- Quality: High Quality');
                    else if (n.match(/real/i)) lines.push('- Quality: Real Accounts');

                    // ── Start: tidak ada field resmi dari API, tampilkan netral ──
                    lines.push('- Start: Sesuai antrian');
                    const speedMatch = n.match(/day\s*(\d+[km]?)/i);
                    if (speedMatch) lines.push(`- Speed: ${speedMatch[0]}`);

                    // ── Refill: utamakan field resmi "refill" (boolean), fallback ke nama ──
                    // API kirim refill sebagai boolean true/false atau string "true"/"false"
                    const refillRaw = selectedService.refill;
                    const hasRefillField = refillRaw !== undefined && refillRaw !== null;
                    if (hasRefillField) {
                      const isRefill = refillRaw === true || refillRaw === 'true' || refillRaw === 1 || refillRaw === '1';
                      lines.push(`- Refill: ${isRefill ? 'Garansi Refill' : 'No Refill'}`);
                    } else if (n.match(/no.?refill/i)) {
                      lines.push('- Refill: No Refill');
                    } else if (n.match(/refill/i)) {
                      lines.push('- Refill: Lifetime Refill');
                    }

                    // ── Cancel: dari field resmi "cancel" ──
                    const cancelRaw = selectedService.cancel;
                    if (cancelRaw !== undefined && cancelRaw !== null) {
                      const canCancel = cancelRaw === true || cancelRaw === 'true' || cancelRaw === 1 || cancelRaw === '1';
                      lines.push(`- Cancel: ${canCancel ? 'Bisa dibatalkan' : 'Tidak bisa dibatalkan'}`);
                    }

                    // ── Dripfeed: dari field resmi "dripfeed" ──
                    const dripRaw = selectedService.dripfeed;
                    if (dripRaw !== undefined && dripRaw !== null) {
                      const hasDrip = dripRaw === true || dripRaw === 'true' || dripRaw === 1 || dripRaw === '1';
                      if (hasDrip) lines.push('- Dripfeed: Tersedia');
                    }

                    // Jika API punya deskripsi sendiri, tampilkan itu DI ATAS info parsed
                    const parsedBlock = lines.join('\n');
                    const finalDesc = desc ? `${desc}\n\n${parsedBlock}` : parsedBlock;

                    return (
                      <div style={{ padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>Detail Layanan</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                          {finalDesc}
                        </div>

                        {/* ── Catatan penting (peringatan order dobel) ── */}
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--yellow-l)', border: '1px solid var(--yellow)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', marginBottom: 6, letterSpacing: '.03em', textTransform: 'uppercase' }}>⚠️ Catatan Penting</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
                            <li>Jangan order ke link yang sama sebelum order sebelumnya selesai. Sistem bisa menandai order sebagai <strong>selesai</strong> atau <strong>partial</strong> jika ada order ganda di link yang sama.</li>
                            <li>Kecepatan proses bisa berubah saat layanan sedang ramai.</li>
                            <li>Jika ada kendala pada layanan, silakan hubungi support.</li>
                          </ul>
                        </div>

                        {/* ── Catatan KHUSUS followers Instagram: matikan "Laporkan untuk ditinjau" ── */}
                        {(() => {
                          // Deteksi IG Followers yang andal lintas provider:
                          //  - platform terdeteksi 'instagram', ATAU teks ada "instagram"/"ig"
                          //    (IG = abbreviation umum di provider lokal/Buzzer).
                          //  - followers / pengikut / subscriber / fans.
                          const rawText = `${selectedService.name || ''} ${selectedService.category || ''}`.toLowerCase();
                          const isInsta = selectedPlatform === 'instagram'
                            || detectPlatform(cleanCategory(selectedService.category), selectedService.name) === 'instagram'
                            || /\binstagram\b/.test(rawText) || /\big\b/.test(rawText);
                          const isFollowers = /follower|pengikut|subscriber|fans/.test(rawText);
                          const isIgFollowers = isInsta && isFollowers;
                          if (!isIgFollowers) return null;
                          return (
                            <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--red-l, rgba(239,68,68,.08))', border: '1px solid var(--red, #EF4444)', borderRadius: 10 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--red, #EF4444)', marginBottom: 7, letterSpacing: '.03em' }}>🚨 PENTING 🚨</div>
                              <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>
                                Harap matikan <strong>"Laporkan untuk ditinjau"</strong> sebelum memesan!
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>Caranya:</div>
                              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                                <li>Masuk ke <strong>Pengaturan dan privasi</strong></li>
                                <li>Pilih <strong>Ikuti & Undang Teman</strong></li>
                                <li>Nonaktifkan <strong>Laporkan untuk ditinjau</strong></li>
                              </ol>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Info tabel */}
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {[
                      {
                        label: 'Start Time', value: 'Sesuai antrian'
                      },
                      {
                        label: 'Speed / Hari', value: (() => {
                          const n = selectedService.name || '';
                          const dayMatch = n.match(/day\s*([\d,.]+[km]?)/i);
                          if (dayMatch) return dayMatch[0].replace(/day/i, '').trim() + ' / hari';
                          return 'Tidak tersedia';
                        })()
                      },
                      // ── Refill dari field resmi API ──
                      ...(selectedService.refill !== undefined && selectedService.refill !== null ? [{
                        label: 'Refill', value: (selectedService.refill === true || selectedService.refill === 'true' || selectedService.refill === 1 || selectedService.refill === '1')
                          ? 'Ada garansi' : 'Tidak ada'
                      }] : []),
                      // ── Cancel dari field resmi API ──
                      ...(selectedService.cancel !== undefined && selectedService.cancel !== null ? [{
                        label: 'Cancel', value: (selectedService.cancel === true || selectedService.cancel === 'true' || selectedService.cancel === 1 || selectedService.cancel === '1')
                          ? 'Bisa dibatalkan' : 'Tidak bisa'
                      }] : []),
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: 140, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', flexShrink: 0 }}>{row.label}</div>
                        <div style={{ flex: 1, padding: '9px 16px', fontSize: 12.5, color: 'var(--text)', borderLeft: '1px solid var(--border)' }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                {(() => {
                  const inputInfo = getInputType(selectedService);
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{inputInfo.label}</label>
                        {selectedService && (
                          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
                            {['link', 'username'].map(t => (
                              <div key={t}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: inputInfo.type === t ? 'var(--blue)' : 'transparent', color: inputInfo.type === t ? '#fff' : 'var(--text3)', fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>
                                {t === 'link' ? 'Link' : 'Username'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input className="inp" placeholder={isMobile ? (inputInfo.type === "username" ? "@username / link" : "https://...") : inputInfo.placeholder} value={link} onChange={e => setLink(e.target.value)} />
                      {selectedService && (
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5 }}>
                          {getInputType(selectedService).type === 'username'
                            ? 'Tanpa @ atau link profil lengkap'
                            : 'Link lengkap post/video target'}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              {(() => {
                const isCC = isCustomCommentsSvc(selectedService);
                const ccLines = comments.split('\n').map(s => s.trim()).filter(Boolean);

                if (isCC) {
                  const overMax = selectedService && ccLines.length > Number(selectedService.max);
                  return (
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>
                        Komentar Custom <span style={{ fontWeight: 500, color: 'var(--text3)' }}>(satu komentar per baris)</span>
                      </label>
                      <textarea
                        className="inp"
                        rows={6}
                        placeholder={'Tulis satu komentar per baris:\nKeren banget kak! 🔥\nProduknya bagus, recommended\nMantap, langganan terus'}
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        style={{ resize: 'vertical', lineHeight: 1.6, fontFamily: "'Outfit',sans-serif" }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11.5, color: 'var(--text3)' }}>
                        <span>Jumlah komentar: <strong style={{ color: overMax ? 'var(--red)' : 'var(--blue)' }}>{ccLines.length}</strong></span>
                        <span>Min {selectedService.min} — Max {selectedService.max}</span>
                      </div>
                      {overMax && (
                        <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
                          Komentar melebihi batas maksimal ({selectedService.max}). Kurangi dulu.
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>
                      Quantity {selectedService && <span style={{ fontWeight: 500, color: 'var(--text3)' }}>Min: {selectedService.min} — Max: {selectedService.max}</span>}
                    </label>
                    <input className="inp" type="number" placeholder={selectedService ? `${selectedService.min} – ${selectedService.max}` : 'Pilih service dulu'} value={qty} onChange={e => setQty(e.target.value)} />
                  </div>
                );
              })()}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--blue-l)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Total Pembayaran</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>
                  {(() => {
                    const isCC = isCustomCommentsSvc(selectedService);
                    const q = isCC ? comments.split('\n').map(s => s.trim()).filter(Boolean).length : (parseInt(qty) || 0);
                    const p = selectedService ? parseFloat(selectedService.rate || 0) / 1000 : 0;
                    const r = fxFor(selectedService);
                    const total = Math.round(q * p * r * resolveMarkup(selectedService));
                    return q > 0 && p > 0 ? `Rp ${total.toLocaleString('id-ID')}` : 'Rp 0';
                  })()}
                </span>
              </div>
              <button className="btn btn-blue" onClick={handleOrder} disabled={orderLoading} style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14 }}>
                {orderLoading ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> Processing...</> : <><ShoppingCart size={15} /> Place Order</>}
              </button>
            </div>
          )}
          {tab === 'Search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" style={{ paddingLeft: 38 }} placeholder="Search by service name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
              </div>
              {searchQuery && (
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                  {searchResults.length}{searchResults.length >= 200 ? '+' : ''} result{searchResults.length !== 1 ? 's' : ''} found
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }} className="ns">
                {(searchQuery ? searchResults : services.slice(0, 10)).map(s => (
                  <div key={s.service}
                    onClick={() => { setSelectedService(s); setTab('New Order'); setSearchQuery(''); }}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-l)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{cleanName(s.name) || s.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>ID: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--text2)', fontWeight: 700 }}>{serviceCode(s)}</span> · Rp {Math.round(parseFloat(s.rate || 0) * fxFor(s) * resolveMarkup(s) / 1000).toLocaleString('id-ID')}/1K · Min: {s.min} | Max: {s.max}</div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                  </div>
                ))}
                {!searchQuery && services.length > 10 && (
                  <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>
                    Type to search all {services.length} services...
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'Bulk Order' && (
            <div>
              {/* Panduan langkah-langkah */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)', marginBottom: 12 }}>📋 Cara Pakai Bulk Order</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { step: '1', title: 'Cari Kode Service', desc: 'Buka tab Search → cari layanan → salin KODE-nya (mis. B519). Tiap layanan punya kode unik, jadi nggak akan ketuker walau angkanya kebetulan sama.', color: 'var(--blue)' },
                    { step: '2', title: 'Tulis di kolom bawah', desc: 'Isi dengan format: ID|link|jumlah — satu order per baris', color: 'var(--green)' },
                    { step: '3', title: 'Submit sekaligus', desc: 'Klik Submit Bulk Order — semua order diproses sekaligus dalam satu klik', color: 'var(--yellow)' },
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{s.step}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{s.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format box */}
              <div style={{ background: 'var(--blue-l)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 8 }}>Format penulisan:</div>
                <code style={{ display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: 'var(--blue)', background: 'rgba(37,99,235,.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 8 }}>
                  service_id|link|quantity
                </code>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--blue)', fontWeight: 700 }}>service_id</span> = kode dari tab Search (mis. B519 / A123) &nbsp;·&nbsp;
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>link</span> = URL profil/post target &nbsp;·&nbsp;
                  <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>quantity</span> = jumlah order
                </div>
              </div>

              <textarea className="inp bulk-textarea" rows={7} placeholder={'Contoh:\n2771|https://instagram.com/username|1000\n302|https://tiktok.com/@user/video/123|5000\n88|https://youtube.com/watch?v=abc|500'} style={{ fontFamily: "'JetBrains Mono',monospace" }} value={bulkText} onChange={e => setBulkText(e.target.value)} />
              {bulkResults.length > 0 && (
                <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {bulkResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 8, background: r.status === 'success' ? 'var(--green-l)' : 'var(--red-l)', border: `1px solid ${r.status === 'success' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}` }}>
                      {r.status === 'success'
                        ? <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                        : <AlertCircle size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />}
                      <div>
                        <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text3)', marginBottom: 2 }}>{r.line}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: r.status === 'success' ? 'var(--green)' : 'var(--red)' }}>{r.msg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-blue" onClick={handleBulkOrder} disabled={bulkLoading} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 10, fontSize: 14 }}>
                {bulkLoading ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> Processing {bulkResults.length}/{bulkText.trim().split('\n').filter(l => l.trim()).length}...</> : <><ShoppingCart size={15} /> Submit Bulk Order</>}
              </button>
            </div>
          )}
        </div>

        {/* ── Panel kanan: service card gabungan (preview + how to order) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky', top: 14 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {selectedService ? (
              <>
                {/* Header: icon platform di tengah + judul + meta */}
                <div style={{ padding: '20px 20px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                  {(() => {
                    const plat = detectPlatform(cleanCategory(selectedService.category), selectedService.name);
                    const p = shownPlatforms.find(x => x.id === plat);
                    return (
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: p ? (dark ? p.darkBg : p.bg) : 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p ? p.color : 'var(--blue)', margin: '0 auto 12px' }}>
                        {p ? PlatformIcons[p.icon] : <Package size={18} />}
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.45, marginBottom: 8 }}>
                    {cleanName(selectedService.name) || selectedService.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                    <span>ID: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--text2)', fontWeight: 700 }}>{serviceCode(selectedService)}</span></span>
                    <span style={{ color: 'var(--border2)' }}>•</span>
                    <span style={{ color: 'var(--blue)', fontWeight: 700 }}>Trusted Provider</span>
                  </div>
                </div>

                {/* 3 kolom stat — data asli */}
                {(() => {
                  const refillRaw = selectedService.refill;
                  const hasRefill = refillRaw === true || refillRaw === 'true' || refillRaw === 1 || refillRaw === '1';
                  const cancelRaw = selectedService.cancel;
                  const hasCancel = cancelRaw === true || cancelRaw === 'true' || cancelRaw === 1 || cancelRaw === '1';
                  const stats = [
                    { icon: <Clock size={17} />, title: 'Start Time', sub: 'Sesuai antrian' },
                    { icon: <BarChart3 size={17} />, title: 'Min — Max', sub: `${Number(selectedService.min).toLocaleString('id-ID')} – ${Number(selectedService.max).toLocaleString('id-ID')}` },
                    { icon: <ShieldCheck size={17} />, title: refillRaw != null ? (hasRefill ? 'Refill' : 'No Refill') : (hasCancel ? 'Cancel' : 'Garansi'), sub: refillRaw != null ? (hasRefill ? 'Ada garansi' : 'Tanpa refill') : (cancelRaw != null ? (hasCancel ? 'Bisa batal' : 'Tidak bisa') : 'Sesuai S&K') },
                  ];
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid var(--border)' }}>
                      {stats.map((st, i) => (
                        <div key={i} style={{ padding: '14px 8px', textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ color: 'var(--text2)', display: 'flex', justifyContent: 'center', marginBottom: 7 }}>{st.icon}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{st.title}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.3 }}>{st.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Harga */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-.02em' }}>
                    Rp {Math.round(parseFloat(selectedService.rate || 0) * fxFor(selectedService) * resolveMarkup(selectedService)).toLocaleString('id-ID')}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>/ 1.000</span>
                </div>
              </>
            ) : (
              <div style={{ padding: '24px 20px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--blue-l)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Package size={18} /></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Belum ada layanan dipilih</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Pilih layanan di form sebelah, detailnya akan muncul di sini.</div>
              </div>
            )}

            {/* How to Place Order */}
            <div style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Cara Order 🛒</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  'Pilih platform, kategori, lalu layanannya.',
                  'Tempel link post/video atau username target.',
                  'Isi jumlah sesuai Min–Max, cek total, klik Place Order.',
                ].map((t, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>{t}</li>
                ))}
              </ul>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>
                  Pastikan akun/postingan <strong style={{ color: 'var(--text2)' }}>publik</strong>, dan jangan order ganda ke link yang sama sebelum order sebelumnya selesai.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>{/* /ns-order-grid */}

      {/* Style scoped untuk tampilan baru — pakai CSS var biar ikut light/dark */}
      <style>{`
        .ns-welcome {
          background: linear-gradient(135deg, var(--blue-l) 0%, var(--white) 70%);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .root.dark .ns-welcome {
          background: linear-gradient(135deg, var(--blue-l2) 0%, var(--white) 75%);
        }
        .ns-welcome-blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(2px);
        }
        .ns-welcome-blob-a {
          top: -70px; right: -40px;
          width: 220px; height: 220px;
          background: radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%);
        }
        .ns-welcome-blob-b {
          bottom: -90px; right: 120px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%);
        }
        .ns-stat-card {
          transition: transform var(--ease), box-shadow var(--ease);
        }
        .ns-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow2);
        }
        .ns-stat-grid { grid-auto-rows: 1fr; }
        .ns-order-grid { max-width: 100%; }
        .ns-order-grid > * { min-width: 0; }
        @media (min-width: 981px) {
          .ns-order-grid { grid-template-columns: minmax(0,1fr) 320px !important; }
        }
        @media (max-width: 600px) {
          .ns-stat-grid { gap: 6px !important; }
          /* font-size .ns-stat-label & .ns-stat-val sudah pakai clamp() inline (lihat array map di atas) —
             otomatis scale fluid sesuai lebar layar, gak perlu override fixed px di sini lagi. */
        }
      `}</style>
    </div>
  );
}