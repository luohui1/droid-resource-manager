# Droid Resource Manager

桌面端资源管理工具，用于管理 **Droids / Skills / MCP** 以及项目工作流执行，基于 Electron + React + Vite 构建。

## 中文说明

### 功能概览
- **Droids 管理**：全局/项目级 Droid 列表、详情、复制与运行。
- **Skills 管理**：全局/项目级 Skills 列表、详情查看，AI 解读改为手动触发。
- **MCP 管理**：统一查看与管理 MCP 服务与工具。
- **任务调度**：任务创建、执行、日志与状态追踪。
- **缓存优化**：Droids/Skills 加载结果持久化缓存，支持手动刷新。
- **手动初始化**：首页提供“初始化资源”按钮，按需扫描资源。

### 环境要求
- Node.js 18+（推荐 20）
- npm 9+
- Windows 10/11（当前 release 为 Windows 构建）

### 启动与开发
```bash
npm install
npm run dev
```

### 构建
```bash
npm run build
```

### 打包（生成 release 安装包）
```bash
npm run dist
```

### Git LFS 说明
release 目录下的 exe 已使用 Git LFS 跟踪：
```bash
git lfs install
git lfs pull
```

## English Guide

### Overview
- **Droids Manager**: global/project droids list, detail, copy, and run.
- **Skills Manager**: global/project skills list, detail viewer; AI summary is manual only.
- **MCP Manager**: manage MCP servers and tools in one place.
- **Task Scheduler**: create tasks, monitor status, and view logs.
- **Caching**: persisted cache for droids/skills with manual refresh.
- **Manual Init**: Home page provides “Init Resources” to scan on demand.

### Requirements
- Node.js 18+ (20 recommended)
- npm 9+
- Windows 10/11 (current release targets Windows)

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Distribution (installer)
```bash
npm run dist
```

### Git LFS
Release executables are tracked with LFS:
```bash
git lfs install
git lfs pull
```
