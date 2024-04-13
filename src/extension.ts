import * as vscode from "vscode";
import * as fs from "./fs";

export function activate(context: vscode.ExtensionContext)
{
	context.subscriptions.push(vscode.commands.registerCommand("uwap.releasecollector.publish", publish));
}

export function deactivate()
{
}

async function publish()
{
	var folders = vscode.workspace.workspaceFolders;
	if (folders === undefined || folders.length !== 1)
	{
		vscode.window.showErrorMessage("No .csproj file found!");
		return;
	}
	var projUri : vscode.Uri | undefined = folders[0].uri;
	var projectFiles = (await fs.getFileNames(projUri)).filter(file => file.endsWith(".csproj"));
	var projName : string;
	switch (projectFiles.length)
	{
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
}
