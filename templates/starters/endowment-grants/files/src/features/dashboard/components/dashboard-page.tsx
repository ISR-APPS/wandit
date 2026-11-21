// Shows a grant cycle, proposal decisions, and an awards ledger.
// The /app route renders it with sample funding records.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";

const filters = [
	"All applications",
	"In review",
	"Recommended",
	"Awarded",
] as const;
const applications = [
	{
		id: "GR-026",
		organization: "Willow Creek Conservancy",
		project: "Floodplain restoration",
		amount: "$38,500",
		stage: "Recommended",
	},
	{
		id: "GR-031",
		organization: "Blue Heron Literacy Center",
		project: "Weekend reading rooms",
		amount: "$24,700",
		stage: "In review",
	},
	{
		id: "GR-034",
		organization: "Foundry Arts Network",
		project: "Open studio evenings",
		amount: "$17,800",
		stage: "Awarded",
	},
	{
		id: "GR-041",
		organization: "West Harbor Food Circle",
		project: "Neighborhood pantry routes",
		amount: "$31,400",
		stage: "In review",
	},
	{
		id: "GR-045",
		organization: "Mile 9 Community Garden",
		project: "Youth seed library",
		amount: "$9,250",
		stage: "Recommended",
	},
];

/** Keeps the applications filter independent of the awarded proposals ledger. */
export function DashboardPage() {
	const { t } = useT();
	const [filter, setFilter] =
		useState<(typeof filters)[number]>("All applications");
	const shown = applications.filter(
		(application) =>
			filter === "All applications" || application.stage === filter,
	);
	return (
		<div className="mx-auto max-w-6xl">
			<div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6 sm:pb-8">
				<div>
					<span className="font-numeric text-muted-foreground text-sm">
						{t("dashboard.cycle08Autumn2026")}
					</span>
					<h1 className="mt-4 font-display text-4xl leading-none sm:text-6xl">
						{t("dashboard.communityFunding")}
					</h1>
					<p className="mt-3 max-w-lg text-muted-foreground">
						{t(
							"dashboard.anOpenCallForProgramsThatImprovePublicSpacesAndServices",
						)}
					</p>
				</div>
				<div className="border-s ps-4">
					<span className="block text-muted-foreground text-sm">
						{t("dashboard.reviewClose")}
					</span>
					<strong className="mt-1 block font-numeric text-xl">28 Oct</strong>
				</div>
			</div>
			<dl className="grid gap-4 border-b py-6 sm:grid-cols-3 sm:gap-8">
				<div>
					<dt className="text-muted-foreground text-sm">
						{t("dashboard.cycleBudget")}
					</dt>
					<dd className="mt-2 font-numeric text-4xl">$580,000</dd>
				</div>
				<div>
					<dt className="text-muted-foreground text-sm">
						{t("dashboard.allocated")}
					</dt>
					<dd className="mt-2 font-numeric text-4xl text-primary">$217,400</dd>
				</div>
				<div>
					<dt className="text-muted-foreground text-sm">
						{t("dashboard.applicationsReceived")}
					</dt>
					<dd className="mt-2 font-numeric text-4xl">46</dd>
				</div>
			</dl>
			<section
				id="applications"
				className="scroll-mt-16 py-6"
				aria-labelledby="applications-title"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 id="applications-title" className="font-display text-2xl">
							{t("dashboard.applications")}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("dashboard.recentSubmissionsFromTheCurrentCycle")}
						</p>
					</div>
					<div className="flex flex-wrap gap-1">
						{filters.map((choice) => (
							<Button
								key={choice}
								type="button"
								size="sm"
								variant={filter === choice ? "default" : "outline"}
								aria-pressed={filter === choice}
								onClick={() => setFilter(choice)}
							>
								{choice}
							</Button>
						))}
					</div>
				</div>
				<ul className="mt-5 divide-y border-y">
					{shown.map((application) => (
						<li
							key={application.id}
							className="grid grid-cols-[1fr_auto] items-center gap-2 py-3 sm:grid-cols-[5rem_1fr_6rem_7rem_1rem] sm:gap-4"
						>
							<span className="font-numeric text-muted-foreground text-sm">
								{application.id}
							</span>
							<span className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
								<strong className="block font-semibold text-sm">
									{application.organization}
								</strong>
								<span className="text-muted-foreground text-xs">
									{application.project}
								</span>
							</span>
							<strong className="font-numeric font-semibold text-sm">
								{application.amount}
							</strong>
							<Badge variant="outline" className="w-fit">
								{application.stage}
							</Badge>
							<ArrowUpRightIcon
								aria-hidden="true"
								className="hidden text-muted-foreground sm:block"
							/>
						</li>
					))}
				</ul>
			</section>
			<section
				id="awards"
				className="scroll-mt-16 rounded-xl border bg-muted p-5"
				aria-labelledby="awards-title"
			>
				<h2 id="awards-title" className="font-display text-2xl">
					{t("dashboard.awardsLedger")}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("dashboard.approvedProposalsInThisRegister")}
				</p>
				<ul className="mt-4 divide-y">
					{applications
						.filter((application) => application.stage === "Awarded")
						.map((application) => (
							<li
								key={application.id}
								className="flex flex-wrap items-center justify-between gap-2 py-2"
							>
								<span>{application.organization}</span>
								<span className="font-numeric">{application.amount}</span>
							</li>
						))}
				</ul>
			</section>
		</div>
	);
}
