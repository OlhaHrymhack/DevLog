import { AlertTriangle } from "lucide-react";
import { alertStyles } from "./styles";
import type { AgentFallbackAlertProps } from "./types";

export function AgentFallbackAlert({ title, children }: AgentFallbackAlertProps) {
  return (
    <div role="alert" className={alertStyles}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <b className="block">{title}</b>
        {children}
      </div>
    </div>
  );
}
