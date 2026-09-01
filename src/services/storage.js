import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {detectContentType} from '../utils/contentType.js';
import {DefaultSettings} from '../constants.js';

export class StorageService {
    constructor() {
        this._history = [];
        this._configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'superv']);
        this._historyFile = GLib.build_filenamev([this._configDir, 'history.json']);
        this._ensureConfigDir();
        this._migrateOldConfig();
    }

    _ensureConfigDir() {
        try {
            GLib.mkdir_with_parents(this._configDir, 0o755);
        } catch {}
    }

    _migrateOldConfig() {
        try {
            const newFile = Gio.File.new_for_path(this._historyFile);
            const oldFile = Gio.File.new_for_path(
                GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-clipboard-history', 'history.json'])
            );

            if (!newFile.query_exists(null) && oldFile.query_exists(null)) {
                oldFile.copy(newFile, Gio.FileCopyFlags.NONE, null, null);
            }
        } catch {}
    }

    getHistory() {
        return this._history;
    }

    load() {
        try {
            const file = Gio.File.new_for_path(this._historyFile);
            if (!file.query_exists(null)) {
                this._history = [];
                return this._history;
            }

            const [, contents] = file.load_contents(null);
            const decoder = new TextDecoder('utf-8');
            const data = JSON.parse(decoder.decode(contents));

            if (Array.isArray(data)) {
                this._history = data.map(item => ({
                    id: item.id || GLib.uuid_string_random(),
                    text: item.text || '',
                    pinned: !!item.pinned,
                    timestamp: item.timestamp || Date.now(),
                    type: item.type || detectContentType(item.text || ''),
                }));
            } else {
                this._history = [];
            }
        } catch (e) {
            console.error(`[SuperV] Failed to load history: ${e.message}`);
            this._history = [];
        }

        return this._history;
    }

    save() {
        try {
            const encoder = new TextEncoder();
            const data = JSON.stringify(this._history, null, 2);
            GLib.file_set_contents(this._historyFile, encoder.encode(data));
        } catch (e) {
            console.error(`[SuperV] Failed to save history: ${e.message}`);
        }
    }

    addItem(text, maxHistory = DefaultSettings.HISTORY_SIZE) {
        if (!text || typeof text !== 'string')
            return null;

        const existingIndex = this._history.findIndex(item => item.text === text);
        let pinned = false;
        let id = GLib.uuid_string_random();

        if (existingIndex !== -1) {
            pinned = this._history[existingIndex].pinned;
            id = this._history[existingIndex].id;
            this._history.splice(existingIndex, 1);
        }

        const newItem = {
            id,
            text,
            pinned,
            timestamp: Date.now(),
            type: detectContentType(text),
        };

        // Insert at the top
        this._history.unshift(newItem);

        // Prune unpinned items beyond limit
        const unpinned = this._history.filter(item => !item.pinned);
        if (unpinned.length > maxHistory) {
            for (let i = this._history.length - 1; i >= 0; i--) {
                if (!this._history[i].pinned) {
                    this._history.splice(i, 1);
                    break;
                }
            }
        }

        this.save();
        return newItem;
    }

    togglePin(id) {
        const item = this._history.find(i => i.id === id);
        if (item) {
            item.pinned = !item.pinned;
            this.save();
            return item;
        }
        return null;
    }

    deleteItem(id) {
        const index = this._history.findIndex(i => i.id === id);
        if (index !== -1) {
            this._history.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    clearUnpinned() {
        this._history = this._history.filter(item => item.pinned);
        this.save();
    }

    clearAll() {
        this._history = [];
        try {
            const file = Gio.File.new_for_path(this._historyFile);
            if (file.query_exists(null))
                file.delete(null);
        } catch {}
    }
}
