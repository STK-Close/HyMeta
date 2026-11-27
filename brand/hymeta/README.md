# HyMeta logo kit (2026-11-27)

HyMeta's own logo: the gold tile with the pixel backpack, beside the name in Grandstander Black, in the same sizes and
spacing as the site's header. Nothing redesigned. The profile picture and banners use Hex in the waving pose that
Ligia approved on November 21, 2026 (promo/hex/hex-wave.png). The lettering is turned into shapes in every SVG, so
no font is needed to open them. Fonts: Grandstander for the name and Atkinson Hyperlegible for the short lines on the
banners, both free under the SIL Open Font License (GRANDSTANDER-FONT-LICENSE.txt, ATKINSON-HYPERLEGIBLE-FONT-LICENSE.txt).

Colors: gold #f2b94b · deep gold #a8771a · backpack #1d1503 and #7a5200 · night #0e1223 · ink #eef1fb (on light: #121930)

## Which file to use
| Use | File |
|---|---|
| YouTube, Instagram, Threads, Reddit profile picture | png/social/profile-1024.png (Hex waving; safe in a circle crop) |
| Ko-fi or X (Twitter) banner | png/social/banner-kofi-x-1500x500.png |
| YouTube banner (everything inside the 1546 by 423 area that shows on phones and TVs) | png/social/banner-youtube-2560x1440.png |
| Link previews in posts | png/social/share-preview-1200x630.png |
| Full logo on dark backgrounds | png/logo/hymeta-logo-color-on-dark.png (transparent) |
| Full logo on light backgrounds | png/logo/hymeta-logo-color-on-light.png (transparent) |
| One-color logo (stamps, single-color printing) | png/logo/hymeta-logo-black.png, hymeta-logo-white.png |
| The tile alone (small spaces, corners, watermarks) | png/mark/hymeta-mark-color.png, -black, -white |
| The site's own icons and link preview (keep using these on the site) | png/icons/ (icon.svg, icon-192, icon-512, apple-touch-icon, favicon-32, og.png) |
| A one-page look at the whole kit | preview.png |
| Printers, sign makers, anything that needs to be sharp at any size | the matching file in svg/ |

## Rules
- Don't stretch, recolor outside these colors, or add effects (shadows, glows) beyond the tile's own.
- Leave clear space around the logo at least as wide as half the tile.
- Every public use says "An unofficial fan site". The banners and the share image already carry it.
- Hex appears only in poses Ligia approved. Show her any new pose before it is used. Child-safe always.

## Remake it
`python3 brand/tools/make_kit.py brand/tools/fonts/Grandstander-Black.ttf` then `node brand/tools/render_kit.cjs`.

© 2026 Lumina Art House, LLC. All Rights Reserved.
