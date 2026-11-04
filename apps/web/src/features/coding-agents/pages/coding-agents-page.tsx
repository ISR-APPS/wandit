/**
 * The /coding-agents account page: the connect steps per coding agent and the connected agents with Revoke.
 * routes/_auth/coding-agents.tsx renders it, only when V2 is open. It renders inside DashboardShell.
 */
import { mcpRoutes } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { DashboardShell } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { getServerUrl } from "@/lib/server-url";
import { ConnectSnippets } from "../components/connect-snippets";
import { ConnectedAgents } from "../components/connected-agents";

// The white card of the dashboard pages, the same as on the billing page.
const CARD_CLASS =
	"rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

/** A grant belongs to the user, not to a workspace, so every workspace shows the same agents here. */
export default function CodingAgentsPage() {
	const { t } = useTranslation();
	// The API origin serves MCP, never the web origin: vercel.json sends /api/* of every web deploy to production.
	const mcpUrl = new URL(mcpRoutes.endpoint, getServerUrl()).toString();
	return (
		<DashboardShell titleKey="auth.codingAgents.title">
			<div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-6">
				<div className="mt-8">
					<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
						{t("auth.codingAgents.title")}
					</h2>
					<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
						{t("auth.codingAgents.description")}
					</p>
				</div>
				<section className={cn(CARD_CLASS, "mt-6 p-5 sm:p-6")}>
					<ConnectSnippets mcpUrl={mcpUrl} />
				</section>
				<section className={cn(CARD_CLASS, "mt-4 p-5 sm:p-6")}>
					<ConnectedAgents />
				</section>
			</div>
		</DashboardShell>
	);
}
