---
name: slop-review
description: Review a diff against the "Code rules" in CLAUDE.md, in both directions. Direction one is slop, code that is too much, over-engineered, or typed with fake evidence. Direction two is cut corners, code that is too little, with a skipped edge case, validation, error path, security check, test, or comment. Use after Codex, a subagent, or a workflow returns code, before a PR, or when the user says "slop review", "review for slop", "is this over-engineered", "did codex cut corners", or "check the comments". Lists findings only. Does not apply fixes unless the user asks.
---

# Slop review

Review the diff against the section "Code rules" in `CLAUDE.md`. One line per finding. The best outcome is a diff that gets shorter and stays complete.

## Scope

- Default: the uncommitted diff (`git diff` plus `git diff --cached` plus untracked files under `apps/` and `packages/`).
- With an argument: that path, that branch range (`dev...HEAD`), or that PR number.
- Read the code the diff touches, not only the diff. A cut corner is often visible only in a caller.

## Tags

Slop (too much):

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` a hand-rolled thing the standard library or the platform has. Name the function or feature.
- `yagni:` an abstraction with one implementation, a config nobody sets, a layer with one caller, a new dependency for a few lines.
- `dup:` a helper, type, or pattern that already exists in the repo. Name the file.
- `shrink:` the same logic in fewer lines, only when the shorter form is also easier to read for a junior developer. Show the shorter form. Not a `shrink:`: a nested ternary, a `reduce` that builds an object, a regex for three clear lines, an inline literal for a named constant.
- `type:` typing slop. `any`. `unknown`, `object`, or `{}` in a signature, a type alias, a read property, or an index signature, outside the three exceptions (a zod parse input, a caught error, an error `cause`). `x as unknown as Y`. An `as` or a non-null `!` without a `SAFETY` fact above it (`as const` and `satisfies` need none). `Record<string, unknown>` for data the code reads. `typeof` on a parameter that already has a type. `@ts-ignore`. A new `vi.mock`, `vi.doMock`, `vi.hoisted`, or `vi.spyOn` on a repo module. A `z.unknown()` or `z.any()` field for data the code reads.

Cut corners (too little):

- `corner:` a skipped edge case, a removed validation, a swallowed error, an empty `catch`, a dropped security check, a lock or idempotency key missing where money, credits, or a queue is involved, a `TODO` instead of the work.
- `test:` non-trivial logic with no check that fails if it breaks, or a test made trivial.
- `comment:` a new or edited file without a header (specs, barrels, and generated files need none), an added or changed export without a comment that gives one fact the name does not show, a product-rule branch, lock, retry, cache, security check, unit conversion, bare number, or library workaround without a "why" line, a comment that is now wrong, a comment that restates the code, a comment that is not Simplified Technical English.
- `limit:` a deliberate simplification without a `LIMIT:` mark, a `LIMIT:` mark without an upgrade path, or a `LIMIT:` mark that hides a missing check (that one is a `corner:`).

## Format

`<file>:L<line>: <tag> <what>. <replacement or fix>.`

Examples:

- `apps/server/src/modules/x/x.service.ts:L12-38: stdlib: 27-line email check. Use the zod email schema from packages/contracts, 1 line.`
- `apps/web/src/features/y/lib/z.ts:L4: dup: slugify exists in packages/shared/src/slug.ts. Import it.`
- `apps/server/src/modules/x/x.service.ts:L52: corner: catch logs and continues after a failed credit debit. Rethrow, or return a typed failure. The turn must not end as paid.`
- `apps/server/src/modules/x/x.repository.ts:L1: comment: no file header. Add what it does, who calls it, what it calls.`
- `packages/contracts/src/v2/turn.ts:L9: type: body as unknown as TurnInput. Parse with turnInputSchema.parse(body).`

Order: `corner:` and `test:` first, then `type:`, then the slop tags, then `comment:` and `limit:`.

## End line

`net: -<N> code lines possible, <M> corners, <K> comment gaps.` Comment lines never count in N.

Nothing to report: `Lean and complete. Ship.`

## Boundaries

- Lists findings. Does not change code unless the user asks after the list.
- Performance and product decisions are out of scope unless they are a `corner:`.
- The one small test or assertion that guards the logic is the minimum, never a `delete:`.
- Report in ASD-STE100 Simplified Technical English.
