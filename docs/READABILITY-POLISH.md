# Readability polish — November 7, 2026

UX-014 responds to the founder reporting bright, bold, blurry white text on black pages. Removes the heading chromatic double-shadow, reading-text glow (including the quiz timer), and the fixed grain layer drawn above content. Caps explicit extra-bold 800–950 weights at 700 across public styles, including font shorthands. Softens pure white and common near-white copy to #dce4e7; shared and Play base surfaces use #10171c. Existing gold/cyan accents, focus outlines, answer states, layout and gameplay authority remain. Decorative code-rail glows stay behind content.

Source candidate only. Local rendered and static validation is recorded in the PR; physical-device acceptance and deployment remain separate. No question, account, wallet, reward or provider configuration changes.

## Founder preview correction

The founder found the first preview too plain. Retain reduced reading weights and softened white, but restore a low-opacity centered cyan glow on the signal heading and timer, with cyan card edge lighting and gold button/brand accents. No displaced chromatic shadows, grain overlay or body/answer-text glow. Hero weight is 750; reading copy retains the lighter baseline. Forced-colors still removes title and timer text shadows. This supersedes the initial no-reading-glow direction for these two display elements only.
