from pathlib import Path

from discoflow_cli.config import PACKAGE_RELATIVE_PATH, build_paths, find_repo_root, resolve_extension_dir


def test_resolve_extension_dir_defaults_to_home_custom() -> None:
    home = Path("/tmp/example-home")
    resolved = resolve_extension_dir(None, home_dir=home)
    assert resolved == home / ".n8n" / "custom"


def test_resolve_extension_dir_uses_first_semicolon_entry() -> None:
    resolved = resolve_extension_dir("/one;/two")
    assert resolved == Path("/one")


def test_resolve_extension_dir_uses_first_colon_entry() -> None:
    resolved = resolve_extension_dir("/one:/two")
    assert resolved == Path("/one")


def test_resolve_extension_dir_empty_first_entry_uses_default() -> None:
    home = Path("/tmp/example-home")
    resolved = resolve_extension_dir(" ;/two", home_dir=home)
    assert resolved == home / ".n8n" / "custom"


def test_find_repo_root_from_env_var(monkeypatch, tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    package_dir = repo_root / PACKAGE_RELATIVE_PATH
    package_dir.mkdir(parents=True)
    (package_dir / "package.json").write_text("{}", encoding="utf-8")

    monkeypatch.setenv("DISCOFLOW_REPO_ROOT", str(repo_root))
    discovered = find_repo_root()

    assert discovered == repo_root.resolve()


def test_build_paths_finds_repo_from_cwd(monkeypatch, tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    package_dir = repo_root / PACKAGE_RELATIVE_PATH
    package_dir.mkdir(parents=True)
    (package_dir / "package.json").write_text("{}", encoding="utf-8")

    monkeypatch.delenv("DISCOFLOW_REPO_ROOT", raising=False)
    monkeypatch.chdir(package_dir)

    paths = build_paths()

    assert paths.repo_root == repo_root.resolve()
    assert paths.package_dir == package_dir.resolve()
