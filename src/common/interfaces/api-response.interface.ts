export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationMeta;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  details?: ApiErrorDetail[];
  timestamp: string;
  path: string;
}
