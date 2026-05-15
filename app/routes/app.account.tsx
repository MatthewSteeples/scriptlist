import type { Route } from "./+types/app.account";

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | Account" }];
}

export default function AccountRoute() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Account</h1>
				<p className="mt-1 text-sm text-slate-600">
					View profile, team access, and subscription plan usage.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-2">
				<section className="rounded-xl border border-slate-200 p-4">
					<h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Primary User</h2>
					<p className="mt-2 text-base font-medium text-slate-900">Demo User</p>
					<p className="text-sm text-slate-700">demo@scriptlist.co.uk</p>
				</section>

				<section className="rounded-xl border border-slate-200 p-4">
					<h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Plan</h2>
					<p className="mt-2 text-base font-medium text-slate-900">Professional</p>
					<p className="text-sm text-slate-700">Monthly exports: 18 / 40</p>
				</section>
			</div>
		</div>
	);
}
