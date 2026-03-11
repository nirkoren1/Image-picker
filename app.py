import io
import shutil
import webbrowser
from datetime import datetime
from pathlib import Path
from threading import Timer

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageOps

app = Flask(__name__)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

# Single-user local tool: store state at module level
source_directory = None
thumbnail_cache = {}


def get_image_files(directory):
    """List image files in the given directory (non-recursive)."""
    path = Path(directory)
    files = []
    for f in sorted(path.iterdir()):
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(f.name)
    return files


def validate_filename(filename):
    """Ensure filename is safe and exists within the source directory."""
    if source_directory is None:
        return None
    # Prevent path traversal
    file_path = (Path(source_directory) / filename).resolve()
    if not str(file_path).startswith(str(Path(source_directory).resolve())):
        return None
    if not file_path.is_file():
        return None
    return file_path


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/load", methods=["POST"])
def load_directory():
    global source_directory, thumbnail_cache

    data = request.get_json()
    directory = data.get("directory", "").strip()

    if not directory:
        return jsonify({"error": "No directory path provided."}), 400

    path = Path(directory)
    if not path.exists():
        return jsonify({"error": f"Directory does not exist: {directory}"}), 400
    if not path.is_dir():
        return jsonify({"error": f"Path is not a directory: {directory}"}), 400

    source_directory = str(path.resolve())
    thumbnail_cache = {}

    files = get_image_files(source_directory)
    if not files:
        return jsonify({"error": "No image files found in the directory."}), 400

    return jsonify({"files": files, "count": len(files)})


@app.route("/thumb/<filename>")
def serve_thumbnail(filename):
    file_path = validate_filename(filename)
    if file_path is None:
        return "Not found", 404

    cache_key = str(file_path)
    if cache_key not in thumbnail_cache:
        img = Image.open(file_path)
        transposed = ImageOps.exif_transpose(img)
        if transposed is not None:
            img = transposed
        img.thumbnail((200, 200))
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        buf.seek(0)
        thumbnail_cache[cache_key] = buf.getvalue()

    return send_file(
        io.BytesIO(thumbnail_cache[cache_key]),
        mimetype="image/jpeg",
    )


@app.route("/done", methods=["POST"])
def done():
    if source_directory is None:
        return jsonify({"error": "No directory loaded."}), 400

    data = request.get_json()
    files = data.get("files", [])

    if not files:
        return jsonify({"error": "No files selected."}), 400

    # Create output directory as sibling of source
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    source_path = Path(source_directory)
    output_dir = source_path.parent / f"selected_{timestamp}"
    output_dir.mkdir(exist_ok=True)

    copied = 0
    for filename in files:
        file_path = validate_filename(filename)
        if file_path is not None:
            shutil.copy2(file_path, output_dir / filename)
            copied += 1

    return jsonify({
        "output_dir": str(output_dir),
        "copied": copied,
    })


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    Timer(1, open_browser).start()
    app.run(debug=False, port=5000)
