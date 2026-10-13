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
  if (!url || !serviceRoleKey) return respond({ error: 'Server configuration is incomplete.' }, 500);
  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const body = await request.json();
    if (body.action === 'student-register') {
      const fullName = String(body.full_name || '').trim().replace(/\s+/g, ' ');
      const section = String(body.section || '').trim().replace(/\s+/g, ' ');
      const codename = String(body.codename || '').trim().toUpperCase();
      if (!/^\p{L}+(?:\s+\p{L}+)*$/u.test(fullName) || !section || section.length > 80 || !/^[A-Z0-9-]{3,32}$/.test(codename)) {
        return respond({ error: 'Enter a valid full name, section, and codename.' }, 400);
      }
      const { data: existing, error: lookupError } = await adminClient.from('profiles').select('user_id').eq('codename', codename).maybeSingle();
      if (lookupError) return respond({ error: 'Registration could not be checked.' }, 500);
      if (existing) return respond({ error: 'That codename is already registered.' }, 409);

      const email = `student-${crypto.randomUUID()}@students.cbam2b.example.com`;
      const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, section, codename },
      });
      if (error) return respond({ error: 'Registration could not be created.' }, 400);
      const { data: student, error: profileError } = await adminClient.from('profiles')
        .update({ approved: true, registration_source: 'student' })
        .eq('user_id', created.user.id)
        .select('user_id,full_name,section,codename,approved,registration_source')
        .single();
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return respond({ error: 'Registration was created but could not be activated. Please try again.' }, 500);
      }
      return respond({ success: true, student: { id: student.user_id, name: student.full_name, section: student.section, code: student.codename, approved: student.approved, registeredBy: student.registration_source }, grades: [] });
    }

    if (body.action === 'student-login') {
      const codename = String(body.codename || '').trim().toUpperCase();
      const section = String(body.section || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!/^[A-Z0-9-]{3,32}$/.test(codename) || !section) return respond({ error: 'Enter your codename and section.' }, 400);
      const { data: student, error } = await adminClient.from('profiles')
        .select('user_id,full_name,section,codename,approved,registration_source')
        .eq('codename', codename).eq('role', 'student').maybeSingle();
      if (error) return respond({ error: 'Student record could not be checked.' }, 500);
      if (!student || student.section.trim().replace(/\s+/g, ' ').toLowerCase() !== section) {
        return respond({ error: 'No student matches that codename and section.' }, 401);
      }
      if (!student.approved) return respond({ error: 'Your registration is awaiting administrator approval.' }, 403);
      const { data: grades, error: gradeError } = await adminClient.from('grades').select('*').eq('student_id', student.user_id);
      if (gradeError) return respond({ error: 'Grades could not be loaded.' }, 500);
      return respond({
        student: { id: student.user_id, name: student.full_name, section: student.section, code: student.codename, approved: student.approved, registeredBy: student.registration_source },
        grades: grades.map(grade => ({ ...grade, studentId: student.user_id, student: student.full_name, section: student.section, code: student.codename })),
      });
    }

    if (!authorization || !anonKey) return respond({ error: 'Authentication required.' }, 401);
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: callerResult, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerResult.user) return respond({ error: 'Authentication required.' }, 401);
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles').select('role').eq('user_id', callerResult.user.id).single();
    if (profileError || callerProfile.role !== 'admin') return respond({ error: 'Administrator access required.' }, 403);

    if (body.action === 'create') {
      const fullName = String(body.full_name || '').trim().replace(/\s+/g, ' ');
      const section = String(body.section || '').trim().replace(/\s+/g, ' ');
      const codename = String(body.codename || '').trim().toUpperCase();
      if (!/^\p{L}+(?:\s+\p{L}+)*$/u.test(fullName) || !section || section.length > 80 || !/^[A-Z0-9-]{3,32}$/.test(codename)) {
        return respond({ error: 'Enter a valid full name, section, and codename.' }, 400);
      }
      const { data: existing, error: lookupError } = await adminClient.from('profiles').select('user_id').eq('codename', codename).maybeSingle();
      if (lookupError) return respond({ error: 'Student record could not be checked.' }, 500);
      if (existing) return respond({ error: 'That codename is already registered.' }, 409);

      const email = `admin-created-${crypto.randomUUID()}@students.cbam2b.example.com`;
      const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, section, codename },
      });
      if (error) return respond({ error: `Student account could not be created: ${error.message}` }, 400);
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
