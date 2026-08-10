// Configuration FollowsMatch — pointe désormais vers l'API FollowsMatch (Railway),
// qui remplace Supabase. Le pont fm-api.js traduit les appels (auth/base/rpc/photos).
// (Les noms de clés restent SUPABASE_* pour ne rien changer dans app.js.)
window.FM_CONFIG = {
  SUPABASE_URL: "https://followsmatch-api-production.up.railway.app",
  SUPABASE_ANON_KEY: "followsmatch-public"
};
