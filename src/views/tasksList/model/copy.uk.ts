const COPY = {
  emptyTitle: { serious: "Поки що задач немає", funny: "Нічого не горить" },
  emptyDescription: {
    serious: "Створіть першу задачу, і агенти допоможуть з пріоритетами та підзадачами.",
    funny: "Або все під контролем, або ти забув створити задачі. Створи першу, агенти підхоплять.",
  },
};

export const t = (key: keyof typeof COPY, serious: boolean) => COPY[key][serious ? "serious" : "funny"];
