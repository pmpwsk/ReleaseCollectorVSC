"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBytes = exports.writeText = exports.writeLines = exports.readBytes = exports.readText = exports.readLines = exports.deleteDirectory = exports.deleteFile = exports.move = exports.copy = exports.createDirectory = exports.getDirectoryNames = exports.getDirectoriesRecursive = exports.getFilesRecursive = exports.getFileNames = exports.modifiedTimestamp = exports.exists = void 0;
const vscode = __importStar(require("vscode"));
async function exists(path) {
    try {
        await vscode.workspace.fs.stat(path);
        return true;
    }
    catch {
        return false;
    }
}
exports.exists = exists;
async function modifiedTimestamp(path) {
    return (await vscode.workspace.fs.stat(path)).mtime;
}
exports.modifiedTimestamp = modifiedTimestamp;
async function getFileNames(path) {
    return (await vscode.workspace.fs.readDirectory(path)).filter(x => x[1] === vscode.FileType.File).map(x => x[0]);
}
exports.getFileNames = getFileNames;
async function getFilesRecursive(path) {
    var result = (await getFileNames(path)).map(x => vscode.Uri.joinPath(path, x));
    for (var x of await getDirectoryNames(path)) {
        result = result.concat(await getFilesRecursive(vscode.Uri.joinPath(path, x)));
    }
    return result;
}
exports.getFilesRecursive = getFilesRecursive;
async function getDirectoriesRecursive(path) {
    var result = [];
    for (var x of await getDirectoryNames(path)) {
        result.push(vscode.Uri.joinPath(path, x));
        result = result.concat(await getDirectoriesRecursive(vscode.Uri.joinPath(path, x)));
    }
    return result;
}
exports.getDirectoriesRecursive = getDirectoriesRecursive;
async function getDirectoryNames(path) {
    return (await vscode.workspace.fs.readDirectory(path)).filter(x => x[1] === vscode.FileType.Directory && x !== undefined && x !== null).map(x => x[0]);
}
exports.getDirectoryNames = getDirectoryNames;
async function createDirectory(path) {
    await vscode.workspace.fs.createDirectory(path);
}
exports.createDirectory = createDirectory;
async function copy(from, to) {
    await vscode.workspace.fs.copy(from, to);
}
exports.copy = copy;
async function move(from, to) {
    await vscode.workspace.fs.rename(from, to);
}
exports.move = move;
async function deleteFile(path) {
    await vscode.workspace.fs.delete(path, { useTrash: false });
}
exports.deleteFile = deleteFile;
async function deleteDirectory(path) {
    await vscode.workspace.fs.delete(path, { useTrash: false, recursive: true });
}
exports.deleteDirectory = deleteDirectory;
async function readLines(path) {
    return (await readText(path)).split("\n").map(x => x.endsWith("\r") ? x.substring(0, x.length - 1) : x);
}
exports.readLines = readLines;
async function readText(path) {
    return new TextDecoder().decode(await readBytes(path));
}
exports.readText = readText;
async function readBytes(path) {
    return await vscode.workspace.fs.readFile(path);
}
exports.readBytes = readBytes;
async function writeLines(path, lines) {
    await writeText(path, lines.join("\n"));
}
exports.writeLines = writeLines;
async function writeText(path, text) {
    await writeBytes(path, new TextEncoder().encode(text));
}
exports.writeText = writeText;
async function writeBytes(path, bytes) {
    await vscode.workspace.fs.writeFile(path, bytes);
}
exports.writeBytes = writeBytes;
//# sourceMappingURL=fs.js.map