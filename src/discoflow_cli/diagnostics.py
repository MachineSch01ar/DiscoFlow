from __future__ import annotations

import os
import site
import stat
from dataclasses import dataclass, field
from pathlib import Path

from .config import Paths, NODE_DISPLAY_NAME
from .process import is_pid_file_running, read_pid
from .shell import DiscoflowError, capture_command, require_command

MIN_NODE_MAJOR = 18
MIN_NODE_MINOR = 17
RECOMMENDED_NODE_MAJOR = 22
EDITABLE_PTH_GLOB = "__editable__.discoflow_cli-*.pth"
NON_EDITABLE_REPAIR_COMMAND = "UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli"
NON_EDITABLE_RUN_PATTERN = "uv run --no-editable discoflow <command>"


@dataclass
class DoctorReport:
    infos: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _parse_node_version(raw: str) -> tuple[int, int] | None:
    value = raw.strip()
    if value.startswith("v"):
        value = value[1:]

    parts = value.split(".")
    if len(parts) < 2:
        return None

    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        return None


def _uv_no_editable_enabled() -> bool:
    value = os.environ.get("UV_NO_EDITABLE", "")
    return value.lower() in {"1", "true", "yes", "on"}


def _collect_editable_pth_files() -> list[Path]:
    locations: list[Path] = []
    seen_locations: set[Path] = set()
    results: list[Path] = []
    seen_results: set[Path] = set()

    for raw in site.getsitepackages():
        candidate = Path(raw)
        if not candidate.is_dir() or candidate in seen_locations:
            continue
        locations.append(candidate)
        seen_locations.add(candidate)

    try:
        user_site = Path(site.getusersitepackages())
        if user_site.is_dir() and user_site not in seen_locations:
            locations.append(user_site)
            seen_locations.add(user_site)
    except Exception:
        pass

    for location in locations:
        for editable_pth in location.glob(EDITABLE_PTH_GLOB):
            resolved = editable_pth.resolve()
            if resolved in seen_results:
                continue
            results.append(resolved)
            seen_results.add(resolved)

    return results


def _is_hidden_pth_file(path: Path) -> bool:
    try:
        stats = path.stat()
    except OSError:
        return False

    hidden_flag = getattr(stat, "UF_HIDDEN", 0)
    if not hidden_flag:
        return False

    flags = getattr(stats, "st_flags", 0)
    return bool(flags & hidden_flag)


def _append_editable_install_diagnostics(report: DoctorReport) -> None:
    if not _uv_no_editable_enabled():
        report.warnings.append(
            "UV_NO_EDITABLE is not set. Prefer "
            f"`{NON_EDITABLE_RUN_PATTERN}` to avoid editable-install import issues."
        )

    editable_pth_files = _collect_editable_pth_files()
    if not editable_pth_files:
        return

    hidden_files = [path for path in editable_pth_files if _is_hidden_pth_file(path)]
    if hidden_files:
        rendered = ", ".join(str(path) for path in hidden_files)
        report.errors.append(
            "Detected hidden editable .pth file(s) for discoflow-cli, which can break imports: "
            f"{rendered}"
        )
        report.errors.append(f"Repair with: `{NON_EDITABLE_REPAIR_COMMAND}`")
        report.errors.append(f"Then run commands as: `{NON_EDITABLE_RUN_PATTERN}`")
        return

    rendered = ", ".join(str(path) for path in editable_pth_files)
    report.warnings.append(
        "Detected editable discoflow-cli install (.pth): "
        f"{rendered}. Non-editable runs are recommended: `{NON_EDITABLE_RUN_PATTERN}`"
    )


def run_doctor(paths: Paths) -> DoctorReport:
    report = DoctorReport()

    report.infos.append(f"Repo root: {paths.repo_root}")
    report.infos.append(f"Package dir: {paths.package_dir}")
    report.infos.append(f"Extension dir: {paths.ext_dir}")
    report.infos.append(f"Node UI name: {NODE_DISPLAY_NAME}")
    _append_editable_install_diagnostics(report)

    for required in ("node", "npm"):
        try:
            require_command(required)
        except DiscoflowError as exc:
            report.errors.append(str(exc))

    if report.errors:
        return report

    try:
        node_version_raw = capture_command(["node", "-v"])
    except DiscoflowError as exc:
        report.errors.append(str(exc))
        return report

    parsed_node_version = _parse_node_version(node_version_raw)
    if parsed_node_version is None:
        report.errors.append(f"Unable to parse Node.js version: {node_version_raw}")
    else:
        major, minor = parsed_node_version
        if major < MIN_NODE_MAJOR or (major == MIN_NODE_MAJOR and minor < MIN_NODE_MINOR):
            report.errors.append(
                f"Node.js must be >= {MIN_NODE_MAJOR}.{MIN_NODE_MINOR}. Current: {node_version_raw}"
            )
        else:
            report.infos.append(f"Node version OK: {node_version_raw}")
            if major != RECOMMENDED_NODE_MAJOR:
                report.warnings.append(
                    f"Node {RECOMMENDED_NODE_MAJOR} is recommended for local n8n development. Current: {node_version_raw}"
                )

    try:
        n8n_version = capture_command(["n8n", "--version"])
        report.infos.append(f"n8n version: {n8n_version}")
    except DiscoflowError:
        report.warnings.append("n8n command not found. Bootstrap will install it globally via npm.")

    if not paths.package_dir.is_dir() or not (paths.package_dir / "package.json").exists():
        report.errors.append(f"Package directory missing or invalid: {paths.package_dir}")

    if os.environ.get("N8N_COMMUNITY_PACKAGES_ENABLED") == "false":
        report.warnings.append("N8N_COMMUNITY_PACKAGES_ENABLED=false can prevent package loading")

    if os.environ.get("N8N_COMMUNITY_PACKAGES_PREVENT_LOADING") == "true":
        report.warnings.append("N8N_COMMUNITY_PACKAGES_PREVENT_LOADING=true prevents package loading")

    link_path = paths.linked_package_path
    if link_path.is_symlink():
        raw_target = os.readlink(link_path)
        report.infos.append(f"Link exists: {link_path} -> {raw_target}")
        try:
            resolved_target = link_path.resolve()
            expected_target = paths.package_dir.resolve()
            if resolved_target != expected_target:
                report.warnings.append(
                    f"Link target resolves to {resolved_target}, expected {expected_target}"
                )
        except OSError:
            report.warnings.append(f"Could not resolve symlink target for {link_path}")
    elif link_path.exists():
        report.warnings.append(f"Package exists but is not symlinked: {link_path}")
    else:
        report.warnings.append(f"No package link found at: {link_path}")

    if is_pid_file_running(paths.n8n_pid_file):
        report.infos.append(f"n8n managed process running (pid {read_pid(paths.n8n_pid_file)})")
    else:
        report.infos.append("n8n managed process not running")

    if is_pid_file_running(paths.watch_pid_file):
        report.infos.append(f"watch managed process running (pid {read_pid(paths.watch_pid_file)})")
    else:
        report.infos.append("watch managed process not running")

    return report
