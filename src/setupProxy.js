const { createProxyMiddleware } = require('http-proxy-middleware');

const apiPaths = [
  '/health',
  '/dashboard',
  '/monitoring',
  '/reports',
  '/backup',
  '/login',
  '/user',
  '/detail_user',
  '/set_status_user',
  '/reset_password',
  '/menu',
  '/hak_akses',
  '/perusahaan',
  '/departemen',
  '/detail_departemen',
  '/jabatan',
  '/detail_jabatan',
  '/grup',
  '/detail_grup',
  '/satuan_barang',
  '/detail_satuan_barang',
  '/kategori_barang',
  '/detail_kategori_barang',
  '/inventory',
  '/sales',
  '/purchases',
];

module.exports = function setupProxy(app) {
  app.use(
    apiPaths,
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
    })
  );
};
