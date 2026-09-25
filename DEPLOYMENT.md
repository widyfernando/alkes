# Deployment Alkes

Arsitektur production:

- Frontend React: Vercel
- Backend Node.js/Express: Render
- Database PostgreSQL: Supabase

## Alternatif tanpa kartu: backend di Vercel

Jika Render meminta verifikasi kartu, backend Express dapat dijalankan sebagai project Vercel kedua pada plan Hobby:

1. Import repository yang sama ke Vercel.
2. Beri nama project `alkes-api`.
3. Set **Root Directory** ke `onpos-backend-node`.
4. Tambahkan environment variable backend seperti pada bagian Render, tetapi gunakan Supabase **Transaction pooler** port `6543` dan set `DATABASE_POOL_MAX=1`.
5. Deploy. File `onpos-backend-node/vercel.json` mengatur Express, region Singapore, migrasi, dan seed otomatis.

Sebagai alternatif `DATABASE_URL`, Vercel dapat memakai `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD` secara terpisah. Cara ini menghindari kebutuhan URL-encode untuk password yang mengandung simbol.

Untuk project Alkes, backend mengenali project reference Supabase dan membentuk username Shared Pooler secara otomatis. `DB_USER` dapat dihapus dari Vercel; jika project Supabase diganti, isi `SUPABASE_PROJECT_REF` dengan reference project yang baru.

Untuk Shared Pooler Supabase yang mengembalikan rantai sertifikat privat, set `DATABASE_SSL=true` dan `DATABASE_SSL_REJECT_UNAUTHORIZED=false`. Koneksi tetap memakai TLS, tetapi validasi CA oleh client Node dinonaktifkan. Untuk verifikasi sertifikat penuh, pasang CA certificate Supabase pada runtime dan pertahankan nilai `true`.

Frontend kemudian diimport sebagai project Vercel terpisah dengan Root Directory repository (`.`). Dengan susunan ini frontend dan backend memiliki URL berbeda, tetapi keduanya tetap auto-deploy dari repository GitHub yang sama.

Tidak ada password, DSN, atau secret production yang disimpan di repository. Semua nilai rahasia harus dimasukkan lewat dashboard masing-masing layanan.

## 1. Supabase

1. Buat project Supabase dan simpan database password dengan aman.
2. Buka **Connect** lalu salin URI **Session pooler**. Mode ini cocok untuk backend Render yang berjalan terus-menerus dan membutuhkan koneksi IPv4.
3. Pastikan URI memakai SSL. Jika belum memiliki parameter, tambahkan `?sslmode=require` di akhir URI.
4. Migrasi dan data awal akan dijalankan otomatis saat backend pertama kali aktif di Render. Jika ingin menginisialisasi dari komputer lokal, jalankan:

   ```powershell
   cd onpos-backend-node
   $env:DATABASE_URL='postgresql://...'
   $env:DATABASE_SSL='true'
   npm run db:migrate
   npm run seed
   Remove-Item Env:DATABASE_URL
   Remove-Item Env:DATABASE_SSL
   ```

Seeder membuat akun bootstrap `admin123`. Setelah login pertama, segera ganti password akun tersebut.

Jika database lokal lama harus ikut dipindahkan, gunakan menu **Database > Backups/Migrations** atau `pg_dump`/`psql`. Jangan jalankan seed setelah data production telah diimpor jika akun dan master data sudah tersedia.

## 2. Backend di Render

Repository sudah memiliki `render.yaml`. Di Render pilih **New > Blueprint**, hubungkan repository, lalu pilih Blueprint tersebut.

Isi environment variable yang bertanda manual:

| Variable | Nilai |
| --- | --- |
| `DATABASE_URL` | URI Session pooler Supabase dengan `sslmode=require` |
| `CORS_ORIGINS` | URL final Vercel, misalnya `https://alkes-pos.vercel.app` |
| `SENTRY_DSN` | DSN project backend Node di Sentry |

`SECRET_KEY` dibuat otomatis oleh Render. Jangan menggantinya setelah aplikasi dipakai karena token login yang lama akan menjadi tidak valid.

Setelah deploy, periksa:

- `https://NAMA-SERVICE.onrender.com/health` mengembalikan status sukses.
- Login dan endpoint API dapat diakses dari frontend.
- Tidak ada error koneksi database di **Render > Logs**.

Startup Render menjalankan migrasi dan seed idempoten sebelum server aktif. Database baru langsung memiliki tabel dan data awal, sedangkan deploy berikutnya tidak mereset password admin atau menggandakan penomoran.

## 3. Frontend di Vercel

Import repository di Vercel dan gunakan root directory repository (`.`). `vercel.json` sudah mengatur preset Create React App, build, output, dan fallback React Router.

Tambahkan environment variable untuk Production, Preview, dan Development bila diperlukan:

| Variable | Nilai |
| --- | --- |
| `REACT_APP_API_URL` | URL backend Render tanpa slash terakhir |
| `REACT_APP_SENTRY_DSN` | DSN project frontend React di Sentry |
| `REACT_APP_SENTRY_ENVIRONMENT` | `production` |
| `REACT_APP_SENTRY_TRACES_SAMPLE_RATE` | `0.1` |
| `REACT_APP_SENTRY_ISSUES_URL` | URL halaman Issues project frontend |

Setelah URL Vercel diketahui, kembali ke Render dan pastikan `CORS_ORIGINS` berisi URL tersebut. Untuk beberapa domain, pisahkan dengan koma, misalnya:

```text
https://alkes-pos.vercel.app,https://app.domainanda.com
```

Setiap perubahan variable frontend memerlukan redeploy Vercel karena variable `REACT_APP_*` dimasukkan saat proses build.

## 4. Pemeriksaan akhir

1. Buka URL Vercel dan login.
2. Uji dashboard, transaksi, pembatalan transaksi, dan report.
3. Jalankan test event frontend dan backend, lalu pastikan keduanya muncul di Sentry.
4. Periksa log Render serta Network tab browser untuk memastikan tidak ada CORS, `401`, atau `500` yang tidak diharapkan.
