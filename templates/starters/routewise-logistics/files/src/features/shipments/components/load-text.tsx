// The size of a load as one text: "6 pallets · 1,840 kg".
// The shipment slips of the driver and vehicle panels render it.
import { fillMessage, pluralForm, weightFormat } from "~/features/logistics";
import { useT } from "~/shared/i18n";

type LoadTextProps = {
	pallets: number;
	/** Whole kilograms. */
	weightKg: number;
};

/** The pallet count has a singular and a plural message. The weight uses the Intl unit format. */
export function LoadText({ pallets, weightKg }: LoadTextProps) {
	const { t, locale } = useT();
	const palletText = fillMessage(
		t(`load.pallets.${pluralForm(pallets, locale)}`),
		{ count: new Intl.NumberFormat(locale).format(pallets) },
	);
	return (
		<span className="tabular-nums">
			{`${palletText} · ${weightFormat(locale).format(weightKg)}`}
		</span>
	);
}
