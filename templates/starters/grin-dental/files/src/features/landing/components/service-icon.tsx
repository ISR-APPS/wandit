// The six drawn icons of the services grid, in the sticker style: flat fills and ink outlines.
// ServiceCard renders one inside its tilted tile. Decorative: the card title names the service.
import type { ServiceIconKind } from "../lib/content";

/** A 48 x 48 drawing for one service. The parent sets the size. */
export function ServiceIcon({
	kind,
	className,
}: {
	kind: ServiceIconKind;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 48 48"
			aria-hidden="true"
			focusable="false"
			className={className}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{kind === "checkup" && (
				<>
					<path
						d="M24 6c-8 0-13.5 5-13.8 12.6-.3 5.6 2.5 9.5 4.6 15.4 1 3.1 5.3 3.8 6.7.7.8-1.7 1.5-2.7 2.5-2.7s1.7 1 2.5 2.7c1.4 3.1 5.7 2.4 6.7-.7 2.1-5.9 4.9-9.8 4.6-15.4C37.5 11 32 6 24 6Z"
						strokeWidth="2.6"
						className="fill-card stroke-foreground"
					/>
					<path
						d="M17 20l3.4 3.4L28 16"
						fill="none"
						strokeWidth="3"
						className="stroke-(--gd-teal)"
					/>
				</>
			)}
			{kind === "aligners" && (
				<>
					<path
						d="M8 40c8 2 24 2 32 0"
						fill="none"
						strokeWidth="2.6"
						className="stroke-foreground"
					/>
					<path
						d="M10 34c0-9 5-16 14-16s14 7 14 16"
						strokeWidth="2.6"
						className="fill-(--gd-mint) stroke-foreground"
					/>
					<path
						d="M17 30c1-4 3.5-6.5 7-6.5s6 2.5 7 6.5"
						fill="none"
						strokeWidth="2.6"
						className="stroke-(--gd-teal)"
					/>
					<circle
						cx="36"
						cy="13"
						r="5"
						strokeWidth="2.4"
						className="fill-(--gd-sun) stroke-foreground"
					/>
				</>
			)}
			{kind === "fillings" && (
				<>
					<rect
						x="20"
						y="4"
						width="8"
						height="26"
						rx="4"
						strokeWidth="2.6"
						className="fill-primary stroke-foreground"
					/>
					<rect
						x="14"
						y="28"
						width="20"
						height="14"
						rx="6"
						strokeWidth="2.6"
						className="fill-card stroke-foreground"
					/>
					<path
						d="M18 33v4M24 33v4M30 33v4"
						strokeWidth="2.6"
						className="stroke-(--gd-teal)"
					/>
				</>
			)}
			{kind === "firstVisit" && (
				<>
					<circle
						cx="24"
						cy="24"
						r="17"
						strokeWidth="2.6"
						className="fill-(--gd-sun) stroke-foreground"
					/>
					<path
						d="M24 7v-4M24 45v-4M7 24H3M45 24h-4M11 11 8 8M40 40l-3-3M37 11l3-3M8 40l3-3"
						strokeWidth="2.6"
						className="stroke-foreground"
					/>
					<path
						d="M18 22c0 1.5 1 2.5 2 2.5s2-1 2-2.5M26 22c0 1.5 1 2.5 2 2.5s2-1 2-2.5"
						fill="none"
						strokeWidth="2.4"
						className="stroke-foreground"
					/>
					<path
						d="M18 29q6 5 12 0"
						fill="none"
						strokeWidth="2.6"
						className="stroke-foreground"
					/>
				</>
			)}
			{kind === "guards" && (
				<>
					<path
						d="M10 16c0-4 3-7 7-7h14c4 0 7 3 7 7v6c0 8-6 15-14 15S10 30 10 22Z"
						strokeWidth="2.6"
						className="fill-(--gd-teal) stroke-foreground"
					/>
					<path
						d="M16 18c0-2 1.6-3.5 3.6-3.5h8.8c2 0 3.6 1.5 3.6 3.5v4c0 5-3.6 9-8 9s-8-4-8-9Z"
						strokeWidth="2.4"
						className="fill-(--gd-mint) stroke-foreground"
					/>
				</>
			)}
			{kind === "polish" && (
				<>
					<path
						d="M24 4l2.8 8.4L36 15l-8 5 2 9-6-5-6 5 2-9-8-5 9.2-2.6Z"
						strokeWidth="2.4"
						className="fill-(--gd-sun) stroke-foreground"
					/>
					<path
						d="M36 30l1.6 4.4L42 36l-4.4 1.6L36 42l-1.6-4.4L30 36l4.4-1.6Z"
						strokeWidth="2.2"
						className="fill-primary stroke-foreground"
					/>
					<circle
						cx="12"
						cy="36"
						r="3.5"
						strokeWidth="2.2"
						className="fill-card stroke-foreground"
					/>
				</>
			)}
		</svg>
	);
}
