# Bike Logbook

A personal, offline logbook for your bikes and cars. Log fuel, trips, services, insurance, accessories and other expenses. The app works out mileage, running costs, service history and what's due next.

It's a web app you install from Safari onto your iPhone home screen. You don't need the App Store, a developer account or any paid service. Everything you log stays on your phone, in the browser's own storage. The only time it connects to anything is if you turn on Google Drive backup; then it talks only to Google, only to save or fetch your backup.

**What it does:** a logbook for every vehicle you own (bikes, scooters and cars): fuel with company, fuel type and riding conditions; services with a per-vehicle checklist and bill photos; trips, accessories and expenses; insurance policies with renewal and payment reminders; purchase price and total cost of ownership; weekly, monthly and yearly reports for each vehicle and for all of them together; Excel export; and backups to Google Drive or iCloud Drive. It installs to your home screen and works offline.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev      # opens a local dev server, usually http://localhost:5173/bike-logbook/
npm test         # unit tests for the calculations
npm run build    # production build into dist/
```

To try it on your phone before deploying, run `npm run dev -- --host` and open the "Network" address it prints in Safari on your iPhone. Your phone has to be on the same Wi-Fi. Offline caching only works on the deployed site, not in dev.

In dev mode, Settings > Developer has two buttons. Neither appears in the deployed app.

- **Load sample data** adds a year of Himalayan 450 riding: fill-ups, services, trips, accessories, expenses and reminders.
- **Load stress test** adds about 4,000 records over four years, to check the app stays quick. On a Mac, every screen draws in under 150 ms with that much data. Long lists show 100 rows at a time.

## Put it on your iPhone (free, with GitHub Pages)

1. **Create a public GitHub repo** (for example `bike-logbook`) and push this project to `main`. GitHub Pages is free for public repos. The repo only contains code, never your data. Your data lives only on your phone.
   ```bash
   git remote add origin https://github.com/<username>/bike-logbook.git
   git push -u origin main
   ```
2. In the repo on GitHub, go to **Settings > Pages**, and under **Build and deployment > Source**, choose **GitHub Actions**.
3. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to finish (about a minute). Then open `https://<username>.github.io/<repo-name>/` in **Safari** on your iPhone.
4. Tap **Share**, then **Add to Home Screen**, then **Add**. Open the app from the new home-screen icon.
5. Open it once while online so everything gets cached. Then turn on airplane mode and open it again to check that it works offline.
6. **Updating:** push changes to `main` and wait for the Actions run to finish. Then close and reopen the app. It picks up the new version by itself. If it doesn't, close it, wait a moment, and open it again.
7. **Backup and restore.** Your logbook lives only on your phone, in Safari's storage for this site. iOS can remove it in rare cases, for example if you delete the home-screen app or clear Safari's website data. So back up once a month. The app shows a banner when it's been more than 30 days.
   - **Back up:** Settings > Backup > **Back up now**. It makes one `.json` file with everything, photos included, and opens the share sheet. Save it somewhere other than the phone: iCloud Drive, Google Drive, or a WhatsApp chat with yourself.
   - **Restore:** Settings > Backup > **Restore from a backup**, then pick the file. You'll see what's in it, then choose:
     - **Merge** adds the backup's records to what's already here and skips any that match, so merging the same file twice changes nothing.
     - **Replace** wipes this phone's data and loads the backup exactly.
   - **Moving to a new phone:** back up on the old one, install the app on the new one (steps 3–4), then restore with Replace.

### The repo name and the base path

GitHub Pages serves the app from `/<repo-name>/`. The deploy workflow (`.github/workflows/deploy.yml`) reads the repo name and sets `BASE_PATH` for you, so any repo name works.

For local builds, the fallback is `/bike-logbook/`, set at the top of `vite.config.ts`. Change it there if your repo has a different name. If you deploy to a user site repo (`<username>.github.io`), set `BASE_PATH` to `/` in the workflow.

## Vehicles

Settings > Vehicles adds a bike, scooter or car. For each one you set the type, what it runs on (petrol, diesel or CNG), the tank size, an optional vehicle number, and the price you paid. Switch vehicles by tapping the name at the top of the Dashboard. Each vehicle has its own fuel, services, trips, expenses, insurance and reminders, and its own service checklist (cars get AC service, wheel alignment and so on). Reports show each vehicle on its own, then all of them together at the bottom.

## Fuel, insurance and reminders

- **Fuel:** pick the company (IndianOil, BPCL, HPCL, Nayara, Jio-bp, Shell), the fuel (for example Petrol E20, XP95, Speed 97, Power 99, V-Power, diesel grades or CNG) and how you rode since the last fill (city, highway, hills, off-road…). Reports compare your mileage for each riding condition.
- **Insurance:** Dashboard > Ownership > Insurance. Add the policy with its premium (paid once, yearly or monthly), dates, IDV, NCB and add-ons. Premiums count in your costs, and the app reminds you before renewal and before each payment (2 days ahead by default).
- **Reminders:** service reminders show their window (for example 25,907–26,907 km) and, from how far you've been riding lately, roughly when you'll reach it.
- **Phone alerts:** a web app can't send notifications while it's closed, so for real alerts use Settings > Reminders > **Add to Calendar**. Calendar then alerts you ahead of time (each reminder's lead time) and on the day.

## Google Drive backup (optional, about 5 minutes)

With this set up, a backup goes to a "Bike Logbook Backups" folder in your Drive each time one is due (weekly or monthly, your choice). The app asks when you open it, and one tap uploads. It can only see files it created, never the rest of your Drive.

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a project (any name, for example "Bike Logbook").
2. Go to **APIs & Services > Library**, find **Google Drive API**, and click **Enable**.
3. Set up the consent screen (now called **Google Auth Platform**): choose **External**, enter an app name and your email, and under **Audience** add your own Google account as a test user.
4. Under **Clients** (or **Credentials > Create credentials > OAuth client ID**), choose **Web application**. Under **Authorized JavaScript origins**, add `https://<username>.github.io` (and `http://localhost:5173` if you also want it working in dev).
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
6. In the app, go to **Settings > Backup > Set up automatic Google Drive backup**, paste it, then tap **Save** and **Back up to Google Drive**. Sign in and allow access the first time.

On a new phone: install the app, paste the same Client ID, then **Restore from Google Drive** and choose **Replace**.

Without Google Drive, **Save to Files / iCloud Drive** opens the share sheet. Choose **Save to Files > iCloud Drive**, and the backup syncs to your other Apple devices.

## Excel export

Reports > **Export to Excel** builds a workbook for the month or year you're looking at, or for all data. Settings has **Export everything to Excel** too. The file (for example `BikeLogbook_Himalayan450_2026-10.xlsx`) opens through the share sheet.

It has these sheets: Summary, Fuel, Trips, Service, Service Items (one row per ticked item), Accessories and Expenses. Each has a header row that stays put when you scroll, real dates, currency formatting and totals.

## How the numbers are worked out

**Mileage (full-tank method).** Fill to full, ride, and fill to full again. Mileage is the distance between the two full fills divided by all the fuel added after the first one, partial top-ups included. A partial fill never shows its own mileage. It counts towards the next full fill. The first full fill you log has no mileage.

**Cost per km** is the fuel spend over the same stretch divided by its distance. Averages (overall and last 5) are weighted by fuel, so a long stretch counts for more than a short one.

All calculations live in `src/lib/calc/` and are covered by tests in `tests/`.

## Project layout

```
public/            icons, 404.html
scripts/           icon generator (npm run icons; also runs before dev and build)
src/db/            Dexie (IndexedDB) schema, seed data, sample data
src/lib/calc/      mileage, cost and odometer calculations
src/components/    shared UI
src/pages/         screens
tests/             Vitest unit tests
```
