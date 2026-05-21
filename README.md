# SuntikSosmed — Next.js (Pages Router)

SMM Panel berbasis Next.js 14 dengan Pages Router.

## Struktur Project

```
src/
├── pages/
│   ├── _app.jsx          → App wrapper (providers)
│   ├── _document.jsx     → HTML document
│   ├── index.jsx         → Landing page (/)
│   ├── login.jsx         → Login page (/login)
│   ├── register.jsx      → Register page (/register)
│   └── dashboard.jsx     → Dashboard (/dashboard)
├── components/
│   ├── AuthForm.jsx      → Shared Login/Register form
│   └── dashboard/
│       ├── ViewNewOrder.jsx
│       ├── ViewMyOrders.jsx
│       ├── ViewServices.jsx
│       ├── ViewAddFunds.jsx
│       ├── ViewReferral.jsx
│       ├── ViewTickets.jsx
│       ├── ViewNotifications.jsx
│       ├── ViewAnalytics.jsx
│       ├── ViewTransactions.jsx
│       ├── ViewAPI.jsx
│       └── ViewSettings.jsx
├── context/
│   ├── ThemeContext.js   → Dark/light mode
│   └── ApiContext.js     → SMM API config & helper
└── styles/
    └── globals.css       → CSS variables + utility classes
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Konfigurasi environment**
   ```bash
   cp .env.local.example .env.local
   ```
   Isi `.env.local`:
   ```
   NEXT_PUBLIC_SMM_API_URL=https://yourprovider.com
   NEXT_PUBLIC_SMM_API_KEY=your_api_key_here
   ```

3. **Jalankan development server**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000)

4. **Build untuk production**
   ```bash
   npm run build
   npm start
   ```

## Konfigurasi SMM Provider

Bisa via 2 cara:
- **`.env.local`** — set sebelum build
- **Dashboard** → Settings → Provider API — set saat runtime (tersimpan di state, reset saat refresh)

## Catatan CORS

Jika provider API menghasilkan CORS error di browser, buat backend proxy sederhana:
```js
// pages/api/proxy.js
export default async function handler(req, res) {
  const { url, ...params } = req.query;
  const response = await fetch(`${url}?${new URLSearchParams(params)}`);
  const data = await response.json();
  res.json(data);
}
```
Lalu ubah `apiUrl` di Settings ke `/api/proxy?url=https://yourprovider.com`.

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **UI**: React 18, Lucide React icons
- **Styling**: CSS Variables + Inline styles (no Tailwind)
- **Font**: Plus Jakarta Sans + JetBrains Mono (Google Fonts)
- **Auth**: sessionStorage (demo — ganti dengan real auth untuk production)
