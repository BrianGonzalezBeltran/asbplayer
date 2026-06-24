import ImageCapturer from '../../services/image-capturer';
import {
    AudioModel,
    Command,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ScreenshotTakenMessage,
    CardModel,
    AudioErrorCode,
    ImageErrorCode,
    PostMineAction,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { CardPublisher } from '../../services/card-publisher';
import AudioRecorderService, { DrmProtectedStreamError } from '../../services/audio-recorder-service';
import GifCapturer from '../../services/gif-capturer';

export default class RecordMediaHandler {
    private readonly _audioRecorder: AudioRecorderService;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;
    private readonly _settingsProvider: SettingsProvider;
    private readonly _gifCapturer: GifCapturer;

    constructor(
        audioRecorder: AudioRecorderService,
        imageCapturer: ImageCapturer,
        cardPublisher: CardPublisher,
        settingsProvider: SettingsProvider
    ) {
        this._audioRecorder = audioRecorder;
        this._imageCapturer = imageCapturer;
        this._cardPublisher = cardPublisher;
        this._settingsProvider = settingsProvider;
        this._gifCapturer = new GifCapturer();
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'record-media-and-forward-subtitle';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const senderTab = sender.tab!;
        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;
        await this._recordAndForward(recordMediaCommand, sender, senderTab);
    }

    private async _recordAndForward(
        recordMediaCommand: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>,
        sender: Browser.runtime.MessageSender,
        senderTab: Browser.tabs.Tab
    ) {
        const message = recordMediaCommand.message;
        const subtitle = message.subtitle;
        let audioPromise = undefined;
        let imagePromise = undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;
        let encodeAsMp3 = false;

        if (message.record) {
            const time = (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd;

            if (message.postMineAction !== PostMineAction.showAnkiDialog) {
                encodeAsMp3 = await this._settingsProvider.getSingle('preferMp3');
            }

            audioPromise = this._audioRecorder.startWithTimeout(time, encodeAsMp3, {
                src: recordMediaCommand.src,
                tabId: sender.tab?.id!,
            });
        }

        const captureGif = await this._settingsProvider.getSingle('streamingCaptureGif');
        let gifPromise: Promise<string> | undefined = undefined;

        if (message.screenshot && captureGif && message.record) {
            // Start GIF capture in parallel with audio — video is playing right now
            const durationMs = Math.min(
                (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd * 1000,
                10000
            );
            gifPromise = this._gifCapturer.capture({
                tabId: senderTab.id!,
                durationMs,
                frameInterval: 500,
                maxWidth: 720,
                maxHeight: 405,
                rect: message.rect,
                src: recordMediaCommand.src,
            });
            gifPromise.finally(() => {
                const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: { command: 'screenshot-taken' },
                    src: recordMediaCommand.src,
                };
                browser.tabs.sendMessage(senderTab.id!, screenshotTakenCommand);
            });
        }

        if (message.screenshot && !captureGif) {
            const { maxWidth, maxHeight, rect, frameId } = message;
            const screenshotDelay = Math.max(
                0,
                message.record
                    ? message.mediaTimestamp - subtitle.start + message.audioPaddingStart
                    : message.imageDelay
            );
            imagePromise = this._imageCapturer.capture(senderTab.id!, recordMediaCommand.src, screenshotDelay, {
                maxWidth,
                maxHeight,
                rect,
                frameId,
            });
            imagePromise.finally(() => {
                const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'screenshot-taken',
                    },
                    src: recordMediaCommand.src,
                };
                browser.tabs.sendMessage(senderTab.id!, screenshotTakenCommand);
            });
        }

        // Wait for audio to finish first
        if (audioPromise) {
            const { audioPaddingStart: paddingStart, audioPaddingEnd: paddingEnd, playbackRate } = message;
            const baseAudioModel: AudioModel = {
                base64: '',
                extension: encodeAsMp3 ? 'mp3' : 'webm',
                paddingStart,
                paddingEnd,
                playbackRate,
            };

            try {
                const audioBase64 = await audioPromise;
                audioModel = {
                    ...baseAudioModel,
                    base64: audioBase64,
                };
            } catch (e) {
                if (!(e instanceof DrmProtectedStreamError)) {
                    throw e;
                }

                audioModel = {
                    ...baseAudioModel,
                    error: AudioErrorCode.drmProtected,
                };
            }
        }

        // GIF: capture was started before audio, now wait for it
        if (gifPromise) {
            try {
                const gifBase64 = await gifPromise;
                imageModel = {
                    base64: gifBase64,
                    extension: 'webm',
                };
            } catch (e) {
                console.error('GIF capture failed:', e);
                imageModel = {
                    base64: '',
                    extension: 'jpeg',
                    error: ImageErrorCode.captureFailed,
                };
            }
        } else if (imagePromise) {
            try {
                await imagePromise;

                imageModel = {
                    base64: this._imageCapturer.lastImageBase64!,
                    extension: 'jpeg',
                };
            } catch (e) {
                console.error(e);
                imageModel = {
                    base64: '',
                    extension: 'jpeg',
                    error: ImageErrorCode.captureFailed,
                };
            }
        }

        const { isBulkExport, ...messageWithoutBulkFlag } = message;
        const card: CardModel = {
            image: imageModel,
            audio: audioModel,
            ...messageWithoutBulkFlag,
        };

        if (isBulkExport) {
            this._cardPublisher.publishBulk(card, senderTab.id!, recordMediaCommand.src);
        } else {
            this._cardPublisher.publish(card, message.postMineAction, senderTab.id!, recordMediaCommand.src);
        }
    }
}
