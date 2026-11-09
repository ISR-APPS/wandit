// shadcn-style avatar on the Radix avatar primitive (port of shadcn/ui, MIT).
// The user menu of the sidebar shows the initials of the signed-in email with it.
// The fallback shows until the image loads, or always when there is no image.

import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** A round 2rem frame for a picture or initials. Change the size and the shape with classes. */
function Avatar({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			className={cn(
				"relative flex size-8 shrink-0 select-none overflow-hidden rounded-full",
				className,
			)}
			{...props}
		/>
	);
}

/** The picture. Radix shows it only after it loads. */
function AvatarImage({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			className={cn("aspect-square size-full", className)}
			{...props}
		/>
	);
}

/** Initials or an icon, shown while the image loads or when there is none. */
function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Avatar, AvatarFallback, AvatarImage };
