// The Reports page behind login: retention beside the activation funnel, then sign-ups by channel beside the platforms.
// The /app/reports route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	platformPeopleQueryOptions,
	retentionQueryOptions,
	signUpsByChannelQueryOptions,
} from "../api/reports.queries";
import { FunnelCard } from "./funnel-card";
import { PlatformCard } from "./platform-card";
import { RetentionCard } from "./retention-card";
import { SignUpsByChannelCard } from "./sign-ups-by-channel-card";

/** Three columns from the 4xl container width: a wide report takes two, its side report one. The rows share their height. */
const REPORT_GRID = "grid grid-cols-1 gap-6 @4xl/main:grid-cols-3";
const WIDE_REPORT = "grid grid-cols-1 @4xl/main:col-span-2";

/** Four reports. Each one has its own title, so the page needs no period control of its own. */
export function ReportsPage() {
	const { t } = useT();
	const { data: cohorts } = useSuspenseQuery(retentionQueryOptions());
	const { data: weeks } = useSuspenseQuery(signUpsByChannelQueryOptions());
	const { data: platforms } = useSuspenseQuery(platformPeopleQueryOptions());

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("reports.title")}
				description={t("reports.description")}
			/>
			<div className={REPORT_GRID}>
				<div className={WIDE_REPORT}>
					<RetentionCard cohorts={cohorts} />
				</div>
				<FunnelCard />
				<div className={WIDE_REPORT}>
					<SignUpsByChannelCard weeks={weeks} />
				</div>
				<PlatformCard platforms={platforms} />
			</div>
		</div>
	);
}

/** Placeholder while the Reports loader runs. The route sets it as pendingComponent. */
export function ReportsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className={REPORT_GRID}>
				<Skeleton className="@4xl/main:col-span-2 h-112" />
				<Skeleton className="h-112" />
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	);
}

/** Error state of the Reports page when the loader fails. Try again runs the loader again. */
export function ReportsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("reports.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
