// A round avatar with the initials of a name: an agent, a customer contact, or a customer company.
// The home table, the ticket pages, and the customer list render it. No photo exists for these people or companies.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type PersonAvatarProps = {
	/** The full name. The avatar shows its initials. */
	name: string;
	/** "agent" draws the team in the primary tint, so a reader tells the team from customers. */
	tone?: "agent" | "customer";
	/** Extra classes, for example a size: `size-6`. */
	className?: string;
};

/** Initials in a circle. The name stays for screen readers in the text next to it, so the avatar is hidden. */
export function PersonAvatar({
	name,
	tone = "customer",
	className,
}: PersonAvatarProps) {
	return (
		<Avatar aria-hidden="true" className={cn("size-7", className)}>
			<AvatarFallback
				className={cn(
					"font-medium text-xs",
					tone === "agent" && "bg-primary/15 text-foreground",
				)}
			>
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
