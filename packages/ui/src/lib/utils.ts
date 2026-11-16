/**
 * Class name helper of the UI kit. `cn` joins class values, and the last
 * Tailwind class of each kind wins. Every kit component and every app calls
 * it. It calls clsx and a tailwind-merge that knows the named kit shadows.
 */

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
				{
					shadow: [
						"shell",
						"card",
						"composer",
						"panel",
						"modal",
						"segment",
						// The depth shadows of the V2 workspace controls.
						"raised",
						"well",
						"key",
						"ember",
					],
				},
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
