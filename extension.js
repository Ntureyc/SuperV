import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DefaultSettings, PasteMode} from './src/constants.js';
import {StorageService} from './src/services/storage.js';
import {ClipboardManager} from './src/services/clipboardManager.js';
import {Paster} from './src/utils/paster.js';
import {SuperVPopup} from './src/ui/popup.js';

export default class SuperVExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._targetWindow = null;
        this._pasteTimeoutId = null;

        // 1. Services
        this._storage = new StorageService();
        const saveHistory = this._settings.get_boolean('save-history');
        if (saveHistory)
            this._storage.load();

        this._paster = new Paster();

        this._clipboard = new ClipboardManager((text) => {
            const maxHistory = this._settings.get_int('history-size') || DefaultSettings.HISTORY_SIZE;
            this._storage.addItem(text, maxHistory);
            if (this._popup && this._popup.isOpen()) {
                this._popup.updateCounts();
                this._popup.renderEntries();
            }
        });
        this._clipboard.start();

        // 2. UI Popup
        this._popup = new SuperVPopup({
            storage: this._storage,
            clipboard: this._clipboard,
            settings: this._settings,
            onSelect: (text) => this._handleSelectClip(text),
        });

        // 3. Register Global Shortcut (Super+V)
        Main.wm.addKeybinding(
            'toggle-clipboard-history',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._togglePopup()
        );
    }

    _togglePopup() {
        if (this._popup.isOpen()) {
            this._popup.close();
            return;
        }

        // Capture currently focused window before opening flyout
        this._targetWindow = global.display.focus_window;
        this._popup.open();
    }

    _handleSelectClip(text) {
        this._clipboard.setText(text);
        this._popup.close();

        const autoPaste = this._settings.get_boolean('auto-paste');
        if (!autoPaste)
            return;

        if (this._pasteTimeoutId) {
            GLib.source_remove(this._pasteTimeoutId);
            this._pasteTimeoutId = null;
        }

        const pasteDelay = this._settings.get_int('paste-delay') || DefaultSettings.PASTE_DELAY;
        const pasteMode = this._settings.get_string('paste-mode') || PasteMode.AUTO;

        this._pasteTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, pasteDelay, () => {
            this._pasteTimeoutId = null;
            this._paster.paste(this._targetWindow, pasteMode);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        Main.wm.removeKeybinding('toggle-clipboard-history');

        if (this._pasteTimeoutId) {
            GLib.source_remove(this._pasteTimeoutId);
            this._pasteTimeoutId = null;
        }

        if (this._clipboard) {
            this._clipboard.stop();
            this._clipboard = null;
        }

        if (this._popup) {
            this._popup.close();
            this._popup = null;
        }

        this._paster = null;
        this._storage = null;
        this._settings = null;
        this._targetWindow = null;
    }
}
