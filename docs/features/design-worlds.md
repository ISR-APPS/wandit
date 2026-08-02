# Design Worlds — the taste library

## Why

Generated sites converge when the model receives loose ingredients — a
palette, a font pair, a few motion words — but must invent the composition.
Unspecified composition falls back to the same polished landing-page
defaults. A design world fixes that by supplying one deep, authored visual
system whose philosophy, page physics, type, components, motion and bans agree
with one another.

The library is written once with care and delivered whole. It replaces neither
the user's facts nor the Brain's content brief: those remain cargo. It supplies
the visual laws that make the result belong to a recognizable family without
turning every build into the same template.

## What

A design world lives in
`apps/server/src/modules/ai-chat/agent/worlds/`. Every world declares a `kind`:

- `website` is for multi-purpose business sites; `both` can also enter the
  legacy product-dossier pool.
- `product` is a single-product **dossier**: an object presented for study,
  story or desire. The ten dossier worlds are `bazar`, `cargo`, `cocon`,
  `forge`, `heritage`, `laboratoire`, `nid`, `sillage`, `verger` and
  `vitrine`.
- `cod` is a single-product cash-on-delivery **funnel**: a pitch answered on a
  phone, with one corridor from hook to embedded order form. Its separate
  46-world library lives under `worlds/cod/`.

Those last two genres are deliberately different. A product dossier may ask
the visitor to admire an object; a COD funnel must keep convincing, restating
the offer and making the order action reachable. The old dossier world `souk`
was therefore renamed `bazar`. The COD library owns the `souk` id and keeps its
cross-world fusion references intact.

The original website and dossier worlds describe their visual physics in the
established deep-document form. A COD world uses a stricter authoring genre:

- Its document has 13 sections: philosophy, variation contract, measured
  signatures, color physics, typography, signature art and components, spine,
  block treatments, hero menu, form menu, motion identity, ban list and example
  variations.
- It records literal palette hexes, font names and radii so its skin is exact.
  The shared COD genre layer bridges those values into the builder's canonical
  page tokens; literals become `:root` token values, never scattered raw CSS.
- Its BLOCKS TREATMENT speaks the permanent 30-id vocabulary from
  `worlds/cod/blocks.ts`, and its refused blocks are law. The shared genre layer
  supplies funnel behavior once, while each world supplies the distinctive
  dress.

See [COD Worlds](./cod-worlds.md) for the funnel contract and complete runtime
flow.

## How it flows

1. Website art direction remains model-authored: the 2026-07-27 experiment is
   still off for websites, and the Brain does not pass a world id for them.
   The legacy single-`worldId` assembly path remains supported.
2. In COD mode, after collecting the product and offer facts, the Brain asks
   one optional funnel-block question and requests a fresh COD world menu. The
   server samples eight candidates from the 46-world pool, limits obvious
   industry matches and preserves compatible fusion choices.
3. The Brain commits to one **base** world and two or three **donors**, menu
   choices only. It passes their ids base-first to `generate_page`, together
   with `pageKind: "cod"`.
4. The queue tool snapshots one builder prompt in this order: base builder
   prompt, shared COD genre law, fusion contract, base world document, then the
   donor documents. Unknown ids are warned about and dropped; a COD build with
   no resolved worlds still receives the genre law.
5. The base owns palette registers, type stacks, spine, refused blocks and
   motion identity. Each donor contributes at most one or two compatible
   signatures, redressed in the base skin. Conflicts resolve to the base, while
   refused blocks accumulate across every supplied world. The target is one new
   coherent pressing, never a collage or a copy of one example variation.

The builder still receives the user's brief as content authority. World and
genre documents govern presentation and funnel craft; they cannot invent
prices, reviews, stock, deadlines or delivery claims.

## Authoring a new world

For a website or dossier world, copy `monographe.ts` as the format exemplar.
Describe a complete system, give every executable value a reason, keep
backticks and `${` out of the document template literal, end with an intensity
clause, and register the world in `worlds/index.ts`.

For a COD world, copy an existing file under `worlds/cod/` and preserve the
13-section contract. Use literal skin values, declare `family`, `fusesWith`
and the five-field `preview`, dress only ids from `COD_BLOCKS`, and state
refused blocks explicitly. Register it in `worlds/cod/index.ts`; the COD barrel
is merged into the global registry.

## Deliberately not here (yet)

- Persisted cooldown or memory of worlds served to a vertical. Sampling is
  fresh and server-side, but it has no cross-request history.
- Generic brief validation and observability (`analyzeBrief`).
- Re-enabling the world chooser for website builds.
