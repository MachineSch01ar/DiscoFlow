from pathlib import Path

import discoflow_cli.diagnostics as diagnostics
from discoflow_cli.config import Paths


def _build_paths(tmp_path: Path) -> Paths:
    repo_root = tmp_path / "repo"
    package_dir = repo_root / "packages" / "n8n-nodes-discourse"
    package_dir.mkdir(parents=True)
    (package_dir / "package.json").write_text("{}", encoding="utf-8")

    ext_dir = tmp_path / "ext"
    state_dir = repo_root / ".tmp" / "dev"

    return Paths(
        repo_root=repo_root,
        package_dir=package_dir,
        ext_dir=ext_dir,
        state_dir=state_dir,
        n8n_pid_file=state_dir / "n8n.pid",
        watch_pid_file=state_dir / "watch.pid",
        n8n_log_file=state_dir / "n8n.log",
        watch_log_file=state_dir / "watch.log",
    )


def _patch_runtime_dependencies(monkeypatch) -> None:
    def _capture_command(cmd: list[str]) -> str:
        if cmd == ["node", "-v"]:
            return "v22.22.0"
        return "2.9.4"

    monkeypatch.setattr(diagnostics, "require_command", lambda _cmd: None)
    monkeypatch.setattr(diagnostics, "capture_command", _capture_command)
    monkeypatch.setattr(diagnostics, "is_pid_file_running", lambda _pid_file: False)
    monkeypatch.setattr(diagnostics, "read_pid", lambda _pid_file: None)


def test_doctor_no_editable_pth_with_uv_no_editable_set(monkeypatch, tmp_path: Path) -> None:
    _patch_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("UV_NO_EDITABLE", "1")
    monkeypatch.setattr(diagnostics, "_collect_editable_pth_files", lambda: [])

    report = diagnostics.run_doctor(_build_paths(tmp_path))

    assert all("UV_NO_EDITABLE is not set" not in warning for warning in report.warnings)
    assert not report.errors


def test_doctor_warns_when_uv_no_editable_unset(monkeypatch, tmp_path: Path) -> None:
    _patch_runtime_dependencies(monkeypatch)
    monkeypatch.delenv("UV_NO_EDITABLE", raising=False)
    monkeypatch.setattr(diagnostics, "_collect_editable_pth_files", lambda: [])

    report = diagnostics.run_doctor(_build_paths(tmp_path))

    assert any("UV_NO_EDITABLE is not set" in warning for warning in report.warnings)
    assert not report.errors


def test_doctor_warns_for_editable_pth_without_hidden_flag(monkeypatch, tmp_path: Path) -> None:
    _patch_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("UV_NO_EDITABLE", "1")

    editable_pth = tmp_path / "site-packages" / "__editable__.discoflow_cli-0.1.0.pth"
    editable_pth.parent.mkdir(parents=True)
    editable_pth.write_text(str(tmp_path / "src"), encoding="utf-8")

    monkeypatch.setattr(diagnostics, "_collect_editable_pth_files", lambda: [editable_pth])
    monkeypatch.setattr(diagnostics, "_is_hidden_pth_file", lambda _path: False)

    report = diagnostics.run_doctor(_build_paths(tmp_path))

    assert any("Detected editable discoflow-cli install (.pth)" in warning for warning in report.warnings)
    assert not report.errors


def test_doctor_errors_for_hidden_editable_pth(monkeypatch, tmp_path: Path) -> None:
    _patch_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("UV_NO_EDITABLE", "1")

    editable_pth = tmp_path / "site-packages" / "__editable__.discoflow_cli-0.1.0.pth"
    editable_pth.parent.mkdir(parents=True)
    editable_pth.write_text(str(tmp_path / "src"), encoding="utf-8")

    monkeypatch.setattr(diagnostics, "_collect_editable_pth_files", lambda: [editable_pth])
    monkeypatch.setattr(diagnostics, "_is_hidden_pth_file", lambda _path: True)

    report = diagnostics.run_doctor(_build_paths(tmp_path))

    assert any("Detected hidden editable .pth file(s) for discoflow-cli" in error for error in report.errors)
    assert any("UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli" in error for error in report.errors)
