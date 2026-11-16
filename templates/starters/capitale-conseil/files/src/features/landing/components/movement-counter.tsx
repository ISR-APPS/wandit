// The header counter, for example "03 / 05". SiteHeader renders it at every width.
// Below 1180px it replaces the index spine. usePassedMovements gives the current movement.
import { useT } from "~/shared/i18n";
import { usePassedMovements } from "../hooks/use-passed-movements";
import { MOVEMENTS } from "../lib/content";

/** The numeral of the current movement over the total. It reads "01" at the top of the page and with no script. */
export function MovementCounter() {
	const { t } = useT();
	const passedCount = usePassedMovements();
	// Before the first movement, the counter shows the first numeral.
	const current = MOVEMENTS[Math.max(passedCount, 1) - 1];
	return (
		<p className="inline-flex items-baseline gap-1 font-semibold text-[0.6875rem] text-primary tabular-nums tracking-[0.12em]">
			<span className="sr-only">{t("site.counterLabel")}</span>
			<span>{current?.numeral}</span>
			<span aria-hidden="true" className="text-foreground/45">
				/
			</span>
			<span>{String(MOVEMENTS.length).padStart(2, "0")}</span>
		</p>
	);
}
