---
name: design-system-cleanspeed
description: CleanSpeed's "Aurora Bento" design system — tokens, layout, components, motion and accessibility rules. Use when changing how any CleanSpeed screen looks, moves or behaves.
---

# CleanSpeed — Aurora Bento

## Mission
CleanSpeed should feel like a premium consumer product: calm frosted glass and soft light (from concept A, "Aurora"), with results laid out as a confident bento of solid colour tiles and big serif numbers (from concept C, "Bento"). The numbers stay the hero; colour always means something.

## Brand
- Product: CleanSpeed — ad-free, tracker-free speed test with router security check and network toolkit
- Audience: people checking their home or mobile connection, mostly on a phone; technically curious, not necessarily experts
- Product surface: React app built into one installable HTML file; 320 px phones to 1440 px+ desktops

## Architecture of the UI
- `app/src/App.jsx` — the shell: sidebar (≥ 1024 px), floating tab bar + More sheet (< 1024 px), hash routes (`#/test`, `#/live`, `#/collider`, `#/insights`, `#/history`, `#/router`, `#/tools`, `#/ask`, `#/settings`), theme (auto / light / dark, stored as `theme`), server sheet scrim.
- `app/src/views/*.jsx` — one component per screen, rendered once and memoised. Element ids are the contract with the engine; don't rename them.
- `app/src/engine/engine.js` — behaviour. It talks back to the shell only through `ui.go(view)`, `ui.sheet(open)`, `ui.running(on)` and `ui.onView(fn)`; a theme change fires `cs:theme`, which the canvases treat like a system colour-scheme change.
- Styles: `fonts.css` (bundled faces), `base.css` (component styles), `theme.css` (tokens, shell, bento, tiles; wins over base).

## Style Foundations
- **Ground:** warm cream `#f3eee5` (dark: ink `#0c0d12`) under three still aurora fields — blue top-left, pink top-right, mint bottom (dark: blue, violet, faint pink).
- **Glass:** `--glass` panels with 26 px backdrop blur, 1 px `--line`, top `--hi` highlight, soft drop shadow. Used for the sidebar, the instrument, charts, forms and lists.
- **Colour tiles (solid, no blur):** text inside always uses the tile's own `--ink` / `--muted`.

  | Tile | Colour | Used for |
  |---|---|---|
  | `.card.ink` | `#15131a` light / `#f3eee5` dark, with a blue→violet blob | Download result |
  | `.card.coral` | `#ff7a4d` | Upload result |
  | `.card.sky` | `#a9dcff` | Latency (ping, jitter, loaded) |
  | `.card.lilac` | `#ddd3ff` | Responsiveness grade |
  | `.card.mint` | `#c4efd9` | Your place in the world |

- **Typography:** three bundled faces with one job each.
  | Token | Use | Face, size |
  |---|---|---|
  | Wordmark | `h1` | "Clean" Instrument Sans 600, 22 px + "*Speed*" Instrument Serif italic, 27 px, next to the conic-gradient app mark |
  | Screen title | `.viewhead h2` | Instrument Serif 400, clamp(36–56 px) |
  | Section title | `h3` | Instrument Serif 400, 26 px |
  | Result number | `.tile.d .val`, `.tile.u .val` | Instrument Serif 400, clamp(54–92 px) (44–60 px on phones) |
  | Live number | gauge centre, `.latency .val`, `.stat b` | Gauge: Instrument Serif 168 px on canvas; others Geist Mono 500 |
  | Body / labels / buttons | everything else | Instrument Sans 400–600, 13–15 px, sentence case |

- **Colour tokens** (components never use raw hex except tile surfaces and the lime GO):

  | Token | Light | Dark | Meaning |
  |---|---|---|---|
  | `--down` = `--accent` | #2453e0 | #7ea4ff / #8fb0ff | Download, links, focus |
  | `--up` | #c2410c | #ff9a66 | Upload |
  | `--violet` / `--up2` | #7048e8 / #e0457b | #a58bff / #ff6fa3 | Gradient partners of download / upload on the gauge |
  | `--lime` / `--on-lime` | #d4f53c / #15170a | same | GO / Retest sphere, current tab |
  | `--ink` / `--muted` | #16131c / #5d5866 | #efedf3 / #a29daf | Text / secondary text |
  | `--good` / `--ok` / `--bad` / `--high` | #13804d / #8a6a00 / #c42f3b / #b8451a | #45cf8f / #e2c34b / #ff5c66 / #ff7a45 | Pass / caution / fail / high severity |

  Canvas code appends alpha to colours, so every colour token is `#rrggbb`.
- **Radius:** panels and tiles 26 px (22 px on phones), tool tiles 20 px, inputs 12 px, every button and pill 999 px. GO is a sphere.
- **Spacing:** 4 px base; bento gap 16 px (12 px on phones); panel padding 24–26 px (18 px on phones).

## Layout
- **Laptop / desktop (≥ 1024 px):** 252 px glass sidebar + content. Home bento is three columns: the instrument spans four rows on the left; download | upload, latency, throughput, grade | router check on the right.
- **Tablet (561–1180 px):** two-column bento; below 1024 px the sidebar becomes a top bar and the tab bar appears.
- **Phone (≤ 560 px):** results first — download | upload tiles above the instrument — then latency, throughput, grade, router check. The tab bar floats at the bottom; the server picker becomes a bottom sheet.

## Components
- **Instrument `#instrument`:** steps pill (current step is an ink pill with a lime dot), ring gauge with the GO sphere in its centre, Stop, phase line, network segmented control, server chip, then connection note and Copy result in a footer.
- **Ring gauge (canvas):** 270° soft track, fine scale inside, value arc as a conic gradient from the phase colour to its partner (download blue→violet, upload coral→pink) with a glow and a white knob at the head; live value in Instrument Serif in the centre while testing.
- **GO sphere `.orb`:** lime radial body with a specular highlight top-left, a 12 px translucent lime halo and a soft drop shadow. Becomes "Retest" after a test.
- **Navigation:** `.navitem` (sidebar) and `.tab` (tab bar) — the current screen is `aria-current="page"`, a solid ink pill (lime in the tab bar). No transition on the pill, so it is never caught half-way at low contrast.
- **Buttons (one family):** primary `.go2` = blue→violet gradient pill, white text; secondary `.ghost` = glass pill; destructive `.stopbtn` = tinted red pill; `.iconbtn` = 44 px round glass (theme switch).
- **Segmented control `.seg`:** pill track, the selected option is a solid ink pill.
- **Tool tiles `.tile2`:** glass cards with a colour chip icon (each tool keeps its own hue); icon above text on phones.
- **Sheets:** the server picker is a centred glass dialog on wide screens and a bottom sheet on phones, over a blurred scrim; Escape or tapping the scrim closes it.
- **Lists, charts, map, collider, help assistant:** unchanged in structure from v1 (see `base.css`); they pick up the new tokens.

## Motion
- Allowed: a short slide (no fade) when a screen opens, hover lift and press on controls (140 ms), state transitions (220 ms), the gauge easing toward the live value, map packets and collider bunches (real data), charts drawing as data arrives, a soft pulse on the sidebar's "Test running" dot.
- Not allowed: fading text in (it fails contrast while it fades), looping decorative motion, parallax, bouncy springs.
- The packet collider keeps its rendered Blender plates and runs only while a test runs, capped at 30 fps, paused off screen, respecting *Animate* and *Reduce motion*.
- `prefers-reduced-motion: reduce`: transitions and animations are cut to 0.01 ms and the map animation starts switched off.

## Accessibility
- Target: WCAG 2.2 AA.
- Text contrast ≥ 4.5:1 for all text tokens on the glass and on every colour tile in both themes. Each tile redefines `--ink`, `--muted`, `--track` and `--line` for its own surface, so components inside a tile stay readable. Glass alpha stays ≥ 0.62.
- Focus: 2 px `--accent` outline, 2 px offset, on every control, `summary` and link; the GO sphere gets a 3 px ink ring outside its halo; tab-bar items use a lime ring.
- Changing screens moves focus to the new screen's heading, so screen readers announce where you are.
- Touch targets ≥ 44 px on coarse pointers (checked at 320 and 390 px: none under 44 px); inputs use 16 px text on touch to prevent iOS zoom.
- Colour is never the only signal: severities, grades and statuses always carry words.
- No horizontal page scroll at 320 px; wide tables scroll inside their own container.

## Writing Tone
Plain and specific. Say what the number means and what to do next. Labels are nouns in sentence case; buttons are a verb and an object ("Run DNS benchmark", "Change server").

## Rules: Do
- Use tokens; add a token before adding a colour.
- Keep download blue and upload coral in every new chart or view.
- Put related numbers in wells side by side; keep numbers in Mono with tabular figures.
- Define default, hover, focus-visible, active, disabled and loading states for any new control.
- Test new UI at 320, 390 and 1280 px, in both themes and with reduced motion.

## Rules: Don't
- Don't accent one word in a heading, set labels in all caps, or join meta text with middle dots; write sentences.
- Don't use monospace for words; it is for numbers, units and addresses.
- Violet appears only inside gradients (the ring gauge, the download blob, the primary button), never as a flat colour with its own meaning.
- Screen titles may sit on the page ground; everything else sits on glass, a well or a colour tile.
- Don't add looping or attention-seeking animation to status elements.
- Don't introduce a second button style, card style or radius scale. New results go in a bento tile; new areas get a screen in `VIEWS` (app/src/App.jsx).
- Don't rely on hover for anything essential.
- Don't put real personal data (routers, MAC or IP addresses, speeds) in screenshots or docs; use the fictional sample set.

## Browser support
- Chrome / Edge 111+, Safari 16.2+ (macOS and iOS), Firefox 113+ (all use `color-mix`). Backdrop blur uses the standard property plus `-webkit-backdrop-filter` for Safari; browsers without blur get the solid panel colour.
- The light fields are a fixed `body::before` layer, not `background-attachment: fixed`, which iOS Safari doesn't support.
- Inputs use 16 px text on touch so iOS Safari doesn't zoom.

## Testing
`python tests/run.py` runs (on every screen, every tool and the server sheet) the end-to-end and WCAG 2.2 AA checks (contrast including every gradient stop, names, roles, landmarks, skip link, keyboard, focus, target sizes, reflow, text spacing, reduced motion, axe-core) in Chromium, Firefox and WebKit; CI runs it on every push. See [docs/TEARDOWN.md](docs/TEARDOWN.md) for the last audit.
- Windows high contrast (`forced-colors`) outlines panels and controls.
- The skip link is the first Tab stop and jumps to `<main>`.

## Quality Gates
- Every text token must pass 4.5:1 on its surface in both themes.
- Every interactive element must be ≥ 44 px tall on touch.
- No page-level horizontal scroll at 320 px.
- Reduced motion must leave every state readable.
- Screenshots in `docs/screenshots` must be regenerated after any visual change: `python tests/screens.py`.
- The committed `index.html` must match `app/` (`cd app && npm run build`); CI checks it.

## Sources
Rules distilled from: TasteSkill (leonxlnx/taste-skill — one system, no violet, no pulse/scroll fades, 44 px taps), UI UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill — accessibility, touch, typography and colour priorities), Design Motion Principles (kylezantos/design-motion-principles — frequency gate, productivity weighting, AI-motion anti-patterns, reduced motion), Awesome Claude Design (VoltAgent/awesome-claude-design — DESIGN.md as the source of truth) and the TypeUI DESIGN.md format used by Design.md Chrome (bergside/design-md-chrome).
