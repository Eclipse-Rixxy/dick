export const runtime = 'edge';

export async function POST(req) {
  const { query } = await req.json();

  const ANTHROPIC_KEY = process.env.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;
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in environment variables.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: `You are an OSINT analyst embedded in CloudSINT, a professional open-source intelligence platform used by security researchers, journalists, and investigators. Analyze targets and findings with precision. Structure your response using these section headers written in ALL CAPS followed by a colon on their own line: SUMMARY, DIGITAL FOOTPRINT, RECONNAISSANCE VECTORS, RISK ASSESSMENT, RECOMMENDED NEXT STEPS, LEGAL NOTICE. Be concise, professional, and tactical. No markdown, no asterisks, no bullets — plain structured text only. Always end with a legal/ethical notice reminding the user to only conduct OSINT on targets they have authorization to investigate or on public figures.`,
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return new Response(JSON.stringify({ error: err }), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await resp.json();
  const text = data.content.map((c) => c.text || '').join('');
  return new Response(JSON.stringify({ result: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
