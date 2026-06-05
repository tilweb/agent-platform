# Konzept: Connection-Packages

**Eine Connection ist mehr als ein Login — sie ist ein selbständiges Fähigkeits-Paket.**

*Stand: 2026-06-05 · Zielgruppe: Produkt- & Entwicklungsteam · Charakter: konzeptionell, kein technischer Blueprint*

> Dieses Dokument beschreibt **Ideen und Prinzipien**, nicht eine konkrete Implementierung.
> Die Umsetzung im skalierbaren Produkt kann technisch ganz anders aussehen — entscheidend
> ist, dass die hier beschriebene **Verantwortungs-Trennung** und das **Bündelungs-Prinzip**
> erhalten bleiben.

---

## 1. Kernidee in einem Satz

Jede externe Integration (DocuWare, Confluence, Jira, Google, …) wird nicht als bloßer
technischer Anschluss gebaut, sondern als **Package**: ein zusammengehöriges Bündel aus
**Zugang + Werkzeugen + einem fachkundigen Assistenten + fertigen Arbeitsabläufen**. Wer
eine Integration einbaut, liefert damit automatisch einen **sofort einsatzfähigen
Assistenten** für dieses System mit — *„batteries included"*.

Das Gegenmodell, das wir vermeiden wollen: Eine Integration liefert nur rohe technische
Zugriffe, und für jeden Kunden bastelt dann jemand händisch Agenten, Prompts und Abläufe
nach. Das skaliert nicht und führt zu inkonsistenter Qualität.

---

## 2. Das Fundament: das Connections-Konzept (Admin & User)

Bevor es um die Pakete geht, zwei klar getrennte Welten — sie sind die Basis, auf der
alles aufsetzt:

**Die Admin-Welt — einrichten & freischalten (einmalig, technisch).**
Ein Administrator richtet die Integration **einmal** für die gesamte Organisation ein:
die OAuth-App beim Anbieter registrieren, technische Zugangsdaten hinterlegen, ggf.
organisationsspezifische Endpunkte konfigurieren. Anschließend entscheidet der Admin pro
Integration: **„für Nutzer freigeschaltet — ja/nein"** (ein Schieberegler). Erst was
freigeschaltet ist, taucht bei den Nutzern überhaupt auf. Das ist bewusst **opt-in**: der
Admin kontrolliert, welche Integrationen im Haus verfügbar sind.

**Die User-Welt — sein eigenes Konto verbinden (pro Person).**
Jeder einzelne Nutzer verbindet in seinem Bereich („Meine Verbindungen") sein **eigenes**
Konto per OAuth-Login. Das ist wichtig: Der Zugriff erfolgt mit der **persönlichen
Identität und den persönlichen Rechten** des Nutzers — nicht über einen geteilten
Sammel-Account. Jeder sieht nur, was er im Quellsystem sehen darf. Die Anmelde-Token
werden pro Nutzer getrennt und sicher gehalten.

**Warum diese Trennung wichtig ist:** Der Admin trägt die **einmalige technische Last**
(OAuth-App, Freigabe). Der einzelne Nutzer trägt nur die **triviale persönliche
Anmeldung** (ein Klick „Verbinden"). Mandantentrennung, Berechtigungen und Datenschutz
bleiben dadurch sauber und zentral geregelt — und genau darauf bauen die Packages auf.

---

## 3. Die vier Bausteine eines Packages

Ein Connection-Package besteht aus vier Schichten. Eine Analogie hilft beim Einordnen —
stell dir eine neue Fachkraft vor, die ein fremdes Aktenarchiv bedienen soll:

| Baustein | Was es ist | Analogie |
|---|---|---|
| **Connection** | Der Zugang: OAuth/Anmeldung, persönlicher Token pro Nutzer, Admin-Freigabe | **Schloss & Schlüssel** zum Archiv |
| **Tools** | Atomare, eng umrissene Aktionen gegen das System (suchen, lesen, auflisten …) | Die **Hände** — einzelne Handgriffe |
| **Agent** | Ein kuratierter, fachkundiger Assistent, der diese Tools beherrscht und die Eigenheiten des Systems kennt | Die **Fachkraft**, die weiß, *wie* man arbeitet |
| **Skills** | Wiederverwendbare Arbeitsabläufe/Playbooks für wiederkehrende Aufgaben (+ ggf. mitgeliefertes Fachwissen) | Die **Standardarbeitsanweisungen (SOPs)** |

Im Detail:

- **Connection (Zugang).** Regelt, *dass* und *als wer* zugegriffen wird. Bringt den
  Setup-Teil (OAuth-App, Endpunkte) und den per-Nutzer-Token mit. Diese Schicht existiert
  heute schon vollständig.

- **Tools (Werkzeuge).** Kleine, klar definierte Fähigkeiten — jeweils *eine* Sache, die
  ein Assistent gegen das System tun kann. Sie sind die **Maschinen-Schnittstelle**: ein
  Tool weiß, wie man eine Suche absetzt oder ein Dokument lädt, aber nicht *wann* oder
  *warum*. Tools sind bereits an die Connection gekoppelt und laufen mit dem persönlichen
  Token des jeweiligen Nutzers. **Jedes Tool hat einen klaren Charakter — lesend oder
  schreibend** — und das wird zum eigenen Berechtigungs-Hebel (siehe Abschnitt 6).

- **Agent (Experte).** Hier liegt der eigentliche Mehrwert der Vision. Der Agent ist ein
  **kuratierter Assistent mit Fachverhalten**: Er kennt die typischen Aufgaben in diesem
  System, weiß, welches Tool wann das richtige ist, kennt die Fallstricke, formuliert
  brauchbare Antworten und fragt bei Mehrdeutigkeit nach. Sein Verhalten ist **handgemacht
  und auf das System zugeschnitten**, nicht generisch.

- **Skills (Playbooks).** Wiederverwendbare Anleitungen für konkrete, wiederkehrende
  Aufgaben — eine Art „Standardarbeitsanweisung", die der Agent bei Bedarf lädt. Ein Skill
  beschreibt einen Ablauf (ggf. mehrschrittig) und kann mitgeliefertes **Fachwissen**
  (Dokumente, Regeln) enthalten. Skills heben den Agenten von „kann das System bedienen"
  auf „erledigt konkrete Geschäftsaufgaben darin".

> **Anschlusspunkt an die heutige Plattform:** Die ersten beiden Schichten existieren
> bereits, und es wird sogar schon **automatisch ein generischer Agent pro Connection**
> erzeugt (er bekommt die Tools der Connection und einen aus den Tool-Beschreibungen
> generierten Prompt). Was fehlt, ist genau der Sprung von **generisch** zu **kuratiert +
> mit Skills**. Die Vision ist also eine **Evolution eines bereits angelegten Mechanismus**,
> kein Neubau auf der grünen Wiese.

---

## 4. Das Paket-Prinzip: warum gebündelt geliefert wird

Der entscheidende Punkt: **Agent und Skills werden zusammen mit der Integration gebaut und
als eine Einheit ausgeliefert** — vom selben Team, im selben Atemzug, versioniert als
Ganzes.

Warum das wichtig ist:

- **Konsistente Qualität.** Wer das System am besten kennt (das Integrations-Team), prägt
  das Assistenten-Verhalten — statt dass später jeder Kunde/Berater seine eigene Variante
  zusammenstückelt.
- **Sofort nutzbar.** Integration freischalten → der passende Assistent ist da. Kein
  „erst noch Agenten konfigurieren".
- **Klarer Owner.** Pro Package gibt es genau ein verantwortliches Team — für Tools, Agent,
  Skills und deren Pflege.
- **Modular & steckbar.** Eine neue Integration ist ein neues, in sich geschlossenes Paket,
  das ohne Umbau am Kern hinzukommt.

Kurz: Das Package macht aus „wir können auf System X zugreifen" ein „wir können in System X
arbeiten".

---

## 5. Durchgängiges Beispiel: das DocuWare-Package

DocuWare ist ein Dokumenten-Management-System (digitale Aktenschränke). So sähe das Package aus:

**Connection.** OAuth gegen die DocuWare-Organisation des Kunden. Der Admin hinterlegt
die OAuth-App und schaltet DocuWare frei. Jeder Sachbearbeiter verbindet danach sein
eigenes DocuWare-Konto — und sieht nur die Aktenschränke, auf die er persönlich Zugriff hat.

**Tools** (die Handgriffe). Zum Beispiel: Dokumente per Volltext suchen · ein Dokument mit
Inhalt/Metadaten abrufen · verfügbare Aktenschränke auflisten · die Feldstruktur eines
Aktenschranks lesen · strukturiert suchen (nach Feldern + Begriff) · Viewer-Links für den
Web-Zugriff holen.

**Agent „DocuWare-Experte".** Ein kuratierter Assistent, der weiß:
- wann eine **strukturierte Feldsuche** besser ist als eine Volltextsuche (z. B. „alle
  Rechnungen von Lieferant X aus Q1");
- wie DocuWare-Aktenschränke typischerweise aufgebaut sind und wie er sich die Feldstruktur
  erst ansieht, bevor er strukturiert sucht;
- dass er Treffer mit **anklickbarem Viewer-Link** und einer knappen Zusammenfassung
  zurückgibt;
- dass er bei Mehrdeutigkeit (welcher Aktenschrank? welcher Zeitraum?) **kurz nachfragt**,
  statt zu raten.

Dieses Verhalten ist **handgeschrieben** — es ist das Erfahrungswissen über DocuWare,
gegossen in den Assistenten.

**Skills** (die Playbooks). Zum Beispiel:
- **„Dokument-Recherche"**: zu einer Frage die relevanten Belege finden, lesen und mit
  Quellen zusammenfassen.
- **„Vorgangsmappe prüfen"**: für einen Geschäftsvorgang prüfen, ob alle Pflichtdokumente
  vorhanden sind (verzahnt mit einer fachlichen App), und Lücken benennen.
- **„Beleg finden & exportieren"**: einen bestimmten Beleg lokalisieren und bereitstellen.

**Das Ergebnis für den Kunden (z. B. Cofermin):** Der Admin schaltet DocuWare frei, der
Sachbearbeiter verbindet sein Konto — und hat **sofort** einen Assistenten, der echte
DocuWare-Aufgaben erledigt. Niemand musste pro Kunde einen Agenten neu bauen oder Prompts
tunen. Genau das ist der Skalierungsgewinn.

---

## 6. Feingranulare Rechte: Lesen vs. Schreiben (Least Privilege)

Nicht jede Aktion ist gleich heikel. Hier liegt eine wichtige Verfeinerung des
Freischalt-Gedankens.

**Die Beobachtung.** Jedes Tool einer Connection hat einen klaren Charakter:
- **Lesend** — Daten abrufen, suchen, anzeigen, auflisten. Risikoarm.
- **Schreibend** — anlegen, ändern, verschieben, hochladen. Verändert das Quellsystem.
- (Optional als eigene, besonders markierte Stufe: **destruktiv** — löschen/unwiderruflich.)

**Das Bedürfnis.** Ein Admin will einer Abteilung oft **erst nur lesenden Zugriff** geben
— z. B. DocuWare *durchsuchen und anzeigen*, aber (noch) nichts *ablegen oder ändern*. Das
ist das **Prinzip der minimalen Rechte**: nur so viel freigeben, wie gebraucht wird, und
schreibende Aktionen bewusst und schrittweise nachziehen.

**Die Konsequenz fürs Konzept.** Die Freischaltung ist deshalb **nicht nur „Connection
an/aus", sondern feiner — pro Tool**. Im Admin-Bereich werden die Funktionen einer
Connection **nach Lesen / Schreiben gruppiert** dargestellt und sind **einzeln
aktivierbar**. So kann der Admin z. B. die gesamte Lese-Gruppe mit einem Griff freigeben
und schreibende Tools gezielt einzeln nachschalten.

**Was das vom Package verlangt.** Jedes Tool im Package trägt seine **Klassifizierung
(lesend / schreibend / destruktiv) als mitgeliefertes Metadatum** — vergeben vom
Integrations-Team, das die Wirkung jedes Endpunkts am besten kennt. Dadurch kann die
Plattform die Tools automatisch gruppieren und **sichere Voreinstellungen** treffen
(Empfehlung: neue und schreibende Tools standardmäßig **aus**; Lesen kann großzügiger sein).

**Zusammenspiel mit Agent & Skills.** Sind schreibende Tools nicht freigeschaltet, arbeitet
der Package-Agent automatisch **read-only**: Er kann recherchieren, lesen und
zusammenfassen, aber nichts verändern. Skills, die Schreibrechte voraussetzen, sind dann
für diese Organisation/diesen Nutzer schlicht **nicht verfügbar** und degradieren sauber.
Wichtig: Der Agent **kommuniziert das transparent** („Ich darf in DocuWare nur lesen — das
Ablegen müsste ein Admin freischalten"), statt mit einem Fehler zu scheitern.

**Im DocuWare-Beispiel:**
- **Lesen** (initial an): Dokumente suchen · Dokument lesen · Aktenschränke/Felder auflisten ·
  strukturiert suchen · Viewer-Links holen.
- **Schreiben** (initial aus, später bei Bedarf): Dokument ablegen/hochladen · Index-Felder
  ändern · Dokument verschieben.

So bekommt das Team aus Abschnitt 5 zunächst einen **reinen Recherche-Assistenten** für
DocuWare — und der Admin schaltet das Ablegen erst frei, wenn Vertrauen und Prozess stehen.

## 7. Rollen & Verantwortlichkeiten

| Rolle | Verantwortung |
|---|---|
| **Integration-Entwickler (Package-Owner)** | Baut & pflegt das gesamte Package: Connection, Tools, Agent, Skills, Wissen — als Einheit, versioniert. |
| **Plattform / System** | Registriert Packages, macht Tools/Agent/Skills verfügbar, kümmert sich um den per-Nutzer-Auth-Mechanismus und die Orchestrierung. |
| **Admin (beim Kunden)** | Richtet die OAuth-App ein, schaltet das Package frei, regelt Berechtigungen. Einmalig, technisch. |
| **End-User** | Verbindet sein eigenes Konto und nutzt den Assistenten — direkt angesprochen oder automatisch über einen übergeordneten Orchestrator. |

Die Trennung ist bewusst: Fachwissen (Package-Owner) ≠ Betrieb/Freigabe (Admin) ≠ Nutzung
(End-User).

---

## 8. Lebenszyklus eines Packages

1. **Bauen** — Das Integrations-Team entwickelt Connection + Tools + Agent + Skills als
   zusammengehöriges Paket.
2. **Ausliefern / Registrieren** — Das Package kommt mit dem Produkt (oder als nachladbares
   Modul) und meldet sich beim System an.
3. **Einrichten & Freischalten** — Der Admin hinterlegt die OAuth-App und aktiviert das
   Package für seine Nutzer.
4. **Verbinden** — Jeder Nutzer meldet sein eigenes Konto an.
5. **Nutzen** — Der Nutzer arbeitet mit dem Assistenten: entweder direkt, oder ein
   übergeordneter Orchestrator (ein „Supervisor"-Assistent) **delegiert** passende Aufgaben
   automatisch an den Package-Agenten.
6. **Pflegen / Versionieren** — Der Package-Owner verbessert Tools/Agent/Skills; das Package
   wird als Ganzes weiterentwickelt.

---

## 9. Komposition: wie die Bausteine zusammenspielen

Im Betrieb greift alles ineinander:

- Ein **Orchestrator** (ein übergeordneter Assistent) erkennt, dass eine Anfrage zu einem
  bestimmten System gehört, und **delegiert** sie an den passenden **Package-Agenten**.
- Der Package-Agent nutzt die **Tools** der Connection — automatisch mit dem **persönlichen
  Token** des anfragenden Nutzers (also mit dessen Rechten).
- Für komplexere Aufgaben **lädt** der Agent eines seiner **Skills** (das Playbook) und
  folgt dem darin beschriebenen Ablauf; das Skill kann Fachwissen mitbringen.

Wichtig: **Packages sind komponierbar.** Ein Geschäftsablauf kann mehrere Packages
kombinieren — etwa „finde den Beleg in DocuWare *und* schicke ihn per E-Mail" nutzt das
DocuWare- *und* das E-Mail-Package. Jedes Package bleibt für sich gekapselt; der
Orchestrator setzt sie zusammen.

---

## 10. Warum das im skalierbaren Produkt zählt

- **Modularität / Marktplatz-Gedanke.** Integrationen werden zu **steckbaren Paketen**.
  Eine neue Integration = ein neues Package, ohne Eingriff in den Kern. Langfristig denkbar:
  ein Katalog/Marktplatz, aus dem Admins Packages aktivieren.
- **Wiederverwendung statt Kundengebastel.** Das Assistenten-Verhalten wird **einmal**
  gebaut und überall genutzt — kein „für Kunde A nochmal neu".
- **Klare Ownership & Wartbarkeit.** Ein Team pro Package; Verbesserungen kommen allen
  Kunden zugute.
- **Sofort-Nutzen.** „Anschließen → loslegen" senkt die Einstiegshürde drastisch und macht
  den Wert sofort sichtbar (gut für Pilotierungen/Vertrieb).
- **Sicherheit & Mandantentrennung bleiben zentral.** Der per-Nutzer-Auth- und der
  Admin-Freigabe-Mechanismus sind *eine* Stelle — jedes Package erbt sie, statt sie neu zu
  erfinden.

---

## 11. Abgrenzung & bewusst offene Designfragen

Dieses Dokument gibt **keinen** technischen Bauplan vor — eure Codebase darf das Modell
anders realisieren (andere Sprache, andere Frameworks, anderer Agenten-/Tool-Mechanismus).
Entscheidend ist die **Trennung der Verantwortlichkeiten** und das **Bündeln** der vier
Schichten.

Bewusst offen gelassen — das sollte das Dev-Team selbst entscheiden:

- **Versionierung & Abhängigkeiten** von Packages (wie geht ein Update, wie hängen Packages
  voneinander/vom Kern ab?).
- **Wie werden Skills an eine Connection gebunden?** Heute sind Skills und Connections eher
  entkoppelt; im Package-Modell gehören sie zusammen — das Bindungs-Modell ist zu entwerfen.
- **Discovery / Verwaltung** (Katalog/Marktplatz-UI: Packages finden, aktivieren,
  konfigurieren).
- **Agent-Prompt: vollständig kuratiert vs. teil-generiert** (wie viel handgeschrieben, wie
  viel automatisch aus den Tools abgeleitet?).
- **Berechtigungs-Granularität (Detailfragen).** Das Grundmodell steht (pro Tool, gruppiert
  nach Lesen/Schreiben — Abschnitt 6). Offen bleibt: Wer vergibt die Klassifizierung
  verbindlich (Package-Owner) und wie wird sie geprüft? Wie behandelt man Tools mit
  gemischtem Charakter (lesen *und* schreiben)? Gilt die Freischaltung pro Organisation,
  pro Gruppe oder pro Nutzer? Braucht es ein Audit-Log für schreibende Aktionen?

---

## 12. Glossar

- **Connection** — Der Zugang zu einem externen System inkl. Anmeldung/OAuth und
  persönlichem Token pro Nutzer.
- **Tool** — Eine einzelne, eng umrissene Aktion gegen das System (suchen, lesen, …); die
  Maschinen-Schnittstelle.
- **Agent** — Ein kuratierter Assistent mit Fachverhalten, der die Tools eines Systems
  gezielt einsetzt.
- **Skill** — Ein wiederverwendbares Playbook/Ablauf (+ ggf. Wissen) für eine konkrete,
  wiederkehrende Aufgabe; wird vom Agenten bei Bedarf geladen.
- **Orchestrator / Supervisor** — Ein übergeordneter Assistent, der Anfragen erkennt und an
  den passenden Package-Agenten delegiert.
- **Package** — Das gebündelte Ganze: Connection + Tools + Agent + Skills, gebaut und
  ausgeliefert als eine Einheit.
