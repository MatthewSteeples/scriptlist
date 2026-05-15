import { NavLink, Outlet } from "react-router";
import type { Route } from "./+types/app";

const navItems = [
	{ to: "/app", label: "Overview", end: true },
	{ to: "/app/export/new", label: "New Export" },
	{ to: "/app/export/history", label: "History" },
	{ to: "/app/subscriptions", label: "Subscriptions" },
	{ to: "/app/account", label: "Account" },
];

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | App" }];
}

export default function AppLayout() {
	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
					<NavLink to="/" className="text-lg font-bold tracking-tight text-slate-900">
						ScriptList Next
					</NavLink>
					<div className="text-sm text-slate-600">Pilot Workspace</div>
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
				<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3">
					<nav className="space-y-1">
						{navItems.map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.end}
								className={({ isActive }) =>
									[
										"block rounded-lg px-3 py-2 text-sm font-medium transition",
										isActive
											? "bg-emerald-600 text-white"
											: "text-slate-700 hover:bg-slate-100",
									].join(" ")
								}
							>
								{item.label}
							</NavLink>
						))}
					</nav>
				</aside>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
					<Outlet />
				</section>
			</div>
		</div>
	);
}