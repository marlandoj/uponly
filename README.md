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
3. Run the Supabase migration in `supabase/migrations/0001_init.sql` (RLS on every table; explicit least-privilege GRANTs — new tables created after 2026-10-30 are not auto-exposed to the Data API).
4. In Supabase Auth → URL Configuration, add `http://localhost:3000/auth/callback` (and your deployed origin's `/auth/callback`) to Redirect URLs. Sign-in is email magic link only (no OAuth).
5. `npm run dev`

### Data API grants (Supabase 2026-10-30 change)

**Tables created after 2026-10-30 need explicit GRANTs; see migration 0001.** Every table gets RLS on *and* a least-privilege grant (`authenticated`: only what its policies allow; `anon`: nothing; `service_role`: explicit). Never fix a `42501` with `GRANT ALL`.

## Verify

- `npm run build`
- `npx tsc --noEmit`
- `npm test` (rating-math unit tests: monotone level, caps, no self-rating)

## Limitations

- Mobile-first PWA; desktop is not the target.
- Simulated First Fold mint (when labelled) is a placeholder, not an on-chain mint.

## License

MIT — see [LICENSE](LICENSE).
