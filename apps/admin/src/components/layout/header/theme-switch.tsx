import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export default function ThemeSwitch() {
	const [mounted, setMounted] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <span className="size-8" aria-hidden />;
	}

	const isDark = resolvedTheme === "dark";

	return (
		<Button
			size="icon-sm"
			variant="ghost"
			className="relative"
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? <SunIcon /> : <MoonIcon />}
			<span className="sr-only">
				Switch to {isDark ? "light" : "dark"} mode
			</span>
		</Button>
	);
}
