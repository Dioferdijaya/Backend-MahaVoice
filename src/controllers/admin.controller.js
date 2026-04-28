const supabase = require('../config/supabase');

const USERS_TABLE = 'users';
const SCREENINGS_TABLE = 'screenings';

const getStressLevel = (score) => {
  if (score <= 13) return 'Rendah';
  if (score <= 26) return 'Sedang';
  return 'Berat';
};

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const getAdminDashboard = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const [usersCountResult, screeningsCountResult, screeningsResult, usersResult] = await Promise.all([
      supabase.from(USERS_TABLE).select('id_user', { count: 'exact', head: true }),
      supabase.from(SCREENINGS_TABLE).select('id', { count: 'exact', head: true }),
      supabase
        .from(SCREENINGS_TABLE)
        .select('id, user_id, nama, npm, email, score, total_score, level, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from(USERS_TABLE)
        .select('id_user, nama, npm, email, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const usersCountError = usersCountResult.error;
    const screeningsCountError = screeningsCountResult.error;
    const screeningsError = screeningsResult.error;
    const usersError = usersResult.error;

    const screeningsTableMissing = [screeningsCountError, screeningsError].some((item) =>
      item && /screenings/i.test(item.message || ''),
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

    const screenings = screeningsTableMissing ? [] : (screeningsResult.data || []);
    const users = usersResult.data || [];

    const distributionMap = screenings.reduce(
      (accumulator, item) => {
        const level = item.level || getStressLevel(safeCount(item.score));
        accumulator[level] = (accumulator[level] || 0) + 1;
        return accumulator;
      },
      { Rendah: 0, Sedang: 0, Berat: 0 },
    );

    const latestScreenings = screenings.slice(0, 5).map((item) => ({
      id: item.id,
      nama: item.nama || 'Nama tidak tersedia',
      npm: item.npm || '-',
      email: item.email || '-',
      score: safeCount(item.score),
      total_score: safeCount(item.total_score || 40),
      level: item.level || getStressLevel(safeCount(item.score)),
      created_at: item.created_at,
    }));

    const userLevelMap = new Map();
    screenings.forEach((item) => {
      const key = item.user_id || item.email || item.npm || item.nama;
      if (!key) return;
      if (!userLevelMap.has(key)) {
        userLevelMap.set(key, {
          nama: item.nama || 'Nama tidak tersedia',
          npm: item.npm || '-',
          email: item.email || '-',
          level: item.level || getStressLevel(safeCount(item.score)),
          score: safeCount(item.score),
          created_at: item.created_at,
        });
      }
    });

    const compositionUsers = Array.from(userLevelMap.values()).slice(0, 3);

    return res.status(200).json({
      success: true,
      message: 'Dashboard admin loaded',
      summary: {
        totalMahasiswa: safeCount(usersCountResult.count),
        totalScreening: screeningsTableMissing ? 0 : safeCount(screeningsCountResult.count),
        distribusi: [
          { label: 'Rendah', value: distributionMap.Rendah },
          { label: 'Sedang', value: distributionMap.Sedang },
          { label: 'Berat', value: distributionMap.Berat },
        ],
      },
      screeningsTableMissing,
      note: screeningsTableMissing
        ? 'Tabel screenings belum ditemukan di Supabase. Buat tabel screenings agar data hasil screening tersimpan dan dashboard terisi.'
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

    const { userId, nama, npm, email, score, totalScore } = req.body;
    const normalizedScore = safeCount(score);
    const normalizedTotal = safeCount(totalScore || 40);

    if (!email && !nama) {
      return res.status(400).json({
        success: false,
        message: 'Nama atau email user wajib diisi',
      });
    }

    const payload = {
      user_id: userId || null,
      nama: String(nama || '').trim(),
      npm: String(npm || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      score: normalizedScore,
      total_score: normalizedTotal,
      level: getStressLevel(normalizedScore),
    };

    const { data, error } = await supabase
      .from(SCREENINGS_TABLE)
      .insert(payload)
      .select('id, user_id, nama, npm, email, score, total_score, level, created_at')
      .single();

    if (error) {
      if (/screenings/i.test(error.message || '')) {
        return res.status(501).json({
          success: false,
          message: 'Tabel screenings belum ada di Supabase',
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan hasil screening',
        error: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Hasil screening tersimpan',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAdminDashboard,
  saveScreeningResult,
};
