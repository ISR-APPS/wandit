import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import Notifications from "@/components/layout/header/notifications";
import Search from "@/components/layout/header/search";
import ThemeSwitch from "@/components/layout/header/theme-switch";
import UserMenu from "@/components/layout/header/user-menu";
import { ThemeCustomizerPanel } from "@/components/theme-customizer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";

export function SiteHeader() {
	const { toggleSidebar, open } = useSidebar();

	return (
		<header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/40 backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-tl-xl md:rounded-tr-xl">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2">
				<Button onClick={toggleSidebar} size="icon" variant="ghost">
					{open ? <PanelLeftClose /> : <PanelLeftOpen />}
					<span className="sr-only">
						{open ? "Collapse sidebar" : "Expand sidebar"}
					</span>
				</Button>
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				<Search />

				<div className="ml-auto flex items-center gap-1 sm:gap-2">
					<Notifications />
					<ThemeSwitch />
					<ThemeCustomizerPanel />
					<Separator
						orientation="vertical"
						className="mx-1 hidden data-[orientation=vertical]:h-4 sm:block"
					/>
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
