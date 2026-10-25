# Nera Design System

Panduan ini mencatat gaya aplikasi yang digunakan di beranda, layar mahasiswa, orang tua, dan kampus. Beranda adalah acuan visual utama. Warna status finansial tetap berbeda agar risiko mudah dikenali.

## Identitas

- Logo header: `/logos/nera-home-logo.webp`, disandingkan dengan logo wondr by BNI.
- Maskot beranda: `/images/nera-home-mascot.webp`.
- Font UI: Inter Tight melalui `next/font/google`, dengan `system-ui` sebagai fallback.
- Ikon: `lucide-react`, garis umumnya 2 px. Wadah ikon memakai kotak membulat saat perlu penekanan.

## Warna

| Peran | Warna | Pemakaian |
| --- | --- | --- |
| Latar aplikasi | `#F1F2F4` | Area di luar panel konten |
| Panel | `#FFFFFF` | Kartu, header, navigasi |
| Teks utama | `#2F240E` | Judul, angka, isi penting |
| Teks sekunder | `#736B60` | Keterangan dan metadata |
| Garis halus | `#E9E5DD` | Input dan batas panel seperlunya |
| Kuning utama | `#FFB900` | Tombol utama, kemajuan, aksen aktif |
| Kuning lembut | `#FFF0BD` / `#FFF3D6` | Wadah ikon dan informasi tersorot |
| Cokelat | `#76520E` / `#3A2800` | Ikon, tautan, aksi BNI, panel privasi |
| Aman | `#277449` / `#DDF0E6` | Status positif |
| Waspada | `#A36A00` / `#FFF3D6` | Peringatan sedang |
| Kritis | `#C43737` / `#FBE4DE` | Peringatan mendesak |

Gunakan kuning sebagai aksen, bukan sebagai latar seluruh halaman.

Kartu Kantong Budget (`/pockets`) boleh memakai nada hangat sebagai pembeda antar kantong: kuning `#FFF0BD`, pasir `#F3EBDD`, peach `#FBE7D3`, gading `#F7F5F0`, dan cokelat `#3A2800` (teks putih). Bar pemakaian berubah merah hanya saat budget terpakai 90% atau lebih. Merah dan hijau dipakai untuk makna status, bukan dekorasi.

## Bentuk dan tata letak

- Panel utama putih dengan radius sekitar 22–26 px. Latar halaman abu muda.
- Tombol dan input memakai radius sekitar 12–14 px; badge status berbentuk pil.
- Bayangan kartu rutin dihilangkan. Gunakan ruang dan perbedaan latar untuk memisahkan bagian.
- Satu kelompok kontrol yang berkaitan dapat berada dalam satu panel putih, seperti Quick Action di beranda.
- Jarak, ukuran teks, dan hierarki mengikuti kepentingan informasi. Angka finansial penting ditampilkan lengkap.
- Status yang dapat ditindaklanjuti harus punya tombol atau tautan yang jelas. Jangan tampilkan chevron untuk konten yang tidak bisa dibuka.
- Layar mahasiswa dan orang tua memakai frame mobile 430 px; dashboard kampus menyesuaikan lebar layar dan menumpuk panel pada viewport sempit.
- Frame mobile tidak menampilkan status bar perangkat tiruan. Header mahasiswa menyediakan tombol fullscreen di pojok kanan atas; header orang tua tidak menampilkannya.

## Interaksi

- Tombol utama: kuning `#FFB900` dengan teks `#352500`.
- Tombol sekunder: kuning lembut dengan teks cokelat, atau putih bergaris halus.
- Aksi yang terhubung ke wondr dapat memakai cokelat gelap dengan teks putih.
- Fokus keyboard harus terlihat. Gerak digunakan untuk umpan balik atau perubahan keadaan, bukan dekorasi berulang.
- Jangan gunakan `transition: all` pada komponen interaktif baru; tentukan properti yang berubah.

## Komponen bersama

Implementasi rujukan ada di `packages/ui/src/components` untuk Card, Button, Modal, Badge, dan TrustBanner; di `apps/web/src/components/common` untuk TopAppBar, BottomNav, dan MobileFrame. Perubahan gaya lintas aplikasi dimulai dari komponen tersebut sebelum memberi pengecualian pada halaman.
