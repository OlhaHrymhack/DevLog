import { Slot } from "radix-ui";
import { cn } from "@/shared/lib/cn";
import { buttonStyles } from "./styles";
import type { ButtonProps } from "./types";

export function Button({ variant, size, asChild = false, className, type = "button", ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return <Component type={asChild ? undefined : type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
