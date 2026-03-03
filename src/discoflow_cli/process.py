from __future__ import annotations

import os
import signal
import subprocess
import time
from collections import deque
from pathlib import Path
from typing import Iterable

from .shell import DiscoflowError


def ensure_state_dir(state_dir: Path) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)


def read_pid(pid_file: Path) -> int | None:
    if not pid_file.exists():
        return None

    raw = pid_file.read_text(encoding="utf-8").strip()
    if not raw:
        return None

    try:
        return int(raw)
    except ValueError:
        return None


def is_pid_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def is_pid_file_running(pid_file: Path) -> bool:
    pid = read_pid(pid_file)
    if pid is None:
        return False

    if is_pid_running(pid):
        return True

    pid_file.unlink(missing_ok=True)
    return False


def start_process(
    *,
    name: str,
    command: Iterable[str],
    cwd: Path,
    pid_file: Path,
    log_file: Path,
    startup_wait_seconds: float = 1.0,
) -> int:
    ensure_state_dir(pid_file.parent)

    cmd = list(command)
    with log_file.open("a", encoding="utf-8") as handle:
        process = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            stdout=handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            text=True,
        )

    pid_file.write_text(str(process.pid), encoding="utf-8")
    time.sleep(startup_wait_seconds)

    if process.poll() is not None:
        pid_file.unlink(missing_ok=True)
        tail = read_last_lines(log_file, 50)
        details = f"\nRecent logs:\n{tail}" if tail else ""
        rendered = " ".join(cmd)
        raise DiscoflowError(f"{name} failed to start: {rendered}{details}")

    return process.pid


def _send_signal(pid: int, sig: int) -> None:
    try:
        os.killpg(pid, sig)
        return
    except ProcessLookupError:
        return
    except PermissionError:
        pass
    except OSError:
        pass

    try:
        os.kill(pid, sig)
    except ProcessLookupError:
        return


def stop_process(
    *,
    pid_file: Path,
    grace_seconds: float = 6.0,
) -> tuple[bool, int | None]:
    pid = read_pid(pid_file)
    if pid is None:
        pid_file.unlink(missing_ok=True)
        return False, None

    if not is_pid_running(pid):
        pid_file.unlink(missing_ok=True)
        return False, pid

    _send_signal(pid, signal.SIGTERM)
    deadline = time.monotonic() + grace_seconds
    while time.monotonic() < deadline:
        if not is_pid_running(pid):
            pid_file.unlink(missing_ok=True)
            return True, pid
        time.sleep(0.2)

    _send_signal(pid, signal.SIGKILL)
    pid_file.unlink(missing_ok=True)
    return True, pid


def read_last_lines(log_file: Path, lines: int = 200) -> str:
    if not log_file.exists():
        return ""

    with log_file.open("r", encoding="utf-8", errors="replace") as handle:
        last = deque(handle, maxlen=lines)
    return "".join(last).rstrip()


def stream_log(log_file: Path, lines: int = 200) -> None:
    if not log_file.exists():
        raise DiscoflowError(f"Log file not found: {log_file}")

    tail = read_last_lines(log_file, lines)
    if tail:
        print(tail)


def stream_log_follow(log_file: Path, lines: int = 200) -> None:
    if not log_file.exists():
        raise DiscoflowError(f"Log file not found: {log_file}")

    stream_log(log_file, lines)

    with log_file.open("r", encoding="utf-8", errors="replace") as handle:
        handle.seek(0, os.SEEK_END)
        while True:
            chunk = handle.readline()
            if chunk:
                print(chunk, end="")
                continue
            time.sleep(0.3)
