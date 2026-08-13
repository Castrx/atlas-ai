import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/tools/tool-registry";
import type { Tool } from "../../src/tools/tool.types";

const echoArgsSchema = z.object({ value: z.string() }).strict();
type EchoArgs = z.infer<typeof echoArgsSchema>;

function buildEchoTool(overrides: Partial<Tool<EchoArgs, unknown>> = {}): Tool<EchoArgs, unknown> {
  return {
    name: "echo",
    description: "Devolve o valor recebido.",
    readOnly: true,
    argsSchema: echoArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
      additionalProperties: false,
    },
    execute: async (args) => ({ echoed: args.value }),
    ...overrides,
  };
}

describe("ToolRegistry.list", () => {
  it("expõe name/description/parameters de cada tool registrada", () => {
    const registry = new ToolRegistry([buildEchoTool()]);

    expect(registry.list()).toEqual([
      {
        name: "echo",
        description: "Devolve o valor recebido.",
        parameters: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      },
    ]);
  });
});

describe("ToolRegistry.invoke", () => {
  it("ok: devolve status ok com o dado quando a tool executa e o resultado não é vazio", async () => {
    const registry = new ToolRegistry([buildEchoTool()]);

    const result = await registry.invoke("echo", { value: "oi" });

    expect(result).toEqual({ status: "ok", data: { echoed: "oi" } });
  });

  it("empty: devolve status empty quando a tool devolve uma lista vazia", async () => {
    const tool = buildEchoTool({ execute: async () => [] });
    const registry = new ToolRegistry([tool]);

    const result = await registry.invoke("echo", { value: "oi" });

    expect(result).toEqual({ status: "empty" });
  });

  it("empty: devolve status empty quando a tool devolve null", async () => {
    const tool = buildEchoTool({ execute: async () => null });
    const registry = new ToolRegistry([tool]);

    const result = await registry.invoke("echo", { value: "oi" });

    expect(result).toEqual({ status: "empty" });
  });

  it("invalid_arguments: devolve status invalid_arguments quando os argumentos não passam no schema", async () => {
    const registry = new ToolRegistry([buildEchoTool()]);

    const result = await registry.invoke("echo", { value: 123 });

    expect(result.status).toBe("invalid_arguments");
    expect((result as { status: "invalid_arguments"; issues: string[] }).issues.length).toBeGreaterThan(0);
  });

  it("invalid_arguments: NÃO chama execute() quando os argumentos não passam no schema", async () => {
    const executeSpy = vi.fn(async (args: EchoArgs) => ({ echoed: args.value }));
    const tool = buildEchoTool({ execute: executeSpy });
    const registry = new ToolRegistry([tool]);

    const result = await registry.invoke("echo", { value: 123 });

    expect(result.status).toBe("invalid_arguments");
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("unknown_tool: devolve status unknown_tool quando o nome não está registrado", async () => {
    const registry = new ToolRegistry([buildEchoTool()]);

    const result = await registry.invoke("naoExiste", {});

    expect(result).toEqual({ status: "unknown_tool" });
  });

  it("unknown_tool: NÃO chama execute() de nenhuma tool registrada quando o nome não existe", async () => {
    const executeSpy = vi.fn(async (args: EchoArgs) => ({ echoed: args.value }));
    const tool = buildEchoTool({ execute: executeSpy });
    const registry = new ToolRegistry([tool]);

    const result = await registry.invoke("naoExiste", {});

    expect(result).toEqual({ status: "unknown_tool" });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("execution_error: devolve status execution_error quando execute() lança, sem vazar o erro real", async () => {
    const tool = buildEchoTool({
      execute: async () => {
        throw new Error("detalhe sensível da integração");
      },
    });
    const registry = new ToolRegistry([tool]);

    const result = await registry.invoke("echo", { value: "oi" });

    expect(result).toEqual({ status: "execution_error" });
    expect(JSON.stringify(result)).not.toContain("detalhe sensível");
  });

  it("timeout: devolve status timeout quando a tool excede o tempo máximo configurado", async () => {
    const tool = buildEchoTool({
      execute: () => new Promise((resolve) => setTimeout(resolve, 50)),
    });
    const registry = new ToolRegistry([tool], 5);

    const result = await registry.invoke("echo", { value: "oi" });

    expect(result).toEqual({ status: "timeout" });
  });

  it("nunca lança exceção, mesmo quando a tool falha", async () => {
    const tool = buildEchoTool({
      execute: async () => {
        throw new Error("boom");
      },
    });
    const registry = new ToolRegistry([tool]);

    await expect(registry.invoke("echo", { value: "oi" })).resolves.toBeDefined();
  });
});
