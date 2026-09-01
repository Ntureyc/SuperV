import Clutter from 'gi://Clutter';
import St from 'gi://St';

export function createSearchBar({onSearchChange}) {
    const searchContainer = new St.BoxLayout({
        style_class: 'clipboard-history-search-container',
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
    });

    const searchIcon = new St.Icon({
        icon_name: 'system-search-symbolic',
        style_class: 'clipboard-history-search-icon',
    });
    searchContainer.add_child(searchIcon);

    const searchEntry = new St.Entry({
        hint_text: 'Search clipboard...',
        style_class: 'clipboard-history-search-entry',
        can_focus: true,
        x_expand: true,
    });

    searchEntry.clutter_text.connect('text-changed', () => {
        const query = searchEntry.get_text().toLowerCase().trim();
        onSearchChange(query);
    });

    searchContainer.add_child(searchEntry);

    return {
        searchContainer,
        searchEntry,
        clear: () => searchEntry.set_text(''),
        focus: () => searchEntry.grab_key_focus(),
    };
}
