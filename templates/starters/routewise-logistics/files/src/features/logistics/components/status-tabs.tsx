// The status tabs of a list: "All" with its count, then one tab per status with its count.
// The shipment list renders it above its record table.
// The caller counts the rows and keeps the active tab in its own state.
import { useT } from "~/shared/i18n";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

/** One status tab. The caller leaves out a status with no rows. */
type StatusTab<Value extends string> = {
	value: Value;
	/** The status name, already translated. */
	label: string;
	/** The rows of this status in the list of the caller. */
	count: number;
};

type StatusTabsProps<Value extends string> = {
	/** The active tab: a status of `tabs`, or "all". */
	value: Value | "all";
	onValueChange: (value: Value | "all") => void;
	/** The label of the first tab, already translated. */
	allLabel: string;
	/** The rows of every status together. */
	allCount: number;
	tabs: StatusTab<Value>[];
};

/** The strip scrolls sideways on a phone and never wraps. A value that is not in `tabs` selects "all". */
export function StatusTabs<Value extends string>({
	value,
	onValueChange,
	allLabel,
	allCount,
	tabs,
}: StatusTabsProps<Value>) {
	const { locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Tabs
			value={value}
			onValueChange={(next) =>
				onValueChange(tabs.find((tab) => tab.value === next)?.value ?? "all")
			}
			// The end padding leaves a gap after the last tab when the strip scrolls to its end.
			className="max-w-full overflow-x-auto pe-4"
		>
			<TabsList>
				<TabsTrigger value="all">
					{allLabel}
					<span className="tabular-nums opacity-70">
						{number.format(allCount)}
					</span>
				</TabsTrigger>
				{tabs.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value}>
						{tab.label}
						<span className="tabular-nums opacity-70">
							{number.format(tab.count)}
						</span>
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
