# CLAUDE.md — SuntikSosmed

Panduan untuk Claude Code saat bekerja di project ini.

## Tentang Project

SuntikSosmed adalah SMM panel berbasis Next.js 14 (Pages Router). User bisa deposit saldo via QRIS lalu beli layanan SMM (followers, likes, views, dll) dari provider eksternal. Ada admin panel terpisah untuk kelola user, order, markup, dan pengumuman.

## Tech Stack

- **Next.js 14** — Pages Router (bukan App Router)
- **Supabase** — Auth + PostgreSQL database
- **Paymenku** — Payment gateway QRIS
- **jsonwebtoken** — JWT untuk admin auth
- **Lucide React** — Icons
- **CSS Variables + inline styles** — Tidak pakai Tailwind atau CSS modules

## Struktur File Penting

```
src/pages/api/          → Semua API routes (server-side)
  auth/login.js         → Login user (cek blocked email di server)
  smm.js                → Proxy ke SMM provider
  payment.js            → QRIS via Paymenku
  admin-auth.js         → Login admin → JWT
  admin-api.js          → CRUD admin (verifikasi JWT dulu)
  webhook/paymenku.ts   → Webhook deposit QRIS

src/components/dashboard/   → View components untuk tiap menu dashboard
src/context/                → ThemeContext, ApiContext, AuthContext
src/pages/[adminSlug].jsx   → Admin panel (slug dikonfigurasi di file itu)
```

## Aturan Keamanan — Wajib Diikuti

### Email user untuk operasi database
**Selalu** ambil dari `supabase.auth.getSession()`, bukan dari sessionStorage atau prop:
```js
// ✅ Benar
const { data: { session } } = await supabase.auth.getSession();
const email = session?.user?.email;

// ❌ Salah — sessionStorage bisa dimanipulasi dari browser console
const { email } = JSON.parse(sessionStorage.getItem('user') || '{}');
```

### sessionStorage
Hanya boleh menyimpan data display UI yang tidak sensitif:
```js
// ✅ Boleh
sessionStorage.setItem('user', JSON.stringify({ name, initials }));

// ❌ Tidak boleh — email/id tidak boleh di sessionStorage
sessionStorage.setItem('user', JSON.stringify({ name, email, id }));
```

### Env var SMM
Jangan pernah tambah prefix `NEXT_PUBLIC_` ke `SMM_API_KEY` atau `SMM_API_URL`:
```env
# ✅ Benar — hanya ada di server
SMM_API_KEY=xxx
SMM_API_URL=https://smmsoc.com

# ❌ Salah — masuk ke browser bundle, bisa dilihat di DevTools
NEXT_PUBLIC_SMM_API_KEY=xxx
```

### Insert ke tabel transactions
Hanya boleh dari:
1. Webhook server-side (`/api/webhook/paymenku`) — untuk deposit
2. API routes yang sudah verifikasi auth — untuk order

Tidak boleh insert transaksi langsung dari komponen React/client.

### Admin operations
Semua operasi admin (baca user, hapus, ubah settings) harus lewat `/api/admin-api` yang verifikasi JWT. Jangan query Supabase langsung dari admin panel client menggunakan anon key.

## Pattern yang Dipakai

### Fetch dari komponen user ke API
```js
// User biasa — pakai Supabase access token
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('/api/smm?action=services', {
  headers: { 'Authorization': `Bearer ${session?.access_token}` }
});
```

### Fetch dari admin panel ke API
```js
// Admin — pakai JWT dari sessionStorage admin_token
const adminFetch = (path, options = {}) => {
  const token = sessionStorage.getItem('admin_token') || '';
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
};
```

### Verifikasi JWT di API route
```js
import jwt from 'jsonwebtoken';

function verifyAdminToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.ADMIN_SECRET, { issuer: 'smm-admin' });
    if (payload.role !== 'admin') return null;
    return payload;
  } catch { return null; }
}
```

## Database — Tabel Utama

| Tabel | Isi | Notes |
|-------|-----|-------|
| `transactions` | Semua mutasi saldo (deposit, order, refund, bonus) | RLS: user hanya bisa baca miliknya |
| `profiles` | Data profil user tambahan (phone, website) | RLS: user hanya bisa baca/edit miliknya |
| `settings` | Config app (markup, blocked_emails, smm_api_url) | RLS: read-only untuk authenticated user |
| `tickets` | Support tickets + replies | RLS: user hanya bisa baca miliknya |
| `announcements` | Pengumuman dari admin | RLS: read-only untuk semua |

## Hal yang Sering Bikin Bug

1. **`supabase is not defined`** — Lupa import `import { supabase } from '@/lib/supabase'` di komponen baru.

2. **Services tidak muncul di user dashboard** — Jangan tambah guard `if (!apiUrl || !apiKey) return` di useEffect yang fetch services. `apiUrl` di client bisa kosong karena load async dari Supabase.

3. **My Orders kosong** — Pastikan query ke tabel `transactions` pakai email dari `supabase.auth.getSession()`, bukan dari sessionStorage.

4. **ViewFAQ not found** — File FAQ adalah `ViewNotifications.jsx`, bukan `ViewFAQ.jsx`. Import dengan nama yang benar.

5. **Admin "supabase is not defined"** — Admin panel (`index.jsx`) masih pakai `supabase.from()` untuk `fetchOrders`. Pastikan import supabase ada di file itu.

## Ganti SMM Provider

Edit `.env.local`:
```env
SMM_API_URL=https://provider-baru.com
SMM_API_KEY=api_key_baru
```
Restart server. Kalau format API provider baru berbeda, edit `src/pages/api/smm.js`.

## Jangan Lakukan Ini

- Jangan simpan `SMM_API_KEY` atau `ADMIN_SECRET` di state React atau expose ke client
- Jangan tambah `NEXT_PUBLIC_` ke env var yang sensitif
- Jangan insert ke `transactions` dari komponen React — selalu lewat server/webhook
- Jangan skip verifikasi JWT di API route admin
- Jangan pakai `err.message` dari Supabase langsung sebagai error message ke user
- Jangan query `blocked_emails` dari browser untuk cek apakah user diblokir — mudah di-bypass
