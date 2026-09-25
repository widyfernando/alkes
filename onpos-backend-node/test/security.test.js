const test = require('node:test');
const assert = require('node:assert/strict');
const { generateWerkzeugScryptHash, verifyWerkzeugPassword } = require('../src/utils/security');
const { getSecretKey } = require('../src/config');

test('password hash menerima password benar dan menolak password salah', () => {
  const hash = generateWerkzeugScryptHash('password-kuat');
  assert.equal(verifyWerkzeugPassword(hash, 'password-kuat'), true);
  assert.equal(verifyWerkzeugPassword(hash, 'password-salah'), false);
});

test('password hash rusak gagal dengan aman tanpa exception', () => {
  assert.equal(verifyWerkzeugPassword('scrypt:abc:def:ghi$salt$bukan-hex', 'password'), false);
  assert.equal(verifyWerkzeugPassword('format-rusak', 'password'), false);
});

test('SECRET_KEY menolak fallback bawaan dan menerima secret acak panjang', () => {
  const original = process.env.SECRET_KEY;
  process.env.SECRET_KEY = '9japosm5qpDNlzZju392lmq0yrh1Fa2B';
  assert.throws(() => getSecretKey(), /SECRET_KEY wajib/);
  process.env.SECRET_KEY = 'a'.repeat(64);
  assert.equal(getSecretKey(), 'a'.repeat(64));
  if (original === undefined) delete process.env.SECRET_KEY;
  else process.env.SECRET_KEY = original;
});
