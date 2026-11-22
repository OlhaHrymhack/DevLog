import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

const KEY_MARKER = "dl-test-key-marker-91c4";

const captureLogger = () => {
  const lines: string[] = [];
  const logger = createLogger({
    level: "info",
    destination: {
      write(message: string) {
        lines.push(message);
      },
    },
  });
  return { logger, lines };
};

describe("logger redact", () => {
  it("DEV-001 AC-5: logger редагує apiKey, headers.authorization і OPENAI_API_KEY", () => {
    const { logger, lines } = captureLogger();

    logger.info(
      {
        apiKey: KEY_MARKER,
        client: { apiKey: KEY_MARKER },
        headers: { authorization: `Bearer ${KEY_MARKER}` },
        request: { headers: { authorization: `Bearer ${KEY_MARKER}` } },
        OPENAI_API_KEY: KEY_MARKER,
        env: { OPENAI_API_KEY: KEY_MARKER },
      },
      "request sent",
    );

    expect(lines).toHaveLength(1);
    const line = lines[0] ?? "";
    expect(line).not.toContain(KEY_MARKER);
    expect(JSON.parse(line)).toMatchObject({
      msg: "request sent",
      apiKey: "[Redacted]",
      client: { apiKey: "[Redacted]" },
      headers: { authorization: "[Redacted]" },
      request: { headers: { authorization: "[Redacted]" } },
      OPENAI_API_KEY: "[Redacted]",
      env: { OPENAI_API_KEY: "[Redacted]" },
    });
  });

  it("DEV-001 AC-5: logger редагує x-api-key і секрети на кількох рівнях вкладеності", () => {
    const { logger, lines } = captureLogger();

    logger.error(
      {
        headers: { "x-api-key": KEY_MARKER },
        request: { headers: { "x-api-key": KEY_MARKER } },
        err: { request: { headers: { authorization: `Bearer ${KEY_MARKER}` } } },
        sdk: { options: { apiKey: KEY_MARKER } },
        taskId: "task-1",
      },
      "sdk call failed",
    );

    const line = lines[0] ?? "";
    expect(line).not.toContain(KEY_MARKER);
    expect(JSON.parse(line)).toMatchObject({
      headers: { "x-api-key": "[Redacted]" },
      request: { headers: { "x-api-key": "[Redacted]" } },
      err: { request: { headers: { authorization: "[Redacted]" } } },
      sdk: { options: { apiKey: "[Redacted]" } },
      taskId: "task-1",
    });
  });

  it("DEV-008 AC-10: logger редагує заголовок Authorization (SDK openai) і OPENAI_API_KEY", () => {
    const { logger, lines } = captureLogger();
    const bearer = ["Bearer", KEY_MARKER].join(" ");
    logger.info({
      headers: { Authorization: bearer },
      err: { request: { headers: { Authorization: bearer } } },
      OPENAI_API_KEY: KEY_MARKER,
    }, "openai call");
    const line = lines[0] ?? "";
    expect(line).not.toContain(KEY_MARKER);
    expect(JSON.parse(line)).toMatchObject({
      headers: { Authorization: "[Redacted]" },
      err: { request: { headers: { Authorization: "[Redacted]" } } },
      OPENAI_API_KEY: "[Redacted]",
    });
  });

  it("DEV-001 AC-5: звичайні поля логуються без змін", () => {
    const { logger, lines } = captureLogger();
    logger.info({ taskId: "task-1" }, "task loaded");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ taskId: "task-1", msg: "task loaded" });
  });
});
