// Toast renderer wired to the semantic tokens.
// The root route mounts <Toaster /> once; any code can call toast().

import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "~/components/ui/icons";

function Toaster({ ...props }: ToasterProps) {
	return (
		<Sonner
			theme="system"
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
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
