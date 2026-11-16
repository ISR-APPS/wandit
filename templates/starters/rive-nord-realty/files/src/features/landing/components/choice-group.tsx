// A row of radio chips with a legend: one choice of the listing slip (type of home, or district).
// ListingSlip renders two of them. The labels are message keys of messages.ts.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type ChoiceGroupProps = {
	/** Visible legend of the group, also its accessible name. */
	legend: string;
	/** Form name of the radio group, also the base of the legend id. Two groups on the page need two names. */
	name: string;
	options: readonly TranslationKey[];
	value: TranslationKey;
	onChange: (value: TranslationKey) => void;
};

/** A row of radio chips. The native radios keep arrow-key moves and screen reader states. */
export function ChoiceGroup({
	legend,
	name,
	options,
	value,
	onChange,
}: ChoiceGroupProps) {
	const { t } = useT();
	return (
		<div className="border-foreground/12 border-b px-4 pt-3 pb-3.5">
			<p
				id={`${name}-legend`}
				className={cn(LABEL, "mb-2.5 text-[10px] opacity-75")}
			>
				{legend}
			</p>
			<div
				role="radiogroup"
				aria-labelledby={`${name}-legend`}
				className="flex flex-wrap gap-1.5"
			>
				{options.map((option) => (
					<label
						key={option}
						className={cn(
							LABEL,
							"relative inline-flex min-h-11 cursor-pointer items-center border px-3 text-[11px] tracking-[0.1em] transition-colors has-focus-visible:outline-3 has-focus-visible:outline-primary has-focus-visible:outline-offset-2",
							value === option
								? "border-primary bg-primary text-primary-foreground"
								: "border-foreground/40 hover:border-foreground hover:bg-secondary",
						)}
					>
						<input
							type="radio"
							name={name}
							value={option}
							checked={value === option}
							onChange={() => onChange(option)}
							className="sr-only"
						/>
						{t(option)}
					</label>
				))}
			</div>
		</div>
	);
}
