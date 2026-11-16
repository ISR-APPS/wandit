// The activity card of the deal page: the logged calls, emails, meetings, and notes of one deal as a timeline.
// DealDetailPage renders it in the main column and passes the cached activities.
// The type tabs filter the timeline. A long timeline shows its newest items first, with a button for the rest.
import { useState } from "react";
import { type Activity, ActivityTimeline } from "~/features/activities";
import { ACTIVITY_TYPES, type ActivityType, fillMessage } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

// The items of the first view. About one screen of timeline; the button shows the rest.
const FIRST_ITEMS = 6;

type DealActivityCardProps = {
	/** Every activity of the deal, newest first. */
	activities: Activity[];
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** A change of tab keeps the "show all" choice, so a long tab stays open. */
export function DealActivityCard({ activities, now }: DealActivityCardProps) {
	const { t, locale } = useT();
	const [type, setType] = useState<ActivityType | "all">("all");
	const [showsAll, setShowsAll] = useState(false);
	const number = new Intl.NumberFormat(locale);
	// A tab shows only for a type that has rows.
	const tabs = ACTIVITY_TYPES.map((value) => ({
		value,
		count: activities.filter((row) => row.type === value).length,
	})).filter((tab) => tab.count > 0);
	const ofType =
		type === "all" ? activities : activities.filter((row) => row.type === type);
	const shown = showsAll ? ofType : ofType.slice(0, FIRST_ITEMS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("deals.activity")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				{activities.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("deals.noActivity")}
					</p>
				) : (
					<>
						<Tabs
							value={type}
							onValueChange={(value) =>
								setType(
									ACTIVITY_TYPES.find((option) => option === value) ?? "all",
								)
							}
							className="max-w-full overflow-x-auto"
						>
							<TabsList>
								<TabsTrigger value="all">
									{t("activities.all")}
									<span className="text-muted-foreground tabular-nums">
										{number.format(activities.length)}
									</span>
								</TabsTrigger>
								{tabs.map((tab) => (
									<TabsTrigger key={tab.value} value={tab.value}>
										{t(`activityTypes.${tab.value}`)}
										<span className="text-muted-foreground tabular-nums">
											{number.format(tab.count)}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
						<ActivityTimeline activities={shown} now={now} />
						{ofType.length > FIRST_ITEMS ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="justify-self-start"
								onClick={() => setShowsAll(!showsAll)}
							>
								{showsAll
									? t("deals.showNewest")
									: fillMessage(t("deals.showAll"), {
											count: number.format(ofType.length),
										})}
							</Button>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
