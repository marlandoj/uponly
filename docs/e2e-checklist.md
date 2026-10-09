# Two-phone E2E checklist — ChoreQuest

Run through with two phones (A = GameMaster, B = Gamer), both on the
deployed URL https://uponly-marlandoj.vercel.app. Mark each step pass/fail.

## Setup (guest access — no login on either phone)
- [ ] A opens the site, is auto-signed in as guest, picks I'M A GAMEMASTER, creates a squad, notes the 6-char join code
- [ ] B opens the site, picks I'M A GAMER, joins via the code
- [ ] Both see each other on the home roster with gamer tags (not "Player")

## Profiles
- [ ] A sets a gamer tag on /profile, sees "Saved ✓"
- [ ] B sets a gamer tag + games on /profile

## Quest flow (B = Gamer)
- [ ] B starts a quest from /quest (Quick + any chore), picks "I approve each finish"
- [ ] Home shows B's active quest card with a resume link
- [ ] B takes before photo (camera-only); timer starts
- [ ] Completing before 4 minutes is rejected
- [ ] B takes after photo, completes — quest goes to "waiting on the GameMaster"

## Approval flow (A = GameMaster)
- [ ] A's home shows the review queue with B's quest + before/after photos
- [ ] A approves — B's loot drops, +10 XP
- [ ] (Optional) A rejects another quest with a reason — B sees the reason, quest returns to active

## Rewards (A = GameMaster)
- [ ] A creates a reward at /rewards/new (game loot + custom)
- [ ] B sees the reward on /rewards but the "Add a reward" link is hidden
- [ ] B opening /rewards/new directly is blocked ("GameMasters only")
- [ ] A marks an earned reward fulfilled in /rewards/queue

## Celebration flow (B -> A)
- [ ] B taps "Share for celebration" — QR image, link, and 6-char code appear
- [ ] A scans the QR (or opens the link / types the code at /r)
- [ ] A sees B's before/after photos and the Done / Great / Legendary buttons
- [ ] A rates 5 — B's level ticks up, "First Fold badge unlocked! (simulated)" shows
- [ ] B cannot rate their own quest (no self-rating)
- [ ] A second rating from A on the same quest is rejected (one per quest)

## Leaderboard
- [ ] /leaderboard shows both members with gamer tags, ordered by level, then streak, then quests

## Privacy
- [ ] B deletes evidence photos — photos disappear, ratings stay
- [ ] Signed photo URLs expire after 5 minutes (open one, wait, refresh)

## Sign-off
- [ ] No console errors on either phone
- [ ] All steps above pass
