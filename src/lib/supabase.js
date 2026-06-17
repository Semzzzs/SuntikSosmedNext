import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Opsi auth ditulis eksplisit (nilainya = default Supabase) supaya jelas dan
// nggak gampang keubah nggak sengaja. Efek: user TETAP login walau browser/tab
// ditutup — session disimpan di localStorage & token diperpanjang otomatis.
//   storage: pakai window.localStorage di browser; undefined saat SSR (Next.js)
//   biar nggak error karena `window` belum ada di server.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,        // simpan session antar buka-tutup browser
        autoRefreshToken: true,      // perpanjang access token otomatis di background
        detectSessionInUrl: true,    // tangani callback OAuth / magic link
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
});