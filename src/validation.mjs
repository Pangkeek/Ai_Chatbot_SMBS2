export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

// A deliberately small JSON Schema subset, shared by the HTTP boundary and contract tests.
export function validate(value, schema, path = 'body') {
  const errors = [];
  const fail = message => errors.push({ field: path, message });
  if (schema.enum && !schema.enum.includes(value)) fail(`Must be one of: ${schema.enum.join(', ')}`);
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [{ field: path, message: 'Must be an object' }];
    for (const key of schema.required || []) if (!(key in value)) errors.push({ field: `${path}.${key}`, message: 'Required' });
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) fail('At least one property is required');
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties || {}, key)) errors.push(...validate(item, schema.properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push({ field: `${path}.${key}`, message: 'Unknown property' });
    }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return [{ field: path, message: 'Must be a string' }];
    if (schema.minLength && value.trim().length < schema.minLength) fail(`Must have at least ${schema.minLength} non-padding characters`);
    if (schema.maxLength && value.length > schema.maxLength) fail(`Must have at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('Invalid format');
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value)) fail('Must be an integer');
    else if (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail('Out of range');
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('Must be an array');
    else value.forEach((item, index) => errors.push(...validate(item, schema.items, `${path}[${index}]`)));
  } else if (schema.type === 'null' && value !== null) fail('Must be null');
  if (schema.anyOf && !schema.anyOf.some(option => validate(value, option, path).length === 0)) fail('Value does not match an allowed type');
  return errors;
}
