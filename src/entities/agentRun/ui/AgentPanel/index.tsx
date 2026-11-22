"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "@/shared/lib/hooks/useMediaQuery";
import { AgentTag } from "../AgentTag";
import { bodyStyles, headStyles, panelStyles, summaryStyles, tagStyles, titleStyles } from "./styles";
import type { AgentPanelProps } from "./types";

export const AgentPanel = ({ title, icon, tagLabel, demo = false, collapsible = false, running = false, summary, children }: AgentPanelProps) => {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const isOpen = !collapsible || open;
  // На десктопі панель завжди розгорнута, тож і для скрінрідера aria-expanded = true.
  const expanded = !collapsible || isDesktop || open;

  const heading = (
    <>
      <h2 className={titleStyles}>
        {icon}
        {title}
      </h2>
      <span className="flex items-center gap-2">
        <AgentTag label={tagLabel} demo={demo} className={tagStyles} />
        {collapsible ? <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-[var(--dur-base)] lg:hidden ${open ? "rotate-180" : ""}`} /> : null}
      </span>
    </>
  );

  return (
    <section aria-label={title} data-open={isOpen} className={panelStyles({ running })}>
      {collapsible ? (
        <button type="button" aria-expanded={expanded} className={`${headStyles} cursor-pointer lg:cursor-default`} onClick={() => setOpen((value) => !value)}>
          {heading}
        </button>
      ) : (
        <div className={headStyles}>{heading}</div>
      )}
      {summary ? <p className={summaryStyles}>{summary}</p> : null}
      <div className={bodyStyles}>{children}</div>
    </section>
  );
};
