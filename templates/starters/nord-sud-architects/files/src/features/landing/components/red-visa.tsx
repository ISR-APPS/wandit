// The red visa of the contact section: "Approved for study", the initials, and the month, in a wobbly hand frame.
// ContactSection renders it near the call to action. It is the third and last red pencil moment of the page.
// The frame plots like a figure when use-scroll-reveal.ts shows it. The text stays visible: it is the message.
import { useT } from "~/shared/i18n";
import { useCurrentMonth } from "../hooks/use-current-month";
import { LABEL } from "../lib/styles";

/** A stamp rotated by about 2 degrees. The visa date is the month of the visit, as "MM.YY". */
export function RedVisa() {
	const { t } = useT();
	const month = useCurrentMonth();
	// "11.2026" becomes "11.26", the short date of a hand visa.
	const shortMonth =
		month === null ? "" : `${month.slice(0, 3)}${month.slice(-2)}`;
	return (
		<div data-reveal className="ns-figure ns-visa relative inline-block">
			<div className="plot-step plot-lines">
				<svg
					aria-hidden="true"
					className="absolute inset-0 size-full overflow-visible"
					viewBox="0 0 300 46"
					preserveAspectRatio="none"
				>
					<path
						className="ns-red plot"
						pathLength={1}
						d="M16,6.5 C70,3.5 150,5.5 286,4.5 C291,13 289.5,25 291,40.5 C226,44 96,41.5 13,42.5 C9,33 10.5,21 12,11.5 C12.6,7.6 15,6.4 22,6.2"
					/>
				</svg>
			</div>
			<p className={`${LABEL} relative px-[18px] py-3 text-primary`}>
				{t("contact.visa")}{" "}
				{/* The month is empty in the prerendered page. The fixed cell keeps the frame width at hydration. */}
				<span className="inline-block min-w-[6ch] tabular-nums">
					{shortMonth}
				</span>
			</p>
		</div>
	);
}
