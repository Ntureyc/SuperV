import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Pango from 'gi://Pango';
import {ContentType} from '../constants.js';
import {formatRelativeTime} from '../utils/time.js';

export function createCard(item, {onSelect, onTogglePin, onCopy, onDelete}) {
    const card = new St.BoxLayout({
        vertical: true,
        reactive: true,
        can_focus: true,
        track_hover: true,
        style_class: `clipboard-history-card ${item.pinned ? 'clipboard-history-card-pinned' : ''}`,
    });

    // 1. Card Header
    const cardHeader = new St.BoxLayout({
        style_class: 'clipboard-history-card-header',
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
    });

    // Type Badge
    const typeBadge = new St.BoxLayout({
        style_class: 'clipboard-history-type-badge',
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
    });

    let typeIconName = 'edit-paste-symbolic';
    let typeLabel = 'Text';

    if (item.type === ContentType.COLOR) {
        typeIconName = 'applications-graphics-symbolic';
        typeLabel = 'Color';

        const colorSwatch = new St.Widget({
            style_class: 'clipboard-history-color-preview',
            style: `background-color: ${item.text.trim()};`,
        });
        typeBadge.add_child(colorSwatch);
    } else if (item.type === ContentType.URL) {
        typeIconName = 'web-browser-symbolic';
        typeLabel = 'Link';
    } else if (item.type === ContentType.CODE) {
        typeIconName = 'text-x-generic-symbolic';
        typeLabel = 'Code';
    }

    const typeIcon = new St.Icon({
        icon_name: typeIconName,
        style_class: 'clipboard-history-type-icon',
    });
    const typeText = new St.Label({
        text: typeLabel,
        style_class: 'clipboard-history-type-text',
    });

    typeBadge.add_child(typeIcon);
    typeBadge.add_child(typeText);
    cardHeader.add_child(typeBadge);

    // Time Label
    const timeLabel = new St.Label({
        text: formatRelativeTime(item.timestamp),
        style_class: 'clipboard-history-time-label',
        x_expand: true,
        x_align: Clutter.ActorAlign.FILL,
        y_align: Clutter.ActorAlign.CENTER,
    });
    cardHeader.add_child(timeLabel);

    // Action Buttons
    const actionsBox = new St.BoxLayout({
        style_class: 'clipboard-history-card-actions',
        vertical: false,
    });

    // Pin Button
    const pinBtn = new St.Button({
        style_class: `clipboard-history-card-btn ${item.pinned ? 'clipboard-history-card-btn-pinned' : ''}`,
        child: new St.Icon({icon_name: 'view-pin-symbolic'}),
        reactive: true,
        track_hover: true,
    });
    pinBtn.connect('clicked', () => onTogglePin(item.id));

    // Copy Button
    const copyBtn = new St.Button({
        style_class: 'clipboard-history-card-btn',
        child: new St.Icon({icon_name: 'edit-copy-symbolic'}),
        reactive: true,
        track_hover: true,
    });
    copyBtn.connect('clicked', () => onCopy(item.text));

    // Delete Button
    const delBtn = new St.Button({
        style_class: 'clipboard-history-card-btn clipboard-history-card-btn-delete',
        child: new St.Icon({icon_name: 'edit-delete-symbolic'}),
        reactive: true,
        track_hover: true,
    });
    delBtn.connect('clicked', () => onDelete(item.id));

    actionsBox.add_child(pinBtn);
    actionsBox.add_child(copyBtn);
    actionsBox.add_child(delBtn);
    cardHeader.add_child(actionsBox);
    card.add_child(cardHeader);

    // 2. Text Content Preview
    const previewText = item.text.length > 280 ? `${item.text.slice(0, 280)}…` : item.text;
    const contentLabel = new St.Label({
        text: previewText,
        style_class: `clipboard-history-card-content ${item.type === ContentType.CODE ? 'clipboard-history-card-code' : ''}`,
        x_expand: true,
    });
    contentLabel.clutter_text.set_line_wrap(true);
    contentLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
    contentLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
    card.add_child(contentLabel);

    // 3. Card Click -> Select / Auto-Paste
    card.connect('button-press-event', (actor, event) => {
        const target = global.stage.get_event_actor(event);
        if (
            target === pinBtn || target === copyBtn || target === delBtn ||
            pinBtn.contains(target) || copyBtn.contains(target) || delBtn.contains(target)
        ) {
            return Clutter.EVENT_PROPAGATE;
        }

        onSelect(item.text);
        return Clutter.EVENT_STOP;
    });

    return {card, item};
}
