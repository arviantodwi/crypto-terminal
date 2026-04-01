export const seedOhlcSchema = {
  body: {
    type: 'object',
    required: ['instrument'],
    additionalProperties: false,
    properties: {
      instrument: { type: 'string', minLength: 1 },
      aggregate: { type: 'integer', minimum: 1, default: 5 },
      forward_fill: { type: 'boolean', default: false },
      numbers: { type: 'integer', minimum: 1 },
    },
  },
  response: {
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
  },
};
