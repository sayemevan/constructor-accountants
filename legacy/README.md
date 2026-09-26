# BuildLedger — Construction Account Keeper

A modern construction accounting app (projects, workers, wages, transactions, materials, accounts) where **all data lives in the contractor's own Google Drive & Google Sheets** — there is no backend server and no centralized database.

Built with Next.js (App Router), React, TypeScript, Tailwind CSS, and the Google Drive + Sheets REST APIs via browser-side OAuth.

## How the Google integration works

- **Auth**: Google Identity Services (GIS) browser token flow. The app only needs a public **OAuth Client ID** — there is **no client secret** (that's only for server-side flows, which this app doesn't use).
- **Scope**: `drive.file` + `spreadsheets` + `userinfo`. The narrow `drive.file` scope means the app can only ever see files **it created**, never the rest of your Drive.
- **Storage**: On first login the app provisions a `Construction Keeper` folder and a master spreadsheet **"Construction Keeper — Ledger"** with one tab per entity (`Projects`, `Workers`, `WorkerPayments`, `Transactions`, `Materials`, `Accounts`) plus a hidden `Settings` tab. Every read/write goes straight to that sheet.

Key source files:

- `src/lib/google/gis-client.ts` — loads GIS and requests access tokens
- `src/services/google-auth.service.ts` — sign-in/out, token + profile management
- `src/services/google-drive.service.ts` — find/create the workspace folder + spreadsheet
- `src/services/google-sheets.service.ts` — create tabs, read/append/update rows
- `src/lib/google/schema.ts` — sheet tabs, headers, and row (de)serializers
- `src/providers/google-auth-provider.tsx` — OAuth + workspace lifecycle
- `src/providers/data-provider.tsx` — loads and mutates all business data via Sheets

## Connecting Google (required to run)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. **APIs & Services → Library**: enable **Google Drive API** and **Google Sheets API**.
3. **APIs & Services → OAuth consent screen**: configure it (User type *External* is fine for testing) and add your own Google account under **Test users**.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - (Add your production origin later when you deploy.)
5. Copy the generated **Client ID**.

Then create a `.env.local` file in the project root (see `.env.local.example`):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Connect Google Account**, approve the consent screen, then **Create Workspace Now** on first run. Your data is then read from and written to the spreadsheet in your Drive.

> If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is missing, the app shows a "Google integration not configured" screen instead of crashing.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — run ESLint

## Notes

- No secrets are committed; `.env*` is gitignored.
- Because the app uses `drive.file`, revoking access or deleting the spreadsheet fully removes the app's data footprint.
