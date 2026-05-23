import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle, Search, ChevronDown, X, ArrowRight, CreditCard, Package, Activity } from 'lucide-react';
import { useApi, useSmmApi } from '@/context/ApiContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

// Strip emojis, brackets [ID], pipes, special chars from service/category names
const cleanName = (name = '') => name
  .replace(/\[.*?\]/g, '')
  .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
  .replace(/[⚡🔥💎✅❌⚠️🎯🌍🌎🌏📌🔑💰🎁🏆⭐🚀💫🌟✨🎉]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Clean category name — take first meaningful segment before |
const cleanCategory = (name = '') => {
  const parts = name.split('|').map(p => p.trim()).filter(Boolean);
  // If all parts are very short (like platform names), join first 2
  if (parts.length <= 1) return cleanName(name);
  // Find the most descriptive part (longest, not just a platform name)
  const platforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'telegram', 'whatsapp', 'spotify', 'linkedin'];
  const meaningful = parts.find(p => p.length > 8 && !platforms.includes(p.toLowerCase()));
  return cleanName(meaningful || parts[0]);
};


// Platform SVG icons
const PlatformIcons = {
  all: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
  instagram: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
  facebook: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
  telegram: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.73a4.85 4.85 0 0 1-1.01-.04z" /></svg>,
  twitter: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  youtube: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M11.999 1.999C6.478 1.999 2 6.478 2 12c0 1.818.483 3.522 1.329 4.997L2 22l5.145-1.311A9.956 9.956 0 0 0 12 22c5.522 0 10-4.478 10-10.001C22 6.478 17.522 1.999 11.999 1.999z" /></svg>,
  spotify: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="10" /><path d="M8 13.5c2.5-1 5.5-.8 7.5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M7 10.5c3-1.3 6.5-1 9 .8" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M6.5 7.5c3.5-1.5 7.5-1.2 10.5 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>,
  other: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
};

// Platform filter
const PLATFORMS = [
  { id: '', label: 'All', icon: 'all', color: '#64748B', bg: '#F1F5F9', darkBg: '#27272A' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram', color: '#E1306C', bg: '#FDF2F8', darkBg: '#3B1520' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877F2', bg: '#EFF6FF', darkBg: '#1E2D4A' },
  { id: 'telegram', label: 'Telegram', icon: 'telegram', color: '#229ED9', bg: '#E0F7FF', darkBg: '#0E2A38' },
  { id: 'tiktok', label: 'TikTok', icon: 'tiktok', color: '#69C9D0', bg: '#F0FFFE', darkBg: '#0A2A2E' },
  { id: 'twitter', label: 'Twitter', icon: 'twitter', color: '#000000', bg: '#F8FAFC', darkBg: '#1A1A1A' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube', color: '#FF0000', bg: '#FFF0F0', darkBg: '#3B0A0A' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', bg: '#F0FFF4', darkBg: '#0A2E1A' },
  { id: 'spotify', label: 'Spotify', icon: 'spotify', color: '#1DB954', bg: '#F0FFF4', darkBg: '#0A2E1A' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', bg: '#EFF6FF', darkBg: '#0A1F3B' },
  { id: 'other', label: 'Other', icon: 'other', color: '#64748B', bg: '#F8FAFC', darkBg: '#1E1E1E' },
];

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
  const visible = filtered.slice(0, q ? 200 : 80); // limit render
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled} onClick={() => { setOpen(v => !v); setQ(''); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13.5, color: selected ? 'var(--text)' : 'var(--text3)', fontWeight: selected ? 600 : 400, opacity: disabled ? 0.5 : 1, textAlign: 'left' }}>
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
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Ketik nama atau ID service..." style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
            </div>
            {!q && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, paddingLeft: 2 }}>Menampilkan {Math.min(80, options.length)} dari {options.length} layanan — ketik untuk cari</div>}
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }} className="ns">
            {filtered.length === 0 && <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Tidak ditemukan</div>}
            {visible.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                style={{ padding: '9px 14px', fontSize: 12.5, fontWeight: o.value === value ? 700 : 400, color: o.value === value ? 'var(--blue)' : 'var(--text)', cursor: 'pointer', background: o.value === value ? 'var(--blue-l)' : 'transparent', transition: 'background .1s', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg2)'; }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {o.sub && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, fontFamily: 'monospace' }}>{o.sub}</span>}
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
  const [markup, setMarkup] = useState(1); // markup dari admin, default 1x (no markup)
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [orderCount, setOrderCount] = useState(null);

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

  // Load markup + smm_api_url dari Supabase settings
  // ✅ Fix: smm_api_key TIDAK diambil ke client — key ada di server env (SMM_API_KEY)
  // /api/smm sudah baca langsung dari process.env.SMM_API_KEY
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('key, value')
        .in('key', ['markup', 'smm_api_url']);
      if (!data) return;
      data.forEach(row => {
        if (row.key === 'markup') setMarkup(parseFloat(row.value));
        if (row.key === 'smm_api_url' && row.value) setConfig(row.value);
      });
    };
    loadSettings();
  }, []);

  // Balance — dari Supabase
  useEffect(() => {
    const loadBalance = async () => {
      try {
        // ✅ Fix: email dari session Supabase, bukan sessionStorage yang bisa dimanipulasi
        const { data: { session } } = await supabase.auth.getSession();
        const authEmail = session?.user?.email;
        if (!authEmail) { setBalance(0); return; }
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('email', authEmail);
        if (!data) { setBalance(0); return; }
        const masuk = data.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
        const keluar = data.filter(t => t.type === 'order').reduce((s, t) => s + (t.amount || 0), 0);
        setBalance(Math.max(0, masuk - keluar));
      } catch { setBalance(0); }
    };
    loadBalance();
  }, []);

  // Order count — dari Supabase
  useEffect(() => {
    const loadOrderCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) return;
        const { data } = await supabase
          .from('transactions')
          .select('order_id, description')
          .eq('email', email)
          .eq('type', 'order');
        const valid = (data || []).filter(t =>
          (t.order_id && /^\d+$/.test(String(t.order_id))) ||
          (t.description && t.description.startsWith('Order #'))
        );
        setOrderCount(valid.length);
      } catch { setOrderCount(0); }
    };
    loadOrderCount();
  }, []);

  // Services — fetch via /api/smm proxy (server punya API key)
  // ✅ Fix: hapus guard apiUrl/effectiveApiKey — /api/smm baca SMM_API_KEY dari env server
  // Client tidak perlu tahu API key, cukup kirim auth token user
  useEffect(() => {
    setLoadingServices(true);
    setError('');
    api.getServices()
      .then(svcs => { setServices(Array.isArray(svcs) ? svcs : []); })
      .catch(e => { setError(e.message); })
      .finally(() => { setLoadingServices(false); });
  }, []);

  const handleOrder = async () => {
    if (!selectedService || !link || !qty) { setError('Lengkapi semua field terlebih dahulu.'); return; }
    // Validasi saldo sebelum order
    const totalIDRCheck = Math.round(parseInt(qty) * parseFloat(selectedService.rate || 0) / 1000 * (rate || 17687) * markup);
    if (balance !== null && totalIDRCheck > balance) {
      setError(`Saldo tidak cukup. Saldo kamu Rp ${Math.round(balance).toLocaleString('id-ID')}, dibutuhkan Rp ${totalIDRCheck.toLocaleString('id-ID')}.`);
      return;
    }
    setOrderLoading(true); setError(''); setOrderResult(null);
    try {
      const res = await api.addOrder(selectedService.service, link, qty);
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
          qty: parseInt(qty),
          rate: selectedService.rate,
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
        // Simpan transaksi order ke Supabase
        const totalIDR = Math.round(parseInt(qty) * parseFloat(selectedService.rate || 0) / 1000 * (rate || 17687) * markup);
        await supabase.from('transactions').insert({
          email: user?.email || '',
          user_id: user?.id || null,
          type: 'order',
          amount: totalIDR,
          // ✅ Simpan order_id dan service_id supaya muncul di admin Orders
          order_id: String(res.order),
          service_id: String(selectedService.service),
          charge: parseFloat(selectedService.rate || 0) * parseInt(qty) / 1000,
          description: `Order #${res.order} - ${selectedService.name?.slice(0, 60)}`,
          status: 'success',
          link: link || null,
          qty: parseInt(qty) || null,
        });
        // Update balance state langsung tanpa reload
        setBalance(prev => Math.max(0, (prev || 0) - totalIDR));
      }
      setLink(''); setQty(''); setSelectedService(null);
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
      try {
        const res = await api.addOrder(serviceId, orderLink, orderQty);
        if (typeof window !== 'undefined' && res.order) {
          const existing = JSON.parse(sessionStorage.getItem('smm_order_ids') || '[]');
          if (!existing.includes(String(res.order))) {
            existing.unshift(String(res.order));
            sessionStorage.setItem('smm_order_ids', JSON.stringify(existing.slice(0, 100)));
          }
        }
        // ✅ Simpan bulk order ke Supabase
        const svc = services.find(s => String(s.service) === String(serviceId));
        const totalIDR = svc ? Math.round(parseInt(orderQty) * parseFloat(svc.rate || 0) / 1000 * (rate || 17687) * markup) : 0;
        await supabase.from('transactions').insert({
          email: user?.email || '',
          user_id: user?.id || null,
          type: 'order',
          amount: totalIDR,
          order_id: String(res.order),
          service_id: String(serviceId),
          charge: svc ? parseFloat(svc.rate || 0) * parseInt(orderQty) / 1000 : 0,
          description: `Order #${res.order} - ${svc?.name?.slice(0, 60) || serviceId}`,
          status: 'success',
        });
        results.push({ line, status: 'success', msg: `Order #${res.order} berhasil!` });
      } catch (e) {
        results.push({ line, status: 'error', msg: e.message });
      }
    }
    setBulkResults(results);
    setBulkLoading(false);
  };

  const platformFilteredServices = selectedPlatform
    ? services.filter(s => {
      const name = (s.name + ' ' + s.category).toLowerCase();
      return name.includes(selectedPlatform);
    })
    : services;

  const filteredServices = platformFilteredServices.filter(s => {
    const matchCat = !selectedCategory || s.category === selectedCategory;
    const matchSearch = !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.service).includes(searchQuery);
    return matchCat && matchSearch;
  });

  const price = selectedService ? (parseFloat(selectedService.rate || 0) / 1000) : 0;
  const toIDR = (usd) => Math.round(usd * rate);
  const formatIDR = (usd) => {
    const val = toIDR(usd);
    return val > 0 ? `Rp ${val.toLocaleString('id-ID')}` : 'Rp 0';
  };
  const categories = [...new Set(platformFilteredServices.map(s => s.category))].filter(Boolean);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="fu">
      {/* Banner API hanya untuk admin — dihapus dari tampilan user */}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Halo, {user?.name?.split(' ')[0] || 'User'} 👋</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Pilih layanan dan buat order sekarang.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }} className="stat-grid">
        {[
          { icon: <CreditCard size={20} />, iconBg: 'var(--blue-l)', iconColor: 'var(--blue)', label: 'Saldo Akun', value: balance !== null ? `Rp ${(typeof balance === 'number' ? balance : Math.round(parseFloat(balance || 0) * rate)).toLocaleString('id-ID')}` : '...', action: 'Tambah Saldo', actionColor: 'var(--blue)', actionBg: 'var(--blue-l)', target: 'Add Funds', fullWidth: true },
          { icon: <Package size={20} />, iconBg: 'var(--green-l)', iconColor: 'var(--green)', label: 'Total Layanan', value: services.length > 0 ? services.length : (loadingServices ? '...' : '—'), action: 'Buat Order', actionColor: 'var(--green)', actionBg: 'var(--green-l)', target: 'New Order' },
          { icon: <Activity size={20} />, iconBg: 'var(--red-l)', iconColor: 'var(--red)', label: 'Pesanan Saya', value: orderCount !== null ? orderCount : '...', action: 'Lihat Pesanan', actionColor: 'var(--red)', actionBg: 'var(--red-l)', target: 'My Orders' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', gridColumn: s.fullWidth ? 'span 2' : 'span 1' }} data-stat-full={s.fullWidth ? '1' : '0'}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.iconColor, flexShrink: 0 }}>{s.icon}</div>
              <div><div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>{s.label}</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div></div>
            </div>
            <button onClick={() => setMenu(s.target)} style={{ width: '100%', padding: '9px 14px', background: s.actionBg, border: 'none', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 13, color: s.actionColor }}>
              {s.action} <ArrowRight size={14} />
            </button>
          </div>
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

      {/* Order form */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><ShoppingCart size={18} /></div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Place your order</h2>
          {loadingServices && <span style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTop: '2px solid var(--blue)', borderRadius: '50%' }} className="spin" />}
          {loadingServices && (
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Memuat layanan...</span>
          )}
        </div>

        <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 4, gap: 2, marginBottom: 20 }}>
          {['New Order', 'Search', 'Bulk Order'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--white)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text3)', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .18s' }}>{t}</button>
          ))}
        </div>

        {tab === 'New Order' && loadingServices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 10, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {tab === 'New Order' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Platform Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Platform</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {PLATFORMS.map(p => {
                  const isActive = selectedPlatform === p.id;
                  return (
                    <button key={p.id} onClick={() => {
                      setSelectedPlatform(p.id);
                      setSelectedService(null);
                      // Auto-select kategori pertama yang cocok dengan platform
                      if (p.id) {
                        const matched = services.filter(s => {
                          const name = (s.name + ' ' + s.category).toLowerCase();
                          return name.includes(p.id);
                        });
                        const firstCat = matched.length > 0 ? matched[0].category : '';
                        setSelectedCategory(firstCat);
                      } else {
                        setSelectedCategory('');
                      }
                    }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px',
                        borderRadius: 10, border: `1.5px solid ${isActive ? p.color : 'var(--border)'}`,
                        background: isActive ? (dark ? p.darkBg : p.bg) : 'var(--bg2)',
                        cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif",
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
                options={[{ value: '', label: 'Semua Kategori' }, ...categories.map(c => ({ value: c, label: cleanCategory(c) || c }))]}
                value={selectedCategory}
                onChange={v => { setSelectedCategory(v); setSelectedService(null); }}
                placeholder="— Pilih Kategori —"
                disabled={loadingServices}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>Choose Service</label>
              <SearchSelect
                options={(selectedCategory ? services.filter(s => s.category === selectedCategory) : services).map(s => ({ value: String(s.service), label: s.name || cleanName(s.name), sub: `#${s.service}` }))}
                value={selectedService ? String(selectedService.service) : ''}
                onChange={v => { const svc = services.find(s => String(s.service) === v) || null; setSelectedService(svc); if (svc) setQty(String(svc.min)); }}
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
                      Rp {Math.round(parseFloat(selectedService.rate || 0) * (rate || 17687) * markup).toLocaleString('id-ID')}
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

                {/* Deskripsi gaya smmsoc */}
                {(() => {
                  const n = selectedService.name || '';
                  const desc = selectedService.description || '';
                  // Parse info dari nama service
                  const lines = [];
                  const linkType = n.toLowerCase().includes('follower') || n.toLowerCase().includes('subscriber') || n.toLowerCase().includes('member')
                    ? 'Username / Profile Link' : n.toLowerCase().includes('comment') ? 'Post Link + Custom Comments'
                      : n.toLowerCase().includes('like') || n.toLowerCase().includes('view') || n.toLowerCase().includes('play') ? 'Post / Video Link' : 'Link / Username';
                  lines.push(`- Link: ${linkType}`);
                  if (n.match(/global/i)) lines.push('- Location: Global');
                  else if (n.match(/indonesia|indo/i)) lines.push('- Location: Indonesia');
                  if (n.match(/hq|high.?quality/i)) lines.push('- Quality: High Quality');
                  else if (n.match(/real/i)) lines.push('- Quality: Real Accounts');
                  const startMatch = n.match(/(\d+[-–]\d+\s*(?:hour|min|day|jam|hari|menit)s?)/i);
                  if (startMatch) lines.push(`- Start: ${startMatch[0]}`);
                  else if (n.match(/instant|instan/i)) lines.push('- Start: 0-1 Hours');
                  const speedMatch = n.match(/day\s*(\d+[km]?)/i);
                  if (speedMatch) lines.push(`- Speed: ${speedMatch[0]}`);
                  if (n.match(/no.?refill/i)) lines.push('- Refill: No Refill');
                  else if (n.match(/refill/i)) lines.push('- Refill: Lifetime Refill');
                  const finalDesc = desc || lines.join('\n');

                  return (
                    <div style={{ padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>Detail Layanan</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                        {finalDesc}
                      </div>
                    </div>
                  );
                })()}

                {/* Info tabel */}
                <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {[
                    {
                      label: 'Start Time', value: (() => {
                        const n = selectedService.name || '';
                        if (n.match(/instant|instan/i)) return 'Instan (0–1 jam)';
                        if (n.match(/\d+[-–]\d+\s*hour/i)) return n.match(/(\d+[-–]\d+\s*hour)/i)[0];
                        return 'Beberapa jam';
                      })()
                    },
                    {
                      label: 'Speed / Hari', value: (() => {
                        const n = selectedService.name || '';
                        const dayMatch = n.match(/day\s*([\d,.]+[km]?)/i);
                        if (dayMatch) return dayMatch[0].replace(/day/i, '').trim() + ' / hari';
                        return 'Tidak tersedia';
                      })()
                    },
                    ...(parseInt(selectedService.average_time) > 0 ? [{
                      label: 'Average Time', value: (() => {
                        const mins = parseInt(selectedService.average_time);
                        if (mins < 60) return `~${mins} menit`;
                        if (mins < 1440) return `~${Math.round(mins / 60)} jam`;
                        return `~${Math.round(mins / 1440)} hari`;
                      })()
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
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: inputInfo.type === t ? 'var(--blue)' : 'transparent', color: inputInfo.type === t ? '#fff' : 'var(--text3)', fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
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
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>
                Quantity {selectedService && <span style={{ fontWeight: 500, color: 'var(--text3)' }}>Min: {selectedService.min} — Max: {selectedService.max}</span>}
              </label>
              <input className="inp" type="number" placeholder={selectedService ? `${selectedService.min} – ${selectedService.max}` : 'Pilih service dulu'} value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--blue-l)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Total Pembayaran</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>
                {(() => {
                  const q = parseInt(qty) || 0;
                  const p = selectedService ? parseFloat(selectedService.rate || 0) / 1000 : 0;
                  const r = rate || 17687;
                  const total = Math.round(q * p * r * markup);
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
                {filteredServices.length} result{filteredServices.length !== 1 ? 's' : ''} found
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }} className="ns">
              {(searchQuery ? filteredServices : services.slice(0, 10)).map(s => (
                <div key={s.service}
                  onClick={() => { setSelectedService(s); setTab('New Order'); setSearchQuery(''); }}
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-l)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>ID: {s.service} · Rp {Math.round(parseFloat(s.rate || 0) * rate * markup / 1000).toLocaleString('id-ID')}/1K · Min: {s.min} | Max: {s.max}</div>
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
                  { step: '1', title: 'Cari ID Service', desc: 'Buka tab Search → cari layanan yang kamu mau → catat angka ID-nya (contoh: 2771)', color: 'var(--blue)' },
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
                <span style={{ color: 'var(--blue)', fontWeight: 700 }}>service_id</span> = ID angka dari tab Search &nbsp;·&nbsp;
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>link</span> = URL profil/post target &nbsp;·&nbsp;
                <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>quantity</span> = jumlah order
              </div>
            </div>

            <textarea className="inp" rows={7} placeholder={'Contoh:\n2771|https://instagram.com/username|1000\n302|https://tiktok.com/@user/video/123|5000\n88|https://youtube.com/watch?v=abc|500'} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }} value={bulkText} onChange={e => setBulkText(e.target.value)} />
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
    </div>
  );
}