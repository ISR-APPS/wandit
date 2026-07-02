import { Button } from "@my-better-t-app/ui/components/button";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			className="relative"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
		>
			<Sun className="size-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute size-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
