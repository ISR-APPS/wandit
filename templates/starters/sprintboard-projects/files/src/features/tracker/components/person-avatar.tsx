// A round avatar with the initials of a team member.
// The board cards, the tables, the task dialog, and the Team page render it.
// The sample members have no photo, so it always shows the initials.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type PersonAvatarProps = {
	/** The full name. The avatar shows its initials, and screen readers skip it: the name is always beside it. */
	name: string;
	/** Size and text size classes, for example "size-6 text-[0.625rem]". The default is size-8. */
	className?: string;
};

/** Decorative: the caller shows or announces the name next to it. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
	return (
		<Avatar aria-hidden="true" className={cn("text-xs", className)}>
			<AvatarFallback className="bg-secondary font-medium text-[length:inherit] text-secondary-foreground">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
