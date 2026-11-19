// One card of the project task board: the deliverable, its owner and due (or approval) day, its owner face,
// a ring of its workflow step, then the priority and the due date.
// BoardColumn renders one card per deliverable. No drag and drop: a status change happens in the real backend.
import { CalendarBlankIcon, CheckCircleIcon } from "@phosphor-icons/react";
import {
	DELIVERABLE_STATUSES,
	fillMessage,
	PersonAvatar,
	PriorityBadge,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";
import type { BoardItem } from "../lib/project-detail";

// The ring is a circle of radius 7 in a 16 x 16 box. Its length gives the dash of a full turn.
const RING_RADIUS = 7;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The ring fills one quarter per step: To do 1 of 4, Approved 4 of 4. */
export function BoardCard({ item }: { item: BoardItem }) {
	const { t, locale } = useT();
	const { shortDate, relativeDay } = useFormatters();
	const number = new Intl.NumberFormat(locale);
	const step = DELIVERABLE_STATUSES.indexOf(item.status) + 1;
	const stepCount = DELIVERABLE_STATUSES.length;
	const stepText = fillMessage(t("projectDetail.step"), {
		step: number.format(step),
		count: number.format(stepCount),
	});

	return (
		<Card className="gap-4 py-5">
			<CardHeader className="px-5">
				<CardTitle className="font-display font-semibold text-base leading-snug">
					{item.name}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 px-5">
				<p className="line-clamp-2 text-muted-foreground text-sm">
					{/* An approved card names its sign-off day. A past due day would read as late. */}
					{item.approvedDay === null
						? fillMessage(t("projectDetail.cardDetail"), {
								owner: item.ownerName,
								due: relativeDay(item.dueDay),
							})
						: fillMessage(t("projectDetail.cardDetailApproved"), {
								owner: item.ownerName,
								day: shortDate(item.approvedDay),
							})}
				</p>
				<div className="flex items-center justify-between text-muted-foreground text-sm">
					<PersonAvatar
						name={item.ownerName}
						className="size-7 ring-2 ring-card"
					/>
					<span className="flex items-center gap-2 rounded-md border px-2 py-1 tabular-nums">
						<svg
							viewBox="0 0 16 16"
							className="size-4 -rotate-90"
							aria-hidden="true"
						>
							<circle
								cx="8"
								cy="8"
								r={RING_RADIUS}
								fill="none"
								strokeWidth="2"
								className="stroke-muted"
							/>
							<circle
								cx="8"
								cy="8"
								r={RING_RADIUS}
								fill="none"
								strokeWidth="2"
								strokeLinecap="round"
								strokeDasharray={RING_LENGTH}
								strokeDashoffset={RING_LENGTH * (1 - step / stepCount)}
								className={
									step === stepCount ? "stroke-success" : "stroke-primary"
								}
							/>
						</svg>
						{stepText}
					</span>
				</div>
				<Separator />
				<div className="flex items-center justify-between text-muted-foreground text-sm">
					{item.priority === null ? (
						<span className="flex items-center gap-1 text-success">
							<CheckCircleIcon className="size-4" />
							{t("codes.deliverables.approved")}
						</span>
					) : (
						<PriorityBadge priority={item.priority} />
					)}
					<span className="flex items-center gap-1 tabular-nums">
						<CalendarBlankIcon className="size-4" />
						{shortDate(item.dueDay)}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
