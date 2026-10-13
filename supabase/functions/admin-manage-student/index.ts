import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string, string>;
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Object.values(publishableKeys)[0];
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Object.values(secretKeys)[0];
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceRoleKey || !authorization) return respond({ error: 'Server configuration is incomplete.' }, 500);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: callerResult, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerResult.user) return respond({ error: 'Authentication required.' }, 401);

  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles').select('role').eq('user_id', callerResult.user.id).single();
  if (profileError || callerProfile.role !== 'admin') return respond({ error: 'Administrator access required.' }, 403);

  try {
    const body = await request.json();
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = String(body.full_name || '').trim();
      const section = String(body.section || '').trim();
      const codename = String(body.codename || '').trim().toUpperCase();
      if (!email || password.length < 8 || !fullName || !section || !codename) return respond({ error: 'Provide an email, an eight-character password, and complete student details.' }, 400);
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, section, codename },
      });
      if (error) return respond({ error: error.message }, 400);
      const { error: updateError } = await adminClient.from('profiles').update({
        approved: true,
        registration_source: 'administrator',
        created_by: callerResult.user.id,
      }).eq('user_id', data.user.id);
      if (updateError) {
        await adminClient.auth.admin.deleteUser(data.user.id);
        return respond({ error: 'Student profile could not be created.' }, 500);
      }
      return respond({ success: true });
    }

    if (body.action === 'approve') {
      const userId = String(body.user_id || '');
      const { error } = await adminClient.from('profiles').update({ approved: true }).eq('user_id', userId).eq('role', 'student');
      if (error) return respond({ error: error.message }, 400);
      return respond({ success: true });
    }

    if (body.action === 'delete') {
      const userId = String(body.user_id || '');
      const { data: target, error: targetError } = await adminClient
        .from('profiles').select('role').eq('user_id', userId).single();
      if (targetError || target.role !== 'student') return respond({ error: 'Only student accounts can be deleted here.' }, 403);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) return respond({ error: error.message }, 400);
      return respond({ success: true });
    }

    return respond({ error: 'Unknown action.' }, 400);
  } catch {
    return respond({ error: 'Invalid request.' }, 400);
  }

  function respond(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
