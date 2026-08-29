function collectOutputText(response: any): string {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const chunks: string[] = [];
  for (const item of response?.output || []) {
    for (const c of item?.content || []) {
      if ((c?.type === 'output_text' || c?.type === 'text') && typeof c?.text === 'string') chunks.push(c.text);
    }
  }
  return chunks.join('\n').trim();
}

export async function openaiResponse(body: any) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY eksik.');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI API hatası (${res.status})`);
  data.__text = collectOutputText(data);
  return data;
}

export function responseText(response: any) {
  return response?.__text || collectOutputText(response) || '';
}
