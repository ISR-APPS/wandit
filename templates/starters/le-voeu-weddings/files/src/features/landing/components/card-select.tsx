// A choice field of the reply card: a native select with no box, one gold underline, and a small caret.
// ReplyCard renders it inside CardField for the place and the guest count.
// The value is the index of a choice, so the options can change language with no data change.
import { type TranslationKey, useT } from "~/shared/i18n";
import { CaretDownIcon } from "~/shared/ui/icons";

type CardSelectProps = {
	/** The id that the label of CardField points to. */
	fieldId: string;
	/** Keys of the choices, in order. The value is the index of a choice. */
	optionKeys: readonly TranslationKey[];
	/** Index of the selected choice in `optionKeys`. */
	selectedIndex: number;
	/** Called with the index of the new choice. */
	onSelect: (index: number) => void;
};

/** A native select with no box: one gold underline and a small caret at the end. */
export function CardSelect({
	fieldId,
	optionKeys,
	selectedIndex,
	onSelect,
}: CardSelectProps) {
	const { t } = useT();
	return (
		<div className="relative">
			<select
				id={fieldId}
				value={selectedIndex}
				onChange={(event) => onSelect(Number(event.target.value))}
				className="voeu-field cursor-pointer pe-7"
			>
				{optionKeys.map((optionKey, index) => (
					<option key={optionKey} value={index}>
						{t(optionKey)}
					</option>
				))}
			</select>
			<CaretDownIcon className="pointer-events-none absolute end-1 top-1/2 size-3.5 -translate-y-1/2 text-foreground/60" />
		</div>
	);
}
