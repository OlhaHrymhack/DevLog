import { describe, expect, it } from "vitest";
import { readNdjson } from "./readNdjson";

const streamOf = (chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({
  start: (controller) => {
    chunks.forEach((chunk) => controller.enqueue(chunk));
    controller.close();
  },
});

describe("readNdjson", () => {
  it("DEV-008 AC-9: збирає рядки, розділені між чанками, включно з UTF-8 символом посередині", async () => {
    const bytes = new TextEncoder().encode(`${JSON.stringify({ label: "Зібрати задачі" })}\n${JSON.stringify({ n: 2 })}\n{"tail":"є"}`);
    const cyrillicAt = bytes.indexOf(0xd0);
    const chunks = [bytes.slice(0, cyrillicAt + 1), bytes.slice(cyrillicAt + 1, cyrillicAt + 7), bytes.slice(cyrillicAt + 7)];
    const values: unknown[] = [];
    await readNdjson(streamOf(chunks), (value) => values.push(value));
    expect(values).toEqual([{ label: "Зібрати задачі" }, { n: 2 }, { tail: "є" }]);
  });

  it("DEV-008 AC-9: порожні рядки пропускаються, невалідний JSON — помилка", async () => {
    const values: unknown[] = [];
    await readNdjson(streamOf([new TextEncoder().encode("\n{\"a\":1}\n\n")]), (value) => values.push(value));
    expect(values).toEqual([{ a: 1 }]);
    await expect(readNdjson(streamOf([new TextEncoder().encode("{oops}\n")]), () => undefined)).rejects.toThrow(SyntaxError);
  });
});
