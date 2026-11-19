// The countdown badge of a file in the trash: "in 2 days" until Vault deletes it for good.
// The final delete column of the Trash table renders it. The color gets stronger as the day comes closer.
import {
	calendarDaysFromNow,
	formatRelativeTime,
	PURGE_SOON_DAYS,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

// The last day is critical; three days or less is urgent; a week or less needs attention soon.
const CRITICAL_DAYS = 1;
const URGENT_DAYS = 3;
const SOON_DAYS = PURGE_SOON_DAYS;

// A tinted red pill: the warning shape in the destructive color. Only the last day gets the solid red.
const URGENT_TINT = "border-destructive/25 bg-destructive/12 text-destructive";

type PurgeBadgeProps = {
	/** ISO time of the final delete. */
	purgeAt: string;
};

/** Solid red on the last day, tinted red up to 3 days, warning up to 7 days, secondary after. */
export function PurgeBadge({ purgeAt }: PurgeBadgeProps) {
	const { locale } = useT();
	const now = Date.now();
	const days = calendarDaysFromNow(purgeAt, now);
	const label = formatRelativeTime(purgeAt, now, locale);
	if (days <= CRITICAL_DAYS) {
		return <Badge variant="destructive">{label}</Badge>;
	}
	if (days <= URGENT_DAYS) {
		return (
			<Badge variant="warning" className={URGENT_TINT}>
				{label}
			</Badge>
		);
	}
	return (
		<Badge variant={days <= SOON_DAYS ? "warning" : "secondary"}>{label}</Badge>
	);
}
