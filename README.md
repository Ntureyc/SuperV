# SuperV

A modern, fluent Windows 11-style clipboard history flyout (`Super+V`) for GNOME Shell (45, 46, 47, 48, 49, 50+).

## Features

- **True Windows 11 Experience (`Super+V`)**: Seamlessly open and close with <kbd>Super</kbd>+<kbd>V</kbd>.
- **Auto-Dismiss on Outside Click**: Automatically closes when you click anywhere outside the popup, refocusing your target window instantly.
- **Auto-Dismiss on `Escape`**: Press <kbd>Esc</kbd> to instantly close the clipboard.
- **Dual & Multi-Monitor Support**: Dynamically detects the exact monitor containing your mouse cursor and positions the flyout right where you need it.
- **Auto-Paste on Click**: Selecting an item copies it, focuses the target window, and automatically simulates <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste.
- **Pin / Unpin Clips**: Pin your favorite clips so they never get lost or wiped when clearing history.
- **Instant Real-Time Search**: Filter through your entire clipboard history with instantaneous search.
- **Clear All (Unpinned)**: Easily wipe transient clips while preserving pinned clips.
- **Smart Content Badges & Color Swatches**:
  - Automatically identifies URLs, Code snippets, Hex color codes (with live color preview swatch!), and text.
  - Formats multiline code and snippets cleanly.
- **Native GNOME Symbolic Icons**: Crisp, theme-matching symbolic icons throughout the UI with zero emojis.
- **Persistent Storage**: Retains your pinned clips and recent history across shell restarts and reboots.
- **Rich Preferences UI**: Configurable history limits, popup position (Cursor / Center / Bottom-Right), auto-paste toggle, and storage tools via GNOME Extensions app.

## Installation

### 1. Clone or copy to extensions directory
```bash
git clone https://github.com/Ntureyc/SuperV.git ~/.local/share/gnome-shell/extensions/superv@ntureyc
```

### 2. Compile GSettings Schema
```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/superv@ntureyc/schemas/
```

### 3. Enable Extension
```bash
gnome-extensions enable superv@ntureyc
```

## Keyboard Shortcuts & Controls

| Shortcut / Action | Function |
|---|---|
| <kbd>Super</kbd> + <kbd>V</kbd> | Toggle SuperV Clipboard Flyout |
| <kbd>Esc</kbd> | Close Popup |
| <kbd>Click Outside</kbd> | Dismiss Popup & Focus underlying app |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Navigate clips via keyboard |
| <kbd>Enter</kbd> | Paste selected clip |
| <kbd>Delete</kbd> | Delete selected clip |
| **Pin Button** | Pin / Unpin clip |
| **Copy Button** | Copy clip to clipboard without pasting |
| **Delete Button** | Delete individual clip |

## Requirements
- GNOME Shell 45, 46, 47, 48, 49, or 50+
- Wayland or X11 session

## Author
- **ntureyc** ([GitHub](https://github.com/Ntureyc))

## License
GPL-3.0-or-later
