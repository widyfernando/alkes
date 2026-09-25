function nextId(prefix, number) {
  return `${prefix}${String(number).padStart(5, '0')}`;
}

function formatDate(value) {
  if (!value) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function allowedUpdate(data, fields) {
  const result = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      result[field] = data[field];
    }
  }
  return result;
}

module.exports = { nextId, formatDate, allowedUpdate };
