/**
 * ==============================================================================
 * APLIKASI TRYOUT TKA SD (TES KEMAMPUAN AKADEMIK SEKOLAH DASAR)
 * Backend Google Apps Script Web App — Single File Architecture (Code.gs)
 * ==============================================================================
 * Petunjuk Instalasi:
 * 1. Buka Google Spreadsheet baru atau yang sudah ada.
 * 2. Masuk ke Extensions -> Apps Script.
 * 3. Hapus seluruh isi default lalu tempel seluruh isi file Code.gs ini.
 * 4. Jalankan fungsi `setupDatabase()` satu kali secara manual dari editor.
 * 5. Klik 'Deploy' -> 'New deployment' -> Pilih type 'Web app'.
 *    - Description: "Tryout TKA SD Production API"
 *    - Execute as: "Me" (email pengelola)
 *    - Who has access: "Anyone" (Siapa saja, termasuk anonim/siswa)
 * 6. Salin URL Web App yang dihasilkan ke konfigurasi frontend `js/config.js`.
 * ==============================================================================
 */

// Konfigurasi Nama-nama Sheet Database
const SHEETS = {
  USERS: 'USERS',
  STUDENTS: 'STUDENTS',
  QUESTIONS: 'QUESTIONS',
  PACKAGES: 'PACKAGES',
  TOKENS: 'TOKENS',
  ATTEMPTS: 'ATTEMPTS',
  SETTINGS: 'SETTINGS',
  AUDIT_LOG: 'AUDIT_LOG'
};

// Durasi Kedaluwarsa Sesi Admin (8 Jam dalam Milidetik)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Inisialisasi Database Google Sheets (Idempotent)
 * Dijalankan manual satu kali oleh pengembang.
 * Aman dijalankan berulang kali tanpa merusak atau menduplikasi data yang sudah ada.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const headersConfig = {
    [SHEETS.USERS]: [
      'user_id', 'username', 'password_hash', 'role', 'display_name', 'active', 'created_at', 'updated_at', 'last_login_at'
    ],
    [SHEETS.STUDENTS]: [
      'student_id', 'student_name', 'class_name', 'created_at', 'updated_at'
    ],
    [SHEETS.QUESTIONS]: [
      'question_id', 'question_code', 'category', 'question_type', 'question_text', 'options_json', 'correct_answer', 'explanation', 'image_refs_json', 'difficulty', 'status', 'created_at', 'updated_at'
    ],
    [SHEETS.PACKAGES]: [
      'package_id', 'title', 'description', 'category', 'duration_minutes', 'question_ids_json', 'start_at', 'end_at', 'attempt_limit', 'show_explanations', 'status', 'created_at', 'updated_at'
    ],
    [SHEETS.TOKENS]: [
      'token_id', 'token_hash', 'package_id', 'student_id', 'expires_at', 'attempt_limit', 'attempt_count', 'active', 'created_at', 'last_used_at'
    ],
    [SHEETS.ATTEMPTS]: [
      'attempt_id', 'token_id', 'student_id', 'package_id', 'started_at', 'deadline_at', 'submitted_at', 'status', 'answers_json', 'score', 'correct_count', 'incorrect_count', 'unanswered_count', 'result_json'
    ],
    [SHEETS.SETTINGS]: [
      'setting_key', 'setting_value', 'updated_at'
    ],
    [SHEETS.AUDIT_LOG]: [
      'log_id', 'actor_id', 'action', 'target_type', 'target_id', 'created_at'
    ]
  };

  const nowIso = new Date().toISOString();

  // 1. Buat atau lengkapi setiap sheet dan header
  for (const sheetName in headersConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    const requiredHeaders = headersConfig[sheetName];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(requiredHeaders);
      // Format baris header agar rapi
      const headerRange = sheet.getRange(1, 1, 1, requiredHeaders.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0d1b1a');
      headerRange.setFontColor('#00E599');
      sheet.setFrozenRows(1);
    }
  }

  // Hapus 'Sheet1' default jika kosong
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 2. Inisialisasi Akun Admin Default jika USERS masih kosong
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  const usersData = usersSheet.getDataRange().getValues();
  if (usersData.length <= 1) {
    // Password default: "AdminTKA2026!"
    const defaultPasswordHash = hashPassword('AdminTKA2026!');
    usersSheet.appendRow([
      'USR-' + Utilities.getUuid().substring(0, 8),
      'admin',
      defaultPasswordHash,
      'ADMIN',
      'Administrator Utama TKA',
      true,
      nowIso,
      nowIso,
      ''
    ]);
  }

  // 3. Inisialisasi Pengaturan Default jika SETTINGS masih kosong
  const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
  const settingsData = settingsSheet.getDataRange().getValues();
  if (settingsData.length <= 1) {
    const defaultSettings = [
      ['APP_TITLE', 'Tryout TKA SD — Portal Latihan Mandiri'],
      ['TIMEZONE', 'Asia/Jakarta'],
      ['PASSING_SCORE', '75'],
      ['DEFAULT_ATTEMPT_LIMIT', '1'],
      ['ALLOW_STUDENT_REVIEW', 'TRUE'],
      ['AUTOSAVE_INTERVAL_SEC', '30']
    ];
    for (const item of defaultSettings) {
      settingsSheet.appendRow([item[0], item[1], nowIso]);
    }
  }

  // 4. Inisialisasi Soal Contoh & Paket Demo jika QUESTIONS masih kosong
  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const qData = questionsSheet.getDataRange().getValues();
  if (qData.length <= 1) {
    const demoQuestions = [
      {
        id: 'QST-001',
        code: 'LIT-SD-001',
        cat: 'LITERASI',
        type: 'MULTIPLE_CHOICE',
        text: 'Budi selalu menyiram tanaman setiap pagi sebelum berangkat ke sekolah. Berkat ketekunannya, bunga mawar di pekarangan rumahnya tumbuh subur dan mekar dengan indah. Apa pesan moral yang dapat kita ambil dari perilaku Budi?',
        options: JSON.stringify([
          { code: 'A', text: 'Malas merawat tanaman' },
          { code: 'B', text: 'Ketekunan dan kepedulian membawa hasil yang baik' },
          { code: 'C', text: 'Menyiram tanaman hanya jika ada waktu luang' },
          { code: 'D', text: 'Bunga mawar tidak perlu dirawat' }
        ]),
        answer: 'B',
        exp: 'Ketekunan Budi merawat tanaman setiap hari menghasilkan bunga yang tumbuh subur dan indah.',
        diff: 'MUDAH'
      },
      {
        id: 'QST-002',
        code: 'LIT-SD-002',
        cat: 'LITERASI',
        type: 'MULTI_SELECT',
        text: 'Perhatikan teks berikut: Hutan mangrove berfungsi sebagai penahan abrasi pantai oleh ombak laut. Selain itu, hutan mangrove juga menjadi tempat berkembang biak berbagai jenis kepiting, ikan kecil, dan burung rawa. Manakah manfaat hutan mangrove yang tepat berdasarkan teks? (Pilih semua yang benar)',
        options: JSON.stringify([
          { code: 'A', text: 'Mencegah abrasi atau pengikisan pantai akibat ombak' },
          { code: 'B', text: 'Sebagai habitat dan tempat berkembang biak kepiting serta ikan' },
          { code: 'C', text: 'Menjadi tempat pembangunan pabrik industri besar' },
          { code: 'D', text: 'Sebagai tempat perlindungan burung rawa' }
        ]),
        answer: 'A,B,D',
        exp: 'Teks secara eksplisit menyebutkan manfaat penahan abrasi serta tempat berkembang biak kepiting, ikan kecil, dan burung rawa.',
        diff: 'SEDANG'
      },
      {
        id: 'QST-003',
        code: 'NUM-SD-001',
        cat: 'NUMERASI',
        type: 'MULTIPLE_CHOICE',
        text: 'Ibu membeli 3 kantong jeruk di pasar. Setiap kantong berisi 12 buah jeruk. Jeruk tersebut kemudian dibagikan secara merata kepada 4 orang anaknya. Berapa buah jeruk yang diterima oleh setiap anak?',
        options: JSON.stringify([
          { code: 'A', text: '6 buah' },
          { code: 'B', text: '8 buah' },
          { code: 'C', text: '9 buah' },
          { code: 'D', text: '10 buah' }
        ]),
        answer: 'C',
        exp: 'Total jeruk = 3 x 12 = 36 buah. Tiap anak menerima = 36 : 4 = 9 buah.',
        diff: 'MUDAH'
      },
      {
        id: 'QST-004',
        code: 'NUM-SD-002',
        cat: 'NUMERASI',
        type: 'MULTI_SELECT',
        text: 'Perhatikan data nilai ulangan matematika siswa kelas 5 SD: 70, 80, 85, 90, 80, 75, 80, 95, 85, 80. Manakah pernyataan berikut yang bernilai BENAR terkait data tersebut? (Pilih semua yang benar)',
        options: JSON.stringify([
          { code: 'A', text: 'Nilai tertinggi adalah 95' },
          { code: 'B', text: 'Modus (nilai yang paling sering muncul) adalah 80' },
          { code: 'C', text: 'Nilai terendah adalah 75' },
          { code: 'D', text: 'Ada tepat 4 siswa yang memperoleh nilai 80' }
        ]),
        answer: 'A,B,D',
        exp: 'Nilai tertinggi 95; angka 80 muncul sebanyak 4 kali sehingga modusnya 80; nilai terendah adalah 70 bukan 75.',
        diff: 'SEDANG'
      }
    ];

    for (const q of demoQuestions) {
      questionsSheet.appendRow([
        q.id,
        q.code,
        q.cat,
        q.type,
        q.text,
        q.options,
        q.answer,
        q.exp,
        '{}',
        q.diff,
        'ACTIVE',
        nowIso,
        nowIso
      ]);
    }

    // Inisialisasi Paket Demo Tryout
    const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);
    const demoPkgId = 'PKG-DEMO-001';
    packagesSheet.appendRow([
      demoPkgId,
      'Tryout Simulasi TKA SD 2026',
      'Paket simulasi komprehensif memuat soal Literasi Membaca dan Numerasi Matematika dasar tingkat Sekolah Dasar.',
      'LITERASI & NUMERASI',
      30,
      JSON.stringify(['QST-001', 'QST-002', 'QST-003', 'QST-004']),
      '2026-01-01T00:00:00Z',
      '2026-12-31T23:59:59Z',
      3,
      true,
      'ACTIVE',
      nowIso,
      nowIso
    ]);

    // Inisialisasi Token Demo Siswa
    const tokensSheet = ss.getSheetByName(SHEETS.TOKENS);
    const rawDemoToken = 'TKASD26';
    tokensSheet.appendRow([
      'TKN-' + Utilities.getUuid().substring(0, 8),
      hashPassword(rawDemoToken),
      demoPkgId,
      '',
      '2026-12-31T23:59:59Z',
      3,
      0,
      true,
      nowIso,
      ''
    ]);
  }

  recordAuditLog('SYSTEM', 'SETUP_DATABASE', 'SYSTEM', 'DATABASE');
  Logger.log('Setup Database Tryout TKA SD Berhasil Selesai!');
  return { success: true, message: 'Database dan konfigurasi awal berhasil dibuat!' };
}

/**
 * Endpoint Utama GET (Mendukung pemanggilan data publik dan uji kesehatan backend)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'ping';

    let result;
    switch (action) {
      case 'ping':
        result = {
          status: 'online',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          app: 'Tryout TKA SD API'
        };
        break;

      case 'get_public_config':
        result = getPublicSettings();
        break;

      case 'student_verify_token':
        result = studentVerifyToken(params.token);
        break;

      default:
        return buildErrorResponse('ACTION_NOT_FOUND', 'Action GET tidak dikenali.');
    }

    return buildSuccessResponse(result, params.callback);
  } catch (err) {
    return buildErrorResponse('INTERNAL_ERROR', err.toString());
  }
}

/**
 * Endpoint Utama POST (Semua mutasi data, login, pengerjaan, dan admin CRUD)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Kunci untuk menghindari race condition (tulis bersamaan)
    lock.waitLock(15000);

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = (e && e.parameter) ? e.parameter : {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    if (!action) {
      return buildErrorResponse('MISSING_ACTION', 'Parameter action diperlukan.');
    }

    let result;

    // --- ALUR SISWA (PUBLIC TOKEN AUTH) ---
    if (action === 'student_verify_token') {
      result = studentVerifyToken(payload.token);
    } else if (action === 'student_start_attempt') {
      result = studentStartAttempt(payload);
    } else if (action === 'student_save_progress') {
      result = studentSaveProgress(payload);
    } else if (action === 'student_submit_attempt') {
      result = studentSubmitAttempt(payload);
    } else if (action === 'student_get_result') {
      result = studentGetResult(payload);
    }

    // --- ALUR AUTENTIKASI ADMIN ---
    else if (action === 'admin_login') {
      result = adminLogin(payload.username, payload.password);
    }

    // --- ALUR ADMIN TEROTORISASI (WAJIB SESI TOKEN SAH) ---
    else {
      const auth = verifyAdminSession(payload.session_token);
      if (!auth.valid) {
        return buildErrorResponse('UNAUTHORIZED', 'Sesi admin tidak sah atau telah kedaluwarsa. Silakan login kembali.');
      }
      const adminUser = auth.user;

      switch (action) {
        case 'admin_verify_session':
          result = { user: adminUser };
          break;

        case 'admin_get_dashboard_stats':
          result = adminGetDashboardStats();
          break;

        case 'admin_get_questions':
          result = adminGetQuestions(payload.filters || {});
          break;

        case 'admin_save_question':
          result = adminSaveQuestion(payload.question, adminUser);
          break;

        case 'admin_delete_question':
          result = adminDeleteQuestion(payload.question_id, adminUser);
          break;

        case 'admin_batch_import_questions':
          result = adminBatchImportQuestions(payload.questions, adminUser);
          break;

        case 'admin_upload_image':
          result = adminUploadImage(payload, adminUser);
          break;

        case 'admin_get_packages':
          result = adminGetPackages();
          break;

        case 'admin_save_package':
          result = adminSavePackage(payload.package, adminUser);
          break;

        case 'admin_delete_package':
          result = adminDeletePackage(payload.package_id, adminUser);
          break;

        case 'admin_get_tokens':
          result = adminGetTokens();
          break;

        case 'admin_create_token':
          result = adminCreateToken(payload, adminUser);
          break;

        case 'admin_toggle_token':
          result = adminToggleToken(payload.token_id, payload.active, adminUser);
          break;

        case 'admin_get_students':
          result = adminGetStudents();
          break;

        case 'admin_save_student':
          result = adminSaveStudent(payload.student, adminUser);
          break;

        case 'admin_delete_student':
          result = adminDeleteStudent(payload.student_id, adminUser);
          break;

        case 'admin_get_attempts':
          result = adminGetAttempts(payload.filters || {});
          break;

        case 'admin_get_settings':
          result = adminGetSettings();
          break;

        case 'admin_save_settings':
          result = adminSaveSettings(payload.settings, adminUser);
          break;

        case 'admin_get_audit_log':
          result = adminGetAuditLog(payload.limit || 100);
          break;

        default:
          return buildErrorResponse('ACTION_NOT_FOUND', 'Aksi ' + action + ' tidak ditemukan.');
      }
    }

    return buildSuccessResponse(result);
  } catch (err) {
    return buildErrorResponse('INTERNAL_ERROR', err.toString());
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ==============================================================================
// MODUL LOGIKA SISWA & UJIAN
// ==============================================================================

/**
 * Validasi Token Siswa
 */
function studentVerifyToken(rawToken) {
  if (!rawToken || !rawToken.trim()) {
    throw new Error('Silakan masukkan token ujian.');
  }

  const cleanToken = rawToken.trim().toUpperCase();
  const tokenHash = hashPassword(cleanToken);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tokensSheet = ss.getSheetByName(SHEETS.TOKENS);
  const tokens = sheetToObjects(tokensSheet);

  const matched = tokens.find(t => t.token_hash === tokenHash || t.token_id === cleanToken);
  if (!matched) {
    throw new Error('Token tidak valid atau tidak ditemukan.');
  }

  if (matched.active !== true && matched.active !== 'TRUE') {
    throw new Error('Token ini telah dinonaktifkan oleh Administrator.');
  }

  const now = new Date();
  if (matched.expires_at) {
    const expDate = new Date(matched.expires_at);
    if (now > expDate) {
      throw new Error('Masa berlaku token telah kedaluwarsa.');
    }
  }

  const attemptLimit = parseInt(matched.attempt_limit, 10) || 1;
  const attemptCount = parseInt(matched.attempt_count, 10) || 0;
  if (attemptCount >= attemptLimit) {
    throw new Error('Batas maksimal percobaan pengerjaan untuk token ini telah tercapai (' + attemptCount + '/' + attemptLimit + ').');
  }

  // Ambil rincian paket
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);
  const packages = sheetToObjects(packagesSheet);
  const pkg = packages.find(p => p.package_id === matched.package_id);

  if (!pkg) {
    throw new Error('Paket tryout yang dikaitkan dengan token ini tidak ditemukan.');
  }

  if (pkg.status !== 'ACTIVE') {
    throw new Error('Paket tryout saat ini sedang tidak aktif.');
  }

  // Hitung jumlah soal
  let questionIds = [];
  try {
    questionIds = JSON.parse(pkg.question_ids_json || '[]');
  } catch (e) {
    questionIds = [];
  }

  return {
    valid: true,
    token_id: matched.token_id,
    package: {
      package_id: pkg.package_id,
      title: pkg.title,
      description: pkg.description,
      category: pkg.category,
      duration_minutes: parseInt(pkg.duration_minutes, 10) || 30,
      question_count: questionIds.length,
      attempt_limit: attemptLimit,
      attempt_count: attemptCount
    }
  };
}

/**
 * Siswa Memulai Pengerjaan Tryout
 */
function studentStartAttempt(payload) {
  const tokenVerification = studentVerifyToken(payload.token);
  const pkgInfo = tokenVerification.package;
  const tokenId = tokenVerification.token_id;
  const studentName = (payload.student_name || 'Peserta Siswa').trim();
  const className = (payload.class_name || '-').trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Simpan / identifikasi siswa
  let studentId = 'STU-' + Utilities.getUuid().substring(0, 8);
  const studentsSheet = ss.getSheetByName(SHEETS.STUDENTS);
  studentsSheet.appendRow([
    studentId,
    studentName,
    className,
    new Date().toISOString(),
    new Date().toISOString()
  ]);

  // Ambil soal yang dipilih paket
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);
  const packages = sheetToObjects(packagesSheet);
  const pkg = packages.find(p => p.package_id === pkgInfo.package_id);
  const questionIds = JSON.parse(pkg.question_ids_json || '[]');

  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const allQuestions = sheetToObjects(questionsSheet);
  
  // Saring soal sesuai id & sembunyikan kunci jawaban/pembahasan
  const studentQuestions = [];
  for (const qId of questionIds) {
    const q = allQuestions.find(item => item.question_id === qId);
    if (q && q.status === 'ACTIVE') {
      let options = [];
      try {
        options = JSON.parse(q.options_json || '[]');
      } catch (e) {
        options = [];
      }
      let imageRefs = {};
      try {
        imageRefs = JSON.parse(q.image_refs_json || '{}');
      } catch (e) {
        imageRefs = {};
      }

      studentQuestions.push({
        question_id: q.question_id,
        category: q.category,
        question_type: q.question_type,
        question_text: q.question_text,
        options: options,
        image_refs: imageRefs,
        difficulty: q.difficulty
      });
    }
  }

  if (studentQuestions.length === 0) {
    throw new Error('Tidak ada soal aktif yang tersedia dalam paket ini.');
  }

  // Hitung waktu deadline di backend
  const now = new Date();
  const durationMs = (parseInt(pkg.duration_minutes, 10) || 30) * 60 * 1000;
  const deadlineDate = new Date(now.getTime() + durationMs);

  const attemptId = 'ATT-' + Utilities.getUuid().substring(0, 10);
  const attemptsSheet = ss.getSheetByName(SHEETS.ATTEMPTS);

  attemptsSheet.appendRow([
    attemptId,
    tokenId,
    studentId,
    pkg.package_id,
    now.toISOString(),
    deadlineDate.toISOString(),
    '',
    'IN_PROGRESS',
    '{}',
    0,
    0,
    0,
    studentQuestions.length,
    '{}'
  ]);

  // Perbarui last_used_at pada token
  updateSheetRow(ss.getSheetByName(SHEETS.TOKENS), 'token_id', tokenId, {
    last_used_at: now.toISOString()
  });

  return {
    attempt_id: attemptId,
    student_id: studentId,
    package_title: pkg.title,
    category: pkg.category,
    started_at: now.toISOString(),
    deadline_at: deadlineDate.toISOString(),
    duration_seconds: Math.floor(durationMs / 1000),
    questions: studentQuestions
  };
}

/**
 * Simpan Progres Jawaban Berkala (Autosave)
 */
function studentSaveProgress(payload) {
  const attemptId = payload.attempt_id;
  const answers = payload.answers || {};

  if (!attemptId) {
    throw new Error('ID Percobaan (attempt_id) tidak disertakan.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName(SHEETS.ATTEMPTS);
  const attempts = sheetToObjects(attemptsSheet);
  const attempt = attempts.find(a => a.attempt_id === attemptId);

  if (!attempt) {
    throw new Error('Sesi ujian tidak ditemukan.');
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return { saved: false, message: 'Ujian telah diselesaikan atau berstatus ' + attempt.status };
  }

  // Periksa batas waktu backend (toleransi 120 detik untuk latensi jaringan)
  const now = new Date();
  const deadline = new Date(attempt.deadline_at);
  if (now.getTime() > (deadline.getTime() + 120000)) {
    return { saved: false, timeout: true, message: 'Waktu ujian telah berakhir.' };
  }

  updateSheetRow(attemptsSheet, 'attempt_id', attemptId, {
    answers_json: JSON.stringify(answers)
  });

  return { saved: true, timestamp: now.toISOString() };
}

/**
 * Siswa Mengumpulkan Jawaban (Submit Attempt) & Penilaian Otomatis
 */
function studentSubmitAttempt(payload) {
  const attemptId = payload.attempt_id;
  const submittedAnswers = payload.answers || {};

  if (!attemptId) {
    throw new Error('attempt_id wajib disertakan.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName(SHEETS.ATTEMPTS);
  const attempts = sheetToObjects(attemptsSheet);
  const attempt = attempts.find(a => a.attempt_id === attemptId);

  if (!attempt) {
    throw new Error('Data percobaan ujian tidak ditemukan.');
  }

  // Cegah double submission
  if (attempt.status === 'SUBMITTED' || attempt.status === 'COMPLETED') {
    return {
      already_submitted: true,
      result: JSON.parse(attempt.result_json || '{}')
    };
  }

  // Ambil paket dan soal-soal untuk penilaian
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);
  const packages = sheetToObjects(packagesSheet);
  const pkg = packages.find(p => p.package_id === attempt.package_id);

  const questionIds = JSON.parse(pkg.question_ids_json || '[]');
  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const allQuestions = sheetToObjects(questionsSheet);

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const itemEvaluations = [];

  for (const qId of questionIds) {
    const q = allQuestions.find(item => item.question_id === qId);
    if (!q) continue;

    const studentAnswer = submittedAnswers[qId];
    const correctAnswer = (q.correct_answer || '').trim();
    let isCorrect = false;

    if (!studentAnswer || (Array.isArray(studentAnswer) && studentAnswer.length === 0)) {
      unansweredCount++;
    } else {
      if (q.question_type === 'MULTI_SELECT') {
        // Pilihan ganda kompleks: bandingkan daftar opsi yang diurutkan
        const correctSet = correctAnswer.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).sort().join(',');
        let studentSet = '';
        if (Array.isArray(studentAnswer)) {
          studentSet = studentAnswer.map(s => s.toString().trim().toUpperCase()).filter(Boolean).sort().join(',');
        } else {
          studentSet = studentAnswer.toString().trim().toUpperCase();
        }

        if (correctSet === studentSet) {
          isCorrect = true;
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else {
        // Pilihan ganda reguler: single choice
        const cleanStudentAns = studentAnswer.toString().trim().toUpperCase();
        const cleanCorrectAns = correctAnswer.toUpperCase();

        if (cleanStudentAns === cleanCorrectAns) {
          isCorrect = true;
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }

    itemEvaluations.push({
      question_id: q.question_id,
      category: q.category,
      question_type: q.question_type,
      question_text: q.question_text,
      student_answer: studentAnswer || null,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      explanation: q.explanation || ''
    });
  }

  const totalQuestions = questionIds.length;
  const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const finalScore = Math.round(rawScore * 10) / 10;

  const nowIso = new Date().toISOString();
  const resultData = {
    score: finalScore,
    total_questions: totalQuestions,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    submitted_at: nowIso,
    show_explanations: (pkg.show_explanations === true || pkg.show_explanations === 'TRUE'),
    items: itemEvaluations
  };

  // Simpan hasil ke sheet ATTEMPTS
  updateSheetRow(attemptsSheet, 'attempt_id', attemptId, {
    submitted_at: nowIso,
    status: 'SUBMITTED',
    answers_json: JSON.stringify(submittedAnswers),
    score: finalScore,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    result_json: JSON.stringify(resultData)
  });

  // Tambahkan hitungan percobaan pada token
  const tokensSheet = ss.getSheetByName(SHEETS.TOKENS);
  const tokens = sheetToObjects(tokensSheet);
  const tokenRecord = tokens.find(t => t.token_id === attempt.token_id);
  if (tokenRecord) {
    const currentCount = parseInt(tokenRecord.attempt_count, 10) || 0;
    updateSheetRow(tokensSheet, 'token_id', attempt.token_id, {
      attempt_count: currentCount + 1
    });
  }

  // Bersihkan data penjelasan jika paket belum mengizinkan pembahasan
  const publicResult = {
    score: finalScore,
    total_questions: totalQuestions,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    submitted_at: nowIso,
    show_explanations: resultData.show_explanations,
    // Jika diizinkan, sertakan item evaluasi; jika tidak, sembunyikan kunci jawaban
    items: resultData.show_explanations ? itemEvaluations : []
  };

  return publicResult;
}

/**
 * Siswa Melihat Kembali Hasil & Pembahasan
 */
function studentGetResult(payload) {
  const attemptId = payload.attempt_id;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName(SHEETS.ATTEMPTS);
  const attempts = sheetToObjects(attemptsSheet);
  const attempt = attempts.find(a => a.attempt_id === attemptId);

  if (!attempt || attempt.status !== 'SUBMITTED') {
    throw new Error('Hasil tryout tidak ditemukan atau belum diselesaikan.');
  }

  const rawResult = JSON.parse(attempt.result_json || '{}');
  if (!rawResult.show_explanations) {
    // Hilangkan kunci & pembahasan
    delete rawResult.items;
  }

  return rawResult;
}

// ==============================================================================
// MODUL AUTENTIKASI & KELOLA ADMIN
// ==============================================================================

/**
 * Login Administrator
 */
function adminLogin(username, password) {
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  const users = sheetToObjects(usersSheet);

  const cleanUser = username.trim();
  const user = users.find(u => u.username === cleanUser);

  if (!user) {
    throw new Error('Username atau password salah.');
  }

  if (user.active !== true && user.active !== 'TRUE') {
    throw new Error('Akun Anda dinonaktifkan.');
  }

  const inputHash = hashPassword(password);
  if (inputHash !== user.password_hash) {
    throw new Error('Username atau password salah.');
  }

  // Buat Sesi Token Admin
  const sessionToken = 'SES-' + Utilities.getUuid() + '-' + Date.now();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const cache = CacheService.getScriptCache();
  const sessionData = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    expires_at: expiresAt
  };

  cache.put('ADMIN_SESSION_' + sessionToken, JSON.stringify(sessionData), Math.floor(SESSION_TTL_MS / 1000));

  // Catat login terakhir
  updateSheetRow(usersSheet, 'user_id', user.user_id, {
    last_login_at: new Date().toISOString()
  });

  recordAuditLog(user.user_id, 'LOGIN', 'USER', user.user_id);

  return {
    success: true,
    session_token: sessionToken,
    user: {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
      role: user.role
    }
  };
}

/**
 * Verifikasi Validitas Sesi Admin
 */
function verifyAdminSession(sessionToken) {
  if (!sessionToken) return { valid: false };

  const cache = CacheService.getScriptCache();
  const cached = cache.get('ADMIN_SESSION_' + sessionToken);

  if (!cached) return { valid: false };

  try {
    const data = JSON.parse(cached);
    if (Date.now() > data.expires_at) {
      cache.remove('ADMIN_SESSION_' + sessionToken);
      return { valid: false };
    }
    return { valid: true, user: data };
  } catch (e) {
    return { valid: false };
  }
}

/**
 * Statistik Dashboard Admin (Gaya NexusBank)
 */
function adminGetDashboardStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const packages = sheetToObjects(ss.getSheetByName(SHEETS.PACKAGES));
  const questions = sheetToObjects(ss.getSheetByName(SHEETS.QUESTIONS));
  const tokens = sheetToObjects(ss.getSheetByName(SHEETS.TOKENS));
  const students = sheetToObjects(ss.getSheetByName(SHEETS.STUDENTS));
  const attempts = sheetToObjects(ss.getSheetByName(SHEETS.ATTEMPTS));

  const submittedAttempts = attempts.filter(a => a.status === 'SUBMITTED');
  const scores = submittedAttempts.map(a => parseFloat(a.score) || 0);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

  // Analisis Literasi vs Numerasi
  let literasiScores = [];
  let numerasiScores = [];

  for (const a of submittedAttempts) {
    const pkg = packages.find(p => p.package_id === a.package_id);
    const scoreVal = parseFloat(a.score) || 0;
    if (pkg) {
      if (pkg.category.indexOf('LITERASI') !== -1) literasiScores.push(scoreVal);
      if (pkg.category.indexOf('NUMERASI') !== -1) numerasiScores.push(scoreVal);
    }
  }

  const avgLiterasi = literasiScores.length > 0 ? Math.round((literasiScores.reduce((a, b) => a + b, 0) / literasiScores.length) * 10) / 10 : 0;
  const avgNumerasi = numerasiScores.length > 0 ? Math.round((numerasiScores.reduce((a, b) => a + b, 0) / numerasiScores.length) * 10) / 10 : 0;

  // Distribusi Nilai (Tuntas >= 75 vs Perlu Bimbingan < 75)
  const passedCount = scores.filter(s => s >= 75).length;
  const remedialCount = scores.filter(s => s < 75).length;

  // Percobaan terbaru
  const recentAttempts = submittedAttempts
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 7)
    .map(a => {
      const stu = students.find(s => s.student_id === a.student_id);
      const pkg = packages.find(p => p.package_id === a.package_id);
      return {
        attempt_id: a.attempt_id,
        student_name: stu ? stu.student_name : 'Siswa',
        class_name: stu ? stu.class_name : '-',
        package_title: pkg ? pkg.title : 'Paket TKA',
        score: a.score,
        correct_count: a.correct_count,
        submitted_at: a.submitted_at
      };
    });

  return {
    counts: {
      total_packages: packages.length,
      total_questions: questions.length,
      total_tokens: tokens.length,
      total_students: students.length,
      total_attempts: submittedAttempts.length,
      avg_score: avgScore,
      avg_literasi: avgLiterasi,
      avg_numerasi: avgNumerasi,
      passed_count: passedCount,
      remedial_count: remedialCount
    },
    recent_attempts: recentAttempts
  };
}

/**
 * Ambil Daftar Soal dengan Filter
 */
function adminGetQuestions(filters) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  let questions = sheetToObjects(questionsSheet);

  if (filters.category && filters.category !== 'ALL') {
    questions = questions.filter(q => q.category === filters.category);
  }
  if (filters.question_type && filters.question_type !== 'ALL') {
    questions = questions.filter(q => q.question_type === filters.question_type);
  }
  if (filters.status && filters.status !== 'ALL') {
    questions = questions.filter(q => q.status === filters.status);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    questions = questions.filter(item =>
      (item.question_text && item.question_text.toLowerCase().indexOf(q) !== -1) ||
      (item.question_code && item.question_code.toLowerCase().indexOf(q) !== -1)
    );
  }

  // Parse JSON kolom untuk kemudahan frontend
  return questions.map(item => {
    let options = [];
    let imageRefs = {};
    try { options = JSON.parse(item.options_json || '[]'); } catch (e) {}
    try { imageRefs = JSON.parse(item.image_refs_json || '{}'); } catch (e) {}
    return {
      ...item,
      options: options,
      image_refs: imageRefs
    };
  });
}

/**
 * Tambah / Perbarui Soal
 */
function adminSaveQuestion(qData, adminUser) {
  if (!qData.question_text || !qData.category || !qData.correct_answer) {
    throw new Error('Batang soal, kategori, dan kunci jawaban wajib diisi.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const nowIso = new Date().toISOString();

  const isNew = !qData.question_id;
  const questionId = qData.question_id || ('QST-' + Utilities.getUuid().substring(0, 8));

  const optionsJson = typeof qData.options === 'string' ? qData.options : JSON.stringify(qData.options || []);
  const imageRefsJson = typeof qData.image_refs === 'string' ? qData.image_refs : JSON.stringify(qData.image_refs || {});

  const rowObject = {
    question_id: questionId,
    question_code: qData.question_code || (qData.category.substring(0, 3) + '-' + questionId.substring(4)),
    category: qData.category,
    question_type: qData.question_type || 'MULTIPLE_CHOICE',
    question_text: qData.question_text,
    options_json: optionsJson,
    correct_answer: qData.correct_answer,
    explanation: qData.explanation || '',
    image_refs_json: imageRefsJson,
    difficulty: qData.difficulty || 'SEDANG',
    status: qData.status || 'ACTIVE',
    updated_at: nowIso
  };

  if (isNew) {
    rowObject.created_at = nowIso;
    sheet.appendRow([
      rowObject.question_id,
      rowObject.question_code,
      rowObject.category,
      rowObject.question_type,
      rowObject.question_text,
      rowObject.options_json,
      rowObject.correct_answer,
      rowObject.explanation,
      rowObject.image_refs_json,
      rowObject.difficulty,
      rowObject.status,
      rowObject.created_at,
      rowObject.updated_at
    ]);
    recordAuditLog(adminUser.user_id, 'CREATE_QUESTION', 'QUESTION', questionId);
  } else {
    updateSheetRow(sheet, 'question_id', questionId, rowObject);
    recordAuditLog(adminUser.user_id, 'UPDATE_QUESTION', 'QUESTION', questionId);
  }

  return { question_id: questionId };
}

/**
 * Hapus Soal
 */
function adminDeleteQuestion(questionId, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  deleteSheetRow(sheet, 'question_id', questionId);
  recordAuditLog(adminUser.user_id, 'DELETE_QUESTION', 'QUESTION', questionId);
  return { deleted: true };
}

/**
 * Impor Massal Soal dari Hasil Parsing CSV/Excel Frontend
 */
function adminBatchImportQuestions(questionsList, adminUser) {
  if (!Array.isArray(questionsList) || questionsList.length === 0) {
    throw new Error('Daftar soal impor kosong.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const nowIso = new Date().toISOString();

  let importedCount = 0;
  for (const q of questionsList) {
    const questionId = 'QST-' + Utilities.getUuid().substring(0, 8);
    const optionsJson = JSON.stringify(q.options || []);
    const imageRefsJson = JSON.stringify(q.image_refs || {});

    sheet.appendRow([
      questionId,
      q.question_code || (q.category.substring(0, 3) + '-' + questionId.substring(4)),
      q.category || 'LITERASI',
      q.question_type || 'MULTIPLE_CHOICE',
      q.question_text,
      optionsJson,
      q.correct_answer,
      q.explanation || '',
      imageRefsJson,
      q.difficulty || 'SEDANG',
      q.status || 'ACTIVE',
      nowIso,
      nowIso
    ]);
    importedCount++;
  }

  recordAuditLog(adminUser.user_id, 'BATCH_IMPORT_QUESTIONS', 'QUESTIONS', 'COUNT_' + importedCount);
  return { imported_count: importedCount };
}

/**
 * Upload Gambar Soal/Opsi ke Google Drive (Menghasilkan Direct Link Tanpa Mengotori Sel Spreadsheet)
 */
function adminUploadImage(payload, adminUser) {
  const base64Data = payload.image_base64;
  const fileName = payload.filename || ('tka_media_' + Date.now() + '.png');
  const mimeType = payload.mime_type || 'image/png';

  if (!base64Data) {
    throw new Error('Data gambar base64 diperlukan.');
  }

  // Buat atau cari folder "TKA_SD_Media" di Google Drive
  let folder;
  const folderName = 'TKA_SD_Media';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  // Bersihkan header data URI jika ada (misal data:image/png;base64,...)
  let cleanBase64 = base64Data;
  if (base64Data.indexOf(',') !== -1) {
    cleanBase64 = base64Data.split(',')[1];
  }

  const decoded = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const file = folder.createFile(blob);

  // Jadikan file dapat dilihat publik agar gambar dapat di-load oleh browser siswa
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  // URL pratinjau langsung Google Drive yang kompatibel dengan tag <img>
  const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

  recordAuditLog(adminUser.user_id, 'UPLOAD_IMAGE', 'DRIVE_FILE', fileId);

  return {
    file_id: fileId,
    url: directUrl
  };
}

/**
 * Kelola Paket Ujian
 */
function adminGetPackages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);
  const packages = sheetToObjects(packagesSheet);

  return packages.map(pkg => {
    let questionIds = [];
    try { questionIds = JSON.parse(pkg.question_ids_json || '[]'); } catch (e) {}
    return {
      ...pkg,
      question_ids: questionIds,
      question_count: questionIds.length
    };
  });
}

function adminSavePackage(pkgData, adminUser) {
  if (!pkgData.title || !pkgData.category) {
    throw new Error('Judul dan kategori paket tryout wajib diisi.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PACKAGES);
  const nowIso = new Date().toISOString();

  const isNew = !pkgData.package_id;
  const packageId = pkgData.package_id || ('PKG-' + Utilities.getUuid().substring(0, 8));
  const questionIdsJson = typeof pkgData.question_ids === 'string' ? pkgData.question_ids : JSON.stringify(pkgData.question_ids || []);

  const rowObject = {
    package_id: packageId,
    title: pkgData.title,
    description: pkgData.description || '',
    category: pkgData.category,
    duration_minutes: parseInt(pkgData.duration_minutes, 10) || 30,
    question_ids_json: questionIdsJson,
    start_at: pkgData.start_at || nowIso,
    end_at: pkgData.end_at || '2030-12-31T23:59:59Z',
    attempt_limit: parseInt(pkgData.attempt_limit, 10) || 1,
    show_explanations: (pkgData.show_explanations === true || pkgData.show_explanations === 'TRUE'),
    status: pkgData.status || 'ACTIVE',
    updated_at: nowIso
  };

  if (isNew) {
    rowObject.created_at = nowIso;
    sheet.appendRow([
      rowObject.package_id,
      rowObject.title,
      rowObject.description,
      rowObject.category,
      rowObject.duration_minutes,
      rowObject.question_ids_json,
      rowObject.start_at,
      rowObject.end_at,
      rowObject.attempt_limit,
      rowObject.show_explanations,
      rowObject.status,
      rowObject.created_at,
      rowObject.updated_at
    ]);
    recordAuditLog(adminUser.user_id, 'CREATE_PACKAGE', 'PACKAGE', packageId);
  } else {
    updateSheetRow(sheet, 'package_id', packageId, rowObject);
    recordAuditLog(adminUser.user_id, 'UPDATE_PACKAGE', 'PACKAGE', packageId);
  }

  return { package_id: packageId };
}

function adminDeletePackage(packageId, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PACKAGES);
  deleteSheetRow(sheet, 'package_id', packageId);
  recordAuditLog(adminUser.user_id, 'DELETE_PACKAGE', 'PACKAGE', packageId);
  return { deleted: true };
}

/**
 * Kelola Token Siswa
 */
function adminGetTokens() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tokensSheet = ss.getSheetByName(SHEETS.TOKENS);
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);

  const tokens = sheetToObjects(tokensSheet);
  const packages = sheetToObjects(packagesSheet);

  return tokens.map(t => {
    const pkg = packages.find(p => p.package_id === t.package_id);
    return {
      ...t,
      package_title: pkg ? pkg.title : 'Paket Tidak Ditemukan'
    };
  });
}

function adminCreateToken(payload, adminUser) {
  const packageId = payload.package_id;
  if (!packageId) {
    throw new Error('Pilih paket tryout yang akan dikaitkan dengan token.');
  }

  // Buat token acak yang sulit ditebak (misal TKA-8K9P2X)
  const rawToken = payload.custom_token ? payload.custom_token.trim().toUpperCase() : generateSecureToken();
  const tokenHash = hashPassword(rawToken);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.TOKENS);
  const nowIso = new Date().toISOString();
  const tokenId = 'TKN-' + Utilities.getUuid().substring(0, 8);

  sheet.appendRow([
    tokenId,
    tokenHash,
    packageId,
    payload.student_id || '',
    payload.expires_at || '2030-12-31T23:59:59Z',
    parseInt(payload.attempt_limit, 10) || 1,
    0,
    true,
    nowIso,
    ''
  ]);

  recordAuditLog(adminUser.user_id, 'CREATE_TOKEN', 'TOKEN', tokenId);

  return {
    token_id: tokenId,
    raw_token: rawToken, // Hanya ditampilkan sekali saat pembuatan
    package_id: packageId
  };
}

function adminToggleToken(tokenId, activeStatus, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.TOKENS);
  updateSheetRow(sheet, 'token_id', tokenId, {
    active: activeStatus
  });
  recordAuditLog(adminUser.user_id, 'TOGGLE_TOKEN', 'TOKEN', tokenId);
  return { success: true };
}

/**
 * Kelola Data Siswa
 */
function adminGetStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  return sheetToObjects(sheet);
}

function adminSaveStudent(studentData, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const nowIso = new Date().toISOString();

  const isNew = !studentData.student_id;
  const studentId = studentData.student_id || ('STU-' + Utilities.getUuid().substring(0, 8));

  if (isNew) {
    sheet.appendRow([
      studentId,
      studentData.student_name,
      studentData.class_name || '-',
      nowIso,
      nowIso
    ]);
    recordAuditLog(adminUser.user_id, 'CREATE_STUDENT', 'STUDENT', studentId);
  } else {
    updateSheetRow(sheet, 'student_id', studentId, {
      student_name: studentData.student_name,
      class_name: studentData.class_name || '-',
      updated_at: nowIso
    });
    recordAuditLog(adminUser.user_id, 'UPDATE_STUDENT', 'STUDENT', studentId);
  }

  return { student_id: studentId };
}

function adminDeleteStudent(studentId, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  deleteSheetRow(sheet, 'student_id', studentId);
  recordAuditLog(adminUser.user_id, 'DELETE_STUDENT', 'STUDENT', studentId);
  return { deleted: true };
}

/**
 * Daftar Hasil Ujian & Rekapitulasi Lengkap
 */
function adminGetAttempts(filters) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName(SHEETS.ATTEMPTS);
  const studentsSheet = ss.getSheetByName(SHEETS.STUDENTS);
  const packagesSheet = ss.getSheetByName(SHEETS.PACKAGES);

  const attempts = sheetToObjects(attemptsSheet);
  const students = sheetToObjects(studentsSheet);
  const packages = sheetToObjects(packagesSheet);

  let results = attempts.filter(a => a.status === 'SUBMITTED');

  if (filters.package_id && filters.package_id !== 'ALL') {
    results = results.filter(a => a.package_id === filters.package_id);
  }

  return results.map(a => {
    const stu = students.find(s => s.student_id === a.student_id);
    const pkg = packages.find(p => p.package_id === a.package_id);
    return {
      attempt_id: a.attempt_id,
      token_id: a.token_id,
      student_id: a.student_id,
      student_name: stu ? stu.student_name : 'Siswa',
      class_name: stu ? stu.class_name : '-',
      package_id: a.package_id,
      package_title: pkg ? pkg.title : '-',
      category: pkg ? pkg.category : '-',
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      score: a.score,
      correct_count: a.correct_count,
      incorrect_count: a.incorrect_count,
      unanswered_count: a.unanswered_count,
      status: a.status
    };
  });
}

/**
 * Pengaturan & Audit Log
 */
function adminGetSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  return sheetToObjects(sheet);
}

function adminSaveSettings(settingsMap, adminUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  const nowIso = new Date().toISOString();

  for (const key in settingsMap) {
    updateSheetRow(sheet, 'setting_key', key, {
      setting_value: settingsMap[key].toString(),
      updated_at: nowIso
    });
  }

  recordAuditLog(adminUser.user_id, 'UPDATE_SETTINGS', 'SYSTEM', 'SETTINGS');
  return { success: true };
}

function adminGetAuditLog(limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
  const logs = sheetToObjects(sheet);
  return logs.reverse().slice(0, limit || 100);
}

function getPublicSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  const rows = sheetToObjects(sheet);
  const config = {};
  for (const r of rows) {
    config[r.setting_key] = r.setting_value;
  }
  return config;
}

// ==============================================================================
// FUNGSI UTILITAS DATA & KEAMANAN
// ==============================================================================

/**
 * Hash Password & Token menggunakan SHA-256
 */
function hashPassword(plainText) {
  if (!plainText) return '';
  const salt = 'TKA_SD_SALT_2026_SECURE_KEY';
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plainText + salt,
    Utilities.Charset.UTF_8
  );
  let hexString = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hexString += byteHex;
  }
  return hexString;
}

/**
 * Hasilkan Token Acak Tidak Berurutan (misal: TKA-8K9P2X)
 */
function generateSecureToken() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Tanpa karakter ambigu O, 0, 1, I
  let result = 'TKA-';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars.charAt(idx);
  }
  return result;
}

/**
 * Konversi Sheet ke Array of Plain Objects
 */
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const results = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    // Lewati baris kosong
    if (row.join('').trim() === '') continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      obj[header] = row[c];
    }
    results.push(obj);
  }
  return results;
}

/**
 * Update Baris Spesifik pada Sheet berdasarkan Key
 */
function updateSheetRow(sheet, keyColumn, keyValue, updateData) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0];
  const keyIdx = headers.indexOf(keyColumn);
  if (keyIdx === -1) return false;

  for (let r = 1; r < data.length; r++) {
    if (data[r][keyIdx].toString() === keyValue.toString()) {
      for (const colKey in updateData) {
        const cIdx = headers.indexOf(colKey);
        if (cIdx !== -1) {
          sheet.getRange(r + 1, cIdx + 1).setValue(updateData[colKey]);
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Hapus Baris Spesifik pada Sheet
 */
function deleteSheetRow(sheet, keyColumn, keyValue) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0];
  const keyIdx = headers.indexOf(keyColumn);
  if (keyIdx === -1) return false;

  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][keyIdx].toString() === keyValue.toString()) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/**
 * Catat Riwayat Audit Log
 */
function recordAuditLog(actorId, action, targetType, targetId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (!sheet) return;

    sheet.appendRow([
      'LOG-' + Utilities.getUuid().substring(0, 8),
      actorId || 'UNKNOWN',
      action,
      targetType || '-',
      targetId || '-',
      new Date().toISOString()
    ]);
  } catch (e) {}
}

/**
 * Bangun Respons Sukses Standar
 */
function buildSuccessResponse(data, callback) {
  const response = {
    success: true,
    data: data
  };
  const jsonString = JSON.stringify(response);

  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Bangun Respons Error Standar
 */
function buildErrorResponse(code, message, callback) {
  const response = {
    success: false,
    error: {
      code: code || 'ERROR',
      message: message || 'Terjadi kesalahan sistem.'
    }
  };
  const jsonString = JSON.stringify(response);

  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}
