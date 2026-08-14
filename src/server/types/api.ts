export type ApiStatus = -1 | 0 | 1;

export interface ApiResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  data?: T | null;
  [key: string]: unknown;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}
