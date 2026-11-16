// One choice of the visit request: a native select with a small bronze label above it.
// VisitRequest renders two of them, the villa and the evening. It reads the option texts through t().
import { type ReactNode, useId } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CaretDownIcon } from "~/shared/ui/icons";
import { KEY_LABEL } from "../lib/type-styles";

type RequestFieldProps = {
	/** The small bronze label above the field. Already translated. */
	label: string;
	/** Keys of the choices, in order. The value of the field is the index of a choice. */
	optionKeys: readonly TranslationKey[];
	/** Index of the selected choice in `optionKeys`. */
	selectedIndex: number;
	/** Called with the index of the new choice. */
	onSelect: (index: number) => void;
};

/** A native select with no box: a label above, and one rule under the value. */
export function RequestField({
	label,
	optionKeys,
	selectedIndex,
	onSelect,
}: RequestFieldProps): ReactNode {
	const { t } = useT();
	const fieldId = useId();
	return (
		<div className="grid min-w-0 gap-2">
			<label htmlFor={fieldId} className={cn(KEY_LABEL, "leading-none")}>
				{label}
			</label>
			<div className="relative">
				<select
					id={fieldId}
					value={selectedIndex}
					onChange={(event) => onSelect(Number(event.target.value))}
					className="min-h-11 w-full cursor-pointer appearance-none truncate border-foreground/24 border-b bg-transparent py-[0.6rem] pe-7 text-[1rem] transition-colors duration-300 hover:border-(--dlp-bronze-deep) focus:border-(--dlp-bronze-deep)"
				>
					{optionKeys.map((optionKey, index) => (
						<option key={optionKey} value={index}>
							{t(optionKey)}
						</option>
					))}
				</select>
				<CaretDownIcon className="pointer-events-none absolute end-1 top-1/2 size-3.5 -translate-y-1/2 text-(--dlp-bronze-deep)" />
			</div>
		</div>
	);
}
