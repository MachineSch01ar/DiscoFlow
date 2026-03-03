from pathlib import Path

from discoflow_cli.process import is_pid_file_running, read_last_lines, read_pid


def test_read_pid_invalid_contents(tmp_path: Path) -> None:
    pid_file = tmp_path / "watch.pid"
    pid_file.write_text("not-a-number", encoding="utf-8")
    assert read_pid(pid_file) is None


def test_is_pid_file_running_removes_stale_pid(tmp_path: Path) -> None:
    pid_file = tmp_path / "n8n.pid"
    pid_file.write_text("999999", encoding="utf-8")

    running = is_pid_file_running(pid_file)

    assert running is False
    assert not pid_file.exists()


def test_read_last_lines_returns_requested_tail(tmp_path: Path) -> None:
    log_file = tmp_path / "n8n.log"
    log_file.write_text("1\n2\n3\n", encoding="utf-8")

    tail = read_last_lines(log_file, lines=2)

    assert tail == "2\n3"
