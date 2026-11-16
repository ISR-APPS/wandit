// The history of one listing as a vertical line of dated steps, newest first.
// ListingDetailPage renders it in the rail with the timeline of the detail query.
import { fillMessage, moneyFormat } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TimelineStep } from "../lib/listing-timeline";

type ListingTimelineCardProps = {
	/** The dated steps of the listing, newest first. */
	steps: TimelineStep[];
};

/** The newest step has a filled dot. A planned first market day shows its date in the future. */
export function ListingTimelineCard({ steps }: ListingTimelineCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.timeline.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="ms-1.5 grid gap-5 border-s ps-5">
					{steps.map((step, index) => (
						<li key={step.kind} className="relative grid gap-0.5">
							{/* The dot sits on the line: half of its width goes over the start edge of the list. */}
							<span
								aria-hidden="true"
								className={cn(
									"absolute -start-6.5 top-1 size-3 rounded-full border bg-card",
									index === 0 && "border-primary bg-primary",
								)}
							/>
							<p className="text-sm">
								{fillMessage(t(`listings.timeline.${step.kind}`), {
									amount: step.amount === null ? "" : money.format(step.amount),
									person: step.person ?? "",
								})}
							</p>
							<p className="text-muted-foreground text-xs tabular-nums">
								{date.format(new Date(step.at))}
							</p>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
