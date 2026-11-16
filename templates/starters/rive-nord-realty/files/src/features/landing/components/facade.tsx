// The drawn facade of one home: a paper building in ink lines over one cobalt shape.
// ListingRow draws it as a thumbnail, ShopWindow draws it large. The classes live in landing.css.
// The drawings replace photos on purpose: the board shows facts, not staging.
import type { ReactNode } from "react";
import type { FacadeId } from "../lib/listings";

/** The drawing of each facade in a 120 x 150 box. The ground line sits at y = 140. */
const DRAWINGS: Record<FacadeId, ReactNode> = {
	"tall-block": (
		<>
			<rect className="rn-fac-fill" x="38" y="6" width="74" height="72" />
			<rect className="rn-fac-body" x="20" y="18" width="72" height="122" />
			<path className="rn-fac-line" d="M16 32h80M20 118h72" />
			<path
				className="rn-fac-line"
				d="M30 40h9v12h-9zM51 40h9v12h-9zM72 40h9v12h-9zM30 62h9v12h-9zM51 62h9v12h-9zM72 62h9v12h-9zM30 84h9v12h-9zM51 84h9v12h-9zM30 104h9v9h-9zM72 104h9v9h-9z"
			/>
			<path className="rn-fac-dash" d="M26 54h60M26 76h60M26 98h60" />
			<rect className="rn-fac-ink" x="50" y="122" width="12" height="18" />
			<path className="rn-fac-line" d="M6 140h108" />
		</>
	),
	stepped: (
		<>
			<circle className="rn-fac-fill" cx="28" cy="36" r="24" />
			<path className="rn-fac-body" d="M104 140H16V72h24V24h64z" />
			<path className="rn-fac-line" d="M16 72h88" />
			<path
				className="rn-fac-line"
				d="M46 36h52M46 48h52M46 60h52M62 24v48M82 24v48"
			/>
			<path
				className="rn-fac-line"
				d="M24 82h20v12H24zM56 82h38v12H56zM24 100h20v12H24zM56 100h38v12H56zM24 118h20v12H24z"
			/>
			<rect className="rn-fac-ink" x="80" y="122" width="12" height="18" />
			<path className="rn-fac-line" d="M8 140h104" />
		</>
	),
	arcades: (
		<>
			<path className="rn-fac-fill" d="M14 134V54a46 46 0 0 1 92 0v80z" />
			<rect className="rn-fac-body" x="22" y="24" width="76" height="116" />
			<path
				className="rn-fac-line"
				d="M22 34h9v-5h9v5h11v-5h9v5h11v-5h9v5h11v-5h9v5h7"
			/>
			<path className="rn-fac-line" d="M22 78h76M22 116h76" />
			<path
				className="rn-fac-line"
				d="M30 44h10v24H30zM55 44h10v24H55zM80 44h10v24H80zM35 44v24M60 44v24M85 44v24"
			/>
			<path
				className="rn-fac-line"
				d="M30 86h10v22H30zM55 86h10v22H55zM80 86h10v22H80zM35 86v22M60 86v22M85 86v22"
			/>
			<path
				className="rn-fac-line"
				d="M28 140v-12a8 8 0 0 1 16 0v12M52 140v-12a8 8 0 0 1 16 0v12M76 140v-12a8 8 0 0 1 16 0v12"
			/>
			<path className="rn-fac-line" d="M8 140h104" />
		</>
	),
	tower: (
		<>
			<rect className="rn-fac-fill" x="14" y="20" width="44" height="120" />
			<rect className="rn-fac-body" x="34" y="12" width="52" height="128" />
			<path
				className="rn-fac-line"
				d="M34 26h52M34 40h52M34 54h52M34 68h52M34 82h52M34 96h52M34 110h52M34 124h52"
			/>
			<path className="rn-fac-line" d="M51 12v112M68 12v112" />
			<path className="rn-fac-line" d="M60 12V2M55 6h10" />
			<rect className="rn-fac-ink" x="53" y="128" width="14" height="12" />
			<path className="rn-fac-line" d="M8 140h104" />
		</>
	),
	"stair-core": (
		<>
			<path className="rn-fac-fill" d="M114 140V52L62 140z" />
			<rect className="rn-fac-body" x="12" y="46" width="96" height="94" />
			<path className="rn-fac-line" d="M52 46v94M68 46v94" />
			<path
				className="rn-fac-line"
				d="M56 56h8v8h-8zM56 76h8v8h-8zM56 96h8v8h-8z"
			/>
			<path
				className="rn-fac-line"
				d="M20 58h9v9h-9zM35 58h9v9h-9zM76 58h9v9h-9zM91 58h9v9h-9zM20 78h9v9h-9zM35 78h9v9h-9zM76 78h9v9h-9zM91 78h9v9h-9zM20 98h9v9h-9zM35 98h9v9h-9zM76 98h9v9h-9zM91 98h9v9h-9zM20 118h9v9h-9zM91 118h9v9h-9z"
			/>
			<path className="rn-fac-line" d="M78 46v-8h16v8M48 126h24" />
			<rect className="rn-fac-ink" x="54" y="128" width="12" height="12" />
			<path className="rn-fac-line" d="M4 140h112" />
		</>
	),
	stone: (
		<>
			<path className="rn-fac-fill" d="M22 62a38 38 0 0 1 76 0z" />
			<rect className="rn-fac-body" x="18" y="20" width="84" height="120" />
			<path
				className="rn-fac-line"
				d="M26 28h68v104H26zM49 28v104M71 28v104M26 54h68M26 80h68M26 106h68"
			/>
			<path
				className="rn-fac-line"
				d="M28 30l5 5M51 30l5 5M73 30l5 5M28 56l5 5M51 56l5 5M73 56l5 5M28 82l5 5M51 82l5 5M73 82l5 5M28 108l5 5M51 108l5 5M73 108l5 5"
			/>
			<path className="rn-fac-line" d="M6 140h108" />
		</>
	),
	rotunda: (
		<>
			<path className="rn-fac-fill" d="M60 4h52v52A52 52 0 0 1 60 4z" />
			<path className="rn-fac-body" d="M96 140H20V52q0-28 30-28h46z" />
			<path className="rn-fac-line" d="M27 52q0-21 23-21" />
			<path
				className="rn-fac-line"
				d="M30 58h9v13h-9zM52 58h9v13h-9zM74 58h9v13h-9zM30 82h9v13h-9zM52 82h9v13h-9zM74 82h9v13h-9zM30 106h9v13h-9zM74 106h9v13h-9z"
			/>
			<path className="rn-fac-dash" d="M24 76h68M24 100h68" />
			<rect className="rn-fac-ink" x="52" y="124" width="12" height="16" />
			<path className="rn-fac-line" d="M20 124h76M6 140h108" />
		</>
	),
	cottage: (
		<>
			<rect className="rn-fac-fill" x="72" y="24" width="36" height="38" />
			<rect className="rn-fac-body" x="26" y="64" width="68" height="76" />
			<path className="rn-fac-body" d="M16 64 60 28l44 36z" />
			<path className="rn-fac-line" d="M27 55 60 34l33 21" />
			<path className="rn-fac-line" d="M84 44v-12h8v18" />
			<path
				className="rn-fac-line"
				d="M36 78h14v18H36zM70 78h14v18H70zM43 78v18M77 78v18"
			/>
			<rect className="rn-fac-ink" x="54" y="112" width="14" height="28" />
			<path
				className="rn-fac-line"
				d="M4 122h22M94 122h22M4 122v18M116 122v18M4 140h112"
			/>
		</>
	),
};

type FacadeProps = {
	facade: FacadeId;
	/** Accessible name of the drawing, already translated. With no label, the drawing is decoration and screen readers skip it. */
	label?: string;
	className?: string;
};

/** One facade as an SVG image. The parent sets its size; the drawing keeps a 4:5 ratio. */
export function Facade({ facade, label, className }: FacadeProps) {
	// The row thumbnail has no label: the window already describes the drawing, so the row name stays short.
	const isDecorative = label === undefined;
	return (
		<svg
			viewBox="0 0 120 150"
			role={isDecorative ? undefined : "img"}
			aria-label={label}
			aria-hidden={isDecorative ? true : undefined}
			className={className}
		>
			{DRAWINGS[facade]}
		</svg>
	);
}
