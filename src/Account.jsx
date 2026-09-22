import React, { useEffect, useState, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { authClient } from "./lib/auth-client";
import App from "./App";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
export function AccountGate() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const settled = useRef(false);
  if (!isLoading) settled.current = true;
  // A focus-triggered session refresh must not unmount the code-entry form.
  if (isLoading && !settled.current)
    return (
      <AccountCard>
        <p>Opening your account…</p>
      </AccountCard>
    );
  return isAuthenticated ? <Workspace /> : <SignIn />;
}
function Workspace() {
  const account = useQuery(api.accounts.current, {}),
    initialize = useMutation(api.accounts.initialize);
  const [error, setError] = useState("");
  useEffect(() => {
    sessionStorage.removeItem("gather-pending-signin");
  }, []);
  useEffect(() => {
    if (account && !account.workspace)
      initialize({}).catch(() =>
        setError("We could not open your workspace. Refresh to try again."),
      );
  }, [account?.workspace]);
  if (error)
    return (
      <AccountCard>
        <p role="alert">{error}</p>
      </AccountCard>
    );
  if (!account?.workspace)
    return (
      <AccountCard>
        <p>Preparing your events…</p>
      </AccountCard>
    );
  return (
    <App
      key={account.workspace}
      account={account}
      workspaceId={account.workspace}
      onSignOut={async () => {
        await authClient.signOut();
        location.hash = "account";
      }}
    />
  );
}
function AccountCard({ children }) {
  return (
    <main className="account-page">
      <a className="brand account-brand" href="#welcome">
        <span className="brand-logo">
          g<span>•</span>
        </span>
        <span className="brand-name">Gather</span>
      </a>
      <section className="panel account-card">{children}</section>
      <p className="account-footer">Every detail, together.</p>
      {/^http:\/\/(127\.0\.0\.1|localhost):/.test(
        import.meta.env.VITE_CONVEX_URL || "",
      ) && (
        <button
          className="text-btn"
          onClick={() => {
            sessionStorage.removeItem("gather-account-mode");
            location.hash = "plan";
            location.reload();
          }}
        >
          Back to local workspace
        </button>
      )}
    </main>
  );
}
function SignIn() {
  const [pending] = useState(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("gather-pending-signin") || "null",
      );
      return saved &&
        typeof saved.email === "string" &&
        saved.expiresAt > Date.now()
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState(pending?.email || ""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(Boolean(pending)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [resendAt, setResendAt] = useState(pending?.resendAt || 0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "sign-in",
      });
      if (result.error) throw result.error;
      sessionStorage.setItem(
        "gather-pending-signin",
        JSON.stringify({
          email: email.trim().toLowerCase(),
          resendAt: Date.now() + 60000,
          expiresAt: Date.now() + 300000,
        }),
      );
      setSent(true);
      setCode("");
      setResendAt(Date.now() + 60000);
    } catch (err) {
      setError(err.message || "We could not send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: code,
      });
      if (result.error) throw result.error;
    } catch (err) {
      setError(
        err.message ||
          "That code did not work. Try again or request a new one.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountCard>
      <div className="account-icon">
        {sent ? <Mail size={22} /> : <ShieldCheck size={22} />}
      </div>
      <p className="eyebrow">YOUR GATHERINGS, TOGETHER</p>
      <h1>{sent ? "Check your inbox." : "A little less uncertainty."}</h1>
      <p className="account-intro">
        {sent
          ? `We sent a six-digit code to ${email}. It expires in five minutes.`
          : "Sign in to keep your event plans, evidence and decisions together across devices."}
      </p>
      <form
        onSubmit={
          sent
            ? verify
            : (e) => {
                e.preventDefault();
                send();
              }
        }
      >
        {sent ? (
          <label>
            Sign-in code
            <input
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              placeholder="000000"
            />
          </label>
        ) : (
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoFocus
            />
          </label>
        )}
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? "One moment…" : sent ? "Open my events" : "Email me a code"}
          {!busy && <ArrowRight size={15} />}
        </button>
      </form>
      {sent ? (
        <div className="account-links">
          <button
            className="text-btn"
            onClick={() => {
              sessionStorage.removeItem("gather-pending-signin");
              setSent(false);
              setError("");
            }}
            disabled={busy}
          >
            Use another email
          </button>
          <button
            className="text-btn"
            onClick={send}
            disabled={busy || now < resendAt}
          >
            {now < resendAt
              ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s`
              : "Resend code"}
          </button>
        </div>
      ) : (
        <p className="account-note">
          Open to everyone · Your events stay private. No password needed.
        </p>
      )}
    </AccountCard>
  );
}
