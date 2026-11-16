// The filter of a list page: one tab per choice with its row count, or a Select on a phone.
// The transactions, cards, payees, and statements pages render it in their toolbar. The parent holds the value.
// It reads the phone flag of the sidebar, so it renders inside the app shell only.
import { useT } from "~/shared/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { useSidebar } from "~/shared/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

/** One choice of FilterTabs. `count` is the number of rows that the choice shows, so it must match the table. */
type FilterOption<Value extends string> = {
	value: Value;
	/** The name of the choice, already translated. */
	label: string;
	count: number;
};

type FilterTabsProps<Value extends string> = {
	/** The choice on show. */
	value: Value;
	options: FilterOption<Value>[];
	onValueChange: (value: Value) => void;
	/** The accessible name of the Select on a phone, for example "Group". */
	label: string;
};

/** Five or more tabs do not fit in the 340 px of a phone toolbar, so a phone gets a Select of 44 px. */
export function FilterTabs<Value extends string>({
	value,
	options,
	onValueChange,
	label,
}: FilterTabsProps<Value>) {
	const { locale } = useT();
	const { isMobile } = useSidebar();
	const number = new Intl.NumberFormat(locale);
	// Radix gives a plain string. The lookup gives back the typed value and ignores an unknown one.
	const choose = (raw: string) => {
		const option = options.find((item) => item.value === raw);
		if (option) {
			onValueChange(option.value);
		}
	};

	if (isMobile) {
		return (
			<Select value={value} onValueChange={choose}>
				<SelectTrigger aria-label={label} className="h-11 w-fit">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
							<span className="ms-1.5 text-muted-foreground tabular-nums">
								{number.format(option.count)}
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}
	return (
		<Tabs
			value={value}
			onValueChange={choose}
			className="max-w-full overflow-x-auto"
		>
			<TabsList>
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
	);
}
