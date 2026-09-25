const crypto = require('crypto');

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyWerkzeugPassword(hash, password) {
  if (!hash || !password) return false;
  try {
    const parts = hash.split('$');
    if (parts.length !== 3) return false;
    const [method, salt, digest] = parts;
    if (!salt || !/^[a-f0-9]+$/i.test(digest) || digest.length % 2 !== 0) return false;

    if (method.startsWith('scrypt:')) {
      const [, nRaw, rRaw, pRaw] = method.split(':');
      const n = Number(nRaw);
      const r = Number(rRaw);
      const p = Number(pRaw);
      if (![n, r, p].every(Number.isSafeInteger) || n < 2 || r < 1 || p < 1) return false;
      const derived = crypto.scryptSync(password, salt, Buffer.from(digest, 'hex').length, { N: n, r, p, maxmem: 64 * 1024 * 1024 }).toString('hex');
      return safeEqualHex(derived, digest);
    }

    if (method.startsWith('pbkdf2:')) {
      const [, algorithm, iterationsRaw] = method.split(':');
      const iterations = Number(iterationsRaw);
      if (!algorithm || !Number.isSafeInteger(iterations) || iterations < 1) return false;
      const derived = crypto.pbkdf2Sync(password, salt, iterations, Buffer.from(digest, 'hex').length, algorithm).toString('hex');
      return safeEqualHex(derived, digest);
    }

    return false;
  } catch {
    return false;
  }
}

function generateWerkzeugScryptHash(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const n = 32768;
  const r = 8;
  const p = 1;
  const digest = crypto.scryptSync(password, salt, 64, { N: n, r, p, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `scrypt:${n}:${r}:${p}$${salt}$${digest}`;
}

module.exports = { verifyWerkzeugPassword, generateWerkzeugScryptHash };
