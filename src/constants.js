/**
 * SuperV - Windows 11-style Clipboard History for GNOME Shell
 * Application Constants and Defaults
 */

export const ContentType = Object.freeze({
    TEXT: 'text',
    CODE: 'code',
    COLOR: 'color',
    URL: 'url',
});

export const PositionMode = Object.freeze({
    CURSOR: 'cursor',
    CENTER: 'center',
    BOTTOM_RIGHT: 'bottom-right',
});

export const PasteMode = Object.freeze({
    AUTO: 'auto',
    CTRL_V: 'ctrl-v',
    CTRL_SHIFT_V: 'ctrl-shift-v',
    SHIFT_INSERT: 'shift-insert',
});

export const TerminalKeywords = Object.freeze([
    'terminal',
    'ptyxis',
    'console',
    'kgx',
    'alacritty',
    'kitty',
    'foot',
    'xterm',
    'urxvt',
    'terminator',
    'tilix',
    'wezterm',
    'blackbox',
    'rio',
    'st-256color',
    'guake',
    'tilda',
    'ghostty',
    'mitchellh',
    'tabby',
    'hyper',
    'zsh',
    'bash',
    'fish',
    'tmux',
    'ssh',
]);

export const DefaultSettings = Object.freeze({
    HISTORY_SIZE: 50,
    AUTO_PASTE: true,
    SAVE_HISTORY: true,
    POSITION_MODE: PositionMode.CURSOR,
    PASTE_MODE: PasteMode.AUTO,
    PASTE_DELAY: 150,
});
