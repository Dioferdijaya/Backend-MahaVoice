const crypto = require('crypto');
const supabase = require('../config/supabase');

const USERS_TABLE = 'users';
const ADMIN_TABLE = 'admin';

const sanitizeUser = (user) => {
  if (!user) {
    return user;
  }

  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.pass;
  delete sanitized.password_hash;
  delete sanitized.passwordHash;
  return sanitized;
};

const normalizeUser = (user) => ({
  id_user: user.id_user,
  nama: user.nama,
  npm: user.npm,
  email: user.email,
  created_at: user.created_at,
});

const normalizeAdmin = (admin) => ({
  id_admin: admin.id_admin,
  nama: admin.nama,
  email: admin.email,
  created_at: admin.created_at,
});

const isSamePassword = (inputPassword, user) => {
  const rawPassword = user.password || user.pass || '';
  const hashPassword = user.password_hash || user.passwordHash || '';

  if (rawPassword && inputPassword === rawPassword) {
    return true;
  }

  if (hashPassword) {
    const inputHash = crypto
      .createHash('sha256')
      .update(String(inputPassword))
      .digest('hex');
    return inputHash === hashPassword;
  }

  return false;
};

const getSupabaseStatus = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const { data, error } = await supabase.from(USERS_TABLE).select('*').limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase connected but query failed',
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase connected',
      table: USERS_TABLE,
      sample: data,
    });
  } catch (err) {
    return next(err);
  }
};

const loginUser = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: admin, error: adminError } = await supabase
      .from(ADMIN_TABLE)
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (adminError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data admin dari Supabase',
        error: adminError.message,
      });
    }

    if (admin && isSamePassword(password, admin)) {
      return res.status(200).json({
        success: true,
        message: 'Login admin berhasil',
        role: 'admin',
        user: normalizeAdmin(sanitizeUser(admin)),
      });
    }

    const { data: user, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data user dari Supabase',
        error: error.message,
      });
    }

    if (!user || !isSamePassword(password, user)) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      role: 'user',
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

const registerUser = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const { fullName, nama, npm, email, password } = req.body;
    const resolvedName = String(fullName || nama || '').trim();

    if (!resolvedName || !npm || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama, NPM, email, dan password wajib diisi',
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 8 karakter',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedNpm = String(npm).trim();

    const { data: existingUser, error: checkError } = await supabase
      .from(USERS_TABLE)
      .select('id_user')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengecek email user',
        error: checkError.message,
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
    }

    const payload = {
      nama: resolvedName,
      npm: trimmedNpm,
      email: normalizedEmail,
      password: String(password),
    };

    const { data: insertedUser, error: insertError } = await supabase
      .from(USERS_TABLE)
      .insert(payload)
      .select('*')
      .single();

    if (insertError || !insertedUser) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan data user ke tabel users',
        error: insertError?.message || 'Insert gagal',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      user: normalizeUser(sanitizeUser(insertedUser)),
    });
  } catch (err) {
    return next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Supabase belum dikonfigurasi' });
    }

    const { userId, nama, npm, email } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId wajib diisi' });
    }

    const updateData = {};
    if (nama !== undefined) updateData.nama = String(nama).trim();
    if (npm !== undefined) updateData.npm = String(npm).trim();
    if (email !== undefined) updateData.email = String(email).trim().toLowerCase();

    const { data: updated, error } = await supabase
      .from(USERS_TABLE)
      .update(updateData)
      .eq('id_user', userId)
      .select('*')
      .single();

    if (error || !updated) {
      return res.status(500).json({ success: false, message: 'Gagal memperbarui profil', error: error?.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: sanitizeUser(updated),
    });
  } catch (err) {
    return next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Supabase belum dikonfigurasi' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'userId, currentPassword, dan newPassword wajib diisi' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter' });
    }

    const { data: user, error: fetchError } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('id_user', userId)
      .maybeSingle();

    if (fetchError || !user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    if (!isSamePassword(currentPassword, user)) {
      return res.status(401).json({ success: false, message: 'Password saat ini salah' });
    }

    const { error: updateError } = await supabase
      .from(USERS_TABLE)
      .update({ password: String(newPassword) })
      .eq('id_user', userId);

    if (updateError) {
      return res.status(500).json({ success: false, message: 'Gagal mengubah password', error: updateError.message });
    }

    return res.status(200).json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getSupabaseStatus, loginUser, registerUser, updateProfile, changePassword };