require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  await pool.query(schema);
  console.log('Migrasi database selesai.');
}

if (require.main === module) {
  migrate()
    .catch((error) => {
      console.error('Migrasi database gagal:', error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { migrate };
