// The last row of the audience page: the table of every audience part (cities and age ranges)
// in 2 of 3 columns, and the split card with three choice tiles (age, cities, online hours) in 1 of 3.
// AudiencePage renders them with the audience profile. Both export their rows as CSV.
import {
	CakeIcon,
	ClockIcon,
	DownloadSimpleIcon,
	MapPinIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	shareFormat,
	toCsv,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { AudiencePart, AudienceProfile } from "../api/audience.queries";
import { HOUR_BLOCKS } from "../lib/sample-data";

// A home table card shows eight rows per page.
const PAGE_SIZE = 8;

// The split card lists the four busiest blocks of the week.
const PEAK_COUNT = 4;

// 1 January 2024 is a Monday: the online levels start on Monday too.
const FIRST_MONDAY_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

type PartsProps = {
	audience: AudienceProfile;
};

/** One row per city and per age range. The filter field matches the label. */
export function AudiencePartsCard({ audience }: PartsProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const rows = [...audience.cities, ...audience.ages];
	const labelOf = (part: AudiencePart) =>
		part.label === "other" ? t("audience.other") : part.label;
	const csvColumns: CsvColumn<AudiencePart>[] = [
		{ header: t("audience.part"), value: labelOf },
		{
			header: t("audience.kind"),
			value: (part) => t(`audience.kinds.${part.kind}`),
		},
		{ header: t("metrics.followers"), value: (part) => String(part.followers) },
		{ header: t("audience.share"), value: (part) => share.format(part.share) },
	];
	const columns: RecordColumn<AudiencePart>[] = [
		{
			id: "part",
			header: t("audience.part"),
			cell: (part) => <span className="font-medium">{labelOf(part)}</span>,
			sortValue: labelOf,
		},
		{
			id: "kind",
			header: t("audience.kind"),
			cell: (part) => (
				<Badge variant={part.kind === "city" ? "info" : "secondary"}>
					{t(`audience.kinds.${part.kind}`)}
				</Badge>
			),
			sortValue: (part) => part.kind,
			hideable: true,
		},
		{
			id: "followers",
			header: t("metrics.followers"),
			cell: (part) => number.format(part.followers),
			sortValue: (part) => part.followers,
			align: "end",
			hideable: true,
		},
		{
			id: "share",
			header: t("audience.share"),
			cell: (part) => share.format(part.share),
			sortValue: (part) => part.share,
			align: "end",
			hideable: true,
		},
	];
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.partsTitle")}</CardTitle>
				<CardDescription>{t("audience.partsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={labelOf}
					searchPlaceholder={t("audience.partsSearch")}
					rowMenu={(part) => (
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(labelOf(part), {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("audience.copyName")}
						</DropdownMenuItem>
					)}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"postbox-audience-selected.csv",
									toCsv(selected, csvColumns),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("audience.noParts")}
				/>
			</CardContent>
		</Card>
	);
}

/** The three dimensions of the split card. */
type SplitKind = "ages" | "cities" | "hours";

/**
 * One line of the split list. `share` is from 0 to 1: a share of the followers for ages and cities,
 * the level against the busiest block for hours. `id` keys the row and the CSV.
 */
type SplitRow = { id: string; label: string; share: number };

/** Three tiles pick the dimension. The list and the export follow the tile. */
export function AudienceSplitCard({ audience }: PartsProps) {
	const { t, locale } = useT();
	const [kind, setKind] = useState<SplitKind>("ages");
	const share = shareFormat(locale);
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		timeZone: "UTC",
	});
	const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const tiles = [
		{ kind: "ages", icon: CakeIcon, label: t("audience.agesTitle") },
		{ kind: "cities", icon: MapPinIcon, label: t("audience.citiesShort") },
		{ kind: "hours", icon: ClockIcon, label: t("audience.hoursShort") },
	] satisfies { kind: SplitKind; icon: typeof CakeIcon; label: string }[];

	const peaks: SplitRow[] = audience.onlineLevels
		.flatMap((levels, dayIndex) =>
			levels.map((level, blockIndex) => {
				const startHour = HOUR_BLOCKS[blockIndex] ?? 0;
				// A block is 3 hours long.
				const endHour = (startHour + 3) % 24;
				return {
					id: `${dayIndex}-${blockIndex}`,
					label: `${weekday.format(new Date(FIRST_MONDAY_MS + dayIndex * DAY_MS))}, ${hour.format(new Date(2024, 0, 1, startHour))}–${hour.format(new Date(2024, 0, 1, endHour))}`,
					share: level,
				};
			}),
		)
		.sort((first, second) => second.share - first.share)
		.slice(0, PEAK_COUNT);
	const toRows = (parts: AudiencePart[]): SplitRow[] =>
		parts.map((part) => ({
			id: part.id,
			label: part.label === "other" ? t("audience.other") : part.label,
			share: part.share,
		}));
	const rows =
		kind === "ages"
			? toRows(audience.ages)
			: kind === "cities"
				? toRows(audience.cities)
				: peaks;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.splitTitle")}</CardTitle>
				<CardDescription>{t("audience.splitDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-6">
				<div className="grid grid-cols-3 gap-3">
					{tiles.map((tile) => (
						<button
							key={tile.kind}
							type="button"
							aria-pressed={kind === tile.kind}
							onClick={() => setKind(tile.kind)}
							className={cn(
								"flex flex-col items-center gap-3 rounded-md border p-4 text-sm hover:bg-accent",
								kind === tile.kind && "border-primary ring-1 ring-primary",
							)}
						>
							<tile.icon className="size-6" />
							<span className="truncate">{tile.label}</span>
						</button>
					))}
				</div>
				<ul className="grid flex-1 content-start gap-4">
					{rows.map((row) => (
						<li key={row.id} className="grid gap-1.5">
							<div className="flex items-center justify-between gap-3 text-sm">
								<span className="truncate">{row.label}</span>
								<span className="text-muted-foreground tabular-nums">
									{share.format(row.share)}
								</span>
							</div>
							<Progress
								value={row.share * 100}
								className="h-2"
								aria-label={`${row.label}: ${share.format(row.share)}`}
							/>
						</li>
					))}
				</ul>
				{kind === "hours" ? (
					<p className="text-muted-foreground text-xs">
						{t("audience.hoursNote")}
					</p>
				) : null}
				<Button
					type="button"
					className="w-full"
					onClick={() =>
						downloadCsv(
							`postbox-audience-${kind}.csv`,
							toCsv(rows, [
								{ header: t("audience.part"), value: (row) => row.label },
								{
									header: t("audience.share"),
									value: (row) => share.format(row.share),
								},
							]),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("audience.exportSplit")}
				</Button>
			</CardContent>
		</Card>
	);
}
