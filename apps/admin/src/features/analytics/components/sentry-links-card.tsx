import {
	ExternalLinkIcon,
	KeyRoundIcon,
	ServerCogIcon,
	ShieldAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const sentryProjectLinks = [
	{
		label: "API / MCP errors",
		description: "Server API and connector execution issues",
		href: "https://wandit.sentry.io/issues/?project=wandit-server&query=is%3Aunresolved&statsPeriod=7d",
		connectorHref:
			"https://wandit.sentry.io/issues/?project=wandit-server&query=is%3Aunresolved+connectorSlug%3A*&statsPeriod=7d",
	},
	{
		label: "Admin app",
		description: "Admin browser issues",
		href: "https://wandit.sentry.io/issues/?project=wandit-admin&query=is%3Aunresolved&statsPeriod=7d",
	},
	{
		label: "Web app",
		description: "Customer-facing browser issues",
		href: "https://wandit.sentry.io/issues/?project=wandit-web&query=is%3Aunresolved&statsPeriod=7d",
	},
	{
		label: "Edge",
		description: "Edge runtime issues",
		href: "https://wandit.sentry.io/issues/?project=wandit-edge&query=is%3Aunresolved&statsPeriod=7d",
	},
] as const;

function ExternalLinkLabel({ label }: { label: string }) {
	return (
		<>
			{label}
			<ExternalLinkIcon aria-hidden="true" className="size-3.5" />
			<span className="sr-only"> (opens in a new tab)</span>
		</>
	);
}

function SentryLinksCard() {
	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-2">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
									<ShieldAlertIcon aria-hidden="true" className="size-4" />
								</span>
								Sentry
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Unresolved production issues by runtime
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						Last 7 days
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<ul className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
					{sentryProjectLinks.map((project) => (
						<li key={project.label} className="border-r border-b px-5 py-5">
							<div className="flex items-start gap-3">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
									<ServerCogIcon aria-hidden="true" className="size-4" />
								</span>
								<div className="min-w-0">
									<a
										href={project.href}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1.5 font-medium text-sm underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
									>
										<ExternalLinkLabel label={project.label} />
									</a>
									<p className="mt-1 text-muted-foreground text-xs">
										{project.description}
									</p>
									{"connectorHref" in project ? (
										<a
											href={project.connectorHref}
											target="_blank"
											rel="noreferrer"
											className="mt-3 inline-flex items-center gap-1.5 text-muted-foreground text-xs underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
										>
											<ExternalLinkLabel label="MCP connector errors" />
										</a>
									) : null}
								</div>
							</div>
						</li>
					))}
				</ul>
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<KeyRoundIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Live error rates need a runtime Sentry API token. These are link-outs
					only for now.
				</p>
			</div>
		</Card>
	);
}

export { SentryLinksCard, sentryProjectLinks };
