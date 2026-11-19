// The product areas card of the home: the busiest feature areas of the period, each with an icon tile,
// its event count, and its change against the period before. OverviewPage renders it last in the second row of three.
import { changeRatio, fillMessage } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { AreaEvents } from "../api/overview.queries";
import { AREA_ICONS } from "../lib/area-icons";
import { ChangeText } from "./change-text";

type ProductAreasCardProps = {
	/** The busiest feature areas, the most events first. */
	areas: AreaEvents[];
};

/** The description gives the events of the listed areas. Each badge compares one area with the period before. */
export function ProductAreasCard({ areas }: ProductAreasCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const total = areas.reduce((sum, area) => sum + area.current, 0);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.areas.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.areas.description"), {
						count: compact.format(total),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{areas.map((area) => {
						const Icon = AREA_ICONS[area.area];
						return (
							<li key={area.area} className="flex items-center gap-4">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
									<Icon className="size-4" />
								</span>
								<span className="min-w-0 truncate">
									{t(`areas.${area.area}`)}
								</span>
								<div className="ms-auto flex items-center gap-3">
									<span className="text-sm tabular-nums">
										{number.format(area.current)}
									</span>
									<span className="w-16 text-end">
										<Badge variant="outline">
											<ChangeText
												change={changeRatio(area.current, area.previous)}
											/>
										</Badge>
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
