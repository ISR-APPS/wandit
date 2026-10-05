// Inline SVG icon set: Lucide paths, 24 px grid, 2 px stroke.
// Components import icons from here; add a Lucide path when a new icon is needed.
// A named export per icon keeps bundle size flat and tree-shakable.
// Directional icons (chevrons, arrows, panel) get `rtl:rotate-180` where they are used.
/*
 * Icon paths from Lucide (https://lucide.dev). ISC License.
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Lucide derives part of these icons from Feather (for example arrow-right,
 * check, the chevrons, info, log-out, search, x), under the MIT License:
 * Copyright (c) 2013-present Cole Bemis.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: the above copyright
 * notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
 * OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
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

/** Lucide panel-left. The sidebar trigger. Directional: rtl:rotate-180. */
export function PanelLeftIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M9 3v18" />
		</Icon>
	);
}

/** Lucide chevrons-up-down. The end of a row that opens a menu. */
export function ChevronsUpDownIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m7 15 5 5 5-5" />
			<path d="m7 9 5-5 5 5" />
		</Icon>
	);
}

/** Lucide log-out. Directional: rtl:rotate-180. */
export function LogOutIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m16 17 5-5-5-5" />
			<path d="M21 12H9" />
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		</Icon>
	);
}

/** Lucide user. The Profile nav item. */
export function UserIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</Icon>
	);
}

/** Lucide chevron-left. "Previous" in DataTable. Directional: rtl:rotate-180. */
export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m15 18-6-6 6-6" />
		</Icon>
	);
}

/** Lucide chevron-right. "Next" in DataTable. Directional: rtl:rotate-180. */
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m9 18 6-6-6-6" />
		</Icon>
	);
}

/** Lucide arrow-up-down. A sortable table header. */
export function ArrowUpDownIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m21 16-4 4-4-4" />
			<path d="M17 20V4" />
			<path d="m3 8 4-4 4 4" />
			<path d="M7 4v16" />
		</Icon>
	);
}

/** Lucide search. The DataTable search box. */
export function SearchIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="m21 21-4.34-4.34" />
			<circle cx="11" cy="11" r="8" />
		</Icon>
	);
}

/** Lucide trending-up. A KPI delta that goes up. */
export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M16 7h6v6" />
			<path d="m22 7-8.5 8.5-5-5L2 17" />
		</Icon>
	);
}

/** Lucide trending-down. A KPI delta that goes down. */
export function TrendingDownIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M16 17h6v-6" />
			<path d="m22 17-8.5-8.5-5 5L2 7" />
		</Icon>
	);
}

/** Lucide ellipsis. The row actions menu of a table. */
export function MoreHorizontalIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<circle cx="12" cy="12" r="1" />
			<circle cx="19" cy="12" r="1" />
			<circle cx="5" cy="12" r="1" />
		</Icon>
	);
}
