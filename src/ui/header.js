import Clutter from 'gi://Clutter';
import St from 'gi://St';

export function createHeader({totalCount, onClear, onClose}) {
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

    const totalBadge = new St.Label({
        text: `${totalCount}`,
        style_class: 'clipboard-history-badge',
        y_align: Clutter.ActorAlign.CENTER,
    });

    titleBox.add_child(titleIcon);
    titleBox.add_child(titleLabel);
    titleBox.add_child(totalBadge);
    header.add_child(titleBox);

    // Clear All Button
    const clearBtnBox = new St.BoxLayout({
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const clearIcon = new St.Icon({
        icon_name: 'user-trash-symbolic',
        style_class: 'btn-icon-small',
    });
    const clearLabel = new St.Label({
        text: 'Clear',
        y_align: Clutter.ActorAlign.CENTER,
    });
    clearBtnBox.add_child(clearIcon);
    clearBtnBox.add_child(clearLabel);

    const clearBtn = new St.Button({
        style_class: 'clipboard-history-btn-clear',
        child: clearBtnBox,
        reactive: true,
        track_hover: true,
    });
    clearBtn.connect('clicked', () => onClear());
    header.add_child(clearBtn);

    // Close Button
    const closeBtn = new St.Button({
        style_class: 'clipboard-history-btn-close',
        child: new St.Icon({icon_name: 'window-close-symbolic'}),
        reactive: true,
        track_hover: true,
    });
    closeBtn.connect('clicked', () => onClose());
    header.add_child(closeBtn);

    return {header, totalBadge};
}
