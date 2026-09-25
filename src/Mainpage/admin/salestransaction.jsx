import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Barcode, History, Loader2, Minus, PackageOpen, Plus, Printer, ReceiptText, Search, ShoppingCart, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const paymentMethods = ["Cash", "QRIS", "Debit", "Credit", "Transfer"];

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");
const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const SalesTransaction = ({ onBack }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [cart, setCart] = useState([]);
  const [diskon, setDiskon] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const barcodeRef = useRef(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/inventory/items", { params: { search: searchTerm, limit: 50, sort: "name" } });
      setItems(response.data.data || []);
    } catch (error) {
      console.error("Gagal memuat barang:", error);
      Swal.fire("Error", "Gagal memuat data barang.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.harga || 0), 0);
    const discount = Math.max(0, Number(diskon || 0));
    const total = Math.max(0, subtotal - discount);
    const paid = Math.max(0, Number(paidAmount || 0));
    return { subtotal, discount, total, paid, change: Math.max(0, paid - total), shortage: Math.max(0, total - paid) };
  }, [cart, diskon, paidAmount]);

  const addItem = (targetItem, targetQty = qty) => {
    const amount = Number(targetQty || 0);
    if (!targetItem) {
      Swal.fire("Barang Tidak Ditemukan", "Scan SKU atau pilih barang dari daftar manual.", "warning");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      Swal.fire("Qty Tidak Valid", "Qty harus lebih dari 0.", "warning");
      return;
    }
    if (Number(targetItem.stok || 0) <= 0) {
      Swal.fire("Stok Kosong", `${targetItem.nama} tidak memiliki stok tersedia.`, "warning");
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.item_id === targetItem.item_id);
      const nextQty = Number(existing?.qty || 0) + amount;
      if (nextQty > Number(targetItem.stok || 0)) {
        Swal.fire("Stok Tidak Cukup", `Stok tersedia hanya ${formatNumber(targetItem.stok)}.`, "warning");
        return current;
      }
      if (existing) {
        return current.map((entry) => (entry.item_id === targetItem.item_id ? { ...entry, qty: nextQty } : entry));
      }
      return [
        ...current,
        {
          item_id: targetItem.item_id,
          nama: targetItem.nama,
          satuan: targetItem.satuan,
          stok: targetItem.stok,
          harga: Number(targetItem.harga || 0),
          kategori: targetItem.kategori,
          qty: amount,
        },
      ];
    });

    setBarcodeInput("");
    setSelectedItemId("");
    setQty("1");
    barcodeRef.current?.focus();
  };

  const submitScan = (event) => {
    event.preventDefault();
    const sku = barcodeInput.trim();
    const found = items.find((item) => item.item_id.toLowerCase() === sku.toLowerCase());
    addItem(found);
  };

  const submitManual = (event) => {
    event.preventDefault();
    const found = items.find((item) => item.item_id === selectedItemId);
    addItem(found);
  };

  const updateCartQty = (itemId, nextQty) => {
    const amount = Number(nextQty || 0);
    setCart((current) =>
      current
        .map((item) => {
          if (item.item_id !== itemId) return item;
          return { ...item, qty: Math.min(Math.max(amount, 1), Number(item.stok || 1)) };
        })
        .filter((item) => Number(item.qty || 0) > 0)
    );
  };

  const removeCartItem = (itemId) => {
    setCart((current) => current.filter((item) => item.item_id !== itemId));
  };

  const checkout = async () => {
    if (!cart.length) {
      Swal.fire("Keranjang Kosong", "Tambahkan barang terlebih dahulu.", "warning");
      return;
    }
    if (!paymentMethod) {
      Swal.fire("Pembayaran Belum Dipilih", "Pilih metode pembayaran.", "warning");
      return;
    }
    if (paymentMethod === "Cash" && totals.paid < totals.total) {
      Swal.fire("Pembayaran Kurang", `Kekurangan pembayaran ${formatMoney(totals.shortage)}.`, "warning");
      return;
    }

    setSaving(true);
    try {
      const response = await API.post("/sales/checkout", {
        items: cart.map((item) => ({ item_id: item.item_id, qty: item.qty })),
        diskon: totals.discount,
        metode_pembayaran: paymentMethod,
        bayar: paymentMethod === "Cash" ? totals.paid : totals.total,
        kembalian: paymentMethod === "Cash" ? totals.change : 0,
      });

      if (response.data.status === 1) {
        setReceipt({
          ...response.data.receipt,
          bayar: paymentMethod === "Cash" ? totals.paid : totals.total,
          kembalian: paymentMethod === "Cash" ? totals.change : 0,
        });
        setCart([]);
        setDiskon("");
        setPaidAmount("");
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Transaksi gagal disimpan.", "warning");
      }
    } catch (error) {
      console.error("Gagal checkout:", error);
      Swal.fire("Error", error.response?.data?.message || "Gagal menghubungi server.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        barcodeRef.current?.focus();
      }
      if (event.ctrlKey && event.key === "Enter" && cart.length && !saving) {
        event.preventDefault();
        checkout();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const printReceipt = (targetReceipt = receipt) => {
    if (!targetReceipt) return;
    const rows = (targetReceipt.items || [])
      .map(
        (item) => `
          <tr>
            <td>${item.nama}<br/><span>${item.item_id}</span></td>
            <td class="right">${formatNumber(item.qty)}</td>
            <td class="right">${formatMoney(item.harga)}</td>
            <td class="right">${formatMoney(item.subtotal)}</td>
          </tr>
        `
      )
      .join("");
    const printWindow = window.open("", "_blank", "width=420,height=720");
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk ${targetReceipt.sales_id}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 18px; }
            h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
            .meta { font-size: 12px; color: #4b5563; text-align: center; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { border-bottom: 1px solid #111827; padding: 6px 0; text-align: left; }
            td { border-bottom: 1px dashed #d1d5db; padding: 7px 0; vertical-align: top; }
            td span { color: #6b7280; font-size: 11px; }
            .right { text-align: right; }
            .totals { margin-top: 12px; font-size: 13px; }
            .line { display: flex; justify-content: space-between; margin: 5px 0; }
            .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #111827; padding-top: 8px; }
          </style>
        </head>
        <body>
          <h1>ALKES MEDIKA</h1>
          <div class="meta">${targetReceipt.sales_id} | ${targetReceipt.metode_pembayaran}</div>
          <table>
            <thead><tr><th>Barang</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <section class="totals">
            <div class="line"><span>Subtotal</span><strong>${formatMoney(targetReceipt.subtotal)}</strong></div>
            <div class="line"><span>Diskon</span><strong>${formatMoney(targetReceipt.diskon)}</strong></div>
            <div class="line grand"><span>Total</span><strong>${formatMoney(targetReceipt.total)}</strong></div>
            ${targetReceipt.bayar !== undefined ? `<div class="line"><span>Bayar</span><strong>${formatMoney(targetReceipt.bayar)}</strong></div><div class="line"><span>Kembalian</span><strong>${formatMoney(targetReceipt.kembalian)}</strong></div>` : ''}
          </section>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const fetchSalesHistory = async (search = historySearch) => {
    setHistoryLoading(true);
    try {
      const response = await API.get("/sales/orders", { params: { search, limit: 50 } });
      setSalesHistory(response.data.data || []);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Gagal memuat riwayat transaksi.", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    fetchSalesHistory("");
  };

  const openHistoryReceipt = async (salesId) => {
    try {
      const response = await API.get(`/sales/orders/${encodeURIComponent(salesId)}`);
      setReceipt(response.data.receipt);
      setShowHistory(false);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Detail transaksi tidak ditemukan.", "error");
    }
  };

  const cancelOrder = async (order) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Batalkan ${order.sales_id}?`,
      html: "Stok seluruh barang akan dikembalikan. Tindakan ini tidak dapat dibatalkan kembali.",
      input: "textarea",
      inputLabel: "Alasan pembatalan",
      inputPlaceholder: "Contoh: pelanggan membatalkan pembelian",
      inputAttributes: { maxlength: "500" },
      showCancelButton: true,
      confirmButtonText: "Batalkan Transaksi",
      cancelButtonText: "Kembali",
      confirmButtonColor: "#dc2626",
      inputValidator: (value) => value.trim().length < 5 ? "Alasan minimal 5 karakter." : undefined,
    });
    if (!result.isConfirmed) return;
    try {
      const response = await API.post(`/sales/orders/${encodeURIComponent(order.sales_id)}/cancel`, { reason: result.value.trim() });
      await Swal.fire("Berhasil", response.data.message, "success");
      fetchSalesHistory();
      fetchItems();
    } catch (error) {
      Swal.fire("Gagal Membatalkan", error.response?.data?.message || "Terjadi kesalahan saat membatalkan transaksi.", "error");
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/68 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-md sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/90 bg-gradient-to-r from-white/85 via-blue-50/70 to-cyan-50/60 p-5 shadow-sm backdrop-blur-lg lg:flex-row lg:items-end lg:justify-between sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <ShoppingCart size={16} />
              Inventory Sales
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Transaksi Penjualan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Scan SKU, cek barang, simpan transaksi, stok otomatis berkurang, lalu cetak struk.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-400">Shortcut: F2 fokus scanner · Ctrl + Enter checkout</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openHistory} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><History size={17} /> Riwayat</button>
            <button onClick={() => onBack?.("inventory")} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:shadow-md">Kembali Inventory</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/90 bg-white/82 p-5 shadow-sm backdrop-blur-lg">
              <h2 className="text-lg font-bold text-slate-950">Input Barang</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <form onSubmit={submitScan} className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-700">Scan / Input SKU</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input
                        ref={barcodeRef}
                        value={barcodeInput}
                        onChange={(event) => setBarcodeInput(event.target.value)}
                        placeholder="Contoh: I00001"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                    <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
                      Tambah
                    </button>
                  </div>
                </form>

                <form onSubmit={submitManual} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Cari Manual</label>
                  <div className="grid grid-cols-[1fr_88px_auto] gap-2">
                    <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                      <option value="">Pilih barang</option>
                      {items.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_id} - {item.nama}
                        </option>
                      ))}
                    </select>
                    <input value={qty} onChange={(event) => setQty(event.target.value)} type="number" min="1" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                      <Plus size={17} />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/90 bg-white/88 shadow-sm backdrop-blur-lg">
              <div className="border-b border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Daftar Barang</h2>
                    <p className="mt-1 text-sm text-slate-500">Gunakan pencarian ini jika SKU tidak terbaca scanner.</p>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari kode atau nama barang..." className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                    {searchTerm && (
                      <button type="button" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)
                ) : items.length > 0 ? (
                  items.map((item) => (
                    <article key={item.item_id} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
                      <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-teal-50 to-sky-50">
                        {item.gambar_url ? <img src={item.gambar_url} alt={item.nama} className="h-full w-full object-cover" /> : <PackageOpen className="text-teal-600" size={36} />}
                        <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${Number(item.stok) <= 0 ? "bg-red-100 text-red-700" : Number(item.stok) <= Number(item.minimum_stock) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>Stok {formatNumber(item.stok)}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">{item.nama}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.merek || item.kategori || "Produk medis"}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{item.item_id} · Batch {item.nomor_batch || "-"}</p>
                        {item.tanggal_kedaluwarsa && <p className="mt-1 text-[11px] font-semibold text-amber-700">Exp {item.tanggal_kedaluwarsa}</p>}
                        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                          <p className="font-bold text-teal-700">{formatMoney(item.harga)}</p>
                          <button onClick={() => addItem(item, 1)} disabled={Number(item.stok) <= 0} aria-label={`Tambahkan ${item.nama}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                            <Plus size={14} /> Tambah
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="col-span-full py-14 text-center">
                    <PackageOpen className="mx-auto text-teal-600" size={38} />
                    <p className="mt-3 font-bold text-slate-800">Produk tidak ditemukan</p>
                    <p className="mt-1 text-sm text-slate-500">Coba kata kunci lain atau tambahkan produk dari Master Barang.</p>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className="overflow-hidden rounded-2xl border border-white/90 bg-white/92 shadow-xl shadow-blue-900/10 backdrop-blur-xl xl:sticky xl:top-24 xl:self-start">
            <div className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <ReceiptText size={18} />
                Daftar Belanja
              </h2>
            </div>
            <div className="max-h-[360px] divide-y divide-slate-100 overflow-auto">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.item_id} className="p-4">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-950">{item.nama}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{item.item_id}</p>
                      </div>
                      <button onClick={() => removeCartItem(item.item_id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
                        <button onClick={() => updateCartQty(item.item_id, Number(item.qty) - 1)} className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50">
                          <Minus size={14} />
                        </button>
                        <input value={item.qty} onChange={(event) => updateCartQty(item.item_id, event.target.value)} className="h-8 w-12 border-x border-slate-200 text-center text-sm font-semibold outline-none" />
                        <button onClick={() => updateCartQty(item.item_id, Number(item.qty) + 1)} className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50">
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-950">{formatMoney(Number(item.qty) * Number(item.harga))}</p>
                        <p className="text-xs text-slate-500">{formatMoney(item.harga)} / item</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">Keranjang masih kosong.</div>
              )}
            </div>
            <div className="space-y-4 border-t border-slate-200 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Diskon</label>
                <input value={diskon} onChange={(event) => setDiskon(event.target.value)} type="number" min="0" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Metode Pembayaran</label>
                <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPaidAmount(""); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              {paymentMethod === "Cash" && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Uang Diterima</label>
                  <input value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} type="number" min="0" placeholder="Masukkan nominal pembayaran" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[totals.total, 50000, 100000].filter((value, index, values) => value > 0 && values.indexOf(value) === index).map((value) => (
                      <button key={value} type="button" onClick={() => setPaidAmount(String(value))} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">{value === totals.total ? "Uang Pas" : formatMoney(value)}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                <div className="flex justify-between text-slate-600"><span>Diskon</span><strong>{formatMoney(totals.discount)}</strong></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-950"><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
                {paymentMethod === "Cash" && <div className={`flex justify-between border-t border-blue-100 pt-3 font-bold ${totals.shortage > 0 ? "text-amber-700" : "text-emerald-700"}`}><span>{totals.shortage > 0 ? "Kekurangan" : "Kembalian"}</span><strong>{formatMoney(totals.shortage || totals.change)}</strong></div>}
              </div>
              <button onClick={checkout} disabled={saving || !cart.length} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
                {saving ? <Loader2 size={17} className="animate-spin" /> : <ReceiptText size={17} />}
                Simpan & Cetak Struk
              </button>
            </div>
          </aside>
        </div>
      </section>

      {showHistory && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div><h3 className="font-bold text-slate-900">Riwayat Transaksi</h3><p className="mt-1 text-xs text-slate-500">Pilih transaksi untuk melihat dan mencetak ulang struk.</p></div>
              <button type="button" onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); fetchSalesHistory(); }} className="flex gap-2 border-b border-slate-100 p-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Cari ID transaksi atau metode pembayaran..." className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <button className="rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Cari</button>
            </form>
            <div className="max-h-[520px] overflow-auto">
              {historyLoading ? <div className="p-12 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></div> : salesHistory.length ? (
                <div className="divide-y divide-slate-100">{salesHistory.map((order) => (
                  <div key={order.sales_id} className="flex items-center gap-3 p-4 transition hover:bg-blue-50/60">
                    <button type="button" onClick={() => openHistoryReceipt(order.sales_id)} className="min-w-0 flex-1 text-left">
                    <div><p className="font-mono text-sm font-bold text-slate-900">{order.sales_id}</p><p className="mt-1 text-xs text-slate-500">{order.created_at} · {order.metode_pembayaran} · {formatNumber(order.total_qty)} item</p></div>
                    </button>
                    <p className={`whitespace-nowrap font-bold ${order.status === "BATAL" ? "text-slate-400 line-through" : "text-blue-700"}`}>{formatMoney(order.total)}</p>
                    {order.status !== "BATAL" && <button type="button" onClick={() => cancelOrder(order)} title="Batalkan transaksi" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"><Ban size={16} /></button>}
                  </div>
                ))}</div>
              ) : <div className="p-12 text-center text-sm text-slate-500">Riwayat transaksi tidak ditemukan.</div>}
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${receipt.status === "BATAL" ? "text-red-700" : "text-gray-700"}`}>{receipt.status === "BATAL" ? "Transaksi Dibatalkan" : "Detail Transaksi"}</h3>
                <p className="mt-1 text-xs text-gray-400">{receipt.sales_id}</p>
              </div>
              <button type="button" onClick={() => setReceipt(null)} className="text-gray-400 transition hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                {receipt.status === "BATAL" && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700"><strong>Alasan:</strong> {receipt.cancel_reason || "-"}</div>}
                <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(receipt.subtotal)}</strong></div>
                <div className="mt-2 flex justify-between"><span>Diskon</span><strong>{formatMoney(receipt.diskon)}</strong></div>
                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><span>Total</span><strong>{formatMoney(receipt.total)}</strong></div>
                {receipt.bayar !== undefined && <><div className="mt-2 flex justify-between text-emerald-700"><span>Bayar</span><strong>{formatMoney(receipt.bayar)}</strong></div><div className="mt-2 flex justify-between font-bold text-emerald-700"><span>Kembalian</span><strong>{formatMoney(receipt.kembalian)}</strong></div></>}
              </div>
              <button onClick={() => printReceipt(receipt)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800">
                <Printer size={17} />
                Print Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default SalesTransaction;
