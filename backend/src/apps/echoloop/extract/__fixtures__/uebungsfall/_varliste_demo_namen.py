# -*- coding: utf-8 -*-
"""Namens-Modul des Übungsfalls · Musterwerk GmbH, Familie Eingangsrechnungen.

Fiktiv. Die Zielnamen folgen **NK v2.2**: Präfix nach Rolle (§A3), Kategorie-Wort
HINTEN aus der geschlossenen Wortliste (§A3b ②: Pfad · Datei · Datum · Text · Zahl ·
Name · Nummer · Status · Anzahl · Grund · Dateiname).

Bei einer echten Familie ist dieses Modul das EINZIGE, was die Projekt-Session
schreibt (plus das Lauf-Skript). Engine und Template bleiben unangetastet.
"""

# ── alt → (neu, Rolle) ────────────────────────────────────────────────────
# Die Schlüssel sind die IST-Namen aus der Ausleitung. Wo IST-Name und Zielname
# identisch sind, ist im Prozess bereits umbenannt — der Explorer hakt solche
# Zeilen vorab ab (außer Reiter 3 widerspricht, siehe C_DruckerName).
MAP = {
    # ── Einstellungen (C_): kommen aus der CONFIG-Excel ──────────────────
    "Ablageordner Rechnungen": ("C_EingangPfad", "C"),
    "Archivordner": ("C_ArchivPfad", "C"),
    # Dieselbe Größe, in Prozess 213 schon umbenannt, in 211 noch nicht.
    # → P-A KOPPLUNGS-RISS: die Übergabe über Namensgleichheit ist TOT, bis
    #   beide Stellen umgestellt sind. Paarweise anfassen.
    "C_ArchivPfad": ("C_ArchivPfad", "C"),
    "Schwellwert Betrag": ("C_PruefSchwelleZahl", "C"),
    "Mailpostfach": ("C_PostfachText", "C"),
    # Im Prozess fertig umbenannt, in der Excel nicht → Reiter 3 sperrt den
    # Vorabhaken (D-085). Nicht „vergessen", sondern absichtlich offen.
    "C_DruckerName": ("C_DruckerName", "C"),
    "Vorlagendatei Prüfprotokoll": ("C_ProtokollVorlageDatei", "C"),
    "Protokolldatei": ("C_ProtokollDatei", "C"),
    "Ablagepfad Monat": ("C_MonatsPfad", "C"),
    "Aufbewahrungsjahre": ("C_AufbewahrungZahl", "C"),

    # ── Hilfsvariablen (H_): flüchtig, nur im eigenen Prozess ────────────
    "Aktuelles Datum": ("H_HeuteDatum", "H"),
    "Zähler": ("H_LaufZahl", "H"),
    "Betreff Filter": ("H_BetreffText", "H"),
    "Anlagenordner": ("H_AnlagenPfad", "H"),
    "Rechnungsbetrag": ("H_BetragZahl", "H"),
    # Zweiter Name für dieselbe Größe im SELBEN Prozess 213 → P-C DUBLETTE.
    # Bei „Ausgehend" wäre undefiniert, welcher Wert die Prozessgrenze quert;
    # hier ist beides privat, also „nur" eine Altlast — aber sie muss weg.
    "Rechnungsbetrag alt": ("H_BetragZahl", "H"),
    "Lieferantenname": ("H_LieferantText", "H"),
    "Prüfprotokoll Zeile": ("H_ZeileZahl", "H"),

    # ── Verfolgung (T_): überlebt den Lauf, geht ins Lauf-Protokoll ──────
    "Lauf erfolgreich": ("T_LaufErgebnis", "T"),
    "Startzeit": ("T_StartDatum", "T"),

    # ── Fachwerte: OHNE Präfix (NK v2.2 §A3 ③) ──────────────────────────
    # Der Fachwert wandert durch mehrere Prozesse und heißt überall exakt gleich —
    # daran koppelt EMMA. Er trägt deshalb KEIN Präfix.
    #
    # Hier stand bis zum 07.08. `U_AnzahlZahl` & Co., und das war falsch. `U_` sollte
    # „Übergabe zwischen Prozessen" heißen — also die SCHNITTSTELLE. Genau die gehört
    # laut §A3 ② nicht in den Namen: dieselbe Variable ist im CFG-Prozess „Ausgehend",
    # im Master „EinAus" und im Teilprozess „Eingehend". Ein `U_` würde in mindestens
    # einem Prozess lügen. Das Rollen-Kürzel bleibt `U` — es ist der CODE für
    # „Fachwert ohne Präfix", nicht ein Präfix. Gefunden hat den Fehler das NK-Gate
    # der Engine beim ersten Lauf nach der Verankerung.
    #
    # 212 liefert die Zahl (Ausgehend), 210 nimmt sie (Eingehend) — verschiedene
    # IST-Namen, ein Zielname. Genau das macht die Kopplung erst sichtbar.
    "Anzahl Mails": ("RechnungenAnzahl", "U"),
    "Anzahl Rechnungen": ("RechnungenAnzahl", "U"),
    "Fehlertext": ("FehlerGrund", "U"),
    "Prüfung bestanden": ("PruefungStatus", "U"),
}

# Nur nötig, wenn derselbe ALTE Name je Prozess etwas ANDERES meint.
# Bei dieser Familie kommt das nicht vor — leer lassen ist die richtige Antwort,
# nicht das Füllen „für alle Fälle".
MAP_JE_PROZESS = {}

# Prozessnummer → (Name, Einstufung). NK v2.3 §A9: MP = Master (steuert, wird nicht
# gerufen) · TP = Teilprozess (fachlicher Teilschritt) · SP = Stützprozess (stellt
# bereit, trägt keine Fachlogik). Die Einstufung ist NICHT die Kritikalität —
# die steht mit Begründung im Steckbrief.
# Die Namen stehen hier EXAKT so, wie sie in der Ausleitung stehen — auch wenn sie
# Leerzeichen und Sonderzeichen tragen. Was der Kunde gebaut hat, wird nicht geschönt.
PROZESSE = {
    "210": ("Rechnungseingang · Hauptlauf", "MP"),
    "211": ("MW_ERECH_Config_UTIL", "SP"),          # schon umbenannt
    "212": ("Postfach auslesen", "SP"),
    "213": ("Rechnung prüfen", "TP"),   # trägt Fachlogik: Betrag gegen Schwelle
    "214": ("Ablage und Protokoll · Config", "SP"),
}

# ── Ziel-Prozessnamen nach NK v2.2 §A2 ────────────────────────────────────
# Schema `<NS>_<FAMILIE>_<Funktion>[_<Rolle>]`; Rolle aus der festen Liste
# `_MASTER` · `_SUB` · `_TRACK` · `_UTIL`. Namensraum `MW` (Musterwerk, 2–6 Zeichen),
# Familie `ERECH` (Eingangsrechnungen, 2–6 Zeichen), Funktion sprechend ohne
# Umlaute/Leerzeichen — Bindestrich im Wortinneren ist erlaubt.
#
# WARUM DIESE AUSPRÄGUNG UND NICHT `MP-`/`TP-`: §A2 kennt zwei gelebte Ausprägungen
# (Rollen-Suffix und Leipziger Typ-Präfix) und lässt die Wahl ❓F5 ausdrücklich OFFEN.
# Verbindlich ist heute nur: **je Familie EINE Ausprägung, konsequent.** Diese Familie
# wählt das Rollen-Suffix und bleibt dabei. Fällt der Entscheid anders aus, ist das
# hier eine Zeile — deshalb steht es hier und nicht in der Engine.
PROZESSE_SOLL = {
    "210": "MW_ERECH_Rechnungslauf_MASTER",
    "211": "MW_ERECH_Config_UTIL",        # identisch mit dem Ist-Namen → konform
    "212": "MW_ERECH_Postfach-Auslesen_SUB",
    "213": "MW_ERECH_Rechnung-Pruefen_SUB",
    # 214 hat BEWUSST keinen Eintrag: der Uebungsfall traegt damit den D-095-Fall —
    # der Explorer leitet den Default maschinell ab und kennzeichnet ihn als VORSCHLAG.
}

# ── Soll-Texte je Prozess (D-094, LE-Vorlage): rechte Spalte des Ist/Soll-Paars ──
# Die Soll-Beschreibung folgt §A9 ②: Typ vorn, damit sie 1:1 ins EMMA-Beschreibungsfeld
# kopiert werden kann. Nur befuellen, was BELEGT entschieden ist — leere Felder der
# Soll-Spalte sind Erfassungsauftraege, keine Luecken.
PROZESSE_SOLL_META = {
    "210": {"typ": "MP", "krit": "hoch",
            "kritgrund": "Zahlungsfristen — bleibt der Lauf stehen, mahnen Lieferanten.",
            "beschr": "MP · Der Master: laedt die Konfiguration (211), laesst das Postfach "
                      "auslesen (212) und schickt jede Rechnung durch die Pruefung (213).",
            "ergebnis": "Alle Rechnungen des Laufs geprueft, Zaehler = Rechnungszahl, "
                        "A_Ergebnis gesetzt."},
    "213": {"typ": "TP", "krit": "hoch",
            "kritgrund": "Fachkern: falsche Freigabe = falsche Zahlung.",
            "beschr": "TP · Liest Betrag und Lieferant, vergleicht mit der Freigabeschwelle "
                      "aus der Config und schreibt eine Zeile ins Pruefprotokoll.",
            "ergebnis": "Pruefergebnis gesetzt, eine neue Protokollzeile."},
}

# ── Prozesse, die es noch NICHT gibt (Anforderung 1 aus dem LE-Handshake) ──
# Der Explorer soll die Familie zeigen, wie sie werden soll — nicht nur, wie sie ist.
# Diese Zeilen haben keine Ausleitung, deshalb kein Export, keine Variablen, keine
# Fundstellen. Sie tragen dieselben Felder zum Abhaken und Kommentieren.
# `id` ist token-relevant und damit APPEND-ONLY: nie umbenennen, nie neu vergeben.
PROZESSE_GEPLANT = [
    {"id": "G1", "name": "MW_ERECH_Lauf-Protokoll_TRACK", "typ": "SP",
     "beschreibung": "Schreibt je Lauf eine Zeile ins Protokoll: Startzeit, Zahl der "
                     "Rechnungen, Ergebnis. Heute merkt sich die Familie nichts — nach "
                     "einem Abbruch ist nicht rekonstruierbar, was schon verarbeitet war.",
     "ergebnis": "Eine neue Zeile je Lauf, mit A_Ergebnis-Wert (OK / NICHTS-ZU-TUN / "
                 "GESTOPPT:<Stelle>).",
     "warum": "Die Variablen T_LaufErgebnis und T_StartDatum existieren bereits in 210 — "
              "sie werden gesetzt, aber nirgends hingeschrieben. Der Prozess fehlt, nicht "
              "die Daten."},
    {"id": "G2", "name": "YN_BASIS_Mail-Anmelden_SUB", "typ": "SP",
     "beschreibung": "Hausbaustein: meldet sich am Mailsystem an und gibt das offene "
                     "Fenster zurück. Wiederverwendbar über Kunden hinweg.",
     "ergebnis": "Mailprogramm offen und angemeldet; A_Ergebnis gesetzt.",
     "warum": "212 macht die Anmeldung heute selbst. Als YN_-Baustein gehört sie einmal "
              "gebaut und überall gerufen — Namensraum YN nach §A1."},
]

# Vorbefüllung der Prozess-Steckbriefe (Reiter 2).
# REGEL: nur, was aus der Ausleitung belegt ist. Die KRITIKALITÄT bleibt überall
# leer — die stuft der Mensch ein, das ist der Sinn des Feldes. Ein vorbefülltes
# „hoch" wäre eine Behauptung, die niemand aufgestellt hat.
PROZESS_META = {
    "210": {"beschreibung": "Der Hauptlauf: holt die Konfiguration, lässt das Postfach "
                            "auslesen und schickt jede gefundene Rechnung durch die Prüfung.",
            "ergebnis": "Alle Rechnungen des Laufs sind geprüft, der Zähler steht auf der "
                        "Zahl der Rechnungen, das Lauf-Ergebnis ist gesetzt."},
    "211": {"beschreibung": "Lädt die Einstellungen aus der CONFIG-Excel in die "
                            "C_-Variablen. Läuft nie allein.",
            "ergebnis": "Alle Einstellungen sind gefüllt; kein C_-Wert ist leer."},
    # 212 hat BEWUSST keine META (v3.10): der Uebungsfall traegt damit den HZL-Regelfall
    # „nichts erfasst, keine RGA-Zeile" — links muss der Herkunfts-Hinweis stehen
    # (EMMA exportiert die Panel-Beschreibung nicht), rechts muss die Kaskade aus der
    # STRUKTUR vorschlagen (Aufrufer/Ausgaenge/Variablen), als VORSCHLAG markiert.
    "213": {"beschreibung": "Liest Betrag und Lieferant aus der Rechnung, vergleicht mit "
                            "der Freigabeschwelle und schreibt eine Zeile ins Prüfprotokoll.",
            "ergebnis": "Prüfergebnis gesetzt, eine neue Zeile im Prüfprotokoll."},
    "214": {"beschreibung": "Lädt die Einstellungen für Ablage und Protokoll. Zweiter "
                            "CONFIG-Prozess der Familie.",
            "ergebnis": "Ablagepfad und Protokolldatei sind gesetzt."},
}

TYP_PANEL = {
    "string": "Text", "int": "Ganze Zahl", "bool": "Boolean",
    "datetime": "Datum&amp;Uhrzeit", "double": "Kommazahl", "password": "Passwort",
}

# GENAU VIER Rollen — der Kanon aus NK v2.2 §A3 ③ (G7 prüft die Zahl).
# `U` ist das Kürzel für den Fachwert OHNE Präfix, nicht für ein Präfix `U_`.
ROLLE_TEXT = {
    "C": "Einstellungen",
    "H": "nur in diesem Prozess",
    "T": "Verfolgung",
    "U": "Fachwert ohne Präfix — koppelt über Namensgleichheit",
}
