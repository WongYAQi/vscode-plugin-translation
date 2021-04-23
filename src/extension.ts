// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import pluginHoverInstall, { GoHoverProvider } from './hover'
import pluginSearchInstall from './search'
const fs = require('fs');
/**
 * 开发计划
 * 0. 下载数据，存储数据，获取数据
 * 1. 完成鼠标悬停提示
 * @param context 
 */


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "coopwire-translation" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('coopwire-translation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from coopwire-translation!');
	});

	context.subscriptions.push(disposable);
	pluginHoverInstall(context)
	pluginSearchInstall(context)
}

// this method is called when your extension is deactivated
export function deactivate() {}
