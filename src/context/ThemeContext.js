import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext({ dark: false, toggle: () => { } });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children, storageKey = 'theme_preference' }) {
  // Selalu init false agar server & client sama → tidak hydration error
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Baca localStorage hanya di client (setelah hydration selesai)
    if (localStorage.getItem(storageKey) === 'dark') setDark(true);
  }, [storageKey]);

  const toggle = () => setDark(d => {
    const next = !d;
    localStorage.setItem(storageKey, next ? 'dark' : 'light');
    return next;
  });

  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}