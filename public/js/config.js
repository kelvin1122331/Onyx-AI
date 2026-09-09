/**
 * ============================================================
 *  O N Y X   A I  —  Konfigurasi
 * ============================================================
 *  API key Gemini dipakai langsung dari browser (seperti
 *  Google AI Studio). Key dibaca dengan urutan:
 *    1. Key yang diisi pengguna di menu Pengaturan (localStorage)
 *    2. File `js/key.js` (lokal, TIDAK di-commit ke repo)
 *  Jika keduanya kosong, aplikasi menampilkan layar setup
 *  saat pertama kali dibuka.
 *
 *  ⚠️ JANGAN menulis API key asli di file ini — file ini
 *  ikut ter-commit. Gunakan `js/key.js` (sudah di-gitignore).
 * ============================================================
 */
'use strict';

window.ONYX_CONFIG = {
  // API key diambil dari js/key.js (file lokal, tidak di-commit).
  // Pengguna juga bisa mengisi key sendiri lewat layar setup / Pengaturan.
  API_KEY: (window.ONYX_API_KEY || '').trim(),

  // Endpoint dasar Gemini API
  API_BASE: 'https://generativelanguage.googleapis.com/v1beta',

  // Katalog model (nama brand Onyx → model Gemini asli)
  MODELS: [
    {
      id: 'gemini-3.5-flash',
      name: 'Onyx Flash',
      icon: 'bolt',
      badge: 'Andalan',
      badgeColor: 'violet',
      desc: 'Cepat & serbaguna untuk kebutuhan harian',
      imageOut: false,
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Onyx Pro',
      icon: 'gem',
      badge: 'Terpintar',
      badgeColor: 'cyan',
      desc: 'Penalaran terdalam untuk tugas kompleks & coding',
      imageOut: false,
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Onyx Lite',
      icon: 'feather',
      badge: 'Ringan',
      badgeColor: 'green',
      desc: 'Respons secepat kilat untuk pertanyaan simpel',
      imageOut: false,
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Onyx Ultra',
      icon: 'flame',
      badge: 'Terbaru',
      badgeColor: 'amber',
      desc: 'Eksperimental — versi Gemini Flash termutakhir',
      imageOut: false,
    },
    {
      id: 'gemini-3.1-flash-image',
      name: 'Onyx Canvas',
      icon: 'palette',
      badge: 'Gambar',
      badgeColor: 'pink',
      desc: 'Generate & edit gambar dari teks (Nano Banana 2)',
      imageOut: true,
    },
  ],

  // Model untuk judul obrolan otomatis (harus murah & cepat)
  TITLE_MODEL: 'gemini-3.5-flash-lite',

  // Instruksi sistem default (persona Onyx AI)
  DEFAULT_SYSTEM_PROMPT:
    'Kamu adalah Onyx AI, asisten AI yang elegan, cerdas, proaktif, dan ramah. ' +
    'Kamu ditenagai oleh model Gemini buatan Google dengan sentuhan khas Onyx. ' +
    'Jawab pertanyaan pengguna dengan akurat, terstruktur, dan langsung ke intinya. ' +
    'Gunakan bahasa yang sama dengan pengguna (secara default: Bahasa Indonesia). ' +
    'Format jawaban dengan Markdown yang rapi: gunakan heading, daftar, tabel, dan blok kode ' +
    'dengan penanda bahasa (contoh: ```python) kapan pun itu membantu. ' +
    'Jika pengguna mengunggah gambar, deskripsikan dan analisis dengan teliti. ' +
    'Jika kamu tidak yakin, katakan dengan jujur. Jangan pernah mengarang fakta.',

  // Batas unggahan
  LIMITS: {
    MAX_ATTACHMENTS: 6,        // maksimal lampiran per pesan
    MAX_IMAGE_DIM: 1600,       // gambar otomatis diperkecil ke sisi terpanjang ini
    IMAGE_QUALITY: 0.9,        // kualitas kompresi JPEG
    MAX_FILE_BYTES: 12 * 1024 * 1024, // ukuran maksimum per file non-gambar (PDF/audio)
    MAX_TOTAL_BYTES: 18 * 1024 * 1024, // total ukuran request
  },

  // Warna aksen brand
  BRAND: {
    name: 'Onyx AI',
    version: '1.0.0',
  },
};
