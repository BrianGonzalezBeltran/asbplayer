import { Command, Message, AiExplainRequestMessage, AiExplainResult } from '@project/common';
import { CommandHandler } from '../command-handler';

export default class AiExplainHandler implements CommandHandler {
    get sender() {
        return 'asbplayerv2' as string | string[];
    }

    get command() {
        return 'ai-explain-request';
    }

    handle(
        command: Command<Message>,
        _sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ): boolean | undefined {
        const msg = command.message as AiExplainRequestMessage;
        this._handleAsync(msg).then(sendResponse);
        return true;
    }

    private async _handleAsync(msg: AiExplainRequestMessage) {
        try {
            const storage = await chrome.storage.sync.get(['groqApiKey']);
            const apiKey = storage.groqApiKey;

            if (!apiKey) {
                return {
                    command: 'ai-explain-response',
                    messageId: msg.messageId,
                    error: 'No Groq API key configured.',
                };
            }

            const prompt = `You are a language learning assistant. The user is learning "${msg.targetLanguage}" and speaks "${msg.nativeLanguage}". Explain everything in simple English, never use Spanish.

Analyze this subtitle text: "${msg.text}"

Respond in JSON only, no markdown fences, with this exact structure:
{
  "translation": "translation in ${msg.nativeLanguage}",
  "grammar": "brief grammar explanation in ${msg.nativeLanguage} (key structures, tenses, notable patterns)",
  "examples": ["example sentence 1 using a key word/pattern", "example sentence 2"],
  "tip": "one practical learning tip about this text in ${msg.nativeLanguage}",
  "ipa": { "uk": "UK IPA transcription of the full phrase using Cambridge dictionary format e.g. /ˌsaɪ.kəˈdel.ɪk/", "us": "US IPA transcription if different, otherwise same as UK" }
}`;

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
                    max_tokens: 700,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    command: 'ai-explain-response',
                    messageId: msg.messageId,
                    error: `Groq API error (${response.status}): ${errorText.slice(0, 200)}`,
                };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content ?? '';

            let result: AiExplainResult;
            try {
                const cleaned = content.replace(/```json\s*|```/g, '').trim();
                result = JSON.parse(cleaned);
            } catch {
                result = {
                    translation: content,
                    grammar: '',
                    examples: [],
                    tip: '',
                };
            }

            return {
                command: 'ai-explain-response',
                messageId: msg.messageId,
                result,
            };
        } catch (err: any) {
            return {
                command: 'ai-explain-response',
                messageId: msg.messageId,
                error: err.message ?? 'Unknown error',
            };
        }
    }
}
