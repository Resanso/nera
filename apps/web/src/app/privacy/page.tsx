import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan Privasi | Nera" };

// Keep in sync with CONSENT_VERSION in apps/api/src/email/consent.ts
const VERSION = "27 Oktober 2026";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Tentang Nera",
    body: (
      <p>
        Nera adalah modul keamanan finansial untuk mahasiswa di dalam wondr by BNI. Halaman ini menjelaskan data apa yang
        Nera proses, untuk apa, dan hak kamu atas data tersebut.
      </p>
    ),
  },
  {
    title: "Data yang kami proses",
    body: (
      <ul>
        <li>Akun: alamat email dan ID akun Google yang kamu pakai untuk masuk.</li>
        <li>
          Impor email (hanya dengan persetujuanmu): email pembayaran dari pengirim yang terdaftar (bank, e-wallet,
          marketplace, transportasi) dan email yang Gmail kelompokkan sebagai Pembelian. Dari setiap email kami simpan
          nominal, merchant, tanggal, kategori dan nomor pesanan. Isi email tidak disimpan.
        </li>
        <li>Alamat penerusan: email yang kamu teruskan ke alamat Nera milikmu diproses dengan cara yang sama.</li>
        <li>
          Kantong (kalau kamu masuk dengan Google): total saldo yang kamu isi sendiri, pemasukan bulanan, kantong dan
          riwayatnya tersimpan di server Nera, supaya angkanya sama di semua perangkat. Tanpa masuk, semuanya hanya ada di
          perangkatmu. Dengan &quot;Estimasi dari struk email&quot;, saldo yang bisa dipakai berkurang sesuai struk email sejak saldo
          terakhir kamu isi atau konfirmasi; dihitung di server dari transaksi yang sudah diimpor. Data BNI lain di aplikasi
          masih data demo.
        </li>
        <li>
          Pengingat (hanya kalau kamu menyalakannya): alamat notifikasi browsermu dan pilihan tampilan nominal. Isi
          pengingatnya diambil dari kantong Rencana dadakan di atas. Mematikan pengingat di semua perangkat menghapus
          alamat notifikasi itu dari server.
        </li>
      </ul>
    ),
  },
  {
    title: "Untuk apa data dipakai",
    body: (
      <>
        <p>
          Hanya untuk fitur yang kamu lihat: riwayat transaksi, grafik, pemakaian dan rekomendasi kantong, Insight Nera dan
          kartu Pengeluaran di Beranda, analisis &quot;Ke mana uangku?&quot; dan saran di chatbot Nera.
        </p>
        <p>
          Estimasi &quot;uangmu bertahan&quot; dan rekomendasi budget harian di Beranda memakai struk email{" "}
          <strong>hanya jika</strong> kamu menyalakan &quot;Estimasi dari struk email&quot;; tanpa itu, keduanya memakai data
          BNI. Pengaturan yang sama membuat saldo di Kantong berkurang sendiri sesuai struk email. Skor kondisi keuangan selalu
          dihitung dari data BNI saja.
        </p>
        <p>
          Data dari email <strong>tidak</strong> dipakai untuk penilaian kredit, keputusan pinjaman, penawaran produk
          atau iklan, <strong>tidak</strong> dijual, dan <strong>tidak</strong> dipakai untuk melatih model AI umum.
        </p>
        <p>
          Penggunaan dan pengalihan informasi yang Nera terima dari Google API mematuhi{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , termasuk ketentuan Limited Use.
        </p>
      </>
    ),
  },
  {
    title: "Bantuan AI (opsional)",
    body: (
      <>
        <p>Hanya jika kamu mengaktifkan &quot;Bantuan AI&quot;:</p>
        <ul>
          <li>
            Struk yang tidak terbaca aturan biasa dikirim ke AI setelah nama, telepon, alamat, email dan nomor
            kartu/rekening disamarkan.
          </li>
          <li>Untuk analisis dan chatbot, hanya ringkasan pengeluaran dan nama merchant yang dikirim, tanpa isi email.</li>
          <li>
            Pemroses: MAIA Router dan penyedia modelnya (saat ini xAI, Grok). Pemrosesan dapat terjadi di luar Indonesia.
          </li>
        </ul>
        <p>Tanpa Bantuan AI, Nera tetap bekerja dengan aturan biasa dan tidak mengirim datamu ke AI.</p>
      </>
    ),
  },
  {
    title: "Penyimpanan dan keamanan",
    body: (
      <ul>
        <li>Akses Gmail bersifat baca saja. Token akses disimpan terenkripsi (AES-256-GCM).</li>
        <li>Koneksi selalu terenkripsi (HTTPS/STARTTLS). Sesi login memakai cookie HttpOnly yang ditandatangani.</li>
        <li>Data disimpan selama akunmu aktif atau sampai kamu menghapusnya.</li>
      </ul>
    ),
  },
  {
    title: "Hak kamu",
    body: (
      <ul>
        <li>Melihat semua transaksi yang diimpor di halaman Impor dari Email.</li>
        <li>Mencabut persetujuan kapan saja. Mencabut impor email memutus Gmail dan menghapus data dari email.</li>
        <li>Menghapus semua data email lewat tombol &quot;Putuskan &amp; hapus semua data email&quot;.</li>
        <li>Mematikan pengingat kapan saja dari detail kantong Rencana dadakan.</li>
        <li>Mencabut akses Nera juga bisa dari pengaturan Akun Google kamu.</li>
      </ul>
    ),
  },
  {
    title: "Kontak",
    body: (
      <p>
        Pertanyaan atau permintaan terkait data: <a href="mailto:resanmekdi@gmail.com">resanmekdi@gmail.com</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#FFFBF0] px-5 py-10 text-[#2F240E]">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-xs font-semibold text-[#76520E]">
          ← Kembali ke Nera
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Kebijakan Privasi Nera</h1>
        <p className="mt-1 text-xs text-[#736B60]">Versi {VERSION}</p>
        <div className="mt-6 space-y-6">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-bold">{s.title}</h2>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#4A3F2C] [&_a]:font-semibold [&_a]:text-[#76520E] [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
