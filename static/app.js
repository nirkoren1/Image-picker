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

function groupByDay(files) {
    const groups = new Map();
    for (const file of files) {
        const dayKey = file.date.slice(0, 10);
        if (!groups.has(dayKey)) {
            groups.set(dayKey, []);
        }
        groups.get(dayKey).push(file);
    }
    return groups;
}

function formatDayHeading(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function renderGrid() {
    grid.innerHTML = "";
    const groups = groupByDay(allFiles);

    for (const [dayKey, files] of groups) {
        const groupEl = document.createElement("div");
        groupEl.className = "day-group";

        const header = document.createElement("div");
        header.className = "day-header";
        header.innerHTML =
            `<span class="day-toggle">&#9660;</span>` +
            `<span class="day-label">${formatDayHeading(dayKey)}</span>` +
            `<span class="day-count">${files.length} image${files.length !== 1 ? "s" : ""}</span>`;

        const dayGrid = document.createElement("div");
        dayGrid.className = "day-grid";

        header.addEventListener("click", () => {
            const collapsed = dayGrid.classList.toggle("collapsed");
            header.querySelector(".day-toggle").innerHTML = collapsed
                ? "&#9654;"
                : "&#9660;";
        });

        for (const file of files) {
            const cell = document.createElement("div");
            cell.className = "image-cell";
            cell.dataset.filename = file.name;
            if (selected.has(file.name)) cell.classList.add("selected");
            cell.onclick = () => toggleSelect(file.name, cell);

            const img = document.createElement("img");
            img.src = `/thumb/${encodeURIComponent(file.name)}`;
            img.alt = file.name;
            img.title = file.name;
            img.loading = "lazy";

            const magnifyBtn = document.createElement("button");
            magnifyBtn.className = "magnify-btn";
            magnifyBtn.innerHTML = "&#128269;";
            magnifyBtn.title = "View full size";
            magnifyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openLightbox(file.name);
            });

            cell.appendChild(img);
            cell.appendChild(magnifyBtn);
            dayGrid.appendChild(cell);
        }

        groupEl.appendChild(header);
        groupEl.appendChild(dayGrid);
        grid.appendChild(groupEl);
    }
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
    allFiles.forEach((f) => selected.add(f.name));
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

function openLightbox(filename) {
    const overlay = document.getElementById("lightbox-overlay");
    const img = document.getElementById("lightbox-img");
    img.src = `/full/${encodeURIComponent(filename)}`;
    overlay.classList.remove("hidden");
}

function closeLightbox() {
    const overlay = document.getElementById("lightbox-overlay");
    const img = document.getElementById("lightbox-img");
    overlay.classList.add("hidden");
    img.src = "";
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
});

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
