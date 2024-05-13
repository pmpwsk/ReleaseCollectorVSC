import * as vscode from "vscode";
import * as fs from "./fs";
import * as util from "util";
import JSZip from "jszip";
const exec = util.promisify(require("child_process").exec);

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand("uwap.releasecollector.publish", publish));
}

export function deactivate() {
}

async function publish() {
	var folders = vscode.workspace.workspaceFolders;
	if (folders === undefined || folders.length !== 1) {
		vscode.window.showErrorMessage("No .csproj file found!");
		return;
	}
	var projUri : vscode.Uri | undefined = folders[0].uri;
	var projectFiles = (await fs.getFileNames(projUri)).filter(file => file.endsWith(".csproj"));
	var projName : string;
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
	var hasPublishFile : boolean = await fs.exists(vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`));
	if (hasPublishFile) {
		await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj`), vscode.Uri.joinPath(projUri, `${projName}.csproj-original`));
		await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`), vscode.Uri.joinPath(projUri, `${projName}.csproj`));
	}
	var csprojCode : string = await fs.readText(vscode.Uri.joinPath(projUri, `${projName}.csproj`));
	var [versionBefore, versionString, versionAfter] = getXML(csprojCode, "Version");
	versionCheck: if (versionString !== null) {
		var version : number[] = [];
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
			await fs.writeText(vscode.Uri.joinPath(projUri, "test.txt"), versionBefore + versionString + versionAfter);
			versionString = vSelection;
		}
	}
	var releaseUri = vscode.Uri.joinPath(projUri, "bin", "Release");
	if (await fs.exists(releaseUri))
		fs.deleteDirectory(releaseUri);
	var targetUri : vscode.Uri;
	if (versionString !== null) {
		var publishUri = vscode.Uri.joinPath(projUri, "bin", "Publish");
		if (!await fs.exists(publishUri))
			await fs.createDirectory(publishUri);
		targetUri = vscode.Uri.joinPath(publishUri, versionString);
	} else
		targetUri = vscode.Uri.joinPath(projUri, "bin", "Publish");
	if (await fs.exists(targetUri))
		await fs.deleteDirectory(targetUri);
	await fs.createDirectory(targetUri);
	var versionSuffix = versionString === null ? "" : `-${versionString}`;
	main: if (csprojCode.includes("<OutputType>Exe</OutputType>") || csprojCode.includes("<Project Sdk=\"Microsoft.NET.Sdk.Web\">")) {
		var netUri : vscode.Uri|null = null;
		var configUri = vscode.Uri.joinPath(projUri, "ReleaseCollector.config");
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
			netUri ??= vscode.Uri.joinPath(releaseUri, (await fs.getDirectoryNames(releaseUri))[0]);
			var sourceUri = vscode.Uri.joinPath(releaseUri, (await fs.getDirectoryNames(releaseUri))[0], runtimeSegments[0], "publish");
			var executableName = runtimeSegments[0].includes("win") ? `${projName}.exe` : projName;
			if (!await fs.exists(vscode.Uri.joinPath(sourceUri, executableName))) {
				vscode.window.showErrorMessage("Build failed!");
				break main;
			}
			for (var include of parts.slice(1)) {
				var uri = vscode.Uri.joinPath(projUri, ...include.split("/"));
				if (await fs.exists(uri))
					await fs.copy(uri, vscode.Uri.joinPath(sourceUri, include.split("/").slice(-1)[0]));
				else vscode.window.showErrorMessage(`Couldn't find included file or directory '${include}'.`);
			}
			await zip(sourceUri, vscode.Uri.joinPath(targetUri, `${projName}${versionSuffix}-${parts[0]}.zip`), executableName);
		}
		vscode.window.showInformationMessage("Success!");
	} else {
		await run(projUri, "dotnet build -c Release");
		var dllUri = vscode.Uri.joinPath(releaseUri, (await fs.getDirectoryNames(releaseUri))[0], `${projName}.dll`);
		if (!await fs.exists(dllUri)) {
			vscode.window.showErrorMessage("Build failed!");
			break main;
		}
		await fs.copy(dllUri, vscode.Uri.joinPath(targetUri, `${projName}${versionSuffix}.dll`));
		var nupkgs = (await fs.getFileNames(releaseUri)).filter(x => x.endsWith(".nupkg"));
		if (nupkgs.length > 0)
			await fs.copy(vscode.Uri.joinPath(releaseUri, nupkgs[0]), vscode.Uri.joinPath(targetUri, nupkgs[0]));
		vscode.window.showInformationMessage("Success!");
	}
	if (hasPublishFile) {
		await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj`), vscode.Uri.joinPath(projUri, `${projName}.csproj-publish`));
		await fs.move(vscode.Uri.joinPath(projUri, `${projName}.csproj-original`), vscode.Uri.joinPath(projUri, `${projName}.csproj`));
	}
}

async function run(projUri : vscode.Uri, command : string) : Promise<boolean> {
	try {
		await exec(command, {cwd: projUri.fsPath});
		return true;
	} catch (e) {
		return false;
	}
}

function getXML(xml : string, key : string) : [string, string|null, string] {
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

function changeVersion(version : number[], index : number) : number[] {
	var result : number[] = [...version];
	while (result.length < index+1)
		result.push(0);
	result[index++]++;
	while (index < result.length)
		result[index++] = 0;
	return result;
}

function versionToString(version : number[]) : string {
	return version.map(seg => seg.toString()).join(".");
}

async function zip(directoryUri : vscode.Uri, zipUri : vscode.Uri, executableName : string) : Promise<void> {
	var zip = new JSZip();
	await addToZip(zip, directoryUri, executableName);
	fs.writeBytes(zipUri, await zip.generateAsync({type:"uint8array", compression:"DEFLATE", compressionOptions:{level:9}, platform:process.platform==="win32"?"DOS":"UNIX"}));
}

async function addToZip(zip : JSZip, path : vscode.Uri, executableName : string | null) : Promise<void> {
	for (var x of await fs.getDirectoryNames(path)) {
		var folder = zip.folder(x)
		if (folder === null)
			vscode.window.showErrorMessage(`'${path.fsPath}' could not be added to a .zip file!`);
		else addToZip(folder, vscode.Uri.joinPath(path, x), null);
	}
	for (var x of await fs.getFileNames(path))
		if (x === executableName)
			zip.file(x, await fs.readBytes(vscode.Uri.joinPath(path, x)), {unixPermissions:"744"});
		else if (executableName === null || x !== "ReleaseCollector.config")
			zip.file(x, await fs.readBytes(vscode.Uri.joinPath(path, x)));
}