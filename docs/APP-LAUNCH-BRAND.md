# Clean Geek branding and installed-app launch

UX-025 replaces the existing logo with original repo-native vector artwork: robot face, circuit-brain dome, turquoise/gold outline and clean GEEK PROTOCOL wordmark. SVG is the editable source; Inkscape renders the 512px PNG. Both the new versioned filename and old compatibility PNG contain the clean artwork. Site logos, metadata favicons and organization-logo references use the new versioned filename. No old bitmap was cropped or modified.

A new manifest sets stable id /geek-protocol, start/scope /, standalone display and #000000 background/theme. Local 192/512 app icons and 512 maskable icon use a padded mark without tiny wordmark text, on opaque black. An Apple touch icon is supplied. Every managed page includes the manifest and touch link; browser theme color is black. Metadata generation removes those links before regenerating to preserve idempotence.

The browser/OS controls the native launch splash, icon placement, timing and installation behavior. An existing browser shortcut may need removing and reinstalling after release. This is an installed web app, not a native store app. No artificial splash overlay, delay, offline claim or service-worker caching of API/session/quiz data. Actual installed Android/iOS behavior remains unverified; source config alone is not physical-device acceptance.
