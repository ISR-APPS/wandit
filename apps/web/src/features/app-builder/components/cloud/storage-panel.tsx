/**
 * Storage panel of the Backend group: the buckets of the app, then the files and
 * folders of one bucket, with folder navigation, download links, upload, and
 * delete. Rendered by cloud-panel-content.tsx inside backend-state.tsx, so the backend
 * is `active` here. Reads cloudBucketsQuery and cloudObjectsQuery; writes
 * through useUploadObject and useDeleteObjects.
 */

import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { FileIcon } from "@phosphor-icons/react/File";
import { FolderIcon } from "@phosphor-icons/react/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/FolderOpen";
import { HardDrivesIcon } from "@phosphor-icons/react/HardDrives";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/UploadSimple";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
	type CloudBucket,
	type CloudObject,
	cloudUploadUrlBodySchema,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { formatDate, type Locale, useTranslation } from "@/lib/i18n";
import { useDeleteObjects, useUploadObject } from "../../api/cloud.mutations";
import { cloudBucketsQuery, cloudObjectsQuery } from "../../api/cloud.queries";
import {
	CLOUD_DATE_TIME_FORMAT,
	CLOUD_EMPTY_CELL,
	CLOUD_UPLOAD_MAX_BYTES,
} from "../../lib/constants";
import {
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "../more/panel-shell";
import { IconAction } from "../shell/top-bar";
import { CloudLoadFailed } from "./backend-state";
import {
	CLOUD_CELL_MUTED_CLASS,
	CLOUD_TABLE_CLASS,
	RowsGridSkeleton,
} from "./rows-grid";

/**
 * Colors of the ghost icon buttons at the end of a file row: download and
 * delete. The kit Button `icon-sm` size gives the round 32 px shape.
 */
const ROW_ICON_BUTTON_CLASS =
	"text-night/55 hover:bg-night/[0.06] hover:text-night dark:text-foreground/55 dark:hover:bg-white/[0.08] dark:hover:text-foreground";

/** Props of StoragePanel. The panel mounts only while the backend is `active`. */
export type StoragePanelProps = {
	projectId: string;
	/** True while the More view is on screen. The queries of the panel wait for it. */
	isActive: boolean;
};

// Intl units from small to large; each one is 1024 of the one before, like the Supabase dashboard.
const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
const BYTES_PER_UNIT_STEP = 1024;

/** A size in bytes as short locale text, for example "1.5 MB" in English or "1,5 Mo" in French. */
export function formatBytes(bytes: number, locale: Locale): string {
	let value = bytes;
	let unit: (typeof BYTE_UNITS)[number] = "byte";
	for (const next of BYTE_UNITS.slice(1)) {
		if (value < BYTES_PER_UNIT_STEP) break;
		value /= BYTES_PER_UNIT_STEP;
		unit = next;
	}
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay: "short",
		maximumFractionDigits: 1,
	}).format(value);
}

// Storage sends its dates as text with no format guarantee. Text that is
// not a date shows as it is, because Intl throws on an invalid date.
function formatStorageDate(value: string | null, locale: Locale): string {
	if (value === null) return CLOUD_EMPTY_CELL;
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: formatDate(date, locale, CLOUD_DATE_TIME_FORMAT);
}

/** The bucket list, or the files of the open bucket. */
export function StoragePanel({ projectId, isActive }: StoragePanelProps) {
	const { t } = useTranslation();
	const buckets = useQuery(cloudBucketsQuery(projectId, isActive));
	// Id of the open bucket; null shows the bucket list.
	const [openBucketId, setOpenBucketId] = useState<string | null>(null);

	if (buckets.isPending) {
		return <RowsGridSkeleton />;
	}
	// A failed refetch keeps the last good list; only a failed first load has no data.
	if (buckets.data === undefined) {
		return <CloudLoadFailed projectId={projectId} />;
	}
	// A turn can delete the open bucket. It then leaves the list, and the list shows again.
	const openBucket = buckets.data.find((bucket) => bucket.id === openBucketId);
	if (openBucket) {
		return (
			<BucketFiles
				// A new bucket starts at its root folder.
				key={openBucket.id}
				projectId={projectId}
				bucket={openBucket}
				isActive={isActive}
				onBack={() => setOpenBucketId(null)}
			/>
		);
	}
	if (buckets.data.length === 0) {
		return (
			<PanelMessage
				icon={HardDrivesIcon}
				text={t("workspace.cloud.storage.buckets.empty")}
			/>
		);
	}
	return <BucketsList buckets={buckets.data} onOpen={setOpenBucketId} />;
}

/** The buckets with their access and last update. A click on a row opens the bucket. */
function BucketsList({
	buckets,
	onOpen,
}: {
	buckets: CloudBucket[];
	/** Called with the id of the clicked bucket. */
	onOpen: (bucketId: string) => void;
}) {
	const { t, locale } = useTranslation();

	return (
		<div className={CLOUD_TABLE_CLASS}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("workspace.cloud.storage.buckets.name")}</TableHead>
						<TableHead>{t("workspace.cloud.storage.buckets.access")}</TableHead>
						<TableHead>
							{t("workspace.cloud.storage.buckets.updated")}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{buckets.map((bucket) => (
						// The name button stretches over the row, so the whole row opens the bucket.
						<TableRow key={bucket.id} className="group/row relative">
							<TableCell>
								<span className="flex items-center gap-2.5">
									<span
										aria-hidden
										className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-spark/[0.16] text-spark-deep transition-colors group-hover/row:bg-spark/30 dark:bg-spark/15 dark:text-spark"
									>
										<FolderIcon weight="duotone" className="size-4" />
									</span>
									<button
										type="button"
										dir="ltr"
										onClick={() => onOpen(bucket.id)}
										className="cursor-pointer rounded-sm font-medium font-mono text-[13px] text-night outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-foreground"
									>
										{bucket.name}
									</button>
								</span>
							</TableCell>
							<TableCell>
								{/* A public bucket shows its files to anyone with the link, so it gets the warning tone. */}
								<PanelChip tone={bucket.public ? "warning" : "neutral"}>
									{bucket.public
										? t("workspace.cloud.storage.buckets.public")
										: t("workspace.cloud.storage.buckets.private")}
								</PanelChip>
							</TableCell>
							<TableCell className={CLOUD_CELL_MUTED_CLASS}>
								{formatStorageDate(bucket.updatedAt, locale)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

/** The files and folders of one folder of a bucket, with the path, upload, download, and delete. */
function BucketFiles({
	projectId,
	bucket,
	isActive,
	onBack,
}: {
	projectId: string;
	bucket: CloudBucket;
	isActive: boolean;
	onBack: () => void;
}) {
	const { t, locale } = useTranslation();
	// Folder path inside the bucket, without a leading or trailing slash; "" is the root.
	const [prefix, setPrefix] = useState("");
	// The file the delete dialog asks about; null while the dialog is closed.
	const [pendingDelete, setPendingDelete] = useState<CloudObject | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const objects = useInfiniteQuery(
		cloudObjectsQuery(projectId, bucket.id, prefix, isActive),
	);
	const upload = useUploadObject(projectId, bucket.id);
	const remove = useDeleteObjects(projectId, bucket.id);
	const segments = prefix === "" ? [] : prefix.split("/");

	function uploadFile(file: File) {
		// The browser sends the file straight to Storage, so the size check runs here, before the upload URL.
		if (file.size > CLOUD_UPLOAD_MAX_BYTES) {
			toast.error(
				t("workspace.cloud.storage.upload.tooLarge", {
					limit: formatBytes(CLOUD_UPLOAD_MAX_BYTES, locale),
				}),
			);
			return;
		}
		const path = prefix === "" ? file.name : `${prefix}/${file.name}`;
		// The API refuses a path with an empty or ".." segment, or a character that
		// Storage refuses, like Arabic letters. The check tells why without a request.
		if (!cloudUploadUrlBodySchema.safeParse({ path }).success) {
			toast.error(t("workspace.cloud.storage.upload.invalidName"));
			return;
		}
		upload.mutate(
			{ path, file },
			{
				onSuccess: () =>
					toast.success(
						t("workspace.cloud.storage.upload.done", { name: file.name }),
					),
			},
		);
	}

	function renderFiles() {
		if (objects.isPending) {
			return <RowsGridSkeleton />;
		}
		// A failed refetch keeps the loaded pages; only a failed first load has no data.
		if (objects.data === undefined) {
			return <CloudLoadFailed projectId={projectId} />;
		}
		const items = objects.data.pages.flatMap((page) => page.items);
		if (items.length === 0) {
			return (
				<PanelMessage
					icon={FolderOpenIcon}
					text={t("workspace.cloud.storage.objects.empty")}
				/>
			);
		}
		return (
			<div className="flex min-w-0 flex-col gap-3">
				<div className={CLOUD_TABLE_CLASS}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									{t("workspace.cloud.storage.objects.name")}
								</TableHead>
								<TableHead className="text-end">
									{t("workspace.cloud.storage.objects.size")}
								</TableHead>
								<TableHead>
									{t("workspace.cloud.storage.objects.updated")}
								</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.path}>
									<TableCell className="max-w-80">
										{item.isFolder ? (
											<button
												type="button"
												dir="ltr"
												onClick={() => setPrefix(item.path)}
												className="inline-flex cursor-pointer items-center gap-2 rounded-sm font-medium font-mono text-[13px] text-night outline-none hover:text-ember-text focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-foreground"
											>
												<FolderIcon
													aria-hidden
													weight="duotone"
													className="size-[18px] shrink-0 text-spark-deep dark:text-spark"
												/>
												<span className="truncate">{item.name}</span>
											</button>
										) : (
											<span
												dir="ltr"
												className="inline-flex items-center gap-2 font-mono text-[13px]"
											>
												<FileIcon
													aria-hidden
													weight="duotone"
													className="size-[18px] shrink-0 text-night/45 dark:text-foreground/45"
												/>
												<span className="truncate">{item.name}</span>
											</span>
										)}
									</TableCell>
									<TableCell className={cn("text-end", CLOUD_CELL_MUTED_CLASS)}>
										{item.sizeBytes === null
											? CLOUD_EMPTY_CELL
											: formatBytes(item.sizeBytes, locale)}
									</TableCell>
									<TableCell className={CLOUD_CELL_MUTED_CLASS}>
										{formatStorageDate(item.updatedAt, locale)}
									</TableCell>
									<TableCell>
										{/* A folder is only a path prefix in Storage: it has no URL and no row to delete. */}
										{item.isFolder ? null : (
											<div className="flex justify-end gap-1">
												{item.downloadUrl === null ? null : (
													<IconAction
														label={t(
															"workspace.cloud.storage.objects.download",
															{
																name: item.name,
															},
														)}
													>
														<Button
															variant="ghost"
															size="icon-sm"
															className={ROW_ICON_BUTTON_CLASS}
															asChild
														>
															<a
																href={item.downloadUrl}
																target="_blank"
																rel="noopener noreferrer"
															>
																<DownloadSimpleIcon aria-hidden weight="bold" />
															</a>
														</Button>
													</IconAction>
												)}
												<IconAction
													label={t("workspace.cloud.storage.objects.delete", {
														name: item.name,
													})}
												>
													<Button
														variant="ghost"
														size="icon-sm"
														className={cn(
															ROW_ICON_BUTTON_CLASS,
															"hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15 dark:hover:text-destructive",
														)}
														onClick={() => setPendingDelete(item)}
													>
														<TrashIcon aria-hidden weight="bold" />
													</Button>
												</IconAction>
											</div>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				{objects.hasNextPage ? (
					<div>
						<Button
							variant="outline"
							size="sm"
							className={PANEL_SECONDARY_BUTTON_CLASS}
							disabled={objects.isFetchingNextPage}
							onClick={() => void objects.fetchNextPage()}
						>
							{t("workspace.cloud.storage.objects.loadMore")}
						</Button>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex min-h-12 flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					className={PANEL_SECONDARY_BUTTON_CLASS}
					onClick={onBack}
				>
					{/* In RTL the list sits on the right, so the arrow mirrors. */}
					<ArrowLeftIcon
						aria-hidden
						weight="bold"
						className="rtl:-scale-x-100"
					/>
					{t("workspace.cloud.storage.buckets.back")}
				</Button>
				{/* A path reads left to right in every locale. The last segment is the open folder. */}
				<nav
					dir="ltr"
					aria-label={t("workspace.cloud.storage.objects.pathLabel")}
					className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-mono text-[13px] text-night/55 dark:text-foreground/55"
				>
					<button
						type="button"
						onClick={() => setPrefix("")}
						className={cn(
							"cursor-pointer rounded-sm px-1 outline-none hover:text-night focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:text-foreground",
							segments.length === 0 &&
								"font-semibold text-night dark:text-foreground",
						)}
					>
						{bucket.name}
					</button>
					{segments.map((segment, index) => (
						<span
							key={segments.slice(0, index + 1).join("/")}
							className="inline-flex items-center gap-1"
						>
							<span
								aria-hidden
								className="text-night/25 dark:text-foreground/25"
							>
								/
							</span>
							<button
								type="button"
								onClick={() =>
									setPrefix(segments.slice(0, index + 1).join("/"))
								}
								className={cn(
									"cursor-pointer rounded-sm px-1 outline-none hover:text-night focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:text-foreground",
									index === segments.length - 1 &&
										"font-semibold text-night dark:text-foreground",
								)}
							>
								{segment}
							</button>
						</span>
					))}
				</nav>
				<input
					ref={fileInput}
					type="file"
					className="hidden"
					onChange={(event) => {
						const file = event.target.files?.[0];
						// The same file can be picked again after a failed upload.
						event.target.value = "";
						if (file) uploadFile(file);
					}}
				/>
				<Button
					className={PANEL_PRIMARY_BUTTON_CLASS}
					disabled={upload.isPending}
					onClick={() => fileInput.current?.click()}
				>
					{upload.isPending ? (
						<CircleNotchIcon
							aria-hidden
							weight="bold"
							className="animate-spin"
						/>
					) : (
						<UploadSimpleIcon aria-hidden weight="bold" />
					)}
					{t("workspace.cloud.storage.upload.button")}
				</Button>
			</div>
			{renderFiles()}
			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("workspace.cloud.storage.deleteConfirm.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("workspace.cloud.storage.deleteConfirm.description", {
								name: pendingDelete?.name ?? "",
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("workspace.cloud.storage.deleteConfirm.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pendingDelete === null) return;
								const name = pendingDelete.name;
								remove.mutate([pendingDelete.path], {
									onSuccess: () =>
										toast.success(
											t("workspace.cloud.storage.deleteConfirm.done", {
												name,
											}),
										),
								});
							}}
						>
							{t("workspace.cloud.storage.deleteConfirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
