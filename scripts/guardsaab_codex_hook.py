"""Experimental Codex CLI PreToolUse gate for a narrow Bash command subset.

This is a hook-contract spike, not a shell parser, sandbox, or production security
boundary. It intentionally denies several high-impact command shapes and lets
other valid Bash calls continue through Codex's normal policy flow.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BLOCK_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "recursive_delete",
        re.compile(r"(?is)(?:^|[;&|]+\s*)(?:\S*/)?rm(?=[^;&|\n]*\s-[^\s;&|]*r)[^;&|\n]*"),
        "Recursive deletion is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "powershell_recursive_delete",
        re.compile(r"(?is)\b(?:remove-item|ri|del|erase)\b(?=[^;&|\n]*\s-(?:recurse|r)\b)"),
        "Recursive PowerShell deletion is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "git_hard_reset",
        re.compile(r"(?is)\bgit\s+reset\b[^;&|\n]*\s--hard\b"),
        "git reset --hard is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "git_force_push",
        re.compile(r"(?is)\bgit\s+push\b[^;&|\n]*(?:\s--force(?:-with-lease)?\b|\s-f(?:\s|$))"),
        "Force push is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "terraform_destroy",
        re.compile(r"(?is)\bterraform\s+destroy\b"),
        "Terraform destroy is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "kubectl_delete",
        re.compile(r"(?is)\bkubectl\s+delete\b"),
        "kubectl delete is blocked by the GuardSaaB pilot policy.",
    ),
    (
        "download_to_shell",
        re.compile(r"(?is)\b(?:curl|wget)\b[^\n]*\|\s*(?:ba)?sh\b"),
        "Piping a network download to a shell is blocked by the GuardSaaB pilot policy.",
    ),
)

DENY_RESPONSE = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
    }
}


def _audit_path() -> Path:
    override = os.environ.get("GUARDSAAB_AUDIT_PATH") or os.environ.get("WARDEN_AUDIT_PATH")
    if override:
        return Path(override)
    local_app_data = os.environ.get("LOCALAPPDATA")
    base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
    return base / "GuardSaaB" / "audit.jsonl"


def _decision(payload: dict[str, Any]) -> tuple[str, str, str, str]:
    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input")
    if tool_name != "Bash" or not isinstance(tool_input, dict):
        return "deny", "unsupported_input", "GuardSaaB cannot validate this hook payload; action blocked.", ""
    command = tool_input.get("command")
    if not isinstance(command, str) or not command.strip():
        return "deny", "missing_command", "GuardSaaB cannot validate a missing or empty command; action blocked.", ""
    for rule_id, pattern, reason in BLOCK_RULES:
        if pattern.search(command):
            return "deny", rule_id, reason, command
    return "allow", "no_block_rule_matched", "", command


def _record(payload: dict[str, Any], decision: str, rule_id: str, command: str) -> None:
    command_digest = hashlib.sha256(command.encode("utf-8", errors="replace")).hexdigest()
    tool_use_id = payload.get("tool_use_id")
    session_id = payload.get("session_id")
    event_material = f"{session_id or ''}:{tool_use_id or ''}:{command_digest}"
    event = {
        "event_id": hashlib.sha256(event_material.encode("utf-8")).hexdigest(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "pre_execution_decision",
        "session_id": session_id if isinstance(session_id, str) else None,
        "tool_use_id": tool_use_id if isinstance(tool_use_id, str) else None,
        "tool_name": payload.get("tool_name"),
        "decision": decision,
        "rule_id": rule_id,
        "command_sha256": command_digest,
        "raw_command_recorded": False,
    }
    path = _audit_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, separators=(",", ":"), ensure_ascii=True) + "\n")


def handle(payload: dict[str, Any]) -> dict[str, Any] | None:
    decision, rule_id, reason, command = _decision(payload)
    try:
        _record(payload, decision, rule_id, command)
    except Exception:
        # Codex documents that hook errors can fail open. Emit a valid explicit
        # denial on audit failure instead of returning a nonzero hook status.
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "GuardSaaB could not persist the decision record; action blocked.",
            }
        }
    if decision == "deny":
        return {
            "hookSpecificOutput": {
                **DENY_RESPONSE["hookSpecificOutput"],
                "permissionDecisionReason": reason,
            }
        }
    return None


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("hook payload must be a JSON object")
        response = handle(payload)
    except Exception:
        response = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "GuardSaaB could not validate the hook request; action blocked.",
            }
        }
    if response is not None:
        sys.stdout.write(json.dumps(response, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
