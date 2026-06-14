import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthCtx = createContext({ user: null, loading: true, authError: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // ✅ Fix: tambah error state agar komponen bisa bedakan
    //         "belum login" vs "gagal cek session" (network error, misconfigured URL, dll)
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        // Cek session yang sudah ada saat refresh
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            // ✅ Fix: tangani error getSession — jangan diam-diam treat sebagai "tidak login"
            if (error) {
                console.error('[AuthContext] getSession error:', error.message);
                setAuthError(error.message);
            }
            setUser(session?.user ?? null);
            setLoading(false);
        });

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
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthCtx.Provider value={{ user, loading, authError }}>
            {children}
        </AuthCtx.Provider>
    );
}