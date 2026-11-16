// The initials of a team member or a contact in a small circle.
// The file tables, the share lists, the feed, and the file page render it next to a name.
// The name beside it carries the meaning, so the circle is hidden from screen readers.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { initialsOf } from "../lib/format";

type MemberAvatarProps = {
	/** The full name. The circle shows its initials. */
	name: string;
	/** sm is the row size (24 px); md is the list size (32 px). */
	size?: "sm" | "md";
	className?: string;
};

/** An initials avatar. Contacts outside the team use the same circle. */
export function MemberAvatar({
	name,
	size = "sm",
	className,
}: MemberAvatarProps) {
	return (
		<Avatar
			aria-hidden
			className={cn(size === "sm" ? "size-6" : "size-8", className)}
		>
			<AvatarFallback
				className={cn(
					"bg-secondary font-medium text-secondary-foreground",
					size === "sm" ? "text-[0.625rem]" : "text-xs",
				)}
			>
				{initialsOf(name)}
			</AvatarFallback>
		</Avatar>
	);
}
