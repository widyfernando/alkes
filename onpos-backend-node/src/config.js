const DEFAULT_SECRET = '9japosm5qpDNlzZju392lmq0yrh1Fa2B';

function getSecretKey() {
  const secret = String(process.env.SECRET_KEY || '');
  if (secret.length < 32 || secret === DEFAULT_SECRET) {
    throw new Error('SECRET_KEY wajib berupa nilai acak minimal 32 karakter dan tidak boleh memakai fallback bawaan');
  }
  return secret;
}

module.exports = { getSecretKey };
