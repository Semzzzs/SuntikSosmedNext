import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';

// useLayoutEffect melempar warning kalau dipanggil di server (gak ada DOM buat di-"layout").
// Next.js tetap jalanin SSR, jadi kita pakai versi aman: useLayoutEffect di client,
// useEffect (no-op saat SSR) di server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ThemeCtx = createContext({ dark: false, toggle: () => { } });
export const useTheme = () => useContext(ThemeCtx);

// ✅ Fix: validasi storageKey hanya boleh alfanumerik + underscore + hyphen
//         Mencegah storageKey dari input eksternal dipakai untuk baca key localStorage lain
function isSafeStorageKey(key) {
  return typeof key === 'string' && /^[a-zA-Z0-9_-]+$/.test(key);
}

// ✅ Fix #3: localStorage bisa melempar SecurityError di Safari private mode / iOS lama,
//            bukan cuma gagal diam-diam. Bungkus tiap akses supaya tidak crash render.
function safeGetItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// ⚠️ CATATAN: dulu ada getInitialDark() yang dipanggil lewat useState(() => ...) lazy init.
//    Itu BUG — meski dibungkus cek `typeof window`, fungsi itu tetap jalan persis di render
//    pertama client (hydration pass), jadi client langsung baca localStorage dan beda sama
//    HTML dari server (yang selalu `dark=false` karena gak punya akses localStorage).
//    React deteksi mismatch ini → buang HTML server, render ulang full dari client (keliatan
//    sebagai kedipan + "Hydration failed" di console).
//    Fix: state awal SELALU false di kedua sisi (server & client render pertama selalu sama),
//    baru baca localStorage di useEffect — useEffect dijamin cuma jalan SETELAH hydration
//    selesai, jadi gak akan pernah mismatch. FOUC (kedipan tema salah) tetap dicegah lewat
//    inline script anti-flash di _document.jsx yang set class "dark" ke <html> sebelum
//    React mount sama sekali — itu murni manipulasi DOM/CSS, gak melibatkan React state.

export function ThemeProvider({ children, storageKey = 'theme_preference' }) {
  // State awal SELALU false — sama persis dengan apa yang di-render server.
  // Ini WAJIB sama supaya hydration pass pertama gak mismatch.
  const [dark, setDark] = useState(false);

  // useLayoutEffect (bukan useEffect) khusus di sini — jalan sebelum browser
  // sempat paint, jadi swap false→true ini gak kelihatan sebagai kedipan sama sekali.
  // Tetap aman dari hydration mismatch karena ini jalan SETELAH hydration commit,
  // cuma SEBELUM paint — bukan bagian dari render yang dibandingkan React.
  useIsomorphicLayoutEffect(() => {
    if (!isSafeStorageKey(storageKey)) return;
    if (safeGetItem(storageKey) === 'dark') setDark(true);
  }, [storageKey]);

  // ✅ Fix #2: sinkronkan antar tab/jendela — saat tab lain mengubah localStorage,
  //            event 'storage' terpicu di tab ini (tidak terpicu di tab yang menulis sendiri).
  useEffect(() => {
    if (!isSafeStorageKey(storageKey)) {
      console.warn('[ThemeContext] storageKey tidak valid, menggunakan default.');
      return;
    }

    const onStorage = (e) => {
      if (e.key !== storageKey) return;
      setDark(e.newValue === 'dark');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const toggle = useCallback(() => {
    setDark(d => {
      const next = !d;
      if (isSafeStorageKey(storageKey)) {
        safeSetItem(storageKey, next ? 'dark' : 'light');
      }
      return next;
    });
  }, [storageKey]);

  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}