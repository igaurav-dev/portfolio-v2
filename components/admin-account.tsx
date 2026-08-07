"use client";

import { useEffect, useState } from "react";

interface PublicAdmin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  source: string;
}

export function AdminAccount({
  notify,
}: {
  notify: (kind: "ok" | "err", text: string) => void;
}) {
  const [me, setMe] = useState<PublicAdmin | null>(null);
  const [admins, setAdmins] = useState<PublicAdmin[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/account", { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json();
    setMe(j.admin);
    setAdmins(j.admins ?? []);
    setEmail(j.admin.email);
    setName(j.admin.name);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (includePassword: boolean) => {
    if (includePassword && newPassword !== confirm) {
      notify("err", "the two new passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          includePassword
            ? { email, name, currentPassword, newPassword }
            : { email, name },
        ),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      notify("ok", j.note ?? "account updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "update failed");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    color: "var(--ink)",
    background: "var(--panel)",
    borderColor: "var(--line-bright)",
  };

  return (
    <div>
      <div className="mb-6 border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <h2 className="text-[17px] font-medium tracking-tight">Account</h2>
        <p className="mono mt-0.5" style={{ color: "var(--faint)" }}>
          {me ? `${me.email} · signed in` : "loading…"}
          {me?.lastLoginAt && ` · last login ${me.lastLoginAt.slice(0, 16).replace("T", " ")}`}
        </p>
        <p className="mt-3 max-w-[74ch] text-[13.5px]" style={{ color: "var(--dim)" }}>
          Credentials are stored in the same database as everything else, hashed with
          PBKDF2. The environment variables only matter once — they create the first
          account when the store is empty. Changing the password here means the values
          in <code>.env.local</code> stop being the way in.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="mono mb-3" style={{ color: "var(--faint)" }}>
            details
          </p>
          <label className="mono mb-1 block" style={{ color: "var(--faint)" }}>
            name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded border px-3 py-1.5 text-[13.5px] outline-none"
            style={inputStyle}
          />
          <label className="mono mb-1 block" style={{ color: "var(--faint)" }}>
            email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded border px-3 py-1.5 text-[13.5px] outline-none"
            style={inputStyle}
          />
          <button
            onClick={() => save(false)}
            disabled={busy}
            className="mono rounded border px-3 py-1.5 disabled:opacity-40"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            save details
          </button>
        </div>

        <div>
          <p className="mono mb-3" style={{ color: "var(--faint)" }}>
            change password
          </p>
          {[
            ["current password", currentPassword, setCurrentPassword],
            ["new password", newPassword, setNewPassword],
            ["confirm new password", confirm, setConfirm],
          ].map(([label, value, setter]) => (
            <div key={label as string}>
              <label className="mono mb-1 block" style={{ color: "var(--faint)" }}>
                {label as string}
              </label>
              <input
                type="password"
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                autoComplete="new-password"
                className="mb-3 w-full rounded border px-3 py-1.5 text-[13.5px] outline-none"
                style={inputStyle}
              />
            </div>
          ))}
          <button
            onClick={() => save(true)}
            disabled={busy || !currentPassword || newPassword.length < 10}
            className="mono rounded border px-3 py-1.5 disabled:opacity-40"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            change password
          </button>
          <p className="mono mt-2" style={{ color: "var(--faint)" }}>
            minimum 10 characters
          </p>
        </div>
      </div>

      {admins.length > 1 && (
        <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--line)" }}>
          <p className="mono mb-3" style={{ color: "var(--faint)" }}>
            {admins.length} accounts
          </p>
          {admins.map((a) => (
            <div
              key={a.id}
              className="flex items-baseline justify-between border-b py-2"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="text-[13.5px]">{a.email}</span>
              <span className="mono" style={{ color: "var(--faint)" }}>
                {a.source} · created {a.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
