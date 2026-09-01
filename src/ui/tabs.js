import Clutter from 'gi://Clutter';
import St from 'gi://St';

export function createTabs({activeTab, allCount, pinnedCount, onTabChange}) {
    const tabsContainer = new St.BoxLayout({
        style_class: 'clipboard-history-tabs',
        vertical: false,
    });

    // Tab: All
    const tabAll = new St.Button({
        style_class: `clipboard-history-tab ${activeTab === 'all' ? 'clipboard-history-tab-active' : ''}`,
        reactive: true,
        track_hover: true,
        x_expand: true,
    });
    const tabAllBox = new St.BoxLayout({
        vertical: false,
        x_align: Clutter.ActorAlign.CENTER,
    });
    const tabAllLabel = new St.Label({
        text: `All (${allCount})`,
        style_class: 'clipboard-history-tab-label',
    });
    tabAllBox.add_child(tabAllLabel);
    tabAll.set_child(tabAllBox);
    tabAll.connect('clicked', () => onTabChange('all'));

    // Tab: Pinned
    const tabPinned = new St.Button({
        style_class: `clipboard-history-tab ${activeTab === 'pinned' ? 'clipboard-history-tab-active' : ''}`,
        reactive: true,
        track_hover: true,
        x_expand: true,
    });
    const tabPinnedBox = new St.BoxLayout({
        vertical: false,
        x_align: Clutter.ActorAlign.CENTER,
    });
    const tabPinnedLabel = new St.Label({
        text: `Pinned (${pinnedCount})`,
        style_class: 'clipboard-history-tab-label',
    });
    tabPinnedBox.add_child(tabPinnedLabel);
    tabPinned.set_child(tabPinnedBox);
    tabPinned.connect('clicked', () => onTabChange('pinned'));

    tabsContainer.add_child(tabAll);
    tabsContainer.add_child(tabPinned);

    return {
        tabsContainer,
        tabAll,
        tabPinned,
        tabAllLabel,
        tabPinnedLabel,
        setActiveTab: (tab) => {
            if (tab === 'all') {
                tabAll.add_style_class_name('clipboard-history-tab-active');
                tabPinned.remove_style_class_name('clipboard-history-tab-active');
            } else {
                tabPinned.add_style_class_name('clipboard-history-tab-active');
                tabAll.remove_style_class_name('clipboard-history-tab-active');
            }
        },
        updateCounts: (all, pinned) => {
            tabAllLabel.set_text(`All (${all})`);
            tabPinnedLabel.set_text(`Pinned (${pinned})`);
        },
    };
}
