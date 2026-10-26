# Nera: backlog privasi, izin, keamanan dan legalitas

Status per 26 Oktober 2026 (branch `resan-dev`, commit `a1790e6`). Disusun dari sesi review sebelum Nera diajukan ke review BNI. Dokumen ini untuk agent atau developer yang mengerjakan perbaikannya. Ini bukan nasihat hukum; butir bertanda **[Manusia]** membutuhkan keputusan atau tindakan orang, bukan agent.

## Cara memakai dokumen ini

- Kerjakan berurutan menurut prioritas: **P0** menghambat review BNI atau peluncuran, **P1** pasti diminta saat review, **P2** perbaikan lanjutan.
- Setiap butir punya ID. Pakai ID itu di pesan commit (`fix(privacy): PRIV-01 ...`) dan centang di sini setelah selesai.
- Butir **[Manusia]** jangan dikerjakan sendiri oleh agent. Siapkan bahan pendukungnya, lalu berhenti dan laporkan.
- Baca bagian **Batasan yang tidak boleh dilanggar** sebelum mengubah kode apa pun.

## Batasan yang tidak boleh dilanggar

1. **Google Limited Use.** Data dari Gmail tidak boleh dipakai untuk skor, penilaian kredit, keputusan pinjaman, penawaran produk (Privileges), iklan, atau melatih model AI. Semua transaksi email bertipe `EmailTransaction` dengan `origin: "EMAIL"` (`apps/api/src/email/types.ts`). Mesin status dan skor di `packages/core` (`evaluateFinancialState`) serta `apps/web/src/app/(student)/privileges/page.tsx` tidak boleh membaca data ini.
2. **Tanpa persetujuan, tidak ada pemrosesan.** Impor email butuh persetujuan `email_import` dan AI butuh `ai_processing` (`apps/api/src/email/consent.ts`). Jangan memproses, mengimpor ulang, atau menghapus data user yang tidak punya persetujuan aktif.
3. **Isi email tidak disimpan.** Yang disimpan hanya nominal, merchant, tanggal, kategori, nomor pesanan, hash Message-ID, dan ID Gmail. "Lihat email asli" membaca langsung dari Gmail per permintaan pemiliknya (`transactionEmail` di `apps/api/src/email/gmail.ts`). Jangan menambahkan cache isi email.
4. **Rahasia hanya ada di server.** `GOOGLE_CLIENT_SECRET`, kunci MAIA, `SESSION_SECRET` dan `EMAIL_TOKEN_KEY` hanya ada di `~/nera/.env.deploy` di VPS. Jangan commit atau mencetaknya ke log atau output.
5. **Jangan mencabut grant Google saat menghapus link lokal.** Mencabut grant mematikan semua link ke akun Gmail yang sama (lihat `--drop-user` di `apps/api/scripts/reprocess-gmail.ts`).
6. **Impor ulang tidak destruktif.** Pakai `reimportGmail` dengan target `--query` dan `--providers` (staging lalu `adoptTransactions`). Perbaiki dengan SQL dulu kalau kolom yang tersimpan sudah cukup.

## Yang sudah baik (pertahankan)

- Persetujuan per fitur, berversi, dengan riwayat event (`nera_consent_events`).
- Scope Gmail baca saja. Refresh token terenkripsi AES-256-GCM (`apps/api/src/email/crypto.ts`).
- Isi email tidak disimpan. Data pribadi disamarkan sebelum dikirim ke AI (`apps/api/src/email/redact.ts`).
- Data email dipisahkan dari skor dan penawaran produk.
- Cabut persetujuan dan "Putuskan & hapus semua data email" tersedia untuk user.
- Cookie sesi bertipe HttpOnly, bertanda tangan, SameSite=Lax, dan Secure di HTTPS (`apps/api/src/auth/session.ts`).
- Kebijakan privasi publik di `/privacy` (`apps/web/src/app/privacy/page.tsx`).

---

## P0: penghambat

### SEC-01: Rotasi kunci MAIA **[Manusia]**
- **Masalah:** kunci API MAIA pernah ditempel di chat sesi pengembangan.
- **Tindakan manusia:** buat kunci baru di dashboard MAIA, ganti di `~/nera/.env.deploy`, deploy, lalu cabut kunci lama.
- **Tindakan agent:** pastikan kunci tidak ada di repo atau riwayat git, misalnya dengan menjalankan `gitleaks detect` (lihat REPO-01).
- **Selesai bila:** kunci lama tidak berlaku dan Bantuan AI tetap jalan dengan kunci baru.

### PRIV-01: Akses manusia ke mailbox user harus dengan izin dan tercatat
- **Masalah:**
  - Saat memperbaiki parser, tim membaca struktur email seorang user pilot (header pengirim, lalu label dan nominal yang disamarkan) lewat skrip sementara di container worker, tanpa izin eksplisit user dan tanpa jejak audit.
  - Google Limited Use hanya membolehkan manusia membaca data Gmail dengan izin eksplisit user, untuk keamanan, atau karena kewajiban hukum.
  - Kebijakan privasi juga belum menyebut akses ini.
- **Tugas:**
  1. Tabel `nera_support_grants (user_id, granted_at, expires_at, scope, reason)` dan tabel `nera_access_log (actor, user_id, action, target, at)` di `apps/api/src/email/store.ts`, untuk Memory dan Pg.
  2. Di halaman Email, tab Pengaturan: tombol "Izinkan tim Nera memeriksa emailku selama 7 hari" (beserta tombol cabut), yang membuat grant.
  3. Skrip dukungan di `apps/api/scripts/` wajib memanggil satu helper, misalnya `assertSupportGrant(userId)`, lalu mencatat ke `nera_access_log`. Tolak kalau grant tidak ada. Hapus pola "skrip sementara via `docker cp`".
  4. `GET /api/admin/overview` (`apps/api/src/routes/admin.ts`) ikut dicatat ke `nera_access_log`.
  5. Tambahkan bagian "Akses tim Nera" di `/privacy`: kapan, dengan izin, dan dicatat.
- **[Manusia]:** beri tahu user pilot yang emailnya sempat diperiksa.
- **Selesai bila:** tanpa grant aktif, skrip dukungan menolak berjalan, dan setiap akses tercatat beserta pelakunya.
- **Dampak ke fitur:** tidak ada untuk user biasa.

### PRIV-02: "Uangmu bertahan" memakai data email, dengan persetujuan ulang
- **Konteks:** user ingin estimasi di Beranda memakai riwayat Gmail. Kebijakan dan teks persetujuan sekarang menyatakan skor dan estimasi "uangmu bertahan" hanya dari BNI.
- **Keputusan sesi:** naikkan versi persetujuan (persetujuan ulang), bukan sekadar mengubah teks.
- **Tugas:**
  1. Hitung estimasi khusus tampilan di `apps/web/src/app/(student)/page.tsx`, bukan lewat `evaluateFinancialState`:
     - saldo = Aset Saya bila `assetsSet` (`apps/web/src/context/FinancialStore.ts`);
     - pengeluaran per hari = rata-rata 30 hari dari BNI + transaksi email yang dihitung (`isCountedSpend` di `apps/web/src/lib/emailSpending.ts`).
     - Kalau Aset belum diatur, tampilkan ajakan "Atur saldo", bukan angka demo.
  2. "Rekomendasi budget/hari" = sisa budget semua kantong bulan ini ÷ sisa hari, dibatasi oleh saldo ÷ sisa hari.
  3. Skor dan status tetap dari BNI. Beri keterangan kecil "Skor dari data BNI".
  4. Naikkan `CONSENT_VERSION` (`apps/api/src/email/consent.ts`) dan perbarui teks di `ConsentCard` (`apps/web/src/components/consent/`) serta `/privacy` (konstanta `VERSION` harus sama).
- **Perhatian:** setelah versi dinaikkan, `hasConsent` bernilai false untuk semua user lama, sehingga sinkronisasi Gmail mereka berhenti sampai mereka menyetujui ulang. Siapkan banner persetujuan ulang di Beranda dan halaman Email sebelum deploy.
- **Selesai bila:** user tanpa persetujuan versi baru tetap melihat estimasi tanpa data email, dan skor tidak berubah ketika data email berubah.

### INFRA-01: Lokasi data di Indonesia **[Manusia untuk keputusan]**
- **Masalah:** produksi berjalan di VPS Tencent Cloud, **Singapura** (AS132203). Postgres `nera-db` (transaksi dan token Gmail terenkripsi) juga ada di sana. Aturan OJK tentang TI bank umumnya mewajibkan data center dan DRC di Indonesia.
- **[Manusia]:** pilih tujuan: infrastruktur BNI, cloud region Jakarta, atau penyedia lokal.
- **Tindakan agent setelah keputusan:**
  - Tulis runbook migrasi di `deploy/README.md`: dump dan restore Postgres terenkripsi saat transit, pindahkan `.env.deploy`, DNS `nera.mentio.space`, redirect URI Google OAuth, topik Pub/Sub, dan MX untuk SMTP penerusan.
  - Cadangan terenkripsi di lokasi yang sama.
- **Dampak ke fitur:** tidak ada.

### AI-01: Bantuan AI lintas negara tanpa DPA
- **Masalah:**
  - Struk yang disamarkan dan ringkasan pengeluaran dikirim ke MAIA Router, lalu ke xAI (Grok) di luar Indonesia (`packages/ai/src/client.ts`, `extractWithAI` di `apps/api/src/email/extract.ts`, `apps/api/src/email/insights.ts`).
  - Belum ada perjanjian pemrosesan data (DPA). UU PDP Pasal 56 mengatur transfer lintas negara.
- **Tugas agent:**
  1. Flag konfigurasi `AI_ENABLED` di env server. Bila `false`: `extractWithAI` tidak dipanggil, kartu persetujuan AI disembunyikan, analisis memakai jalur tanpa AI yang sudah ada, dan chatbot tidak mendapat konteks email.
  2. Abstraksikan penyedia supaya bisa diganti ke penyedia berserver di Indonesia tanpa mengubah pemanggil.
- **[Manusia]:** tanda tangani DPA dengan MAIA, ganti penyedia, atau matikan AI untuk versi BNI.
- **Dampak ke fitur:** bila dimatikan, struk yang tidak terbaca aturan masuk "Perlu dicek" alih-alih ditebak AI. Sejak parser blu, wondr, Tokopedia dan Livin' diperbaiki, porsinya kecil.

### GOOGLE-01: Verifikasi OAuth Google dan audit CASA **[Manusia]**
- **Masalah:** scope `gmail.readonly` termasuk restricted. Aplikasi masih mode testing: maksimal 100 user, refresh token kedaluwarsa 7 hari, dan layar "aplikasi belum diverifikasi".
- **Tindakan agent (bahan pengajuan):**
  - Pastikan halaman beranda publik menjelaskan Nera dan menautkan `/privacy`.
  - Tulis pernyataan Limited Use secara verbatim di `/privacy`.
  - Tulis justifikasi scope dan naskah video demo di `docs/google-verification.md`.
- **[Manusia]:** ajukan verifikasi dan jalani penilaian keamanan CASA (tahunan).

---

## P1: pasti diminta saat review

### REPO-01: Bersihkan repo
- `apps/web/dev-server.log` ter-commit. Hapus file itu dan tambahkan `*.log` ke `.gitignore`.
- Jalankan pemindaian rahasia pada seluruh riwayat (`gitleaks detect --log-opts="--all"`). Bila ada temuan, laporkan ke manusia; jangan menulis ulang riwayat tanpa persetujuan.
- Pastikan `client_secret_*.json` tetap di-ignore dan file lokalnya dihapus **[Manusia]**.

### SEC-02: Pengerasan API
- Header keamanan (`helmet` atau setara) di `apps/api/src/server.ts`.
- Rate limit untuk `/api/auth/*`, `/api/email/*` (terutama `/transactions/:id/email` yang memanggil Gmail), `/api/email/inbound` dan `/api/email/gmail/push`.
- Masa sesi 30 hari (`MAX_AGE_S`) terlalu panjang untuk aplikasi keuangan. Usulkan 7 hari dengan sliding renewal, dan sediakan "keluar dari semua perangkat".
- Perlindungan CSRF: endpoint yang mengubah data harus menolak permintaan tanpa `Content-Type: application/json` atau tanpa header khusus. Cookie SameSite=Lax saja belum cukup untuk semua kasus.
- `pnpm audit` dan perbarui dependensi yang rentan.
- **[Manusia]:** VA/pentest oleh pihak independen.

### SEC-03: Data at rest dan cadangan
- Hanya token Gmail yang dienkripsi di level aplikasi; transaksi tersimpan polos di `nera_email_transactions`. Minimal: enkripsi disk volume Postgres dan cadangan terenkripsi. Dokumentasikan di `deploy/README.md`.
- Pastikan port Postgres tidak terbuka ke publik (cek `deploy/infra.yml`).

### SEC-04: Endpoint publik
- `/api/email/gmail/push` dilindungi `?token=GMAIL_PUSH_TOKEN`. Tambahkan verifikasi JWT OIDC dari Pub/Sub bila memungkinkan.
- SMTP penerusan (port 2525): batasi ukuran pesan, rate per alias, dan tolak alias yang tidak aktif. Periksa `apps/api/src/email/forward.ts`.

### DATA-01: Retensi
- Kebijakan sekarang: "selama akun aktif". Tetapkan batas, misalnya hapus data email akun yang tidak aktif 12 bulan.
- Tambah job di worker yang memakai `nera_users.last_seen_at`, lalu tulis ke `/privacy`.
- **[Manusia]:** tetapkan angkanya.

### DATA-02: Ekspor data ("Unduh dataku")
- `GET /api/email/export` mengembalikan JSON transaksi, persetujuan, link Gmail (tanpa token), dan aturan merchant. Tombolnya di tab Pengaturan.
- Ingat: artefak dan viewer di dalam app tidak selalu mendukung unduhan; uji di browser biasa.

### DATA-03: Minimalkan data di dashboard admin
- `/admin` menampilkan email user. Samarkan (misal `gu***@gmail.com`) kecuali admin sedang membuka satu user dengan grant PRIV-01, dan catat setiap akses.

### DOC-01: Dokumen untuk review BNI
Susun di `docs/compliance/`, isinya harus akurat terhadap kode:
- **Diagram alur data:** sumber (BNI demo, Gmail, penerusan), penyimpanan, dan pihak ketiga (Google, MAIA/xAI, Tencent Cloud).
- **Inventaris data / ROPA:** kolom yang disimpan, tujuan, dasar pemrosesan, retensi, siapa yang bisa mengakses.
- **Daftar pihak ketiga** beserta status perjanjiannya.
- **Draf DPIA:** risiko dan mitigasi; data keuangan skala besar tergolong berisiko tinggi.
- **Prosedur insiden:** kebocoran wajib dilaporkan dalam 3×24 jam ke user dan lembaga, termasuk kontak dan langkahnya.
- **Prosedur pengaduan nasabah.**

### LEGAL-01: Kontak resmi dan syarat layanan **[Manusia untuk isi]**
- Kontak data di `/privacy` masih email pribadi (`apps/web/src/app/privacy/page.tsx:101`). Ganti dengan alamat resmi atau DPO.
- Tambahkan halaman Syarat & Ketentuan, termasuk penafian bahwa Nera bukan penasihat keuangan.
- **[Manusia]:** tunjuk penanggung jawab data (DPO).

### BNI-01: SSO wondr dan data BNI asli **[Butuh tim BNI]**
- Saat Nera berjalan di dalam wondr, login Google (`/api/auth`) diganti sesi wondr. Google tetap dipakai hanya untuk menghubungkan Gmail.
- Saat API data BNI tersedia, saldo dan transaksi BNI berasal dari bank, bukan `INITIAL_*` demo di `packages/core`. Email wondr (`bni.co.id`, sender `BNI` di `apps/api/src/email/senders.ts`) lalu harus dikecualikan supaya transaksi tidak terhitung dua kali. "Atur Aset Saya" bisa diganti saldo otomatis.

---

## P2: perbaikan lanjutan

- **AGE-01, usia user:** Nera menyasar mahasiswa, sebagian bisa di bawah 18 tahun. UU PDP mensyaratkan persetujuan orang tua untuk anak. Tambahkan konfirmasi usia di onboarding (`apps/web/src/app/onboarding/page.tsx`); di bawah 18, impor email dan AI butuh alur persetujuan wali.
- **FAM-01, Family Hub:** pastikan orang tua hanya melihat yang sudah disetujui anak (`apps/web/src/app/(student)/family-hub/page.tsx`). Data email tidak pernah dibagikan ke orang tua tanpa persetujuan terpisah.
- **CAMPUS-01, dasbor kampus:** data agregat di `/campus` harus anonim dengan ukuran kelompok minimum (misal ≥ 10 orang per sel) dan tidak memakai data Gmail.
- **AI-02, transparansi AI:** tandai hasil yang dibuat AI (`extractedBy: "ai"`) di UI, misalnya "dibaca AI, mohon cek".
- **LOG-01, log server:** pastikan log container tidak memuat email user, isi email, atau token. Saat ini ada `console.log` di worker (`apps/api/src/email/gmail.ts`); audit semuanya.

## Keputusan yang menunggu manusia

| ID | Keputusan |
|---|---|
| INFRA-01 | Lokasi hosting di Indonesia |
| AI-01 | DPA dengan MAIA, ganti penyedia, atau matikan AI |
| DATA-01 | Lama retensi untuk akun tidak aktif |
| LEGAL-01 | Kontak resmi dan DPO |
| PRIV-01 | Pemberitahuan ke user pilot yang emailnya sempat diperiksa |
| BNI-01 | Status Nera: produk internal BNI atau kerja sama pihak ketiga (menentukan jalur review) |
