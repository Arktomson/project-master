import * as vscode from "vscode";

/**
 * 注册文件夹操作相关的命令
 * @param context 扩展上下文
 */
export function registerFolderCommands(context: vscode.ExtensionContext) {
  // 注册在当前窗口打开文件夹的命令
  const openInCurrentWindow = vscode.commands.registerCommand(
    "project-master.openFolderInCurrentWindow",
    (uri: vscode.Uri) => {
      if (uri) {
        vscode.commands.executeCommand("vscode.openFolder", uri, false);
      }
    }
  );

  // 注册在新窗口打开文件夹的命令
  const openInNewWindow = vscode.commands.registerCommand(
    "project-master.openFolderInNewWindow",
    (uri: vscode.Uri) => {
      if (uri) {
        vscode.commands.executeCommand("vscode.openFolder", uri, true);
      }
    }
  );

  context.subscriptions.push(openInCurrentWindow, openInNewWindow);
}
