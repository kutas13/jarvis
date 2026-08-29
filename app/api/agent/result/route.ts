import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db';
import { bearerToken, sha256 } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = adminDb();
    const { data: device } = await db.from('devices').select('id').eq('token_hash', sha256(token)).eq('enabled', true).maybeSingle();
    if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = String(body?.id || '');
    const ok = Boolean(body?.ok);
    const result = String(body?.result ?? '').slice(0, 12000);
    if (!id) return NextResponse.json({ error: 'Komut id eksik.' }, { status: 400 });

    const { error } = await db.from('device_commands').update({
      status: ok ? 'completed' : 'failed', result, completed_at: new Date().toISOString()
    }).eq('id', id).eq('device_id', device.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Agent result hatası' }, { status: 500 });
  }
}
