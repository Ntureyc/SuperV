import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import {PasteMode} from '../constants.js';
import {isTerminalWindow, activateWindow} from './windowHelper.js';

export class Paster {
    constructor() {
        this._virtualKeyboard = null;
    }

    _getKeyboard() {
        if (!this._virtualKeyboard) {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }
        return this._virtualKeyboard;
    }

    /**
     * Pastes clipboard content into the target window using the appropriate key combination
     * @param {Meta.Window|null} targetWindow
     * @param {string} mode - 'auto' | 'ctrl-v' | 'ctrl-shift-v' | 'shift-insert'
     */
    paste(targetWindow, mode = PasteMode.AUTO) {
        if (targetWindow)
            activateWindow(targetWindow);

        const vk = this._getKeyboard();
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
    }
}
