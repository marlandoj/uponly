# UpOnly — Positive-Only Chore Game (Hackyard Yard #4)

Positive-only chore game: pick a quest with a finish condition, snap a before photo, do the chore, snap an after photo, and an AI-assisted progress check returns pass / unclear / fail (never blocks completion). A second circle member rates the completion via QR / link / 6-char code (3 = Done, 4 = Great, 5 = Legendary).

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
3. Run the Supabase migrations in `supabase/migrations/` in order (`0001_init.sql`, `0002_quests.sql`, `0003_progress_check.sql`) (RLS on every table; explicit least-privilege GRANTs — new tables created after 2026-10-30 are not auto-exposed to the Data API).
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

## Verify

- `npm run build`
- `npx tsc --noEmit`
- `npm test` (join-code, quest catalog / timer, JPEG metadata-stripping, and rating-math (`lib/rating.ts`: level, XP, caps), and progress-check (`lib/progressCheck.ts`: verdicts, timeout, no-key and error degradation) unit tests)

## Limitations

- Mobile-first PWA; desktop is not the target.
- Simulated First Fold mint (when labelled) is a placeholder, not an on-chain mint.

## License

MIT — see [LICENSE](LICENSE).
