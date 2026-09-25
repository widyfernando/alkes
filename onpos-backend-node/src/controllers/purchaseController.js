const { query, withTransaction } = require('../db');
const { nextId } = require('../utils/helpers');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function normalizePurchase(body = {}) {
  const supplier = String(body.supplier_name || '').trim();
  const sourceItems = Array.isArray(body.items) ? body.items : [];
  if (!supplier || !sourceItems.length) {
    throw Object.assign(new Error('Supplier dan item wajib diisi'), { statusCode: 400 });
  }

  let total = 0;
  const items = sourceItems.map((entry) => {
    const itemId = String(entry.item_id || '').trim();
    const qty = Number(entry.qty);
    const unitCost = Number(entry.unit_cost);
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      throw Object.assign(new Error('Item pembelian tidak valid'), { statusCode: 400 });
    }
    total += qty * unitCost;
    return { itemId, qty, unitCost };
  });

  return {
    supplier,
    invoiceNumber: String(body.invoice_number || '').trim(),
    purchaseDate: body.purchase_date || new Date().toISOString().slice(0, 10),
    notes: String(body.notes || '').trim(),
    items,
    total,
  };
}

const list = wrap(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const search = String(req.query.search || '').trim();
  const values = [];
  const where = ['1=1'];
  if (search) {
    values.push(`%${search}%`);
    where.push(`(p.purchase_id ILIKE $${values.length} OR p.supplier_name ILIKE $${values.length} OR p.invoice_number ILIKE $${values.length})`);
  }
  const clause = ` WHERE ${where.join(' AND ')}`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM purchases p${clause}`, values);
  values.push(10, (page - 1) * 10);
  const rows = await query(
    `SELECT p.*, COUNT(pi.purchase_item_id)::int AS item_count
       FROM purchases p
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.purchase_id
       ${clause}
      GROUP BY p.purchase_id
      ORDER BY p.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const total = Number(count.rows[0]?.total || 0);
  res.json({ status: 1, data: rows.rows, total, page, total_pages: Math.max(Math.ceil(total / 10), 1) });
});

const detail = wrap(async (req, res) => {
  const purchase = await query('SELECT * FROM purchases WHERE purchase_id = $1', [req.params.purchaseId]);
  if (!purchase.rows[0]) throw Object.assign(new Error('Pembelian tidak ditemukan'), { statusCode: 404 });
  const items = await query(
    `SELECT pi.purchase_item_id, pi.item_id, pi.qty, pi.unit_cost, pi.subtotal, i.nama
       FROM purchase_items pi
       JOIN inventory_items i ON i.item_id = pi.item_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.purchase_item_id`,
    [req.params.purchaseId]
  );
  res.json({ status: 1, data: { ...purchase.rows[0], items: items.rows } });
});

const create = wrap(async (req, res) => {
  const data = normalizePurchase(req.body);
  let id;
  await withTransaction(async (client) => {
    const numbering = await client.query("SELECT nomor FROM penomoran WHERE kategori = 'pembelian' FOR UPDATE");
    const current = Number(numbering.rows[0]?.nomor || 1);
    id = nextId('PB', current);
    if (numbering.rows[0]) await client.query("UPDATE penomoran SET nomor = $1 WHERE kategori = 'pembelian'", [current + 1]);
    else await client.query("INSERT INTO penomoran(kategori, nomor) VALUES('pembelian', $1)", [current + 1]);

    await client.query(
      `INSERT INTO purchases(purchase_id, supplier_name, invoice_number, purchase_date, notes, total, created_by)
       VALUES($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.supplier, data.invoiceNumber, data.purchaseDate, data.notes, data.total, req.user?.nama || 'SYSTEM']
    );
    for (const item of data.items) {
      await client.query(
        'INSERT INTO purchase_items(purchase_id, item_id, qty, unit_cost, subtotal) VALUES($1, $2, $3, $4, $5)',
        [id, item.itemId, item.qty, item.unitCost, item.qty * item.unitCost]
      );
    }
  });
  res.json({ status: 1, message: `Pembelian ${id} dibuat`, purchase_id: id });
});

const update = wrap(async (req, res) => {
  const id = req.params.purchaseId;
  const data = normalizePurchase(req.body);
  await withTransaction(async (client) => {
    const current = await client.query('SELECT status FROM purchases WHERE purchase_id = $1 FOR UPDATE', [id]);
    if (!current.rows[0]) throw Object.assign(new Error('Pembelian tidak ditemukan'), { statusCode: 404 });
    if (current.rows[0].status !== 'DRAFT') throw Object.assign(new Error('Hanya pembelian DRAFT yang dapat diedit'), { statusCode: 409 });
    await client.query(
      `UPDATE purchases SET supplier_name = $1, invoice_number = $2, purchase_date = $3, notes = $4, total = $5, updated_at = NOW()
        WHERE purchase_id = $6`,
      [data.supplier, data.invoiceNumber, data.purchaseDate, data.notes, data.total, id]
    );
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const item of data.items) {
      await client.query(
        'INSERT INTO purchase_items(purchase_id, item_id, qty, unit_cost, subtotal) VALUES($1, $2, $3, $4, $5)',
        [id, item.itemId, item.qty, item.unitCost, item.qty * item.unitCost]
      );
    }
  });
  res.json({ status: 1, message: `Pembelian ${id} berhasil diperbarui` });
});

const remove = wrap(async (req, res) => {
  const id = req.params.purchaseId;
  await withTransaction(async (client) => {
    const current = await client.query('SELECT status FROM purchases WHERE purchase_id = $1 FOR UPDATE', [id]);
    if (!current.rows[0]) throw Object.assign(new Error('Pembelian tidak ditemukan'), { statusCode: 404 });
    if (current.rows[0].status !== 'DRAFT') throw Object.assign(new Error('Hanya pembelian DRAFT yang dapat dihapus'), { statusCode: 409 });
    await client.query('DELETE FROM purchases WHERE purchase_id = $1', [id]);
  });
  res.json({ status: 1, message: `Pembelian ${id} berhasil dihapus` });
});

const receive = wrap(async (req, res) => {
  const id = req.params.purchaseId;
  await withTransaction(async (client) => {
    const purchase = await client.query('SELECT status FROM purchases WHERE purchase_id = $1 FOR UPDATE', [id]);
    if (!purchase.rows[0] || purchase.rows[0].status !== 'DRAFT') {
      throw Object.assign(new Error('Pembelian tidak valid atau sudah diproses'), { statusCode: 409 });
    }
    const lines = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const line of lines.rows) {
      const stock = await client.query('SELECT stok FROM inventory_items WHERE item_id = $1 FOR UPDATE', [line.item_id]);
      const before = Number(stock.rows[0].stok);
      const after = before + Number(line.qty);
      await client.query('UPDATE inventory_items SET stok = $1, harga_modal = $2, updated_at = NOW() WHERE item_id = $3', [after, line.unit_cost, line.item_id]);
      await client.query(
        "INSERT INTO inventory_transactions(item_id, tipe, qty, harga, stok_sebelum, stok_sesudah, catatan) VALUES($1, 'MASUK', $2, $3, $4, $5, $6)",
        [line.item_id, line.qty, line.unit_cost, before, after, `Penerimaan ${id}`]
      );
    }
    await client.query("UPDATE purchases SET status = 'RECEIVED', received_at = NOW(), updated_at = NOW() WHERE purchase_id = $1", [id]);
  });
  res.json({ status: 1, message: 'Pembelian diterima; stok bertambah' });
});

module.exports = { list, detail, create, update, remove, receive };