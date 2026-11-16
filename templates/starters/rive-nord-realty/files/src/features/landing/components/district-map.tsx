// The drawn map of the north bank: land above, the bay below, and one pin per district of lib/districts.ts.
// DistrictsSection renders it. A pin press selects its district; the map then zooms around that pin.
// The strokes and fills live in landing.css (.rn-map-*). The drawing is fictional, like the districts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISTRICTS, type DistrictId } from "../lib/districts";
import { LABEL } from "../lib/type-styles";

type DistrictMapProps = {
	/** The district of the open sheet, or null when no pin is pressed. */
	selectedId: DistrictId | null;
	onPinPress: (id: DistrictId) => void;
};

// The zoom factor of the map around the chosen pin.
const ZOOM = 1.35;

/** A framed 1000 x 540 drawing. The pins sit over it in percent, so they follow every width. */
export function DistrictMap({ selectedId, onPinPress }: DistrictMapProps) {
	const { t } = useT();
	const selected = DISTRICTS.find((district) => district.id === selectedId);
	// The map is a picture of places, so it does not mirror in a right-to-left language: positions are physical.
	const zoomStyle =
		selected === undefined
			? undefined
			: {
					transformOrigin: `${selected.pinX}% ${selected.pinY}%`,
					transform: `scale(${ZOOM})`,
				};

	return (
		<div className="rn-corners relative border border-foreground bg-secondary">
			<span aria-hidden="true" className="rn-corners-end" />
			<div className="relative aspect-1000/540 w-full overflow-hidden">
				<div className="rn-map-layer absolute inset-0" style={zoomStyle}>
					<svg
						viewBox="0 0 1000 540"
						role="img"
						aria-label={t("districts.mapLabel")}
						preserveAspectRatio="xMidYMid slice"
						className="absolute inset-0 size-full"
					>
						<rect className="rn-map-water" width="1000" height="540" />
						<path
							className="rn-map-land"
							d="M0 0H1000V318C930 330 860 352 790 348C720 344 650 318 590 322C540 326 500 312 470 300C430 284 380 300 330 322C270 348 200 352 130 340C80 332 40 330 0 336Z"
						/>
						<path
							className="rn-map-coast"
							d="M1000 318C930 330 860 352 790 348C720 344 650 318 590 322C540 326 500 312 470 300C430 284 380 300 330 322C270 348 200 352 130 340C80 332 40 330 0 336"
						/>
						{/* The lighthouse spit and the harbour jetty. */}
						<path className="rn-map-coast" d="M118 340L156 414M482 304l40 38" />
						<circle className="rn-map-light" cx="158" cy="420" r="6" />
						<path
							className="rn-map-wave"
							d="M260 420h90M420 470h80M700 420h96M820 480h80M80 500h70M560 400h60"
						/>
						<path
							className="rn-map-ferry"
							d="M524 344C560 410 600 470 640 540"
						/>
						<path
							className="rn-map-road"
							d="M0 270C140 262 260 236 360 246C430 252 450 262 470 270M470 270C560 286 680 282 1000 262M410 120C424 180 440 222 470 270M210 210C280 214 330 230 360 246M780 292C800 220 830 160 880 100M600 140C610 200 600 240 590 322"
						/>
						<path
							className="rn-map-block"
							d="M380 186h16v10h-16zM402 196h14v10h-14zM386 206h13v9h-13zM436 204h13v9h-13zM452 220h15v10h-15zM420 232h13v9h-13zM500 232h14v9h-14zM516 246h13v9h-13z"
						/>
						<path
							className="rn-map-block"
							d="M160 236h15v10h-15zM182 228h13v9h-13zM174 252h14v10h-14zM240 244h13v9h-13zM252 260h14v10h-14z"
						/>
						<path
							className="rn-map-block"
							d="M350 140h15v10h-15zM372 132h13v9h-13zM456 148h14v10h-14zM440 166h13v9h-13z"
						/>
						<path
							className="rn-map-block"
							d="M700 300h18v12h-18zM726 292h16v11h-16zM840 300h17v11h-17zM862 312h16v11h-16zM824 318h15v10h-15z"
						/>
						<text className="rn-map-label uppercase" x="300" y="450">
							{t("districts.bay")}
						</text>
						<text className="rn-map-label-water uppercase" x="560" y="500">
							{t("districts.ferry")}
						</text>
						<text className="rn-map-label-water uppercase" x="40" y="455">
							{t("districts.lighthouse")}
						</text>
						<text className="rn-map-label-minor uppercase" x="250" y="70">
							{t("districts.upperTown")}
						</text>
						<text className="rn-map-label-minor uppercase" x="610" y="120">
							{t("districts.orchard")}
						</text>
						<text className="rn-map-label-minor uppercase" x="610" y="214">
							{t("districts.ropeWorks")}
						</text>
						<text className="rn-map-label-minor uppercase" x="860" y="70">
							{t("districts.airport")}
						</text>
					</svg>
					{DISTRICTS.map((district) => {
						const isSelected = district.id === selectedId;
						return (
							<button
								key={district.id}
								type="button"
								aria-pressed={isSelected}
								aria-label={`${t(district.nameKey)}: ${t("districts.pinHint")}`}
								onClick={() => onPinPress(district.id)}
								style={{ left: `${district.pinX}%`, top: `${district.pinY}%` }}
								className={cn(
									// min-h-11 and the wider ::after give each pin a touch area of at least 44px on a phone.
									"absolute flex min-h-11 min-w-11 items-center gap-1.25 p-1 after:absolute after:-inset-1.5 after:content-['']",
									district.labelSide === "above"
										? "-translate-x-1/2 translate-y-[calc(-100%+17px)] flex-col-reverse"
										: "-translate-x-1/2 -translate-y-3 flex-col",
								)}
							>
								<span
									aria-hidden="true"
									className="rn-pin-dot relative block size-3.25 rounded-full bg-primary"
								/>
								<span
									className={cn(
										LABEL,
										"whitespace-nowrap border px-1.25 pt-0.75 pb-0.5 text-[9px] leading-none tracking-[0.08em] sm:px-1.75 sm:pt-1 sm:pb-0.75 sm:text-[10px] sm:tracking-[0.12em]",
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-foreground bg-background",
									)}
								>
									{t(district.nameKey)}
								</span>
							</button>
						);
					})}
				</div>
			</div>
			<p
				aria-hidden="true"
				className={cn(
					LABEL,
					"absolute start-3 bottom-2.5 hidden text-[9px] text-background leading-[1.6] tracking-[0.14em] opacity-85 sm:block",
				)}
			>
				{t("districts.legend")}
			</p>
		</div>
	);
}
