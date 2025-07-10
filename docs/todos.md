TODO:
!: high prio for render bandwitch free plan comply
resize images or cloudinary integration.
similar for sound cloud load

implement timer per turn checks on the backend and consequences of not playing in time

poll server for match list update

allow user to only create 1 match

socks version instead polling for more fluid gameplay

bug: check lose message for the loser



---

Here’s how I’d sequence things, balancing impact vs. effort for an MVP:

---

### 1. **Real-Time Game Flow (High ROI)**

* **WebSocket GameConsumer**
  *Why:* Instant feedback makes your game feel snappier and more “alive” than polling.
  *Rough Effort:* Moderate—you already have Channels wired up for chat, so move updates are a natural next step.
* **In-match Chat Integration**
  *Why:* Players love to trash-talk or cheer each other on. You’ve built the chat consumer, just surface it in the match view.

### 2. **Polish & UX (Medium ROI)**

* **Mobile/Responsive Layout**
  *Why:* Even basic media-queries give you 80% of the benefit. Focus on breaking points and larger tap targets.
  *Rough Effort:* Low—start with CSS grid/flex tweaks and a responsive meta tag.
* **Sound & Visual SFX**
  *Why:* A little flip sound + confetti on win goes a long way to “feel” good. You’ve scaffolded sfx modules already.
* **Rematch Button**
  *Why:* Keeps the engagement loop tight—“Play again?” immediately after a game.

### 3. **Bots & AI (Medium–Low ROI)**

* **Minimax/Alpha-Beta Tier**
  *Why:* You already have the RandomBot; wrapping in deeper search is a nice “hard” mode.
  *Rough Effort:* Moderate—algorithm work but little UI.

### 4. **Server-Enforced Timer (Lower ROI)**

* **Why:** Guarantees pace, but for MVP you can get by with a front-end countdown and a soft forfeit.
* **When:** Tackle this once your real-time WS loop is solid.

### 5. **Game Replays & Analytics (Lowest ROI)**

* **Why:** Cool for power users and demos, but not essential to your first public launch.
* **When:** After core loop + social/UX polish.

---

**Your Next Steps:**

1. Swap out polling → WS for moves
2. Embed the existing chat into the battle page
3. Tackle responsive CSS (media-queries, touch targets)
4. Hook up SFX/confetti/rematch UX

That combo will give you a *super* engaging, immediate-feel multiplayer experience—strong enough to show off on Product Hunt—before investing in heavier features like replays or strict server timers.


***


Today’s progress recap & outstanding items

    Global Chat up & styled, with join/leave notices over WebSockets.

    Polling-based game flow refactored into startMatchPolling(). Deck loads, moves place, flips animate, SFX wired, confetti blasts on game‐over.

    Bug triage in flight:

        Premature “Game over” firing

        Missing board redraw on first load

        Two-player auto-refresh inconsistencies

        Timer UI still pending

        Minor JS exports/imports and sfx module cleanups

Next-up feature ideas

    Real-time & Networking

        WebSocket GameConsumer instead of polling

        Server-driven per-move countdown + auto-forfeit

    Social & Matchmaking

        In-match chat (team vs. global)

        Public lobbies & invitation links

        Spectator mode

    UI/UX Enhancements

        Polish flip animations & particle effects

        Mobile-friendly/touch gestures

        Accessibility (keyboard nav, ARIA, color-blind support)

    Gameplay & Content

        Rematch/draw proposals

        Alternate rule-sets (blitz, power-ups)

        Achievements & badges

    Persistence & Analytics

        Elo leaderboards & stats dashboard

        Match replays

        Usage metrics (DAU, match length, popular decks)

+++

🦄 Zeny Zoo: Updated Task & Bug List (Priority Extract)
1. High-Priority:

    Bot Duplicate Plays

        Issue: RandomBot sometimes reuses the same PlayerCard twice per match.

        Action: Refactor choose_move logic to exclude already-played PlayerCard instances (not just by card type/ID).

        Verify: Commit the move immediately after selection to prevent duplicate picks.

2. Next-Action Sprint:

    Player 2 Stats

        TODO: Add accurate Win/Loss counters for Player 2 (both human and bot sessions).

3. Workflow/Infra

    Fix API vs Template URL issues (/game/api/...).

    Static files & CSRF for AJAX reliability.

    POST-based logout, proper login/register redirects.

4. UI & Game State

    Board polling: reflect all moves in near-real time (no F5).

    Dedicated “Game Over” banner with winner highlight, freeze board on end.

    Animation: ensure flips update owner highlights on every change.

5. Multiplayer Testing

    Alice vs Bob: deck select, match, moves, end.

    Spectator mode: reload and verify real-time board updates.

6. Statistics/Profiles

    Human vs Human stats.

    Bot stats separated.

    Win/Loss/Draw counters increment at match-end, not before.

Immediate Focus

    Start with: Bot duplicate–card fix
    Next: Full 2-player flow (Alice vs Bob), ensure stats update, polish UI
