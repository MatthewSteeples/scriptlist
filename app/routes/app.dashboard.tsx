import { Link } from "react-router";
import type { Route } from "./+types/app.dashboard";

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | Dashboard" }];
}

export default function AppDashboardRoute() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
				<p className="mt-1 text-sm text-slate-600">
					Quick access to your most common prescribing export workflows.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "New Export", value: "Start from guided wizard", to: "/app/export/new" },
					{ label: "Recent Files", value: "View latest generated exports", to: "/app/export/history" },
					{ label: "Schedules", value: "Manage monthly subscriptions", to: "/app/subscriptions" },
				].map((item) => (
					<Link
						key={item.label}
						to={item.to}
						className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-400 hover:bg-emerald-50"
					>
						<h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</h2>
						<p className="mt-2 text-base font-medium text-slate-900">{item.value}</p>
					</Link>
				))}
			</div>
		</div>
	);
}