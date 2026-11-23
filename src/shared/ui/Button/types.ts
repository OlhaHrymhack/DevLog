import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import type { buttonStyles } from "./styles";

type ButtonBaseProps = Omit<ComponentProps<"button">, "children"> &
  Pick<VariantProps<typeof buttonStyles>, "variant"> & {
    children?: React.ReactNode;
    /** Рендерить дочірній елемент (напр. `<a>`) з тими самими стилями. */
    asChild?: boolean;
  };

export type ButtonProps =
  | (ButtonBaseProps & { size?: "sm" | "md" })
  // Кнопка-іконка без тексту: доступна назва обов'язкова на рівні типів.
  | (ButtonBaseProps & { size: "icon"; "aria-label": string });
