import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  ShoppingCart,
  UserRound,
} from 'lucide-react';
import { loginUser } from '../services/authService';
import Swal from 'sweetalert2';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const user = await loginUser(username, password);

      if (onLoginSuccess) onLoginSuccess(user);

      navigate('/home', { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f8fcfd] text-slate-900"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,107,135,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(23,107,135,0.045)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(21,152,149,0.08),transparent_28%),radial-gradient(circle_at_88%_88%,rgba(23,107,135,0.07),transparent_30%)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden px-12 py-10 text-[#12304a] lg:flex lg:flex-col lg:justify-between">

          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo-panamed.png" alt="Panamed" className="h-14 w-auto max-w-[230px] object-contain" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c9e4e5] bg-white/80 px-4 py-2 text-sm font-semibold text-[#176b87] shadow-sm">
              <ShieldCheck size={16} />
              Pusat kendali operasional
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#12304a]">
              Persediaan medis, lebih tertib dan mudah dipantau.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#607887]">
              Pantau ketersediaan produk medis, pengadaan, pengeluaran barang, dan akses tim dalam sistem yang aman dan terintegrasi.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[#d9e8ed] bg-white/90 p-4 shadow-sm">
                <ShoppingCart className="mb-4 text-[#176b87]" size={24} />
                <p className="text-lg font-bold">Real-time</p>
                <p className="mt-1 text-xs text-[#607887]">Stok & produk</p>
              </div>
              <div className="rounded-2xl border border-[#d9e8ed] bg-white/90 p-4 shadow-sm">
                <Boxes className="mb-4 text-[#159895]" size={24} />
                <p className="text-lg font-bold">Terkontrol</p>
                <p className="mt-1 text-xs text-[#607887]">Pengadaan</p>
              </div>
              <div className="rounded-2xl border border-[#d9e8ed] bg-white/90 p-4 shadow-sm">
                <BarChart3 className="mb-4 text-[#176b87]" size={24} />
                <p className="text-lg font-bold">Terpadu</p>
                <p className="mt-1 text-xs text-[#607887]">Pengeluaran</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 grid max-w-xl grid-cols-[1fr_auto] items-end gap-6 rounded-2xl border border-[#d9e8ed] bg-white/90 p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-[#12304a]">Clinical supply operations</p>
              <p className="mt-2 text-xs leading-5 text-[#607887]">
                Sistem hanya untuk personel berwenang. Semua aktivitas akses dapat dicatat oleh administrator.
              </p>
            </div>
            <div className="medical-pulse-monitor relative h-20 w-36 overflow-hidden rounded-xl border border-[#d7ebed] bg-[#effafa] px-2">
              <div className="absolute inset-0 opacity-50 medical-pulse-grid" />
              <svg viewBox="0 0 180 72" className="relative h-full w-full" aria-label="Denyut sistem aktif" role="img">
                <path className="medical-pulse-trail" pathLength="1" d="M0 38H30L39 38L47 25L58 54L72 12L87 38H112L121 38L129 29L139 47L149 21L160 38H180" />
              </svg>
              <span className="medical-pulse-dot absolute right-2 top-2 h-2 w-2 rounded-full bg-[#159895]" />
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:pr-12">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-9">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
            <div className="pointer-events-none absolute right-7 top-5 h-8 w-24 opacity-30 sm:hidden"><svg viewBox="0 0 120 35" className="h-full w-full" aria-hidden="true"><path className="medical-pulse-trail" pathLength="1" d="M0 19H24L31 9L40 29L51 3L63 19H84L91 12L99 25L108 19H120" /></svg></div>
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <img src="/logo-panamed.png" alt="Panamed" className="h-12 w-auto max-w-[190px] object-contain" />
            </div>

            <div className="mb-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <ShieldCheck size={14} />
                Authorized personnel only
              </p>
              <h2 className="text-3xl font-bold text-slate-950">Masuk ke ERP</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Gunakan akun internal Anda untuk mengakses dashboard operasional.
              </p>
            </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  required
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#2f7dd3] focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <button type="button" onClick={() => Swal.fire({ icon: 'info', title: 'Reset Password', text: 'Hubungi administrator Alkes untuk melakukan reset password akun Anda.', confirmButtonText: 'Mengerti', confirmButtonColor: '#2f7dd3' })} className="text-xs font-medium text-[#2f7dd3] hover:text-[#1d5fa6]">
                  Lupa password?
                </button>
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#2f7dd3] focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="font-semibold">Login gagal</p>
                  <p className="mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition ${
                loading
                  ? 'cursor-not-allowed bg-slate-400'
                  : 'bg-[#2f7dd3] hover:bg-[#246cb8] focus:outline-none focus:ring-4 focus:ring-blue-100'
              }`}
            >
              {loading ? 'Memverifikasi akun...' : 'Masuk ke Dashboard'}
            </button>
          </form>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200 pt-5 text-xs text-slate-500">
              <span>ALKES MEDIKA</span>
              <span>Secure medical supply access</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
