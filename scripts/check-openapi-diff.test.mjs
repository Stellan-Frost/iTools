import assert from 'node:assert/strict';
import test from 'node:test';
import { findBreakingOpenApiChanges } from './openapi-compatibility.mjs';

function baselineDocument() {
  return {
    openapi: '3.1.0',
    paths: {
      '/widgets/{id}': {
        get: {
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Widget',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['id', 'name'],
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
    },
  };
}

test('allows additive paths, optional parameters, and optional response fields', () => {
  const baseline = baselineDocument();
  const current = structuredClone(baseline);
  current.paths['/widgets/{id}'].get.parameters.push({
    name: 'view',
    in: 'query',
    required: false,
    schema: { type: 'string' },
  });
  current.paths['/widgets/{id}'].get.responses['200'].content[
    'application/json'
  ].schema.properties.metadata = { type: 'string' };
  current.paths['/widgets/{id}'].get.responses['202'] = {
    description: 'Accepted',
  };
  current.paths['/widgets/{id}/history'] = {
    get: { responses: { 200: { description: 'History' } } },
  };

  assert.deepEqual(findBreakingOpenApiChanges(baseline, current), []);
});

test('negative probe catches removed response fields, required inputs, and tighter input schemas', () => {
  const baseline = baselineDocument();
  const current = structuredClone(baseline);
  current.paths['/widgets/{id}'].get.parameters.push({
    name: 'locale',
    in: 'query',
    required: true,
    schema: { type: 'string' },
  });
  delete current.paths['/widgets/{id}'].get.responses['200'].content[
    'application/json'
  ].schema.properties.name;
  current.paths['/widgets/{id}'].post.requestBody.content[
    'application/json'
  ].schema.required.push('format');
  current.paths['/widgets/{id}'].post.requestBody.content[
    'application/json'
  ].schema.properties.format = { type: 'string', enum: ['compact'] };
  current.paths['/widgets/{id}'].post.requestBody.content[
    'application/json'
  ].schema.properties.name.enum = ['Ada'];

  const changes = findBreakingOpenApiChanges(baseline, current);
  assert.ok(
    changes.some((change) =>
      change.includes('made parameter query:locale required'),
    ),
  );
  assert.ok(changes.some((change) => change.includes('removed property name')));
  assert.ok(
    changes.some((change) => change.includes('made property format required')),
  );
  assert.ok(
    changes.some((change) => change.includes('changed request enum values')),
    changes.join('\n'),
  );
});

test('negative probe catches removed operations, response codes, and new authorization', () => {
  const baseline = baselineDocument();
  const current = structuredClone(baseline);
  delete current.paths['/widgets/{id}'].get;
  delete current.paths['/widgets/{id}'].post.responses['201'];
  current.paths['/widgets/{id}'].post.security = [{ bearerAuth: [] }];

  const changes = findBreakingOpenApiChanges(baseline, current);
  assert.ok(changes.some((change) => change.includes('removed operation GET')));
  assert.ok(changes.some((change) => change.includes('removed response 201')));
  assert.ok(
    changes.some((change) => change.includes('strengthened or added security')),
  );
});
