# Fotobox

Touchscreen-Fotobox für 4:3-Monitor. Sucher mit Spiegelbild, Capture-Button mit 3-Sekunden-Countdown, danach on demand QR-Code zum Herunterladen des Fotos übers LAN.

## Setup

```bash
npm install
npm run dev      # Entwicklung (watch)
npm start        # Produktion
npm run kiosk    # Server + Chrome im Kiosk-Modus
```

App läuft auf `http://localhost:3000`. QR-Codes zeigen auf die LAN-IP des Rechners — Gäste müssen im selben Netz sein (z.B. Event-WLAN).

## Ablauf

1. Sucher (gespiegelt, Foto selbst ungespiegelt)
2. Roter Auslöser → Countdown 3-2-1 → Blitz
3. Vorschau mit **Neues Foto** / **QR-Code**
4. QR-Code lädt das Foto erst dann hoch und zeigt den Scan-Code

Fotos liegen in `data/photos/`.

## Hinweise

- `getUserMedia` braucht Secure Context — `localhost` zählt, daher Kiosk-Browser auf demselben Rechner laufen lassen.
- Kamera-Berechtigung im Kiosk-Modus: `kiosk.ps1` setzt `--use-fake-ui-for-media-stream` (auto-allow).
- Port via `PORT`-Env änderbar.
