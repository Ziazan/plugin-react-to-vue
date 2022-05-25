// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {genReact2VueCode} from './main/index';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "plugin-react-to-vue" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('plugin-react-to-vue.helloWorld', (args) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const selectPath = args.path;
		console.log('%c [ selectPath ]-21', 'font-size:13px; background:pink; color:#bf2c9f;', selectPath);
		const currentlyOpenTabFilePath = vscode.window.activeTextEditor?.document.fileName;
		console.log('%c [ currentlyOpenTabfilePath ]-22', 'font-size:13px; background:pink; color:#bf2c9f;', currentlyOpenTabFilePath);
		// const fileContent = fs.readFileSync(currentlyOpenTabFilePath!, 'utf8');
		const targetFilePath = `${selectPath.split('.')[0]}.vue`;
		// fs.writeFileSync(targetFilePath, targetFilePath);
		genReact2VueCode(currentlyOpenTabFilePath!,targetFilePath);
		vscode.window.showInformationMessage('Hello World from plugin-react-to-vue!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
