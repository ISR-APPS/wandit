import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
	const navigate = useNavigate();

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void navigate({ to: "/dashboard" });
	};

	return (
		<main className="flex pb-8 lg:h-screen lg:pb-0">
			<div className="hidden w-1/2 bg-gray-100 lg:block">
				<img
					src="/images/extra/image4.jpg"
					alt="Wandit administrator login"
					className="h-full w-full object-cover"
				/>
			</div>

			<div className="flex w-full items-center justify-center lg:w-1/2">
				<div className="w-full max-w-md space-y-8 px-4">
					<div className="text-center">
						<h1 className="mt-6 font-bold text-3xl">Welcome back</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Please sign in to your account
						</p>
					</div>

					<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
						<div className="space-y-4">
							<div>
								<Label htmlFor="email" className="sr-only">
									Email address
								</Label>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									required
									className="w-full"
									placeholder="Email address"
								/>
							</div>
							<div>
								<Label htmlFor="password" className="sr-only">
									Password
								</Label>
								<Input
									id="password"
									name="password"
									type="password"
									autoComplete="current-password"
									required
									className="w-full"
									placeholder="Password"
								/>
							</div>
							<div className="text-end">
								<button
									type="button"
									className="ml-auto inline-block text-sm underline"
								>
									Forgot your password?
								</button>
							</div>
						</div>

						<div>
							<Button type="submit" className="w-full">
								Sign in
							</Button>
						</div>
					</form>

					<div className="mt-6">
						<div className="flex items-center gap-3">
							<div className="w-full border-t" />
							<span className="shrink-0 text-muted-foreground text-sm">
								or continue with
							</span>
							<div className="w-full border-t" />
						</div>

						<div className="mt-6 grid grid-cols-2 gap-3">
							<Button type="button" variant="outline" className="w-full">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path
										fill="currentColor"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="currentColor"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="currentColor"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="currentColor"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								Google
							</Button>
							<Button type="button" variant="outline" className="w-full">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path
										fill="currentColor"
										d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.98 10.98 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.21c0 .31.21.67.79.56A11.5 11.5 0 0 0 12 .7Z"
									/>
								</svg>
								GitHub
							</Button>
						</div>

						<div className="mt-6 text-center text-sm">
							Don&apos;t have an account?{" "}
							<button type="button" className="underline">
								Sign up
							</button>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
