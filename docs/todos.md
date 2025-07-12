🦄 Zeny Zoo: DevOps Recap & MVP Strike Plan

You’ve got 3 categories:

    Immediate MVP (top priority)

    UX Next-Ups (polish but not required for first public show)

    Post-MVP (future fire)

🚀 Immediate MVP—Ship These, Show Off

    WebSocket game flow: No more polling. All moves/board/chat in real-time, both players and spectators.

    In-match Chat: Works, styled, Spectator mode respected, global + match.

    Game Over Logic: Show banners (“You win!”, “You lose!”, “Draw”, “Winner: [X]” for spectators).

    Bot Fixes: No dupe moves/cards, bot always responds single turn, never double.

    Scoreboard: Named scores, always correct, always visible. No drift.

    Auto-Forfeit: If >60s, game ends, forfeit message shown.

    Single Match Creation: User can only open one active match at a time.

    Match Join Alert: WS update, auto-redirect when player joins your match.

    Spectator Clean UI: No deck for spectator, show who’s in.

    Spinner: Deck & board show “Waiting for server…” translucent overlay on move.

    Favicon/static loads both locally & prod.

    Lose message: Only shows to actual player, not spectators.

    Basic mobile/responsive layout (media queries, big buttons).

✨ UX Upgrades (Day 2/3 after MVP)

    Rematch Button: After game over, “Play Again” spawns new match, invites last opponent.

    Online Players Counter: Count in lobby (Redis, simple API or WS).

    Friend List: Only wireframe, core add/remove/block/leaderboard logic, not polish.

    Game History: “Last games” on profile (opponents, win/loss).

    Accessibility polish: Colors, focus, contrast.

    Bot Chat: (DeepSeek/LLM): Have RamBot trash-talk after moves.

    Lobbies/invites: Public/private match invites, links.

🧞‍♂️ Post-MVP (Queue These)

    Leagues/Shop (barebones only, no real commerce)

    Replay/Analytics for match review

    Switch frontend to Svelte or similar

    Consider Rust rewrite only after user feedback

What’s Next / Tomorrow’s TODO (Fastest Value)

    Bot dupe/2x move bug (core fun killer—fix first)

    Finish spinner UX: Only show when move is processing, remove on response. Keep it tight, not fullscreen.

    Game over banner: Spectator, P1, P2—correct, no mixup.

    WS join alert: If match is yours, WS triggers redirect to game.

    Only show “join” if not already in game.

    One match per user, lockout on extra create.

    Responsive CSS pass (header, buttons, board)

    Confirm “waiting for server” overlay works in both player and bot flow.

What You Can Defer

    League system, shop, invite links, deep profile stuff

    Anything requiring deep stateful analytics

    Bot chat (LLM API) for day 2/3

Commit Message Suggestion

MVP core features: real-time WS game/chat, bot move/dupe fix, game over banners, single active match per user, mobile-ready UI, improved join/alert flow, spinner overlay, proper spectator handling. Next: squash bot double-move, rematch btn, polish, prep for Product Hunt.


