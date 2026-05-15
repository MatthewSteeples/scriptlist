import type { Route } from "./+types/app.export.new";

const steps = [
	{
		title: "Choose data scope",
		detail: "England, Wales, Scotland and target organizations.",
	},
	{
		title: "Select medicines",
		detail: "Pick BNF codes or search by medicine names.",
	},
	{
		title: "Set date window",
		detail: "Monthly period, rolling window, or custom range.",
	},
	{
		title: "Preview output",
		detail: "Row estimate, file size estimate, and expected runtime.",
	},
	{
		title: "Generate export",
		detail: "Download now or save as recurring subscription.",
	},
];

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | New Export" }];
}

export default function NewExportRoute() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">New Export</h1>
				<p className="mt-1 text-sm text-slate-600">
					Guided mode reduces setup time and prevents invalid combinations.
				</p>
			</header>

			<ol className="space-y-3">
				{steps.map((step, idx) => (
					<li key={step.title} className="flex items-start gap-4 rounded-xl border border-slate-200 p-4">
						<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
							{idx + 1}
						</div>
						<div>
							<h2 className="text-base font-semibold text-slate-900">{step.title}</h2>
							<p className="mt-1 text-sm text-slate-600">{step.detail}</p>
						</div>
					</li>
				))}
			</ol>

			<section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
				<span className="font-semibold">Phase 2 placeholder:</span> this page will become a full
				interactive wizard with API-backed medicine search and preview metrics.
			</section>
		</div>
	);
}