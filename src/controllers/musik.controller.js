const supabase = require('../config/supabase');

const MUSIK_TABLE = 'musik';

const getDefaultThumbnailUrl = (youtubeId) => {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId.trim()}/hqdefault.jpg`;
};

// ─────────────────────────────────────────────
// GET ALL MUSIC
// ─────────────────────────────────────────────
const getAllMusik = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data musik',
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data,
      message: 'Musik berhasil diambil',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET MUSIC BY CATEGORY
// ─────────────────────────────────────────────
const getMusikByCategory = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Kategori harus disediakan',
      });
    }

    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data musik',
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data,
      message: 'Musik berhasil diambil',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET ALL MUSIC (including inactive)
// ─────────────────────────────────────────────
const getAdminMusik = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data musik',
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data,
      message: 'Data musik berhasil diambil',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// CREATE MUSIK (ADMIN)
// ─────────────────────────────────────────────
const createMusik = async (req, res) => {
  try {
    const { title, category, channel, youtube_id, thumbnail_url, sort_order } = req.body;

    if (!title || !category || !youtube_id) {
      return res.status(400).json({
        success: false,
        message: 'Judul, kategori, dan YouTube ID harus disediakan',
      });
    }

    const trimmedYoutubeId = youtube_id.trim();
    const resolvedThumbnailUrl = thumbnail_url && thumbnail_url.trim()
      ? thumbnail_url.trim()
      : getDefaultThumbnailUrl(trimmedYoutubeId);

    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .insert([
        {
          title: title.trim(),
          category: category.trim(),
          channel: channel ? channel.trim() : null,
          youtube_id: trimmedYoutubeId,
          thumbnail_url: resolvedThumbnailUrl,
          sort_order: sort_order ? parseInt(sort_order) : 0,
          is_active: true,
        },
      ])
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat musik',
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      data: data[0],
      message: 'Musik berhasil dibuat',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// UPDATE MUSIK (ADMIN)
// ─────────────────────────────────────────────
const updateMusik = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, channel, youtube_id, thumbnail_url, sort_order, is_active } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID musik harus disediakan',
      });
    }

    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (channel !== undefined) updateData.channel = channel ? channel.trim() : null;
    if (youtube_id !== undefined) {
      const trimmedYoutubeId = youtube_id.trim();
      updateData.youtube_id = trimmedYoutubeId;
      if (thumbnail_url === undefined) {
        updateData.thumbnail_url = getDefaultThumbnailUrl(trimmedYoutubeId);
      }
    }
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url ? thumbnail_url.trim() : null;
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order);
    if (is_active !== undefined) updateData.is_active = is_active;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .update(updateData)
      .eq('id_musik', id)
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui musik',
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Musik tidak ditemukan',
      });
    }

    res.status(200).json({
      success: true,
      data: data[0],
      message: 'Musik berhasil diperbarui',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// DELETE MUSIK (ADMIN)
// ─────────────────────────────────────────────
const deleteMusik = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID musik harus disediakan',
      });
    }

    const { data, error } = await supabase
      .from(MUSIK_TABLE)
      .delete()
      .eq('id_musik', id)
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus musik',
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Musik tidak ditemukan',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Musik berhasil dihapus',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  getAllMusik,
  getMusikByCategory,
  getAdminMusik,
  createMusik,
  updateMusik,
  deleteMusik,
};
