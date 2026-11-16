// "Most changed" on the Recent page: the live files with the most feed entries in the last 7 days.
// RecentPage renders it in the rail with the rows of rankBy. Each row opens the file page.
import { Link } from "@tanstack/react-router";
import {
	type FileKind,
	FileTile,
	fillCount,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RankRow } from "../lib/feed";

type BusyFilesCardProps = {
	/** The title names the period. */
	title: string;
	/** The most changed first. `key` is the file id. */
	rows: RankRow[];
	/** The kind of each file id, for the tile. */
	kindOf: (fileId: string) => FileKind;
};

/** A short link list with the count of changes of each file. */
export function BusyFilesCard({ title, rows, kindOf }: BusyFilesCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("recent.noActivityWeek")}
					</p>
				) : (
					<ul className="grid">
						{rows.map((row) => (
							<li key={row.key}>
								<Link
									to="/app/files/$fileId"
									params={{ fileId: row.key }}
									className="-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
								>
									<FileTile kind={kindOf(row.key)} />
									<span
										className="min-w-0 flex-1 truncate font-medium text-sm"
										dir="auto"
									>
										{row.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{fillCount(
											t(`recent.changeCount.${pluralForm(row.count, locale)}`),
											row.count,
											locale,
										)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
