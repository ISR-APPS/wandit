// A clock time with the minutes since then, for example "21:42 · 38 min".
// TableSheet renders it for the time when the guests sat down or the check opened.
// It reads the format helpers of ~/features/restaurant.
import {
	formatClock,
	formatMinutes,
	minutesSince,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";

type TimeSinceProps = {
	/** ISO time of the start. */
	iso: string;
	/** Milliseconds since 1970 at render. The page passes one value for every time on screen. */
	now: number;
};

/** The clock time in the text color, the minutes after it in the muted color. */
export function TimeSince({ iso, now }: TimeSinceProps) {
	const { locale } = useT();
	return (
		<span className="tabular-nums">
			{formatClock(iso, locale)}
			<span className="text-muted-foreground">
				{` · ${formatMinutes(minutesSince(iso, now), locale)}`}
			</span>
		</span>
	);
}
