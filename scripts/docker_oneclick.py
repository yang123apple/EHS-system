#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "docker-compose.prod.yml"
ENV_FILE = ROOT / ".env.docker"

REQUIRED_DIRS = [
    "data",
    "data/db",
    "data/minio-data",
    "data/minio-config",
    "data/minio-backup",
    "public/uploads",
    "ehs-private",
    "ehs-public",
]


def run(cmd: list[str], env: dict[str, str]) -> None:
    print("+ " + " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, env=env, check=True)


def detect_compose() -> list[str]:
    if shutil.which("docker") is None:
        sys.exit("ERROR: docker not found in PATH.")
    try:
        subprocess.run(
            ["docker", "compose", "version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return ["docker", "compose"]
    except Exception:
        if shutil.which("docker-compose"):
            return ["docker-compose"]
    sys.exit("ERROR: docker compose is not available.")


def ensure_dirs() -> None:
    for rel in REQUIRED_DIRS:
        path = ROOT / rel
        if path.exists():
            continue
        path.mkdir(parents=True, exist_ok=True)


def main() -> None:
    if not COMPOSE_FILE.exists():
        sys.exit(f"ERROR: Missing {COMPOSE_FILE}")
    if not ENV_FILE.exists():
        sys.exit(f"ERROR: Missing {ENV_FILE}")

    ensure_dirs()
    compose_cmd = detect_compose()

    env = os.environ.copy()
    env.setdefault("COMPOSE_PROJECT_NAME", "ehs")

    base_cmd = compose_cmd + ["--env-file", str(ENV_FILE), "-f", str(COMPOSE_FILE)]
    run(base_cmd + ["up", "-d", "--build"], env=env)
    run(base_cmd + ["ps"], env=env)


if __name__ == "__main__":
    main()
