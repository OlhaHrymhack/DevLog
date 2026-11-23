"use client";

import { Gauge } from "lucide-react";
import { useState } from "react";
import { PublicQuotaKindSchema } from "@/shared/api/agentQuota/schema";
import { useAgentQuota } from "@/shared/api/agentQuota/useAgentQuota";
import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { remainingStyles, rowStyles, totalStyles } from "./styles";

const LABELS = {
  prioritize: "План на день",
  "stuck-radar": "Радар застряглих",
  "voice-draft": "Голосовий ввід",
  decompose: "Декомпозиція задач",
  "status-update": "Статус-апдейти",
};

export const AgentQuotaDialog = () => {
  const [open, setOpen] = useState(false);
  const quota = useAgentQuota(open);
  const data = quota.data;
  const rows = data?.enabled ? PublicQuotaKindSchema.options.map((kind) => ({
    kind,
    used: data.used[kind],
  })) : [];
  const used = rows.reduce((total, row) => total + row.used, 0);

  return (
    <>
      <Button variant="ghost" size="sm" className="min-h-11 shrink-0" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Gauge aria-hidden="true" className="size-4" />
        Спроби AI
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Спроби AI"
        description={data?.enabled ? "Ліміт спільний для всіх AI-функцій і відвідувачів." : undefined}>
        {quota.isPending && <p role="status">Завантажуємо ліміти…</p>}
        {quota.isError && (
          <div className="space-y-3">
            <p role="alert">Не вдалося оновити лічильники спроб.</p>
            <Button variant="ghost" disabled={quota.isFetching} onClick={() => void quota.refetch()}>Спробувати ще раз</Button>
          </div>
        )}
        {data?.enabled === false && <p>У цьому середовищі запуск AI без ліміту.</p>}
        {data?.enabled && (
          <>
            <p className={totalStyles}>
              <span>Залишилось загалом</span>
              <strong>{Math.max(0, data.limit - used)} із {data.limit}</strong>
            </p>
            <ul aria-label="Запуски за функціями">
              {rows.map(({ kind, used }) => (
                <li key={kind} className={rowStyles}>
                  <span>{LABELS[kind]}</span>
                  <span className={remainingStyles}>Використано {used}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ResponsiveDialog>
    </>
  );
};
