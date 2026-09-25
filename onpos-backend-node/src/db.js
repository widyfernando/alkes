const { Pool } = require('pg');
const modalInventory = require('./data/modalInventory.json');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
let connectionHost = '';
try {
  connectionHost = connectionString ? new URL(connectionString).hostname : '';
} catch (_error) {
  connectionHost = '';
}
const databaseHost = process.env.DB_HOST || connectionHost;
const isSupabaseHost = databaseHost.endsWith('.supabase.com');
const isSupabaseSharedPooler = databaseHost.endsWith('.pooler.supabase.com');
const useSsl = process.env.DATABASE_SSL === 'true' || isSupabaseHost;
const supabaseProjectRef = process.env.SUPABASE_PROJECT_REF || '';
const databaseUser = isSupabaseSharedPooler
  ? `postgres.${supabaseProjectRef}`
  : (process.env.DB_USER || 'postgres');
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED
  ? process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
  : !isSupabaseSharedPooler;

let normalizedConnectionString = connectionString;
if (connectionString && useSsl) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.delete('sslrootcert');
  normalizedConnectionString = url.toString();
}

const connection = normalizedConnectionString
  ? { connectionString: normalizedConnectionString }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5433),
      database: process.env.DB_NAME || 'onpos',
      user: databaseUser,
      password: process.env.DB_PASSWORD || 'password',
    };

const pool = new Pool({
  ...connection,
  ssl: useSsl ? { rejectUnauthorized } : undefined,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10000),
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC(14, 2) NOT NULL DEFAULT 5");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS merek VARCHAR(80) NOT NULL DEFAULT ''");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS principal VARCHAR(120) NOT NULL DEFAULT ''");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS nomor_izin_edar VARCHAR(100) NOT NULL DEFAULT ''");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS nomor_batch VARCHAR(80) NOT NULL DEFAULT ''");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tanggal_kedaluwarsa DATE");
  await query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS gambar_url TEXT NOT NULL DEFAULT ''");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS bayar NUMERIC(14, 2)");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS kembalian NUMERIC(14, 2)");
  await query("UPDATE sales_orders SET bayar = total WHERE bayar IS NULL");
  await query("UPDATE sales_orders SET kembalian = 0 WHERE kembalian IS NULL");
  await query("ALTER TABLE sales_orders ALTER COLUMN bayar SET NOT NULL");
  await query("ALTER TABLE sales_orders ALTER COLUMN kembalian SET NOT NULL");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SELESAI'");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100)");
  await query("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT");
  // Alkes starts with its own clean inventory; legacy BikeStore import is intentionally disabled.
  const menus = [
    ['M00001', 'Administration', '', 'M00001'],
    ['M00002', 'Dashboard', 'dashboard', 'M00002'],
    ['M00028', 'Inventory', 'inventory', 'M00028'],
    ['M00010', 'Master Barang', 'master-barang', 'M00028'],
    ['M00027', 'Master Kategori Barang', 'master-kategori-barang', 'M00028'],
    ['M00016', 'Master Satuan Barang', 'master-satuan-barang', 'M00028'],
    ['M00029', 'Stock Opname', 'stock-opname', 'M00028'],
    ['M00030', 'Transaksi Penjualan', 'transaksi-penjualan', 'M00030'],
['M00036', 'Pembelian Barang', 'purchases', 'M00036'],
    ['M00031', 'Report', 'reports', 'M00031'],
    ['M00032', 'Settings', 'settings', 'M00032'],
    ['M00003', 'Otoritas Menu Pengguna', 'otoritas', 'M00032'],
    ['M00005', 'Master Group User', 'master-group', 'M00032'],
    ['M00004', 'Pengaturan Pengguna', 'pengaturan-pengguna', 'M00032'],
    ['M00033', 'Master Users', 'master-users', 'M00001'],
    ['M00034', 'Master Departemen', 'master-departemen', 'M00032'],
    ['M00035', 'Master Jabatan', 'master-jabatan', 'M00032'],
  ];
  const activeMenuIds = menus.map(([menuId]) => menuId);

  for (const [menuId, nama, path, parentId] of menus) {
    await query(
      `INSERT INTO menu (menu_id, nama, path, parent_id, is_aktif)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (menu_id) DO UPDATE SET nama = EXCLUDED.nama, path = EXCLUDED.path, parent_id = EXCLUDED.parent_id, is_aktif = true`,
      [menuId, nama, path, parentId]
    );
  }

  // Admin default diberi akses ke seluruh menu aktif supaya akun bootstrap tetap lengkap.
  for (const [menuId] of menus) {
    await query(
      `INSERT INTO hak_akses (grup_id, menu_item_id, granted)
       VALUES ('G00006', $1, true)
       ON CONFLICT (grup_id, menu_item_id)
       DO UPDATE SET granted = true`,
      [menuId]
    );
  }

  await query(
    `UPDATE menu
        SET is_aktif = false, updated_at = NOW()
      WHERE menu_id <> ALL($1::varchar[])`,
    [activeMenuIds]
  );
}

async function importProductionModalInventory() {
  if (process.env.NODE_ENV !== 'production') return;

  const migrationId = '20260823_modal_inventory_v1';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [20260823]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_data_migrations (
        migration_id VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const applied = await client.query(
      'SELECT 1 FROM app_data_migrations WHERE migration_id = $1',
      [migrationId]
    );
    if (applied.rowCount > 0) {
      await client.query('COMMIT');
      return;
    }

    await client.query('DELETE FROM sales_order_items');
    await client.query('DELETE FROM sales_orders');
    await client.query('DELETE FROM inventory_price_history');
    await client.query('DELETE FROM inventory_transactions');
    await client.query('DELETE FROM inventory_items');

    const unit = await client.query("SELECT 1 FROM satuan_barang WHERE satuan_id = 'S00001'");
    if (unit.rowCount === 0) {
      await client.query(
        "INSERT INTO satuan_barang (satuan_id, nama, keterangan) VALUES ('S00001', 'PCS', 'Pieces / satuan unit')"
      );
    }

    for (let offset = 0; offset < modalInventory.length; offset += 100) {
      const batch = modalInventory.slice(offset, offset + 100);
      const values = [];
      const placeholders = batch.map((item, index) => {
        const base = index * 4;
        values.push(item.item_id, item.nama, item.harga_modal, item.harga);
        return `($${base + 1}, $${base + 2}, 'S00001', NULL, '', 0, $${base + 3}, $${base + 4}, 5, true)`;
      });
      await client.query(
        `INSERT INTO inventory_items
          (item_id, nama, satuan_id, kategori_id, locator, stok, harga_modal, harga, minimum_stock, is_aktif)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await client.query('INSERT INTO app_data_migrations (migration_id) VALUES ($1)', [migrationId]);
    await client.query('COMMIT');
    console.log(`Production modal inventory imported: ${modalInventory.length} items`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction, ensureSchema };
