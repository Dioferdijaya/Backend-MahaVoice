const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabaseKey = env.supabaseServiceRoleKey || env.supabasePublishableKey;

if (!env.supabaseUrl || !supabaseKey) {
module.exports = null;
} else {
module.exports = createClient(env.supabaseUrl, supabaseKey, {
auth: {
persistSession: false,
autoRefreshToken: false,
},
});
}