// The initials of a person in a small frame: a member, or a coach in the coaches strip of the home.
// The member list, the member page, the class roster, and the home agenda render it beside the name.
// The gym keeps no member photos, so the avatar never loads an image.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/membership";

type MemberAvatarProps = {
	/** The full name of the member. The avatar shows its first and last initials. */
	name: string;
	/** A size class, for example "size-12". The default is 2rem. */
	className?: string;
};

/** The name always sits beside the avatar, so screen readers skip the initials. */
export function MemberAvatar({ name, className }: MemberAvatarProps) {
	return (
		<Avatar className={cn("rounded-control", className)} aria-hidden="true">
			<AvatarFallback className="rounded-control bg-accent font-medium font-numeric text-accent-foreground text-xs">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
