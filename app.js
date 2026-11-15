const starterFiles = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Website</title>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Welcome to S - Code Editor.</p>
  <button onclick="alert('It works!')">Click me</button>
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

  "script.js": `console.log("Hello from S - Code Editor!");`
};

let files = {};
let currentFile = "index.html";
let editor = null;
let usingMonaco = false;
let saveTimer = null;

const editorElement = document.getElementById("editor");
const fileList = document.getElementById("file-list");
const previewFrame = document.getElementById("preview-frame");
const saveStatus = document.getElementById("save-status");
const currentFileLabel = document.getElementById("current-file-label");
const languageLabel = document.getElementById("language-label");
const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function loadFiles() {
  try {
    const saved = localStorage.getItem("swypyy-code-editor-files");

    if (saved) {
      files = JSON.parse(saved);
    } else {
      files = { ...starterFiles };
    }
  } catch {
    files = { ...starterFiles };
  }

  Object.keys(starterFiles).forEach(name => {
    if (typeof files[name] !== "string") {
      files[name] = starterFiles[name];
    }
  });
}

function saveFiles() {
  saveStatus.textContent = "Saving...";

  try {
    localStorage.setItem(
      "swypyy-code-editor-files",
      JSON.stringify(files)
    );

    saveStatus.textContent = "Saved locally";
  } catch {
    saveStatus.textContent = "Storage unavailable";
    showToast("Could not save. Browser storage may be full.");
  }
}

function getLanguage(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  const languages = {
    html: "html",
    css: "css",
    js: "javascript",
    json: "json",
    txt: "plaintext",
    md: "markdown"
  };

  return languages[extension] || "plaintext";
}

function getFileIcon(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  if (extension === "html") return "html-icon";
  if (extension === "css") return "css-icon";
  if (extension === "js") return "js-icon";

  return "";
}

function renderFileList() {
  fileList.innerHTML = "";

  Object.keys(files).forEach(filename => {
    const button = document.createElement("button");

    button.className =
      "file-item" + (filename === currentFile ? " active" : "");

    const icon = document.createElement("span");
    icon.className = "file-icon " + getFileIcon(filename);
    icon.textContent = filename.endsWith(".js")
      ? "JS"
      : filename.endsWith(".css")
        ? "✳"
        : filename.endsWith(".html")
          ? "5"
          : "•";

    const label = document.createElement("span");
    label.textContent = filename;

    button.append(icon, label);

    button.addEventListener("click", () => {
      openFile(filename);
    });

    fileList.appendChild(button);
  });
}

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

function updateEditorLanguage() {
  const language = getLanguage(currentFile);

  const names = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    json: "JSON",
    plaintext: "Plain Text",
    markdown: "Markdown"
  };

  languageLabel.textContent = names[language] || "Plain Text";

  if (usingMonaco && editor) {
    const model = editor.getModel();

    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }
  }
}

function openFile(filename) {
  if (!Object.hasOwn(files, filename)) return;

  if (currentFile && editorElement) {
    files[currentFile] = getEditorValue();
  }

  currentFile = filename;

  setEditorValue(files[filename]);

  currentFileLabel.textContent = filename;

  updateEditorLanguage();
  renderFileList();
  updateCursorPosition();
}

function updateCursorPosition() {
  const value = getEditorValue();
  const lines = value.slice(0, getCursorPosition()).split("\n");

  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;

  document.getElementById("cursor-position").textContent =
    `Line ${line}, Column ${column}`;
}

function getCursorPosition() {
  if (usingMonaco && editor) {
    return editor.getModel().getOffsetAt(editor.getPosition());
  }

  return document.getElementById("editor-fallback").selectionStart;
}

function handleEditorChange() {
  files[currentFile] = getEditorValue();

  saveStatus.textContent = "Unsaved changes";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveFiles();
  }, 500);

  updateCursorPosition();
}

function createEditor() {
  const fallback = document.getElementById("editor-fallback");

  fallback.value = files[currentFile];

  fallback.addEventListener("input", handleEditorChange);
  fallback.addEventListener("keyup", updateCursorPosition);
  fallback.addEventListener("click", updateCursorPosition);

  if (!window.require) return;

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
      showToast("Code editor loaded");
    } catch (error) {
      console.error("Editor error:", error);
    }
  });
}

function buildPreview() {
  files[currentFile] = getEditorValue();
  saveFiles();

  const html = files["index.html"] || "";
  const css = files["styles.css"] || "";
  const js = files["script.js"] || "";

  const documentContent = html.replace(
    /<head([^>]*)>/i,
    `<head$1><style>${css.replace(/<\/style/gi, "<\\/style")}</style>`
  );

  const finalContent = documentContent.replace(
    /<\/body>/i,
    `<script>${js.replace(/<\/script/gi, "<\\/script")}<\/script></body>`
  );

  previewFrame.srcdoc = finalContent;

  showToast("Preview updated");
}

function createNewFile() {
  const filename = prompt(
    "Enter a file name (example: about.html):"
  );

  if (!filename) return;

  const cleanName = filename.trim();

  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(cleanName)) {
    showToast("Invalid file name");
    return;
  }

  if (Object.hasOwn(files, cleanName)) {
    showToast("File already exists");
    return;
  }

  files[cleanName] = "";

  saveFiles();
  renderFileList();
  openFile(cleanName);

  showToast("File created");
}

function resetProject() {
  const confirmed = confirm(
    "Reset your project to the original starter files? Your current local changes will be lost."
  );

  if (!confirmed) return;

  files = { ...starterFiles };
  currentFile = "index.html";

  saveFiles();
  renderFileList();
  openFile(currentFile);
  buildPreview();

  showToast("Project reset");
}

document.getElementById("run-button").addEventListener(
  "click",
  buildPreview
);

document.getElementById("refresh-button").addEventListener(
  "click",
  buildPreview
);

document.getElementById("new-file-button").addEventListener(
  "click",
  createNewFile
);

document.getElementById("reset-button").addEventListener(
  "click",
  resetProject
);

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();

    files[currentFile] = getEditorValue();
    saveFiles();
    showToast("Project saved");
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    buildPreview();
  }
});

loadFiles();
renderFileList();
createEditor();
buildPreview();
