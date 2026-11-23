import { Button } from "@/shared/ui/Button";
import { buttonStyles, navStyles, statusStyles } from "./styles";
import type { PaginationProps } from "./types";

export const Pagination = ({ label, page, totalPages, pending, onPageChange }: PaginationProps) => {
  const previousDisabled = pending || page <= 1;
  const nextDisabled = pending || page >= totalPages;
  return (
    <nav aria-label={label} className={navStyles}>
      <p aria-live="polite" className={statusStyles}>Сторінка {page} з {totalPages}</p>
      <Button variant="ghost" className={buttonStyles} aria-disabled={previousDisabled}
        onClick={() => { if (!previousDisabled) onPageChange(page - 1); }}>
        Назад
      </Button>
      <Button variant="ghost" className={buttonStyles} aria-disabled={nextDisabled}
        onClick={() => { if (!nextDisabled) onPageChange(page + 1); }}>
        Далі
      </Button>
    </nav>
  );
};
