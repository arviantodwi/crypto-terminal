const instrumentSchema = {
  type: 'object',
  properties: {
    symbol: { type: 'string' },
    pair: { type: 'string' },
    contractType: { type: 'string' },
    deliveryDate: { type: 'number' },
    status: { type: 'string' },
    lastSyncedAt: { type: 'string' },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

export const getInstrumentsSchema = {
  response: {
    200: {
      type: 'array',
      items: instrumentSchema,
    },
  },
};

export const getInstrumentBySymbolSchema = {
  params: {
    type: 'object',
    required: ['symbol'],
    properties: {
      symbol: { type: 'string' },
    },
  },
  response: {
    200: instrumentSchema,
    404: errorSchema,
  },
};

export const syncInstrumentsSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        newListings: { type: 'integer' },
        delistings: { type: 'integer' },
        upcomingDelistings: { type: 'integer' },
        updates: { type: 'integer' },
      },
    },
    409: errorSchema,
    500: errorSchema,
  },
};
