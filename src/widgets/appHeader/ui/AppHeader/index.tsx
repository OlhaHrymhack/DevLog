import { FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/features/themeToggle";
import { Button } from "@/shared/ui/Button";
import { headerStyles, logoMarkStyles, logoStyles } from "./styles";
import type { AppHeaderProps } from "./types";

export const AppHeader = ({ onOpenDevPanel, onNewTask }: AppHeaderProps) => (
  <header className={headerStyles}>
    <Link href="/" className={logoStyles} aria-label="DevLog, на головну">
      <span className={logoMarkStyles} aria-hidden="true">dl</span>
      <span className="font-semibold tracking-[0.04em]">DEVLOG</span>
    </Link>
    <span className="hidden text-fg-dim md:inline">/ Platform team</span>
    <div className="flex-1" />
    {onOpenDevPanel && (
      <Button variant="ghost" size="icon" className="size-11" aria-label="Стани прототипу" onClick={onOpenDevPanel}>
        <FlaskConical aria-hidden="true" className="size-4" />
      </Button>
    )}
    <ThemeToggle />
    <Button className="hidden md:inline-flex" disabled={!onNewTask} onClick={onNewTask}>
      <Plus aria-hidden="true" className="size-4" /> Нова задача
    </Button>
  </header>
);
