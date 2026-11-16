# Keep game play together — UX-033

The founder observed repeated up/down scrolling during the recorded walkthrough. Local clients focused newly rendered status messages and squares with the browser's default scrolling after selection, moves, undo or feedback. Large desktop introductions and vertically stacked Solitaire stock/foundation areas compounded the problem.

The candidate uses `preventScroll` when restoring focus during play. Local session entry deliberately positions the compact main area once; exiting returns focus to setup. Existing live announcements, keyboard controls, game rules, scoring, storage, rooms and account/economic boundaries stay in place.

A last-loaded, active-session-only stylesheet reduces the header/title, hides setup art and supplemental copy during play, sizes chess/checkers boards to viewport height, and keeps Brain Lab's question/answer/feedback together. Setup retains the original GIGA and Geek presentation. Chess history is a disclosure. Solitaire stock, waste and all four Home piles share a stable row in a sticky control area. Seven columns remain visible at phone width; exceptionally long stacks and short/zoomed viewports may still scroll naturally. No body scroll lock or content clipping is introduced. Instructions remain available.

Focus handling also covers the existing local strategy client and online piece selection. Online hosted two-player acceptance, physical phones, on-screen keyboards and assistive-technology acceptance remain separate. The provider preview and exact browser evidence are recorded in the PR. No production release is claimed before founder review.
