// The page of one file: its summary, its version history, who it is shared with, its timeline, and its folder.
// The /app/files/$fileId route renders it after its loader. The route also uses the skeleton below.
// An unknown id, or a file in the trash, shows a not-found block with a link back to the files.
import { LinkSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { formatBytes } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { fileQueryOptions } from "../api/files.queries";
import { FileHistoryCard } from "./file-history-card";
import { FileSharingCard } from "./file-sharing-card";
import { FileSummaryCard } from "./file-summary-card";
import { FolderNeighborsCard } from "./folder-neighbors-card";
import { VersionHistoryCard } from "./version-history-card";

type FileDetailPageProps = {
	/** The `$fileId` param of the URL. An unknown id shows the not-found block. */
	fileId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function FileDetailPage({ fileId }: FileDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(fileQueryOptions(fileId));

	if (!detail) {
		return (
			<div className="grid gap-4">
				<BackLink folderId={undefined} label={t("files.allFiles")} />
				<p className="text-muted-foreground text-sm">
					{t("files.fileNotFound")}
				</p>
			</div>
		);
	}

	const { file, folder } = detail;
	const liveShares = detail.shares.filter(
		(share) => share.status !== "expired",
	).length;

	return (
		<div className="grid gap-6">
			<BackLink
				folderId={folder?.id}
				label={folder?.name ?? t("files.allFiles")}
			/>
			<PageHeader
				title={file.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						{liveShares > 0 ? (
							<Badge variant="info">
								<LinkSimpleIcon />
								{t("files.shared")}
							</Badge>
						) : (
							<Badge variant="secondary">{t("files.teamOnly")}</Badge>
						)}
						<span>
							{`${t(`fileKinds.${file.kind}`)} · ${formatBytes(file.sizeBytes, locale)}`}
						</span>
					</span>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid min-w-0 gap-6">
					<FileSummaryCard file={file} />
					<VersionHistoryCard versions={detail.versions} />
					{detail.neighbors.length > 0 ? (
						<FolderNeighborsCard neighbors={detail.neighbors} folder={folder} />
					) : null}
				</div>
				<div className="grid min-w-0 gap-6">
					<FileSharingCard shares={detail.shares} />
					<FileHistoryCard activity={detail.activity} />
				</div>
			</div>
		</div>
	);
}

type BackLinkProps = {
	/** The folder to open, or undefined for the top of the workspace. */
	folderId: string | undefined;
	/** The folder name, already translated for the top. */
	label: string;
};

// The way back to the folder of the file, with the folder name.
function BackLink({ folderId, label }: BackLinkProps) {
	return (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-sm:h-11"
		>
			<Link to="/app/files" search={{ folder: folderId }}>
				<CaretLeftIcon className="rtl:rotate-180" />
				<span dir="auto">{label}</span>
			</Link>
		</Button>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function FileDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-5 w-48" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-60" />
					<Skeleton className="h-64" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-48" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}
