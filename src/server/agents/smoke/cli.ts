import { createInterface } from "node:readline/promises";
import { runSmokeCli } from "./runSmokeCli";
import { ensureSmokeToken } from "./smokeToken";

const main = async () => {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.exitCode = await runSmokeCli({
      confirm: (question) => readline.question(question),
      fetchImpl: fetch,
      print: (line) => process.stdout.write(`${line}\n`),
      port: process.env.PORT ?? "3000",
      token: () => ensureSmokeToken(),
    });
  } finally {
    readline.close();
  }
};

void main();
