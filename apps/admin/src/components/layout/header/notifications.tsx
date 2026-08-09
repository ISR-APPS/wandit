import { Link } from "@tanstack/react-router";
import { BellIcon, ClockIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

import { type Notification, notifications } from "./data";

export default function Notifications() {
	const isMobile = useIsMobile();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon-sm" variant="ghost" className="relative">
					<BellIcon />
					<span className="absolute end-0.5 top-0.5 block size-1.5 shrink-0 rounded-full bg-destructive" />
					<span className="sr-only">Open notifications</span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align={isMobile ? "center" : "end"}
				className="ms-4 w-80 p-0"
			>
				<DropdownMenuLabel className="sticky top-0 bg-background p-0 dark:bg-muted">
					<div className="flex justify-between border-b px-6 py-4">
						<div className="font-medium">Notifications</div>
						<Button
							variant="link"
							className="h-auto p-0 text-xs"
							size="sm"
							asChild
						>
							<Link to="/users">View all</Link>
						</Button>
					</div>
				</DropdownMenuLabel>

				<ScrollArea className="h-[350px]">
					<DropdownMenuGroup>
						{notifications.map((item: Notification) => (
							<DropdownMenuItem
								key={item.id}
								className="group flex cursor-pointer items-start gap-9 rounded-none border-b px-4 py-3"
							>
								<div className="flex flex-1 items-start gap-2">
									<Avatar className="size-8">
										<AvatarFallback>{item.initials}</AvatarFallback>
									</Avatar>
									<div className="flex flex-1 flex-col gap-1">
										<div className="truncate font-medium text-sm">
											{item.title}
										</div>
										<div className="line-clamp-2 text-muted-foreground text-xs">
											{item.description}
										</div>
										<div className="flex items-center gap-1 text-muted-foreground text-xs">
											<ClockIcon className="size-3!" />
											{item.date}
										</div>
									</div>
								</div>
								{item.unread ? (
									<span className="block size-2 rounded-full border bg-destructive/80" />
								) : null}
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
