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
            (_event, session) => {
                setUser(session?.user ?? null);
                setAuthError(null); // reset error saat ada perubahan auth
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