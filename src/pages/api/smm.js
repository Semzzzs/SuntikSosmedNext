/**
 * API Proxy untuk smmsoc.com
 * - User biasa: wajib Supabase session token
 * - Admin: wajib ADMIN_SECRET header
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    const adminSecret = req.headers['x-admin-secret'];

    // ✅ Cek apakah request dari admin panel
    const isAdmin = adminSecret && adminSecret === process.env.ADMIN_SECRET;

    // ✅ Kalau bukan admin, cek Supabase user token
    if (!isAdmin) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
        }

        const token = authHeader.split(' ')[1];
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });
        }
    }

    const apiUrl = process.env.NEXT_PUBLIC_SMM_API_URL || 'https://smmsoc.com';
    const apiKey = process.env.NEXT_PUBLIC_SMM_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Key belum dikonfigurasi.' });
    }

    try {
        const body = new URLSearchParams({
            key: apiKey,
            ...req.query,
        });

        const response = await fetch(`${apiUrl}/api/v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return res.status(200).json(data);
        } catch {
            return res.status(response.status).send(text);
        }
    } catch (err) {
        return res.status(500).json({ error: `Proxy error: ${err.message}` });
    }
}