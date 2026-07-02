import { motion } from "motion/react";
import type * as React from "react";

type RevealProps = {
	children: React.ReactNode;
	delay?: number;
	className?: string;
};

/** Scroll-linked section reveal — fades and lifts once when it enters view. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-64px" }}
			transition={{ duration: 0.55, delay, ease: "easeOut" }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
