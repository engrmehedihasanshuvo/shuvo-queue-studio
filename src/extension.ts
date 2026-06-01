import * as vscode from "vscode";
import { chatWithOllama, listOllamaModels } from "./ollama";
import { TaskQueue } from "./queue";
import { getWebviewHtml } from "./webview";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1:8b";

export function activate(context: vscode.ExtensionContext) {
  const queue = new TaskQueue();
  const panelState = { panel: undefined as vscode.WebviewPanel | undefined };

  const getConfig = () => vscode.workspace.getConfiguration("cursorQueueAssistant");

  const getSelectedModel = () =>
    context.globalState.get<string>("cursorQueueAssistant.model") ??
    getConfig().get<string>("model", DEFAULT_MODEL);

  const refreshPanel = () => {
    if (!panelState.panel) {
      return;
    }

    const baseUrl = getConfig().get<string>("ollamaBaseUrl", DEFAULT_BASE_URL);
    const model = getSelectedModel();
    panelState.panel.webview.html = getWebviewHtml(
      panelState.panel.webview,
      queue.getAll(),
      model,
      baseUrl,
    );
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
      refreshPanel();
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
    refreshPanel();
    panelState.panel?.reveal(vscode.ViewColumn.One);
  };

  const runQueue = async () => {
    const baseUrl = getConfig().get<string>("ollamaBaseUrl", DEFAULT_BASE_URL);
    const model = getSelectedModel();

    await queue.runSequentially(async (task) => {
      refreshPanel();
      return await chatWithOllama({
        baseUrl,
        model,
        prompt: task.prompt,
        systemPrompt:
          "You are a coding assistant. Return concise, practical output.",
      });
    });

    refreshPanel();
  };

  const openPanel = async () => {
    if (panelState.panel) {
      panelState.panel.reveal(vscode.ViewColumn.One);
      refreshPanel();
      return;
    }

    panelState.panel = vscode.window.createWebviewPanel(
      "cursorQueueAssistant",
      "Cursor Queue Assistant",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );

    panelState.panel.onDidDispose(() => {
      panelState.panel = undefined;
    });

    panelState.panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "addTask") {
        const prompt = String(message.prompt ?? "").trim();
        if (!prompt) {
          vscode.window.showWarningMessage("Enter a task first.");
          return;
        }
        queue.add(prompt);
        refreshPanel();
        return;
      }

      if (message.type === "clearQueue") {
        queue.clear();
        refreshPanel();
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
          refreshPanel();
        } catch (error) {
          vscode.window.showErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    });

    refreshPanel();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorQueueAssistant.open", openPanel),
    vscode.commands.registerCommand("cursorQueueAssistant.chooseModel", async () => {
      await chooseModel();
      await openPanel();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.addTask", async () => {
      await addTask();
      await openPanel();
    }),
    vscode.commands.registerCommand("cursorQueueAssistant.runQueue", async () => {
      await openPanel();
      await runQueue();
    }),
  );
}

export function deactivate() {}
