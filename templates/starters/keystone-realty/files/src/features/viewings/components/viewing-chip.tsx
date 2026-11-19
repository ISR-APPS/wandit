// One viewing as a small chip in a calendar cell: the time and the street, on the tint of its status.
// The month and week views of the viewings page render it. A click opens the page of the home.
import { Link } from "@tanstack/react-router";
import type { ViewingRow, ViewingStatus } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** The tint per status. The legend of the calendar names each tint, and the chip label names the status. */
export const VIEWING_CHIP_TINT = {
	requested: "bg-warning/30",
	confirmed: "bg-info/25",
	completed: "bg-success/25",
	no_show: "bg-destructive/20",
	cancelled: "bg-muted text-muted-foreground line-through",
} satisfies Record<ViewingStatus, string>;

type ViewingChipProps = {
	viewing: ViewingRow;
};

/** The aria-label reads the time, the home, the lead, and the status, so the tint is never the only mark. */
export function ViewingChip({ viewing }: ViewingChipProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
		new Date(viewing.startsAt),
	);
	return (
		<Link
			to="/app/listings/$listingId"
			params={{ listingId: viewing.listingId }}
			aria-label={`${time}, ${viewing.listingStreet}, ${viewing.leadName}, ${t(`agency.viewingStatuses.${viewing.status}`)}`}
			className={cn(
				"block truncate rounded-sm px-1.5 py-0.5 text-xs hover:ring-1 hover:ring-ring",
				VIEWING_CHIP_TINT[viewing.status],
			)}
		>
			<span className="text-muted-foreground tabular-nums">{time}</span>{" "}
			<span dir="auto">{viewing.listingStreet}</span>
		</Link>
	);
}
