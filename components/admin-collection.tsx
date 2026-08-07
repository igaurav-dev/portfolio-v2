"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHEMAS, type CollectionSchema } from "@/lib/admin-schema";
import { FieldInput, Label, SkillsEditor } from "./admin-fields";

type Row = Record<string, unknown>;

export function AdminCollection({
  schema,
  notify,
}: {
  schema: CollectionSchema;
  notify: (kind: "ok" | "err", text: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [single, setSingle] = useState<Row>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [backendName, setBackendName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/records?collection=${schema.name}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = await res.json();
    setBackendName(json.backend);
    if (schema.singleton) setSingle(json.data ?? {});
    else setRows(json.data ?? []);
    setDirty(false);
  }, [schema.name, schema.singleton]);

  useEffect(() => {
    setEditing(null);
    setFilter("");
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(q),
    );
  }, [rows, filter]);

  /* ---------------- singleton ---------------- */

  if (schema.singleton) {
    const isSkills = schema.name === "skills";
    return (
      <div>
        <Header schema={schema} backendName={backendName} dirty={dirty}>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch(
                  `/api/admin/records?collection=${schema.name}`,
                  {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ record: single }),
                  },
                );
                const j = await res.json();
                if (!res.ok) throw new Error(j.hint ? `${j.error} — ${j.hint}` : j.error);
                notify("ok", `${schema.label} saved — live on the next request`);
                setDirty(false);
              } catch (err) {
                notify("err", err instanceof Error ? err.message : "save failed");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !dirty}
            className="mono rounded border px-3 py-1.5 disabled:opacity-40"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            {busy ? "saving…" : dirty ? "save changes" : "saved"}
          </button>
        </Header>

        {isSkills ? (
          <SkillsEditor
            value={single as Record<string, string[]>}
            onChange={(next) => {
              setSingle(next);
              setDirty(true);
            }}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {schema.fields.map((f) => (
              <div
                key={f.key}
                className={
                  f.type === "textarea" || f.type === "lines" || f.type === "objects"
                    ? "lg:col-span-2"
                    : ""
                }
              >
                <Label field={f} />
                <FieldInput
                  field={f}
                  value={single[f.key]}
                  onChange={(v) => {
                    setSingle((s) => ({ ...s, [f.key]: v }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---------------- list + editor ---------------- */

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/records?collection=${schema.name}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ record: editing, previousId: originalId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.hint ? `${j.error} — ${j.hint}` : j.error);
      notify("ok", `saved — ${String(editing[schema.titleField] ?? j.id)}`);
      setEditing(null);
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    const id = String(row[schema.idField]);
    if (!confirm(`Delete "${String(row[schema.titleField] ?? id)}"? This cannot be undone.`))
      return;
    await fetch(`/api/admin/records?collection=${schema.name}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    notify("ok", `deleted ${id}`);
    await load();
  };

  const move = async (row: Row, direction: -1 | 1) => {
    await fetch(`/api/admin/records?collection=${schema.name}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: String(row[schema.idField]), direction }),
    });
    await load();
  };

  if (editing) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <button
            onClick={() => setEditing(null)}
            className="mono rounded border px-2.5 py-1"
            style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
          >
            ← back
          </button>
          <p className="text-[15px] font-medium">
            {String(editing[schema.titleField] || `New ${schema.label.replace(/s$/, "")}`)}
          </p>
          <button
            onClick={save}
            disabled={busy}
            className="mono ml-auto rounded border px-3 py-1.5 disabled:opacity-40"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            {busy ? "saving…" : "save"}
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {schema.fields.map((f) => (
            <div
              key={f.key}
              className={
                f.type === "textarea" || f.type === "lines" || f.type === "objects"
                  ? "lg:col-span-2"
                  : ""
              }
            >
              <Label field={f} />
              <FieldInput
                field={f}
                value={editing[f.key]}
                onChange={(v) => setEditing((r) => (r ? { ...r, [f.key]: v } : r))}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header schema={schema} backendName={backendName} count={rows.length}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter…"
          className="rounded border bg-transparent px-2.5 py-1 text-[13px] outline-none"
          style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
        />
        <button
          onClick={() => {
            setEditing({ ...schema.blank });
            setOriginalId(null);
          }}
          className="mono rounded border px-3 py-1.5"
          style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
        >
          + new {schema.label.replace(/s$/, "").toLowerCase()}
        </button>
      </Header>

      <div className="space-y-px">
        {visible.map((row, i) => (
          <div
            key={String(row[schema.idField]) + i}
            className="row grid gap-3 border-b py-3 pl-4 sm:grid-cols-[1fr_auto] sm:items-center"
            style={{ borderColor: "var(--line)" }}
          >
            <button
              onClick={() => {
                setEditing({ ...schema.blank, ...row });
                setOriginalId(String(row[schema.idField]));
              }}
              className="min-w-0 text-left"
            >
              <p className="flex flex-wrap items-baseline gap-2 text-[14.5px] font-medium">
                {String(row[schema.titleField] ?? "(untitled)")}
                {schema.fields
                  .filter((f) => f.summary && f.key !== schema.titleField)
                  .map((f) => (
                    <span key={f.key} className="mono" style={{ color: "var(--faint)" }}>
                      {String(row[f.key] ?? "")}
                    </span>
                  ))}
              </p>
              {schema.subtitleField && (
                <p className="mt-0.5 line-clamp-1 max-w-[70ch] text-[13px]" style={{ color: "var(--dim)" }}>
                  {String(row[schema.subtitleField] ?? "")}
                </p>
              )}
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => move(row, -1)}
                disabled={i === 0}
                className="mono rounded border px-1.5 py-0.5 disabled:opacity-25"
                style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
                title="move up"
              >
                ↑
              </button>
              <button
                onClick={() => move(row, 1)}
                disabled={i === visible.length - 1}
                className="mono rounded border px-1.5 py-0.5 disabled:opacity-25"
                style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
                title="move down"
              >
                ↓
              </button>
              <button
                onClick={() => remove(row)}
                className="mono rounded border px-1.5 py-0.5"
                style={{ borderColor: "var(--line)", color: "var(--dead)" }}
              >
                del
              </button>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="mono py-8 text-center" style={{ color: "var(--faint)" }}>
            {rows.length === 0
              ? `no ${schema.label.toLowerCase()} yet — create the first one`
              : "nothing matches that filter"}
          </p>
        )}
      </div>
    </div>
  );
}

function Header({
  schema,
  backendName,
  count,
  dirty,
  children,
}: {
  schema: CollectionSchema;
  backendName: string;
  count?: number;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 border-b pb-4" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[17px] font-medium tracking-tight">{schema.label}</h2>
          <p className="mono mt-0.5" style={{ color: "var(--faint)" }}>
            {backendName === "mongodb" ? "mongodb" : "json files"}
            {count !== undefined && ` · ${count} records`}
            {dirty && " · unsaved changes"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
      <p className="mt-3 max-w-[74ch] text-[13.5px]" style={{ color: "var(--dim)" }}>
        {schema.description}
      </p>
    </div>
  );
}

export { SCHEMAS };
