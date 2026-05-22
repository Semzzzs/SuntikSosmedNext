import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Lock, Eye, EyeOff, CheckCircle, Zap } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
    const router = useRouter();
    const { dark } = useTheme();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Supabase sets session from URL hash after email link click
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') setReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) return setError('Password minimal 6 karakter.');
        if (password !== confirm) return setError('Password tidak cocok.');
        setLoading(true);
        const { error: err } = await supabase.auth.updateUser({ password });
        setLoading(false);
        // ✅ Jangan expose raw Supabase error ke UI
        if (err) return setError('Gagal menyimpan password. Link mungkin sudah kadaluarsa, minta reset ulang.');
        setDone(true);
        setTimeout(() => router.push('/login'), 3000);
    };

    return (
        <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>

                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div onClick={() => router.push('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 24 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={18} style={{ color: '#fff' }} />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>SuntikSosmed</span>
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Reset Password</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text3)' }}>Masukkan password baru kamu</p>
                </div>

                <div className="card" style={{ padding: 32 }}>
                    {done ? (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <CheckCircle size={28} style={{ color: 'var(--green)' }} />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Password berhasil diubah!</div>
                            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Kamu akan diarahkan ke halaman login...</p>
                        </div>
                    ) : !ready ? (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 16 }}>Memverifikasi link reset...</div>
                            <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', margin: '0 auto' }} className="spin" />
                            <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 16 }}>
                                Jika tidak ada yang terjadi, pastikan kamu membuka link dari email dan belum kadaluarsa.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Password Baru</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" type={showPw ? 'text' : 'password'} style={{ paddingLeft: 38, paddingRight: 42 }}
                                        placeholder="Min. 6 karakter" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
                                    <button type="button" onClick={() => setShowPw(v => !v)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Konfirmasi Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" type={showPw ? 'text' : 'password'} style={{ paddingLeft: 38 }}
                                        placeholder="Ulangi password baru" value={confirm} onChange={e => setConfirm(e.target.value)} />
                                </div>
                            </div>
                            {error && (
                                <div style={{ background: 'var(--red-l)', borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{error}</div>
                            )}
                            <button type="submit" disabled={loading} className="btn btn-blue"
                                style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14.5, marginTop: 4 }}>
                                {loading
                                    ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" />
                                    : 'Simpan Password Baru'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}