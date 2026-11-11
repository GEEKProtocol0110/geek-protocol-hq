# Kaspa code-rain background

UX-026, founder request (Nov 11, 2026) to go beyond the UX-024 edge accents with a full-page "static matrix-like code" effect. This supersedes UX-024's "no infinite matrix rain" boundary for page backgrounds only; UX-024 edge feedback is unchanged.

**What it is.** `public/assets/kaspa-matrix.js` adds one fixed, full-viewport `<canvas>` layer (`pointer-events:none`, `aria-hidden`), plus a thin glitch-slice layer that is transparent except during a burst. Glyphs fall in Kaspa teal/green: a Kaspa-style K (Ҝ, K, ₭), digits, hex, BlockDAG-ish marks (◇ ◆ ⬡ ◈ ⋔ ⟁ △ ⇉ ⊶ ⋮ ∷), and about one column in six spells KAS, GEEK, DAG, ₭AS, BPS or GHOST. Static scanlines (CSS, not animated) and a few dim static specks per frame add texture. A brief 240ms RGB-split/slice burst runs at most once every 9 to 22 seconds and covers a thin band (2 to 7 percent of the viewport height) at low opacity. There are no full-screen flashes.

**Stacking.** Most sections paint opaque backgrounds, so a layer at `z-index:-1` was invisible on the homepage in the 1280x800 check. The layer therefore sits at `z-index:1` inside the isolated `body`: above section backgrounds, below the sticky header (z 90), menus and dialogs, as a faint veil that never takes input.

**Readability.** The layer runs at 20 percent opacity on desktop and 14 percent on phones. A horizontal mask keeps the central reading column at about 40 percent of that. Cards keep their existing backgrounds.

**Performance.** There is one `requestAnimationFrame` loop, capped at 24fps (20fps under 700px wide or with Save-Data). Device pixel ratio is capped at 1.5 on desktop and 1 on phones. Phones get at most 26 columns and desktops at most 110. Resize is debounced to 200ms. The loop stops on `visibilitychange` when hidden and on `pagehide`. Each frame does one fade fill plus one glyph per column. There are no network requests, no player records and no game hooks.

**Toggle.** A "Code rain: on/off" button is appended to the page footer. The Stray signal terminal accepts `matrix`, `matrix on` and `matrix off`. The choice is stored on this device only, in `localStorage` under `geek-matrix-background`. It is on by default. Under `prefers-reduced-motion` it is off by default, and opting in shows one still frame with no animation or bursts. Forced colors and print hide it.

**Games and quizzes.** Individual game boards (`/games/<game>/`), owner pages and sign-in pages never load it. Quiz and lobby routes (`/play/`, `/practice/`, `/quest/`, `/duel/`, `/royale/`, `/memory/`, `/challenges/`) get a single still frame at 6 percent opacity with no loop. Anywhere else, an active `body.is-playing` or `/play/` quiz screen stops the loop and dims the layer, and it resumes after play ends. Timers, the Gauntlet and board input are untouched.

**Loading.** It is imported from `site.js`. `<script type="module" src="/assets/kaspa-matrix.js">` is added to the pages that do not load `site.js` (News, Media, Directory, About, Leaderboard, and the Whitepaper generator). It is a same-origin external module and stylesheet, so the existing CSP (`script-src 'self'`, `style-src 'self'`) is unchanged.

**Validation.** Six synthetic client tests are in `tests/kaspa-matrix.test.js`, and local 1280x800 headless Chromium screenshots were taken of the homepage and a game page. Physical-phone and low-power-device acceptance remains open.
