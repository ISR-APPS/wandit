// The round initials of one person: an agent, a lead, or a seller.
// The tables, the agenda, and the side panels render it beside a name.
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type PersonAvatarProps = {
	/** The full name. The avatar shows its initials, and the name is its tooltip text. */
	fullName: string;
	/** Size and tint classes, for example "size-10". The default size is 2rem. */
	className?: string;
};

/** Initials on the secondary tint of the theme. It shows no picture: the sample people have none. */
export function PersonAvatar({ fullName, className }: PersonAvatarProps) {
	return (
		<Avatar className={className} title={fullName}>
			<AvatarFallback className="bg-secondary font-medium text-secondary-foreground text-xs">
				{initialsOf(fullName)}
			</AvatarFallback>
		</Avatar>
	);
}
