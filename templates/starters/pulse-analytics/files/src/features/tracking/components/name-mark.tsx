// The mark of an account or a person: a small tile with two initials.
// The account lists, the home, and the people table of the account page render it before a name.
import { cn } from "~/shared/lib/utils";
import { initialsOf } from "../lib/format";

type NameMarkProps = {
	/** The name of the account or the person. The tile shows its initials. */
	name: string;
	className?: string;
};

/** The name stands beside the tile, so screen readers skip the initials. */
export function NameMark({ name, className }: NameMarkProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-control bg-accent font-medium text-accent-foreground text-xs",
				className,
			)}
		>
			{initialsOf(name)}
		</span>
	);
}
