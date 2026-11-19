// A tile with the initials of a name: the picture of an item, or the avatar of a supplier.
// The tables, the lists, and the item page render it. The sample rows have no photo, so it always shows text.
import { cn } from "~/shared/lib/utils";
import { initialsOf } from "../lib/format";

type InitialsTileProps = {
	/** The item or supplier name. The tile shows its initials, and screen readers skip it: the name is always beside it. */
	name: string;
	/** Size and text size classes, for example "size-10 text-sm". Add "rounded-full" for a person or a supplier. */
	className?: string;
};

/** Decorative: the caller shows the name next to it. */
export function InitialsTile({ name, className }: InitialsTileProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted font-medium text-muted-foreground text-xs",
				className,
			)}
		>
			{initialsOf(name)}
		</span>
	);
}
