import { NextRequest, NextResponse } from 'next/server';
import { adminDb, ownerId } from '@/lib/db';
import { constantTimeEqual, randomToken, sha256 } from '@/lib/security';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.JARVIS_PAIRING_SECRET?.trim();
    if (!expected) throw new Error('JARVIS_PAIRING_SECRET eksik.');
    const body = await req.json().catch(() => ({}));
    const secret = String(body?.pairing_secret || '');
    const name = String(body?.name || 'Windows PC').slice(0, 80);
    if (!constantTimeEqual(secret, expected)) return NextResponse.json({ error: 'Eşleştirme anahtarı geçersiz.' }, { status: 401 });

    const token = randomToken(32);
    const db = adminDb();
    const { data, error } = await db.from('devices').insert({
      user_id: ownerId(), name, token_hash: sha256(token), enabled: true, last_seen_at: new Date().toISOString()
    }).select('id,name').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, device: data, device_token: token });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Eşleştirme hatası' }, { status: 500 });
  }
}
