import { notFound } from "next/navigation";
import { UiKitView } from "@/views/uiKit";

export const metadata = { title: "UI Kit · DevLog" };

/** Каталог компонентів — лише в dev (AC-6): у production сторінки немає. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKitView />;
}
