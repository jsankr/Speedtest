# CleanSpeed teardown

A critical review of the live app, done the way a design lead, a QA engineer and an accessibility auditor would each tear it down. Every finding lists what was wrong, why it matters, and what changed. Screens referenced are in [`docs/screenshots`](screenshots) (fictional sample data).

**Method**
- **Design review** against the frontend-design principles: does every choice come from the subject (a measuring instrument), or from a template?
- **Usability review** against Nielsen's 10 heuristics.
- **Accessibility audit** against WCAG 2.2 level AA: automated (axe-core 4.10 plus 20+ custom checks in [`tests/run.py`](../tests/run.py)) in Chromium, Firefox and WebKit, plus manual keyboard checks.
- **Cross-browser testing** of every flow in all three engines on every push ([`.github/workflows/tests.yml`](../.github/workflows/tests.yml)).

---

## 1. Design teardown

| # | Finding | Why it matters | Change |
|---|---|---|---|
| D1 | Section titles accented one word in italic colour ("Live network *map*"). | Highlighting a single word in every headline is one of the most common signs of a generated page. It adds no information. | Titles are plain Instrument Serif. The only italic left is the logotype "Clean*Speed*". |
| D2 | Every small label was tracked-out ALL CAPS in monospace ("DOWNLOAD", "RESPONSIVENESS UNDER LOAD", table headers, badges). | All-caps text is harder to read at small sizes and shouts. Monospace for small labels is template chrome. | Labels, table headers, badges and status text are sentence case in Instrument Sans. Geist Mono is now used only where its fixed width helps: numbers, units, MAC and IP addresses. |
| D3 | Buttons were set in monospace capitals. | Buttons are verbs; they read faster in the text face. | One button family in Instrument Sans: "Run security check", "Change server", "Retest". |
| D4 | Meta strings were joined with middle dots ("No ads · No trackers · Results stay…", footer, test status). | Dot-joined fragments are another template default, and screen readers read them as one run-on line. | Rewritten as sentences: "No ads or trackers. Your results stay on this device." Status: "Done. Tap Retest to test again." |
| D5 | Before a test, half of the speed-test panel was an empty chart. | Empty space with no explanation looks broken. | The chart fills its column and says "Live throughput appears here during a test." |
| D6 | Boldness was spread across many effects. | One memorable object beats many decorated ones. | The GO sphere and the glass dial are the single bold moment; everything else is quieter glass. |

Kept on purpose: cyan download / amber upload everywhere, frosted glass with one light direction, one entrance on load, numbers in a tabular face.

## 2. Usability teardown (Nielsen heuristics)

| Heuristic | What works | Finding → change |
|---|---|---|
| Visibility of system status | Phase steps, live dial, live map, timeline | Status changes were only visual → the status line is now a live region, so screen readers hear "Testing download…", "Done." |
| Match with the real world | Units in MB/s or Mbps, plain-language results ("HD streaming: Great") | — |
| User control and freedom | Stop at any time, Retest, toggles for map animation and live ping | — |
| Consistency and standards | One button family, one colour per direction | Three different label styles → one sentence-case label style |
| Error prevention | Network type must be picked; router check explains each question | — |
| Recognition rather than recall | History keeps every result; settings are remembered | — |
| Flexibility and efficiency | Keyboard and touch, units, own server | Keyboard users had to tab through the whole header → skip link "Skip to the speed test" |
| Aesthetic and minimalist design | See design teardown | Shouted labels and dot strings removed |
| Help users recover from errors | Errors say what failed and what to do next | — |
| Help and documentation | Inline "Where do I find these?" and the README | — |

Open (not changed, worth considering): the page is long on phones and has no in-page navigation; opening a tool shows it below the tool grid, which can move the reading position.

## 3. Accessibility audit (WCAG 2.2 AA)

| Success criterion | Finding | Fix | Checked by |
|---|---|---|---|
| 1.1.1 Non-text content | Six canvases (dial, chart, map, timeline, ping chart, trend) had labels but no role, so the labels were ignored. | `role="img"` + `aria-label` on every canvas; decorative SVG icons stay `aria-hidden`. | custom check + axe |
| 1.3.1 Info and relationships / 2.4.1 Bypass blocks | No `main` landmark and no skip link. | `<main id="main">` and a skip link that is the first Tab stop. | custom check |
| 1.4.3 Contrast (minimum) | Dark theme: dark text on the darkest stop of the cyan button gradient was 4.28:1. Light theme: white text on the lightest stop was 1.53:1. | Gradient stops re-tuned: every stop now ≥ 4.8:1 against its text. | custom check (tests every gradient stop) + axe |
| 1.4.10 Reflow | — | Passes at 320 px and with text at 200%. | custom check |
| 1.4.12 Text spacing | — | Passes with WCAG's spacing override applied. | custom check |
| 2.1.1 Keyboard / 2.1.2 No trap | — | Every control is reachable; no trap. | custom check |
| 2.4.7 Focus visible | — | 2 px accent outline on every stop. | custom check |
| 2.5.8 Target size (minimum) | The "Where do I find these?" disclosure was 20 px tall. | 28 px; every control is ≥ 24 px, and ≥ 44 px on touch screens. | custom check |
| 2.3.3 Animation from interactions | — | With *Reduce motion* on, transitions are cut and the map starts unanimated. | custom check |
| 4.1.2 Name, role, value | The network picker used `role="radio"` with `aria-pressed` (an invalid combination); router questions used `role="radiogroup"` around toggle buttons. Comparison bars had a label on an element with no role (axe: aria-prohibited-attr). | Toggle-button groups (`role="group"` + `aria-pressed`); comparison bars `role="group"`. | custom check + axe |
| 4.1.3 Status messages | Test progress wasn't announced. | `role="status"` + `aria-live="polite"` on the status line; errors use `role="alert"`. | custom check |
| 2.1.1 Keyboard (scrollable region) | The country ranking scrolls but couldn't be focused (axe: scrollable-region-focusable). | `tabindex="0"`, `role="region"` and a label. | axe |
| Windows high contrast | Glass panels lost their edges. | `forced-colors` styles outline panels and controls. | manual |

## 4. Cross-browser bugs found by the new tests

| Engine | Bug | Cause | Fix |
|---|---|---|---|
| WebKit (Safari) | After one speed test the page grew to about 18,000 px tall, with a huge empty chart. | The chart canvas sized its own grid row, and each redraw made the row taller. | The canvas is absolutely placed inside a wrapper, so the row sizes the chart and never the reverse. Tests now assert page and chart height after a test. |
| WebKit (Safari) | `ResizeObserver loop completed with undelivered notifications` error. | Same growth loop. | Same fix; chart redraws are batched into one animation frame. |
| WebKit (Safari) | `overflow-x: hidden` on `body` made the body its own scroller. | WebKit doesn't always pass body overflow up to the page. | `overflow-x: clip`, which stops sideways scroll without creating a scroller. |

## 5. Still to check by hand

Automated tools catch many accessibility problems, but not all of them. Before a release, also:
- Use the app with VoiceOver on iPhone and Mac, and NVDA on Windows, end to end.
- Zoom to 400% on a desktop browser.
- Check the router report's wording with someone who isn't technical.
