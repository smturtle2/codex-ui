"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminalSettingsPath = getTerminalSettingsPath;
exports.readTerminalSettings = readTerminalSettings;
exports.writeTerminalSettings = writeTerminalSettings;
exports.resetTerminalSettings = resetTerminalSettings;
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const windows_terminal_1 = require("../src/lib/windows-terminal");
function getSettingsDirectory() {
    if (process.platform === "win32") {
        return process.env.LOCALAPPDATA || process.env.APPDATA || (0, node_path_1.join)((0, node_os_1.homedir)(), "AppData", "Roaming");
    }
    return process.env.XDG_CONFIG_HOME || (0, node_path_1.join)((0, node_os_1.homedir)(), ".config");
}
function getTerminalSettingsPath() {
    return (0, node_path_1.join)(getSettingsDirectory(), "webpty", "settings.json");
}
async function ensureSettingsDirectory(path) {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true });
}
async function readTerminalSettings(startingDirectory) {
    const path = getTerminalSettingsPath();
    await ensureSettingsDirectory(path);
    try {
        const raw = await (0, promises_1.readFile)(path, "utf8");
        const parsed = JSON.parse(raw);
        return {
            path,
            settings: (0, windows_terminal_1.normalizeTerminalSettings)(parsed, startingDirectory),
        };
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        const settings = (0, windows_terminal_1.createDefaultTerminalSettings)(startingDirectory);
        await (0, promises_1.writeFile)(path, (0, windows_terminal_1.serializeTerminalSettings)(settings), "utf8");
        return {
            path,
            settings,
        };
    }
}
async function writeTerminalSettings(settings, startingDirectory) {
    const path = getTerminalSettingsPath();
    const normalized = (0, windows_terminal_1.normalizeTerminalSettings)(settings, startingDirectory);
    await ensureSettingsDirectory(path);
    await (0, promises_1.writeFile)(path, (0, windows_terminal_1.serializeTerminalSettings)(normalized), "utf8");
    return {
        path,
        settings: normalized,
    };
}
function resetTerminalSettings(startingDirectory) {
    return (0, windows_terminal_1.createDefaultTerminalSettings)(startingDirectory);
}
