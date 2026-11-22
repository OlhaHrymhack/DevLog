import { Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { agentTagStyles } from "./styles";
import type { AgentTagProps } from "./types";

export function AgentTag({ label, demo = false, className }: AgentTagProps) {
  return (
    <span className={cn(agentTagStyles({ demo }), className)}>
      {demo ? `Демо · ${label}` : (
        <>
          <Sparkles aria-hidden="true" className="size-4 shrink-0" />
          {label}
        </>
      )}
    </span>
  );
}
