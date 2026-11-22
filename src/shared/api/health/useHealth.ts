"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../http";
import { HealthSchema } from "./schema";

export const useHealth = () => useQuery({
  queryKey: ["health"],
  queryFn: ({ signal }) => fetchJson("/api/health", HealthSchema, { signal }),
});
