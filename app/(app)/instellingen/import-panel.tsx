"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { KIND_LABELS, type Counts } from "@/lib/import/importer";
import type { ImportKind } from "@/lib/import/schema";
import { previewImport, runImport, type ImportResult } from "./actions";

export function ImportPanel() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File | undefined) {
    setResult(null);
    if (!f) return setFile(null);
    const text = await f.text();
    setFile({ name: f.name, text });
    start(async () => setResult(await previewImport(text)));
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Importbestand (JSON)"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-border file:bg-surface file:px-4 file:text-sm file:font-medium"
      />
      {pending ? <p className="text-sm text-muted">Bezig…</p> : null}
      {result && !result.ok ? (
        <Notice tone="error">
          <p className="mb-2 font-medium">Er is niets geïmporteerd. {result.errors.length} fout(en):</p>
          <ul className="max-h-64 list-disc space-y-1 overflow-auto pl-5">
            {result.errors.slice(0, 100).map((e, i) => (
              <li key={i}>
                <code>{e.path}</code>: {e.message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {result?.ok ? <Summary result={result} /> : null}
      {result?.ok && !result.applied && file ? (
        <Button variant="primary" disabled={pending} onClick={() => start(async () => setResult(await runImport(file.text)))}>
          Importeer {file.name}
        </Button>
      ) : null}
    </div>
  );
}

function Summary({ result }: { result: Extract<ImportResult, { ok: true }> }) {
  const { summary, applied } = result;
  const fmt = (c?: Counts) => (c ? `${c.new} / ${c.updated} / ${c.skipped}` : "–");
  const kinds: ImportKind[] = ["objectives", "cards", "illness_scripts", "cases", "questions"];
  return (
    <div className="space-y-3">
      <Notice tone={applied ? "ok" : "info"}>
        {applied ? "Import klaar. Nieuwe inhoud staat als concept klaar in Goedkeuren." : "Controle geslaagd. Zo ziet de import eruit:"}
      </Notice>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-1 text-left text-xs text-muted">Per thema: nieuw / bijgewerkt / overgeslagen</caption>
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">Thema</th>
              {kinds.map((k) => (
                <th key={k} className="py-1 pr-3 font-medium">
                  {KIND_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.topics.map((t) => (
              <tr key={t.external_id} className="border-t border-border">
                <td className="py-1 pr-3">{t.name}</td>
                {kinds.map((k) => (
                  <td key={k} className="py-1 pr-3 tabular-nums">
                    {fmt(t.counts[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Modules: {fmt(summary.general.modules)} · Bronnen: {fmt(summary.general.sources)}
      </p>
      {summary.conflicts.length ? (
        <Notice>
          {summary.conflicts.length} item(s) zijn al actief en worden niet overschreven:{" "}
          {summary.conflicts.slice(0, 10).map((c) => c.external_id).join(", ")}
          {summary.conflicts.length > 10 ? " …" : ""}
        </Notice>
      ) : null}
      {summary.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
    </div>
  );
}
