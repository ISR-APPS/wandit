// Shows review coverage and sample access exceptions.
// The /app route renders it for the current sample audit cycle.
import { ShieldCheckIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Progress } from "~/shared/ui/progress";

const severityOptions = ["All severities", "High", "Medium", "Low"] as const;
const sources = [
	{
		name: "Okta Workforce",
		scope: "Employees",
		completion: 98,
		volume: "249 / 254",
	},
	{
		name: "AWS Identity Center",
		scope: "Cloud accounts",
		completion: 86,
		volume: "42 / 49",
	},
	{
		name: "GitHub Enterprise",
		scope: "Code and deploys",
		completion: 91,
		volume: "82 / 90",
	},
];
const exceptions = [
	{
		id: "AX-447",
		title: "Inactive contractor can deploy",
		source: "GitHub Enterprise",
		principal: "mina.patel.ext",
		severity: "High",
	},
	{
		id: "AX-468",
		title: "Build service assumes administrator role",
		source: "AWS Identity Center",
		principal: "svc-release-runner",
		severity: "High",
	},
	{
		id: "AX-479",
		title: "Group membership has no reviewer",
		source: "Okta Workforce",
		principal: "analytics-external",
		severity: "Medium",
	},
	{
		id: "AX-494",
		title: "Temporary viewer access has expired",
		source: "GitHub Enterprise",
		principal: "t.varela",
		severity: "Low",
	},
];

/** Filters sample results by severity and keeps the source coverage totals visible. */
export function DashboardPage() {
	const { t } = useT();
	const [severity, setSeverity] =
		useState<(typeof severityOptions)[number]>("All severities");
	const visible = exceptions.filter(
		(exception) =>
			severity === "All severities" || exception.severity === severity,
	);
	return (
		<div className="mx-auto grid max-w-7xl gap-5">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p className="font-mono text-primary text-xs">
						{t("dashboard.quarterlyCertificationProduction")}
					</p>
					<h1 className="mt-2 font-display font-semibold text-4xl tracking-tight">
						{t("dashboard.accessReview")}
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{t("dashboard.reviewIdentitiesSourceCoverageAndPolicyExceptions")}
					</p>
				</div>
				<Badge variant="outline" className="gap-2 font-mono">
					<ShieldCheckIcon />
					{t("dashboard.cycleInProgress")}
				</Badge>
			</div>
			<dl className="grid gap-px overflow-hidden border bg-border sm:grid-cols-3">
				<div className="bg-card p-4">
					<dt className="font-mono text-muted-foreground text-xs">
						{t("dashboard.identitiesInScope")}
					</dt>
					<dd className="mt-1 font-mono text-3xl">393</dd>
				</div>
				<div className="bg-card p-4">
					<dt className="font-mono text-muted-foreground text-xs">
						{t("dashboard.certificationsComplete")}
					</dt>
					<dd className="mt-1 font-mono text-3xl text-primary">373</dd>
				</div>
				<div className="bg-card p-4">
					<dt className="font-mono text-muted-foreground text-xs">
						{t("dashboard.openExceptions")}
					</dt>
					<dd className="mt-1 font-mono text-3xl">4</dd>
				</div>
			</dl>
			<section
				id="sources"
				className="scroll-mt-32 border bg-card"
				aria-labelledby="source-title"
			>
				<div className="border-b px-4 py-3">
					<h2 id="source-title" className="font-semibold">
						{t("dashboard.coverageByIdentitySource")}
					</h2>
				</div>
				<ul className="divide-y">
					{sources.map((source) => (
						<li
							key={source.name}
							className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 sm:grid-cols-[12rem_1fr_5rem] sm:gap-5"
						>
							<div>
								<strong className="block text-sm">{source.name}</strong>
								<span className="text-muted-foreground text-xs">
									{source.scope}
								</span>
							</div>
							<Progress
								value={source.completion}
								aria-label={source.name}
								className="col-span-2 h-1.5 sm:col-span-1 sm:row-auto"
							/>
							<span className="col-start-2 row-start-1 text-end font-mono text-muted-foreground text-xs sm:col-start-auto sm:row-start-auto">
								{source.volume}
							</span>
						</li>
					))}
				</ul>
			</section>
			<section
				id="exceptions"
				className="scroll-mt-32 border bg-card"
				aria-labelledby="exception-title"
			>
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
					<h2
						id="exception-title"
						className="flex items-center gap-2 font-semibold"
					>
						<WarningOctagonIcon className="text-primary" />
						{t("dashboard.exceptions")}
					</h2>
					<div className="flex flex-wrap gap-1">
						{severityOptions.map((choice) => (
							<Button
								type="button"
								variant={severity === choice ? "secondary" : "ghost"}
								size="sm"
								key={choice}
								aria-pressed={severity === choice}
								onClick={() => setSeverity(choice)}
							>
								{choice}
							</Button>
						))}
					</div>
				</div>
				<ul className="divide-y">
					{visible.map((exception) => (
						<li
							key={exception.id}
							className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 sm:grid-cols-[5rem_1fr_10rem_5rem] sm:gap-4"
						>
							<span className="font-mono text-primary text-xs">
								{exception.id}
							</span>
							<span className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
								<strong className="block font-medium text-sm">
									{exception.title}
								</strong>
								<span className="font-mono text-muted-foreground text-xs">
									{exception.principal}
								</span>
							</span>
							<span className="hidden text-muted-foreground text-xs sm:block">
								{exception.source}
							</span>
							<Badge
								variant={exception.severity === "High" ? "default" : "outline"}
								className="w-fit"
							>
								{exception.severity}
							</Badge>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
