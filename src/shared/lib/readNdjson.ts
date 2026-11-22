/**
 * Читає NDJSON-потік рядок за рядком. Рядок і навіть UTF-8 символ можуть бути розділені між чанками.
 * Невалідний JSON або виняток з `onValue` скасовують потік і передаються далі.
 */
export const readNdjson = async (body: ReadableStream<Uint8Array>, onValue: (value: unknown) => void): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (final: boolean) => {
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const value: unknown = JSON.parse(line);
        onValue(value);
      }
      newline = buffer.indexOf("\n");
    }
    if (final && buffer.trim()) {
      const value: unknown = JSON.parse(buffer);
      buffer = "";
      onValue(value);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      flush(false);
    }
    buffer += decoder.decode();
    flush(true);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
};
