import { captureVisibleTab } from './capture-visible-tab';

export interface GifCaptureOptions {
    tabId: number;
    durationMs: number;
    frameInterval?: number;
    maxWidth?: number;
    maxHeight?: number;
    src?: string;
    rect?: { left: number; top: number; width: number; height: number };
}

export default class GifCapturer {
    private _capturing = false;

    async capture(options: GifCaptureOptions): Promise<string> {
        if (this._capturing) {
            throw new Error('Already capturing GIF');
        }
        this._capturing = true;

        const frameInterval = Math.max(options.frameInterval ?? 500, 500);
        const maxFrames = Math.min(Math.floor(options.durationMs / frameInterval) + 1, 8);

        try {
            const frameDataUrls: string[] = [];

            for (let i = 0; i < maxFrames; i++) {
                try {
                    const dataUrl = await captureVisibleTab(options.tabId);
                    frameDataUrls.push(dataUrl);
                } catch (e) {
                    console.warn('GIF frame capture failed:', e);
                }
                if (i < maxFrames - 1) {
                    await new Promise((r) => setTimeout(r, frameInterval));
                }
            }

            if (frameDataUrls.length === 0) {
                throw new Error('No frames captured');
            }

            // Send frames to content script for encoding (service worker OffscreenCanvas is broken)
            console.log("GIF: sending encode-gif, rect:", options.rect, "to tab", options.tabId, "src:", options.src);
            const response = await browser.tabs.sendMessage(options.tabId, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'encode-gif',
                    frameDataUrls,
                    delay: frameInterval,
                    maxWidth: options.maxWidth ?? 480,
                    maxHeight: options.maxHeight ?? 270,
                    rect: options.rect,
                },
                src: options.src,
            });

            if (!response || !response.gifBase64) {
                throw new Error(response?.error || 'GIF encoding failed');
            }

            return response.gifBase64;
        } finally {
            this._capturing = false;
        }
    }
}
