TODO:
implement timer per turn checks on the backend and consequences of not playing in time

poll server for match list update

allow user to only create 1 match

bug: check lose message for the loser

---

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
