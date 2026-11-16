// The badge "Waiting 6 days" of a submission with no grade. Its tint shows the waiting band.
// The home grading list, the Assignments table, and the submission panel render it.
// It reads only its props and the "grading.waitingFor" message.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { WaitBand } from "../lib/catalog";
import { dayCountFormat, fillMessage } from "../lib/format";

// The kit has no tinted red variant. The overdue band copies the tint of ChangePill, so a list of late work stays calm.
const WAIT_BAND_LOOK = {
	fresh: { variant: "info", className: undefined },
	waiting: { variant: "warning", className: undefined },
	overdue: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/10 text-destructive",
	},
} as const satisfies Record<
	WaitBand,
	{ variant: "info" | "warning" | "outline"; className: string | undefined }
>;

type WaitBadgeProps = {
	/** The waiting band of the submission, from waitBandOf(). */
	band: WaitBand;
	/** Whole calendar days since the submission, from waitDaysOf(). */
	days: number;
};

/** Only for a submission with no grade. A graded one shows its points. */
export function WaitBadge({ band, days }: WaitBadgeProps) {
	const { t, locale } = useT();
	const look = WAIT_BAND_LOOK[band];
	return (
		<Badge variant={look.variant} className={look.className}>
			{fillMessage(t("grading.waitingFor"), {
				days: dayCountFormat(locale).format(days),
			})}
		</Badge>
	);
}
