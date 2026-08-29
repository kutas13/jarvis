import crypto from 'crypto';
import { NextRequest } from 'next/server';

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function constantTimeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function requireBrowserKey(req: NextRequest) {
  const expected = process.env.JARVIS_ACCESS_KEY?.trim();
  if (!expected) throw new Error('JARVIS_ACCESS_KEY eksik.');
  const given = req.headers.get('x-jarvis-key')?.trim() || '';
  return constantTimeEqual(given, expected);
}

export function bearerToken(req: NextRequest) {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
