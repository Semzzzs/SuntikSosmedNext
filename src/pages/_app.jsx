import { useRouter } from 'next/router';
import Head from 'next/head';
import { Component } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ApiProvider } from '@/context/ApiContext';
import { AuthProvider } from '@/context/AuthContext';
import '@/styles/globals.css';

// ✅ Error Boundary — cegah seluruh app crash saat satu view error
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 24, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 28 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>Terjadi kesalahan</div>
          <div style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 24, maxWidth: 360 }}>
            Halaman mengalami error. Coba refresh atau kembali ke beranda.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.location.reload()}
              style={{ padding: '9px 20px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Refresh
            </button>
            <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              style={{ padding: '9px 20px', borderRadius: 10, background: '#F3F4F6', color: '#374151', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Ke Beranda
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  return (
    <ErrorBoundary>
      <Head>
        {/* ✅ Viewport — lokasi yang benar (next/head), bukan _document.
            viewport-fit=cover agar safe-area iPhone aktif. Tanpa user-scalable=no = accessible. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <AuthProvider>
        <ApiProvider>
          <ThemeProvider
            key={isAdmin ? 'admin' : 'user'}
            storageKey={isAdmin ? 'admin_theme' : 'user_theme'}
          >
            <ErrorBoundary>
              <Component {...pageProps} />
            </ErrorBoundary>
          </ThemeProvider>
        </ApiProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}