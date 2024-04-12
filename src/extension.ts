import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext)
{
	context.subscriptions.push(vscode.commands.registerCommand("uwap.releasecollector.publish", publish));
}

export function deactivate()
{
}

async function publish()
{
	
}
