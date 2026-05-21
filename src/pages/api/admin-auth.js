// API Route: /api/admin-auth
// .env.local: ADMIN_USERNAME=xxx  ADMIN_PASSWORD=xxx  ADMIN_SECRET=random_string

export default function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const correctUser = process.env.ADMIN_USERNAME;
    const correctPass = process.env.ADMIN_PASSWORD;
    const secret = process.env.ADMIN_SECRET;

    // Pastikan env variables sudah diset
    if (!correctUser || !correctPass || !secret) {
        console.error('ADMIN env variables not set!');
        return res.status(500).json({ ok: false, error: 'Server misconfigured.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ ok: false, error: 'Username dan password wajib diisi.' });
    }

    if (username === correctUser && password === correctPass) {
        return res.status(200).json({ ok: true, token: secret });
    }

    // Slow down brute force
    setTimeout(() => {
        res.status(401).json({ ok: false, error: 'Username atau password salah.' });
    }, 1000);
}