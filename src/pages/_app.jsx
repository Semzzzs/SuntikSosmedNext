import { useRouter } from 'next/router';
import { ThemeProvider } from '@/context/ThemeContext';
import { ApiProvider } from '@/context/ApiContext';
import { AuthProvider } from '@/context/AuthContext';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  return (
    <AuthProvider>
      <ApiProvider>
        <ThemeProvider
          key={isAdmin ? 'admin' : 'user'}
          storageKey={isAdmin ? 'admin_theme' : 'user_theme'}
        >
          <Component {...pageProps} />
        </ThemeProvider>
      </ApiProvider>
    </AuthProvider>
  );
}