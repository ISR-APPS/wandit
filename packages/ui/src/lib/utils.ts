import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The named @theme shadows (globals.css) must be registered as box-shadow
// utilities: stock tailwind-merge reads "shadow-composer" as a shadow *color*,
// so a base "shadow-xs" survives the merge and wins over the design-system
// shadow in the final stylesheet.
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			shadow: [
				{ shadow: ["shell", "card", "composer", "panel", "modal", "segment"] },
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
