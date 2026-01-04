import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("excel", "routes/excel.tsx"),
] satisfies RouteConfig;
