// The initials of a patient or a practitioner in a round frame.
// The lists, the agenda, the board, and the detail pages render it beside a name.
// The practice keeps no photos, so the avatar never loads an image.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type PersonAvatarProps = {
	/** The full name. A title such as "Dr." does not count for the initials. */
	name: string;
	/** "staff" gives the accent tint of a practitioner. "patient" is neutral. */
	tone?: "patient" | "staff";
	/** A size class, for example "size-10". The default is 2rem. */
	className?: string;
};

/** The name stays beside the avatar on every page, so screen readers skip the initials. */
export function PersonAvatar({
	name,
	tone = "patient",
	className,
}: PersonAvatarProps) {
	return (
		<Avatar className={className} aria-hidden="true">
			<AvatarFallback
				className={cn(
					"font-medium text-xs",
					tone === "staff" && "bg-primary/12 text-accent-foreground",
				)}
			>
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
