const crypto = require('crypto');
const supabase = require('../config/supabase');

const USERS_TABLE = 'users';
const SCREENINGS_TABLE = 'screenings';
const SCREENING_RESULTS_TABLE = 'hasil_screening';
const SCREENING_HISTORY_TABLE = 'riwayat_screening';
const SCREENING_QUESTIONS_TABLE = 'screening_questions';
const RECOMMENDATIONS_TABLE = 'recommendations';

const RECOMMENDATION_LEVELS = ['Rendah', 'Sedang', 'Berat'];

const getStressLevel = (score) => {
  if (score <= 13) return 'Rendah';
  if (score <= 26) return 'Sedang';
  return 'Berat';
};

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const normalizeQuestion = (question) => ({
  id_question: question.id_question,
  question_text: question.question_text,
  weight: safeCount(question.weight || 1),
  sort_order: safeCount(question.sort_order || 0),
  is_active: question.is_active ?? true,
  created_at: question.created_at,
  updated_at: question.updated_at,
});

const parseWeight = (value) => {
  const weight = Number(value);
  if (!Number.isFinite(weight)) return 1;
  return Math.min(Math.max(Math.trunc(weight), 1), 4);
};

const parseSortOrder = (value, fallback = 0) => {
  const sortOrder = Number(value);
  if (!Number.isFinite(sortOrder)) return fallback;
  return Math.trunc(sortOrder);
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const normalizeRecommendationItems = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((item) => item.replace(/^[-•*\s]+/, '').trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeRecommendation = (item) => ({
  id_recommendation: item.id_recommendation || null,
  stress_level: item.stress_level || null,
  title: item.title || '',
  description: item.description || '',
  items: Array.isArray(item.items) ? item.items : normalizeRecommendationItems(item.items),
  sort_order: safeCount(item.sort_order || 0),
  is_active: item.is_active ?? true,
  created_at: item.created_at,
  updated_at: item.updated_at,
});

const isValidRecommendationLevel = (value) => RECOMMENDATION_LEVELS.includes(String(value || '').trim());

const sortNormalizedRecommendations = (items) => {
  const levelOrder = new Map(RECOMMENDATION_LEVELS.map((level, index) => [level, index + 1]));

  return [...items].sort((left, right) => {
    const leftOrder = safeCount(left.sort_order) || levelOrder.get(left.stress_level) || 999;
    const rightOrder = safeCount(right.sort_order) || levelOrder.get(right.stress_level) || 999;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return String(left.stress_level || left.title || '').localeCompare(String(right.stress_level || right.title || ''));
  });
};

const fetchRecommendationsRows = async () => {
  const { data, error } = await supabase
    .from(RECOMMENDATIONS_TABLE)
    .select('*');

  if (error) {
    return { data: null, error };
  }

  return { data: data || [], error: null };
};

const fetchRecommendationSource = async () => {
  const source = await fetchRecommendationsRows();
  return { tableName: RECOMMENDATIONS_TABLE, ...source };
};

const getAdminDashboard = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const [usersCountResult, screeningsCountResult, screeningResultsResult, screeningsResult, usersResult] = await Promise.all([
      supabase.from(USERS_TABLE).select('id_user', { count: 'exact', head: true }),
      supabase.from(SCREENING_RESULTS_TABLE).select('id_hasil', { count: 'exact', head: true }),
      supabase
        .from(SCREENING_RESULTS_TABLE)
        .select('id_hasil, id_screening, skor, tingkat_stres')
        .order('id_hasil', { ascending: false })
        .limit(500),
      supabase
        .from(SCREENINGS_TABLE)
        .select('id_screening, id_user, tanggal, jawaban')
        .order('tanggal', { ascending: false })
        .limit(500),
      supabase
        .from(USERS_TABLE)
        .select('id_user, nama, npm, email, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const usersCountError = usersCountResult.error;
    const screeningsCountError = screeningsCountResult.error;
    const screeningResultsError = screeningResultsResult.error;
    const screeningsError = screeningsResult.error;
    const usersError = usersResult.error;

    const screeningsTableMissing = [screeningsCountError, screeningsError].some((item) =>
      item && /screenings/i.test(item.message || ''),
    );

    const screeningResultsTableMissing = [screeningsCountError, screeningResultsError].some((item) =>
      item && /hasil_screening/i.test(item.message || ''),
    );

    if (usersCountError || usersError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data dashboard admin',
        error: [usersCountError, usersError]
          .filter(Boolean)
          .map((item) => item.message)
          .join(' | '),
      });
    }

    const screeningResults = screeningResultsTableMissing ? [] : (screeningResultsResult.data || []);
    const screenings = screeningsTableMissing ? [] : (screeningsResult.data || []);
    const users = usersResult.data || [];
    const userMap = new Map(users.map((item) => [item.id_user, item]));
    const screeningMap = new Map(screenings.map((item) => [item.id_screening, item]));

    const distributionMap = screeningResults.reduce(
      (accumulator, item) => {
        const level = item.tingkat_stres || getStressLevel(safeCount(item.skor));
        accumulator[level] = (accumulator[level] || 0) + 1;
        return accumulator;
      },
      { Rendah: 0, Sedang: 0, Berat: 0 },
    );

    const latestScreenings = screeningResults.slice(0, 5).map((item) => {
      const screening = screeningMap.get(item.id_screening) || {};
      const user = userMap.get(screening.id_user) || {};

      return {
        id: item.id_hasil,
        nama: user.nama || 'Nama tidak tersedia',
        npm: user.npm || '-',
        email: user.email || '-',
        score: safeCount(item.skor),
        total_score: 40,
        level: item.tingkat_stres || getStressLevel(safeCount(item.skor)),
        created_at: screening.tanggal || null,
      };
    });

    const userLevelMap = new Map();
    screeningResults.forEach((item) => {
      const screening = screeningMap.get(item.id_screening) || {};
      const user = userMap.get(screening.id_user) || {};
      const key = screening.id_user || user.email || user.npm || user.nama || item.id_screening;
      if (!key) return;
      if (!userLevelMap.has(key)) {
        userLevelMap.set(key, {
          nama: user.nama || 'Nama tidak tersedia',
          npm: user.npm || '-',
          email: user.email || '-',
          level: item.tingkat_stres || getStressLevel(safeCount(item.skor)),
          score: safeCount(item.skor),
          created_at: screening.tanggal || null,
        });
      }
    });

    const compositionUsers = Array.from(userLevelMap.values()).slice(0, 3);

    return res.status(200).json({
      success: true,
      message: 'Dashboard admin loaded',
      summary: {
        totalMahasiswa: safeCount(usersCountResult.count),
        totalScreening: screeningResultsTableMissing ? 0 : safeCount(screeningsCountResult.count),
        distribusi: [
          { label: 'Rendah', value: distributionMap.Rendah },
          { label: 'Sedang', value: distributionMap.Sedang },
          { label: 'Berat', value: distributionMap.Berat },
        ],
      },
      screeningsTableMissing: screeningsTableMissing || screeningResultsTableMissing,
      note: screeningsTableMissing
        ? 'Tabel screenings belum ditemukan di Supabase. Tabel ini dipakai untuk menyimpan sesi screening.'
        : screeningResultsTableMissing
          ? 'Tabel hasil_screening belum ditemukan di Supabase. Buat tabel ini agar hasil screening tersimpan dan dashboard terisi.'
        : '',
      komposisi: compositionUsers,
      screeningTerbaru: latestScreenings,
      mahasiswa: users.map((item) => ({
        id_user: item.id_user,
        nama: item.nama,
        npm: item.npm,
        email: item.email,
        created_at: item.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

const saveScreeningResult = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const { userId, nama, npm, email, score, totalScore, answers = [] } = req.body;
    const normalizedScore = safeCount(score);
    const normalizedTotal = safeCount(totalScore || 40);
    const stressLevel = getStressLevel(normalizedScore);

    if (!email && !nama) {
      return res.status(400).json({
        success: false,
        message: 'Nama atau email user wajib diisi',
      });
    }

    const rawPayload = {
      id_user: userId || null,
      tanggal: new Date().toISOString().slice(0, 10),
      jawaban: JSON.stringify({
        answers,
        nama: String(nama || '').trim(),
        npm: String(npm || '').trim(),
        email: String(email || '').trim().toLowerCase(),
        score: normalizedScore,
        total_score: normalizedTotal,
        level: stressLevel,
      }),
    };

    const { data: screeningData, error: screeningError } = await supabase
      .from(SCREENINGS_TABLE)
      .insert(rawPayload)
      .select('id_screening, id_user, tanggal, jawaban')
      .single();

    if (screeningError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan sesi screening',
        error: screeningError.message,
      });
    }

    const resultPayload = {
      id_screening: screeningData.id_screening,
      skor: normalizedScore,
      tingkat_stres: stressLevel,
    };

    const { data: resultData, error: resultError } = await supabase
      .from(SCREENING_RESULTS_TABLE)
      .insert(resultPayload)
      .select('id_hasil, id_screening, skor, tingkat_stres')
      .single();

    if (resultError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan hasil screening',
        error: resultError.message,
      });
    }

    const { data: historyData, error: historyError } = await supabase
      .from(SCREENING_HISTORY_TABLE)
      .insert({
        id_user: userId || null,
        id_hasil: resultData.id_hasil,
        tanggal: rawPayload.tanggal,
      })
      .select('id_riwayat, id_user, id_hasil, tanggal')
      .single();

    if (historyError) {
      return res.status(500).json({
        success: false,
        message: 'Hasil screening tersimpan, tetapi riwayat screening gagal disimpan',
        error: historyError.message,
        data: {
          screening: screeningData,
          hasil: resultData,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Hasil screening tersimpan',
      data: {
        screening: screeningData,
        hasil: resultData,
        riwayat: historyData,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getUserScreeningHistory = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const userId = Number(req.query.userId);

    if (!Number.isFinite(userId)) {
      return res.status(400).json({
        success: false,
        message: 'userId wajib diisi',
      });
    }

    const { data: historyRows, error: historyError } = await supabase
      .from(SCREENING_HISTORY_TABLE)
      .select('id_riwayat, id_user, id_hasil, tanggal')
      .eq('id_user', userId)
      .order('tanggal', { ascending: false })
      .order('id_riwayat', { ascending: false })
      .limit(100);

    if (historyError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil riwayat screening',
        error: historyError.message,
      });
    }

    const history = historyRows || [];
    const resultIds = history.map((item) => item.id_hasil).filter(Boolean);

    if (!resultIds.length) {
      return res.status(200).json({
        success: true,
        message: 'Riwayat screening kosong',
        histories: [],
      });
    }

    const { data: resultRows, error: resultError } = await supabase
      .from(SCREENING_RESULTS_TABLE)
      .select('id_hasil, skor, tingkat_stres')
      .in('id_hasil', resultIds);

    if (resultError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil hasil screening',
        error: resultError.message,
      });
    }

    const resultMap = new Map((resultRows || []).map((item) => [item.id_hasil, item]));

    return res.status(200).json({
      success: true,
      message: 'Riwayat screening berhasil diambil',
      histories: history.map((item) => {
        const result = resultMap.get(item.id_hasil) || {};
        return {
          id_riwayat: item.id_riwayat,
          id_user: item.id_user,
          id_hasil: item.id_hasil,
          tanggal: item.tanggal,
          skor: safeCount(result.skor),
          total_score: 40,
          level: result.tingkat_stres || getStressLevel(safeCount(result.skor)),
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
};

const getAdminScreeningResults = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const limitValue = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

    const [resultsResponse, screeningsResponse, usersResponse] = await Promise.all([
      supabase
        .from(SCREENING_RESULTS_TABLE)
        .select('id_hasil, id_screening, skor, tingkat_stres')
        .order('id_hasil', { ascending: false })
        .limit(limitValue),
      supabase
        .from(SCREENINGS_TABLE)
        .select('id_screening, id_user, tanggal, jawaban')
        .order('id_screening', { ascending: false })
        .limit(limitValue * 2),
      supabase
        .from(USERS_TABLE)
        .select('id_user, nama, npm, email')
        .limit(limitValue * 2),
    ]);

    if (resultsResponse.error || screeningsResponse.error || usersResponse.error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil hasil screening admin',
        error: [resultsResponse.error, screeningsResponse.error, usersResponse.error]
          .filter(Boolean)
          .map((item) => item.message)
          .join(' | '),
      });
    }

    const results = resultsResponse.data || [];
    const screenings = screeningsResponse.data || [];
    const users = usersResponse.data || [];

    const screeningMap = new Map(screenings.map((item) => [item.id_screening, item]));
    const userMap = new Map(users.map((item) => [item.id_user, item]));

    const rows = results.map((item) => {
      const screening = screeningMap.get(item.id_screening) || {};
      const user = userMap.get(screening.id_user) || {};
      const parsedJawaban = (() => {
        try {
          if (!screening.jawaban) return {};
          return typeof screening.jawaban === 'string' ? JSON.parse(screening.jawaban) : screening.jawaban;
        } catch (error) {
          return {};
        }
      })();

      return {
        id_hasil: item.id_hasil,
        id_screening: item.id_screening,
        id_user: screening.id_user || null,
        nama: user.nama || parsedJawaban.nama || 'Nama tidak tersedia',
        npm: user.npm || parsedJawaban.npm || '-',
        email: user.email || parsedJawaban.email || '-',
        tanggal: screening.tanggal || null,
        skor: safeCount(item.skor),
        total_score: safeCount(parsedJawaban.total_score || 40),
        level: item.tingkat_stres || getStressLevel(safeCount(item.skor)),
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Hasil screening admin berhasil diambil',
      rows,
      total: rows.length,
    });
  } catch (err) {
    return next(err);
  }
};

const getAdminUsers = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const limitValue = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);

    const [usersResponse, screeningsResponse, resultsResponse] = await Promise.all([
      supabase
        .from(USERS_TABLE)
        .select('id_user, nama, npm, email, created_at')
        .order('created_at', { ascending: false })
        .limit(limitValue),
      supabase
        .from(SCREENINGS_TABLE)
        .select('id_screening, id_user, tanggal')
        .order('tanggal', { ascending: false })
        .limit(limitValue * 3),
      supabase
        .from(SCREENING_RESULTS_TABLE)
        .select('id_hasil, id_screening, skor, tingkat_stres')
        .order('id_hasil', { ascending: false })
        .limit(limitValue * 3),
    ]);

    if (usersResponse.error || screeningsResponse.error || resultsResponse.error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data mahasiswa',
        error: [usersResponse.error, screeningsResponse.error, resultsResponse.error]
          .filter(Boolean)
          .map((item) => item.message)
          .join(' | '),
      });
    }

    const users = usersResponse.data || [];
    const screenings = screeningsResponse.data || [];
    const results = resultsResponse.data || [];

    const userScreenings = new Map();

    screenings.forEach((item) => {
      const key = item.id_user;
      if (!key) return;
      const list = userScreenings.get(key) || [];
      list.push(item);
      userScreenings.set(key, list);
    });

    const resultMap = new Map(results.map((item) => [item.id_screening, item]));

    const rows = users.map((user) => {
      const userScreeningList = userScreenings.get(user.id_user) || [];
      const latestScreening = userScreeningList[0] || null;
      const latestResult = latestScreening ? resultMap.get(latestScreening.id_screening) || null : null;

      return {
        id_user: user.id_user,
        nama: user.nama || 'Nama tidak tersedia',
        npm: user.npm || '-',
        email: user.email || '-',
        created_at: user.created_at,
        total_screening: userScreeningList.length,
        last_screening_at: latestScreening?.tanggal || null,
        last_score: safeCount(latestResult?.skor),
        last_level: latestResult?.tingkat_stres || (latestResult ? getStressLevel(safeCount(latestResult.skor)) : '-'),
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Data mahasiswa berhasil diambil',
      rows,
      total: rows.length,
    });
  } catch (err) {
    return next(err);
  }
};

const listRecommendations = async (req, res, next, includeInactive = false) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const source = await fetchRecommendationSource();

    if (source.error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil rekomendasi',
        error: source.error.message,
      });
    }

    const normalized = sortNormalizedRecommendations((source.data || []).map((item, index) => {
      const recommendation = normalizeRecommendation(item);

      if (!recommendation.stress_level) {
        recommendation.stress_level = RECOMMENDATION_LEVELS[index] || null;
      }

      if (!recommendation.title) {
        recommendation.title = recommendation.stress_level ? `Stres ${recommendation.stress_level}` : `Rekomendasi ${index + 1}`;
      }

      return recommendation;
    }));

    const filtered = includeInactive ? normalized : normalized.filter((item) => item.is_active);

    return res.status(200).json({
      success: true,
      message: 'Rekomendasi berhasil diambil',
      recommendations: filtered,
    });
  } catch (err) {
    return next(err);
  }
};

const getPublicRecommendations = async (req, res, next) => {
  try {
    const level = String(req.query.level || '').trim();

    if (level && !isValidRecommendationLevel(level)) {
      return res.status(400).json({
        success: false,
        message: 'level rekomendasi tidak valid',
      });
    }

    if (!level) {
      return listRecommendations(req, res, next, false);
    }

    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const source = await fetchRecommendationSource();

    if (source.error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil rekomendasi',
        error: source.error.message,
      });
    }

    const normalized = sortNormalizedRecommendations((source.data || []).map((item, index) => {
      const recommendation = normalizeRecommendation(item);

      if (!recommendation.stress_level) {
        recommendation.stress_level = RECOMMENDATION_LEVELS[index] || null;
      }

      if (!recommendation.title) {
        recommendation.title = recommendation.stress_level ? `Stres ${recommendation.stress_level}` : `Rekomendasi ${index + 1}`;
      }

      return recommendation;
    }));

    const data = normalized.find((item) => item.stress_level === level && item.is_active);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Rekomendasi untuk level ini belum tersedia',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Rekomendasi berhasil diambil',
      recommendation: normalizeRecommendation(data),
    });
  } catch (err) {
    return next(err);
  }
};

const getAdminRecommendations = async (req, res, next) => listRecommendations(req, res, next, true);

const upsertRecommendation = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const level = String(req.params.level || req.body.stress_level || '').trim();

    if (!isValidRecommendationLevel(level)) {
      return res.status(400).json({
        success: false,
        message: 'stress_level wajib diisi dengan nilai Rendah, Sedang, atau Berat',
      });
    }

    const title = String(req.body.title || req.body.judul || `Stres ${level}`).trim();
    const description = String(req.body.description || req.body.deskripsi || '').trim();
    const items = normalizeRecommendationItems(req.body.items ?? req.body.recommendation_items ?? req.body.list);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Judul rekomendasi wajib diisi',
      });
    }

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu poin rekomendasi harus diisi',
      });
    }

    const payload = {
      stress_level: level,
      title,
      description,
      items,
      sort_order: parseSortOrder(req.body.sort_order ?? req.body.urutan ?? (RECOMMENDATION_LEVELS.indexOf(level) + 1), RECOMMENDATION_LEVELS.indexOf(level) + 1),
      is_active: parseBoolean(req.body.is_active, true),
    };

    const source = await fetchRecommendationSource();

    if (source.error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan rekomendasi',
        error: source.error.message,
      });
    }

    const { data, error } = await supabase
      .from(RECOMMENDATIONS_TABLE)
      .upsert(payload, { onConflict: 'stress_level' })
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan rekomendasi',
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Rekomendasi berhasil disimpan',
      recommendation: normalizeRecommendation(data),
    });
  } catch (err) {
    return next(err);
  }
};

const listScreeningQuestions = async (req, res, next, includeInactive = false) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    let query = supabase
      .from(SCREENING_QUESTIONS_TABLE)
      .select('id_question, question_text, weight, sort_order, is_active, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id_question', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil pertanyaan screening',
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pertanyaan screening berhasil diambil',
      questions: (data || []).map(normalizeQuestion),
    });
  } catch (err) {
    return next(err);
  }
};

const getPublicScreeningQuestions = async (req, res, next) => listScreeningQuestions(req, res, next, false);

const getAdminScreeningQuestions = async (req, res, next) => listScreeningQuestions(req, res, next, true);

const createScreeningQuestion = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const questionText = String(req.body.question_text || req.body.pertanyaan || '').trim();
    if (!questionText) {
      return res.status(400).json({
        success: false,
        message: 'Pertanyaan wajib diisi',
      });
    }

    const payload = {
      id_question: crypto.randomUUID(),
      question_text: questionText,
      weight: parseWeight(req.body.weight ?? req.body.bobot ?? 1),
      sort_order: parseSortOrder(req.body.sort_order ?? req.body.urutan ?? 0),
      is_active: parseBoolean(req.body.is_active, true),
    };

    const { data, error } = await supabase
      .from(SCREENING_QUESTIONS_TABLE)
      .insert(payload)
      .select('id_question, question_text, weight, sort_order, is_active, created_at, updated_at')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan pertanyaan screening',
        error: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Pertanyaan screening berhasil dibuat',
      question: normalizeQuestion(data),
    });
  } catch (err) {
    return next(err);
  }
};

const updateScreeningQuestion = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const idQuestion = req.params.id || req.body.id_question;
    const questionText = String(req.body.question_text || req.body.pertanyaan || '').trim();

    if (!idQuestion) {
      return res.status(400).json({
        success: false,
        message: 'id_question wajib diisi',
      });
    }

    if (!questionText) {
      return res.status(400).json({
        success: false,
        message: 'Pertanyaan wajib diisi',
      });
    }

    const payload = {
      question_text: questionText,
      weight: parseWeight(req.body.weight ?? req.body.bobot ?? 1),
      sort_order: parseSortOrder(req.body.sort_order ?? req.body.urutan ?? 0),
      is_active: parseBoolean(req.body.is_active, true),
    };

    const { data, error } = await supabase
      .from(SCREENING_QUESTIONS_TABLE)
      .update(payload)
      .eq('id_question', idQuestion)
      .select('id_question, question_text, weight, sort_order, is_active, created_at, updated_at')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui pertanyaan screening',
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pertanyaan screening berhasil diperbarui',
      question: normalizeQuestion(data),
    });
  } catch (err) {
    return next(err);
  }
};

const deleteScreeningQuestion = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const idQuestion = req.params.id;

    if (!idQuestion) {
      return res.status(400).json({
        success: false,
        message: 'id_question wajib diisi',
      });
    }

    const { error } = await supabase
      .from(SCREENING_QUESTIONS_TABLE)
      .delete()
      .eq('id_question', idQuestion);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus pertanyaan screening',
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pertanyaan screening berhasil dihapus',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAdminDashboard,
  saveScreeningResult,
  getPublicScreeningQuestions,
  getAdminScreeningQuestions,
  createScreeningQuestion,
  updateScreeningQuestion,
  deleteScreeningQuestion,
  getUserScreeningHistory,
  getAdminScreeningResults,
  getAdminUsers,
  getPublicRecommendations,
  getAdminRecommendations,
  upsertRecommendation,
};
