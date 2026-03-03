from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Sequence


class DiscoflowError(RuntimeError):
    """Raised when the CLI cannot complete an action."""


def require_command(command_name: str) -> str:
    command_path = shutil.which(command_name)
    if command_path is None:
        raise DiscoflowError(f"Required command not found: {command_name}")
    return command_path


def run_command(command: Sequence[str], cwd: Path | None = None) -> None:
    completed = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd else None,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        rendered = " ".join(command)
        raise DiscoflowError(f"Command failed ({completed.returncode}): {rendered}")


def capture_command(command: Sequence[str], cwd: Path | None = None) -> str:
    completed = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        rendered = " ".join(command)
        stderr = completed.stderr.strip()
        details = f": {stderr}" if stderr else ""
        raise DiscoflowError(f"Command failed ({completed.returncode}): {rendered}{details}")
    return completed.stdout.strip()
