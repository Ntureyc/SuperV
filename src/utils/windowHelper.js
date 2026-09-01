import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {TerminalKeywords} from '../constants.js';

/**
 * Determine if a given window is a terminal or console application
 * Checks Wayland, X11, sandboxed app IDs, window tracker, and title strings.
 * @param {Meta.Window|null} window
 * @returns {boolean}
 */
export function isTerminalWindow(window) {
    if (!window)
        return false;

    let app = null;
    try {
        app = Shell.WindowTracker.get_default()?.get_window_app(window);
    } catch {}

    const identifiers = [
        window.get_wm_class?.(),
        window.get_wm_class_instance?.(),
        window.get_gtk_application_id?.(),
        window.get_sandboxed_app_id?.(),
        window.get_title?.(),
        window.get_description?.(),
        app?.get_id?.(),
        app?.get_name?.(),
    ].filter(Boolean).map(s => String(s).toLowerCase());

    return identifiers.some(id => TerminalKeywords.some(keyword => id.includes(keyword)));
}

/**
 * Safely activate and restore focus to a previously active window
 * @param {Meta.Window|null} window
 */
export function activateWindow(window) {
    if (!window)
        return;

    try {
        if (Main.activateWindow)
            Main.activateWindow(window);
        else
            window.activate(global.get_current_time());
    } catch {
        try {
            window.activate(global.get_current_time());
        } catch {}
    }
}
