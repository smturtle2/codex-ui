"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_COMMANDS = void 0;
exports.BUILTIN_COMMANDS = [
    {
        name: "model",
        description: "Choose the current session model and reasoning effort.",
        action: "model",
    },
    {
        name: "review",
        description: "Run an inline review against uncommitted changes.",
        action: "review",
    },
    {
        name: "new",
        description: "Start a fresh thread in the current browser session.",
        action: "new",
    },
    {
        name: "resume",
        description: "Open the thread drawer for previous local sessions.",
        action: "resume",
    },
    {
        name: "fork",
        description: "Fork the active thread into a new branchable session.",
        action: "fork",
    },
    {
        name: "status",
        description: "Open the runtime and bridge status panel.",
        action: "status",
    },
    {
        name: "clear",
        description: "Clear the working surface by starting a new thread.",
        action: "clear",
    },
];
