const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiVersion: process.env.GEMINI_API_VERSION || 'v1beta',
  geminiModel: process.env.GEMINI_MODEL || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
};