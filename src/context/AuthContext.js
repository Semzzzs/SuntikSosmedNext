import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthCtx = createContext({ user: null, loading: true, authError: null });
export const useAuth = () => useContext(AuthCtx);

// ── Auto sign-out kalau browser ditutup/idle terlalu lama ──
// Supabase Free Plan gak punya fitur "inactivity timeout" bawaan (itu fitur Pro),
// jadi kita implementasikan sendiri: catat waktu terakhir user aktif, dan kalau
// pas buka lagi udah lewat batas ini, paksa sign-out walau token masih valid.
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 jam — ganti angka ini sesuai kebutuhan
const LAST_ACTIVE_KEY = 'ss_last_active';

function markActive() {
    try {
        localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    } catch { }
}

function getElapsedSinceLastActive() {
    try {
        const last = localStorage.getItem(LAST_ACTIVE_KEY);
        if (!last) return null; // belum pernah tercatat (mis. login pertama kali)
        return Date.now() - parseInt(last, 10);
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // ✅ Fix: tambah error state agar komponen bisa bedakan
    //         "belum login" vs "gagal cek session" (network error, misconfigured URL, dll)
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        const elapsed = getElapsedSinceLastActive();
        const expired = elapsed !== null && elapsed > INACTIVITY_LIMIT_MS;

        if (expired) {
            // Browser ditutup/idle lebih lama dari batas — paksa sign-out
            // walau token di localStorage masih teknisnya valid.
            supabase.auth.signOut().finally(() => {
                try { localStorage.removeItem(LAST_ACTIVE_KEY); } catch { }
                setUser(null);
                setLoading(false);
            });
        } else {
            // Cek session yang sudah ada saat refresh
            supabase.auth.getSession().then(({ data: { session }, error }) => {
                // ✅ Fix: tangani error getSession — jangan diam-diam treat sebagai "tidak login"
                if (error) {
                    console.error('[AuthContext] getSession error:', error.message);
                    setAuthError(error.message);
                }
                setUser(session?.user ?? null);
                setLoading(false);
                if (session?.user) markActive();
            });
        }

        // Listen perubahan login/logout
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user ?? null);
                // ✅ Fix: JANGAN reset authError saat INITIAL_SESSION.
                //         onAuthStateChange nge-emit INITIAL_SESSION pas mount lewat
                //         callback ini. Kalau di-reset di sini, error dari getSession()
                //         (network / refresh token gagal) bisa ke-wipe secara racy.
                //         Reset hanya pada perubahan auth yang sebenarnya.
                if (event !== 'INITIAL_SESSION') setAuthError(null);
                setLoading(false);
                if (session?.user) markActive();
            }
        );

        // Catat waktu terakhir aktif — dipakai buat ngitung berapa lama
        // browser ditutup/idle waktu dibuka lagi.
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') markActive();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', markActive);
        window.addEventListener('beforeunload', markActive);
        // Update berkala juga selagi tab aktif — jaga-jaga kalau event di atas
        // gak sempat kepanggil (mis. app di-kill paksa oleh OS Android).
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') markActive();
        }, 60 * 1000);

        return () => {
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pagehide', markActive);
            window.removeEventListener('beforeunload', markActive);
            clearInterval(interval);
        };
    }, []);

    return (
        <AuthCtx.Provider value={{ user, loading, authError }}>
            {children}
        </AuthCtx.Provider>
    );
}