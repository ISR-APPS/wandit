// The practitioners page behind login: one card per practitioner, then two breakdowns of the visits of 30 days.
// The /app/practitioners route renders it after its loader. The route also uses the skeleton and the error below.
// Both breakdowns count the same visits, so their totals are equal.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, useNow } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	practitionersQueryOptions,
	visitsByTypeQueryOptions,
} from "../api/practitioners.queries";
import { PractitionerCard } from "./practitioner-card";
import { RankedBars } from "./ranked-bars";

/** The cards keep the order of the rooms. The breakdowns rank by count. */
export function PractitionersPage() {
	const { t, locale } = useT();
	const now = useNow();
	const { data: practitioners } = useSuspenseQuery(practitionersQueryOptions());
	const { data: visitsByType } = useSuspenseQuery(visitsByTypeQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const onDutyCount = practitioners.filter(
		(practitioner) => practitioner.shiftToday !== null,
	).length;
	const periodTotal = practitioners.reduce(
		(sum, practitioner) => sum + practitioner.periodVisits,
		0,
	);
	const periodDescription = fillMessage(t("practitioners.periodTotal"), {
		count: number.format(periodTotal),
	});

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("practitioners.title")}
				description={fillMessage(t("practitioners.description"), {
					count: number.format(practitioners.length),
					onDuty: number.format(onDutyCount),
				})}
			/>
			<div className="grid @5xl/main:grid-cols-3 @xl/main:grid-cols-2 grid-cols-1 gap-4">
				{practitioners.map((practitioner) => (
					<PractitionerCard
						key={practitioner.id}
						practitioner={practitioner}
						now={now}
					/>
				))}
			</div>
			<div className="grid @3xl/main:grid-cols-2 grid-cols-1 gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{t("practitioners.byPractitioner")}</CardTitle>
						<CardDescription className="tabular-nums">
							{periodDescription}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<RankedBars
							slices={[...practitioners]
								.sort(
									(first, second) => second.periodVisits - first.periodVisits,
								)
								.map((practitioner) => ({
									label: practitioner.fullName,
									value: practitioner.periodVisits,
								}))}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("practitioners.byVisitType")}</CardTitle>
						<CardDescription className="tabular-nums">
							{periodDescription}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{visitsByType.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								{t("chart.empty")}
							</p>
						) : (
							<RankedBars
								slices={visitsByType.map((slice) => ({
									label: t(`visitTypes.${slice.label}`),
									value: slice.value,
								}))}
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because they never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the loader runs: the header, the six cards, and the two breakdowns. */
export function PractitionersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-64" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 @xl/main:grid-cols-2 grid-cols-1 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-72" />
				))}
			</div>
			<div className="grid @3xl/main:grid-cols-2 grid-cols-1 gap-4">
				<Skeleton className="h-72" />
				<Skeleton className="h-72" />
			</div>
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function PractitionersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("practitioners.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
