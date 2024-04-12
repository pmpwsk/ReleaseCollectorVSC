import * as vscode from "vscode";

export async function exists(path : vscode.Uri) : Promise<boolean>
{
	try
	{
		await vscode.workspace.fs.stat(path);
		return true;
	}
	catch
	{
		return false;
	}
}

export async function modifiedTimestamp(path : vscode.Uri) : Promise<number>
{
	return (await vscode.workspace.fs.stat(path)).mtime;
}

export async function getFileNames(path : vscode.Uri) : Promise<string[]>
{
	return (await vscode.workspace.fs.readDirectory(path)).filter(x => x[1] === vscode.FileType.File).map(x => x[0]);
}

export async function getFilesRecursive(path : vscode.Uri) : Promise<vscode.Uri[]>
{
	var result : vscode.Uri[] = (await getFileNames(path)).map(x => vscode.Uri.joinPath(path, x));
	for (var x of await getDirectoryNames(path))
	{
		result = result.concat(await getFilesRecursive(vscode.Uri.joinPath(path, x)));
	}
	return result;
}

export async function getDirectoriesRecursive(path : vscode.Uri) : Promise<vscode.Uri[]>
{
	var result : vscode.Uri[] = [];
	for (var x of await getDirectoryNames(path))
	{
		result.push(vscode.Uri.joinPath(path, x));
		result = result.concat(await getDirectoriesRecursive(vscode.Uri.joinPath(path, x)));
	}
	return result;
}

export async function getDirectoryNames(path : vscode.Uri) : Promise<string[]>
{
	return (await vscode.workspace.fs.readDirectory(path)).filter(x => x[1] === vscode.FileType.Directory && x !== undefined && x !== null).map(x => x[0]);
}

export async function createDirectory(path : vscode.Uri) : Promise<void>
{
	await vscode.workspace.fs.createDirectory(path);
}

export async function copy(from : vscode.Uri, to : vscode.Uri) : Promise<void>
{
	await vscode.workspace.fs.copy(from, to);
}

export async function move(from : vscode.Uri, to : vscode.Uri) : Promise<void>
{
	await vscode.workspace.fs.rename(from, to);
}

export async function deleteFile(path : vscode.Uri) : Promise<void>
{
	await vscode.workspace.fs.delete(path, {useTrash : false});
}

export async function deleteDirectory(path : vscode.Uri) : Promise<void>
{
	await vscode.workspace.fs.delete(path, {useTrash : false, recursive: true});
}

export async function readLines(path : vscode.Uri) : Promise<string[]>
{
	return (await readText(path)).split("\n").map(x => x.endsWith("\r") ? x.substring(0, x.length - 1) : x);
}

export async function readText(path : vscode.Uri) : Promise<string>
{
	return new TextDecoder().decode(await readBytes(path));
}

export async function readBytes(path : vscode.Uri) : Promise<Uint8Array>
{
	return await vscode.workspace.fs.readFile(path);
}

export async function writeLines(path : vscode.Uri, lines : string[]) : Promise<void>
{
	await writeText(path, lines.join("\n"));
}

export async function writeText(path : vscode.Uri, text : string) : Promise<void>
{
	await writeBytes(path, new TextEncoder().encode(text));
}

export async function writeBytes(path : vscode.Uri, bytes : Uint8Array) : Promise<void>
{
	await vscode.workspace.fs.writeFile(path, bytes);
}