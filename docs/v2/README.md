# docs/v2

Planning material for the V2 app builder (Lovable-style web and mobile apps).

- `V2-ARCHITECTURE-REPORT.md` - the summary report: how V1 works, the technologies, the research per component, the recommended architecture, the phase plan, the decisions, and the open spikes. Start here.
- `wandit-v2-report.html` - the same report as a styled HTML page. The published copy is the Claude artifact: https://claude.ai/code/artifact/2213aacb-6c87-444c-b80a-7a952959e292
- `research/` - the 22 detailed files that the report summarizes: 9 inspections of V1, 10 web research topics, 3 architecture proposals, and 3 policy files (Anthropic, OpenAI, verification). Each file cites file paths or URLs and marks UNVERIFIED claims.
- `DECISIONS.md` - the decision log: the founder decisions and the open product questions, in ADR style, with a status per entry. Rule for agents: read this file before any issue. Follow the default, or the final choice when the status is confirmed or changed. Do not build on an open answer.
- `LINEAR-ISSUES.md` - the index of the 61 Linear issues (WANDIT-148 to WANDIT-208) per phase with priority, effort, and blockers, plus the open points from the cross-issue review. Project: https://linear.app/scalemindapps/project/wandit-v2-app-builder-87ef3ccaf3bf (team ISR-WANDIT). Overview issue: WANDIT-147.
- Pinned harness versions (2026-09-14): `@ai-sdk/harness` 1.0.109, `@ai-sdk/harness-claude-code` 1.0.113, `@ai-sdk/sandbox-vercel` 1.0.109, `@vercel/sandbox` 3.3.0, `ai` 7.0.99.

Status: research and planning only. No product code changed. Written on 2026-09-03 on branch `feat/v2-builder`, issues created on 2026-09-06.
