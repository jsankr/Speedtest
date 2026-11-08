---
name: design-system-cleanspeed
description: CleanSpeed's "instrument panel" design system — tokens, components, motion and accessibility rules. Use when changing how any CleanSpeed screen looks, moves or behaves.
---

# CleanSpeed — Instrument Panel

## Mission
CleanSpeed should read like a measuring instrument, not a marketing page: numbers first, one colour per direction of traffic, nothing that glows, floats or competes with the measurement. Every element earns its place by helping someone read, compare or act on a result.

## Brand
- Product: CleanSpeed — ad-free, tracker-free speed test with router security check and network toolkit
- Audience: people checking their home or mobile connection on a phone; technically curious, not necessarily experts
- Product surface: single-page web app (installable), phone first, works to 320 px

## Style Foundations
- **Visual style:** flat graphite panels, 1 px rules, tabular monospaced numbers, square-ish corners. No glass, blur, aurora, gradients on surfaces, drop shadows, glows or violet.
- **Typography:** IBM Plex Sans (UI text, headings) and IBM Plex Mono (numbers, labels, buttons, data). Fallbacks: system-ui / ui-monospace.

  | Token | Use | Size / weight |
  |---|---|---|
  | Wordmark | `h1` | Mono 600, 20 px, 0.14em tracking, uppercase |
  | Section heading | `h2` | Sans 600, 15 px |
  | Primary value | `.val` | Mono 500, clamp(30–44 px), tabular, slashed zero |
  | Secondary value | `.small .val`, `.stat b` | Mono 500, 20–26 px |
  | Label | `.lbl`, `th` | Mono 500, 11 px, 0.12em tracking, uppercase |
  | Body | `body` | Sans 400, 15 px / 1.5 |
  | Note | `.note` | Sans 400, 13 px, `--muted` |

- **Colour (semantic tokens; components never use raw hex):**

  | Token | Dark | Light | Meaning |
  |---|---|---|---|
  | `--bg0` | #0d1012 | #eceff0 | Page ground |
  | `--panel` / `--panel2` | #141a1d / #1a2125 | #ffffff / #f4f6f7 | Panel / inset or hover |
  | `--line` / `--line2` | 10% / 20% white | 13% / 22% ink | Rules / control borders |
  | `--ink` / `--muted` | #e4eaed / #8f9ca5 | #11171a / #56626b | Text / secondary text |
  | `--down` = `--accent` | #3ad3e3 | #067785 | Download, primary action, links, focus |
  | `--up` | #ffa53d | #b45f00 | Upload |
  | `--good` / `--ok` / `--bad` | #45cf8f / #e2c34b / #ff5c66 | #13804d / #8a6a00 / #c42f3b | Pass / caution / fail |
  | `--high` | #ff7a45 | #b8451a | High-severity vulnerability |
  | `--you` | #f2f5f6 | #11171a | "You" marker in comparisons |

  Cyan always means download and amber always means upload, everywhere (gauge, sparkline, map dots, timeline, history). Violet is never used.
- **Spacing:** 4 px base; panel padding 18–20 px (16 px under 480 px); gaps 8 / 14 / 16 px.
- **Radius:** `--r-panel` 6 px, `--r-ctl` 4 px, chips and badges 2 px, markers 1 px. The GO button is the only circle.
- **Elevation:** none. Separation comes from `--line` rules and `--panel2` insets.

## Components
- **Buttons (one family):** `.go2` / `.orb` = filled accent (primary, one per area); `.ghost` = outlined (secondary); `.stopbtn` = outlined `--bad` (destructive). All: Mono label, 4 px radius, min-height 36 px (44 px on touch), hover = border/background step, press = translateY(1px) or scale(.97) for the orb, disabled = 45% opacity.
- **Segmented control `.seg`:** joined buttons with internal rules; selected = filled accent.
- **Readout groups:** related values share one bordered box split by rules (`.big`, `.small`), not separate cards. Download/upload tiles carry a 2 px top rule in their direction colour.
- **Lists (fixes, router questions, MAC results):** one bordered box, rows split by rules. Severity shown as a bordered tag (`.sev`) with text, never colour alone.
- **Callouts:** 3 px left rule in the state colour, neutral background.
- **Charts:** flat 3 px lines, faint area fill (≤20%), no shadows; gauge = 22 px butt-capped arc in the phase colour with an ink needle mark.
- **Map:** stylised dot-matrix land; dots stand for real bytes; small, faint halos only on markers and moving packets.

## Motion
- Weighted for a productivity tool (restraint first): state changes only, 120 ms (`--t-fast`) or 180 ms (`--t`), `cubic-bezier(.2,.7,.2,1)`.
- Allowed: button press/hover, meter width, gauge needle easing toward the live value, map packets (real data), chart drawing as data arrives.
- Not allowed: pulsing or breathing indicators, looping rings, drifting backgrounds, parallax or tilt, fade-in on scroll, staggered list entrances, bouncy springs.
- Animation loops run only while something changes (the gauge stops redrawing when the needle settles).
- `prefers-reduced-motion: reduce`: transitions and animations are cut to 0.01 ms and the map animation starts switched off; every state is still visible.

## Accessibility
- Target: WCAG 2.2 AA.
- Text contrast ≥ 4.5:1 for all text tokens on `--panel` in both themes (checked: muted 6.2:1, accent 5.3:1 light / 9.7:1 dark, white on light accent 5.3:1).
- Focus: 2 px `--accent` outline, 2 px offset, on every control, `summary` and link.
- Touch targets ≥ 44 px on coarse pointers (checked at 320 and 390 px: none under 44 px); inputs use 16 px text on touch to prevent iOS zoom.
- Colour is never the only signal: severities, grades and statuses always carry words.
- No horizontal page scroll at 320 px; wide tables scroll inside their own container.

## Writing Tone
Plain and specific. Say what the number means and what to do next. Labels are nouns in uppercase Mono; buttons are a verb and an object ("Run DNS benchmark", "Change server").

## Rules: Do
- Use tokens; add a token before adding a colour.
- Keep download cyan and upload amber in every new chart or view.
- Group related numbers in one ruled box; keep numbers in Mono with tabular figures.
- Define default, hover, focus-visible, active, disabled and loading states for any new control.
- Test new UI at 320, 390 and 1280 px, in both themes and with reduced motion.

## Rules: Don't
- Don't add glass, blur, glow, drop shadows, gradients on surfaces, or violet.
- Don't add looping or attention-seeking animation to status elements.
- Don't introduce a second button style, card style or radius.
- Don't rely on hover for anything essential.
- Don't put real personal data (routers, MAC or IP addresses, speeds) in screenshots or docs; use the fictional sample set.

## Quality Gates
- Every text token must pass 4.5:1 on its surface in both themes.
- Every interactive element must be ≥ 44 px tall on touch.
- No page-level horizontal scroll at 320 px.
- Reduced motion must leave every state readable.
- Screenshots in `docs/screenshots` must be regenerated after any visual change.

## Sources
Rules distilled from: TasteSkill (leonxlnx/taste-skill — one system, no violet, no pulse/scroll fades, 44 px taps), UI UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill — accessibility, touch, typography and colour priorities), Design Motion Principles (kylezantos/design-motion-principles — frequency gate, productivity weighting, AI-motion anti-patterns, reduced motion), Awesome Claude Design (VoltAgent/awesome-claude-design — DESIGN.md as the source of truth) and the TypeUI DESIGN.md format used by Design.md Chrome (bergside/design-md-chrome).
