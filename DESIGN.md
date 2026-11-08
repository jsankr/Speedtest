---
name: design-system-cleanspeed
description: CleanSpeed's "glass instrument" design system — tokens, components, motion and accessibility rules. Use when changing how any CleanSpeed screen looks, moves or behaves.
---

# CleanSpeed — Glass Instrument

## Mission
CleanSpeed should feel like a precision instrument made of glass: depth, light and material that make it a pleasure to use, while the numbers stay the hero. Every object is lit from the same direction, every colour carries one meaning, and nothing moves unless it shows something real.

## Brand
- Product: CleanSpeed — ad-free, tracker-free speed test with router security check and network toolkit
- Audience: people checking their home or mobile connection, mostly on a phone; technically curious, not necessarily experts
- Product surface: single-page web app (installable), fits 320 px phones to 1440 px+ desktops

## Style Foundations
- **Visual style:** frosted-glass panels over two still light fields (cyan top-left, amber bottom-right) and a faint dot grid; engraved "wells" for readouts and inputs; raised 3D objects (GO sphere, tool chips, segmented thumb, dial bead) lit from the top-left. Violet is never used.
- **Typography:** three faces with one job each, bundled with the app (Latin subset, WOFF, SIL Open Font License) so no font request leaves the device.
  - **Instrument Serif** (`--display`) — section titles, with one word set in italic accent colour ("Live network *map*"), and the italic half of the wordmark.
  - **Instrument Sans** (`--body`, variable 400–700) — reading text, tool names and descriptions, notes.
  - **Geist Mono** (`--mono`, `--num`, variable 100–900) — every number, unit, label, button and table.
  - Fallbacks: ui-serif/Georgia, system-ui/-apple-system, ui-monospace/SF Mono. Antialiased, kerning on, `font-display: swap`; canvases redraw when the fonts arrive.

  | Token | Use | Face, size / weight |
  |---|---|---|
  | Wordmark | `h1` + glass chip | "Clean" Instrument Sans 600, 23 px · "*Speed*" Instrument Serif italic, 27 px, accent |
  | Section title | `h2` | Instrument Serif 400, 25 px / 1.1, −0.01em, one italic accent word |
  | Tool title | `.tool h3` | Instrument Serif 400, 22 px |
  | Primary value | `.val` | Geist Mono 500, clamp(30–46 px), tabular, soft halo in its direction colour |
  | Secondary value | `.small .val`, `.stat b`, `.bignum` | Geist Mono 500, 20–34 px |
  | Label | `.lbl`, `th`, `.tag` | Geist Mono 500, 11 px, 0.09em tracking, uppercase |
  | Control | buttons, segmented, chips | Geist Mono 500, 12.5–13 px |
  | Body | `body`, `.conn`, tool descriptions | Instrument Sans 400, 15 px / 1.55 (descriptions 12.5–13 px) |
  | Note | `.note` | Instrument Sans 400, 13 px, `--muted` |

- **Colour (semantic tokens; components never use raw hex, except the per-tool chip hues):**

  | Token | Dark | Light | Meaning |
  |---|---|---|---|
  | `--bg0` | #080b0d | #e6ebef | Page ground under the light fields |
  | `--field1` / `--field2` | cyan 13% / amber 8% | cyan 20% / amber 16% | Still light fields behind the glass |
  | `--glass` | rgba(22,29,34,.58) | rgba(255,255,255,.60) | Panel material (with 22 px backdrop blur) |
  | `--glass-solid` | #151b1f | #f7f9fa | Fallback when backdrop blur is unsupported |
  | `--well` / `--well-in` | 3.5% white / 35% black inner shadow | 55% white / 6% ink inner shadow | Engraved readouts, inputs, lists |
  | `--line` / `--line2` / `--hi` | 9% / 18% / 10% white | 11% / 20% ink / 95% white | Edges / control borders / top highlight |
  | `--ink` / `--muted` | #e6ecef / #93a0a9 | #10181d / #53606a | Text / secondary text |
  | `--down` = `--accent` | #3ad3e3 | #067785 | Download, primary action, links, focus |
  | `--accent-hi` / `--accent-lo` | #b9f6fc / #0b8796 | #5fe3f0 / #045d68 | Light and shadow side of accent objects |
  | `--up` | #ffa53d | #b45f00 | Upload |
  | `--good` / `--ok` / `--bad` / `--high` | #45cf8f / #e2c34b / #ff5c66 / #ff7a45 | #13804d / #8a6a00 / #c42f3b / #b8451a | Pass / caution / fail / high severity |

  Cyan always means download and amber always means upload, everywhere (dial, sparkline, map, timeline, history, comparison "you" bar). Tool chips each have their own hue (speed cyan, router green, ping amber, DNS blue, IP teal, calculator slate, password rose, device lime, subnet cobalt, compare gold) so the toolkit reads as distinct objects.
- **Spacing:** 4 px base; panel padding 22–24 px (18 px under 480 px, 26–28 px at 1280 px+); gaps 10 / 16 / 22 px.
- **Radius:** panels 20 px, wells and tiles 14–16 px, controls 12 px, chips and tags 999 px. The GO button is a sphere.
- **Elevation:** three levels: page (light fields), glass panel (`--shadow` + top `--hi` highlight), raised object (coloured drop shadow + inner top highlight + inner bottom shade). Wells go *into* the glass (inner shadow).

## Components
- **Glass panel `.glass`:** `--glass` fill, 1 px `--line`, 20 px radius, `backdrop-filter: blur(22px) saturate(150%)` (with `-webkit-` prefix for Safari), inset top highlight and soft drop shadow; solid fallback via `@supports`.
- **GO sphere `.orb`:** radial specular highlight top-left, accent body shading to `--accent-lo`, coloured cast shadow, sitting in a 10 px tinted ring. Hover lifts 2 px; press scales to .97.
- **Dial:** lit glass bezel, engraved track, value arc in the phase colour with a soft halo and a white glass bead at the head; mono value in the centre during a test.
- **Buttons (one family):** primary `.go2` = accent glass object; secondary `.ghost` = raised glass control; destructive `.stopbtn` = tinted red glass. Mono labels, 12 px radius, min-height 38 px (44 px on touch). Hover lifts 1 px, press settles and scales .98.
- **Segmented control `.seg`:** engraved track, selected option is a raised accent thumb.
- **Readouts:** wells with an inner shadow; download/upload wells carry a light line in their direction colour along the top edge.
- **Tool tiles `.tile2`:** raised glass cards with a 3D colour chip icon; hover lifts 2 px; the open tool gets a coloured rim.
- **Lists (fixes, CVEs, router questions, MAC results):** wells or raised glass rows with 8 px gaps. Severities are tinted pills with words, never colour alone.
- **Charts:** 3 px lines with a soft halo in the series colour and a faint area fill; the throughput chart stretches to fill the readout column on wide screens and shows a hint when empty.
- **Map:** stylised dot-matrix land in an engraved well; markers and moving packets have small halos; each dot stands for real bytes.

## Motion
- Weighted for a product people use daily: restraint first, polish second.
- Allowed: one entrance of the speed-test panel on load (550 ms rise), hover lift and press on controls (140 ms), state transitions (220 ms), the dial needle easing toward the live value, map packets (real data), charts drawing as data arrives.
- Not allowed: pulsing or breathing indicators, looping rings, drifting backgrounds, parallax or pointer tilt, fade-in on scroll, staggered list entrances, bouncy springs.
- Animation loops run only while something changes (the dial stops redrawing when the needle settles).
- `prefers-reduced-motion: reduce`: transitions and animations are cut to 0.01 ms and the map animation starts switched off; every state is still visible.

## Accessibility
- Target: WCAG 2.2 AA.
- Text contrast ≥ 4.5:1 for all text tokens on the glass in both themes (checked against the solid fallback colours: muted 6.2:1, accent 5.3:1 light / 9.7:1 dark, white on light accent 5.3:1). Glass alpha stays ≥ 0.58 so text never sits on a busy background.
- Focus: 2 px `--accent` outline, 2 px offset, on every control, `summary` and link.
- Touch targets ≥ 44 px on coarse pointers (checked at 320 and 390 px: none under 44 px); inputs use 16 px text on touch to prevent iOS zoom.
- Colour is never the only signal: severities, grades and statuses always carry words.
- No horizontal page scroll at 320 px; wide tables scroll inside their own container.

## Writing Tone
Plain and specific. Say what the number means and what to do next. Labels are nouns in uppercase Mono; buttons are a verb and an object ("Run DNS benchmark", "Change server").

## Rules: Do
- Use tokens; add a token before adding a colour.
- Keep download cyan and upload amber in every new chart or view.
- Put related numbers in wells side by side; keep numbers in Mono with tabular figures.
- Define default, hover, focus-visible, active, disabled and loading states for any new control.
- Test new UI at 320, 390 and 1280 px, in both themes and with reduced motion.

## Rules: Don't
- Don't use violet, or mix light directions: every highlight comes from the top-left.
- Don't put text directly on the light fields; text sits on glass or in wells.
- Don't add looping or attention-seeking animation to status elements.
- Don't introduce a second button style, card style or radius scale.
- Don't rely on hover for anything essential.
- Don't put real personal data (routers, MAC or IP addresses, speeds) in screenshots or docs; use the fictional sample set.

## Browser support
- Chrome / Edge 111+, Safari 16.2+ (macOS and iOS), Firefox 113+ (all use `color-mix`). Backdrop blur uses the standard property plus `-webkit-backdrop-filter` for Safari; browsers without blur get the solid panel colour.
- The light fields are a fixed `body::before` layer, not `background-attachment: fixed`, which iOS Safari doesn't support.
- Inputs use 16 px text on touch so iOS Safari doesn't zoom.

## Quality Gates
- Every text token must pass 4.5:1 on its surface in both themes.
- Every interactive element must be ≥ 44 px tall on touch.
- No page-level horizontal scroll at 320 px.
- Reduced motion must leave every state readable.
- Screenshots in `docs/screenshots` must be regenerated after any visual change.

## Sources
Rules distilled from: TasteSkill (leonxlnx/taste-skill — one system, no violet, no pulse/scroll fades, 44 px taps), UI UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill — accessibility, touch, typography and colour priorities), Design Motion Principles (kylezantos/design-motion-principles — frequency gate, productivity weighting, AI-motion anti-patterns, reduced motion), Awesome Claude Design (VoltAgent/awesome-claude-design — DESIGN.md as the source of truth) and the TypeUI DESIGN.md format used by Design.md Chrome (bergside/design-md-chrome).
