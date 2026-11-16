// A one-line drawing of a yoga or pilates pose, in the 240 x 200 frame of a teacher card.
// TeacherCard renders it in place of a photo. Each path draws itself when the card reveals (landing.css .sp-draw).
// The figure is a head circle, a spine, the limbs, and a floor line, in the ink of the page.

/** The four poses of the teacher cards. */
export type Pose = "seated" | "teaser" | "kneeling" | "fold";

/** The path data of each pose. The floor line comes last, so it draws after the body. */
const POSE_PATHS: Record<Pose, readonly string[]> = {
	// Easy seat: shoulders, arms to the knees, hands on the knees, the front shin crosses over the back one.
	seated: [
		"M120 36 a 13 13 0 1 0 .01 0",
		"M120 64 C 118 88 118 112 120 138",
		"M102 82 C 110 76 130 76 138 82",
		"M102 82 C 94 102 82 128 70 152",
		"M138 82 C 146 102 158 128 170 152",
		"M62 150 L 76 154",
		"M164 154 L 178 150",
		"M56 162 C 80 142 106 136 120 140 C 134 136 160 142 184 162",
		"M56 162 C 84 170 126 170 158 160",
		"M184 162 C 176 166 166 168 152 168",
		"M40 172 L 200 172",
	],
	// Teaser: a V of the torso and the legs, arms reaching along the shins.
	teaser: [
		"M74 62 a 12 12 0 1 0 .01 0",
		"M108 160 C 98 136 88 112 80 90",
		"M108 160 C 136 136 164 110 196 84",
		"M84 100 C 112 96 140 90 170 88",
		"M40 172 L 200 172",
	],
	// Kneeling on the heels, seen from the side: the thigh and the folded shin. The arms open upward.
	kneeling: [
		"M120 26 a 12 12 0 1 0 .01 0",
		"M120 52 C 122 78 122 104 120 128",
		"M119 70 C 96 66 78 48 72 22",
		"M121 70 C 144 66 162 48 168 22",
		"M120 128 C 104 136 92 152 90 166 L 150 166",
		"M40 172 L 200 172",
	],
	// Standing forward fold: straight legs, the back rounded over the hips, the head by the knees, hands on the calves.
	fold: [
		"M128 172 C 129 140 131 100 132 64",
		"M132 64 C 126 40 98 38 92 64 C 89 80 90 94 93 104",
		"M95 104 a 12 12 0 1 0 .01 0",
		"M98 72 C 106 98 116 122 124 140",
		"M40 172 L 200 172",
	],
};

type PoseFigureProps = {
	pose: Pose;
	/** The alt text of the drawing, already translated. */
	label: string;
};

/** The drawing, 216px tall in its card. Stroke ends are round, the line is 2.6 units wide. */
export function PoseFigure({ pose, label }: PoseFigureProps) {
	return (
		<svg
			viewBox="0 0 240 200"
			fill="none"
			role="img"
			aria-label={label}
			className="sp-figure sp-draw relative h-full w-auto text-foreground"
		>
			{POSE_PATHS[pose].map((path) => (
				<path
					key={path}
					pathLength={1}
					d={path}
					stroke="currentColor"
					strokeWidth="2.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			))}
		</svg>
	);
}
