/**
 * ==============================================================================
 * LOGIKA ADMIN PORTAL (js/admin.js)
 * Dashboard, Bank Soal, Import & Media Manager, Paket, Token, Hasil, Pengaturan
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
    document.getElementById('admin-login-view').style.display = 'flex';
    document.getElementById('admin-app-layout').style.display = 'none';
  },

  showAdminLayout() {
    document.getElementById('admin-login-view').style.display = 'none';
    document.getElementById('admin-app-layout').style.display = 'flex';
    document.getElementById('admin-user-display').innerText = this.currentUser ? (this.currentUser.display_name || this.currentUser.username) : 'Admin';
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

    // File Input Import CSV
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

    // Form Pengaturan
    const settingsForm = document.getElementById('form-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Ekspor CSV Hasil
    const btnExport = document.getElementById('btn-export-results');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportResultsToCsv());
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
      window.TKA_API.toast('Login berhasil! Selamat datang.', 'success');
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
      document.getElementById('stat-pkg-count').innerText = c.total_packages || 0;
      document.getElementById('stat-qst-count').innerText = c.total_questions || 0;
      document.getElementById('stat-tkn-count').innerText = c.total_tokens || 0;
      document.getElementById('stat-stu-count').innerText = c.total_students || 0;
      document.getElementById('stat-att-count').innerText = c.total_attempts || 0;
      document.getElementById('stat-avg-score').innerText = c.avg_score || 0;

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

      this.questions = questions;
      this.renderQuestionsTable(questions);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderQuestionsTable(list) {
    const tbody = document.getElementById('questions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
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
    document.getElementById('form-q-category').value = 'LITERASI';
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
   * Modal Pratinjau & Pengelolaan Media Gambar Soal (Sesuai PRD)
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
            ${optImg ? `<button type="button" class="pill-btn pill-btn-danger pill-btn-sm" onclick="AdminApp.removeImage('${opt.code}')">Hapus Foto</button>` : ''}
          </div>
        </div>
        ${optImg ? `<div class="option-media-container" style="margin-top:10px;"><img src="${optImg}" class="option-media-img"></div>` : ''}
      `;
      optsBox.appendChild(optDiv);
    });

    document.getElementById('preview-explanation-text').innerText = q.explanation || 'Belum ada pembahasan.';
    document.getElementById('modal-question-preview').classList.add('open');
  },

  /**
   * Upload Gambar Langsung dari Perangkat (Batang Soal / Opsi)
   */
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
      
      // Jika mode live GAS, kirim ke backend untuk disimpan ke Google Drive
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
        // Mode demo: simpan Data URI
        q.image_refs[targetSlot] = base64Data;
      }

      // Simpan perubahan ke backend
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
  // IMPORT SOAL CSV & LAPORAN VALIDASI PER BARIS
  // ==============================================================================

  openTemplateModal() {
    const modal = document.getElementById('modal-template-excel');
    if (modal) modal.classList.add('open');
  },

  openImportModal() {
    document.getElementById('import-report-box').style.display = 'none';
    document.getElementById('btn-confirm-import').style.display = 'none';
    document.getElementById('input-import-file').value = '';
    document.getElementById('modal-import-csv').classList.add('open');
  },

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (fileEvent) => {
      const content = fileEvent.target.result;
      this.parseAndValidateCsv(content);
    };
    reader.readAsText(file);
  },

  parseAndValidateCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      window.TKA_API.toast('File CSV kosong atau hanya berisi header.', 'error');
      return;
    }

    // Parsing CSV mempertimbangkan tanda kutip koma
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      rows.push(this.parseCsvLine(lines[i]));
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const validQuestions = [];
    const reportRows = [];

    let successCount = 0;
    let failCount = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0 || row.join('').trim() === '') continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = row[c] || '';
      }

      // Pemetaan Kolom Fleksibel (Mendukung format No/Materi/Level/Soal/Kunci & question_code/type/...)
      const rawNo = (obj['no'] || '').trim();
      const code = obj['question_code'] || (rawNo ? `NUM-${rawNo.padStart(3, '0')}` : `ROW-${r}`);
      
      let type = (obj['type'] || obj['kategori'] || '').trim().toUpperCase();
      if (!type) {
        // Otomatis deteksi dari materi/indikator jika ada
        type = 'NUMERASI';
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

      if (!['LITERASI', 'NUMERASI'].includes(type)) {
        errors.push(`Kategori '${type}' tidak valid (wajib LITERASI atau NUMERASI)`);
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
          category: type,
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

      window.TKA_API.toast(`Sukses mengimpor ${res.imported_count} soal!`, 'success');
      document.getElementById('modal-import-csv').classList.remove('open');
      this.loadQuestions();
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
      this.packages = list;
      this.renderPackagesGrid(list);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderPackagesGrid(list) {
    const grid = document.getElementById('packages-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (list.length === 0) {
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
        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">${p.description || 'Tidak ada deskripsi.'}</p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; font-size:0.8rem; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:10px;">
          <div>⏱️ <strong>${p.duration_minutes} Menit</strong></div>
          <div>📝 <strong>${p.question_count || 0} Soal</strong></div>
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
    document.getElementById('picker-selected-count').innerText = `${checked.length} Soal Dipilih`;
  },

  async handleSavePackage(e) {
    e.preventDefault();
    const pkgId = document.getElementById('form-pkg-id').value;
    const selectedQIds = Array.from(document.querySelectorAll('.pkg-q-check:checked')).map(cb => cb.value);

    if (selectedQIds.length === 0) {
      window.TKA_API.toast('Pilih minimal 1 soal untuk paket ini.', 'warning');
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
      this.tokens = list;
      this.renderTokensTable(list);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderTokensTable(list) {
    const tbody = document.getElementById('tokens-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
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
          <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" onclick="AdminApp.toggleToken('${t.token_id}', ${!t.active})">
            ${t.active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openGenerateTokenModal() {
    // Isi opsi paket
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
      this.students = list;
      this.renderStudentsTable(list);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderStudentsTable(list) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:30px;">Belum ada data siswa terdaftar. Siswa terdaftar otomatis saat mulai ujian.</td></tr>`;
      return;
    }

    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">${s.student_id}</td>
        <td><strong>${s.student_name}</strong></td>
        <td><span class="nexus-badge badge-neutral">${s.class_name || '-'}</span></td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(s.created_at || Date.now()).toLocaleDateString('id-ID')}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // ==============================================================================
  // HASIL UJIAN & EKSPOR CSV
  // ==============================================================================

  async loadResults() {
    try {
      const list = await window.TKA_API.request('admin_get_attempts', {
        session_token: this.currentUser?.session_token
      });
      this.attempts = list;
      this.renderResultsTable(list);
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    }
  },

  renderResultsTable(list) {
    const tbody = document.getElementById('results-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Belum ada hasil tryout yang dikumpulkan.</td></tr>`;
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
        <td><span class="nexus-badge badge-mint">SELESAI</span></td>
      `;
      tbody.appendChild(tr);
    });
  },

  exportResultsToCsv() {
    if (this.attempts.length === 0) {
      window.TKA_API.toast('Tidak ada data hasil ujian untuk diekspor.', 'warning');
      return;
    }

    let csv = 'ID Percobaan,Nama Siswa,Kelas,Paket Tryout,Kategori,Nilai,Benar,Salah,Kosong,Waktu Selesai\n';
    this.attempts.forEach(a => {
      csv += `"${a.attempt_id}","${a.student_name}","${a.class_name}","${a.package_title}","${a.category}",${a.score},${a.correct_count},${a.incorrect_count},${a.unanswered_count},"${a.submitted_at}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Rekap_Hasil_Tryout_TKA_SD_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    window.TKA_API.toast('Ekspor rekap hasil CSV berhasil diunduh!', 'success');
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
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
