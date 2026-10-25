# END-TO-END FLOW: Nera PWA

Dokumen ini menjelaskan alur penggunaan setiap fitur di PWA Nera dari sudut pandang pengguna, dan bagaimana data mengalir di baliknya. Untuk detail formula skor lihat `STATE_MACHINE.md`, untuk visi produk lihat `PROJECT_CONTEXT.md`.

Semua state aplikasi hidup di satu Zustand store (`apps/web/src/context/FinancialStore.ts`), dipersist ke `localStorage` key `nera-financial-store`. Tidak ada backend nyata — semua kalkulasi (skor, DTI, runway, persona) dihitung di client dari fungsi murni di `packages/core`.

---

## 0. Mengakses Aplikasi

- Buka `/` (Beranda) — ini home tab pertama dari 5 tab `BottomNav`: **Beranda, Cek Risiko, Keluarga, Pemulihan, Investasi**.
- Setiap halaman dibungkus `MobileFrame` (mockup iPhone) + `TopAppBar` (logo/back button, ikon Coach, ikon Notifikasi, ikon "?" Demo Persona).
- Data awal (mock): user "Budi", kampus Telkom University, skor 34 (AMAN), alokasi 80% Daily Pocket / 20% Lock Pocket dari uang saku Rp2.000.000.

---

## 1. Beranda (`/`) — Daily Runway & Smart Pocket

**Tujuan:** dashboard harian, representasi Module 2 (Retensi Harian).

Alur:
1. **Hero Card** menampilkan badge status (`Skor X · Kondisi Sehat/Waspada/Kritis`), estimasi **Runway** (`runwayDays` hari lagi uang bertahan), progress bar, dan rekomendasi budget harian (`dailyBudgetSafe`).
2. **Daily Pocket** (uang siap pakai) vs **Lock Pocket** (BNI Life Goals, terkunci) ditampilkan berdampingan.
3. **Quick Action** — 4 tombol: Scan QRIS (buka modal catat transaksi manual), Transfer, Bayar Tagihan, Top Up (modal generik "Lanjutkan di wondr").
4. **Insight Nera** — kartu nudge kontekstual:
   - Tagihan kos jatuh tempo → tombol "Bayar via BNI" (memotong Daily Pocket, hilang dari daftar nudge).
   - Tagihan UKT dengan cashback info.
   - Smart Sweep akhir bulan → modal konfirmasi pindahkan sisa Daily Pocket ke Lock Pocket.
   - Insight belanja mingguan (statis, ilustratif).
5. **Manfaat BNI Untukmu** — kartu ringkas persona teratas hasil klasifikasi (lihat §6), tautan ke halaman `/privileges`.
6. **Transaksi Terakhir** — 5 transaksi terbaru dari store.

Setiap transaksi baru (`addTransaction`) otomatis:
- Mengurangi/menambah `dailyPocket`.
- Memicu `recalculateState()` → skor & status baru dihitung ulang.
- Jika transaksi masuk (income) → `detectAnomalies()` mengecek pola pinjol.

---

## 2. Cek Risiko (`/risk-check`) — AI Risk Intelligence & Rem Darurat

Representasi Module 0 (State Machine) + Module 3 (Rem Darurat 24 Jam).

Alur:
1. **Gauge skor risiko** (RiskGauge) + badge status + ringkasan DTI & jumlah cicilan aktif.
2. **Alert Anomali** (jika ada) — transfer masuk yang cocok pola pinjol/PayLater berisiko, dengan estimasi tekor per bulan. Bisa di-*acknowledge*.
3. **24-Hour Cooling-Off Timer** — muncul jika sedang aktif, berupa `ProgressRing` + countdown, dengan tombol "Batalkan Timer".
4. **Simulator Risiko Cicilan** — form input plafon, tenor, bunga, biaya admin → `simulateLoanImpact()` menghitung:
   - Cicilan per bulan, total bunga & biaya.
   - Proyeksi DTI dan skor baru (state machine dijalankan pada data hipotetis, tidak mengubah data asli).
   - **Reality Check UI** — jika berbahaya, tampil kartu merah "Tekor Rp X / bulan" + penjelasan dalam Rupiah nyata.
   - Tombol "Aktifkan 24-Hour Cooling-Off Timer" jika `coolingOffRequired`.
5. **Alternatif Aman Kampus** — daftar kartu (Kopma 0%, BNI Fleksi Pendidikan, Dana Darurat Kemahasiswaan) dengan link eksternal resmi.

---

## 3. Keluarga (`/family-hub`) — Aktivasi & Family Hub

Representasi Module 1.

Alur:
1. **Izin Akses Transparan** — banner "Batasan Sebelum Manfaat" menjelaskan Nera hanya baca kategori mutasi (read-only), toggle status izin (visual only).
2. **Parent-Child Link** — kartu akun ortu yang sudah terverifikasi, tombol "Tampilkan QR" (modal QR pairing) dan "Share Link".
3. **Smart Allowance Splitter** — slider 50–95% menentukan rasio Kebutuhan Harian vs Life Goals dari nominal uang saku yang diinput. Preview alokasi real-time. Tombol "Terapkan Alokasi Otomatis" memanggil `setAllowanceSplit()` → mengubah `monthlyAllowance`, `dailyPocket`, `lockPocket`, `dailyBudgetSafe`, lalu `recalculateState()`.
4. **Pratinjau Bulan Depan** — ringkasan tekstual alokasi berikutnya.

---

## 4. Pemulihan (`/recovery`) — AI Recovery Consultant

Representasi Module 4, aktif penuh saat status WASPADA/KRITIS.

Alur:
1. **Banner Mode Pemulihan** — merah (Kritis) atau kuning (Waspada), menyatakan semua produk investasi BNI dikunci total (`Reksa Dana`, `SBN/Sukuk`, `KPR/KKB` — chip terkunci).
2. **Ringkasan Kewajiban** — total sisa utang, beban/bulan, rasio DTI.
3. **Milestone Pemulihan** (`StepProgress`) — 5 tahapan berurutan: Identifikasi Kewajiban → Hentikan Pinjaman Baru → Lunasi Prioritas #1 → DTI di Bawah 40% → Kembali ke Status Aman. Status `isCompleted` dihitung otomatis oleh `updateRecoveryMilestones()` setiap kali state berubah.
4. **Debt Snowball** — tombol "Tambah Pos" membuka form (nama platform, sisa pokok, cicilan/bulan) → `addDebtItem()` → `calculateDebtSnowball()` mengurutkan dari pokok terkecil, menyusun `payoffPriority` dan langkah rekomendasi. Tombol "Tandai Lunas" menghapus pos dan menyusun ulang urutan.
5. **Rujukan Konseling Kampus** — tombol Telepon/Chat (placeholder alert).

---

## 5. Investasi (`/wealth-engine`) — Adaptive Wealth Engine

Representasi Module 5, hanya terbuka penuh jika status AMAN.

Alur:
1. **Header eligibility** — menyatakan apakah tangga investasi terbuka (butuh `state === "AMAN"` dan `safeConsecutiveMonths >= 2`).
2. **Streak Hijau** — visualisasi 8 minggu terakhir (kalkulasi kasar dari `safeConsecutiveMonths`).
3. **Tangga Kemapanan Finansial** — 3 tier berurutan:
   - **Tier 1: Dana Darurat** (BNI Life Goals) — wajib 100% sebelum tier lain terbuka. Tombol "Tambah" → modal deposit → `depositToLifeGoals()` menambah `lockPocket` dan progress tier.
   - **Tier 2: Reksa Dana Pasar Uang** — terbuka jika Tier 1 selesai.
   - **Tier 3: SBN/Sukuk** — terbuka jika Tier 2 selesai.
   Tier yang belum terbuka ditampilkan pudar dengan label "Terkunci".

---

## 6. Manfaat BNI Untukmu (`/privileges`) — Persona Privilege Hub *(Module 6, baru)*

Menjawab kebutuhan cross-sell produk BNI di luar investasi, disesuaikan persona pengguna.

Alur:
1. **Banner transparansi** — menegaskan skor & transaksi dipakai read-only untuk mencocokkan manfaat.
2. Jika status bukan AMAN → banner "Mode Proteksi Reputasi Aktif" dan **hanya** persona `Pejuang Pemulihan` yang tampil (mengunci semua produk investasi/kartu kredit, hanya menawarkan opsi resmi seperti BNI Fleksi Pendidikan).
3. Jika status AMAN → `classifyPersonas()` (di `packages/core`) menganalisis transaksi & angka finansial untuk mencocokkan 0–5 persona sekaligus (bisa lebih dari satu):
   - **Si Konsisten Nabung** — rasio Lock Pocket ≥20% dari uang saku & streak Aman ≥1 bulan → Reksa Dana BNI-AM, Sukuk Ritel.
   - **Pejuang Runway** — runway ≥14 hari → BNI Taplus Muda Co-Brand.
   - **Anak Rantau** — ada tagihan kos rutin → BNI Life proteksi kecelakaan.
   - **Calon Mapan** — tren uang saku naik & DTI <10% → Kartu Kredit BNI Pemula, BNI Griya Gue (edukasi).
   - **Wirausaha Kampus** — ada pemasukan rutin di luar kategori "allowance" → BNI Xpora.
4. Setiap kartu offer menampilkan **alasan match** (chip), benefit, sumber riset, dan tombol aksi:
   - `actionType: "wondr"` → modal hand-off "Lanjutkan di wondr" (pola sama dengan Quick Action Beranda).
   - `actionType: "external"` → link resmi BNI dibuka tab baru.

**Prinsip desain penting:** persona TIDAK PERNAH di-hardcode oleh UI — selalu hasil derivasi dari `transactions[]`, `score`, `state`, `lockPocket`, `runwayDays`, dll. yang sudah ada di store. Ini bisa dibuktikan lewat fitur di §7.

---

## 7. Nera Family Hub — Parent Dashboard (`/parent`) *(role baru)*

Portal terpisah untuk **Orang Tua**, mobile-first, tetap pakai `MobileFrame` yang sama tapi dengan `ParentBottomNav` sendiri (2 tab: Ringkasan, Alokasi). Diakses lewat menu "Lihat Sebagai" (§9) atau langsung ke `/parent`.

1. **Pairing Screen** — jika `isParentPaired` masih `false` (default), tampil form kode pairing + copy "Batasan Sebelum Manfaat". Submit memicu animasi sukses (Framer Motion) lalu `completeParentPairing()`.
2. **Ringkasan (`/parent`)** — setelah pairing:
   - Badge status + `RiskGauge` yang sama seperti Cek Risiko, **tanpa** daftar transaksi atau nama merchant apa pun (ditegakkan di level kode, ada komentar eksplisit di `parent/page.tsx`).
   - **Kartu Permintaan Top Up** — muncul jika ada `emergencyTopUpRequests` berstatus `pending`. Teks alasan diambil dari angka store asli (`dailyPocket`, `runwayDays`) saat data di-seed, bukan string statis lepas. Tombol "Top Up Sekarang" menambah `dailyPocket` lewat `resolveEmergencyTopUp()` — perubahan ini langsung terlihat juga di Beranda mahasiswa karena satu store yang sama.
3. **Alokasi (`/parent/allowance`)** — slider split yang identik dengan Smart Allowance Splitter di Family Hub, memanggil **action yang sama** (`setAllowanceSplit`) — tidak ada logika bisnis yang diduplikasi.

---

## 8. Nera Campus Financial Safety — Campus B2B Dashboard (`/campus`) *(role baru)*

Dashboard analitik **desktop** untuk pihak kampus, shell terpisah (`CampusSidebar`, bukan `MobileFrame`) karena target pengguna (staf kampus) membuka di laptop. Semua data di sini **statis, agregat, dan anonim** — tidak pernah terhubung ke `useFinancialStore` milik mahasiswa individu.

1. **Ringkasan (`/campus`)** — 3 kartu metrik (Total Mahasiswa Terpantau, Rata-rata Skor, % Zona Kritis) + `LineChart` tren skor semester + `PieChart` distribusi Aman/Waspada/Kritis (Recharts). Skeleton loading singkat saat pertama dimuat.
2. **Kohort Risiko (`/campus/cohorts`)** — tabel agregat per Fakultas × Angkatan, dengan disclaimer eksplisit "data teragregasi dan anonim".
3. **Peringatan (`/campus/alerts`)** — daftar alert intervensi (kritis/perhatian/info) dengan rekomendasi tindakan, dihasilkan dari pola agregat bukan pemantauan individu.

Sumber data: `packages/core/src/constants/campus-mock-data.ts` (`CAMPUS_OVERVIEW_METRICS`, `CAMPUS_SEMESTER_TREND`, `CAMPUS_SCORE_DISTRIBUTION`, `CAMPUS_COHORT_RISK`, `CAMPUS_INTERVENTION_ALERTS`).

---

## 9. Menu Demo & Role Switcher

Ikon "?" di `TopAppBar` (dipakai di semua halaman Student & Parent) membuka satu dropdown gabungan (`DemoControlPanel.tsx`) berisi tiga bagian:

- **Lihat Sebagai** — 3 tautan role: Tampilan Mahasiswa (`/`), Tampilan Orang Tua (`/parent`), Tampilan Kampus (`/campus`). Campus tidak punya `TopAppBar` (pakai sidebar sendiri), jadi tautan setara ada di footer `CampusSidebar`.
- **Warna Latar Mockup** — color picker (swatch `<input type="color">` + input teks hex yang bisa diketik manual, saling sinkron) untuk mengganti warna kanvas di sisi-sisi mockup HP (area gelap di sekitar frame iPhone). Tersimpan di store terpisah `UiPreferencesStore.ts` (key `nera-ui-preferences`, persist ke localStorage), dibaca langsung oleh `MobileFrame.tsx`. Ada tombol reset ke default (`#0F172A`). Hanya berlaku untuk Student & Parent (yang pakai `MobileFrame`) — Campus punya shell desktop sendiri jadi tidak relevan.
- **Ganti Persona (Mahasiswa)** — 6 skenario demo, detail lihat §10.

Ini murni alat bantu demo/navigasi untuk prototipe tanpa sistem login sungguhan — bukan representasi auth production.

---

## 10. Demo: Ganti Persona *(alat bantu demo/juri, bukan fitur produksi)*

Bagian bawah dari dropdown "Menu Demo" yang sama di §9, berisi 6 skenario:

> Si Konsisten Nabung · Pejuang Runway · Anak Rantau · Calon Mapan · Wirausaha Kampus · Pejuang Pemulihan

Memilih salah satu memanggil `applyPersonaDemoScenario(personaId)` yang **hanya mengganti angka mentah** (transaksi, `monthlyAllowance`, `dailyPocket`, `lockPocket`, `totalMonthlyInstallments`, `activeDebts`, dst. — didefinisikan di `packages/core/src/constants/demo-scenarios.ts`), lalu memanggil `recalculateState()` yang sama seperti alur normal. Skor, status, dan persona yang muncul di halaman **Manfaat BNI Untukmu** adalah hasil kalkulasi ulang state machine + classifier — bukan nilai yang di-set langsung oleh tombol ini. Ini untuk membuktikan ke juri bahwa mesin klasifikasinya nyata, bukan mock UI statis.

---

## Peta Alur Data (Ringkas)

```
User Action (klik tombol/form)
   → Store action (FinancialStore.ts)
      → mengubah angka mentah (transactions, pocket, allowance, debts)
      → recalculateState()
          → evaluateFinancialState() [packages/core/state-machine/risk-score.ts]
              → hitung DTI, runway, deteksi stacking
              → tentukan score (0–100) & state (AMAN/WASPADA/KRITIS)
          → updateRecoveryMilestones()
   → Re-render halaman yang subscribe ke store (Zustand)
   → classifyPersonas() [dipanggil terpisah di Beranda & /privileges]
      → mencocokkan persona dari angka yang sama
      → menampilkan offer BNI relevan dari BNI_OFFERS catalog
```

## Peta File Kunci

| Area | File |
|---|---|
| State & actions | `apps/web/src/context/FinancialStore.ts` |
| Formula skor risiko | `packages/core/src/state-machine/risk-score.ts` |
| Formula debt snowball | `packages/core/src/formulas/debt-snowball.ts` |
| Simulasi pinjaman | `packages/core/src/formulas/loan-simulator.ts` |
| Classifier persona | `packages/core/src/state-machine/persona-classifier.ts` |
| Katalog produk BNI | `packages/core/src/constants/index.ts` (`BNI_OFFERS`) |
| Skenario demo persona | `packages/core/src/constants/demo-scenarios.ts` |
| Mock data kampus (anonim) | `packages/core/src/constants/campus-mock-data.ts` |
| Komponen UI bersama | `packages/ui/src/components/*` |
| Halaman student (route group) | `apps/web/src/app/(student)/{page,risk-check,family-hub,recovery,wealth-engine,privileges}/page.tsx` |
| Halaman & komponen Orang Tua | `apps/web/src/app/parent/**`, `apps/web/src/components/parent/*` |
| Halaman & komponen Kampus | `apps/web/src/app/campus/**`, `apps/web/src/components/campus/*` |
| Menu Demo (role + persona switcher) | `apps/web/src/components/common/DemoControlPanel.tsx` |
