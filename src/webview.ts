import * as vscode from "vscode";
import { QueueTask } from "./queue";

export function getWebviewHtml(webview: vscode.Webview, tasks: QueueTask[], model: string, baseUrl: string): string {
  const nonce = Date.now().toString();
  const taskItems =
    tasks.length === 0
      ? "<li><em>No tasks yet. Add a task, then run queue.</em></li>"
      : tasks
          .map((task, index) => {
            return `<li><strong>#${index + 1} ${escapeHtml(task.status)}</strong> - ${escapeHtml(task.prompt)}${task.output ? `<pre>${escapeHtml(task.output)}</pre>` : ""}${task.error ? `<pre class=error>${escapeHtml(task.error)}</pre>` : ""}</li>`;
          })
          .join("");

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <style>
      body { font-family: sans-serif; padding: 16px; color: #ddd; background: #111; }
      input, button, textarea { width: 100%; margin: 6px 0; padding: 8px; box-sizing: border-box; }
      textarea { min-height: 110px; }
      button { cursor: pointer; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      ul { padding-left: 18px; }
      li { margin-bottom: 12px; }
      pre { white-space: pre-wrap; background: #1f1f1f; padding: 8px; border-radius: 6px; }
      .error { color: #ff8a8a; }
      .meta { color: #aaa; font-size: 12px; }
    </style>
  </head>
  <body>
    <h2>Shuvo Queue Studio</h2>
    <div class="meta">Model: ${escapeHtml(model)} | Ollama: ${escapeHtml(baseUrl)}</div>
    <textarea id="prompt" placeholder="Describe the task you want the local model to handle..."></textarea>
    <div class="row">
      <button id="addTask">Add Task</button>
      <button id="runQueue">Run Queue</button>
    </div>
    <div class="row">
      <button id="chooseModel">Choose Local Model</button>
      <button id="clearQueue">Clear Queue</button>
    </div>
    <h3>Queued Tasks</h3>
    <ul id="tasks">${taskItems}</ul>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.getElementById('addTask').addEventListener('click', () => {
        const prompt = document.getElementById('prompt').value;
        vscode.postMessage({ type: 'addTask', prompt });
      });
      document.getElementById('runQueue').addEventListener('click', () => vscode.postMessage({ type: 'runQueue' }));
      document.getElementById('chooseModel').addEventListener('click', () => vscode.postMessage({ type: 'chooseModel' }));
      document.getElementById('clearQueue').addEventListener('click', () => vscode.postMessage({ type: 'clearQueue' }));
    </script>
  </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
