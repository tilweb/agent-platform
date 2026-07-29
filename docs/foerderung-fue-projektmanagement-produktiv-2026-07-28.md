# Briefing: KI-Projektmanagement — Antworten für den F&E-Call

*Kontext: RuhrPM will die Zusammenarbeit rückwirkend als F&E bewerten lassen. Simon hat die Prototyp-Phase
(Python/Streamlit, bis Anfang März) belegt; dieses Dokument fasst die Forschungsleistung aus Sicht von
Andreas zusammen und integriert beide Phasen — die bereits geleistete Prototyp-Forschung und die produktive
Weiterentwicklung im KI-Workplace.*

**Ehrlichkeits-Rahmen (bewusst gewählt):** Nicht jede Iteration ist Forschung. Wir trennen durchgängig
zwischen echter technischer Unsicherheit (kein Literatur-/Tool-Rezept, reproduzierbares Fehlverhalten,
selbst zu erarbeitende Lösung) und solidem Handwerk. Belegte Aussagen sind entweder im Code nachvollziehbar
oder durch die Prototyp-Ergebnisse dokumentiert; wo die subjektive „war-zu-Beginn-unklar"-Ebene gemeint ist,
ist das als „von Andreas zu ergänzen" gekennzeichnet.

---

## Wo die Forschung stattfand (Überblick)

Die technische Unsicherheit des Vorhabens verteilt sich auf **zwei Forschungspfeiler**, die beide
tatsächlich bearbeitet wurden:

**Pfeiler 1 — Identifikation und belastbarer Vergleich alter Projekterfahrung (im Prototyp erforscht, mit
Evidenz).** Die dreiteilige Kernaufgabe — Referenzprojekte auf einer Facette (Personen, Milestones, Risiken)
identifizieren, das Projekt pro Kategorie gegen die gefundenen vergleichen, Ergebnis und Handlungsempfehlungen
reporten — wurde im Prototyp untersucht und iterativ verbessert. Hier liegt die substanzielle, **bereits
erbrachte** Forschungsleistung (messbare Fehlerquoten, selbst definierte Vergleichsmetrik, mehrere
Iterationsstufen). Dass die produktive Übernahme dieses Teils noch aussteht, ändert an der geleisteten
Forschung nichts und ist für deren Bewertung nachrangig.

**Pfeiler 2 — Methodische KI-Bewertung eines Projektauftrags gegen die RuhrPM-Masterclass (produktiv
ausgebaut).** Die schrittweise Analyse und Bewertung des Projektauftrags (Score, Konsistenzprüfung,
Gesamtbewertung) ist im Produkt umgesetzt und im Betrieb — mit eigener, weiter bestehender Unsicherheit
(kein objektiver Bewertungsmaßstab, reproduzierbare Fehlerbilder, iterative Absicherung).

Zwischen Prototyp und Produkt gilt: der Projektauftrag wird in beiden erfasst; die methodische Bewertung ist
produktiv deutlich ausgebaut; der projektübergreifende Vergleich ist im Prototyp erforscht und produktiv noch
zu realisieren.

*Nicht Gegenstand dieses Antrags ist die allgemeine Dokument-Extraktion/-Aufbereitung; sie ist ohne Zuarbeit
von RuhrPM entstanden und bleibt hier außen vor.*

---

## Modell- und Architekturwahl (war der Lösungsweg offen?)

### Frage 1 — Welches Sprachmodell, wie kam die Wahl zustande?

Kein fest verdrahtetes Modell. Die Plattform hat eine modell-agnostische Adapter-Architektur; das konkrete
Modell ist pro Zweck und pro Kunden-Instanz konfigurierbar aus einem Adacor-kuratierten Set. Treiber der
gesamten Wahl ist die Datensouveränität (DE-Hosting, keine Speicherung der Inhalte) — nicht „das stärkste
Modell am Markt".

- Getrennte Routing-Zwecke (Dialog, App-Analysen, Vision), je austauschbar; ein Modellwechsel erfordert keine
  Code-Änderung.
- Belegter Lebenszyklus: Prototyp auf Mistral 3 24B; der agentische Kern dann gezielt
  auf Qwen 3.5; Bildverarbeitung bewusst bei Mistral. Produktive Kunden-Instanzen laufen aktuell auf
  Mistral 3 24B (128k-Kontext); in der Weiterentwicklung werden neuere Modelle erprobt. Das heutige
  Chat-Modell existierte zur Prototyp-Zeit noch nicht.
- War der Weg offen? Ja — belegt durch den mehrfachen Modellwechsel unter der Souveränitäts-Nebenbedingung.
  Es gab keine Vorlage „Modell X für PM-Beratung"; die Eignung war je Modell empirisch zu prüfen (jedes
  Modell hat eigene Fehlertypen, siehe Fragen 5/6).

Einordnung: Die Adapter-Abstraktion selbst ist Standard-Engineering. Die kuratierte Modellwahl unter
Datensouveränität und die empirische Eignungsprüfung sind Ausdruck eines offenen Lösungswegs, aber allein
noch nicht der stärkste Forschungshebel.

### Frage 2 — Verfolgte und wieder verworfene Architektur / Sackgassen?

- Vielstufiger Vergleichsprozess (Prototyp) verworfen. Der mehrstufige Vergleich funktionierte, brauchte
  aber Minuten pro Durchlauf; der agentische Ansatz ist mächtiger und zeitgemäßer, weshalb die vielstufige
  Variante als überholt entfernt wurde. Das ist eine reale, im Forschungsprozess getroffene Kurskorrektur.
- Standalone-Streamlit zur Integration in den KI-Workplace (Rechte, Persistenz, geteilte Dienste) — eine
  Produkt-/Architekturweiche.
- Reasoning-Reihenfolge im Bewertungs-Output (siehe Frage 5): der zunächst naheliegende Weg „Bewertung
  zuerst" lieferte reproduzierbar schlechtere Ergebnisse und wurde verworfen (Begründung vor Bewertung).
- Ein konkreter Auswertungspfad in der produktiven Analyse (Zusammenführung zweier Datenquellen) lieferte
  reproduzierbar leere Ergebnisse; Ursache eingegrenzt und korrigiert (siehe Frage 5).

Einordnung: Die Reasoning-Reihenfolge und die Auswertungs-Fragilität sind echte, vorab nicht wissbare
Erkenntnisse im methodischen Kern; die Architektur-Weichen (agentisch, Workplace) sind Produktentscheidungen.

---

## Retrieval / Wissenszugriff (Kernstück der möglichen F&E)

### Frage 3 — Wie greift das System auf Handbücher, Masterclass, Projekterfahrungen zu?

- Masterclass und Handbuch: kuratierte Dateien direkt im Prompt, kein Vektor-RAG. Das Schritt-Wissen
  (Kernkonzepte, Prüfkriterien, typische Fehler, Verbesserungsvorschläge) wird pro Wizard-Schritt direkt in
  den Prompt injiziert. RAG war für das kleinere Mistral einmal geplant, ist durch die großen Kontextfenster
  neuerer Modelle bewusst unnötig geworden. Das ist eine bewusste Vereinfachung — und
  gilt im Prototyp wie im Produkt gleichermaßen.
- Der Zugriff auf **Projekterfahrungen** (Identifikation und Vergleich) ist der schwierigste Teil gewesen.
  Er wurde im Prototyp erforscht; genau hier lag die zentrale anfängliche Unsicherheit — Scheinzusammenhänge,
  „findet nichts Passendes" und Fehlinterpretationen traten reproduzierbar auf und waren der schwierigste
  Teil. Im Produkt existiert bislang nur der projekteigene Blick (Lessons Learned je Projekt); der
  projektübergreifende Vergleich ist die produktiv noch zu realisierende Ausbaustufe — inhaltlich unverändert
  dieselbe, im Prototyp bereits mit Evidenz untersuchte Herausforderung.

### Frage 4 — Was musstet ihr empirisch erarbeiten, ohne Vorlage?

Bekannt war nur das LLM-Handwerk (Chat-Nachrichten, strukturierter Output über JSON-Schema). Alles Fachliche
war ohne Standardrezept zu erarbeiten:

- Vergleichsqualität ohne Vorlage (Prototyp, geleistet). Es gab kein Standardmaß für einen „guten Vergleich"
  und kein Vergleichs-Dataset — beides musste selbst definiert werden. Es existierte kein Standardweg, und
  jedes Modell brachte eigene Fehlertypen mit. Das ist der empirische Kern der bereits erbrachten Forschung.
- Methodische Bewertung ohne objektiven Maßstab (produktiv). Es gibt kein validiertes Verfahren, das die
  Qualität und innere Konsistenz eines Projektauftrags gegen eine Methodik „richtig" bewertet. Wie man ein
  Sprachmodell dafür so führt, dass die Bewertung reproduzierbar und vertrauenswürdig wird (injizierte
  Kriterien, Begründung-vor-Bewertung, Feld-Bezug, schrittübergreifende Konsistenz), war selbst zu erarbeiten
  (siehe Frage 7).

---

## Ergebnisqualität und Halluzination (reproduzierbares Fehlverhalten)

### Frage 5 — Methodisch plausibel, aber reproduzierbar falsch — Ursache eingegrenzt?

- „Decision before Reasoning"-Antipattern (im Prototyp erkannt, produktiv verankert). Gibt das Modell im
  strukturierten Output zuerst die Bewertung und erst danach die Begründung aus, liefert es reproduzierbar
  schwächere und inkonsistente Ergebnisse. Der Fix — erst Stärken/Schwächen/Hinweise, dann Bewertung — ist
  eine belegte Erkenntnis aus der Prototyp-Phase und im produktiven Bewertungsschema fest verdrahtet.
- Reproduzierbarer 0-%-Bereich (Prototyp). Ein methodisch plausibler „allgemeiner Vergleich" lieferte
  reproduzierbar nahezu keine brauchbaren Treffer; die Ursache wurde eingegrenzt (rund 40 Prozent der Fehler
  gingen auf fehlende konkrete Zahlen zurück) und gezielt behoben (siehe Frage 6).
- Konkreter produktiver Defekt mit Ursacheneingrenzung. Die Analyse des Roadmap-Schritts — der einzige, der
  zwei Datenquellen zusammenführt (Meilensteine und Hauptaufgaben) — lieferte reproduzierbar leere Ergebnisse,
  weil beim Zusammenführen die falschen Ergebnisfelder gelesen wurden. Eingegrenzt durch isolierte
  Reproduktion des Analysepfads außerhalb der Oberfläche, dann behoben. Illustriert die Fragilität solcher
  Auswertungen an Zusammenführungs- und Schemagrenzen.

Einordnung: Reproduzierbares Fehlverhalten mit methodischer Ursacheneingrenzung ist das klassische Signal
technischer Unsicherheit; alle drei Punkte betreffen den methodischen Kern, nicht die Peripherie.

### Frage 6 — Datenaufbereitung, die nicht trug — konkretes Beispiel?

- Prototyp (geleistet, mit Messung). Der „allgemeine Vergleich" trug reproduzierbar nicht (0-%-Bereich); rund
  40 Prozent der Fehler waren fehlende konkrete Zahlen. Über die Datenaufbereitung und die Prompts wurde
  gegengesteuert (Zahlen erzwingen, Historie als strukturiertes Feld führen), mit messbarer Verbesserung über
  mehrere Versionen. Ein Lehrbuchbeispiel für „nach hinten, dann anders wieder nach vorne".
- Produktiv (RuhrPM-relevant). Die Bewertung forderte anfangs Verbesserungen, die im Tool gar nicht umsetzbar
  waren, oder meldete bereits abgedeckte Best Practices als „fehlend" (etwa den Auftraggeber, der über
  Gruppe/Rolle erfasst wird, oder ein nicht existierendes separates Sponsor-/Jobtitel-Feld). Methodisch
  plausibel, praktisch unbrauchbar. Behoben über die Datenaufbereitung des Prompts: ein injiziertes Schema der
  tatsächlich erfassbaren Felder plus Leitplanken (nur vorschlagen, was über diese Felder umsetzbar ist; nie
  nicht existierende Felder fordern).

---

## Scoring / Konsistenzprüfung (nichttriviales Modellierungsproblem)

### Frage 7 — Wie funktioniert „65/100" und die Konsistenzprüfung, und worin lag die Schwierigkeit?

Mechanik:

- Der Score (0–100) ist modellerzeugt (das Sprachmodell als Bewertungsinstanz) über strukturierten
  JSON-Output, nicht deterministisch berechnet. Bewertet wird je Schritt gegen die injizierten
  Masterclass-Prüfkriterien; die Ausgabe erfolgt in der Reihenfolge Begründung vor Bewertung. Es gibt grobe
  Bedeutungsbänder (0–40 grundlegende Probleme bis 81–100 exzellent).
- Die Konsistenzprüfung lässt das Modell den aktuellen Schritt gegen die Daten definierter Vorschritte prüfen
  (Ziele gegen Umfang gegen Aufgaben gegen Meilensteine gegen Budget/Risiken gegen Organisation) und meldet
  Befunde mit Status (konsistent, Warnung, inkonsistent). Es ist keine Regel-Engine, sondern eine geführte
  Prüfung mit injiziertem Vorschritt-Kontext.
- Die Gesamtbewertung aggregiert die Schritt-Scores gewichtet und leitet einen Projektreife-Status ab.

Die Schwierigkeit — und damit die Unsicherheit:

- Es gibt keine objektive Referenzbewertung für „ein guter Projektauftrag". Der Score ist ein Modell-Urteil,
  kein validiertes Messinstrument. Die Kernfrage war: Kann man ein Sprachmodell so führen, dass seine
  Bewertung reproduzierbar und vertrauenswürdig genug ist, dass ein Projektmanager ihr folgt?
- Reproduzierbarkeit und Stabilität, die Empfindlichkeit gegenüber der Prompt-Reihenfolge (Begründung-vor-
  Bewertung war eine belegte Stellschraube) und die Fragilität an Schema- und Zusammenführungsgrenzen (der
  Roadmap-Defekt aus Frage 5) zeigen: verlässliches, nachvollziehbares Scoring ist nicht trivial und musste
  iterativ abgesichert werden.
- Eine formale Validierungsstudie (Übereinstimmung mit menschlichen
  Gutachtern, Kalibrierung des Scores) steht aus.

Einordnung: „Verlässliches, konsistentes Modell-Urteil über die methodische Qualität eines Projektauftrags
ohne objektiven Maßstab" ist ein nichttriviales Modellierungsproblem und der produktiven Weiterentwicklung
zuzuordnen.

---

## Datenregime / Cold Start

### Frage 8 — Ergebnisqualität bei kaum strukturierter Historie? Ab wann werden Ergebnisse valide?

Es sind zwei verschiedene Datenregime sauber zu trennen:

1. Schritt-Analyse und Bewertung: kein Cold-Start-Problem. Die Bewertung läuft ab dem ersten Projekt, weil sie
   die Eingaben gegen die injizierten Masterclass-Kriterien prüft, nicht gegen andere Projekte. Ein Kunde
   braucht dafür keine strukturierte Historie.
2. Projektübergreifender Vergleich: echtes Sparse-Data-Regime — im Prototyp bereits durchdacht. Schon ein
   einziges Referenzprojekt bringt Nutzen, wenn es auf einer Facette passt (eine Person aus dem geplanten Team,
   die anderswo Ähnliches gemacht hat; eine Milestone-Konstellation, die schon einmal Probleme machte; ein
   Risiko, das früher zu Verzögerungen führte). Mehr Referenzprojekte bedeuten mehr und bessere
   Facetten-Treffer; bei null ist das Verfahren nutzlos; ab kritischer Masse wird die Identifikation selbst
   (welches Projekt passt auf welcher Facette?) zum harten Problem — genau der anspruchsvollste Teil. Ab
   welcher Menge und Art von Daten die Ergebnisse valide werden, war zu Beginn nicht klar und musste sich
   zeigen.

---

## Die eine entscheidende Frage

### Frage 9 — Die offene technische Frage, ohne Antwort aus Literatur, Doku oder bestehenden Tools?

Zwei echte offene Fragen, beide tatsächlich bearbeitet:

1. Identifikation und belastbarer Vergleich alter Projekterfahrung (im Prototyp erforscht, mit Evidenz). Wie
   findet man verlässlich die auf einer Facette (Personen, Milestones, Risiken) relevanten Referenzprojekte,
   und wie vergleicht man belastbar — echte Risiken statt Scheinzusammenhänge? Sowohl die Identifikation als
   auch der Vergleich waren harte Themen ohne Literatur oder Tool. Der Vergleich wurde ausgeführt und zeigt
   die Forschung mit Evidenz (messbare Fehler, 0-%-Bereich, Iterationen); die Identifikation über Facetten war
   geplant und blieb im Prototyp unausgeführt. Das ist der substanzielle, bereits geleistete Forschungskern;
   die produktive Realisierung ist der nächste Schritt, ändert aber nichts an der erbrachten Leistung.
2. Vertrauenswürdiges Modell-Urteil ohne objektiven Maßstab (produktiv ausgebaut). Kann ein Sprachmodell die
   methodische Qualität und die interne Konsistenz eines Projektauftrags reproduzierbar und belastbar genug
   bewerten, dass ein Projektmanager der Bewertung folgt — ohne objektive Referenzbewertung? Kein
   Literatur- oder Tool-Rezept; die Modellführung und ihre Fragilität waren selbst zu erarbeiten (Fragen 5/7).

---

## Verdichtung: Was ist F&E, was ist Handwerk

| Bereich | Einordnung | Begründung |
|---|---|---|
| Identifikation und Vergleich alter Projekterfahrung | Forschung (im Prototyp geleistet, mit Evidenz) | kein Standardmaß, kein Dataset, messbare Fehler und Iterationen; produktive Umsetzung offen |
| Methodische Bewertung/Konsistenz ohne objektiven Maßstab | Forschung (produktiv ausgebaut) | nichttriviales Modellierungsproblem; reproduzierbare Fehler mit Ursacheneingrenzung |
| „Decision before Reasoning" / Reasoning-first, Feld-Bezug | Erkenntnis (belegt) | reproduzierbarer Effekt, im Schema verankert |
| Roadmap-Auswertung (Fragilität) | Beispiel (reproduzierbar, ursacheneingegrenzt) | zeigt Schema-/Zusammenführungsgrenzen |
| Kuratierte, DE-souveräne Modellwahl | offener Lösungsweg | keine Vorlage; mehrfacher Modellwechsel |
| Modell-Adapter / Multi-Provider | Standard-Engineering | bekanntes Muster, austauschbar |
| Masterclass-Wissen per Prompt statt RAG | bewusste Vereinfachung | kein Forschungsrisiko |
| Cold-Start beim Bewerten | kein Problem | kriterienbasiert, ab dem ersten Projekt |
| Cold-Start beim Vergleich | Forschungsrelevant | echtes Sparse-Data-Regime (im Prototyp durchdacht) |

---

## Für den Call: was Andreas noch aus Erinnerung schärfen sollte

Die obigen Aussagen sind belegt (Code beziehungsweise Prototyp-Ergebnisse). Die subjektive Ebene „was war zu
Beginn unklar" kann nur Andreas liefern — genau das ist förderrelevant. Je ein konkreter Evidenz- oder
Anekdotensatz:

- Vergleich/Identifikation (Fragen 3/8/9): Woran habt ihr im Prototyp reproduzierbar gemerkt, dass „findet
  nichts Passendes" oder Scheinzusammenhänge auftreten — und welche Iterationen (v1 bis v3) haben es messbar
  besser gemacht?
- Bewertung (Fragen 5/6/7): Welche Fehlbewertungen kamen anfangs reproduzierbar, und wie habt ihr praktisch
  geprüft, ob man dem Score trauen kann (etwa Stichproben gegen das eigene Urteil)?
- Feld-Bezug (Frage 6): ein bis zwei konkrete Fälle, in denen die Analyse Unumsetzbares forderte, bevor die
  Leitplanken kamen.
- Modelle (Fragen 1/5): ein Modell mit reproduzierbar eigenem Fehlertyp an dieser Aufgabe.

*Belege auf Ebene der Mechanik liegen vor und können je Frage nachgereicht werden.*
