# Widget installation page

The canonical guide is `/tools/kaspa-widget/`, with permanent `#android` and `#iphone` anchors. HQ's home card and tools directory link here. Old `/tools/#kaspa-widget` links still land on the tools card with both platform choices.

Android keeps the verified `/api/widget?download=1` endpoint. The direct GitHub APK URL is a second route; browsers can copy the canonical page link if an in-app download stalls. Neither a full progress bar nor an HTTP check proves installation on the user's device.

iPhone setup uses Scriptable. The public `.txt` file is the unmodified, reviewed script from widget repository commit `41423f2a7bbdb7a5dea5268012cf38b77a91f971`. Provenance and SHA-256 are recorded alongside it in `scriptable-version.json`; `widget-install.js` verifies the bytes before copying. A blocked Clipboard API shows a selectable text area. Missing JavaScript or unavailable script verification leaves the raw-text link usable. This change does not distribute the native iOS app or claim physical iPhone acceptance.

When updating Scriptable, replace the versioned asset with a separately reviewed version, update its manifest and `widget-install.js` hash, and update the HTML raw-text links. Verify that the copy contains the full source, including the final `await run();`. Never silently modify the widget script in HQ; fixes belong in its source repository first.

`kaspa-widget-mark.svg` preserves the media-kit paths and mint/white colors from the widget's `app/src/main/res/drawable/kaspa_mark.xml`. Source attribution: [widget BRAND_ASSETS.md](https://github.com/GEEKProtocol0110/kaspa-live-widget/blob/main/BRAND_ASSETS.md). The widget script and HQ code use their respective repository MIT licenses.

Verification: `node --test tests/widget-guide.test.js tests/widget-download.test.js`, then the repository's `npm run verify` and production dependency audit. Client fixtures prove copy/error/retry behavior, not native browser rendering. Real Android installation and Scriptable/iPhone trials remain separate checks. No managed preview browser is available in this workspace; inspect layouts and keyboard/clipboard behavior on real browsers before calling them device-verified.
