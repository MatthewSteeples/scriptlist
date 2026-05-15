import type { Route } from "./+types/app.export.history";

const recentExports = [
	{ id: "EXP-1018", name: "Asthma CCG Comparison", status: "Ready", createdAt: "2026-05-12" },
	{ id: "EXP-1017", name: "Scotland Statins Trend", status: "Processing", createdAt: "2026-05-11" },
	{ id: "EXP-1016", name: "Wales Diabetes Spend", status: "Ready", createdAt: "2026-05-10" },
];

export function meta({}: Route.MetaArgs) {
	return [{ title: "ScriptList Next | Export History" }];
}

export default function ExportHistoryRoute() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Export History</h1>
				<p className="mt-1 text-sm text-slate-600">
					Track generation status and quickly re-run successful reports.
				</p>
			</header>

			<div className="overflow-hidden rounded-xl border border-slate-200">
				<table className="w-full text-left text-sm">
					<thead className="bg-slate-50 text-slate-600">
						<tr>
							<th className="px-4 py-3 font-semibold">Export ID</th>
							<th className="px-4 py-3 font-semibold">Name</th>
							<th className="px-4 py-3 font-semibold">Status</th>
							<th className="px-4 py-3 font-semibold">Created</th>
						</tr>
					</thead>
					<tbody>
						{recentExports.map((item) => (
							<tr key={item.id} className="border-t border-slate-100">
								<td className="px-4 py-3 font-mono text-xs text-slate-700">{item.id}</td>
								<td className="px-4 py-3 text-slate-900">{item.name}</td>
								<td className="px-4 py-3">
									<span
										className={[
											"inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
											item.status === "Ready"
												? "bg-emerald-100 text-emerald-800"
												: "bg-amber-100 text-amber-800",
										].join(" ")}
									>
										{item.status}
									</span>
								</td>
								<td className="px-4 py-3 text-slate-700">{item.createdAt}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}