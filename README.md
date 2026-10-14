# PT Log

Persoonlijk coachingplatform (trainer + klanten), PWA. Vite + vanilla JS, Supabase (Auth, Postgres+RLS, Realtime, Edge Functions), Mollie.

- `src/core.js` – trainer-app (klanten, schema's, offline loggen, grafieken, periodisering, strippen)
- `src/sync.js` – offline-first sync (localStorage + wachtrij, last-write-wins) en rollen
- `src/views.js` – oefeningenbibliotheek, programma's, producten/betalingen, chat, klant-app
- `supabase/migrations` – SQL (tabellen `ptl_*`, RLS)
- `supabase/functions` – `pay-create` en `pay-webhook` (Mollie). Secrets: `MOLLIE_API_KEY` (test_…), `APP_URL`.
- `tests/e2e.py` – Playwright end-to-end tests

Deploy: push naar `main` → GitHub Action bouwt en publiceert naar GitHub Pages.
