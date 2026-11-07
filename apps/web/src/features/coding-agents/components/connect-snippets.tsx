/**
 * The connect steps of a coding agent: the server URL, then one tab per coding agent.
 * coding-agents-page.tsx and project-connect-steps.tsx render it. It reads the API origin from getServerUrl.
 * The snippets hold no secret: each agent runs the OAuth sign-in itself.
 */
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { mcpRoutes } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { toast } from "sonner";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { getServerUrl } from "@/lib/server-url";

/** One step of a guide: a sentence, then an optional file path and an optional text to copy. */
type GuideStep = {
	textKey: TranslationKey;
	/** Path of the config file that the step edits, shown after the sentence. */
	file?: string;
	/** A command or a config block, shown with a copy button. */
	code?: string;
};

/** The connect guide of one coding agent. `name` is a brand name, so it is never translated. */
type AgentGuide = { id: string; name: string; steps: GuideStep[] };

/** The guides per agent. The server name `wandit` is the same in every guide, so the login commands match. */
function agentGuides(mcpUrl: string): AgentGuide[] {
	return [
		{
			id: "claude-code",
			name: "Claude Code",
			steps: [
				{
					textKey: "auth.codingAgents.connect.runInTerminal",
					code: `claude mcp add --transport http wandit ${mcpUrl}`,
				},
				{ textKey: "auth.codingAgents.connect.runInClaudeCode", code: "/mcp" },
			],
		},
		{
			id: "codex",
			name: "Codex CLI",
			steps: [
				{
					textKey: "auth.codingAgents.connect.addToFile",
					file: "~/.codex/config.toml",
					// A JSON string is also a valid TOML basic string for a URL.
					code: `[mcp_servers.wandit]\nurl = ${JSON.stringify(mcpUrl)}`,
				},
				{
					textKey: "auth.codingAgents.connect.runToSignIn",
					code: "codex mcp login wandit",
				},
			],
		},
		{
			id: "cursor",
			name: "Cursor",
			steps: [
				{
					textKey: "auth.codingAgents.connect.addToFile",
					file: "~/.cursor/mcp.json",
					code: JSON.stringify(
						{ mcpServers: { wandit: { url: mcpUrl } } },
						null,
						2,
					),
				},
				{ textKey: "auth.codingAgents.connect.connectInCursor" },
			],
		},
		{
			id: "vscode",
			name: "VS Code",
			steps: [
				{
					textKey: "auth.codingAgents.connect.addToProjectFile",
					file: ".vscode/mcp.json",
					code: JSON.stringify(
						{ servers: { wandit: { type: "http", url: mcpUrl } } },
						null,
						2,
					),
				},
				{ textKey: "auth.codingAgents.connect.startInVsCode" },
			],
		},
	];
}

/** The server URL with a copy button, then the guide of each agent in tabs. */
export function ConnectSnippets() {
	const { t } = useTranslation();
	// `<VITE_SERVER_URL>/api/mcp`: the MCP endpoint and the OAuth resource of the API.
	// The API origin serves MCP, never the web origin: vercel.json sends /api/* of every web deploy to production.
	const mcpUrl = new URL(mcpRoutes.endpoint, getServerUrl()).toString();
	const guides = agentGuides(mcpUrl);
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="font-grotesk font-semibold text-base">
					{t("auth.codingAgents.connect.title")}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("auth.codingAgents.connect.description")}
				</p>
			</div>
			<div>
				<p className="font-medium text-sm">
					{t("auth.codingAgents.serverUrl")}
				</p>
				<CopyableCode code={mcpUrl} />
			</div>
			<Tabs defaultValue={guides[0]?.id}>
				{/* Four brand names can be wider than a phone screen, so the list scrolls. */}
				<TabsList className="max-w-full justify-start overflow-x-auto">
					{guides.map((guide) => (
						<TabsTrigger key={guide.id} value={guide.id}>
							{guide.name}
						</TabsTrigger>
					))}
				</TabsList>
				{guides.map((guide) => (
					<TabsContent key={guide.id} value={guide.id} className="mt-3">
						<ol className="flex flex-col gap-4">
							{guide.steps.map((step) => (
								<li key={step.textKey} className="text-sm">
									<p>
										{t(step.textKey)}{" "}
										{step.file ? (
											<code
												dir="ltr"
												className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
											>
												{step.file}
											</code>
										) : null}
									</p>
									{step.code ? <CopyableCode code={step.code} /> : null}
								</li>
							))}
						</ol>
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}

/** A code block with a copy button. A failed copy shows an error toast. The MCP panel of a project shows the project id in it. */
export function CopyableCode({ code }: { code: string }) {
	const { t } = useTranslation();
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			toast.success(t("auth.codingAgents.copied"));
		} catch (error) {
			// The browser refuses the clipboard outside a secure origin or a user gesture.
			console.error("Copy to the clipboard failed", error);
			toast.error(t("auth.codingAgents.copyFailed"));
		}
	};
	return (
		// Commands and config read left to right in every locale, so the copy button stays on the right.
		<div dir="ltr" className="relative mt-2 rounded-xl bg-muted">
			<pre className="overflow-x-auto py-3 ps-3 pe-12 font-mono text-xs leading-relaxed">
				<code>{code}</code>
			</pre>
			<Button
				variant="ghost"
				size="icon-sm"
				className="absolute end-1.5 top-1.5"
				aria-label={t("auth.codingAgents.copy")}
				title={t("auth.codingAgents.copy")}
				onClick={() => void copy()}
			>
				<CopyIcon aria-hidden weight="bold" />
			</Button>
		</div>
	);
}
