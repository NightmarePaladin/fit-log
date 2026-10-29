# FitLog — Android strength training tracker

React Native (Expo SDK 58) + TypeScript + Expo Router, Supabase (Postgres, Auth with Google, RLS), AsyncStorage drafts, React Native Paper UI, `react-native-gifted-charts`.

## What it does
- Google sign-in (Supabase Auth, PKCE), encrypted session persistence, auto-restore on restart, sign out.
- **Dashboard**: welcome, Start/Resume workout, last workout, this-week workouts and total lb, recent PRs, weekly strength summary.
- **Active workout**: add library or custom exercises, weight × reps per set, add/remove sets, check off sets, a **Last Workout** column per set with one-tap copy into today, copy the whole last workout, autosaved draft restored after restart.
- **Reps-only (bodyweight) exercises**: Push-Up, Pull-Up, Dip and Hanging Leg Raise log reps with no weight box, and you can create your own (choose *Reps only* when creating). Progress for these compares best-set reps and total reps week over week instead of weight, and never reports a weight or strength percentage (`exercises.reps_only`, migration `0008_reps_only.sql`).
- **Timed exercises and the workout timer**: create a custom exercise as *Timed* (running, planks, rowing) and log minutes : seconds instead of weight/reps. A **Timer** stopwatch button sits at the bottom of the workout page; it keeps running while minimized, and *Use this time for…* drops the result into a timed exercise. A timed set stores its duration in seconds in `workout_sets.reps` with weight 0 (`exercises.timed`, migration `0011_timed_exercises.sql`); History, Progress, sharing and the Excel exports show it as `m:ss`.
- **Creating exercises**: the picker has a visible *Create custom exercise* button (it turns into *Create “your search”* as you type) plus a type choice (Weight / Reps / Timed).
- **History**: by date, filter by exercise, open a workout, repeat / edit / delete.
- **Progress**: pick an exercise (or all), last week vs this week (Mon–Sun, local time): best weight, volume, % changes, PRs, line charts.
- Strength % is reported **only when the best sets use the same rep count**. Otherwise the app shows the weight and volume deltas and says the change is not like-for-like.

## 1. Setup
```bash
npm install            # .npmrc sets legacy-peer-deps (react-dom peer range vs Expo's pinned React)
cp .env.example .env   # then fill in the two values
```
`.env` (gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
```
The anon/publishable key is designed to be public; access control is enforced by RLS. Never put the `service_role` key in the app.

## 2. Database setup
Run the files in `supabase/migrations/` in order (Supabase SQL editor, or `supabase db push`):
1. `0001_schema.sql` — tables, FKs, indexes, profile-on-signup trigger
2. `0002_rls.sql` — Row Level Security policies on every table
3. `0003_seed_exercises.sql` — global exercise library (34 exercises)
4. `0004_save_workout.sql` — atomic `save_workout` RPC (security invoker, so RLS applies)

Optional demo data: `supabase/seed/demo_workouts.sql` creates ~4 weeks of workouts for your account (edit the email at the top, run after your first sign-in). Squat goes 225×10 → 235×10 (like-for-like +4.4%); bench goes 155×8 → 160×6 (reps differ, so no strength %).

## 3. Google sign-in (manual dashboard steps)
1. **Google Cloud Console** → APIs & Services → OAuth consent screen (External; add yourself as a test user) → Credentials → *Create OAuth client ID* → type **Web application**. Add authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Providers → Google: enable, paste the client ID and secret.
3. **Supabase** → Authentication → URL Configuration → *Redirect URLs*: add `fitlog://auth/callback` (and `exp://**` if you ever use Expo Go; not recommended).
4. The app scheme is `fitlog` (`app.json`). The redirect URI is built with `Linking.createURL('auth/callback')`.

## Sharing, buddies and exports
- **Share a workout** (workout page → *Share, export or send to a buddy*): as a **picture** (a branded Fit Lift card, shared through the system share sheet so it can go to Instagram, Messages, WhatsApp, etc.; on the web it uses the browser's share sheet or downloads a PNG), as **text**, or as a **private link** (`/s/<token>`) that anyone can open in a browser without an account. A link only ever shows that one workout and can be turned off at any time (`workout_shares`, `get_shared_workout`).
- **Buddies** (Dashboard → people icon, or Settings): create an 8-character invite code and send it; your buddy enters it under *Have a code?*. Connecting lets you each see the other's workouts, **read-only**. Either of you can stop sharing (one direction) or remove the buddy (both). Codes are single use, expire after 7 days, and a wrong/used/expired code gives the same error so codes cannot be probed. Tables `buddy_shares` and `buddy_invites`, functions `create_buddy_invite` / `accept_buddy_invite`, migration `0009_sharing.sql`.
- **Export a workout plan to Excel** (share sheet → *Export as plan (Excel)*): the workout's exercises and sets with what you did last time and blank yellow cells for next time's target weight/reps.
- **Export your history to Excel** (History → *Export history (Excel)*): a *Workouts* sheet (one row per workout) and a *Sets* sheet (one row per set). Weights use your chosen unit. The .xlsx is written by a small built-in generator (`src/lib/xlsx.ts`) using `fflate`; no spreadsheet library with known vulnerabilities is used.
- **Appearance**: Settings → Dark, Light or System.
- Important when querying: buddies can read each other's workouts, so every query for "my" data filters by `user_id` explicitly (`fetchWorkouts`, `fetchExercises`).
- New native modules (`expo-sharing`, `expo-file-system`, `expo-clipboard`, `react-native-view-shot`) need a new Android build.

## Offline use (gyms with no signal)
- **Signed-in users stay signed in offline.** The saved session is used when the connection is missing or slow (the app stops waiting after 6 seconds), so you are not sent to the login screen. Recent workouts are cached on the device, so Last Workout, History, Dashboard and Progress keep working.
- **Finishing a workout with no connection saves it on the device** ("Saved on this device") and uploads automatically when you are back online. A banner shows what is waiting, with an **Upload now** button.
- **Access while offline** (login screen): use the app with no account. Workouts, custom exercises and the lb/kg setting stay on the device. When you later sign in, the app **asks** before uploading them to that account (Upload / Not now / Delete). Nothing is uploaded without that choice.
- **No duplicates:** each workout gets its own id on the device, and the database save (`0007_idempotent_save.sql`) replaces a workout with the same id, so retries and re-uploads are safe. Another user cannot overwrite your workout by reusing its id.
- **Privacy:** offline mode shows only workouts waiting on the device, never a signed-in user's cached history. Signing out clears the cached copy of your server data but keeps un-uploaded workouts (the app warns first). A signed-in user only sees their own waiting workouts.
- The 34 built-in exercises ship with the app (`src/data/library.ts`), so the picker works on a first launch with no signal.
- Needs a connection: changing your name, deleting a workout that is on the server, and deleting your account. Offline Progress uses the 150 most recent cached workouts.
- Adds the native module `@react-native-community/netinfo`, so it needs a new Android build (not just a refresh).

## Email + password accounts
The login screen has **Sign in / Create account** tabs (email + password, name on registration) alongside Google. Passwords need 8+ characters with letters and numbers; **Forgot password?** emails a reset link, and email users can change their password on the Account page.

Supabase setting that matters — Authentication → Sign In / Providers → Email:
- **Confirm email ON** (the default): new users must click an emailed link before signing in. Supabase's built-in email sender is heavily rate-limited and may only deliver to your own team's addresses, so for anyone else set up custom SMTP (Authentication → SMTP).
- **Confirm email OFF**: sign-up signs the user in immediately. Simplest for a class demo.
- Add every URL the links return to under Authentication → URL Configuration → Redirect URLs: `fitlog://auth/callback` (Android) and `http://localhost:8081` (web), plus your deployed web URL if any.

## Units (lb / kg)
Settings → Weight unit switches between pounds and kilograms. Weights are always **stored in pounds** (`workout_sets.weight`, numeric(9,4)); the app converts for display and for what you type, so switching never alters saved data and a typed kg value round-trips exactly. The preference is saved in `profiles.unit` (migration `0006_units.sql`). An unfinished workout's typed weights are converted when you switch.

## 4a. Run on PC (web) — no Android tooling needed
```bash
npm run web          # opens http://localhost:8081
```
Add `http://localhost:8081` under Supabase → Authentication → URL Configuration → Redirect URLs (web sign-in returns to the page, not the `fitlog://` link). The same Google client works; no Google changes are needed.
Web differences: the session is kept in the browser's localStorage (not Keystore-encrypted), and confirmation prompts use the browser's `confirm()`.

## 4b. Android without Android Studio (cloud build)
```bash
npx eas-cli login                                   # free Expo account
npx eas-cli init                                    # links the project
npx eas-cli build --profile development --platform android
```
When the build finishes, open the link/QR it prints on your device and install the APK (allow "install unknown apps"). Then run `npx expo start --dev-client` on your PC and open the app on the device (same Wi-Fi).

## 4c. Run on Android (local, needs Android Studio)
Google sign-in returns through a custom-scheme deep link, so use a **development build**, not Expo Go.
```bash
# Option A: local (Android Studio + emulator or USB device with debugging on)
npx expo run:android

# Option B: cloud build, install the APK on your device
npx eas-cli build --profile development --platform android
npx expo start --dev-client
```
Checks:
```bash
npm test          # 18 unit tests (weeks, volume, PRs, comparison, drafts, history helpers)
npm run typecheck
```

### Manual test checklist (Definition of Done)
- [ ] Sign in with Google → Dashboard shows your first name
- [ ] Start workout → add 3 exercises (one custom) → enter weights/reps, check sets
- [ ] Finish & save → “Workout saved” banner
- [ ] Force-close and reopen: still signed in; History lists the workout
- [ ] Start a workout mid-way, force-close, reopen → Dashboard says *Resume workout* with your sets intact
- [ ] New workout → Last Workout column shows previous sets; tap one to copy; “Copy last workout” works
- [ ] Progress: with demo data, Barbell Squat shows +10 lb and +4.4%; Bench shows “Not comparable”
- [ ] Edit and delete a workout from its detail screen
- [ ] Sign out and back in: data is still there

## 5. Architecture
```
app/                    Expo Router screens
  _layout.tsx           providers; Stack.Protected gates routes on session
  login.tsx             Google sign-in
  (tabs)/               Dashboard · History · Progress (bottom nav)
  active.tsx            Active workout (full-screen modal)
  workout/[id].tsx      Workout detail: repeat / edit / delete
src/
  auth/AuthProvider     session state, Google OAuth via expo-web-browser + exchangeCodeForSession
  lib/supabase.ts       client; storage = LargeSecureStore
  lib/secureStorage.ts  AES-encrypts the session into AsyncStorage; key lives in Android Keystore (SecureStore)
  lib/dates.ts          Monday–Sunday local-time week math
  lib/stats.ts          pure functions: volume, best set, week comparison, PR detection, weekly series
  lib/history.ts        flatten/prev-set lookup/copy-workout helpers
  store/draft.ts        zustand + persist(AsyncStorage): the unsaved workout
  api/workouts.ts       Supabase queries and the save_workout RPC
supabase/               migrations, demo seed
__tests__/              jest (jest-expo)
```
Data flow: screens load completed workouts (nested select) → `stats.ts` computes everything client-side from those rows. Draft edits live only in the persisted zustand store until **Finish & save** sends one atomic RPC call.

Security: every table has RLS; child tables check ownership through their parent workout. `anon` has no table access. The draft stores an `ownerId` and the Dashboard ignores drafts from another account. Weights are stored in pounds (`profiles.unit` is constrained to `lb` for the MVP).

## Known limits
- No rest timer or plate calculator. Offline sync is tested with unit tests and a browser walk-through of offline mode; the signed-in sync should also be checked on a device in airplane mode.
- History/Progress load the latest 300 workouts and compute in-app.
