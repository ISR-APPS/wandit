// The round initials of a sales rep. The reps list, the rep page, and the order tables show it.
// The team has no photos, so the initials stand in for one.
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type RepAvatarProps = {
	/** The full name of the rep. */
	name: string;
	/** A size class, for example "size-12". The default is size-8, the size of a table row. */
	className?: string;
};

/** Initials on a tint of the brand color. The name next to it names the rep, so screen readers skip it. */
export function RepAvatar({ name, className }: RepAvatarProps) {
	return (
		<Avatar aria-hidden className={className}>
			<AvatarFallback className="bg-primary/15 font-medium text-foreground text-xs">
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
