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

### Using GPT models inside workflows and subagents

The Agent/Workflow `model` parameter only takes Claude models, so use a wrapper:

- Spawn a thin Claude wrapper agent with `model: 'sonnet', effort: 'low'` whose prompt instructs it
  to write a self-contained codex prompt, run `codex exec` via Bash with the model/effort flags from
  the routing above, and return the result verbatim.
