import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClipboardHistoryPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'edit-copy-symbolic',
        });

        // 1. Behavior Group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior & Integration'),
            description: _('Configure clipboard history behavior and auto-paste interaction'),
        });

        // Auto-paste Switch
        const autoPasteRow = new Adw.SwitchRow({
            title: _('Auto-Paste on Selection'),
            subtitle: _('Automatically paste the selected clip into the active window'),
        });
        settings.bind('auto-paste', autoPasteRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(autoPasteRow);

        // Paste Mode Combo
        const pasteModeOptions = [
            ['auto', _('Auto-detect (Ctrl+Shift+V for terminals, Ctrl+V for GUI)')],
            ['ctrl-v', _('Standard (Ctrl+V)')],
            ['ctrl-shift-v', _('Terminal mode (Ctrl+Shift+V)')],
            ['shift-insert', _('Universal (Shift+Insert)')],
        ];

        const pasteModeList = new Gtk.StringList();
        pasteModeOptions.forEach(opt => pasteModeList.append(opt[1]));

        const currentPasteMode = settings.get_string('paste-mode') || 'auto';
        let initialPasteIdx = pasteModeOptions.findIndex(opt => opt[0] === currentPasteMode);
        if (initialPasteIdx === -1)
            initialPasteIdx = 0;

        const pasteModeRow = new Adw.ComboRow({
            title: _('Paste Shortcut Mode'),
            subtitle: _('Shortcut simulated when inserting clips'),
            model: pasteModeList,
            selected: initialPasteIdx,
        });
        pasteModeRow.connect('notify::selected', (row) => {
            const idx = row.get_selected();
            if (idx >= 0 && idx < pasteModeOptions.length) {
                settings.set_string('paste-mode', pasteModeOptions[idx][0]);
            }
        });
        behaviorGroup.add(pasteModeRow);

        // Paste Delay SpinRow
        const pasteDelayRow = new Adw.SpinRow({
            title: _('Paste Activation Delay'),
            subtitle: _('Delay in ms before injecting keypress to allow window focus transition (50-500ms)'),
            adjustment: new Gtk.Adjustment({
                lower: 50,
                upper: 500,
                step_increment: 25,
                page_increment: 50,
                value: settings.get_int('paste-delay') || 150,
            }),
        });
        pasteDelayRow.connect('notify::value', () => {
            settings.set_int('paste-delay', pasteDelayRow.get_value_as_int());
        });
        behaviorGroup.add(pasteDelayRow);

        // Save history Switch
        const saveHistoryRow = new Adw.SwitchRow({
            title: _('Persist History Across Sessions'),
            subtitle: _('Save clipboard history and pinned items to disk'),
        });
        settings.bind('save-history', saveHistoryRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(saveHistoryRow);

        // Max history size SpinRow
        const historySizeRow = new Adw.SpinRow({
            title: _('Max History Items'),
            subtitle: _('Maximum number of unpinned items to store (10-200)'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 200,
                step_increment: 5,
                page_increment: 10,
                value: settings.get_int('history-size') || 50,
            }),
        });
        historySizeRow.connect('notify::value', () => {
            settings.set_int('history-size', historySizeRow.get_value_as_int());
        });
        behaviorGroup.add(historySizeRow);

        page.add(behaviorGroup);

        // 2. Appearance & Position Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance & Position'),
            description: _('Configure where the clipboard popup appears'),
        });

        const positionOptions = [
            ['cursor', _('Near Mouse Cursor')],
            ['center', _('Screen Center')],
            ['bottom-right', _('Bottom Right (Windows-style)')],
        ];

        const positionList = new Gtk.StringList();
        positionOptions.forEach(opt => positionList.append(opt[1]));

        const currentPos = settings.get_string('position-mode') || 'cursor';
        let initialPosIdx = positionOptions.findIndex(opt => opt[0] === currentPos);
        if (initialPosIdx === -1)
            initialPosIdx = 0;

        const positionRow = new Adw.ComboRow({
            title: _('Popup Position'),
            subtitle: _('Where the clipboard history window should pop up'),
            model: positionList,
            selected: initialPosIdx,
        });

        positionRow.connect('notify::selected', (row) => {
            const idx = row.get_selected();
            if (idx >= 0 && idx < positionOptions.length) {
                settings.set_string('position-mode', positionOptions[idx][0]);
            }
        });
        appearanceGroup.add(positionRow);

        page.add(appearanceGroup);

        // 3. Storage Management Group
        const storageGroup = new Adw.PreferencesGroup({
            title: _('Storage Management'),
        });

        const clearHistoryRow = new Adw.ActionRow({
            title: _('Clear Clipboard History File'),
            subtitle: _('Delete saved history on disk (pinned items in active session are kept)'),
        });

        const clearButton = new Gtk.Button({
            label: _('Clear Data'),
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });

        clearButton.connect('clicked', () => {
            try {
                const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'superv']);
                const file = Gio.File.new_for_path(GLib.build_filenamev([configDir, 'history.json']));
                if (file.query_exists(null))
                    file.delete(null);
            } catch (e) {
                console.error(`[SuperV] Failed to clear history file: ${e.message}`);
            }
        });

        clearHistoryRow.add_suffix(clearButton);
        storageGroup.add(clearHistoryRow);

        page.add(storageGroup);

        // 4. Keyboard Shortcut Group
        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcut'),
            description: _('Choose the shortcut used to summon the clipboard flyout. Dismiss with Esc or clicking outside.'),
        });

        const shortcutOptions = [
            ['<Super>v', _('Super + V (Windows default)')],
            ['<Super><Shift>v', _('Super + Shift + V')],
            ['<Primary><Alt>v', _('Ctrl + Alt + V')],
            ['<Super>c', _('Super + C')],
        ];

        const shortcutList = new Gtk.StringList();
        shortcutOptions.forEach(opt => shortcutList.append(opt[1]));

        const currentShortcuts = settings.get_strv('toggle-clipboard-history');
        const currentPrimaryShortcut = currentShortcuts.length > 0 ? currentShortcuts[0] : '<Super>v';
        let initialShortcutIdx = shortcutOptions.findIndex(opt => opt[0].toLowerCase() === currentPrimaryShortcut.toLowerCase());
        if (initialShortcutIdx === -1)
            initialShortcutIdx = 0;

        const shortcutRow = new Adw.ComboRow({
            title: _('Activation Shortcut'),
            subtitle: _('Press this key combination anywhere on your desktop to toggle SuperV'),
            model: shortcutList,
            selected: initialShortcutIdx,
        });

        shortcutRow.connect('notify::selected', (row) => {
            const idx = row.get_selected();
            if (idx >= 0 && idx < shortcutOptions.length) {
                settings.set_strv('toggle-clipboard-history', [shortcutOptions[idx][0]]);
            }
        });
        shortcutGroup.add(shortcutRow);

        page.add(shortcutGroup);

        window.add(page);
    }
}
