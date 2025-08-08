import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"), 
    layout("routes/chat/layout.tsx", [
        route("chat", "routes/chat/chat.tsx"),
        route("chat/:id", "routes/chat/chat.$id.tsx"),
    ]),
    layout("routes/settings/layout.tsx", [
        route("settings", "routes/settings/index.tsx"),
        route("settings/model", "routes/settings/model.tsx"),
        route("settings/customize", "routes/settings/customize.tsx"),
    ]),
    route("sign-in/*", "routes/auth/sign-in.tsx"),
    route("sign-up/*", "routes/auth/sign-up.tsx"),
    route("api/webhook", "routes/api/webhook.ts"),
    route("api/chat", "routes/api/chat.ts"),
] satisfies RouteConfig;
