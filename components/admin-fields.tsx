"use client";

import { useState } from "react";
import type { Field } from "@/lib/admin-schema";

/* Reusable field renderers. One switch drives every editor in the panel. */

const inputStyle = {
  color: "var(--ink)",
  background: "var(--panel)",
  borderColor: "var(--line-bright)",
};

export function Label({ field }: { field: Field }) {
  return (
    <div className="mb-1.5">
      <span className="mono" style={{ color: "var(--faint)" }}>
        {field.label}
        {field.required && <span style={{ color: "var(--signal)" }}> *</span>}
      </span>
      {field.hint && (
        <p className="mt-1 max-w-[62ch] text-[12px]" style={{ color: "var(--faint)" }}>
          {field.hint}
        </p>
      )}
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          className="w-full resize-y rounded border px-3 py-2 text-[13.5px] leading-relaxed outline-none"
          style={inputStyle}
        />
      );

    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border px-2.5 py-1.5 text-[13.5px] outline-none"
          style={inputStyle}
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o} style={{ background: "var(--panel)" }}>
              {o}
            </option>
          ))}
        </select>
      );

    case "tags":
      return <TagsInput value={(value as string[]) ?? []} onChange={onChange} />;

    case "lines":
      return (
        <textarea
          value={((value as string[]) ?? []).join("\n")}
          onChange={(e) =>
            onChange(e.target.value.split("\n").map((l) => l.trimStart()).filter((l, i, a) => l !== "" || i < a.length - 1))
          }
          rows={field.rows ?? 5}
          placeholder="one per line"
          className="w-full resize-y rounded border px-3 py-2 font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed outline-none"
          style={inputStyle}
        />
      );

    case "objects":
      return (
        <ObjectListInput
          rows={(value as Record<string, unknown>[]) ?? []}
          fields={field.fields ?? []}
          onChange={onChange}
        />
      );

    default:
      return (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded border px-3 py-1.5 text-[13.5px] outline-none"
          style={inputStyle}
        />
      );
  }
}

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parts = draft
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !value.includes(p));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <button
            key={tag}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="mono group inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5"
            style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
            title="remove"
          >
            {tag}
            <span style={{ color: "var(--faint)" }}>×</span>
          </button>
        ))}
        {value.length === 0 && (
          <span className="mono" style={{ color: "var(--faint)" }}>
            none yet
          </span>
        )}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder="type and press enter — commas split"
        className="w-full rounded border px-3 py-1.5 text-[13.5px] outline-none"
        style={inputStyle}
      />
    </div>
  );
}

function ObjectListInput({
  rows,
  fields,
  onChange,
}: {
  rows: Record<string, unknown>[];
  fields: Field[];
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const update = (i: number, key: string, v: unknown) =>
    onChange(rows.map((r, j) => (i === j ? { ...r, [key]: v } : r)));

  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded border p-3"
            style={{ borderColor: "var(--line)", background: "var(--raised)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="num" style={{ color: "var(--faint)", fontSize: 11 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="mono rounded border px-1.5 disabled:opacity-30"
                style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="mono rounded border px-1.5 disabled:opacity-30"
                style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
              >
                ↓
              </button>
              <button
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="mono ml-auto rounded border px-1.5"
                style={{ borderColor: "var(--line)", color: "var(--dead)" }}
              >
                remove
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <span className="mono mb-1 block" style={{ color: "var(--faint)" }}>
                    {f.label}
                  </span>
                  <FieldInput
                    field={f}
                    value={row[f.key]}
                    onChange={(v) => update(i, f.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          onChange([...rows, Object.fromEntries(fields.map((f) => [f.key, ""]))])
        }
        className="mono mt-2 rounded border px-2.5 py-1"
        style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
      >
        + add
      </button>
    </div>
  );
}

/** Skills are a map of category → technologies; it gets its own editor. */
export function SkillsEditor({
  value,
  onChange,
}: {
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}) {
  const [newCategory, setNewCategory] = useState("");
  const entries = Object.entries(value);

  return (
    <div>
      <div className="space-y-4">
        {entries.map(([category, list]) => (
          <div key={category} className="border-b pb-4" style={{ borderColor: "var(--line)" }}>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={category}
                onChange={(e) => {
                  const next: Record<string, string[]> = {};
                  for (const [k, v] of entries) next[k === category ? e.target.value : k] = v;
                  onChange(next);
                }}
                className="rounded border px-2 py-1 text-[13.5px] font-medium outline-none"
                style={inputStyle}
              />
              <span className="mono" style={{ color: "var(--faint)" }}>
                {list.length}
              </span>
              <button
                onClick={() => {
                  const next = { ...value };
                  delete next[category];
                  onChange(next);
                }}
                className="mono ml-auto rounded border px-1.5 py-0.5"
                style={{ borderColor: "var(--line)", color: "var(--dead)" }}
              >
                remove group
              </button>
            </div>
            <TagsInput
              value={list}
              onChange={(next) => onChange({ ...value, [category]: next })}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="new group, e.g. Observability"
          className="rounded border px-3 py-1.5 text-[13.5px] outline-none"
          style={inputStyle}
        />
        <button
          onClick={() => {
            if (!newCategory.trim() || value[newCategory]) return;
            onChange({ ...value, [newCategory.trim()]: [] });
            setNewCategory("");
          }}
          className="mono rounded border px-2.5 py-1"
          style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
        >
          + group
        </button>
      </div>
    </div>
  );
}
