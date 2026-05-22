import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext({ dark: false, toggle: () => { } });
export const useTheme = () => useContext(ThemeCtx);

// ✅ Fix: validasi storageKey hanya boleh alfanumerik + underscore + hyphen
//         Mencegah storageKey dari input eksternal dipakai untuk baca key localStorage lain
function isSafeStorageKey(key) {
  return typeof key === 'string' && /^[a-zA-Z0-9_-]+$/.test(key);
}

export function ThemeProvider({ children, storageKey = 'theme_preference' }) {
  // Selalu init false agar server & client sama → tidak hydration error
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // ✅ Fix: validasi storageKey sebelum dipakai untuk baca localStorage
    if (!isSafeStorageKey(storageKey)) {
      console.warn('[ThemeContext] storageKey tidak valid, menggunakan default.');
      return;
    }
    if (localStorage.getItem(storageKey) === 'dark') setDark(true);
  }, [storageKey]);

  const toggle = () => setDark(d => {
    const next = !d;
    // ✅ Validasi juga saat write
    if (isSafeStorageKey(storageKey)) {
      localStorage.setItem(storageKey, next ? 'dark' : 'light');
    }
    return next;
  });

  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}