/**
 * ==============================================================================
 * LOGIKA SISWA & UJIAN LIVE (js/student.js)
 * Portal Ujian Tryout TKA SD
 * ==============================================================================
 */

const StudentApp = {
  currentView: 'view-token', // 'view-token', 'view-confirm', 'view-exam', 'view-result', 'view-review'
  tokenData: null,
  attemptData: null,
  questions: [],
  currentIndex: 0,
  answers: {}, // { [question_id]: string | string[] }
  flags: {},   // { [question_id]: boolean } (Ragu-ragu)
  timerInterval: null,
  autosaveInterval: null,
  remainingSeconds: 0,

  /**
   * Inisialisasi Aplikasi Siswa
   */
  init() {
    this.bindEvents();
    this.checkActiveSession();
  },

  /**
   * Cek apakah ada sesi ujian yang sedang berjalan di perangkat ini
   */
  checkActiveSession() {
    const savedSession = localStorage.getItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Cek deadline
        const now = new Date().getTime();
        const deadline = new Date(session.deadline_at).getTime();

        if (now < deadline) {
          this.attemptData = session;
          this.questions = session.questions || [];
          this.answers = JSON.parse(localStorage.getItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_ANSWERS) || '{}');
          this.flags = JSON.parse(localStorage.getItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_FLAGS) || '{}');
          this.remainingSeconds = Math.max(0, Math.floor((deadline - now) / 1000));
          
          this.switchView('view-exam');
          this.startTimer();
          this.startAutosave();
          this.renderQuestion();
          this.renderPalette();
          window.TKA_API.toast('Sesi pengerjaan sebelumnya dipulihkan.', 'info');
          return;
        } else {
          // Waktu telah habis saat offline
          localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION);
        }
      } catch (e) {
        localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION);
      }
    }
  },

  bindEvents() {
    // Form Token Submit
    const tokenForm = document.getElementById('token-form');
    if (tokenForm) {
      tokenForm.addEventListener('submit', (e) => this.handleTokenSubmit(e));
    }

    // Tombol Mulai di Layar Konfirmasi
    const btnStart = document.getElementById('btn-start-exam');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.handleStartExam());
    }

    // Tombol Batalkan di Layar Konfirmasi
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    if (btnCancelConfirm) {
      btnCancelConfirm.addEventListener('click', () => {
        this.tokenData = null;
        this.switchView('view-token');
      });
    }

    // Navigasi Soal
    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.prevQuestion());
    }

    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => this.nextQuestion());
    }

    const btnFlag = document.getElementById('btn-flag');
    if (btnFlag) {
      btnFlag.addEventListener('click', () => this.toggleFlag());
    }

    const btnSubmitModal = document.getElementById('btn-open-submit-modal');
    if (btnSubmitModal) {
      btnSubmitModal.addEventListener('click', () => this.openSubmitModal());
    }

    const btnConfirmSubmit = document.getElementById('btn-confirm-submit');
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener('click', () => this.submitExam());
    }

    const btnCancelSubmit = document.getElementById('btn-cancel-submit');
    if (btnCancelSubmit) {
      btnCancelSubmit.addEventListener('click', () => this.closeSubmitModal());
    }

    // Tombol Lihat Pembahasan di Hasil
    const btnViewReview = document.getElementById('btn-view-review');
    if (btnViewReview) {
      btnViewReview.addEventListener('click', () => this.switchView('view-review'));
    }

    const btnBackToHome = document.getElementById('btn-back-home');
    if (btnBackToHome) {
      btnBackToHome.addEventListener('click', () => {
        localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION);
        localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_ANSWERS);
        localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_FLAGS);
        window.location.reload();
      });
    }
  },

  switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) {
      target.style.display = 'block';
      this.currentView = viewId;
      window.scrollTo(0, 0);
    }
  },

  /**
   * Verifikasi Token Masuk
   */
  async handleTokenSubmit(e) {
    e.preventDefault();
    const tokenInput = document.getElementById('input-token');
    const nameInput = document.getElementById('input-student-name');
    const classInput = document.getElementById('input-student-class');
    const btn = document.getElementById('btn-submit-token');

    const rawToken = tokenInput.value.trim().toUpperCase();
    const studentName = (nameInput ? nameInput.value : '').trim() || 'Siswa Peserta';
    const className = (classInput ? classInput.value : '').trim() || 'Kelas 5';

    if (!rawToken) {
      window.TKA_API.toast('Silakan masukkan token ujian.', 'warning');
      tokenInput.focus();
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memeriksa...`;

    try {
      const data = await window.TKA_API.request('student_verify_token', { token: rawToken });
      this.tokenData = {
        token: rawToken,
        student_name: studentName,
        class_name: className,
        ...data
      };

      this.populateConfirmView();
      this.switchView('view-confirm');
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Masuk Ujian <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  },

  populateConfirmView() {
    const pkg = this.tokenData.package;
    document.getElementById('confirm-title').innerText = pkg.title;
    document.getElementById('confirm-desc').innerText = pkg.description || 'Tidak ada deskripsi.';
    document.getElementById('confirm-category').innerText = pkg.category;
    document.getElementById('confirm-duration').innerText = `${pkg.duration_minutes} Menit`;
    document.getElementById('confirm-qcount').innerText = `${pkg.question_count} Soal`;
    document.getElementById('confirm-student').innerText = `${this.tokenData.student_name} (${this.tokenData.class_name})`;
    document.getElementById('confirm-attempt').innerText = `Percobaan ke-${(pkg.attempt_count || 0) + 1} dari ${pkg.attempt_limit}`;
  },

  /**
   * Memulai Ujian
   */
  async handleStartExam() {
    const btn = document.getElementById('btn-start-exam');
    btn.disabled = true;
    btn.innerText = 'Menyiapkan Soal...';

    try {
      const attempt = await window.TKA_API.request('student_start_attempt', {
        token: this.tokenData.token,
        student_name: this.tokenData.student_name,
        class_name: this.tokenData.class_name
      });

      this.attemptData = attempt;
      this.questions = attempt.questions || [];
      this.currentIndex = 0;
      this.answers = {};
      this.flags = {};
      this.remainingSeconds = attempt.duration_seconds || (30 * 60);

      // Simpan sesi ke localStorage
      localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION, JSON.stringify(attempt));
      localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_ANSWERS, JSON.stringify({}));
      localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_FLAGS, JSON.stringify({}));

      document.getElementById('exam-title-badge').innerText = attempt.package_title;
      document.getElementById('exam-student-badge').innerText = this.tokenData.student_name;

      this.switchView('view-exam');
      this.startTimer();
      this.startAutosave();
      this.renderQuestion();
      this.renderPalette();
    } catch (err) {
      window.TKA_API.toast(err.message, 'error');
      btn.disabled = false;
      btn.innerText = 'Mulai Kerjakan Sekarang';
    }
  },

  /**
   * Timer Hitung Mundur dengan Validasi Deadline
   */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const timerEl = document.getElementById('exam-timer');

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;

      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        if (timerEl) timerEl.innerText = '00:00:00';
        window.TKA_API.toast('Waktu pengerjaan telah habis! Mengirimkan jawaban...', 'warning');
        this.submitExam(true);
        return;
      }

      const hrs = Math.floor(this.remainingSeconds / 3600);
      const mins = Math.floor((this.remainingSeconds % 3600) / 60);
      const secs = this.remainingSeconds % 60;

      const fmt = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      if (timerEl) {
        timerEl.innerText = fmt;
        // Peringatan jika di bawah 5 menit
        if (this.remainingSeconds < 300) {
          timerEl.parentElement.classList.add('warning');
        } else {
          timerEl.parentElement.classList.remove('warning');
        }
      }
    }, 1000);
  },

  /**
   * Autosave Jawaban Siswa
   */
  startAutosave() {
    if (this.autosaveInterval) clearInterval(this.autosaveInterval);

    this.autosaveInterval = setInterval(async () => {
      if (this.attemptData && this.attemptData.attempt_id) {
        const indicator = document.getElementById('autosave-indicator');
        if (indicator) indicator.innerText = 'Menyimpan...';

        try {
          await window.TKA_API.request('student_save_progress', {
            attempt_id: this.attemptData.attempt_id,
            answers: this.answers
          });
          if (indicator) indicator.innerText = 'Tersimpan otomatis';
        } catch (e) {
          if (indicator) indicator.innerText = 'Tersimpan lokal';
        }
      }
    }, window.TKA_CONFIG.AUTOSAVE_INTERVAL_SEC * 1000);
  },

  /**
   * Render Soal Aktif
   */
  renderQuestion() {
    if (this.questions.length === 0) return;
    const q = this.questions[this.currentIndex];

    // Meta Soal
    document.getElementById('q-current-num').innerText = `Soal ${this.currentIndex + 1} dari ${this.questions.length}`;
    document.getElementById('q-category-badge').innerText = q.category;
    document.getElementById('q-type-badge').innerText = q.question_type === 'MULTI_SELECT' ? 'Pilihan Ganda Kompleks' : 'Pilihan Ganda';
    
    // Teks Soal
    document.getElementById('q-body-text').innerText = q.question_text;

    // Render Gambar Batang Soal (jika ada) — Utuh & Proporsional
    const promptImgContainer = document.getElementById('q-prompt-media');
    promptImgContainer.innerHTML = '';
    if (q.image_refs && q.image_refs.prompt) {
      const img = document.createElement('img');
      img.src = q.image_refs.prompt;
      img.alt = 'Gambar Soal';
      img.className = 'question-media-img';
      img.onclick = () => this.zoomImage(q.image_refs.prompt);
      promptImgContainer.appendChild(img);
    }

    // Render Opsi Jawaban
    const optionsContainer = document.getElementById('q-options-container');
    optionsContainer.innerHTML = '';

    const currentAnswer = this.answers[q.question_id];
    const isMulti = q.question_type === 'MULTI_SELECT';

    (q.options || []).forEach(opt => {
      const optItem = document.createElement('div');
      optItem.className = 'option-item';

      let isSelected = false;
      if (isMulti) {
        isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(opt.code);
      } else {
        isSelected = currentAnswer === opt.code;
      }

      if (isSelected) optItem.classList.add('selected');

      // Gambar opsi jika ada
      let optionMediaHtml = '';
      if (q.image_refs && q.image_refs[opt.code]) {
        optionMediaHtml = `
          <div class="option-media-container">
            <img src="${q.image_refs[opt.code]}" alt="Opsi ${opt.code}" class="option-media-img">
          </div>
        `;
      }

      optItem.innerHTML = `
        <div class="option-code-badge">${opt.code}</div>
        <div class="option-label">
          <div>${opt.text}</div>
          ${optionMediaHtml}
        </div>
      `;

      optItem.addEventListener('click', () => {
        this.selectOption(q.question_id, opt.code, isMulti);
      });

      optionsContainer.appendChild(optItem);
    });

    // Update status tombol ragu-ragu
    const btnFlag = document.getElementById('btn-flag');
    if (btnFlag) {
      if (this.flags[q.question_id]) {
        btnFlag.className = 'pill-btn pill-btn-primary';
        btnFlag.innerHTML = `★ Ragu-ragu (Ditandai)`;
      } else {
        btnFlag.className = 'pill-btn pill-btn-outline';
        btnFlag.innerHTML = `☆ Ragu-ragu`;
      }
    }

    // Update disable tombol prev/next
    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.disabled = (this.currentIndex === 0);

    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      if (this.currentIndex === this.questions.length - 1) {
        btnNext.innerText = 'Selesai';
      } else {
        btnNext.innerText = 'Selanjutnya';
      }
    }

    this.renderPalette();
  },

  /**
   * Pilihan Opsi
   */
  selectOption(qId, code, isMulti) {
    if (isMulti) {
      let current = Array.isArray(this.answers[qId]) ? [...this.answers[qId]] : [];
      if (current.includes(code)) {
        current = current.filter(c => c !== code);
      } else {
        current.push(code);
      }
      this.answers[qId] = current.sort();
    } else {
      this.answers[qId] = code;
    }

    // Simpan ke local storage instan
    localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_ANSWERS, JSON.stringify(this.answers));
    this.renderQuestion();
  },

  /**
   * Toggle Ragu-ragu
   */
  toggleFlag() {
    const q = this.questions[this.currentIndex];
    this.flags[q.question_id] = !this.flags[q.question_id];
    localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_FLAGS, JSON.stringify(this.flags));
    this.renderQuestion();
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderQuestion();
    }
  },

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.renderQuestion();
    } else {
      this.openSubmitModal();
    }
  },

  jumpToQuestion(idx) {
    this.currentIndex = idx;
    this.renderQuestion();
  },

  /**
   * Render Palet Navigasi Soal (Nomor 1..N)
   */
  renderPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let answeredCount = 0;

    this.questions.forEach((q, idx) => {
      const btn = document.createElement('div');
      btn.className = 'palette-btn';
      btn.innerText = (idx + 1);

      const hasAnswer = this.answers[q.question_id] && (
        !Array.isArray(this.answers[q.question_id]) || this.answers[q.question_id].length > 0
      );
      const isFlagged = this.flags[q.question_id];

      if (hasAnswer) {
        btn.classList.add('answered');
        answeredCount++;
      }
      if (isFlagged) {
        btn.classList.add('ragu');
      }
      if (idx === this.currentIndex) {
        btn.classList.add('active-current');
      }

      btn.addEventListener('click', () => this.jumpToQuestion(idx));
      grid.appendChild(btn);
    });

    const summaryEl = document.getElementById('palette-summary');
    if (summaryEl) {
      summaryEl.innerText = `${answeredCount}/${this.questions.length} Soal Terjawab`;
    }
  },

  /**
   * Modal Konfirmasi Submit
   */
  openSubmitModal() {
    let answered = 0;
    this.questions.forEach(q => {
      const a = this.answers[q.question_id];
      if (a && (!Array.isArray(a) || a.length > 0)) answered++;
    });

    const unanswered = this.questions.length - answered;
    document.getElementById('modal-ans-count').innerText = answered;
    document.getElementById('modal-unans-count').innerText = unanswered;

    document.getElementById('modal-submit-confirm').classList.add('open');
  },

  closeSubmitModal() {
    document.getElementById('modal-submit-confirm').classList.remove('open');
  },

  /**
   * Submit Ujian dan Ambil Hasil Penilaian
   */
  async submitExam(isTimeout = false) {
    this.closeSubmitModal();
    clearInterval(this.timerInterval);
    clearInterval(this.autosaveInterval);

    // Tampilkan loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
      const result = await window.TKA_API.request('student_submit_attempt', {
        attempt_id: this.attemptData.attempt_id,
        answers: this.answers
      });

      // Bersihkan sesi aktif
      localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_SESSION);
      localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_ANSWERS);
      localStorage.removeItem(window.TKA_CONFIG.STORAGE_KEYS.STUDENT_FLAGS);

      this.renderResult(result, isTimeout);
      this.switchView('view-result');
    } catch (err) {
      window.TKA_API.toast('Gagal mengumpulkan: ' + err.message, 'error');
    } finally {
      if (overlay) overlay.style.display = 'none';
    }
  },

  /**
   * Render Hasil Ujian
   */
  renderResult(res, isTimeout) {
    document.getElementById('result-score-val').innerText = res.score;
    document.getElementById('result-correct').innerText = `${res.correct_count} Benar`;
    document.getElementById('result-incorrect').innerText = `${res.incorrect_count} Salah`;
    document.getElementById('result-unanswered').innerText = `${res.unanswered_count} Kosong`;

    const statusBadge = document.getElementById('result-status-badge');
    if (res.score >= 75) {
      statusBadge.className = 'nexus-badge badge-mint';
      statusBadge.innerText = 'LULUS / TUNTAS';
    } else {
      statusBadge.className = 'nexus-badge badge-amber';
      statusBadge.innerText = 'PERLU BIMBINGAN';
    }

    // Cek apakah pembahasan diizinkan oleh paket
    const reviewBtn = document.getElementById('btn-view-review');
    if (reviewBtn) {
      if (res.show_explanations) {
        reviewBtn.style.display = 'inline-flex';
        this.renderReviewItems(res.items || []);
      } else {
        reviewBtn.style.display = 'none';
      }
    }
  },

  /**
   * Render Daftar Pembahasan Soal
   */
  renderReviewItems(items) {
    const list = document.getElementById('review-items-container');
    if (!list) return;
    list.innerHTML = '';

    if (items.length === 0) {
      list.innerHTML = `<div class="nexus-card text-center text-muted">Pembahasan tidak diaktifkan oleh pengajar.</div>`;
      return;
    }

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `nexus-card ${item.is_correct ? 'border-mint' : 'border-rose'}`;
      card.style.marginBottom = '20px';

      const stuAnsStr = Array.isArray(item.student_answer) ? item.student_answer.join(', ') : (item.student_answer || 'Tidak dijawab');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="nexus-badge ${item.is_correct ? 'badge-mint' : 'badge-rose'}">
            ${item.is_correct ? '✓ JAWABAN BENAR' : '✗ JAWABAN SALAH'}
          </span>
          <span class="nexus-badge badge-neutral">Nomor ${idx + 1} (${item.category})</span>
        </div>
        <p style="font-size:1.05rem; font-weight:600; margin-bottom:16px;">${item.question_text}</p>
        
        <div style="background:rgba(0,0,0,0.25); padding:14px; border-radius:12px; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Jawaban Kamu:</div>
            <div style="font-weight:700; color:${item.is_correct ? 'var(--accent-primary)' : 'var(--accent-rose)'};">${stuAnsStr}</div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Kunci Jawaban:</div>
            <div style="font-weight:700; color:var(--accent-primary);">${item.correct_answer}</div>
          </div>
        </div>

        <div style="background:rgba(0, 229, 153, 0.08); border-left:4px solid var(--accent-primary); padding:14px 18px; border-radius:8px;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--accent-primary); margin-bottom:4px;">PEMBAHASAN:</div>
          <div style="font-size:0.95rem; color:var(--text-main);">${item.explanation || 'Belum ada penjelasan tertulis.'}</div>
        </div>
      `;

      list.appendChild(card);
    });
  },

  /**
   * Zoom Gambar
   */
  zoomImage(url) {
    const modal = document.getElementById('modal-image-zoom');
    const img = document.getElementById('zoom-img-target');
    if (modal && img) {
      img.src = url;
      modal.classList.add('open');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  StudentApp.init();
});
