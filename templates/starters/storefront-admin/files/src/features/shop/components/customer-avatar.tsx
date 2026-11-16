// A round avatar with the initials of a customer.
// The customer table, the customer panel, the order page, and the home list render it.
// The sample customers have no photo, so it always shows the initials.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type CustomerAvatarProps = {
	/** The full name. The avatar shows its initials, and screen readers skip it: the name is always beside it. */
	name: string;
	/** Size and text size classes, for example "size-12 text-base". The default is size-8. */
	className?: string;
};

/** Decorative: the caller shows the name next to it. */
export function CustomerAvatar({ name, className }: CustomerAvatarProps) {
	return (
		<Avatar aria-hidden="true" className={cn("text-xs", className)}>
			<AvatarFallback className="bg-secondary font-medium text-[length:inherit] text-secondary-foreground">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
