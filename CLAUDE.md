# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ogen Sign — a digital PDF-signing web app that runs entirely in the browser (no app server). Document owners upload a PDF (or Word file), place fields, and share a signing link; signers fill and sign from that link. The UI is Hebrew-first (RTL) with an English toggle.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build into dist/
npm run preview  # serve the built dist/
```

There is no test suite and no linter configured. For end-to-end manual testing without network/Supabase, open the app with `?mock=1` — this swaps in the localStorage mock backend (see below).

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to the `gh-pages` branch on every push to the default branch (note: the default branch is `claude/laughing-babbage-n8phwv`, not `main`). Live site: https://ogennursing-ux.github.io/-/. `vite.config.js` uses `base: './'` so the build works from a sub-path — keep asset references relative.

## Architecture

### Entry routing (`src/App.jsx`)

There is no router; the view is chosen from URL query params:

- `?req=<id>` → `SignerView` — signer fills a one-off signing request
- `?form=<id>` → `FormSignerView` — permanent template link; each visitor signs a fresh copy
- otherwise → owner area: `Login` (simple client-side gate, credentials hard-coded in `Login.jsx`, flag in localStorage) then `PrepareApp`, which drives screens `home | name | editor | created`

### Backend selection (`src/lib/api.js`)

`api` is either `supabaseApi` (real backend) or `mockApi` (localStorage, same interface), chosen at load time: mock when `?mock=1` is in the URL or Supabase isn't configured. When touching backend behavior, keep both implementations in sync.

- `supabaseApi.js`: Supabase Postgres tables `sign_requests` and `templates` + Storage bucket `documents` (paths `originals/…` and `signed/…`). Access uses the public anon key in `config.js` (intentionally committed; protected by RLS — never put a service_role key there).
- The owner's own lists ("my documents", "my templates", settings) live only in that browser's localStorage (`my_sign_requests`, `my_templates`, `owner_settings`), not in the database.

### PDF pipeline (`src/lib/pdfUtils.js`)

- Rendering for display: pdf.js with a **locally bundled worker** (imported via Vite `?url`) — do not switch to a CDN worker; it must match the bundled pdfjs-dist version.
- Signed output: pdf-lib. **Hebrew/Unicode text cannot use pdf-lib's built-in fonts** (WinAnsi only), so text-like fields are drawn onto a canvas and embedded as transparent PNGs. Keep this approach for anything that renders user text into the PDF.
- Word uploads are converted client-side in `docx.js` (mammoth → HTML → html2canvas → jsPDF); multiple uploads are merged with pdf-lib (`exporters.js`).

### Field model (`src/lib/fields.js`)

Fields are stored with percentage-based geometry (`xPct/yPct/wPct/hPct` as fractions of the page) plus `type`, `pageIndex`, `signer` index, and `value`. `SHARED_TYPES` (signature, names, ID…) are filled once by a signer and distributed to every matching field; `TEXT_TYPES` are the ones rendered as text→PNG in the output. The signing UX in `SignFlow.jsx` is a single "fill once" form, not per-field in-place editing.

### Signers / round-signing

`signers` on a request is `{ current, list, note }` (up to 2 signers). After signer 1 submits, `api.advance` bumps `current` and the same link serves signer 2; the final signer triggers `submitSigned`. Always run stored `signers` values through `normalizeSigners` — older rows may be a bare array.

### Notifications (`src/lib/notify.js`, `src/lib/telegram.js`)

Best-effort, sent directly from the browser (including the *signer's* browser): a Make.com webhook (email) and/or a Telegram bot. Both targets are packed into the single `webhook_url` DB column — a plain URL string (legacy) or JSON `{ v, webhook, telegram: { token, chatId } }`; use `packNotifyTarget`/`unpackNotifyTarget`. Notification failures must never block the signing flow (`notify` never throws).

## i18n (`src/lib/i18n.js`)

The Hebrew string **is** the translation key. `t('עברית...')` returns it as-is in Hebrew and looks it up in the `EN` map for English (falling back to Hebrew). When adding any user-facing string: write it in Hebrew, wrap it in `t(...)`, and add an English entry to `EN`. Placeholders use `{name}` syntax. The document direction flips to LTR only in English — keep CSS working in RTL (the default).

## Conventions

- Plain JavaScript (JSX), no TypeScript. Heavy libraries (pdf-lib, mammoth, html2canvas, jspdf, pdfjs-dist) are loaded via dynamic `import()` to keep the initial bundle small — follow that pattern.
- User-facing error messages are Hebrew strings (often thrown directly from the lib layer); commit messages in this repo have historically been written in Hebrew as well.
- Mobile matters: the app is used on phones; watch for horizontal overflow (several past fixes were mobile-overflow bugs).
