/**
 * ==============================================================================
 * KONFIGURASI APLIKASI TRYOUT TKA SD
 * ==============================================================================
 * Cara menghubungkan ke Google Apps Script:
 * 1. Deploy Apps Script sebagai Web App (Akses: Anyone).
 * 2. Salin URL Web App (berakhiran `/exec`).
 * 3. Isi konstanta DEFAULT_GAS_API_URL di bawah ini, ATAU masukkan melalui
 *    menu 'Pengaturan' pada Dashboard Admin.
 * ==============================================================================
 */

const CONFIG = {
  APP_NAME: 'Tryout TKA SD',
  VERSION: '1.0.0',
  
  // URL Web App Google Apps Script default (Bisa diperbarui lewat menu Admin)
  DEFAULT_GAS_API_URL: '',

  // Ambil URL aktif (memprioritaskan yang tersimpan di localStorage browser)
  getApiUrl: function() {
    return localStorage.getItem('TKA_GAS_API_URL') || this.DEFAULT_GAS_API_URL;
  },

  // Set URL aktif
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
