import os
import requests
from io import BytesIO
from PIL import Image

DRIVE_ID = "1-7XnY0AUgFm0ee9AZug3I-c_iEDy_vTN"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public")
os.makedirs(OUT_DIR, exist_ok=True)


def download_file_from_google_drive(id):
    session = requests.Session()
    URL = "https://docs.google.com/uc?export=download"
    response = session.get(URL, params={"id": id}, stream=True)

    token = None
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            token = value
            break

    if token:
        params = {"id": id, "confirm": token}
        response = session.get(URL, params=params, stream=True)

    response.raise_for_status()
    return response.content


print("Downloading image from Drive...")
data = download_file_from_google_drive(DRIVE_ID)
img = Image.open(BytesIO(data)).convert("RGBA")

# Ensure square canvas by padding
size = max(img.size)
bg = Image.new("RGBA", (size, size), (255,255,255,0))
bg.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2), mask=img if img.mode=="RGBA" else None)
img = bg

# Save main logo (512x512)
logo_path = os.path.join(OUT_DIR, "logo.png")
img.resize((512,512), Image.LANCZOS).save(logo_path, format="PNG")
print("Saved", logo_path)

# Generate favicons and icons
sizes = [(16, "favicon-16.png"), (32, "favicon-32.png"), (192, "favicon-192.png"), (180, "apple-touch-icon.png")]
for s, name in sizes:
    path = os.path.join(OUT_DIR, name)
    img.resize((s,s), Image.LANCZOS).save(path, format="PNG")
    print("Saved", path)

# Save favicon.ico with multiple sizes
ico_path = os.path.join(OUT_DIR, "favicon.ico")
ico_sizes = [(16,16),(32,32),(48,48),(64,64)]
icons = [img.resize(sz, Image.LANCZOS) for sz in ico_sizes]
icons[0].save(ico_path, format="ICO", sizes=ico_sizes)
print("Saved", ico_path)

print("Icon generation complete.")
