import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Volume2, VolumeX } from "lucide-react";

type SoundToggleProps = {
	muted: boolean;
	label: string;
	onToggle: () => void;
	disabled?: boolean;
	className?: string;
};

export function SoundToggle({
	muted,
	label,
	onToggle,
	disabled = false,
	className,
}: SoundToggleProps) {
	const Icon = muted ? VolumeX : Volume2;

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={label}
			disabled={disabled}
			onClick={onToggle}
			className={cn(
				"absolute end-4 top-4 z-20 text-muted-foreground hover:text-foreground active:scale-95 md:end-6 md:top-6",
				className,
			)}
		>
			<Icon aria-hidden className="size-4.5" />
		</Button>
	);
}
