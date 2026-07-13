import { supabase } from './supabase';

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      entity,
      entity_id: entityId,
      details: details ?? null,
    });
  } catch {
    // silent — audit logging is best-effort
  }
}
