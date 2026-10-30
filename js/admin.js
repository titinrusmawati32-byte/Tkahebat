/**
 * ==============================================================================
 * LOGIKA ADMIN PORTAL (js/admin.js)
 * Dashboard, Bank Soal (Excel/CSV), Paket, Token, Siswa, Hasil, Pengaturan
 * ==============================================================================
 */

const AdminApp = {
  currentTab: 'tab-dashboard',
  currentUser: null,
  questions: [],
  packages: [],
  tokens: [],
  students: [],
  attempts: [],
  activePreviewQuestionId: null,
  pendingImportQuestions: [],

  init() {
    this.bindEvents();
    this.checkSession();
  },

  /**
   * Cek Status Sesi Login
   */
  checkSession() {
    const rawSession = localStorage.getItem(window.TKA_CONFIG.STORAGE_KEYS.ADMIN_SESSION);
    if (rawSession) {
      try {
        this.currentUser = JSON.parse(rawSession);
        this.showAdminLayout();
        this.loadDashboardData();
        return;
      } catch (e) {
        localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.ADMIN_SESSION);
      }
    }
    this.showLoginLayout();
  },

  showLoginLayout() {
    const loginView = document.getElementById('admin-login-view');
    const appLayout = document.getElementById('admin-app-layout');
    if (loginView) loginView.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'none';
  },

  showAdminLayout() {
    const loginView = document.getElementById('admin-login-view');
    const appLayout = document.getElementById('admin-app-layout');
    if (loginView) loginView.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';
    const displayEl = document.getElementById('admin-user-display');
    if (displayEl) {
      displayEl.innerText = this.currentUser ? (this.currentUser.display_name || this.currentUser.username) : 'Admin';
    }
  },

  bindEvents() {
    // Form Login
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Tombol Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    // Navigasi Sidebar Tab
    document.querySelectorAll('.sidebar-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Filter Bank Soal
    const filterCat = document.getElementById('filter-q-category');
    const filterType = document.getElementById('filter-q-type');
    const searchQ = document.getElementById('search-q');

    if (filterCat) filterCat.addEventListener('change', () => this.loadQuestions());
    if (filterType) filterType.addEventListener('change', () => this.loadQuestions());
    if (searchQ) searchQ.addEventListener('input', () => this.loadQuestions());

    // File Input Import Excel / CSV
    const importInput = document.getElementById('input-import-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Form Tambah / Edit Soal
    const qForm = document.getElementById('form-question');
    if (qForm) {
      qForm.addEventListener('submit', (e) => this.handleSaveQuestion(e));
    }

    // Form Tambah / Edit Paket
    const pkgForm = document.getElementById('form-package');
    if (pkgForm) {
      pkgForm.addEventListener('submit', (e) => this.handleSavePackage(e));
    }

    // Form Buat Token
    const tokenForm = document.getElementById('form-token');
    if (tokenForm) {
      tokenForm.addEventListener('submit', (e) => this.handleCreateToken(e));
    }

    // Form Pengaturan API
    const settingsForm = document.getElementById('form-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }
  },

  switchTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));

    const activeBtn = document.querySelector(`.sidebar-nav-item[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    this.currentTab = tabId;

    // Muat data spesifik tab
    if (tabId === 'tab-dashboard') this.loadDashboardData();
    if (tabId === 'tab-questions') this.loadQuestions();
    if (tabId === 'tab-packages') this.loadPackages();
    if (tabId === 'tab-tokens') this.loadTokens();
    if (tabId === 'tab-students') this.loadStudents();
    if (tabId === 'tab-results') this.loadResults();
    if (tabId === 'tab-settings') this.loadSettings();
  },

  /**
   * Login Admin
   */
  async handleLogin(e) {
    e.preventDefault();
    const uInput = document.getElementById('admin-username');
    const pInput = document.getElementById('admin-password');
    const btn = document.getElementById('btn-admin-login');

    const username = uInput.value.trim();
    const password = pInput.value;

    btn.disabled = true;
    btn.innerText = 'Memverifikasi...';

    try {
      const res = await window.TKA_API.request('admin_login', { username, password });
      this.currentUser = res.user;
      this.currentUser.session_token = res.session_token;

      localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(this.currentUser));
      window.TKA_API.toast('Login berhasil! Selamat datang di Admin Portal.', 'success');
      this.showAdminLayout();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Masuk Dashboard';
    }
  },

  handleLogout() {
    localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.ADMIN_SESSION);
    this.currentUser = null;
    window.TKA_API.toast('Berhasil keluar.', 'info');
    this.showLoginLayout();
  },

  /**
   * Muat Data Dashboard
   */
  async loadDashboardData() {
    try {
      const stats = await window.TKA_API.request('admin_get_dashboard_stats', {
        session_token: this.currentUser ? this.currentUser.session_token : ''
      });

      const c = stats.counts || {};
      const elPkg = document.getElementById('stat-pkg-count');
      const elQst = document.getElementById('stat-qst-count');
      const elTkn = document.getElementById('stat-tkn-count');
      const elStu = document.getElementById('stat-stu-count');
      const elAtt = document.getElementById('stat-att-count');
      const elAvg = document.getElementById('stat-avg-score');

      if (elPkg) elPkg.innerText = c.total_packages || 0;
      if (elQst) elQst.innerText = c.total_questions || 0;
      if (elTkn) elTkn.innerText = c.total_tokens || 0;
      if (elStu) elStu.innerText = c.total_students || 0;
      if (elAtt) elAtt.innerText = c.total_attempts || 0;
      if (elAvg) elAvg.innerText = c.avg_score || 0;

      // Render Riwayat Terbaru
      const tbody = document.getElementById('dashboard-recent-table');
      if (tbody) {
        tbody.innerHTML = '';
        const recent = stats.recent_attempts || [];
        if (recent.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:24px;">Belum ada aktivitas pengerjaan ujian.</td></tr>`;
        } else {
          recent.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${r.student_name}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${r.class_name})</span></td>
              <td>${r.package_title}</td>
              <td><span class="nexus-badge ${r.score >= 75 ? 'badge-mint' : 'badge-amber'}">${r.score}</span></td>
              <td>${r.correct_count} Benar</td>
              <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(r.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (e) {
      console.warn('Gagal memuat stats:', e);
    }
  },

  // ==============================================================================
  // BANK SOAL & MEDIA MANAGER
  // ==============================================================================

  async loadQuestions() {
    const cat = document.getElementById('filter-q-category')?.value || 'ALL';
    const type = document.getElementById('filter-q-type')?.value || 'ALL';
    const search = document.getElementById('search-q')?.value || '';

    try {
      const questions = await window.TKA_API.request('admin_get_questions', {
        session_token: this.currentUser?.session_token,
        filters: { category: cat, question_type: type, search: search }
      });

      this.questions = questions || [];
      this.renderQuestionsTable(this.questions);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderQuestionsTable(list) {
    const tbody = document.getElementById('questions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">Tidak ada soal yang cocok dengan kriteria.</td></tr>`;
      return;
    }

    list.forEach((q, idx) => {
      const tr = document.createElement('tr');
      const hasImage = q.image_refs && (q.image_refs.prompt || Object.keys(q.image_refs).length > 0);

      tr.innerHTML = `
        <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">${q.question_code || (idx + 1)}</td>
        <td>
          <span class="nexus-badge ${q.category === 'LITERASI' ? 'badge-cyan' : 'badge-purple'}">${q.category}</span>
          ${hasImage ? '<span class="nexus-badge badge-mint" style="margin-left:4px;">🖼️ Gambar</span>' : ''}
        </td>
        <td style="max-width:340px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${q.question_text}</td>
        <td><span class="nexus-badge badge-neutral">${q.question_type === 'MULTI_SELECT' ? 'Kompleks' : 'Pilihan Ganda'}</span></td>
        <td><strong style="color:var(--accent-primary); font-family:var(--font-mono);">${q.correct_answer}</strong></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.openPreviewModal('${q.question_id}')">
              👁️ Pratinjau & Media
            </button>
            <button type="button" class="pill-btn pill-btn-secondary pill-btn-sm" onclick="AdminApp.openEditQuestionModal('${q.question_id}')">
              ✏️
            </button>
            <button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.deleteQuestion('${q.question_id}')">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openAddQuestionModal() {
    document.getElementById('modal-q-title').innerText = 'Tambah Soal Baru';
    document.getElementById('form-q-id').value = '';
    document.getElementById('form-q-code').value = '';
    document.getElementById('form-q-category').value = 'NUMERASI';
    document.getElementById('form-q-type').value = 'MULTIPLE_CHOICE';
    document.getElementById('form-q-text').value = '';
    document.getElementById('form-opt-a').value = '';
    document.getElementById('form-opt-b').value = '';
    document.getElementById('form-opt-c').value = '';
    document.getElementById('form-opt-d').value = '';
    document.getElementById('form-q-correct').value = '';
    document.getElementById('form-q-exp').value = '';
    document.getElementById('form-q-diff').value = 'SEDANG';

    document.getElementById('modal-question-form').classList.add('open');
  },

  openEditQuestionModal(qId) {
    const q = this.questions.find(item => item.question_id === qId);
    if (!q) return;

    document.getElementById('modal-q-title').innerText = 'Edit Soal';
    document.getElementById('form-q-id').value = q.question_id;
    document.getElementById('form-q-code').value = q.question_code || '';
    document.getElementById('form-q-category').value = q.category;
    document.getElementById('form-q-type').value = q.question_type;
    document.getElementById('form-q-text').value = q.question_text;

    const opts = q.options || [];
    document.getElementById('form-opt-a').value = opts.find(o => o.code === 'A')?.text || '';
    document.getElementById('form-opt-b').value = opts.find(o => o.code === 'B')?.text || '';
    document.getElementById('form-opt-c').value = opts.find(o => o.code === 'C')?.text || '';
    document.getElementById('form-opt-d').value = opts.find(o => o.code === 'D')?.text || '';

    document.getElementById('form-q-correct').value = q.correct_answer;
    document.getElementById('form-q-exp').value = q.explanation || '';
    document.getElementById('form-q-diff').value = q.difficulty || 'SEDANG';

    document.getElementById('modal-question-form').classList.add('open');
  },

  async handleSaveQuestion(e) {
    e.preventDefault();
    const qId = document.getElementById('form-q-id').value;
    const existingQ = this.questions.find(item => item.question_id === qId);

    const questionObj = {
      question_id: qId,
      question_code: document.getElementById('form-q-code').value.trim(),
      category: document.getElementById('form-q-category').value,
      question_type: document.getElementById('form-q-type').value,
      question_text: document.getElementById('form-q-text').value.trim(),
      options: [
        { code: 'A', text: document.getElementById('form-opt-a').value.trim() },
        { code: 'B', text: document.getElementById('form-opt-b').value.trim() },
        { code: 'C', text: document.getElementById('form-opt-c').value.trim() },
        { code: 'D', text: document.getElementById('form-opt-d').value.trim() }
      ],
      correct_answer: document.getElementById('form-q-correct').value.trim().toUpperCase(),
      explanation: document.getElementById('form-q-exp').value.trim(),
      difficulty: document.getElementById('form-q-diff').value,
      image_refs: existingQ ? (existingQ.image_refs || {}) : {}
    };

    try {
      await window.TKA_API.request('admin_save_question', {
        session_token: this.currentUser?.session_token,
        question: questionObj
      });

      window.TKA_API.toast('Soal berhasil disimpan!', 'success');
      document.getElementById('modal-question-form').classList.remove('open');
      this.loadQuestions();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  async deleteQuestion(qId) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;
    try {
      await window.TKA_API.request('admin_delete_question', {
        session_token: this.currentUser?.session_token,
        question_id: qId
      });
      window.TKA_API.toast('Soal berhasil dihapus.', 'info');
      this.loadQuestions();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  /**
   * Modal Pratinjau & Pengelolaan Media Gambar Soal
   */
  openPreviewModal(qId) {
    const q = this.questions.find(item => item.question_id === qId);
    if (!q) return;

    this.activePreviewQuestionId = qId;
    document.getElementById('preview-modal-code').innerText = `${q.question_code} (${q.category})`;
    document.getElementById('preview-q-text').innerText = q.question_text;

    // Prompt Image
    const promptImgTarget = document.getElementById('preview-prompt-img');
    const promptImgBox = document.getElementById('preview-prompt-box');
    if (q.image_refs && q.image_refs.prompt) {
      promptImgTarget.src = q.image_refs.prompt;
      promptImgBox.style.display = 'block';
    } else {
      promptImgBox.style.display = 'none';
    }

    // Options with Media
    const optsBox = document.getElementById('preview-options-box');
    optsBox.innerHTML = '';
    (q.options || []).forEach(opt => {
      const optDiv = document.createElement('div');
      optDiv.style.marginBottom = '14px';
      optDiv.style.padding = '12px 16px';
      optDiv.style.background = 'rgba(255,255,255,0.03)';
      optDiv.style.borderRadius = '12px';

      const optImg = q.image_refs && q.image_refs[opt.code] ? q.image_refs[opt.code] : null;

      optDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="option-code-badge ${q.correct_answer.includes(opt.code) ? 'badge-mint' : ''}">${opt.code}</span>
            <span style="font-weight:600;">${opt.text}</span>
          </div>
          <div>
            <label class="pill-btn pill-btn-outline pill-btn-sm" style="cursor:pointer; margin:0;">
              📷 Upload Foto Opsi ${opt.code}
              <input type="file" accept="image/*" style="display:none;" onchange="AdminApp.handleImageUpload(event, '${opt.code}')">
            </label>
            ${optImg ? `<button type="button" class="pill-btn pill-btn-danger pill-btn-sm" style="margin-left:6px;" onclick="AdminApp.removeImage('${opt.code}')">Hapus Foto</button>` : ''}
          </div>
        </div>
        ${optImg ? `<div class="option-media-container" style="margin-top:10px;"><img src="${optImg}" class="option-media-img"></div>` : ''}
      `;
      optsBox.appendChild(optDiv);
    });

    document.getElementById('preview-explanation-text').innerText = q.explanation || 'Belum ada pembahasan.';
    document.getElementById('modal-question-preview').classList.add('open');
  },

  async handleImageUpload(e, targetSlot) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      window.TKA_API.toast('Ukuran gambar maksimal 8MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      const q = this.questions.find(item => item.question_id === this.activePreviewQuestionId);
      if (!q) return;

      if (!q.image_refs) q.image_refs = {};
      
      const apiUrl = window.TKA_CONFIG.getApiUrl();
      if (apiUrl && apiUrl.startsWith('http')) {
        try {
          window.TKA_API.toast('Mengunggah gambar ke Google Drive...', 'info');
          const res = await window.TKA_API.request('admin_upload_image', {
            session_token: this.currentUser?.session_token,
            image_base64: base64Data,
            filename: `${q.question_id}_${targetSlot}_${Date.now()}.png`,
            mime_type: file.type
          });
          q.image_refs[targetSlot] = res.url;
        } catch (uploadErr) {
          window.TKA_API.toast('Gagal upload Drive: ' + uploadErr.message + '. Menyimpan lokal.', 'warning');
          q.image_refs[targetSlot] = base64Data;
        }
      } else {
        q.image_refs[targetSlot] = base64Data;
      }

      await window.TKA_API.request('admin_save_question', {
        session_token: this.currentUser?.session_token,
        question: q
      });

      window.TKA_API.toast(`Gambar ${targetSlot === 'prompt' ? 'batang soal' : 'opsi ' + targetSlot} berhasil diperbarui!`, 'success');
      this.openPreviewModal(q.question_id);
    };
    reader.readAsDataURL(file);
  },

  async removeImage(targetSlot) {
    const q = this.questions.find(item => item.question_id === this.activePreviewQuestionId);
    if (!q || !q.image_refs) return;

    delete q.image_refs[targetSlot];

    await window.TKA_API.request('admin_save_question', {
      session_token: this.currentUser?.session_token,
      question: q
    });

    window.TKA_API.toast('Gambar berhasil dihapus.', 'info');
    this.openPreviewModal(q.question_id);
  },

  // ==============================================================================
  // DOWNLOAD TEMPLATE EXCEL (.XLSX) & IMPORT EXCEL / CSV
  // ==============================================================================

  openTemplateModal() {
    const modal = document.getElementById('modal-template-excel');
    if (modal) modal.classList.add('open');
  },

  /**
   * Mengunduh Template Soal Asli Microsoft Excel (.xlsx) dengan 11 Kolom Standar
   */
  downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
      window.TKA_API.toast('Library SheetJS belum selesai dimuat.', 'error');
      return;
    }

    const templateRows = [
      ['No', 'Materi/Kompetensi', 'Level', 'Bentuk', 'Soal', 'A', 'B', 'C', 'D', 'Kunci', 'Pembahasan'],
      [1, 'Bilangan cacah: operasi hitung', 'L2 – aplikasi', 'Pilihan ganda', 'Perpustakaan memiliki 1.245 buku. Sekolah menerima 275 buku baru, lalu 138 buku dipindahkan ke ruang baca lain. Berapa buku yang tersisa di perpustakaan utama?', '1.282', '1.382', '1.520', '1.658', 'B', '1.245 + 275 = 1.520. Kemudian 1.520 − 138 = 1.382 buku.'],
      [2, 'Bilangan: operasi perkalian', 'L2 – aplikasi', 'Pilihan ganda', 'Ada 24 kotak pensil. Setiap kotak berisi 12 pensil. Jumlah seluruh pensil adalah ....', '188', '248', '288', '312', 'C', '24 × 12 = 24 × (10 + 2) = 240 + 48 = 288.'],
      [3, 'Bilangan: pembagian', 'L2 – aplikasi', 'Pilihan ganda', 'Sebanyak 168 buku dibagikan sama banyak kepada 8 kelas. Setiap kelas menerima ....', '18', '20', '21', '24', 'C', '168 ÷ 8 = 21 buku untuk setiap kelas.'],
      [4, 'Pecahan senilai', 'L1 – pemahaman', 'Pilihan ganda', 'Pecahan yang senilai dengan 3/4 adalah ....', '6/8', '4/6', '5/8', '6/10', 'A', '3/4 dikalikan pembilang dan penyebut dengan 2 menghasilkan 6/8.'],
      [5, 'Membandingkan pecahan', 'L2 – aplikasi', 'Pilihan ganda', 'Manakah pecahan yang nilainya paling besar?', '1/2', '2/3', '3/5', '5/8', 'B', '2/3 ≈ 0,667; 5/8 = 0,625; 3/5 = 0,6; 1/2 = 0,5. Jadi 2/3 paling besar.'],
      [6, 'Desimal dan persen', 'L1 – pemahaman', 'Pilihan ganda', 'Nilai 35% dalam bentuk desimal adalah ....', '0,035', '0,35', '3,5', '35,0', 'B', 'Persen berarti per seratus, sehingga 35% = 35/100 = 0,35.'],
      [7, 'Operasi pecahan', 'L2 – aplikasi', 'Pilihan ganda', 'Ibu menggunakan 2/8 kg tepung untuk kue dan 3/8 kg untuk roti. Tepung yang digunakan seluruhnya adalah ....', '1/8 kg', '5/8 kg', '5/16 kg', '6/8 kg', 'B', 'Penyebut sama, maka 2/8 + 3/8 = 5/8 kg.'],
      [8, 'Operasi pecahan dengan bilangan asli', 'L2 – aplikasi', 'Pilihan ganda', 'Sebuah pita panjangnya 24 meter. Sebanyak 3/4 bagian digunakan untuk menghias kelas. Berapa meter pita yang digunakan?', '6', '12', '18', '21', 'C', '3/4 × 24 = 24 ÷ 4 × 3 = 6 × 3 = 18 meter.'],
      [9, 'Faktor dan kelipatan', 'L3 – penalaran', 'Pilihan ganda', 'Lampu A berkedip setiap 6 detik dan lampu B setiap 8 detik. Jika keduanya berkedip bersama sekarang, setelah berapa detik keduanya berkedip bersama lagi?', '12', '18', '24', '48', 'C', 'KPK(6, 8) = 24, jadi keduanya kembali bersamaan setelah 24 detik.'],
      [10, 'Faktor persekutuan terbesar', 'L3 – penalaran', 'Pilihan ganda', 'Ada 36 pensil dan 48 penghapus. Semua akan dibagi ke dalam paket yang sama, tanpa sisa, dengan jumlah paket sebanyak mungkin. Berapa paket yang dapat dibuat?', '6', '8', '12', '18', 'C', 'Jumlah paket maksimum adalah FPB(36, 48) = 12. Setiap paket berisi 3 pensil dan 4 penghapus.'],
      [11, 'Pola bilangan', 'L2 – aplikasi', 'Pilihan ganda', 'Perhatikan pola: 4, 9, 14, 19, .... Bilangan berikutnya adalah ....', '22', '23', '24', '25', 'C', 'Setiap bilangan bertambah 5; 19 + 5 = 24.'],
      [12, 'Geometri: sifat bangun datar', 'L1 – pemahaman', 'Pilihan ganda', 'Bangun datar memiliki empat sisi sama panjang dan empat sudut siku-siku. Bangun tersebut adalah ....', 'persegi', 'persegi panjang', 'segitiga sama sisi', 'trapesium', 'A', 'Persegi memiliki empat sisi sama panjang dan empat sudut siku-siku.'],
      [13, 'Keliling persegi panjang', 'L2 – aplikasi', 'Pilihan ganda', 'Sebuah kebun berbentuk persegi panjang memiliki panjang 15 m dan lebar 8 m. Keliling kebun adalah ....', '23 m', '46 m', '60 m', '120 m', 'B', 'Keliling = 2 × (15 + 8) = 2 × 23 = 46 m.'],
      [14, 'Luas persegi', 'L2 – aplikasi', 'Pilihan ganda', 'Lantai berbentuk persegi memiliki panjang sisi 9 m. Luas lantai tersebut adalah ....', '18 m²', '36 m²', '72 m²', '81 m²', 'D', 'Luas persegi = sisi × sisi = 9 × 9 = 81 m².'],
      [15, 'Pengukuran panjang', 'L1 – pemahaman', 'Pilihan ganda', 'Jarak rumah ke perpustakaan adalah 2,5 km. Jarak tersebut sama dengan ....', '250 m', '2.050 m', '2.500 m', '25.000 m', 'C', '1 km = 1.000 m, maka 2,5 km = 2.500 m.'],
      [16, 'Pengukuran waktu', 'L2 – aplikasi', 'Pilihan ganda', 'Kegiatan dimulai pukul 08.25 dan selesai pukul 10.05. Lama kegiatan adalah ....', '1 jam 20 menit', '1 jam 40 menit', '2 jam 20 menit', '2 jam 40 menit', 'B', '08.25 ke 09.25 = 1 jam; 09.25 ke 10.05 = 40 menit. Total 1 jam 40 menit.'],
      [17, 'Pengukuran berat', 'L2 – aplikasi', 'Pilihan ganda', 'Satu karung berisi 3 kg 250 g beras. Jika dinyatakan dalam gram, beratnya adalah ....', '325 g', '3.025 g', '3.250 g', '32.500 g', 'C', '3 kg = 3.000 g; ditambah 250 g menjadi 3.250 g.'],
      [18, 'Volume dan kapasitas', 'L2 – aplikasi', 'Pilihan ganda', 'Jeriken berkapasitas 10 liter berisi 6,5 liter air. Berapa liter lagi yang dapat ditambahkan sampai penuh?', '2,5 liter', '3,5 liter', '4,5 liter', '6,5 liter', 'B', '10 − 6,5 = 3,5 liter.'],
      [19, 'Bangun ruang: kubus', 'L1 – pemahaman', 'Pilihan ganda', 'Sebuah kubus memiliki berapa sisi berbentuk persegi?', '4', '5', '6', '8', 'C', 'Kubus memiliki 6 sisi, 12 rusuk, dan 8 titik sudut.'],
      [20, 'Bangun ruang: volume balok', 'L2 – aplikasi', 'Pilihan ganda', 'Kotak berbentuk balok berukuran panjang 8 cm, lebar 5 cm, dan tinggi 4 cm. Volumenya adalah ....', '17 cm³', '40 cm³', '80 cm³', '160 cm³', 'D', 'Volume balok = p × l × t = 8 × 5 × 4 = 160 cm³.'],
      [21, 'Bangun ruang: tampilan bentuk', 'L3 – penalaran', 'Pilihan ganda', 'Sebuah susunan terdiri atas 3 kubus pada baris bawah dan 2 kubus ditumpuk tepat di atas dua kubus pada baris bawah. Jumlah kubus seluruhnya adalah ....', '3', '4', '5', '6', 'C', 'Baris bawah terdiri atas 3 kubus dan di atasnya ada 2 kubus tambahan, sehingga 3 + 2 = 5.'],
      [22, 'Data: membaca tabel', 'L1 – pemahaman', 'Pilihan ganda', 'Jumlah buku yang dibaca empat murid selama sebulan: Ani 5, Budi 8, Citra 6, Danu 4. Siapa membaca buku paling banyak?', 'Ani', 'Budi', 'Citra', 'Danu', 'B', 'Angka terbesar adalah 8, milik Budi.'],
      [23, 'Data: menghitung jumlah', 'L2 – aplikasi', 'Pilihan ganda', 'Kantin menjual 18 roti pada pagi hari dan 27 roti saat istirahat. Jumlah roti yang terjual adalah ....', '35', '40', '45', '55', 'C', '18 + 27 = 45 roti.'],
      [24, 'Data: selisih', 'L2 – aplikasi', 'Pilihan ganda', 'Pada Senin terkumpul 35 kg sampah daur ulang dan pada Selasa 28 kg. Selisih jumlah sampah adalah ....', '5 kg', '7 kg', '8 kg', '63 kg', 'B', '35 − 28 = 7 kg.'],
      [25, 'Data: simpulan dari data', 'L3 – penalaran', 'Pilihan ganda', 'Pilihan ekstrakurikuler murid: sepak bola 18 murid, tari 12 murid, musik 9 murid, pramuka 21 murid. Pernyataan yang benar adalah ....', 'musik paling diminati', 'pramuka dipilih lebih banyak daripada sepak bola', 'tari dipilih oleh 21 murid', 'semua kegiatan dipilih jumlah murid sama', 'B', 'Pramuka dipilih 21 murid, lebih banyak daripada sepak bola yang dipilih 18 murid.'],
      [26, 'Bilangan: masalah multi-langkah', 'L3 – penalaran', 'Pilihan ganda', 'Sekolah membeli 15 pak kertas. Setiap pak berisi 40 lembar. Sebanyak 175 lembar digunakan. Berapa lembar kertas yang tersisa?', '325', '425', '525', '600', 'B', 'Total 15 × 40 = 600 lembar. Sisa 600 − 175 = 425 lembar.'],
      [27, 'Pecahan: memilih pernyataan benar', 'L3 – penalaran', 'Pilihan ganda kompleks (MCMA)', 'Pilih semua pernyataan yang benar.', '1/2 = 2/4', '3/5 lebih besar daripada 1/2', '4/8 sama dengan 1/4', '75% sama dengan 3/4', 'A, B, D', 'A benar karena 1/2 = 2/4. B benar karena 0,6 > 0,5. D benar karena 75/100 = 3/4. C salah karena 4/8 = 1/2.'],
      [28, 'Pengukuran: memilih satuan tepat', 'L2 – aplikasi', 'Pilihan ganda kompleks (MCMA)', 'Pilih semua pasangan objek dan satuan yang masuk akal.', 'Panjang ruang kelas — meter', 'Berat sebutir beras — kilogram', 'Isi botol minum — mililiter', 'Lama satu kedipan mata — kilometer', 'A, C', 'Panjang ruang kelas lazim diukur dalam meter dan kapasitas botol dalam mililiter. Kilogram tidak sesuai untuk sebutir beras, sedangkan kilometer bukan satuan waktu.'],
      [29, 'Geometri: sifat bangun', 'L2 – aplikasi', 'Pilihan ganda kompleks (MCMA)', 'Pilih semua pernyataan yang benar tentang persegi.', 'Memiliki empat sisi sama panjang', 'Memiliki empat sudut siku-siku', 'Memiliki tepat tiga sisi', 'Sisi yang berhadapan sejajar', 'A, B, D', 'Persegi memiliki empat sisi sama panjang, empat sudut siku-siku, dan dua pasang sisi berhadapan yang sejajar.'],
      [30, 'Data: membandingkan dua kategori', 'L3 – penalaran', 'Pilihan ganda', 'Kelas A mengumpulkan 26 kg kertas dan 19 kg plastik. Kelas B mengumpulkan 22 kg kertas dan 25 kg plastik. Berapa total sampah daur ulang kedua kelas?', '72 kg', '82 kg', '92 kg', '102 kg', 'C', 'Kelas A: 26 + 19 = 45 kg. Kelas B: 22 + 25 = 47 kg. Total 45 + 47 = 92 kg.']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateRows);

    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 32 }, // Materi/Kompetensi
      { wch: 18 }, // Level
      { wch: 22 }, // Bentuk
      { wch: 60 }, // Soal
      { wch: 16 }, // A
      { wch: 16 }, // B
      { wch: 16 }, // C
      { wch: 16 }, // D
      { wch: 10 }, // Kunci
      { wch: 50 }  // Pembahasan
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Soal_TKA_SD');
    XLSX.writeFile(wb, 'Template_Soal_TKA_SD_Numerasi.xlsx');
    window.TKA_API.toast('File template Excel (.xlsx) berhasil diunduh!', 'success');
  },

  openImportModal() {
    document.getElementById('import-report-box').style.display = 'none';
    document.getElementById('btn-confirm-import').style.display = 'none';
    document.getElementById('input-import-file').value = '';
    document.getElementById('modal-import-csv').classList.add('open');
  },

  /**
   * Menangani Pemilihan File (.xlsx, .xls, .csv)
   */
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      if (typeof XLSX === 'undefined') {
        window.TKA_API.toast('Library SheetJS belum siap untuk memproses Excel.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (fileEvent) => {
        try {
          const data = new Uint8Array(fileEvent.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          this.parseAndValidateRows(rows);
        } catch (err) {
          window.TKA_API.toast(`Gagal membaca file Excel: ${err.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // File CSV
      const reader = new FileReader();
      reader.onload = (fileEvent) => {
        try {
          const content = fileEvent.target.result;
          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          const rows = lines.map(line => this.parseCsvLine(line));
          this.parseAndValidateRows(rows);
        } catch (err) {
          window.TKA_API.toast(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
    }
  },

  /**
   * Parser & Validator Matriks Baris Data (Baik dari SheetJS Excel maupun CSV)
   */
  parseAndValidateRows(rows) {
    if (!rows || rows.length <= 1) {
      window.TKA_API.toast('File kosong atau hanya berisi baris header.', 'error');
      return;
    }

    const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
    const validQuestions = [];
    const reportRows = [];

    let successCount = 0;
    let failCount = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || row.join('').trim() === '') continue;

      const errors = []; // Inisialisasi array error per baris

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = String(row[c] !== undefined && row[c] !== null ? row[c] : '').trim();
      }

      // Pemetaan Kolom Fleksibel (Mendukung format No/Materi/Level/Soal/Kunci & question_code/type/...)
      const rawNo = (obj['no'] || '').trim();
      const code = obj['question_code'] || (rawNo ? `NUM-${rawNo.padStart(3, '0')}` : `SOAL-${r}`);
      
      let category = (obj['type'] || obj['kategori'] || '').trim().toUpperCase();
      if (!category) {
        category = 'NUMERASI';
      }

      const qText = (obj['question_text'] || obj['soal'] || '').trim();
      const bentuk = (obj['bentuk'] || '').toLowerCase();
      
      const optA = (obj['option_a'] || obj['a'] || '').trim();
      const optB = (obj['option_b'] || obj['b'] || '').trim();
      const optC = (obj['option_c'] || obj['c'] || '').trim();
      const optD = (obj['option_d'] || obj['d'] || '').trim();

      // Bersihkan spasi pada kunci jawaban (misal: "A, B, D" -> "A,B,D")
      let correct = (obj['correct_answer'] || obj['kunci'] || '').replace(/\s+/g, '').toUpperCase();

      let qType = (obj['question_type'] || '').trim().toUpperCase();
      if (!qType) {
        if (bentuk.includes('kompleks') || bentuk.includes('mcma') || correct.includes(',')) {
          qType = 'MULTI_SELECT';
        } else {
          qType = 'MULTIPLE_CHOICE';
        }
      }

      const explanation = (obj['explanation'] || obj['pembahasan'] || '').trim();
      const level = (obj['level'] || '').toLowerCase();
      let difficulty = (obj['difficulty'] || '').trim().toUpperCase();
      if (!difficulty) {
        if (level.includes('l1')) difficulty = 'MUDAH';
        else if (level.includes('l3')) difficulty = 'SULIT';
        else difficulty = 'SEDANG';
      }

      if (!['LITERASI', 'NUMERASI'].includes(category)) {
        errors.push(`Kategori '${category}' tidak valid (wajib LITERASI atau NUMERASI)`);
      }
      if (!qText) {
        errors.push('Teks batang soal kosong');
      }
      if (!optA || !optB || !optC || !optD) {
        errors.push('Pilihan A, B, C, dan D wajib diisi');
      }
      if (!correct) {
        errors.push('Kunci jawaban belum ditentukan');
      } else {
        if (qType === 'MULTIPLE_CHOICE' && !['A', 'B', 'C', 'D'].includes(correct)) {
          errors.push(`Kunci pilihan ganda '${correct}' tidak valid (hanya A/B/C/D)`);
        }
      }

      if (errors.length === 0) {
        successCount++;
        validQuestions.push({
          question_code: code,
          category: category,
          question_type: qType,
          question_text: qText,
          options: [
            { code: 'A', text: optA },
            { code: 'B', text: optB },
            { code: 'C', text: optC },
            { code: 'D', text: optD }
          ],
          correct_answer: correct,
          explanation: explanation,
          difficulty: difficulty,
          status: 'ACTIVE'
        });
        reportRows.push(`<tr style="color:var(--accent-primary);"><td>Baris ${r + 1}</td><td>${code}</td><td>✓ Valid</td><td>Siap diimpor</td></tr>`);
      } else {
        failCount++;
        reportRows.push(`<tr style="color:var(--accent-rose);"><td>Baris ${r + 1}</td><td>${code}</td><td>✗ Gagal</td><td>${errors.join(', ')}</td></tr>`);
      }
    }

    this.pendingImportQuestions = validQuestions;

    // Tampilkan Laporan Hasil Validasi
    const reportBox = document.getElementById('import-report-box');
    reportBox.style.display = 'block';
    document.getElementById('import-summary-text').innerHTML = `
      Ditemukan <strong>${rows.length - 1}</strong> total baris data:
      <span style="color:var(--accent-primary);"><strong>${successCount}</strong> valid</span> dan
      <span style="color:var(--accent-rose);"><strong>${failCount}</strong> bermasalah</span>.
    `;
    document.getElementById('import-report-table-body').innerHTML = reportRows.join('');

    const btnConfirm = document.getElementById('btn-confirm-import');
    if (successCount > 0) {
      btnConfirm.style.display = 'inline-flex';
      btnConfirm.innerText = `Terbitkan & Simpan ${successCount} Soal Valid`;
    } else {
      btnConfirm.style.display = 'none';
    }
  },

  /**
   * Helper Parser CSV dengan Tanda Petik
   */
  parseCsvLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  },

  async executeBatchImport() {
    if (!this.pendingImportQuestions || this.pendingImportQuestions.length === 0) return;

    try {
      const res = await window.TKA_API.request('admin_batch_import_questions', {
        session_token: this.currentUser?.session_token,
        questions: this.pendingImportQuestions
      });

      window.TKA_API.toast(`Sukses mengimpor ${res.imported_count} butir soal ke database!`, 'success');
      document.getElementById('modal-import-csv').classList.remove('open');
      this.loadQuestions();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  // ==============================================================================
  // PAKET TRYOUT
  // ==============================================================================

  async loadPackages() {
    try {
      const list = await window.TKA_API.request('admin_get_packages', {
        session_token: this.currentUser?.session_token
      });
      this.packages = list || [];
      this.renderPackagesGrid(this.packages);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderPackagesGrid(list) {
    const grid = document.getElementById('packages-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!list || list.length === 0) {
      grid.innerHTML = `<div class="nexus-card text-center text-muted" style="grid-column:1/-1; padding:30px;">Belum ada paket ujian yang dibuat.</div>`;
      return;
    }

    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'nexus-card';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="nexus-badge ${p.category.includes('LITERASI') ? 'badge-cyan' : 'badge-purple'}">${p.category}</span>
          <span class="nexus-badge ${p.status === 'ACTIVE' ? 'badge-mint' : 'badge-neutral'}">${p.status}</span>
        </div>
        <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:8px;">${p.title}</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">${p.description || 'Tidak ada deskripsi khusus.'}</p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; font-size:0.8rem; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:10px;">
          <div>⏱️ <strong>${p.duration_minutes} Menit</strong></div>
          <div>📝 <strong>${p.question_count || (p.question_ids ? p.question_ids.length : 0)} Soal</strong></div>
          <div>🔁 <strong>Maks ${p.attempt_limit}x</strong></div>
          <div>💡 <strong>${p.show_explanations ? 'Ada Pembahasan' : 'Tanpa Pembahasan'}</strong></div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.openEditPackageModal('${p.package_id}')">Edit</button>
          <button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.deletePackage('${p.package_id}')">Hapus</button>
        </div>
      `;
      grid.appendChild(card);
    });
  },

  openAddPackageModal() {
    document.getElementById('modal-pkg-title').innerText = 'Buat Paket Ujian';
    document.getElementById('form-pkg-id').value = '';
    document.getElementById('form-pkg-title-input').value = '';
    document.getElementById('form-pkg-desc').value = '';
    document.getElementById('form-pkg-category').value = 'LITERASI & NUMERASI';
    document.getElementById('form-pkg-duration').value = '30';
    document.getElementById('form-pkg-attempt').value = '1';
    document.getElementById('form-pkg-exp-toggle').checked = true;

    this.renderQuestionPicker([]);
    document.getElementById('modal-package-form').classList.add('open');
  },

  openEditPackageModal(pkgId) {
    const p = this.packages.find(item => item.package_id === pkgId);
    if (!p) return;

    document.getElementById('modal-pkg-title').innerText = 'Edit Paket Ujian';
    document.getElementById('form-pkg-id').value = p.package_id;
    document.getElementById('form-pkg-title-input').value = p.title;
    document.getElementById('form-pkg-desc').value = p.description || '';
    document.getElementById('form-pkg-category').value = p.category;
    document.getElementById('form-pkg-duration').value = p.duration_minutes;
    document.getElementById('form-pkg-attempt').value = p.attempt_limit;
    document.getElementById('form-pkg-exp-toggle').checked = (p.show_explanations === true || p.show_explanations === 'TRUE');

    this.renderQuestionPicker(p.question_ids || []);
    document.getElementById('modal-package-form').classList.add('open');
  },

  renderQuestionPicker(selectedIds) {
    const container = document.getElementById('picker-questions-list');
    if (!container) return;
    container.innerHTML = '';

    if (this.questions.length === 0) {
      container.innerHTML = `<div style="padding:14px; color:var(--text-muted); font-size:0.85rem;">Belum ada soal di Bank Soal. Tambah soal terlebih dahulu.</div>`;
      return;
    }

    this.questions.forEach(q => {
      const isChecked = selectedIds.includes(q.question_id);
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '10px';
      row.style.padding = '8px 12px';
      row.style.borderBottom = '1px solid var(--border-glass)';
      row.style.cursor = 'pointer';

      row.innerHTML = `
        <input type="checkbox" class="pkg-q-check" value="${q.question_id}" ${isChecked ? 'checked' : ''} onchange="AdminApp.updatePickerCount()">
        <span class="nexus-badge ${q.category === 'LITERASI' ? 'badge-cyan' : 'badge-purple'}" style="font-size:0.7rem;">${q.category}</span>
        <span style="font-size:0.85rem; color:var(--text-main); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${q.question_text}</span>
      `;
      container.appendChild(row);
    });

    this.updatePickerCount();
  },

  updatePickerCount() {
    const checked = document.querySelectorAll('.pkg-q-check:checked');
    const el = document.getElementById('picker-selected-count');
    if (el) el.innerText = `${checked.length} Soal Dipilih`;
  },

  async handleSavePackage(e) {
    e.preventDefault();
    const pkgId = document.getElementById('form-pkg-id').value;
    const selectedQIds = Array.from(document.querySelectorAll('.pkg-q-check:checked')).map(cb => cb.value);

    if (selectedQIds.length === 0) {
      window.TKA_API.toast('Pilih minimal 1 butir soal untuk paket ujian ini.', 'warning');
      return;
    }

    const pkgObj = {
      package_id: pkgId,
      title: document.getElementById('form-pkg-title-input').value.trim(),
      description: document.getElementById('form-pkg-desc').value.trim(),
      category: document.getElementById('form-pkg-category').value,
      duration_minutes: parseInt(document.getElementById('form-pkg-duration').value, 10) || 30,
      attempt_limit: parseInt(document.getElementById('form-pkg-attempt').value, 10) || 1,
      show_explanations: document.getElementById('form-pkg-exp-toggle').checked,
      question_ids: selectedQIds,
      status: 'ACTIVE'
    };

    try {
      await window.TKA_API.request('admin_save_package', {
        session_token: this.currentUser?.session_token,
        package: pkgObj
      });
      window.TKA_API.toast('Paket ujian berhasil disimpan!', 'success');
      document.getElementById('modal-package-form').classList.remove('open');
      this.loadPackages();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  async deletePackage(pkgId) {
    if (!confirm('Apakah Anda yakin ingin menghapus paket tryout ini?')) return;
    try {
      await window.TKA_API.request('admin_delete_package', {
        session_token: this.currentUser?.session_token,
        package_id: pkgId
      });
      window.TKA_API.toast('Paket berhasil dihapus.', 'info');
      this.loadPackages();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  // ==============================================================================
  // TOKEN SISWA
  // ==============================================================================

  async loadTokens() {
    try {
      const list = await window.TKA_API.request('admin_get_tokens', {
        session_token: this.currentUser?.session_token
      });
      this.tokens = list || [];
      this.renderTokensTable(this.tokens);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderTokensTable(list) {
    const tbody = document.getElementById('tokens-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">Belum ada token siswa yang dibuat.</td></tr>`;
      return;
    }

    list.forEach(t => {
      const tr = document.createElement('tr');
      const tokenDisplay = t.raw_token || t.token_id;

      tr.innerHTML = `
        <td>
          <span style="font-family:var(--font-mono); font-weight:700; font-size:1.05rem; color:var(--accent-primary); letter-spacing:1px;">${tokenDisplay}</span>
          <button type="button" class="pill-btn pill-btn-secondary pill-btn-sm" style="margin-left:8px; padding:2px 8px;" onclick="AdminApp.copyToClipboard('${tokenDisplay}')">📋 Salin</button>
        </td>
        <td><strong>${t.package_title}</strong></td>
        <td>${t.attempt_count || 0} / ${t.attempt_limit} Kali</td>
        <td>
          <span class="nexus-badge ${t.active ? 'badge-mint' : 'badge-rose'}">
            ${t.active ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(t.expires_at || Date.now()).toLocaleDateString('id-ID')}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.toggleToken('${t.token_id}', ${!t.active})">
              ${t.active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.deleteToken('${t.token_id}')">
              Hapus
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openGenerateTokenModal() {
    const select = document.getElementById('token-pkg-select');
    if (select) {
      select.innerHTML = '';
      this.packages.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.package_id;
        opt.innerText = `${p.title} (${p.category})`;
        select.appendChild(opt);
      });
    }

    document.getElementById('modal-generate-token').classList.add('open');
  },

  async handleCreateToken(e) {
    e.preventDefault();
    const pkgId = document.getElementById('token-pkg-select').value;
    const limit = document.getElementById('token-attempt-limit').value;

    try {
      const res = await window.TKA_API.request('admin_create_token', {
        session_token: this.currentUser?.session_token,
        package_id: pkgId,
        attempt_limit: limit
      });

      window.TKA_API.toast(`Token dibuat: ${res.raw_token}`, 'success');
      document.getElementById('modal-generate-token').classList.remove('open');
      this.loadTokens();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  async toggleToken(tokenId, status) {
    try {
      await window.TKA_API.request('admin_toggle_token', {
        session_token: this.currentUser?.session_token,
        token_id: tokenId,
        active: status
      });
      window.TKA_API.toast(`Status token diperbarui.`, 'info');
      this.loadTokens();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  async deleteToken(tokenId) {
    if (!confirm('Apakah Anda yakin ingin menghapus token ini secara permanen?')) return;
    try {
      await window.TKA_API.request('admin_delete_token', {
        session_token: this.currentUser?.session_token,
        token_id: tokenId
      });
      window.TKA_API.toast('Token berhasil dihapus.', 'info');
      this.loadTokens();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      window.TKA_API.toast(`Token ${text} disalin ke clipboard!`, 'success');
    });
  },

  // ==============================================================================
  // DATA SISWA
  // ==============================================================================

  async loadStudents() {
    try {
      const list = await window.TKA_API.request('admin_get_students', {
        session_token: this.currentUser?.session_token
      });
      this.students = list || [];
      this.populateStudentClassFilter();
      this.renderStudentsTable(this.students);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  populateStudentClassFilter() {
    const select = document.getElementById('filter-students-class');
    if (!select) return;
    const currentVal = select.value;
    const classes = Array.from(new Set(this.students.map(s => s.class_name).filter(Boolean))).sort();
    select.innerHTML = '<option value="ALL">Semua Kelas / Rombel</option>';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    if (classes.includes(currentVal)) select.value = currentVal;
  },

  filterStudents() {
    const search = (document.getElementById('search-students')?.value || '').toLowerCase().trim();
    const classFilter = document.getElementById('filter-students-class')?.value || 'ALL';

    let filtered = this.students;
    if (classFilter !== 'ALL') {
      filtered = filtered.filter(s => (s.class_name || '') === classFilter);
    }
    if (search) {
      filtered = filtered.filter(s => 
        (s.student_name || '').toLowerCase().includes(search) || 
        (s.student_id || '').toLowerCase().includes(search) ||
        (s.class_name || '').toLowerCase().includes(search)
      );
    }
    this.renderStudentsTable(filtered);
  },

  renderStudentsTable(list) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">Tidak ada data siswa yang cocok.</td></tr>`;
      return;
    }

    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">${s.student_id}</td>
        <td><strong>${s.student_name}</strong></td>
        <td><span class="nexus-badge badge-neutral">${s.class_name || '-'}</span></td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(s.created_at || Date.now()).toLocaleDateString('id-ID')}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.openEditStudentModal('${s.student_id}')">Edit</button>
            <button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.deleteStudent('${s.student_id}')">Hapus</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openAddStudentModal() {
    document.getElementById('modal-student-title').innerText = 'Tambah Siswa Manual';
    document.getElementById('form-student-id').value = '';
    document.getElementById('form-student-name').value = '';
    document.getElementById('form-student-class').value = '';
    document.getElementById('modal-student-form').classList.add('open');
  },

  openEditStudentModal(studentId) {
    const s = this.students.find(item => item.student_id === studentId);
    if (!s) return;
    document.getElementById('modal-student-title').innerText = 'Edit Data Siswa';
    document.getElementById('form-student-id').value = s.student_id;
    document.getElementById('form-student-name').value = s.student_name;
    document.getElementById('form-student-class').value = s.class_name || '';
    document.getElementById('modal-student-form').classList.add('open');
  },

  async handleSaveStudent(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('form-student-id').value.trim();
    const name = document.getElementById('form-student-name').value.trim();
    const className = document.getElementById('form-student-class').value.trim();

    if (!name) {
      window.TKA_API.toast('Nama siswa wajib diisi.', 'warning');
      return;
    }

    try {
      await window.TKA_API.request('admin_save_student', {
        session_token: this.currentUser?.session_token,
        student: {
          student_id: id || undefined,
          student_name: name,
          class_name: className
        }
      });
      window.TKA_API.toast('Data siswa berhasil disimpan!', 'success');
      document.getElementById('modal-student-form').classList.remove('open');
      this.loadStudents();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  async deleteStudent(studentId) {
    if (!confirm('Apakah Anda yakin ingin menghapus data siswa ini?')) return;
    try {
      await window.TKA_API.request('admin_delete_student', {
        session_token: this.currentUser?.session_token,
        student_id: studentId
      });
      window.TKA_API.toast('Data siswa berhasil dihapus.', 'info');
      this.loadStudents();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  // ==============================================================================
  // HASIL UJIAN & DETAIL LEMBAR JAWABAN
  // ==============================================================================

  async loadResults() {
    try {
      const list = await window.TKA_API.request('admin_get_attempts', {
        session_token: this.currentUser?.session_token
      });
      this.attempts = list || [];
      this.populateResultsPackageFilter();
      this.renderResultsTable(this.attempts);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  populateResultsPackageFilter() {
    const select = document.getElementById('filter-results-pkg');
    if (!select) return;
    const currentVal = select.value;
    const packages = Array.from(new Set(this.attempts.map(a => a.package_title).filter(Boolean))).sort();
    select.innerHTML = '<option value="ALL">Semua Paket Tryout</option>';
    packages.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    if (packages.includes(currentVal)) select.value = currentVal;
  },

  filterResults() {
    const search = (document.getElementById('search-results-student')?.value || '').toLowerCase().trim();
    const pkgFilter = document.getElementById('filter-results-pkg')?.value || 'ALL';

    let filtered = this.attempts;
    if (pkgFilter !== 'ALL') {
      filtered = filtered.filter(a => (a.package_title || '') === pkgFilter);
    }
    if (search) {
      filtered = filtered.filter(a => 
        (a.student_name || '').toLowerCase().includes(search) || 
        (a.class_name || '').toLowerCase().includes(search) ||
        (a.attempt_id || '').toLowerCase().includes(search)
      );
    }
    this.renderResultsTable(filtered);
  },

  renderResultsTable(list) {
    const tbody = document.getElementById('results-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Belum ada hasil tryout yang sesuai kriteria.</td></tr>`;
      return;
    }

    list.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${a.student_name}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${a.class_name})</span></td>
        <td>${a.package_title}</td>
        <td><span class="nexus-badge ${a.category.includes('LITERASI') ? 'badge-cyan' : 'badge-purple'}">${a.category}</span></td>
        <td><span class="nexus-badge ${a.score >= 75 ? 'badge-mint' : 'badge-amber'}" style="font-size:0.95rem;">${a.score}</span></td>
        <td><span style="color:var(--accent-primary); font-weight:700;">${a.correct_count} Benar</span> / <span style="color:var(--accent-rose);">${a.incorrect_count} Salah</span></td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(a.submitted_at).toLocaleString('id-ID')}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.openAttemptDetail('${a.attempt_id}')">👁️ Lembar Jawaban</button>
            <button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.resetAttempt('${a.attempt_id}')">🔄 Reset</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openAttemptDetail(attemptId) {
    const a = this.attempts.find(item => item.attempt_id === attemptId);
    if (!a) {
      window.TKA_API.toast('Data pengerjaan tidak ditemukan.', 'error');
      return;
    }

    document.getElementById('detail-student-header').innerText = `Lembar Jawaban: ${a.student_name} (${a.class_name})`;
    document.getElementById('detail-sub-header').innerText = `Paket: ${a.package_title} | Dikumpulkan: ${new Date(a.submitted_at).toLocaleString('id-ID')}`;

    const summaryCards = document.getElementById('detail-summary-cards');
    summaryCards.innerHTML = `
      <div class="nexus-card" style="padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted);">Skor Akhir</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--accent-primary);">${a.score}</div>
      </div>
      <div class="nexus-card" style="padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted);">Jawaban Benar</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--accent-mint);">${a.correct_count}</div>
      </div>
      <div class="nexus-card" style="padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted);">Jawaban Salah</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--accent-rose);">${a.incorrect_count}</div>
      </div>
      <div class="nexus-card" style="padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted);">Tidak Dijawab</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--text-muted);">${a.unanswered_count || 0}</div>
      </div>
    `;

    const container = document.getElementById('detail-questions-container');
    container.innerHTML = '';

    // Cari item rincian jawaban
    let items = [];
    if (a.result && a.result.items && Array.isArray(a.result.items)) {
      items = a.result.items;
    } else if (a.answers) {
      let ansMap = a.answers;
      if (typeof ansMap === 'string') {
        try { ansMap = JSON.parse(ansMap); } catch (e) { ansMap = {}; }
      }
      Object.keys(ansMap).forEach(qId => {
        const val = ansMap[qId];
        const qObj = this.questions.find(q => q.question_id === qId) || {};
        const studentAns = typeof val === 'object' ? (val.student_answer || val.answer || '-') : val;
        const isCorrect = typeof val === 'object' ? (val.is_correct || false) : (studentAns === qObj.correct_answer);
        items.push({
          question_id: qId,
          question_code: qObj.question_code || qId,
          question_text: qObj.question_text || 'Teks pertanyaan ujian',
          student_answer: studentAns,
          correct_answer: qObj.correct_answer || '-',
          is_correct: isCorrect,
          explanation: qObj.explanation || ''
        });
      });
    }

    if (items.length === 0) {
      container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">Rincian lembar jawaban per butir soal tersimpan dalam rekapitulasi nilai akhir.</div>`;
    } else {
      items.forEach((it, idx) => {
        const isCorrect = it.is_correct;
        const qCard = document.createElement('div');
        qCard.className = 'nexus-card';
        qCard.style.marginBottom = '12px';
        qCard.style.borderLeft = `4px solid ${isCorrect ? 'var(--accent-mint)' : 'var(--accent-rose)'}`;

        qCard.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="font-weight:700; font-size:0.88rem;">No ${idx + 1} (${it.question_code || it.question_id})</span>
            <span class="nexus-badge ${isCorrect ? 'badge-mint' : 'badge-rose'}">${isCorrect ? '✓ BENAR' : '✗ SALAH'}</span>
          </div>
          <div style="font-size:0.92rem; margin-bottom:10px; line-height:1.5;">${it.question_text}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.82rem; background:rgba(0,0,0,0.25); padding:10px; border-radius:8px;">
            <div>Jawaban Siswa: <strong style="color:${isCorrect ? 'var(--accent-mint)' : 'var(--accent-rose)'};">${it.student_answer || '(Kosong)'}</strong></div>
            <div>Kunci Benar: <strong style="color:var(--accent-mint);">${it.correct_answer}</strong></div>
          </div>
          ${it.explanation ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:8px;">💡 <em>Pembahasan:</em> ${it.explanation}</div>` : ''}
        `;
        container.appendChild(qCard);
      });
    }

    document.getElementById('modal-attempt-detail').classList.add('open');
  },

  async resetAttempt(attemptId) {
    if (!confirm('Apakah Anda yakin ingin mereset hasil ujian ini? Siswa akan dapat mengerjakan kembali jika token masih aktif.')) return;
    try {
      await window.TKA_API.request('admin_reset_attempt', {
        session_token: this.currentUser?.session_token,
        attempt_id: attemptId
      });
      window.TKA_API.toast('Hasil ujian berhasil direset.', 'info');
      this.loadResults();
      this.loadDashboardData();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  exportResultsToExcel() {
    if (!this.attempts || this.attempts.length === 0) {
      window.TKA_API.toast('Tidak ada data hasil ujian untuk diekspor.', 'warning');
      return;
    }

    if (typeof XLSX === 'undefined') {
      window.TKA_API.toast('Library SheetJS belum selesai dimuat.', 'error');
      return;
    }

    const aoa = [
      ['No', 'ID Ujian', 'Nama Siswa', 'Kelas/Rombel', 'Paket Tryout', 'Kategori', 'Nilai Akhir', 'Benar', 'Salah', 'Kosong', 'Status', 'Waktu Selesai']
    ];

    this.attempts.forEach((a, idx) => {
      aoa.push([
        idx + 1,
        a.attempt_id,
        a.student_name,
        a.class_name,
        a.package_title,
        a.category,
        a.score,
        a.correct_count,
        a.incorrect_count,
        a.unanswered_count || 0,
        'SELESAI',
        new Date(a.submitted_at).toLocaleString('id-ID')
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 25 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Hasil_Tryout');
    const filename = `Rekap_Hasil_Tryout_TKA_SD_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    window.TKA_API.toast(`File Rekap Excel (${filename}) berhasil diunduh!`, 'success');
  },

  // ==============================================================================
  // PENGATURAN & AUDIT LOG
  // ==============================================================================

  loadSettings() {
    const activeUrl = window.TKA_CONFIG.getApiUrl();
    const urlInput = document.getElementById('setting-gas-url');
    if (urlInput) urlInput.value = activeUrl;
  },

  handleSaveSettings(e) {
    e.preventDefault();
    const urlInput = document.getElementById('setting-gas-url');
    const newUrl = urlInput ? urlInput.value.trim() : '';

    window.TKA_CONFIG.setApiUrl(newUrl);
    window.TKA_API.toast('Pengaturan URL Google Apps Script berhasil disimpan!', 'success');
    this.testApiConnection();
  },

  async testApiConnection() {
    const badge = document.getElementById('api-connection-badge');
    if (badge) {
      badge.className = 'nexus-badge badge-amber';
      badge.innerText = '⚡ Menguji Koneksi...';
    }

    const startTime = Date.now();
    try {
      const res = await window.TKA_API.request('ping', {});
      const latency = Date.now() - startTime;
      if (badge) {
        badge.className = 'nexus-badge badge-mint';
        const isOnline = res && res.mode === 'online';
        badge.innerText = `✓ Terhubung (${isOnline ? 'Google Apps Script Live' : 'Mode Demo Offline'} • ${latency}ms)`;
      }
      window.TKA_API.toast(`Koneksi aktif! Waktu respon: ${latency}ms`, 'success');
    } catch (err) {
      if (badge) {
        badge.className = 'nexus-badge badge-rose';
        badge.innerText = `✗ Gagal Terhubung`;
      }
      window.TKA_API.toast(`Gagal terhubung ke API: ${err.message}`, 'error');
    }
  },

  async resetDatabase() {
    if (!confirm('PERINGATAN: Seluruh data lokal simulasi (soal baru, paket, token, dan hasil ujian) akan direset ke pengaturan awal bawaan. Lanjutkan?')) return;
    
    localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.LOCAL_DB);
    window.TKA_API.toast('Basis data lokal berhasil direset.', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  },

  async handleChangePassword(e) {
    if (e) e.preventDefault();
    const newPass = document.getElementById('input-new-pass').value;
    const confirmPass = document.getElementById('input-confirm-pass').value;

    if (!newPass || newPass.length < 6) {
      window.TKA_API.toast('Password minimal 6 karakter.', 'warning');
      return;
    }
    if (newPass !== confirmPass) {
      window.TKA_API.toast('Konfirmasi password baru tidak cocok!', 'error');
      return;
    }

    try {
      await window.TKA_API.request('admin_change_password', {
        session_token: this.currentUser?.session_token,
        new_password: newPass
      });
      window.TKA_API.toast('Password administrator berhasil diubah!', 'success');
      document.getElementById('input-new-pass').value = '';
      document.getElementById('input-confirm-pass').value = '';
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
