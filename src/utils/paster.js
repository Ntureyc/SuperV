import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import {PasteMode} from '../constants.js';
import {isTerminalWindow, activateWindow} from './windowHelper.js';

export class Paster {
    constructor() {
        this._virtualKeyboard = null;
    }

    _getKeyboard() {
        try {
            if (!this._virtualKeyboard) {
                const backend = Clutter.get_default_backend();
                const seat = backend ? backend.get_default_seat() : null;
                if (seat) {
                    this._virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
                }
            }
        } catch (e) {
            console.error(`[SuperV] Failed to create virtual keyboard device: ${e.message}`);
            this._virtualKeyboard = null;
        }
        return this._virtualKeyboard;
    }

    destroy() {
        this._virtualKeyboard = null;
    }

    /**
     * Pastes clipboard content into the target window using the appropriate key combination
     * @param {Meta.Window|null} targetWindow
     * @param {string} mode - 'auto' | 'ctrl-v' | 'ctrl-shift-v' | 'shift-insert'
     */
    paste(targetWindow, mode = PasteMode.AUTO) {
        try {
            if (targetWindow)
                activateWindow(targetWindow);

            const vk = this._getKeyboard();
            if (!vk) {
                console.warn('[SuperV] Virtual keyboard not available for auto-paste');
                return;
            }

            const now = GLib.get_monotonic_time();
            let useTerminalShortcut = false;

            if (mode === PasteMode.CTRL_SHIFT_V) {
                useTerminalShortcut = true;
            } else if (mode === PasteMode.SHIFT_INSERT) {
                // Shift + Insert
                vk.notify_keyval(now, Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_Insert, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_Insert, Clutter.KeyState.RELEASED);
                vk.notify_keyval(now, Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
                return;
            } else if (mode === PasteMode.AUTO) {
                useTerminalShortcut = isTerminalWindow(targetWindow);
            }

            if (useTerminalShortcut) {
                // Terminals require Ctrl + Shift + V
                vk.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_V, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_V, Clutter.KeyState.RELEASED);
                vk.notify_keyval(now, Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
                vk.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
            } else {
                // Standard GUI applications use Ctrl + v
                vk.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_v, Clutter.KeyState.PRESSED);
                vk.notify_keyval(now, Clutter.KEY_v, Clutter.KeyState.RELEASED);
                vk.notify_keyval(now, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
            }
        } catch (e) {
            console.error(`[SuperV] Auto-paste failed: ${e.message}`);
        }
    }
}
