---
name: pinwall
description: A left-luggage counter for text — you deposit it, keep the only stub, and the attendant cannot look inside.
colors:
  enamel-deep: "#1e2326"
  enamel: "#232a2e"
  enamel-lit: "#3d484d"
  on-enamel: "#a6b0a6"
  ticket: "#2d353b"
  ticket-hi: "#252c31"
  ticket-rule: "#75838c"
  brass: "#dbbc7f"
  brass-lit: "#e9d3a0"
  oxblood: "#e67e80"
  ink: "#d3c6aa"
  ink-muted: "#a6b0a6"
  ink-faint: "#94a199"
typography:
  display:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  wordmark:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  prose:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  code:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  serial:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tnum 1"
  label:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  chip: "2px"
  control: "3px"
  panel: "4px"
  sheet: "6px"
  pill: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
components:
  counter-header:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    padding: "12px 20px"
  plate:
    backgroundColor: "{colors.ticket}"
    rounded: "{rounded.control}"
  recess:
    backgroundColor: "{colors.enamel-deep}"
    textColor: "{colors.ink}"
    padding: "16px"
    typography: "{typography.code}"
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.enamel-deep}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.brass-lit}"
    textColor: "{colors.enamel-deep}"
  button-primary-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
  button-ghost:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    typography: "{typography.title}"
  button-ghost-hover:
    backgroundColor: "{colors.enamel-lit}"
    textColor: "{colors.ink}"
  button-stock:
    backgroundColor: "{colors.ticket-hi}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    typography: "{typography.title}"
  button-stock-hover:
    backgroundColor: "{colors.ticket-hi}"
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "32px"
  field-inset:
    backgroundColor: "{colors.ticket-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    typography: "{typography.code}"
  tag-badge:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.enamel-deep}"
    rounded: "{rounded.chip}"
    padding: "2px 6px"
    typography: "{typography.serial}"
  stamp-sealed:
    backgroundColor: "transparent"
    textColor: "{colors.oxblood}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
    typography: "{typography.label}"
  field-label:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
---

# Design System: pinwall

<!--
Recorded from the shipped build (src/index.css, src/components/, src/routes/) after the
world was implemented, not from the plan. Where the direction contract and the code
disagreed, the code won.

Review status, stated at its real scope: a finish review returned `ship` for the scored
fixes only — eight material findings plus two regressions — not a whole-surface pass. Two
things were explicitly NOT certified: the mechanical detector never ran outside DEGRADED
mode, so custom properties, selector matching, and computed contrast were never
mechanically evaluated; and the Everforest Dark palette never received a full fidelity
pass, because it arrived after the review round. The contrast ratios quoted below are
hand-measured, not tool-verified.
-->

## Overview

**Creative North Star: "The Left-Luggage Counter"**

pinwall is a station cloakroom rendered in Everforest Dark. Its structure and its whole vocabulary come from a left-luggage counter: you hand something over, an attendant takes it behind an enamel counter, and you leave with a brass **tag** and a paper **stub**. The vocabulary is not decoration — it is the interaction model, and it is load-bearing everywhere the interface names something: a pin is a *deposit*, its id is a *tag*, the edit link is your *stub*, encryption is a *seal*, the options row is *deposit terms*, and the surface content sits on is a *plate*. The material carries the product's central promise without asserting it: an attendant who takes a sealed case genuinely cannot look inside.

The material system is Everforest Dark, applied over that structure late in the build by user directive. It replaced a lighter enamel-and-ticket-stock treatment; the counter's *roles* survived the swap unchanged, only the pigments moved. So the whole app is dark: a near-black ground, a chrome band at the top, a slightly lifted plate holding the content, and a darker recess cut into that plate where the code is read. Depth is built from the physics of those materials — a fired enamel surface catching a band of light along its top edge, a sheet of stock casting a soft offset shadow, a window cut into that sheet showing an inner shadow at its lip — never from generic card elevation.

The register is quiet, dense, and mechanical. There is no hero, no marketing tone, no illustration: the paste target fills the first viewport, and every piece of chrome earns its place by serving handoff, trust, or editing. Two things are deliberately not here: nostalgia cosplay (no fake wear, torn edges, or vintage filters — the counter is a *working* counter, not a period piece), and the dark-shell-with-one-neon-accent pastebin the world replaces.

**Key Characteristics:**

- A closed palette of five inks over six surfaces; further tone comes only from gloss and ruling.
- Brass is the single action colour, used on one control per screen.
- Everything measurable is set in mono with tabular figures; everything spoken is set in a signage grotesque.
- Depth reads as *sitting on* or *cut into* — never as floating.
- Hairline corners (2–3px) throughout; nothing is soft or pill-shaped.
- Type on brass is the ground colour, never ink.
- Two authored motion moments only: a seal closing and a stamp landing.

## Colors

Everforest Dark, cast into the counter's roles: six cool surfaces, three warm inks, and two marks. It is a closed set — every remaining tone in the build is a translucent tint of ink or of black, layered as gloss or ruling, never a new hue.

### Primary

- **Brass** (`brass`): the tag, the hook, and the one action. It appears on the primary button, the issued tag badge, the engaged Seal switch, the wordmark's tag mark, the markdown blockquote rule, and text selection — and nowhere else. Rarity is the point: one brass control per screen.
- **Lit Brass** (`brass-lit`): brass caught in light. Primary hover, the inset top highlight on the primary button, focus rings, the caret in every text field, the checked option in the language picker, and the passphrase key icon.

### Secondary

- **Oxblood** (`oxblood`): the counter's refusals and its seal. Error banners (as a full 1px border over a 15% wash, never a left stripe), the wrong-passphrase message, the *Sealed* stamp, the "unsealed here" seal state, the stub warning on the share ticket, and — inside rendered markdown only — link colour and checked task boxes, because brass is reserved for the one action and a document's links are not that action.

### Neutral

- **Enamel Deep** (`enamel-deep`): the page ground, the recess a code view is read through, and the text colour of anything set on brass.
- **Enamel** (`enamel`): the counter front — the header band, the deposit-terms bar, ghost buttons, and the language picker's popup.
- **Lit Enamel** (`enamel-lit`): every border and divider on chrome, and the scrollbar thumb on dark ground.
- **On Enamel** (`on-enamel`): secondary text set on chrome — the posted notice, the terms-bar labels, the editor placeholder.
- **Ticket** (`ticket`): the plate — every surface that carries pin content, plus the modal panels and empty-state cards.
- **Ticket Highlight** (`ticket-hi`): fields inset into the plate — url readouts, the passphrase input, inline code, table headers, the stub half of the share ticket.
- **Ticket Rule** (`ticket-rule`): every rule, border, and perforation dot drawn *on* the plate, and the plate's scrollbar thumb.
- **Ink** (`ink`): primary reading text and headings (7.38:1 on plate).
- **Muted Ink** (`ink-muted`): body prose and field values (5.57:1 on plate). Numerically identical to `on-enamel`; the two names exist because the roles are different — one is text on stock, one is text on enamel — and either could move without the other.
- **Faint Ink** (`ink-faint`): field captions, counts, timestamps, and unset states such as "not issued" and "open" (4.64:1 on plate, 4.95:1 on inset).

### Named Rules

**The Five Inks Rule.** The palette is closed at five inks over six surfaces. New tone is produced only two ways: a gloss (a translucent ink or black gradient laid over a surface) or a ruling (a translucent ink line). A new hex is a sixth ink and needs the same justification the first five had.

**The Ground-on-Brass Rule.** Type, icons, and cut-outs on a brass field are `enamel-deep`, never `ink` (8.70:1). This holds on the primary button, the tag badge, the engaged Seal switch, the wordmark's tag glyph, and text selection. Ink on brass is the single most likely way to break this world's contrast.

**The One Hook Rule.** Exactly one brass action per screen. When a screen offers a second action it takes the ghost or stock variant, so the eye never has to choose between two hooks.

**The Second Cue Rule.** State is never carried by hue alone. Sealed is oxblood *plus* a bordered uppercase stamp *plus* a brass band closing across the plate; disabled is a dashed border *plus* a transparent fill, not a dimmer colour; the verified state says "verified" in words next to the button it enables.

## Typography

**Display Font:** Libre Franklin (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Libre Franklin
**Label/Mono Font:** Azeret Mono (with `ui-monospace, SFMono-Regular, monospace`)

Both faces are self-hosted variable `woff2` from `public/fonts/`, preloaded in `index.html`, subset to Latin, and served `font-display: swap`. Self-hosting is not a performance preference: PRODUCT.md binds *no tracking, no ads*, and a font CDN is a beacon that fires on first paint. A CDN-linked face is a violation of a binding commitment, not a shortcut.

**Character:** Libre Franklin is a signage grotesque — it reads as posted notice and station lettering, and at 800 weight with negative tracking it gives the counter's few headings real authority without ornament. Azeret Mono is the counter's stamping machine: serials, dates, counts, ids, and urls. The pairing is a station's two voices — what the counter *says*, and what the counter *records*.

### Hierarchy

- **Display** (800, 30px, 1.05, -0.035em): the two moments a screen announces something — "Tag issued" on the share ticket, "This deposit is sealed" on the locked viewer.
- **Headline** (800, 26px, 1.1, -0.03em): the counter's answer when there is nothing to show — "No deposit under this tag", "The counter did not answer".
- **Wordmark** (mono 600, 16px, -0.03em): `pinwall`, lowercase, in mono, beside the brass tag mark. It is the only mono at display scale and it never changes.
- **Title** (600, 13px): the one-line lead inside a panel, e.g. "Scan to open elsewhere".
- **Body** (400, 13px/1.6, `ink-muted`): explanatory prose in panels and modals. The posted notice in the header runs one step down at 12px/1.45 in `on-enamel`; proof text and error copy run 12.5px/1.6.
- **Prose** (400, 14px/1.65, max 72ch): rendered markdown only. Its own hand-rolled scale (h1 1.6em, h2 1.3em with a `ticket-rule` underline, h3 1.1em, all 800 weight at 1.25 with -0.015em) rather than a typography plugin, so every colour comes from the palette instead of being overridden into it.
- **Code** (mono 400, 12.5px/1.6): the editor, the code block, and the highlighted layer beneath the editor's textarea. Both editor layers share this exact metric — they must, or the transparent textarea's glyphs stop lining up with the highlighting under them.
- **Serial** (mono 500, 11.5px, tabular): field values in the label grid — tag, date, seal state — plus counts and relative times.
- **Label** (mono, 9–10px, uppercase, 0.11–0.14em tracking, `ink-faint`): field captions, stamps, the editor's Write/Preview tabs, the Seal switch, "Deposit as", "Hand this over". Field captions in the label grid sit at the small end (9px / 0.14em).

### Named Rules

**The Measurement Rule.** Mono carries measurement and counter markings only — ids, dates, byte counts, urls, language names, field captions, stamps. It never sets prose. Prose is always the grotesque. Mono as a costume for "this is technical" is the failure mode this rule exists to prevent.

**The Date Die Rule.** Dates are stamped `04 SEP 2026` — two-digit day, three-letter uppercase month, four-digit year — at fixed width, so a label grid never reflows when the date changes. Anything else that could shift width (ids, counts, relative times) carries `.tabular` (`font-variant-numeric: tabular-nums`).

**The Signage Weight Rule.** Headings jump straight from 13px/600 to 26–30px/800. There is no 18px or 20px middle tier; the counter either states something or annotates it.

## Layout

The app is a fixed-height counter, never a scrolling page. The shell is `h-dvh` and a flex column: a `shrink-0` chrome header, then a `flex-1 min-h-0` main that owns all the remaining height. Content scrolls *inside* the plate or the recess; the document itself does not scroll. This is what lets the paste target fill the first viewport with nothing above it.

Spacing runs on Tailwind's 4px scale, densely: the main region uses 12px padding and gaps that step to 16–20px at `sm`. The plate header is `16px / 10px`, the editor pads 16px, panels pad 20–24px. Vertical rhythm inside the label grid is 2px (caption to value), 8px between rows, and 20–28px between fields — tight groups, generous separation.

Two container widths exist and no more: **440px** for a single decision (the unlock form, every empty and error state) and **460px** for the share ticket. Everything else is full-bleed to the shell.

Responsive behaviour is switch-shaped, not fluid. At `sm` the deposit-terms bar turns from a stacked column into one horizontal line with the action at its end; the share ticket turns from a bottom sheet (bottom-anchored, `6px` top corners, a `ticket-rule` grabber pill) into a centred card with `4px` corners. At `md` the posted notice moves from below the content to the right of the header. The passphrase field takes `basis-full` below `sm` so it never squeezes the language picker.

**The Nothing Above the Paste Target Rule.** On `/`, the header is the only thing between the top of the viewport and the plate. No banner, no tagline, no announcement bar ever goes there.

**The Content-Owns-the-Height Rule.** Every intermediate flex container carries `min-h-0`. Any new panel added to the shell is `shrink-0` unless it is the content itself; the content is the only `flex-1`.

## Elevation & Depth

There are no ambient card shadows in this system. Every surface is either **sitting on** the counter or **cut into** it, and the shadow says which.

A surface that sits on the counter (`.plate`) gets a 1px ink highlight along its top inside edge and a soft, downward-offset cast shadow — the way a sheet of stock lying on enamel actually reads. A surface cut into the counter (`.recess`) gets inner shadows instead: a hard dark line at its top lip and a soft gradient down its left side, as if light falls from above and the wall of the cut catches it. Chrome gets neither; it gets `.enamel-gloss`, a fired-enamel gradient that catches a band of light in its top 2px and pools darker at the bottom edge.

### Shadow Vocabulary

- **Plate** (`box-shadow: 0 1px 0 rgb(211 198 170 / 0.07) inset, 0 10px 26px -10px rgb(0 0 0 / 0.55)`): every surface carrying pin content, plus modal panels and empty-state cards.
- **Recess** (`box-shadow: 0 1px 0 rgb(0 0 0 / 0.4) inset, 14px 0 18px -18px rgb(0 0 0 / 0.75) inset`): the code window cut into the plate. Always paired with an `enamel-deep` fill.
- **Brass hook** (`box-shadow: 0 1px 0 var(--color-brass-lit) inset, 0 6px 16px -8px rgb(0 0 0 / 0.55)`): the primary button only. The inset line is the lit top edge of a metal tag, not a border.
- **Picker popup** (`box-shadow: 0 18px 48px -12px rgb(3 16 13 / 0.8)`): the open language picker, the only surface that genuinely floats above the counter.

### Named Rules

**The Two Directions Rule.** A shadow either lifts a surface off the counter (outer, offset down, soft) or sinks one into it (inset, from the top lip and the left wall). There is no third mode. A zero-offset halo or a coloured glow is decoration and does not belong.

**The Gloss Not Fill Rule.** Chrome and plate tone comes from a gradient over the base colour — `.enamel-gloss` on the header, the fibre tint in `.plate`, `.ruled` on the stub. Flat-filling a surface to a new flat hex is how the closed palette leaks.

## Shapes

Corners are hairlines. Three radii cover the entire app: **2px** for anything chip-sized (tag badges, stamps, inline code, the Seal switch, editor tabs, copy-icon buttons), **3px** for anything panel- or button-sized (the plate, buttons, error banners, inset fields, the QR panel), and **4px** for the two surfaces that read as paper — markdown `pre` blocks and images, and the share ticket at `sm`. The bottom-sheet form of the share ticket takes **6px** on its top corners only. Fully round appears exactly twice, both times as physical objects: the sheet's grabber pill and the 44px oxblood ring around the lock badge.

Borders are 1px and always a palette colour: `enamel-lit` on chrome, `ticket-rule` on stock, `brass` or `oxblood` when the border *is* the state. The only 2px borders in the system are the lock badge's ring and the markdown blockquote rule.

The signature silhouette is the **perforation**: a 1px band of `ticket-rule` dots on a 9px pitch, drawn with a radial gradient rather than bordered. It runs across the share ticket at exactly the point where the half you hand over ends and the stub you keep begins — a functional tear line, not a divider. Its companion is the recess's **ruled gutter**: a 12px binding edge down the left of every code window, drawn as a 20px-pitch horizontal ruling with a 1px inner rule, so the code always reads as written into a form.

## Components

### Buttons

Three variants, distinguished by the surface each one acts on.

- **Shape:** hairline corners (3px); icon buttons are a fixed 32px square. Transitions run 150ms on background, colour, border, and shadow.
- **Primary (brass):** the counter's one action — `Deposit`, `Unlock`, `Save`, `Amend`, `Open pin`, `New deposit`. Brass fill, `enamel-deep` text, the lit-edge shadow. Hover lifts the fill to `brass-lit`.
- **Ghost (enamel):** acts on the counter without being the action — header tools (raw, copy, render toggle), `Cancel`. `enamel` fill with an `enamel-lit` border; hover moves the border to `brass` and the fill to `enamel-lit`.
- **Stock:** acts on the plate itself — copy buttons inside the share ticket, the QR toggle, `Try again`. `ticket-hi` fill with a `ticket-rule` border and `ink-muted` text; hover moves the border to `brass` and the text to `ink`.
- **Disabled:** the fill is removed entirely and replaced by a **dashed** `brass/55` border over transparent, with `ink-muted` text and no shadow. A disabled brass button never reads as a dimmer brass button.

### Inputs / Fields

- **Style:** `ticket-hi` fill, 1px `ticket-rule` border, 3px corners, mono at 12.5–13px. Inline fields on the terms bar drop the box entirely and sit transparent on the enamel with no border.
- **Focus:** the global focus ring is a 2px `brass-lit` outline at 2px offset with a 2px radius, applied on `:focus-visible` only. The passphrase field on the locked viewer overrides this with an oxblood border and an oxblood caret, because that field belongs to the seal, not to the action.
- **Caret:** every text-entry surface sets `caret-brass-lit` (or `caret-oxblood` on the unlock field). The caret is part of the palette here, not a browser default.
- **Placeholder:** `on-enamel` on the recess, `ink-faint` on stock.

### Cards / Containers

- **Corner Style:** 3px (4px for markdown paper surfaces, 6px top-only for the mobile sheet).
- **Background:** `ticket` via `.plate`, which also supplies the fibre tint and the cast shadow.
- **Shadow Strategy:** see Elevation — plate shadow, never an ambient card shadow.
- **Border:** none on the plate itself; internal divisions are 1px `ticket-rule` rules.
- **Internal Padding:** 16px horizontal / 10px vertical on the plate header; 20–24px on decision panels.

### The Label Grid (signature)

Four fields in a fixed order — **Tag / Deposited / Keep until / Seal** — carried by every object in the product: the deposit plate on `/`, the viewer's plate, and the share ticket's header. A visitor reads the same four facts in the same order wherever they meet a pin. Each field is a mono 9px uppercase caption in `ink-faint` over a mono 11.5px tabular value in `ink-muted`, stacked with a 2px gap, laid out as a wrapping flex row with 20px column gaps (28px at `sm`).

Unset values are named rather than blanked: `not issued`, `no limit`, `open`. `Keep until` currently reads the literal truth — **`no limit`** — because expiry is not built. That field is the slot expiry will occupy; until it ships, nothing in the interface may imply a pin is temporary.

### The Seal (signature interaction)

Sealing is the one authored moment in the app, and it acts on the *deposit*, not on the switch. Toggling Private does three things at once: a 3px brass band closes across the full width of the plate from its left hinge (`clip-path: inset(0 100% 0 0)` → `inset(0)` over 500ms), an oxblood **Sealed** stamp lands on the plate's own header (from `rotate(-9deg) scale(1.5) blur(3px)` at zero opacity to `rotate(-4deg) scale(1)` over 380ms), and the switch itself fills brass. Both animations run on `--ease-counter` (`cubic-bezier(0.16, 1, 0.3, 1)`) and both are switched off under `prefers-reduced-motion: reduce`. The switch is the hand that does it, never the thing that changes.

### The Share Ticket (signature)

A real cloakroom ticket in two halves, separated by the perforation. Above it: the display heading, the brass tag badge, the share link, the QR panel, and the plain statement of what the counter actually received. Below it: the stub — a `ticket-hi` ground carrying `.ruled` (28px-pitch horizontal ruling), the edit link in an oxblood-bordered field, and the oxblood warning that the token cannot be reissued. The tone shift across the perforation is the point: the top half is a handoff, the bottom half is a receipt you are responsible for.

### The Code Editor / Code Block

A Shiki-highlighted layer sits under a transparent textarea inside the recess, both at identical font metrics and padding, scroll-mirrored. The theme is Shiki's `everforest-dark`, loaded lazily with one grammar chunk per language, so highlighting matches the palette by construction rather than by override. Before Shiki resolves, the same text renders unstyled in `on-enamel` so the layout never jumps. Markdown adds a Write/Preview tab pair (mono 10.5px uppercase; the active tab inverts to `ink` on `enamel-deep`) inside the editor itself, so the creator and the viewer's edit mode both get it.

Two behaviours here are load-bearing and constrain any future visual change (see `attention.md`): the editor must stay escapable by keyboard — Tab indents, Escape releases the next Tab — and rendered markdown must stay DOMPurify-sanitised before it reaches `dangerouslySetInnerHTML`.

### Navigation

There is none in the conventional sense: two routes, and the only persistent navigation is the wordmark, which is a link to a new deposit. Its brass tag mark rotates 7° on its hook on hover (500ms, `--ease-counter`). Screen-level tools live at the right of the chrome header as ghost icon buttons.

### The Language Picker

A real `<select>`, kept real so phones and tablets get the OS wheel or sheet for free. `appearance: base-select` styling is applied only where the browser supports it *and* the pointer is fine, so touch always falls back to the native picker. The styled popup is `enamel-deep` at 20rem max height with mono 12px options, the checked option in `brass-lit`, the default checkmark column suppressed (it shifts every label), and the picker icon rotating 180° when open.

### Browser Surfaces

The parts the browser would otherwise style are part of the system: selection is `enamel-deep` on brass, focus is a `brass-lit` ring, scrollbars are thin with an `enamel-lit` thumb on dark ground and a `ticket-rule` thumb on stock, and `color-scheme: dark` is set on `html` and re-asserted on markdown `pre`.

## Do's and Don'ts

### Do:

- **Do** stay inside the five inks. New tone comes from a gloss or a ruling — a translucent ink or black layer over an existing surface — not from a new hex.
- **Do** set type on brass in `enamel-deep`. Every brass field in the build does this, and it is the difference between 8.70:1 and unreadable.
- **Do** give every screen exactly one brass action, and put every other action on the ghost or stock variant.
- **Do** decide, for each new surface, whether it *sits on* the counter (`.plate`) or is *cut into* it (`.recess`), and take that surface's shadow unchanged.
- **Do** set anything measurable in mono with `.tabular` — ids, dates, counts, urls, serials — and anything spoken in Libre Franklin.
- **Do** carry the four-field label grid, in order, on any new object that represents a pin.
- **Do** pair every state colour with a second cue: a border, a stamp, a word, a dashed edge.
- **Do** theme browser surfaces (selection, caret, scrollbars, focus ring) from the palette on any new control.
- **Do** self-host any new face as a subset variable `woff2` in `public/fonts/` with a preload in `index.html`.
- **Do** keep the shell's height contract: `shrink-0` chrome, one `flex-1 min-h-0` content region, scrolling inside the content.

### Don't:

- **Don't** put type or icons on brass in `ink`.
- **Don't** add an ambient card shadow, a coloured glow, or a zero-offset halo. The two-direction shadow vocabulary is the whole depth system.
- **Don't** round anything past 4px, or reach for a pill shape. Hairline corners are the form language; the two round objects in the build are physical objects, not styling.
- **Don't** use brass for a second, competing action, or for decoration. Its scarcity is what makes it read as the hook.
- **Don't** set prose in mono, or use mono to signal "technical". Mono is for measurement.
- **Don't** put anything above the paste target on `/` — no banner, no tagline, no announcement.
- **Don't** imply a pin is temporary. `Keep until` reads `no limit` because that is the truth today; countdowns, expiry chips, and "expires in" copy are forbidden until expiry actually ships.
- **Don't** add a second authored motion moment. The seal closing and the stamp landing are the app's motion budget; everything else is a 150ms state transition.
- **Don't** load a font, script, or asset from a third-party CDN on a rendering path. Self-hosting is a binding product commitment, not a preference.
- **Don't** add nostalgia texture — fake wear, torn edges, sepia, vintage filters. This is a working counter, not a period piece.
- **Don't** put a stroke of any weight on the left edge of a card, list item, or alert as an accent device. Errors take a full 1px border over a 15% wash.
