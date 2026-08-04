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

> **Hinweis zum Identitätsmodell:** Das hier beschriebene Modell — *jeder Nutzer
> verbindet sein eigenes Konto, der Assistent handelt in seinem Namen* — ist der
> **Standardfall („On-behalf-of", OBO)** und der richtige Default für persönliche
> Produktivität. Es ist aber **nicht der einzige** Fall: manche Integrationen bieten gar
> kein per-Nutzer-OAuth, und manche Assistenten sollen mit einer **eigenen, geteilten
> Identität** handeln statt im Namen einer Einzelperson. Diese Erweiterung beschreibt
> **Abschnitt 7** — das Fundament hier bleibt davon unberührt.

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
  heute schon vollständig. **Verfeinerung:** Genau genommen zerfällt dieser Baustein in
  *Integration* (das Zielsystem + die technische App-Registrierung) und *Identität* (der
  konkrete Zugang darin — per-Nutzer-OBO oder eine geteilte Dienst-Identität). Eine
  Integration kann **mehrere Identitäten** tragen — siehe **Abschnitt 7**.

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

## 7. Identitätsmodelle & Betriebsmodi

Die Abschnitte 2–6 beschreiben den **Standardfall**: Jeder Nutzer verbindet sein eigenes
Konto, und der Assistent handelt **in seinem Namen** (On-behalf-of, OBO). Das ist richtig
für persönliche Produktivität — deckt aber zwei reale Bedürfnisse **nicht** ab:

- **Integrationen ohne per-Nutzer-OAuth** (viele ERP-/Legacy-Systeme bieten nur API-Keys
  oder Service-Zugänge).
- **Assistenten mit eigener, geteilter Identität** — z. B. ein HR-Assistent, der allen
  Mitarbeitern Fragen zu Richtlinien beantwortet (geteiltes Wissen, nicht „meine" Daten),
  oder ein Assistent, der jeden Montag automatisch einen Report aus dem ERP erzeugt —
  **fürs Management, nicht für eine Einzelperson**.

Dieser Abschnitt erweitert das Modell um diese Fälle. Es ist eine **Erweiterung, keine
Abgrenzung**: OBO bleibt der Default; die folgenden Modi kommen daneben hinzu.

### 7.1 Zwei Achsen, die man trennen muss

Der Standardfall vermischt zwei eigentlich unabhängige Fragen zu einer:

- **Welche Identität?** — *In wessen Vollmacht* handelt der Assistent?
  → **OBO-Nutzer** (handelt als der Nutzer) vs. **Dienst-Identität** (handelt als er selbst).
- **Welcher Auth-Mechanismus?** — *Wie* entsteht das Credential?
  → **interaktives OAuth** (Browser-Login pro Nutzer) vs. **App-/Service-Credentials**
  (Client-Credentials, **API-Key**, Service-Account, …).

Beide hängen oft zusammen (OBO ⇒ meist interaktives OAuth; Dienst-Identität ⇒ meist
App-Credentials), sind aber **nicht dasselbe**. Wichtig fürs Konzept: Der **Zugang-Baustein
ist mechanismus-agnostisch** — er deckt OAuth genauso ab wie API-Key oder Service-Account.
Damit ist der Fall „Integration ohne OAuth2" gelöst: nicht alle Identitäten müssen über
einen interaktiven Login entstehen.

Hinzu kommt eine **dritte Dimension — der Auslöser-Kontext**: *interaktiv* (ein Mensch im
Chat) vs. *autonom/geplant* (kein Mensch dabei). Letzteres kann OBO gar nicht nutzen — ohne
anwesenden Nutzer gibt es kein persönliches Token, das man verwenden könnte.

### 7.2 Connection = Integration + Identitäten

Daraus folgt die in Abschnitt 3 angekündigte Verfeinerung. Eine Connection ist **nicht ein
einzelner Zugang**, sondern:

```
Connection „DocuWare/SharePoint"  (Integration: Zielsystem + App-Registrierung, Admin-Setup)
 ├── OBO-Token Nutzer A            (persönlich, automatisch beim Verbinden)
 ├── OBO-Token Nutzer B            (persönlich)
 ├── Dienst-Identität „HR"         (vom Admin angelegt; Scope: Richtlinien-Site, read-only)
 └── Dienst-Identität „Legal"      (vom Admin angelegt; Scope: Vertrags-Site, read-only)
```

Per-Nutzer-OBO und Dienst-Identitäten **koexistieren** auf derselben Integration. Der
**Assistent bindet an eine konkrete Identität**, nicht nur an „die Connection".

### 7.3 Die drei Betriebsmodi

| Modus | Identität | Auslöser | Typischer Fall |
|---|---|---|---|
| **A — Persönlich (OBO)** | Nutzer | interaktiv | „Meine Sachen"-Assistent; jeder sieht nur sein Eigenes |
| **B1 — Geteilter Wissens-/Service-Zugang** | Dienst-Identität | interaktiv | HR-Assistent liest Richtlinien aus geteilter Quelle für alle |
| **B2 — Autonom / geplant** | Dienst-Identität | zeit-/ereignisgesteuert | Montags-Sales-Report aus dem ERP, geliefert an eine Gruppe |

### 7.4 Mehrere Dienst-Identitäten pro Integration

Eine Integration kann **mehrere** Dienst-Identitäten tragen (zusätzlich zu den OBO-Token).
Gründe — alle aus echten Bedürfnissen:

- **Least Privilege / getrennte Scopes** — eine *lesende* Identität für den Report-Assistenten
  **und** eine *schreibende* für den Auftrags-Assistenten; der Report-Assistent bekommt nie
  Schreibrechte.
- **Datendomänen / Abteilungen** — *eine* SharePoint-Integration, aber HR-Identität nur auf
  die Richtlinien-Site, Legal-Identität nur auf Verträge.
- **Eigener Kosten-/Budget-Topf** — jede Dienst-Identität ist eine budgetierbare,
  abrechenbare Einheit (siehe Abschnitt 8).
- **Audit- & Rate-Isolation** — Aktionen sind einem *benannten* Service-Principal zuordenbar;
  ein durchdrehender Assistent erschöpft nicht das Kontingent der anderen.

Das ist **Industrie-Standard**: Slack (Bot-Token *und* User-Token auf einer App),
Salesforce („Integration User" neben User-OAuth), Google Workspace (Service-Account mit
Domain-Wide-Delegation neben per-Nutzer-OAuth).

### 7.5 Governance: bei Dienst-Identität kippt die Verantwortung

Das ist der sicherheitskritische Kern:

- **Bei OBO** erzwingt das **Quellsystem** die Rechte pro Nutzer — sicher by default. Jeder
  sieht nur sein Eigenes.
- **Bei Dienst-Identität** wird der Assistent zum **Daten-Gateway**: Wer den Assistenten
  nutzen darf, sieht effektiv **alles, was die Dienst-Identität sehen darf**. Die
  Zugriffskontrolle **verlagert sich** von „wer darf das im Quellsystem" auf zwei neue
  Hebel: *wie eng ist die Identität gescopt* und *wer darf den Assistenten nutzen*.
- Zusätzlich geht **Attribution** im Quellsystem verloren — es sieht „den Integrations-Account",
  nicht die handelnde Person. Das verlangt **plattformseitiges Audit** (wer/welcher Auslöser
  hat was unter der Dienst-Identität getan).

### 7.6 Das Berechtigungsmodell — drei Tore, klare Owner

Aus 7.5 folgt ein konkretes Modell. **Dienst-Identitäten legt ausschließlich der Admin an**
(passt in den Admin-Scope aus Abschnitt 2). Er setzt einen **engen Scope** und berechtigt
**eine oder mehrere Nutzer-Gruppen**, die mit dieser Identität **bauen** dürfen.

| Tor | Was es regelt | Owner |
|---|---|---|
| **Scope** der Dienst-Identität | *welche Daten / lesend-schreibend* | **Admin** (bei Anlage) |
| **Build-Freigabe** (Gruppe) | *wer mit dieser Identität bauen darf* | **Admin** |
| **Nutzungs-Freigabe** des Assistenten | *wer den fertigen Assistenten nutzen darf* | **Erbauer** |

Entscheidend: **Build-Berechtigung ≠ Nutzungs-Berechtigung.** Die Gruppe steuert nur, *wer
bauen darf* — **nicht** das spätere Publikum. Ein Erbauer aus der berechtigten Gruppe kann
einen Assistenten anschließend an **alle** freigeben. Damit liegt die wahre
Sicherheitsgrenze im **engen Scope, den der Admin setzt** — nicht in der Build-Gruppe.

### 7.7 Pflicht-Transparenz statt zusätzlichem Schloss

Weil der Erbauer das Publikum aufmacht, muss der enge Admin-Scope **verlässlich
kommuniziert** sein. Deshalb:

- Der Admin **muss** bei Anlage einer Dienst-Identität eine **ausführliche
  Scope-Beschreibung** hinterlegen (Pflichtfeld). Empfohlen **halb-strukturiert**: *Worauf
  greift sie zu? · Lesend oder schreibend? · Für welches Publikum gedacht?* + Freitext für
  Details.
- Diese Beschreibung wird dem **Erbauer transparent und prominent** angezeigt, wenn er die
  Tools dieser Identität in seinen Assistenten aufnimmt — und mit einer **expliziten
  Bestätigung** am **Freigabe-Schritt** („Mir ist bewusst, dass dieser Assistent Daten aus
  *‹Scope›* an alle freigegebenen Nutzer weitergibt"), denn das Weiten des Publikums ist der
  riskanteste Moment.
- Der Hinweis **reist mit dem Assistenten** (Kurzfassung ggf. auch für End-User sichtbar).
- **Änderungs-Fall:** Ändert der Admin Scope oder Beschreibung, werden betroffene Assistenten
  **markiert** / ihre Erbauer **re-benachrichtigt**, und die bestätigte **Version** des
  Scope-Texts wird mitgeführt. So driftet die Beschreibung nicht von der Realität weg.

### 7.8 Bindung Assistent ↔ Identität — die Leitplanken

- **Die Identität wird beim *Bauen* festgelegt, nie im Chat gewechselt.** Jeder Assistent
  hat **genau eine** Bindung: OBO-des-Aufrufers *oder* eine bestimmte Dienst-Identität.
- **„OBO" heißt immer „im Namen des aktuellen Aufrufers", niemals des Erbauers.** Ein
  geteilter OBO-Assistent läuft unter dem Token **jedes Aufrufers** und funktioniert nur,
  wenn dieser selbst verbunden ist — er **leiht nie** die Identität des Erbauers.
- **Kein automatischer Fallback** OBO → Dienst-Identität. Das wäre eine
  **Privilege-Escalation** (ein Nutzer ohne persönlichen Zugriff bekäme über die
  Dienst-Identität plötzlich Service-Level-Daten).
- **Der System-Connection-Agent bleibt OBO-only und generisch.** Dienst-Identitäten werden
  **nicht automatisch zu Agenten** — sie sind ein **Baustein**, den *zweckgebaute*
  Assistenten (Package-Agent oder vom Nutzer gebaut) bewusst binden. Das verhindert eine
  Explosion von System-Agenten (kein „User-Agent **und** Service-Agent pro Connection").

### 7.9 Durchgängiges Beispiel: der HR-Assistent (Modus B1)

1. **Admin** legt auf der DocuWare/SharePoint-Connection eine **Dienst-Identität „HR"** an:
   Scope = *nur die Richtlinien-Site, read-only*, hinterlegt die Pflicht-Beschreibung und
   berechtigt die **Gruppe „HR"** zum Bauen.
2. Eine **HR-Mitarbeiterin** baut einen **HR-Assistenten** und stattet ihn mit den
   DocuWare-Tools **über die Dienst-Identität „HR"** aus. Sie sieht dabei prominent den
   Scope-Hinweis und bestätigt ihn. (Andere Nutzer ohne HR-Build-Freigabe können diese
   Identität gar nicht erst wählen.)
3. Sie gibt den Assistenten **allen Mitarbeitern zur Nutzung** frei.
4. Jeder Mitarbeiter kann nun HR-Fragen stellen — beantwortet aus den Richtlinien-Dokumenten,
   **ohne** dass irgendjemand persönlich DocuWare verbunden hat. Die Schutzgrenze ist der
   **enge Scope**, den der Admin gesetzt und transparent beschrieben hat.

**Abgrenzung zum interaktiven Direktzugriff:** Für **spontane, persönliche** Recherche
bleibt der **OBO-System-Agent** richtig (jeder sieht nur sein Eigenes — sicher by default).
Einen rohen „Chat direkt als Dienst-Identität"-Modus gibt es bewusst **nicht** (er wäre ein
Governance-Loch). Wer eine Dienst-Identität interaktiv nutzen will, **baut sich einen
Zweck-Assistenten** und wählt ihn aus.

> **Angrenzendes Thema (bewusst ausgespart):** Modus B2 (autonom/geplant) braucht zusätzlich
> einen **Automatisierungs-Runtime** — Auslöser (Zeitplan, Ereignis/Webhook) und
> **Ausgabe-Ziele** (in einen Kanal posten, an eine Gruppe mailen). Das ist ein eigenes,
> angrenzendes Konzept und wird hier nur benannt, nicht ausgeführt.

---

## 8. Kommerzielle Betrachtung: Identität & Kosten

Die Identitätsmodelle haben eine **kommerzielle Dimension**, die das Betriebsmodell direkt
betrifft — sie gehört bewusst ins Konzept, auch wenn die konkrete Preisgestaltung eine
Produkt-/Vertriebsentscheidung ist.

Ein **Per-Seat-Modell** (z. B. ein fester Betrag pro Nutzer/Monat) nimmt implizit an: *Jede
Aktion hängt an einem zahlenden Menschen*, und die Kosten sind durch das **menschliche
Tempo** gedeckelt. Die drei Betriebsmodi verhalten sich dazu **unterschiedlich**:

| Modus | Wer löst aus | Durch Seat gedeckt? | Bepreisung |
|---|---|---|---|
| **A — OBO (persönlich)** | Nutzer | ✅ ja | Per Seat |
| **B1 — geteiltes Wissen** | Nutzer (interaktiv) | ⚠️ größtenteils | Per Seat (Verbrauch im Blick) |
| **B2 — autonom / geplant** | Zeitplan / Ereignis | ❌ nein | **Eigene Achse** + Kosten-Governance |

**Warum B2 das Seat-Modell bricht:** Hinter einem autonomen Assistenten steht **kein Seat**.
Er läuft, ob jemand online ist oder nicht; seine Kosten skalieren mit der
**Automatisierungsmenge**, nicht mit der Kopfzahl. Ein einziger Nutzer könnte mehrere
autonome Assistenten anlegen, die rund um die Uhr Ressourcen verbrauchen — die Grenzkosten
übersteigen den Seat-Preis beliebig.

**Die Konsequenz — eine zweite Preisachse (statt eines Kostenlochs):** Autonome
Dienst-Assistenten werden als **eigenständige Einheit** bepreist. Gängige Schnitte:
- **Service-Seat / „digitaler Mitarbeiter"** — ein autonomer Assistent kostet wie ein
  (Teilzeit-)Kollege, gestaffelt nach Nutzung. Intuitivste Story fürs Management.
- **Verbrauch / Credits** — ein Pool an Automatisierungs-Credits (pro Lauf / pro Verbrauch),
  Overage wird berechnet.
- **Hybrid** — jeder Seat bringt ein kleines Automatisierungs-Kontingent mit; Dienst-Assistenten
  ziehen aus dem geteilten Pool, darüber hinaus Overage.

**Kosten-Governance ist der Pflicht-Zwilling der Sicherheits-Governance (7.5).** Damit die
zweite Achse überhaupt betreibbar ist, braucht es:
- **Budgets / Quotas** pro Dienst-Identität **und** pro Mandant (harte Deckel),
- **Rate-Limits / Max-Runs** für autonome Assistenten,
- **Metering & Transparenz** pro Identität/Assistent — für die Abrechnung **und** damit der
  Kunde den Verbrauch selbst kontrollieren kann.

Das fügt sich mit Abschnitt 7.4 zusammen: **Jede Dienst-Identität ist eine budgetierbare,
abrechenbare Einheit.**

---

## 9. Rollen & Verantwortlichkeiten

| Rolle | Verantwortung |
|---|---|
| **Integration-Entwickler (Package-Owner)** | Baut & pflegt das gesamte Package: Connection, Tools, Agent, Skills, Wissen — als Einheit, versioniert. |
| **Plattform / System** | Registriert Packages, macht Tools/Agent/Skills verfügbar, kümmert sich um den per-Nutzer-Auth-Mechanismus und die Orchestrierung. |
| **Admin (beim Kunden)** | Richtet die OAuth-App ein, schaltet das Package frei, regelt Berechtigungen. **Zusätzlich (Abschnitt 7):** legt **Dienst-Identitäten** an, setzt deren engen Scope + Pflicht-Beschreibung und berechtigt **Build-Gruppen**. Einmalig, technisch. |
| **Assistenten-Erbauer (User)** | Ein Nutzer, der einen **eigenen Assistenten** baut: wählt Tools + Identität (OBO oder eine ihm freigegebene Dienst-Identität) und entscheidet über die **Nutzungs-Freigabe**. Bestätigt dabei den Scope-Hinweis. |
| **End-User** | Verbindet sein eigenes Konto und nutzt den Assistenten — direkt angesprochen oder automatisch über einen übergeordneten Orchestrator. |

Die Trennung ist bewusst: Fachwissen (Package-Owner) ≠ Betrieb/Freigabe (Admin) ≠ Bauen
(Erbauer) ≠ Nutzung (End-User).

---

## 10. Lebenszyklus eines Packages

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

## 11. Komposition: wie die Bausteine zusammenspielen

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

## 12. Warum das im skalierbaren Produkt zählt

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

## 13. Abgrenzung & bewusst offene Designfragen

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
- **Automatisierungs-Runtime (Modus B2).** Das *Identitätsmodell* für autonome Assistenten
  steht (Abschnitt 7), der **Auslöse- und Ausgabe-Teil** ist hier bewusst ausgespart:
  Zeitplan-/Ereignis-Trigger, Ausgabe-Ziele (Kanal/Mail/Dashboard), Fehler-/Retry-Verhalten.
  Das ist ein eigenes, angrenzendes Konzept.
- **Kostenmodell & Metering (Abschnitt 8).** *Dass* autonome Assistenten eine eigene
  Preis-/Budget-Achse brauchen, ist gesetzt; die **konkrete Ausgestaltung** (Service-Seat
  vs. Credits vs. Hybrid, Quota-Durchsetzung, Verbrauchs-Reporting) ist Produkt-/Vertriebs-
  und Plattform-Entscheidung.

> **Bereits entschieden (nicht mehr offen):** Identitätsmodelle (OBO vs. Dienst-Identität),
> dass **nur Admins** Dienst-Identitäten anlegen und Build-Gruppen berechtigen, die
> **Trennung Build- vs. Nutzungs-Freigabe**, der **enge Scope + Pflicht-Beschreibung** als
> Schutzgrenze, **keine In-Chat-Identitätswechsel** und **kein OBO→Dienst-Fallback** — siehe
> Abschnitt 7. Diese Punkte sind als Prinzipien gesetzt, nicht zur Disposition gestellt.

---

## 14. Glossar

- **Connection** — Der Zugang zu einem externen System. Zerfällt genauer in *Integration*
  + eine oder mehrere *Identitäten* (siehe unten).
- **Integration** — Das Zielsystem + die technische App-Registrierung (Basis-Setup), vom
  Admin einmalig eingerichtet. Trägt 1..N Identitäten.
- **Identität** — Ein konkreter Zugang innerhalb einer Integration, in einem von zwei Modi:
  *OBO-pro-Nutzer* oder *Dienst-Identität*.
- **OBO (On-behalf-of)** — Der Assistent handelt **im Namen des aktuellen Nutzers**, mit
  dessen persönlichem Token und dessen Rechten. Der Standardfall.
- **Dienst-Identität (Service-Account)** — Eine geteilte, vom Admin angelegte Identität, mit
  der ein Assistent **als er selbst** handelt (nicht im Namen einer Einzelperson) — eng
  gescopt, gruppen-berechtigt, mit Pflicht-Scope-Beschreibung.
- **Betriebsmodus** — Wie ein Assistent betrieben wird: *persönlich (OBO)*, *geteilter
  Wissens-/Service-Zugang (B1)* oder *autonom/geplant (B2)*.
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
