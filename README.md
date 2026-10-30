# 🎓 Aplikasi Tryout TKA SD (Tes Kemampuan Akademik Jenjang SD)

Aplikasi web tryout modern, responsif, dan siap produksi untuk **Tes Kemampuan Akademik (TKA) jenjang Sekolah Dasar (Literasi & Numerasi)**. Dirancang dengan antarmuka **Dark Glassmorphism Emerald/Mint** terinspirasi dari referensi desain dashboard *NexusBank*, berbasis serverless **Google Apps Script** dan basis data **Google Sheets**, serta siap dideploy ke **Vercel**.

---

## 🌟 Fitur Utama

### 1. Desain & Antarmuka Modern (NexusBank Dark Glassmorphism)
- **Palet Warna Futuristik**: Latar belakang dark emerald/cyan (`#070e0e`, `#0d1717`), aksen mint neon (`#00E599`), status badge glow, pill button, dan glass card transparan dengan efek `backdrop-filter: blur(16px)`.
- **Sidebar Ikonik Vertikal**: Sesuai dengan referensi desain dengan tooltip interaktif dan penanda aktif bercahaya.
- **Visualisasi Chart Real-time**: Grafik batang pengerjaan ujian dan donat komposisi materi Literasi vs Numerasi.
- **Responsif Penuh**: Tampilan optimal untuk Desktop, Tablet, dan Smartphone siswa.

### 2. Portal Ujian Siswa (`/` - `index.html`)
- **Autentikasi Token Fleksibel**: Siswa memasukkan nama, rombel/kelas, dan token ujian yang dibuat oleh admin.
- **Konfirmasi Detail Paket**: Menampilkan judul, durasi waktu, jumlah soal, dan syarat pengerjaan sebelum memulai.
- **Lembar Kerja Interaktif**:
  - Pilihan Ganda Tunggal (*Single Choice*) & Pilihan Ganda Kompleks (*Multi-Select Checkboxes*).
  - Tanda Ragu-ragu (*Mark for Review*) dengan warna pembeda di palet navigasi nomor soal.
  - Autosave otomatis ke penyimpanan lokal browser setiap 30 detik untuk mengantisipasi mati listrik atau koneksi terputus.
  - Palet nomor soal dengan indikator status: Terjawab (Hijau), Ragu-ragu (Kuning), Belum Dijawab (Abu-abu), Sedang Dibuka (Border Mint).
- **Keamanan Ujian (Anti-Curang)**:
  - Countdown timer tersinkronisasi dengan validasi backend; siswa tidak dapat memanipulasi waktu lokal perangkat.
  - Kunci jawaban dan pembahasan **tidak pernah dikirim ke browser siswa** sebelum ujian diserahkan (*submitted*).
  - Kunci anti-double submission untuk mencegah pengumpulan ganda.
- **Hasil Instan & Pembahasan**:
  - Skor otomatis berskala 0–100, rincian benar, salah, dan kosong.
  - Keterangan kelulusan KKM.
  - Pembahasan butir soal lengkap dengan penjelasan langkah demi langkah (apabila diizinkan oleh paket ujian).

### 3. Portal Administrasi (`/admin` - `admin.html`)
- **Login Terproteksi**: Autentikasi sesi token dengan enkripsi SHA-256 pada backend Google Apps Script.
- **Dashboard Ringkasan**: 6 kartu metrik utama (Total Paket, Bank Soal, Token, Siswa, Percobaan Selesai, Rata-rata Nilai) serta riwayat aktivitas terkini.
- **Bank Soal & Media Manager**:
  - CRUD butir soal lengkap (Kode, Kategori Literasi/Numerasi, Tipe, Batang Soal, Opsi A-D, Kunci, Pembahasan, Kesulitan).
  - Filter kategori, jenis jawaban, dan kotak pencarian teks dinamis.
  - **Media Manager Gambar**: Upload gambar langsung dari perangkat untuk batang soal dan setiap opsi jawaban. Gambar disimpan rapi ke Google Drive dan dirender proporsional tanpa terpotong (`object-fit: contain`).
- **Import Soal CSV / Excel**:
  - Disediakan file template resmi `template_import_soal.csv`.
  - Parser CSV pintar dengan dukungan tanda petik ganda.
  - **Laporan Validasi Per Baris**: Menampilkan jumlah baris valid vs bermasalah serta rincian kesalahan sebelum disimpan ke database.
- **Paket Tryout Builder**:
  - Atur judul, durasi menit, batas percobaan pengerjaan, dan toggle izin melihat pembahasan.
  - Pemilih soal interaktif (*Question Picker*) berbasis checkbox dengan counter otomatis.
- **Generator Token Siswa**:
  - Pembuatan token acak 7 digit unik untuk paket tertentu.
  - Fitur 1-klik salin (*Copy to Clipboard*) dan saklar aktivasi/nonaktif token instan.
- **Rekap Hasil & Ekspor CSV**:
  - Daftar nilai seluruh siswa.
  - Tombol **Ekspor Hasil ke CSV** untuk integrasi ke rapor atau arsip sekolah.
- **Pengaturan API**:
  - Konfigurasi URL Google Apps Script Web App langsung dari dashboard admin.
  - Smart Offline Demo Fallback otomatis aktif jika URL belum diisi.

---

## 📁 Struktur Direktori

```text
ujian/
├── index.html                  # Halaman Portal Ujian Siswa (Root Route /)
├── admin.html                  # Halaman Admin Portal (/admin)
├── vercel.json                 # Konfigurasi routing & security headers Vercel
├── template_import_soal.csv    # Template CSV import soal TKA SD
├── Code.gs                     # Backend Google Apps Script (Single-File)
├── css/
│   └── style.css               # Desain Sistem Glassmorphism Dark Mint (NexusBank Style)
├── js/
│   ├── config.js               # Konfigurasi URL API & Storage Keys
│   ├── api.js                  # Jaringan API Universal + Offline Mock Database
│   ├── student.js              # Controller Pengerjaan Ujian Siswa
│   └── admin.js                # Controller Dashboard Admin & Bank Soal
└── README.md                   # Dokumentasi Panduan Lengkap
```

---

## 🚀 Panduan Setup Backend (Google Sheets & Apps Script)

Backend aplikasi dirancang dalam **satu file tunggal `Code.gs`** untuk memudahkan instalasi tanpa konfigurasi server yang rumit.

### Langkah 1: Buat Google Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet, misalnya: `Database Tryout TKA SD`.

### Langkah 2: Buka Google Apps Script Editor
1. Pada menu Google Sheets, klik **Extensions** (Ekstensi) > **Apps Script**.
2. Hapus kode bawaan di editor `Code.gs`.
3. Buka file `Code.gs` dari folder proyek ini, salin seluruh kodenya, dan tempelkan ke editor Apps Script.
4. Klik ikon **Save** (Simpan).

### Langkah 3: Inisialisasi Database
1. Pada dropdown daftar fungsi di bagian atas editor Apps Script, pilih fungsi `setupDatabase`.
2. Klik tombol **Run** (Jalankan).
3. Google akan meminta izin akses (*Authorization Required*):
   - Klik **Review Permissions** (Tinjau Izin).
   - Pilih akun Google Anda.
   - Klik **Advanced** (Lanjutan) > Klik **Go to Database Tryout TKA SD (unsafe)**.
   - Klik **Allow** (Izinkan).
4. Fungsi `setupDatabase()` akan otomatis membuat sheet-sheet berikut secara rapi:
   - `USERS` (Akun admin dengan password terenkripsi SHA-256)
   - `STUDENTS` (Direktori peserta)
   - `QUESTIONS` (Bank soal Literasi & Numerasi)
   - `PACKAGES` (Paket ujian)
   - `TOKENS` (Daftar token pengerjaan)
   - `ATTEMPTS` (Lembar jawaban & riwayat pengerjaan siswa)
   - `SETTINGS` (Konfigurasi aplikasi & batas KKM)
   - `AUDIT_LOG` (Catatan riwayat transaksi admin)
5. Folder Google Drive bernama `TKA_SD_MEDIA` juga akan otomatis dibuat untuk menampung gambar soal dan opsi.

### Langkah 4: Deploy sebagai Web App
1. Di pojok kanan atas Apps Script, klik tombol biru **Deploy** > **New deployment**.
2. Klik ikon gerigi (Select type) di sebelah kiri > Pilih **Web app**.
3. Isi parameter deployment:
   - **Description**: `Produksi Tryout v1`
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone` *(Wajib dipilih agar siswa dan admin dapat mengakses API tanpa login akun Google)*.
4. Klik **Deploy**.
5. Salin URL Web App yang diberikan (berakhiran `/exec`).  
   *Contoh format: `https://script.google.com/macros/s/AKfycb.../exec`*

---

## 🔗 Menghubungkan Frontend ke Backend

Anda dapat menyambungkan frontend ke Web App Google Apps Script melalui dua cara:

### Cara A: Melalui Antarmuka Admin (Paling Mudah)
1. Buka aplikasi di browser (buka `admin.html` atau buka route `/admin`).
2. Masuk menggunakan akun admin default:
   - **Username**: `admin`
   - **Password**: `AdminTKA2026!`
3. Buka menu **Pengaturan & API** (ikon gerigi pada sidebar).
4. Tempelkan URL Web App Anda pada kolom **Google Apps Script Web App URL**.
5. Klik **Simpan URL API**. Frontend akan otomatis terhubung ke Google Sheets Anda!

### Cara B: Melalui File `js/config.js`
Buka file `js/config.js` dan ubah nilai `DEFAULT_LIVE_URL`:
```javascript
const TKA_CONFIG = {
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  // ...
};
```

> **Mode Demo Offline:**  
> Jika URL belum disetel, aplikasi secara otomatis berjalan dalam **Mode Demo Interaktif** menggunakan database lokal (`js/api.js`). Anda dapat langsung menguji alur login admin, pembuatan paket, penerbitan token, dan pengerjaan siswa tanpa backend sama sekali!

---

## 🌐 Panduan Deployment Frontend ke Vercel

Aplikasi ini sudah dilengkapi dengan file `vercel.json` yang menangani rewrites URL (`/admin` menuju `admin.html`) dan security header.

### Opsi 1: Deploy via Vercel Dashboard (GitHub)
1. Buat repositori baru di GitHub (misal: `tryout-tka-sd`) dan push seluruh file proyek ini.
2. Buka [Vercel Dashboard](https://vercel.com/dashboard) dan klik **Add New...** > **Project**.
3. Hubungkan repositori GitHub Anda.
4. Biarkan pengaturan default (Framework Preset: *Other*, Root Directory: `./`).
5. Klik **Deploy**.
6. Aplikasi Anda siap diakses secara global dengan domain gratis `*.vercel.app`!

### Opsi 2: Deploy via Vercel CLI
Jalankan perintah berikut di direktori proyek:
```bash
npm install -g vercel
vercel
```
Ikuti instruksi interaktif di terminal, dan aplikasi akan langsung terunggah ke Vercel.

---

## 🔑 Kredensial Default & Akun Demo

- **Admin Portal**: Buka `/admin` atau `admin.html`
  - **Username**: `admin`
  - **Password**: `AdminTKA2026!`
- **Demo Token Ujian Siswa**:
  - **Kode Token**: `TKASD26` (Atau buat token baru dari dashboard admin)

---

## 📝 Format File CSV Import Soal

Gunakan template `template_import_soal.csv` yang disertakan di repositori. Struktur kolom wajib:

| Kolom | Tipe | Deskripsi / Contoh |
| :--- | :--- | :--- |
| `question_code` | Teks | Kode unik butir soal (contoh: `LIT-001`, `NUM-002`) |
| `type` | Teks | Kategori wajib: `LITERASI` atau `NUMERASI` |
| `question_text` | Teks | Teks narasi / pertanyaan soal |
| `question_type` | Teks | `MULTIPLE_CHOICE` (Pilihan ganda) atau `MULTI_SELECT` (Kompleks) |
| `option_a` | Teks | Teks pilihan jawaban A |
| `option_b` | Teks | Teks pilihan jawaban B |
| `option_c` | Teks | Teks pilihan jawaban C |
| `option_d` | Teks | Teks pilihan jawaban D |
| `correct_answer`| Teks | Kunci jawaban: `A`, `B`, `C`, `D`, atau `A,C` jika multi-select |
| `explanation` | Teks | Pembahasan detail soal untuk siswa |
| `difficulty` | Teks | Tingkat kesulitan: `MUDAH`, `SEDANG`, atau `SULIT` |
| `status` | Teks | Status soal: `ACTIVE` |

### Penanganan Gambar Soal (Media Manager)
- Database Google Sheets tidak disarankan menyimpan data biner base64 langsung di dalam sel karena batasan ukuran 50.000 karakter per sel.
- Sistem ini menyediakan tombol **👁️ Pratinjau & Media** di setiap butir soal pada dashboard admin.
- Admin dapat memilih file gambar PNG/JPG langsung dari laptop/smartphone untuk batang soal maupun opsi A–D. Gambar akan otomatis diunggah ke Google Drive dan URL-nya tersimpan di database.
- Tampilan gambar di lembar ujian siswa menggunakan `object-fit: contain` dan rasio responsif sehingga gambar tidak terpotong atau terdistorsi.

---

## 🧪 Checklist Pengujian Manual (End-to-End)

Untuk memastikan seluruh alur berjalan sempurna:

1. **Pengujian Admin Login**:
   - [ ] Buka `admin.html` di browser.
   - [ ] Masukkan `admin` dan `AdminTKA2026!`.
   - [ ] Pastikan dashboard NexusBank terbuka dengan 6 kartu metrik dan grafik visual.
2. **Pengujian Bank Soal & Import CSV**:
   - [ ] Buka tab **Bank Soal**.
   - [ ] Klik **📥 Import CSV/Excel**, pilih `template_import_soal.csv`.
   - [ ] Verifikasi laporan validasi per baris muncul (8 soal valid).
   - [ ] Klik **Terbitkan Soal Valid** dan pastikan soal muncul di tabel.
   - [ ] Klik tombol **👁️ Pratinjau & Media** pada salah satu soal, coba unggah foto ilustrasi batang soal.
3. **Pengujian Pembuatan Paket & Token**:
   - [ ] Buka tab **Paket Tryout** > Klik **+ Buat Paket Baru**.
   - [ ] Masukkan judul paket, durasi (misal 15 menit), centang soal yang ingin diujikan, lalu simpan.
   - [ ] Buka tab **Token Siswa** > Klik **+ Buat Token Baru**.
   - [ ] Pilih paket yang baru dibuat, klik **Terbitkan Token**.
   - [ ] Klik tombol **Salin** pada token yang terbuat.
4. **Pengujian Pengerjaan Ujian Siswa**:
   - [ ] Buka `index.html` di tab browser lain (atau jendela incognito).
   - [ ] Masukkan nama siswa, rombel/kelas, dan tempelkan token yang tadi disalin.
   - [ ] Klik **Konfirmasi & Mulai Pengerjaan**.
   - [ ] Pastikan timer berjalan mundur, navigasi soal berpindah lancar.
   - [ ] Coba tombol **Tandai Ragu-ragu (Kuning)** dan pilih beberapa jawaban.
   - [ ] Coba muat ulang halaman (*refresh browser*) untuk memastikan autosave memulihkan jawaban siswa.
   - [ ] Klik **Selesai & Kumpulkan Ujian** pada nomor terakhir.
   - [ ] Konfirmasi pengumpulan, pastikan halaman skor muncul dengan nilai, analisis kelulusan, dan pembahasan soal.
5. **Pengujian Rekap & Ekspor Nilai**:
   - [ ] Kembali ke tab admin, buka menu **Hasil & Rekap**.
   - [ ] Pastikan nama siswa dan skor hasil ujian tadi tercatat secara real-time.
   - [ ] Klik tombol **Ekspor Hasil ke CSV** dan verifikasi file CSV berhasil terunduh dengan rapi.

---

## 🛡️ Keamanan & Kepatuhan Integritas Ujian

1. **Backend Session Guard**: Setiap request admin memvalidasi token sesi aktif; siswa tidak dapat memicu aksi admin.
2. **Anti-Leak Kunci Jawaban**: Endpoint `get_exam_package` menghapus properti `correct_answer` dan `explanation` sebelum data dikirim ke siswa. Jawaban baru dinilai di server saat `submit_exam`.
3. **Anti-Tamper Timer**: Waktu mulai pengerjaan dicatat di backend saat token divalidasi. Waktu pengumpulan dicek toleransinya terhadap durasi paket untuk mencegah manipulasi jam di browser.
4. **Anti-Double Submission**: Pengerjaan yang sudah berstatus `SUBMITTED` dikunci otomatis di backend menggunakan `LockService` Google Apps Script.

---

## 📄 Lisensi
Hak Cipta © 2026. Dikembangkan untuk kemajuan pendidikan dasar dan evaluasi akademik siswa Sekolah Dasar di Indonesia.
