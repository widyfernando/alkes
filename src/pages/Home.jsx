// src/pages/Home.jsx

// Import React dan hooks
import React, { useState, useRef, useEffect } from "react";

// Import komponen halaman
import Dashboard from "../components/dashboard";
import Otoritaspengguna from "../Mainpage/admin/otoritaspengguna";
import Mastergroup from "../Mainpage/admin/mastergroup";
import MasterMenu from "../Mainpage/admin/mastermenu";
import MasterSatuanBarang from "../Mainpage/admin/mastersatuanbarang";
import MasterKategoriBarang from "../Mainpage/admin/masterkategoribarang";
import OrganizationMaster from "../Mainpage/admin/organizationmaster";
import Inventory from "../Mainpage/admin/inventory";
import MasterBarang from "../Mainpage/admin/masterbarang";
import StockOpname from "../Mainpage/admin/stockopname";
import Purchases from "../Mainpage/admin/purchases";
import Reports from "../Mainpage/admin/reports";
import Settings from "../components/settings";
import Pengaturanpengguna from "../Mainpage/admin/pengaturanpengguna";
import { getStoredUser } from "../utils/authStorage";
import API from "../utils/axiosInstance";

// Import ikon (sebelumnya di Header.jsx)
import { FaUsers, FaSignOutAlt } from "react-icons/fa";
import { ArrowLeft, ArrowUpFromLine, BarChart3, Boxes, ClipboardCheck, FileChartColumn, LayoutDashboard, PackageSearch, Settings2, Tags, Truck } from "lucide-react";

// Perhatikan: kita tambahkan prop 'user' di sini
const Home = ({ onLogout, user = {} }) => {
  const activeUser = user || getStoredUser() || {};
  const displayName = activeUser.nama || activeUser.name || activeUser.username || "User";
  const displayEmail = activeUser.email || activeUser.username || "-";
  // State halaman aktif (dari Home)
  const [activePage, setActivePage] = useState("dashboard"); // default halaman

  // State yang dipindahkan dari Header.jsx
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [allowedPages, setAllowedPages] = useState(new Set(["dashboard"]));
  const dropdownRef = useRef(null);
// Navigasi dikunci selama pengguna menyelesaikan alur kerja modul.
  const lockedPages = ["master", "data-barang-umum", "master-barang", "master-satuan-barang", "master-kategori-barang", "master-departemen", "master-jabatan", "inventory", "pengeluaran-barang", "purchases", "stock-opname", "reports", "otoritas", "master-group", "pengaturan-pengguna", "master-users"];
  const inventoryFlowPages = ["inventory", "pengeluaran-barang", "master-barang", "data-barang-umum", "master-kategori-barang", "master-satuan-barang", "stock-opname"];
  const isLocked = lockedPages.includes(activePage);
  const allMenuItems = [
    { icon: <LayoutDashboard size={19} strokeWidth={1.9} />, label: "Dashboard", key: "dashboard" },
    { icon: <Truck size={19} strokeWidth={1.9} />, label: "Pembelian", key: "purchases" },
    { icon: <PackageSearch size={19} strokeWidth={1.9} />, label: "Inventory", key: "inventory" },
    { icon: <FileChartColumn size={19} strokeWidth={1.9} />, label: "Report", key: "reports" },
    { icon: <Settings2 size={19} strokeWidth={1.9} />, label: "Settings", key: "settings" },
  ];
  const menuItems = allMenuItems.filter(
    (item) =>
      item.key === "dashboard" ||
      allowedPages.has(item.key) ||
      (item.key === "inventory" && inventoryFlowPages.some((key) => allowedPages.has(key)))
  );
  const inventoryTabs = [
    { icon: <Boxes size={17} />, label: "Stok", key: "inventory" },
    { icon: <ArrowUpFromLine size={17} />, label: "Pengeluaran Barang", key: "pengeluaran-barang" },
    { icon: <PackageSearch size={17} />, label: "Master Barang", key: "master-barang" },
    { icon: <Tags size={17} />, label: "Kategori", key: "master-kategori-barang" },
    { icon: <BarChart3 size={17} />, label: "Satuan", key: "master-satuan-barang" },
    { icon: <ClipboardCheck size={17} />, label: "Stock Opname", key: "stock-opname" },
  ];
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!activeUser.grup_id) return;

    API.get("/hak_akses", { params: { grup_id: activeUser.grup_id } })
      .then((response) => {
        const paths = (response.data.data || []).map((entry) => entry.path).filter(Boolean);
        setAllowedPages(new Set(paths.length ? [...paths, "dashboard"] : ["dashboard"]));
      })
      .catch((error) => {
        console.error("Gagal memuat hak akses menu:", error);
        setAllowedPages(new Set(["dashboard"]));
      });
  }, [activeUser.grup_id]);

  const exitLockedPage = () => {
    setActivePage("dashboard");
  };
  // Render halaman berdasarkan state activePage (dari Home)
  const renderInventoryModule = (content) => (
    <div>
      <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2">
          {inventoryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActivePage(tab.key)}
              className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                activePage === tab.key || (tab.key === "master-barang" && activePage === "data-barang-umum")
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      {content}
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard onSelectMenu={setActivePage} onLogout={onLogout} />;
      case "otoritas":
        return <Otoritaspengguna onClose={setActivePage} onLogout={onLogout} />;
      case "master":
        return <MasterMenu onClose={setActivePage} onSelectMenu={setActivePage} />;
      case "master-satuan-barang":
        return renderInventoryModule(<MasterSatuanBarang onClose={() => setActivePage("inventory")} />);
      case "master-kategori-barang":
        return renderInventoryModule(<MasterKategoriBarang onClose={() => setActivePage("inventory")} />);
      case "master-departemen":
        return <OrganizationMaster type="departemen" onClose={setActivePage} />;
      case "master-jabatan":
        return <OrganizationMaster type="jabatan" onClose={setActivePage} />;
      case "master-barang":
      case "data-barang-umum":
        return renderInventoryModule(<MasterBarang onClose={() => setActivePage("inventory")} />);
      case "inventory":
        return renderInventoryModule(<Inventory onSelectMenu={setActivePage} />);
      case "pengeluaran-barang":
        return renderInventoryModule(<Inventory issueMode />);
      case "purchases":
        return <Purchases />;
      case "stock-opname":
        return renderInventoryModule(<StockOpname />);
      case "reports":
        return <Reports />;
      case "master-group":
        return <Mastergroup onClose={setActivePage} onLogout={onLogout} />;
      case "pengaturan-pengguna":
        return <Pengaturanpengguna onLogout={onLogout} onClose={setActivePage} />;
      case "master-users":
        return (
          <Pengaturanpengguna
            onLogout={onLogout}
            onClose={setActivePage}
            mode="master"
            title="Master Users"
            eyebrow="User Master"
            description="Kelola master data pengguna sesuai endpoint backend: daftar, tambah, edit, dan nonaktifkan user."
          />
        );
      case "settings":
        return <Settings onSelectMenu={setActivePage} onLogout={onLogout} allowedPages={allowedPages} />;
      default:
        return <Dashboard onSelectMenu={setActivePage} onLogout={onLogout} />;
    }
  };

  return (
    <div
      className="app-shell relative min-h-[100dvh] bg-slate-50"
      style={{ backgroundImage: "url('/alkes-background.png')" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-white/25" />
      <div className="pointer-events-none fixed -left-40 top-24 h-96 w-96 rounded-full bg-blue-200/25 blur-3xl" />
      <div className="pointer-events-none fixed -right-32 bottom-10 h-80 w-80 rounded-full bg-cyan-100/35 blur-3xl" />

      {/* === SEMUA JSX DARI HEADER.JSX DIPINDAHKAN KE SINI === */}
      <header className="app-header fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2 sm:px-6 md:py-2.5">

          {/* 1. Logo (Sekarang ada di Home.jsx) */}
          <div className="flex items-center gap-3">
            <img src="/logo-panamed.png" alt="Panamed" className="h-10 w-auto max-w-[170px] object-contain md:h-12" />
          </div>

          {/* Desktop Menu */}
         <nav className="hidden items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100/70 p-1 md:flex">
            {menuItems.map((item, idx) => {
              // Item didisable jika page locked DAN item tersebut bukan page yang sedang aktif
              const isInventoryFlow = inventoryFlowPages.includes(activePage) && inventoryFlowPages.includes(item.key);
              const isActive = activePage === item.key || (item.key === "inventory" && inventoryFlowPages.includes(activePage));
              const isDisabled = isLocked && activePage !== item.key && !isInventoryFlow;

              return (
                <button
                  key={idx}
                  disabled={isDisabled}
                  className={`flex items-center space-x-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed text-gray-400"
                      : isActive
                        ? "bg-white text-blue-700 font-semibold shadow-sm ring-1 ring-slate-200/70"
                        : "text-slate-500 hover:bg-white/70 hover:text-blue-600"
                  }`}
                  onClick={() => !isDisabled && setActivePage(item.key)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 2. User Info & Dropdown (Sekarang ada di Home.jsx) */}
          <div className="relative flex items-center space-x-2" ref={dropdownRef}>
            {isLocked && (
              <button type="button" onClick={exitLockedPage} className="sidebar-exit-control inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100" title="Selesaikan modul dan kembali ke dashboard">
                <ArrowLeft size={17} />
                <span className="hidden md:inline">Selesai & Kembali</span>
              </button>
            )}

            <button
              className="sidebar-user-trigger flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-1.5 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FaUsers /></span>
              <div className="hidden md:block text-left">
                <p className="font-semibold text-sm text-gray-800">{displayName}</p>
                <p className="text-xs text-gray-500">{displayEmail}</p>
              </div>
            </button>

            <div className="sidebar-user-actions hidden w-full grid-cols-2 gap-2 md:grid">
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700" onClick={() => setActivePage("pengaturan-pengguna")}>
                <FaUsers /> Profile
              </button>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100" onClick={onLogout}>
                <FaSignOutAlt /> Logout
              </button>
            </div>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-48 rounded-xl md:hidden border border-slate-200/80 bg-white/95 py-2 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                  onClick={() => { setActivePage("pengaturan-pengguna"); setDropdownOpen(false); }}
                >
                  Profile
                </button>
                <hr className="my-1" />
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  onClick={onLogout} // Menggunakan prop 'onLogout'
                >
                  <FaSignOutAlt />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/90 bg-white/95 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur-2xl md:hidden" aria-label="Navigasi utama">
        <div className="mx-auto grid max-w-lg grid-flow-col auto-cols-fr">
          {menuItems.map((item) => {
            const isInventoryFlow = inventoryFlowPages.includes(activePage) && inventoryFlowPages.includes(item.key);
            const isActive = activePage === item.key || (item.key === "inventory" && inventoryFlowPages.includes(activePage));
            const isDisabled = isLocked && activePage !== item.key && !isInventoryFlow;
            return (
              <button
                key={item.key}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setActivePage(item.key)}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition active:scale-95 ${
                  isDisabled
                    ? "text-slate-300"
                    : isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="max-w-full truncate">{item.label}</span>
                {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      </nav>
      {/* === AKHIR DARI JSX HEADER === */}

      {/* Render halaman aktif */}
      <div className="app-content relative mx-auto max-w-[1600px] px-0 pb-24 pt-[3.55rem] sm:px-5 md:pb-5 md:pt-16">{renderPage()}</div>
    </div>
  );
};

export default Home;
