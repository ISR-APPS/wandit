// One question of the consultation request: a legend and its answers as native radio inputs drawn as ruled rows.
// RequestFolder renders two of them. A native radio keeps the keyboard and the screen reader behavior.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type ChoiceGroupProps = {
	/** The question above the choices, in brass small caps. */
	legend: TranslationKey;
	/** Groups the radios, so only one answer stays checked. Also the field name for a later real form. */
	name: string;
	options: readonly TranslationKey[];
	value: TranslationKey;
	onChange: (value: TranslationKey) => void;
};

/** One radio group drawn as ruled rows, two columns from 640px. A checked row takes a brass rule and a filled brass circle. */
export function ChoiceGroup({
	legend,
	name,
	options,
	value,
	onChange,
}: ChoiceGroupProps) {
	const { t } = useT();
	return (
		<fieldset className="m-0 min-w-0 border-0 p-0">
			<legend
				className={cn(
					LABEL,
					"mb-3 text-(--vt-brass) text-[10.5px] leading-snug",
				)}
			>
				{t(legend)}
			</legend>
			<div className="grid gap-x-6 sm:grid-cols-2">
				{options.map((option) => (
					<label
						key={option}
						className="vt-line group flex min-h-11 cursor-pointer items-center gap-3 border-b py-2 transition-colors hover:border-(--vt-brass) has-[:checked]:border-(--vt-brass) has-[:focus-visible]:outline-(--vt-brass) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4"
					>
						<input
							type="radio"
							name={name}
							value={option}
							checked={value === option}
							onChange={() => onChange(option)}
							className="sr-only"
						/>
						<span
							aria-hidden="true"
							className="vt-line grid size-3.5 shrink-0 place-items-center rounded-full border group-has-[:checked]:border-(--vt-brass)"
						>
							<span className="size-1.5 rounded-full bg-(--vt-brass) opacity-0 transition-opacity group-has-[:checked]:opacity-100" />
						</span>
						<span className="text-(--vt-ink-70) text-[0.95rem] group-has-[:checked]:text-(--vt-ink)">
							{t(option)}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
