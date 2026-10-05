/**
 * The tactile button of the landing page: a spark face on a solid bottom edge.
 * The face sinks onto the edge on press, like a key. The hero, the nav, the
 * ideas wall, and the closing panel use it. The dashboard prompt box and its
 * empty state get it through the landing barrel. Plain <button>, so the
 * caller sets type and handlers.
 */

import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";

/** `lg` in the ideas wall and the closing panel, `md` in the hero prompt box, `sm` in the nav. */
type KeycapSize = "sm" | "md" | "lg";

type KeycapButtonProps = React.ComponentProps<"button"> & {
	size?: KeycapSize;
};

// The edge height is the press depth: the face moves down by the same amount.
const SIZE_CLASS = {
	sm: "h-9 gap-1.5 rounded-xl px-3.5 text-sm [--keycap-depth:3px]",
	md: "h-10 gap-2 rounded-xl px-4 text-[15px] [--keycap-depth:4px]",
	lg: "h-14 gap-2.5 rounded-2xl px-6 text-lg [--keycap-depth:5px]",
} as const;

/**
 * The keycap look as a class string. The nav uses it on its dashboard
 * <Link>, which must be a real link and not a button.
 */
export function keycapClassName(size: KeycapSize = "lg") {
	return cn(
		"inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap font-grotesk font-semibold tracking-tight",
		"bg-spark text-night [--keycap-edge:var(--color-spark-deep)] focus-visible:outline-white",
		"shadow-[0_var(--keycap-depth)_0_var(--keycap-edge)] outline-offset-4 transition-[translate,box-shadow] duration-100 ease-out",
		"hover:-translate-y-px hover:shadow-[0_calc(var(--keycap-depth)+1px)_0_var(--keycap-edge)]",
		"active:translate-y-(--keycap-depth) active:shadow-none",
		"focus-visible:outline-2",
		"disabled:pointer-events-none disabled:opacity-60",
		SIZE_CLASS[size],
	);
}

/** A press-down button. The white focus outline suits ember ground; a caller on paper overrides it. */
export function KeycapButton({
	size = "lg",
	className,
	...props
}: KeycapButtonProps) {
	return <button className={cn(keycapClassName(size), className)} {...props} />;
}
