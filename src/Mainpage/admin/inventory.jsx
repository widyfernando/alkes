import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  Download,
  History,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");
const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const transactionInitial = { item_id: "", nama: "", tipe: "MASUK", qty: "", reason_id: "", catatan: "", stok_awal: "", nomor_batch: "", serial_number: "", lots: [] };
const emptySpbLine = () => ({ item_id: "", nama: "", serial_number: "", qty: 1, stok: "", satuan: "", lots: [] });
const emptySpbForm = () => ({ spb_number: "", issue_date: new Date().toISOString().slice(0, 10), recipient: "", destination: "", reason_id: "", notes: "", revision_of: null, items: [emptySpbLine()] });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
};

const csvNumber = (value) => {
  const cleaned = String(value ?? "").trim().replace(/[^0-9,.-]/g, "");
  if (!cleaned) return "";
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "")
    : cleaned.replace(",", ".");
  return Number(normalized);
};

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const barcodeSvg = (value, height = 58) => {
  const text = String(value || "");
  let checksum = 104;
  const codes = [104];

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index) - 32;
    if (code < 0 || code > 95) continue;
    codes.push(code);
    checksum += code * index + code;
  }

  codes.push(checksum % 103, 106);
  let x = 10;
  const bars = [];

  codes.forEach((code) => {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) return;
    [...pattern].forEach((width, index) => {
      const barWidth = Number(width) * 2;
      if (index % 2 === 0) {
        bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#111827" />`);
      }
      x += barWidth;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="${height}" viewBox="0 0 ${x + 10} ${height}">${bars.join("")}</svg>`;
};

const uniqueLocators = (items) => {
  const map = new Map();
  items.forEach((item) => {
    const locator = String(item.locator || "").trim();
    if (!locator || map.has(locator.toLowerCase())) return;
    map.set(locator.toLowerCase(), locator);
  });
  return [...map.values()];
};

const expiryStatus = (date) => {
  if (!date) return null;
  const days = Math.ceil((new Date(date).setHours(23, 59, 59, 999) - Date.now()) / 86400000);
  if (days < 0) return { label: "Kedaluwarsa", className: "bg-red-50 text-red-700 border-red-200" };
  if (days <= 90) return { label: `${days} hari lagi`, className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: new Date(date).toLocaleDateString("id-ID"), className: "bg-teal-50 text-teal-700 border-teal-200" };
};
const stockStatus = (itemOrStock) => {
  const value = Number(typeof itemOrStock === "object" ? itemOrStock.stok : itemOrStock || 0);
  const minimum = Number(typeof itemOrStock === "object" ? itemOrStock.minimum_stock ?? 5 : 5);
  if (value <= 0) return { label: "Kosong", className: "bg-red-50 text-red-700 border-red-200", rowClass: "bg-red-50/40 hover:bg-red-50" };
  if (value <= minimum) return { label: "Mau Habis", className: "bg-amber-50 text-amber-700 border-amber-200", rowClass: "bg-amber-50/40 hover:bg-amber-50" };
  return { label: "Aman", className: "bg-emerald-50 text-emerald-700 border-emerald-200", rowClass: "hover:bg-blue-50/40" };
};

const Inventory = ({ issueMode = false }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [transactionModal, setTransactionModal] = useState(null);
  const [transactionForm, setTransactionForm] = useState(transactionInitial);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyData, setHistoryData] = useState({ transactions: [], prices: [] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total_items: 0, total_stok: 0, total_nilai: 0, stok_rendah: 0, stok_kosong: 0 });
  const [reasons, setReasons] = useState([]);
  const [spbModal, setSpbModal] = useState(false);
  const [spbForm, setSpbForm] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("alkes_spb_draft") || "null");
      return draft?.items?.length ? draft : emptySpbForm();
    } catch (_error) {
      return emptySpbForm();
    }
  });
  const [issueHistoryOpen, setIssueHistoryOpen] = useState(false);
  const [issueHistory, setIssueHistory] = useState([]);
  const [issueHistoryLoading, setIssueHistoryLoading] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [issuePage, setIssuePage] = useState(1);
  const [issueTotalPages, setIssueTotalPages] = useState(1);
  const [issueTotal, setIssueTotal] = useState(0);
  const [spbSaving, setSpbSaving] = useState(false);

  const fetchReasons = useCallback(async () => {
    try {
      const response = await API.get("/inventory/reasons");
      setReasons(response.data.data || []);
    } catch (_error) {
      setReasons([]);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/inventory/items", {
        params: {
          search: searchTerm,
          stock_status: stockFilter,
          sort: sortBy,
          page,
          limit: pageSize,
        },
      });
      setItems(response.data.data || []);
      setTotalItems(Number(response.data.total || 0));
      setTotalPages(Number(response.data.total_pages || 1));
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error("Gagal memuat inventory:", err);
      Swal.fire("Error", "Gagal memuat data inventory.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, sortBy, stockFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 250);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  useEffect(() => { fetchReasons(); }, [fetchReasons]);
  useEffect(() => {
    localStorage.setItem("alkes_spb_draft", JSON.stringify(spbForm));
  }, [spbForm]);

  const addReason = async (target = "transaction") => {
    const result = await Swal.fire({ title: "Tambah Alasan", input: "text", inputLabel: "Nama alasan/keperluan", inputPlaceholder: "Contoh: DEMO EVENT", showCancelButton: true, confirmButtonText: "Simpan", inputValidator: (value) => value.trim().length < 2 ? "Minimal 2 karakter" : undefined });
    if (!result.isConfirmed) return;
    const response = await API.post("/inventory/reasons", { name: result.value.trim() });
    await fetchReasons();
    if (response.data.data) {
      const reasonId = String(response.data.data.reason_id);
      if (target === "spb") setSpbForm((current) => ({ ...current, reason_id: reasonId }));
      else setTransactionForm((current) => ({ ...current, reason_id: reasonId }));
    }
  };

  const totals = {
    stok: Number(summary.total_stok || 0),
    stokRendah: Number(summary.stok_rendah || 0),
    stokKosong: Number(summary.stok_kosong || 0),
  };
  const visibleItems = items;
  const firstItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, totalItems);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const openTransaction = (item, tipe) => {
    setTransactionForm({
      item_id: item?.item_id || "",
      nama: item?.nama || "",
      tipe,
      qty: "",
      reason_id: "",
      catatan: "",
      stok_awal: item?.stok ?? "",
      nomor_batch: item?.nomor_batch || "",
      serial_number: "",
      lots: item?.lots || [],
    });
    setTransactionModal(tipe);
  };

  const openSpb = () => {
    setSpbModal(true);
  };

  const addToSpbCart = (item) => {
    const filledItems = spbForm.items.filter((line) => line.item_id);
    const sameItemExists = filledItems.some((line) => line.item_id === item.item_id);
    if (sameItemExists && !item.lots?.length) {
      Swal.fire({ icon: "info", title: "Sudah di keranjang", text: item.nama, timer: 1100, showConfirmButton: false });
      return;
    }
    if (filledItems.length >= 10) {
      Swal.fire("Maksimal 10 item", "Satu SPB hanya dapat memuat maksimal 10 item.", "warning");
      return;
    }
    const newLine = { item_id: item.item_id, nama: item.nama, serial_number: "", qty: 1, stok: item.stok, satuan: item.satuan || "", lots: item.lots || [] };
    setSpbForm((current) => ({
      ...current,
      items: current.items.length === 1 && !current.items[0].item_id ? [newLine] : [...current.items, newLine],
    }));
    Swal.fire({ icon: "success", title: "Masuk Keranjang SPB", text: sameItemExists ? `${item.nama} ditambahkan lagi. Pilih SN/batch yang berbeda.` : item.nama, timer: 1200, showConfirmButton: false });
  };

  const updateSpbLine = (index, changes) => {
    setSpbForm((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line) }));
  };

  const buildSpbDocument = (spb) => {
    const rows = (spb.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.item_id)}</td><td>${escapeHtml(item.nama)}</td><td>${escapeHtml(item.serial_number || "-")}</td><td>${escapeHtml(item.qty)}</td><td>${escapeHtml(item.satuan || "-")}</td></tr>`).join("");
    const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
    const logoUrl = `${window.location.origin}/logo-panamed.png`;
    return `<html><head><meta charset="utf-8"><title>SPB ${escapeHtml(spb.spb_number)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:9.5pt}.header{display:flex;align-items:center;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:14px}.logo{width:145px;max-height:64px;object-fit:contain}.heading{flex:1;text-align:center;padding-right:145px}h1{font-size:16pt;margin:0}.subtitle{font-size:9pt;margin-top:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:14px}.box{border:1px solid #555;padding:7px;min-height:31px}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #333;padding:6px}th{background:#eee;text-align:center}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:30px;text-align:center}.space{height:58px}.footer-info{display:flex;justify-content:space-between;border-top:1px solid #777;margin-top:24px;padding-top:7px;font-size:8.5pt}.note{margin-top:12px;border:1px solid #555;padding:8px;min-height:42px;font-size:8.5pt}.note b{display:block;margin-bottom:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><img class="logo" src="${logoUrl}" alt="Panamed"><div class="heading"><h1>SURAT PENGANTARAN BARANG (SPB)</h1><div class="subtitle">PT Panamed</div></div></div><div class="meta"><div class="box"><b>No. PO Customer:</b> ${escapeHtml(spb.recipient)}</div><div class="box"><b>Tujuan/Lokasi:</b> ${escapeHtml(spb.destination || "-")}</div><div class="box"><b>Keperluan:</b> ${escapeHtml(spb.reason)}</div><div class="box"><b>No. NIE/AKL:</b> ${escapeHtml(spb.notes || "-")}</div></div><table><thead><tr><th>No</th><th>Kode</th><th>Nama Barang</th><th>SN/Batch</th><th>Qty</th><th>Satuan</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Penerima<div class="space"></div>(___________________)</div><div>Penanggung Jawab Teknis<div class="space"></div>(___________________)</div><div>Mengetahui<div class="space"></div>(___________________)</div></div><div class="footer-info"><span><b>Tanggal cetak:</b> ${escapeHtml(printedAt)}</span><span><b>No. SPB:</b> ${escapeHtml(spb.spb_number)}</span></div><div class="note"><b>NOTE:</b>${escapeHtml(spb.print_note || "")}</div></body></html>`;
  };
  const downloadSpb = (spb) => {
    if (spb.status !== "APPROVED") return Swal.fire("Belum dapat dicetak", "SPB harus disetujui atasan terlebih dahulu.", "warning");
    const html = buildSpbDocument(spb);
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `SPB-${String(spb.spb_number || "pengantaran").replace(/[^a-z0-9_-]/gi, "-")}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printSpb = (spb) => {
    if (spb.status !== "APPROVED") return Swal.fire("Belum dapat dicetak", "SPB harus disetujui atasan terlebih dahulu.", "warning");
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) return Swal.fire("Pop-up diblokir", "Izinkan pop-up browser untuk mencetak SPB.", "warning");
    printWindow.document.write(buildSpbDocument(spb));
    printWindow.document.close();
    try { printWindow.history.replaceState({}, "", `/spb-print/${encodeURIComponent(spb.spb_number)}`); } catch (_error) { /* Browser restriction. */ }
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };
  const fetchIssueHistory = async (search = issueSearch, targetPage = issuePage) => {
    setIssueHistoryLoading(true);
    try {
      const response = await API.get("/inventory/issues", { params: { search, page: targetPage, limit: 10 } });
      setIssueHistory(response.data.data || []);
      setIssuePage(Number(response.data.page || targetPage));
      setIssueTotalPages(Number(response.data.total_pages || 1));
      setIssueTotal(Number(response.data.total || 0));
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Gagal memuat riwayat SPB.", "error");
    } finally {
      setIssueHistoryLoading(false);
    }
  };

  const openIssueHistory = () => {
    setIssueHistoryOpen(true);
    fetchIssueHistory(issueSearch, 1);
  };

  const handleIssueDocument = async (issueId, action) => {
    try {
      const response = await API.get(`/inventory/issues/${issueId}`);
      if (action === "print") printSpb(response.data.data);
      else downloadSpb(response.data.data);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "SPB tidak dapat dibuka.", "error");
    }
  };
  const approveIssue = async (issue) => {
    const confirmation = await Swal.fire({ icon: "question", title: `Setujui ${issue.spb_number}?`, text: "Stok akan dikurangi dan SPB dapat dicetak. Pembuat tidak dapat menyetujui dokumennya sendiri.", showCancelButton: true, confirmButtonText: "Setujui", cancelButtonText: "Batal" });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await API.post(`/inventory/issues/${issue.issue_id}/approve`);
      await Swal.fire("Disetujui", response.data.message, "success");
      await fetchIssueHistory(issueSearch, issuePage);
      await fetchItems();
    } catch (error) {
      Swal.fire("Approval gagal", error.response?.data?.message || "SPB gagal disetujui.", "error");
    }
  };

  const reviseIssue = async (issue) => {
    try {
      const response = await API.get(`/inventory/issues/${issue.issue_id}`);
      const data = response.data.data;
      setSpbForm({
        spb_number: data.spb_number,
        issue_date: new Date().toISOString().slice(0, 10),
        recipient: data.recipient || "",
        destination: data.destination || "",
        reason_id: String(data.reason_id || ""),
        notes: data.notes || "",
        revision_of: data.issue_id,
        items: (data.items || []).map((item) => ({ item_id: item.item_id, nama: item.nama, serial_number: item.serial_number || "", qty: item.qty, stok: item.stock_before, satuan: item.satuan || "", lots: [] })),
      });
      setIssueHistoryOpen(false);
      setSpbModal(true);
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Data revisi tidak dapat dimuat.", "error");
    }
  };

  const submitSpb = async (event) => {
    event.preventDefault();
    if (spbForm.items.length > 10) return;
    setSpbSaving(true);
    try {
      const response = await API.post("/inventory/issues", { ...spbForm, items: spbForm.items.map(({ item_id, serial_number, qty }) => ({ item_id, serial_number, qty })) });
      if (response.data.status !== 1) throw new Error(response.data.message || "Gagal menyimpan SPB");
      setSpbModal(false);
      setSpbForm(emptySpbForm());
      localStorage.removeItem("alkes_spb_draft");
      await fetchItems();
      await Swal.fire({ icon: "success", title: "Menunggu Approval", text: response.data.message + ". Dokumen baru dapat dicetak setelah disetujui pengguna lain.", confirmButtonText: "OK" });
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || error.message || "Gagal menyimpan SPB.", "error");
    } finally {
      setSpbSaving(false);
    }
  };
  const openHistory = async (item) => {
    setHistoryModal(item);
    setHistoryData({ transactions: [], prices: [] });
    try {
      const response = await API.get("/inventory/history", { params: { item_id: item.item_id } });
      setHistoryData({
        transactions: response.data.transactions || [],
        prices: response.data.prices || [],
      });
    } catch (err) {
      console.error("Gagal memuat history:", err);
      Swal.fire("Error", "Gagal memuat history inventory.", "error");
    }
  };

  const printBarcode = (targetItems) => {
    const list = Array.isArray(targetItems) ? targetItems : [targetItems];
    const labels = list
      .map((item) => `
        <section class="label">
          <div class="name">${item.nama}</div>
          <div class="barcode">${barcodeSvg(item.item_id)}</div>
          <div class="sku">${item.item_id}</div>
          <div class="meta">${item.satuan || "-"} | ${item.merek || "Tanpa merek"}</div>
        </section>
      `)
      .join("");
    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode SKU</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
            .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .label { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; text-align: center; break-inside: avoid; min-height: 118px; }
            .name { font-size: 12px; font-weight: 700; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .barcode svg { max-width: 100%; height: 54px; }
            .sku { font-family: Consolas, monospace; font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-top: 6px; }
            .meta { font-size: 10px; color: #6b7280; margin-top: 3px; }
          </style>
        </head>
        <body><main class="sheet">${labels}</main></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const printLocatorBarcode = (target) => {
    const locators = Array.isArray(target)
      ? uniqueLocators(target)
      : [String(target?.locator || target || "").trim()].filter(Boolean);

    if (!locators.length) {
      Swal.fire("Peringatan", "Locator belum diisi.", "warning");
      return;
    }

    const labels = locators
      .map((locator) => {
        const relatedItems = items.filter((item) => String(item.locator || "").trim().toLowerCase() === locator.toLowerCase());
        return `
          <section class="label">
            <div class="title">LOCATOR</div>
            <div class="name">${locator}</div>
            <div class="barcode">${barcodeSvg(`LOC:${locator}`)}</div>
            <div class="sku">LOC:${locator}</div>
            <div class="meta">${relatedItems.length} barang</div>
          </section>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Locator</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
            .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .label { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; text-align: center; break-inside: avoid; min-height: 126px; }
            .title { font-size: 10px; font-weight: 800; color: #2563eb; letter-spacing: 1px; margin-bottom: 4px; }
            .name { font-size: 14px; font-weight: 800; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .barcode svg { max-width: 100%; height: 54px; }
            .sku { font-family: Consolas, monospace; font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-top: 6px; }
            .meta { font-size: 10px; color: #6b7280; margin-top: 3px; }
          </style>
        </head>
        <body><main class="sheet">${labels}</main></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const readIncomingFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const table = parseCsv(await file.text());
      const headers = (table[0] || []).map((header) => header.trim().toLowerCase());
      const column = (name) => headers.indexOf(name.toLowerCase());
      const required = ["SKU", "Nama Produk", "HPP", "Stok Terkini"];
      const missing = required.filter((name) => column(name) < 0);
      if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(", ")}`);

      const parsed = table.slice(1).map((row, index) => ({
        row_number: index + 2,
        sku: row[column("SKU")] || "",
        nama: row[column("Nama Produk")] || "",
        harga: csvNumber(row[column("HPP")]),
        qty: csvNumber(row[column("Stok Terkini")]),
        kategori: column("Kategori") >= 0 ? row[column("Kategori")] || "" : "",
        minimum_stock: column("Stok Minimum") >= 0 ? csvNumber(row[column("Stok Minimum")]) : "",
        satuan: column("Satuan") >= 0 ? row[column("Satuan")] || "" : "",
        gudang: column("Gudang") >= 0 ? row[column("Gudang")] || "" : "",
        rak: column("Rak") >= 0 ? row[column("Rak")] || "" : "",
      })).filter((row) => row.sku || row.nama);

      if (!parsed.length) throw new Error("File tidak memiliki baris data.");
      if (parsed.length > 3000) throw new Error("Maksimal 3.000 baris per upload.");
      setBulkFileName(file.name);
      setBulkRows(parsed);
    } catch (error) {
      setBulkFileName("");
      setBulkRows([]);
      Swal.fire("Format tidak sesuai", error.message || "CSV tidak dapat dibaca.", "warning");
    }
  };

  const uploadIncoming = async () => {
    if (!bulkRows.length) return;
    const validRows = bulkRows.filter((row) => Number.isFinite(row.qty) && row.qty >= 0);
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Proses barang masuk?",
      text: `${validRows.length} dari ${bulkRows.length} baris valid akan diproses. Barang yang belum ada akan dibuat, dan Stok Terkini akan ditambahkan ke stok saat ini.`,
      showCancelButton: true,
      confirmButtonText: "Proses Upload",
      cancelButtonText: "Batal",
    });
    if (!confirmation.isConfirmed) return;

    setUploading(true);
    try {
      const response = await API.post("/inventory/transactions/bulk-incoming", {
        rows: bulkRows,
        catatan: `Upload barang masuk dari ${bulkFileName}`,
      });
      const data = response.data;
      const errorHtml = (data.errors || []).slice(0, 10)
        .map((error) => `<li>Baris ${error.row}: ${error.nama || error.sku || "-"} — ${error.message}</li>`)
        .join("");
      await Swal.fire({
        icon: data.processed > 0 ? "success" : "warning",
        title: "Upload selesai",
        html: `<p>${data.processed || 0} baris berhasil (${data.created || 0} barang baru), ${data.skipped || 0} dilewati. Total qty masuk: ${formatNumber(data.total_qty)}.</p>${errorHtml ? `<ul style="margin-top:12px;text-align:left;font-size:12px;max-height:180px;overflow:auto">${errorHtml}</ul>` : ""}`,
      });
      setBulkFileName("");
      setBulkRows([]);
      fetchItems();
    } catch (err) {
      console.error("Gagal upload barang masuk:", err);
      Swal.fire("Error", err.response?.data?.message || "Gagal memproses file.", "error");
    } finally {
      setUploading(false);
    }
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        item_id: transactionForm.item_id,
        tipe: transactionForm.tipe,
        qty: transactionForm.qty,
        harga: null,
        catatan: transactionForm.catatan,
        reason_id: transactionForm.tipe === "KELUAR" ? transactionForm.reason_id : null,
        serial_number: transactionForm.serial_number,
      };
      const response = await API.post("/inventory/transactions", payload);

      if (response.data.status === 1) {
        Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1600, showConfirmButton: false });
        setTransactionModal(null);
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menyimpan transaksi.", "warning");
      }
    } catch (err) {
      console.error("Gagal menyimpan transaksi:", err);
      Swal.fire("Error", err.response?.data?.message || "Gagal menghubungi server.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <PackagePlus size={16} />
              Inventory Control
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{issueMode ? "Pengeluaran Barang" : "Inventory"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {issueMode ? "Pilih barang ke keranjang, lengkapi SPB, lalu simpan dan cetak surat pengeluaran." : "Kelola stok, barang masuk, barcode, dan riwayat inventory."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {!issueMode && <>
              <button onClick={() => printBarcode(items)} disabled={!items.length} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50 sm:w-auto"><Barcode size={17} /> Print SKU Halaman</button>
              <button onClick={() => printLocatorBarcode(items)} disabled={!uniqueLocators(items).length} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 shadow-sm disabled:opacity-50 sm:w-auto"><Barcode size={17} /> Print Locator</button>
              <button onClick={() => openTransaction(null, "MASUK")} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm sm:w-auto"><ArrowDownToLine size={17} /> Barang Masuk</button>
            </>}
            <button onClick={openIssueHistory} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 shadow-sm sm:w-auto"><History size={17} /> Riwayat SPB</button>
            <button onClick={openSpb} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm sm:w-auto"><ArrowUpFromLine size={17} /> Keranjang SPB ({spbForm.items.filter((line) => line.item_id).length})</button>
          </div>
        </div>

        {(totals.stokRendah > 0 || totals.stokKosong > 0) && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-bold text-amber-950">Perhatian stok</p>
            <p className="mt-1">
              Ada {formatNumber(totals.stokRendah)} barang mau habis dan {formatNumber(totals.stokKosong)} barang kosong. Baris terkait diberi warna kuning/merah.
            </p>
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Item</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(summary.total_items)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Stok</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(totals.stok)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Mau Habis</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{formatNumber(totals.stokRendah)}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Kosong</p>
            <p className="mt-2 text-2xl font-bold text-red-600">{formatNumber(totals.stokKosong)}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="clinical-toolbar border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{issueMode ? "Pilih Barang untuk SPB" : "Daftar Inventory"}</h2>
                <p className="mt-1 text-sm text-slate-500">Menampilkan {firstItem}-{lastItem} dari {formatNumber(totalItems)} barang.</p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[180px_180px_320px]">
                <select value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  <option value="all">Semua Status</option>
                  <option value="low">Mau Habis</option>
                  <option value="empty">Kosong</option>
                  <option value="safe">Aman</option>
                </select>
                <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  <option value="created">Terbaru</option>
                  <option value="stock_asc">Stok Terendah</option>
                  <option value="stock_desc">Stok Tertinggi</option>
                  <option value="name">Nama A-Z</option>
                  <option value="locator">Locator A-Z</option>
                </select>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
                    placeholder="Cari barang, scan SKU atau locator..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => { setSearchTerm(""); setPage(1); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Barang</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Satuan</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Locator</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Stok</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
                      <p className="text-sm font-semibold text-slate-700">Memuat inventory</p>
                    </td>
                  </tr>
                ) : visibleItems.length > 0 ? (
                  visibleItems.map((item) => {
                    const status = stockStatus(item);
                    return (
                    <tr key={item.item_id} className={`transition ${status.rowClass}`}>
                      <td className="min-w-[240px] px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-3">
                            {item.gambar_url ? <img src={item.gambar_url} alt="" className="h-11 w-11 rounded-xl border border-slate-200 object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><PackagePlus size={18} /></span>}
                            <div>
                              <p className="font-semibold text-slate-950">{item.nama}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.merek || "Tanpa merek"} · {item.principal || "Principal belum diisi"}</p>
                            </div>
                          </div>
                          {status.label !== "Aman" && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>}
                        </div>
                                                <p className="mt-1 font-mono text-xs text-slate-500">{item.item_id} · NIE {item.nomor_izin_edar || "-"}</p>
                        {expiryStatus(item.tanggal_kedaluwarsa) && <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${expiryStatus(item.tanggal_kedaluwarsa).className}`}>{expiryStatus(item.tanggal_kedaluwarsa).label}</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{item.kategori || "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{item.satuan || "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{item.locator || "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <p className={`text-sm font-bold ${status.label === "Kosong" ? "text-red-700" : status.label === "Mau Habis" ? "text-amber-700" : "text-slate-950"}`}>{formatNumber(item.stok)}</p>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span><div className="product-stock-track mt-2 w-24"><div className="product-stock-fill" style={{ width: `${Math.min(100, Math.max(4, Number(item.stok || 0) / Math.max(Number(item.minimum_stock || 1) * 2, 1) * 100))}%` }} /></div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {!issueMode && <button onClick={() => openTransaction(item, "MASUK")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 text-emerald-600" title="Barang masuk"><ArrowDownToLine size={15} /></button>}
                          <button onClick={() => addToSpbCart(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-100 text-orange-600" title="Tambah ke Keranjang SPB"><ArrowUpFromLine size={15} /></button>
                          {!issueMode && <>
                            <button onClick={() => openHistory(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-100 text-violet-600" title="History"><History size={15} /></button>
                            <button onClick={() => printBarcode(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600" title="Print barcode SKU"><Barcode size={15} /></button>
                            <button onClick={() => printLocatorBarcode(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 text-indigo-600" title="Print barcode locator"><Barcode size={15} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-5 py-16 text-center text-sm text-slate-500">Tidak ada data sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {loading ? (
              <div className="px-5 py-12 text-center">
                <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
                <p className="text-sm font-semibold text-slate-700">Memuat inventory</p>
              </div>
            ) : visibleItems.length > 0 ? (
              visibleItems.map((item) => {
                const status = stockStatus(item);
                return (
                <article key={item.item_id} className={`p-4 ${status.label === "Kosong" ? "bg-red-50/40" : status.label === "Mau Habis" ? "bg-amber-50/40" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold text-slate-950">{item.nama}</p>
                        {status.label !== "Aman" && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>}
                      </div>
                                              <p className="mt-1 font-mono text-xs text-slate-500">{item.item_id} · NIE {item.nomor_izin_edar || "-"}</p>
                        {expiryStatus(item.tanggal_kedaluwarsa) && <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${expiryStatus(item.tanggal_kedaluwarsa).className}`}>{expiryStatus(item.tanggal_kedaluwarsa).label}</span>}
                    </div>
                    {!issueMode && <button onClick={() => printBarcode(item)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Print barcode SKU">
                      <Barcode size={15} />
                    </button>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Kategori" value={item.kategori || "-"} />
                    <Info label="Satuan" value={item.satuan || "-"} />
                    <Info label="Locator" value={item.locator || "-"} />
                    <Info label="Stok" value={`${formatNumber(item.stok)} - ${status.label}`} strong />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {!issueMode && <button onClick={() => openTransaction(item, "MASUK")} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"><ArrowDownToLine size={14} /> Masuk</button>}
                    <button onClick={() => addToSpbCart(item)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white"><ArrowUpFromLine size={14} /> + Keranjang</button>
                    {!issueMode && <>
                      <button onClick={() => openHistory(item)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-100 text-xs font-bold text-violet-600"><History size={14} /> History</button>
                      <button onClick={() => printLocatorBarcode(item)} className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-100 text-xs font-bold text-indigo-600"><Barcode size={14} /> Print Locator</button>
                    </>}
                  </div>
                </article>
              );
              })
            ) : (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Tidak ada data sesuai filter.</div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-medium text-slate-500">
                Menampilkan {firstItem}-{lastItem} dari {formatNumber(totalItems)} data
              </p>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                Per halaman
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-700 outline-none focus:border-blue-500">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                Sebelumnya
              </button>
              {pageNumbers.map((number, index) => (
                <React.Fragment key={number}>
                  {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-xs text-slate-400">...</span>}
                  <button type="button" onClick={() => setPage(number)} disabled={loading} aria-current={number === page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${number === page ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}>
                    {number}
                  </button>
                </React.Fragment>
              ))}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                Berikutnya
              </button>
            </div>
          </div>
        </section>
      </section>

      {spbModal && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/55 p-3 pt-4 backdrop-blur-sm sm:p-6 sm:pt-8">
          <div className="w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <ModalHeader title="Surat Pengantaran Barang (SPB)" subtitle="Satu SPB dapat memuat maksimal 10 item barang." onClose={() => setSpbModal(false)} />
            <form onSubmit={submitSpb} className="max-h-[calc(100vh-5rem)] overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <Input label={spbForm.revision_of ? "Nomor SPB Sumber (suffix otomatis)" : "Nomor SPB"} value={spbForm.spb_number} onChange={(value) => setSpbForm((current) => ({ ...current, spb_number: value }))} placeholder="Contoh: SPB-001" required disabled={Boolean(spbForm.revision_of)} />
                <Input label="Tanggal SPB" type="date" value={spbForm.issue_date} onChange={(value) => setSpbForm((current) => ({ ...current, issue_date: value }))} required />
                <Input label="No. PO Customer" value={spbForm.recipient} onChange={(value) => setSpbForm((current) => ({ ...current, recipient: value }))} placeholder="Nomor PO customer" required />
                <Input label="Tujuan / Lokasi" value={spbForm.destination} onChange={(value) => setSpbForm((current) => ({ ...current, destination: value }))} placeholder="RS / lokasi tujuan" />
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Alasan / Keperluan</label>
                  <div className="flex gap-2"><select required value={spbForm.reason_id} onChange={(event) => setSpbForm((current) => ({ ...current, reason_id: event.target.value }))} className="w-full rounded-lg border bg-white px-3 py-2 text-sm">
                    <option value="">Pilih alasan</option>
                    {reasons.map((reason) => <option key={reason.reason_id} value={reason.reason_id}>{reason.name}</option>)}
                  </select><button type="button" onClick={() => addReason("spb")} className="whitespace-nowrap rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700">+ Alasan</button></div>
                </div>
                <div className="md:col-span-2"><Textarea label="No. NIE / AKL" value={spbForm.notes} onChange={(value) => setSpbForm((current) => ({ ...current, notes: value }))} /></div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-col gap-3 border-b bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h4 className="font-bold text-slate-900">Daftar Barang SPB</h4><p className="text-xs text-slate-500">{spbForm.items.length} dari maksimal 10 item</p></div>
                  <button type="button" disabled={spbForm.items.length >= 10} onClick={() => setSpbForm((current) => ({ ...current, items: [...current.items, emptySpbLine()] }))} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 text-sm font-bold text-blue-700 disabled:opacity-40"><Plus size={15} /> Tambah Item</button>
                </div>
                <div className="space-y-3 bg-slate-50/50 p-3">
                  {spbForm.items.map((line, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[44px_minmax(280px,2fr)_minmax(170px,1fr)_130px_110px_44px] lg:items-start">
                      <div className="flex h-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{index + 1}</div>
                      <ItemLookup items={items} value={line.item_id} nama={line.nama} onChange={(value, selected) => updateSpbLine(index, { item_id: value, nama: selected?.nama || "", stok: selected?.stok ?? "", satuan: selected?.satuan || "", lots: selected?.lots || [], serial_number: "" })} />
                      <div><label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">SN / Batch</label>{line.lots?.length ? <select required value={line.serial_number} onChange={(event) => updateSpbLine(index, { serial_number: event.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Pilih SN/Batch</option>{line.lots.map((lot) => <option key={lot.serial_number} value={lot.serial_number}>{lot.serial_number} · stok {formatNumber(lot.qty)}</option>)}</select> : <input value={line.serial_number} onChange={(event) => updateSpbLine(index, { serial_number: event.target.value })} placeholder="Opsional" className="w-full rounded-lg border px-3 py-2 text-sm" />}</div>
                      <Input label="Qty Keluar" type="number" value={line.qty} onChange={(value) => updateSpbLine(index, { qty: value })} required />
                      <Info label="Stok" value={line.stok === "" ? "-" : formatNumber(line.stok)} strong />
                      <button type="button" aria-label="Hapus item" disabled={spbForm.items.length === 1} onClick={() => setSpbForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))} className="flex h-10 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-30"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={async () => { const result = await Swal.fire({ icon: "warning", title: "Kosongkan keranjang?", text: "Semua item dan data draft SPB akan dihapus.", showCancelButton: true, confirmButtonText: "Ya, kosongkan", cancelButtonText: "Batal", confirmButtonColor: "#dc2626" }); if (result.isConfirmed) setSpbForm(emptySpbForm()); }} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-bold text-red-600">Kosongkan Keranjang</button>
                <button type="button" onClick={() => setSpbModal(false)} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600">Tutup</button>
                <button type="submit" disabled={spbSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">{spbSaving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Ajukan Approval SPB</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {issueHistoryOpen && (
        <div className="fixed inset-0 z-[1001] flex items-start justify-center overflow-y-auto bg-black/55 p-3 pt-6 backdrop-blur-sm sm:p-6 sm:pt-10">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <ModalHeader title="Riwayat SPB" subtitle="Approval, revisi, download, dan cetak Surat Pengantaran Barang." onClose={() => setIssueHistoryOpen(false)} />
            <div className="p-4 sm:p-6">
              <form onSubmit={(event) => { event.preventDefault(); setIssuePage(1); fetchIssueHistory(issueSearch, 1); }} className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)} placeholder="Cari nomor SPB, PO customer, tujuan, NIE/AKL, atau alasan" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
                <button className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white">Cari</button>
              </form>
              <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 bg-slate-50"><tr>{["Nomor SPB", "Tanggal", "No. PO Customer", "Status", "Item", "Aksi"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {issueHistoryLoading ? <tr><td colSpan="6" className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr> : issueHistory.length ? issueHistory.map((issue) => <tr key={issue.issue_id}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{issue.spb_number}</td><td className="whitespace-nowrap px-4 py-3">{issue.issue_date}</td><td className="px-4 py-3">{issue.recipient}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${issue.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : issue.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{issue.status === "APPROVED" ? "Disetujui" : issue.status === "PENDING" ? "Menunggu" : "Direvisi"}</span></td><td className="whitespace-nowrap px-4 py-3">{issue.item_count} item · {formatNumber(issue.total_qty)}</td>
                      <td className="whitespace-nowrap px-4 py-3"><div className="flex flex-wrap gap-2">{issue.status === "PENDING" && <button onClick={() => approveIssue(issue)} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white">Approve</button>}{issue.status === "APPROVED" && <><button onClick={() => handleIssueDocument(issue.issue_id, "download")} className="rounded-lg border border-blue-200 px-3 py-1.5 font-bold text-blue-700">Download</button><button onClick={() => handleIssueDocument(issue.issue_id, "print")} className="rounded-lg border border-orange-200 px-3 py-1.5 font-bold text-orange-700">Print</button><button onClick={() => reviseIssue(issue)} className="rounded-lg border border-violet-200 px-3 py-1.5 font-bold text-violet-700">Revisi</button></>}</div></td>
                    </tr>) : <tr><td colSpan="6" className="p-10 text-center text-slate-500">Belum ada riwayat SPB.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Total {issueTotal} SPB · halaman {issuePage} dari {issueTotalPages}</p><div className="flex gap-2"><button type="button" disabled={issuePage <= 1 || issueHistoryLoading} onClick={() => fetchIssueHistory(issueSearch, issuePage - 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Sebelumnya</button><button type="button" disabled={issuePage >= issueTotalPages || issueHistoryLoading} onClick={() => fetchIssueHistory(issueSearch, issuePage + 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Berikutnya</button></div></div>
            </div>
          </div>
        </div>
      )}
      {transactionModal && (
        <div className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6 backdrop-blur-sm sm:pt-10">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl">
            <ModalHeader title={transactionModal === "MASUK" ? "Barang Masuk" : "Barang Keluar"} subtitle={transactionForm.nama} onClose={() => setTransactionModal(null)} />
            {transactionModal === "MASUK" && (
              <section className="mx-6 mt-6 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Upload CSV Master_Barang</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Format Master_Barang: Nama Produk, HPP, dan Stok Terkini. SKU baru dibuat otomatis oleh sistem.</p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                    <Upload size={16} />
                    Pilih CSV
                    <input type="file" accept=".csv,text/csv" onChange={readIncomingFile} className="hidden" />
                  </label>
                </div>
                {bulkRows.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{bulkFileName} · {bulkRows.length} baris</p>
                      <button type="button" onClick={uploadIncoming} disabled={uploading} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Proses Upload
                      </button>
                    </div>
                    <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">SKU</th><th className="p-2 text-left">Nama</th><th className="p-2 text-right">Qty</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {bulkRows.slice(0, 20).map((row) => <tr key={row.row_number}><td className="p-2 font-mono">{row.sku || "-"}</td><td className="p-2">{row.nama || "-"}</td><td className="p-2 text-right">{Number.isFinite(row.qty) ? formatNumber(row.qty) : "Tidak valid"}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                    {bulkRows.length > 20 && <p className="mt-2 text-[11px] text-slate-500">Preview 20 baris pertama.</p>}
                  </div>
                )}
              </section>
            )}
            <div className={transactionModal === "MASUK" ? "mx-6 mt-5 border-t border-slate-200 pt-5" : ""}>
              {transactionModal === "MASUK" && <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Input Manual</p>}
            <form onSubmit={submitTransaction} className="space-y-4 px-6 pb-6">
              <ItemLookup
                items={items}
                value={transactionForm.item_id}
                nama={transactionForm.nama}
                onChange={(value, matchedItem) => {
                  const selected = matchedItem || items.find((item) => item.item_id.toLowerCase() === value.trim().toLowerCase());
                  setTransactionForm((current) => ({
                    ...current,
                    item_id: value,
                    nama: selected?.nama || "",
                    stok_awal: selected?.stok ?? "",
                    nomor_batch: selected?.nomor_batch || "",
                    lots: selected?.lots || [],
                    serial_number: "",
                  }));
                }}
              />
              {transactionForm.item_id && transactionForm.nama && <div className="grid grid-cols-2 gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm"><Info label="Stok awal/saat ini" value={formatNumber(transactionForm.stok_awal)} strong /><Info label="SN/Batch tersedia" value={(transactionForm.lots || []).map((lot) => lot.serial_number + " (" + formatNumber(lot.qty) + ")").join(", ") || transactionForm.nomor_batch || "-"} /></div>}
              {transactionForm.tipe === "KELUAR" && transactionForm.lots?.length ? <div><label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Pilih SN / Batch</label><select required value={transactionForm.serial_number} onChange={(event) => setTransactionForm((current) => ({ ...current, serial_number: event.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Pilih SN / Batch</option>{transactionForm.lots.map((lot) => <option key={lot.serial_number} value={lot.serial_number}>{lot.serial_number} - stok {formatNumber(lot.qty)}</option>)}</select></div> : <Input label="SN / Batch" value={transactionForm.serial_number} onChange={(value) => setTransactionForm((current) => ({ ...current, serial_number: value }))} placeholder="Contoh: SN 0002" />}
              <Input label="Qty" type="number" value={transactionForm.qty} onChange={(value) => setTransactionForm((current) => ({ ...current, qty: value }))} required />
              {transactionForm.tipe === "KELUAR" && <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Alasan / Keperluan</label>
                <div className="flex gap-2"><select required value={transactionForm.reason_id} onChange={(event) => setTransactionForm((current) => ({ ...current, reason_id: event.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">Pilih alasan</option>
                  {reasons.map((reason) => <option key={reason.reason_id} value={reason.reason_id}>{reason.name}</option>)}
                </select><button type="button" onClick={addReason} className="whitespace-nowrap rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700">+ Alasan</button></div>
              </div>}
              <Textarea label="Catatan" value={transactionForm.catatan} onChange={(value) => setTransactionForm((current) => ({ ...current, catatan: value }))} />
              <ModalActions saving={saving} onCancel={() => setTransactionModal(null)} />
            </form>
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <ModalHeader title="Log History Inventory" subtitle={`${historyModal.item_id} - ${historyModal.nama}`} onClose={() => setHistoryModal(null)} />
            <div className="grid max-h-[72vh] grid-cols-1 gap-4 overflow-auto p-6">
              <HistoryTable title="Barang Masuk / Keluar" rows={historyData.transactions} type="transactions" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
    <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-red-500">
      <X size={20} />
    </button>
  </div>
);

const Input = ({ label, value, onChange, type = "text", required = false, placeholder = "", disabled = false }) => (
  <div>
    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</label>
    <input required={required} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500" />
  </div>
);

const Info = ({ label, value, strong = false }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 break-words text-sm ${strong ? "font-bold text-slate-950" : "font-medium text-slate-700"}`}>{value}</p>
  </div>
);

const ItemLookup = ({ items, value, nama, onChange }) => {
  const [remoteItems, setRemoteItems] = useState([]);
  useEffect(() => {
    const keyword = value.trim();
    if (!keyword) { setRemoteItems([]); return undefined; }
    const timer = setTimeout(() => {
      API.get("/inventory/items", { params: { search: keyword, limit: 20, sort: "name" } })
        .then((response) => setRemoteItems(response.data.data || []))
        .catch(() => setRemoteItems([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [value]);
  const suggestions = remoteItems.length ? remoteItems : (value ? items.filter((item) => (item.item_id + " " + item.nama).toLowerCase().includes(value.toLowerCase())).slice(0, 10) : []);

  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Kode Barang / SKU</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Scan atau ketik kode barang"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
      {nama ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{nama}</p>
      ) : value ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Barang belum ditemukan. Tambahkan dulu dari Master Barang.</p>
      ) : null}
      {suggestions.length > 0 && !nama && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {suggestions.map((item) => (
            <button
              key={item.item_id}
              type="button"
              onClick={() => onChange(item.item_id, item)}
              className="block w-full px-3 py-2 text-left text-xs transition hover:bg-blue-50"
            >
              <span className="font-bold text-slate-800">{item.item_id}</span>
              <span className="ml-2 text-slate-500">{item.nama}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Textarea = ({ label, value, onChange }) => (
  <div>
    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</label>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
  </div>
);

const ModalActions = ({ saving, onCancel }) => (
  <div className="flex gap-2 pt-4">
    <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
      Batal
    </button>
    <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      Simpan
    </button>
  </div>
);

const HistoryTable = ({ title, rows, type }) => (
  <section className="rounded-lg border border-slate-200">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
    </div>
    <div className="max-h-80 overflow-auto">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={type === "prices" ? row.history_id : row.transaksi_id}>
                <td className="px-4 py-3">
                  {type === "prices" ? (
                    <>
                      <p className="font-semibold text-slate-900">{formatMoney(row.harga_lama)} -> {formatMoney(row.harga_baru)}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.catatan || "-"}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">{row.tipe} qty {formatNumber(row.qty)}</p>
                      <p className="mt-1 text-xs text-slate-500">Stok {formatNumber(row.stok_sebelum)} -&gt; {formatNumber(row.stok_sesudah)}{row.alasan && <> · {row.alasan}</>}</p>
                    </>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">{row.created_at}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-8 text-center text-slate-400">Belum ada history.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export default Inventory;
