#!/usr/bin/env python3
"""Publish a read-only, EXIF-stripped snapshot of GAIA plant records for ChatGPT.

Requires GAIA_VIEW_TOKEN as a GitHub Actions secret. This script NEVER writes
that token, a Supabase key, or an authenticated URL into the repository.
"""
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

API = "https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/gaia-private-view"
TOKEN = os.environ.get("GAIA_VIEW_TOKEN", "").strip()
ROOT = Path("gaia-reference")
IMAGES = ROOT / "photos"
OUTPUT = ROOT / "snapshot.json"
PLANT_FIELDS = (
    "plant_id", "name", "species", "reference_photo", "latest_photo",
    "previous_photo", "photos", "pot", "soil_observations", "care_events"
)
MAX_JSON_BYTES = 8 * 1024 * 1024
MAX_IMAGE_BYTES = 12 * 1024 * 1024
UUID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")


def read_endpoint(parameters, max_bytes):
    params = {"access": TOKEN, **parameters}
    url = API + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        url, headers={"User-Agent": "GAIA-read-only-GitHub-reference/1.0"}
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        if response.status != 200:
            raise RuntimeError("GAIA returned HTTP " + str(response.status))
        body = response.read(max_bytes + 1)
    if len(body) > max_bytes:
        raise RuntimeError("GAIA response exceeds the allowed size")
    return body


def load_previous():
    if not OUTPUT.exists():
        return {}
    try:
        contents = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return {str(p["plant_id"]): p for p in contents.get("plants", [])}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def photo_filename(plant_id, which):
    slug = re.sub(r"[^A-Za-z0-9_-]", "-", plant_id).strip("-")[:50] or "plant"
    suffix = hashlib.sha256(plant_id.encode("utf-8")).hexdigest()[:10]
    return f"{slug}-{suffix}-{which}.webp"


def snapshot_image(plant_id, label, photo, old_plant, keep):
    if not isinstance(photo, dict):
        return
    photo_id = photo.get("id")
    if not isinstance(photo_id, str) or not UUID_PATTERN.fullmatch(photo_id):
        return
    filename = photo_filename(plant_id, label)
    path = IMAGES / filename
    former = old_plant.get(label) or {}
    if not (path.is_file() and former.get("id") == photo_id):
        photo_data = read_endpoint({"image": photo_id}, MAX_IMAGE_BYTES)
        with Image.open(io.BytesIO(photo_data)) as original:
            original.verify()
        with Image.open(io.BytesIO(photo_data)) as original:
            clean = ImageOps.exif_transpose(original)
            clean.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
            rgb = clean.convert("RGB")
            rgb.save(path, "WEBP", quality=84, method=5)
    keep.add(filename)
    photo["snapshot_image"] = "gaia-reference/photos/" + filename


def main():
    if not TOKEN:
        print(
            "Missing GAIA_VIEW_TOKEN GitHub Actions secret. "
            "Add it in Repository Settings > Secrets and variables > Actions.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    raw = read_endpoint({"format": "json"}, MAX_JSON_BYTES)
    result = json.loads(raw)
    if result.get("read_only") is not True or not isinstance(result.get("plants"), list):
        raise RuntimeError("Unexpected GAIA API response format")
    ROOT.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    previous = load_previous()
    keep = set()
    plants = []
    for record in result["plants"]:
        if not isinstance(record, dict) or not record.get("plant_id"):
            continue
        item = {field: record.get(field) for field in PLANT_FIELDS}
        plant_id = str(item["plant_id"])
        for which in ("latest_photo", "previous_photo"):
            snapshot_image(
                plant_id, which, item.get(which), previous.get(plant_id, {}), keep
            )
        plants.append(item)
    if not plants:
        raise RuntimeError("GAIA returned no plants; refusing to publish an empty snapshot")
    output = {
        "schema_version": 1,
        "read_only": True,
        "source": "GAIA owner-approved reference snapshot",
        "generated_at": result.get("generated_at"),
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "plant_count": len(plants),
        "unavailable_sections": result.get("unavailable_sections", []),
        "plants": plants,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for unused in IMAGES.glob("*.webp"):
        if unused.name not in keep:
            unused.unlink()
    print("Published reference snapshot for", len(plants), "plants and", len(keep), "photos.")


if __name__ == "__main__":
    main()
