/* ============================================================
   FollowsMatch — pont API (remplace supabase-js).
   Expose window.supabase.createClient(url,key) avec la MÊME surface
   que le client Supabase utilisée par app.js (auth / from / rpc / storage),
   mais tout part vers l'API FollowsMatch (Railway). app.js reste inchangé.
   ============================================================ */
(function () {
  const LS_KEY = 'fm_token';
  const getToken = () => { try { return localStorage.getItem(LS_KEY) || null; } catch (_) { return null; } };
  const setToken = (t) => { try { t ? localStorage.setItem(LS_KEY, t) : localStorage.removeItem(LS_KEY); } catch (_) {} };
  const decode = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return null; } };
  const sessFromToken = (t) => { if (!t) return null; const c = decode(t); if (!c) return null; return { access_token: t, token_type: 'bearer', user: { id: c.sub, email: c.email } }; };

  function makeClient(url) {
    const base = String(url || '').replace(/\/+$/, '');
    let session = sessFromToken(getToken());
    const listeners = [];
    const emit = (ev) => listeners.forEach((fn) => { try { fn(ev, session); } catch (_) {} });

    // Récupère un jeton renvoyé dans l'URL (retour Google OAuth), à la manière de Supabase.
    (function detectUrlToken() {
      if (location.hash && location.hash.indexOf('access_token') >= 0) {
        const h = new URLSearchParams(location.hash.slice(1));
        const t = h.get('access_token');
        if (t) { setToken(t); session = sessFromToken(t); history.replaceState(null, '', location.pathname + location.search); }
      }
    })();

    async function api(path, opts) {
      opts = opts || {};
      const headers = {};
      if (!opts.raw) headers['content-type'] = 'application/json';
      const tok = getToken();
      if (opts.auth !== false && tok) headers['authorization'] = 'Bearer ' + tok;
      let res, data = null;
      try {
        res = await fetch(base + path, {
          method: opts.method || 'GET',
          headers,
          body: opts.raw ? opts.body : (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        });
      } catch (e) {
        return { ok: false, data: { error: { message: 'réseau indisponible' } } };
      }
      try { data = await res.json(); } catch (_) {}
      return { ok: res.ok, status: res.status, data };
    }

    // ---------- AUTH ----------
    const auth = {
      async getSession() { session = sessFromToken(getToken()); return { data: { session }, error: null }; },
      async getUser() { session = sessFromToken(getToken()); return { data: { user: session ? session.user : null }, error: null }; },
      onAuthStateChange(cb) {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe() { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
      },
      async signUp({ email, password, options }) {
        const r = await api('/auth/signup', { method: 'POST', auth: false, body: { email, password, data: (options && options.data) || {} } });
        if (r.data && r.data.access_token) { setToken(r.data.access_token); session = sessFromToken(r.data.access_token); emit('SIGNED_IN'); return { data: { user: session.user, session }, error: null }; }
        return { data: { user: null, session: null }, error: (r.data && r.data.error) || { message: 'inscription impossible' } };
      },
      async signInWithPassword({ email, password }) {
        const r = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
        if (r.data && r.data.access_token) { setToken(r.data.access_token); session = sessFromToken(r.data.access_token); emit('SIGNED_IN'); return { data: { user: session.user, session }, error: null }; }
        return { data: { user: null, session: null }, error: (r.data && r.data.error) || { message: 'connexion impossible' } };
      },
      async signOut() { setToken(null); session = null; emit('SIGNED_OUT'); return { error: null }; },
      async resetPasswordForEmail(email) { await api('/auth/recover', { method: 'POST', auth: false, body: { email } }); return { data: {}, error: null }; },
      async updateUser({ password }) {
        const r = await api('/auth/update-user', { method: 'POST', body: { password } });
        if (r.data && r.data.user) return { data: { user: r.data.user }, error: null };
        return { data: { user: null }, error: (r.data && r.data.error) || { message: 'mise à jour impossible' } };
      },
      async signInWithOAuth({ provider, options }) {
        const redirect = (options && options.redirectTo) || location.href;
        if (provider === 'google') { location.href = base + '/auth/google/start?redirect_to=' + encodeURIComponent(redirect); return { data: { provider, url: null }, error: null }; }
        return { data: null, error: { message: 'fournisseur non pris en charge : ' + provider } };
      },
    };

    // ---------- TABLES (query builder minimal, compatible supabase-js) ----------
    function unwrap(r, q) {
      const resp = r.data;
      if (!resp) return { data: q._single ? null : [], error: { message: 'aucune réponse' } };
      if (resp.error) return { data: q._single ? null : (resp.data != null ? resp.data : []), error: resp.error };
      let data = resp.data;
      if (q._single) data = Array.isArray(data) ? (data[0] != null ? data[0] : null) : data;
      return { data, error: null };
    }

    async function exec(q) {
      try {
        // matchs : forme imbriquée dédiée
        if (q.table === 'matches' && q._op === 'select') {
          const r = await api('/me/matches');
          return unwrap(r, q);
        }
        if (q._op === 'select') {
          const r = await api('/rest/select', { method: 'POST', body: { table: q.table, filters: q._filters, order: q._order, limit: q._limit, single: q._single, embed: q._embed } });
          return unwrap(r, q);
        }
        if (q._op === 'insert') {
          const r = await api('/rest/insert', { method: 'POST', body: { table: q.table, rows: q._payload } });
          return unwrap(r, q);
        }
        if (q._op === 'update') {
          const r = await api('/rest/update', { method: 'POST', body: { table: q.table, values: q._payload, filters: q._filters } });
          return unwrap(r, q);
        }
        if (q._op === 'delete') {
          const r = await api('/rest/delete', { method: 'POST', body: { table: q.table, filters: q._filters } });
          return unwrap(r, q);
        }
        if (q._op === 'upsert') {
          const r = await api('/rest/upsert', { method: 'POST', body: { table: q.table, row: q._payload, onConflict: q._onConflict } });
          return unwrap(r, q);
        }
        return { data: null, error: { message: 'opération inconnue' } };
      } catch (e) {
        return { data: q._single ? null : null, error: { message: e.message } };
      }
    }

    function from(table) {
      const q = { table, _op: 'select', _filters: [], _order: null, _limit: null, _single: false, _embed: null, _payload: null, _onConflict: null };
      const b = {
        select(cols) {
          if (q._op === 'select') { if (typeof cols === 'string' && /profiles\s*\(/.test(cols)) q._embed = 'profiles'; }
          return b;
        },
        insert(rows) { q._op = 'insert'; q._payload = rows; return b; },
        update(vals) { q._op = 'update'; q._payload = vals; return b; },
        delete() { q._op = 'delete'; return b; },
        upsert(row, opts) { q._op = 'upsert'; q._payload = row; q._onConflict = opts && opts.onConflict; return b; },
        eq(col, val) { q._filters.push({ col, op: 'eq', val }); return b; },
        order(col, opts) { q._order = { col, ascending: !(opts && opts.ascending === false) }; return b; },
        limit(n) { q._limit = n; return b; },
        single() { q._single = true; return b; },
        maybeSingle() { q._single = true; return b; },
        then(resolve, reject) { return exec(q).then(resolve, reject); },
        catch(fn) { return exec(q).catch(fn); },
      };
      return b;
    }

    // ---------- RPC ----------
    async function rpc(fn, params) {
      const r = await api('/rpc/' + fn, { method: 'POST', body: params || {} });
      if (r.data && r.data.error) return { data: null, error: r.data.error };
      return { data: r.data ? r.data.data : null, error: null };
    }

    // ---------- STORAGE (bucket 'avatars') ----------
    const storage = {
      from(bucket) {
        return {
          async upload(path, blob, opts) {
            const r = await api('/' + bucket + '/' + path, { method: 'PUT', raw: true, body: blob });
            if (r.ok) return { data: { path }, error: null };
            return { data: null, error: (r.data && r.data.error) || { message: 'envoi impossible' } };
          },
          getPublicUrl(path) { return { data: { publicUrl: base + '/' + bucket + '/' + path } }; },
          async remove(paths) { for (const p of (paths || [])) { await api('/' + bucket + '/' + p, { method: 'DELETE' }); } return { data: {}, error: null }; },
        };
      },
    };

    return { auth, from, rpc, storage };
  }

  window.supabase = { createClient: (url, key) => makeClient(url) };
})();
