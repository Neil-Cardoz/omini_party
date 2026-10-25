import type { EventType } from '@celebraitions/shared';

export interface CreativeRequest {
  eventType: EventType;
  partyName: string;
  prompt: string;
  vibe?: string | undefined;
  guestCount?: number | undefined;
  budgetTier?: string | undefined;
}

export interface CreativeResponse {
  source: 'offline' | 'claude';
  text: string;
  ideas: string[];
}

const fallbackIdeas: Record<EventType, string[]> = {
  wedding: ['A welcome table with a handwritten note for every family group', 'One signature drink named after the couple', 'A quiet photo corner with a prompt guests can answer'],
  birthday: ['A one-song spotlight for the birthday person', 'A tiny take-home favor that doubles as a place card', 'A guest activity that creates a keepsake instead of clutter'],
  community: ['A volunteer welcome crew with visible color-coded badges', 'A local maker table that tells the neighborhood story', 'A simple waste-sorting station with friendly signs'],
  graduation: ['A memory wall with one sentence from each guest', 'A future-self toast to open the evening', 'A photo prompt that captures what comes next'],
  corporate: ['A short gratitude round before the formal agenda', 'A table prompt that gets people talking beyond job titles', 'A closing ritual that makes the milestone feel real'],
  'baby-shower': ['A wishes-for-the-future card station', 'A soft, low-pressure game guests can join from their seats', 'A practical favor parents will actually use'],
  other: ['A welcome ritual that gives everyone a way in', 'One sensory detail repeated through the room', 'A final note guests can take home'],
};

function fallback(request: CreativeRequest): CreativeResponse {
  const ideas = fallbackIdeas[request.eventType];
  const context = request.vibe ? ` with a ${request.vibe.toLowerCase()} feeling` : '';
  return {
    source: 'offline',
    text: `For ${request.partyName || 'your celebration'}${context}, keep the creative choices focused on one memorable welcome, one shared moment and one small detail guests can carry with them.`,
    ideas,
  };
}

export async function generateCreativeResponse(request: CreativeRequest): Promise<CreativeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback(request);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
        max_tokens: 500,
        system: 'You are celebrAItions, an event planning assistant. Give practical, warm, event-planning ideas only. Never invent prices, dates, availability or legal advice. Return JSON with text and ideas (an array of 3 short strings).',
        messages: [{ role: 'user', content: JSON.stringify(request) }],
      }),
    });
    if (!response.ok) return fallback(request);
    const payload = await response.json() as { content?: Array<{ text?: string }> };
    const raw = payload.content?.[0]?.text;
    if (!raw) return fallback(request);
    const parsed = JSON.parse(raw) as { text?: unknown; ideas?: unknown };
    if (typeof parsed.text !== 'string' || !Array.isArray(parsed.ideas) || parsed.ideas.some((idea) => typeof idea !== 'string')) return fallback(request);
    return { source: 'claude', text: parsed.text, ideas: parsed.ideas.slice(0, 5) as string[] };
  } catch {
    return fallback(request);
  } finally {
    clearTimeout(timeout);
  }
}

export { fallback as fallbackCreativeResponse };
