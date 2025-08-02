import * as vscode from "vscode";

export const loadProjectManagerView = (context: vscode.ExtensionContext) => {
  const projectManager = new ProjectManager(context);
  const projectType = new ProjectType(projectManager);

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(() => {
      projectType.refresh();
    })
  );

  // 注册视图
  const treeView = vscode.window.createTreeView("projectExplorer", {
    treeDataProvider: projectType,
  });

  // 必需的命令注册 - 简洁版本，直接调用方法
  context.subscriptions.push(
    vscode.commands.registerCommand("projectExplorer.addProject", () => projectType.addProject()),
    vscode.commands.registerCommand("projectExplorer.addCurrentProject", () => projectType.addCurrentProject()),
    vscode.commands.registerCommand("projectExplorer.resetData", () => projectType.resetData()),
    vscode.commands.registerCommand("projectExplorer.exportData", () => projectType.exportData()),
    vscode.commands.registerCommand("projectExplorer.importData", () => projectType.importData()),
    vscode.commands.registerCommand("projectExplorer.openCategoryProjects", (item: ProjectItem) => item.openCategoryProjects())
  );
};

export class ProjectType implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | null | void
  > = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ProjectItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private projectManager: ProjectManager) {}

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectItem): Promise<ProjectItem[]> {
    if (!element) {
      // 根节点显示所有类别
      const categories = this.projectManager.getCategories();
      return categories.map(
        (category) =>
          new ProjectItem(
            category,
            vscode.TreeItemCollapsibleState.Collapsed,
            "category",
            undefined,
            undefined,
            this.projectManager // 传递 ProjectManager 实例
          )
      );
    } else if (element.type === "category") {
      // 显示类别下的所有项目
      const projects = this.projectManager.getProjectsByCategory(element.label);
      return projects.map(
        (project) =>
          new ProjectItem(
            project.name,
            vscode.TreeItemCollapsibleState.None,
            "project",
            project.path,
            element.label, // 添加父类别信息
            this.projectManager // 传递 ProjectManager 实例
          )
      );
    }
    return Promise.resolve([]);
  }

  refresh(): void {
    // 刷新项目数据
    this.projectManager.refreshProjects();
    // 触发视图刷新
    this._onDidChangeTreeData.fire();
  }

  // 功能方法 - 可以通过其他方式调用（如快捷键、状态栏等）
  async addProject(): Promise<void> {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: "选择项目文件夹",
    });

    if (folderUri && folderUri[0]) {
      const folderName = folderUri[0].fsPath.split("/").pop() || "";

      const projectName = await vscode.window.showInputBox({
        prompt: "输入项目名称（留空则使用文件夹名）",
        placeHolder: folderName,
        value: folderName,
      });

      if (!projectName) {
        return;
      }

      // 使用新的分类选择方法
      const category = await this.projectManager.handleCategorySelection();
      if (category === undefined) {
        return; // 用户取消了分类选择
      }

      this.projectManager.saveProject({
        category: category || "default", // 如果返回空字符串，使用default
        name: projectName,
        path: folderUri[0].fsPath,
      });
      this.refresh();
      vscode.window.showInformationMessage(
        `项目 "${projectName}" 已添加到 "${category || "default"}" 分类`
      );
    }
  }

  async addCurrentProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("没有打开的工作区");
      return;
    }

    const folderPath = workspaceFolder.uri.fsPath;
    const folderName = workspaceFolder.name;

    // 获取项目名称
    const projectName = await vscode.window.showInputBox({
      prompt: "输入项目名称（留空则使用文件夹名）",
      placeHolder: folderName,
      value: folderName,
    });

    if (!projectName) {
      return;
    }

    // 选择分类
    const category = await this.projectManager.handleCategorySelection();
    if (category === undefined) {
      return; // 用户取消了分类选择
    }

    this.projectManager.saveProject({
      category: category || "default", // 如果返回空字符串，使用default
      name: projectName,
      path: folderPath,
    });
    this.refresh();
    vscode.window.showInformationMessage(
      `项目 "${projectName}" 已添加到 "${category || "default"}" 分类`
    );
  }

  async resetData(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      "确定要重置所有数据吗？此操作不可恢复！",
      { modal: true },
      "重置"
    );

    if (confirm === "重置") {
      this.projectManager.resetData();
      this.refresh();
      vscode.window.showInformationMessage("数据已重置");
    }
  }

  async exportData(): Promise<void> {
    await this.projectManager.exportData();
  }

  async importData(): Promise<void> {
    await this.projectManager.importData();
    this.refresh(); // 刷新视图
  }
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: "category" | "project",
    public readonly projectPath?: string,
    public readonly parent?: string,
    private readonly projectManager?: ProjectManager
  ) {
    super(label, collapsibleState);

    // 设置图标
    if (type === "category") {
      this.iconPath = new vscode.ThemeIcon("folder");
      this.contextValue = "category";
    } else {
      this.iconPath = new vscode.ThemeIcon("symbol-misc");
      this.contextValue = "project";
    }

    // 项目双击直接打开（不需要命令）
    if (type === "project" && projectPath) {
      this.command = {
        command: "vscode.openFolder",
        title: "Open Folder",
        arguments: [vscode.Uri.file(projectPath), { forceNewWindow: false }],
      };
    }
  }

  // 右键菜单功能 - 通过直接调用实现
  async openCategoryProjects(): Promise<void> {
    if (this.type === "category" && this.projectManager) {
      const projects = this.projectManager.getProjectsByCategory(this.label);
      // 为每个项目创建一个打开窗口的Promise
      const openPromises = projects.map(
        (project, index) =>
          new Promise<void>((resolve) => {
            // 添加小延迟，避免同时打开太多窗口
            setTimeout(() => {
              vscode.commands.executeCommand(
                "vscode.openFolder",
                vscode.Uri.file(project.path),
                { forceNewWindow: true }
              );
              resolve();
            }, index * 500); // 每个窗口间隔500ms
          })
      );

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `正在打开 ${this.label} 下的项目...`,
          cancellable: false,
        },
        async () => {
          await Promise.all(openPromises);
          vscode.window.showInformationMessage(
            `已打开 ${this.label} 下的所有项目`
          );
        }
      );
    }
  }
}

export class ProjectManager {
  private static readonly STORAGE_KEY =
    "publisher.project-master.storage.projects";
  private projects: ProjectData[] = [];

  constructor(private context: vscode.ExtensionContext) {
    if (
      this.context.globalState.get(ProjectManager.STORAGE_KEY) === undefined
    ) {
      this.context.globalState.update(ProjectManager.STORAGE_KEY, []);
    }
    // 初始化时加载存储的项目数据
    this.projects = this.getAllProjects();

    // 设置需要同步的键，这样在卸载时会触发清理
    this.context.globalState.setKeysForSync([ProjectManager.STORAGE_KEY]);
  }

  // 导出数据
  async exportData(): Promise<void> {
    const data = this.getAllProjects();
    const jsonData = JSON.stringify(data, null, 2);

    const uri = await vscode.window.showSaveDialog({
      filters: { JSON: ["json"] },
      defaultUri: vscode.Uri.file("project-master-data.json"),
      title: "导出项目数据",
    });

    if (uri) {
      try {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(jsonData, "utf-8")
        );
        vscode.window.showInformationMessage("数据导出成功！");
      } catch (error) {
        vscode.window.showErrorMessage(`导出失败: ${error}`);
      }
    }
  }

  // 导入数据
  async importData(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { JSON: ["json"] },
      title: "导入项目数据",
    });

    if (uri && uri[0]) {
      try {
        const data = await vscode.workspace.fs.readFile(uri[0]);
        const jsonData = JSON.parse(data.toString());

        if (
          Array.isArray(jsonData) &&
          jsonData.every(
            (item) =>
              typeof item === "object" &&
              "category" in item &&
              "name" in item &&
              "path" in item
          )
        ) {
          this.projects = jsonData;
          await this.context.globalState.update(
            ProjectManager.STORAGE_KEY,
            this.projects
          );
          vscode.window.showInformationMessage("数据导入成功！");
          return;
        }
        throw new Error("无效的数据格式");
      } catch (error) {
        vscode.window.showErrorMessage(`导入失败: ${error}`);
      }
    }
  }

  saveProject(project: ProjectData): void {
    this.projects.push(project);
    this.context.globalState.update(ProjectManager.STORAGE_KEY, this.projects);
  }

  getAllProjects(): ProjectData[] {
    return this.context.globalState.get<ProjectData[]>(
      ProjectManager.STORAGE_KEY,
      []
    );
  }

  getProjectsByCategory(category: string): ProjectData[] {
    return this.projects.filter((p) => p.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.projects.map((p) => p.category));
    if (!categories.has("default")) {
      categories.add("default");
    }
    return Array.from(categories);
  }

  refreshProjects(): void {
    this.projects = this.getAllProjects();
  }

  renameProject(oldName: string, category: string, newName: string): boolean {
    const projectIndex = this.projects.findIndex(
      (p) => p.name === oldName && p.category === category
    );
    if (projectIndex !== -1) {
      this.projects[projectIndex].name = newName;
      this.context.globalState.update(
        ProjectManager.STORAGE_KEY,
        this.projects
      );
      return true;
    }
    return false;
  }

  deleteProject(name: string, category: string): boolean {
    const projectIndex = this.projects.findIndex(
      (p) => p.name === name && p.category === category
    );
    if (projectIndex !== -1) {
      this.projects.splice(projectIndex, 1);
      this.context.globalState.update(
        ProjectManager.STORAGE_KEY,
        this.projects
      );
      return true;
    }
    return false;
  }

  renameCategory(oldName: string, newName: string): boolean {
    if (oldName === "default") {
      return false;
    }
    const projectsToUpdate = this.projects.filter(
      (p) => p.category === oldName
    );
    if (projectsToUpdate.length > 0) {
      projectsToUpdate.forEach((p) => (p.category = newName));
      this.context.globalState.update(
        ProjectManager.STORAGE_KEY,
        this.projects
      );
      return true;
    }
    return false;
  }

  deleteCategory(category: string): boolean {
    if (category === "default") {
      return false;
    }
    const initialLength = this.projects.length;
    this.projects = this.projects.filter((p) => p.category !== category);
    if (this.projects.length < initialLength) {
      this.context.globalState.update(
        ProjectManager.STORAGE_KEY,
        this.projects
      );
      return true;
    }
    return false;
  }

  resetData(): void {
    this.projects = [];
    this.context.globalState.update(ProjectManager.STORAGE_KEY, this.projects);
  }

  async getCategoryQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const categories = this.getCategories();
    return [
      { label: "$(new-folder) 新建分类...", description: "创建新的分类" },
      ...categories.map((category) => ({
        label: category,
        description: `${this.getProjectsByCategory(category).length} 个项目`,
      })),
    ];
  }

  async handleCategorySelection(): Promise<string | undefined> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.items = await this.getCategoryQuickPickItems();
    quickPick.placeholder = "选择或创建新分类";

    let isCreatingNewCategory = false;

    return new Promise<string | undefined>((resolve) => {
      quickPick.onDidAccept(async () => {
        const selection = quickPick.selectedItems;
        if (!selection || selection.length === 0) {
          quickPick.hide();
          return;
        }
        const selected = selection[0];

        if (selected.label.startsWith("$(new-folder)")) {
          isCreatingNewCategory = true;
          quickPick.hide();

          const newCategory = await vscode.window.showInputBox({
            prompt: "输入新的分类名称",
            placeHolder: "新分类名称",
            validateInput: (text) => {
              const trimmed = text?.trim() || "";
              if (!trimmed) {
                return "分类名称不能为空";
              }
              if (trimmed === "default") {
                return "不能使用 'default' 作为分类名称";
              }
              return null;
            },
          });

          isCreatingNewCategory = false;
          if (newCategory?.trim()) {
            resolve(newCategory.trim());
          } else {
            quickPick.show();
          }
        } else {
          quickPick.hide();
          resolve(selected.label);
        }
      });

      quickPick.onDidHide(() => {
        if (!isCreatingNewCategory) {
          quickPick.dispose();
          resolve(undefined);
        }
      });

      quickPick.show();
    });
  }
}

export interface ProjectData {
  category: string;
  name: string;
  path: string;
}