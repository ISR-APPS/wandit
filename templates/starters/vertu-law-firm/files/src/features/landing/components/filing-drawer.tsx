// The drawn object of the hero: an open filing drawer with three seated folders and one folder pulled out.
// HeroSection renders it in the right rail. landing.css gives every shape its token color; there is no photo.
// The walls come first, so the folders read as files in a box and never as a bar chart.
import { useT } from "~/shared/i18n";

/** A 360 x 248 drawing that scales to the width of its column. */
export function FilingDrawer({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<svg
			role="img"
			aria-label={t("hero.drawerLabel")}
			viewBox="0 0 360 248"
			className={className}
		>
			{/* The drawer: a recessed box with 14px walls around a darker inside. */}
			<path className="vt-drawer-box" d="M2 2 H358 V246 H2 Z" strokeWidth="1" />
			<path
				className="vt-drawer-inside"
				d="M16 14 H344 V194 H16 Z"
				strokeWidth="1"
			/>
			{/* Three seated folders, each narrower than the one in front. Tabs cut right, left, then centre. */}
			<g className="vt-file-stroke" strokeWidth="1" strokeLinejoin="round">
				<path
					className="vt-file-a"
					d="M52 78 V48 H232 L241 16 H275 L284 48 H308 V78 Z"
				/>
				<path
					className="vt-file-b"
					d="M42 122 V92 H56 L65 60 H99 L108 92 H318 V122 Z"
				/>
				<path
					className="vt-file-a"
					d="M32 166 V136 H150 L159 104 H193 L202 136 H328 V166 Z"
				/>
			</g>
			{/* The folder that is out: over the left wall and the front rail, with a brass tab. */}
			<path
				className="vt-file-out"
				d="M6 218 V180 H30 L39 148 H73 L82 180 H296 V218 Z"
				strokeWidth="1"
				strokeLinejoin="round"
			/>
			<path className="vt-brass-fill" d="M30 180 L39 148 H73 L82 180 Z" />
			{/* The handle of the drawer. */}
			<rect
				className="vt-brass-fill"
				x="150"
				y="228"
				width="60"
				height="6"
				rx="2"
			/>
		</svg>
	);
}
