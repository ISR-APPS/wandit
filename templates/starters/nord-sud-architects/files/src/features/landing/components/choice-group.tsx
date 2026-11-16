// A group of square choice tags for the study request: one radio input for each option, styled as a tag.
// StudyRequest renders two of them, the project type and the plot location. The chosen tag is filled with ink.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/styles";

type ChoiceGroupProps = {
	/** The text key of the group legend, for example "Project type". */
	legend: TranslationKey;
	/** The name of the radio inputs of the group. It is unique on the page. */
	name: string;
	options: readonly TranslationKey[];
	value: TranslationKey;
	onChange: (value: TranslationKey) => void;
};

/** A row of square choice tags. Native radio inputs keep the keyboard and screen reader behavior. */
export function ChoiceGroup({
	legend,
	name,
	options,
	value,
	onChange,
}: ChoiceGroupProps) {
	const { t } = useT();
	return (
		<fieldset>
			<legend
				className={`${LABEL} mb-3 font-normal text-[0.625rem] text-foreground/70`}
			>
				{t(legend)}
			</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const isChosen = option === value;
					return (
						<label
							key={option}
							className={cn(
								"inline-flex min-h-11 cursor-pointer items-center border-[1.5px] px-3.5 py-2 text-[0.9375rem] transition-colors duration-150 ease-linear has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foreground has-[:focus-visible]:outline-offset-2",
								isChosen
									? "border-foreground bg-foreground text-background"
									: "border-foreground/35 hover:border-foreground",
							)}
						>
							<input
								type="radio"
								name={name}
								value={option}
								checked={isChosen}
								onChange={() => onChange(option)}
								className="sr-only"
							/>
							{t(option)}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}
