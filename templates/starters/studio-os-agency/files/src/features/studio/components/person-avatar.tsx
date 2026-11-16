// A round avatar with the initials of a studio member.
// The tables, the sheets, and the project team card render it next to the name.
// The sample members have no photo, so it always shows the initials.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";

type PersonAvatarProps = {
	/** The full name. The avatar shows its initials; screen readers skip it, because the name is beside it. */
	name: string;
	/** Size and text classes, for example "size-6 text-[0.625rem]". The default is size-8. */
	className?: string;
};

/** The first letter of the first and the last word of a name: "Maya Okafor" gives "MO". */
function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = words[0]?.[0] ?? "";
	const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
	return `${first}${last}`;
}

/** Decorative: the caller shows the name next to it. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
	return (
		<Avatar aria-hidden="true" className={cn("text-xs", className)}>
			<AvatarFallback className="bg-secondary font-semibold text-[length:inherit] text-secondary-foreground">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
