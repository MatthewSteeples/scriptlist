import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("excel", "routes/excel.tsx"),
    route("app", "routes/app.tsx", [
        index("routes/app.dashboard.tsx"),
        route("export/new", "routes/app.export.new.tsx"),
        route("export/history", "routes/app.export.history.tsx"),
        route("subscriptions", "routes/app.subscriptions.tsx"),
        route("account", "routes/app.account.tsx"),
    ]),
] satisfies RouteConfig;
