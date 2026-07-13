import { useState, useEffect } from 'react';
import { Sun, Moon, User, Mail, Phone, Globe, Smartphone, Trash2, CheckCircle, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

const NOTIF_KEY = 'user_notif_prefs';
// ✅ Fix: PROFILE_KEY dihapus — phone & website sekarang disimpan ke Supabase profiles

// ── Avatar inisial warna-warni: warna di-generate dari string (email/nama),
//    konsisten — user yang sama selalu dapat warna yang sama. ──
const AVATAR_COLORS = [
  ['#2563EB', '#1D4ED8'], ['#059669', '#047857'], ['#DC2626', '#B91C1C'],
  ['#7C3AED', '#6D28D9'], ['#DB2777', '#BE185D'], ['#EA580C', '#C2410C'],
  ['#0891B2', '#0E7490'], ['#CA8A04', '#A16207'], ['#4F46E5', '#4338CA'],
  ['#16A34A', '#15803D'],
];
function avatarColor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name = '', email = '') {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.charAt(0).toUpperCase();
}

// ── Avatar gambar otomatis (DiceBear "avataaars") — unik & konsisten per user.
//    Tidak perlu upload; seed dari email/nama. ──
function avatarUrl(seed = '') {
  const s = encodeURIComponent((seed || 'user').trim().toLowerCase());
  // backgroundColor: kumpulan warna pastel; DiceBear pilih satu secara konsisten per seed.
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${s}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8e6c9,fff9c4`;
}

// ── Validasi: hanya berlaku kalau field DIISI (boleh dikosongkan). ──
// Telepon: digit Indonesia, boleh diawali + atau 0, panjang wajar 9–15 digit.
function validatePhone(v) {
  const s = (v || '').trim();
  if (!s) return null; // kosong = boleh
  const cleaned = s.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return 'Nomor telepon hanya boleh angka.';
  const digits = cleaned.replace(/^\+/, '');
  if (digits.length < 9 || digits.length > 15) return 'Nomor telepon tidak valid (9–15 digit).';
  return null;
}
// Website: harus terlihat seperti domain/URL (ada titik + TLD), http(s) opsional.
function validateWebsite(v) {
  const s = (v || '').trim();
  if (!s) return null; // kosong = boleh
  const re = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/[\w\-./?%&=#]*)?$/i;
  if (!re.test(s)) return 'Format website tidak valid (contoh: namasitus.com).';
  return null;
}

export default function ViewSettings({ user, onLogout }) {
  const { dark, toggle } = useTheme();
  const [tab, setTab] = useState('Profile');
  const [showPw, setShowPw] = useState({ cur: false, new: false, con: false });
  const [saved, setSaved] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Profile fields
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [profileErr, setProfileErr] = useState({ phone: '', website: '' });

  // Password fields
  const [pw, setPw] = useState({ cur: '', new: '', con: '' });

  // Notification prefs - load from localStorage
  const [notifs, setNotifs] = useState({
    orderCompleted: true,
    orderDelayed: true,
    lowBalance: true,
    promoOffers: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // ✅ Fix High: load phone & website dari Supabase profiles, bukan localStorage
    // localStorage tidak terikat akun dan tidak terhapus saat logout
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      supabase.from('profiles')
        .select('phone, website')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.phone) setPhone(data.phone);
          if (data?.website) setWebsite(data.website);
        });
    });
    // Notification prefs tetap di localStorage (device-local preference, tidak sensitif)
    const savedNotifs = JSON.parse(localStorage.getItem(NOTIF_KEY) || 'null');
    if (savedNotifs) setNotifs(savedNotifs);
  }, []);

  const handleSaveProfile = async () => {
    // ✅ Validasi dulu — hanya field yang diisi yang dicek
    const pErr = validatePhone(phone);
    const wErr = validateWebsite(website);
    setProfileErr({ phone: pErr || '', website: wErr || '' });
    if (pErr || wErr) return; // batalkan simpan kalau ada yang tidak valid

    // ✅ Fix High: simpan ke Supabase profiles, bukan localStorage
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      phone: phone.trim(),
      website: website.trim(),
      updated_at: new Date().toISOString(),
    });
    if (error) { console.error('[ViewSettings] gagal simpan profil:', error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleNotif = (key) => {
    setNotifs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdatePassword = async () => {
    if (!pw.cur) return setPwMsg({ type: 'error', text: 'Masukkan password saat ini.' });
    if (pw.new.length < 6) return setPwMsg({ type: 'error', text: 'Password baru minimal 6 karakter.' });
    if (pw.new !== pw.con) return setPwMsg({ type: 'error', text: 'Konfirmasi password tidak cocok.' });

    // ✅ Fix Medium: ambil email dari session Supabase, bukan prop user
    // Prop user berasal dari sessionStorage yang bisa dimanipulasi
    const { data: { session } } = await supabase.auth.getSession();
    const authEmail = session?.user?.email;
    if (!authEmail) return setPwMsg({ type: 'error', text: 'Sesi tidak valid. Silakan login ulang.' });

    // Verifikasi password lama via Supabase re-auth
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: pw.cur,
    });
    if (signInErr) return setPwMsg({ type: 'error', text: 'Password saat ini salah.' });

    // Update password via Supabase
    const { error: updateErr } = await supabase.auth.updateUser({ password: pw.new });
    // ✅ Fix Medium: jangan expose raw error Supabase ke UI
    if (updateErr) {
      console.error('[ViewSettings] updateUser error:', updateErr.message);
      return setPwMsg({ type: 'error', text: 'Gagal memperbarui password. Coba lagi.' });
    }

    setPw({ cur: '', new: '', con: '' });
    setPwMsg({ type: 'success', text: 'Password berhasil diperbarui!' });
    setTimeout(() => setPwMsg({ type: '', text: '' }), 3000);
  };

  const tabs = [
    { id: 'Profile', label: 'Profil' },
    { id: 'Security', label: 'Keamanan' },
    { id: 'Notifications', label: 'Notifikasi' },
    { id: 'Appearance', label: 'Tampilan' },
  ];

  const Toggle = ({ on, onChange }) => (
    <div onClick={onChange} style={{ width: 42, height: 23, borderRadius: 12, background: on ? 'var(--blue)' : 'var(--bg2)', border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', padding: '2px 3px', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
      <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transform: on ? 'translateX(19px)' : 'translateX(0)', transition: 'transform .2s' }} />
    </div>
  );

  return (
    <div className="fu">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Pengaturan</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Kelola preferensi akun kamu.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 16px', borderRadius: 9, border: `1.5px solid ${tab === t.id ? 'var(--blue)' : 'var(--border)'}`, background: tab === t.id ? 'var(--blue-l)' : 'transparent', color: tab === t.id ? 'var(--blue)' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all .18s' }}>{t.label}</button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === 'Profile' && (
        <div className="card" style={{ padding: 26 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 26 }}>
            <div style={{ width: 68, height: 68, borderRadius: 18, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,.12)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={avatarUrl(user?.email || user?.name)}
                alt="Avatar"
                width={68} height={68}
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback: kalau gambar gagal load, tampilkan inisial
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextSibling;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <span style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 24, letterSpacing: '.5px' }}>
                {initials(user?.name, user?.email)}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 2 }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>{user?.email || ''}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Nama Lengkap</label>
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" defaultValue={user?.name || ''} style={{ paddingLeft: 34, fontSize: 13.5 }} readOnly />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" defaultValue={user?.email || ''} style={{ paddingLeft: 34, fontSize: 13.5 }} readOnly />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Nomor Telepon</label>
              <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" value={phone}
                  onChange={e => { setPhone(e.target.value); if (profileErr.phone) setProfileErr(p => ({ ...p, phone: '' })); }}
                  placeholder="+62 xxx xxxx xxxx"
                  style={{ paddingLeft: 34, fontSize: 13.5, borderColor: profileErr.phone ? 'var(--red)' : undefined }} />
              </div>
              {profileErr.phone && (
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> {profileErr.phone}
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Website</label>
              <div style={{ position: 'relative' }}>
                <Globe size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" value={website}
                  onChange={e => { setWebsite(e.target.value); if (profileErr.website) setProfileErr(p => ({ ...p, website: '' })); }}
                  placeholder="yourwebsite.com"
                  style={{ paddingLeft: 34, fontSize: 13.5, borderColor: profileErr.website ? 'var(--red)' : undefined }} />
              </div>
              {profileErr.website && (
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> {profileErr.website}
                </div>
              )}
            </div>
          </div>
          {saved && (
            <div style={{ marginTop: 14, background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 9, padding: '9px 13px', fontSize: 13, fontWeight: 600, color: 'var(--green)', display: 'flex', gap: 7, alignItems: 'center' }}>
              <CheckCircle size={14} /> Profil tersimpan!
            </div>
          )}
          <button className="btn btn-blue" onClick={handleSaveProfile} style={{ marginTop: 18, borderRadius: 10, padding: '11px 22px' }}>
            Simpan Perubahan <CheckCircle size={14} />
          </button>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'Security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={15} style={{ color: 'var(--blue)' }} /> Ubah Password
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { l: 'Password Saat Ini', k: 'cur' },
                { l: 'Password Baru', k: 'new' },
                { l: 'Konfirmasi Password Baru', k: 'con' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>{f.l}</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input className="inp" type={showPw[f.k] ? 'text' : 'password'} value={pw[f.k]} onChange={e => setPw(p => ({ ...p, [f.k]: e.target.value }))} placeholder="••••••••" style={{ paddingLeft: 34, paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPw(p => ({ ...p, [f.k]: !p[f.k] }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                      {showPw[f.k] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              {pwMsg.text && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: pwMsg.type === 'error' ? 'var(--red-l)' : 'var(--green-l)', color: pwMsg.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {pwMsg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {pwMsg.text}
                </div>
              )}
              <button className="btn btn-blue" onClick={handleUpdatePassword} style={{ borderRadius: 10, padding: '11px 22px', width: 'fit-content', marginTop: 4 }}>Perbarui Password</button>
            </div>
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>Autentikasi Dua Faktor</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Tambah lapisan keamanan ekstra untuk akun kamu.</div>
            </div>
            <button className="btn btn-outline" disabled title="Fitur ini belum tersedia" style={{ borderRadius: 9, padding: '9px 14px', fontSize: 13, flexShrink: 0, cursor: 'not-allowed', opacity: 0.6 }}>
              <Smartphone size={13} /> Segera Hadir
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'Notifications' && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: 'var(--text)' }}>Preferensi Notifikasi</div>
          {[
            { key: 'orderCompleted', l: 'Pesanan selesai', d: 'Beri tahu saat pesanan selesai diproses' },
            { key: 'orderDelayed', l: 'Pesanan tertunda', d: 'Peringatkan jika pengiriman lebih lama dari biasanya' },
            { key: 'lowBalance', l: 'Saldo menipis', d: 'Ingatkan saat saldo di bawah Rp5.000' },
            { key: 'promoOffers', l: 'Penawaran promo', d: 'Flash sale & penawaran spesial' },
          ].map((n, i, arr) => (
            <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: 2 }}>{n.l}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{n.d}</div>
              </div>
              <Toggle on={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
            </div>
          ))}
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {tab === 'Appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Tema Warna</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: false, label: 'Mode Terang', icon: <Sun size={20} />, desc: 'Bersih & terang' },
                { id: true, label: 'Mode Gelap', icon: <Moon size={20} />, desc: 'Nyaman di mata' },
              ].map(t => (
                <button key={t.label} onClick={() => { if (dark !== t.id) toggle(); }}
                  style={{ flex: 1, padding: '18px 16px', borderRadius: 14, border: `2px solid ${dark === t.id ? 'var(--blue)' : 'var(--border)'}`, background: dark === t.id ? 'var(--blue-l)' : 'var(--bg2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontFamily: "'Outfit',sans-serif", transition: 'all .18s' }}>
                  <span style={{ color: dark === t.id ? 'var(--blue)' : 'var(--text2)' }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: dark === t.id ? 'var(--blue)' : 'var(--text2)', marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.desc}</div>
                  </div>
                  {dark === t.id && <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={12} style={{ color: '#fff' }} /></div>}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20, border: '1.5px solid rgba(239,68,68,.2)', background: 'var(--red-l)' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--red)', marginBottom: 6 }}>Zona Berbahaya</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Sign out */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Keluar</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Keluar dari sesi ini.</div>
                </div>
                <button onClick={onLogout} className="btn" style={{ background: 'transparent', color: 'var(--red)', border: '1.5px solid var(--red)', borderRadius: 9, padding: '8px 14px', fontSize: 13, flexShrink: 0 }}>
                  Keluar
                </button>
              </div>
              {/* ✅ Fix High: "Delete Account" sekarang benar-benar request hapus akun */}
              <div style={{ borderTop: '1px solid rgba(239,68,68,.2)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 2 }}>Hapus Akun</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 220, lineHeight: 1.5 }}>Permanen dan tidak bisa dibatalkan. Semua data akan dihapus.</div>
                </div>
                <button
                  onClick={() => { setShowDeleteModal(true); setDeleteEmailInput(''); setDeleteError(''); }}
                  className="btn" style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Trash2 size={14} /> Hapus Akun
                </button>

                {/* Modal Konfirmasi Hapus Akun */}
                {showDeleteModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={18} style={{ color: 'var(--red)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Hapus Akun</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tindakan ini tidak bisa dibatalkan</div>
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                        Semua data akun dan transaksi akan dihapus permanen. Ketik email kamu untuk konfirmasi.
                      </p>
                      <input
                        className="inp"
                        type="email"
                        placeholder="Email kamu"
                        value={deleteEmailInput}
                        onChange={e => { setDeleteEmailInput(e.target.value); setDeleteError(''); }}
                        style={{ width: '100%', fontSize: 13, marginBottom: 10 }}
                      />
                      {deleteError && (
                        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--red-l)', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                          {deleteError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => { setShowDeleteModal(false); setDeleteError(''); }}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                          Batal
                        </button>
                        <button
                          disabled={deleteLoading}
                          onClick={async () => {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!deleteEmailInput || deleteEmailInput.trim() !== session?.user?.email) {
                              setDeleteError('Email tidak cocok. Periksa kembali.');
                              return;
                            }
                            setDeleteLoading(true);
                            const res = await fetch('/api/account/delete', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                            });
                            setDeleteLoading(false);
                            if (res.ok) { setShowDeleteModal(false); onLogout(); }
                            else { setDeleteError('Gagal menghapus akun. Hubungi admin.'); }
                          }}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1, fontFamily: "'Outfit',sans-serif" }}>
                          {deleteLoading ? 'Menghapus...' : 'Ya, Hapus Akun'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}