import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import {
  ApiResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';
import { ResponseInterceptor } from './response.interceptor';

const ISO_8601_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function contextWith(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function handlerOf(payload: unknown): CallHandler<unknown> {
  return { handle: () => of(payload) };
}

async function intercept(
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResponse<unknown>> {
  return lastValueFrom(
    new ResponseInterceptor().intercept(
      contextWith(headers),
      handlerOf(payload),
    ),
  );
}

describe('ResponseInterceptor', () => {
  it('embrulha objeto simples em { data, meta }', async () => {
    const result = await intercept({ id: 'clx1', name: 'Exemplo' });

    expect(result.data).toEqual({ id: 'clx1', name: 'Exemplo' });
    expect(result.meta.timestamp).toMatch(ISO_8601_MS);
    expect(typeof result.meta.requestId).toBe('string');
    expect(result.meta.requestId.length).toBeGreaterThan(0);
  });

  it('ecoa o x-request-id recebido sem alteracao', async () => {
    const result = await intercept(
      { id: 'clx1' },
      { 'x-request-id': 'req_abc123def456' },
    );

    expect(result.meta.requestId).toBe('req_abc123def456');
  });

  it('gera um id novo e diferente quando o header falta', async () => {
    const first = await intercept({ id: 'clx1' });
    const second = await intercept({ id: 'clx1' });

    expect(first.meta.requestId).not.toBe(second.meta.requestId);
  });

  it('trata header vazio como ausente', async () => {
    const result = await intercept({ id: 'clx1' }, { 'x-request-id': '' });

    expect(result.meta.requestId).not.toBe('');
    expect(result.meta.requestId.length).toBeGreaterThan(0);
  });

  it('nao inclui meta.pagination em recurso unico', async () => {
    const result = await intercept({ id: 'clx1' });

    expect('pagination' in result.meta).toBe(false);
  });

  it('inclui meta.pagination com as seis chaves em listagem', async () => {
    const pagination: PaginationMeta = {
      total: 142,
      page: 1,
      limit: 20,
      totalPages: 8,
      hasNextPage: true,
      hasPreviousPage: false,
    };

    const result = await intercept({
      items: [{ id: 'clx1' }, { id: 'clx2' }],
      meta: pagination,
    });

    expect(result.meta.pagination).toEqual(pagination);
    expect(Object.keys(result.meta.pagination ?? {})).toHaveLength(6);
  });

  it('devolve o array direto em data, nunca { items }', async () => {
    const result = await intercept({
      items: [{ id: 'clx1' }, { id: 'clx2' }],
      meta: {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(result.data).toEqual([{ id: 'clx1' }, { id: 'clx2' }]);
  });
});
