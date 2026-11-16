// The Trash page behind login: the deleted files with the day of their final delete, a filter, and a search.
// The /app/trash route renders it after its loader. A row opens TrashDetailsDialog with its facts.
import { InfoIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	calendarDaysFromNow,
	FileNameCell,
	fillCount,
	formatBytes,
	formatRelativeTime,
	MemberAvatar,
	type TrashItem,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { trashQueryOptions } from "../api/trash.queries";
import { PurgeBadge } from "./purge-badge";
import { TrashDetailsDialog } from "./trash-details-dialog";

// The second tab lists the files whose final delete comes in 7 calendar days or less.
const WEEK_DAYS = 7;

/** The trash list. The final delete sits next to the name, so a phone shows it first. The tab filters the rows. */
export function TrashPage() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(trashQueryOptions());
	const [tab, setTab] = useState<"all" | "week">("all");
	const [openFile, setOpenFile] = useState<TrashItem | null>(null);

	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const withinWeek = data.files.filter(
		(file) => calendarDaysFromNow(file.purgeAt, now) <= WEEK_DAYS,
	);
	const rows = tab === "week" ? withinWeek : data.files;

	const columns: DataTableColumn<TrashItem>[] = [
		{
			id: "name",
			header: t("files.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<FileNameCell
					fileId={row.id}
					name={row.name}
					kind={row.kind}
					path={row.path}
					linked={false}
				/>
			),
		},
		{
			id: "purge",
			header: t("trash.columns.purge"),
			sortValue: (row) => Date.parse(row.purgeAt),
			cell: (row) => <PurgeBadge purgeAt={row.purgeAt} />,
		},
		{
			id: "size",
			header: t("files.columns.size"),
			align: "end",
			sortValue: (row) => row.sizeBytes,
			cell: (row) => formatBytes(row.sizeBytes, locale),
		},
		{
			id: "deletedBy",
			header: t("trash.columns.deleted"),
			sortValue: (row) => Date.parse(row.deletedAt),
			cell: (row) => (
				<span className="flex items-center gap-2 whitespace-nowrap">
					<MemberAvatar name={row.deletedByName} />
					<span className="grid">
						{row.deletedByName}
						<span className="text-muted-foreground text-xs">
							{formatRelativeTime(row.deletedAt, now, locale)}
						</span>
					</span>
				</span>
			),
		},
		{
			id: "details",
			header: "",
			align: "end",
			cell: (row) => (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="max-sm:h-11"
					onClick={() => setOpenFile(row)}
				>
					{t("trash.details")}
				</Button>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("trash.title")}
				description={fillCount(
					t("trash.description"),
					data.retentionDays,
					locale,
				)}
			/>
			<Card className="flex-row items-start gap-3 px-5 py-4">
				<InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
				<p className="text-sm">
					{t("trash.storageNote")
						.replace("{trash}", formatBytes(data.trashBytes, locale))
						.replace("{used}", formatBytes(data.usedBytes, locale))
						.replace(
							"{share}",
							percent.format(
								data.usedBytes > 0 ? data.trashBytes / data.usedBytes : 0,
							),
						)}
				</p>
			</Card>
			{data.files.length === 0 ? (
				<Card>
					<CardContent className="py-6 text-center text-muted-foreground text-sm">
						{t("trash.empty")}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.name} ${row.path.join(" ")} ${row.deletedByName}`
							}
							noResults={t("trash.noResults")}
							toolbar={
								<Tabs
									value={tab}
									onValueChange={(value) =>
										setTab(value === "week" ? "week" : "all")
									}
								>
									{/* A phone gets 44 px tall tabs, so the list grows to fit them. */}
									<TabsList className="max-sm:group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all" className="max-sm:min-h-11">
											{t("trash.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(data.files.length)}
											</span>
										</TabsTrigger>
										<TabsTrigger value="week" className="max-sm:min-h-11">
											{t("trash.withinWeek")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(withinWeek.length)}
											</span>
										</TabsTrigger>
									</TabsList>
								</Tabs>
							}
						/>
					</CardContent>
				</Card>
			)}
			<TrashDetailsDialog
				file={openFile}
				onOpenChange={(open) => {
					if (!open) {
						setOpenFile(null);
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TrashPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-28" />
				<Skeleton className="h-4 w-80" />
			</div>
			<Skeleton className="h-14 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function TrashPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("trash.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
