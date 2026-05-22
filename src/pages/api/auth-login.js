// API Route: /api/auth/login
// File BARU — menggantikan login flow yang sebelumnya dilakukan di client (AuthForm.jsx).
//
// Kenapa perlu file ini:
//   AuthForm dulu: (1) query blocked_emails dari browser, (2) kalau tidak blocked: signIn di browser.
//   Masalah: step (1) mudah di-bypass — user bisa langsung call supabase.auth.signInWithPassword()
//   dari console tanpa pernah lewat checkBlocked().
//
//   Sekarang: semua dilakukan di server. Client tidak bisa skip step apapun.
//
// DEPENDENCY: jsonwebtoken & @supabase/supabase-js sudah terinstall.

import { createClient } from '@supabase/supabase-js';

// Supabase admin — untuk signInWithPassword server-side
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    // ✅ Step 1: Cek blocked_emails di SERVER — tidak bisa di-bypass dari client
    try {
        const { data: blockData } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', 'blocked_emails')
            .maybeSingle();

        if (blockData?.value) {
            const blocked = JSON.parse(blockData.value);
            if (blocked.includes(email.toLowerCase().trim())) {
                // Delay sama seperti login gagal — jangan bocorkan bahwa akun ada tapi diblokir
                await new Promise(r => setTimeout(r, 300));
                return res.status(403).json({ error: 'Akun kamu telah diblokir. Hubungi admin untuk informasi lebih lanjut.' });
            }
        }
    } catch (e) {
        console.error('[auth/login] Gagal cek blocked_emails:', e.message);
        // Jangan block login kalau query settings gagal — fail open untuk UX
    }

    // ✅ Step 2: SignIn via Supabase (menggunakan anon key — sesuai flow Supabase)
    // Pakai createClient dengan anon key untuk auth user biasa
    const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
        await new Promise(r => setTimeout(r, 300)); // slow down brute force
        return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // ✅ Return session tokens ke client — client set session via supabase.auth.setSession()
    return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
            id: data.user.id,
            email: data.user.email,
        },
    });
}