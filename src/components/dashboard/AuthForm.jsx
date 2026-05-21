import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';
import { Target, Moon, Sun, User, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function AuthForm({ type }) {
    const router = useRouter();
    const { dark, toggle } = useTheme();
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [registerSuccess, setRegisterSuccess] = useState(false);

    useEffect(() => {
        if (window.location.search.includes('registered=1')) setRegisterSuccess(true);
    }, []);

    const checkBlocked = async (email) => {
        const { data } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
        if (data?.value) {
            const blocked = JSON.parse(data.value);
            return blocked.includes(email);
        }
        return false;
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (type === 'login') {
                const isBlocked = await checkBlocked(form.email);
                if (isBlocked) {
                    setError('Akun kamu telah diblokir. Hubungi admin untuk informasi lebih lanjut.');
                    setLoading(false);
                    return;
                }
                const { error: err } = await supabase.auth.signInWithPassword({
                    email: form.email,
                    password: form.password,
                });
                if (err) { setError('Email atau password salah.'); setLoading(false); return; }
                router.push('/dashboard');
            } else {
                const { error: err } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                    options: { data: { full_name: form.name } },
                });
                if (err) { setError(err.message); setLoading(false); return; }
                router.push('/login?registered=1');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        }
        setLoading(false);
    };

    return (
        <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, borderRadius: '50%', border: '60px solid rgba(37,99,235,.06)', pointerEvents: 'none' }} />
            <button onClick={toggle} style={{ position: 'fixed', top: 20, right: 20, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', boxShadow: 'var(--shadow)' }}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="card fu" style={{ width: '100%', maxWidth: 400, padding: '36px 32px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div onClick={() => router.push('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 20, color: 'var(--text)', cursor: 'pointer', marginBottom: 20 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={20} style={{ color: 'var(--blue)' }} strokeWidth={2.5} />
                        </div>
                        SuntikSosmed
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                        {type === 'login' ? 'Welcome Back!' : 'Create Account'}
                    </h2>
                    <p style={{ color: 'var(--text2)', fontSize: 14 }}>
                        {type === 'login' ? 'Sign in to access dashboard' : 'Join SuntikSosmed to grow'}
                    </p>
                </div>

                {registerSuccess && (
                    <div style={{ background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
                        Registrasi berhasil! Silakan login.
                    </div>
                )}
                {error && (
                    <div style={{ background: 'var(--red-l)', borderRadius: 9, padding: '10px 13px', marginBottom: 14, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                        {error}
                    </div>
                )}
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {type === 'register' && (
                        <div style={{ position: 'relative' }}>
                            <User size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                            <input className="inp" style={{ paddingLeft: 38 }} placeholder="Full Name" required onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                        <input className="inp" style={{ paddingLeft: 38 }} type="email" placeholder="Email Address" required onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                        <input className="inp" style={{ paddingLeft: 38, paddingRight: 40 }} type={showPw ? 'text' : 'password'} placeholder="Password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    <button className="btn btn-blue" type="submit" style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14, marginTop: 4 }} disabled={loading}>
                        {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" />}
                        {loading ? 'Please wait...' : type === 'login' ? 'Sign In' : 'Create Account'}
                        {!loading && <ArrowRight size={15} />}
                    </button>
                </form>

                {type === 'login' && (
                    <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: 'var(--blue)', cursor: 'pointer', fontWeight: 600 }}>
                        Lupa password?
                    </p>
                )}
                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--text2)' }}>
                    {type === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <span onClick={() => router.push(type === 'login' ? '/register' : '/login')} style={{ color: 'var(--blue)', cursor: 'pointer', fontWeight: 700 }}>
                        {type === 'login' ? 'Sign up' : 'Sign in'}
                    </span>
                </div>
            </div>
        </div>
    );
}