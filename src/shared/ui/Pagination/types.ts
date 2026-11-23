export type PaginationProps = {
  label: string;
  page: number;
  totalPages: number;
  pending: boolean;
  onPageChange: (page: number) => void;
};
