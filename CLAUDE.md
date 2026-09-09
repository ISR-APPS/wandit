Only report to me in ASD-STE100 Simplified Technical English

## Worktrees

- **Create new worktrees under `.claude/worktrees/<name>` inside the repo, never as sibling directories** (no more `../ISR-AI-<name>`). Existing sibling worktrees stay where they are until their branches land.
- **NEVER commit at the end of a task** (in worktrees or anywhere else). Leave all changes uncommitted so Zack can review the full diff in his editor's Git view. Only commit when Zack explicitly asks for it.
- **On worktree creation, always bootstrap it fully:**
  1. Copy the env files the app needs (at minimum `apps/web/.env`) from the main checkout.
  2. Install dependencies with `npx -y pnpm@11.7.0 install`.
  3. Start the dev servers on **free ports** — check which ports are already in use first (other worktrees/servers may be running) and pick unoccupied ones to avoid conflicts.
  4. **Run the dev servers inside ONE tmux session named after the worktree** — NOT as plain background processes with log files. tmux gives the process a real terminal, so turbo renders its normal interactive TUI (the web / native / server task list with arrow-key switching) even though Claude started it detached. Zack attaches and gets the exact same experience as running `pnpm run dev` himself.
     - If a session with that name already exists, kill it first: `tmux kill-session -t <name>`.
     - Launch: `tmux new-session -d -s <name> -c <repo-root>/.claude/worktrees/<name> '<PORT env vars> npx -y pnpm@11.7.0 run dev'` — use the root dev script that fits the task (`dev`, `dev:pipeline`, or a `-F` filtered variant), with the free ports from step 3.
  5. **Print one command for Zack:** `tmux attach -t <name>`. Tell him: arrow keys switch between the tasks (normal turbo TUI), and `Ctrl-b` then `d` detaches while the servers keep running. Do not print `tail -f` commands anymore.
  6. When Claude needs to read server output itself, capture the pane instead of tailing files: `tmux capture-pane -p -e -t <name> -S -300`.
  7. Also **print the backend auth URLs for Google sign-in** (authorized JavaScript origin + the Google OAuth redirect/callback URL, e.g. `http://localhost:<api-port>/api/auth/callback/google`) so Zack can copy them into the Google Cloud Console and authentication works on that worktree's ports.

## Codex / GPT models

- Mechanics: GPT models are only reachable through the Codex CLI — `codex exec` / `codex review`
  (my `~/.codex/config.toml` defaults to `gpt-5.6-sol` at `ultra` reasoning effort). Use the
  codex-implementation, codex-review, and codex-computer-use skills; for work they don't cover
  (investigation, data analysis), run `codex exec -s read-only` directly with a self-contained prompt.
- Claude models (sonnet-5, opus-4.8, fable-5) run via the Agent/Workflow `model` parameter.

### GPT model routing (always follow — workflows, agents, and direct CLI alike)

- **Implementation** (writing or editing code, fixes, refactors, features):
  `gpt-5.6-sol` at `ultra` effort. This matches the config default, so plain `codex exec` works;
  to be explicit: `codex exec -m gpt-5.6-sol -c model_reasoning_effort="ultra" "<prompt>"`
- **Batch inspection probes** (the pre-implementation codebase investigation for a feature batch):
  `gpt-5.6-sol` at `high` effort — NOT Claude agents, NOT luna:
  `codex exec -s read-only -m gpt-5.6-sol -c model_reasoning_effort="high" "<prompt>"`
- **Other research and exploration** (standalone code-base Q&A, data analysis):
  `gpt-5.6-luna` at `high` effort:
  `codex exec -s read-only -m gpt-5.6-luna -c model_reasoning_effort="high" "<prompt>"`
- Only deviate from this routing when Zack explicitly names a different model or effort.
- Every codex prompt that writes or reviews code carries the block "Contract for delegated code" from the section "Code rules" below. Check the returned diff against it.

### Using GPT models inside workflows and subagents

The Agent/Workflow `model` parameter only takes Claude models, so use a wrapper:

- Spawn a thin Claude wrapper agent with `model: 'sonnet', effort: 'low'` whose prompt instructs it
  to write a self-contained codex prompt, run `codex exec` via Bash with the model/effort flags from
  the routing above, and return the result verbatim.

## Code rules

These rules apply to every agent that writes, changes, or reviews code in this repo: Claude in this session, subagents from the Agent tool, workflow agents, and Codex through `codex exec`. They apply to every line you add or change. Do not rewrite lines the task does not touch. An existing line that breaks a rule is not a pattern to copy.

When you write a prompt for another agent, paste the block "Contract for delegated code" (below) into it. This includes review prompts: `codex review`, `/code-review`, and a workflow verify agent. A reviewer without the rules asks for wrappers, options, and abstractions. When the work comes back, check the diff against the same block before you accept it. The parent agent owns the result. "Codex did it" is not a reason.

### Who reads the code

Zack reads every diff in his editor. He is a full-stack developer and not a native English speaker. He runs many agent sessions at the same time, so he cannot keep a large call tree in his head. Write each file for a junior developer who joined today. That reader must understand the file in one read. That reader must not open five other files to do it.

### The sweet spot: small code that is still complete

Two failures are common. Do not do either.

1. **Slop, too much code.** An abstraction nobody asked for. A wrapper that only delegates. A config value that never changes. A helper the standard library already has. A new dependency for ten lines. A retry around a local call. A file for each layer before the layer has code. Comments that repeat the code. Essays in chat.
2. **Cut corners, too little code.** An edge case skipped. An error caught and ignored. A validation removed. A test deleted or made trivial. A type widened to `unknown` or `any` so that the compiler stops. A security check dropped. A `TODO` instead of the work. A short diff that satisfies the reviewer and breaks in production.

The target is the smallest change that is fully correct. Small means fewer lines, fewer files, fewer concepts. Complete means every input the code can receive is handled, every error goes somewhere on purpose, and the change has a check in the repo.

Before you write code, climb this ladder. Stop at the first step that holds.

1. Does this need to exist at all? If nobody asked for it and no current caller needs it, skip it and say so in one line. A requirement in Zack's task is never "nobody asked".
2. Does the repo already have it? Search first. A helper, a type, a hook, or a pattern a few files away wins over a new one. Re-implementing what exists here is the most common slop. An existing line that breaks these rules is not a pattern. Do not copy it. Reuse never crosses a feature boundary by a deep path. Another feature is used only through its `index.ts` barrel (`docs/frontend-structure.md`). If two features need the same code and it belongs to neither, move it to a shared folder. If the two uses can change in different directions, copy it. A twenty-line copy is cheaper than a wrong coupling.
3. Does the standard library or the platform do it? `Intl`, `URL`, `crypto`, `<input type="date">`, CSS, a database constraint. Use it.
4. Does an installed dependency do it? Use it. Do not add a dependency for what a few lines can do.
5. Can it be one function in an existing file of the right layer? Put it there. The layout docs decide where code lives: `apps/server/src/modules/README.md` for the API, `docs/frontend-structure.md` for the web app. The ladder decides how much code. A Drizzle query lives in a repository, not in a controller. A fetch call lives in `api/<entity>.services.ts`, not in a component. Do not create a layer, a folder, or a file until it has code.
6. Only then, write the minimum new code that works.

Understand before you climb. Read the code the change touches. Trace the real flow from the caller to the database. A bug report names a symptom. Grep every caller of the function you touch and fix the shared function once. A small patch in the wrong place is a second bug.

Never cut these to make the diff smaller:

- Validation at a trust boundary. A boundary function is a function whose input comes from HTTP, a webhook, a queue, a file, an LLM, a provider SDK, or a `catch`. Parse that input with a zod schema from `packages/contracts`, with named fields. `z.unknown()`, `z.any()`, and `z.record(z.string(), z.unknown())` are not validation for data the code reads. After the boundary, trust the types.
- Error handling that prevents data loss or a stuck state. Every `catch` recovers with a reason, or rethrows, or logs with context and returns a typed failure. An empty `catch` is forbidden.
- Security: auth guards, ownership checks, CORS, cookie flags, secrets, SQL only through Drizzle, no user content on a `wandit.dev` origin. See `docs/api-security.md`.
- A lock, and a key that makes a repeated write a no-op, where money, credits, or a queue is involved.
- The one check that fails if the logic breaks. A check is a `*.spec.ts` file next to the code, run by `vitest run`. A command you ran once in chat is not a check. When you change a function that has a spec, add one case to that spec. When you add a branch, add one case that enters that branch. Trivial means: no branch, no loop, no arithmetic, no date, no regex, no money, no security. Only trivial code needs no test.
- Anything Zack asked for explicitly. If he insists on the full version, build it. Do not argue a second time.

If you cannot complete one of these items, stop and ask Zack before you write code.

Two marks exist for things you leave out on purpose. Use them only as defined here.

- `// LIMIT: <ceiling>. Upgrade: <path>.` in the code. It names a ceiling on scale or precision that you accept today, for example one lock for all projects, or a loop inside a loop. It never names a missing check, a missing validation, or a missing test. Example: `// LIMIT: one global lock, about 50 turns per minute. Upgrade: one lock per project.`
- "Skipped" in the report. It holds only work outside the task: a nice-to-have, a refactor, a follow-up feature. An item from the "Never cut these" list can never appear under "Skipped". The parent rejects a diff whose "Skipped" list holds one.

### Types: fight typing slop

The types are the proof that the code is correct. Do not fake the proof.

- No `any`. Biome reports it as a warning only (`noExplicitAny`). Treat the warning as an error.
- No `unknown`, `object`, or `{}` as a parameter or return type. The same ban applies in a type alias, in a property of a type the code reads, and as the value of an index signature. Three inputs are the exception: the raw value before a zod parse, a caught error, and an error `cause`. A function that reads a caught error takes `error: unknown` and narrows it with one type guard.
- A generic parameter has a constraint. `T extends Record<string, unknown>` is fine as a constraint.
- No `typeof x === "string"` on a parameter that already has a type. If the parameter has a type, `typeof` on it is slop. Narrow at the boundary with zod, or branch on a union with a tag field, like `kind`. `typeof` is fine on a union a library gives you, like `string | Stripe.PaymentIntent`.
- Do not widen a known value to `unknown`, `object`, or `Record<string, unknown>` and then assert it back. Keep the inferred type. Use `satisfies` to check a shape without losing it.
- No chained assertions. `x as unknown as User` is forbidden. One `as`, or one non-null `!`, is allowed only with a comment on the line above: `// SAFETY: <the fact that makes this true>`. The fact names a line, a schema, or a rule. `// SAFETY: zod parsed this body above.` is a fact. `// SAFETY: safe cast.` is not.
- `as const` and `satisfies` never need a comment.
- No `Record<string, unknown>` or `Record<string, any>` for data the code reads. Name the value type. Use it only for JSON the code passes through without reading, like an audit blob or a metadata column.
- No `@ts-ignore` or `@ts-expect-error` to pass a type error. Fix the type. If a library type is wrong, wrap it in one small typed function with a `SAFETY` comment.
- No new module mock of a repo module in a test: `vi.mock`, `vi.doMock`, `vi.hoisted`, or `vi.spyOn` on an imported repo module. Pass the dependency in through one constructor parameter or one Nest provider, and give the test a fake through it. When you add a case to a spec that already uses `vi.mock`, reuse its mocks and add no new one. A mock of a third-party SDK or of the network is fine. If the seam needs changes outside the module you work in, stop and ask Zack.
- No "shape" in a type name (`UserShape`). Name the thing: `User`, `UserRow`, `UserInput`.

### Comments: write for the junior developer who joined today

Zack must understand each file without a tour. Comments do that work. Write them in ASD-STE100 Simplified Technical English: sentences of at most 20 words, present tense, active voice, one meaning per word, no idioms.

Add a comment for:

- **Every new file, at the top, two to five lines.** What this file does, who calls it, and what it calls. When you edit a file that has no header, add one in the same diff. Read enough of the file to make it true. No header on `*.spec.ts`, on an `index.ts` barrel, or on a generated file. Example:

  ```ts
  /**
   * Debits credits at the end of a builder turn.
   * Called by the Trigger.dev task `builder-turn` after the harness stops.
   * Writes to `agent_session` and `credit_ledger` through Drizzle.
   */
  ```

- **Every exported function, class, type, and constant that you add or change, one to three lines.** Give at least one fact that the name and the types do not show: what it is for, a unit, a limit, a caller, what happens on error, the reason for a value. `/** Lock TTL. */` on `LOCK_TTL_MS` is noise. `/** 30 s. Longer than the slowest builder turn seen in Sentry. */` is a comment. When you change an export that has no comment, add one.
- **One "why" line above each of these blocks:**
  - a branch that follows a product rule ("free users get one project")
  - a loop that stops on a condition that is not in the loop header
  - a lock, a retry, a cache, a security check
  - a unit conversion (centi-credits to credits)
  - a number that is not 0 or 1 and has no named constant
  - a workaround for a library bug

  Example: `// Stripe sends the same event twice. The row id makes the second write a no-op.`

- Every `LIMIT:` and `SAFETY:` mark.

Do not comment:

- What the code already says. `i++ // add one` is noise.
- The history of the change. Git has the history.
- Commented-out code. Delete it.

Keep comments true. When you change the code, change the comment in the same edit. A wrong comment is worse than no comment.

Names are the first comment. Name a function by what it does (`debitTurnCredits`), a boolean by the question it answers (`isSameBrowserSite`), a constant by its meaning and unit (`LOCK_TTL_MS`). Do not abbreviate, except units (`MS`, `SEC`) and names the repo already uses everywhere (`id`, `url`, `dto`, `ttl`).

### Checks and the report

Run these commands on every change and paste the last line of each output in the report. A warning is a failure. Never run `biome check --write .` on the whole repo.

```
npx biome check --error-on-warnings <files you touched>
npx -y pnpm@11.7.0 -F <package> check-types
npx -y pnpm@11.7.0 -F <package> test -- <the spec file of every module you touched>
```

The package names are `server`, `web`, `admin`, `edge`, `@wandit/contracts`, and `@wandit/db`.

The report has four lists, one line per item, in this order:

- Files: each path you changed.
- Traced: the entry point and the callers you grepped.
- Skipped: see the "Skipped" rule above, or "none".
- Checked: each command above with the last line of its output.

Add prose only when Zack asks a question. An explanation Zack asked for is not slop. An unrequested essay is. The Worktrees section adds the tmux command and the auth URLs when you created a worktree.

Run `/slop-review` on every diff with more than 30 changed lines or more than one file. Fix what it finds before you report.

### Contract for delegated code

Paste this block, unchanged, into every prompt that asks Codex, a subagent, or a workflow agent to write or review code. `AGENTS.md` at the repo root holds the same block for Codex. When you change the block, change it in both files in the same edit.

In a workflow, give every implementation agent one verify agent. The verify agent runs the `/slop-review` skill on the diff and returns its findings in that format. A `corner:` or `test:` finding blocks acceptance. The parent sends the diff back with the finding. Reject a review finding that asks for a new abstraction, wrapper, config value, or dependency, unless it names a current caller that needs it.

```
Code contract (repo ISR-AI). Follow all eight points.
1. Make the smallest change that is fully correct. No new abstraction, dependency, config, layer, or file unless the task needs it now. Search the repo and reuse what exists. Reuse across features goes through the feature index.ts barrel, or the code moves to a shared folder, or you copy it. Never a deep import from another feature. An existing line that breaks these rules is not a pattern to copy. Put code where the layout docs say: apps/server/src/modules/README.md, docs/frontend-structure.md.
2. Never cut: validation at a trust boundary (zod with named fields, from packages/contracts), error handling (no empty catch), security checks, a lock or an idempotency key where money, credits, or a queue is involved, and the spec case that fails if the logic breaks. "Skipped" may hold only work outside the task. If you cannot complete one of these items, stop and ask.
3. Types: no any; no unknown, object, or {} in a signature, a type alias, a read property, or an index signature, except a zod parse input, a caught error, and an error cause; no "x as unknown as Y"; a "// SAFETY: <fact>" comment above every "as" and every non-null "!", except "as const" and "satisfies"; no Record<string, unknown> for data you read; no @ts-ignore; no new vi.mock, vi.doMock, vi.hoisted, or vi.spyOn on a repo module.
4. Comments in Simplified Technical English (sentences of at most 20 words, present tense, active voice): a 2 to 5 line header on every new file and on every edited file that has none (what it does, who calls it, what it calls; not on specs, barrels, generated files); 1 to 3 lines on every export you add or change, with one fact the name does not show; one "why" line above a product-rule branch, a lock, a retry, a cache, a security check, a unit conversion, a bare number, or a library workaround. Never restate the code. Update a comment when you change its code.
5. Mark an accepted ceiling on scale or precision in the code: "// LIMIT: <ceiling>. Upgrade: <path>." Never use it for a missing check.
6. Run and paste the last line of each: "npx biome check --error-on-warnings <files>"; "npx -y pnpm@11.7.0 -F <package> check-types"; "npx -y pnpm@11.7.0 -F <package> test -- <spec of each touched module>". A warning is a failure. Do not run biome --write on the whole repo.
7. Do not commit. Leave the diff for review.
8. Report four lists, one line per item: Files; Traced (entry point and callers grepped); Skipped (with reasons, or none); Checked (each command with its last output line). No essay.
```

When the diff comes back, check before you accept it: the "Skipped" list against point 2, every `as`, `!`, and `unknown`, the header and export comments, and that the spec cases exist and pass. Then run `/slop-review`.
