# Hazusu

## Goal and audience

Introduce Hazusu to Android users with a camera roll full of photos and videos they mean to sort. The primary action is **Download APK** (direct download of the `v0.4.0-alpha.1` testing prerelease hosted via GitHub Releases on `ZenDevvv/hazusu-site`). Visitors can also experience all four swipe decisions on the page using sample photos before installing.

## Pages and content

One editorial landing page opens with a fan of four prints and the top of the phone peeking behind them. Scrolling glides the same Android device continuously through the entire page: first to center-stage for the four-direction swipe guide, then weaving across three stacking riso zine folios in Field Notes (Monthly issues on the right, Smart piles flipped to the left, Toss pile dead-center flanked by split display typography), and finally into the closing Android edition section where App notes and the return action live inside the phone screen itself.

Use Hazusu’s current product README, release notes, swipe implementation and brand book as the source of truth. The current testing prerelease (`v0.4.0-alpha.1`) is linked directly from the Hero and Android edition buttons via GitHub Releases on `ZenDevvv/hazusu-site`.

## Visual direction

Use Hazusu’s Riso Zine identity. Set the cover in Dela Gothic One, body copy in Zen Kaku Gothic New, and small print details in monospace. Pair plum text and lavender paper with a pink second impression, mint Keep marks and lilac Fave marks. Use the app’s hanko, tactile paper, photographic prints and monthly cover format.

Use large type and pacing inspired by [TTM Supply](https://ttm.supply/), the chapter changes of [Mandelo](https://www.mandelo.agency/), and the image-and-type compositions of [BeeVrac](https://beevrac.fr/). The standing direction is in [marketing site design preferences](../../docs/design-preferences.md).

## Requirements

- Keep the site local for this iteration. Bundle its photos, fonts and Lenis dependency with the site.
- Parallax separates the cover prints at different speeds while the top of the phone peeks behind the stack. As you scroll past the cover and its press strip, the phone glides into center-stage over oversized display type, then travels smoothly into Field Notes and finally docks in Android edition with App notes inside the phone.
- Keep all phone transitions C¹-continuous and frame-rate-independently damped (matching scroll velocity when docking into normal-flow sections so there is no abrupt stop), with scroll-scrubbed overlapping screen crossfades and subtle 3D tilts that lean with gestures and angle toward companion copy.
- In the guide, right keeps, left tosses, up faves and down skips. Each photo moves on the corresponding axis once the phone reaches the centered stage. Reverse scrolling rebuilds the stack and returns the phone behind the cover.
- Visitors can jump directly to any gesture or skip the guide via the compact bottom bar. On short screens and with reduced motion, the phone stays centered in the guide and four buttons select the examples. With JavaScript disabled, all four descriptions remain readable.
- Field notes layer as three distinct tactile paper folios (`01` cream/lilac, `02` mint, `03` riso pink) with clickable spine headers rather than a carousel or duplicate pinned stage. Keep copy minimal (one short line per folio, wordless visual specimens, no badges or duplicate eyelines repeating the in-phone UI). On mobile, short viewports and reduced motion, all three folios stack vertically as full spreads.

## Review

Check the cover and chapter links on mobile and desktop, the four card trajectories in both scroll directions, release wording, keyboard focus, and reduced-motion behavior. Build and serve the static output with its local assets.
