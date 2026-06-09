import { Command, Message, AiTopPhrasesRequestMessage, AiTopPhrase } from '@project/common';
import { CommandHandler } from '../command-handler';

export default class AiTopPhrasesHandler implements CommandHandler {
    get sender() {
        return 'asbplayerv2' as string | string[];
    }

    get command() {
        return 'ai-top-phrases-request';
    }

    handle(
        command: Command<Message>,
        _sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ): boolean | undefined {
        const msg = command.message as AiTopPhrasesRequestMessage;
        this._handleAsync(msg).then(sendResponse);
        return true;
    }

    private async _handleAsync(msg: AiTopPhrasesRequestMessage) {
        try {
            const storage = await chrome.storage.sync.get(['groqApiKey']);
            const apiKey = storage.groqApiKey;

            if (!apiKey) {
                return {
                    command: 'ai-top-phrases-response',
                    error: 'No Groq API key configured.',
                };
            }

            const prompt = `You are an expert English language tutor specializing in intermediate-to-advanced learners. Your student speaks Spanish and already understands basic English grammar and vocabulary. They do NOT need help with simple structures.

Here is the full transcript of a video they watched. Each line has a timestamp and the subtitle text:

${msg.transcript}

Select the TOP 10 most valuable phrases from this transcript. Apply these strict criteria:

MUST INCLUDE (prioritize in this order):
1. Idiomatic expressions and fixed phrases (e.g. "to save your life", "making a federal case out of this", "raise the bar") — these are the #1 priority because they cannot be deduced from individual word meanings
2. Phrasal verbs in natural context (e.g. "screwed it up", "hold onto", "turn out")
3. Natural collocations that sound native (e.g. "perfectly good", "a stitch", "not a drop of")
4. Culturally embedded expressions, sarcasm, or humor patterns that a non-native would miss
5. Useful conversational formulas for expressing emotions, opinions, promises, or complaints in a natural way

MUST EXCLUDE:
- Phrases too simple for an intermediate learner (e.g. "It's not healthy", "I need an event")
- Phrases that are only meaningful with heavy visual/plot context and don't transfer to real conversations
- Song lyrics or theme song lines
- Phrases where the grammar pattern is the only interesting thing but the expression itself is generic
- Two phrases containing the same idiom or core expression (e.g. if you pick "to save your life" as an idiom, don't also pick a longer sentence that contains it — choose the most natural standalone usage)
- Phrases a Spanish speaker would naturally produce correctly by translating from Spanish (e.g. "to keep her from the truth" ≈ "mantenerla lejos de la verdad" — too direct a mapping)

BONUS POINTS for:
- Expressions with NO direct Spanish equivalent (e.g. "That's just crazy enough to work", "You're worrying about nothing", "Way to raise the bar")
- Sarcasm, understatement, or humor that only works in English
- Filler/softener patterns native speakers use unconsciously (e.g. "I guess", "kind of", "come on")
- Promises, reassurances, and emotional formulas that sound stiff when translated from Spanish
- Complete natural sentences over isolated phrasal verbs — prefer "Everything he says is a stitch" over just "a stitch", prefer "You're worrying about nothing" over just "worrying about"

CRITICAL FILTER — ask yourself for each candidate:
- "Would a B2-level Spanish speaker already produce this naturally?" If YES, skip it. (e.g. "hold onto" = "agarrarse de", "nature's way" = "la forma de la naturaleza" — too transparent)
- "Does this phrase teach something you can REUSE in other conversations?" If NO, skip it.
- Prefer full utterances that model natural speech rhythm over fragments

For "why": explain in 1 sentence what makes this phrase special — focus on what a Spanish speaker would NOT intuitively understand or produce. Do not explain basic grammar.

Respond in JSON only, no markdown fences:
[
  { "phrase": "exact subtitle text", "timestamp": "MM:SS", "why": "why this is valuable — focus on the idiomatic/cultural/collocational insight" }
]

Return exactly 10 items. Most valuable first.`;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 2000,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    command: 'ai-top-phrases-response',
                    error: `Groq API error (${response.status}): ${errorText.slice(0, 200)}`,
                };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content ?? '';

            let result: AiTopPhrase[];
            try {
                const cleaned = content.replace(/```json\s*|```/g, '').trim();
                result = JSON.parse(cleaned);
            } catch {
                return {
                    command: 'ai-top-phrases-response',
                    error: 'Failed to parse AI response',
                };
            }

            return {
                command: 'ai-top-phrases-response',
                result,
            };
        } catch (err: any) {
            return {
                command: 'ai-top-phrases-response',
                error: err.message ?? 'Unknown error',
            };
        }
    }
}
