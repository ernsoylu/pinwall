---
version: 1
slug: "src-routes-creator-tsx"
primary_target: "src/routes/Creator.tsx"
related_targets: ["src/routes/Viewer.tsx","src/routes/ShareModal.tsx","src/components/Shell.tsx"]
---

Scope: the whole app — `/` (Creator), `/<id>` (Viewer: loading, missing, expired, error, locked, ready, editing), and the share slip. Replacement visual world, not a refinement. Visitor mode: **Operate** on every surface, `/` included.

Audience and job: a developer mid-task with a stack trace or config already on the clipboard, needing it to become a link in about five seconds. A second visitor arrives at `/<id>` from someone else's link and decides in two seconds whether this looks like somewhere a teammate's secret should live.

Action: paste → set deposit terms → create → hand off. Time-to-link is unchanged by anything added here.

Proof to carry (all checkable in source, nothing invented): the passphrase never leaves the device; the DB holds only `ciphertext` and `iv`; `anon` has no `SELECT` on `edit_token`; `INSERT`/`UPDATE`/`DELETE` are revoked from `anon`. The share slip is where this gets told in full — the visitor has already succeeded there, so proof costs them nothing.

Memorable moment: sealing a private pin. Toggling Private is a deposit being closed and sealed, with weight, not a checkbox tint.

Constraints: nothing above the paste target on `/`; state never carried by hue alone; the editor stays escapable by keyboard; the three `attention.md` invariants hold; no index or browse of pins.

Expiry semantics (confirmed): time windows only — 1 hour / 24 hours / 7 days / 30 days / no limit — with **permanent the default**. Ignore the control and the pin lives forever, exactly as today. Nothing may imply pins are temporary until expiry ships.

Anti-goals: nostalgia cosplay (fake wear, torn edges, vintage filters); a lock icon and a ticket-shaped `div` standing in for the material system; any claim not checkable in the source.

Unresolved decisions, not for a builder to invent:
- Whether disposal hard-deletes the row or tombstones it. If rows are hard-deleted, an expired pin cannot report *"disposed of on 4 March"* and the expired state collapses back into missing. This blocks that screen.
- Whether the edit token also authorizes deletion (PRODUCT.md records it undecided).

## Direction contract

**THESIS:** A left-luggage counter — you deposit text, keep the only stub, and the attendant cannot look inside. Refuses the dark-shell-with-one-accent pastebin it replaces.

**OWN-WORLD:** Everforest Dark carries every surface (user-directed, replacing the enamel-and-ticket-stock materials; the counter's structure is unchanged). Chrome #232a2e over a #1e2326 ground; #2d353b plate; code in a #1e2326 recess; brass #dbbc7f for the tag, the hook and the one action; #e67e80 for refusals; ink #d3c6aa. Signage grotesque, mono serials for ids and dates, mono body. Closed set — further tone comes from gloss and ruling only.

**STORY:** A developer deposits text, reads the terms in one line, and leaves with a tag and a stub. The slip states exactly what was kept and what was never received, so the claim is checked rather than believed.

**FIRST VIEWPORT:** Enamel counter header, posted notice at its right. The ticket-stock plate fills the viewport as the paste target, ruled and already dated. The deposit-terms line sits beneath it, primary action at its end.

**FORM:** The Left-Luggage Counter — candidate 1 of my ordered list, taken as the pick over assigned index 7; seed 5c1539eb.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
