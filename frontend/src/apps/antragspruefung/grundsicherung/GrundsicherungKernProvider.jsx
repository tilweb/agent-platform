import { AntragKernProvider } from '../kern/AntragKernContext';
import { grundsicherungApi } from './api';

/** API-Funktionen, die die Bausteine des Antrags-Kerns von der Grundsicherungs-App brauchen. */
const KERN_API = {
  getRegeln: grundsicherungApi.getRegeln,
  getKiVerbrauch: grundsicherungApi.getKiVerbrauch,
  getPosteingangKiVerbrauch: grundsicherungApi.getPosteingangKiVerbrauch,
};

/** Stellt den Antrags-Kern-Kontext für eine Grundsicherungs-Seite bereit. */
export default function GrundsicherungKernProvider({ children }) {
  return <AntragKernProvider api={KERN_API}>{children}</AntragKernProvider>;
}
