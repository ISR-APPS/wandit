// A round mark with the initials of a person. The sample people have no photo.
// The driver table, the driver panel, and the contacts card of the shipment page render it beside a name.
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type PersonAvatarProps = {
	/** The full name. The mark shows its first and last initial. */
	name: string;
	/** A size class, for example "size-10". The default is the 2rem of the kit Avatar. */
	className?: string;
};

/** Decorative: the name is always beside it, so screen readers skip the initials. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
	return (
		<Avatar aria-hidden="true" className={className}>
			<AvatarFallback className="bg-accent font-medium text-accent-foreground text-xs">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
