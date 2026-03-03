from __future__ import annotations

import shutil
from pathlib import Path

import typer

from .config import PACKAGE_NAME, Paths, build_paths
from .diagnostics import run_doctor
from .process import (
    is_pid_file_running,
    read_pid,
    start_process,
    stop_process,
    stream_log,
    stream_log_follow,
)
from .shell import DiscoflowError, require_command, run_command

app = typer.Typer(
    add_completion=False,
    help="DiscoFlow contributor CLI for local n8n node development.",
    no_args_is_help=True,
)


def info(message: str) -> None:
    typer.echo(f"[discoflow] {message}")


def warn(message: str) -> None:
    typer.echo(f"[discoflow][warn] {message}", err=True)


def error(message: str) -> None:
    typer.echo(f"[discoflow][error] {message}", err=True)


def fail(message: str, exit_code: int = 1) -> None:
    error(message)
    raise typer.Exit(code=exit_code)


def execute(action) -> None:  # type: ignore[no-untyped-def]
    try:
        action()
    except DiscoflowError as exc:
        fail(str(exc))


def ensure_extension_dir(paths: Paths) -> None:
    paths.ext_dir.mkdir(parents=True, exist_ok=True)
    package_json = paths.ext_dir / "package.json"
    if not package_json.exists():
        info(f"Initializing npm package in extension dir: {paths.ext_dir}")
        run_command(["npm", "init", "-y"], cwd=paths.ext_dir)


def install_global_n8n_if_missing() -> None:
    if shutil.which("n8n"):
        return

    info("n8n is not installed. Installing globally with npm")
    run_command(["npm", "install", "-g", "n8n"])
    info("Installed n8n globally")


def build_package(paths: Paths) -> None:
    info(f"Building package in {paths.package_dir}")
    run_command(["npm", "run", "build"], cwd=paths.package_dir)


def link_package(paths: Paths) -> None:
    require_command("npm")
    ensure_extension_dir(paths)

    info(f"Linking package globally from {paths.package_dir}")
    run_command(["npm", "link"], cwd=paths.package_dir)

    info(f"Linking package into extension dir {paths.ext_dir}")
    run_command(["npm", "link", PACKAGE_NAME], cwd=paths.ext_dir)


def start_n8n(paths: Paths) -> None:
    require_command("n8n")

    if is_pid_file_running(paths.n8n_pid_file):
        pid = read_pid(paths.n8n_pid_file)
        info(f"n8n already running (pid {pid})")
        return

    info("Starting n8n")
    pid = start_process(
        name="n8n",
        command=["n8n", "start"],
        cwd=paths.repo_root,
        pid_file=paths.n8n_pid_file,
        log_file=paths.n8n_log_file,
    )
    info(f"n8n started (pid {pid})")
    info(f"Log file: {paths.n8n_log_file}")


def start_watch(paths: Paths) -> None:
    require_command("npm")

    if is_pid_file_running(paths.watch_pid_file):
        pid = read_pid(paths.watch_pid_file)
        info(f"watch already running (pid {pid})")
        return

    info("Starting build watch")
    pid = start_process(
        name="watch",
        command=["npm", "run", "build:watch"],
        cwd=paths.package_dir,
        pid_file=paths.watch_pid_file,
        log_file=paths.watch_log_file,
    )
    info(f"watch started (pid {pid})")
    info(f"Log file: {paths.watch_log_file}")


def stop_named_process(paths: Paths, target: str) -> None:
    match target:
        case "n8n":
            stopped, pid = stop_process(pid_file=paths.n8n_pid_file)
            if stopped and pid is not None:
                info(f"Stopped n8n (pid {pid})")
            else:
                info("n8n is not running")
        case "watch":
            stopped, pid = stop_process(pid_file=paths.watch_pid_file)
            if stopped and pid is not None:
                info(f"Stopped watch (pid {pid})")
            else:
                info("watch is not running")
        case "all":
            stop_named_process(paths, "watch")
            stop_named_process(paths, "n8n")
        case _:
            fail(f"Unknown stop target: {target}. Use n8n, watch, or all.")


def do_bootstrap(paths: Paths) -> None:
    require_command("node")
    require_command("npm")

    install_global_n8n_if_missing()

    info(f"Installing dependencies in {paths.package_dir}")
    run_command(["npm", "install"], cwd=paths.package_dir)

    build_package(paths)
    link_package(paths)

    info("Bootstrap complete")


def remove_path(path: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return

    if path.is_symlink() or path.is_file():
        path.unlink(missing_ok=True)
        return

    shutil.rmtree(path)


@app.command()
def doctor() -> None:
    """Validate local environment, paths, and link state."""

    def _run() -> None:
        report = run_doctor(build_paths())

        for message in report.infos:
            info(message)
        for message in report.warnings:
            warn(message)
        for message in report.errors:
            error(message)

        if report.errors:
            raise typer.Exit(code=1)

    execute(_run)


@app.command()
def bootstrap() -> None:
    """Install dependencies, build package, and link into n8n extensions."""

    execute(lambda: do_bootstrap(build_paths()))


@app.command()
def link() -> None:
    """Run npm link flow for package + n8n extensions directory."""

    execute(lambda: link_package(build_paths()))


@app.command()
def start() -> None:
    """Start n8n in background with managed PID and log files."""

    execute(lambda: start_n8n(build_paths()))


@app.command()
def watch() -> None:
    """Start package build watch in background with managed PID and log files."""

    execute(lambda: start_watch(build_paths()))


@app.command()
def stop(target: str = typer.Argument("all")) -> None:
    """Stop managed process(es): n8n, watch, or all."""

    execute(lambda: stop_named_process(build_paths(), target))


@app.command()
def restart() -> None:
    """Restart managed n8n process."""

    def _run() -> None:
        paths = build_paths()
        stop_named_process(paths, "n8n")
        start_n8n(paths)

    execute(_run)


@app.command()
def status() -> None:
    """Show managed process and link status."""

    def _run() -> None:
        paths = build_paths()

        info(f"Repo root: {paths.repo_root}")
        info(f"Package dir: {paths.package_dir}")
        info(f"Extension dir: {paths.ext_dir}")

        if is_pid_file_running(paths.n8n_pid_file):
            info(f"n8n: running (pid {read_pid(paths.n8n_pid_file)})")
        else:
            info("n8n: stopped")

        if is_pid_file_running(paths.watch_pid_file):
            info(f"watch: running (pid {read_pid(paths.watch_pid_file)})")
        else:
            info("watch: stopped")

        link_path = paths.linked_package_path
        if link_path.is_symlink():
            info(f"link: {link_path} -> {link_path.resolve()}")
        elif link_path.exists():
            warn(f"link exists but is not symlinked: {link_path}")
        else:
            warn(f"link missing: {link_path}")

    execute(_run)


@app.command()
def logs(
    target: str = typer.Argument("n8n"),
    follow: bool = typer.Option(False, "--follow", help="Follow live log output."),
    lines: int = typer.Option(200, "--lines", min=1, help="Number of trailing lines to display."),
) -> None:
    """Show logs for n8n or watch process."""

    def _run() -> None:
        paths = build_paths()
        if target == "n8n":
            log_file = paths.n8n_log_file
        elif target == "watch":
            log_file = paths.watch_log_file
        else:
            fail(f"Unknown log target: {target}. Use n8n or watch.")

        if follow:
            try:
                stream_log_follow(log_file, lines=lines)
            except KeyboardInterrupt:
                return
        else:
            stream_log(log_file, lines=lines)

    execute(_run)


@app.command("ui-refresh")
def ui_refresh() -> None:
    """Build, relink, and restart n8n so UI metadata changes are picked up."""

    def _run() -> None:
        paths = build_paths()
        build_package(paths)
        link_package(paths)

        if is_pid_file_running(paths.n8n_pid_file):
            stop_named_process(paths, "n8n")
        start_n8n(paths)

        info("UI refresh flow complete. Hard-refresh the browser to validate UI metadata changes.")

    execute(_run)


@app.command("clean-reset")
def clean_reset(force: bool = typer.Option(False, "--force", help="Required to run destructive reset.")) -> None:
    """Stop processes, clear local dev state, and rebuild/relink from scratch."""

    def _run() -> None:
        if not force:
            fail("clean-reset is destructive. Re-run with: clean-reset --force")

        paths = build_paths()
        stop_named_process(paths, "all")

        info("Removing managed state directory")
        remove_path(paths.state_dir)

        info("Removing package node_modules")
        remove_path(paths.package_dir / "node_modules")

        info("Removing linked package in extension directory")
        remove_path(paths.linked_package_path)

        npx_cache = Path.home() / ".npm" / "_npx"
        if npx_cache.exists():
            info("Removing npx cache")
            remove_path(npx_cache)

        info("Verifying npm cache")
        run_command(["npm", "cache", "verify"])

        do_bootstrap(paths)
        info("Clean reset complete")

    execute(_run)


if __name__ == "__main__":
    app()
