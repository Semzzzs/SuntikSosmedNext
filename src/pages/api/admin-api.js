// API Route: /api/admin-api
// File BARU — menggantikan semua direct Supabase call dari client (index.jsx).
//
// KENAPA FILE INI ADA:
//   Sebelumnya index.jsx memanggil supabase.from(...) langsung dari browser
//   menggunakan anon key. Siapapun bisa bypass UI dan query/hapus data.
//   Sekarang semua operasi admin harus lewat endpoint ini, yang:
//     1. Verifikasi JWT admin token (bukan ADMIN_SECRET mentah)
//     2. Baru pakai service role key untuk Supabase
//
// DEPENDENCY: npm install jsonwebtoken @supabase/supabase-js

import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// ── Helper: verifikasi JWT admin ──────────────────────────────────────────
function verifyAdminToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return null;

    try {
        const payload = jwt.verify(token, secret, { issuer: 'smm-admin' });
        if (payload.role !== 'admin') return null;
        return payload;
    } catch {
        // expired, invalid signature, dll
        return null;
    }
}

// ── Supabase admin client (service role) — hanya di server ───────────────
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY  // ✅ bukan anon key
    );
}

// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    // ✅ Semua request wajib punya JWT admin yang valid
    const adminPayload = verifyAdminToken(req);
    if (!adminPayload) {
        return res.status(401).json({ error: 'Unauthorized. Token tidak valid atau sudah expired.' });
    }

    const supabase = getSupabaseAdmin();
    const { action } = req.query;

    // ── GET /api/admin-api?action=... ──────────────────────────────────────

    if (req.method === 'GET') {

        // Ambil markup dari settings
        if (action === 'get_markup') {
            const { data, error } = await supabase.from('settings').select('value').eq('key', 'markup').maybeSingle();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ value: data?.value || null });
        }

        // Ambil daftar user dari profiles (atau fallback ke transactions)
        if (action === 'get_users') {
            const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
            const blockedEmails = blockData?.value ? JSON.parse(blockData.value) : [];

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, full_name, created_at')
                .order('created_at', { ascending: true });

            if (!profileError && profileData?.length > 0) {
                return res.status(200).json({
                    users: profileData.map(u => ({
                        email: u.email,
                        name: u.full_name || u.email?.split('@')[0],
                        createdAt: u.created_at,
                        blocked: blockedEmails.includes(u.email),
                    }))
                });
            }

            // Fallback: dari transactions
            const { data: txData } = await supabase.from('transactions').select('email, created_at').order('created_at', { ascending: true });
            const seen = new Set();
            const userList = (txData || []).filter(t => {
                if (!t.email || seen.has(t.email)) return false;
                seen.add(t.email); return true;
            }).map(t => ({
                email: t.email,
                name: t.email?.split('@')[0],
                createdAt: t.created_at,
                blocked: blockedEmails.includes(t.email),
            }));
            return res.status(200).json({ users: userList });
        }

        // Ambil orders (transactions type=order)
        if (action === 'get_orders') {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'order')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ orders: data || [] });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    // ── POST /api/admin-api?action=... ────────────────────────────────────

    if (req.method === 'POST') {
        const body = req.body;

        // Simpan markup
        if (action === 'save_markup') {
            const val = parseFloat(body.value);
            if (isNaN(val) || val < 1 || val > 100) {
                return res.status(400).json({ error: 'Nilai markup tidak valid.' });
            }
            const { error } = await supabase.from('settings').upsert({
                key: 'markup',
                value: String(val),
                updated_at: new Date().toISOString()
            });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // Toggle block user
        if (action === 'toggle_block') {
            const { email, blocked_emails } = body;
            if (!email || !Array.isArray(blocked_emails)) {
                return res.status(400).json({ error: 'Data tidak valid.' });
            }
            const { error } = await supabase.from('settings').upsert({
                key: 'blocked_emails',
                value: JSON.stringify(blocked_emails),
                updated_at: new Date().toISOString()
            });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // Hapus user — hapus transactions + (opsional) Supabase Auth user
        if (action === 'delete_user') {
            const { email } = body;
            if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });

            // Hapus transactions
            const { error: txError } = await supabase.from('transactions').delete().eq('email', email);
            if (txError) return res.status(500).json({ error: txError.message });

            // Hapus dari blocked_emails settings jika ada
            const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
            if (blockData?.value) {
                const list = JSON.parse(blockData.value).filter(e => e !== email);
                await supabase.from('settings').upsert({
                    key: 'blocked_emails',
                    value: JSON.stringify(list),
                    updated_at: new Date().toISOString()
                });
            }

            // ✅ Hapus juga akun Supabase Auth (fix bug: sebelumnya akun masih bisa login)
            // Perlu cari user_id dulu dari profiles
            const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
            if (profile?.id) {
                await supabase.auth.admin.deleteUser(profile.id);
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}