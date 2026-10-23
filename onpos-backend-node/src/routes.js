const express = require('express');
const jwt = require('jsonwebtoken');
const controller = require('./controllers/coreController');
const purchaseController = require('./controllers/purchaseController');
const Sentry = require('./instrument');
const { query } = require('./db');
const { getSecretKey } = require('./config');

const router = express.Router();
const SECRET_KEY = getSecretKey();

router.use(async (req, _res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET_KEY);
      const user = await query('SELECT user_id, username, nama, grup_id, is_approver FROM users WHERE user_id = $1 AND is_aktif = true', [payload.user_id]);
      req.user = user.rows[0] || null;
      if (!req.user) req.authError = 'Akun sudah tidak aktif atau tidak ditemukan';
    } catch (error) {
      req.user = null;
      req.authError = error?.name === 'TokenExpiredError' ? 'Sesi login sudah kedaluwarsa' : 'Token login tidak valid';
    }
  }
  next();
});

const publicRoutes = [
  ['GET', '/health'],
  ['POST', '/login'],
];

function requiredPages(req) {
  const path = req.path;
  if (path.startsWith('/dashboard')) return ['dashboard'];
  if (path.startsWith('/monitoring')) return ['settings'];
  if (path.startsWith('/reports') || path.startsWith('/backup')) return ['reports'];
  if (path.startsWith('/sales')) return ['transaksi-penjualan'];
  if (path.startsWith('/hak_akses')) return req.method === 'GET' ? [] : ['otoritas'];
  if (path.startsWith('/menu')) return ['settings', 'otoritas'];
  if (path.startsWith('/user') || path.startsWith('/detail_user') || path.startsWith('/set_status_user') || path.startsWith('/reset_password')) return ['pengaturan-pengguna', 'master-users'];
  if (path.startsWith('/grup') || path.startsWith('/detail_grup')) return ['master-group', 'otoritas'];
  if (path.startsWith('/satuan_barang') || path.startsWith('/detail_satuan_barang')) return ['master-satuan-barang'];
  if (path.startsWith('/kategori_barang') || path.startsWith('/detail_kategori_barang')) return ['master-kategori-barang'];
  if (path.startsWith('/inventory/stock-opname')) return ['stock-opname'];
  if (path.startsWith('/inventory/transactions')) return ['inventory'];
  if (path.startsWith('/inventory/items') && req.method === 'GET') return ['inventory', 'master-barang', 'stock-opname', 'transaksi-penjualan'];
  if (path.startsWith('/inventory/items')) return ['master-barang'];
  if (path.startsWith('/inventory')) return ['inventory'];
  if (path.startsWith('/purchases')) return ['purchases', 'inventory'];
  if (path.startsWith('/departemen') || path.startsWith('/detail_departemen')) return ['master-departemen', 'master-users', 'pengaturan-pengguna'];
  if (path.startsWith('/jabatan') || path.startsWith('/detail_jabatan')) return ['master-jabatan', 'master-users', 'pengaturan-pengguna'];
  if (path.startsWith('/perusahaan')) return ['settings'];
  return [];
}

router.use(async (req, res, next) => {
  if (publicRoutes.some(([method, path]) => req.method === method && req.path === path)) return next();
  if (!req.user) return res.status(401).json({ status: 0, message: req.authError || 'Token tidak valid atau sudah kedaluwarsa' });

  const required = requiredPages(req);
  if (!required.length || !req.user.grup_id) return next();
  if (required.includes('dashboard')) return next();

  const grants = await query(
    `SELECT m.path
       FROM hak_akses ha
       JOIN menu m ON m.menu_id = ha.menu_item_id
      WHERE ha.grup_id = $1 AND ha.granted = true AND m.is_aktif = true`,
    [req.user.grup_id]
  );
  if (grants.rowCount === 0) {
    return res.json({ status: 2, message: 'Anda tidak memiliki hak akses untuk menu ini', data: [] });
  }

  const allowed = new Set(grants.rows.map((row) => row.path).filter(Boolean));
  if (required.some((path) => allowed.has(path))) return next();

  return res.json({ status: 2, message: 'Anda tidak memiliki hak akses untuk menu ini', data: [] });
});

router.get('/health', (_req, res) => res.json({ status: 1, message: 'ok' }));
router.get('/dashboard/summary', controller.getDashboardSummary);
router.get('/monitoring/status', (_req, res) => res.json({ status: 1, data: { backend: Boolean(process.env.SENTRY_DSN), environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development' } }));
router.post('/monitoring/test-event', async (req, res) => {
  if (!process.env.SENTRY_DSN) return res.json({ status: 2, message: 'SENTRY_DSN backend belum dikonfigurasi' });
  const eventId = Sentry.captureMessage(`Alkes backend test event by ${req.user?.username || 'unknown'}`, 'info');
  await Sentry.flush(2000);
  return res.json({ status: 1, message: 'Event uji backend dikirim ke Sentry', event_id: eventId });
});
router.get('/reports/:type', controller.getReport);
router.get('/backup', controller.getBackup);

router.post('/login', controller.login);

router.get('/user', controller.getUsers);
router.post('/user', controller.addUser);
router.put('/user', controller.updateUser);
router.get('/detail_user', controller.getDetailUser);
router.put('/set_status_user', controller.setStatusUser);
router.put('/reset_password', controller.updateUser);

router.get('/menu', controller.getMenus);
router.get('/hak_akses', controller.getHakAkses);
router.post('/hak_akses', controller.grantHakAkses);
router.put('/hak_akses', controller.updateHakAkses);
router.delete('/hak_akses', controller.revokeHakAkses);

router.get('/perusahaan', controller.getPerusahaan);
router.put('/perusahaan', controller.updatePerusahaan);

router.get('/departemen', controller.departemen.list);
router.post('/departemen', controller.departemen.add);
router.put('/departemen', controller.departemen.update);
router.get('/detail_departemen', controller.departemen.detail);

router.get('/jabatan', controller.jabatan.list);
router.post('/jabatan', controller.jabatan.add);
router.put('/jabatan', controller.jabatan.update);
router.get('/detail_jabatan', controller.jabatan.detail);

router.get('/grup', controller.grup.list);
router.post('/grup', controller.grup.add);
router.put('/grup', controller.grup.update);
router.get('/detail_grup', controller.grup.detail);

router.get('/satuan_barang', controller.getSatuanBarang);
router.post('/satuan_barang', controller.addSatuanBarang);
router.put('/satuan_barang', controller.updateSatuanBarang);
router.delete('/satuan_barang', controller.deleteSatuanBarang);
router.get('/detail_satuan_barang', controller.getDetailSatuanBarang);

router.get('/kategori_barang', controller.getKategoriBarang);
router.post('/kategori_barang', controller.addKategoriBarang);
router.put('/kategori_barang', controller.updateKategoriBarang);
router.delete('/kategori_barang', controller.deleteKategoriBarang);
router.get('/detail_kategori_barang', controller.getDetailKategoriBarang);

router.get('/inventory/items', controller.getInventoryItems);
router.post('/inventory/items', controller.addInventoryItem);
router.put('/inventory/items', controller.updateInventoryItem);
router.delete('/inventory/items', controller.deleteInventoryItem);
router.put('/inventory/price', controller.updateInventoryPrice);
router.post('/inventory/transactions', controller.addInventoryTransaction);
router.post('/inventory/issues', controller.addInventoryIssue);
router.get('/inventory/issues', controller.getInventoryIssues);
router.get('/inventory/issues/:issueId', controller.getInventoryIssue);
router.post('/inventory/issues/:issueId/approve', controller.approveInventoryIssue);
router.post('/inventory/transactions/bulk-incoming', controller.addBulkInventoryIncoming);
router.post('/inventory/stock-opname', controller.addStockOpname);
router.post('/inventory/stock-opname/bulk', controller.addBulkStockOpname);
router.get('/inventory/history', controller.getInventoryHistory);
router.get('/inventory/reasons', controller.getInventoryReasons);
router.post('/inventory/reasons', controller.addInventoryReason);
router.put('/inventory/reasons/:reasonId', controller.updateInventoryReason);
router.put('/inventory/restock-plan/:itemId', controller.updateRestockPlan);

router.get('/purchases', purchaseController.list);
router.get('/purchases/:purchaseId', purchaseController.detail);
router.post('/purchases', purchaseController.create);
router.put('/purchases/:purchaseId', purchaseController.update);
router.delete('/purchases/:purchaseId', purchaseController.remove);
router.post('/purchases/:purchaseId/receive', purchaseController.receive);

router.get('/sales/orders', controller.getSalesOrders);
router.get('/sales/orders/:salesId', controller.getSalesOrderDetail);
router.post('/sales/orders/:salesId/cancel', controller.cancelSalesOrder);
router.post('/sales/checkout', controller.checkoutSales);

module.exports = router;
