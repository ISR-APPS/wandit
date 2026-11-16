// A round avatar with the initials of a person: a student or an instructor.
// The tables, the lists of the home, the course cards, and the side panels render it.
// The sample rows have no photo, so it always shows the initials on one of five theme tints.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

// The tints of the avatars. Ink text keeps 4.5:1 on each of them.
const AVATAR_TINTS = [
	"bg-secondary",
	"bg-accent",
	"bg-chart-3/30",
	"bg-chart-2/25",
	"bg-chart-5/30",
] as const;

// The same name always gets the same tint: the sum of its character codes picks it.
function tintOf(name: string): string {
	const sum = Array.from(name).reduce(
		(total, character) => total + (character.codePointAt(0) ?? 0),
		0,
	);
	return AVATAR_TINTS[sum % AVATAR_TINTS.length] ?? AVATAR_TINTS[0];
}

type PersonAvatarProps = {
	/** The full name. The avatar shows its initials, and screen readers skip it: the name is always beside it. */
	name: string;
	/** Size and text size classes, for example "size-6 text-xs". The default is size-8. */
	className?: string;
};

/** Decorative: the caller shows or announces the name next to it. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
	return (
		<Avatar
			aria-hidden="true"
			className={cn("border border-border text-xs", className)}
		>
			<AvatarFallback
				className={cn(
					"font-semibold text-[length:inherit] text-foreground",
					tintOf(name),
				)}
			>
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
