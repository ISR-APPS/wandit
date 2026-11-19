// The home behind login, in the band order of the kit file manager page:
// four type cards, then three quick folders beside the storage card, then the transfer bars beside the newest uploads.
// The /app route renders it after its loader, and uses the skeleton and the error below.
import { FolderOpenIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewQueryOptions } from "../api/overview.queries";
import { CategoryCard } from "./category-card";
import { FolderCard } from "./folder-card";
import { RecentUploadsCard } from "./recent-uploads-card";
import { StorageCard } from "./storage-card";
import { TransferCard } from "./transfer-card";

// The grid of each band. Container queries follow the page column, not the window.
const TYPE_BAND = "grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4";
const FOLDER_BAND = "grid gap-4 @4xl/main:grid-cols-3";
const FOLDER_CARDS = "grid gap-4 @xl/main:grid-cols-3 @4xl/main:col-span-2";
const CHART_BAND = "grid gap-4 @4xl/main:grid-cols-2";

/** The home. The transfer card holds its own grouping; the other cards read one query. */
export function OverviewPage() {
	const { t } = useT();
	const { data } = useSuspenseQuery(overviewQueryOptions());
	const now = Date.now();

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				actions={
					<Button asChild>
						<Link to="/app/files" aria-label={t("overview.browseFiles")}>
							<FolderOpenIcon />
							<span className="hidden lg:inline">
								{t("overview.browseFiles")}
							</span>
						</Link>
					</Button>
				}
			/>
			<div className={TYPE_BAND}>
				{data.categories.map((usage) => (
					<CategoryCard
						key={usage.category}
						usage={usage}
						liveBytes={data.liveBytes}
					/>
				))}
			</div>
			<div className={FOLDER_BAND}>
				<div className={FOLDER_CARDS}>
					{data.folders.map((folder) => (
						<FolderCard key={folder.id} folder={folder} now={now} />
					))}
				</div>
				<StorageCard usedBytes={data.usedBytes} planBytes={data.planBytes} />
			</div>
			<div className={CHART_BAND}>
				<TransferCard />
				<RecentUploadsCard uploads={data.recentUploads} />
			</div>
		</div>
	);
}

// Fixed keys for the placeholder cards, because they never reorder.
const FOUR = ["1", "2", "3", "4"];
const THREE = ["1", "2", "3"];

/** Placeholder while the home loader runs, with the bands and spans of the page. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-36" />
			</div>
			<div className={TYPE_BAND}>
				{FOUR.map((key) => (
					<Skeleton
						key={key}
						className="h-56 w-full rounded-(--surface-radius)"
					/>
				))}
			</div>
			<div className={FOLDER_BAND}>
				<div className={FOLDER_CARDS}>
					{THREE.map((key) => (
						<Skeleton
							key={key}
							className="h-44 w-full rounded-(--surface-radius)"
						/>
					))}
				</div>
				<Skeleton className="h-44 w-full rounded-(--surface-radius)" />
			</div>
			<div className={CHART_BAND}>
				{["chart", "table"].map((key) => (
					<Card key={key}>
						<CardHeader>
							<Skeleton className="h-5 w-40" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-72 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

/** Error state of the home when its loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("overview.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
