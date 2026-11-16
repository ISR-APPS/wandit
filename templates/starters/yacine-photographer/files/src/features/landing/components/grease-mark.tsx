// The grease-pencil loop around a kept frame of the contact sheet.
// contact-sheet-section.tsx renders one for each kept frame, with its tag.
// landing.css sets the stroke and the tilt of each variant.
import { cn } from "~/shared/lib/utils";

type GreaseMarkProps = {
	/** The tilt and the mirror of the loop, so no two marks on a sheet repeat. */
	variant: "a" | "b" | "c";
};

/** A hand-drawn path, not a rectangle: its start and its end overshoot where the crayon closes the loop. */
export function GreaseMark({ variant }: GreaseMarkProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 100 66"
			preserveAspectRatio="none"
			className={cn(
				"yr-grease",
				variant === "b" && "yr-grease-b",
				variant === "c" && "yr-grease-c",
			)}
		>
			<path d="M4.8 5.4C24 1.8 58 3.6 97.6 2.4C99.4 16 98.4 46 96.4 63.2C68 65.4 34 62.6 3.4 64.2C1.2 47 3.6 21 2.4 6.2C9 3.8 15.6 3.2 27.4 4.6" />
		</svg>
	);
}
