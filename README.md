# Hazusu marketing site

A local-first preview of the camera roll clean-out zine. The site uses semantic HTML, CSS, vanilla JavaScript and Lenis. Vite serves the source and produces a static build. See the [site brief](brief.md) for the intended experience.

## Run locally

From this directory, use Node 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. To serve the production build locally, run the following commands.

```sh
npm run build
npm run preview
```

The deployable directory is `dist/`. Relative asset paths support serving it at a domain root or under a subdirectory. Hosting is deferred. At public launch, set the social preview image URL to the final absolute origin and update the release information against the published APK.

## Editing the site

- **Content and print order** live in `index.html`. Keep the four cover prints, swipe stories, buttons and phone frames in matching order.
- **Brand styling and layout** live in `src/site.css`. It contains the font faces, ink colors, paper textures, print compositions and responsive layouts.
- **Motion and controls** live in `src/main.js`. Lenis smooths wheel input. On desktop and tablet, one continuous Android device travels across the full page: peeking behind the cover prints, gliding past the press strip to center-stage for the swipe guide, weaving in an S-curve across three stacking riso paper folios in Field Notes (Right for Monthly issues → Left for Smart piles → Center flanked by split display type for Toss pile, with clickable spine strips to jump to any folio), and finishing in the closing Android edition section with interactive App notes inside the phone. Narrow mobile keeps the Hero-to-Swipe glide and renders the three distinct Field Notes folios as a vertical editorial sequence; short viewports and reduced motion fall back cleanly to static spreads.
- **Product facts** come from the Hazusu app repository’s `README.md`, `docs/STATUS.md`, `docs/releases.md`, `src/theme/tokens.ts` and `src/review/moves.ts`. The phone and issue spreads are illustrative previews with sample photos. The Android app does not run in the browser.

## Assets and credits

All runtime media is served locally.

| Site asset | Source and use |
| --- | --- |
| `photos/corner-store.webp` (+ `-280`, `-480`) | Tokyo street photograph by Iban Lopez Luna, cropped and encoded at responsive widths for the sample roll. [Original photograph](https://www.pexels.com/photo/japanese-vending-machine-in-tokyo-street-scene-37533033/) · [Pexels license](https://www.pexels.com/license/) |
| `photos/side-street.webp` (+ `-280`, `-480`) | Tokyo street photograph by Gu Ko, cropped and encoded at responsive widths for the sample roll. [Original photograph](https://www.pexels.com/photo/coca-cola-vending-machine-on-tokyo-street-corner-36414769/) · [Pexels license](https://www.pexels.com/license/) |
| `photos/window-seat.webp` (+ `-280`, `-480`) | Roc0ast3r’s cat photograph, from the app’s grayscale onboarding crop at responsive widths. [Original photograph](https://commons.wikimedia.org/wiki/File:Cat_staring_out_window_(2023-08-14).jpg) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `photos/coffee-break.webp` (+ `-280`, `-480`) | Edward’s Café Butter photograph, from the app’s grayscale onboarding crop at responsive widths. [Original photograph](https://commons.wikimedia.org/wiki/File:Cup_of_coffee_in_Caf%C3%A9_Butter_-_Prenzlauer_Berg,_Berlin.jpg) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `hanko-104.png`, `hanko-208.png`, `hanko.png` | Hazusu’s own seal from the app’s `assets/images/seal.png`, `seal@2x.png`, and `seal@3x.png`. It is product branding. |
| `fonts/*.woff2` | Web subsets of Hazusu’s Dela Gothic One and Zen Kaku Gothic New. Redistribute the copyright and license notices with the fonts. [Dela Gothic One license](public/fonts/OFL-DelaGothicOne.txt) · [Zen Kaku Gothic New license](public/fonts/OFL-ZenKakuGothicNew.txt) |
| `grain.png`, `share.jpg` | Paper grain made for the site and a share image derived from its cover. |

The two Pexels images and the CC0 images allow use without attribution. Photographer credits are retained here with the source links.
