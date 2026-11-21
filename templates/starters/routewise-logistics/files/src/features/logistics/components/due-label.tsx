// The due day of a shipment as a short label: "Today", "Tomorrow", or a late mark.
// The shipment list and the shipment slips of the driver and vehicle panels render it.
// An open shipment shows a relative day. A closed shipment shows its due date.

import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { WarningIcon } from "~/shared/ui/icons";
import { capitalize, dayCountFormat, fillMessage } from "../lib/format";
import { formatRelativeDay } from "../lib/relative-time";

type DueLabelProps = {
	/** The end of the promised delivery day, as ISO. */
	dueAt: string;
	/** Calendar days after the due day: 0 is on time. The shipment query computes it. */
	lateDays: number;
	/** True while the shipment is not delivered and not failed. */
	isOpen: boolean;
	className?: string;
};

/** A late open shipment is red with an icon. A closed one that was late keeps a muted note under its date. */
export function DueLabel({
	dueAt,
	lateDays,
	isOpen,
	className,
}: DueLabelProps) {
	const { t, locale } = useT();
	const lateText = fillMessage(t("due.late"), {
		days: dayCountFormat(locale).format(lateDays),
	});
	if (isOpen && lateDays > 0) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 font-medium text-destructive",
					className,
				)}
			>
				<WarningIcon className="size-4 shrink-0" />
				{lateText}
			</span>
		);
	}
	if (isOpen) {
		return (
			<span className={className}>
				{capitalize(formatRelativeDay(dueAt, Date.now(), locale), locale)}
			</span>
		);
	}
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	}).format(new Date(dueAt));
	// The late note takes a second line, so a narrow table column on a phone keeps it whole.
	return (
		<span className={cn("inline-grid", className)}>
			<span>{date}</span>
			{lateDays > 0 ? (
				<span className="text-muted-foreground text-xs">{lateText}</span>
			) : null}
		</span>
	);
}
