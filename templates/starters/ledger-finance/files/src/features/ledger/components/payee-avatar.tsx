// The round mark before a payee name: the first letter for income, the category icon for an expense or a transfer.
// The transaction tables of the home, the transactions page, and the detail pages render it.
// The tint follows the type of the entry, so money in and money out read apart at a glance.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import type { CategoryId } from "../lib/categories";
import { CATEGORY_ICONS } from "../lib/category-icons";
import type { TransactionType } from "../lib/sample-transactions";

// The tint of each type. Income is the good news color, a transfer is neutral information.
const TYPE_TINTS = {
	income: "bg-success/15 text-success",
	expense: "bg-muted text-foreground",
	transfer: "bg-info/15 text-info",
} satisfies Record<TransactionType, string>;

type PayeeAvatarProps = {
	payee: string;
	type: TransactionType;
	categoryId: CategoryId;
	/** The size class of the circle, for example "size-8". The kit default is size-10. */
	className?: string;
};

/** Decorative: the payee name and the category label always sit next to it. */
export function PayeeAvatar({
	payee,
	type,
	categoryId,
	className,
}: PayeeAvatarProps) {
	const { locale } = useT();
	const Icon = CATEGORY_ICONS[categoryId];
	return (
		<Avatar aria-hidden="true" className={cn("size-10", className)}>
			<AvatarFallback className={cn("font-medium", TYPE_TINTS[type])}>
				{type === "income" ? (
					// Array.from splits by code point, so a first emoji or astral letter stays whole.
					(Array.from(payee)[0] ?? "").toLocaleUpperCase(locale)
				) : (
					<Icon className="size-4" />
				)}
			</AvatarFallback>
		</Avatar>
	);
}
