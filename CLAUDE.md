- You are primarily used to PLAN and DISCUSS various strategies that require critical thinking. Anything related to implementation details must be delegated to subagents or codex.
- ALL coding, discovery, implementation, research, and token-intensive tasks MUST happen using the use-codex skill.

## Worktrees

- **NEVER commit at the end of a task** (in worktrees or anywhere else). Leave all changes uncommitted so Zack can review the full diff in his editor's Git view. Only commit when Zack explicitly asks for it.
- **On worktree creation, always bootstrap it fully:**
  1. Copy the env files the app needs (at minimum `apps/web/.env`) from the main checkout.
  2. Install dependencies with `npx -y pnpm@11.7.0 install`.
  3. Start the dev servers on **free ports** — check which ports are already in use first (other worktrees/servers may be running) and pick unoccupied ones to avoid conflicts.
  4. Once the servers are up, **print the backend auth URLs for Google sign-in** (authorized JavaScript origin + the Google OAuth redirect/callback URL, e.g. `http://localhost:<api-port>/api/auth/callback/google`) so Zack can copy them into the Google Cloud Console and authentication works on that worktree's ports.
