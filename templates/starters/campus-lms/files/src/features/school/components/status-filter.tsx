// The status filter of a list page: a row of tabs from the sm width, a select on a phone.
// The Courses, Students, and Assignments pages render it. Each option shows its row count.
// Five tabs do not fit in one row at 390 px. The select keeps every option in reach with a 44 px touch area.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

/** One choice of the filter. The texts are already translated. */
type StatusFilterOption<Value extends string> = {
	value: Value;
	label: string;
	/** The count of rows with this value, shown after the label. */
	count: number;
};

type StatusFilterProps<Value extends string> = {
	/** The choices in display order, "all" included when the page has it. */
	options: StatusFilterOption<Value>[];
	value: Value;
	onValueChange: (value: Value) => void;
	/** The width of the slot, for example "w-full sm:w-auto". */
	className?: string;
};

/** Both controls show the same state. CSS shows one of them, so a screen reader finds only the visible one. */
export function StatusFilter<Value extends string>({
	options,
	value,
	onValueChange,
	className,
}: StatusFilterProps<Value>) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// Radix gives a plain string. Only a value of the options changes the state.
	const select = (next: string) => {
		const option = options.find((item) => item.value === next);
		if (option) {
			onValueChange(option.value);
		}
	};

	return (
		<div className={cn("min-w-0", className)}>
			<Select value={value} onValueChange={select}>
				<SelectTrigger
					aria-label={t("common.status")}
					className="h-11 sm:hidden"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							className="min-h-11"
						>
							{option.label}
							<span className="ms-1.5 text-muted-foreground tabular-nums">
								{number.format(option.count)}
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Tabs value={value} onValueChange={select} className="max-sm:hidden">
				<TabsList
					aria-label={t("common.status")}
					className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"
				>
					{options.map((option) => (
						<TabsTrigger key={option.value} value={option.value}>
							{option.label}
							<span className="text-muted-foreground tabular-nums">
								{number.format(option.count)}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	);
}
