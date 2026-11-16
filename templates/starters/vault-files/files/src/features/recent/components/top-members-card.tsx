// "Most active" on the Recent page: the members with the most feed entries in the last 7 days.
// RecentPage renders it in the rail with the rows of rankBy.
import { MemberAvatar } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { RankRow } from "../lib/feed";

type TopMembersCardProps = {
	/** The title names the period. */
	title: string;
	/** The most active first. */
	rows: RankRow[];
};

/** One row per member: the avatar, the name, the count, and a bar against the most active member. */
export function TopMembersCard({ title, rows }: TopMembersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const top = rows[0]?.count ?? 0;
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
					<ul className="grid gap-3.5">
						{rows.map((row) => (
							<li key={row.key} className="flex items-center gap-3 text-sm">
								<MemberAvatar name={row.name} size="md" />
								<div className="grid min-w-0 flex-1 gap-1.5">
									<div className="flex items-baseline justify-between gap-2">
										<span className="truncate">{row.name}</span>
										<span className="shrink-0 font-medium tabular-nums">
											{number.format(row.count)}
										</span>
									</div>
									<Progress
										value={row.count}
										max={top}
										aria-label={row.name}
										className="h-1"
									/>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
