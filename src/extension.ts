import * as vscode from "vscode";
import { loadExternalFileView } from "./view/externalFileView";
import { loadProjectManagerView } from "./view/projectManager";
import { initProcess } from "./view";
import { registerFolderCommands } from "./commands/folderCommands";
import { registerChoreCommands } from "./commands/choreCommands";

export function activate(context: vscode.ExtensionContext) {
  // initProcess(context);

  loadProjectManagerView(context);

  loadExternalFileView(context);

  // 注册文件夹操作命令
  registerFolderCommands(context);
  // 注册其他命令
  registerChoreCommands(context);

}

export function deactivate() {}
