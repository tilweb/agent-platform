import { AntragKernProvider } from '../kern/AntragKernContext';
import { wohngeldApi } from './api';

/** API-Funktionen, die die Bausteine des Antrags-Kerns von der Wohngeld-App brauchen. */
const KERN_API = {
  getRegeln: wohngeldApi.getRegeln,
  getKiVerbrauch: wohngeldApi.getKiVerbrauch,
  getPosteingangKiVerbrauch: wohngeldApi.getPosteingangKiVerbrauch,
};

/** Stellt den Antrags-Kern-Kontext für eine Wohngeld-Seite bereit. */
export default function WohngeldKernProvider({ children }) {
  return <AntragKernProvider api={KERN_API}>{children}</AntragKernProvider>;
}
