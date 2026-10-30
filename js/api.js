/**
 * ==============================================================================
 * MODUL API & KOMUNIKASI JARINGAN (js/api.js)
 * Mendukung Live Google Apps Script Backend & Smart Offline Demo Fallback
 * ==============================================================================
 */

const API = {
  /**
   * Request Universal ke Backend
   */
  async request(action, payload = {}) {
    const apiUrl = window.TKA_CONFIG.getApiUrl();
    const fullPayload = { action, ...payload };

    // Jika URL GAS aktif telah dikonfigurasi, kirim ke server sebenarnya
    if (apiUrl && (apiUrl.startsWith('http') || apiUrl.startsWith('/'))) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            // Jika via proxy Vercel gunakan application/json, jika direct GAS gunakan text/plain agar tidak kena preflight
            'Content-Type': apiUrl.startsWith('/') ? 'application/json' : 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(fullPayload)
        });

        const resData = await response.json();
        if (!resData.success) {
          throw new Error(resData.error ? resData.error.message : 'Terjadi kesalahan pada backend.');
        }
        return resData.data;
      } catch (err) {
        console.warn('Backend request error:', err);
        // Jika proxy belum terhubung atau mode offline lokal, fallback ke mock jika diizinkan
        if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
          return this.mockBackend(action, fullPayload);
        }
        throw err;
      }
    }

    // --- SMART OFFLINE DEMO SIMULATION (Ketika URL GAS belum dimasukkan) ---
    console.info(`[Demo Mode] Menjalankan aksi backend lokal: ${action}`);
    return this.mockBackend(action, fullPayload);
  },

  /**
   * Simulasi Backend Lokal Lengkap (Memastikan aplikasi dapat langsung diuji dari detik pertama)
   */
  async mockBackend(action, payload) {
    // Simulasi delay jaringan realistis
    await new Promise(r => setTimeout(r, 250));

    let db = this.getMockDb();

    switch (action) {
      // --- SISWA ---
      case 'student_verify_token': {
        const rawToken = (payload.token || '').trim().toUpperCase();
        const foundToken = db.tokens.find(t => t.raw_token === rawToken || t.token_id === rawToken);
        if (!foundToken) throw new Error('Token tidak valid atau tidak ditemukan. Coba gunakan token demo: TKASD26');
        if (!foundToken.active) throw new Error('Token ini telah dinonaktifkan.');
        if (foundToken.attempt_count >= foundToken.attempt_limit) {
          throw new Error(`Batas percobaan token telah habis (${foundToken.attempt_count}/${foundToken.attempt_limit}).`);
        }

        const pkg = db.packages.find(p => p.package_id === foundToken.package_id);
        if (!pkg || pkg.status !== 'ACTIVE') throw new Error('Paket tryout tidak aktif atau tidak ditemukan.');

        return {
          valid: true,
          token_id: foundToken.token_id,
          package: {
            package_id: pkg.package_id,
            title: pkg.title,
            description: pkg.description,
            category: pkg.category,
            duration_minutes: pkg.duration_minutes,
            question_count: pkg.question_ids.length,
            attempt_limit: foundToken.attempt_limit,
            attempt_count: foundToken.attempt_count
          }
        };
      }

      case 'student_start_attempt': {
        const verify = await this.mockBackend('student_verify_token', { token: payload.token });
        const pkg = db.packages.find(p => p.package_id === verify.package.package_id);
        const questions = db.questions
          .filter(q => pkg.question_ids.includes(q.question_id) && q.status === 'ACTIVE')
          .map(q => ({
            question_id: q.question_id,
            category: q.category,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options,
            image_refs: q.image_refs || {},
            difficulty: q.difficulty
          }));

        const now = new Date();
        const durationMs = pkg.duration_minutes * 60 * 1000;
        const deadlineDate = new Date(now.getTime() + durationMs);
        const attemptId = 'ATT-' + Math.random().toString(36).substring(2, 9).toUpperCase();

        const newAttempt = {
          attempt_id: attemptId,
          token_id: verify.token_id,
          student_name: payload.student_name || 'Siswa',
          class_name: payload.class_name || '5 SD',
          package_id: pkg.package_id,
          started_at: now.toISOString(),
          deadline_at: deadlineDate.toISOString(),
          status: 'IN_PROGRESS',
          answers: {}
        };
        db.attempts.push(newAttempt);
        this.saveMockDb(db);

        return {
          attempt_id: attemptId,
          student_id: 'STU-DEMO',
          package_title: pkg.title,
          category: pkg.category,
          started_at: now.toISOString(),
          deadline_at: deadlineDate.toISOString(),
          duration_seconds: pkg.duration_minutes * 60,
          questions: questions
        };
      }

      case 'student_save_progress': {
        const attempt = db.attempts.find(a => a.attempt_id === payload.attempt_id);
        if (attempt && attempt.status === 'IN_PROGRESS') {
          attempt.answers = payload.answers || {};
          this.saveMockDb(db);
          return { saved: true, timestamp: new Date().toISOString() };
        }
        return { saved: false };
      }

      case 'student_submit_attempt': {
        const attempt = db.attempts.find(a => a.attempt_id === payload.attempt_id);
        if (!attempt) throw new Error('Percobaan ujian tidak ditemukan.');
        if (attempt.status === 'SUBMITTED') {
          return { already_submitted: true, result: attempt.result };
        }

        const pkg = db.packages.find(p => p.package_id === attempt.package_id);
        const submittedAnswers = payload.answers || {};
        let correctCount = 0;
        let incorrectCount = 0;
        let unansweredCount = 0;
        const items = [];

        for (const qId of pkg.question_ids) {
          const q = db.questions.find(item => item.question_id === qId);
          if (!q) continue;

          const ans = submittedAnswers[qId];
          const correct = q.correct_answer;
          let isCorrect = false;

          if (!ans || (Array.isArray(ans) && ans.length === 0)) {
            unansweredCount++;
          } else if (q.question_type === 'MULTI_SELECT') {
            const correctSorted = correct.split(',').map(s => s.trim().toUpperCase()).sort().join(',');
            const ansSorted = (Array.isArray(ans) ? ans : [ans]).map(s => s.toString().trim().toUpperCase()).sort().join(',');
            if (correctSorted === ansSorted) {
              isCorrect = true;
              correctCount++;
            } else {
              incorrectCount++;
            }
          } else {
            if (ans.toString().trim().toUpperCase() === correct.trim().toUpperCase()) {
              isCorrect = true;
              correctCount++;
            } else {
              incorrectCount++;
            }
          }

          items.push({
            question_id: q.question_id,
            category: q.category,
            question_type: q.question_type,
            question_text: q.question_text,
            student_answer: ans || null,
            correct_answer: correct,
            is_correct: isCorrect,
            explanation: q.explanation || ''
          });
        }

        const totalQ = pkg.question_ids.length;
        const score = totalQ > 0 ? Math.round((correctCount / totalQ) * 1000) / 10 : 0;
        const nowIso = new Date().toISOString();

        const resultData = {
          score,
          total_questions: totalQ,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          unanswered_count: unansweredCount,
          submitted_at: nowIso,
          show_explanations: pkg.show_explanations,
          items: pkg.show_explanations ? items : []
        };

        attempt.status = 'SUBMITTED';
        attempt.submitted_at = nowIso;
        attempt.score = score;
        attempt.correct_count = correctCount;
        attempt.incorrect_count = incorrectCount;
        attempt.unanswered_count = unansweredCount;
        attempt.result = resultData;

        // Tambah hitungan pada token
        const tok = db.tokens.find(t => t.token_id === attempt.token_id);
        if (tok) tok.attempt_count = (tok.attempt_count || 0) + 1;

        this.saveMockDb(db);
        return resultData;
      }

      // --- ADMIN AUTH ---
      case 'admin_login': {
        const u = payload.username;
        const p = payload.password;
        if (u === 'admin' && (p === 'AdminTKA2026!' || p === 'admin')) {
          const session = {
            user_id: 'USR-ADMIN-01',
            username: 'admin',
            display_name: 'Administrator TKA',
            role: 'ADMIN',
            token: 'SES-DEMO-' + Date.now()
          };
          return { success: true, session_token: session.token, user: session };
        }
        throw new Error('Username atau password admin salah. (Default: admin / AdminTKA2026!)');
      }

      // --- ADMIN DASHBOARD ---
      case 'admin_get_dashboard_stats': {
        const submitted = db.attempts.filter(a => a.status === 'SUBMITTED');
        const scores = submitted.map(a => a.score || 0);
        const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

        return {
          counts: {
            total_packages: db.packages.length,
            total_questions: db.questions.length,
            total_tokens: db.tokens.length,
            total_students: db.students.length + submitted.length,
            total_attempts: submitted.length,
            avg_score: avg,
            avg_literasi: 82.5,
            avg_numerasi: 78.0,
            passed_count: scores.filter(s => s >= 75).length,
            remedial_count: scores.filter(s => s < 75).length
          },
          recent_attempts: submitted.slice(-5).reverse().map(a => ({
            attempt_id: a.attempt_id,
            student_name: a.student_name,
            class_name: a.class_name,
            package_title: 'Tryout TKA SD 2026',
            score: a.score,
            correct_count: a.correct_count,
            submitted_at: a.submitted_at
          }))
        };
      }

      // --- ADMIN QUESTIONS CRUD ---
      case 'admin_get_questions': {
        let qList = [...db.questions];
        const f = payload.filters || {};
        if (f.category && f.category !== 'ALL') qList = qList.filter(q => q.category === f.category);
        if (f.question_type && f.question_type !== 'ALL') qList = qList.filter(q => q.question_type === f.question_type);
        if (f.search) {
          const s = f.search.toLowerCase();
          qList = qList.filter(q => q.question_text.toLowerCase().includes(s) || q.question_code.toLowerCase().includes(s));
        }
        return qList;
      }

      case 'admin_save_question': {
        const qData = payload.question;
        const isNew = !qData.question_id;
        const qId = qData.question_id || ('QST-' + Math.random().toString(36).substring(2, 7).toUpperCase());

        const newObj = {
          ...qData,
          question_id: qId,
          image_refs: qData.image_refs || {}
        };

        if (isNew) {
          db.questions.push(newObj);
        } else {
          const idx = db.questions.findIndex(q => q.question_id === qId);
          if (idx !== -1) db.questions[idx] = newObj;
        }
        this.saveMockDb(db);
        return { question_id: qId };
      }

      case 'admin_delete_question': {
        db.questions = db.questions.filter(q => q.question_id !== payload.question_id);
        this.saveMockDb(db);
        return { deleted: true };
      }

      case 'admin_batch_import_questions': {
        const imported = payload.questions || [];
        for (const item of imported) {
          db.questions.push({
            ...item,
            question_id: 'QST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            image_refs: {}
          });
        }
        this.saveMockDb(db);
        return { imported_count: imported.length };
      }

      // --- ADMIN PACKAGES CRUD ---
      case 'admin_get_packages': {
        return db.packages.map(p => ({
          ...p,
          question_count: p.question_ids ? p.question_ids.length : 0
        }));
      }

      case 'admin_save_package': {
        const pData = payload.package;
        const pId = pData.package_id || ('PKG-' + Math.random().toString(36).substring(2, 7).toUpperCase());
        const pkgObj = { ...pData, package_id: pId };

        const idx = db.packages.findIndex(p => p.package_id === pId);
        if (idx !== -1) {
          db.packages[idx] = pkgObj;
        } else {
          db.packages.push(pkgObj);
        }
        this.saveMockDb(db);
        return { package_id: pId };
      }

      case 'admin_delete_package': {
        db.packages = db.packages.filter(p => p.package_id !== payload.package_id);
        this.saveMockDb(db);
        return { deleted: true };
      }

      // --- ADMIN TOKENS CRUD ---
      case 'admin_get_tokens': {
        return db.tokens.map(t => {
          const p = db.packages.find(pkg => pkg.package_id === t.package_id);
          return {
            ...t,
            package_title: p ? p.title : 'Paket Tidak Ditemukan'
          };
        });
      }

      case 'admin_create_token': {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let raw = 'TKA-';
        for (let i = 0; i < 6; i++) raw += chars.charAt(Math.floor(Math.random() * chars.length));

        const newToken = {
          token_id: 'TKN-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
          raw_token: raw,
          package_id: payload.package_id,
          attempt_limit: parseInt(payload.attempt_limit) || 1,
          attempt_count: 0,
          active: true,
          expires_at: payload.expires_at || '2030-12-31T23:59:59Z'
        };
        db.tokens.push(newToken);
        this.saveMockDb(db);
        return { token_id: newToken.token_id, raw_token: raw };
      }

      case 'admin_toggle_token': {
        const tok = db.tokens.find(t => t.token_id === payload.token_id);
        if (tok) {
          tok.active = payload.active;
          this.saveMockDb(db);
        }
        return { success: true };
      }

      // --- ADMIN ATTEMPTS ---
      case 'admin_get_attempts': {
        return db.attempts.filter(a => a.status === 'SUBMITTED').map(a => {
          const pkg = db.packages.find(p => p.package_id === a.package_id);
          return {
            attempt_id: a.attempt_id,
            token_id: a.token_id,
            student_name: a.student_name,
            class_name: a.class_name,
            package_title: pkg ? pkg.title : '-',
            category: pkg ? pkg.category : '-',
            score: a.score,
            correct_count: a.correct_count,
            incorrect_count: a.incorrect_count,
            unanswered_count: a.unanswered_count,
            submitted_at: a.submitted_at,
            status: a.status
          };
        });
      }

      default:
        throw new Error(`Aksi '${action}' tidak dikenali di demo mock backend.`);
    }
  },

  /**
   * Database Mock Awal
   */
  getMockDb() {
    const raw = localStorage.getItem(window.TKA_CONFIG.STORAGE_KEYS.LOCAL_DB);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }

    const initialDb = {
      questions: [
        {
          question_id: 'QST-001',
          question_code: 'LIT-SD-001',
          category: 'LITERASI',
          question_type: 'MULTIPLE_CHOICE',
          question_text: 'Budi selalu menyiram tanaman setiap pagi sebelum berangkat ke sekolah. Berkat ketekunannya, bunga mawar di pekarangan rumahnya tumbuh subur dan mekar dengan indah. Apa pesan moral yang dapat kita ambil dari perilaku Budi?',
          options: [
            { code: 'A', text: 'Malas merawat tanaman' },
            { code: 'B', text: 'Ketekunan dan kepedulian membawa hasil yang baik' },
            { code: 'C', text: 'Menyiram tanaman hanya jika ada waktu luang' },
            { code: 'D', text: 'Bunga mawar tidak perlu dirawat' }
          ],
          correct_answer: 'B',
          explanation: 'Ketekunan Budi merawat tanaman setiap hari menghasilkan bunga yang mekar dan subur.',
          difficulty: 'MUDAH',
          status: 'ACTIVE',
          image_refs: {}
        },
        {
          question_id: 'QST-002',
          question_code: 'LIT-SD-002',
          category: 'LITERASI',
          question_type: 'MULTI_SELECT',
          question_text: 'Perhatikan teks berikut: Hutan mangrove berfungsi sebagai penahan abrasi pantai oleh ombak laut. Selain itu, hutan mangrove juga menjadi tempat berkembang biak berbagai jenis kepiting, ikan kecil, dan burung rawa. Manakah manfaat hutan mangrove yang tepat berdasarkan teks? (Pilih semua yang benar)',
          options: [
            { code: 'A', text: 'Mencegah abrasi atau pengikisan pantai akibat ombak' },
            { code: 'B', text: 'Sebagai habitat dan tempat berkembang biak kepiting serta ikan' },
            { code: 'C', text: 'Menjadi tempat pembangunan pabrik industri besar' },
            { code: 'D', text: 'Sebagai tempat perlindungan burung rawa' }
          ],
          correct_answer: 'A,B,D',
          explanation: 'Teks menyebutkan secara eksplisit pencegah abrasi serta tempat berkembang biak satwa rawa.',
          difficulty: 'SEDANG',
          status: 'ACTIVE',
          image_refs: {}
        },
        {
          question_id: 'QST-003',
          question_code: 'NUM-SD-001',
          category: 'NUMERASI',
          question_type: 'MULTIPLE_CHOICE',
          question_text: 'Ibu membeli 3 kantong jeruk di pasar. Setiap kantong berisi 12 buah jeruk. Jeruk tersebut kemudian dibagikan secara merata kepada 4 orang anaknya. Berapa buah jeruk yang diterima oleh setiap anak?',
          options: [
            { code: 'A', text: '6 buah' },
            { code: 'B', text: '8 buah' },
            { code: 'C', text: '9 buah' },
            { code: 'D', text: '10 buah' }
          ],
          correct_answer: 'C',
          explanation: 'Total jeruk = 3 x 12 = 36. Setiap anak menerima = 36 / 4 = 9 buah.',
          difficulty: 'MUDAH',
          status: 'ACTIVE',
          image_refs: {}
        },
        {
          question_id: 'QST-004',
          question_code: 'NUM-SD-002',
          category: 'NUMERASI',
          question_type: 'MULTI_SELECT',
          question_text: 'Perhatikan data nilai ulangan matematika siswa kelas 5 SD: 70, 80, 85, 90, 80, 75, 80, 95, 85, 80. Manakah pernyataan berikut yang bernilai BENAR terkait data tersebut? (Pilih semua yang benar)',
          options: [
            { code: 'A', text: 'Nilai tertinggi adalah 95' },
            { code: 'B', text: 'Modus (nilai yang paling sering muncul) adalah 80' },
            { code: 'C', text: 'Nilai terendah adalah 75' },
            { code: 'D', text: 'Ada tepat 4 siswa yang memperoleh nilai 80' }
          ],
          correct_answer: 'A,B,D',
          explanation: 'Nilai tertinggi 95, angka 80 muncul 4 kali (modus), dan nilai terendah adalah 70.',
          difficulty: 'SEDANG',
          status: 'ACTIVE',
          image_refs: {}
        }
      ],
      packages: [
        {
          package_id: 'PKG-DEMO-001',
          title: 'Tryout Simulasi TKA SD 2026',
          description: 'Simulasi latihan resmi Tes Kemampuan Akademik jenjang SD materi Literasi dan Numerasi dasar.',
          category: 'LITERASI & NUMERASI',
          duration_minutes: 30,
          question_ids: ['QST-001', 'QST-002', 'QST-003', 'QST-004'],
          attempt_limit: 3,
          show_explanations: true,
          status: 'ACTIVE'
        }
      ],
      tokens: [
        {
          token_id: 'TKN-DEMO-001',
          raw_token: 'TKASD26',
          package_id: 'PKG-DEMO-001',
          attempt_limit: 3,
          attempt_count: 0,
          active: true,
          expires_at: '2030-12-31T23:59:59Z'
        }
      ],
      students: [
        { student_id: 'STU-001', student_name: 'Ahmad Faiz', class_name: '5A' },
        { student_id: 'STU-002', student_name: 'Siti Nurhaliza', class_name: '5B' }
      ],
      attempts: []
    };

    this.saveMockDb(initialDb);
    return initialDb;
  },

  saveMockDb(db) {
    localStorage.setItem(window.TKA_CONFIG.STORAGE_KEYS.LOCAL_DB, JSON.stringify(db));
  },

  /**
   * Helper Toast Notifikasi
   */
  toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `nexus-toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

window.TKA_API = API;
