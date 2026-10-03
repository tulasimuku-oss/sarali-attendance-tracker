# Sarali

Static studio app for private music teachers: attendance, fees, calendar, notes, and audio. Data stays in this browser.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Production build

```bash
npm run build
npm run preview
```

`npm run build` typechecks, then writes the static site to `dist/`.

## Vercel

Import this repository. Vercel detects Vite:

- Build command: `npm run build`
- Output directory: `dist`

Client routes rewrite to `index.html`. There is no server and no environment variables.
