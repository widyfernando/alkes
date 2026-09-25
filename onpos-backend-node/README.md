# ONPOS Backend Node

Migrasi awal backend Flask ke Node.js Express dengan PostgreSQL existing.

## Setup

```powershell
cd D:\onpos\onpos-backend\onpos-backend-node
copy .env.example .env
npm install
npm run seed
npm run dev
```

Backend jalan di `http://localhost:5000`.

Deployment production menggunakan konfigurasi Vercel di folder backend ini dan
membaca koneksi Supabase dari `DATABASE_URL` atau variable `DB_*` terpisah.

## Endpoint yang sudah dimigrasi

- `POST /login`
- `GET /user?page=1&per_page=10`
- `POST /user`
- `PUT /user?user_id=...`
- `GET /detail_user?user_id=...`
- `PUT /set_status_user?user_id=...`
- `PUT /reset_password?user_id=...`
- `GET|PUT /perusahaan`
- `GET|POST|PUT /departemen`
- `GET /detail_departemen?dept_id=...`
- `GET|POST|PUT /jabatan`
- `GET /detail_jabatan?jabatan_id=...`
- `GET|POST|PUT /grup`
- `GET /detail_grup?grup_id=...`
