// The round initials of a person: an employee or a candidate. Lists, the pipeline board, and the profile show it.
// The tint comes from the chart tokens, picked from the name, so one person keeps one tint on every page.
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";

// Light tints of the chart tokens. Foreground text keeps its contrast on each of them.
const TINTS = [
	"bg-chart-1/15",
	"bg-chart-2/20",
	"bg-chart-3/20",
	"bg-chart-4/25",
	"bg-chart-5/25",
] as const;

type PersonAvatarProps = {
	/** The full name, for example "Amara Okafor". The initials and the tint come from it. */
	name: string;
	/** Size classes, for example "size-12 text-base". The default is the kit size-8. */
	className?: string;
};

/** Initials in a tinted circle. It is decorative: the name always shows next to it. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
	const initials = name
		.split(" ")
		.map((part) => part.charAt(0))
		.slice(0, 2)
		.join("");
	// A stable small hash of the name picks the tint.
	const hash = [...name].reduce(
		(sum, character) => (sum * 31 + character.charCodeAt(0)) % 9973,
		7,
	);
	return (
		<Avatar className={cn("size-8", className)} aria-hidden>
			<AvatarFallback
				className={cn(
					"font-medium text-foreground text-xs",
					TINTS[hash % TINTS.length],
				)}
			>
				{initials}
			</AvatarFallback>
		</Avatar>
	);
}
