// The figure strip at the top of the audience page: people in all segments, segments in live campaigns,
// and the segment with the fastest growth. AudiencesPage renders it above the table.
import { ChangeLine, fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { Audience } from "../api/audiences.queries";

type AudienceFiguresProps = {
	/** Every audience of the list query. The figures do not follow the type tab. */
	audiences: Audience[];
};

/** Three cells: 1 column on a phone, 3 from the 36rem container width, so a 1024 px screen shows one row. */
export function AudienceFigures({ audiences }: AudienceFiguresProps) {
	const { t, locale } = useT();
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const number = new Intl.NumberFormat(locale);
	const totalPeople = audiences.reduce((sum, row) => sum + row.size, 0);
	const inLive = audiences.filter((row) =>
		row.campaigns.some((campaign) => campaign.status === "live"),
	).length;
	const fastest = audiences.reduce<Audience | undefined>(
		(best, row) =>
			row.growth !== null && (best?.growth ?? -1) < row.growth ? row : best,
		undefined,
	);

	return (
		<Card className="py-0">
			<CardContent className="grid @xl/main:grid-cols-3 @xl/main:divide-x divide-y @xl/main:divide-y-0 px-0 rtl:@xl/main:divide-x-reverse">
				<div className="grid content-start gap-1 px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("audiences.totalPeople")}
					</p>
					<p className="font-numeric text-3xl tabular-nums">
						{compact.format(totalPeople)}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("audiences.totalPeopleHint")}
					</p>
				</div>
				<div className="grid content-start gap-1 px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("audiences.inLive")}
					</p>
					<p className="font-numeric text-3xl tabular-nums">
						{number.format(inLive)}
					</p>
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("audiences.inLiveHint"), {
							count: number.format(inLive),
							total: number.format(audiences.length),
						})}
					</p>
				</div>
				<div className="grid content-start gap-1 px-6 py-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("audiences.fastest")}
					</p>
					<p
						className="line-clamp-2 font-display font-semibold text-xl"
						dir="auto"
					>
						{fastest?.name ?? "–"}
					</p>
					{fastest ? (
						<ChangeLine
							change={fastest.growth}
							goodWhen="up"
							srLabel={t("audiences.growthLabel")}
						/>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
