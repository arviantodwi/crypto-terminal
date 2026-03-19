export const fetchOhlcSchema = {
  body: {
    type: 'object',
    required: ['instrument'],
    additionalProperties: false,
    properties: {
      instrument: { type: 'string', minLength: 1 },
      to_ts: { type: 'integer' },
      pages: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        instrument: { type: 'string' },
        pages_fetched: { type: 'integer' },
        total_records: { type: 'integer' },
        inserted: { type: 'integer' },
        skipped: { type: 'integer' },
        earliest_candle_ts: { type: 'integer' },
        latest_candle_ts: { type: 'integer' },
        duration_ms: { type: 'integer' },
      },
    },
    400: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
    409: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
    502: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};
