# JA 31 – Große Klappe, kleines Blatt

## Spaßmenü 1.9

- freundliches zweispaltiges Hauptmenü speziell fürs Querformat
- persönliche Begrüßung und farbige Spielmodi
- wechselnde Sprüche von Karten-Kalle
- Überrasch-mich-Schnellstart
- deutlichere Tagesmissionen und Glücksrad-Belohnung

## Querformat-Fix 1.8

- komplette Computer-Arena passt ohne Scrollen auf einen Handybildschirm
- Spieltisch links und feste Aktionsleiste rechts
- kompaktere Karten, Avatare und Gegneranzeigen für kleine Displays

## Battle Update 1.7

- tägliches animiertes JA-Glücksrad mit acht Gewinnfeldern
- sichtbarer 3-2-1-Countdown beim Klopfen
- pulsierender Alarmtisch während der letzten Züge
- fliegende Karten beim Einzel- und Kompletttausch
- drei unterschiedliche Bot-Stärken: Locker, Frech und Brutal
- Schwierigkeitsanzeige direkt in der Arena

Spielbarer App-Prototyp Version 0.6 für Android und iPhone auf Basis von Expo/React Native.

## Enthalten

- 32-Karten-Blatt und korrekte 31-Punktewertung
- Drei Leben pro Spieler
- Einzeltausch und Tausch aller drei Karten
- Computergegner mit Zugbewertung
- JA-Schäfers-Design in Schwarz, Weiß und Rot
- lokaler Weitergabe-Modus für 2–4 Personen auf einem Handy
- verdeckte Kartenübergabe und letzter Zug für alle nach dem Klopfen
- gemeinsame Rundenauswertung; alle Spieler mit dem niedrigsten Wert verlieren ein Leben
- Online-Lobby: Raum erstellen oder per sechsstelliger Einladung beitreten
- anonyme Geräte-Anmeldung ohne E-Mail und Passwort
- Echtzeit-Warteraum für bis zu vier Spieler
- synchronisierte Online-Partie mit Karten, Spielerreihenfolge, Tauschen und Klopfen
- 1.000 erspielbare Start-Coins ohne Echtgeldkauf oder Auszahlung
- Erfahrungspunkte, Levelaufstiege und freischaltbare Einsätze
- Einsätze: 50 Coins ab Level 1, 100 ab Level 2, 250 ab Level 3, 500 ab Level 5 und 1.000 ab Level 10
- automatischer 100-Coin-Comeback-Bonus, damit niemand ohne Spieleinsatz festhängt

## Lokal starten

1. Node.js installieren.
2. Im Projektordner `npm install` ausführen.
3. `npm start` ausführen.
4. Den QR-Code mit Expo Go auf dem Android- oder iPhone-Gerät öffnen.

## Online-Verbindung aktivieren

Die Projektfassung ist live mit dem Supabase-Projekt **JA31** in West-Europa verbunden. Die Tabellen, RLS-Sicherheitsregeln, anonyme Anmeldung und Echtzeit-Aktualisierung wurden am 09.08.2026 eingerichtet und über eine echte anonyme Anmeldung samt Testraum geprüft.

## Nächste Ausbaustufe

- dauerhaftes Spielerprofil und Wiederverbindung nach Verbindungsabbruch
- Freundesliste und private Einladungen
- Feinschliff bei Animationen, Sounds und Kartenmotiven
