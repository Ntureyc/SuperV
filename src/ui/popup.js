import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {PositionMode} from '../constants.js';
import {createHeader} from './header.js';
import {createTabs} from './tabs.js';
import {createSearchBar} from './searchBar.js';
import {createCard} from './card.js';

export class SuperVPopup {
    constructor({storage, clipboard, onSelect, settings}) {
        this._storage = storage;
        this._clipboard = clipboard;
        this._onSelect = onSelect;
        this._settings = settings;

        this._popup = null;
        this._activeTab = 'all';
        this._searchQuery = '';
        this._selectedIndex = -1;
        this._cardButtons = [];

        this._stageEventId = null;
        this._overviewShowingId = null;
        this._workspaceChangedId = null;
    }

    isOpen() {
        return this._popup !== null;
    }

    open() {
        if (this._popup) {
            this.close();
            return;
        }

        this._searchQuery = '';
        this._selectedIndex = -1;
        this._cardButtons = [];

        // 1. Root Popup Container
        this._popup = new St.BoxLayout({
            vertical: true,
            reactive: true,
            can_focus: true,
            style_class: 'clipboard-history-popup',
        });

        // 2. Header
        const history = this._storage.getHistory();
        const pinnedCount = history.filter(i => i.pinned).length;

        this._headerComponent = createHeader({
            totalCount: history.length,
            onClear: () => this._handleClear(),
            onClose: () => this.close(),
        });
        this._popup.add_child(this._headerComponent.header);

        // 3. Tabs (All / Pinned)
        this._tabsComponent = createTabs({
            activeTab: this._activeTab,
            allCount: history.length,
            pinnedCount,
            onTabChange: (tab) => this._handleTabChange(tab),
        });
        this._popup.add_child(this._tabsComponent.tabsContainer);

        // 4. Search Bar
        this._searchComponent = createSearchBar({
            onSearchChange: (query) => this._handleSearch(query),
        });
        this._popup.add_child(this._searchComponent.searchContainer);

        // 5. Scroll View & Entry List
        this._scrollView = new St.ScrollView({
            style_class: 'clipboard-history-scrollview',
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
        });
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        this._entriesBox = new St.BoxLayout({
            vertical: true,
            style_class: 'clipboard-history-list',
            x_expand: true,
        });
        this._scrollView.set_child(this._entriesBox);
        this._popup.add_child(this._scrollView);

        // 6. Populate List
        this.renderEntries();

        // 7. Add to Stage Chrome
        Main.layoutManager.addChrome(this._popup, {
            affectsInputRegion: true,
            affectsStruts: false,
            trackFullscreen: true,
        });

        // 8. Position the Popup Window
        this._positionPopup();

        // 9. Stage Events Capture (outside click & global shortcuts)
        this._stageEventId = global.stage.connect('captured-event', (actor, event) => {
            return this._onCapturedStageEvent(event);
        });

        this._overviewShowingId = Main.overview.connect('showing', () => this.close());
        this._workspaceChangedId = global.workspace_manager.connect('active-workspace-changed', () => this.close());

        // Focus search entry by default
        this._searchComponent.focus();
    }

    close() {
        if (!this._popup)
            return;

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

        Main.layoutManager.removeChrome(this._popup);
        this._popup.destroy();
        this._popup = null;
        this._entriesBox = null;
        this._scrollView = null;
        this._searchComponent = null;
        this._tabsComponent = null;
        this._headerComponent = null;
        this._cardButtons = [];
        this._selectedIndex = -1;
    }

    _positionPopup() {
        if (!this._popup)
            return;

        const [, , natWidth, natHeight] = this._popup.get_preferred_size();
        const popupWidth = natWidth || 360;
        const popupHeight = natHeight || 480;

        const [mouseX, mouseY] = global.get_pointer();
        const currentMonitor = global.display.get_current_monitor();
        const monitorWorkarea = Main.layoutManager.getWorkAreaForMonitor(currentMonitor);

        const positionMode = this._settings
            ? this._settings.get_string('position-mode')
            : PositionMode.CURSOR;

        let posX = mouseX + 16;
        let posY = mouseY + 16;

        if (positionMode === PositionMode.CENTER) {
            posX = monitorWorkarea.x + (monitorWorkarea.width - popupWidth) / 2;
            posY = monitorWorkarea.y + (monitorWorkarea.height - popupHeight) / 2;
        } else if (positionMode === PositionMode.BOTTOM_RIGHT) {
            posX = monitorWorkarea.x + monitorWorkarea.width - popupWidth - 24;
            posY = monitorWorkarea.y + monitorWorkarea.height - popupHeight - 24;
        } else {
            // Position near cursor, ensuring it fits inside monitor workarea
            if (posX + popupWidth > monitorWorkarea.x + monitorWorkarea.width) {
                posX = mouseX - popupWidth - 16;
            }
            if (posY + popupHeight > monitorWorkarea.y + monitorWorkarea.height) {
                posY = mouseY - popupHeight - 16;
            }
        }

        // Clamp to monitor boundaries
        posX = Math.max(monitorWorkarea.x + 8, Math.min(posX, monitorWorkarea.x + monitorWorkarea.width - popupWidth - 8));
        posY = Math.max(monitorWorkarea.y + 8, Math.min(posY, monitorWorkarea.y + monitorWorkarea.height - popupHeight - 8));

        this._popup.set_position(Math.round(posX), Math.round(posY));
    }

    _handleTabChange(tab) {
        this._activeTab = tab;
        this._tabsComponent.setActiveTab(tab);
        this._selectedIndex = -1;
        this.renderEntries();
    }

    _handleSearch(query) {
        this._searchQuery = query;
        this._selectedIndex = -1;
        this.renderEntries();
    }

    _handleClear() {
        if (this._activeTab === 'pinned') {
            const history = this._storage.getHistory();
            history.forEach(item => {
                if (item.pinned)
                    this._storage.togglePin(item.id);
            });
        } else {
            this._storage.clearUnpinned();
        }
        this.updateCounts();
        this.renderEntries();
    }

    updateCounts() {
        const history = this._storage.getHistory();
        const pinnedCount = history.filter(i => i.pinned).length;

        if (this._headerComponent)
            this._headerComponent.totalBadge.set_text(`${history.length}`);

        if (this._tabsComponent)
            this._tabsComponent.updateCounts(history.length, pinnedCount);
    }

    renderEntries() {
        if (!this._entriesBox)
            return;

        this._entriesBox.destroy_all_children();
        this._cardButtons = [];

        const history = this._storage.getHistory();
        let filtered = this._activeTab === 'pinned'
            ? history.filter(item => item.pinned)
            : history;

        if (this._searchQuery) {
            filtered = filtered.filter(item =>
                item.text.toLowerCase().includes(this._searchQuery)
            );
        }

        if (filtered.length === 0) {
            const emptyBox = new St.BoxLayout({
                vertical: true,
                style_class: 'clipboard-history-empty-box',
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });

            const emptyIcon = new St.Icon({
                icon_name: this._searchQuery ? 'edit-find-symbolic' : 'edit-copy-symbolic',
                style_class: 'clipboard-history-empty-icon',
            });

            const emptyTitle = new St.Label({
                text: this._searchQuery ? 'No matching clips found' : 'Your clipboard is empty',
                style_class: 'clipboard-history-empty-title',
            });

            const emptySubtitle = new St.Label({
                text: this._searchQuery ? 'Try another search term' : 'Copied text will automatically show up here',
                style_class: 'clipboard-history-empty-subtitle',
            });

            emptyBox.add_child(emptyIcon);
            emptyBox.add_child(emptyTitle);
            emptyBox.add_child(emptySubtitle);
            this._entriesBox.add_child(emptyBox);
            return;
        }

        for (const item of filtered) {
            const cardObj = createCard(item, {
                onSelect: (text) => {
                    this._onSelect(text);
                },
                onTogglePin: (id) => {
                    this._storage.togglePin(id);
                    this.updateCounts();
                    this.renderEntries();
                },
                onCopy: (text) => {
                    this._clipboard.setText(text);
                    this.close();
                },
                onDelete: (id) => {
                    this._storage.deleteItem(id);
                    this.updateCounts();
                    this.renderEntries();
                },
            });

            this._cardButtons.push(cardObj);
            this._entriesBox.add_child(cardObj.card);
        }
    }

    _onCapturedStageEvent(event) {
        if (!this._popup)
            return Clutter.EVENT_PROPAGATE;

        const eventType = event.type();

        // 1. KEYBOARD NAVIGATION
        if (eventType === Clutter.EventType.KEY_PRESS) {
            const symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }

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
                    this._onSelect(this._cardButtons[this._selectedIndex].item.text);
                    return Clutter.EVENT_STOP;
                }
            } else if (symbol === Clutter.KEY_Delete) {
                if (this._selectedIndex >= 0 && this._selectedIndex < this._cardButtons.length) {
                    this._storage.deleteItem(this._cardButtons[this._selectedIndex].item.id);
                    this.updateCounts();
                    this.renderEntries();
                    return Clutter.EVENT_STOP;
                }
            }
        }

        // 2. MOUSE BUTTON PRESS OUTSIDE
        if (eventType === Clutter.EventType.BUTTON_PRESS) {
            const [stageX, stageY] = event.get_coords();
            const actor = global.stage.get_event_actor(event);

            const isInsideActor = this._popup.contains(actor) || actor === this._popup;

            let isInsideCoords = false;
            const [hasExtents, extents] = this._popup.get_transformed_extents();
            if (hasExtents) {
                const topLeft = extents.get_top_left();
                const bottomRight = extents.get_bottom_right();
                if (
                    stageX >= topLeft.x && stageX <= bottomRight.x &&
                    stageY >= topLeft.y && stageY <= bottomRight.y
                ) {
                    isInsideCoords = true;
                }
            } else {
                const [px, py] = this._popup.get_transformed_position();
                const [pw, ph] = this._popup.get_transformed_size();
                if (stageX >= px && stageX <= px + pw && stageY >= py && stageY <= py + ph) {
                    isInsideCoords = true;
                }
            }

            if (!isInsideActor && !isInsideCoords) {
                this.close();
                return Clutter.EVENT_PROPAGATE;
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
}
