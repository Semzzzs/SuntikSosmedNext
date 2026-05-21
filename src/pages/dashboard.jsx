import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/router';
import {
  ShoppingCart, Package, CreditCard,
  ChevronRight, ChevronLeft, Bell, Moon, Sun, LogOut, Settings,
  Target, ChevronDown, X, Menu, Ticket, Phone, BarChart2, ArrowLeftRight, HelpCircle, MessageCircle, Newspaper
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useApi } from '@/context/ApiContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

// Lazy load semua view — hanya di-load saat pertama kali dibuka
const ViewNewOrder = lazy(() => import('@/components/dashboard/ViewNewOrder'));
const ViewMyOrders = lazy(() => import('@/components/dashboard/ViewMyOrders'));
const ViewAddFunds = lazy(() => import('@/components/dashboard/ViewAddFunds'));
const ViewNotifications = lazy(() => import('@/components/dashboard/ViewNotifications'));
const ViewTickets = lazy(() => import('@/components/dashboard/ViewTickets'));
const ViewContact = lazy(() => import('@/components/dashboard/ViewContact'));
const ViewAnalytics = lazy(() => import('@/components/dashboard/ViewAnalytics'));
const ViewTransactions = lazy(() => import('@/components/dashboard/ViewTransactions'));
const ViewSettings = lazy(() => import('@/components/dashboard/ViewSettings'));
const ViewAnnouncements = lazy(() => import('@/components/dashboard/ViewAnnouncements'));

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
  const [sideOpen, setSideOpen] = useState(true);

  const setMenuAndSave = (m) => {
    setMenu(m);
    sessionStorage.setItem('dashboard_menu', m);
  };
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(user);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const prevUnread = useState(0);

  useEffect(() => {
    if (unreadCount > 0 && notifications.length > 0) {
      const latest = notifications[0];
      setToast(latest);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [unreadCount]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
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

    const userData = {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      initials: ((authUser.user_metadata?.full_name || authUser.email || 'U').charAt(0)).toUpperCase(),
    };
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
  }, [authUser, authLoading]);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) { setBalance(0); return; }
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('email', email);
        if (!data) { setBalance(0); return; }
        const masuk = data.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
        const keluar = data.filter(t => t.type === 'order').reduce((s, t) => s + (t.amount || 0), 0);
        setBalance(Math.max(0, masuk - keluar));
      } catch { setBalance(0); }
    };
    loadBalance();
    // Auto-refresh saldo setiap 30 detik
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') sessionStorage.removeItem('user');
    router.push('/');
  };

  const navItems = [
    { id: 'New Order', icon: <ShoppingCart size={17} /> },
    { id: 'My Orders', icon: <Package size={17} /> },
    { id: 'Add Funds', icon: <CreditCard size={17} /> },
    { id: 'Transactions', icon: <ArrowLeftRight size={17} /> },
    { id: 'Analytics', icon: <BarChart2 size={17} /> },
    { id: 'Pengumuman', icon: <Newspaper size={17} /> },
    { id: 'Tickets', icon: <Ticket size={17} /> },
    { id: 'Contact', icon: <Phone size={17} /> },
    { id: 'FAQ', icon: <HelpCircle size={17} /> },
  ];
  const navBottom = [
    { id: 'Settings', icon: <Settings size={17} /> },
  ];

  const views = {
    'New Order': <ViewNewOrder user={user} setMenu={setMenu} />,
    'My Orders': <ViewMyOrders />,
    'Add Funds': <ViewAddFunds user={user} balance={balance} />,
    'Transactions': <ViewTransactions user={user} />,
    'Analytics': <ViewAnalytics user={user} />,
    'Pengumuman': <ViewAnnouncements />,
    'Tickets': <ViewTickets />,
    'Contact': <ViewContact />,
    'FAQ': <ViewNotifications />,
    'Settings': <ViewSettings user={user} onLogout={logout} />,
  };

  const SideLink = ({ item }) => (
    <button onClick={() => { setMenuAndSave(item.id); if (typeof window !== 'undefined' && window.innerWidth < 1024) setSideOpen(false); }}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 13.5, transition: 'all .18s', background: menu === item.id ? 'var(--blue)' : 'transparent', color: menu === item.id ? '#fff' : 'var(--text2)' }}
      onMouseEnter={e => { if (menu !== item.id) e.currentTarget.style.background = 'var(--bg2)'; }}
      onMouseLeave={e => { if (menu !== item.id) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ color: menu === item.id ? '#fff' : 'var(--text3)' }}>{item.icon}</span>
      {item.id}
      {menu === item.id && <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.6)' }} />}
    </button>
  );

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: 'var(--text3)' }}>
      Loading...
    </div>
  );

  if (!user) return null;

  return (
    <div className={`root${dark ? ' dark' : ''}`} style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {sideOpen && typeof window !== 'undefined' && window.innerWidth < 1024 && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 30 }} />
      )}

      {/* SIDEBAR */}
      <aside style={{ width: sideOpen ? 240 : 0, minWidth: sideOpen ? 240 : 0, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all .25s', position: typeof window !== 'undefined' && window.innerWidth < 768 ? 'fixed' : 'relative', top: 0, left: 0, bottom: 0, zIndex: 40 }}>
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
          <div style={{ margin: '0 12px 10px', background: 'var(--blue)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 600, marginBottom: 2 }}>SALDO SAYA</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Rp {(typeof balance === 'number' ? balance : Math.round(parseFloat(balance || 0) * rate)).toLocaleString('id-ID')}</div>
            <button onClick={() => setMenuAndSave('Add Funds')} style={{ marginTop: 8, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>+ Add Funds</button>
          </div>
        )}

        {/* User card */}
        <div style={{ padding: '0 12px 12px' }}>
          <div onClick={() => setMenuAndSave('Settings')} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
              {user?.initials || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>My Account</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </div>
        </div>

        <nav className="ns" style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(item => <SideLink key={item.id} item={item} />)}
          </div>
        </nav>

        <div style={{ padding: '10px 10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navBottom.map(item => <SideLink key={item.id} item={item} />)}
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--red)', background: 'transparent', transition: 'background .18s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-l)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: 0 }}>
        {/* Topbar */}
        <div style={{ height: 58, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 }}>
          {!sideOpen && (
            <button onClick={() => setSideOpen(true)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', marginRight: 8 }}>
              <Menu size={17} />
            </button>
          )}
          <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Dashboard</span><ChevronRight size={13} />
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{menu}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={toggle} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', position: 'relative' }}>
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: 'var(--red)', borderRadius: '50%', border: '1.5px solid var(--white)', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && !isMobile && (
                <div className="card fu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 320, zIndex: 200, overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Notifikasi {unreadCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '2px 7px', borderRadius: 20, marginLeft: 6 }}>{unreadCount}</span>}</span>
                    {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--blue)', fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Tandai semua dibaca</button>}
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
            <div style={{ position: 'relative' }}>
              <button ref={profileBtnRef} onClick={handleProfileOpen} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{user?.initials?.charAt(0) || 'U'}</div>
              </button>
              {profileOpen && !isMobile && (
                <div className="card fu" style={{ position: 'fixed', right: profileDropPos.right, top: profileDropPos.top, width: 220, zIndex: 9999, overflow: 'hidden', padding: '6px 0' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{user?.initials?.charAt(0) || 'U'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{user?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.email}</div>
                    </div>
                  </div>
                  {[
                    { label: 'My Orders', action: () => setMenuAndSave('My Orders') },
                    { label: 'Settings', action: () => setMenuAndSave('Settings') },
                  ].map(item => (
                    <button key={item.label} onClick={() => { item.action(); setProfileOpen(false); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                    <button onClick={logout} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--red)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
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

        <main className="ns main-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}
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
                <button onClick={() => { markRead(toast.id); setMenuAndSave('Tickets'); setToast(null); }} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
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
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{user?.initials?.charAt(0) || 'U'}</div>
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
                style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans',sans-serif", borderBottom: '1px solid var(--border)' }}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { logout(); setProfileOpen(false); }}
              style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 15, fontWeight: 600, color: 'var(--red)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
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
              {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--blue)', fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Tandai semua dibaca</button>}
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

      {/* BOTTOM NAV — Mobile only */}
      <nav className="bottom-nav-bar">
        {[
          { id: 'New Order', icon: <ShoppingCart size={20} /> },
          { id: 'My Orders', icon: <Package size={20} /> },
          { id: 'Add Funds', icon: <CreditCard size={20} /> },
          { id: 'Tickets', icon: <Ticket size={20} /> },
          { id: 'Settings', icon: <Settings size={20} /> },
        ].map(item => (
          <button key={item.id} onClick={() => setMenuAndSave(item.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: menu === item.id ? 'var(--blue)' : 'var(--text3)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 10, fontWeight: 700, padding: '4px 0' }}>
            {item.icon}
            <span>{item.id === 'New Order' ? 'Order' : item.id === 'Add Funds' ? 'Deposit' : item.id}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}