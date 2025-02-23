import * as vscode from "vscode";

export const loadProjectManagerView = (context: vscode.ExtensionContext) => {
  const projectManager = new ProjectManager(context);
  const projectType = new ProjectType(projectManager);

  // 注册在当前窗口打开项目的命令
  let openProjectInCurrentWindowCommand = vscode.commands.registerCommand(
    "projectExplorer.openProjectInCurrentWindow",
    async (item: ProjectItem) => {
      if (item.type === "project" && item.projectPath) {
        vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(item.projectPath),
          { forceNewWindow: false }
        );
      }
    }
  );

  // 注册打开类别下所有项目的命令
  let openCategoryProjectsCommand = vscode.commands.registerCommand(
    "projectExplorer.openCategoryProjects",
    async (item: ProjectItem) => {
      if (item.type === "category") {
        const projects = projectManager.getProjectsByCategory(item.label);
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
            title: `正在打开 ${item.label} 下的项目...`,
            cancellable: false,
          },
          async () => {
            await Promise.all(openPromises);
            vscode.window.showInformationMessage(
              `已打开 ${item.label} 下的所有项目`
            );
          }
        );
      }
    }
  );

  // 注册添加当前项目命令
  let addCurrentProjectCommand = vscode.commands.registerCommand(
    "projectExplorer.addCurrentProject",
    async () => {
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
      const category = await projectManager.handleCategorySelection();
      console.log(category);
      if (category === undefined) {
        return; // 用户取消了分类选择
      }

      projectManager.saveProject({
        category: category || "default", // 如果返回空字符串，使用default
        name: projectName,
        path: folderPath,
      });
      projectType.refresh();
      vscode.window.showInformationMessage(
        `项目 "${projectName}" 已添加到 "${category || "default"}" 分类`
      );
    }
  );

  // 修改添加项目命令
  let addProjectCommand = vscode.commands.registerCommand(
    "projectExplorer.addProject",
    async () => {
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
        const category = await projectManager.handleCategorySelection();
        if (category === undefined) {
          return; // 用户取消了分类选择
        }

        projectManager.saveProject({
          category: category || "default", // 如果返回空字符串，使用default
          name: projectName,
          path: folderUri[0].fsPath,
        });
        projectType.refresh();
        vscode.window.showInformationMessage(
          `项目 "${projectName}" 已添加到 "${category || "default"}" 分类`
        );
      }
    }
  );

  // 注册重命名项目命令
  let renameProjectCommand = vscode.commands.registerCommand(
    "projectExplorer.renameProject",
    async (item: ProjectItem) => {
      if (item.type === "project") {
        const newName = await vscode.window.showInputBox({
          prompt: "输入新的项目名称",
          placeHolder: item.label,
          value: item.label,
        });

        if (newName && newName !== item.label) {
          const category = item.parent || "default";
          if (projectManager.renameProject(item.label, category, newName)) {
            projectType.refresh();
            vscode.window.showInformationMessage(`项目已重命名为: ${newName}`);
          } else {
            vscode.window.showErrorMessage("重命名项目失败");
          }
        }
      }
    }
  );

  // 注册删除项目命令
  let deleteProjectCommand = vscode.commands.registerCommand(
    "projectExplorer.deleteProject",
    async (item: ProjectItem) => {
      if (item.type === "project") {
        const confirm = await vscode.window.showWarningMessage(
          `确定要删除项目 "${item.label}" 吗？`,
          { modal: true },
          "删除"
        );

        if (confirm === "删除") {
          const category = item.parent || "default";
          if (projectManager.deleteProject(item.label, category)) {
            projectType.refresh();
            vscode.window.showInformationMessage(`项目 "${item.label}" 已删除`);
          } else {
            vscode.window.showErrorMessage("删除项目失败");
          }
        }
      }
    }
  );

  // 注册重命名类别命令
  let renameCategoryCommand = vscode.commands.registerCommand(
    "projectExplorer.renameCategory",
    async (item: ProjectItem) => {
      if (item.type === "category") {
        if (item.label === "default") {
          vscode.window.showWarningMessage("不能重命名 default 类别");
          return;
        }

        const newName = await vscode.window.showInputBox({
          prompt: "输入新的类别名称",
          placeHolder: item.label,
          value: item.label,
        });

        if (newName && newName !== item.label) {
          if (projectManager.renameCategory(item.label, newName)) {
            projectType.refresh();
            vscode.window.showInformationMessage(`类别已重命名为: ${newName}`);
          } else {
            vscode.window.showErrorMessage("重命名类别失败");
          }
        }
      }
    }
  );

  // 注册删除类别命令
  let deleteCategoryCommand = vscode.commands.registerCommand(
    "projectExplorer.deleteCategory",
    async (item: ProjectItem) => {
      if (item.type === "category") {
        if (item.label === "default") {
          vscode.window.showWarningMessage("不能删除 default 类别");
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `确定要删除类别 "${item.label}" 及其所有项目吗？`,
          { modal: true },
          "删除"
        );

        if (confirm === "删除") {
          if (projectManager.deleteCategory(item.label)) {
            projectType.refresh();
            vscode.window.showInformationMessage(
              `类别 "${item.label}" 及其项目已删除`
            );
          } else {
            vscode.window.showErrorMessage("删除类别失败");
          }
        }
      }
    }
  );

  // 注册重置数据命令
  let resetDataCommand = vscode.commands.registerCommand(
    "projectExplorer.resetData",
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        "确定要重置所有数据吗？此操作不可恢复！",
        { modal: true },
        "重置"
      );

      if (confirm === "重置") {
        projectManager.resetData();
        projectType.refresh();
        vscode.window.showInformationMessage("数据已重置");
      }
    }
  );

  // 注册导入导出命令
  let exportDataCommand = vscode.commands.registerCommand(
    "projectExplorer.exportData",
    async () => {
      await projectManager.exportData();
    }
  );

  let importDataCommand = vscode.commands.registerCommand(
    "projectExplorer.importData",
    async () => {
      await projectManager.importData();
      projectType.refresh(); // 刷新视图
    }
  );

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(() => {
      projectType.refresh();
    })
  );

  context.subscriptions.push(
    openCategoryProjectsCommand,
    addProjectCommand,
    addCurrentProjectCommand,
    renameProjectCommand,
    deleteProjectCommand,
    renameCategoryCommand,
    deleteCategoryCommand,
    resetDataCommand,
    exportDataCommand,
    importDataCommand,
    openProjectInCurrentWindowCommand
  );

  // 注册视图
  vscode.window.createTreeView("projectExplorer", {
    treeDataProvider: projectType,
  });
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
            "category"
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
            element.label // 添加父类别信息
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
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: "category" | "project",
    public readonly projectPath?: string,
    public readonly parent?: string
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

    if (type === "project" && projectPath) {
      this.command = {
        command: "vscode.openFolder",
        title: "Open Folder",
        arguments: [vscode.Uri.file(projectPath), { forceNewWindow: true }],
      };
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
    // ... 现有的 exportData 方法内容 ...
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
    // ... 现有的 importData 方法内容 ...
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

  // ... 其他所有 ProjectManager 类的方法 ...
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
