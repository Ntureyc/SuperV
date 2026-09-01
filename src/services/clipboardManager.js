import St from 'gi://St';
import GLib from 'gi://GLib';

export class ClipboardManager {
    constructor(onNewClip) {
        this._onNewClip = onNewClip;
        this._clipboard = St.Clipboard.get_default();
        this._pollId = null;
        this._lastText = '';
    }

    start(intervalMs = 500) {
        this.stop();
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            this._checkClipboard();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = null;
        }
    }

    setText(text) {
        this._lastText = text;
        if (this._clipboard)
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _checkClipboard() {
        if (!this._clipboard)
            return;

        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (!text || text === this._lastText || text.trim().length === 0)
                return;

            this._lastText = text;
            if (this._onNewClip)
                this._onNewClip(text);
        });
    }
}
