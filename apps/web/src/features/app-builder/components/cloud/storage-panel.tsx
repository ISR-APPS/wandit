/**
 * Storage panel of the Cloud tab: the buckets of the app, then the files and
 * folders of one bucket, with folder navigation, download links, upload, and
 * delete. Rendered by cloud-tab.tsx inside backend-state.tsx, so the backend
 * is `active` here. Reads cloudBucketsQuery and cloudObjectsQuery; writes
 * through useUploadObject and useDeleteObjects.
 */

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
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import {
	ArrowLeft,
	Download,
	FileIcon,
	Folder,
	FolderOpen,
	HardDrive,
	LoaderCircle,
	Trash2,
	Upload,
} from "lucide-react";
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
import { CodeMessage } from "../code/code-viewer";
import { CloudLoadFailed } from "./backend-state";
import { RowsGridSkeleton } from "./rows-grid";

/** Props of StoragePanel. The panel mounts only while the backend is `active`. */
export type StoragePanelProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The queries of the panel wait for it. */
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
			<CodeMessage
				icon={HardDrive}
				text={t("workspace.cloud.storage.buckets.empty")}
			/>
		);
	}
	return <BucketsList buckets={buckets.data} onOpen={setOpenBucketId} />;
}

/** The buckets with their access and last update. A click on a name opens the bucket. */
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
		<div className="rounded-xl border">
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
						<TableRow key={bucket.id}>
							<TableCell>
								<button
									type="button"
									dir="ltr"
									onClick={() => onOpen(bucket.id)}
									className="rounded-sm font-medium font-mono text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									{bucket.name}
								</button>
							</TableCell>
							<TableCell>
								<Badge variant={bucket.public ? "warning" : "outline"}>
									{bucket.public
										? t("workspace.cloud.storage.buckets.public")
										: t("workspace.cloud.storage.buckets.private")}
								</Badge>
							</TableCell>
							<TableCell className="text-muted-foreground">
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
				<CodeMessage
					icon={FolderOpen}
					text={t("workspace.cloud.storage.objects.empty")}
				/>
			);
		}
		return (
			<div className="flex min-w-0 flex-col gap-3">
				<div className="rounded-xl border">
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
												className="inline-flex items-center gap-2 rounded-sm font-mono text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
											>
												<Folder className="size-4 shrink-0 text-muted-foreground" />
												<span className="truncate">{item.name}</span>
											</button>
										) : (
											<span
												dir="ltr"
												className="inline-flex items-center gap-2 font-mono text-sm"
											>
												<FileIcon className="size-4 shrink-0 text-muted-foreground" />
												<span className="truncate">{item.name}</span>
											</span>
										)}
									</TableCell>
									<TableCell className="text-end text-muted-foreground">
										{item.sizeBytes === null
											? CLOUD_EMPTY_CELL
											: formatBytes(item.sizeBytes, locale)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatStorageDate(item.updatedAt, locale)}
									</TableCell>
									<TableCell>
										{/* A folder is only a path prefix in Storage: it has no URL and no row to delete. */}
										{item.isFolder ? null : (
											<div className="flex justify-end gap-1">
												{item.downloadUrl === null ? null : (
													<Button variant="ghost" size="icon-sm" asChild>
														<a
															href={item.downloadUrl}
															target="_blank"
															rel="noopener noreferrer"
															aria-label={t(
																"workspace.cloud.storage.objects.download",
																{ name: item.name },
															)}
														>
															<Download />
														</a>
													</Button>
												)}
												<Button
													variant="ghost"
													size="icon-sm"
													aria-label={t(
														"workspace.cloud.storage.objects.delete",
														{ name: item.name },
													)}
													onClick={() => setPendingDelete(item)}
												>
													<Trash2 />
												</Button>
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
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="ghost" size="sm" onClick={onBack}>
					{/* In RTL the list sits on the right, so the arrow mirrors. */}
					<ArrowLeft className="rtl:-scale-x-100" />
					{t("workspace.cloud.storage.buckets.back")}
				</Button>
				{/* A path reads left to right in every locale. */}
				<nav
					dir="ltr"
					aria-label={t("workspace.cloud.storage.objects.pathLabel")}
					className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-mono text-sm"
				>
					<button
						type="button"
						onClick={() => setPrefix("")}
						className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						{bucket.name}
					</button>
					{segments.map((segment, index) => (
						<span
							key={segments.slice(0, index + 1).join("/")}
							className="inline-flex items-center gap-1"
						>
							<span className="text-muted-foreground">/</span>
							<button
								type="button"
								onClick={() =>
									setPrefix(segments.slice(0, index + 1).join("/"))
								}
								className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
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
					size="sm"
					disabled={upload.isPending}
					onClick={() => fileInput.current?.click()}
				>
					{upload.isPending ? (
						<LoaderCircle className="animate-spin" />
					) : (
						<Upload />
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
