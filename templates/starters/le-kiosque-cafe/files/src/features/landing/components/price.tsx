// A menu price in bold lining figures, for example "€4.20". The menu section renders one per classified ad.
// It formats the euro amount of lib/content.ts with Intl in the page language.
import { useT } from "~/shared/i18n";

/** Bold euro price that never wraps away from its sentence. */
export function Price({
	euros,
}: {
	/** The price in euros, service included. */
	euros: number;
}) {
	const { locale } = useT();
	const text = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: 2,
	}).format(euros);
	return (
		<span className="whitespace-nowrap font-bold lining-nums tabular-nums">
			{text}
		</span>
	);
}
