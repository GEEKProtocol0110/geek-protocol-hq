# Readability polish — November 7, 2026

UX-014 responds to the founder reporting bright, bold, blurry white text on black pages. Removes the heading chromatic double-shadow, reading-text glow (including the quiz timer), and the fixed grain layer drawn above content. Caps explicit extra-bold 800–950 weights at 700 across public styles, including font shorthands. Softens pure white and common near-white copy to #dce4e7; shared and Play base surfaces use #10171c. Existing gold/cyan accents, focus outlines, answer states, layout and gameplay authority remain. Decorative code-rail glows stay behind content.

Source candidate only. Local rendered and static validation is recorded in the PR; physical-device acceptance and deployment remain separate. No question, account, wallet, reward or provider configuration changes.

## Founder preview correction

The founder found the first preview too plain. Retain reduced reading weights and softened white, but restore a low-opacity centered cyan glow on the signal heading and timer, with cyan card edge lighting and gold button/brand accents. No displaced chromatic shadows, grain overlay or body/answer-text glow. Hero weight is 750; reading copy retains the lighter baseline. Forced-colors still removes title and timer text shadows. This supersedes the initial no-reading-glow direction for these two display elements only.


## News heading follow-up — November 8, 2026

Founder screenshot shows the market-desk H2 and market-view H3 still thick and hard to read. Root cause: News inherits the global Impact/Haettenschweiler condensed heading family; earlier weight limits did not replace that family. Scoped News overrides now use the regular UI sans-serif stack at 600, relaxed heading spacing and line-height, no text shadow/stroke/filter, and softened heading color. Hero size is reduced while cyan/gold accents and panel lighting remain. Navigation, selected feed and coin labels use 600; micro-labels use 500. The News CSS link has a revision query so cached CSS can refresh. Feed behavior, third-party frame typography, security policy and all other pages stay unchanged. This candidate is tracked under UX-014; rendered/phone acceptance remains separate.

Founder also reports the same appearance in the directory. Its title, category headings and resource names inherit the same Impact face. Applied the regular UI sans-serif/600/no-text-effects treatment there too, softened the default white and updated its CSS revision query. Listing records, source evidence, filtering and 183 resource links are unchanged.
