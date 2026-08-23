import { useNavigate } from "@tanstack/react-router";
import { CommandIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/lib/session";
import { getVisibleAdminNavigation } from "@/lib/navigation";

export default function Search() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const { data } = useSession();
	const navigation = useMemo(
		() => getVisibleAdminNavigation(data?.user.role),
		[data?.user.role],
	);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setOpen((current) => !current);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const results = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return navigation;
		}

		return navigation.filter((item) =>
			`${item.title} ${item.description}`
				.toLowerCase()
				.includes(normalizedQuery),
		);
	}, [navigation, query]);

	return (
		<div className="lg:flex-1">
			<div className="relative hidden max-w-sm flex-1 lg:block">
				<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label="Search administration"
					className="h-9 w-full cursor-pointer rounded-md border pr-14 pl-10 text-sm shadow-xs"
					placeholder="Search..."
					readOnly
					onFocus={() => setOpen(true)}
				/>
				<div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-medium font-mono text-xs sm:flex dark:bg-neutral-700">
					<CommandIcon className="size-3" />
					<span>K</span>
				</div>
			</div>
			<div className="block lg:hidden">
				<Button size="icon" variant="ghost" onClick={() => setOpen(true)}>
					<SearchIcon />
					<span className="sr-only">Search</span>
				</Button>
			</div>

			<Dialog
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) {
						setQuery("");
					}
				}}
			>
				<DialogContent
					className="gap-0 overflow-hidden p-0"
					showCloseButton={false}
				>
					<DialogHeader className="sr-only">
						<DialogTitle>Search admin navigation</DialogTitle>
						<DialogDescription>
							Find and open an administration page.
						</DialogDescription>
					</DialogHeader>
					<div className="border-b p-3">
						<div className="relative">
							<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								autoFocus
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								className="border-0 pl-9 shadow-none focus-visible:ring-0"
								placeholder="Type a page name..."
							/>
						</div>
					</div>
					<div className="max-h-80 overflow-y-auto p-2">
						{results.length ? (
							<div className="flex flex-col gap-1">
								{results.map((item) => (
									<Button
										key={item.to}
										variant="ghost"
										className="h-auto justify-start gap-3 px-3 py-3 text-left"
										onClick={() => {
											setOpen(false);
											void navigate({ to: item.to });
										}}
									>
										<item.icon data-icon="inline-start" />
										<span className="flex flex-col items-start gap-0.5">
											<span>{item.title}</span>
											<span className="font-normal text-muted-foreground text-xs">
												{item.description}
											</span>
										</span>
									</Button>
								))}
							</div>
						) : (
							<Empty className="border-0 py-10">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<SearchIcon />
									</EmptyMedia>
									<EmptyTitle>No pages found</EmptyTitle>
									<EmptyDescription>
										Try a different page name or keyword.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
