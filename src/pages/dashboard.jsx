import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  ShoppingCart, Package, CreditCard, List, Wallet,
  ChevronRight, ChevronLeft, Bell, Moon, Sun, LogOut, Settings,
  Target, ChevronDown, X, Menu, Ticket, Phone, BarChart2, ArrowLeftRight, HelpCircle, MessageCircle, Newspaper,
  Check, Megaphone, Pin, Info, CheckCircle, AlertCircle, Zap, Clock
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useApi } from '@/context/ApiContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

const ViewNewOrder = lazy(() => import('@/components/dashboard/ViewNewOrder'));
const ViewServices = lazy(() => import('@/components/dashboard/ViewServices'));
const ViewMyOrders = lazy(() => import('@/components/dashboard/ViewMyOrders'));
const ViewAddFunds = lazy(() => import('@/components/dashboard/ViewAddFunds'));
const ViewTickets = lazy(() => import('@/components/dashboard/ViewTickets'));
const ViewContact = lazy(() => import('@/components/dashboard/ViewContact'));
const ViewAnalytics = lazy(() => import('@/components/dashboard/ViewAnalytics'));
const ViewTransactions = lazy(() => import('@/components/dashboard/ViewTransactions'));
const ViewSettings = lazy(() => import('@/components/dashboard/ViewSettings'));
const ViewAnnouncements = lazy(() => import('@/components/dashboard/ViewAnnouncements'));
const ViewFAQ = lazy(() => import('@/components/dashboard/Faq'));

// Skeleton saat view sedang di-load
function ViewSkeleton() {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[80, 120, 200, 160].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 14, background: 'var(--bg2)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}


// ── Popup "Berita Terbaru": daftar pengumuman dari Supabase, muncul tiap buka dashboard ──
// Diam kalau user sudah "jangan tampilkan lagi", TAPI muncul lagi kalau ada pengumuman baru.
const NEWS_TYPES = {
  info: { label: 'Info', color: '#2f6bff', darkColor: '#7da4ff', icon: <Info size={15} /> },
  success: { label: 'Sukses', color: '#059669', darkColor: '#34D399', icon: <CheckCircle size={15} /> },
  warning: { label: 'Peringatan', color: '#D97706', darkColor: '#FCD34D', icon: <AlertCircle size={15} /> },
  promo: { label: 'Promo', color: '#7C3AED', darkColor: '#A78BFA', icon: <Zap size={15} /> },
};

function NewsPopup({ dark, items, onClose }) {
  const [dontShow, setDontShow] = useState(false);

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const finish = () => {
    try {
      if (dontShow) localStorage.setItem('ss_news_dismissed', '1');
      // Tandai pengumuman terbaru sebagai "sudah dilihat" — pakai updated_at PALING BARU
      // dari SEMUA item (bukan items[0], yang diurutkan pinned dulu).
      const latest = items.reduce((max, a) => {
        const t = a?.updated_at || '';
        return t > max ? t : max;
      }, '');
      if (latest) localStorage.setItem('ss_news_last_seen', latest);
    } catch { }
    onClose();
  };

  return (
    <div className={`root${dark ? ' dark' : ''}`} onClick={finish}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, fontFamily: "'Inter',sans-serif", animation: 'nwFade .25s ease' }}>
      <style>{`
        @keyframes nwFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nwPop { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
        .nw-scroll::-webkit-scrollbar { width: 8px }
        .nw-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px }
      `}</style>

      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 20, width: 540, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,.45)', overflow: 'hidden', animation: 'nwPop .35s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#2f6bff,#2456e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(47,107,255,.3)', flexShrink: 0 }}>
            <Megaphone size={19} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>Berita Terbaru</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text3)' }}>Info & promo terbaru dari admin</p>
          </div>
          <button onClick={finish} aria-label="Tutup"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 7, cursor: 'pointer', color: 'var(--text3)', display: 'flex', flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>

        {/* List (scrollable) */}
        <div className="nw-scroll" style={{ overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Bell size={24} style={{ color: 'var(--blue)' }} />
              </div>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 5 }}>Belum ada pengumuman</p>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Pantau terus ya, info & promo terbaru muncul di sini.</p>
            </div>
          ) : items.map(a => {
            const t = NEWS_TYPES[a.type] || NEWS_TYPES.info;
            const color = dark ? t.darkColor : t.color;
            const tint = dark ? `${color}1F` : `${color}14`;      // background lembut warna tipe
            return (
              <div key={a.id} style={{ flexShrink: 0, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--white)', overflow: 'hidden', boxShadow: dark ? '0 1px 3px rgba(0,0,0,.3)' : '0 1px 3px rgba(0,0,0,.05)' }}>

                {/* Header berwarna */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: `linear-gradient(135deg, ${tint}, transparent 75%)`, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: tint, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.25 }}>{a.title}</span>
                      {a.pinned && (
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.03em', color: dark ? '#FCD34D' : '#92400E', background: dark ? 'rgba(252,211,77,.14)' : '#FEF3C7', padding: '2px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Pin size={9} /> PENTING
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text3)', fontWeight: 500 }}>
                      <Clock size={11} /> {formatDate(a.updated_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color, background: tint, border: `1px solid ${color}33`, padding: '3px 9px', borderRadius: 7, flexShrink: 0 }}>{t.label}</span>
                </div>

                {/* Isi */}
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0, padding: '13px 16px 15px', whiteSpace: 'pre-wrap' }}>{a.content || '—'}</p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, userSelect: 'none' }}>
            <span onClick={() => setDontShow(v => !v)}
              style={{ width: 19, height: 19, borderRadius: 6, border: `1.5px solid ${dontShow ? 'var(--blue)' : 'var(--border)'}`, background: dontShow ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
              {dontShow && <Check size={13} style={{ color: '#fff' }} />}
            </span>
            <span onClick={() => setDontShow(v => !v)}>Jangan tampilkan lagi</span>
          </label>
          <button onClick={finish}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 22px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: '0 6px 18px rgba(47,107,255,.35)' }}>
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Avatar gambar otomatis (DiceBear "avataaars") — unik & konsisten per user.
//    Seed dari email/nama; fallback ke inisial huruf kalau gambar gagal load. ──
function avatarUrl(seed = '') {
  const s = encodeURIComponent((seed || 'user').trim().toLowerCase());
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${s}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8e6c9,fff9c4`;
}
function Avatar({ seed, fallback = 'U', size = 36, radius = 10, fontSize }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={avatarUrl(seed)}
        alt="Avatar"
        width={size} height={size}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fb = e.currentTarget.nextSibling;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <span style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: fontSize || Math.round(size * 0.4) }}>
        {fallback}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const { apiUrl, apiKey } = useApi();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState(() => {
    if (typeof window === 'undefined') return 'New Order';
    return sessionStorage.getItem('dashboard_menu') || 'New Order';
  });
  const [sideOpen, setSideOpen] = useState(false);

  const setMenuAndSave = (m) => {
    setMenu(m);
    sessionStorage.setItem('dashboard_menu', m);
  };
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(user);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (unreadCount > 0 && notifications.length > 0) {
      const latest = notifications[0];
      setToast(latest);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [unreadCount, notifications[0]?.id]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    // Saat pertama load: desktop sidebar kebuka, mobile/tablet ketutup
    setSideOpen(window.innerWidth >= 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const profileBtnRef = useRef(null);
  const [profileDropPos, setProfileDropPos] = useState({ top: 0, right: 0 });

  const handleProfileOpen = () => {
    if (profileBtnRef.current) {
      const rect = profileBtnRef.current.getBoundingClientRect();
      setProfileDropPos({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      });
    }
    setProfileOpen(v => !v);
    setNotifOpen(false);
  };
  const [balance, setBalance] = useState(null);
  const [rate, setRate] = useState(17687);

  useEffect(() => {
    fetch('/api/rate').then(r => r.json()).then(d => { if (d.rate) setRate(d.rate); }).catch(() => { });
  }, []);

  useEffect(() => {
    // Tunggu sampai AuthContext selesai cek session (hindari redirect prematur saat refresh)
    if (authLoading) return;

    if (!authUser) {
      router.push('/login');
      return;
    }

    let cancelled = false;

    // ✅ Cek apakah akun diblokir admin. Kalau ya: sign out + tendang ke /login.
    //    Penegakan ada juga di /api/smm (saat order), ini lapisan UX agar user
    //    diblokir tidak bisa masuk dashboard sama sekali.
    (async () => {
      try {
        // Pastikan session masih valid & token tidak kedaluwarsa.
        // getUser() memicu refresh token bila perlu → hindari 401 dari token basi.
        const { data: { user: u }, error: uErr } = await supabase.auth.getUser();
        if (uErr || !u) return; // belum login / sesi invalid → jangan panggil endpoint
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch('/api/check-blocked', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return; // 401/5xx → fail-open, jangan kunci user
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (json.blocked) {
          await supabase.auth.signOut();
          try { sessionStorage.clear(); } catch { }
          // Hard redirect (bukan router.replace) — pastikan halaman login fresh
          // dengan query ?blocked=1 terbaca, tidak terganggu auth-state listener.
          window.location.href = '/login?blocked=1';
          return;
        }
      } catch (e) {
        // FAIL-OPEN: jangan kunci user kalau cek gagal — order tetap dijaga server.
      }
    })();

    const userData = {
      // ✅ Jangan simpan id di sessionStorage — cukup untuk display
      email: authUser.email,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      initials: ((authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || 'U').charAt(0)).toUpperCase(),
    };
    setUser(userData);
    // ✅ Simpan minimal — tidak ada id/sensitive data
    // sessionStorage hanya untuk data UI — email/id selalu dari supabase.auth.getSession()
    sessionStorage.setItem('user', JSON.stringify({ name: userData.name, initials: userData.initials }));

    return () => { cancelled = true; };
  }, [authUser, authLoading]);

  useEffect(() => {
    // Hanya jalan kalau ada user login. Saat ganti user / logout,
    // effect cleanup membersihkan interval lama → saldo akun lama tidak nyangkut.
    const email = authUser?.email;
    if (!email) { setBalance(null); return; }

    let alive = true;
    const loadBalance = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const sessionEmail = session?.user?.email;
        // Pastikan session masih milik user yang sama (hindari race saat ganti akun)
        if (!sessionEmail || sessionEmail !== email) { if (alive) setBalance(0); return; }
        const { data } = await supabase
          .from('transactions')
          .select('type, amount, status')
          .eq('email', sessionEmail);
        if (!alive) return;
        if (!data) { setBalance(0); return; }
        const masuk = data.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
        const keluar = data.filter(t => ['order', 'purchase'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
        setBalance(Math.max(0, masuk - keluar));
      } catch { if (alive) setBalance(0); }
    };
    loadBalance();
    // Auto-refresh saldo setiap 30 detik
    const interval = setInterval(loadBalance, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [authUser?.email]);

  // ── Berita Terbaru: muncul tiap buka dashboard, kecuali user "jangan tampilkan lagi" ──
  // Pengecualian: kalau ada pengumuman baru (updated_at lebih baru dari yang terakhir dilihat), tetap muncul.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('announcements').select('*')
          .order('pinned', { ascending: false })
          .order('updated_at', { ascending: false });
        if (!alive) return;
        const items = data || [];
        setNewsItems(items);
        if (items.length === 0) return;

        // latest = updated_at PALING BARU dari SEMUA item (jangan pakai items[0],
        // karena items diurutkan pinned dulu — items[0] belum tentu yang terbaru).
        const latest = items.reduce((max, a) => {
          const t = a?.updated_at || '';
          return t > max ? t : max;
        }, '');
        let dismissed = false, lastSeen = '';
        try {
          dismissed = localStorage.getItem('ss_news_dismissed') === '1';
          lastSeen = localStorage.getItem('ss_news_last_seen') || '';
        } catch { }

        // Ada berita baru? (latest > lastSeen) — paksa muncul walau sudah dismissed.
        const hasNew = latest && latest !== lastSeen && (!lastSeen || new Date(latest) > new Date(lastSeen));
        if (!dismissed || hasNew) setShowNews(true);
      } catch { }
    })();
    return () => { alive = false; };
  }, [user]);

  const logout = async () => {
    const logoutEmail = authUser?.email;
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      // Bersihkan semua session & local data saat logout
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('dashboard_menu');
      sessionStorage.removeItem('smm_order_ids');
      sessionStorage.removeItem('admin_authed');
      sessionStorage.removeItem('admin_token');
      // Hapus smm_orders agar data order tidak tersisa di device setelah logout
      if (logoutEmail) localStorage.removeItem('smm_orders_' + logoutEmail);
    }
    router.push('/');
  };

  const navItems = [
    { id: 'New Order', icon: <ShoppingCart size={19} /> },
    { id: 'Services', icon: <List size={19} /> },
    { id: 'My Orders', icon: <Package size={19} /> },
    { id: 'Add Funds', icon: <CreditCard size={19} /> },
    { id: 'Transactions', icon: <ArrowLeftRight size={19} /> },
    { id: 'Analytics', icon: <BarChart2 size={19} /> },
    { id: 'Pengumuman', icon: <Newspaper size={19} /> },
    { id: 'Tickets', icon: <Ticket size={19} /> },
    { id: 'Contact', icon: <Phone size={19} /> },
    { id: 'FAQ', icon: <HelpCircle size={19} /> },
  ];
  const navBottom = [
    { id: 'Settings', icon: <Settings size={19} /> },
  ];

  // ✅ useMemo — views tidak re-create tiap render
  const views = useMemo(() => ({
    'New Order': <ViewNewOrder user={user} setMenu={setMenuAndSave} />,
    'Services': <ViewServices />,
    'My Orders': <ViewMyOrders />,
    'Add Funds': <ViewAddFunds user={user} balance={balance} />,
    'Transactions': <ViewTransactions user={user} />,
    'Analytics': <ViewAnalytics user={user} />,
    'Pengumuman': <ViewAnnouncements />,
    'Tickets': <ViewTickets />,
    'Contact': <ViewContact />,
    'FAQ': <ViewFAQ />,
    'Settings': <ViewSettings user={user} onLogout={logout} />,
  }), [user, balance]);

  const SideLink = ({ item }) => {
    const active = menu === item.id;
    return (
      <button onClick={() => { setMenuAndSave(item.id); if (typeof window !== 'undefined' && window.innerWidth < 1024) setSideOpen(false); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: active ? 700 : 600, fontSize: 14, transition: 'all .18s', background: active ? 'var(--blue)' : 'transparent', color: active ? '#fff' : 'var(--text2)', boxShadow: active ? '0 6px 16px rgba(47,107,255,.30)' : 'none' }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg2)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ display: 'flex', color: active ? '#fff' : 'var(--text3)', flexShrink: 0 }}>{item.icon}</span>
        {item.id}
        {active && <ChevronRight size={15} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.85)' }} />}
      </button>
    );
  };

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', fontFamily: "'Inter',sans-serif", fontSize: 14, color: 'var(--text3)' }}>
      Loading...
    </div>
  );

  if (!user) return null;

  return (
    <div className={`root ns-shell${dark ? ' dark' : ''}`} style={{ display: 'flex', overflow: 'hidden', fontFamily: "'Inter',sans-serif" }}>
      <Head>
        {/* Cegah auto-zoom saat tap input di iOS & Android. viewport-fit=cover WAJIB ada
            supaya env(safe-area-inset-bottom) kebaca (home indicator iPhone) — tanpa ini
            env() selalu 0 dan padding bawah jadi salah hitung. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .ns-shell {
          /* 100vh di iOS Safari dihitung dari viewport TERBESAR (saat address bar ngumpet),
             jadi kalau address bar lagi kebuka, layout jadi kelebihan tinggi → muncul area
             kosong yang kebesaran di sidebar (nav flex:1 ikut salah hitung). 100dvh mengikuti
             tinggi viewport yang BENERAN kelihatan saat itu. */
          height: 100vh;
          height: 100dvh;
        }
        @media (max-width: 600px) {
          .ns-top-btn { width: 34px !important; height: 34px !important; border-radius: 9px !important; }
          .ns-topbar { padding: 0 14px !important; gap: 8px !important; }
        }
        .ns-balance-card { isolation: isolate; }
        .ns-balance-pattern {
          position: absolute; inset: 0; pointer-events: none; opacity: .5;
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.16) 1px, transparent 0);
          background-size: 13px 13px;
          -webkit-mask-image: linear-gradient(135deg, #000 0%, transparent 65%);
          mask-image: linear-gradient(135deg, #000 0%, transparent 65%);
        }
        .ns-balance-glow {
          position: absolute; top: -45px; right: -35px; width: 150px; height: 150px;
          border-radius: 50%; pointer-events: none; filter: blur(6px);
          background: radial-gradient(circle, rgba(255,255,255,.22) 0%, transparent 70%);
        }
        .ns-balance-card::after {
          content: ''; position: absolute; top: 0; left: -120%; width: 60%; height: 100%;
          pointer-events: none; transform: skewX(-18deg);
          background: linear-gradient(105deg, transparent, rgba(255,255,255,.2), transparent);
          animation: nsShine 5.5s ease-in-out infinite;
        }
        @keyframes nsShine { 0%, 65% { left: -120%; } 85%, 100% { left: 160%; } }
        @media (prefers-reduced-motion: reduce) { .ns-balance-card::after { display: none; } }
      `}</style>
      {sideOpen && isMobile && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 30 }} />
      )}

      {/* SIDEBAR */}
      <aside style={{ width: sideOpen ? 240 : 0, minWidth: sideOpen ? 240 : 0, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all .25s', position: isMobile ? 'fixed' : 'relative', top: 0, left: 0, bottom: 0, zIndex: 150 }}>
        <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.png" alt="SuntikSosmed" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            SuntikSosmed
          </div>
          <button onClick={() => setSideOpen(false)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 6px', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Balance card */}
        {balance !== null && (
          <div className="ns-balance-card" style={{ position: 'relative', overflow: 'hidden', margin: '0 12px 10px', background: 'linear-gradient(135deg, #2f6bff 0%, #2456e0 55%, #16327f 100%)', borderRadius: 14, padding: '14px 15px', boxShadow: '0 8px 22px rgba(47,107,255,.3), inset 0 1px 0 rgba(255,255,255,.16)' }}>
            <div className="ns-balance-pattern" />
            <div className="ns-balance-glow" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.78)', fontWeight: 700, letterSpacing: '.1em' }}>SALDO SAYA</span>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={14} style={{ color: '#fff' }} />
                </div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', textShadow: '0 2px 8px rgba(0,0,0,.18)' }}>Rp {Math.round(balance || 0).toLocaleString('id-ID')}</div>
              <button onClick={() => setMenuAndSave('Add Funds')} style={{ marginTop: 10, width: '100%', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 9, padding: '7px 10px', fontSize: 11.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, backdropFilter: 'blur(4px)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.28)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.18)'}>
                <CreditCard size={13} /> Add Funds
              </button>
            </div>
          </div>
        )}

        {/* User card */}
        <div style={{ padding: '0 12px 12px' }}>
          <div onClick={() => setMenuAndSave('Settings')} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Avatar seed={user?.email || user?.name} fallback={user?.initials || 'U'} size={36} radius={10} fontSize={13} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>My Account</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </div>
        </div>

        <nav className="ns" style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navItems.map(item => <SideLink key={item.id} item={item} />)}
          </div>
        </nav>

        <div style={{ padding: isMobile ? '10px 12px calc(64px + env(safe-area-inset-bottom, 0px))' : '10px 12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navBottom.map(item => <SideLink key={item.id} item={item} />)}
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--red)', background: 'transparent', transition: 'background .18s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-l)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={19} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: 0 }}>
        {/* Topbar */}
        <div className="ns-topbar" style={{ height: 62, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, position: 'relative', zIndex: 100 }}>
          {/* Logo / hamburger kiri */}
          {!sideOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSideOpen(true)}
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 11, padding: '7px 8px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', transition: 'all .15s' }}>
                <Menu size={17} />
              </button>
              {/* Logo inline saat sidebar tutup */}
              <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#2f6bff,#2456e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(47,107,255,.35)' }}>
                  <img src="/logo.png" alt="SuntikSosmed" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-.02em', fontFamily: "'Inter',sans-serif" }}>
                  Suntik<span style={{ color: 'var(--blue)' }}>Sosmed</span>
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Dashboard</span><ChevronRight size={13} />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{menu}</span>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Dark mode toggle — pill style */}
            <button onClick={toggle} className="ns-top-btn"
              style={{ background: dark ? 'rgba(59,130,246,.15)' : 'var(--bg2)', border: `1px solid ${dark ? 'rgba(59,130,246,.3)' : 'var(--border)'}`, borderRadius: 11, cursor: 'pointer', color: dark ? 'var(--blue)' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, transition: 'all .2s' }}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notif bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }} className="ns-top-btn"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 11, cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, position: 'relative', transition: 'all .15s' }}>
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 5, right: 5, width: 15, height: 15, background: 'var(--red)', borderRadius: '50%', border: '1.5px solid var(--white)', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && !isMobile && (
                <div className="card fu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 320, zIndex: 200, overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Notifikasi {unreadCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '2px 7px', borderRadius: 20, marginLeft: 6 }}>{unreadCount}</span>}</span>
                    {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--blue)', fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>Tandai semua dibaca</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                      <Bell size={28} style={{ color: 'var(--text3)', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                      Tidak ada notifikasi baru
                    </div>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: 'auto' }} className="ns">
                      {notifications.map(n => (
                        <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--blue-l)' }}
                          onClick={() => { markRead(n.id); setMenuAndSave('Tickets'); setNotifOpen(false); }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageCircle size={16} style={{ color: '#fff' }} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Admin membalas tiket kamu</div>
                              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.ticketSubject}</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{new Date(n.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Avatar / profile */}
            <div style={{ position: 'relative' }}>
              <button ref={profileBtnRef} onClick={handleProfileOpen} className="ns-top-btn"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, padding: 0, overflow: 'hidden', fontFamily: "'Inter',sans-serif", transition: 'all .15s' }}>
                <Avatar seed={user?.email || user?.name} fallback={user?.initials?.charAt(0) || 'U'} size={30} radius={9} fontSize={12} />
              </button>
              {profileOpen && !isMobile && (
                <div className="card fu" style={{ position: 'fixed', right: profileDropPos.right, top: profileDropPos.top, width: 220, zIndex: 9999, overflow: 'hidden', padding: '6px 0' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar seed={user?.email || user?.name} fallback={user?.initials?.charAt(0) || 'U'} size={34} radius={10} fontSize={14} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{user?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.email}</div>
                    </div>
                  </div>
                  {[
                    { label: 'My Orders', action: () => setMenuAndSave('My Orders') },
                    { label: 'Settings', action: () => setMenuAndSave('Settings') },
                  ].map(item => (
                    <button key={item.label} onClick={() => { item.action(); setProfileOpen(false); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', fontFamily: "'Inter',sans-serif", transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                    <button onClick={logout} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--red)', fontFamily: "'Inter',sans-serif" }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--red-l)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="ns main-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', paddingBottom: isMobile ? '90px' : '24px' }}
          onClick={() => { if (notifOpen) setNotifOpen(false); if (profileOpen) setProfileOpen(false); }}>
          <Suspense fallback={<ViewSkeleton />}>
            {views[menu]}
          </Suspense>
        </main>

        {/* Toast notification */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, maxWidth: 320, animation: 'fadeUp .3s ease' }}>
            <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--blue)', boxShadow: '0 8px 32px rgba(0,0,0,.15)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageCircle size={18} style={{ color: '#fff' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Admin membalas tiket kamu!</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast.ticketSubject}</div>
                <button onClick={() => { markRead(toast.id); setMenuAndSave('Tickets'); setToast(null); }} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  Lihat Balasan
                </button>
              </div>
              <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, padding: 2 }}>✕</button>
            </div>
          </div>
        )}
      </div>
      {/* MOBILE BOTTOM SHEETS */}
      {isMobile && profileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setProfileOpen(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--white)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 16px' }} />
            {/* User info */}
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar seed={user?.email || user?.name} fallback={user?.initials?.charAt(0) || 'U'} size={40} radius={12} fontSize={16} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.email}</div>
              </div>
            </div>
            {/* Menu items */}
            {[
              { label: 'My Orders', action: () => setMenuAndSave('My Orders') },
              { label: 'Settings', action: () => setMenuAndSave('Settings') },
            ].map(item => (
              <button key={item.label} onClick={() => { item.action(); setProfileOpen(false); }}
                style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: "'Inter',sans-serif", borderBottom: '1px solid var(--border)' }}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { logout(); setProfileOpen(false); }}
              style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 15, fontWeight: 600, color: 'var(--red)', fontFamily: "'Inter',sans-serif" }}>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {isMobile && notifOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setNotifOpen(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--white)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 0' }} />
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Notifikasi {unreadCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '2px 7px', borderRadius: 20, marginLeft: 6 }}>{unreadCount}</span>}</span>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--blue)', fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>Tandai semua dibaca</button>}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }} className="ns">
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                  <Bell size={32} style={{ color: 'var(--text3)', display: 'block', margin: '0 auto 12px' }} />
                  Tidak ada notifikasi baru
                </div>
              ) : notifications.map(n => (
                <div key={n.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => { markRead(n.id); setMenuAndSave('Tickets'); setNotifOpen(false); }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageCircle size={16} style={{ color: '#fff' }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Admin membalas tiket kamu</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.ticketSubject}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{new Date(n.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM NAV — Mobile only */}
      <nav className="bottom-nav-bar">
        {[
          { id: 'New Order', icon: <ShoppingCart size={19} />, label: 'Order' },
          { id: 'My Orders', icon: <Package size={19} />, label: 'Orders' },
          { id: 'Add Funds', icon: <CreditCard size={19} />, label: 'Deposit' },
          { id: 'Tickets', icon: <Ticket size={19} />, label: 'Tickets' },
          { id: 'Settings', icon: <Settings size={19} />, label: 'Settings' },
        ].map(item => {
          const active = menu === item.id;
          return (
            <button key={item.id} onClick={() => setMenuAndSave(item.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                background: active ? 'var(--blue)' : 'transparent', border: 'none', cursor: 'pointer',
                color: active ? '#fff' : 'var(--text3)', fontFamily: "'Inter',sans-serif",
                fontSize: 9.5, fontWeight: 700, padding: '8px 12px', borderRadius: 16,
                transition: 'all .25s cubic-bezier(.4,0,.2,1)', WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ display: 'flex' }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* BERITA TERBARU */}
      {showNews && (
        <NewsPopup
          dark={dark}
          items={newsItems}
          onClose={() => setShowNews(false)}
        />
      )}
    </div>
  );
}