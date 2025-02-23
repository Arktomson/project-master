import * as vscode from "vscode";

interface DragState {
  isDragging: boolean;
  sourceEditor?: vscode.TextEditor;
  dragStartTime?: number;
}

export function registerTabDragDropEvents(context: vscode.ExtensionContext) {
  console.log("注册标签页拖拽事件...");
  let dragState: DragState = {
    isDragging: false,
  };

  // 监听所有编辑器事件
  const editorChangeDisposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      console.log("编辑器内容改变:", {
        fileName: event.document.fileName,
        reason: event.reason,
      });
    }
  );

  // 监听拖拽开始事件
  const dragStartDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        const currentTime = Date.now();

        // 如果当前没有处于拖拽状态，记录开始拖拽
        if (!dragState.isDragging) {
          dragState = {
            isDragging: true,
            sourceEditor: editor,
            dragStartTime: currentTime,
          };

          console.log("开始拖拽标签页:", {
            fileName: editor.document.fileName,
            languageId: editor.document.languageId,
            viewColumn: editor.viewColumn,
          });

          // 显示状态栏消息
          vscode.window.setStatusBarMessage("正在拖拽标签页...");
        }
      }
    }
  );

  // 监听拖拽过程中的事件
  const dragDisposable = vscode.window.onDidChangeVisibleTextEditors(
    (editors) => {
      if (dragState.isDragging) {
        const currentTime = Date.now();

        // 计算拖拽持续时间
        if (dragState.dragStartTime) {
          const dragDuration = currentTime - dragState.dragStartTime;
          console.log("拖拽持续时间:", dragDuration + "ms");
        }

        // 记录可见编辑器的变化
        console.log("编辑器布局变化:", {
          visibleEditorsCount: editors.length,
          editorPositions: editors.map((e) => ({
            fileName: e.document.fileName,
            viewColumn: e.viewColumn,
          })),
        });
      }
    }
  );

  // 监听放置事件
  const dropDisposable = vscode.window.onDidChangeTextEditorViewColumn(
    (event) => {
      if (dragState.isDragging && dragState.sourceEditor) {
        // 确认是否为同一个编辑器
        if (event.textEditor.document === dragState.sourceEditor.document) {
          console.log("标签页已放置:", {
            fileName: event.textEditor.document.fileName,
            fromColumn: dragState.sourceEditor.viewColumn,
            toColumn: event.textEditor.viewColumn,
          });

          // 重置拖拽状态
          dragState = {
            isDragging: false,
          };

          // 清除状态栏消息
          vscode.window.setStatusBarMessage("");

          // 触发自定义事件或执行其他操作
          handleTabDropped(event.textEditor);
        }
      }
    }
  );

  // 注册这些事件到上下文中
  context.subscriptions.push(editorChangeDisposable);
  context.subscriptions.push(dragStartDisposable);
  context.subscriptions.push(dragDisposable);
  context.subscriptions.push(dropDisposable);

  // 显示通知，表明事件已注册
  vscode.window.showInformationMessage("标签页拖拽事件已注册");
}

function handleTabDropped(editor: vscode.TextEditor) {
  // 这里可以添加标签页放置后的自定义处理逻辑
  // 例如：更新UI、触发其他操作等
  vscode.window.showInformationMessage(
    `标签页已移动到新位置: ${editor.viewColumn}`
  );
}
