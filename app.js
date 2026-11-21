(() => {
"use strict";

const STARTER_FILES = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Swypyy Project</title>
</head>
<body>
  <h1>Hello, Swypyy!</h1>
  <p>Welcome to S Code Editor v3.0.</p>
  <button onclick="console.log('It works!')">Test Console</button>
</body>
</html>`,
  "styles.css": `body {
  font-family: Arial, sans-serif;
  padding: 40px;
  background: #f4f4f4;
  color: #222;
}
h1 { color: #7045db; }`,
  "script.js": `console.log("S Code Editor v3.0 is working!");`
};

const DB_KEY = "swypyy-code-editor-v3";
const LEGACY_KEY = "swypyy-code-editor-files";
const $ = id => document.getElementById(id);

let database = { activeId: "default", projects: {} };
let projectId = "default";
let project = null;
let files = {};
let currentFile = "index.html";
let openTabs = [];
let editor = null;
let monacoReady = false;
let saveTimer = null;
let consoleMessages = [];
let toastTimer = null;

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2300);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeId() { return "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function safeName(value) { return String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""); }

function loadDatabase() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) database = JSON.parse(saved);
  } catch (e) { console.warn("Could not read project storage", e); }

  if (!database || typeof database !== "object" || !database.projects) {
    database = { activeId: "default", projects: {} };
  }

  if (!Object.keys(database.projects).length) {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"); } catch {}
    database.projects.default = {
      id: "default", name: "My Project",
      files: legacy && typeof legacy === "object" ? legacy : clone(STARTER_FILES),
      updatedAt: Date.now()
    };
  }
  if (!database.projects[database.activeId]) database.activeId = Object.keys(database.projects)[0];
  activateProject(database.activeId, false);
  persistDatabase();
}

function persistDatabase() {
  try {
    if (project) {
      project.files = files;
      project.updatedAt = Date.now();
    }
    localStorage.setItem(DB_KEY, JSON.stringify(database));
    $("save-status").textContent = "Saved locally";
  } catch (e) {
    $("save-status").textContent = "Storage full";
    toast("Could not save. Browser storage may be full.");
  }
}

function activateProject(id, showMessage = true) {
  const target = database.projects[id];
  if (!target) return;
  storeCurrentFile();
  projectId = id;
  project = target;
  files = target.files && typeof target.files === "object" ? target.files : clone(STARTER_FILES);
  Object.keys(files).forEach(name => { if (typeof files[name] !== "string") delete files[name]; });
  if (!Object.keys(files).length) files = clone(STARTER_FILES);
  currentFile = files["index.html"] !== undefined ? "index.html" : Object.keys(files)[0];
  openTabs = [currentFile];
  database.activeId = id;
  if (editor) setEditorValue(files[currentFile]);
  renderAll();
  persistDatabase();
  if (showMessage) { buildPreview(); toast("Project opened"); }
}

function getLanguage(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return ({html:"html",htm:"html",css:"css",js:"javascript",mjs:"javascript",cjs:"javascript",json:"json",md:"markdown",xml:"xml",svg:"xml",ts:"typescript",tsx:"typescript",jsx:"javascript",py:"python",java:"java",cpp:"cpp",c:"c",sql:"sql",php:"php",yaml:"yaml",yml:"yaml",scss:"scss",less:"less"})[ext] || "plaintext";
}
function languageName(filename) {
  const names = {html:"HTML",css:"CSS",javascript:"JavaScript",typescript:"TypeScript",json:"JSON",markdown:"Markdown",xml:"XML",python:"Python",java:"Java",cpp:"C++",c:"C",sql:"SQL",php:"PHP",yaml:"YAML",scss:"SCSS",less:"LESS",plaintext:"Plain Text"};
  return names[getLanguage(filename)] || "Plain Text";
}
function fileGlyph(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "html" || ext === "htm") return ["5", "html-icon"];
  if (ext === "css") return ["✳", "css-icon"];
  if (ext === "js") return ["JS", "js-icon"];
  return ["•", ""];
}
function getEditorValue() {
  if (monacoReady && editor) return editor.getValue();
  return $("editor-fallback").value;
}
function setEditorValue(value) {
  if (monacoReady && editor) editor.setValue(value);
  else $("editor-fallback").value = value;
}
function storeCurrentFile() {
  if (files && currentFile && files[currentFile] !== undefined) files[currentFile] = getEditorValue();
}
function saveSoon() {
  $("save-status").textContent = "Unsaved changes";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistDatabase, 400);
}
function renderAll() {
  $("project-name-label").textContent = (project?.name || "MY PROJECT").toUpperCase();
  renderFiles();
  renderTabs();
  updateFileInfo();
}
function renderFiles() {
  const container = $("file-list");
  container.replaceChildren();
  Object.keys(files).sort().forEach(path => {
    const row = document.createElement("div");
    row.className = "file-row" + (path === currentFile ? " active" : "");
    const open = document.createElement("button");
    open.className = "file-item";
    const [glyph, cls] = fileGlyph(path);
    const icon = document.createElement("span");
    icon.className = "file-icon " + cls;
    icon.textContent = glyph;
    const label = document.createElement("span");
    label.textContent = path;
    open.append(icon, label);
    open.title = path;
    open.addEventListener("click", () => openFile(path));
    const download = document.createElement("button");
    download.className = "file-action";
    download.textContent = "↓";
    download.title = "Download file";
    download.addEventListener("click", () => downloadFile(path));
    const remove = document.createElement("button");
    remove.className = "file-action";
    remove.textContent = "×";
    remove.title = "Delete file";
    remove.addEventListener("click", () => deleteFile(path));
    row.append(open, download, remove);
    container.append(row);
  });
}
function renderTabs() {
  const container = $("editor-tabs");
  container.replaceChildren();
  openTabs = openTabs.filter(name => files[name] !== undefined);
  if (!openTabs.includes(currentFile)) openTabs.push(currentFile);
  openTabs.forEach(name => {
    const tab = document.createElement("button");
    tab.className = "tab" + (name === currentFile ? " active" : "");
    const [glyph, cls] = fileGlyph(name);
    const icon = document.createElement("span");
    icon.className = "file-icon " + cls;
    icon.textContent = glyph;
    const label = document.createElement("span");
    label.textContent = name.split("/").pop();
    const close = document.createElement("span");
    close.textContent = " ×";
    close.title = "Close tab";
    close.addEventListener("click", event => { event.stopPropagation(); closeTab(name); });
    tab.append(icon, label, close);
    tab.title = name;
    tab.addEventListener("click", () => openFile(name));
    container.append(tab);
  });
}
function updateFileInfo() {
  $("current-file-label").textContent = currentFile;
  $("language-label").textContent = languageName(currentFile);
  if (monacoReady && editor) monaco.editor.setModelLanguage(editor.getModel(), getLanguage(currentFile));
}
function openFile(name) {
  if (files[name] === undefined) return;
  storeCurrentFile();
  currentFile = name;
  if (!openTabs.includes(name)) openTabs.push(name);
  setEditorValue(files[name]);
  renderFiles(); renderTabs(); updateFileInfo(); updateCursor();
}
function closeTab(name) {
  if (name === currentFile) storeCurrentFile();
  openTabs = openTabs.filter(item => item !== name);
  if (currentFile === name) {
    currentFile = openTabs[openTabs.length - 1] || Object.keys(files)[0];
    openTabs = openTabs.length ? openTabs : [currentFile];
    setEditorValue(files[currentFile] || "");
  }
  renderTabs(); renderFiles(); updateFileInfo();
}
function updateCursor() {
  const value = getEditorValue();
  let offset = 0;
  if (monacoReady && editor) {
    const p = editor.getPosition();
    offset = editor.getModel().getOffsetAt(p);
  } else offset = $("editor-fallback").selectionStart || 0;
  const parts = value.slice(0, offset).split("\n");
  $("cursor-position").textContent = `Line ${parts.length}, Column ${parts[parts.length - 1].length + 1}`;
}
function editorChanged() {
  storeCurrentFile(); saveSoon(); updateCursor();
}

function initEditor() {
  const fallback = $("editor-fallback");
  fallback.value = files[currentFile];
  fallback.addEventListener("input", editorChanged);
  fallback.addEventListener("keyup", updateCursor);
  fallback.addEventListener("click", updateCursor);
  if (!window.require) { toast("Monaco unavailable. Using basic editor."); return; }
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    try {
      editor = monaco.editor.create($("editor"), {
        value: files[currentFile], language: getLanguage(currentFile), theme: "vs-dark",
        automaticLayout: true, minimap: { enabled: false }, fontSize: 13,
        fontFamily: "DM Mono, monospace", lineNumbers: "on", scrollBeyondLastLine: false,
        tabSize: 2, wordWrap: "on", padding: { top: 12 }
      });
      monacoReady = true;
      fallback.remove();
      editor.onDidChangeModelContent(editorChanged);
      editor.onDidChangeCursorPosition(updateCursor);
      updateFileInfo();
    } catch (error) { console.error(error); toast("Monaco failed. Basic editor remains available."); }
  });
}

function addFile() {
  const raw = prompt("File name (example: pages/about.html). Use / to create a folder path:");
  if (!raw) return;
  const name = safeName(raw);
  if (!name || name.split("/").some(part => !part || part === "." || part === "..")) { toast("Invalid file path"); return; }
  if (files[name] !== undefined) { toast("File already exists"); return; }
  storeCurrentFile();
  files[name] = "";
  currentFile = name; openTabs.push(name);
  setEditorValue(""); renderAll(); updateFileInfo(); persistDatabase(); toast("File created");
}
function addFolder() {
  const raw = prompt("Folder name (example: components):");
  if (!raw) return;
  const folder = safeName(raw);
  if (!folder || folder.includes("..")) { toast("Invalid folder name"); return; }
  const placeholder = folder + "/.keep";
  if (files[placeholder] !== undefined) { toast("Folder already exists"); return; }
  storeCurrentFile(); files[placeholder] = "";
  renderFiles(); persistDatabase(); toast("Folder created");
}
function deleteFile(name) {
  if (!files[name] || !confirm(`Delete "${name}"?`)) return;
  storeCurrentFile();
  delete files[name];
  openTabs = openTabs.filter(item => item !== name);
  if (!Object.keys(files).length) files = clone(STARTER_FILES);
  if (currentFile === name) {
    currentFile = Object.keys(files)[0]; openTabs.push(currentFile);
    setEditorValue(files[currentFile]);
  }
  renderAll(); persistDatabase(); buildPreview(); toast("File deleted");
}
function downloadFile(name) {
  storeCurrentFile();
  const blob = new Blob([files[name] || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name.split("/").pop();
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function resetProject() {
  if (!confirm("Reset this project to the starter files? This replaces its current files.")) return;
  files = clone(STARTER_FILES); currentFile = "index.html"; openTabs = [currentFile];
  setEditorValue(files[currentFile]); renderAll(); persistDatabase(); buildPreview(); toast("Project reset");
}

function consoleAdd(type, text) {
  consoleMessages.push({ type, text: String(text) });
  if (consoleMessages.length > 400) consoleMessages.shift();
  renderConsole();
}
function renderConsole() {
  const output = $("console-output");
  output.replaceChildren();
  const filter = $("console-filter").value;
  const shown = consoleMessages.filter(m => filter === "all" || m.type === filter);
  $("console-count").textContent = String(consoleMessages.length);
  if (!shown.length) {
    const empty = document.createElement("div"); empty.className = "console-empty";
    empty.textContent = consoleMessages.length ? "No messages match this filter." : "Console is ready. Run your project to see messages.";
    output.append(empty); return;
  }
  shown.forEach(message => {
    const row = document.createElement("div");
    row.className = "console-entry " + message.type;
    row.textContent = `[${message.type.toUpperCase()}] ${message.text}`;
    output.append(row);
  });
  output.scrollTop = output.scrollHeight;
}
function clearConsole() { consoleMessages = []; renderConsole(); }

window.addEventListener("message", event => {
  if (event.source !== $("preview-frame").contentWindow) return;
  const data = event.data;
  if (!data || data.source !== "swypyy-preview-console" || typeof data.text !== "string") return;
  consoleAdd(data.type || "log", data.text);
});

function buildPreview() {
  storeCurrentFile(); persistDatabase(); clearConsole();
  let html = files["index.html"] || "<!DOCTYPE html><html><head></head><body></body></html>";
  const css = (files["styles.css"] || "").replace(/<\/style/gi, "<\\/style");
  const js = (files["script.js"] || "").replace(/<\/script/gi, "<\\/script");
  const bridge = `<script>
(function(){
 const fmt=v=>{try{return typeof v==="string"?v:v instanceof Error?(v.stack||v.message):JSON.stringify(v)}catch(e){return String(v)}};
 ["log","info","warn","error","debug"].forEach(type=>{
  const original=console[type];
  console[type]=function(){const text=Array.from(arguments).map(fmt).join(" ");parent.postMessage({source:"swypyy-preview-console",type:type==="debug"?"info":type,text},"*");if(original)original.apply(console,arguments)};
 });
 addEventListener("error",e=>parent.postMessage({source:"swypyy-preview-console",type:"error",text:e.message},"*"));
 addEventListener("unhandledrejection",e=>parent.postMessage({source:"swypyy-preview-console",type:"error",text:"Unhandled promise rejection: "+fmt(e.reason)},"*"));
})();
<\/script>`;
  const styleTag = `<style>${css}</style>`;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, match => match + bridge + styleTag);
  else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, match => match + "<head>" + bridge + styleTag + "</head>");
  else html = "<!DOCTYPE html><html><head>" + bridge + styleTag + "</head><body>" + html + "</body></html>";
  const scriptTag = `<script>${js}<\/script>`;
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, scriptTag + "</body>");
  else html += scriptTag;
  $("preview-frame").srcdoc = html;
  toast("Preview updated");
}

async function exportZip() {
  storeCurrentFile(); persistDatabase();
  if (typeof JSZip !== "function") { toast("ZIP library unavailable. Check your internet connection and reload."); return; }
  try {
    const zip = new JSZip();
    Object.entries(files).forEach(([path, content]) => {
      if (path.endsWith("/.keep")) zip.folder(path.slice(0, -6));
      else zip.file(path, content);
    });
    zip.file("README.txt", `Created with S Code Editor by Swypyy\nProject: ${project.name}\n`);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = (project.name || "swypyy-project").toLowerCase().replace(/[^a-z0-9-_]+/g, "-") + ".zip";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast("Project ZIP exported");
  } catch (error) { console.error(error); toast("ZIP export failed: " + error.message); }
}
async function importZip(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof JSZip !== "function") { toast("ZIP library unavailable. Check your internet connection."); event.target.value = ""; return; }
  if (file.size > 20 * 1024 * 1024) { toast("ZIP must be smaller than 20 MB"); event.target.value = ""; return; }
  if (!confirm("Import this ZIP and replace the current project's files?")) { event.target.value = ""; return; }
  try {
    const zip = await JSZip.loadAsync(file);
    const imported = {};
    const entries = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.startsWith("__MACOSX/") && !entry.name.split("/").some(p => p === ".."));
    if (entries.length > 200) throw new Error("ZIP contains more than 200 files");
    let total = 0;
    for (const entry of entries) {
      const name = safeName(entry.name);
      if (!name || name.startsWith(".") || name.endsWith("/")) continue;
      const content = await entry.async("string");
      total += new Blob([content]).size;
      if (total > 10 * 1024 * 1024) throw new Error("Uncompressed project exceeds 10 MB");
      if (content.includes("\0")) continue;
      imported[name] = content;
    }
    if (!Object.keys(imported).length) throw new Error("No supported text files found");
    files = imported;
    currentFile = files["index.html"] !== undefined ? "index.html" : Object.keys(files)[0];
    openTabs = [currentFile];
    setEditorValue(files[currentFile] || "");
    renderAll(); persistDatabase(); buildPreview();
    toast(`Imported ${Object.keys(files).length} files`);
  } catch (error) { console.error(error); toast("Import failed: " + error.message); }
  event.target.value = "";
}

function renderProjects() {
  const list = $("projects-list"); list.replaceChildren();
  Object.values(database.projects).forEach(item => {
    const row = document.createElement("div"); row.className = "project-entry";
    const select = document.createElement("button"); select.className = "project-select";
    const strong = document.createElement("strong"); strong.textContent = item.name;
    const small = document.createElement("small"); small.textContent = `${Object.keys(item.files || {}).length} files`;
    select.append(strong, small);
    select.addEventListener("click", () => { $("projects-dialog").close(); activateProject(item.id); });
    row.append(select);
    if (item.id !== projectId) {
      const remove = document.createElement("button"); remove.className = "icon-button"; remove.textContent = "×"; remove.title = "Delete project";
      remove.addEventListener("click", () => {
        if (!confirm(`Delete project "${item.name}"?`)) return;
        delete database.projects[item.id];
        if (!Object.keys(database.projects).length) createProject("My Project", false);
        if (projectId === item.id) activateProject(Object.keys(database.projects)[0]);
        persistDatabase(); renderProjects();
      });
      row.append(remove);
    }
    list.append(row);
  });
}
function createProject(name, notify = true) {
  const id = makeId();
  database.projects[id] = { id, name: name || "New Project", files: clone(STARTER_FILES), updatedAt: Date.now() };
  persistDatabase();
  activateProject(id, false);
  if (notify) toast("New project created");
}
function manageProjects() {
  renderProjects(); $("projects-dialog").showModal();
}

function findInEditor() {
  const query = $("search-input").value;
  if (!query) return;
  if (monacoReady && editor) {
    editor.getAction("actions.find").run();
    return;
  }
  const area = $("editor-fallback");
  const index = area.value.indexOf(query, area.selectionEnd);
  if (index >= 0) { area.focus(); area.setSelectionRange(index, index + query.length); }
  else toast("No more matches");
}
function replaceOne() {
  const find = $("search-input").value;
  if (!find) return;
  const replacement = $("replace-input").value;
  if (monacoReady && editor) {
    const selection = editor.getSelection();
    const selected = editor.getModel().getValueInRange(selection);
    if (selected === find) editor.executeEdits("replace", [{ range: selection, text: replacement }]);
    else findInEditor();
  } else {
    const area = $("editor-fallback");
    const start = area.selectionStart, end = area.selectionEnd;
    if (area.value.slice(start, end) === find) {
      area.setRangeText(replacement, start, end, "select"); editorChanged();
    } else findInEditor();
  }
}
function replaceAll() {
  const find = $("search-input").value;
  if (!find) return;
  const replacement = $("replace-input").value;
  const value = getEditorValue();
  const updated = value.split(find).join(replacement);
  if (updated === value) { toast("No matches found"); return; }
  setEditorValue(updated); editorChanged(); toast("All matches replaced");
}

function toggleTheme() {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = next;
  localStorage.setItem("swypyy-editor-theme", next);
  $("theme-button").textContent = next === "dark" ? "☀" : "☾";
  if (monacoReady && editor) monaco.editor.setTheme(next === "dark" ? "vs-dark" : "vs");
}
function toggleFullscreen() {
  const target = $("preview-canvas");
  if (!document.fullscreenElement) target.requestFullscreen?.().catch(() => toast("Fullscreen unavailable"));
  else document.exitFullscreen?.();
}

function bindEvents() {
  $("run-button").addEventListener("click", buildPreview);
  $("refresh-button").addEventListener("click", buildPreview);
  $("new-file-button").addEventListener("click", addFile);
  $("new-folder-button").addEventListener("click", addFolder);
  $("reset-button").addEventListener("click", resetProject);
  $("clear-console-button").addEventListener("click", clearConsole);
  $("console-filter").addEventListener("change", renderConsole);
  $("export-zip-button").addEventListener("click", exportZip);
  $("import-zip-button").addEventListener("click", () => $("zip-file-input").click());
  $("zip-file-input").addEventListener("change", importZip);
  $("download-file-button").addEventListener("click", () => { storeCurrentFile(); downloadFile(currentFile); });
  $("theme-button").addEventListener("click", toggleTheme);
  $("fullscreen-button").addEventListener("click", toggleFullscreen);
  $("projects-button").addEventListener("click", manageProjects);
  $("new-project-button").addEventListener("click", () => {
    const name = prompt("Name your new project:");
    if (name && name.trim()) { $("projects-dialog").close(); createProject(name.trim()); }
  });
  $("close-tab-button").addEventListener("click", () => closeTab(currentFile));
  $("search-toggle-button").addEventListener("click", () => { $("search-panel").hidden = !$("search-panel").hidden; $("search-input").focus(); });
  $("search-close-button").addEventListener("click", () => $("search-panel").hidden = true);
  $("find-next-button").addEventListener("click", findInEditor);
  $("replace-button").addEventListener("click", replaceOne);
  $("replace-all-button").addEventListener("click", replaceAll);
  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault(); storeCurrentFile(); persistDatabase(); toast("Project saved");
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); buildPreview(); }
    if ((event.ctrlKey || event.metaKey) && key === "f") {
      event.preventDefault(); $("search-panel").hidden = false; $("search-input").focus();
    }
  });
}

function start() {
  loadDatabase();
  const savedTheme = localStorage.getItem("swypyy-editor-theme");
  if (savedTheme === "light") { document.body.dataset.theme = "light"; $("theme-button").textContent = "☾"; }
  bindEvents();
  renderAll();
  initEditor();
  renderConsole();
  buildPreview();
  if (!window.JSZip) {
    window.zipLibraryReady?.then(ok => {
      if (ok) toast("ZIP tools ready");
      else console.warn("ZIP tools unavailable: could not load JSZip.");
    });
  }
}

start();
})();