import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Pango from 'gi://Pango';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function detectContentType(text) {
    if (!text)
        return 'text';

    const trimmed = text.trim();

    // Hex Color code
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i.test(trimmed))
        return 'color';

    // URL
    if (/^(https?|ftp|file):\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed))
        return 'url';

    // Code snippet detection
    const codeIndicators = [
        '{', '}', '=>', ';', '</', '/>', 'const ', 'let ', 'var ',
        'function', 'class ', 'def ', 'import ', 'export ', 'return ',
        'public ', 'private ', 'namespace', 'if (', 'for (', 'while (',
        'async ', 'await ', 'console.log', '#include', '<?php'
    ];
    if (trimmed.includes('\n') || codeIndicators.some(k => trimmed.includes(k)))
        return 'code';

    return 'text';
}

function formatRelativeTime(timestamp) {
    if (!timestamp)
        return '';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 30)
        return 'Just now';
    if (diff < 60)
        return `${diff}s ago`;
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default class SuperVExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._history = [];
        this._lastText = '';
        this._popup = null;
        this._grab = null;
        this._activeTab = 'all'; // 'all' | 'pinned'
        this._searchQuery = '';
        this._selectedIndex = -1;
        this._cardButtons = [];

        this._loadHistory();

        // Register Global Keybinding (default: Super+V)
        Main.wm.addKeybinding(
            'toggle-clipboard-history',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._togglePopup()
        );

        this._clipboard = St.Clipboard.get_default();

        // Clipboard Poller (500ms interval)
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._checkClipboard();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _getStorageFile() {
        const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'superv']);
        GLib.mkdir_with_parents(configDir, 0o755);
        const newFile = Gio.File.new_for_path(GLib.build_filenamev([configDir, 'history.json']));
        const oldFile = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-clipboard-history', 'history.json']));
        if (!newFile.query_exists(null) && oldFile.query_exists(null)) {
            try {
                oldFile.copy(newFile, Gio.FileCopyFlags.NONE, null, null);
            } catch {}
        }
        return newFile;
    }

    _loadHistory() {
        try {
            const file = this._getStorageFile();
            if (!file.query_exists(null))
                return;

            const [, contents] = file.load_contents(null);
            const decoder = new TextDecoder('utf-8');
            const data = JSON.parse(decoder.decode(contents));

            if (Array.isArray(data)) {
                this._history = data.map(item => {
                    if (typeof item === 'string') {
                        return {
                            id: GLib.uuid_string_random(),
                            text: item,
                            pinned: false,
                            timestamp: Date.now(),
                            type: detectContentType(item),
                        };
                    }
                    return {
                        id: item.id || GLib.uuid_string_random(),
                        text: item.text || '',
                        pinned: Boolean(item.pinned),
                        timestamp: item.timestamp || Date.now(),
                        type: item.type || detectContentType(item.text),
                    };
                }).filter(item => item.text && item.text.trim().length > 0);

                if (this._history.length > 0)
                    this._lastText = this._history[0].text;
            }
        } catch (e) {
            console.error(`[SuperV] Failed to load history: ${e.message}`);
            this._history = [];
        }
    }

    _saveHistory() {
        try {
            const shouldSave = this._settings ? this._settings.get_boolean('save-history') : true;
            if (!shouldSave)
                return;

            const file = this._getStorageFile();
            const encoder = new TextEncoder();
            const jsonStr = JSON.stringify(this._history, null, 2);
            file.replace_contents(
                encoder.encode(jsonStr),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.error(`[SuperV] Failed to save history: ${e.message}`);
        }
    }

    _checkClipboard() {
        if (!this._clipboard)
            return;

        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (!text || text.trim().length === 0 || text === this._lastText)
                return;

            this._lastText = text;

            // Remove existing duplicate if present
            const existingIndex = this._history.findIndex(item => item.text === text);
            let pinned = false;
            let id = GLib.uuid_string_random();

            if (existingIndex !== -1) {
                pinned = this._history[existingIndex].pinned;
                id = this._history[existingIndex].id;
                this._history.splice(existingIndex, 1);
            }

            // Insert new item at top
            this._history.unshift({
                id,
                text,
                pinned,
                timestamp: Date.now(),
                type: detectContentType(text),
            });

            // Enforce max history size while protecting pinned items
            const maxHistory = this._settings ? this._settings.get_int('history-size') : 50;
            const unpinned = this._history.filter(item => !item.pinned);
            if (unpinned.length > maxHistory) {
                for (let i = this._history.length - 1; i >= 0; i--) {
                    if (!this._history[i].pinned) {
                        this._history.splice(i, 1);
                        break;
                    }
                }
            }

            this._saveHistory();

            if (this._popup && this._popup.visible) {
                this._updateHeaderCounts();
                this._renderEntries();
            }
        });
    }

    _togglePopup() {
        if (this._popup)
            this._closePopup();
        else
            this._openPopup();
    }

    _openPopup() {
        this._previousWindow = global.display.focus_window;
        this._searchQuery = '';
        this._selectedIndex = -1;

        // 1. Build Windows 11 Popup Container
        this._popup = new St.BoxLayout({
            vertical: true,
            reactive: true,
            can_focus: true,
            style_class: 'clipboard-history-popup',
        });

        // 2. Header (Icon + Title + Counts + Clear All + Close)
        const header = new St.BoxLayout({
            style_class: 'clipboard-history-header',
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const titleBox = new St.BoxLayout({
            style_class: 'clipboard-history-title-box',
            x_expand: true,
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const titleIcon = new St.Icon({
            icon_name: 'edit-copy-symbolic',
            style_class: 'clipboard-history-title-icon',
        });

        const titleLabel = new St.Label({
            text: 'Clipboard',
            style_class: 'clipboard-history-title',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._totalBadge = new St.Label({
            text: `${this._history.length}`,
            style_class: 'clipboard-history-badge',
            y_align: Clutter.ActorAlign.CENTER,
        });

        titleBox.add_child(titleIcon);
        titleBox.add_child(titleLabel);
        titleBox.add_child(this._totalBadge);

        // Clear All button with clean symbolic icon
        const clearBtn = new St.Button({
            style_class: 'clipboard-history-btn-clear',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const clearBox = new St.BoxLayout({vertical: false, style: 'spacing: 4px;'});
        clearBox.add_child(new St.Icon({icon_name: 'edit-clear-all-symbolic'}));
        clearBox.add_child(new St.Label({text: 'Clear all', y_align: Clutter.ActorAlign.CENTER}));
        clearBtn.set_child(clearBox);
        clearBtn.connect('clicked', () => this._clearAllUnpinned());

        // Close button with window-close-symbolic icon
        const closeBtn = new St.Button({
            style_class: 'clipboard-history-btn-close',
            child: new St.Icon({icon_name: 'window-close-symbolic'}),
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        closeBtn.connect('clicked', () => this._closePopup());

        header.add_child(titleBox);
        header.add_child(clearBtn);
        header.add_child(closeBtn);
        this._popup.add_child(header);

        // 3. Filter Tabs (All / Pinned) with symbolic icons
        const tabsBox = new St.BoxLayout({
            style_class: 'clipboard-history-tabs',
            vertical: false,
        });

        this._tabAll = new St.Button({
            style_class: `clipboard-history-tab ${this._activeTab === 'all' ? 'clipboard-history-tab-active' : ''}`,
            reactive: true,
            track_hover: true,
        });
        this._tabAllBox = new St.BoxLayout({vertical: false, style: 'spacing: 4px;'});
        this._tabAllBox.add_child(new St.Icon({icon_name: 'view-list-symbolic'}));
        this._tabAllLabel = new St.Label({text: `All (${this._history.length})`, y_align: Clutter.ActorAlign.CENTER});
        this._tabAllBox.add_child(this._tabAllLabel);
        this._tabAll.set_child(this._tabAllBox);
        this._tabAll.connect('clicked', () => {
            this._activeTab = 'all';
            this._updateTabsState();
            this._renderEntries();
        });

        const pinnedCount = this._history.filter(i => i.pinned).length;
        this._tabPinned = new St.Button({
            style_class: `clipboard-history-tab ${this._activeTab === 'pinned' ? 'clipboard-history-tab-active' : ''}`,
            reactive: true,
            track_hover: true,
        });
        this._tabPinnedBox = new St.BoxLayout({vertical: false, style: 'spacing: 4px;'});
        this._tabPinnedBox.add_child(new St.Icon({icon_name: 'view-pin-symbolic'}));
        this._tabPinnedLabel = new St.Label({text: `Pinned (${pinnedCount})`, y_align: Clutter.ActorAlign.CENTER});
        this._tabPinnedBox.add_child(this._tabPinnedLabel);
        this._tabPinned.set_child(this._tabPinnedBox);
        this._tabPinned.connect('clicked', () => {
            this._activeTab = 'pinned';
            this._updateTabsState();
            this._renderEntries();
        });

        tabsBox.add_child(this._tabAll);
        tabsBox.add_child(this._tabPinned);
        this._popup.add_child(tabsBox);

        // 4. Search Bar
        const searchContainer = new St.BoxLayout({
            style_class: 'clipboard-history-search-container',
        });

        this._searchEntry = new St.Entry({
            hint_text: 'Search clipboard...',
            style_class: 'clipboard-history-search-entry',
            can_focus: true,
            x_expand: true,
        });
        this._searchEntry.set_primary_icon(new St.Icon({
            icon_name: 'edit-find-symbolic',
            icon_size: 14,
        }));

        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._searchQuery = this._searchEntry.get_text().toLowerCase().trim();
            this._renderEntries();
        });

        searchContainer.add_child(this._searchEntry);
        this._popup.add_child(searchContainer);

        // 5. Scrollable List of Items
        this._scrollView = new St.ScrollView({
            style_class: 'clipboard-history-scrollview',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            x_expand: true,
            y_expand: true,
        });

        this._entriesBox = new St.BoxLayout({
            vertical: true,
            style_class: 'clipboard-history-list',
            x_expand: true,
        });

        this._scrollView.add_child(this._entriesBox);
        this._popup.add_child(this._scrollView);

        // Render Cards
        this._renderEntries();

        // Add to UI Group
        Main.uiGroup.add_child(this._popup);

        // Position popup accurately on the monitor containing cursor
        this._positionPopup();

        // Modal Grab for Keyboard & Pointer routing
        this._grab = Main.pushModal(this._popup);

        // Stage Captured Event for Escape key & Outside Click dismissal
        this._stageEventId = global.stage.connect('captured-event', (stage, event) => {
            return this._onCapturedStageEvent(event);
        });

        // Close on overview or workspace switch
        this._overviewShowingId = Main.overview.connect('showing', () => this._closePopup());
        this._workspaceChangedId = global.workspace_manager.connect('active-workspace-changed', () => this._closePopup());

        // Keyboard focus on search bar
        this._searchEntry.grab_key_focus();
    }

    _updateTabsState() {
        if (!this._tabAll || !this._tabPinned)
            return;

        const pinnedCount = this._history.filter(i => i.pinned).length;
        this._tabAllLabel.set_text(`All (${this._history.length})`);
        this._tabPinnedLabel.set_text(`Pinned (${pinnedCount})`);

        if (this._activeTab === 'all') {
            this._tabAll.add_style_class_name('clipboard-history-tab-active');
            this._tabPinned.remove_style_class_name('clipboard-history-tab-active');
        } else {
            this._tabPinned.add_style_class_name('clipboard-history-tab-active');
            this._tabAll.remove_style_class_name('clipboard-history-tab-active');
        }
    }

    _updateHeaderCounts() {
        if (this._totalBadge)
            this._totalBadge.set_text(`${this._history.length}`);
        this._updateTabsState();
    }

    _getFilteredHistory() {
        let list = this._history;

        // Apply Tab Filter
        if (this._activeTab === 'pinned')
            list = list.filter(item => item.pinned);

        // Apply Search Filter
        if (this._searchQuery) {
            list = list.filter(item =>
                item.text.toLowerCase().includes(this._searchQuery)
            );
        }

        return list;
    }

    _renderEntries() {
        if (!this._entriesBox)
            return;

        this._entriesBox.destroy_all_children();
        this._cardButtons = [];
        this._selectedIndex = -1;

        const items = this._getFilteredHistory();

        if (items.length === 0) {
            const emptyBox = new St.BoxLayout({
                vertical: true,
                style_class: 'clipboard-history-empty-box',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });

            const emptyIcon = new St.Icon({
                icon_name: this._searchQuery ? 'edit-find-symbolic' : 'edit-copy-symbolic',
                style_class: 'clipboard-history-empty-icon',
                x_align: Clutter.ActorAlign.CENTER,
            });

            const emptyTitle = new St.Label({
                text: this._searchQuery ? 'No matching clips found' : 'Your clipboard is empty',
                style_class: 'clipboard-history-empty-title',
                x_align: Clutter.ActorAlign.CENTER,
            });

            const emptySubtitle = new St.Label({
                text: this._searchQuery
                    ? 'Try searching with a different term'
                    : 'Copy text (Ctrl+C) anywhere to see it here',
                style_class: 'clipboard-history-empty-subtitle',
                x_align: Clutter.ActorAlign.CENTER,
            });

            emptyBox.add_child(emptyIcon);
            emptyBox.add_child(emptyTitle);
            emptyBox.add_child(emptySubtitle);
            this._entriesBox.add_child(emptyBox);
            return;
        }

        // Render each item as a Windows 11 Card
        for (const item of items) {
            const card = new St.BoxLayout({
                vertical: true,
                style_class: `clipboard-history-card ${item.pinned ? 'clipboard-history-card-pinned' : ''}`,
                reactive: true,
                can_focus: true,
                track_hover: true,
            });

            // Card Header
            const cardHeader = new St.BoxLayout({
                style_class: 'clipboard-history-card-header',
                vertical: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Type Badge with clean symbolic icon
            const typeBadge = new St.BoxLayout({
                style_class: 'clipboard-history-type-badge',
                vertical: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            let typeIconName = 'text-x-generic-symbolic';
            let typeText = 'TEXT';

            if (item.type === 'url') {
                typeIconName = 'web-browser-symbolic';
                typeText = 'LINK';
            } else if (item.type === 'code') {
                typeIconName = 'utilities-terminal-symbolic';
                typeText = 'CODE';
            } else if (item.type === 'color') {
                typeText = 'COLOR';
            }

            if (item.type === 'color') {
                const colorSwatch = new St.Widget({
                    style_class: 'clipboard-history-color-preview',
                    style: `background-color: ${item.text.trim()};`,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                typeBadge.add_child(colorSwatch);
            } else {
                typeBadge.add_child(new St.Icon({
                    icon_name: typeIconName,
                    style_class: 'clipboard-history-type-icon',
                }));
            }

            typeBadge.add_child(new St.Label({
                text: typeText,
                style_class: 'clipboard-history-type-text',
                y_align: Clutter.ActorAlign.CENTER,
            }));

            cardHeader.add_child(typeBadge);

            // Time Label
            const timeLabel = new St.Label({
                text: formatRelativeTime(item.timestamp),
                style_class: 'clipboard-history-time-label',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            cardHeader.add_child(timeLabel);

            // Action Buttons
            const actionsBox = new St.BoxLayout({
                style_class: 'clipboard-history-card-actions',
                vertical: false,
            });

            // Pin Button (view-pin-symbolic)
            const pinBtn = new St.Button({
                style_class: `clipboard-history-card-btn ${item.pinned ? 'clipboard-history-card-btn-pinned' : ''}`,
                child: new St.Icon({icon_name: 'view-pin-symbolic'}),
                reactive: true,
                track_hover: true,
            });
            pinBtn.connect('clicked', () => this._togglePin(item.id));

            // Copy Button (edit-copy-symbolic)
            const copyBtn = new St.Button({
                style_class: 'clipboard-history-card-btn',
                child: new St.Icon({icon_name: 'edit-copy-symbolic'}),
                reactive: true,
                track_hover: true,
            });
            copyBtn.connect('clicked', () => {
                this._clipboard.set_text(St.ClipboardType.CLIPBOARD, item.text);
                this._closePopup();
            });

            // Delete Button (edit-delete-symbolic)
            const delBtn = new St.Button({
                style_class: 'clipboard-history-card-btn clipboard-history-card-btn-delete',
                child: new St.Icon({icon_name: 'edit-delete-symbolic'}),
                reactive: true,
                track_hover: true,
            });
            delBtn.connect('clicked', () => this._deleteItem(item.id));

            actionsBox.add_child(pinBtn);
            actionsBox.add_child(copyBtn);
            actionsBox.add_child(delBtn);
            cardHeader.add_child(actionsBox);

            card.add_child(cardHeader);

            // Card Text Content Preview
            const previewText = item.text.length > 280 ? `${item.text.slice(0, 280)}…` : item.text;
            const contentLabel = new St.Label({
                text: previewText,
                style_class: `clipboard-history-card-content ${item.type === 'code' ? 'clipboard-history-card-code' : ''}`,
                x_expand: true,
            });
            contentLabel.clutter_text.set_line_wrap(true);
            contentLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            contentLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);

            card.add_child(contentLabel);

            // Card Click Action -> Auto-Paste & Close!
            card.connect('button-press-event', (actor, event) => {
                const target = global.stage.get_event_actor(event);
                if (target === pinBtn || target === copyBtn || target === delBtn ||
                    pinBtn.contains(target) || copyBtn.contains(target) || delBtn.contains(target)) {
                    return Clutter.EVENT_PROPAGATE;
                }
                this._selectEntry(item.text);
                return Clutter.EVENT_STOP;
            });

            this._cardButtons.push({card, item});
            this._entriesBox.add_child(card);
        }
    }

    _togglePin(id) {
        const item = this._history.find(i => i.id === id);
        if (item) {
            item.pinned = !item.pinned;
            this._saveHistory();
            this._updateHeaderCounts();
            this._renderEntries();
        }
    }

    _deleteItem(id) {
        const index = this._history.findIndex(i => i.id === id);
        if (index !== -1) {
            this._history.splice(index, 1);
            this._saveHistory();
            this._updateHeaderCounts();
            this._renderEntries();
        }
    }

    _clearAllUnpinned() {
        this._history = this._history.filter(item => item.pinned);
        this._saveHistory();
        this._updateHeaderCounts();
        this._renderEntries();
    }

    _positionPopup() {
        const focusWindow = global.display.focus_window;
        const [rawPointerX, rawPointerY] = global.get_pointer();

        let targetMonitor = null;

        // Check if pointer is on a valid monitor
        let pointerMonitor = null;
        if (typeof rawPointerX === 'number' && typeof rawPointerY === 'number' &&
            !(rawPointerX === 0 && rawPointerY === 0)) {
            pointerMonitor = Main.layoutManager.monitors.find(m =>
                rawPointerX >= m.x && rawPointerX < m.x + m.width &&
                rawPointerY >= m.y && rawPointerY < m.y + m.height
            );
        }

        // 1. Prioritize active focused window's monitor
        if (focusWindow) {
            const focusMonitorIdx = focusWindow.get_monitor();
            targetMonitor = Main.layoutManager.monitors[focusMonitorIdx];
        }

        // 2. If no focused window, use pointer's monitor or primary
        if (!targetMonitor) {
            targetMonitor = pointerMonitor || Main.layoutManager.currentMonitor || Main.layoutManager.primaryMonitor;
        }

        const positionMode = this._settings ? this._settings.get_string('position-mode') : 'cursor';

        const width = 380;
        const height = 480;

        let x, y;

        if (positionMode === 'center') {
            x = targetMonitor.x + (targetMonitor.width - width) / 2;
            y = targetMonitor.y + (targetMonitor.height - height) / 2;
        } else if (positionMode === 'bottom-right') {
            x = targetMonitor.x + targetMonitor.width - width - 24;
            y = targetMonitor.y + targetMonitor.height - height - 24;
        } else {
            // Default: If mouse pointer is on targetMonitor, place at cursor
            if (pointerMonitor && pointerMonitor === targetMonitor) {
                x = rawPointerX + 12;
                y = rawPointerY + 12;

                if (x + width > targetMonitor.x + targetMonitor.width - 16) {
                    x = rawPointerX - width - 12;
                }
                if (y + height > targetMonitor.y + targetMonitor.height - 16) {
                    y = rawPointerY - height - 12;
                }
            } else if (focusWindow) {
                // If cursor is on a different monitor or idle, center on active focused window
                const frameRect = focusWindow.get_frame_rect();
                x = frameRect.x + Math.round((frameRect.width - width) / 2);
                y = frameRect.y + Math.round((frameRect.height - height) / 2);
            } else {
                // Fallback: center of targetMonitor
                x = targetMonitor.x + (targetMonitor.width - width) / 2;
                y = targetMonitor.y + (targetMonitor.height - height) / 2;
            }

            // Strictly clamp to stay within targetMonitor boundaries
            x = Math.max(targetMonitor.x + 16, Math.min(x, targetMonitor.x + targetMonitor.width - width - 16));
            y = Math.max(targetMonitor.y + 16, Math.min(y, targetMonitor.y + targetMonitor.height - height - 16));
        }

        this._popup.set_position(Math.round(x), Math.round(y));
    }

    _onCapturedStageEvent(event) {
        if (!this._popup || !this._popup.visible)
            return Clutter.EVENT_PROPAGATE;

        const eventType = event.type();

        // 1. ESCAPE key: Close immediately
        if (eventType === Clutter.EventType.KEY_PRESS) {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._closePopup();
                return Clutter.EVENT_STOP;
            }

            // Keyboard navigation
            if (symbol === Clutter.KEY_Down) {
                if (this._cardButtons.length > 0) {
                    this._selectedIndex = Math.min(this._selectedIndex + 1, this._cardButtons.length - 1);
                    this._highlightSelectedCard();
                    return Clutter.EVENT_STOP;
                }
            } else if (symbol === Clutter.KEY_Up) {
                if (this._cardButtons.length > 0) {
                    this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
                    this._highlightSelectedCard();
                    return Clutter.EVENT_STOP;
                }
            } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                if (this._selectedIndex >= 0 && this._selectedIndex < this._cardButtons.length) {
                    this._selectEntry(this._cardButtons[this._selectedIndex].item.text);
                    return Clutter.EVENT_STOP;
                }
            } else if (symbol === Clutter.KEY_Delete) {
                if (this._selectedIndex >= 0 && this._selectedIndex < this._cardButtons.length) {
                    this._deleteItem(this._cardButtons[this._selectedIndex].item.id);
                    return Clutter.EVENT_STOP;
                }
            }
        }

        // 2. MOUSE BUTTON PRESS OUTSIDE: Close immediately
        if (eventType === Clutter.EventType.BUTTON_PRESS) {
            const [stageX, stageY] = event.get_coords();
            const actor = global.stage.get_event_actor(event);

            const isInsideActor = this._popup.contains(actor) || actor === this._popup;

            let isInsideCoords = false;
            const [hasExtents, extents] = this._popup.get_transformed_extents();
            if (hasExtents) {
                const topLeft = extents.get_top_left();
                const bottomRight = extents.get_bottom_right();
                if (stageX >= topLeft.x && stageX <= bottomRight.x &&
                    stageY >= topLeft.y && stageY <= bottomRight.y) {
                    isInsideCoords = true;
                }
            } else {
                const [px, py] = this._popup.get_transformed_position();
                const [pw, ph] = this._popup.get_transformed_size();
                if (stageX >= px && stageX <= px + pw && stageY >= py && stageY <= py + ph)
                    isInsideCoords = true;
            }

            if (!isInsideActor && !isInsideCoords) {
                this._closePopup();
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _highlightSelectedCard() {
        for (let i = 0; i < this._cardButtons.length; i++) {
            const {card} = this._cardButtons[i];
            if (i === this._selectedIndex) {
                card.add_style_pseudo_class('hover');
                card.grab_key_focus();
            } else {
                card.remove_style_pseudo_class('hover');
            }
        }
    }

    _selectEntry(text) {
        if (this._clipboard)
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);

        this._closePopup();

        const autoPaste = this._settings ? this._settings.get_boolean('auto-paste') : true;
        if (!autoPaste)
            return;

        if (this._pasteTimeoutId)
            GLib.source_remove(this._pasteTimeoutId);

        this._pasteTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._pasteTimeoutId = null;
            this._pasteText();
            return GLib.SOURCE_REMOVE;
        });
    }

    _pasteText() {
        if (this._previousWindow)
            this._previousWindow.activate(global.get_current_time());

        if (!this._virtualKeyboard) {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }

        const now = GLib.get_monotonic_time();
        this._virtualKeyboard.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
        this._virtualKeyboard.notify_keyval(now, Clutter.KEY_v, Clutter.KeyState.PRESSED);
        this._virtualKeyboard.notify_keyval(now, Clutter.KEY_v, Clutter.KeyState.RELEASED);
        this._virtualKeyboard.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
    }

    _closePopup() {
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }

        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = null;
        }

        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = null;
        }

        if (this._workspaceChangedId) {
            global.workspace_manager.disconnect(this._workspaceChangedId);
            this._workspaceChangedId = null;
        }

        if (this._popup) {
            Main.uiGroup.remove_child(this._popup);
            this._popup.destroy();
            this._popup = null;
        }

        this._entriesBox = null;
        this._scrollView = null;
        this._searchEntry = null;
        this._tabAll = null;
        this._tabPinned = null;
        this._tabAllLabel = null;
        this._tabPinnedLabel = null;
        this._totalBadge = null;
        this._cardButtons = [];
        this._selectedIndex = -1;
    }

    disable() {
        this._closePopup();

        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = null;
        }
        if (this._pasteTimeoutId) {
            GLib.source_remove(this._pasteTimeoutId);
            this._pasteTimeoutId = null;
        }

        Main.wm.removeKeybinding('toggle-clipboard-history');

        this._settings = null;
        this._history = [];
        this._clipboard = null;
        this._virtualKeyboard = null;
        this._previousWindow = null;
    }
}
