require('dotenv').config();

const { withTransaction, pool } = require('./db');
const { generateWerkzeugScryptHash } = require('./utils/security');

const departemen = [
  ['D00001', 'PPIC'],
  ['D00002', 'IT'],
  ['D00003', 'Marketing'],
  ['D00004', 'Finance'],
  ['D00005', 'Warehouse'],
  ['D00006', 'HCGA'],
];

const jabatan = [
  ['J00001', 'Manajer'],
  ['J00002', 'Supervisor'],
  ['J00003', 'Leader'],
  ['J00004', 'Operator'],
  ['J00005', 'Staff'],
  ['J00006', 'CEO'],
  ['J00007', 'HOC'],
  ['J00008', 'WHL'],
  ['J00009', 'PJT'],
  ['J00010', 'GA'],
  ['J00011', 'ACC'],
];

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

async function seed() {
  await withTransaction(async (client) => {
    for (const [id, nama] of departemen) {
      await client.query('INSERT INTO departemen (departemen_id, nama) VALUES ($1, $2) ON CONFLICT (departemen_id) DO NOTHING', [id, nama]);
    }

    for (const [id, nama] of jabatan) {
      await client.query('INSERT INTO jabatan (jabatan_id, nama) VALUES ($1, $2) ON CONFLICT (jabatan_id) DO NOTHING', [id, nama]);
    }

    for (let index = 1; index <= 30; index += 1) {
      const id = `G${String(index).padStart(5, '0')}`;
      const groupName = id === 'G00006' ? 'Super Akses' : id === 'G00007' ? 'User / Admin' : `GRUP_${index}`;
      await client.query('INSERT INTO grup (grup_id, nama) VALUES ($1, $2) ON CONFLICT (grup_id) DO UPDATE SET nama = EXCLUDED.nama', [id, groupName]);
    }

    for (const [menuId, nama, path, parentId] of menus) {
      await client.query(
        `INSERT INTO menu (menu_id, nama, path, parent_id, is_aktif)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (menu_id) DO UPDATE SET nama = EXCLUDED.nama, path = EXCLUDED.path, parent_id = EXCLUDED.parent_id, is_aktif = true`,
        [menuId, nama, path, parentId]
      );
    }

    for (const [menuId] of menus) {
      await client.query(
        `INSERT INTO hak_akses (grup_id, menu_item_id, granted)
         VALUES ('G00006', $1, true)
         ON CONFLICT (grup_id, menu_item_id)
         DO UPDATE SET granted = true`,
        [menuId]
      );
    }

    const userAdminPaths = ['dashboard', 'inventory', 'master-barang', 'master-kategori-barang', 'master-satuan-barang', 'stock-opname', 'purchases', 'reports'];
    await client.query(
      `INSERT INTO hak_akses (grup_id, menu_item_id, granted)
       SELECT 'G00007', menu_id, true FROM menu WHERE path = ANY($1)
       ON CONFLICT (grup_id, menu_item_id) DO UPDATE SET granted = true`,
      [userAdminPaths]
    );
    await client.query(
      `INSERT INTO users (user_id, username, nama, password, email, is_aktif, grup_id, dept_id, jabatan_id)
       VALUES ('U_ADMIN', 'admin123', 'Admin', $1, 'admin@gmail.com', true, 'G00006', 'D00002', 'J00001')
       ON CONFLICT (user_id) DO NOTHING`,
      [generateWerkzeugScryptHash('admin123')]
    );

    const applicationUsers = [
      ['U00002', 'vania', 'Vania', 'vania@panamed.co.id', 'G00006', 'D00006', 'J00006', true],
      ['U00001', 'eka', 'Eka', 'eka@panamed.co.id', 'G00006', 'D00006', 'J00007', true],
      ['U00003', 'evita', 'Evita', 'evita@panamed.co.id', 'G00007', 'D00005', 'J00008', false],
      ['U00004', 'novita', 'Novita', 'novita@panamed.co.id', 'G00007', 'D00001', 'J00009', true],
      ['U00005', 'yenny', 'Yenny', 'yenny@panamed.co.id', 'G00007', 'D00006', 'J00010', false],
      ['U00006', 'evan', 'Evan', 'evan@panamed.co.id', 'G00007', 'D00004', 'J00011', false],
    ];
    for (const [id, username, nama, email, grupId, deptId, jabatanId, isApprover] of applicationUsers) {
      await client.query(
        `INSERT INTO users (user_id, username, nama, password, email, is_aktif, grup_id, dept_id, jabatan_id, is_approver)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, nama = EXCLUDED.nama,
           email = EXCLUDED.email, is_aktif = true, grup_id = EXCLUDED.grup_id, dept_id = EXCLUDED.dept_id,
           jabatan_id = EXCLUDED.jabatan_id, is_approver = EXCLUDED.is_approver, updated_at = NOW()`,
        [id, username, nama, generateWerkzeugScryptHash(username), email, grupId, deptId, jabatanId, isApprover]
      );
    }
    await client.query(
      `INSERT INTO perusahaan (perusahaan_id, nama, no_izin, alamat, kota, kodepos, telepon, fax, email, pemilik, logo, token)
       VALUES ('P001', 'PT Maju Sejahtera', 'IZN-2025-001', 'Jl. Melati No. 123, Blok A', 'Jakarta', '10220', '0211234567', '0217654321', 'info@maju-sejahtera.co.id', 'Budi Santoso', 'logo_maju_sejahtera.png', 'aktif')
       ON CONFLICT (perusahaan_id) DO NOTHING`
    );

    const penomoran = [
      ['user', 1],
      ['departemen', 7],
      ['jabatan', 6],
      ['grup', 31],
      ['kategori', 1],
    ];
    for (const [kategori, nomor] of penomoran) {
      await client.query(
        `INSERT INTO penomoran (kategori, nomor)
         SELECT $1::varchar, $2::integer
         WHERE NOT EXISTS (SELECT 1 FROM penomoran WHERE kategori = $1::varchar)`,
        [kategori, nomor]
      );
    }
  });
}

if (require.main === module) {
  seed()
    .then(() => console.log('Seeder selesai. Admin: admin123 / admin123'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { seed };
