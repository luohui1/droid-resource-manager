"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const os = require("os");
const net = require("net");
const GLOBAL_SKILLS_PATH = path.join(os.homedir(), ".factory", "skills");
const SKILL_SCAN_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "dist-electron", "release", ".git"]);
function parseFrontmatter$3(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  try {
    const yamlStr = match[1];
    const body = match[2];
    const frontmatter = { name: "" };
    yamlStr.split("\n").forEach((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    });
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}
function scanSkillsDir(skillsDir, scope, projectPath) {
  const skills = [];
  if (!fs.existsSync(skillsDir)) return skills;
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      const skillDir = path.join(skillsDir, entry.name);
      if (!entry.isDirectory()) {
        if (!entry.isSymbolicLink()) continue;
        try {
          const stat = fs.statSync(skillDir);
          if (!stat.isDirectory()) continue;
        } catch {
          continue;
        }
      }
      let resolvedSkillDir = skillDir;
      let mdPath = null;
      const skillMdPath = path.join(resolvedSkillDir, "SKILL.md");
      const skillMdxPath = path.join(resolvedSkillDir, "skill.mdx");
      mdPath = fs.existsSync(skillMdPath) ? skillMdPath : fs.existsSync(skillMdxPath) ? skillMdxPath : null;
      if (!mdPath) {
        const subEntries = fs.readdirSync(resolvedSkillDir, { withFileTypes: true });
        const nested = subEntries.filter((sub) => sub.isDirectory()).map((sub) => path.join(resolvedSkillDir, sub.name)).map((dir) => {
          const nestedMd = path.join(dir, "SKILL.md");
          const nestedMdx = path.join(dir, "skill.mdx");
          if (fs.existsSync(nestedMd)) return { dir, mdPath: nestedMd };
          if (fs.existsSync(nestedMdx)) return { dir, mdPath: nestedMdx };
          return null;
        }).filter((item) => Boolean(item));
        if (nested.length === 0) continue;
        resolvedSkillDir = nested[0].dir;
        mdPath = nested[0].mdPath;
      }
      const content = fs.readFileSync(mdPath, "utf-8");
      const { frontmatter } = parseFrontmatter$3(content);
      const files = fs.readdirSync(resolvedSkillDir).filter((f) => f !== "SKILL.md" && f !== "skill.mdx" && f !== "AI_SUMMARY.md");
      const aiSummaryPath = path.join(resolvedSkillDir, "AI_SUMMARY.md");
      const aiSummary = fs.existsSync(aiSummaryPath) ? fs.readFileSync(aiSummaryPath, "utf-8") : void 0;
      skills.push({
        name: frontmatter?.name || path.basename(resolvedSkillDir),
        description: frontmatter?.description || "",
        content,
        path: resolvedSkillDir,
        scope,
        projectPath,
        files,
        aiSummary
      });
    }
  } catch (e) {
    console.error("扫描 skills 目录失败:", e);
  }
  return skills;
}
function getGlobalSkills() {
  return scanSkillsDir(GLOBAL_SKILLS_PATH, "global");
}
function discoverSkillProjects(rootPath, maxDepth = 4) {
  const results = /* @__PURE__ */ new Set();
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const factorySkillsPath = path.join(dir, ".factory", "skills");
    try {
      if (fs.existsSync(factorySkillsPath) && fs.statSync(factorySkillsPath).isDirectory()) {
        results.add(dir);
      }
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKILL_SCAN_SKIP_DIRS.has(entry.name)) continue;
      if (entry.name === ".factory") continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  };
  walk(rootPath, 0);
  return Array.from(results);
}
function getProjectSkills(projectPath) {
  const skillsDir = path.join(projectPath, ".factory", "skills");
  return scanSkillsDir(skillsDir, "project", projectPath);
}
function getSkill(skillPath) {
  const skillMdPath = path.join(skillPath, "SKILL.md");
  const skillMdxPath = path.join(skillPath, "skill.mdx");
  const mdPath = fs.existsSync(skillMdPath) ? skillMdPath : fs.existsSync(skillMdxPath) ? skillMdxPath : null;
  if (!mdPath) return null;
  const content = fs.readFileSync(mdPath, "utf-8");
  const { frontmatter } = parseFrontmatter$3(content);
  const files = fs.readdirSync(skillPath).filter((f) => f !== "SKILL.md" && f !== "skill.mdx" && f !== "AI_SUMMARY.md");
  const isGlobal = skillPath.startsWith(GLOBAL_SKILLS_PATH);
  const aiSummaryPath = path.join(skillPath, "AI_SUMMARY.md");
  const aiSummary = fs.existsSync(aiSummaryPath) ? fs.readFileSync(aiSummaryPath, "utf-8") : void 0;
  return {
    name: frontmatter?.name || path.basename(skillPath),
    description: frontmatter?.description || "",
    content,
    path: skillPath,
    scope: isGlobal ? "global" : "project",
    files,
    aiSummary
  };
}
function createSkill(name, content, scope, projectPath) {
  try {
    const dirName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    const baseDir = scope === "global" ? GLOBAL_SKILLS_PATH : path.join(projectPath, ".factory", "skills");
    const skillDir = path.join(baseDir, dirName);
    if (fs.existsSync(skillDir)) {
      return { success: false, error: "同名 Skill 已存在" };
    }
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
    return { success: true, path: skillDir };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function updateSkill(skillPath, content) {
  try {
    const mdPath = path.join(skillPath, "SKILL.md");
    fs.writeFileSync(mdPath, content, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function deleteSkill(skillPath) {
  try {
    fs.rmSync(skillPath, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function getGlobalSkillsPath() {
  return GLOBAL_SKILLS_PATH;
}
function readSkillFile(skillPath, fileName) {
  try {
    const filePath = path.join(skillPath, fileName);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function saveSkillFile(skillPath, fileName, content) {
  try {
    const filePath = path.join(skillPath, fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function deleteSkillFile(skillPath, fileName) {
  try {
    const filePath = path.join(skillPath, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function saveAiSummary$1(skillPath, summary) {
  try {
    const summaryPath = path.join(skillPath, "AI_SUMMARY.md");
    fs.writeFileSync(summaryPath, summary, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
function importSkillFolder(sourcePath, scope, projectPath) {
  try {
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
      return { success: false, error: "无效的文件夹路径" };
    }
    const skillMdPath = path.join(sourcePath, "SKILL.md");
    const skillMdxPath = path.join(sourcePath, "skill.mdx");
    if (!fs.existsSync(skillMdPath) && !fs.existsSync(skillMdxPath)) {
      return { success: false, error: "文件夹中没有 SKILL.md 或 skill.mdx 文件" };
    }
    const folderName = path.basename(sourcePath);
    const baseDir = scope === "global" ? GLOBAL_SKILLS_PATH : path.join(projectPath, ".factory", "skills");
    const destPath = path.join(baseDir, folderName);
    if (fs.existsSync(destPath)) {
      return { success: false, error: `同名 Skill "${folderName}" 已存在` };
    }
    copyDir(sourcePath, destPath);
    return { success: true, path: destPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function importSkillFolders(sourcePaths, scope, projectPath) {
  const errors = [];
  let success = 0;
  let failed = 0;
  for (const sourcePath of sourcePaths) {
    const result = importSkillFolder(sourcePath, scope, projectPath);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${path.basename(sourcePath)}: ${result.error}`);
    }
  }
  return { success, failed, errors };
}
function importSkillsFromDirectory(dirPath, scope, projectPath) {
  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return { success: 0, failed: 0, errors: ["无效的目录路径"] };
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const skillFolders = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderPath = path.join(dirPath, entry.name);
      const hasSkillMd = fs.existsSync(path.join(folderPath, "SKILL.md")) || fs.existsSync(path.join(folderPath, "skill.mdx"));
      if (hasSkillMd) {
        skillFolders.push(folderPath);
      }
    }
    if (skillFolders.length === 0) {
      const hasSkillMd = fs.existsSync(path.join(dirPath, "SKILL.md")) || fs.existsSync(path.join(dirPath, "skill.mdx"));
      if (hasSkillMd) {
        const result = importSkillFolder(dirPath, scope, projectPath);
        return {
          success: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          errors: result.error ? [result.error] : []
        };
      }
      return { success: 0, failed: 0, errors: ["目录中没有找到有效的 Skill"] };
    }
    return importSkillFolders(skillFolders, scope, projectPath);
  } catch (e) {
    return { success: 0, failed: 0, errors: [e.message] };
  }
}
function extractZip(zipPath) {
  try {
    const tempDir = path.join(os.tmpdir(), `skills-import-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    if (process.platform === "win32") {
      child_process.execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, {
        windowsHide: true
      });
    } else {
      child_process.execSync(`unzip -q "${zipPath}" -d "${tempDir}"`);
    }
    return tempDir;
  } catch (e) {
    console.error("解压失败:", e);
    return null;
  }
}
function cleanupTempDir(tempDir) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
  }
}
function importSkillsFromZip(zipPath, scope, projectPath) {
  const tempDir = extractZip(zipPath);
  if (!tempDir) {
    return { success: 0, failed: 0, errors: ["解压 ZIP 文件失败"] };
  }
  try {
    const result = importSkillsFromDirectory(tempDir, scope, projectPath);
    return result;
  } finally {
    cleanupTempDir(tempDir);
  }
}
function copySkill(sourcePath, targetScope, targetProjectPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "源 Skill 不存在" };
    }
    const skillName = path.basename(sourcePath);
    const targetBaseDir = targetScope === "global" ? GLOBAL_SKILLS_PATH : path.join(targetProjectPath, ".factory", "skills");
    const targetPath = path.join(targetBaseDir, skillName);
    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Skill: ${skillName}` };
    }
    fs.mkdirSync(targetBaseDir, { recursive: true });
    copyDirRecursive$1(sourcePath, targetPath);
    return { success: true, path: targetPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function moveSkill(sourcePath, targetScope, targetProjectPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "源 Skill 不存在" };
    }
    const skillName = path.basename(sourcePath);
    const targetBaseDir = targetScope === "global" ? GLOBAL_SKILLS_PATH : path.join(targetProjectPath, ".factory", "skills");
    const targetPath = path.join(targetBaseDir, skillName);
    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Skill: ${skillName}` };
    }
    fs.mkdirSync(targetBaseDir, { recursive: true });
    try {
      fs.renameSync(sourcePath, targetPath);
    } catch (e) {
      const err = e;
      if (err.code !== "EXDEV") {
        throw e;
      }
      copyDirRecursive$1(sourcePath, targetPath);
      fs.rmSync(sourcePath, { recursive: true, force: true });
    }
    return { success: true, path: targetPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function copyDirRecursive$1(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive$1(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
const TOOL_CATEGORIES = {
  "read-only": ["Read", "LS", "Grep", "Glob"],
  "all": [
    "Read",
    "LS",
    "Grep",
    "Glob",
    "Create",
    "Edit",
    "ApplyPatch",
    "Execute",
    "WebSearch",
    "FetchUrl",
    "TodoWrite"
  ],
  "edit": ["Create", "Edit", "ApplyPatch"],
  "execute": ["Execute"],
  "web": ["WebSearch", "FetchUrl"]
};
const ALL_TOOLS = [
  "Read",
  "LS",
  "Grep",
  "Glob",
  "Create",
  "Edit",
  "ApplyPatch",
  "Execute",
  "WebSearch",
  "FetchUrl",
  "TodoWrite"
];
const GLOBAL_DROIDS_PATH = path.join(os.homedir(), ".factory", "droids");
const CONFIG_DIR = path.join(os.homedir(), ".factory", "droid-configs");
const DROID_SCAN_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "dist-electron", "release", ".git"]);
function parseFrontmatter$2(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  try {
    const yamlStr = match[1];
    const body = match[2];
    const frontmatter = { name: "" };
    let currentKey = "";
    let inArray = false;
    const arrayItems = [];
    yamlStr.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (inArray && trimmed.startsWith("- ")) {
        arrayItems.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
        return;
      } else if (inArray && !trimmed.startsWith("- ") && trimmed) {
        frontmatter[currentKey] = arrayItems.length > 0 ? [...arrayItems] : [];
        inArray = false;
        arrayItems.length = 0;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (!value) {
          currentKey = key;
          inArray = true;
          arrayItems.length = 0;
        } else if (value.startsWith("[") && value.endsWith("]")) {
          const items = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
          frontmatter[key] = items.filter(Boolean);
        } else {
          frontmatter[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    });
    if (inArray && arrayItems.length > 0) {
      frontmatter[currentKey] = [...arrayItems];
    }
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}
function generateFrontmatter(droid) {
  const lines = ["---"];
  if (droid.name) lines.push(`name: ${droid.name}`);
  if (droid.description) lines.push(`description: ${droid.description}`);
  if (droid.model) lines.push(`model: ${droid.model}`);
  if (droid.reasoningEffort) lines.push(`reasoningEffort: ${droid.reasoningEffort}`);
  if (droid.tools) {
    if (typeof droid.tools === "string") {
      lines.push(`tools: ${droid.tools}`);
    } else if (Array.isArray(droid.tools)) {
      lines.push(`tools: [${droid.tools.map((t) => `"${t}"`).join(", ")}]`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
function loadDroidConfig(droidName) {
  try {
    const configPath = path.join(CONFIG_DIR, `${droidName}.json`);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.error(`加载 Droid 配置失败 [${droidName}]:`, e);
  }
  return void 0;
}
function saveDroidConfig(droidName, config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const configPath = path.join(CONFIG_DIR, `${droidName}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function moveDroid(sourcePath, targetScope, targetProjectPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "源 Droid 不存在" };
    }
    const targetBaseDir = targetScope === "global" ? GLOBAL_DROIDS_PATH : path.join(targetProjectPath, ".factory", "droids");
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetBaseDir, fileName);
    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Droid: ${fileName}` };
    }
    fs.mkdirSync(targetBaseDir, { recursive: true });
    let droidName = null;
    try {
      const content = fs.readFileSync(sourcePath, "utf-8");
      const { frontmatter } = parseFrontmatter$2(content);
      droidName = frontmatter?.name || null;
    } catch {
      droidName = null;
    }
    try {
      fs.renameSync(sourcePath, targetPath);
    } catch (e) {
      const err = e;
      if (err.code !== "EXDEV") {
        throw e;
      }
      fs.copyFileSync(sourcePath, targetPath);
      fs.rmSync(sourcePath, { force: true });
    }
    if (droidName) {
      const sourceSummary = path.join(path.dirname(sourcePath), `${droidName}.summary.md`);
      const targetSummary = path.join(targetBaseDir, `${droidName}.summary.md`);
      if (fs.existsSync(sourceSummary)) {
        fs.rmSync(targetSummary, { force: true });
        try {
          fs.renameSync(sourceSummary, targetSummary);
        } catch (e) {
          const err = e;
          if (err.code === "EXDEV") {
            fs.copyFileSync(sourceSummary, targetSummary);
            fs.rmSync(sourceSummary, { force: true });
          } else {
            throw e;
          }
        }
      }
    }
    return { success: true, path: targetPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function scanDroidsDir(droidsDir, scope, projectPath) {
  const droids = [];
  if (!fs.existsSync(droidsDir)) return droids;
  try {
    const entries = fs.readdirSync(droidsDir, { withFileTypes: true });
    const droidFiles = [];
    for (const entry of entries) {
      const entryPath = path.join(droidsDir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) {
        droidFiles.push(entryPath);
        continue;
      }
      if (entry.isDirectory()) {
        const nestedEntries = fs.readdirSync(entryPath, { withFileTypes: true });
        for (const nested of nestedEntries) {
          if (nested.isFile() && nested.name.endsWith(".md")) {
            droidFiles.push(path.join(entryPath, nested.name));
          }
        }
      }
    }
    for (const filePath of droidFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter$2(content);
      if (!frontmatter?.name) continue;
      let tools = [];
      if (frontmatter.tools) {
        if (typeof frontmatter.tools === "string") {
          if (frontmatter.tools in TOOL_CATEGORIES) {
            tools = frontmatter.tools;
          } else {
            tools = [frontmatter.tools];
          }
        } else if (Array.isArray(frontmatter.tools)) {
          tools = frontmatter.tools;
        }
      }
      const config = loadDroidConfig(frontmatter.name);
      const summaryPath = path.join(path.dirname(filePath), `${frontmatter.name}.summary.md`);
      const aiSummary = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, "utf-8") : void 0;
      droids.push({
        name: frontmatter.name,
        description: frontmatter.description || "",
        model: frontmatter.model || "inherit",
        reasoningEffort: frontmatter.reasoningEffort,
        tools,
        systemPrompt: body.trim(),
        content,
        path: filePath,
        scope,
        projectPath,
        config,
        aiSummary
      });
    }
  } catch (e) {
    console.error("扫描 droids 目录失败:", e);
  }
  return droids;
}
function getGlobalDroids() {
  return scanDroidsDir(GLOBAL_DROIDS_PATH, "global");
}
function getProjectDroids(projectPath) {
  const droidsDir = path.join(projectPath, ".factory", "droids");
  return scanDroidsDir(droidsDir, "project", projectPath);
}
function discoverDroidProjects(rootPath, maxDepth = 4) {
  const results = /* @__PURE__ */ new Set();
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const factoryDroidsPath = path.join(dir, ".factory", "droids");
    try {
      if (fs.existsSync(factoryDroidsPath) && fs.statSync(factoryDroidsPath).isDirectory()) {
        results.add(dir);
      }
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (DROID_SCAN_SKIP_DIRS.has(entry.name)) continue;
      if (entry.name === ".factory") continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  };
  walk(rootPath, 0);
  return Array.from(results);
}
function getDroid(droidPath) {
  if (!fs.existsSync(droidPath)) return null;
  const content = fs.readFileSync(droidPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter$2(content);
  if (!frontmatter?.name) return null;
  let tools = [];
  if (frontmatter.tools) {
    if (typeof frontmatter.tools === "string") {
      if (frontmatter.tools in TOOL_CATEGORIES) {
        tools = frontmatter.tools;
      } else {
        tools = [frontmatter.tools];
      }
    } else if (Array.isArray(frontmatter.tools)) {
      tools = frontmatter.tools;
    }
  }
  const isGlobal = droidPath.startsWith(GLOBAL_DROIDS_PATH);
  const config = loadDroidConfig(frontmatter.name);
  const dir = path.dirname(droidPath);
  const summaryPath = path.join(dir, `${frontmatter.name}.summary.md`);
  const aiSummary = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, "utf-8") : void 0;
  return {
    name: frontmatter.name,
    description: frontmatter.description || "",
    model: frontmatter.model || "inherit",
    reasoningEffort: frontmatter.reasoningEffort,
    tools,
    systemPrompt: body.trim(),
    content,
    path: droidPath,
    scope: isGlobal ? "global" : "project",
    config,
    aiSummary
  };
}
function createDroid(data, scope, projectPath) {
  try {
    const normalizedName = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    const baseDir = scope === "global" ? GLOBAL_DROIDS_PATH : path.join(projectPath, ".factory", "droids");
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const filePath = path.join(baseDir, `${normalizedName}.md`);
    if (fs.existsSync(filePath)) {
      return { success: false, error: "同名 Droid 已存在" };
    }
    const frontmatter = generateFrontmatter({
      name: normalizedName,
      description: data.description,
      model: data.model || "inherit",
      reasoningEffort: data.reasoningEffort,
      tools: data.tools
    });
    const content = `${frontmatter}

${data.systemPrompt}`;
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function updateDroid(droidPath, data) {
  try {
    const existing = getDroid(droidPath);
    if (!existing) {
      return { success: false, error: "Droid 不存在" };
    }
    const updated = {
      name: data.name || existing.name,
      description: data.description ?? existing.description,
      model: data.model || existing.model,
      reasoningEffort: data.reasoningEffort || existing.reasoningEffort,
      tools: data.tools ?? existing.tools,
      systemPrompt: data.systemPrompt ?? existing.systemPrompt
    };
    const frontmatter = generateFrontmatter(updated);
    const content = `${frontmatter}

${updated.systemPrompt}`;
    fs.writeFileSync(droidPath, content, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function deleteDroid(droidPath) {
  try {
    if (fs.existsSync(droidPath)) {
      const droid = getDroid(droidPath);
      fs.unlinkSync(droidPath);
      if (droid?.name) {
        const configPath = path.join(CONFIG_DIR, `${droid.name}.json`);
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
        const summaryPath = path.join(path.dirname(droidPath), `${droid.name}.summary.md`);
        if (fs.existsSync(summaryPath)) {
          fs.unlinkSync(summaryPath);
        }
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function getGlobalDroidsPath() {
  return GLOBAL_DROIDS_PATH;
}
function saveAiSummary(droidPath, droidName, summary) {
  try {
    const dir = path.dirname(droidPath);
    const summaryPath = path.join(dir, `${droidName}.summary.md`);
    fs.writeFileSync(summaryPath, summary, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function getAllTools() {
  return [...ALL_TOOLS];
}
function getToolCategories() {
  return { ...TOOL_CATEGORIES };
}
function copyDroid(sourcePath, targetScope, targetProjectPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "源 Droid 不存在" };
    }
    const fileName = path.basename(sourcePath);
    const droidName = fileName.replace(".md", "");
    const targetBaseDir = targetScope === "global" ? GLOBAL_DROIDS_PATH : path.join(targetProjectPath, ".factory", "droids");
    const targetPath = path.join(targetBaseDir, fileName);
    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Droid: ${droidName}` };
    }
    fs.mkdirSync(targetBaseDir, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const sourceDir = path.dirname(sourcePath);
    const summaryPath = path.join(sourceDir, `${droidName}.summary.md`);
    if (fs.existsSync(summaryPath)) {
      fs.copyFileSync(summaryPath, path.join(targetBaseDir, `${droidName}.summary.md`));
    }
    return { success: true, path: targetPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
const PROMPTS_PATH = "D:\\work\\AI\\prompt";
function parseFrontmatter$1(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  try {
    const yamlStr = match[1];
    const body = match[2];
    const frontmatter = { name: "" };
    yamlStr.split("\n").forEach((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if (key === "variables" || key === "linkedResources") {
          value = value.split(",").map((v) => v.trim()).filter(Boolean);
        }
        frontmatter[key] = value;
      }
    });
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}
function extractVariables(content) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}
function scanPromptsDir() {
  const prompts = [];
  if (!fs.existsSync(PROMPTS_PATH)) {
    fs.mkdirSync(PROMPTS_PATH, { recursive: true });
    return prompts;
  }
  try {
    const entries = fs.readdirSync(PROMPTS_PATH, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const promptDir = path.join(PROMPTS_PATH, entry.name);
      const promptMdPath = path.join(promptDir, "PROMPT.md");
      if (!fs.existsSync(promptMdPath)) continue;
      const content = fs.readFileSync(promptMdPath, "utf-8");
      const { frontmatter, body } = parseFrontmatter$1(content);
      prompts.push({
        name: frontmatter?.name || entry.name,
        description: frontmatter?.description || "",
        content: body,
        path: promptDir,
        category: frontmatter?.category,
        variables: frontmatter?.variables || extractVariables(body),
        linkedResources: frontmatter?.linkedResources
      });
    }
  } catch (e) {
    console.error("扫描 prompts 目录失败:", e);
  }
  return prompts;
}
function getPrompts() {
  return scanPromptsDir();
}
function getPrompt(promptPath) {
  const promptMdPath = path.join(promptPath, "PROMPT.md");
  if (!fs.existsSync(promptMdPath)) return null;
  const content = fs.readFileSync(promptMdPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter$1(content);
  return {
    name: frontmatter?.name || path.basename(promptPath),
    description: frontmatter?.description || "",
    content: body,
    path: promptPath,
    category: frontmatter?.category,
    variables: frontmatter?.variables || extractVariables(body),
    linkedResources: frontmatter?.linkedResources
  };
}
function createPrompt(name, content, description = "", category = "template", linkedResources = []) {
  try {
    const safeName = name.replace(/[<>:"/\\|?*]/g, "-");
    const promptDir = path.join(PROMPTS_PATH, safeName);
    if (fs.existsSync(promptDir)) {
      return { success: false, error: "同名 Prompt 已存在" };
    }
    fs.mkdirSync(promptDir, { recursive: true });
    const variables = extractVariables(content);
    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      variables.length > 0 ? `variables: ${variables.join(", ")}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(", ")}` : null,
      "---"
    ].filter(Boolean).join("\n");
    const fullContent = `${frontmatter}
${content}`;
    fs.writeFileSync(path.join(promptDir, "PROMPT.md"), fullContent, "utf-8");
    return { success: true, path: promptDir };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function updatePrompt(promptPath, content, description = "", category = "template", linkedResources = []) {
  try {
    const promptMdPath = path.join(promptPath, "PROMPT.md");
    if (!fs.existsSync(promptMdPath)) {
      return { success: false, error: "Prompt 不存在" };
    }
    const name = path.basename(promptPath);
    const variables = extractVariables(content);
    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      variables.length > 0 ? `variables: ${variables.join(", ")}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(", ")}` : null,
      "---"
    ].filter(Boolean).join("\n");
    const fullContent = `${frontmatter}
${content}`;
    fs.writeFileSync(promptMdPath, fullContent, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function deletePrompt(promptPath) {
  try {
    if (!fs.existsSync(promptPath)) {
      return { success: false, error: "Prompt 不存在" };
    }
    fs.rmSync(promptPath, { recursive: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function getPromptsPath() {
  return PROMPTS_PATH;
}
function getPromptsCount() {
  return scanPromptsDir().length;
}
const GLOBAL_RULES_PATH = path.join(os.homedir(), ".factory", "rules");
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  try {
    const yamlStr = match[1];
    const body = match[2];
    const frontmatter = { name: "" };
    yamlStr.split("\n").forEach((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if (key === "globs" || key === "linkedResources") {
          value = value.split(",").map((v) => v.trim()).filter(Boolean);
        } else if (key === "priority") {
          value = parseInt(value) || 0;
        }
        frontmatter[key] = value;
      }
    });
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}
function scanRulesDir(rulesDir, scope, projectPath) {
  const rules = [];
  if (!fs.existsSync(rulesDir)) {
    if (scope === "global") {
      fs.mkdirSync(rulesDir, { recursive: true });
    }
    return rules;
  }
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ruleDir = path.join(rulesDir, entry.name);
      const ruleMdPath = path.join(ruleDir, "RULE.md");
      if (!fs.existsSync(ruleMdPath)) continue;
      const content = fs.readFileSync(ruleMdPath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      rules.push({
        name: frontmatter?.name || entry.name,
        description: frontmatter?.description || "",
        content: body,
        path: ruleDir,
        scope,
        projectPath,
        category: frontmatter?.category,
        priority: frontmatter?.priority,
        globs: frontmatter?.globs,
        linkedResources: frontmatter?.linkedResources
      });
    }
  } catch (e) {
    console.error("扫描 rules 目录失败:", e);
  }
  return rules;
}
function getGlobalRules() {
  return scanRulesDir(GLOBAL_RULES_PATH, "global");
}
function getProjectRules(projectPath) {
  const rulesDir = path.join(projectPath, ".factory", "rules");
  return scanRulesDir(rulesDir, "project", projectPath);
}
function getRule(rulePath) {
  const ruleMdPath = path.join(rulePath, "RULE.md");
  if (!fs.existsSync(ruleMdPath)) return null;
  const content = fs.readFileSync(ruleMdPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);
  const isGlobal = rulePath.startsWith(GLOBAL_RULES_PATH);
  return {
    name: frontmatter?.name || path.basename(rulePath),
    description: frontmatter?.description || "",
    content: body,
    path: rulePath,
    scope: isGlobal ? "global" : "project",
    category: frontmatter?.category,
    priority: frontmatter?.priority,
    globs: frontmatter?.globs,
    linkedResources: frontmatter?.linkedResources
  };
}
function createRule(name, content, scope, projectPath, description = "", category = "coding-style", priority = 0, globs = [], linkedResources = []) {
  try {
    const safeName = name.replace(/[<>:"/\\|?*]/g, "-");
    const baseDir = scope === "global" ? GLOBAL_RULES_PATH : path.join(projectPath, ".factory", "rules");
    const ruleDir = path.join(baseDir, safeName);
    if (fs.existsSync(ruleDir)) {
      return { success: false, error: "同名 Rule 已存在" };
    }
    fs.mkdirSync(ruleDir, { recursive: true });
    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      `priority: ${priority}`,
      globs.length > 0 ? `globs: ${globs.join(", ")}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(", ")}` : null,
      "---"
    ].filter(Boolean).join("\n");
    const fullContent = `${frontmatter}
${content}`;
    fs.writeFileSync(path.join(ruleDir, "RULE.md"), fullContent, "utf-8");
    return { success: true, path: ruleDir };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function updateRule(rulePath, content, description = "", category = "coding-style", priority = 0, globs = [], linkedResources = []) {
  try {
    const ruleMdPath = path.join(rulePath, "RULE.md");
    if (!fs.existsSync(ruleMdPath)) {
      return { success: false, error: "Rule 不存在" };
    }
    const name = path.basename(rulePath);
    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      `priority: ${priority}`,
      globs.length > 0 ? `globs: ${globs.join(", ")}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(", ")}` : null,
      "---"
    ].filter(Boolean).join("\n");
    const fullContent = `${frontmatter}
${content}`;
    fs.writeFileSync(ruleMdPath, fullContent, "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function deleteRule(rulePath) {
  try {
    if (!fs.existsSync(rulePath)) {
      return { success: false, error: "Rule 不存在" };
    }
    fs.rmSync(rulePath, { recursive: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function getGlobalRulesPath() {
  return GLOBAL_RULES_PATH;
}
function getGlobalRulesCount() {
  return getGlobalRules().length;
}
function copyRule(sourcePath, targetScope, targetProjectPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "源 Rule 不存在" };
    }
    const ruleName = path.basename(sourcePath);
    const targetBaseDir = targetScope === "global" ? GLOBAL_RULES_PATH : path.join(targetProjectPath, ".factory", "rules");
    const targetPath = path.join(targetBaseDir, ruleName);
    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Rule: ${ruleName}` };
    }
    fs.mkdirSync(targetBaseDir, { recursive: true });
    copyDirRecursive(sourcePath, targetPath);
    return { success: true, path: targetPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
const isDev = !electron.app.isPackaged;
let mainWindow = null;
const DATA_FILE = path.join(electron.app.getPath("userData"), "droid-resources.json");
const MCP_CONFIG_PATH = path.join(os.homedir(), ".factory", "mcp.json");
const RESOURCE_CENTER_PATH = "D:\\work\\AI";
const RESOURCE_CENTER_MCP_PATH = path.join(RESOURCE_CENTER_PATH, ".factory", "mcp.json");
const WINDOWS_DRIVE_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
function getWindowsDrives() {
  return WINDOWS_DRIVE_LETTERS.map((letter) => `${letter}:\\`).filter((drive) => {
    try {
      return fs.existsSync(drive);
    } catch {
      return false;
    }
  });
}
const mcpConnections = /* @__PURE__ */ new Map();
const httpConnections = /* @__PURE__ */ new Map();
function createWindow() {
  const iconPath = isDev ? path.join(electron.app.getAppPath(), "public", "icon.ico") : path.join(electron.app.getAppPath(), "dist", "icon.ico");
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false
    },
    frame: true,
    show: true,
    backgroundColor: "#f9fafb"
  });
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load data:", e);
  }
  return { resources: [], tags: [] };
}
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to save data:", e);
    return false;
  }
}
function loadMcpConfig() {
  try {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load MCP config:", e);
  }
  return { mcpServers: {} };
}
function saveMcpConfig(config) {
  try {
    const dir = path.dirname(MCP_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to save MCP config:", e);
    return false;
  }
}
function loadResourceCenterMcpConfig() {
  try {
    if (fs.existsSync(RESOURCE_CENTER_MCP_PATH)) {
      return JSON.parse(fs.readFileSync(RESOURCE_CENTER_MCP_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load resource center MCP config:", e);
  }
  return { mcpServers: {} };
}
function saveResourceCenterMcpConfig(config) {
  try {
    const dir = path.dirname(RESOURCE_CENTER_MCP_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RESOURCE_CENTER_MCP_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to save resource center MCP config:", e);
    return false;
  }
}
function resolveMcpPort(name, server) {
  const envPort = server.env?.BROWSERMCP_PORT || server.env?.PORT;
  if (envPort) {
    const parsed = Number(envPort);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (name.toLowerCase().includes("browsermcp")) {
    return 9009;
  }
  return null;
}
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}
function extractNpmSpec(args) {
  if (!args || args.length === 0) return null;
  const spec = args.find((arg) => !arg.startsWith("-"));
  if (!spec) return null;
  if (spec.startsWith("@")) {
    const lastAt = spec.lastIndexOf("@");
    if (lastAt > 0) {
      return { name: spec.slice(0, lastAt), version: spec.slice(lastAt + 1) };
    }
    return { name: spec };
  }
  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: spec.slice(0, atIndex), version: spec.slice(atIndex + 1) };
  }
  return { name: spec };
}
function compareVersions(a, b) {
  const [baseA] = a.split("-");
  const [baseB] = b.split("-");
  const partsA = baseA.split(".").map((n) => Number(n));
  const partsB = baseB.split(".").map((n) => Number(n));
  const max = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < max; i += 1) {
    const left = partsA[i] ?? 0;
    const right = partsB[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}
async function mcpCheckUpdate(name) {
  const config = loadMcpConfig();
  const server = config.mcpServers[name];
  if (!server) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  const command = server.command || "";
  if (!command.toLowerCase().includes("npx")) {
    return { success: false, error: "仅支持通过 npx 启动的 MCP 更新检查" };
  }
  const spec = extractNpmSpec(server.args);
  if (!spec) {
    return { success: false, error: "未找到 npm 包信息" };
  }
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(spec.name)}`);
    if (!response.ok) {
      return { success: false, error: `查询失败: ${response.status}` };
    }
    const data = await response.json();
    const latest = data?.["dist-tags"]?.latest;
    if (!latest) {
      return { success: false, error: "未获取到 latest 版本" };
    }
    const current = spec.version || "latest";
    const updateAvailable = current !== "latest" && compareVersions(current, latest) < 0;
    return {
      success: true,
      packageName: spec.name,
      currentVersion: current,
      latestVersion: latest,
      updateAvailable
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function sendMcpRequest(conn, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++conn.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params: params || {}
    };
    const record = {
      id,
      method,
      params,
      startTime: Date.now()
    };
    conn.callHistory.push(record);
    if (conn.callHistory.length > 100) conn.callHistory.shift();
    conn.pendingRequests.set(id, {
      resolve: (result) => {
        record.result = result;
        record.endTime = Date.now();
        record.duration = record.endTime - record.startTime;
        resolve(result);
      },
      reject: (error) => {
        record.error = error.message;
        record.endTime = Date.now();
        record.duration = record.endTime - record.startTime;
        reject(error);
      },
      method,
      startTime: Date.now()
    });
    const requestStr = JSON.stringify(request);
    conn.logs.push(`[send] ${requestStr}`);
    if (conn.logs.length > 100) conn.logs.shift();
    console.log(`[${conn.name}] Sending:`, requestStr);
    conn.process.stdin?.write(requestStr + "\n");
    setTimeout(() => {
      if (conn.pendingRequests.has(id)) {
        conn.pendingRequests.delete(id);
        record.error = "Request timeout";
        record.endTime = Date.now();
        record.duration = record.endTime - record.startTime;
        reject(new Error("Request timeout"));
      }
    }, 3e4);
  });
}
async function sendHttpRequest(conn, server, method, params) {
  const id = ++conn.requestId;
  const record = {
    id,
    method,
    params,
    startTime: Date.now()
  };
  conn.callHistory.push(record);
  if (conn.callHistory.length > 100) conn.callHistory.shift();
  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...server.headers || {}
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params: params || {}
      })
    });
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || "Remote error");
    }
    record.result = json.result;
    record.endTime = Date.now();
    record.duration = record.endTime - record.startTime;
    return json.result;
  } catch (e) {
    record.error = e.message;
    record.endTime = Date.now();
    record.duration = record.endTime - record.startTime;
    throw e;
  }
}
function handleMcpResponse(conn, data) {
  const lines = data.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      conn.logs.push(`[recv] ${line}`);
      if (conn.logs.length > 100) conn.logs.shift();
      console.log(`[${conn.name}] Received:`, line);
      if (response.id !== void 0) {
        const pending = conn.pendingRequests.get(response.id);
        if (pending) {
          conn.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message || "Unknown error"));
          } else {
            pending.resolve(response.result);
          }
        }
      }
    } catch {
      if (line.trim()) {
        conn.logs.push(`[output] ${line}`);
        if (conn.logs.length > 100) conn.logs.shift();
      }
    }
  }
}
async function mcpConnect(name) {
  const config = loadMcpConfig();
  const server = config.mcpServers[name];
  if (!server) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  if (server.type === "http") {
    const conn = httpConnections.get(name) || {
      name,
      connected: void 0,
      tools: [],
      callHistory: [],
      requestId: 0
    };
    try {
      const initResult = await sendHttpRequest(conn, server, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "droid-resource-manager", version: "1.0.0" }
      });
      conn.serverInfo = initResult.serverInfo;
      conn.connected = true;
      conn.lastChecked = Date.now();
      const toolsResult = await sendHttpRequest(conn, server, "tools/list", {});
      conn.tools = toolsResult.tools || [];
      httpConnections.set(name, conn);
      return { success: true, serverInfo: conn.serverInfo, tools: conn.tools };
    } catch (e) {
      conn.connected = false;
      conn.lastChecked = Date.now();
      httpConnections.set(name, conn);
      return { success: false, error: `连接失败: ${e.message}` };
    }
  }
  if (!server.command) {
    return { success: false, error: `服务器 "${name}" 没有配置 command` };
  }
  const portToCheck = resolveMcpPort(name, server);
  if (portToCheck) {
    const available = await checkPortAvailable(portToCheck);
    if (!available) {
      return { success: false, error: `端口 ${portToCheck} 已被占用，请关闭占用程序或修改端口后重试` };
    }
  }
  if (mcpConnections.has(name)) {
    await mcpDisconnect(name);
  }
  try {
    const env = { ...process.env, ...server.env };
    const proc = child_process.spawn(server.command, server.args || [], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    const conn = {
      name,
      process: proc,
      pid: proc.pid,
      startTime: Date.now(),
      logs: [],
      tools: [],
      connected: false,
      pendingRequests: /* @__PURE__ */ new Map(),
      requestId: 0,
      callHistory: []
    };
    mcpConnections.set(name, conn);
    proc.stdout?.on("data", (data) => {
      handleMcpResponse(conn, data.toString());
    });
    proc.stderr?.on("data", (data) => {
      const line = `[stderr] ${data.toString().trim()}`;
      conn.logs.push(line);
      if (conn.logs.length > 100) conn.logs.shift();
      console.error(`[${name}]`, line);
    });
    proc.on("error", (err) => {
      conn.logs.push(`[error] ${err.message}`);
      conn.connected = false;
    });
    proc.on("exit", (code, signal) => {
      conn.logs.push(`[exit] code=${code}, signal=${signal}`);
      conn.connected = false;
      mcpConnections.delete(name);
    });
    const initResult = await sendMcpRequest(conn, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "droid-resource-manager", version: "1.0.0" }
    });
    conn.serverInfo = initResult.serverInfo;
    conn.connected = true;
    const toolsResult = await sendMcpRequest(conn, "tools/list", {});
    conn.tools = toolsResult.tools || [];
    return {
      success: true,
      serverInfo: conn.serverInfo,
      tools: conn.tools
    };
  } catch (e) {
    mcpConnections.delete(name);
    return { success: false, error: `连接失败: ${e.message}` };
  }
}
async function mcpDisconnect(name) {
  const conn = mcpConnections.get(name);
  if (conn) {
    try {
      if (process.platform === "win32") {
        child_process.spawn("taskkill", ["/pid", conn.pid.toString(), "/f", "/t"], { shell: true });
      } else {
        conn.process.kill("SIGTERM");
      }
      mcpConnections.delete(name);
      return { success: true };
    } catch (e) {
      return { success: false, error: `断开失败: ${e.message}` };
    }
  }
  if (httpConnections.has(name)) {
    httpConnections.delete(name);
    return { success: true };
  }
  return { success: false, error: `服务器 "${name}" 未连接` };
}
async function mcpCallTool(name, toolName, args) {
  const conn = mcpConnections.get(name);
  if (conn) {
    if (!conn.connected) {
      return { success: false, error: `服务器 "${name}" 未连接` };
    }
    try {
      const result = await sendMcpRequest(conn, "tools/call", {
        name: toolName,
        arguments: args
      });
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  const httpConn = httpConnections.get(name);
  const config = loadMcpConfig();
  const server = config.mcpServers[name];
  if (server?.type === "http" && httpConn) {
    try {
      const result = await sendHttpRequest(httpConn, server, "tools/call", {
        name: toolName,
        arguments: args
      });
      httpConn.connected = true;
      httpConn.lastChecked = Date.now();
      httpConnections.set(name, httpConn);
      return { success: true, result };
    } catch (e) {
      httpConn.connected = false;
      httpConn.lastChecked = Date.now();
      httpConnections.set(name, httpConn);
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: `服务器 "${name}" 未连接` };
}
function mcpGetConnectionStatus(name) {
  const conn = mcpConnections.get(name);
  if (conn) {
    return {
      name: conn.name,
      pid: conn.pid,
      startTime: conn.startTime,
      uptime: Date.now() - conn.startTime,
      connected: conn.connected,
      serverInfo: conn.serverInfo,
      tools: conn.tools,
      logs: conn.logs.slice(-30),
      callHistory: conn.callHistory.slice(-20)
    };
  }
  const httpConn = httpConnections.get(name);
  if (httpConn) {
    return {
      name: httpConn.name,
      connected: httpConn.connected,
      lastChecked: httpConn.lastChecked,
      serverInfo: httpConn.serverInfo,
      tools: httpConn.tools,
      callHistory: httpConn.callHistory.slice(-20)
    };
  }
  return null;
}
function mcpList() {
  const config = loadMcpConfig();
  const servers = Object.entries(config.mcpServers).map(([name, server]) => {
    const conn = mcpConnections.get(name);
    const httpConn = httpConnections.get(name);
    return {
      name,
      type: server.type,
      disabled: server.disabled ?? false,
      command: server.command,
      args: server.args,
      url: server.url,
      env: server.env || {},
      headers: server.headers || {},
      // 连接状态
      connected: server.type === "http" ? httpConn?.connected : conn?.connected ?? false,
      pid: conn?.pid,
      startTime: conn?.startTime,
      lastChecked: httpConn?.lastChecked,
      serverInfo: (server.type === "http" ? httpConn?.serverInfo : conn?.serverInfo) || void 0,
      tools: server.type === "http" ? httpConn?.tools || [] : conn?.tools || [],
      logs: conn?.logs.slice(-20) || [],
      callHistory: server.type === "http" ? httpConn?.callHistory.slice(-10) || [] : conn?.callHistory.slice(-10) || []
    };
  });
  return {
    configPath: MCP_CONFIG_PATH,
    servers
  };
}
function resourceCenterMcpList() {
  const config = loadResourceCenterMcpConfig();
  const servers = Object.entries(config.mcpServers).map(([name, server]) => ({
    name,
    type: server.type,
    disabled: server.disabled ?? false,
    command: server.command,
    args: server.args,
    url: server.url,
    env: server.env || {},
    headers: server.headers || {},
    connected: false,
    tools: []
  }));
  return {
    configPath: RESOURCE_CENTER_MCP_PATH,
    servers
  };
}
function resourceCenterMcpAdd(name, serverConfig) {
  const config = loadResourceCenterMcpConfig();
  if (config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 已存在` };
  }
  config.mcpServers[name] = serverConfig;
  return { success: saveResourceCenterMcpConfig(config) };
}
function mcpEnable(name) {
  const config = loadMcpConfig();
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  config.mcpServers[name].disabled = false;
  return { success: saveMcpConfig(config) };
}
function mcpDisable(name) {
  const config = loadMcpConfig();
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  config.mcpServers[name].disabled = true;
  return { success: saveMcpConfig(config) };
}
function mcpAdd(name, serverConfig) {
  const config = loadMcpConfig();
  if (config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 已存在` };
  }
  config.mcpServers[name] = serverConfig;
  return { success: saveMcpConfig(config) };
}
function mcpRemove(name) {
  const config = loadMcpConfig();
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  if (mcpConnections.has(name)) {
    mcpDisconnect(name);
  }
  delete config.mcpServers[name];
  return { success: saveMcpConfig(config) };
}
function mcpUpdate(name, serverConfig) {
  const config = loadMcpConfig();
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` };
  }
  config.mcpServers[name] = { ...config.mcpServers[name], ...serverConfig };
  return { success: saveMcpConfig(config) };
}
electron.ipcMain.handle("load-data", () => loadData());
electron.ipcMain.handle("save-data", (_, data) => saveData(data));
electron.ipcMain.handle("get-data-path", () => DATA_FILE);
electron.ipcMain.handle("export-data", async (_, data) => {
  const result = await electron.dialog.showSaveDialog(mainWindow, {
    title: "导出资源数据",
    defaultPath: "droid-resources.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  }
  return false;
});
electron.ipcMain.handle("import-data", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "导入资源数据",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      return JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
});
electron.ipcMain.handle("open-external", (_, url) => electron.shell.openExternal(url));
const MARKETPLACE_HOSTS = /* @__PURE__ */ new Set(["mcp.so", "www.mcp.so", "smithery.ai"]);
const MARKETPLACE_CACHE_TTL = 60 * 60 * 1e3;
const MARKETPLACE_MIN_INTERVAL = 5e3;
const marketplaceCache = /* @__PURE__ */ new Map();
const marketplaceHostLastFetch = /* @__PURE__ */ new Map();
let marketplaceQueue = Promise.resolve();
const MARKETPLACE_SKILL_AGENT = "opencode";
async function waitForMarketplaceSlot(host) {
  const last = marketplaceHostLastFetch.get(host) || 0;
  const delta = Date.now() - last;
  if (delta < MARKETPLACE_MIN_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MARKETPLACE_MIN_INTERVAL - delta));
  }
  marketplaceHostLastFetch.set(host, Date.now());
}
async function fetchMarketplaceHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DroidResourceManager/1.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const text = await response.text();
  return { status: response.status, text };
}
async function fetchMarketplaceHtmlWithRetry(url) {
  const cached = marketplaceCache.get(url);
  if (cached && Date.now() - cached.timestamp < MARKETPLACE_CACHE_TTL) {
    return { status: cached.status, text: cached.text };
  }
  const delays = [2e3, 4e3, 8e3];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const { status, text } = await fetchMarketplaceHtml(url);
    marketplaceCache.set(url, { timestamp: Date.now(), status, text });
    if (status !== 429) {
      return { status, text };
    }
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  }
  const last = await fetchMarketplaceHtml(url);
  marketplaceCache.set(url, { timestamp: Date.now(), status: last.status, text: last.text });
  return last;
}
function runSkillsAddCommand(url) {
  return new Promise((resolve) => {
    const args = ["--yes", "skills", "add", url, "--agent", MARKETPLACE_SKILL_AGENT];
    const proc = child_process.spawn("npx", args, {
      cwd: RESOURCE_CENTER_PATH,
      shell: true,
      windowsHide: true
    });
    let output = "";
    let error = "";
    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ success: false, output, error: "命令执行超时" });
    }, 12e4);
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      error += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ success: true, output: output.trim() });
      } else {
        resolve({ success: false, output: output.trim(), error: error.trim() || `退出码 ${code}` });
      }
    });
  });
}
electron.ipcMain.handle("marketplace-fetch", async (_, url) => {
  try {
    const parsed = new URL(url);
    if (!MARKETPLACE_HOSTS.has(parsed.hostname)) {
      return { success: false, error: "仅支持 mcp.so 或 smithery.ai 的链接" };
    }
    const result = await (marketplaceQueue = marketplaceQueue.then(async () => {
      await waitForMarketplaceSlot(parsed.hostname);
      const { status, text } = await fetchMarketplaceHtmlWithRetry(url);
      if (status >= 400) {
        const error = status === 429 ? "请求过于频繁，请稍后再试" : `HTTP ${status}`;
        return { success: false, status, error };
      }
      return { success: true, status, text };
    }));
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("marketplace-skill-import", async (_, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "smithery.ai") {
      return { success: false, error: "仅支持 smithery.ai 的 skill 链接" };
    }
    return await runSkillsAddCommand(url);
  } catch (e) {
    return { success: false, output: "", error: e.message };
  }
});
electron.ipcMain.handle("mcp-list", () => mcpList());
electron.ipcMain.handle("mcp-enable", (_, name) => mcpEnable(name));
electron.ipcMain.handle("mcp-disable", (_, name) => mcpDisable(name));
electron.ipcMain.handle("mcp-connect", (_, name) => mcpConnect(name));
electron.ipcMain.handle("mcp-disconnect", (_, name) => mcpDisconnect(name));
electron.ipcMain.handle("mcp-call-tool", (_, name, toolName, args) => mcpCallTool(name, toolName, args));
electron.ipcMain.handle("mcp-get-status", (_, name) => mcpGetConnectionStatus(name));
electron.ipcMain.handle("mcp-check-update", (_, name) => mcpCheckUpdate(name));
electron.ipcMain.handle("mcp-add", (_, name, config) => mcpAdd(name, config));
electron.ipcMain.handle("mcp-remove", (_, name) => mcpRemove(name));
electron.ipcMain.handle("mcp-update", (_, name, config) => mcpUpdate(name, config));
electron.ipcMain.handle("mcp-get-config-path", () => MCP_CONFIG_PATH);
electron.ipcMain.handle("resource-center-list", () => ({
  basePath: RESOURCE_CENTER_PATH,
  mcp: resourceCenterMcpList(),
  skills: getProjectSkills(RESOURCE_CENTER_PATH),
  droids: getProjectDroids(RESOURCE_CENTER_PATH)
}));
electron.ipcMain.handle("resource-center-mcp-add", (_, name, config) => resourceCenterMcpAdd(name, config));
electron.ipcMain.handle("resource-center-skill-create", (_, name, content) => createSkill(name, content, "project", RESOURCE_CENTER_PATH));
const AI_SETTINGS_FILE = path.join(electron.app.getPath("userData"), "ai-settings.json");
const DEFAULT_AI_SETTINGS = {
  url: "http://43.134.190.112:3000/v1/chat/completions",
  apiKey: "sk-0bMcBMw1fzFb0uh71WydfaE9dihEcdo97OcxigcwrzqabAZA",
  model: "gpt-4o-mini",
  skillsModel: "gpt-4o-mini"
};
function loadAISettings() {
  try {
    if (fs.existsSync(AI_SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, "utf-8"));
      return { ...DEFAULT_AI_SETTINGS, ...saved };
    }
  } catch (e) {
    console.error("加载AI设置失败:", e);
  }
  return DEFAULT_AI_SETTINGS;
}
function saveAISettings(settings) {
  try {
    fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("保存AI设置失败:", e);
    return false;
  }
}
electron.ipcMain.handle("ai-get-settings", () => loadAISettings());
electron.ipcMain.handle("ai-save-settings", (_, settings) => saveAISettings(settings));
async function fetchModelList(settings) {
  try {
    const baseUrl = settings.url.replace(/\/chat\/completions$/, "").replace(/\/v1$/, "");
    const modelsUrl = `${baseUrl}/v1/models`;
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.data || []).map((m) => ({
      id: m.id,
      name: m.name || m.id
    }));
  } catch (e) {
    console.error("获取模型列表失败:", e);
    return [];
  }
}
electron.ipcMain.handle("ai-fetch-models", async () => {
  const settings = loadAISettings();
  return fetchModelList(settings);
});
async function translateToolDescription(description) {
  const settings = loadAISettings();
  try {
    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "system",
            content: "你是一个翻译助手。将用户提供的MCP工具描述翻译成简洁的中文，只返回翻译结果，不要添加任何解释。"
          },
          {
            role: "user",
            content: description
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || description;
  } catch (e) {
    console.error("AI翻译失败:", e);
    return description;
  }
}
async function explainSkill(skillContent) {
  const settings = loadAISettings();
  try {
    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.skillsModel || settings.model,
        // 优先使用 skillsModel
        messages: [
          {
            role: "system",
            content: `你是一个专业的技术文档分析师。请分析用户提供的 Skill 文件，用中文生成结构化的解读。

请严格按照以下格式输出（使用 Markdown）：

## 概述
用1-2句话简要说明这个 Skill 是什么、做什么用的。

## 核心功能
- 功能点1
- 功能点2
- 功能点3

## 使用场景
描述在什么情况下应该使用这个 Skill。

## 使用方法
1. 第一步
2. 第二步
3. 第三步

## 注意事项
- 注意点1
- 注意点2

要求：
- 语言简洁专业
- 每个部分都要有内容
- 功能点和步骤要具体明确
- 不要添加额外的标题或格式`
          },
          {
            role: "user",
            content: skillContent
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "无法生成解释";
  } catch (e) {
    console.error("AI解释失败:", e);
    return `解释生成失败: ${e.message}`;
  }
}
electron.ipcMain.handle("ai-translate", (_, text) => translateToolDescription(text));
electron.ipcMain.handle("ai-explain-skill", (_, content) => explainSkill(content));
electron.ipcMain.handle("skills-generate-ai-summary", async (_, skillPath, content) => {
  try {
    const summary = await explainSkill(content);
    if (summary && !summary.startsWith("解释生成失败")) {
      saveAiSummary$1(skillPath, summary);
      return { success: true, summary };
    }
    return { success: false, error: summary };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("skills-save-ai-summary", (_, skillPath, summary) => saveAiSummary$1(skillPath, summary));
electron.ipcMain.handle("skills-get-global", () => getGlobalSkills());
electron.ipcMain.handle("skills-discover-work", () => {
  const drives = getWindowsDrives();
  const projects = drives.flatMap((drive) => discoverSkillProjects(drive));
  return Array.from(new Set(projects));
});
electron.ipcMain.handle("skills-get-project", (_, projectPath) => getProjectSkills(projectPath));
electron.ipcMain.handle("skills-get", (_, skillPath) => getSkill(skillPath));
electron.ipcMain.handle("skills-create", (_, name, content, scope, projectPath) => createSkill(name, content, scope, projectPath));
electron.ipcMain.handle("skills-update", (_, skillPath, content) => updateSkill(skillPath, content));
electron.ipcMain.handle("skills-delete", (_, skillPath) => deleteSkill(skillPath));
electron.ipcMain.handle("skills-get-global-path", () => getGlobalSkillsPath());
electron.ipcMain.handle("skills-read-file", (_, skillPath, fileName) => readSkillFile(skillPath, fileName));
electron.ipcMain.handle("skills-save-file", (_, skillPath, fileName, content) => saveSkillFile(skillPath, fileName, content));
electron.ipcMain.handle("skills-delete-file", (_, skillPath, fileName) => deleteSkillFile(skillPath, fileName));
electron.ipcMain.handle("skills-select-project", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "选择项目目录",
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("skills-import-folder", async (_, scope, projectPath) => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "选择要导入的 Skill 文件夹",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  return importSkillFolder(result.filePaths[0], scope, projectPath);
});
electron.ipcMain.handle("skills-import-directory", async (_, scope, projectPath) => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "选择包含多个 Skills 的目录（如解压后的文件夹）",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: 0, failed: 0, errors: [], canceled: true };
  }
  return { ...importSkillsFromDirectory(result.filePaths[0], scope, projectPath), canceled: false };
});
electron.ipcMain.handle("skills-import-zip", async (_, scope, projectPath) => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "选择 Skills ZIP 压缩包",
    filters: [{ name: "ZIP 文件", extensions: ["zip"] }],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: 0, failed: 0, errors: [], canceled: true };
  }
  return { ...importSkillsFromZip(result.filePaths[0], scope, projectPath), canceled: false };
});
electron.ipcMain.handle("skills-copy", (_, sourcePath, targetScope, targetProjectPath) => copySkill(sourcePath, targetScope, targetProjectPath));
electron.ipcMain.handle("skills-move", (_, sourcePath, targetScope, targetProjectPath) => moveSkill(sourcePath, targetScope, targetProjectPath));
electron.ipcMain.handle("droids-get-global", () => getGlobalDroids());
electron.ipcMain.handle("droids-discover-work", () => {
  const drives = getWindowsDrives();
  const projects = drives.flatMap((drive) => discoverDroidProjects(drive));
  return Array.from(new Set(projects));
});
electron.ipcMain.handle("droids-get-project", (_, projectPath) => getProjectDroids(projectPath));
electron.ipcMain.handle("droids-get", (_, droidPath) => getDroid(droidPath));
electron.ipcMain.handle("droids-create", (_, data, scope, projectPath) => createDroid(data, scope, projectPath));
electron.ipcMain.handle("droids-update", (_, droidPath, data) => updateDroid(droidPath, data));
electron.ipcMain.handle("droids-delete", (_, droidPath) => deleteDroid(droidPath));
electron.ipcMain.handle("droids-get-global-path", () => getGlobalDroidsPath());
electron.ipcMain.handle("droids-save-config", (_, droidName, config) => saveDroidConfig(droidName, config));
electron.ipcMain.handle("droids-get-tools", () => getAllTools());
electron.ipcMain.handle("droids-get-tool-categories", () => getToolCategories());
electron.ipcMain.handle("droids-move", (_, sourcePath, targetScope, targetProjectPath) => moveDroid(sourcePath, targetScope, targetProjectPath));
electron.ipcMain.handle("droids-select-project", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "选择项目目录",
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
async function explainDroid(droidContent) {
  const settings = loadAISettings();
  try {
    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.skillsModel || settings.model,
        messages: [
          {
            role: "system",
            content: `你是一个专业的 AI Agent 分析师。请分析用户提供的 Droid（子代理）配置文件，用中文生成结构化的解读。

请严格按照以下格式输出（使用 Markdown）：

## 概述
用1-2句话简要说明这个 Droid 是什么、做什么用的。

## 核心能力
- 能力点1
- 能力点2
- 能力点3

## 使用场景
描述在什么情况下应该调用这个 Droid。

## 工具权限
说明这个 Droid 可以使用哪些工具，有什么限制。

## 调用示例
给出1-2个调用这个 Droid 的示例指令。

## 注意事项
- 注意点1
- 注意点2

要求：
- 语言简洁专业
- 每个部分都要有内容
- 重点说明这个 Droid 的独特价值`
          },
          {
            role: "user",
            content: droidContent
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "无法生成解释";
  } catch (e) {
    console.error("AI解释Droid失败:", e);
    return `解释生成失败: ${e.message}`;
  }
}
electron.ipcMain.handle("droids-generate-ai-summary", async (_, droidPath, droidName, content) => {
  try {
    const summary = await explainDroid(content);
    if (summary && !summary.startsWith("解释生成失败")) {
      saveAiSummary(droidPath, droidName, summary);
      return { success: true, summary };
    }
    return { success: false, error: summary };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("droids-copy", (_, sourcePath, targetScope, targetProjectPath) => copyDroid(sourcePath, targetScope, targetProjectPath));
electron.ipcMain.handle("prompts-get-all", () => getPrompts());
electron.ipcMain.handle("prompts-get", (_, promptPath) => getPrompt(promptPath));
electron.ipcMain.handle("prompts-create", (_, name, content, description, category, linkedResources) => createPrompt(name, content, description, category, linkedResources));
electron.ipcMain.handle("prompts-update", (_, promptPath, content, description, category, linkedResources) => updatePrompt(promptPath, content, description, category, linkedResources));
electron.ipcMain.handle("prompts-delete", (_, promptPath) => deletePrompt(promptPath));
electron.ipcMain.handle("prompts-get-path", () => getPromptsPath());
electron.ipcMain.handle("prompts-get-count", () => getPromptsCount());
electron.ipcMain.handle("rules-get-global", () => getGlobalRules());
electron.ipcMain.handle("rules-get-project", (_, projectPath) => getProjectRules(projectPath));
electron.ipcMain.handle("rules-get", (_, rulePath) => getRule(rulePath));
electron.ipcMain.handle("rules-create", (_, name, content, scope, projectPath, description, category, priority, globs, linkedResources) => createRule(name, content, scope, projectPath, description, category, priority, globs, linkedResources));
electron.ipcMain.handle("rules-update", (_, rulePath, content, description, category, priority, globs, linkedResources) => updateRule(rulePath, content, description, category, priority, globs, linkedResources));
electron.ipcMain.handle("rules-delete", (_, rulePath) => deleteRule(rulePath));
electron.ipcMain.handle("rules-get-global-path", () => getGlobalRulesPath());
electron.ipcMain.handle("rules-get-global-count", () => getGlobalRulesCount());
electron.ipcMain.handle("rules-copy", (_, sourcePath, targetScope, targetProjectPath) => copyRule(sourcePath, targetScope, targetProjectPath));
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", () => {
  for (const [name] of mcpConnections) {
    mcpDisconnect(name);
  }
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
electron.app.on("before-quit", () => {
  for (const [name] of mcpConnections) {
    mcpDisconnect(name);
  }
});
