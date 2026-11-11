# Ongoing Geek games

GAME-004 candidate. New lounge rooms default to Play at your pace: 30 days from creation; Quick room remains 24 hours. Neither moves nor requests extend the deadline. API callers omitting pace retain the 24-hour default; existing rooms keep their original expiry. Creation time includes waiting for an opponent. There is no per-move timer or automatic disconnection loss; the existing 600-ply practice cap remains.

Each player has up to 10 new waiting-host or accepted-playing rooms. Lua checks capacity, writes the room and updates both players’ expiry-scored indexes atomically. A full guest cannot be accepted; a full host cannot create another. Finish removes index entries, and expiry pruning releases slots. Requests alone do not reserve a seat. The existing rate limits still apply (12 host creates/hour, IP and request limits unchanged). Legacy rooms become indexed when next updated, not through scanning all historical private rooms. Older invitation links still work until their original expiry.

My Games is session-authenticated, bounded to ten and contains only room metadata, opponent name, expiry and turn indicator. It never returns boards, hidden fleets, session/player IDs or unrelated private room codes. Same Geek player is required to reconnect; guests who lose their session should not expect recovery. Public lobby discovery remains separate.

Turn indicators use authoritative turn state, including forced checkers captures, Dots bonus turns and pending fleet deployment. Alerts require an explicit button and browser permission. A service worker scoped only to /games/online/ displays notifications and routes their clicks to the exact room; it has no fetch/cache or push handlers. Page polling remains visible-only and four-second bounded. A new turn notifies once per ply; repeated polls and draw-offer revisions do not repeat it. No initial notification flood on reconnect. Notification text can show the opponent’s display name on the phone lock screen according to browser/OS settings.

Important limit: this release does NOT send notifications after the lounge is closed, suspended or backgrounded. The interface says this explicitly. True closed-app push requires subscription storage, a configured push sender and reliable move-event delivery, still future implementation. No notification subscription, VAPID keys or scheduled push service is created here. No monetary, reward, XP or A.C.E. changes.

Validation: 19 focused engine/API/client checks pass with real Redis, including eleven concurrent room creates (exactly ten succeed), per-player privacy, slot release and chess turn transitions; client checks permission and per-ply deduplication. Site source checks pass. Browser/phone acceptance is separate and open. No production merge claimed.

Full-suite checkpoint: 835/835 pass, zero failures/skips, with real Redis. Alerts can be toggled off without changing the browser’s saved permission.
