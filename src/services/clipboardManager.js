import Meta from 'gi://Meta';
import St from 'gi://St';
import GLib from 'gi://GLib';

const MAX_CLIP_LENGTH = 100000;

export class ClipboardManager {
    constructor(onNewClip) {
        this._onNewClip = onNewClip;
        this._clipboard = St.Clipboard.get_default();
        this._selection = null;
        this._ownerChangedId = null;
        this._debounceId = null;
        this._pollId = null;
        this._lastText = '';
    }

    setInitialText(text) {
        if (typeof text === 'string')
            this._lastText = text;
    }

    start() {
        this.stop();

        // 1. Connect to Meta.Selection owner-changed event (native, zero-lag, battery-friendly)
        try {
            if (global.display && global.display.get_selection) {
                this._selection = global.display.get_selection();
                if (this._selection) {
                    this._ownerChangedId = this._selection.connect(
                        'owner-changed',
                        (selection, selectionType) => {
                            if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
                                this._queueCheckClipboard();
                            }
                        }
                    );
                }
            }
        } catch (e) {
            console.warn(`[SuperV] Failed to connect to selection owner-changed: ${e.message}`);
        }

        // 2. Perform initial check for any current clipboard contents
        this._checkClipboard();

        // 3. Fallback polling heartbeat for environments where owner-changed may be bypassed
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
            this._checkClipboard();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _queueCheckClipboard(delayMs = 60) {
        if (this._debounceId) {
            GLib.source_remove(this._debounceId);
            this._debounceId = null;
        }

        this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._debounceId = null;
            this._checkClipboard();
            return GLib.SOURCE_REMOVE;
        });
    }

    stop() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = null;
        }

        if (this._debounceId) {
            GLib.source_remove(this._debounceId);
            this._debounceId = null;
        }

        if (this._ownerChangedId && this._selection) {
            try {
                this._selection.disconnect(this._ownerChangedId);
            } catch {}
            this._ownerChangedId = null;
        }

        this._selection = null;
        this._onNewClip = null;
    }

    setText(text) {
        this._lastText = text;
        if (this._clipboard)
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _checkClipboard() {
        if (!this._clipboard || !this._onNewClip)
            return;

        try {
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
                if (!this._onNewClip)
                    return;

                if (!text || typeof text !== 'string' || text === this._lastText || text.trim().length === 0)
                    return;

                const trimmed = text.length > MAX_CLIP_LENGTH ? text.slice(0, MAX_CLIP_LENGTH) : text;
                this._lastText = text;

                try {
                    this._onNewClip(trimmed);
                } catch (e) {
                    console.error(`[SuperV] Error in onNewClip callback: ${e.message}`);
                }
            });
        } catch (e) {
            console.error(`[SuperV] Failed to query clipboard text: ${e.message}`);
        }
    }
}
