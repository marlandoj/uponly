# Two-phone E2E checklist

Run through with two phones (A = quest doer, B = circle-mate), both on the
deployed URL. Mark each step pass/fail.

## Setup
- [ ] A creates a circle, notes the 6-char join code
- [ ] B joins via the code; both see each other on the roster

## Quest flow (A)
- [ ] A starts a quest, takes before photo (camera-only)
- [ ] Completing before 4 minutes is rejected ("quests take at least 4 minutes")
- [ ] A takes after photo, completes — +10 XP, boss HP drops, streak = 1

## Celebration flow (A -> B)
- [ ] A taps "Share for celebration" — QR image, link, and 6-char code appear
- [ ] B scans the QR (or opens the link / types the code at /r)
- [ ] B sees A's before/after photos and the Done / Great / Legendary buttons
- [ ] B rates 5 — A's level ticks up, "First Fold badge unlocked! (simulated)" shows
- [ ] A cannot rate their own quest (no self-rating)
- [ ] A second rating from B on the same quest is rejected (one per quest)
- [ ] A third circle-mate's rating is recorded but not counted (max 2)

## Anti-abuse (B, fresh account)
- [ ] B (joined < 24h ago) cannot rate — "24 hours after you joined" message
- [ ] B's 6th rating in a day is rejected (rater daily cap)

## Leaderboard
- [ ] /leaderboard shows both members, ordered by level, then streak, then quests
- [ ] Medals, streak flames, and boss-defeated counts render

## Privacy
- [ ] A deletes evidence photos — photos disappear, ratings stay
- [ ] Signed photo URLs expire after 5 minutes (open one, wait, refresh)

## Sign-off
- [ ] No console errors on either phone
- [ ] All steps above pass
