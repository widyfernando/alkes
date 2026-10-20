const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../db');
const { verifyWerkzeugPassword, generateWerkzeugScryptHash } = require('../utils/security');
const { nextId, formatDate, allowedUpdate } = require('../utils/helpers');
const { getSecretKey } = require('../config');

const SECRET_KEY = getSecretKey();

let inventoryIssueSchemaPromise;
async function ensureInventoryIssueSchema() {
  if (!inventoryIssueSchemaPromise) {
    inventoryIssueSchemaPromise = Promise.all([
      query("CREATE TABLE IF NOT EXISTS inventory_issues (issue_id BIGSERIAL PRIMARY KEY, spb_number VARCHAR(100) NOT NULL UNIQUE, issue_date DATE NOT NULL DEFAULT CURRENT_DATE, recipient VARCHAR(150) NOT NULL DEFAULT '', destination VARCHAR(200) NOT NULL DEFAULT '', reason_id BIGINT NOT NULL REFERENCES inventory_reasons(reason_id), notes TEXT NOT NULL DEFAULT '', created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"),
      query("CREATE TABLE IF NOT EXISTS inventory_issue_items (issue_item_id BIGSERIAL PRIMARY KEY, issue_id BIGINT NOT NULL REFERENCES inventory_issues(issue_id) ON DELETE CASCADE, item_id VARCHAR(20) NOT NULL REFERENCES inventory_items(item_id), serial_number VARCHAR(100) NOT NULL DEFAULT '', qty NUMERIC(14, 2) NOT NULL, stock_before NUMERIC(14, 2) NOT NULL, stock_after NUMERIC(14, 2) NOT NULL)"),
      query("ALTER TABLE inventory_issues ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'"),
      query("ALTER TABLE inventory_issues ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100)"),
      query("ALTER TABLE inventory_issues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ"),
      query("ALTER TABLE inventory_issues ADD COLUMN IF NOT EXISTS revision_of BIGINT REFERENCES inventory_issues(issue_id)"),
    ]).then(() => Promise.all([
      query("CREATE INDEX IF NOT EXISTS idx_inventory_issue_items_issue_id ON inventory_issue_items(issue_id)"),
      query("CREATE INDEX IF NOT EXISTS idx_inventory_issues_revision_of ON inventory_issues(revision_of)"),
    ]))
      .catch((error) => { inventoryIssueSchemaPromise = null; throw error; });
  }
  return inventoryIssueSchemaPromise;
}

function actorName(req) {
  return req.user?.nama || req.user?.username || 'SYSTEM';
}

async function addLog(client, aktor, target, kategori, keterangan) {
  await client.query(
    'INSERT INTO log_audit_trail (aktor_name, target_name, kategori, keterangan) VALUES ($1, $2, $3, $4)',
    [aktor, target, kategori, keterangan]
  );
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function normalizeUserPayload(body) {
  const data = { ...(body || {}) };
  if (!data.dept_id && data.departemen_id) data.dept_id = data.departemen_id;
  return data;
}

async function findMissingUserReferences(data, options = {}) {
  const { required = false } = options;
  const checks = [
    ['grup_id', 'grup', 'grup_id', 'Grup'],
    ['dept_id', 'departemen', 'departemen_id', 'Departemen'],
    ['jabatan_id', 'jabatan', 'jabatan_id', 'Jabatan'],
  ];
  const missing = [];

  for (const [field, table, column, label] of checks) {
    if (!data[field]) {
      if (required) missing.push(`${label} wajib diisi`);
      continue;
    }

    const result = await query(`SELECT ${column} FROM ${table} WHERE ${column} = $1`, [data[field]]);
    if (!result.rows[0]) missing.push(`${label} ${data[field]} tidak ditemukan`);
  }

  return missing;
}

const login = asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.json({ status: 2, message: 'Username atau password salah' });
  }
  if (username.length > 100 || password.length > 256) {
    return res.json({ status: 2, message: 'Username atau password salah' });
  }

  const result = await query(
    `SELECT u.user_id, u.username, u.nama, u.email, u.password, u.is_aktif,
            g.grup_id, d.departemen_id, j.jabatan_id
       FROM users u
       JOIN grup g ON u.grup_id = g.grup_id
       JOIN departemen d ON u.dept_id = d.departemen_id
       JOIN jabatan j ON u.jabatan_id = j.jabatan_id
      WHERE u.username = $1`,
    [username]
  );

  const user = result.rows[0];
  if (!user) return res.json({ message: 'Username atau password salah', status: 2 });
  if (!user.is_aktif) return res.json({ message: 'User dinonaktifkan. Silakan hubungi admin jika ada keperluan', status: 2 });
  if (!verifyWerkzeugPassword(user.password, password)) {
    return res.json({ message: 'Username atau password salah', status: 2 });
  }

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, nama: user.nama, grup_id: user.grup_id },
    SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '12h' }
  );

  return res.json({
    status: 1,
    message: 'Login berhasil',
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      nama: user.nama,
      email: user.email,
      grup_id: user.grup_id,
      jabatan_id: user.jabatan_id,
      departemen_id: user.departemen_id,
    },
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || 10);
  const offset = (page - 1) * perPage;
  const search = String(req.query.search || '').trim();
  const searchPattern = `%${search}%`;
  const whereSql = search
    ? `WHERE u.is_aktif = true
       AND (
         u.user_id ILIKE $3 OR
         u.username ILIKE $3 OR
         u.nama ILIKE $3 OR
         g.nama ILIKE $3 OR
         d.nama ILIKE $3 OR
         j.nama ILIKE $3
       )`
    : 'WHERE u.is_aktif = true';
  const params = search ? [offset, perPage, searchPattern] : [offset, perPage];
  const totalParams = search ? [searchPattern] : [];

  const users = await query(
    `SELECT u.user_id, u.username, u.nama, g.nama AS grup, d.nama AS departemen,
            j.nama AS jabatan, u.created_at
       FROM users u
       JOIN grup g ON u.grup_id = g.grup_id
       JOIN departemen d ON u.dept_id = d.departemen_id
       JOIN jabatan j ON u.jabatan_id = j.jabatan_id
      ${whereSql}
      ORDER BY u.created_at DESC, u.user_id DESC
      OFFSET $1 LIMIT $2`,
    params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS count
       FROM users u
       JOIN grup g ON u.grup_id = g.grup_id
       JOIN departemen d ON u.dept_id = d.departemen_id
       JOIN jabatan j ON u.jabatan_id = j.jabatan_id
      ${whereSql.replace(/\$3/g, '$1')}`,
    totalParams
  );
  const data = users.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }));
  const totalCount = total.rows[0].count;

  return res.json({
    page,
    per_page: perPage,
    total: totalCount,
    pages: Math.ceil(totalCount / perPage),
    data,
    status: data.length > 0 ? 1 : 2,
  });
});

const getDetailUser = asyncHandler(async (req, res) => {
  const { user_id: userId } = req.query;
  const result = await query(
    `SELECT u.user_id, u.username, u.nama, u.email,
            u.grup_id, u.dept_id, u.jabatan_id,
            g.nama AS grup, d.nama AS departemen, j.nama AS jabatan
       FROM users u
       JOIN grup g ON u.grup_id = g.grup_id
       JOIN departemen d ON u.dept_id = d.departemen_id
       JOIN jabatan j ON u.jabatan_id = j.jabatan_id
      WHERE u.user_id = $1`,
    [userId]
  );

  if (!result.rows[0]) return res.json({ status: 2, message: 'Data user tidak ditemukan' });
  return res.json({ user: result.rows[0], status: 1 });
});

const addUser = asyncHandler(async (req, res) => {
  const data = normalizeUserPayload(req.body);
  const missingReferences = await findMissingUserReferences(data, { required: true });
  if (missingReferences.length > 0) {
    return res.json({ status: 2, message: missingReferences.join(', ') });
  }

  const duplicateUsername = await query('SELECT user_id FROM users WHERE username = $1', [data.username]);
  if (duplicateUsername.rows[0]) return res.json({ status: 2, message: 'Username sudah terdaftar. Silakan gunakan username lain' });

  const duplicateEmail = await query('SELECT user_id FROM users WHERE email = $1', [data.email]);
  if (duplicateEmail.rows[0]) return res.json({ status: 2, message: 'Email telah digunakan. Silakan gunakan email lain' });

  await withTransaction(async (client) => {
    const nomor = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'user' FOR UPDATE");
    const newUserId = nextId('U', nomor.rows[0].nomor);
    await client.query(
      `INSERT INTO users (user_id, username, nama, password, email, is_aktif, grup_id, dept_id, jabatan_id)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)`,
      [newUserId, data.username, data.nama, generateWerkzeugScryptHash(data.username), data.email, data.grup_id, data.dept_id, data.jabatan_id]
    );
    await client.query("UPDATE penomoran SET nomor = nomor + 1, updated_at = NOW() WHERE kategori = 'user'");
    await addLog(client, actorName(req), newUserId, 'USER', `Tambah pengguna ${newUserId} - ${data.nama}`);
  });

  return res.json({ status: 1, message: 'Berhasil menambah user' });
});

const updateUser = asyncHandler(async (req, res) => {
  const { user_id: userId } = req.query;
  const data = normalizeUserPayload(req.body);
  const exists = await query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data user tidak ditemukan' });

  const missingReferences = await findMissingUserReferences(data);
  if (missingReferences.length > 0) {
    return res.json({ status: 2, message: missingReferences.join(', ') });
  }

  const duplicateUsername = await query('SELECT user_id FROM users WHERE username = $1 AND user_id <> $2', [data.username, userId]);
  if (duplicateUsername.rows[0]) return res.json({ status: 2, message: 'Username sudah terdaftar. Silakan gunakan username lain' });

  const duplicateEmail = await query('SELECT user_id FROM users WHERE email = $1 AND user_id <> $2', [data.email, userId]);
  if (duplicateEmail.rows[0]) return res.json({ status: 2, message: 'Email telah digunakan. Silakan gunakan email lain' });

  const fields = allowedUpdate(data, ['username', 'nama', 'email', 'grup_id', 'dept_id', 'jabatan_id', 'password']);
  if (fields.password) fields.password = generateWerkzeugScryptHash(fields.password);
  const keys = Object.keys(fields);
  if (keys.length === 0) return res.json({ message: `Data user ${userId} berhasil diupdate`, status: 1 });

  await withTransaction(async (client) => {
    const setSql = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    await client.query(`UPDATE users SET ${setSql}, updated_at = NOW() WHERE user_id = $${keys.length + 1}`, [...keys.map((key) => fields[key]), userId]);
    await addLog(client, actorName(req), userId, 'USER', `Update pengguna ${userId}`);
  });

  return res.json({ message: `Data user ${userId} berhasil diupdate`, status: 1 });
});

const setStatusUser = asyncHandler(async (req, res) => {
  const { user_id: userId } = req.query;
  const aktif = Boolean((req.body || {}).status);
  const exists = await query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data user tidak ditemukan' });

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET is_aktif = $1, updated_at = NOW() WHERE user_id = $2', [aktif, userId]);
    await addLog(client, actorName(req), userId, 'USER', `Akses pengguna ${userId}: ${aktif ? 'AKTIF' : 'NONAKTIF'}`);
  });

  return res.json({ message: aktif ? `User ${userId} diaktifkan` : `User ${userId} dinonaktifkan`, status: 1 });
});

const getMenus = asyncHandler(async (req, res) => {
  const parentId = req.query.parent_id;
  const search = String(req.query.search || '').trim();
  const params = [];
  const where = ['m.is_aktif = true'];

  if (parentId !== undefined) {
    params.push(parentId);
    where.push(`m.parent_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(m.menu_id ILIKE $${params.length} OR m.nama ILIKE $${params.length})`);
  }

  const result = await query(
    `SELECT m.menu_id, m.nama, m.path, m.parent_id,
            CASE WHEN m.parent_id = m.menu_id THEN NULL ELSE p.nama END AS parent_nama
       FROM menu m
       LEFT JOIN menu p ON p.menu_id = m.parent_id
      WHERE ${where.join(' AND ')}
      ORDER BY CASE WHEN m.parent_id = m.menu_id THEN m.menu_id ELSE m.parent_id END, m.menu_id`,
    params
  );

  return res.json({ data: result.rows, total: result.rowCount, status: result.rowCount > 0 ? 1 : 2 });
});

const getHakAkses = asyncHandler(async (req, res) => {
  const { grup_id: grupId } = req.query;
  if (!grupId) return res.json({ status: 2, message: 'Grup wajib dipilih', data: [] });

  const result = await query(
    `SELECT ha.akses_id, ha.grup_id, ha.menu_item_id AS menu_id, ha.granted,
            m.nama, m.path, m.parent_id,
            CASE WHEN m.parent_id = m.menu_id THEN NULL ELSE p.nama END AS parent_nama
       FROM hak_akses ha
       JOIN menu m ON m.menu_id = ha.menu_item_id
       LEFT JOIN menu p ON p.menu_id = m.parent_id
      WHERE ha.grup_id = $1 AND ha.granted = true AND m.is_aktif = true
      ORDER BY CASE WHEN m.parent_id = m.menu_id THEN m.menu_id ELSE m.parent_id END, m.menu_id`,
    [grupId]
  );

  return res.json({ data: result.rows, total: result.rowCount, status: result.rowCount > 0 ? 1 : 2 });
});

const grantHakAkses = asyncHandler(async (req, res) => {
  const { grup_id: grupId, menu_item_id: menuItemId } = req.body || {};
  if (!grupId || !menuItemId) return res.json({ status: 2, message: 'Grup dan menu wajib dipilih' });

  const exists = await query(
    `SELECT g.grup_id, m.menu_id
       FROM grup g
       CROSS JOIN menu m
      WHERE g.grup_id = $1 AND m.menu_id = $2 AND m.is_aktif = true`,
    [grupId, menuItemId]
  );
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Grup atau menu tidak ditemukan' });

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO hak_akses (grup_id, menu_item_id, granted)
       VALUES ($1, $2, true)
       ON CONFLICT (grup_id, menu_item_id)
       DO UPDATE SET granted = true`,
      [grupId, menuItemId]
    );
    await addLog(client, actorName(req), grupId, 'OTORITAS', `Tambah akses menu ${menuItemId}`);
  });

  return res.json({ status: 1, message: 'Hak akses menu berhasil ditambahkan' });
});

const updateHakAkses = asyncHandler(async (req, res) => {
  const { grup_id: grupId, menu_item_id: menuItemId } = req.query;
  const granted = Boolean((req.body || {}).granted);
  if (!grupId || !menuItemId) return res.json({ status: 2, message: 'Grup dan menu wajib dipilih' });

  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE hak_akses SET granted = $1
        WHERE grup_id = $2 AND menu_item_id = $3`,
      [granted, grupId, menuItemId]
    );
    if (result.rowCount === 0) {
      await client.query(
        `INSERT INTO hak_akses (grup_id, menu_item_id, granted)
         VALUES ($1, $2, $3)`,
        [grupId, menuItemId, granted]
      );
    }
    await addLog(client, actorName(req), grupId, 'OTORITAS', `${granted ? 'Aktifkan' : 'Nonaktifkan'} akses menu ${menuItemId}`);
  });

  return res.json({ status: 1, message: granted ? 'Hak akses menu diaktifkan' : 'Hak akses menu dinonaktifkan' });
});

const revokeHakAkses = asyncHandler(async (req, res) => {
  const { grup_id: grupId, menu_item_id: menuItemId } = req.query;
  if (!grupId || !menuItemId) return res.json({ status: 2, message: 'Grup dan menu wajib dipilih' });

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE hak_akses SET granted = false
        WHERE grup_id = $1 AND menu_item_id = $2`,
      [grupId, menuItemId]
    );
    await addLog(client, actorName(req), grupId, 'OTORITAS', `Hapus akses menu ${menuItemId}`);
  });

  return res.json({ status: 1, message: 'Hak akses menu berhasil dihapus' });
});

const getPerusahaan = asyncHandler(async (_req, res) => {
  const result = await query('SELECT nama, no_izin, alamat, email, kodepos, kota, fax, pemilik FROM perusahaan LIMIT 1');
  return res.json({ perusahaan: result.rows[0] || null, status: 1 });
});

const updatePerusahaan = asyncHandler(async (req, res) => {
  const data = allowedUpdate(req.body || {}, ['nama', 'no_izin', 'alamat', 'email', 'kodepos', 'kota', 'fax', 'pemilik', 'telepon', 'logo', 'token']);
  const keys = Object.keys(data);
  if (keys.length === 0) return res.json({ message: 'Data perusahaan berhasil diupdate', status: 1 });

  await withTransaction(async (client) => {
    const setSql = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    await client.query(`UPDATE perusahaan SET ${setSql}, updated_at = NOW()`, keys.map((key) => data[key]));
    await addLog(client, actorName(req), '-', 'PERUSAHAAN', 'Data perusahaan telah diupdate');
  });
  return res.json({ message: 'Data perusahaan berhasil diupdate', status: 1 });
});

function createMasterHandlers(config) {
  const { table, idColumn, prefix, kategori, detailKey, label } = config;

  const list = asyncHandler(async (_req, res) => {
    const result = await query(`SELECT ${idColumn}, nama FROM ${table} ORDER BY ${idColumn}`);
    return res.json({ data: result.rows, status: 1 });
  });

  const detail = asyncHandler(async (req, res) => {
    const id = req.query[idColumn === 'departemen_id' ? 'dept_id' : idColumn];
    const result = await query(`SELECT ${idColumn}, nama FROM ${table} WHERE ${idColumn} = $1`, [id]);
    if (!result.rows[0]) return res.json({ status: 2, message: `Data ${label} tidak ditemukan` });
    return res.json({ [detailKey]: result.rows[0], status: 1 });
  });

  const add = asyncHandler(async (req, res) => {
    const nama = (req.body || {}).nama;
    let newId;
    await withTransaction(async (client) => {
      const nomor = await client.query('SELECT nomor FROM penomoran WHERE kategori = $1 FOR UPDATE', [kategori]);
      newId = nextId(prefix, nomor.rows[0].nomor);
      await client.query(`INSERT INTO ${table} (${idColumn}, nama) VALUES ($1, $2)`, [newId, nama]);
      await client.query('UPDATE penomoran SET nomor = nomor + 1, updated_at = NOW() WHERE kategori = $1', [kategori]);
      await addLog(client, actorName(req), newId, label.toUpperCase(), `Tambah ${label} ${newId} - ${nama}`);
    });
    return res.json({ status: 1, message: `Berhasil menambah ${label}. ${label[0].toUpperCase() + label.slice(1)} '${nama}' terdaftar dengan ID ${newId}.` });
  });

  const update = asyncHandler(async (req, res) => {
    const id = req.query[idColumn === 'departemen_id' ? 'dept_id' : idColumn];
    const exists = await query(`SELECT ${idColumn} FROM ${table} WHERE ${idColumn} = $1`, [id]);
    if (!exists.rows[0]) return res.json({ status: 2, message: `Data ${label} tidak ditemukan` });

    await withTransaction(async (client) => {
      await client.query(`UPDATE ${table} SET nama = $1, updated_at = NOW() WHERE ${idColumn} = $2`, [(req.body || {}).nama, id]);
      await addLog(client, actorName(req), id, label.toUpperCase(), `Update ${label} ${id}`);
    });
    return res.json({ message: `Data ${label} ${id} berhasil diupdate`, status: 1 });
  });

  return { list, detail, add, update };
}

const getSatuanBarang = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const params = [];
  let whereSql = '';

  if (search) {
    params.push(`%${search}%`);
    whereSql = `WHERE satuan_id ILIKE $1 OR nama ILIKE $1 OR keterangan ILIKE $1`;
  }

  const result = await query(
    `SELECT satuan_id, nama, keterangan, created_at
       FROM satuan_barang
      ${whereSql}
      ORDER BY satuan_id`,
    params
  );

  return res.json({ data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })), total: result.rowCount, status: result.rowCount > 0 ? 1 : 2 });
});

const getDetailSatuanBarang = asyncHandler(async (req, res) => {
  const { satuan_id: satuanId } = req.query;
  const result = await query('SELECT satuan_id, nama, keterangan FROM satuan_barang WHERE satuan_id = $1', [satuanId]);

  if (!result.rows[0]) return res.json({ status: 2, message: 'Data satuan barang tidak ditemukan' });
  return res.json({ satuan_barang: result.rows[0], status: 1 });
});

const addSatuanBarang = asyncHandler(async (req, res) => {
  const nama = String((req.body || {}).nama || '').trim();
  const keterangan = String((req.body || {}).keterangan || '').trim();
  if (!nama) return res.json({ status: 2, message: 'Nama satuan wajib diisi' });

  const duplicate = await query('SELECT satuan_id FROM satuan_barang WHERE LOWER(nama) = LOWER($1)', [nama]);
  if (duplicate.rows[0]) return res.json({ status: 2, message: 'Nama satuan sudah terdaftar' });

  let newId;
  await withTransaction(async (client) => {
    const nomor = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'satuan' FOR UPDATE");
    const currentNumber = nomor.rows[0]?.nomor || 1;
    if (!nomor.rows[0]) {
      await client.query("INSERT INTO penomoran (kategori, nomor) VALUES ('satuan', 1)");
    }
    newId = nextId('S', currentNumber);
    await client.query('INSERT INTO satuan_barang (satuan_id, nama, keterangan) VALUES ($1, $2, $3)', [newId, nama, keterangan]);
    await client.query("UPDATE penomoran SET nomor = $1, updated_at = NOW() WHERE kategori = 'satuan'", [currentNumber + 1]);
    await addLog(client, actorName(req), newId, 'SATUAN', `Tambah satuan ${newId} - ${nama}`);
  });

  return res.json({ status: 1, message: `Berhasil menambah satuan barang ${newId}` });
});

const updateSatuanBarang = asyncHandler(async (req, res) => {
  const { satuan_id: satuanId } = req.query;
  const nama = String((req.body || {}).nama || '').trim();
  const keterangan = String((req.body || {}).keterangan || '').trim();
  if (!nama) return res.json({ status: 2, message: 'Nama satuan wajib diisi' });

  const exists = await query('SELECT satuan_id FROM satuan_barang WHERE satuan_id = $1', [satuanId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data satuan barang tidak ditemukan' });

  const duplicate = await query('SELECT satuan_id FROM satuan_barang WHERE LOWER(nama) = LOWER($1) AND satuan_id <> $2', [nama, satuanId]);
  if (duplicate.rows[0]) return res.json({ status: 2, message: 'Nama satuan sudah terdaftar' });

  await withTransaction(async (client) => {
    await client.query('UPDATE satuan_barang SET nama = $1, keterangan = $2, updated_at = NOW() WHERE satuan_id = $3', [nama, keterangan, satuanId]);
    await addLog(client, actorName(req), satuanId, 'SATUAN', `Update satuan ${satuanId}`);
  });

  return res.json({ status: 1, message: `Data satuan barang ${satuanId} berhasil diupdate` });
});

const deleteSatuanBarang = asyncHandler(async (req, res) => {
  const { satuan_id: satuanId } = req.query;
  const exists = await query('SELECT satuan_id FROM satuan_barang WHERE satuan_id = $1', [satuanId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data satuan barang tidak ditemukan' });

  await withTransaction(async (client) => {
    await client.query('DELETE FROM satuan_barang WHERE satuan_id = $1', [satuanId]);
    await addLog(client, actorName(req), satuanId, 'SATUAN', `Hapus satuan ${satuanId}`);
  });

  return res.json({ status: 1, message: `Data satuan barang ${satuanId} berhasil dihapus` });
});

const getKategoriBarang = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const params = [];
  let whereSql = '';

  if (search) {
    params.push(`%${search}%`);
    whereSql = `WHERE kategori_id ILIKE $1 OR nama ILIKE $1 OR keterangan ILIKE $1`;
  }

  const result = await query(
    `SELECT kategori_id, nama, keterangan, created_at
       FROM kategori_barang
      ${whereSql}
      ORDER BY kategori_id`,
    params
  );

  return res.json({ data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })), total: result.rowCount, status: result.rowCount > 0 ? 1 : 2 });
});

const getDetailKategoriBarang = asyncHandler(async (req, res) => {
  const { kategori_id: kategoriId } = req.query;
  const result = await query('SELECT kategori_id, nama, keterangan FROM kategori_barang WHERE kategori_id = $1', [kategoriId]);

  if (!result.rows[0]) return res.json({ status: 2, message: 'Data kategori barang tidak ditemukan' });
  return res.json({ kategori_barang: result.rows[0], status: 1 });
});

const addKategoriBarang = asyncHandler(async (req, res) => {
  const nama = String((req.body || {}).nama || '').trim();
  const keterangan = String((req.body || {}).keterangan || '').trim();
  if (!nama) return res.json({ status: 2, message: 'Nama kategori wajib diisi' });

  const duplicate = await query('SELECT kategori_id FROM kategori_barang WHERE LOWER(nama) = LOWER($1)', [nama]);
  if (duplicate.rows[0]) return res.json({ status: 2, message: 'Nama kategori sudah terdaftar' });

  let newId;
  await withTransaction(async (client) => {
    const nomor = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'kategori' FOR UPDATE");
    const currentNumber = nomor.rows[0]?.nomor || 1;
    if (!nomor.rows[0]) {
      await client.query("INSERT INTO penomoran (kategori, nomor) VALUES ('kategori', 1)");
    }
    newId = nextId('K', currentNumber);
    await client.query('INSERT INTO kategori_barang (kategori_id, nama, keterangan) VALUES ($1, $2, $3)', [newId, nama, keterangan]);
    await client.query("UPDATE penomoran SET nomor = $1, updated_at = NOW() WHERE kategori = 'kategori'", [currentNumber + 1]);
    await addLog(client, actorName(req), newId, 'KATEGORI', `Tambah kategori ${newId}`);
  });

  return res.json({ status: 1, message: `Berhasil menambah kategori barang ${newId}` });
});

const updateKategoriBarang = asyncHandler(async (req, res) => {
  const { kategori_id: kategoriId } = req.query;
  const nama = String((req.body || {}).nama || '').trim();
  const keterangan = String((req.body || {}).keterangan || '').trim();
  if (!nama) return res.json({ status: 2, message: 'Nama kategori wajib diisi' });

  const exists = await query('SELECT kategori_id FROM kategori_barang WHERE kategori_id = $1', [kategoriId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data kategori barang tidak ditemukan' });

  const duplicate = await query('SELECT kategori_id FROM kategori_barang WHERE LOWER(nama) = LOWER($1) AND kategori_id <> $2', [nama, kategoriId]);
  if (duplicate.rows[0]) return res.json({ status: 2, message: 'Nama kategori sudah terdaftar' });

  await withTransaction(async (client) => {
    await client.query('UPDATE kategori_barang SET nama = $1, keterangan = $2, updated_at = NOW() WHERE kategori_id = $3', [nama, keterangan, kategoriId]);
    await addLog(client, actorName(req), kategoriId, 'KATEGORI', `Update kategori ${kategoriId}`);
  });

  return res.json({ status: 1, message: `Data kategori barang ${kategoriId} berhasil diupdate` });
});

const deleteKategoriBarang = asyncHandler(async (req, res) => {
  const { kategori_id: kategoriId } = req.query;
  const exists = await query('SELECT kategori_id FROM kategori_barang WHERE kategori_id = $1', [kategoriId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data kategori barang tidak ditemukan' });

  const used = await query('SELECT item_id FROM inventory_items WHERE kategori_id = $1 AND is_aktif = true LIMIT 1', [kategoriId]);
  if (used.rows[0]) return res.json({ status: 2, message: 'Kategori masih dipakai di master barang' });

  await withTransaction(async (client) => {
    await client.query('DELETE FROM kategori_barang WHERE kategori_id = $1', [kategoriId]);
    await addLog(client, actorName(req), kategoriId, 'KATEGORI', `Hapus kategori ${kategoriId}`);
  });

  return res.json({ status: 1, message: `Data kategori barang ${kategoriId} berhasil dihapus` });
});

const getInventoryItems = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const stockStatus = String(req.query.stock_status || 'all').trim();
  const sort = String(req.query.sort || 'created').trim();
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 10), 5000);
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['i.is_aktif = true'];
  let searchRankSql = '';

  if (search) {
    const locatorScan = search.toLowerCase().startsWith('loc:') ? search.slice(4).trim() : '';
    const keyword = locatorScan || search;
    params.push(`%${keyword}%`);
    const likeParam = params.length;
    params.push(keyword.toLowerCase());
    const exactParam = params.length;

    if (locatorScan) {
      conditions.push(`i.locator ILIKE $${likeParam}`);
      searchRankSql = `CASE WHEN LOWER(i.locator) = $${exactParam} THEN 0 WHEN LOWER(i.locator) LIKE ($${exactParam} || '%') THEN 1 ELSE 2 END,`;
    } else {
      conditions.push(`(i.item_id ILIKE $${likeParam} OR i.nama ILIKE $${likeParam} OR i.locator ILIKE $${likeParam} OR i.merek ILIKE $${likeParam} OR i.principal ILIKE $${likeParam} OR i.nomor_izin_edar ILIKE $${likeParam} OR i.nomor_batch ILIKE $${likeParam} OR s.nama ILIKE $${likeParam} OR k.nama ILIKE $${likeParam})`);
      searchRankSql = `CASE WHEN LOWER(i.item_id) = $${exactParam} OR LOWER(i.locator) = $${exactParam} THEN 0 WHEN LOWER(i.item_id) LIKE ($${exactParam} || '%') OR LOWER(i.locator) LIKE ($${exactParam} || '%') THEN 1 ELSE 2 END,`;
    }
  }

  if (stockStatus === 'empty') conditions.push('i.stok <= 0');
  if (stockStatus === 'low') conditions.push('i.stok > 0 AND i.stok <= i.minimum_stock');
  if (stockStatus === 'safe') conditions.push('i.stok > i.minimum_stock');

  const sortOptions = {
    created: 'i.created_at DESC, i.item_id DESC',
    stock_asc: 'i.stok ASC, i.nama ASC',
    stock_desc: 'i.stok DESC, i.nama ASC',
    value_desc: '(i.stok * i.harga_modal) DESC, i.nama ASC',
    name: 'i.nama ASC, i.item_id ASC',
    locator: "NULLIF(i.locator, '') ASC NULLS LAST, i.nama ASC",
  };
  const orderSql = `ORDER BY ${searchRankSql} ${sortOptions[sort] || sortOptions.created}`;
  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const joins = `LEFT JOIN satuan_barang s ON s.satuan_id = i.satuan_id
                 LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM inventory_items i ${joins} ${whereSql}`,
    search ? params.slice(0, -1) : params
  );

  const dataParams = [...params, limit, offset];
  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const result = await query(
    `SELECT i.item_id, i.nama, i.satuan_id, s.nama AS satuan, i.kategori_id, k.nama AS kategori,
            i.locator, i.merek, i.principal, i.nomor_izin_edar, i.nomor_batch, TO_CHAR(i.tanggal_kedaluwarsa, 'YYYY-MM-DD') AS tanggal_kedaluwarsa, i.gambar_url, i.stok, i.harga_modal, i.harga, i.minimum_stock, i.created_at,
            COALESCE((SELECT json_agg(json_build_object('serial_number', l.serial_number, 'qty', l.qty) ORDER BY l.serial_number) FROM inventory_lots l WHERE l.item_id = i.item_id AND l.qty > 0), '[]'::json) AS lots
       FROM inventory_items i
       ${joins}
       ${whereSql}
       ${orderSql}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
    dataParams
  );

  const summaryResult = await query(
    `SELECT COUNT(*)::int AS total_items,
            COALESCE(SUM(stok), 0)::float AS total_stok,
            COALESCE(SUM(stok * harga_modal), 0)::float AS total_nilai,
            COUNT(*) FILTER (WHERE stok > 0 AND stok <= minimum_stock)::int AS stok_rendah,
            COUNT(*) FILTER (WHERE stok <= 0)::int AS stok_kosong
       FROM inventory_items
      WHERE is_aktif = true`
  );

  const total = Number(countResult.rows[0]?.total || 0);
  return res.json({
    data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })),
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1),
    summary: summaryResult.rows[0] || {},
    status: result.rowCount > 0 ? 1 : 2,
  });
});
const addInventoryItem = asyncHandler(async (req, res) => {
  const data = req.body || {};
  const nama = String(data.nama || '').trim();
  const satuanId = data.satuan_id || null;
  const kategoriId = data.kategori_id || null;
  const locator = String(data.locator || '').trim();
  const merek = String(data.merek || '').trim();
  const principal = String(data.principal || '').trim();
  const nomorIzinEdar = String(data.nomor_izin_edar || '').trim();
  const nomorBatch = String(data.nomor_batch || '').trim();
  const tanggalKedaluwarsa = data.tanggal_kedaluwarsa || null;
  const gambarUrl = String(data.gambar_url || '').trim();
  const hargaModal = Number(data.harga_modal || 0);
  const harga = Number(data.harga || 0);
  const minimumStock = Number(data.minimum_stock ?? 5);
  if (!nama) return res.json({ status: 2, message: 'Nama barang wajib diisi' });
  if (Number.isNaN(hargaModal) || hargaModal < 0) return res.json({ status: 2, message: 'Harga modal tidak valid' });
  if (Number.isNaN(harga) || harga < 0) return res.json({ status: 2, message: 'Harga tidak valid' });
  if (Number.isNaN(minimumStock) || minimumStock < 0) return res.json({ status: 2, message: 'Minimum stok tidak valid' });

  let newId;
  await withTransaction(async (client) => {
    const nomor = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'barang' FOR UPDATE");
    const currentNumber = nomor.rows[0]?.nomor || 1;
    if (!nomor.rows[0]) await client.query("INSERT INTO penomoran (kategori, nomor) VALUES ('barang', 1)");

    newId = nextId('I', currentNumber);
    await client.query(
      'INSERT INTO inventory_items (item_id, nama, satuan_id, kategori_id, locator, merek, principal, nomor_izin_edar, nomor_batch, tanggal_kedaluwarsa, gambar_url, harga_modal, harga, minimum_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [newId, nama, satuanId, kategoriId, locator, merek, principal, nomorIzinEdar, nomorBatch, tanggalKedaluwarsa, gambarUrl, hargaModal, harga, minimumStock]
    );
    await client.query("UPDATE penomoran SET nomor = $1, updated_at = NOW() WHERE kategori = 'barang'", [currentNumber + 1]);
    if (harga > 0) {
      await client.query('INSERT INTO inventory_price_history (item_id, harga_lama, harga_baru, catatan) VALUES ($1, 0, $2, $3)', [newId, harga, 'Harga awal']);
    }
    await addLog(client, actorName(req), newId, 'INVENTORY', `Tambah barang ${newId} - ${nama}`);
  });

  return res.json({ status: 1, message: `Barang ${newId} berhasil ditambahkan` });
});

const updateInventoryItem = asyncHandler(async (req, res) => {
  const { item_id: itemId } = req.query;
  const data = req.body || {};
  const nama = String(data.nama || '').trim();
  const satuanId = data.satuan_id || null;
  const kategoriId = data.kategori_id || null;
  const locator = String(data.locator || '').trim();
  const merek = String(data.merek || '').trim();
  const principal = String(data.principal || '').trim();
  const nomorIzinEdar = String(data.nomor_izin_edar || '').trim();
  const nomorBatch = String(data.nomor_batch || '').trim();
  const tanggalKedaluwarsa = data.tanggal_kedaluwarsa || null;
  const gambarUrl = String(data.gambar_url || '').trim();
  const hargaModal = data.harga_modal === undefined || data.harga_modal === null || data.harga_modal === '' ? null : Number(data.harga_modal);
  const harga = data.harga === undefined || data.harga === null || data.harga === '' ? null : Number(data.harga);
  const minimumStock = data.minimum_stock === undefined || data.minimum_stock === null || data.minimum_stock === '' ? 5 : Number(data.minimum_stock);
  if (!nama) return res.json({ status: 2, message: 'Nama barang wajib diisi' });
  if (hargaModal !== null && (Number.isNaN(hargaModal) || hargaModal < 0)) return res.json({ status: 2, message: 'Harga modal tidak valid' });
  if (harga !== null && (Number.isNaN(harga) || harga < 0)) return res.json({ status: 2, message: 'Harga tidak valid' });
  if (Number.isNaN(minimumStock) || minimumStock < 0) return res.json({ status: 2, message: 'Minimum stok tidak valid' });

  const exists = await query('SELECT item_id, harga_modal, harga FROM inventory_items WHERE item_id = $1 AND is_aktif = true', [itemId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data barang tidak ditemukan' });

  await withTransaction(async (client) => {
    const oldPrice = Number(exists.rows[0].harga || 0);
    const nextModal = hargaModal === null ? Number(exists.rows[0].harga_modal || 0) : hargaModal;
    const nextPrice = harga === null ? oldPrice : harga;
    await client.query('UPDATE inventory_items SET nama = $1, satuan_id = $2, kategori_id = $3, locator = $4, merek = $5, principal = $6, nomor_izin_edar = $7, nomor_batch = $8, tanggal_kedaluwarsa = $9, gambar_url = $10, harga_modal = $11, harga = $12, minimum_stock = $13, updated_at = NOW() WHERE item_id = $14', [nama, satuanId, kategoriId, locator, merek, principal, nomorIzinEdar, nomorBatch, tanggalKedaluwarsa, gambarUrl, nextModal, nextPrice, minimumStock, itemId]);
    if (nextPrice !== oldPrice) {
      await client.query(
        'INSERT INTO inventory_price_history (item_id, harga_lama, harga_baru, catatan) VALUES ($1, $2, $3, $4)',
        [itemId, oldPrice, nextPrice, 'Update harga dari master barang']
      );
    }
    await addLog(client, actorName(req), itemId, 'INVENTORY', `Update barang ${itemId}`);
  });

  return res.json({ status: 1, message: `Barang ${itemId} berhasil diupdate` });
});

const deleteInventoryItem = asyncHandler(async (req, res) => {
  const { item_id: itemId } = req.query;
  const exists = await query('SELECT item_id FROM inventory_items WHERE item_id = $1 AND is_aktif = true', [itemId]);
  if (!exists.rows[0]) return res.json({ status: 2, message: 'Data barang tidak ditemukan' });

  await withTransaction(async (client) => {
    await client.query('UPDATE inventory_items SET is_aktif = false, updated_at = NOW() WHERE item_id = $1', [itemId]);
    await addLog(client, actorName(req), itemId, 'INVENTORY', `Nonaktifkan barang ${itemId}`);
  });

  return res.json({ status: 1, message: `Barang ${itemId} berhasil dihapus` });
});

const updateInventoryPrice = asyncHandler(async (req, res) => {
  const { item_id: itemId } = req.query;
  const harga = Number((req.body || {}).harga);
  const catatan = String((req.body || {}).catatan || '').trim();
  if (Number.isNaN(harga) || harga < 0) return res.json({ status: 2, message: 'Harga tidak valid' });

  await withTransaction(async (client) => {
    const item = await client.query('SELECT item_id, harga FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [itemId]);
    if (!item.rows[0]) throw Object.assign(new Error('Data barang tidak ditemukan'), { statusCode: 404 });

    const oldPrice = Number(item.rows[0].harga || 0);
    await client.query('UPDATE inventory_items SET harga = $1, updated_at = NOW() WHERE item_id = $2', [harga, itemId]);
    await client.query(
      'INSERT INTO inventory_price_history (item_id, harga_lama, harga_baru, catatan) VALUES ($1, $2, $3, $4)',
      [itemId, oldPrice, harga, catatan || 'Update harga manual']
    );
    await addLog(client, actorName(req), itemId, 'INVENTORY', `Update harga barang ${itemId}`);
  });

  return res.json({ status: 1, message: `Harga barang ${itemId} berhasil diupdate` });
});

const addInventoryTransaction = asyncHandler(async (req, res) => {
  const data = req.body || {};
  const itemId = data.item_id;
  const tipe = String(data.tipe || '').toUpperCase();
  const qty = Number(data.qty || 0);
  const harga = data.harga === '' || data.harga === undefined || data.harga === null ? null : Number(data.harga);
  const catatan = String(data.catatan || '').trim();
  const serialNumber = String(data.serial_number || '').trim();
  const reasonId = data.reason_id === '' || data.reason_id === undefined || data.reason_id === null ? null : Number(data.reason_id);

  if (!['MASUK', 'KELUAR'].includes(tipe)) return res.json({ status: 2, message: 'Tipe transaksi tidak valid' });
  if (Number.isNaN(qty) || qty <= 0) return res.json({ status: 2, message: 'Qty harus lebih dari 0' });
  if (harga !== null && (Number.isNaN(harga) || harga < 0)) return res.json({ status: 2, message: 'Harga tidak valid' });
  if (tipe === 'KELUAR' && (!Number.isInteger(reasonId) || reasonId <= 0)) return res.json({ status: 2, message: 'Alasan pengeluaran wajib dipilih' });

  await withTransaction(async (client) => {
    const item = await client.query('SELECT item_id, stok, harga_modal, harga FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [itemId]);
    if (!item.rows[0]) throw Object.assign(new Error('Data barang tidak ditemukan'), { statusCode: 404 });

    if (tipe === 'KELUAR') {
      const reason = await client.query('SELECT reason_id FROM inventory_reasons WHERE reason_id = $1 AND is_active = true', [reasonId]);
      if (!reason.rows[0]) throw Object.assign(new Error('Alasan pengeluaran tidak valid atau sudah dinonaktifkan'), { statusCode: 400 });
    }

    const stokSebelum = Number(item.rows[0].stok || 0);
    const stokSesudah = tipe === 'MASUK' ? stokSebelum + qty : stokSebelum - qty;
    if (stokSesudah < 0) throw Object.assign(new Error('Stok tidak mencukupi'), { statusCode: 400 });

    if (serialNumber) {
      const lot = await client.query('SELECT qty FROM inventory_lots WHERE item_id = $1 AND serial_number = $2 FOR UPDATE', [itemId, serialNumber]);
      const lotBefore = Number(lot.rows[0]?.qty || 0);
      const lotAfter = tipe === 'MASUK' ? lotBefore + qty : lotBefore - qty;
      if (lotAfter < 0) throw Object.assign(new Error('Stok SN/batch tidak mencukupi'), { statusCode: 400 });
      await client.query(
        `INSERT INTO inventory_lots(item_id, serial_number, qty) VALUES($1, $2, $3)
         ON CONFLICT(item_id, serial_number) DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
        [itemId, serialNumber, lotAfter]
      );
    }

    await client.query(
      `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan, reason_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [itemId, tipe, qty, harga, stokSebelum, stokSesudah, catatan, tipe === 'KELUAR' ? reasonId : null]
    );
    await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [stokSesudah, itemId]);

    if (tipe === 'MASUK' && harga !== null && harga !== Number(item.rows[0].harga_modal || 0)) {
      await client.query('UPDATE inventory_items SET harga_modal = $1, updated_at = NOW() WHERE item_id = $2', [harga, itemId]);
    }

    await addLog(client, actorName(req), itemId, 'INVENTORY', `${tipe} barang ${itemId} qty ${qty}`);
  });

  return res.json({ status: 1, message: `Transaksi barang ${tipe.toLowerCase()} berhasil disimpan` });
});

const getInventoryIssue = asyncHandler(async (req, res) => {
  await ensureInventoryIssueSchema();
  const issue = await query(
    `SELECT x.issue_id, x.spb_number, TO_CHAR(x.issue_date, 'YYYY-MM-DD') AS issue_date,
            x.recipient, x.destination, x.notes, x.created_by, x.created_at, x.status,
            x.approved_by, x.approved_at, x.revision_of, x.reason_id, r.name AS reason
       FROM inventory_issues x
       JOIN inventory_reasons r ON r.reason_id = x.reason_id
      WHERE x.issue_id = $1`,
    [req.params.issueId]
  );
  if (!issue.rows[0]) return res.status(404).json({ status: 0, message: 'SPB tidak ditemukan' });
  const items = await query(
    `SELECT d.item_id, i.nama, COALESCE(s.nama, '') AS satuan, d.serial_number,
            d.qty::float, d.stock_before::float, d.stock_after::float
       FROM inventory_issue_items d
       JOIN inventory_items i ON i.item_id = d.item_id
       LEFT JOIN satuan_barang s ON s.satuan_id = i.satuan_id
      WHERE d.issue_id = $1 ORDER BY d.issue_item_id`,
    [req.params.issueId]
  );
  return res.json({ status: 1, data: { ...issue.rows[0], items: items.rows } });
});

const getInventoryIssues = asyncHandler(async (req, res) => {
  await ensureInventoryIssueSchema();
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  const params = search ? [`%${search}%`] : [];
  const where = search ? `WHERE x.spb_number ILIKE $1 OR x.recipient ILIKE $1 OR x.destination ILIKE $1 OR x.notes ILIKE $1 OR r.name ILIKE $1` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM inventory_issues x JOIN inventory_reasons r ON r.reason_id = x.reason_id ${where}`, params);
  const rows = await query(
    `SELECT x.issue_id, x.spb_number, TO_CHAR(x.issue_date, 'YYYY-MM-DD') AS issue_date,
            x.recipient, x.destination, x.created_by, x.created_at, x.status, x.approved_by,
            x.approved_at, x.revision_of, r.name AS reason,
            COUNT(d.issue_item_id)::int AS item_count, COALESCE(SUM(d.qty), 0)::float AS total_qty
       FROM inventory_issues x JOIN inventory_reasons r ON r.reason_id = x.reason_id
       LEFT JOIN inventory_issue_items d ON d.issue_id = x.issue_id ${where}
      GROUP BY x.issue_id, r.name ORDER BY x.issue_date DESC, x.issue_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = Number(count.rows[0]?.total || 0);
  return res.json({ status: 1, data: rows.rows, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) });
});

function revisionSuffix(number) {
  let value = number;
  let suffix = '';
  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return suffix;
}

const addInventoryIssue = asyncHandler(async (req, res) => {
  await ensureInventoryIssueSchema();
  const data = req.body || {};
  let spbNumber = String(data.spb_number || '').trim();
  const issueDate = data.issue_date || null;
  const recipient = String(data.recipient || '').trim();
  const destination = String(data.destination || '').trim();
  const notes = String(data.notes || '').trim();
  const reasonId = Number(data.reason_id);
  const revisionOf = Number(data.revision_of) || null;
  const items = Array.isArray(data.items) ? data.items.map((item) => ({
    itemId: String(item.item_id || '').trim(),
    serialNumber: String(item.serial_number || '').trim(),
    qty: Number(item.qty),
  })) : [];

  if (!spbNumber) return res.status(400).json({ status: 0, message: 'Nomor SPB wajib diisi' });
  if (issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(issueDate))) return res.status(400).json({ status: 0, message: 'Format tanggal SPB tidak valid' });
  if (!recipient) return res.status(400).json({ status: 0, message: 'No. PO customer wajib diisi' });
  if (!notes) return res.status(400).json({ status: 0, message: 'No. NIE/AKL wajib diisi' });
  if (!Number.isInteger(reasonId) || reasonId <= 0) return res.status(400).json({ status: 0, message: 'Alasan pengantaran wajib dipilih' });
  if (!items.length || items.length > 10) return res.status(400).json({ status: 0, message: 'SPB harus berisi 1 sampai 10 item' });
  if (items.some((item) => !item.itemId || !Number.isFinite(item.qty) || item.qty <= 0)) return res.status(400).json({ status: 0, message: 'Barang dan qty setiap baris wajib valid' });
  const itemKeys = items.map((item) => item.itemId + '|' + item.serialNumber);
  if (new Set(itemKeys).size !== itemKeys.length) return res.status(400).json({ status: 0, message: 'Barang dengan SN/batch yang sama tidak boleh duplikat' });

  let issueId;
  await withTransaction(async (client) => {
    const reason = await client.query('SELECT reason_id FROM inventory_reasons WHERE reason_id = $1 AND is_active = true', [reasonId]);
    if (!reason.rows[0]) throw Object.assign(new Error('Alasan pengantaran tidak valid atau sudah dinonaktifkan'), { statusCode: 400 });

    if (revisionOf) {
      const source = await client.query('SELECT issue_id, spb_number, status FROM inventory_issues WHERE issue_id = $1 FOR UPDATE', [revisionOf]);
      if (!source.rows[0]) throw Object.assign(new Error('SPB sumber revisi tidak ditemukan'), { statusCode: 404 });
      if (source.rows[0].status !== 'APPROVED') throw Object.assign(new Error('Hanya SPB yang sudah disetujui yang dapat direvisi'), { statusCode: 400 });
      const baseNumber = source.rows[0].spb_number.replace(/[A-Z]+$/i, '');
      let revision = 1;
      while (true) {
        const candidate = `${baseNumber}${revisionSuffix(revision)}`;
        const exists = await client.query('SELECT 1 FROM inventory_issues WHERE LOWER(spb_number) = LOWER($1)', [candidate]);
        if (!exists.rows[0]) { spbNumber = candidate; break; }
        revision += 1;
      }
    } else {
      const duplicate = await client.query('SELECT issue_id FROM inventory_issues WHERE LOWER(spb_number) = LOWER($1)', [spbNumber]);
      if (duplicate.rows[0]) throw Object.assign(new Error('Nomor SPB sudah digunakan'), { statusCode: 409 });
    }

    const created = await client.query(
      `INSERT INTO inventory_issues(spb_number, issue_date, recipient, destination, reason_id, notes, created_by, status, revision_of)
       VALUES($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, 'PENDING', $8) RETURNING issue_id`,
      [spbNumber, issueDate, recipient, destination, reasonId, notes, actorName(req), revisionOf]
    );
    issueId = created.rows[0].issue_id;

    for (const line of items) {
      const item = await client.query('SELECT item_id, stok FROM inventory_items WHERE item_id = $1 AND is_aktif = true', [line.itemId]);
      if (!item.rows[0]) throw Object.assign(new Error(`Barang ${line.itemId} tidak ditemukan`), { statusCode: 404 });
      const stockBefore = Number(item.rows[0].stok || 0);
      if (stockBefore < line.qty) throw Object.assign(new Error(`Stok barang ${line.itemId} tidak mencukupi`), { statusCode: 400 });
      if (line.serialNumber) {
        const lot = await client.query('SELECT qty FROM inventory_lots WHERE item_id = $1 AND serial_number = $2', [line.itemId, line.serialNumber]);
        if (!lot.rows[0] || Number(lot.rows[0].qty || 0) < line.qty) throw Object.assign(new Error(`Stok SN/batch ${line.serialNumber} tidak mencukupi`), { statusCode: 400 });
      }
      await client.query(
        `INSERT INTO inventory_issue_items(issue_id, item_id, serial_number, qty, stock_before, stock_after)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [issueId, line.itemId, line.serialNumber, line.qty, stockBefore, stockBefore - line.qty]
      );
    }
    await addLog(client, actorName(req), spbNumber, 'INVENTORY', `Pengajuan SPB ${spbNumber} menunggu approval`);
  });

  const detail = await query(
    `SELECT x.issue_id, x.spb_number, TO_CHAR(x.issue_date, 'YYYY-MM-DD') AS issue_date,
            x.recipient, x.destination, x.notes, x.created_by, x.created_at, x.status,
            x.approved_by, x.approved_at, x.revision_of, x.reason_id, r.name AS reason
       FROM inventory_issues x JOIN inventory_reasons r ON r.reason_id = x.reason_id WHERE x.issue_id = $1`,
    [issueId]
  );
  const detailItems = await query(
    `SELECT d.item_id, i.nama, COALESCE(s.nama, '') AS satuan, d.serial_number,
            d.qty::float, d.stock_before::float, d.stock_after::float
       FROM inventory_issue_items d JOIN inventory_items i ON i.item_id = d.item_id
       LEFT JOIN satuan_barang s ON s.satuan_id = i.satuan_id WHERE d.issue_id = $1 ORDER BY d.issue_item_id`,
    [issueId]
  );
  return res.json({ status: 1, message: `SPB ${spbNumber} diajukan untuk approval`, data: { ...detail.rows[0], items: detailItems.rows } });
});

const approveInventoryIssue = asyncHandler(async (req, res) => {
  await ensureInventoryIssueSchema();
  const issueId = Number(req.params.issueId);
  let approvedNumber = '';
  await withTransaction(async (client) => {
    const issue = await client.query('SELECT * FROM inventory_issues WHERE issue_id = $1 FOR UPDATE', [issueId]);
    const row = issue.rows[0];
    if (!row) throw Object.assign(new Error('SPB tidak ditemukan'), { statusCode: 404 });
    if (row.status !== 'PENDING') throw Object.assign(new Error('SPB ini tidak sedang menunggu approval'), { statusCode: 409 });
    if (String(row.created_by).toLowerCase() === actorName(req).toLowerCase()) throw Object.assign(new Error('Pembuat SPB tidak dapat menyetujui pengajuannya sendiri'), { statusCode: 403 });
    approvedNumber = row.spb_number;

    if (row.revision_of) {
      const previous = await client.query('SELECT status, spb_number FROM inventory_issues WHERE issue_id = $1 FOR UPDATE', [row.revision_of]);
      if (!previous.rows[0] || previous.rows[0].status !== 'APPROVED') throw Object.assign(new Error('SPB sumber revisi sudah tidak aktif'), { statusCode: 409 });
      const previousItems = await client.query('SELECT * FROM inventory_issue_items WHERE issue_id = $1 ORDER BY issue_item_id FOR UPDATE', [row.revision_of]);
      for (const line of previousItems.rows) {
        const item = await client.query('SELECT stok FROM inventory_items WHERE item_id = $1 FOR UPDATE', [line.item_id]);
        const before = Number(item.rows[0].stok || 0);
        const after = before + Number(line.qty);
        await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [after, line.item_id]);
        if (line.serial_number) await client.query(`INSERT INTO inventory_lots(item_id, serial_number, qty) VALUES($1,$2,$3) ON CONFLICT(item_id,serial_number) DO UPDATE SET qty=inventory_lots.qty+EXCLUDED.qty, updated_at=NOW()`, [line.item_id, line.serial_number, line.qty]);
        await client.query(`INSERT INTO inventory_transactions(item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan) VALUES($1,'MASUK',$2,NULL,$3,$4,$5)`, [line.item_id, line.qty, before, after, `Pembatalan ${previous.rows[0].spb_number} karena revisi ${row.spb_number}`]);
      }
      await client.query("UPDATE inventory_issues SET status = 'REVISED' WHERE issue_id = $1", [row.revision_of]);
    }

    const lines = await client.query('SELECT * FROM inventory_issue_items WHERE issue_id = $1 ORDER BY issue_item_id FOR UPDATE', [issueId]);
    for (const line of lines.rows) {
      const item = await client.query('SELECT stok FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [line.item_id]);
      if (!item.rows[0]) throw Object.assign(new Error(`Barang ${line.item_id} tidak ditemukan`), { statusCode: 404 });
      const before = Number(item.rows[0].stok || 0);
      const after = before - Number(line.qty);
      if (after < 0) throw Object.assign(new Error(`Stok barang ${line.item_id} tidak mencukupi saat approval`), { statusCode: 400 });
      if (line.serial_number) {
        const lot = await client.query('SELECT qty FROM inventory_lots WHERE item_id = $1 AND serial_number = $2 FOR UPDATE', [line.item_id, line.serial_number]);
        const lotAfter = Number(lot.rows[0]?.qty || 0) - Number(line.qty);
        if (!lot.rows[0] || lotAfter < 0) throw Object.assign(new Error(`Stok SN/batch ${line.serial_number} tidak mencukupi saat approval`), { statusCode: 400 });
        await client.query('UPDATE inventory_lots SET qty = $1, updated_at = NOW() WHERE item_id = $2 AND serial_number = $3', [lotAfter, line.item_id, line.serial_number]);
      }
      await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [after, line.item_id]);
      await client.query('UPDATE inventory_issue_items SET stock_before = $1, stock_after = $2 WHERE issue_item_id = $3', [before, after, line.issue_item_id]);
      await client.query(`INSERT INTO inventory_transactions(item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan, reason_id) VALUES($1,'KELUAR',$2,NULL,$3,$4,$5,$6)`, [line.item_id, line.qty, before, after, `SPB ${row.spb_number}: ${row.notes}`, row.reason_id]);
    }
    await client.query("UPDATE inventory_issues SET status='APPROVED', approved_by=$1, approved_at=NOW() WHERE issue_id=$2", [actorName(req), issueId]);
    await addLog(client, actorName(req), row.spb_number, 'INVENTORY', `Approval SPB ${row.spb_number}`);
  });
  return res.json({ status: 1, message: `SPB ${approvedNumber} telah disetujui dan siap dicetak` });
});
const addBulkInventoryIncoming = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const catatan = String(req.body?.catatan || '').trim() || 'Upload barang masuk Master_Barang';

  if (!rows.length) return res.status(400).json({ status: 0, message: 'Data upload kosong' });
  if (rows.length > 3000) return res.status(400).json({ status: 0, message: 'Maksimal 3.000 baris per upload' });

  const result = { processed: 0, created: 0, updated: 0, skipped: 0, total_qty: 0, errors: [] };
  await withTransaction(async (client) => {
    const itemsResult = await client.query(
      'SELECT item_id, nama, stok, harga_modal FROM inventory_items WHERE is_aktif = true FOR UPDATE'
    );
    const categoriesResult = await client.query('SELECT kategori_id, nama FROM kategori_barang');
    const unitsResult = await client.query('SELECT satuan_id, nama FROM satuan_barang');
    const nomorResult = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'barang' FOR UPDATE");
    let nextNumber = Number(nomorResult.rows[0]?.nomor || 1);
    if (!nomorResult.rows[0]) {
      await client.query("INSERT INTO penomoran (kategori, nomor) VALUES ('barang', $1)", [nextNumber]);
    }

    const normalize = (value) => String(value || '').trim().toLowerCase();
    const byId = new Map(itemsResult.rows.map((item) => [normalize(item.item_id), item]));
    const byName = new Map();
    itemsResult.rows.forEach((item) => {
      const key = normalize(item.nama);
      const matches = byName.get(key) || [];
      matches.push(item);
      byName.set(key, matches);
    });
    const categories = new Map(categoriesResult.rows.map((row) => [normalize(row.nama), row.kategori_id]));
    const units = new Map(unitsResult.rows.map((row) => [normalize(row.nama), row.satuan_id]));
    const usedIds = new Set(itemsResult.rows.map((item) => normalize(item.item_id)));
    const newItems = [];
    const changedItems = new Map();
    const transactions = [];

    const generatedId = () => {
      let id;
      do {
        id = nextId('I', nextNumber);
        nextNumber += 1;
      } while (usedIds.has(normalize(id)));
      usedIds.add(normalize(id));
      return id;
    };

    for (let index = 0; index < rows.length; index += 1) {
      const source = rows[index] || {};
      const sku = String(source.sku || '').trim();
      const namaAsli = String(source.nama || '').trim();
      const nama = namaAsli.slice(0, 80);
      const qty = Number(source.qty);
      const harga = source.harga === '' || source.harga === null || source.harga === undefined ? 0 : Number(source.harga);
      const rowNumber = Number(source.row_number) || index + 2;

      if (!namaAsli) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, sku, nama, message: 'Nama Produk wajib diisi' });
        continue;
      }
      if (!Number.isFinite(qty) || qty < 0) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, sku, nama, message: 'Stok Terkini tidak valid' });
        continue;
      }
      if (!Number.isFinite(harga) || harga < 0) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, sku, nama, message: 'HPP tidak valid' });
        continue;
      }

      let item = null;
      const nameMatches = byName.get(normalize(nama)) || [];
      if (nameMatches.length === 1) item = nameMatches[0];

      if (!item) {
        const itemId = generatedId();
        const locator = [source.gudang, source.rak].map((value) => String(value || '').trim()).filter(Boolean).join(' / ').slice(0, 80);
        item = {
          item_id: itemId,
          nama,
          stok: 0,
          harga_modal: harga,
          kategori_id: categories.get(normalize(source.kategori)) || null,
          satuan_id: units.get(normalize(source.satuan)) || null,
          locator,
          minimum_stock: Number.isFinite(Number(source.minimum_stock)) ? Math.max(0, Number(source.minimum_stock)) : 5,
          isNew: true,
        };
        newItems.push(item);
        byId.set(normalize(itemId), item);
        const matches = byName.get(normalize(nama)) || [];
        matches.push(item);
        byName.set(normalize(nama), matches);
        result.created += 1;
      } else if (!item.isNew) {
        result.updated += 1;
      }

      const stokSebelum = Number(item.stok || 0);
      const stokSesudah = stokSebelum + qty;
      item.stok = stokSesudah;
      item.harga_modal = harga;
      changedItems.set(item.item_id, item);
      if (qty > 0) {
        transactions.push({
          item_id: item.item_id,
          qty,
          harga,
          stok_sebelum: stokSebelum,
          stok_sesudah: stokSesudah,
          catatan: `${catatan} (baris ${rowNumber})`,
        });
        result.total_qty += qty;
      }
      result.processed += 1;
    }

    if (newItems.length) {
      await client.query(
        `INSERT INTO inventory_items
          (item_id, nama, satuan_id, kategori_id, locator, stok, harga_modal, harga, minimum_stock, is_aktif)
         SELECT x.item_id, x.nama, x.satuan_id, x.kategori_id, x.locator, x.stok, x.harga_modal, 0, x.minimum_stock, true
         FROM jsonb_to_recordset($1::jsonb) AS x(
           item_id varchar, nama varchar, satuan_id varchar, kategori_id varchar, locator varchar,
           stok numeric, harga_modal numeric, minimum_stock numeric
         )`,
        [JSON.stringify(newItems)]
      );
    }

    const existingChanges = [...changedItems.values()].filter((item) => !item.isNew);
    if (existingChanges.length) {
      await client.query(
        `UPDATE inventory_items AS i
            SET stok = x.stok, harga_modal = x.harga_modal, updated_at = NOW()
           FROM jsonb_to_recordset($1::jsonb) AS x(item_id varchar, stok numeric, harga_modal numeric)
          WHERE i.item_id = x.item_id`,
        [JSON.stringify(existingChanges)]
      );
    }

    if (transactions.length) {
      await client.query(
        `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan)
         SELECT x.item_id, 'MASUK', x.qty, x.harga, x.stok_sebelum, x.stok_sesudah, x.catatan
         FROM jsonb_to_recordset($1::jsonb) AS x(
           item_id varchar, qty numeric, harga numeric, stok_sebelum numeric, stok_sesudah numeric, catatan text
         )`,
        [JSON.stringify(transactions)]
      );
    }

    if (nextNumber !== Number(nomorResult.rows[0]?.nomor || 1)) {
      await client.query("UPDATE penomoran SET nomor = $1, updated_at = NOW() WHERE kategori = 'barang'", [nextNumber]);
    }
    await addLog(
      client,
      actorName(req),
      'BULK-INCOMING',
      'INVENTORY',
      `Upload barang masuk: ${result.processed} baris, ${result.created} barang baru, qty ${result.total_qty}`
    );
  });

  return res.json({
    status: result.processed > 0 ? 1 : 2,
    message: `${result.processed} baris diproses, ${result.created} barang baru, ${result.skipped} dilewati`,
    ...result,
  });
});
const addStockOpname = asyncHandler(async (req, res) => {
  const data = req.body || {};
  const itemId = data.item_id;
  const lots = Array.isArray(data.lots) ? data.lots.map((lot) => ({ serialNumber: String(lot.serial_number || '').trim(), qty: Number(lot.qty) })) : [];
  const invalidLot = lots.find((lot) => !lot.serialNumber || !Number.isFinite(lot.qty) || lot.qty < 0);
  if (invalidLot) return res.json({ status: 2, message: 'Stok fisik SN/batch tidak valid' });
  const stokFisik = lots.length ? lots.reduce((total, lot) => total + lot.qty, 0) : Number(data.stok_fisik);
  const catatan = String(data.catatan || '').trim();
  if (Number.isNaN(stokFisik) || stokFisik < 0) return res.json({ status: 2, message: 'Stok fisik tidak valid' });

  await withTransaction(async (client) => {
    const item = await client.query('SELECT item_id, stok FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [itemId]);
    if (!item.rows[0]) throw Object.assign(new Error('Data barang tidak ditemukan'), { statusCode: 404 });

    const stokSebelum = Number(item.rows[0].stok || 0);
    const selisih = stokFisik - stokSebelum;
    if (lots.length) {
      await client.query('UPDATE inventory_lots SET qty = 0, updated_at = NOW() WHERE item_id = $1', [itemId]);
      for (const lot of lots) {
        await client.query(
          `INSERT INTO inventory_lots(item_id, serial_number, qty) VALUES($1, $2, $3)
           ON CONFLICT(item_id, serial_number) DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
          [itemId, lot.serialNumber, lot.qty]
        );
      }
    }
    await client.query(
      `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan)
       VALUES ($1, 'OPNAME', $2, NULL, $3, $4, $5)`,
      [itemId, selisih, stokSebelum, stokFisik, catatan || 'Stock opname']
    );
    await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [stokFisik, itemId]);
    await addLog(client, actorName(req), itemId, 'INVENTORY', `Stock opname ${itemId}: ${stokSebelum} ke ${stokFisik}`);
  });

  return res.json({ status: 1, message: `Stock opname barang ${itemId} berhasil disimpan` });
});

const addBulkStockOpname = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!rows.length) return res.json({ status: 2, message: 'Tidak ada data stock opname untuk disimpan' });

  const normalized = rows.map((row) => ({
    itemId: String(row.item_id || '').trim(),
    lots: Array.isArray(row.lots) ? row.lots.map((lot) => ({ serialNumber: String(lot.serial_number || '').trim(), qty: Number(lot.qty) })) : [],
    stokFisik: Array.isArray(row.lots) && row.lots.length ? row.lots.reduce((total, lot) => total + Number(lot.qty || 0), 0) : Number(row.stok_fisik),
    catatan: String(row.catatan || '').trim(),
  }));
  const invalid = normalized.find((row) => !row.itemId || Number.isNaN(row.stokFisik) || row.stokFisik < 0 || row.lots.some((lot) => !lot.serialNumber || !Number.isFinite(lot.qty) || lot.qty < 0));
  if (invalid) return res.json({ status: 2, message: 'Data stock opname tidak valid' });

  const duplicated = normalized.find((row, index) => normalized.findIndex((candidate) => candidate.itemId === row.itemId) !== index);
  if (duplicated) return res.json({ status: 2, message: `Barang ${duplicated.itemId} duplikat di payload` });

  await withTransaction(async (client) => {
    for (const row of normalized) {
      const item = await client.query('SELECT item_id, stok FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [row.itemId]);
      if (!item.rows[0]) throw Object.assign(new Error(`Data barang ${row.itemId} tidak ditemukan`), { statusCode: 404 });

      const stokSebelum = Number(item.rows[0].stok || 0);
      const selisih = row.stokFisik - stokSebelum;
      if (row.lots.length) {
        await client.query('UPDATE inventory_lots SET qty = 0, updated_at = NOW() WHERE item_id = $1', [row.itemId]);
        for (const lot of row.lots) {
          await client.query(
            `INSERT INTO inventory_lots(item_id, serial_number, qty) VALUES($1, $2, $3)
             ON CONFLICT(item_id, serial_number) DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
            [row.itemId, lot.serialNumber, lot.qty]
          );
        }
      }
      await client.query(
        `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan)
         VALUES ($1, 'OPNAME', $2, NULL, $3, $4, $5)`,
        [row.itemId, selisih, stokSebelum, row.stokFisik, row.catatan || 'Bulk stock opname']
      );
      await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [row.stokFisik, row.itemId]);
      await addLog(client, actorName(req), row.itemId, 'INVENTORY', `Bulk stock opname ${row.itemId}: ${stokSebelum} ke ${row.stokFisik}`);
    }
  });

  return res.json({ status: 1, message: `${normalized.length} stock opname berhasil disimpan` });
});

const getInventoryReasons = asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.include_inactive || '') === 'true';
  const result = await query(
    'SELECT reason_id, name, is_active FROM inventory_reasons WHERE ($1::boolean = true OR is_active = true) ORDER BY name',
    [includeInactive]
  );
  return res.json({ status: 1, data: result.rows });
});

const addInventoryReason = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim().toUpperCase();
  if (name.length < 2 || name.length > 100) return res.status(400).json({ status: 0, message: 'Nama alasan harus 2-100 karakter' });
  const result = await query(
    'INSERT INTO inventory_reasons(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET is_active = true, updated_at = NOW() RETURNING reason_id, name, is_active',
    [name]
  );
  return res.json({ status: 1, message: 'Alasan berhasil disimpan', data: result.rows[0] });
});

const updateInventoryReason = asyncHandler(async (req, res) => {
  const reasonId = Number(req.params.reasonId);
  const isActive = req.body?.is_active !== false;
  const result = await query('UPDATE inventory_reasons SET is_active = $1, updated_at = NOW() WHERE reason_id = $2 RETURNING reason_id, name, is_active', [isActive, reasonId]);
  if (!result.rows[0]) return res.status(404).json({ status: 0, message: 'Alasan tidak ditemukan' });
  return res.json({ status: 1, message: 'Status alasan diperbarui', data: result.rows[0] });
});

const updateRestockPlan = asyncHandler(async (req, res) => {
  const itemId = String(req.params.itemId || '').trim();
  const plannedQty = Number(req.body?.planned_qty);
  if (!itemId || !Number.isFinite(plannedQty) || plannedQty < 0) return res.status(400).json({ status: 0, message: 'Qty rencana tidak valid' });
  await query(
    `INSERT INTO inventory_restock_plans(item_id, planned_qty, updated_by) VALUES($1, $2, $3)
     ON CONFLICT(item_id) DO UPDATE SET planned_qty = EXCLUDED.planned_qty, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [itemId, plannedQty, actorName(req)]
  );
  return res.json({ status: 1, message: 'Qty rencana pembelian tersimpan', item_id: itemId, planned_qty: plannedQty });
});

const getInventoryHistory = asyncHandler(async (req, res) => {
  const { item_id: itemId } = req.query;
  const transactions = await query(
    `SELECT it.transaksi_id, it.tipe, it.qty, it.harga, it.stok_sebelum, it.stok_sesudah, it.catatan,
            ir.name AS alasan, it.created_at
       FROM inventory_transactions it
       LEFT JOIN inventory_reasons ir ON ir.reason_id = it.reason_id
      WHERE it.item_id = $1
      ORDER BY it.created_at DESC, it.transaksi_id DESC
      LIMIT 50`,
    [itemId]
  );
  const prices = await query(
    `SELECT history_id, harga_lama, harga_baru, catatan, created_at
       FROM inventory_price_history
      WHERE item_id = $1
      ORDER BY created_at DESC, history_id DESC
      LIMIT 50`,
    [itemId]
  );

  return res.json({
    status: 1,
    transactions: transactions.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })),
    prices: prices.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })),
  });
});

const getDashboardSummary = asyncHandler(async (_req, res) => {
  const [
    inventorySummary,
    inventoryByCategory,
    stockStatus,
    lowStockItems,
    salesSummary,
    salesByDay,
    recentOrders,
    paymentMethods,
    transactionTypes,
    userSummary,
    usersByGroup,
    menuSummary,
    masterCounts,
    purchaseSummary,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_items,
              COALESCE(SUM(stok), 0)::float AS total_stok,
              COALESCE(SUM(stok * harga_modal), 0)::float AS estimasi_modal,
              COALESCE(SUM(stok * harga), 0)::float AS estimasi_jual,
              COUNT(*) FILTER (WHERE stok <= minimum_stock)::int AS stok_rendah
         FROM inventory_items
        WHERE is_aktif = true`
    ),
    query(
      `SELECT COALESCE(k.nama, 'Tanpa Kategori') AS label,
              COUNT(i.item_id)::int AS item_count,
              COALESCE(SUM(i.stok), 0)::float AS total_stok,
              COALESCE(SUM(i.stok * i.harga_modal), 0)::float AS estimasi_modal
         FROM inventory_items i
         LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id
        WHERE i.is_aktif = true
        GROUP BY COALESCE(k.nama, 'Tanpa Kategori')
        ORDER BY estimasi_modal DESC
        LIMIT 8`
    ),
    query(
      `SELECT CASE
                WHEN stok <= 0 THEN 'Kosong'
                WHEN stok <= minimum_stock THEN 'Rendah'
                ELSE 'Aman'
              END AS label,
              COUNT(*)::int AS value
         FROM inventory_items
        WHERE is_aktif = true
        GROUP BY label
        ORDER BY label`
    ),
    query(
      `SELECT i.item_id, i.nama, COALESCE(k.nama, 'Tanpa Kategori') AS kategori, i.stok
         FROM inventory_items i
         LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id
        WHERE i.is_aktif = true AND i.stok <= i.minimum_stock
        ORDER BY i.stok ASC, i.nama ASC
        LIMIT 8`
    ),
    query(
      `SELECT COUNT(*)::int AS total_orders,
              COALESCE(SUM(total), 0)::float AS total_sales,
              COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN total ELSE 0 END), 0)::float AS sales_today,
              COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS orders_today
         FROM sales_orders
        WHERE status = 'SELESAI'`
    ),
    query(
      `SELECT TO_CHAR(day::date, 'DD Mon') AS label,
              COALESCE(SUM(so.total), 0)::float AS total
         FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') day
         LEFT JOIN sales_orders so ON so.created_at::date = day::date AND so.status = 'SELESAI'
        GROUP BY day
        ORDER BY day`
    ),
    query(
      `SELECT so.sales_id, so.total, so.metode_pembayaran, so.created_at, so.status,
              COALESCE(string_agg(ii.nama, ', ' ORDER BY soi.sales_item_id), '-') AS items
         FROM sales_orders so
         LEFT JOIN sales_order_items soi ON soi.sales_id = so.sales_id
         LEFT JOIN inventory_items ii ON ii.item_id = soi.item_id
        GROUP BY so.sales_id, so.total, so.metode_pembayaran, so.created_at, so.status
        ORDER BY so.created_at DESC
        LIMIT 8`
    ),
    query(
      `SELECT metode_pembayaran AS label,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS value
         FROM sales_orders
        WHERE status = 'SELESAI'
        GROUP BY metode_pembayaran
        ORDER BY value DESC`
    ),
    query(
      `SELECT tipe AS label,
              COUNT(*)::int AS count,
              COALESCE(SUM(qty), 0)::float AS qty
         FROM inventory_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY tipe
        ORDER BY count DESC`
    ),
    query(
      `SELECT COUNT(*)::int AS total_users,
              COUNT(*) FILTER (WHERE is_aktif = true)::int AS active_users,
              COUNT(*) FILTER (WHERE is_aktif = false)::int AS inactive_users
         FROM users`
    ),
    query(
      `SELECT g.nama AS label,
              COUNT(u.user_id)::int AS value
         FROM grup g
         LEFT JOIN users u ON u.grup_id = g.grup_id
        GROUP BY g.nama
        ORDER BY value DESC, g.nama ASC
        LIMIT 8`
    ),
    query(
      `SELECT COUNT(*)::int AS total_menus,
              COUNT(*) FILTER (WHERE is_aktif = true)::int AS active_menus,
              COUNT(*) FILTER (WHERE is_aktif = false)::int AS inactive_menus
         FROM menu`
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM kategori_barang) AS kategori_barang,
         (SELECT COUNT(*)::int FROM satuan_barang) AS satuan_barang,
         (SELECT COUNT(*)::int FROM grup) AS grup,
         (SELECT COUNT(*)::int FROM departemen) AS departemen,
         (SELECT COUNT(*)::int FROM jabatan) AS jabatan`
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS pending_purchases,
              COALESCE(SUM(total) FILTER (WHERE status = 'DRAFT'), 0)::float AS pending_value
         FROM purchases`
    ),
  ]);

  return res.json({
    status: 1,
    inventory: {
      summary: inventorySummary.rows[0] || {},
      by_category: inventoryByCategory.rows,
      stock_status: stockStatus.rows,
      low_stock: lowStockItems.rows,
      transaction_types: transactionTypes.rows,
    },
    sales: {
      summary: salesSummary.rows[0] || {},
      by_day: salesByDay.rows,
      recent_orders: recentOrders.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })),
      payment_methods: paymentMethods.rows,
    },
    users: {
      summary: userSummary.rows[0] || {},
      by_group: usersByGroup.rows,
    },
    menu: menuSummary.rows[0] || {},
    master_counts: masterCounts.rows[0] || {},
    purchases: { summary: purchaseSummary.rows[0] || {} },
  });
});

const getReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { start_date: startDate, end_date: endDate, search = '', status = '', kategori = '', tipe = '' } = req.query;
  const from = startDate || '2000-01-01';
  const to = endDate || '2999-12-31';
  const keyword = `%${String(search).trim()}%`;

  if (type === 'stock') {
    const result = await query(
      `SELECT i.item_id, i.nama, COALESCE(k.nama, 'Tanpa Kategori') AS kategori, COALESCE(s.nama, '-') AS satuan,
              i.locator, i.stok, i.minimum_stock, i.harga_modal,
              (i.stok * i.harga_modal)::float AS nilai_persediaan,
              CASE WHEN i.stok <= 0 THEN 'Kosong'
                   WHEN i.stok <= i.minimum_stock THEN 'Mau Habis'
                   ELSE 'Aman' END AS status_stok
         FROM inventory_items i
         LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id
         LEFT JOIN satuan_barang s ON s.satuan_id = i.satuan_id
        WHERE i.is_aktif = true
          AND ($1 = '' OR i.item_id ILIKE $2 OR i.nama ILIKE $2 OR i.locator ILIKE $2 OR k.nama ILIKE $2)
          AND ($3 = '' OR k.nama = $3)
          AND ($4 = '' OR CASE WHEN i.stok <= 0 THEN 'Kosong' WHEN i.stok <= i.minimum_stock THEN 'Mau Habis' ELSE 'Aman' END = $4)
        ORDER BY status_stok DESC, i.stok ASC, i.nama ASC`,
      [String(search).trim(), keyword, kategori, status]
    );
    return res.json({ status: 1, type, data: result.rows });
  }

  if (type === 'restock') {
    const result = await query(
      `SELECT i.item_id, i.nama, COALESCE(k.nama, 'Tanpa Kategori') AS kategori, COALESCE(s.nama, '-') AS satuan,
              i.locator, i.stok, i.minimum_stock,
              GREATEST(i.minimum_stock - i.stok, 0)::float AS rekomendasi_restock,
              COALESCE(rp.planned_qty, GREATEST(i.minimum_stock - i.stok, 0))::float AS qty_rencana
         FROM inventory_items i
         LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id
         LEFT JOIN satuan_barang s ON s.satuan_id = i.satuan_id
         LEFT JOIN inventory_restock_plans rp ON rp.item_id = i.item_id
        WHERE i.is_aktif = true AND i.stok <= i.minimum_stock
          AND ($1 = '' OR i.item_id ILIKE $2 OR i.nama ILIKE $2 OR i.locator ILIKE $2 OR k.nama ILIKE $2)
        ORDER BY i.stok ASC, i.nama ASC`,
      [String(search).trim(), keyword]
    );
    return res.json({ status: 1, type, data: result.rows });
  }

  if (type === 'movement' || type === 'opname') {
    const opnameOnly = type === 'opname';
    const result = await query(
      `SELECT it.transaksi_id, it.item_id, i.nama, COALESCE(k.nama, 'Tanpa Kategori') AS kategori,
              it.tipe, it.qty, it.stok_sebelum, it.stok_sesudah, it.catatan, it.created_at
         FROM inventory_transactions it
         JOIN inventory_items i ON i.item_id = it.item_id
         LEFT JOIN kategori_barang k ON k.kategori_id = i.kategori_id
        WHERE it.created_at::date BETWEEN $1::date AND $2::date
          AND ($3::boolean = false OR it.tipe = 'OPNAME')
          AND ($4 = '' OR it.tipe = $4)
          AND ($5 = '' OR it.item_id ILIKE $6 OR i.nama ILIKE $6 OR k.nama ILIKE $6 OR it.catatan ILIKE $6)
        ORDER BY it.created_at DESC, it.transaksi_id DESC`,
      [from, to, opnameOnly, tipe, String(search).trim(), keyword]
    );
    return res.json({ status: 1, type, data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })) });
  }

  if (type === 'sales') {
    const result = await query(
      `SELECT so.sales_id, so.created_at, so.metode_pembayaran, so.subtotal, so.diskon, so.total, so.bayar, so.kembalian, so.status, so.cancel_reason, so.cancelled_at, so.cancelled_by,
              COALESCE(SUM(soi.qty), 0)::float AS total_qty,
              COALESCE(string_agg(ii.nama, ', ' ORDER BY soi.sales_item_id), '-') AS items
         FROM sales_orders so
         LEFT JOIN sales_order_items soi ON soi.sales_id = so.sales_id
         LEFT JOIN inventory_items ii ON ii.item_id = soi.item_id
        WHERE so.created_at::date BETWEEN $1::date AND $2::date
          AND ($3 = '' OR so.sales_id ILIKE $4 OR so.metode_pembayaran ILIKE $4 OR ii.nama ILIKE $4)
        GROUP BY so.sales_id, so.created_at, so.metode_pembayaran, so.subtotal, so.diskon, so.total, so.bayar, so.kembalian, so.status, so.cancel_reason, so.cancelled_at, so.cancelled_by
        ORDER BY so.created_at DESC`,
      [from, to, String(search).trim(), keyword]
    );
    return res.json({ status: 1, type, data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })) });
  }

  return res.status(404).json({ status: 0, message: `Report ${type} tidak ditemukan` });
});

const getBackup = asyncHandler(async (_req, res) => {
  const tables = [
    'departemen',
    'jabatan',
    'grup',
    'satuan_barang',
    'kategori_barang',
    'inventory_items',
    'inventory_transactions',
    'inventory_price_history',
    'sales_orders',
    'sales_order_items',
    'menu',
    'hak_akses',
    'users',
    'perusahaan',
    'penomoran',
    'log_audit_trail',
  ];
  const backup = { exported_at: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    const result = await query(`SELECT * FROM ${table}`);
    backup.tables[table] = result.rows;
  }

  return res.json({ status: 1, backup });
});

const getSalesOrders = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
  const keyword = `%${search}%`;
  const result = await query(
    `SELECT so.sales_id, so.created_at, so.metode_pembayaran, so.subtotal, so.diskon, so.total, so.bayar, so.kembalian, so.status, so.cancel_reason, so.cancelled_at, so.cancelled_by,
            COALESCE(SUM(soi.qty), 0)::float AS total_qty,
            COUNT(soi.sales_item_id)::int AS item_lines
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON soi.sales_id = so.sales_id
      WHERE ($1 = '' OR so.sales_id ILIKE $2 OR so.metode_pembayaran ILIKE $2)
      GROUP BY so.sales_id, so.created_at, so.metode_pembayaran, so.subtotal, so.diskon, so.total, so.bayar, so.kembalian, so.status, so.cancel_reason, so.cancelled_at, so.cancelled_by
      ORDER BY so.created_at DESC, so.sales_id DESC
      LIMIT $3`,
    [search, keyword, limit]
  );
  return res.json({ status: 1, data: result.rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) })) });
});

const getSalesOrderDetail = asyncHandler(async (req, res) => {
  const salesId = String(req.params.salesId || '').trim();
  const order = await query(
    'SELECT sales_id, created_at, metode_pembayaran, subtotal, diskon, total, bayar, kembalian, status, cancel_reason, cancelled_at, cancelled_by FROM sales_orders WHERE sales_id = $1',
    [salesId]
  );
  if (!order.rows[0]) return res.status(404).json({ status: 0, message: 'Transaksi tidak ditemukan' });
  const items = await query(
    `SELECT soi.item_id, COALESCE(i.nama, soi.item_id) AS nama, soi.qty, soi.harga, soi.subtotal
       FROM sales_order_items soi
       LEFT JOIN inventory_items i ON i.item_id = soi.item_id
      WHERE soi.sales_id = $1
      ORDER BY soi.sales_item_id`,
    [salesId]
  );
  return res.json({
    status: 1,
    receipt: { ...order.rows[0], created_at: formatDate(order.rows[0].created_at), items: items.rows },
  });
});

const cancelSalesOrder = asyncHandler(async (req, res) => {
  const salesId = String(req.params.salesId || '').trim();
  const reason = String(req.body?.reason || '').trim();
  if (!salesId) return res.status(400).json({ status: 0, message: 'ID transaksi wajib diisi' });
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ status: 0, message: 'Alasan pembatalan wajib diisi minimal 5 dan maksimal 500 karakter' });

  await withTransaction(async (client) => {
    const orderResult = await client.query('SELECT sales_id, status FROM sales_orders WHERE sales_id = $1 FOR UPDATE', [salesId]);
    const order = orderResult.rows[0];
    if (!order) {
      const error = new Error('Transaksi tidak ditemukan');
      error.statusCode = 404;
      throw error;
    }
    if (order.status === 'BATAL') {
      const error = new Error('Transaksi sudah dibatalkan sebelumnya');
      error.statusCode = 409;
      throw error;
    }

    const items = await client.query('SELECT item_id, qty, harga FROM sales_order_items WHERE sales_id = $1 ORDER BY sales_item_id FOR UPDATE', [salesId]);
    for (const item of items.rows) {
      const inventoryResult = await client.query('SELECT stok FROM inventory_items WHERE item_id = $1 FOR UPDATE', [item.item_id]);
      if (!inventoryResult.rows[0]) {
        const error = new Error(`Barang ${item.item_id} tidak ditemukan; pembatalan dihentikan agar stok tetap konsisten`);
        error.statusCode = 409;
        throw error;
      }
      const stokSebelum = Number(inventoryResult.rows[0].stok || 0);
      const qty = Number(item.qty || 0);
      const stokSesudah = stokSebelum + qty;
      await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [stokSesudah, item.item_id]);
      await client.query(
        `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan)
         VALUES ($1, 'RETUR', $2, $3, $4, $5, $6)`,
        [item.item_id, qty, Number(item.harga || 0), stokSebelum, stokSesudah, `Pembatalan transaksi ${salesId}: ${reason}`]
      );
    }

    await client.query(
      `UPDATE sales_orders
          SET status = 'BATAL', cancel_reason = $1, cancelled_at = NOW(), cancelled_by = $2
        WHERE sales_id = $3`,
      [reason, actorName(req), salesId]
    );
    await addLog(client, actorName(req), salesId, 'SALES_CANCEL', `Pembatalan transaksi ${salesId}: ${reason}`);
  });

  return res.json({ status: 1, message: `Transaksi ${salesId} berhasil dibatalkan dan stok telah dikembalikan` });
});

const checkoutSales = asyncHandler(async (req, res) => {
  const data = req.body || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const diskon = Number(data.diskon || 0);
  const metodePembayaran = String(data.metode_pembayaran || '').trim();
  const bayarInput = Number(data.bayar || 0);

  if (items.length === 0) return res.json({ status: 2, message: 'Daftar belanja masih kosong' });
  if (Number.isNaN(diskon) || diskon < 0) return res.json({ status: 2, message: 'Diskon tidak valid' });
  if (!metodePembayaran) return res.json({ status: 2, message: 'Metode pembayaran wajib dipilih' });
  if (Number.isNaN(bayarInput) || bayarInput < 0) return res.json({ status: 2, message: 'Nominal pembayaran tidak valid' });

  let salesId;
  let receiptItems = [];
  let subtotal = 0;

  await withTransaction(async (client) => {
    const nomor = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'sales' FOR UPDATE");
    const currentNumber = nomor.rows[0]?.nomor || 1;
    if (!nomor.rows[0]) await client.query("INSERT INTO penomoran (kategori, nomor) VALUES ('sales', 1)");

    salesId = nextId('T', currentNumber);

    for (const cartItem of items) {
      const itemId = cartItem.item_id;
      const qty = Number(cartItem.qty || 0);
      if (!itemId || Number.isNaN(qty) || qty <= 0) throw new Error('Qty transaksi tidak valid');

      const item = await client.query('SELECT item_id, nama, stok, harga FROM inventory_items WHERE item_id = $1 AND is_aktif = true FOR UPDATE', [itemId]);
      if (!item.rows[0]) throw new Error(`Barang ${itemId} tidak ditemukan`);

      const row = item.rows[0];
      const stokSebelum = Number(row.stok || 0);
      const harga = Number(row.harga || 0);
      if (stokSebelum < qty) throw new Error(`Stok ${row.nama} tidak mencukupi`);

      const stokSesudah = stokSebelum - qty;
      const lineSubtotal = qty * harga;
      subtotal += lineSubtotal;

      await client.query('UPDATE inventory_items SET stok = $1, updated_at = NOW() WHERE item_id = $2', [stokSesudah, itemId]);
      await client.query(
        `INSERT INTO inventory_transactions (item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan)
         VALUES ($1, 'KELUAR', $2, $3, $4, $5, $6)`,
        [itemId, qty, harga, stokSebelum, stokSesudah, `Transaksi ${salesId}`]
      );

      receiptItems.push({ item_id: itemId, nama: row.nama, qty, harga, subtotal: lineSubtotal });
    }

    const total = Math.max(0, subtotal - diskon);
    const bayar = metodePembayaran === 'Cash' ? bayarInput : (bayarInput || total);
    if (bayar < total) {
      const error = new Error(`Pembayaran kurang Rp ${(total - bayar).toLocaleString('id-ID')}`);
      error.statusCode = 400;
      throw error;
    }
    const kembalian = Math.max(0, bayar - total);
    await client.query(
      'INSERT INTO sales_orders (sales_id, subtotal, diskon, total, bayar, kembalian, metode_pembayaran) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [salesId, subtotal, diskon, total, bayar, kembalian, metodePembayaran]
    );

    for (const item of receiptItems) {
      await client.query(
        'INSERT INTO sales_order_items (sales_id, item_id, qty, harga, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [salesId, item.item_id, item.qty, item.harga, item.subtotal]
      );
    }

    await client.query("UPDATE penomoran SET nomor = $1, updated_at = NOW() WHERE kategori = 'sales'", [currentNumber + 1]);
    await addLog(client, actorName(req), salesId, 'SALES', `Transaksi penjualan ${salesId}`);
  });

  return res.json({
    status: 1,
    message: `Transaksi ${salesId} berhasil`,
    receipt: {
      sales_id: salesId,
      items: receiptItems,
      subtotal,
      diskon,
      total: Math.max(0, subtotal - diskon),
      bayar: metodePembayaran === 'Cash' ? bayarInput : (bayarInput || Math.max(0, subtotal - diskon)),
      kembalian: Math.max(0, (metodePembayaran === 'Cash' ? bayarInput : (bayarInput || Math.max(0, subtotal - diskon))) - Math.max(0, subtotal - diskon)),
      metode_pembayaran: metodePembayaran,
    },
  });
});

const departemen = createMasterHandlers({ table: 'departemen', idColumn: 'departemen_id', prefix: 'D', kategori: 'departemen', detailKey: 'departemen', label: 'departemen' });
const jabatan = createMasterHandlers({ table: 'jabatan', idColumn: 'jabatan_id', prefix: 'J', kategori: 'jabatan', detailKey: 'jabatan', label: 'jabatan' });
const grup = createMasterHandlers({ table: 'grup', idColumn: 'grup_id', prefix: 'G', kategori: 'grup', detailKey: 'grup', label: 'grup' });

module.exports = {
  login,
  getUsers,
  getDetailUser,
  addUser,
  updateUser,
  setStatusUser,
  getMenus,
  getHakAkses,
  grantHakAkses,
  updateHakAkses,
  revokeHakAkses,
  getPerusahaan,
  updatePerusahaan,
  getSatuanBarang,
  getDetailSatuanBarang,
  addSatuanBarang,
  updateSatuanBarang,
  deleteSatuanBarang,
  getKategoriBarang,
  getDetailKategoriBarang,
  addKategoriBarang,
  updateKategoriBarang,
  deleteKategoriBarang,
  getInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  updateInventoryPrice,
  addInventoryTransaction,
  addInventoryIssue,
  approveInventoryIssue,
  getInventoryIssue,
  getInventoryIssues,
  addBulkInventoryIncoming,
  addStockOpname,
  addBulkStockOpname,
  getInventoryReasons,
  addInventoryReason,
  updateInventoryReason,
  updateRestockPlan,
  getInventoryHistory,
  getDashboardSummary,
  getReport,
  getBackup,
  getSalesOrders,
  getSalesOrderDetail,
  cancelSalesOrder,
  checkoutSales,
  departemen,
  jabatan,
  grup,
};
