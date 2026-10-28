# FitLog demo script (about 8 minutes)

Covers the 10 Definition-of-Done steps in order. Present from the Android phone; keep the web app (http://localhost:8081) open on the laptop as a backup.

## Before you present (do this the day before)
- [ ] Phone has the latest APK installed, and Google sign-in worked at least once.
- [ ] Supabase project **FitLog** is awake (free projects pause after about a week idle). Open the dashboard once.
- [ ] Supabase → Authentication → URL Configuration still lists `fitlog://auth/callback` and `fitlog://**`.
- [ ] Phone is on Wi-Fi with battery, screen timeout off, notifications silenced.
- [ ] Signed OUT of the app, so step 1 starts at the login screen.
- [ ] Demo data present. Progress compares **this week vs last week (Mon–Sun)**, so the squat numbers only work if you present during the week the demo data was loaded. If it is a new week, re-run `supabase/seed/demo_workouts.sql` (you must have no existing workouts, or delete them first).
- [ ] Know what is already logged **this week**: the seed only adds workouts up to the day you ran it. If Bench shows "log this lift in both weeks", that is expected: you will log it live in step 3.

## The script

| # | Step | What you do | What to say |
|---|------|-------------|-------------|
| 1 | **Sign in** | Tap *Continue with Google*, pick the account. (Mention you can also register with email.) | "Auth is Supabase with Google OAuth. The session is encrypted on the device, and every row is private to the user by Row Level Security." |
| 2 | **Start a workout** | Dashboard → *Start workout*. Point out this week's workouts, weight lifted, PRs. | "Everything on the dashboard is computed from real saved data. There is no hardcoded demo data in the screens." |
| 3 | **Add 3 exercises** | Add *Barbell Bench Press*, *Barbell Squat*, and one **custom** exercise (e.g. "Cable Fly"). | "Library of 34 exercises plus custom ones that only this user can see." |
| 4 | **Log sets** | Squat: tap the **Last workout** chip to copy it, tick the sets. Bench: type **160 × 6**, tick. Show *Add set* (copies the previous set), and that sets can be removed. | "The Last Workout column is the speed feature: one tap copies last time's weight and reps." |
| 5 | **Finish & save** | *Finish & save*. Point at the green **Workout saved** banner. | "Saving is one atomic database call, so a workout can never be half-saved." |
| 6 | **Close and reopen** | Force-close the app, reopen. Still signed in. | "The session is restored from encrypted storage." |
| 6b | **Draft restore** (bonus) | Start a new workout, add a set, force-close, reopen: Dashboard says **Resume workout**. | "Unfinished workouts are kept on the device and restored." |
| 7 | **History** | History tab: the new workout is there. Filter by exercise. Open it: Repeat / Edit / Delete are available. | "Past workouts by date, filter by exercise, and you can repeat or edit them." |
| 8 | **Copy previous** | *Start workout* → *Copy last workout*. | "Starts a new workout pre-filled from the last one." |
| 9 | **Compare weeks** | Progress tab. **Barbell Squat**: last week 225×10 → this week 235×10 = +10 lb, **+4.4%**. **Bench**: 155×8 → 160×6 shows **Not comparable**. Show the line chart and PRs. | "Volume is weight × reps over completed sets. I only report a strength percentage when reps are the same. A heavier weight at fewer reps is not the same thing, so the app says so instead of faking a number." |
| 10 | **Sign out and in** | Settings (gear) → *Sign out*, then sign in again. History is still there. | "Data lives in Postgres, not on the phone." |

**Bonus: offline (great for the "gyms have bad signal" story).** Turn on airplane mode, finish a workout, and show the blue **Saved on this phone** banner and the **Not uploaded** tag in History. Turn airplane mode off: it uploads by itself and the tag disappears. For the no-account version: sign out, tap **Access while offline**, log a workout, then sign in and show the **Upload your offline workouts?** prompt.

Optional extras if time allows: Settings → switch to **kg** (all screens convert; saved data is unchanged); Account page → edit your name.

## If something goes wrong
- **Google sign-in fails or lands on a localhost page:** use the email/password login (create an account in the app). Then check Supabase Redirect URLs afterwards.
- **No data / Supabase asleep:** open the Supabase dashboard to wake it, wait a minute, retry.
- **Phone problem:** switch to the web app at http://localhost:8081 (`npm run web`). Same features.
- **Bench shows nothing to compare:** log Bench 160 × 6 live (step 4) and refresh Progress.

## Likely questions
- **How is data kept private?** Row Level Security on every table; child tables check ownership through the parent workout. Tested with two users: neither could read or change the other's data.
- **Why store weights in pounds when kg exists?** One canonical unit. The app converts for display and input, so switching units never corrupts history.
- **What about offline?** Signed-in users keep working with no signal: workouts save on the phone and upload automatically later. There is also an **Access while offline** mode with no account, and the app asks before uploading those workouts when you sign in. Each workout has a phone-generated id, so a retry can never duplicate it.
- **What's not built?** Rest timer, plate calculator, social features, and a Google Play release (the APK is installed directly).

## Honest limits to be upfront about
- Android was tested on a real phone only for the flows in this checklist; iOS was not built.
- The Google client is in Google's "Testing" mode, so only listed test users can sign in with Google. Email sign-up works for anyone.
