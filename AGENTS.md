# Agent instructions (Codex and other AGENTS.md readers)

Read `CLAUDE.md` in this folder and follow it. It is the single source of the rules for this repo. The section "Code rules" applies to you in full. The block below is a copy of its "Contract for delegated code". Keep the two copies identical.

```
Code contract (repo ISR-AI). Follow all nine points.
1. Make the smallest change that is fully correct. No new abstraction, dependency, config, layer, or file unless the task needs it now. Search the repo and reuse what exists. Reuse across features goes through the feature index.ts barrel, or the code moves to a shared folder, or you copy it. Never a deep import from another feature. An existing line that breaks these rules is not a pattern to copy. Put code where the layout docs say: apps/server/src/modules/README.md, docs/frontend-structure.md.
2. Never cut: validation at a trust boundary (zod with named fields, from packages/contracts), error handling (no empty catch), security checks, a lock or an idempotency key where money, credits, or a queue is involved, and the proof that the change works (point 6). "Skipped" may hold only work outside the task. If you cannot complete one of these items, stop and ask.
3. Types: no any; no unknown, object, or {} in a signature, a type alias, a read property, or an index signature, except a zod parse input, a caught error, and an error cause; no "x as unknown as Y"; a "// SAFETY: <fact>" comment above every "as" and every non-null "!", except "as const" and "satisfies"; no Record<string, unknown> for data you read; no @ts-ignore; no new vi.mock, vi.doMock, vi.hoisted, or vi.spyOn on a repo module.
4. Comments in Simplified Technical English (sentences of at most 20 words, present tense, active voice): a 2 to 5 line header on every new file and on every edited file that has none (what it does, who calls it, what it calls; not on specs, barrels, generated files); 1 to 3 lines on every export you add or change, with one fact the name does not show; one line on every prop, parameter field, and type field a reader cannot understand from the file alone (what it is, its unit or shape, where it comes from); one "why" line above a product-rule branch, a lock, a retry, a cache, a security check, a unit conversion, a bare number, or a library workaround. Never restate the code. Update a comment when you change its code.
5. Mark an accepted ceiling on scale or precision in the code: "// LIMIT: <ceiling>. Upgrade: <path>." Never use it for a missing check.
6. Tests: prove every change that a user or an API caller can see with an end-to-end check of the real flow on the local stack (dev sign-in, Playwright MCP or curl, real Postgres and Redis). Write the steps and what you saw, so that Zack can repeat them. Write a unit spec case only for risky logic: money, security, a parser of untrusted input, a regex, a date, a state rule, or a bug fix (the case must fail on the old code). Never write a case that copies a constant, only checks that a mock got its input, tests a fake or a library, or repeats another case. Run only the specs of the modules you touched, not the full suite.
7. Run and paste the last line of each: "npx biome check --error-on-warnings <files>"; "npx -y pnpm@11.7.0 -F <package> check-types"; "npx -y pnpm@11.7.0 -F <package> test -- <spec of each touched module>". A warning is a failure. Do not run biome --write on the whole repo.
8. Do not commit. Leave the diff for review.
9. Report four lists, one line per item: Files; Traced (entry point and callers grepped); Skipped (with reasons, or none); Checked (each command with its last output line, then the E2E steps with what you saw). No essay.
```

Report in ASD-STE100 Simplified Technical English.

## Dev sign-in

- A local API (`NODE_ENV=development`, `BETTER_AUTH_URL` on localhost) accepts email and password sign-in. Sign-up stays off.
- The API seeds one account at boot: `dev@wandit.test`, password `wandit-dev-password`. The account is verified and onboarded. It gets the signup credit grant only when `product_settings.signup_grant_enabled` is true. When it has no active personal plan, the seed also gives it a yearly Business plan with 250 plan credits, once per plan row, so a new V2 project gets a backend.
- When you test the web app in a browser, open the auth modal and click "Dev sign-in". The form already holds these values. Do not use Google sign-in.
