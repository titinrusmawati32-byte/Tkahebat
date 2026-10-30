/**
 * ==============================================================================
 * KONFIGURASI APLIKASI TRYOUT TKA SD
 * ==============================================================================
 * Menghubungkan ke Google Apps Script di Luar Aplikasi:
 *
 * Cara 1 (Rekomendasi di Vercel - Tanpa Ubah Kode):
 *   Buka Vercel Dashboard > Proyek Anda > Settings > Environment Variables.
 *   Tambahkan:
 *     Key: GAS_URL
 *     Value: [URL Web App Google Apps Script Anda yang berakhiran /exec]
 *   Frontend otomatis terhubung melalui serverless proxy /api/gas.
 *
 * Cara 2 (Langsung di Repositori GitHub):
 *   Isi konstanta DEFAULT_GAS_API_URL di bawah ini dengan URL Web App Anda.
 * ==============================================================================
 */

const CONFIG = {
  APP_NAME: 'Tryout TKA SD',
  VERSION: '1.0.0',
  
  // URL Web App Google Apps Script default (Bisa diisi langsung di file ini pada GitHub)
  DEFAULT_GAS_API_URL: '',

  // Endpoint Serverless Proxy Vercel (Otomatis membaca env GAS_URL di Vercel)
  VERCEL_PROXY_ENDPOINT: '/api/gas',

  // Ambil URL aktif yang berjalan di luar antarmuka aplikasi
  getApiUrl: function() {
    // 1. Prioritas utama: jika DEFAULT_GAS_API_URL diisi langsung di file ini
    if (this.DEFAULT_GAS_API_URL && this.DEFAULT_GAS_API_URL.trim().startsWith('http')) {
      return this.DEFAULT_GAS_API_URL.trim();
    }

    // 2. Jika aplikasi berjalan di hosting web (seperti Vercel), gunakan proxy serverless /api/gas
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      return this.VERCEL_PROXY_ENDPOINT;
    }

    // 3. Fallback jika membuka via file:/// lokal
    return localStorage.getItem('TKA_GAS_API_URL') || '';
  },

  // Set URL aktif (opsional fallback)
  setApiUrl: function(url) {
    if (url && url.trim()) {
      localStorage.setItem('TKA_GAS_API_URL', url.trim());
    } else {
      localStorage.removeItem('TKA_GAS_API_URL');
    }
  },

  // Kunci Penyimpanan Lokal
  STORAGE_KEYS: {
    ADMIN_SESSION: 'TKA_ADMIN_SESSION',
    STUDENT_SESSION: 'TKA_STUDENT_SESSION',
    STUDENT_ANSWERS: 'TKA_STUDENT_ANSWERS',
    STUDENT_FLAGS: 'TKA_STUDENT_FLAGS',
    LOCAL_DB: 'TKA_LOCAL_CACHE_DB'
  },

  // Interval Autosave Jawaban Siswa ke Backend (detik)
  AUTOSAVE_INTERVAL_SEC: 30
};

// Ekspor ke window agar dapat diakses global
window.TKA_CONFIG = CONFIG;
