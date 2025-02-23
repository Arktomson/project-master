import * as vscode from "vscode";

export const loadExternalFileView = (context: vscode.ExtensionContext) => {
  const externalFileViewProvider = new ExternalFileViewProvider(context);

  // 注册视图
  vscode.window.createTreeView("externalFileView", {
    treeDataProvider: externalFileViewProvider,
  });

  let addFileCommand = vscode.commands.registerCommand(
    "externalFileView.addFile",
    () => {
      externalFileViewProvider.addItem("file");
    }
  );

  let openFileCommand = vscode.commands.registerCommand(
    "externalFileView.openFile",
    async (item: FileItem) => {
      const document = await vscode.workspace.openTextDocument(item.path);
      await vscode.window.showTextDocument(document);
    }
  );

  let deleteItemCommand = vscode.commands.registerCommand(
    "externalFileView.deleteItem",
    (item: FileItem) => {
      externalFileViewProvider.deleteItem(item);
    }
  );

  context.subscriptions.push(
    addFileCommand,
    openFileCommand,
    deleteItemCommand
  );
};
export class ExternalFileViewProvider
  implements vscode.TreeDataProvider<FileItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    FileItem | undefined | null | void
  > = new vscode.EventEmitter<FileItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    FileItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private static readonly STORAGE_KEY =
    "publisher.project-master.storage.external-file";
  private items: SavedItem[] = [];

  constructor(private context: vscode.ExtensionContext) {
    // 初始化时加载存储的数据
    this.items = this.context.globalState.get<SavedItem[]>(
      ExternalFileViewProvider.STORAGE_KEY,
      []
    );
  }

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileItem): Thenable<FileItem[]> {
    if (!element) {
      return Promise.resolve(
        this.items.map(
          (item) =>
            new FileItem(
              item.label,
              vscode.TreeItemCollapsibleState.None,
              item.path,
              item.type
            )
        )
      );
    }
    return Promise.resolve([]);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // 添加新项目
  async addItem(type: "file" | "folder") {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: type === "file",
      canSelectFolders: type === "folder",
      canSelectMany: false,
      title: `选择${type === "file" ? "文件" : "文件夹"}`,
    });

    if (uri && uri[0]) {
      const name = uri[0].fsPath.split("/").pop() || "";

      const itemName = await vscode.window.showInputBox({
        prompt: "输入名称（留空则使用原名）",
        placeHolder: name,
        value: name,
      });

      if (itemName) {
        this.items.push({
          label: itemName,
          path: uri[0].fsPath,
          type: type,
        });

        await this.context.globalState.update(
          ExternalFileViewProvider.STORAGE_KEY,
          this.items
        );
        this.refresh();
      }
    }
  }

  // 删除项目
  async deleteItem(item: FileItem) {
    const index = this.items.findIndex((i) => i.path === item.path);
    if (index !== -1) {
      this.items.splice(index, 1);
      await this.context.globalState.update(
        ExternalFileViewProvider.STORAGE_KEY,
        this.items
      );
      this.refresh();
    }
  }
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly path: string,
    public readonly type: "file" | "folder"
  ) {
    super(label, collapsibleState);

    // 设置图标
    this.iconPath = new vscode.ThemeIcon(type === "file" ? "file" : "folder");

    // 设置提示信息
    this.tooltip = `${this.label}\n${this.path}`;

    // 设置点击命令
    if (type === "file") {
      this.command = {
        command: "externalFileView.openFile",
        title: "Open File",
        arguments: [this],
      };
    } else {
      this.command = {
        command: "externalFileView.openFolder",
        title: "Open Folder",
        arguments: [this],
      };
    }

    // 设置上下文值，用于右键菜单
    this.contextValue = type;
  }
}
interface SavedItem {
  label: string;
  path: string;
  type: "file" | "folder";
}
