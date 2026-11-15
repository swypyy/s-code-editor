const starterFiles = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Website</title>
</head>
<body>
  <h1>Hello, Swypyy!</h1>
  <p>Welcome to S - Code Editor.</p>
  <button onclick="console.log('Button clicked!')">Test Console</button>
</body>
</html>`,

  "styles.css": `body {
  font-family: Arial, sans-serif;
  padding: 40px;
  background: #f4f4f4;
  color: #222;
}
h1 {
  color: #7045db;
}`,

  "script.js": `console.log("Hello from S - Code Editor!");

console.warn("This is a warning example.");`
};

const STORAGE_KEY = "swypyy-code-editor-files";

let files = {};
let currentFile = "index.html";
let editor = null;
let usingMonaco = false;
let saveTimer = null;
let consoleMessages = [];

const fileList = document.getElementById("file-list");
const tabsContainer = document.getElementById("editor-tabs");
const editorElement = document.getElementById("editor");
const previewFrame = document.getElementById("preview-frame");
const saveStatus = document.getElementById("save-status");
const toast = document.getElementById("toast");
const consoleOutput = document.getElementById("console-output");
const consoleCount = document.getElementById("console-count");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// STORAGE

function loadFiles() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    files = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : { ...starterFiles };
  } catch {
    files = { ...starterFiles };
  }

  Object.keys(files).forEach(name => {
    if (typeof files[name] !== "string") {
      delete files[name];
    }
  });

  if (Object.keys(files).length === 0) {
    files = { ...starterFiles };
  }

  if (!Object.prototype.hasOwnProperty.call(files, currentFile)) {
    currentFile = Object.keys(files)[0];
  }
}

function saveFiles() {
  saveStatus.textContent = "Saving...";

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    saveStatus.textContent = "Saved locally";
  } catch (error) {
    saveStatus.textContent = "Save failed";
    showToast("Could not save. Browser storage may be full.");
  }
}

function scheduleSave() {
  saveStatus.textContent = "Unsaved changes";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveFiles();
  }, 500);
}

// LANGUAGE

function getLanguage(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  const languages = {
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    json: "json",
    txt: "plaintext",
    md: "markdown",
    xml: "xml",
    svg: "xml",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    sql: "sql",
    php: "php",
    yaml: "yaml",
    yml: "yaml",
    scss: "scss",
    less: "less"
  };

  return languages[extension] || "plaintext";
}

function getLanguageName(filename) {
  const language = getLanguage(filename);

  const names = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    typescript: "TypeScript",
    json: "JSON",
    plaintext: "Plain Text",
    markdown: "Markdown",
    xml: "XML",
    python: "Python",
    java: "Java",
    cpp: "C++",
    c: "C",
    sql: "SQL",
    php: "PHP",
    yaml: "YAML",
    scss: "SCSS",
    less: "LESS"
  };

  return names[language] || "Plain Text";
}

function getFileIcon(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  if (extension === "html" || extension === "htm") return "html-icon";
  if (extension === "css") return "css-icon";
  if (extension === "js") return "js-icon";

  return "";
}

function getIconText(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  if (extension === "js") return "JS";
  if (extension === "css") return "✳";
  if (extension === "html" || extension === "htm") return "5";

  return "•";
}

// EDITOR VALUES

function getEditorValue() {
  if (usingMonaco && editor) {
    return editor.getValue();
  }

  return document.getElementById("editor-fallback").value;
}

function setEditorValue(value) {
  if (usingMonaco && editor) {
    editor.setValue(value);
  } else {
    document.getElementById("editor-fallback").value = value;
  }
}

function storeCurrentFile() {
  if (files[currentFile] !== undefined) {
    files[currentFile] = getEditorValue();
  }
}

// FILE EXPLORER

function renderFileList() {
  fileList.innerHTML = "";

  Object.keys(files).forEach(filename => {
    const item = document.createElement("div");
    item.className = "file-row";

    const openButton = document.createElement("button");
    openButton.className =
      "file-item" + (filename === currentFile ? " active" : "");

    const icon = document.createElement("span");
    icon.className = "file-icon " + getFileIcon(filename);
    icon.textContent = getIconText(filename);

    const label = document.createElement("span");
    label.textContent = filename;

    openButton.append(icon, label);
    openButton.addEventListener("click", () => openFile(filename));

    const renameButton = document.createElement("button");
    renameButton.className = "file-action";
    renameButton.textContent = "✎";
    renameButton.title = "Rename " + filename;
    renameButton.addEventListener("click", () => renameFile(filename));

    const deleteButton = document.createElement("button");
    deleteButton.className = "file-action delete-action";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete " + filename;
    deleteButton.addEventListener("click", () => deleteFile(filename));

    item.append(openButton, renameButton, deleteButton);
    fileList.appendChild(item);
  });
}

function renderTabs() {
  tabsContainer.innerHTML = "";

  Object.keys(files).forEach(filename => {
    const tab = document.createElement("button");
    tab.className = "tab" + (filename === currentFile ? " active" : "");

    const icon = document.createElement("span");
    icon.className = "file-icon " + getFileIcon(filename);
    icon.textContent = getIconText(filename);

    const label = document.createElement("span");
    label.textContent = filename;

    tab.append(icon, label);
    tab.addEventListener("click", () => openFile(filename));

    tabsContainer.appendChild(tab);
  });
}

function updateEditorLanguage() {
  document.getElementById("current-file-label").textContent = currentFile;

  document.getElementById("language-label").textContent =
    getLanguageName(currentFile);

  if (usingMonaco && editor) {
    monaco.editor.setModelLanguage(
      editor.getModel(),
      getLanguage(currentFile)
    );
  }
}

function openFile(filename) {
  if (!Object.prototype.hasOwnProperty.call(files, filename)) return;

  storeCurrentFile();
  currentFile = filename;

  setEditorValue(files[filename]);

  updateEditorLanguage();
  renderFileList();
  renderTabs();
  updateCursorPosition();
}

// CURSOR POSITION

function getCursorPosition() {
  if (usingMonaco && editor) {
    const position = editor.getPosition();
    return editor.getModel().getOffsetAt(position);
  }

  return document.getElementById("editor-fallback").selectionStart;
}

function updateCursorPosition() {
  const value = getEditorValue();
  const beforeCursor = value.slice(0, getCursorPosition());
  const lines = beforeCursor.split("\n");

  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;

  document.getElementById("cursor-position").textContent =
    `Line ${line}, Column ${column}`;
}

function handleEditorChange() {
  storeCurrentFile();
  scheduleSave();
  updateCursorPosition();
}

// MONACO EDITOR

function createEditor() {
  const fallback = document.getElementById("editor-fallback");
  fallback.value = files[currentFile];

  fallback.addEventListener("input", handleEditorChange);
  fallback.addEventListener("keyup", updateCursorPosition);
  fallback.addEventListener("click", updateCursorPosition);

  if (!window.require) {
    showToast("Using basic editor mode");
    return;
  }

  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
    }
  });

  require(["vs/editor/editor.main"], function () {
    try {
      editor = monaco.editor.create(editorElement, {
        value: files[currentFile],
        language: getLanguage(currentFile),
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "DM Mono, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        roundedSelection: true,
        tabSize: 2,
        wordWrap: "on"
      });

      usingMonaco = true;
      fallback.remove();

      editor.onDidChangeModelContent(handleEditorChange);
      editor.onDidChangeCursorPosition(updateCursorPosition);

      updateEditorLanguage();
      showToast("Monaco editor loaded");

    } catch (error) {
      console.error("Monaco editor error:", error);
      showToast("Could not load Monaco editor");
    }
  });
}

// CONSOLE

function safeFormat(value) {
  if (typeof value === "string") return value;

  if (value instanceof Error) {
    return value.stack || value.message;
  }

  try {
    const result = JSON.stringify(value);
    return result === undefined ? String(value) : result;
  } catch {
    return String(value);
  }
}

function addConsoleMessage(type, values) {
  const message = {
    type,
    text: values.map(safeFormat).join(" ")
  };

  consoleMessages.push(message);

  if (consoleMessages.length > 300) {
    consoleMessages.shift();
  }

  renderConsole();
}

function renderConsole() {
  consoleOutput.innerHTML = "";
  consoleCount.textContent = consoleMessages.length;

  if (consoleMessages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "console-empty";
    empty.textContent = "Console is ready. Run your project to see messages.";
    consoleOutput.appendChild(empty);
    return;
  }

  consoleMessages.forEach(message => {
    const entry = document.createElement("div");
    entry.className = "console-entry";

    if (message.type === "error") {
      entry.classList.add("error");
    } else if (message.type === "warn") {
      entry.classList.add("warn");
    } else if (message.type === "info") {
      entry.classList.add("info");
    }

    entry.textContent =
      `[${message.type.toUpperCase()}] ${message.text}`;

    consoleOutput.appendChild(entry);
  });

  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
  consoleMessages = [];
  renderConsole();
}

// RECEIVE PREVIEW CONSOLE MESSAGES

window.addEventListener("message", event => {
  if (event.source !== previewFrame.contentWindow) return;

  const data = event.data;

  if (!data || data.source !== "swypyy-preview-console") return;
  if (typeof data.type !== "string" || typeof data.text !== "string") return;

  addConsoleMessage(data.type, [data.text]);
});

// PREVIEW

function buildPreview() {
  storeCurrentFile();
  saveFiles();
  clearConsole();

  let html = files["index.html"] || "";

  if (!html.trim()) {
    html = "<!DOCTYPE html><html><head></head><body></body></html>";
  }

  const css = files["styles.css"] || "";
  const js = files["script.js"] || "";

  const escapedCSS = css.replace(/<\/style/gi, "<\\/style");
  const escapedJS = js.replace(/<\/script/gi, "<\\/script");

  const bridge = `
<script>
(function () {
  function format(value) {
    if (typeof value === "string") return value;

    if (value instanceof Error) {
      return value.stack || value.message;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function send(type, values) {
    try {
      parent.postMessage({
        source: "swypyy-preview-console",
        type: type,
        text: values.map(format).join(" ")
      }, "*");
    } catch (error) {}
  }

  ["log", "info", "warn", "error", "debug"].forEach(function (type) {
    var original = console[type];

    console[type] = function () {
      var values = Array.from(arguments);

      send(type === "debug" ? "info" : type, values);

      if (original) {
        original.apply(console, arguments);
      }
    };
  });

  window.addEventListener("error", function (event) {
    send("error", [
      event.message || "Unknown JavaScript error",
      event.filename ? "at " + event.filename + ":" + event.lineno : ""
    ]);
  });

  window.addEventListener("unhandledrejection", function (event) {
    send("error", ["Unhandled promise rejection:", event.reason]);
  });
})();
<\/script>`;

  const styles = `<style>${escapedCSS}</style>`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, match => match + bridge + styles);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(
      /<html[^>]*>/i,
      match => match + "<head>" + bridge + styles + "</head>"
    );
  } else {
    html =
      "<!DOCTYPE html><html><head>" +
      bridge + styles +
      "</head><body>" + html +
      "</body></html>";
  }

  const script = `<script>${escapedJS}<\/script>`;

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, script + "</body>");
  } else {
    html += script;
  }

  previewFrame.srcdoc = html;

  showToast("Preview updated");
}

// FILE MANAGEMENT

function createNewFile() {
  const filename = prompt("Enter a file name (example: about.html):");

  if (!filename) return;

  const cleanName = filename.trim();

  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(cleanName)) {
    showToast("Invalid file name");
    return;
  }

  if (Object.prototype.hasOwnProperty.call(files, cleanName)) {
    showToast("File already exists");
    return;
  }

  storeCurrentFile();

  files[cleanName] = "";
  currentFile = cleanName;

  saveFiles();
  renderFileList();
  renderTabs();
  setEditorValue("");

  updateEditorLanguage();
  updateCursorPosition();

  showToast("File created");
}

function renameFile(oldName) {
  const newName = prompt("Enter the new file name:", oldName);

  if (!newName) return;

  const cleanName = newName.trim();

  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(cleanName)) {
    showToast("Invalid file name");
    return;
  }

  if (
    cleanName !== oldName &&
    Object.prototype.hasOwnProperty.call(files, cleanName)
  ) {
    showToast("That file already exists");
    return;
  }

  if (cleanName === oldName) return;

  storeCurrentFile();

  const updatedFiles = {};

  Object.keys(files).forEach(name => {
    updatedFiles[name === oldName ? cleanName : name] = files[name];
  });

  files = updatedFiles;

  if (currentFile === oldName) {
    currentFile = cleanName;
  }

  saveFiles();
  renderFileList();
  renderTabs();
  updateEditorLanguage();

  showToast("File renamed");
}

function deleteFile(filename) {
  if (!Object.prototype.hasOwnProperty.call(files, filename)) return;

  const confirmed = confirm(
    `Delete "${filename}"? This cannot be undone.`
  );

  if (!confirmed) return;

  storeCurrentFile();

  delete files[filename];

  const remaining = Object.keys(files);

  if (remaining.length === 0) {
    files = { "index.html": starterFiles["index.html"] };
  }

  if (currentFile === filename) {
    currentFile = Object.keys(files)[0];
    setEditorValue(files[currentFile]);
  }

  saveFiles();
  renderFileList();
  renderTabs();
  updateEditorLanguage();

  showToast("File deleted");
}

function resetProject() {
  const confirmed = confirm(
    "Reset the project to the original starter files? Your current changes will be lost."
  );

  if (!confirmed) return;

  files = { ...starterFiles };
  currentFile = "index.html";

  saveFiles();
  renderFileList();
  renderTabs();
  setEditorValue(files[currentFile]);

  updateEditorLanguage();
  buildPreview();

  showToast("Project reset");
}

// ZIP IMPORT AND EXPORT

const ZIP_ALLOWED_EXTENSIONS = [
  "html", "htm", "css", "js", "json", "txt",
  "md", "xml", "svg", "csv", "ts", "tsx",
  "jsx", "py", "java", "c", "cpp", "h",
  "sql", "yaml", "yml", "toml", "sh",
  "php", "go", "rs", "scss", "less"
];

async function exportProjectZip() {
  if (typeof JSZip === "undefined") {
    showToast("ZIP library could not load");
    return;
  }

  storeCurrentFile();
  saveFiles();

  try {
    const zip = new JSZip();

    Object.keys(files).forEach(filename => {
      zip.file(filename, files[filename]);
    });

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "swypyy-project.zip";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("Project exported successfully");

  } catch (error) {
    console.error("ZIP export error:", error);
    showToast("Could not export project");
  }
}

async function importProjectZip(event) {
  const input = event.target;
  const file = input.files && input.files[0];

  if (!file) return;

  if (typeof JSZip === "undefined") {
    showToast("ZIP library could not load");
    input.value = "";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    showToast("Please select a ZIP file");
    input.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast("ZIP file is too large (10 MB maximum)");
    input.value = "";
    return;
  }

  const confirmed = confirm(
    "Import this project? Your current project will be replaced."
  );

  if (!confirmed) {
    input.value = "";
    return;
  }

  try {
    storeCurrentFile();

    const zip = await JSZip.loadAsync(file);
    const importedFiles = {};

    const entries = Object.values(zip.files).filter(entry => {
      if (entry.dir) return false;

      const name = entry.name;

      // This version supports files in the ZIP root only.
      if (name.includes("/") || name.includes("\\")) return false;

      if (name.startsWith("__MACOSX")) return false;

      if (name.startsWith(".")) return false;

      return true;
    });

    if (entries.length > 100) {
      throw new Error("Too many files. Maximum is 100.");
    }

    let totalSize = 0;

    for (const entry of entries) {
      const filename = entry.name;
      const extension = filename.split(".").pop().toLowerCase();

      if (!ZIP_ALLOWED_EXTENSIONS.includes(extension)) continue;

      const content = await entry.async("string");

      if (content.includes("\0")) continue;

      totalSize += new Blob([content]).size;

      if (totalSize > 5 * 1024 * 1024) {
        throw new Error("Extracted files exceed the 5 MB limit.");
      }

      importedFiles[filename] = content;
    }

    if (Object.keys(importedFiles).length === 0) {
      throw new Error("No supported text files found in this ZIP.");
    }

    files = importedFiles;

    currentFile = Object.prototype.hasOwnProperty.call(
      files,
      "index.html"
    )
      ? "index.html"
      : Object.keys(files)[0];

    setEditorValue(files[currentFile]);

    saveFiles();
    renderFileList();
    renderTabs();
    updateEditorLanguage();
    updateCursorPosition();
    buildPreview();

    showToast(
      `Imported ${Object.keys(files).length} files successfully`
    );

  } catch (error) {
    console.error("ZIP import error:", error);
    showToast(error.message || "Could not import ZIP file");
  }

  input.value = "";
}

function openZipFilePicker() {
  const input = document.getElementById("zip-file-input");

  if (!input) {
    showToast("ZIP input is missing from index.html");
    return;
  }

  input.click();
}

// BUTTONS

document.getElementById("run-button")
  .addEventListener("click", buildPreview);

document.getElementById("refresh-button")
  .addEventListener("click", buildPreview);

document.getElementById("new-file-button")
  .addEventListener("click", createNewFile);

document.getElementById("reset-button")
  .addEventListener("click", resetProject);

document.getElementById("clear-console-button")
  .addEventListener("click", clearConsole);

document.getElementById("export-zip-button")
  .addEventListener("click", exportProjectZip);

document.getElementById("import-zip-button")
  .addEventListener("click", openZipFilePicker);

document.getElementById("zip-file-input")
  .addEventListener("change", importProjectZip);

// KEYBOARD SHORTCUTS

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if ((event.ctrlKey || event.metaKey) && key === "s") {
    event.preventDefault();

    storeCurrentFile();
    saveFiles();

    showToast("Project saved");
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    buildPreview();
  }
});

// START APP

loadFiles();
renderFileList();
renderTabs();
renderConsole();
createEditor();
buildPreview();
