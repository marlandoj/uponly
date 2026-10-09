# ChoreQuest — Real-life chores, EPIC in-game loot.

> **Hackyard Yard #4 entry** · Solo build · Gamification theme · Ship: Fri Oct 9, 2026

<video src="docs/demo.mp4" controls width="960"></video>

*Watch the demo above — or try it live at https://uponly-marlandoj.vercel.app*

ChoreQuest turns household chores into game loot. The parent is the **GameMaster**: they create a squad, set chores, and pick rewards from a live loot catalog — real Fortnite shop items, Robux packs, Minecoins — matched to the kid's games. The kid (**Gamer**) picks up quests, does the real work, submits photo proof. The GameMaster reviews and approves, and the loot drops instantly.

**Big chore, big loot. No nagging. No negotiations.**

## How it works

1. **Squad** — GameMaster creates a squad, shares the join code or QR. The gamer joins from their phone — no login, guest access just works. One GameMaster per squad, enforced in the database.
2. **Profile** — Gamer sets their gamer tag and picks their games (Fortnite, Roblox, Minecraft). The app researches the live Fortnite shop and builds a loot catalog around it.
3. **The deal** — GameMaster creates a reward: picks a chore, a size tier (quick / standard / big), and loot from the catalog. Reward cards show the actual item art, not generic icons.
4. **The quest** — Gamer starts the quest (4-minute minimum, server-enforced), does the chore, submits before/after photos — camera-only capture, EXIF stripped.
5. **Verification** — GameMaster reviews the photos in the review queue. Approve → **QUEST COMPLETE** celebration, loot drops to the gamer's collection. Reject → structured feedback, gamer resubmits.
6. **Fulfillment** — Earned loot lands in the GameMaster's fulfillment queue. (Gift-card fulfillment is next — auto-purchasing in-game items is impossible; no Epic or Roblox API.)

## The details that matter

- **Instant earning ledger** — rewards credit the moment the GameMaster approves; fulfillment is a separate step.
- **Anti-abuse** — camera-only capture, hashed evidence, GameMaster owns the final call. Gamers can't approve quests, create rewards, or fulfill.
- **AI visual verification** — OpenAI vision gives an advisory pass/unclear/fail on photo pairs; never blocks, GameMaster decides.
- **Game juice** — 8 pixel-art mascots wander the background, synthesized chiptune + SFX (Web Audio, zero assets), QUEST START / QUEST COMPLETE celebrations.
- **PWA** — installable, loot-chest icon set, social preview card.

## Stack

Next.js (App Router) · Supabase (Auth / Postgres / Storage) · OpenAI vision · Tailwind · Web Audio API · Vercel

Migrations in `supabase/migrations/` — RLS on every table, explicit least-privilege GRANTs.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (server-side only)
3. Run migrations in `supabase/migrations/` in order
4. `npm run dev`

## Verify

- `npm run build` · `npx tsc --noEmit` · `npm test`
