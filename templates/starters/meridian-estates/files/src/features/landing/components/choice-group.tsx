// One question of the viewing note as a group of ruled radio lines. A checked line shows a bronze tick.
// ViewingNote renders two of them: the house and the time of day. The native radio stays in the page,
// so the arrow keys, the focus ring, and the screen readers work as with any radio group.
import { type TranslationKey, useT } from "~/shared/i18n";
import type { ViewingChoice } from "../lib/content";

type ChoiceGroupProps = {
	legend: TranslationKey;
	/** The name of the radio inputs. Unique on the page. */
	name: string;
	choices: readonly ViewingChoice[];
	/** The id of the checked choice. */
	value: string;
	onChange: (id: string) => void;
	/** "list" stacks full-width lines; "row" sets short choices side by side from the sm breakpoint. */
	layout: "list" | "row";
};

/** A fieldset of ruled lines, each at least 44 px tall for touch. */
export function ChoiceGroup({
	legend,
	name,
	choices,
	value,
	onChange,
	layout,
}: ChoiceGroupProps) {
	const { t } = useT();
	return (
		<fieldset>
			<legend className="mb-3 text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
				{t(legend)}
			</legend>
			<div
				className={
					layout === "row"
						? "grid border-foreground/14 border-t sm:grid-cols-3 sm:gap-x-6"
						: "grid border-foreground/14 border-t"
				}
			>
				{choices.map((choice) => (
					<label
						key={choice.id}
						className="group flex min-h-12 cursor-pointer items-center gap-4 border-foreground/14 border-b py-3 transition-colors duration-300 has-[:checked]:border-primary/60 has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-4"
					>
						<input
							type="radio"
							name={name}
							value={choice.id}
							checked={value === choice.id}
							onChange={() => onChange(choice.id)}
							className="peer sr-only"
						/>
						<span
							aria-hidden="true"
							className="h-px w-7 shrink-0 scale-x-[0.4] bg-foreground/30 transition duration-300 peer-checked:scale-x-100 peer-checked:bg-primary ltr:origin-left rtl:origin-right"
						/>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
							<span className="text-[1rem] text-foreground/75 transition-colors duration-300 group-hover:text-foreground group-has-[:checked]:text-foreground">
								{choice.label.map((key) => t(key)).join(" ")}
							</span>
							{choice.detail === null ? null : (
								<span className="text-[0.65625rem] text-foreground/55 uppercase tracking-[0.16em]">
									{t(choice.detail)}
								</span>
							)}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
