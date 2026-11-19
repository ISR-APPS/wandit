// The history card of a listing detail page: a line timeline of the dated steps of the home, newest first,
// each with an icon, its text, its date, and how long ago it was. ListingDetailPage renders it in the wide column.
// It shows 3 steps. "View all" shows every step: a state of the card.
import {
	CalendarPlusIcon,
	ChatCircleDotsIcon,
	ClockIcon,
	DoorOpenIcon,
	HandshakeIcon,
	HouseLineIcon,
	KeyIcon,
	SignatureIcon,
	TagIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
	fillMessage,
	formatRelativeTime,
	moneyFormat,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { TimelineKind, TimelineStep } from "../lib/listing-timeline";

// Three steps keep the card short. "View all" shows the rest.
const SHOWN_STEPS = 3;

const STEP_ICON = {
	instructed: SignatureIcon,
	launch_planned: CalendarPlusIcon,
	listed: HouseLineIcon,
	first_enquiry: ChatCircleDotsIcon,
	first_viewing: DoorOpenIcon,
	price_reduced: TagIcon,
	offer_accepted: HandshakeIcon,
	sold: KeyIcon,
	withdrawn: XCircleIcon,
} satisfies Record<TimelineKind, KitIcon>;

type ListingActivityCardProps = {
	/** The dated steps of the listing, newest first. */
	steps: TimelineStep[];
};

/** The newest step carries a "Latest" badge. */
export function ListingActivityCard({ steps }: ListingActivityCardProps) {
	const { t, locale } = useT();
	const [showAll, setShowAll] = useState(false);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const now = Date.now();
	const shown = showAll ? steps : steps.slice(0, SHOWN_STEPS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.timeline.title")}</CardTitle>
				{steps.length > SHOWN_STEPS ? (
					<CardAction>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto px-0 text-muted-foreground"
							onClick={() => setShowAll((current) => !current)}
						>
							{showAll ? t("listings.showFewer") : t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-9">
				<ol className="relative grid gap-8 border-s">
					{shown.map((step, index) => {
						const StepIcon = STEP_ICON[step.kind];
						return (
							<li key={`${step.kind}-${step.at}`} className="ms-6 grid gap-2">
								<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
									<StepIcon className="size-3 text-primary" />
								</span>
								<h3 className="flex flex-wrap items-center gap-2 font-semibold">
									{fillMessage(t(`listings.timeline.${step.kind}`), {
										person: step.person ?? "",
										amount:
											step.amount === null ? "" : money.format(step.amount),
									})}
									{index === 0 ? (
										<Badge variant="outline">
											{t("listings.timeline.latest")}
										</Badge>
									) : null}
								</h3>
								<time
									dateTime={step.at}
									className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
								>
									<ClockIcon className="size-3" />
									{date.format(new Date(step.at))}
								</time>
								<p className="text-muted-foreground text-sm">
									{formatRelativeTime(step.at, now, locale)}
								</p>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
