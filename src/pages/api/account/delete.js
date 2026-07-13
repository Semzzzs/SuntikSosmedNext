// pages/api/account/delete.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];

    // Verifikasi ini beneran token milik user yang mau dihapus (bukan admin token,
    // bukan token orang lain) — supabase.auth.getUser() decode dari token itu sendiri.
    const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user?.id || !user?.email) {
        return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });
    }

    const supaSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        // Hapus data terkait dulu (biar gak nyisa row yatim kalau salah satu gagal, urutan aman).
        await supaSvc.from('tickets').delete().eq('email', user.email);
        await supaSvc.from('transactions').delete().eq('email', user.email);
        await supaSvc.from('profiles').delete().eq('id', user.id);

        // Hapus akun auth-nya sendiri (butuh service role).
        const { error: delErr } = await supaSvc.auth.admin.deleteUser(user.id);
        if (delErr) {
            console.error('[account/delete] gagal hapus auth user:', delErr.message);
            return res.status(500).json({ error: 'Gagal menghapus akun. Coba lagi atau hubungi admin.' });
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('[account/delete] exception:', e.message);
        return res.status(500).json({ error: 'Gagal menghapus akun. Coba lagi atau hubungi admin.' });
    }
}