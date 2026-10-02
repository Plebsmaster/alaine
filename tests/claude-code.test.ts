import { describe, expect, it } from "vitest";
import { AiError, runJson } from "@/lib/ai/client";
import { claudeCodeArgs, parseClaudeCodeOutput, type ClaudeCodeExec } from "@/lib/ai/claude-code";
import { draftCompareOutput } from "@/lib/ai/schemas";

// AI lokaal via Claude Code (AI_PROVIDER=claude-code): zelfde contract als de API.

const ok = (output: unknown, usage = { input_tokens: 10, output_tokens: 5 }) =>
  JSON.stringify({ type: "result", is_error: false, result: "", structured_output: output, usage });

const goodCard = { card: { front: "Hoe onderscheid je A van B?", back: "…", explanation: "", needs_verification: false } };

describe("claudeCodeArgs", () => {
  it("alleen tekst: geen tools, geen instellingen of MCP, geen opgeslagen sessie", () => {
    const args = claudeCodeArgs({ systemFile: "sys.txt", schema: { type: "object" }, model: "claude-sonnet-5-5" });
    expect(args.slice(0, 3)).toEqual(["-p", "--output-format", "json"]);
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--setting-sources") + 1]).toBe("");
    expect(args).toContain("--strict-mcp-config");
    expect(args).toContain("--no-session-persistence");
    expect(args[args.indexOf("--system-prompt-file") + 1]).toBe("sys.txt");
    expect(args[args.indexOf("--model") + 1]).toBe("claude-sonnet-5-5");
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1])).toEqual({ type: "object" });
  });
});

describe("parseClaudeCodeOutput", () => {
  it("leest structured_output en telt tokens", () => {
    const r = parseClaudeCodeOutput(JSON.stringify({ is_error: false, structured_output: { a: 1 }, usage: { input_tokens: 3, cache_read_input_tokens: 4, output_tokens: 2 } }));
    expect(r).toEqual({ output: { a: 1 }, inputTokens: 7, outputTokens: 2 });
  });

  it("valt terug op JSON in result", () => {
    expect(parseClaudeCodeOutput(JSON.stringify({ is_error: false, result: '{"a":2}' })).output).toEqual({ a: 2 });
  });

  it("niet ingelogd: duidelijke melding", () => {
    expect(() => parseClaudeCodeOutput(JSON.stringify({ is_error: true, result: "Failed to authenticate: OAuth session expired" }))).toThrow(/claude auth login/);
  });

  it("onleesbare uitvoer: nette fout", () => {
    expect(() => parseClaudeCodeOutput("geen json")).toThrow(/geen leesbaar antwoord/);
  });
});

describe("runJson via Claude Code", () => {
  it("valideert met zod en doet één nieuwe poging met de fout erbij", async () => {
    const prompts: string[] = [];
    const outputs = [ok({ card: { front: "", back: "x", explanation: "", needs_verification: false } }), ok(goodCard)];
    const cli: ClaudeCodeExec = async (_args, stdin) => {
      prompts.push(stdin);
      return outputs.shift()!;
    };
    const out = await runJson({ fn: "draft_compare", system: "s", user: "vergelijk A en B", schema: draftCompareOutput, cli });
    expect(out).toEqual(goodCard);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toBe("vergelijk A en B");
    expect(prompts[1]).toContain("card.front");
  });

  it("CLI-fout wordt een AiError", async () => {
    const cli: ClaudeCodeExec = async () => JSON.stringify({ is_error: true, result: "Failed to authenticate" });
    await expect(runJson({ fn: "draft_compare", system: "s", user: "u", schema: draftCompareOutput, cli })).rejects.toBeInstanceOf(AiError);
  });
});
