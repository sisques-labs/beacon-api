import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SpanStatusCode, metrics, trace } from '@opentelemetry/api';
import { Mock, Mocked, vi } from 'vitest';

import { CqrsObservabilityService } from '@core/observability/cqrs-observability.service';

vi.mock('@opentelemetry/api', async () => {
  const actual =
    await vi.importActual<typeof import('@opentelemetry/api')>(
      '@opentelemetry/api',
    );
  return {
    ...actual,
    trace: { getTracer: vi.fn() },
    metrics: { getMeter: vi.fn() },
  };
});

class TestCommand {
  constructor(public readonly id: string) {}
}

describe('CqrsObservabilityService', () => {
  let commandBus: Mocked<CommandBus>;
  let queryBus: Mocked<QueryBus>;
  let span: {
    end: Mock;
    setStatus: Mock;
    recordException: Mock;
  };
  let tracer: { startActiveSpan: Mock };
  let histogram: { record: Mock };
  let counter: { add: Mock };
  let service: CqrsObservabilityService;

  beforeEach(() => {
    span = { end: vi.fn(), setStatus: vi.fn(), recordException: vi.fn() };
    tracer = {
      startActiveSpan: vi.fn(
        (_name: string, _opts: unknown, fn: (span: unknown) => unknown) =>
          fn(span),
      ),
    };
    histogram = { record: vi.fn() };
    counter = { add: vi.fn() };

    (trace.getTracer as Mock).mockReturnValue(tracer);
    (metrics.getMeter as Mock).mockReturnValue({
      createHistogram: vi.fn().mockReturnValue(histogram),
      createCounter: vi.fn().mockReturnValue(counter),
    });

    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;

    service = new CqrsObservabilityService(commandBus, queryBus);
  });

  it('wraps CommandBus.execute and QueryBus.execute on module init', () => {
    const originalCommandExecute = commandBus.execute;
    const originalQueryExecute = queryBus.execute;

    service.onModuleInit();

    expect(commandBus.execute).not.toBe(originalCommandExecute);
    expect(queryBus.execute).not.toBe(originalQueryExecute);
  });

  it('starts a span named command.<CommandName>, returns the result, and records success metrics', async () => {
    commandBus.execute.mockResolvedValueOnce('handler-result');
    service.instrument(commandBus, 'command');

    const result = await commandBus.execute(new TestCommand('abc'));

    expect(result).toBe('handler-result');
    expect(tracer.startActiveSpan).toHaveBeenCalledWith(
      'command.TestCommand',
      { kind: expect.any(Number) },
      expect.any(Function),
    );
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(span.end).toHaveBeenCalled();
    expect(histogram.record).toHaveBeenCalledWith(expect.any(Number), {
      type: 'TestCommand',
      kind: 'command',
      status: 'success',
    });
    expect(counter.add).toHaveBeenCalledWith(1, {
      type: 'TestCommand',
      kind: 'command',
      status: 'success',
    });
  });

  it('records exception, error status, and error metrics, then rethrows', async () => {
    const error = new Error('handler failed');
    queryBus.execute.mockRejectedValueOnce(error);
    service.instrument(queryBus, 'query');

    await expect(queryBus.execute(new TestCommand('abc'))).rejects.toThrow(
      error,
    );

    expect(span.recordException).toHaveBeenCalledWith(error);
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    expect(span.end).toHaveBeenCalled();
    expect(counter.add).toHaveBeenCalledWith(1, {
      type: 'TestCommand',
      kind: 'query',
      status: 'error',
    });
  });

  it('wraps a non-Error rejection before recording it on the span', async () => {
    queryBus.execute.mockRejectedValueOnce('rejected as string');
    service.instrument(queryBus, 'query');

    await expect(queryBus.execute(new TestCommand('abc'))).rejects.toBe(
      'rejected as string',
    );

    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'rejected as string' }),
    );
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'rejected as string',
    });
  });
});
