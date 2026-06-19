import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

// ✅ Fix #1: baca preferensi tema sebelum render pertama (dipanggil lazy di useState).
//            Ini tetap aman untuk SSR karena dibungkus cek `typeof window`.
//            Dikombinasikan dengan inline script di _document.js, ini menghilangkan
//            flash of wrong theme di reload tanpa membuat mismatch hydration —
//            lihat catatan _document.js untuk bagian yang menset class sebelum React mount.
function getInitialDark(storageKey) {
  if (typeof window === 'undefined') return false; // SSR: selalu false, konsisten dgn markup awal
  if (!isSafeStorageKey(storageKey)) return false;
  return safeGetItem(storageKey) === 'dark';
}

export function ThemeProvider({ children, storageKey = 'theme_preference' }) {
  // Lazy init: function ini hanya jalan sekali saat mount pertama di client.
  // Di server selalu false (lihat getInitialDark), sehingga HTML hasil SSR
  // tetap konsisten dengan markup yang di-generate _document.js → tidak hydration error.
  const [dark, setDark] = useState(() => getInitialDark(storageKey));

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