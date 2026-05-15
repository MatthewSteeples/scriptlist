import type { Route } from "./+types/app.subscriptions";

const subscriptions = [
	{ name: "Primary Care Respiratory", frequency: "Monthly", destination: "ops@company.com" },
	{ name: "Cardiology Regional Snapshot", frequency: "Monthly", destination: "insights@company.com" },
];

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | Subscriptions" }];
}

export default function SubscriptionsRoute() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscriptions</h1>
				<p className="mt-1 text-sm text-slate-600">
					Manage recurring exports delivered automatically when monthly data is released.
				</p>
			</header>

			<div className="grid gap-4">
				{subscriptions.map((item) => (
					<article key={item.name} className="rounded-xl border border-slate-200 p-4">
						<h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
						<p className="mt-1 text-sm text-slate-600">{item.frequency} delivery</p>
						<p className="mt-1 text-sm text-slate-700">Destination: {item.destination}</p>
					</article>
				))}
			</div>

			<section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
				Next iteration: add schedule builder, data freshness policy, and retry controls.
			</section>
		</div>
	);
}
