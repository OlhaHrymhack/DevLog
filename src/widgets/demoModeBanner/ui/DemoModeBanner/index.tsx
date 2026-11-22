import type { Health } from "@/shared/api/health/schema";
import { WifiOff } from "lucide-react";
import { bannerStyles } from "./styles";

export const DemoModeBanner = ({ mode }: { mode?: Health["aiMode"] }) => (
  mode === "demo" && (
    <div role="status" className={bannerStyles}>
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Демо-режим AI.</strong>{" "}
        Без OPENAI_API_KEY агенти повертають детерміновані мок-відповіді. Додайте ключ і перезапустіть{" "}
        <code className="font-mono">npm run dev</code>.
      </p>
    </div>
  )
);
