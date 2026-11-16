// The icon of a transaction type in a small tinted circle: an arrow in for a buy, an arrow out for a sell.
// The activity list of the home, the Activity table, and the transaction panel render it before the type name.
import {
	ArrowDownLeftIcon,
	ArrowUpRightIcon,
	CoinsIcon,
	TrayArrowDownIcon,
	TrayArrowUpIcon,
} from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";
import type { KitIcon } from "~/shared/ui/icons";
import type { TransactionType } from "../lib/ledger-codes";

/** One icon per type. An arrow that points down-left brings units in. */
const TYPE_ICONS = {
	buy: ArrowDownLeftIcon,
	sell: ArrowUpRightIcon,
	deposit: TrayArrowDownIcon,
	withdrawal: TrayArrowUpIcon,
	reward: CoinsIcon,
} satisfies Record<TransactionType, KitIcon>;

/** The tint tells the direction: green for units in, the warning tint for a reward, neutral for units out. */
const TYPE_TINT = {
	buy: "bg-success/12 text-success",
	sell: "bg-muted text-foreground",
	deposit: "bg-success/12 text-success",
	withdrawal: "bg-muted text-foreground",
	reward: "bg-warning/12 text-warning",
} satisfies Record<TransactionType, string>;

type TransactionTypeIconProps = {
	type: TransactionType;
	className?: string;
};

/** Decoration only: the type name beside it gives the meaning, so screen readers skip the icon. */
export function TransactionTypeIcon({
	type,
	className,
}: TransactionTypeIconProps) {
	const Icon = TYPE_ICONS[type];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-full",
				TYPE_TINT[type],
				className,
			)}
		>
			{/* The arrows point the same way in Arabic: in and out are not reading directions. */}
			<Icon className="size-4" />
		</span>
	);
}
