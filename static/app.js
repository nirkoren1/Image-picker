const selected = new Set();
let allFiles = [];

const dirInput = document.getElementById("dir-input");
const loadBtn = document.getElementById("load-btn");
const loadError = document.getElementById("load-error");
const loadSection = document.getElementById("load-section");
const toolbar = document.getElementById("toolbar");
const grid = document.getElementById("grid");
const counter = document.getElementById("counter");
const doneBtn = document.getElementById("done-btn");
const result = document.getElementById("result");
const resultPath = document.getElementById("result-path");
const resultCount = document.getElementById("result-count");

dirInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadDirectory();
});

async function loadDirectory() {
    const dir = dirInput.value.trim();
    if (!dir) return;

    loadBtn.disabled = true;
    loadBtn.textContent = "Loading...";
    loadError.classList.add("hidden");

    try {
        const res = await fetch("/load", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ directory: dir }),
        });
        const data = await res.json();

        if (!res.ok) {
            loadError.textContent = data.error;
            loadError.classList.remove("hidden");
            return;
        }

        allFiles = data.files;
        selected.clear();
        renderGrid();
        toolbar.classList.remove("hidden");
        updateCounter();
    } catch (err) {
        loadError.textContent = "Failed to connect to server.";
        loadError.classList.remove("hidden");
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = "Load";
    }
}

function renderGrid() {
    grid.innerHTML = "";
    allFiles.forEach((filename) => {
        const cell = document.createElement("div");
        cell.className = "image-cell";
        cell.onclick = () => toggleSelect(filename, cell);

        const img = document.createElement("img");
        img.src = `/thumb/${encodeURIComponent(filename)}`;
        img.alt = filename;
        img.title = filename;
        img.loading = "lazy";

        cell.appendChild(img);
        grid.appendChild(cell);
    });
}

function toggleSelect(filename, cell) {
    if (selected.has(filename)) {
        selected.delete(filename);
        cell.classList.remove("selected");
    } else {
        selected.add(filename);
        cell.classList.add("selected");
    }
    updateCounter();
}

function updateCounter() {
    counter.textContent = `${selected.size} of ${allFiles.length} selected`;
    doneBtn.disabled = selected.size === 0;
}

function selectAll() {
    selected.clear();
    allFiles.forEach((f) => selected.add(f));
    document.querySelectorAll(".image-cell").forEach((cell) => {
        cell.classList.add("selected");
    });
    updateCounter();
}

function deselectAll() {
    selected.clear();
    document.querySelectorAll(".image-cell").forEach((cell) => {
        cell.classList.remove("selected");
    });
    updateCounter();
}

async function submitSelection() {
    if (selected.size === 0) return;

    doneBtn.disabled = true;
    doneBtn.textContent = "Copying...";

    try {
        const res = await fetch("/done", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: Array.from(selected) }),
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error);
            return;
        }

        loadSection.classList.add("hidden");
        toolbar.classList.add("hidden");
        grid.classList.add("hidden");
        resultPath.textContent = data.output_dir;
        resultCount.textContent = `${data.copied} image(s) copied successfully.`;
        result.classList.remove("hidden");
    } catch (err) {
        alert("Failed to copy files.");
    } finally {
        doneBtn.disabled = false;
        doneBtn.textContent = "Done";
    }
}
