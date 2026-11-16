// The viewings page behind login: the agenda of the week, the viewings to confirm, the latest notes, and the past viewings.
// The /app/viewings route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { countLabel } from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { viewingsQueryOptions } from "../api/viewings.queries";
import { AgendaCard } from "./agenda-card";
import { FeedbackCard } from "./feedback-card";
import { PastViewingsCard } from "./past-viewings-card";
import { ToConfirmCard } from "./to-confirm-card";

/** The page splits the rows of one query: the viewings to come, and the viewings with an outcome. */
export function ViewingsPage() {
	const { t, locale } = useT();
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const now = Date.now();

	const upcoming = viewings.filter(
		(viewing) =>
			(viewing.status === "requested" || viewing.status === "confirmed") &&
			Date.parse(viewing.startsAt) > now,
	);
	const requested = upcoming.filter(
		(viewing) => viewing.status === "requested",
	);
	// The query gives oldest first. The tables and the notes show newest first.
	const past = viewings
		.filter(
			(viewing) =>
				viewing.status === "completed" ||
				viewing.status === "no_show" ||
				viewing.status === "cancelled",
		)
		.reverse();
	// One note for each viewing to confirm, from 2 to 4. The two cards side by side then have about the same height.
	const noteCount = Math.min(4, Math.max(2, requested.length));

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("viewings.title")}
				description={[
					countLabel(
						upcoming.length,
						t("viewings.upcomingOne"),
						t("viewings.upcomingOther"),
						locale,
					),
					countLabel(
						requested.length,
						t("viewings.requestedOne"),
						t("viewings.requestedOther"),
						locale,
					),
				].join(" · ")}
			/>
			<AgendaCard viewings={viewings} />
			{/* The two cards stretch to the same height side by side. The short list of viewings to confirm gets the narrow column. */}
			<div className="grid @4xl/main:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] grid-cols-1 gap-6">
				<ToConfirmCard requestedViewings={requested} />
				<FeedbackCard
					completedViewings={past.filter(
						(viewing) => viewing.status === "completed",
					)}
					now={now}
					noteCount={noteCount}
				/>
			</div>
			<PastViewingsCard pastViewings={past} />
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ViewingsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Skeleton className="h-96 w-full" />
			<div className="grid @4xl/main:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] grid-cols-1 gap-6">
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
			<Skeleton className="h-96 w-full" />
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function ViewingsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("viewings.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
