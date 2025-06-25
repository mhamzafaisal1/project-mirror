module.exports = {
    type: 'object',
    required: [
      'number',
      'name',
      'active'
    ],
    properties: {
      _id: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$' // optional but must be valid ObjectId if present
      },
      number: {
        type: 'integer'
      },
      name: {
        type: 'string'
      },
      active: {
        type: 'boolean'
      },
      weight: {
        type: ['number', 'null']
      }
    },
    additionalProperties: false
  }; 