import * as vscode from "vscode";
import { chatWithOllama, listOllamaModels } from "./ollama";
import { TaskQueue } from "./queue";
import { getWebviewHtml } from "./webview";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1:8b";

export function activate(context: vscode.ExtensionContext) {
  const queue = new TaskQueue();
  const panelState = { panel: undefined as vscode.WebviewPanel | undefined };
  const sidebarState = { view: undefined as vscode.WebviewView | undefined };

  const getConfig = () => vscode.workspace.getConfiguration("cursorQueueAssistant");

  const getSelectedModel = () =>
    context.globalState.get<string>("cursorQueueAssistant.model") ??
    getConfig().get<string>("model", DEFAULT_MODEL);

  const setWebviewContent = (webview: vscode.Webview) => {
    const baseUrl = getConfig().get<string>("ollamaBaseUrl", DEFAULT_BASE_URL);
    const model = getSelectedModel();
    webview.html = getWebviewHtml(webview, queue.getAll(), model, baseUrl);
  };

  const refreshViews = () => {
    if (panelState.panel) {
      setWebviewContent(panelState.panel.webview);
    }

    if (sidebarState.view) {
      setWebviewContent(sidebarState.view.webview);
    }
  };

  const chooseModel = async () => {
    const baseUrl = getConfig().get<string>("ollamaBaseUrl", DEFAULT_BASE_URL);
    const models = await listOllamaModels(baseUrl);

    if (models.length === 0) {
      vscode.window.showInformationMessage("No Ollama models found.");
      return;
    }

    const picked = await vscode.window.showQuickPick(
      models.map((model) => model.name),
      { placeHolder: "Choose a local Ollama model" },
    );

    if (picked) {
      await context.globalState.update("cursorQueueAssistant.model", picked);
      refreshViews();
    }
  };

  const addTask = async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: "Describe the task you want the local model to handle",
      placeHolder: "Summarize a file, refactor a function, explain an error...",
    });

    const trimmed = prompt?.trim();
    if (!trimmed) {
      return;
    }

    queue.add(trimmed);
    refreshViews();
    panelState.panel?.reveal(vscode.ViewColumn.One);
    await focusSidebarView();
  };

  const runQueue = async () => {
    const baseUrl = getConfig().get<string>("ollamaBaseUrl", DEFAULT_BASE_URL);
    const model = getSelectedModel();

    await queue.runSequentially(
      async (task) => {
        refreshViews();
        return await chatWithOllama({
          baseUrl,
          model,
          prompt: task.prompt,
          systemPrompt:
            "You are a coding assistant. Return concise, practical output.",
        });
      },
      () => {
        refreshViews();
      },
    );

    refreshViews();

    const tasks = queue.getAll();
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const failedCount = tasks.filter((task) => task.status === "failed").length;
    vscode.window.showInformationMessage(
      `Queue finished. Done: ${doneCount}, Failed: ${failedCount}`,
    );
  };

  const handleIncomingMessage = async (message: { type?: string; prompt?: string }) => {
    if (message.type === "addTask") {
      const prompt = String(message.prompt ?? "").trim();
      if (!prompt) {
        vscode.window.showWarningMessage("Enter a task first.");
        return;
      }
      queue.add(prompt);
      refreshViews();
      return;
    }

    if (message.type === "clearQueue") {
      queue.clear();
      refreshViews();
      return;
    }

    if (message.type === "chooseModel") {
      try {
        await chooseModel();
      } catch (error) {
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }

    if (message.type === "runQueue") {
      try {
        await runQueue();
        refreshViews();
      } catch (error) {
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  };

  const focusSidebarView = async () => {
    await vscode.commands.executeCommand("workbench.view.explorer");
    await vscode.commands.executeCommand("shuvoQueueStudioView.focus");
  };

  const openPanel = async () => {
    if (panelState.panel) {
      panelState.panel.reveal(vscode.ViewColumn.One);
      refreshViews();
      return;
    }

    panelState.panel = vscode.window.createWebviewPanel(
      "cursorQueueAssistant",
      "Shuvo Queue Studio",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );

    panelState.panel.onDidDispose(() => {
      panelState.panel = undefined;
    });

    panelState.panel.webview.onDidReceiveMessage(handleIncomingMessage);
    refreshViews();
  };

  const viewProvider: vscode.WebviewViewProvider = {
    resolveWebviewView(webviewView) {
      sidebarState.view = webviewView;
      webviewView.webview.options = {
        enableScripts: true,
      };

      webviewView.onDidDispose(() => {
        sidebarState.view = undefined;
      });

      webviewView.webview.onDidReceiveMessage(handleIncomingMessage);
      setWebviewContent(webviewView.webview);
    },
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("shuvoQueueStudioView", viewProvider),
    vscode.commands.registerCommand("cursorQueueAssistant.open", async () => {
      await focusSidebarView();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.chooseModel", async () => {
      await chooseModel();
      await focusSidebarView();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.addTask", async () => {
      await addTask();
      await focusSidebarView();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.runQueue", async () => {
      await focusSidebarView();
      await runQueue();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.openPanel", openPanel),
  );

  void (async () => {
    const didAutoReveal = context.globalState.get<boolean>(
      "shuvoQueueStudio.didAutoReveal",
      false,
    );
    if (!didAutoReveal) {
      await focusSidebarView();
      await context.globalState.update("shuvoQueueStudio.didAutoReveal", true);
    }
  })();
}

export function deactivate() {}
