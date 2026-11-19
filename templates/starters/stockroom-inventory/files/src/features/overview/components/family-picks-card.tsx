// The picks by family card of the home: one row per product family with its share of the picked units,
// its change against the period before, and a bar. It takes the place of the kit "sales by location" card.
// OverviewPage renders it. "Export" downloads the rows as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Delta, downloadCsv, fillMessage, toCsv } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { FamilyPicks } from "../api/overview.queries";

type FamilyPicksCardProps = {
	/** One entry per family, the most picked first. */
	families: FamilyPicks[];
	/** The period in words, for example "30 days". */
	period: string;
	/** The grid span classes of the page. */
	className?: string;
};

/** The six families of the catalog, so the card always has six rows. */
export function FamilyPicksCard({
	families,
	period,
	className,
}: FamilyPicksCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{t("overview.familiesTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.familiesDescription"), { period })}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"picks-by-family.csv",
								toCsv(
									families.map((family) => ({
										id: family.category,
										...family,
									})),
									[
										{
											header: t("items.category"),
											value: (row) => t(`categories.${row.category}`),
										},
										{
											header: t("overview.picksTitle"),
											value: (row) => String(row.units),
										},
										{
											header: t("overview.share"),
											value: (row) => percent.format(row.share),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{families.map((family) => (
						<li key={family.category} className="grid gap-2">
							<div className="flex items-center justify-between gap-2 text-sm">
								<span className="flex items-center gap-2">
									{t(`categories.${family.category}`)}
									<Delta change={family.change} goodWhen="up" variant="badge" />
								</span>
								<span className="tabular-nums">
									{percent.format(family.share)}
								</span>
							</div>
							{/* The share is from 0 to 1. Progress takes 0 to 100. */}
							<Progress
								value={family.share * 100}
								aria-label={t(`categories.${family.category}`)}
							/>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
