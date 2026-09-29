# 🛠️ IDE & Development Workflow Guide — Food Saver Direct Connect

This repository is pre-configured for seamless development with **VS Code**, **Cursor**, **WebStorm**, and command-line workflows.

---

## ⚡ Quick Start (1-Click & Commands)

### Option 1: VS Code 1-Click Launch (Recommended)
1. Open the repository root `foodsaver-direct-connect` in VS Code.
2. Press **`F5`** (or go to the **Run & Debug** panel `Ctrl+Shift+D`).
3. Select **`🚀 Full Stack (Backend + Chrome)`** or **`🚀 Full Stack (Backend + Edge)`** and hit **Play**.
   - Starts Express + Socket.io backend server on `http://localhost:4000` with Node debugger attached.
   - Starts Vite React frontend dev server on `http://localhost:5173`.
   - Opens browser window with full source map debugging enabled.

---

### Option 2: Workspace Task Runner (`tasks.json`)
- Press **`Ctrl+Shift+B`** (Build Task) or **`Ctrl+Shift+P`** → `Tasks: Run Task`.
- Available Tasks:
  - `🚀 Start Full Stack (Backend + Frontend)`
  - `npm: start - backend`
  - `npm: dev - frontend`
  - `📦 Install All Dependencies`
  - `🏗️ Build Frontend for Production`

---

### Option 3: Command Line (Root Scripts)
```bash
# Install dependencies across root, backend, and frontend
npm run install:all

# Run full stack concurrently
npm run dev

# Run only backend
npm run dev:backend

# Run only frontend
npm run dev:frontend
```

---

## 📁 VS Code Configuration Summary

| File Path | Description |
|---|---|
| [`.vscode/launch.json`](file:///d:/foodsaver-direct-connect/.vscode/launch.json) | Debug configurations for Node backend, Vite frontend (Chrome/Edge), and Full-Stack compound debugging. |
| [`.vscode/tasks.json`](file:///d:/foodsaver-direct-connect/.vscode/tasks.json) | Tasks for running, building, and installing backend & frontend modules. |
| [`.vscode/settings.json`](file:///d:/foodsaver-direct-connect/.vscode/settings.json) | Workspace formatting rules (Prettier), tab size (2 spaces), auto-imports, and search exclusions. |
| [`.vscode/extensions.json`](file:///d:/foodsaver-direct-connect/.vscode/extensions.json) | Recommended extensions (React, ESLint, Prettier, REST Client, Socket.io, GitLens). |
| [`foodsaver.code-workspace`](file:///d:/foodsaver-direct-connect/foodsaver.code-workspace) | Multi-root workspace file for structured tree view in VS Code Explorer. |
| [`foodsaver/backend/api-tests.http`](file:///d:/foodsaver-direct-connect/foodsaver/backend/api-tests.http) | In-editor REST API test playground compatible with the `humao.rest-client` VS Code extension. |

---

## 🌐 In-IDE REST API Testing

You can send live API requests directly inside VS Code without leaving your editor:
1. Install the **REST Client** extension (`humao.rest-client`).
2. Open [`foodsaver/backend/api-tests.http`](file:///d:/foodsaver-direct-connect/foodsaver/backend/api-tests.http).
3. Click **"Send Request"** above any request block (Health check, List items, Create bundle, Claim token).

---

## 🔌 Debugging & Breakpoints

- **Backend Breakpoints**: Set breakpoints in any file under `foodsaver/backend/src/`. Hit API endpoints using `api-tests.http` or the frontend web app to trigger breakpoints.
- **Frontend Breakpoints**: Set breakpoints in any React component in `foodsaver/frontend/src/`. The Chrome/Edge debugger attached in `launch.json` will pause execution directly inside VS Code!
