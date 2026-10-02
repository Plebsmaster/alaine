import "server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// AI lokaal zonder API-key (AI_PROVIDER=claude-code): de server roept de Claude Code-CLI op deze
// laptop aan (`claude -p`), die met het eigen Claude-account is ingelogd (`claude auth login`).
// Zonder tools, zonder projectinstellingen of MCP, zonder opgeslagen sessie: alleen systeemprompt,
// prompt en een JSON-schema. Werkt niet op Vercel; daar blijft ANTHROPIC_API_KEY nodig.

export function claudeCodeEnabled(): boolean {
  return process.env.AI_PROVIDER === "claude-code";
}

export type ClaudeCodeResult = { output: unknown; inputTokens: number; outputTokens: number };

/** Draait de CLI met deze argumenten en prompt op stdin; geeft stdout terug. Vervangbaar in tests. */
export type ClaudeCodeExec = (args: string[], stdin: string, timeoutMs: number) => Promise<string>;

export class ClaudeCodeError extends Error {}

function bin(): string {
  if (process.env.CLAUDE_CODE_BIN) return process.env.CLAUDE_CODE_BIN;
  const local = join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
  return existsSync(local) ? local : "claude";
}

const defaultExec: ClaudeCodeExec = (args, stdin, timeoutMs) =>
  new Promise((resolve, reject) => {
    const env = { ...process.env };
    // Geen API-key doorgeven (dan zou de CLI die gebruiken) en niet als geneste sessie starten.
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_BASE_URL;
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    const child = spawn(bin(), args, { cwd: tmpdir(), env, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new ClaudeCodeError("Claude Code deed er te lang over."));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ClaudeCodeError(`Claude Code niet gevonden of niet te starten (${e.message}). Zet CLAUDE_CODE_BIN in .env.local.`));
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (out.trim()) resolve(out);
      else reject(new ClaudeCodeError(`Claude Code gaf geen antwoord${err ? `: ${err.trim().slice(0, 200)}` : "."}`));
    });
    child.stdin.end(stdin);
  });

/** De argumenten voor één aanroep: alleen tekst in, gevalideerd JSON uit. */
export function claudeCodeArgs(opts: { systemFile: string; schema: object; model: string }): string[] {
  return [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(opts.schema),
    "--system-prompt-file",
    opts.systemFile,
    "--model",
    opts.model,
    "--tools",
    "",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
}

/** Leest het resultaat van `claude -p --output-format json`. */
export function parseClaudeCodeOutput(stdout: string): ClaudeCodeResult {
  let data: {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new ClaudeCodeError("Claude Code gaf geen leesbaar antwoord.");
  }
  if (data.is_error) {
    const msg = data.result ?? "";
    if (/authenticat|log ?in|oauth/i.test(msg)) {
      throw new ClaudeCodeError("Claude Code is niet ingelogd. Voer op deze laptop `claude auth login` uit en probeer het opnieuw.");
    }
    if (/limit|quota|usage/i.test(msg)) throw new ClaudeCodeError("De limiet van je Claude-account is bereikt. Probeer het later opnieuw.");
    throw new ClaudeCodeError(`Claude Code-aanroep mislukt: ${msg.slice(0, 200) || "onbekende fout"}.`);
  }
  let output = data.structured_output;
  if (output === undefined && data.result) {
    try {
      output = JSON.parse(data.result);
    } catch {
      output = data.result;
    }
  }
  const u = data.usage ?? {};
  return {
    output,
    inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
  };
}

/** Eén aanroep van de CLI. De systeemprompt gaat via een tijdelijk bestand (Windows kent een maximale opdrachtlengte). */
export async function runClaudeCode(
  opts: { system: string; prompt: string; schema: object; model: string; timeoutMs?: number },
  exec: ClaudeCodeExec = defaultExec,
): Promise<ClaudeCodeResult> {
  const dir = await mkdtemp(join(tmpdir(), "pa-studie-ai-"));
  try {
    const systemFile = join(dir, "system.txt");
    await writeFile(systemFile, opts.system, "utf8");
    const stdout = await exec(claudeCodeArgs({ systemFile, schema: opts.schema, model: opts.model }), opts.prompt, opts.timeoutMs ?? 240_000);
    return parseClaudeCodeOutput(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
