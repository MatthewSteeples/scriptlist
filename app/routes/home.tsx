import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "ScriptList Next | NHS Prescribing Exports" },
        {
            name: "description",
            content:
                "Build custom NHS prescribing exports with guided filters, previews, and scheduled delivery.",
        },
    ];
}

export function loader({ context }: Route.LoaderArgs) {
    const cloudflare = context.cloudflare as
        | { env?: { VALUE_FROM_CLOUDFLARE?: string } }
        | undefined;

    return {
        message: cloudflare?.env?.VALUE_FROM_CLOUDFLARE ?? "Local environment",
    };
}

export default function Home({ loaderData }: Route.ComponentProps) {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d8f3dc_0%,#f5fff7_30%,#f3fafc_65%,#eef7ff_100%)] text-slate-900">
            <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-10 md:pt-16">
                <header className="rounded-3xl border border-emerald-200/70 bg-white/85 p-8 shadow-[0_20px_80px_-40px_rgba(20,83,45,0.45)] backdrop-blur md:p-12">
                    <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                        Prescription Intelligence
                    </p>
                    <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
                        Create NHS prescribing exports in minutes, not hours.
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
                        Rebuilding ScriptList with a cleaner workflow: guided filters, instant
                        previews, and scheduled delivery of the exact files your team needs.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            to="/app/export/new"
                            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        >
                            Start Guided Export
                        </Link>
                        <Link
                            to="/app"
                            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
                        >
                            Open Dashboard
                        </Link>
                        <a
                            href="/excel"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                        >
                            Download Sample Excel
                        </a>
                    </div>
                </header>

                <div className="mt-10 grid gap-5 md:grid-cols-3">
                    {[
                        {
                            title: "Guided Workflow",
                            description:
                                "Step-by-step query builder with medication search, geography filters, and date ranges.",
                        },
                        {
                            title: "Preview Before Export",
                            description:
                                "Estimate file size, row counts, and run-time before committing to generation.",
                        },
                        {
                            title: "Scheduled Delivery",
                            description:
                                "Save export rules once and receive monthly files as soon as fresh data lands.",
                        },
                    ].map((item) => (
                        <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                        </article>
                    ))}
                </div>

                <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Environment
                    </h2>
                    <p className="mt-2 text-base text-slate-800">
                        Cloudflare variable: <span className="font-semibold">{loaderData.message}</span>
                    </p>
                </div>
            </section>
        </main>
    );
}
