const supabase = require('../config/supabase');

const TIPS_TABLE = 'tips';

// ─────────────────────────────────────────────
// GET ALL TIPS (active only)
// ─────────────────────────────────────────────
const getAllTips = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data tips',
        error: error.message,
      });
    }

    // Normalize DB column `isi` to `content` for frontend compatibility
    const normalized = (data || []).map((row) => ({
      ...row,
      content: row.isi !== undefined ? row.isi : row.content || null,
    }));

    res.status(200).json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error('Error fetching all tips:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET TIPS BY CATEGORY
// ─────────────────────────────────────────────
const getTipsByCategory = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Kategori harus diisi',
      });
    }

    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data tips',
        error: error.message,
      });
    }

    const normalized = (data || []).map((row) => ({
      ...row,
      content: row.isi !== undefined ? row.isi : row.content || null,
    }));

    res.status(200).json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error('Error fetching tips by category:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET ALL TIPS FOR ADMIN (including inactive)
// ─────────────────────────────────────────────
const getAdminTips = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data tips',
        error: error.message,
      });
    }

    const normalized = (data || []).map((row) => ({
      ...row,
      content: row.isi !== undefined ? row.isi : row.content || null,
    }));

    res.status(200).json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error('Error fetching admin tips:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// CREATE NEW TIP
// ─────────────────────────────────────────────
const createTip = async (req, res) => {
  try {
    const { title, description, content, isi, category, sort_order } = req.body;

    // Validate required fields
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        error: 'Judul dan kategori harus diisi',
      });
    }

    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .insert([
        {
          title: title.trim(),
          description: description ? description.trim() : null,
          isi: isi !== undefined ? (isi ? isi.trim() : null) : (content ? content.trim() : null),
          category: category.trim(),
          sort_order: sort_order || 0,
          is_active: true,
        },
      ])
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menambahkan tips',
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tips berhasil ditambahkan',
      data: data && data.length > 0 ? ({ ...data[0], content: data[0].isi || data[0].content || null }) : {},
    });
  } catch (error) {
    console.error('Error creating tip:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// UPDATE TIP
// ─────────────────────────────────────────────
const updateTip = async (req, res) => {
  try {
    console.log('[TIPS] updateTip request', { params: req.params, body: req.body });

    const { id } = req.params;
    const { title, description, content, isi, category, sort_order, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'id_tips harus diisi' });
    }

    // Build update object only with provided fields
    const updateData = {};
    if (title !== undefined && typeof title === 'string') updateData.title = title.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (content !== undefined) updateData.isi = content ? content.trim() : null;
    if (isi !== undefined) updateData.isi = isi ? isi.trim() : null;
    if (category !== undefined && typeof category === 'string') updateData.category = category.trim();
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada field untuk diupdate' });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .update(updateData)
      .eq('id_tips', id)
      .select();

    if (error) {
      console.error('[TIPS] supabase update error', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengubah tips',
        error: error.message,
      });
    }

    console.log('[TIPS] update success', data);

    res.status(200).json({
      success: true,
      message: 'Tips berhasil diperbarui',
      data: data && data.length > 0 ? data[0] : {},
    });
  } catch (error) {
    console.error('Error updating tip:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error),
    });
  }
};

// ─────────────────────────────────────────────
// DELETE TIP
// ─────────────────────────────────────────────
const deleteTip = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .delete()
      .eq('id_tips', id)
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus tips',
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tips berhasil dihapus',
      data: data && data.length > 0 ? data[0] : {},
    });
  } catch (error) {
    console.error('Error deleting tip:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllTips,
  getTipsByCategory,
  getAdminTips,
  createTip,
  updateTip,
  deleteTip,
};
