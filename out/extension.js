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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("./fs"));
const util = __importStar(require("util"));
const jszip_1 = __importDefault(require("jszip"));
const exec = util.promisify(require("child_process").exec);
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("uwap.releasecollector.publish", publish));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
async function publish() {
    var folders = vscode.workspace.workspaceFolders;
    if (folders === undefined || folders.length !== 1) {
        vscode.window.showErrorMessage("No .csproj file found!");
        return;
    }
    var projUri = folders[0].uri;
    var projectFiles = (await fs.getFileNames(projUri)).filter(file => file.endsWith(".csproj"));
    var projName;
    switch (projectFiles.length) {
        case 0:
            vscode.window.showErrorMessage("No .csproj file found!");
            return;
        case 1:
            projName = projectFiles[0];
            projName = projName.substring(0, projName.length - 7);
            break;
        default:
            vscode.window.showErrorMessage("Multiple .csproj files found, please open one project specifically!");
            return;
    }
    var hasPublishFile = await fs.exists(vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`));
    if (hasPublishFile) {
        await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj`), vscode.Uri.joinPath(projUri, `${projName}.csproj-original`));
        await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`), vscode.Uri.joinPath(projUri, `${projName}.csproj`));
    }
    var csprojCode = await fs.readText(vscode.Uri.joinPath(projUri, `${projName}.csproj`));
    var [versionBefore, versionString, versionAfter] = getXML(csprojCode, "Version");
    versionCheck: if (versionString !== null) {
        var version = [];
        for (var segString of versionString.split(".")) {
            var seg = Number.parseInt(segString);
            if (seg !== undefined && seg >= 0)
                version.push(seg);
            else {
                vscode.window.showErrorMessage("Invalid version!");
                versionString = null;
                break versionCheck;
            }
        }
        if (version.length > 4) {
            vscode.window.showErrorMessage("Invalid version!");
            versionString = null;
            break versionCheck;
        }
        var vSelection = await vscode.window.showQuickPick([
            versionToString(version),
            versionToString(changeVersion(version, 3)),
            versionToString(changeVersion(version, 2)),
            versionToString(changeVersion(version, 1)),
            versionToString(changeVersion(version, 0))
        ], { placeHolder: 'Select a version...' });
        if (vSelection === undefined) {
            if (hasPublishFile) {
                await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj`), vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`));
                await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj-original`), vscode.Uri.joinPath(projUri, `${projName}.csproj`));
            }
            return;
        }
        if (versionString !== vSelection) {
            versionString = vSelection;
            await fs.writeText(vscode.Uri.joinPath(projUri, `${projName}.csproj`), versionBefore + versionString + versionAfter);
        }
    }
    var binReleaseUri = vscode.Uri.joinPath(projUri, "bin", "Release");
    if (await fs.exists(binReleaseUri))
        await fs.deleteDirectory(binReleaseUri);
    var objReleaseUri = vscode.Uri.joinPath(projUri, "obj", "Release");
    if (await fs.exists(objReleaseUri))
        await fs.deleteDirectory(objReleaseUri);
    var targetUri;
    if (versionString !== null) {
        var publishUri = vscode.Uri.joinPath(projUri, "bin", "Publish");
        if (!await fs.exists(publishUri))
            await fs.createDirectory(publishUri);
        targetUri = vscode.Uri.joinPath(publishUri, versionString);
    }
    else
        targetUri = vscode.Uri.joinPath(projUri, "bin", "Publish");
    if (await fs.exists(targetUri))
        await fs.deleteDirectory(targetUri);
    await fs.createDirectory(targetUri);
    var versionSuffix = versionString === null ? "" : `-${versionString}`;
    main: if (csprojCode.includes("<OutputType>Exe</OutputType>") || csprojCode.includes("<Project Sdk=\"Microsoft.NET.Sdk.Web\">")) {
        var netUri = null;
        var configUri = vscode.Uri.joinPath(projUri, "ReleaseCollector.conf");
        for (var line of await fs.exists(configUri) ? await fs.readLines(configUri) : ["linux-arm64_fd", "linux-x64_fd", "osx-arm64_fd", "osx-x64_fd", "win-arm64_fd", "win-x64_fd", "linux-arm64_sc", "linux-x64_sc", "osx-arm64_sc", "osx-x64_sc", "win-arm64_sc", "win-x64_sc"]) {
            line = line.trim();
            if (line === "")
                continue;
            var parts = line.split(" + ");
            var runtimeSegments = parts[0].split("_");
            if (runtimeSegments.length !== 2) {
                vscode.window.showErrorMessage(`Invalid runtime line '${line}'!`);
                continue;
            }
            switch (runtimeSegments[1]) {
                case "fd":
                    await run(projUri, `dotnet publish -r ${runtimeSegments[0]} -p:PublishSingleFile=true --sc false -c Release`);
                    break;
                case "sc":
                    await run(projUri, `dotnet publish -r ${runtimeSegments[0]} --sc true -c Release`);
                    break;
                default:
                    vscode.window.showErrorMessage(`Invalid runtime line '${line}'!`);
                    continue;
            }
            netUri ??= vscode.Uri.joinPath(binReleaseUri, (await fs.getDirectoryNames(binReleaseUri))[0]);
            var sourceUri = vscode.Uri.joinPath(binReleaseUri, (await fs.getDirectoryNames(binReleaseUri))[0], runtimeSegments[0], "publish");
            var executableName = runtimeSegments[0].includes("win") ? `${projName}.exe` : projName;
            if (!await fs.exists(vscode.Uri.joinPath(sourceUri, executableName))) {
                vscode.window.showErrorMessage("Build failed!");
                break main;
            }
            for (var include of parts.slice(1)) {
                var uri = vscode.Uri.joinPath(projUri, ...include.split("/"));
                if (await fs.exists(uri))
                    await fs.copy(uri, vscode.Uri.joinPath(sourceUri, include.split("/").slice(-1)[0]));
                else
                    vscode.window.showErrorMessage(`Couldn't find included file or directory '${include}'.`);
            }
            await zip(sourceUri, vscode.Uri.joinPath(targetUri, `${projName}${versionSuffix}-${parts[0]}.zip`), executableName);
        }
        vscode.window.showInformationMessage("Success!");
    }
    else {
        await run(projUri, "dotnet build -c Release");
        var dllUri = vscode.Uri.joinPath(binReleaseUri, (await fs.getDirectoryNames(binReleaseUri))[0], `${projName}.dll`);
        if (!await fs.exists(dllUri)) {
            vscode.window.showErrorMessage("Build failed!");
            break main;
        }
        await fs.copy(dllUri, vscode.Uri.joinPath(targetUri, `${projName}${versionSuffix}.dll`));
        var nupkgs = (await fs.getFileNames(binReleaseUri)).filter(x => x.endsWith(".nupkg"));
        if (nupkgs.length > 0)
            await fs.copy(vscode.Uri.joinPath(binReleaseUri, nupkgs[0]), vscode.Uri.joinPath(targetUri, nupkgs[0]));
        vscode.window.showInformationMessage("Success!");
    }
    if (vscode.workspace.getConfiguration().get("UWAP.releasecollector.deleteReleaseFolder")) {
        if (await fs.exists(binReleaseUri))
            await fs.deleteDirectory(binReleaseUri);
        if (await fs.exists(objReleaseUri))
            await fs.deleteDirectory(objReleaseUri);
    }
    if (hasPublishFile) {
        await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj`), vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`));
        await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj-original`), vscode.Uri.joinPath(projUri, `${projName}.csproj`));
    }
}
async function run(projUri, command) {
    try {
        await exec(command, { cwd: projUri.fsPath });
        return true;
    }
    catch (e) {
        return false;
    }
}
function getXML(xml, key) {
    var index = xml.indexOf(`<${key}>`);
    if (index === -1)
        return ["", null, ""];
    var before = `${xml.slice(0, index)}<${key}>`;
    xml = xml.slice(index + key.length + 2);
    index = xml.indexOf(`</${key}>`);
    if (index === -1)
        return ["", null, ""];
    var value = xml.slice(0, index).trim();
    var after = xml.slice(index);
    return [before, value, after];
}
function changeVersion(version, index) {
    var result = [...version];
    while (result.length < index + 1)
        result.push(0);
    result[index++]++;
    while (index < result.length)
        result[index++] = 0;
    return result;
}
function versionToString(version) {
    return version.map(seg => seg.toString()).join(".");
}
async function zip(directoryUri, zipUri, executableName) {
    var zip = new jszip_1.default();
    await addToZip(zip, directoryUri, executableName);
    await fs.writeBytes(zipUri, await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: process.platform === "win32" ? "DOS" : "UNIX" }));
}
async function addToZip(zip, path, executableName) {
    for (var x of await fs.getDirectoryNames(path)) {
        var folder = zip.folder(x);
        if (folder === null)
            vscode.window.showErrorMessage(`'${path.fsPath}' could not be added to a .zip file!`);
        else
            await addToZip(folder, vscode.Uri.joinPath(path, x), null);
    }
    for (var x of await fs.getFileNames(path))
        if (x === executableName)
            zip.file(x, await fs.readBytes(vscode.Uri.joinPath(path, x)), { unixPermissions: "744" });
        else
            zip.file(x, await fs.readBytes(vscode.Uri.joinPath(path, x)));
}
//# sourceMappingURL=extension.js.map