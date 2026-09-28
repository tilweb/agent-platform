import { createContext, useContext, useMemo } from 'react';

/**
 * Kontext des Antrags-Kerns: die App stellt ihre API-Funktionen bereit, die die
 * fachfreien Bausteine benötigen (kein Prop-Drilling, kein Import aus der App).
 *
 * value: { api: { getRegeln, getKiVerbrauch, getPosteingangKiVerbrauch } }
 */
const AntragKernContext = createContext(null);

export function AntragKernProvider({ api, children }) {
  const value = useMemo(() => ({ api }), [api]);
  return <AntragKernContext.Provider value={value}>{children}</AntragKernContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook gehört zum Provider
export function useAntragKern() {
  const ctx = useContext(AntragKernContext);
  if (!ctx) throw new Error('useAntragKern: kein AntragKernProvider vorhanden');
  return ctx;
}
