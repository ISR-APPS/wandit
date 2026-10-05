// Inline SVG icon set, lucide-compatible stroke style.
// Components import icons from here; add a path when a new icon is needed.
// A named export per icon keeps bundle size flat and tree-shakable.
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{children}
		</svg>
	);
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M5 12h14" />
			<path d="m12 5 7 7-7 7" />
		</Icon>
	);
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M21.801 10A10 10 0 1 1 17 3.335" />
			<path d="m9 11 3 3L22 4" />
		</Icon>
	);
}

export function CircleCheckIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<circle cx="12" cy="12" r="10" />
			<path d="m9 12 2 2 4-4" />
		</Icon>
	);
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M20 6 9 17l-5-5" />
		</Icon>
	);
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m6 9 6 6 6-6" />
		</Icon>
	);
}

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m18 15-6-6-6 6" />
		</Icon>
	);
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</Icon>
	);
}

export function InfoIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4" />
			<path d="M12 8h.01" />
		</Icon>
	);
}

export function Loader2Icon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</Icon>
	);
}

export function OctagonXIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m15 9-6 6" />
			<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />
			<path d="m9 9 6 6" />
		</Icon>
	);
}

export function TriangleAlertIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
			<path d="M12 9v4" />
			<path d="M12 17h.01" />
		</Icon>
	);
}
