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
            description: _('Configure clipboard history behavior and interaction'),
        });

        // Auto-paste Switch
        const autoPasteRow = new Adw.SwitchRow({
            title: _('Auto-Paste on Click'),
            subtitle: _('Automatically paste the selected clip into the active window (Ctrl+V)'),
        });
        settings.bind('auto-paste', autoPasteRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(autoPasteRow);

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
                value: settings.get_int('history-size'),
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

        const stringList = new Gtk.StringList();
        positionOptions.forEach(opt => stringList.append(opt[1]));

        const currentPos = settings.get_string('position-mode') || 'cursor';
        let initialIndex = positionOptions.findIndex(opt => opt[0] === currentPos);
        if (initialIndex === -1)
            initialIndex = 0;

        const positionRow = new Adw.ComboRow({
            title: _('Popup Position'),
            subtitle: _('Where the clipboard history window should pop up'),
            model: stringList,
            selected: initialIndex,
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
                console.error(`Failed to clear history file: ${e.message}`);
            }
        });

        clearHistoryRow.add_suffix(clearButton);
        storageGroup.add(clearHistoryRow);

        page.add(storageGroup);

        // 4. About & Shortcut Info Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcut'),
            description: _('Default shortcut is Super+V (Windows-style). Dismiss with Esc or clicking outside.'),
        });

        const shortcutRow = new Adw.ActionRow({
            title: _('Default Shortcut'),
            subtitle: _('Super+V (Win+V)'),
        });
        aboutGroup.add(shortcutRow);

        page.add(aboutGroup);

        window.add(page);
    }
}
