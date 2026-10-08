# ChoreQuest — Real chores. Epic loot. (Hackyard Yard #4)

ChoreQuest (repo: `uponly`) is a positive-only chore game: pick a quest with a finish condition, snap a before photo, do the chore, snap an after photo, and an AI-assisted progress check returns pass / unclear / fail (never blocks completion). A second circle member rates the completion via QR / link / 6-char code (3 = Done, 4 = Great, 5 = Legendary).

- **Chore level** = 3.50 + 1.50 × (1 − e^−S), S = Σ (rating − 3) × 0.06 × verification (0.8 unclear/photo-only, 1.0 AI-pass), max 2 counted ratings per completion. Ratings never subtract.
- **Solo completion** instantly awards +10 XP (max 3 credited per day), defeating the Boss HP progress bar.
- **Circle-only leaderboard** (level, streak, quests completed). Photos are owner-only until shared, membership-gated, served via 5-minute signed URLs with EXIF stripped.
- **Soulbound rewards** on Base Sepolia testnet (First Fold mint; simulated fallback labelled).

**Stack:** Next.js mobile-first PWA (manifest only, no service worker) · Supabase Auth / Postgres / Storage · OpenAI vision · viem (Base Sepolia) · camera-only capture.

**Yard #4 build window:** Mon Oct 5 – Fri Oct 9, 2026 (all code written during build week per Hackyard rules). Solo builder, gamification theme.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (server-side only)
   - `BASE_SEPOLIA_APP_SIGNER` / `BASE_SEPOLIA_RPC_URL` (server-side only)
3. Run the Supabase migrations in `supabase/migrations/` in order (`0001_init.sql`, `0002_quests.sql`, `0003_progress_check.sql`, `0004_celebrations.sql`, `0005_streaks.sql`, `0006_mints.sql`, `0007_rewards.sql`, `0008_game_rewards.sql`, `0009_visual_verification.sql`, `0010_review_queue.sql`, `0011_loot_catalog.sql`) (RLS on every table; explicit least-privilege GRANTs — new tables created after 2026-10-30 are not auto-exposed to the Data API).
4. In Supabase Auth → URL Configuration, add `http://localhost:3000/auth/callback` (and your deployed origin's `/auth/callback`) to Redirect URLs. Sign-in is email magic link only (no OAuth).
5. `npm run dev`

### Data API grants (Supabase 2026-10-30 change)

**Tables created after 2026-10-30 need explicit GRANTs; see migration 0001.** Every table gets RLS on *and* a least-privilege grant (`authenticated`: only what its policies allow; `anon`: nothing; `service_role`: explicit). Never fix a `42501` with `GRANT ALL`.

## Quest flow

1. **Pick** a quest and one finish condition from the catalog (`lib/quests.ts`) at `/quest`. One open quest per player.
2. **Before photo** — camera only (`getUserMedia` live preview → canvas → JPEG; no file picker, so no gallery uploads). The timer starts server-side when the before photo is recorded.
3. **Timer** — the after photo unlocks after a **4-minute minimum**, enforced in three places: the UI, the route handler, and the `complete_quest` RPC (plus a `quest_runs_min_duration` check constraint).
4. **After photo** — uploaded through `POST /api/quests/[id]/photo`, which re-strips JPEG metadata (EXIF/GPS/XMP/comments) server-side, stores it at `evidence/<uid>/<run>/{before,after}.jpg`, then advances the run via a SECURITY DEFINER RPC that checks ownership, state and that the object exists.

## AI-assisted progress check

After `complete_quest` succeeds, the photo route runs one server-side vision call (`lib/progressCheck.ts`, OpenAI chat completions with a strict `pass | unclear | fail` JSON schema) comparing the before and after photos against the finish condition. **It never blocks completion** — the quest is already completed before the check starts.

- **Deadline:** loading the before photo + the vision call share a single 10-second budget; on timeout the result is `photo-only`.
- **Outcomes:** `pass` → full rating weight (1.0). `unclear` → **photo-only path** (the circle-mate rates from the photos; 0.8). `fail` → still completed, 0.8, shown with positive wording. Any error, refusal, malformed answer or missing key → `photo-only` (0.8).
- **Keys:** `OPENAI_API_KEY` is read from the server environment only; if it's unset the check is skipped (photo-only) and nothing breaks. `OPENAI_VISION_MODEL` optionally overrides the model.
- **Recording:** the verdict is written to `quest_runs.verification` with the service-role client (`SUPABASE_SERVICE_ROLE_KEY`) so players can't set their own verdict; without that key the verdict is shown once but not saved (treated as photo-only). Photos sent to the model are the EXIF-stripped copies.

## Celebration flow

1. **Share** — on a completed quest the owner taps *Share for celebration*; `share_quest` gives the run a 6-char code (circle join-code alphabet). The quest page shows it as a **QR image** (server-rendered SVG), a **link** (`/r/<code>`, native share sheet / copy) and the **code** itself (typed in at `/r`). Signed-out scanners go through the magic link and land back on the rating page.
2. **Rate** — a circle-mate opens `/r/<code>`, sees the before/after photos and picks **3 Done / 4 Great / 5 Legendary**. `rate_quest` (SECURITY DEFINER) is the only writer and enforces: same circle, **no self-rating**, rater **joined ≥ 24h before the quest started**, one rating per rater per quest, and the `lib/rating.ts` caps (2 counted per quest, 5 counted per rater per day, uncredited completions not rateable). Over-cap ratings are kept as a thank-you but change nothing.
3. **Level tick** — a counted rating adds +2/+4/+6 XP and `(rating − 3) × 0.06 × (1.0 pass / 0.8 otherwise)` to `profiles.score`; `level` is recomputed and can only rise. Both rater and owner see the `3.50 → 3.64 ▲` tick.
4. **Boss** — `complete_quest` now credits the first 3 completions per UTC day with +10 XP. Total XP drives the Boss HP bar (`lib/boss.ts`, 50 HP per boss); crossing a boundary shows *Boss defeated*.
5. **First Fold** — the first counted celebration a player receives inserts a `badges` row (`first_fold`) and triggers the soulbound mint: server-side, app signer to a generated recipient address on Base Sepolia. Until the go/no-go the mint runs in **simulated** mode (labelled in the UI); set `MINT_BACKEND=onchain` with `MINTER_PRIVATE_KEY`, `SOULBOUND_CONTRACT_ADDRESS` and `BASE_SEPOLIA_RPC_URL` to go live.

**Photo sharing:** storage stays owner-only. `get_celebration` only returns a row to members of the quest's circle; only then does the server sign that run's two photo keys with the service-role client for **5 minutes** (`PHOTO_URL_TTL_SECONDS`). Without `SUPABASE_SERVICE_ROLE_KEY` the photos show as unavailable and rating still works.

## Verify

- `npm run build`
- `npx tsc --noEmit`
- `npm test` (join-code, quest catalog / timer, JPEG metadata-stripping, and rating-math (`lib/rating.ts`: level, XP, caps), progress-check (`lib/progressCheck.ts`: verdicts, timeout, no-key and error degradation), Boss HP (`lib/boss.ts`), celebration photo-key guard and sign-in redirect safety unit tests)

## Limitations

- Mobile-first PWA; desktop is not the target.
- Simulated First Fold mint (when labelled) is a placeholder, not an on-chain mint.

## License

MIT — see [LICENSE](LICENSE).
