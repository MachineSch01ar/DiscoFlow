from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PACKAGE_NAME = "@machinesch01ar/n8n-nodes-discourse"
NODE_DISPLAY_NAME = "Discourse Extended"
PACKAGE_RELATIVE_PATH = Path("packages/n8n-nodes-discourse")
STATE_RELATIVE_PATH = Path(".tmp/dev")

N8N_PID_FILE_NAME = "n8n.pid"
WATCH_PID_FILE_NAME = "watch.pid"
N8N_LOG_FILE_NAME = "n8n.log"
WATCH_LOG_FILE_NAME = "watch.log"
REPO_ROOT_ENV_VAR = "DISCOFLOW_REPO_ROOT"


@dataclass(frozen=True)
class Paths:
    repo_root: Path
    package_dir: Path
    ext_dir: Path
    state_dir: Path
    n8n_pid_file: Path
    watch_pid_file: Path
    n8n_log_file: Path
    watch_log_file: Path

    @property
    def linked_package_path(self) -> Path:
        return self.ext_dir / "node_modules" / "@machinesch01ar" / "n8n-nodes-discourse"


def _is_repo_root(path: Path) -> bool:
    return (path / PACKAGE_RELATIVE_PATH / "package.json").exists()


def _walk_up(start: Path) -> list[Path]:
    return [start, *start.parents]


def find_repo_root(explicit_root: Path | None = None) -> Path:
    candidates: list[Path] = []
    seen: set[Path] = set()

    env_root = os.environ.get(REPO_ROOT_ENV_VAR)
    if env_root:
        candidates.append(Path(env_root).expanduser())

    if explicit_root is not None:
        candidates.append(explicit_root)

    candidates.extend(_walk_up(Path.cwd()))
    candidates.extend(_walk_up(Path(__file__).resolve()))

    for raw in candidates:
        candidate = raw.resolve()
        if candidate in seen:
            continue
        seen.add(candidate)
        if _is_repo_root(candidate):
            return candidate

    raise RuntimeError(
        "Unable to locate DiscoFlow repository root. Run commands from the repo root or set "
        f"{REPO_ROOT_ENV_VAR} to the repository path."
    )


def resolve_extension_dir(raw_value: str | None, home_dir: Path | None = None) -> Path:
    home = home_dir or Path.home()
    default_dir = (home / ".n8n" / "custom").expanduser()

    if not raw_value:
        return default_dir

    first_path = raw_value
    if ";" in first_path:
        first_path = first_path.split(";", 1)[0]
    elif ":" in first_path:
        first_path = first_path.split(":", 1)[0]

    first_path = first_path.strip()
    if not first_path:
        return default_dir

    return Path(first_path).expanduser()


def build_paths(repo_root: Path | None = None) -> Paths:
    root = find_repo_root(repo_root)
    ext_dir = resolve_extension_dir(os.environ.get("N8N_CUSTOM_EXTENSIONS"))
    state_dir = root / STATE_RELATIVE_PATH

    return Paths(
        repo_root=root,
        package_dir=root / PACKAGE_RELATIVE_PATH,
        ext_dir=ext_dir,
        state_dir=state_dir,
        n8n_pid_file=state_dir / N8N_PID_FILE_NAME,
        watch_pid_file=state_dir / WATCH_PID_FILE_NAME,
        n8n_log_file=state_dir / N8N_LOG_FILE_NAME,
        watch_log_file=state_dir / WATCH_LOG_FILE_NAME,
    )
