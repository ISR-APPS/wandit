// The preview area of a grid card on the Files page. FilesGridView renders it for each file.
// An image or a design file gets a small drawn thumbnail: a photo, an app screen, or artboards.
// Other kinds show the kind mark of FileTile. hashOf picks the layout, so one file keeps one look.
import { type FileItem, FileTile } from "~/features/workspace";
import { cn } from "~/shared/lib/utils";
import { hashOf } from "../lib/file-facts";

type FilePreviewProps = {
	file: FileItem;
};

// Fixed keys for the repeated bars of a drawing. The bars never reorder.
const ROWS = ["a", "b", "c", "d"] as const;

// The tones of a photo: sky, far hill, near hill. Real photos differ in color, so the drawings do too.
const PHOTO_TONES = [
	["bg-chart-2/15", "bg-chart-2/25", "bg-chart-2/45"],
	["bg-chart-3/25", "bg-chart-3/50", "bg-primary/45"],
	["bg-chart-5/35", "bg-chart-4/30", "bg-chart-4/55"],
] as const;

/** A 4:3 thumbnail drawn with theme tokens only. A later turn can show the real image from Storage here. */
export function FilePreview({ file }: FilePreviewProps) {
	const seed = hashOf(file.id);
	const frameClass =
		"relative block aspect-[4/3] w-full overflow-hidden rounded-md";
	const barClass = "block rounded-full bg-border";

	if (file.kind === "design") {
		// Two to four artboards on the design tint. The first one is selected, as in a design tool.
		const boards = ROWS.slice(0, 2 + (seed % 3));
		return (
			<span
				aria-hidden
				className={cn(
					frameClass,
					"flex items-center justify-center gap-[4%] bg-chart-4/15",
				)}
			>
				{boards.map((key, index) => (
					<span
						key={key}
						className={cn(
							// 17% wide, so four boards and their gaps fit in the frame.
							"flex aspect-[9/16] w-[17%] flex-col gap-1 rounded-sm border border-foreground/10 bg-card p-1",
							index === 0 && "outline-1 outline-primary outline-offset-2",
						)}
					>
						<span
							className={cn(
								"block h-2/5 rounded-xs",
								index === seed % boards.length ? "bg-primary/25" : "bg-border",
							)}
						/>
						<span className={cn(barClass, "h-1 w-3/4")} />
						<span className={cn(barClass, "h-1 w-1/2")} />
					</span>
				))}
			</span>
		);
	}

	if (file.kind === "image" && file.extension === "jpg") {
		// A photo: a sun and two hills. The seed picks the tones, the sun place, and the hill side,
		// so a shoot is not a row of copies.
		const [sky, farHill, nearHill] =
			PHOTO_TONES[seed % PHOTO_TONES.length] ?? PHOTO_TONES[0];
		return (
			<span aria-hidden className={cn(frameClass, sky)}>
				<span
					className="absolute top-[14%] block aspect-square w-[13%] rounded-full bg-card"
					style={{ insetInlineStart: `${12 + ((seed >>> 4) % 66)}%` }}
				/>
				<span
					className={cn(
						"absolute inset-x-0 bottom-0 block h-3/5",
						(seed >>> 8) % 2 === 1 && "-scale-x-100",
					)}
				>
					<span
						className={cn(
							"absolute inset-0 block [clip-path:polygon(0_100%,0_50%,28%_12%,58%_62%,100%_28%,100%_100%)]",
							farHill,
						)}
					/>
					<span
						className={cn(
							"absolute inset-0 block [clip-path:polygon(0_100%,0_78%,40%_42%,72%_80%,100%_58%,100%_100%)]",
							nearHill,
						)}
					/>
				</span>
			</span>
		);
	}

	if (file.kind === "image") {
		// An app screen in a window: a sidebar layout, a hero layout, or a list layout.
		const layout = seed % 3;
		return (
			<span aria-hidden className={cn(frameClass, "bg-chart-2/15")}>
				<span className="absolute inset-x-[9%] top-[11%] bottom-0 flex flex-col overflow-hidden rounded-t-md border border-foreground/10 border-b-0 bg-card">
					<span className="flex h-[13%] shrink-0 items-center gap-1 border-foreground/10 border-b px-2">
						{ROWS.slice(0, 3).map((key) => (
							<span
								key={key}
								className="block size-1 rounded-full bg-muted-foreground/35"
							/>
						))}
					</span>
					{layout === 0 ? (
						<span className="flex flex-1 gap-2 p-2">
							<span className="flex w-1/4 flex-col gap-1.5">
								{ROWS.map((key, index) => (
									<span
										key={key}
										className={cn(
											"block h-1 rounded-full",
											index === 0 ? "bg-primary/40" : "bg-border",
										)}
									/>
								))}
							</span>
							<span className="grid flex-1 grid-cols-2 content-start gap-1.5">
								<span className={cn(barClass, "col-span-2 h-1.5 w-1/2")} />
								{ROWS.map((key) => (
									<span
										key={key}
										className="block h-5 rounded-xs border border-foreground/10 bg-muted"
									/>
								))}
							</span>
						</span>
					) : layout === 1 ? (
						<span className="flex flex-1 flex-col gap-1.5 p-2">
							<span className="block h-2/5 rounded-xs bg-primary/20" />
							<span
								className={cn(barClass, "h-1.5 w-3/4 bg-muted-foreground/35")}
							/>
							<span className={cn(barClass, "h-1 w-1/2")} />
							<span className="block h-2 w-1/4 rounded-xs bg-primary/50" />
						</span>
					) : (
						<span className="flex flex-1 flex-col gap-1.5 p-2">
							<span
								className={cn(barClass, "h-1.5 w-1/3 bg-muted-foreground/35")}
							/>
							{ROWS.map((key, index) => (
								<span key={key} className="flex items-center gap-1.5">
									<span className="block size-2 shrink-0 rounded-full bg-muted-foreground/25" />
									<span className={cn(barClass, "h-1 flex-1")} />
									<span
										className={cn(
											"block h-1 w-1/5 rounded-full",
											index === seed % ROWS.length
												? "bg-primary/40"
												: "bg-border",
										)}
									/>
								</span>
							))}
						</span>
					)}
				</span>
			</span>
		);
	}

	return <FileTile kind={file.kind} size="preview" />;
}
