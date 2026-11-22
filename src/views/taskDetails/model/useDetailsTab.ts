"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_DETAILS_TAB, parseDetailsTab, type DetailsTab } from "./detailsTab";

export const useDetailsTab = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseDetailsTab(searchParams.get("tab"));

  const setTab = (next: DetailsTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === DEFAULT_DETAILS_TAB) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { tab, setTab };
};
