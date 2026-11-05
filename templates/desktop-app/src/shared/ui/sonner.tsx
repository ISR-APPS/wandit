// Toast renderer wired to the semantic tokens.
// The root route mounts <Toaster /> once; any code can call toast().
// The toast box reads the --overlay-* role tokens of src/styles/engine.css, like a menu.

import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
	CheckCircleIcon,
	CircleNotchIcon,
	InfoIcon,
	WarningIcon,
	XCircleIcon,
} from "~/shared/ui/icons";
import { useAppTheme } from "~/styles/theme";

/** The toast area. Its theme is the mode of theme.json, the same value that puts the dark class on <html>. */
function Toaster({ ...props }: ToasterProps) {
	const { selection } = useAppTheme();
	return (
		<Sonner
			// A fixed theme, not "system": a dark OS must not darken the toasts of a light app.
			theme={selection.mode}
			className="toaster group"
			icons={{
				success: <CheckCircleIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <WarningIcon className="size-4" />,
				error: <XCircleIcon className="size-4" />,
				loading: <CircleNotchIcon className="size-4 animate-spin" />,
			}}
			toastOptions={{
				classNames: {
					// sonner styles the toast with two attribute selectors, so a plain utility loses. The ! makes the token win.
					// The important shadow also hides the sonner focus shadow. The ring adds the focus mark back for the keyboard.
					toast:
						"border-(length:--overlay-border-width)! border-(--overlay-border-color)! shadow-(--overlay-shadow)! focus-visible:ring-[3px] focus-visible:ring-ring/50",
				},
			}}
			style={
				// SAFETY: sonner accepts CSS custom properties here; CSSProperties lacks them.
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--overlay-radius)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}

export { Toaster };
