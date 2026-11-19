// The page of one file, in the shape of the kit profile page: a title row, tabs, then a 1/3 start column
// (profile card, folder share, labels) and a 2/3 end column (latest activity, then versions beside "People with access").
// The /app/files/$fileId route renders it after its loader. An unknown id, or a file in the trash, shows a not-found block.
import { ArrowLeftIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { copyToClipboard, fileUrl } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { fileQueryOptions } from "../api/files.queries";
import { FileLabelsCard } from "./file-labels-card";
import { FileProfileCard } from "./file-profile-card";
import { FileTimeline } from "./file-timeline";
import { FolderShareCard } from "./folder-share-card";
import { SharedWithCard } from "./shared-with-card";
import { VersionTableCard } from "./version-table-card";

/** The tabs of the page. Each tab shows real content of the file. */
const DETAIL_TABS = ["overview", "versions", "activity"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

// The Overview tab shows the three newest events and the six newest versions, as the kit cards do.
const LATEST_EVENTS = 3;
const OVERVIEW_VERSIONS = 6;

type FileDetailPageProps = {
	/** The `$fileId` param of the URL. An unknown id shows the not-found block. */
	fileId: string;
};

/** The page holds the tab. "Copy link" puts the URL of this page on the clipboard. */
export function FileDetailPage({ fileId }: FileDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(fileQueryOptions(fileId));
	const [tab, setTab] = useState<DetailTab>("overview");

	if (!detail) {
		return (
			<div className="grid justify-items-start gap-4">
				<PageHeader title={t("files.title")} />
				<p className="text-muted-foreground text-sm">
					{t("files.fileNotFound")}
				</p>
				<Button asChild variant="outline">
					<Link to="/app/files">{t("files.backToAll")}</Link>
				</Button>
			</div>
		);
	}

	const { file, folder } = detail;
	// The versions button belongs only under an upload event. A share event has no new version to open.
	const newestAction = detail.activity[0]?.action;
	const isNewestUpload =
		newestAction === "uploaded" || newestAction === "updated";

	return (
		<div className="grid gap-4">
			<PageHeader
				title={file.name}
				actions={
					<>
						<Button variant="outline" size="icon" asChild>
							<Link
								to="/app/files"
								search={{ folder: folder?.id }}
								aria-label={`${t("files.backTo")} ${folder?.name ?? t("files.allFiles")}`}
							>
								<ArrowLeftIcon className="rtl:rotate-180" />
							</Link>
						</Button>
						<Button
							type="button"
							onClick={() =>
								copyToClipboard(fileUrl(file.id), {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<LinkSimpleIcon />
							{t("files.copyLink")}
						</Button>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(DETAIL_TABS.find((option) => option === value) ?? "overview")
				}
			>
				<TabsList>
					{DETAIL_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{t(`files.tabs.${option}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{tab === "versions" ? (
				<VersionTableCard versions={detail.versions} isDescribed />
			) : tab === "activity" ? (
				<Card>
					<CardHeader>
						<CardTitle>{t("files.tabs.activity")}</CardTitle>
					</CardHeader>
					<CardContent className="ps-8">
						<FileTimeline activity={detail.activity} />
					</CardContent>
				</Card>
			) : (
				<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
					<div className="grid min-w-0 gap-4">
						<FileProfileCard file={file} shareViews={detail.shareViews} />
						<FolderShareCard
							fileBytes={file.sizeBytes}
							folderBytes={detail.folderBytes}
						/>
						<FileLabelsCard file={file} folder={folder} />
					</div>
					<div className="@4xl/main:col-span-2 grid min-w-0 gap-4">
						<Card>
							<CardHeader>
								<CardTitle>{t("files.latestActivity")}</CardTitle>
								<CardAction>
									<button
										type="button"
										onClick={() => setTab("activity")}
										className="text-muted-foreground text-sm hover:text-primary hover:underline"
									>
										{t("overview.viewAll")}
									</button>
								</CardAction>
							</CardHeader>
							<CardContent className="ps-8">
								<FileTimeline
									activity={detail.activity.slice(0, LATEST_EVENTS)}
									latestAction={
										isNewestUpload ? (
											<Button
												type="button"
												variant="outline"
												onClick={() => setTab("versions")}
											>
												{t("files.openVersions")}
											</Button>
										) : null
									}
								/>
							</CardContent>
						</Card>
						<div className="grid @4xl/main:grid-cols-2 items-start gap-4">
							<VersionTableCard
								versions={detail.versions}
								limit={OVERVIEW_VERSIONS}
							/>
							<SharedWithCard shares={detail.shares} editors={detail.editors} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function FileDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-64" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-96 rounded-(--surface-radius)" />
					<Skeleton className="h-28 rounded-(--surface-radius)" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-96 rounded-(--surface-radius)" />
					<Skeleton className="h-72 rounded-(--surface-radius)" />
				</div>
			</div>
		</div>
	);
}
