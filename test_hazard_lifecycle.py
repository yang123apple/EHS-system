"""
隐患生命周期集成测试（pytest）

目标：模拟 "A 提报 -> C 确认 -> D 审批 -> B 整改 -> E 验收" 的完整链路，
并在每一步验证隐患的 Status 与 Current Assignee 是否符合预期。

运行前置条件：
1) EHS 服务已启动（默认 http://localhost:3000，可通过 EHS_BASE_URL 覆盖）
2) 测试数据库可写（默认读取 DATABASE_URL 或 .env 中的 DATABASE_URL）
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import pytest

requests = pytest.importorskip("requests")

BASE_URL = os.getenv("EHS_BASE_URL", "http://localhost:3000")

# ------------------------------
# 测试用户定义
# ------------------------------

USER_A = {
    "id": "test-user-a",
    "username": "test_user_a",
    "name": "User A",
    "role": "user",
    # 上报权限必须存在，否则 /api/hazards POST 会被拒绝
    "permissions": {"hidden_danger": ["report"]},
}

USER_B = {
    "id": "test-user-b",
    "username": "test_user_b",
    "name": "User B",
    "role": "user",
    "permissions": {},
}

USER_C = {
    "id": "test-user-c",
    "username": "test_user_c",
    "name": "User C",
    "role": "user",
    "permissions": {},
}

USER_D = {
    "id": "test-user-d",
    "username": "test_user_d",
    "name": "User D",
    "role": "user",
    "permissions": {},
}

USER_E = {
    "id": "test-user-e",
    "username": "test_user_e",
    "name": "User E",
    "role": "user",
    "permissions": {},
}

ADMIN = {
    "id": "test-admin",
    "username": "test_admin",
    "name": "Test Admin",
    "role": "admin",
    "permissions": {},
}

TEST_USERS = [USER_A, USER_B, USER_C, USER_D, USER_E, ADMIN]


# ------------------------------
# 工具函数：数据库/工作流配置
# ------------------------------

def _load_database_url(repo_root: Path) -> Optional[str]:
    """优先读取环境变量，其次读取 .env 文件。"""
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")

    env_path = repo_root / ".env"
    if not env_path.exists():
        return None

    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip("\"")

    return None


def _sqlite_path(db_url: str, repo_root: Path) -> Optional[Path]:
    """仅支持 SQLite（file:/sqlite:），其他数据库返回 None。"""
    if db_url.startswith("file:"):
        relative = db_url.replace("file:", "", 1)
        return (repo_root / relative).resolve()

    if db_url.startswith("sqlite:"):
        # 可能是 sqlite:./dev.db 或 sqlite:///abs/path
        cleaned = db_url.replace("sqlite:", "", 1)
        cleaned = cleaned.lstrip("/") if cleaned.startswith("///") else cleaned
        return (repo_root / cleaned).resolve()

    return None


@contextmanager
def _sqlite_conn(db_path: Path):
    """打开 SQLite 连接并确保外键约束。"""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        yield conn
        conn.commit()
    finally:
        conn.close()


def _ensure_users(conn: sqlite3.Connection, users: Iterable[Dict[str, Any]]) -> None:
    """写入测试用户，若已存在则更新角色/权限。"""
    for user in users:
        row = conn.execute(
            "SELECT id FROM User WHERE id = ?",
            (user["id"],),
        ).fetchone()

        permissions = json.dumps(user.get("permissions") or {}, ensure_ascii=False)

        if row:
            conn.execute(
                "UPDATE User SET name = ?, role = ?, permissions = ?, isActive = 1 WHERE id = ?",
                (user["name"], user["role"], permissions, user["id"]),
            )
            continue

        conn.execute(
            """
            INSERT INTO User (id, username, name, password, role, permissions, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                user["id"],
                user["username"],
                user["name"],
                "test-password",
                user["role"],
                permissions,
            ),
        )


def _build_workflow_config() -> Dict[str, Any]:
    """构造测试专用工作流：Report -> Confirm -> Approve -> Rectify -> Verify。"""
    return {
        "version": 1,
        "updatedAt": "2026-01-01T00:00:00Z",
        "updatedBy": "pytest",
        "steps": [
            {
                "id": "report",
                "name": "上报",
                "description": "隐患上报",
                "handlerStrategy": {
                    "type": "fixed",
                    "description": "执行人：上报人（系统自动）",
                    "fixedUsers": [],
                },
                "ccRules": [],
            },
            {
                "id": "confirm",
                "name": "确认",
                "description": "确认隐患信息",
                "handlerStrategy": {
                    "type": "fixed",
                    "description": "执行人：确认人",
                    "fixedUsers": [{"userId": USER_C["id"], "userName": USER_C["name"]}],
                },
                "ccRules": [],
            },
            {
                "id": "approve",
                "name": "审批",
                "description": "审批隐患",
                "handlerStrategy": {
                    "type": "fixed",
                    "description": "执行人：审批人",
                    "fixedUsers": [{"userId": USER_D["id"], "userName": USER_D["name"]}],
                },
                "ccRules": [],
            },
            {
                "id": "rectify",
                "name": "整改",
                "description": "整改责任人提交整改结果",
                "handlerStrategy": {
                    "type": "fixed",
                    "description": "执行人：整改责任人（系统自动）",
                    "fixedUsers": [],
                },
                "ccRules": [],
            },
            {
                "id": "verify",
                "name": "验收",
                "description": "验收整改结果",
                "handlerStrategy": {
                    "type": "fixed",
                    "description": "执行人：验收人",
                    "fixedUsers": [{"userId": USER_E["id"], "userName": USER_E["name"]}],
                },
                "ccRules": [],
            },
        ],
    }


@contextmanager
def _temporary_workflow_config(repo_root: Path, config: Dict[str, Any]):
    """写入测试工作流，测试结束后恢复原配置。"""
    workflow_file = repo_root / "data" / "hazard-workflow.json"
    workflow_file.parent.mkdir(parents=True, exist_ok=True)

    original_content = workflow_file.read_text(encoding="utf-8") if workflow_file.exists() else None

    try:
        workflow_file.write_text(
            json.dumps(config, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        yield workflow_file
    finally:
        if original_content is None:
            if workflow_file.exists():
                workflow_file.unlink()
        else:
            workflow_file.write_text(original_content, encoding="utf-8")


# ------------------------------
# 工具函数：业务状态/接口封装
# ------------------------------

def _status_for_step(step_id: str, step_index: int, steps: Iterable[Dict[str, Any]]) -> str:
    """复刻后端 getStatusByStepId 逻辑，保证状态断言一致。"""
    if step_id == "report":
        return "reported"
    if step_id == "assign":
        return "assigned"
    if step_id == "rectify":
        return "rectifying"
    if step_id == "verify":
        return "verified"

    step_ids = [step["id"] for step in steps]
    report_index = step_ids.index("report") if "report" in step_ids else -1
    assign_index = step_ids.index("assign") if "assign" in step_ids else -1
    rectify_index = step_ids.index("rectify") if "rectify" in step_ids else -1
    verify_index = step_ids.index("verify") if "verify" in step_ids else -1

    if report_index >= 0 and step_index <= report_index:
        return "reported"
    if assign_index >= 0 and step_index <= assign_index:
        return "assigned"
    if rectify_index >= 0 and step_index < rectify_index:
        return "assigned"
    if rectify_index >= 0 and step_index <= rectify_index:
        return "rectifying"
    if verify_index >= 0 and step_index < verify_index:
        return "rectifying"
    if verify_index >= 0 and step_index <= verify_index:
        return "verified"

    return "assigned"


def _request(method: str, path: str, user: Dict[str, Any], payload: Optional[Dict[str, Any]] = None):
    """统一封装带身份的请求（使用 x-user-id 进行认证）。"""
    url = f"{BASE_URL}{path}"
    headers = {"x-user-id": user["id"]}
    response = requests.request(method, url, headers=headers, json=payload, timeout=15)
    return response


def _assert_state(hazard: Dict[str, Any], status: str, assignee: Optional[Dict[str, Any]], step_id: str, step_index: int):
    """校验隐患状态与当前处理人是否符合预期。"""
    assert hazard["status"] == status
    assert hazard["currentStepId"] == step_id
    assert hazard["currentStepIndex"] == step_index

    expected_assignee = assignee["id"] if assignee else None
    assert hazard.get("currentExecutorId") == expected_assignee


def _advance_to_step(
    hazard: Dict[str, Any],
    operator: Dict[str, Any],
    next_step_id: str,
    next_step_index: int,
    steps: Iterable[Dict[str, Any]],
    assignee: Optional[Dict[str, Any]],
    action_name: str,
    extra_updates: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    将隐患推进到指定步骤：
    - 由操作者触发 action
    - 更新 status/currentStep/currentAssignee
    """
    payload = {
        "id": hazard["id"],
        "operatorId": operator["id"],
        "operatorName": operator["name"],
        "actionName": action_name,
        "status": _status_for_step(next_step_id, next_step_index, steps),
        "currentStepIndex": next_step_index,
        "currentStepId": next_step_id,
        "dopersonal_ID": assignee["id"] if assignee else None,
        "dopersonal_Name": assignee["name"] if assignee else None,
    }

    if extra_updates:
        payload.update(extra_updates)

    response = _request("PATCH", "/api/hazards", operator, payload)
    assert response.status_code == 200, response.text
    return response.json()


# ------------------------------
# Pytest Fixtures
# ------------------------------

@pytest.fixture(scope="module")
def test_context():
    """准备工作流配置与测试用户。"""
    repo_root = Path(__file__).resolve().parent
    db_url = _load_database_url(repo_root)
    if not db_url:
        pytest.skip("未找到 DATABASE_URL，无法准备测试用户")

    db_path = _sqlite_path(db_url, repo_root)
    if not db_path:
        pytest.skip("当前 DATABASE_URL 非 SQLite，测试未实现对应的初始化逻辑")

    if not db_path.exists():
        pytest.skip(f"数据库文件不存在: {db_path}")

    with _sqlite_conn(db_path) as conn:
        table = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").fetchone()
        if not table:
            pytest.skip("未检测到 User 表，请先执行 Prisma migration")

        _ensure_users(conn, TEST_USERS)

    workflow_config = _build_workflow_config()

    with _temporary_workflow_config(repo_root, workflow_config):
        yield {"steps": workflow_config["steps"]}


# ------------------------------
# 核心测试用例
# ------------------------------


def test_hazard_lifecycle_end_to_end(test_context):
    """完整生命周期：A 提报 -> C 确认 -> D 审批 -> B 整改 -> E 验收闭环。"""
    steps = test_context["steps"]

    # 0) 检查服务可用性（需要 admin 用户身份）
    ping = _request("GET", "/api/hazards/workflow", ADMIN)
    assert ping.status_code == 200, ping.text

    # 1) A 提报隐患，并指定整改责任人 B
    create_payload = {
        "type": "安全隐患",
        "location": "测试地点",
        "desc": "pytest 集成测试 - 隐患生命周期",
        "riskLevel": "low",
        "reporterId": USER_A["id"],
        "reporterName": USER_A["name"],
        "responsibleId": USER_B["id"],
        "responsibleName": USER_B["name"],
        "rectificationLeaderId": USER_B["id"],
        "rectificationLeaderName": USER_B["name"],
    }

    create_resp = _request("POST", "/api/hazards", USER_A, create_payload)
    assert create_resp.status_code == 200, create_resp.text
    hazard = create_resp.json()

    # 预期：系统把流程推到确认人 C，状态 assigned
    _assert_state(hazard, "assigned", USER_C, step_id="confirm", step_index=1)

    try:
        # 2) C 确认隐患，流转到审批人 D
        hazard = _advance_to_step(
            hazard=hazard,
            operator=USER_C,
            next_step_id="approve",
            next_step_index=2,
            steps=steps,
            assignee=USER_D,
            action_name="确认",
        )
        _assert_state(hazard, "assigned", USER_D, step_id="approve", step_index=2)

        # 3) D 审批通过，流转回责任人 B 进行整改
        hazard = _advance_to_step(
            hazard=hazard,
            operator=USER_D,
            next_step_id="rectify",
            next_step_index=3,
            steps=steps,
            assignee=USER_B,
            action_name="审批通过",
        )
        _assert_state(hazard, "rectifying", USER_B, step_id="rectify", step_index=3)

        # 4) B 提交整改结果，流转到验收人 E
        hazard = _advance_to_step(
            hazard=hazard,
            operator=USER_B,
            next_step_id="verify",
            next_step_index=4,
            steps=steps,
            assignee=USER_E,
            action_name="提交整改",
            extra_updates={
                "rectifyDesc": "已完成整改并上传现场照片",
                "rectifyPhotos": [],
            },
        )
        _assert_state(hazard, "verified", USER_E, step_id="verify", step_index=4)

        # 5) E 验收通过，隐患闭环
        close_payload = {
            "id": hazard["id"],
            "operatorId": USER_E["id"],
            "operatorName": USER_E["name"],
            "actionName": "验收通过",
            "status": "closed",
            "currentStepIndex": 4,
            "currentStepId": "verify",
            "dopersonal_ID": None,
            "dopersonal_Name": None,
            "verifyDesc": "验收通过，流程闭环",
            "verifyPhotos": [],
        }

        close_resp = _request("PATCH", "/api/hazards", USER_E, close_payload)
        assert close_resp.status_code == 200, close_resp.text
        hazard = close_resp.json()

        _assert_state(hazard, "closed", None, step_id="verify", step_index=4)

    finally:
        # 测试结束后作废隐患，避免污染数据
        void_payload = {"hazardId": hazard["id"], "reason": "pytest 集成测试清理"}
        _request("POST", "/api/hazards/void", ADMIN, void_payload)
