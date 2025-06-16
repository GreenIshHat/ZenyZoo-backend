✅ Added to the bug list:

* **Bot duplicate plays:** RandomBot sometimes plays the same `PlayerCard` twice in a match, rather than excluding already-used cards.

We’ll need to dig into the `RandomBot.choose_move` logic (and the data passed into it) to ensure we’re excluding previously played **PlayerCard** IDs, not just **Card** IDs, and that the move is committed before the next selection.

---

### Updated Bug & Task List

1. **URL & Routing**

   * Fix template vs API URL mix-ups (e.g. `/game/api/...` endpoints shouldn’t render DRF’s browsable pages).

2. **Static & CSRF**

   * Ensure all AJAX calls include `X-CSRFToken` and `credentials: "same-origin"`.
   * Confirm `STATIC_ROOT`/`STATICFILES_DIRS` configuration to serve `style.css` and `script.js`.

3. **Authentication Flows**

   * Logout via POST (405 on GET).
   * Redirects after login/register need to honor `LOGIN_REDIRECT_URL` / `LOGOUT_REDIRECT_URL`.

4. **Bot Integration**

   * **Duplicate plays bug**: Bot is picking the same card twice.
   * Ensure `bot_player.bot_strategy` is always set and `is_bot=True` before triggering.
   * Verify immediate bot response after human move.

5. **Front-End UI**

   * Board polling must reflect both human and bot moves without needing F5.
   * “Game Over” state should freeze board and display winner in a dedicated banner.
   * Ensure flip animations update owner highlighting on each flip.

6. **Two-Player Testing**

   * Full session: Alice vs Bob, deck select, match creation/join, in-game move sequence, end-game.
   * Spectator mode: reload mid-match and confirm polling shows accurate board state.

7. **Statistics & Profile**

   * Head-to-head vs humans only.
   * Separate “vs Bots” tally.
   * Win/Loss/Draw counts must increment reliably on match end.

---

Let’s tackle the **bot duplicate–card** issue first in our testing session, then proceed with the full 2-player flow. Sound good?
