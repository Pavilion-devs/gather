import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "./lib/auth-client";
import { AccountGate } from "./Account";
import App from "./App";
import { PublicPage } from "./Public";
const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const local = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(
  import.meta.env.VITE_CONVEX_URL || "",
);
// Cloud always requires identity. Local development can open #account to exercise sign-in.
function Root() {
  const [route, setRoute] = React.useState(location.hash);
  React.useEffect(() => {
    const f = () => setRoute(location.hash);
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const [accountMode, setAccountMode] = React.useState(
    !local ||
      location.hash === "#account" ||
      sessionStorage.getItem("gather-account-mode") === "true",
  );
  React.useEffect(() => {
    if (route === "#account") {
      sessionStorage.setItem("gather-account-mode", "true");
      setAccountMode(true);
    }
  }, [route]);
  const publicRoute =
    !route || route === "#welcome" || route.startsWith("#report/");
  return accountMode ? (
    <ConvexBetterAuthProvider client={client} authClient={authClient}>
      {publicRoute ? <PublicPage route={route} /> : <AccountGate />}
    </ConvexBetterAuthProvider>
  ) : (
    <ConvexProvider client={client}>
      {publicRoute ? <PublicPage route={route} /> : <App />}
    </ConvexProvider>
  );
}
createRoot(document.getElementById("root")).render(<Root />);
