# SuntikSosmed — Next.js SMM Panel

SMM Panel berbasis Next.js 14 (Pages Router) dengan autentikasi Supabase, payment gateway Paymenku (QRIS), dan proxy API ke provider SMM.

## Struktur Project

```
src/
├── pages/
│   ├── _app.jsx
│   ├── _document.jsx
│   ├── index.jsx               → Landing page (/)
│   ├── login.jsx               → Login (/login)
│   ├── register.jsx            → Register (/register)
│   ├── dashboard.jsx           → Dashboard user (/dashboard)
│   ├── [adminSlug].jsx         → Admin panel (/Voltaraz atau slug kustom)
│   └── api/
│       ├── auth/
│       │   └── login.js        → Server-side login + blocked email check
│       ├── smm.js              → Proxy ke SMM provider (auth-protected)
│       ├── payment.js          → QRIS via Paymenku
│       ├── rate.js             → Kurs USD/IDR realtime
│       ├── admin-auth.js       → Login admin → JWT
│       ├── admin-api.js        → CRUD admin (users, settings, markup)
│       └── webhook/
│           └── paymenku.ts     → Webhook deposit QRIS
├── components/
│   ├── AuthForm.jsx
│   └── dashboard/
│       ├── ViewNewOrder.jsx
│       ├── ViewMyOrders.jsx
│       ├── ViewAddFunds.jsx
│       ├── ViewTransactions.jsx
│       ├── ViewAnalytics.jsx
│       ├── ViewTickets.jsx
│       ├── ViewSettings.jsx
│       ├── ViewContact.jsx
│       ├── ViewAnnouncements.jsx
│       ├── ViewServices.jsx
│       └── ViewNotifications.jsx   → FAQ
├── context/
│   ├── ThemeContext.js
│   ├── ApiContext.js
│   └── AuthContext.js
└── styles/
    └── globals.css
```

## Setup

### 1. Install dependencies

```bash
npm install
npm install jsonwebtoken
```

### 2. Konfigurasi environment

Buat file `.env.local` di root project:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# SMM Provider (tanpa NEXT_PUBLIC — tidak boleh bocor ke browser)
SMM_API_URL=https://smmsoc.com
SMM_API_KEY=your_smm_api_key

# Admin panel
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_kuat
ADMIN_SECRET=random_string_min_32_karakter

# Payment (Paymenku)
PAYMENKU_API_KEY=your_paymenku_api_key
PAYMENKU_WEBHOOK_SECRET=your_webhook_secret

# App
NEXT_PUBLIC_BASE_URL=https://domainmu.com
```

> **Penting:** `SMM_API_KEY` tidak boleh pakai prefix `NEXT_PUBLIC_` — kalau pakai prefix itu, key akan masuk ke JavaScript bundle dan bisa dilihat siapapun di DevTools.

### 3. Setup Supabase

Aktifkan **Row Level Security (RLS)** di semua tabel:

| Tabel | Policy |
|-------|--------|
| `transactions` | User hanya bisa baca row miliknya: `auth.jwt() ->> 'email' = email` |
| `profiles` | User hanya bisa baca/edit row miliknya: `auth.uid() = id` |
| `tickets` | User hanya bisa baca row miliknya |
| `settings` | Read-only untuk semua authenticated user |
| `announcements` | Read-only untuk semua authenticated user |

### 4. Jalankan

```bash
npm run dev        # Development
npm run build      # Build production
npm start          # Jalankan production
```

## Ganti SMM Provider

Cukup ubah 2 baris di `.env.local` lalu restart server:

```env
SMM_API_URL=https://provider-baru.com
SMM_API_KEY=api_key_baru
```

Mayoritas provider SMM pakai format API yang sama (`/api/v2`, POST form-urlencoded). Kalau provider baru pakai format berbeda, edit `src/pages/api/smm.js`.

## Arsitektur Keamanan

### Autentikasi user
- Login via `/api/auth/login` (server-side) — cek blocked email sebelum auth
- Token Supabase di-set ke client via `supabase.auth.setSession()`
- Email untuk operasi database selalu dari `supabase.auth.getSession()`, tidak dari sessionStorage

### Autentikasi admin
- Login via `/api/admin-auth` → dapat JWT (expire 8 jam)
- Semua operasi admin lewat `/api/admin-api` yang verifikasi JWT dulu
- Raw `ADMIN_SECRET` tidak pernah dikirim ke client

### API proxy SMM
- Semua request ke provider SMM lewat `/api/smm` (server-side)
- User biasa: wajib Supabase Bearer token
- Admin: wajib JWT admin

### Payment
- Deposit hanya dikreditkan oleh webhook server-side (`/api/webhook/paymenku`)
- Client tidak bisa insert deposit sendiri
- HMAC signature diverifikasi setiap webhook masuk

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Auth & DB**: Supabase (Auth + PostgreSQL)
- **UI**: React 18, Lucide React
- **Styling**: CSS Variables + inline styles
- **Font**: Plus Jakarta Sans, JetBrains Mono
- **Payment**: Paymenku (QRIS)
- **JWT**: jsonwebtoken