# Brain Games candidate

UX-016 adds /games/brain/ with three first-party games, linked from /games/#brain-games. Signal Sequence exercises exact digit-order recall, including leading zeros: digits remain visible until the player explicitly hides them. Every two rounds adds a digit, capped at twelve. Number Forge offers bounded integer addition/subtraction, with multiplication at higher levels. Rule Shift alternates parity and greater-than-five rules, with the current rule always visible. Each game has Easy, Steady and Stretch levels and ten untimed rounds. Controls support keyboard use and numeric mobile input. No flashing, sound, deadlines or external assets are required.

Start is explicit. One answer can score each round; the player reviews the explanation before advancing. Exiting does not save an incomplete result. Completed best scores (0–10) are stored per mode/level under geek-brain-v1 in localStorage, validated on read. Blocked/malformed storage leaves gameplay available. Clear removes this namespace only. No quiz bank, server API, account, player record, XP, ranking, token or economic gate is changed. Local scoring is intentionally untrusted and never submitted as a competitive score.

Practice is the product claim, not higher IQ or prevention/treatment of cognitive conditions. The National Institute on Aging distinguishes specific training research from broad commercial game claims: https://www.nia.nih.gov/health/brain-health/cognitive-health-and-older-adults. Geek's games have not been clinically evaluated. No clinical finding is transferred to these new implementations. Product copy describes the actual tasks and session results.

Metadata/link/continuity and game/client tests are required. This is a source candidate; exact-head CI, rendered preview, physical-device acceptance, merge and deployment are separate evidence. Existing Games hub #249 is merged/deployed and its canonical HTML/CSS matched source. Brain Games adds no external embed or vendor service.

Local validation: six engine/shipped-client tests and five homepage regressions pass; site metadata/link and continuity checks pass; public-answer and security checks pass (311 assertions). No rendered-browser or physical-phone acceptance is claimed.


## Geek visual finish — November 8, 2026

Founder requires a consistent Geek look for every new game. Shared /games/assets/geek-play.css adds branded headers, existing GIGA artwork in compact practice-tip panels, gold primary controls, cyan/gold rimmed checker pieces, a framed board and circuit-patterned dark card backs. Card fronts retain readable rank/suit symbols on dark blue panels with distinct red-suit text; no color-only cues. Brain prompts use a framed signal panel. No new game logic, image generation, external requests or score behavior. Site and all 19 focused game/client/homepage checks pass. Visual browser/phone acceptance remains unclaimed.
