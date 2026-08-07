"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, client: "web" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.hint ?? null);
        throw new Error(data.error ?? "login failed");
      }
      router.replace(params.get("next") ?? "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
      setBusy(false);
    }
  };

  const inputStyle = {
    color: "var(--ink)",
    background: "var(--panel)",
    borderColor: "var(--line-bright)",
  };

  return (
    <div className="mx-auto flex min-h-[74vh] max-w-sm flex-col justify-center px-4">
      <p className="mono mb-3" style={{ color: "var(--signal)" }}>
        restricted
      </p>
      <h1 className="text-[26px] font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--dim)" }}>
        Content management, the day planner and résumé ingestion.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-3">
        <div>
          <label className="mono mb-1.5 block" style={{ color: "var(--faint)" }}>
            email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="w-full rounded border px-3.5 py-2.5 text-[15px] outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="mono mb-1.5 block" style={{ color: "var(--faint)" }}>
            password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded border px-3.5 py-2.5 text-[15px] outline-none"
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="mono w-full rounded border px-3 py-2.5 transition-opacity disabled:opacity-40"
          style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
        >
          {busy ? "checking…" : "sign in"}
        </button>

        {error && (
          <p className="mono" style={{ color: "var(--dead)" }}>
            {error}
          </p>
        )}
        {hint && (
          <p
            className="border-l-2 py-1 pl-3 text-[13px]"
            style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
          >
            {hint}
          </p>
        )}
      </form>

      <p className="mono mt-8 leading-relaxed" style={{ color: "var(--faint)" }}>
        the first admin is created automatically from ADMIN_EMAIL and
        ADMIN_PASSWORD the first time the server starts against an empty store.
        change the password from the account page afterwards.
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
