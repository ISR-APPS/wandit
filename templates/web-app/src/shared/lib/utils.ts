// Class-name helper used by every shadcn-style component.
// Components call cn() to merge variant classes with caller overrides.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional classes and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
