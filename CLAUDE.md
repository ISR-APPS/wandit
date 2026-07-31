## Worktrees

- **Create new worktrees under `.claude/worktrees/<name>` inside the repo, never as sibling directories** (no more `../ISR-AI-<name>`). Existing sibling worktrees stay where they are until their branches land.
- **NEVER commit at the end of a task** (in worktrees or anywhere else). Leave all changes uncommitted so Zack can review the full diff in his editor's Git view. Only commit when Zack explicitly asks for it.
- **On worktree creation, always bootstrap it fully:**
  1. Copy the env files the app needs (at minimum `apps/web/.env`) from the main checkout.
  2. Install dependencies with `npx -y pnpm@11.7.0 install`.
  3. Start the dev servers on **free ports** — check which ports are already in use first (other worktrees/servers may be running) and pick unoccupied ones to avoid conflicts.
  4. Once the servers are up, **print the backend auth URLs for Google sign-in** (authorized JavaScript origin + the Google OAuth redirect/callback URL, e.g. `http://localhost:<api-port>/api/auth/callback/google`) so Zack can copy them into the Google Cloud Console and authentication works on that worktree's ports.

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
- **Research, exploration, and codebase reading** (investigation, code-base Q&A, data analysis):
  `gpt-5.6-luna` at `high` effort:
  `codex exec -s read-only -m gpt-5.6-luna -c model_reasoning_effort="high" "<prompt>"`
- Only deviate from this routing when Zack explicitly names a different model or effort.

### Using GPT models inside workflows and subagents

The Agent/Workflow `model` parameter only takes Claude models, so use a wrapper:

- Spawn a thin Claude wrapper agent with `model: 'sonnet', effort: 'low'` whose prompt instructs it
  to write a self-contained codex prompt, run `codex exec` via Bash with the model/effort flags from
  the routing above, and return the result verbatim.
