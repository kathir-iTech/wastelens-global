# Demo script (DRAFT for review — not final, not recorded)

Live URL: <https://wastelens-global.vercel.app/>
Order matches the locked pitch beats. Timings are targets, adjust on the day.
Everything below that touches retrieval/embedding wording is **non-negotiable** —
it must match what the repo actually does (see `README.md` → "Design decisions (said straight)").

---

## Beat 0 — hook (0:00–0:15)

> "You're standing in Delhi. The same photo of this tin, and the law decides.
> Not 'AI says recycling' — 'section 388(E) of the SWM Rules says this goes in
> the dry stream, and here's the fine if you don't.' That's WasteLens Global."

## Beat 1 — the mechanism (0:15–0:45)

> "Three layers. Perception proposes, the law decides.
> **Perception** reads the photograph and names the object — glass jar, paint
> can, banana peels. It never guesses the law. **The matrix** takes that
> description and does a deterministic lookup against a corpus of rules we
> hand-verified against primary sources — India SWM 2026, New York Local Law 19,
> England's Simpler Recycling SI. Same input, same jurisdiction, same rule
> version, same answer. Always. It's a lookup, not a classifier."

*Screen: Mode A, Run perception on the glass jar, verdict appears.*

## Beat 2 — the honest design decision, the "tech beat" (0:45–1:15)

> "Now the question every engineer asks: how do you retrieve the right rule?
> The straight answer: **we use deterministic weighted matching, not embeddings.**
> For a legal-compliance tool, auditable and exact beats probabilistic — and
> vector search would add approximate-match risk to precisely the one layer
> that cannot afford to guess. Every source row is exact, every score is
> explainable, every verdict shows you its rule text and its URL. You can
> audit the whole chain from photo to fine."

*This is the line that replaces any "pgvector semantic retrieval" phrasing from
earlier drafts. We do not run pgvector, Supabase, or embeddings anywhere.*

## Beat 3 — risk tiers (1:15–1:50)

> "Three tiers, and the tiers are the honesty. **Tier 1**: a verified row
> matches, we apply it, you get the source. **Tier 2**: we're not confident our
> perception is right, so we stop and ask one clarifying question instead of
> bluffing a bin. **Tier 3**: coverage gap — no verified rule for this in this
> jurisdiction. No fine is asserted. General guidance only. A compliance tool
> that never admits uncertainty isn't a compliance tool."

*Screen: walk the three gallery cases IN-01 (Tier 1), NY-02 (Tier 2 clarify),
IN-03 (Tier 3).*

## Beat 4 — one scan, three laws (1:50–2:20)

> "One perception, three jurisdictions. The same empty paint can is a
> recyclable in New York under DSNY guidance — dry, empty, metal — but the same
> can half-full of wet paint is household hazardous waste, and in India it's
> the special-care stream. The perception runs once; only the law changes."

*Screen: toggle India → NYC → England on one verdict. Show the cache count stays at
one perception.*

## Beat 5 — numbers (2:20–2:50)

> "And the part you should trust least, so we say it plainly: our
> `accuracy_adjudicated` of 1.0000 is *not* real-world accuracy. It's
> self-consistency — matrix against corpus, given hand-labeled inputs. It
> proves the law table has no bugs. End-to-end live accuracy is the
> `accuracy_raw_vlm` number, which we will show you the moment the free-tier
> budget lets us compute it honestly — we don't estimate, we print SKIPPED.
> Every decision, across 27 benchmark items and three jurisdictions, is 100%
> traceable to its source URL and its effective date. A judge should ask for
> exactly that."

## Beat 6 — close (2:50–3:00)

> "Perception proposes. The law decides. And the law, here, shows its work."

---

## Script kit / props

- Phone or laptop on https://wastelens-global.vercel.app/ (Mode A).
- Offline fallback ready: Mode B + Sample gallery need zero network.
- If live perception is quota-blocked (free-tier daily limit), say:
  "the free tier is rate-limiting today — same path, proven with a real key,
  shown honestly as SKIPPED in the metrics rather than invented."

## Review checklist

- [ ] The "deterministic, not embeddings" line confirmed against README.
- [ ] No sentence implies Supabase, pgvector, or generator-class-aware exemptions.
- [ ] `accuracy_adjudicated` always labelled "given hand-labeled inputs".
- [ ] Tier quotes exact (gallery case IDs above match `data/sample_gallery.json`).