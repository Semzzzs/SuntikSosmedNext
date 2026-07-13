// pages/api/transactions.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];

    // Verifikasi user dari token (anon key cukup buat getUser)
    const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user?.email) {
        return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });
    }

    // Query pakai service role — email diambil dari token, BUKAN dari input client,
    // jadi gak bisa dimanipulasi buat lihat transaksi orang lain.
    const supaSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error: qErr } = await supaSvc
        .from('transactions')
        .select('id, type, description, amount, status, created_at, order_id') // TANPA provider, service_id, charge, charge_idr
        .eq('email', user.email)
        .order('created_at', { ascending: false });

    if (qErr) return res.status(500).json({ error: qErr.message });
    return res.status(200).json(data || []);
}