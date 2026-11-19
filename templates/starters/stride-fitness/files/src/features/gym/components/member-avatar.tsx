// The initials of a member in a round avatar.
// The member tables, the member page, the at-risk feed, and the class roster render it beside the name.
// The gym keeps no member photos, so the avatar never loads an image.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/membership";

type MemberAvatarProps = {
	/** The full name of the member. The avatar shows its first and last initials. */
	name: string;
	/** A size class, for example "size-9". The default is 2rem. */
	className?: string;
	/** A text size class for the initials, for example "text-xl" on a big avatar. The default is "text-xs". */
	initialsClassName?: string;
};

/** The name always sits beside the avatar, so screen readers skip the initials. */
export function MemberAvatar({
	name,
	className,
	initialsClassName,
}: MemberAvatarProps) {
	return (
		<Avatar className={className} aria-hidden="true">
			<AvatarFallback
				className={cn(
					"bg-muted font-medium font-numeric text-xs",
					initialsClassName,
				)}
			>
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
