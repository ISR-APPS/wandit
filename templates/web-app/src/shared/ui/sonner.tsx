// Toast renderer wired to the semantic tokens.
// The root route mounts <Toaster /> once; any code can call toast().

import {
	CircleCheckIcon,
	InfoIcon,
	LoaderCircleIcon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** The toast area. The theme is fixed, so it must match the class on <html>. */
function Toaster({ ...props }: ToasterProps) {
	return (
		<Sonner
			// The app sets no dark class by default, so a dark OS must not darken the toasts.
			// The mode=dark step of the app-dashboard skill sets "dark" here too.
			theme="light"
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <LoaderCircleIcon className="size-4 animate-spin" />,
			}}
			style={
				// SAFETY: sonner accepts CSS custom properties here; CSSProperties lacks them.
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}

export { Toaster };
