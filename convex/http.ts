import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });
registerStaticRoutes(http, components.staticHosting);
export default http;
