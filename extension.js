import Gio from 'gi://Gio';
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

const SHELL_KEYBINDINGS_SCHEMA = 'org.gnome.shell.keybindings';

export default class SuperVExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._targetWindow = null;
        this._pasteTimeoutId = null;
        this._startupCompleteId = null;
        this._settingsChangedId = null;
        this._saveHistoryChangedId = null;

        // 1. Services
        const saveHistory = this._settings.get_boolean('save-history');
        this._storage = new StorageService(saveHistory);
        if (saveHistory)
            this._storage.load();

        this._paster = new Paster();

        this._clipboard = new ClipboardManager((text) => {
            if (!this._settings || !this._storage)
                return;
            const maxHistory = this._settings.get_int('history-size') || DefaultSettings.HISTORY_SIZE;
            this._storage.addItem(text, maxHistory);
            if (this._popup && this._popup.isOpen()) {
                this._popup.updateCounts();
                this._popup.renderEntries();
            }
        });

        if (saveHistory)
            this._clipboard.setInitialText(this._storage.getLatestText());

        this._clipboard.start();

        // 2. UI Popup
        this._popup = new SuperVPopup({
            storage: this._storage,
            clipboard: this._clipboard,
            settings: this._settings,
            onSelect: (text) => this._handleSelectClip(text),
        });

        // 3. Register Global Shortcut with conflict resolution & boot timing resilience
        this._bindShortcut();

        if (Main.layoutManager && Main.layoutManager._startingUp) {
            this._startupCompleteId = Main.layoutManager.connect('startup-complete', () => {
                if (this._startupCompleteId) {
                    Main.layoutManager.disconnect(this._startupCompleteId);
                    this._startupCompleteId = null;
                }
                this._bindShortcut();
            });
        }

        // Listen for setting changes
        this._settingsChangedId = this._settings.connect(
            'changed::toggle-clipboard-history',
            () => this._bindShortcut()
        );

        this._saveHistoryChangedId = this._settings.connect(
            'changed::save-history',
            () => {
                const save = this._settings ? this._settings.get_boolean('save-history') : true;
                if (this._storage)
                    this._storage.setSaveHistory(save);
            }
        );
    }

    _resolveKeybindingConflicts() {
        try {
            const shellSettings = new Gio.Settings({schema_id: SHELL_KEYBINDINGS_SCHEMA});
            const trayBindings = shellSettings.get_strv('toggle-message-tray');
            const hasSuperV = trayBindings.some(b => b.toLowerCase().replace(/\s+/g, '') === '<super>v');

            if (hasSuperV) {
                const filtered = trayBindings.filter(b => b.toLowerCase().replace(/\s+/g, '') !== '<super>v');
                shellSettings.set_strv('toggle-message-tray', filtered);
                this._modifiedMessageTrayBindings = true;
            }
        } catch (e) {
            console.error(`[SuperV] Failed to resolve keybinding conflicts: ${e.message}`);
        }
    }

    _bindShortcut() {
        this._resolveKeybindingConflicts();

        Main.wm.removeKeybinding('toggle-clipboard-history');

        const action = Main.wm.addKeybinding(
            'toggle-clipboard-history',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.ALL,
            () => this._togglePopup()
        );

        if (action === Meta.KeyBindingAction.NONE) {
            console.warn('[SuperV] Failed to bind toggle-clipboard-history shortcut');
        }
    }

    _togglePopup() {
        if (!this._popup || (Main.sessionMode && Main.sessionMode.isLocked))
            return;

        if (this._popup.isOpen()) {
            this._popup.close();
            return;
        }

        // Capture currently focused window before opening flyout
        this._targetWindow = global.display ? global.display.focus_window : null;
        this._popup.open();
    }

    _handleSelectClip(text) {
        if (this._clipboard)
            this._clipboard.setText(text);
        if (this._popup)
            this._popup.close();

        if (!this._settings)
            return;

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
            if (this._paster)
                this._paster.paste(this._targetWindow, pasteMode);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        if (this._startupCompleteId) {
            try {
                Main.layoutManager.disconnect(this._startupCompleteId);
            } catch {}
            this._startupCompleteId = null;
        }

        if (this._settingsChangedId) {
            try {
                this._settings.disconnect(this._settingsChangedId);
            } catch {}
            this._settingsChangedId = null;
        }

        if (this._saveHistoryChangedId) {
            try {
                this._settings.disconnect(this._saveHistoryChangedId);
            } catch {}
            this._saveHistoryChangedId = null;
        }

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

        if (this._paster) {
            this._paster.destroy();
            this._paster = null;
        }

        this._storage = null;
        this._settings = null;
        this._targetWindow = null;
    }
}
