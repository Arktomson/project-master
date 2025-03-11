import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * 递归查找指定目录下的所有 JSON 文件
 * @param dir 要搜索的目录路径
 * @returns 所有找到的 JSON 文件路径数组
 */
async function findJsonFiles(dir: string): Promise<string[]> {
  let jsonFiles: string[] = [];
  const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));

  for (const [name, type] of items) {
    const fullPath = path.join(dir, name);
    if (type === vscode.FileType.Directory) {
      // 递归查找子目录中的 JSON 文件
      const subDirFiles = await findJsonFiles(fullPath);
      jsonFiles = jsonFiles.concat(subDirFiles);
    } else if (type === vscode.FileType.File && name.endsWith('.json')) {
      // 找到 JSON 文件，添加到结果列表
      jsonFiles.push(fullPath);
    }
  }

  return jsonFiles;
}

/**
 * 注册文件夹操作相关的命令
 * @param context 扩展上下文
 */
export function registerChoreCommands(context: vscode.ExtensionContext) {
  
  // 注册右键文件夹时更新代码片段的命令
  const updateSnippetsFromFolder = vscode.commands.registerCommand(
    "project-master.updateSnippetsFromFolder",
    async (uri: vscode.Uri) => {

      if (uri) {
        try {
          const folderPath = uri.fsPath;
          // 递归查找所有 JSON 文件
          const jsonFiles = await findJsonFiles(folderPath);
          
          if (jsonFiles.length === 0) {
            vscode.window.showInformationMessage(`未在 ${folderPath} 中找到任何 JSON 文件`);
            return;
          }

          for (const jsonFilePath of jsonFiles) {
            const fileName = path.basename(jsonFilePath);
            const snippetType = fileName.replace('.json', '');
            
            try {
              // 读取 JSON 文件内容
              const jsonContent = await vscode.workspace.fs.readFile(vscode.Uri.file(jsonFilePath));
              const contentStr = Buffer.from(jsonContent).toString('utf-8');
              const snippets = JSON.parse(contentStr);
              
              // 同时更新 VSCode、Windsurf 和 Cursor 的代码片段
              // 定义各平台和编辑器的路径
              const getUserDir = (app: string): string => {
                // Windows 路径
                if (process.platform === 'win32') {
                  const appData = process.env.APPDATA || '';
                  switch (app) {
                    case 'vscode':
                      return path.join(appData, 'Code/User');
                    case 'windsurf':
                      return path.join(appData, 'Windsurf/User');
                    case 'cursor':
                      return path.join(appData, 'Cursor/User');
                    default:
                      return '';
                  }
                }
                // macOS 路径
                else if (process.platform === 'darwin') {
                  const home = process.env.HOME || '';
                  switch (app) {
                    case 'vscode':
                      return path.join(home, 'Library/Application Support/Code/User');
                    case 'windsurf':
                      return path.join(home, 'Library/Application Support/Windsurf/User');
                    case 'cursor':
                      return path.join(home, 'Library/Application Support/Cursor/User');
                    default:
                      return '';
                  }
                }
                // Linux 路径
                else {
                  const home = process.env.HOME || '';
                  switch (app) {
                    case 'vscode':
                      return path.join(home, '.config/Code/User');
                    case 'windsurf':
                      return path.join(home, '.config/Windsurf/User');
                    case 'cursor':
                      return path.join(home, '.config/Cursor/User');
                    default:
                      return '';
                  }
                }
              };

              // 更新指定编辑器的代码片段
              const updateEditorSnippets = async (editorName: string, displayName: string) => {
                try {
                  const userDir = getUserDir(editorName);
                  if (!userDir) {
                    console.log(`无法确定 ${displayName} 的用户目录`);
                    return;
                  }
                  
                  const snippetsDir = path.join(userDir, 'snippets');
                  console.log(snippetsDir, `${displayName} Snippets Dir`);
                  
                  if (!fs.existsSync(snippetsDir)) {
                    fs.mkdirSync(snippetsDir, { recursive: true });
                  }
                  
                  const snippetPath = path.join(snippetsDir, `${snippetType}.json`);
                  await vscode.workspace.fs.writeFile(vscode.Uri.file(snippetPath), jsonContent);
                  console.log(`已成功写入 ${displayName} 的 ${snippetType} 代码片段到: ${snippetPath}`);
                } catch (error: any) {
                  vscode.window.showErrorMessage(`更新 ${displayName} 的 ${snippetType} 代码片段失败: ${error.message}`);
                }
              };
              
              // 更新所有编辑器的代码片段并收集结果
              const results = [];
              
              try {
                await updateEditorSnippets('vscode', 'VSCode');
                results.push('VSCode');
              } catch (error) {
                console.error('VSCode更新失败:', error);
              }
              
              try {
                await updateEditorSnippets('windsurf', 'Windsurf');
                results.push('Windsurf');
              } catch (error) {
                console.error('Windsurf更新失败:', error);
              }
              
              try {
                await updateEditorSnippets('cursor', 'Cursor');
                results.push('Cursor');
              } catch (error) {
                console.error('Cursor更新失败:', error);
              }
              
              // 最后统一显示更新成功的编辑器
              if (results.length > 0) {
                vscode.window.showInformationMessage(`已成功更新以下编辑器的 ${snippetType} 代码片段: ${results.join(', ')}`);
              }
              // 已经在上面的重构代码中更新了代码片段文件
            } catch (error: any) {
              vscode.window.showErrorMessage(`更新 ${snippetType} 代码片段失败: ${error.message}`);
            }
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`操作失败: ${error.message}`);
        }
      }
    }
  );

  context.subscriptions.push(updateSnippetsFromFolder);
}
