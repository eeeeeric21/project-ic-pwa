# Project IC PWA

A Progressive Web App for elderly health check-ins.

## Features

- 🎤 Voice input (tap to speak)
- 🔊 Voice output (AI speaks back)
- 📊 Real-time risk scoring
- 👨‍👩‍👧‍👦 Patient & Caregiver views
- 📱 Installable on any device

## Quick Start

### Option 1: Local Server (Recommended)

```bash
cd ~/clawd/pwa

# Using Python
python3 -m http.server 8080

# Or using Node.js
npx serve .
```

Then open: http://localhost:8080

### Option 2: Host on GitHub Pages

1. Create a new GitHub repo
2. Upload all files in this folder
3. Settings → Pages → Enable
4. Access at: https://yourusername.github.io/repo-name

### Option 3: Host on Netlify/Vercel (Free)

Drag & drop this folder to:
- https://app.netlify.com/drop
- https://vercel.com/new

## Demo Accounts

**Patient:**
- Enter any name → Start check-in

**Caregiver:**
- ID: any
- PIN: 1234

## Usage

1. **Patient View:**
   - Enter name → Start
   - Tap mic button to speak
   - Or use quick reply buttons
   - AI responds with voice

2. **Caregiver View:**
   - Login with PIN 1234
   - See patient status
   - View alerts

## Files

| File | Purpose |
|------|---------|
| index.html | Main app structure |
| styles.css | UI styling |
| app.js | Application logic |
| manifest.json | PWA configuration |
| sw.js | Service worker (offline) |

## Browser Support

- ✅ Chrome (recommended)
- ✅ Safari
- ✅ Edge
- ⚠️ Firefox (limited voice)

## Notes

- Voice works best in Chrome
- HTTPS required for production
- Uses MERaLiON API for AI responses
