const crypto = require('crypto');
const supabase = require('../config/supabase');
const env = require('../config/env');

const CHAT_TABLE = 'chatbot';
const USERS_TABLE = 'users';
const GEMINI_API_VERSION = env.geminiApiVersion || 'v1';
const GEMINI_MODEL_CANDIDATES = [
  env.geminiModel,
  'gemini-2.5-flash',
  'gemini-2.5-flash-latest',
  'gemini-1.5-flash',
].filter(Boolean);

const CREATOR_CREDITS = [
  'Bot ini dibuat oleh Dio Ferdi Jaya, Tinsari Rauhana, Muhammad Al Azizi, Adinda Muarrifa, dan Razian Sabri.',
  'Dosen pembimbing: Ibu Rini Rasasunaja, Universitas Syiah Kuala, Banda Aceh.',
].join(' ');

const SYSTEM_PROMPT = [
  'Kamu adalah Hava, chatbot pendamping mahasiswa MahaVoice.',
  'Jawab dengan bahasa Indonesia yang hangat, empatik, singkat, dan jelas.',
  'Jika pengguna ingin screening, bantu arahkan ke fitur screening.',
  'Jika pengguna bercerita soal stres, validasi perasaan mereka dan beri saran ringan yang aman.',
  `Jika pengguna bertanya siapa yang membuatmu, jawab dengan: ${CREATOR_CREDITS}`,
  'Jika ada tanda bahaya serius, sarankan mencari bantuan profesional atau layanan darurat setempat.',
].join(' ');

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  }

  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';
};

const encodeChatPayload = ({ role, text, sessionId }) => JSON.stringify({
  role,
  text,
  sessionId,
});

const decodeChatPayload = (value) => {
  if (!value) {
    return {
      role: 'user',
      text: '',
      sessionId: null,
    };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        return {
          role: parsed.role === 'assistant' ? 'assistant' : 'user',
          text: parsed.text,
          sessionId: parsed.sessionId || null,
        };
      }
    } catch (error) {
      return {
        role: 'user',
        text: value,
        sessionId: null,
      };
    }
  }

  if (typeof value === 'object' && typeof value.text === 'string') {
    return {
      role: value.role === 'assistant' ? 'assistant' : 'user',
      text: value.text,
      sessionId: value.sessionId || null,
    };
  }

  return {
    role: 'user',
    text: String(value),
    sessionId: null,
  };
};

const normalizeMessage = (row) => {
  const decoded = decodeChatPayload(row.pesan);

  return {
    id_chat: row.id_chat,
    id_user: row.id_user,
    role: row.role || decoded.role,
    text: row.pesan_text || decoded.text,
    sessionId: row.session_id || decoded.sessionId,
    waktu: row.waktu,
    time: formatTime(row.waktu),
  };
};

const isChatConfigured = () => Boolean(supabase && env.geminiApiKey);

const getUserMessage = (req) => String(req.body.message || req.body.pesan || '').trim();

const getSessionId = (input) => String(input || '').trim() || crypto.randomUUID();

const normalizeMessageText = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const buildIntentResponse = (message) => {
  const normalized = normalizeMessageText(message);

  if (!normalized) {
    return null;
  }

  const greetingMatch = /\b(hai|halo|hi|hello|helo|pagi|siang|sore|malam)\b/.test(normalized);
  if (greetingMatch && normalized.length <= 40) {
    return {
      reply: [
        'Halo, aku Hava, teman ngobrol di MahaVoice.',
        'Aku bisa bantu kamu cerita, screening stres, lihat riwayat screening, atau cari musik relaksasi.',
        'Kalau mau, langsung tulis kebutuhanmu ya.',
      ].join(' '),
      action: null,
    };
  }

  const creatorMatch = /\b(siapa (yang )?(membuat|menciptakan|merancang) (kamu|bot ini|botnya|hava)|siapa pembuat(\s+bot)?(\s+ini|nya)?|pembuat(\s+bot)?(\s+ini|nya)?|dibuat oleh siapa|dibuat sama siapa|siapa yang bikin(\s+bot)?(\s+ini|nya)?|creator|pencipta|developer)\b/.test(normalized);
  if (creatorMatch) {
    return {
      reply: `${CREATOR_CREDITS}`,
      action: null,
    };
  }

  const screeningMatch = /\b(screening|cek stres|tes stres|stres|cemas|cemas berlebih|panik|depresi|sedih|lelah|capek|overwhelmed|tidak kuat|ga kuat|nggak kuat|takut|bingung)\b/.test(normalized);
  if (screeningMatch) {
    return {
      reply: 'Sepertinya kamu butuh fitur screening. Aku arahkan ke sana ya supaya kamu bisa cek kondisi kamu lebih dulu.',
      action: { type: 'navigate', target: 'screening' },
    };
  }

  const historyMatch = /\b(riwayat|history|hasil screening|hasil sebelumnya|rekam|rekap|progress)\b/.test(normalized);
  if (historyMatch) {
    return {
      reply: 'Tentu, aku arahkan ke riwayat screening kamu ya.',
      action: { type: 'navigate', target: 'riwayat' },
    };
  }

  const musicMatch = /\b(musik|lagu|relaksasi|tenang|menenangkan|meditasi|tidur)\b/.test(normalized);
  if (musicMatch) {
    return {
      reply: 'Bisa, aku arahkan ke fitur musik relaksasi supaya kamu bisa lebih tenang.',
      action: { type: 'navigate', target: 'musik' },
    };
  }

  return null;
};

const insertChatRow = async ({ idUser, role, text, sessionId }) => {
  const payload = {
    id_chat: crypto.randomUUID(),
    id_user: idUser,
    session_id: sessionId,
    role,
    pesan: encodeChatPayload({ role, text, sessionId }),
    pesan_text: text,
    waktu: new Date().toISOString(),
  };

  try {
    if (!supabase) {
      const err = new Error('Supabase client tidak tersedia');
      err.detail = 'Supabase client is null - check env keys';
      throw err;
    }

    console.log('Inserting chat row', { table: CHAT_TABLE, idUser, role, sessionId });

    const { data, error } = await supabase
      .from(CHAT_TABLE)
      .insert(payload)
      .select('id_chat, id_user, session_id, role, pesan, pesan_text, waktu')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return normalizeMessage(data);
  } catch (err) {
    console.error('insertChatRow error:', err && err.message ? err.message : err, { payload });
    throw err;
  }
};

const fetchChatHistory = async (idUser, since, limit = 20) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  let query = supabase
    .from(CHAT_TABLE)
    .select('id_chat, id_user, session_id, role, pesan, pesan_text, waktu')
    .eq('id_user', idUser)
    .order('waktu', { ascending: true })
    .limit(safeLimit);

  if (since) {
    query = query.gte('waktu', since);
  }

  try {
    if (!supabase) {
      const err = new Error('Supabase client tidak tersedia');
      err.detail = 'Supabase client is null - check env keys';
      throw err;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }

    return (data || []).map(normalizeMessage);
  } catch (err) {
    console.error('fetchChatHistory error:', err && err.message ? err.message : err, { idUser, since, limit: safeLimit });
    throw err;
  }
};

const buildGeminiContents = (history, message) => {
  const contents = [];

  history.forEach((item) => {
    if (!item.text) {
      return;
    }

    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text }],
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  return contents;
};

const callGemini = async (model, history, message) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${env.geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: buildGeminiContents(history, message),
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 256,
        },
      }),
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = result.error?.message || 'Gagal memanggil Gemini API';
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    error.details = result.error || result;
    throw error;
  }

  const replyText = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('')
    .trim();

  if (!replyText) {
    throw new Error('Gemini tidak mengembalikan teks balasan');
  }

  return replyText;
};

const generateGeminiReply = async (history, message) => {
  let lastError = null;

  for (const model of [...new Set(GEMINI_MODEL_CANDIDATES)]) {
    try {
      console.log('Trying Gemini model', { model, version: GEMINI_API_VERSION });
      return await callGemini(model, history, message);
    } catch (error) {
      lastError = error;
      console.error('Gemini model failed:', { model, version: GEMINI_API_VERSION, error: error.message });

      const errorText = String(error.message || '').toLowerCase();
      const shouldTryNext =
        error.statusCode === 404 ||
        error.statusCode === 400 ||
        errorText.includes('not found') ||
        errorText.includes('not supported') ||
        errorText.includes('unsupported');

      if (!shouldTryNext) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Semua model Gemini gagal dipanggil');
};

const getChatHistory = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase belum dikonfigurasi. Cek file .env',
      });
    }

    const { userId, since, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId wajib diisi',
      });
    }

    const messages = await fetchChatHistory(userId, since, limit);

    return res.status(200).json({
      success: true,
      message: 'Riwayat chat berhasil diambil',
      messages,
    });
  } catch (error) {
    return next(error);
  }
};

const sendChatMessage = async (req, res, next) => {
  try {
    if (!isChatConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Supabase atau GEMINI_API_KEY belum dikonfigurasi. Cek file .env',
      });
    }

    const { userId, sessionId: rawSessionId, since } = req.body;
    const message = getUserMessage(req);

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId dan message wajib diisi',
      });
    }

    const normalizedSessionId = getSessionId(rawSessionId);

    const { data: userRecord, error: userError } = await supabase
      .from(USERS_TABLE)
      .select('id_user')
      .eq('id_user', userId)
      .maybeSingle();

    if (userError) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memvalidasi user',
        error: userError.message,
      });
    }

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan',
      });
    }

    const userMessage = await insertChatRow({
      idUser: userId,
      role: 'user',
      text: message,
      sessionId: normalizedSessionId,
    });

    let replyText;
    let usedFallback = false;
    let action = null;

    const intentResponse = buildIntentResponse(message);

    if (intentResponse) {
      replyText = intentResponse.reply;
      action = intentResponse.action;
    } else {
      const history = await fetchChatHistory(userId, since, 50);

      try {
        replyText = await generateGeminiReply(history.slice(0, -1), message);
      } catch (err) {
        // log for server-side debugging and continue with a graceful fallback
        console.error('Gemini generation error:', err && err.message ? err.message : err);

        usedFallback = true;
        replyText = 'Maaf, Hava sedang sibuk sekarang. Aku telah menyimpan pesanmu dan akan mencoba merespons lagi nanti.';
      }
    }

    let assistantMessage;
    try {
      assistantMessage = await insertChatRow({
        idUser: userId,
        role: 'assistant',
        text: replyText,
        sessionId: normalizedSessionId,
      });
    } catch (err) {
      console.error('Failed to insert assistant message:', err && err.message ? err.message : err);
      // Don't fail the whole request; return replyText but report insert failure
      return res.status(200).json({
        success: true,
        message: 'Balasan diterima (fallback atau partial), namun terjadi kegagalan menyimpan ke DB',
        sessionId: normalizedSessionId,
        userMessage,
        assistantMessage: null,
        reply: replyText,
        fallback: usedFallback,
        warning: err && err.message ? err.message : String(err),
      });
    }

    return res.status(200).json({
      success: true,
      message: usedFallback ? 'Balasan fallback dikembalikan' : 'Balasan Gemini berhasil dibuat',
      sessionId: normalizedSessionId,
      userMessage,
      assistantMessage,
      reply: replyText,
      fallback: usedFallback,
      action,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getChatHistory,
  sendChatMessage,
};