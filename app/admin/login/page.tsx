"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "login failed");
      router.replace(params.get("next") ?? "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <p className="mono mb-3" style={{ color: "var(--signal)" }}>
        restricted
      </p>
      <h1 className="text-[26px] font-medium tracking-tight">Admin</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--dim)" }}>
        Content editing and résumé ingestion.
      </p>

      <form onSubmit={submit} className="mt-7">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoFocus
          className="panel w-full px-3.5 py-2.5 text-[15px] outline-none"
          style={{ color: "var(--ink)", background: "var(--panel)" }}
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="mono mt-3 w-full rounded border px-3 py-2.5 transition-opacity disabled:opacity-40"
          style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
        >
          {busy ? "checking…" : "sign in"}
        </button>
        {error && (
          <p className="mono mt-3" style={{ color: "var(--dead)" }}>
            {error}
          </p>
        )}
      </form>

      <p className="mono mt-8" style={{ color: "var(--faint)" }}>
        set ADMIN_PASSWORD and ADMIN_SECRET in .env.local
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
