# Shuvo Queue Studio

A minimal VS Code extension scaffold for a Cursor-like queued task workflow with local Ollama model selection.

This project is intended to be open source and portable across macOS, Windows, and Linux.

License: MIT

## What it does
- Opens a simple webview panel
- Lets you add tasks to a FIFO queue
- Runs queued tasks one by one through a local Ollama model
- Lets you choose the active local model from `http://localhost:11434`

## Next steps
- Add streaming output in the panel
- Add file edit/apply actions
- Add task persistence across VS Code restarts
- Add richer command palette and sidebar integration

## Build

```bash
npm install
npm run compile
```

## Run

Open the project in VS Code and press `F5` to launch the Extension Development Host.

## Supported Platforms

- macOS
- Windows
- Linux

The only runtime dependency is a working local Ollama server at `http://localhost:11434`.
