import { DatabaseIcon, UserRoundSearchIcon } from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AnalyticsAcquisitionResponse } from "@/features/analytics/api/analytics.dto";
import {
	formatAcquisitionSource,
	formatNullableAnalyticsMetric,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewRoundedUsdMinor,
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type AcquisitionAnalyticsTablesProps = Pick<
	AnalyticsAcquisitionResponse,
	"campaigns" | "countries" | "sources"
> & {
	costCoverageComplete: boolean;
	hasActiveAttributionFilters: boolean;
};

type AcquisitionUnattributedTileProps = {
	signups: number;
};

const sourceClassificationTooltip =
	"Sources are classified in this order: affiliate, captured UTM source, organic search, external referral, then direct. Accounts created before tracking appear as Unknown.";

const signupTooltip =
	"People who created an account during the selected range.";

const paidTooltip =
	"Signups in this row that are linked to a paid subscription.";

const mrrTooltip =
	"Current list-price monthly recurring revenue from live subscriptions attributed to this source or campaign. This all-time snapshot is not limited to signups in the selected range. Annual plans are divided by 12.";

function NumericTableHeading({
	label,
	tooltip,
	className,
}: {
	label: string;
	tooltip: string;
	className?: string;
}) {
	return (
		<div className={`flex items-center justify-end gap-1 ${className ?? ""}`}>
			<span>{label}</span>
			<MetricInfoTooltip label={label} content={tooltip} />
		</div>
	);
}

function AcquisitionUnattributedTile({
	signups,
}: AcquisitionUnattributedTileProps) {
	return (
		<section
			aria-label="Acquisition headline metrics"
			className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
		>
			<Card className="gap-0 py-0 shadow-none">
				<CardContent className="flex items-start gap-3 px-5 py-5">
					<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
						<UserRoundSearchIcon className="size-4" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex min-h-4 items-center gap-1">
							<p className="text-muted-foreground text-xs leading-4">
								Unattributed signups
							</p>
							<MetricInfoTooltip
								label="Unattributed signups"
								content="Signups with no attribution record. Attribution tracking started 2026-08-15, so earlier users cannot be assigned a source."
							/>
						</div>
						<p className="mt-1.5 min-h-7 font-semibold text-xl tabular-nums tracking-tight">
							{formatOverviewWholeNumber(signups)}
						</p>
						<p className="mt-1.5 min-h-8 text-muted-foreground text-xs leading-4">
							Signed up before tracking
						</p>
					</div>
				</CardContent>
			</Card>
		</section>
	);
}

function AcquisitionSourcesTable({
	sources,
	costCoverageComplete,
	hasActiveAttributionFilters,
}: Pick<
	AcquisitionAnalyticsTablesProps,
	"costCoverageComplete" | "hasActiveAttributionFilters" | "sources"
>) {
	const cacTooltip = hasActiveAttributionFilters
		? "CAC is unavailable while source, country, or device filters are active because spend cannot be allocated to a filtered subset."
		: costCoverageComplete
			? "Ad spend attributed to this source divided by signup-cohort users who became paid. Sources with no paid users show an em dash."
			: "needs cost data for every month in range";

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Sources</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					Signup outcomes and current recurring revenue by last-touch source
				</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				<Table className="min-w-[940px] tabular-nums">
					<TableCaption className="sr-only">
						Signups, activation, paid conversion, monthly recurring revenue, and
						customer acquisition cost by acquisition source.
					</TableCaption>
					<TableHeader className="bg-muted/20">
						<TableRow className="hover:bg-transparent">
							<TableHead className="h-11 min-w-64 pl-6">
								<div className="flex items-center gap-1">
									<span>Source</span>
									<MetricInfoTooltip
										label="Source"
										content={sourceClassificationTooltip}
									/>
								</div>
							</TableHead>
							<TableHead className="h-11 min-w-28 text-right">
								<NumericTableHeading label="Signups" tooltip={signupTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-28 text-right">
								<NumericTableHeading
									label="Activated"
									tooltip="Signups with at least one successful generation. Work done by another organization member may not be attributed to the signing-up user."
								/>
							</TableHead>
							<TableHead className="h-11 min-w-24 text-right">
								<NumericTableHeading label="Paid" tooltip={paidTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-36 text-right">
								<NumericTableHeading
									label="Signup → paid"
									tooltip="Share of signups in this source row that are linked to a paid subscription."
								/>
							</TableHead>
							<TableHead className="h-11 min-w-28 text-right">
								<NumericTableHeading label="MRR" tooltip={mrrTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-28 pr-6 text-right">
								<NumericTableHeading label="CAC" tooltip={cacTooltip} />
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sources.length === 0 ? (
							<TableRow className="hover:bg-transparent">
								<TableCell
									colSpan={7}
									className="h-36 px-6 text-center text-muted-foreground"
								>
									Source attribution will appear after a tracked signup.
								</TableCell>
							</TableRow>
						) : (
							sources.map((source) => (
								<TableRow key={source.source}>
									<th
										scope="row"
										className="whitespace-nowrap p-2 pl-6 text-left align-middle font-medium"
									>
										{formatAcquisitionSource(source.source)}
									</th>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(source.signups)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(source.activated)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(source.paid)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewPercentValue(source.signupToPaidPct)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewRoundedUsdMinor(source.mrrCents)}
									</TableCell>
									<TableCell className="pr-6 text-right font-medium">
										{formatNullableAnalyticsMetric(
											source.cacCents,
											formatOverviewUsdMinor,
										)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<DatabaseIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Signup attribution started 2026-08-15. Earlier users appear as
					“Unknown — signed up before tracking”; their source cannot be
					backfilled.
				</p>
			</div>
		</Card>
	);
}

function AcquisitionCampaignsTable({
	campaigns,
}: Pick<AnalyticsAcquisitionResponse, "campaigns">) {
	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Campaigns</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					Captured UTM campaigns and the customers they brought in
				</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				<Table className="min-w-[720px] tabular-nums">
					<TableCaption className="sr-only">
						Signups, paid customers, and monthly recurring revenue by UTM
						campaign and source.
					</TableCaption>
					<TableHeader className="bg-muted/20">
						<TableRow className="hover:bg-transparent">
							<TableHead className="h-11 min-w-48 pl-6">Campaign</TableHead>
							<TableHead className="h-11 min-w-36">
								<div className="flex items-center gap-1">
									<span>Source</span>
									<MetricInfoTooltip
										label="Campaign source"
										content="The captured UTM source recorded with this campaign."
									/>
								</div>
							</TableHead>
							<TableHead className="h-11 min-w-24 text-right">
								<NumericTableHeading label="Signups" tooltip={signupTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-24 text-right">
								<NumericTableHeading label="Paid" tooltip={paidTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-28 pr-6 text-right">
								<NumericTableHeading label="MRR" tooltip={mrrTooltip} />
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{campaigns.length === 0 ? (
							<TableRow className="hover:bg-transparent">
								<TableCell
									colSpan={5}
									className="h-36 px-6 text-center text-muted-foreground"
								>
									Campaign attribution will appear after a signup arrives with a
									UTM campaign.
								</TableCell>
							</TableRow>
						) : (
							campaigns.map((campaign) => (
								<TableRow
									key={JSON.stringify([campaign.campaign, campaign.source])}
								>
									<th
										scope="row"
										className="whitespace-nowrap p-2 pl-6 text-left align-middle font-medium"
									>
										{campaign.campaign}
									</th>
									<TableCell>
										{campaign.source === "unknown"
											? "Source not captured"
											: formatAcquisitionSource(campaign.source)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(campaign.signups)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(campaign.paid)}
									</TableCell>
									<TableCell className="pr-6 text-right font-medium">
										{formatOverviewRoundedUsdMinor(campaign.mrrCents)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function AcquisitionCountriesTable({
	countries,
}: Pick<AnalyticsAcquisitionResponse, "countries">) {
	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Countries</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					Signup and paid customer mix by country
				</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				<Table className="min-w-[440px] tabular-nums">
					<TableCaption className="sr-only">
						Signups and paid customers by signup country.
					</TableCaption>
					<TableHeader className="bg-muted/20">
						<TableRow className="hover:bg-transparent">
							<TableHead className="h-11 min-w-44 pl-6">
								<div className="flex items-center gap-1">
									<span>Country</span>
									<MetricInfoTooltip
										label="Country"
										content="Country is recorded from infrastructure-provided request headers at signup and can be unavailable."
									/>
								</div>
							</TableHead>
							<TableHead className="h-11 min-w-24 text-right">
								<NumericTableHeading label="Signups" tooltip={signupTooltip} />
							</TableHead>
							<TableHead className="h-11 min-w-24 pr-6 text-right">
								<NumericTableHeading label="Paid" tooltip={paidTooltip} />
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{countries.length === 0 ? (
							<TableRow className="hover:bg-transparent">
								<TableCell
									colSpan={3}
									className="h-36 px-6 text-center text-muted-foreground"
								>
									Country data will appear when signup requests include a
									country header.
								</TableCell>
							</TableRow>
						) : (
							countries.map((country) => (
								<TableRow key={country.country}>
									<th
										scope="row"
										className="whitespace-nowrap p-2 pl-6 text-left align-middle font-medium"
									>
										{country.country}
									</th>
									<TableCell className="text-right font-medium">
										{formatOverviewWholeNumber(country.signups)}
									</TableCell>
									<TableCell className="pr-6 text-right font-medium">
										{formatOverviewWholeNumber(country.paid)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function AcquisitionAnalyticsTables({
	campaigns,
	countries,
	sources,
	costCoverageComplete,
	hasActiveAttributionFilters,
}: AcquisitionAnalyticsTablesProps) {
	return (
		<>
			<AcquisitionSourcesTable
				sources={sources}
				costCoverageComplete={costCoverageComplete}
				hasActiveAttributionFilters={hasActiveAttributionFilters}
			/>

			<section
				aria-label="Campaign and country acquisition breakdowns"
				className="grid items-stretch gap-5 lg:grid-cols-12"
			>
				<div className="min-w-0 lg:col-span-8">
					<AcquisitionCampaignsTable campaigns={campaigns} />
				</div>
				<div className="min-w-0 lg:col-span-4">
					<AcquisitionCountriesTable countries={countries} />
				</div>
			</section>
		</>
	);
}

export type {
	AcquisitionAnalyticsTablesProps,
	AcquisitionUnattributedTileProps,
};
export { AcquisitionAnalyticsTables, AcquisitionUnattributedTile };
