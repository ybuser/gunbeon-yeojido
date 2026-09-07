"""Normalize downloaded public data; does not fetch or persist KTO API data.

Run from repository root: python3 scripts/normalize_public_data.py
Unknown operating/access/reward facts stay unknown. Download time is not venue verification.
"""
from pathlib import Path
import csv
import collections
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/public"
OUT = ROOT / "data/processed"
REPORTS = ROOT / "reports"
RETRIEVED = "2026-09-07"
REGIONS = ["철원", "화천", "양구", "인제", "고성"]
SOURCES = {
    "dmz_tourism": {"file": "dmz-15119699-0.csv", "url": "https://www.data.go.kr/data/15119699/fileData.do", "version": "20260820"},
    "dmz_cafe": {"file": "dmz-15119706-0.csv", "url": "https://www.data.go.kr/data/15119706/fileData.do", "version": "20251031"},
    "mpva_memorial": {"file": "mpva-api-response.json", "url": "https://mfis.mpva.go.kr/api/json/allSearch.do", "version": "live-response-20260907"},
}

def region(address):
    if "강원" not in address:
        return None
    return next((r for r in REGIONS if r + "군" in address), None)

def number(value):
    try:
        return float(value) if value not in ("", None) else None
    except (ValueError, TypeError):
        return None

def valid_coordinate(lat, lon):
    return lat is not None and lon is not None and 33 <= lat <= 39.5 and 124 <= lon <= 132

def make_node(source, row, row_index):
    memorial = source == "mpva_memorial"
    title = row.get("facilnm" if memorial else "이름", "").strip()
    address = row.get("addr" if memorial else "주소", "").strip()
    county = region(address)
    lat = number(row.get("xindex" if memorial else "위도"))
    lon = number(row.get("yindex" if memorial else "경도"))
    sid = row.get("mgmtno") if memorial else hashlib.sha256((title + "|" + address).encode()).hexdigest()[:16]
    flags = ["operations_unverified", "reservation_unknown", "id_check_unknown", "accessibility_unknown"]
    phone = row.get("전화번호") or None
    image = row.get("이미지URL") or None
    if not valid_coordinate(lat, lon):
        flags.append("coordinate_missing_or_invalid")
    if phone is None:
        flags.append("telephone_not_in_source" if memorial else "telephone_missing")
    if image is None:
        flags.append("image_missing")
    if memorial:
        flags.extend(["address_district_only", "reward_eligibility_unverified", "public_access_unverified"])
    elif row.get("번호구분") == "지자체 대표번호":
        flags.append("telephone_is_municipal_contact")
    if image:
        flags.append("image_license_not_verified")
    source_meta = SOURCES[source]
    return {
        "id": f"{source}:{sid}", "source": source, "source_id": sid,
        "source_url": source_meta["url"], "source_file": "data/raw/public/" + source_meta["file"],
        "source_version": source_meta["version"], "source_row_number": row_index,
        "ingested_at": RETRIEVED, "title": title, "address": address,
        "lat": lat, "lon": lon, "sigungu": county + "군", "chapter": county + "장",
        "category": "memorial" if memorial else "cafe" if source == "dmz_cafe" else "attraction",
        "theme_tags": (["호국"] if row.get("gubun") == "국가수호" else ["독립운동"]) if memorial else [],
        "military_context_tags": ["현충시설"] if memorial else [],
        "family_tags": [], "access_tags": [], "reward_tags": [],
        "reservation_required": None, "id_check_required": None, "opening_status": "unknown",
        "image_url": image, "overview": row.get("facilexplain", "") if memorial else "",
        "telephone": phone, "source_topic": row.get("topic") if memorial else None,
        "data_quality_flags": flags, "last_verified_at": None,
    }

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    nodes, metrics = [], []
    for source, meta in SOURCES.items():
        payload = (RAW / meta["file"]).read_bytes()
        rows = json.loads(payload)["data"] if source == "mpva_memorial" else list(csv.DictReader(payload.decode("cp949").splitlines()))
        address_key = "addr" if source == "mpva_memorial" else "주소"
        gangwon = [r for r in rows if "강원" in r.get(address_key, "")]
        selected = [(idx, r) for idx, r in enumerate(rows, start=2 if source != "mpva_memorial" else 1) if region(r.get(address_key, ""))]
        source_nodes = [make_node(source, row, idx) for idx, row in selected]
        nodes.extend(source_nodes)
        lat_key, lon_key = ("xindex", "yindex") if source == "mpva_memorial" else ("위도", "경도")
        missing = lambda rs: sum(not valid_coordinate(number(r.get(lat_key)), number(r.get(lon_key))) for r in rs)
        metrics.append({
            "source": source, **meta, "retrieved_at": RETRIEVED,
            "sha256": hashlib.sha256(payload).hexdigest(), "columns": list(rows[0]),
            "total_records": len(rows), "gangwon_records": len(gangwon),
            "border_5_records": len(selected), "border_5_ratio": round(len(selected) / len(rows), 6),
            "coordinate_missing_or_invalid": missing(rows),
            "border_5_coordinate_missing_or_invalid": missing([r for _, r in selected]),
            "telephone_missing": None if source == "mpva_memorial" else sum(not r.get("전화번호", "").strip() for r in rows),
            "border_5_telephone_missing": None if source == "mpva_memorial" else sum(not r.get("전화번호", "").strip() for _, r in selected),
            "border_5_by_region": dict(collections.Counter(n["sigungu"] for n in source_nodes)),
            "exact_title_address_duplicates": len(source_nodes) - len({(n["title"], n["address"]) for n in source_nodes}),
        })
    grouped = collections.defaultdict(list)
    for n in nodes:
        grouped[(n["sigungu"], re.sub(r"[^가-힣a-zA-Z0-9]", "", n["title"]))].append(n)
    for group in grouped.values():
        if len(group) > 1:
            for n in group:
                n["data_quality_flags"].append("duplicate_title_county_review")
    (OUT / "place_nodes_gangwon.json").write_text(json.dumps(nodes, ensure_ascii=False, indent=2) + "\n")
    (REPORTS / "data_validation_metrics.json").write_text(json.dumps({"retrieved_at": RETRIEVED, "sources": metrics, "normalized_records": len(nodes), "map_candidate_records": sum(valid_coordinate(n["lat"], n["lon"]) for n in nodes), "duplicate_title_county_groups": sum(len(v) > 1 for v in grouped.values()), "mission_generation_verified": False}, ensure_ascii=False, indent=2) + "\n")
    with (REPORTS / "data_quality_flags.csv").open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.writer(file)
        writer.writerow(["id", "source", "source_row_number", "title", "sigungu", "flag"])
        for n in nodes:
            for flag in n["data_quality_flags"]:
                writer.writerow([n["id"], n["source"], n["source_row_number"], n["title"], n["sigungu"], flag])
    print(json.dumps({"nodes": len(nodes), "sources": metrics}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
