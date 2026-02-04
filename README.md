# Droid Resource Manager

[中文](#中文说明) | [English](#english-guide)

桌面端资源管理工具，用于管理 **Droids / Skills / MCP / Prompts / Rules** 等资源，基于 Electron + React + Vite 构建。

## 中文说明

### 功能概览
- **首页概览**：资源数量统计与“初始化资源”手动扫描。
- **Droids 管理**：全局/项目级 Droid 列表、详情查看、创建/复制、拖拽移动、工具与配置更新。
- **Skills 管理**：全局/项目级 Skills 列表、详情查看、创建/编辑/删除，AI 解读手动触发。
- **MCP 管理**：MCP 服务与工具列表查看。
- **Prompts 管理**：查看与管理 Prompt 资源。
- **Rules 管理**：查看与管理 Rule 资源。
- **资源市场**：资源市场入口与浏览。
- **设置**：导入/导出配置与基础设置。

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
- **Home**: resource counters and manual “Init Resources” scan.
- **Droids Manager**: global/project droids list, details, create/copy, drag-move, tools/config updates.
- **Skills Manager**: global/project skills list, details, create/edit/delete; AI summary is manual only.
- **MCP Manager**: list MCP servers and tools.
- **Prompts Manager**: manage prompt resources.
- **Rules Manager**: manage rule resources.
- **Marketplace**: browse resource marketplace.
- **Settings**: import/export settings and basic configuration.

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
