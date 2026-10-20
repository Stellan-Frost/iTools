const METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);
const OBJECT_IDS = new WeakMap();
let nextObjectId = 0;

export function findBreakingOpenApiChanges(before, after) {
  assertDocument(before, 'baseline');
  assertDocument(after, 'current');
  const context = { before, after, changes: [], visited: new Set() };
  for (const [path, oldValue] of Object.entries(before.paths)) {
    const newValue = after.paths[path];
    if (!isRecord(newValue)) {
      context.changes.push(`removed path ${path}`);
      continue;
    }
    const oldPath = reference(oldValue, before);
    const newPath = reference(newValue, after);
    for (const method of METHODS) {
      if (!isRecord(oldPath[method])) continue;
      const label = `${method.toUpperCase()} ${path}`;
      if (!isRecord(newPath[method])) {
        context.changes.push(`removed operation ${label}`);
        continue;
      }
      compareOperation(
        oldPath[method],
        newPath[method],
        oldPath,
        newPath,
        label,
        context,
      );
    }
  }
  return [...new Set(context.changes)].sort();
}

function assertDocument(value, name) {
  if (
    !isRecord(value) ||
    typeof value.openapi !== 'string' ||
    !isRecord(value.paths)
  ) {
    throw new Error(`${name} is not an OpenAPI document with paths.`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reference(value, document) {
  if (!isRecord(value) || typeof value.$ref !== 'string') return value;
  if (!value.$ref.startsWith('#/'))
    throw new Error(`Unsupported external reference: ${value.$ref}`);
  const target = value.$ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((item, key) => {
      return item !== null && typeof item === 'object' ? item[key] : undefined;
    }, document);
  if (!isRecord(target))
    throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`);
  return target;
}

function compareOperation(
  oldOpValue,
  newOpValue,
  oldPath,
  newPath,
  label,
  context,
) {
  const oldOp = reference(oldOpValue, context.before);
  const newOp = reference(newOpValue, context.after);
  const oldParameters = collectParameters(oldPath.parameters, context.before);
  const newParameters = collectParameters(newPath.parameters, context.after);
  for (const [key, value] of collectParameters(
    oldOp.parameters,
    context.before,
  ))
    oldParameters.set(key, value);
  for (const [key, value] of collectParameters(newOp.parameters, context.after))
    newParameters.set(key, value);
  for (const [key, oldParameter] of oldParameters) {
    const newParameter = newParameters.get(key);
    if (newParameter === undefined) {
      context.changes.push(`${label} removed parameter ${key}`);
      continue;
    }
    if (newParameter.required === true && oldParameter.required !== true) {
      context.changes.push(`${label} made parameter ${key} required`);
    }
    compareSchema(
      oldParameter.schema,
      newParameter.schema,
      'request',
      `${label} parameter ${key}`,
      context,
    );
  }
  for (const [key, parameter] of newParameters) {
    if (!oldParameters.has(key) && parameter.required === true) {
      context.changes.push(`${label} made parameter ${key} required`);
    }
  }
  compareRequestBody(oldOp.requestBody, newOp.requestBody, label, context);
  compareResponses(oldOp.responses, newOp.responses, label, context);
  compareSecurity(
    security(context.before, oldOp),
    security(context.after, newOp),
    label,
    context,
  );
}

function collectParameters(values, document) {
  const output = new Map();
  if (!Array.isArray(values)) return output;
  for (const value of values) {
    const parameter = reference(value, document);
    if (
      typeof parameter.name !== 'string' ||
      typeof parameter.in !== 'string'
    ) {
      throw new Error('OpenAPI parameter must include name and in fields.');
    }
    output.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return output;
}

function compareRequestBody(oldValue, newValue, label, context) {
  if (oldValue === undefined) return;
  if (newValue === undefined) {
    context.changes.push(`${label} removed request body`);
    return;
  }
  const oldBody = reference(oldValue, context.before);
  const newBody = reference(newValue, context.after);
  if (newBody.required === true && oldBody.required !== true) {
    context.changes.push(`${label} made request body required`);
  }
  compareContent(
    oldBody.content,
    newBody.content,
    'request',
    `${label} request body`,
    context,
  );
}

function compareResponses(oldValue, newValue, label, context) {
  const oldResponses = isRecord(oldValue) ? oldValue : {};
  const newResponses = isRecord(newValue) ? newValue : {};
  for (const [status, value] of Object.entries(oldResponses)) {
    if (newResponses[status] === undefined) {
      context.changes.push(`${label} removed response ${status}`);
      continue;
    }
    const oldResponse = reference(value, context.before);
    const newResponse = reference(newResponses[status], context.after);
    compareContent(
      oldResponse.content,
      newResponse.content,
      'response',
      `${label} response ${status}`,
      context,
    );
  }
}

function compareContent(oldValue, newValue, direction, label, context) {
  const oldContent = isRecord(oldValue) ? oldValue : {};
  const newContent = isRecord(newValue) ? newValue : {};
  for (const [mediaType, value] of Object.entries(oldContent)) {
    if (newContent[mediaType] === undefined) {
      context.changes.push(`${label} removed media type ${mediaType}`);
      continue;
    }
    const oldMedia = reference(value, context.before);
    const newMedia = reference(newContent[mediaType], context.after);
    compareSchema(
      oldMedia.schema,
      newMedia.schema,
      direction,
      `${label} ${mediaType}`,
      context,
    );
  }
}

function compareSchema(oldValue, newValue, direction, label, context) {
  if (oldValue === undefined) {
    if (direction === 'request' && newValue !== undefined)
      context.changes.push(`${label} added input schema`);
    return;
  }
  if (newValue === undefined) {
    if (direction === 'response')
      context.changes.push(`${label} removed response schema`);
    return;
  }
  const oldSchema = reference(oldValue, context.before);
  const newSchema = reference(newValue, context.after);
  const pair = `${direction}:${objectId(oldSchema)}:${objectId(newSchema)}`;
  if (context.visited.has(pair)) return;
  context.visited.add(pair);

  compareAllowedValues(
    oldSchema.type,
    newSchema.type,
    direction,
    'types',
    label,
    context,
  );
  compareAllowedValues(
    oldSchema.enum,
    newSchema.enum,
    direction,
    'enum values',
    label,
    context,
  );
  compareBounds(oldSchema, newSchema, direction, label, context);
  comparePropertyContracts(oldSchema, newSchema, direction, label, context);
  if (
    direction === 'request' &&
    oldSchema.additionalProperties !== false &&
    newSchema.additionalProperties === false
  ) {
    context.changes.push(`${label} disallowed additional input properties`);
  }
  if (
    direction === 'response' &&
    oldSchema.additionalProperties === false &&
    newSchema.additionalProperties !== false
  ) {
    context.changes.push(`${label} expanded additional response properties`);
  }
  for (const key of ['allOf', 'anyOf', 'oneOf', 'not']) {
    if (
      oldSchema[key] !== undefined &&
      !equal(oldSchema[key], newSchema[key])
    ) {
      context.changes.push(
        `${label} changed ${key}; compatibility review required`,
      );
    }
  }
  if (oldSchema.items !== undefined || newSchema.items !== undefined) {
    compareSchema(
      oldSchema.items,
      newSchema.items,
      direction,
      `${label} items`,
      context,
    );
  }
}

function objectId(value) {
  if (OBJECT_IDS.has(value)) return OBJECT_IDS.get(value);
  nextObjectId += 1;
  OBJECT_IDS.set(value, nextObjectId);
  return nextObjectId;
}

function compareAllowedValues(
  oldValue,
  newValue,
  direction,
  kind,
  label,
  context,
) {
  const list = (value) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value];
  const before = list(oldValue);
  const after = list(newValue);
  const subset = (values, allowed) =>
    allowed === undefined ||
    (values !== undefined &&
      values.every((item) => allowed.some((value) => equal(item, value))));
  const breaks =
    direction === 'request' ? !subset(before, after) : !subset(after, before);
  if (breaks) context.changes.push(`${label} changed ${direction} ${kind}`);
}

function compareBounds(before, after, direction, label, context) {
  const bounds = [
    ['minLength', 'maxLength'],
    ['minItems', 'maxItems'],
    ['minProperties', 'maxProperties'],
    ['minimum', 'maximum'],
    ['exclusiveMinimum', 'exclusiveMaximum'],
  ];
  for (const [min, max] of bounds) {
    const tighter =
      (number(after[min]) &&
        (!number(before[min]) || after[min] > before[min])) ||
      (number(after[max]) &&
        (!number(before[max]) || after[max] < before[max]));
    const looser =
      (number(after[min]) && number(before[min]) && after[min] < before[min]) ||
      (number(after[max]) && number(before[max]) && after[max] > before[max]) ||
      (before[min] !== undefined && after[min] === undefined) ||
      (before[max] !== undefined && after[max] === undefined);
    if (direction === 'request' && tighter)
      context.changes.push(`${label} tightened input constraints`);
    if (direction === 'response' && looser)
      context.changes.push(`${label} loosened response constraints`);
  }
}

function comparePropertyContracts(before, after, direction, label, context) {
  const oldRequired = new Set(
    Array.isArray(before.required) ? before.required : [],
  );
  const newRequired = new Set(
    Array.isArray(after.required) ? after.required : [],
  );
  for (const name of newRequired) {
    if (direction === 'request' && !oldRequired.has(name))
      context.changes.push(`${label} made property ${name} required`);
  }
  for (const name of oldRequired) {
    if (direction === 'response' && !newRequired.has(name))
      context.changes.push(`${label} no longer guarantees property ${name}`);
  }
  const oldProperties = isRecord(before.properties) ? before.properties : {};
  const newProperties = isRecord(after.properties) ? after.properties : {};
  for (const [name, value] of Object.entries(oldProperties)) {
    if (newProperties[name] === undefined) {
      context.changes.push(`${label} removed property ${name}`);
    } else {
      compareSchema(
        value,
        newProperties[name],
        direction,
        `${label}.${name}`,
        context,
      );
    }
  }
}

function security(document, operation) {
  const value = Object.hasOwn(operation, 'security')
    ? operation.security
    : document.security;
  return Array.isArray(value) ? value : [{}];
}

function compareSecurity(before, after, label, context) {
  const anonymous = after.some(
    (item) => Object.keys(record(item)).length === 0,
  );
  const preserved = before.every((oldItem) =>
    after.some((newItem) => {
      const current = record(newItem);
      return Object.entries(current).every(([scheme, scopes]) => {
        if (!Object.hasOwn(record(oldItem), scheme)) return false;
        const currentScopes = Array.isArray(scopes) ? scopes : [];
        const oldScopes = Array.isArray(oldItem[scheme]) ? oldItem[scheme] : [];
        return currentScopes.every((scope) => oldScopes.includes(scope));
      });
    }),
  );
  if (!anonymous && !preserved)
    context.changes.push(
      `${label} strengthened or added security requirements`,
    );
}

function record(value) {
  return isRecord(value) ? value : {};
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
