export type PlanEntry = {
  id: string;
  title: string;
  /** Пояснення агента; у fallback і в серйозному режимі не показується. */
  why?: string;
  /** Жарт агента; лише поза серйозним режимом. */
  joke?: string | null;
};

export type PlanListProps = {
  entries: readonly PlanEntry[];
};
