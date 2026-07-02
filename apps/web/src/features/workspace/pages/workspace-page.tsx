export default function WorkspacePage({ projectId }: { projectId: string }) {
	return (
		<div className="grid h-full grid-cols-[minmax(280px,380px)_1fr]">
			<aside className="border-r p-4">
				<p className="text-muted-foreground text-sm">
					Chat pane — project {projectId}
				</p>
			</aside>
			<main className="p-4">
				<p className="text-muted-foreground text-sm">
					Canvas — preview renders here
				</p>
			</main>
		</div>
	);
}
