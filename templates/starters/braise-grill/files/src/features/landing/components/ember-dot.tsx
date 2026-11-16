// The live ember dot: a 9px ember circle with a slow pulsing halo. It marks "fire lit".
// The header wordmark and the tonight slate of the hero render it. landing.css draws the dot and the pulse.
import { cn } from "~/shared/lib/utils";

/** Decorative only. The world allows two per page, so do not add a third. */
export function EmberDot({
	isLate = false,
	className,
}: {
	/** True starts the pulse 0.35 s later, so two dots on one screen do not beat together. */
	isLate?: boolean;
	className?: string;
}) {
	return (
		<span aria-hidden="true" className={cn("br-dot", className)}>
			<span className={cn("br-halo", isLate && "br-halo--late")} />
		</span>
	);
}
