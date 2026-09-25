import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  Cog,
  Gauge,
  FolderTree,
  Loader2,
  MapPinned,
  Package,
  Search,
  Server,
  Truck,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const iconMap = {
  "master-pemasok": Truck,
  "data-barang-umum": Server,
  "master-barang": Server,
  "master-wilayah": MapPinned,
  "data-sales": UsersRound,
  "master-data-sheet-klasifikasi": ClipboardList,
  "master-process-activity": Cog,
  "klasifikasi-pelanggan": ClipboardList,
  "master-satuan-barang": BriefcaseBusiness,
  "master-kategori-barang": FolderTree,
  "master-departemen": Warehouse,
  "master-jabatan": BriefcaseBusiness,
  "master-pelanggan": ClipboardList,
  "master-warehouse": Warehouse,
  "golongan-produk": ClipboardList,
  "data-alat-mesin": Gauge,
  "data-operator": UsersRound,
  "master-jenis-material": Boxes,
  "master-data-material": Package,
  "master-formula": Cog,
};

const availableRoutes = new Set([
  "dashboard",
  "settings",
  "master",
  "otoritas",
  "pengaturan-pengguna",
  "master-group",
  "master-users",
  "master-satuan-barang",
  "master-kategori-barang",
  "master-departemen",
  "master-jabatan",
  "data-barang-umum",
  "master-barang",
]);

const cardTones = [
  "border-blue-200 text-blue-700 hover:bg-blue-50",
  "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
  "border-amber-200 text-amber-700 hover:bg-amber-50",
  "border-rose-200 text-rose-700 hover:bg-rose-50",
  "border-violet-200 text-violet-700 hover:bg-violet-50",
  "border-cyan-200 text-cyan-700 hover:bg-cyan-50",
  "border-indigo-200 text-indigo-700 hover:bg-indigo-50",
  "border-orange-200 text-orange-700 hover:bg-orange-50",
  "border-purple-200 text-purple-700 hover:bg-purple-50",
  "border-green-200 text-green-700 hover:bg-green-50",
  "border-sky-200 text-sky-700 hover:bg-sky-50",
  "border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50",
  "border-lime-200 text-lime-700 hover:bg-lime-50",
  "border-slate-200 text-slate-700 hover:bg-slate-50",
  "border-pink-200 text-pink-700 hover:bg-pink-50",
  "border-teal-200 text-teal-700 hover:bg-teal-50",
];

const MasterMenu = ({ onClose, onSelectMenu }) => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/menu", {
        params: { parent_id: "M00008" },
      });
      setMenus(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Gagal memuat menu master:", err);
      setError("Gagal memuat submenu master dari backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const filteredMenus = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const masterChildren = menus.filter((menu) => menu.menu_id !== "M00008");
    if (!keyword) return masterChildren;

    return masterChildren.filter((menu) =>
      `${menu.menu_id} ${menu.nama} ${menu.path}`.toLowerCase().includes(keyword)
    );
  }, [menus, searchTerm]);

  const handleClose = () => {
    if (onClose) onClose("settings");
  };

  const handleOpenMenu = (menu) => {
    if (menu.path && availableRoutes.has(menu.path) && onSelectMenu) {
      onSelectMenu(menu.path);
      return;
    }

    Swal.fire("Informasi", `${menu.nama} belum memiliki halaman detail.`, "info");
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-8 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Master Data</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Master</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pilih submenu master yang tersedia di database.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari submenu master..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Tutup master"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">
            <Loader2 className="mb-3 animate-spin text-blue-600" size={28} />
            <p className="text-sm font-semibold">Memuat submenu master</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMenus.map((menu, index) => {
              const Icon = iconMap[menu.path] || ClipboardList;
              const tone = cardTones[index % cardTones.length];

              return (
                <motion.button
                  key={menu.menu_id}
                  type="button"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  whileHover={{ scale: 1.06, y: -4 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleOpenMenu(menu)}
                  className={`group relative h-36 overflow-hidden rounded-lg border bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${tone}`}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 shadow-sm transition group-hover:bg-white">
                      <Icon size={28} />
                    </div>
                    <p className="text-sm font-bold leading-5 text-slate-950">{menu.nama}</p>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 border-t border-current/10 bg-white/95 px-3 py-2 text-center opacity-0 transition-all duration-300 hover:opacity-100">
                    <p className="font-mono text-[11px] text-slate-500">{menu.menu_id}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{menu.path || "-"}</p>
                  </div>
                </motion.button>
              );
            })}

            {filteredMenus.length === 0 && (
              <div className="col-span-full flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-slate-500 shadow-sm">
                <ClipboardList className="mb-3 text-slate-300" size={36} />
                <p className="text-sm font-semibold">Submenu tidak ditemukan</p>
                <p className="mt-1 text-sm">Ubah kata kunci pencarian atau cek data menu di database.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default MasterMenu;
