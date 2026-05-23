import { useState, useEffect } from 'react';
import { Sun, Moon, User, Mail, Phone, Globe, Camera, Smartphone, Trash2, CheckCircle, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

const NOTIF_KEY = 'user_notif_prefs';
// ✅ Fix: PROFILE_KEY dihapus — phone & website sekarang disimpan ke Supabase profiles

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

  const tabs = ['Profile', 'Security', 'Notifications', 'Appearance'];

  const Toggle = ({ on, onChange }) => (
    <div onClick={onChange} style={{ width: 42, height: 23, borderRadius: 12, background: on ? 'var(--blue)' : 'var(--bg2)', border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', padding: '2px 3px', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
      <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transform: on ? 'translateX(19px)' : 'translateX(0)', transition: 'transform .2s' }} />
    </div>
  );

  return (
    <div className="fu">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Manage your account preferences.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 9, border: `1.5px solid ${tab === t ? 'var(--blue)' : 'var(--border)'}`, background: tab === t ? 'var(--blue-l)' : 'transparent', color: tab === t ? 'var(--blue)' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .18s' }}>{t}</button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === 'Profile' && (
        <div className="card" style={{ padding: 26 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 26 }}>
            <div style={{ width: 68, height: 68, borderRadius: 18, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, flexShrink: 0 }}>
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 2 }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>{user?.email || ''}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" defaultValue={user?.name || ''} style={{ paddingLeft: 34, fontSize: 13.5 }} readOnly />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" defaultValue={user?.email || ''} style={{ paddingLeft: 34, fontSize: 13.5 }} readOnly />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+62 xxx xxxx xxxx" style={{ paddingLeft: 34, fontSize: 13.5 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Website</label>
              <div style={{ position: 'relative' }}>
                <Globe size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" value={website} onChange={e => setWebsite(e.target.value)} placeholder="yourwebsite.com" style={{ paddingLeft: 34, fontSize: 13.5 }} />
              </div>
            </div>
          </div>
          {saved && (
            <div style={{ marginTop: 14, background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 9, padding: '9px 13px', fontSize: 13, fontWeight: 600, color: 'var(--green)', display: 'flex', gap: 7, alignItems: 'center' }}>
              <CheckCircle size={14} /> Profile saved!
            </div>
          )}
          <button className="btn btn-blue" onClick={handleSaveProfile} style={{ marginTop: 18, borderRadius: 10, padding: '11px 22px' }}>
            Save Changes <CheckCircle size={14} />
          </button>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'Security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={15} style={{ color: 'var(--blue)' }} /> Change Password
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { l: 'Current Password', k: 'cur' },
                { l: 'New Password', k: 'new' },
                { l: 'Confirm New Password', k: 'con' },
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
              <button className="btn btn-blue" onClick={handleUpdatePassword} style={{ borderRadius: 10, padding: '11px 22px', width: 'fit-content', marginTop: 4 }}>Update Password</button>
            </div>
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>Two-Factor Authentication</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Add an extra layer of security to your account.</div>
            </div>
            <button className="btn btn-outline" style={{ borderRadius: 9, padding: '9px 14px', fontSize: 13, flexShrink: 0 }}>
              <Smartphone size={13} /> Enable 2FA
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'Notifications' && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: 'var(--text)' }}>Notification Preferences</div>
          {[
            { key: 'orderCompleted', l: 'Order completed', d: 'Get notified when an order finishes' },
            { key: 'orderDelayed', l: 'Order delayed', d: 'Alert if delivery takes longer than expected' },
            { key: 'lowBalance', l: 'Low balance warning', d: 'Remind me when balance is below $10' },
            { key: 'promoOffers', l: 'Promotional offers', d: 'Flash sales and special deals' },
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Color Theme</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: false, label: 'Light Mode', icon: <Sun size={20} />, desc: 'Clean and bright' },
                { id: true, label: 'Dark Mode', icon: <Moon size={20} />, desc: 'Easy on the eyes' },
              ].map(t => (
                <button key={t.label} onClick={() => { if (dark !== t.id) toggle(); }}
                  style={{ flex: 1, padding: '18px 16px', borderRadius: 14, border: `2px solid ${dark === t.id ? 'var(--blue)' : 'var(--border)'}`, background: dark === t.id ? 'var(--blue-l)' : 'var(--bg2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .18s' }}>
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
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--red)', marginBottom: 6 }}>Danger Zone</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Sign out */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Sign Out</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Keluar dari sesi ini.</div>
                </div>
                <button onClick={onLogout} className="btn" style={{ background: 'transparent', color: 'var(--red)', border: '1.5px solid var(--red)', borderRadius: 9, padding: '8px 14px', fontSize: 13, flexShrink: 0 }}>
                  Sign Out
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
                          style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
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
                            const res = await fetch('/api/admin-api?action=delete_user', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                              body: JSON.stringify({ email: session.user.email }),
                            });
                            setDeleteLoading(false);
                            if (res.ok) { setShowDeleteModal(false); onLogout(); }
                            else { setDeleteError('Gagal menghapus akun. Hubungi admin.'); }
                          }}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
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