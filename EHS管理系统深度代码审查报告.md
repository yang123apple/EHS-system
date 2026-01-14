# EHS 管理系统深度代码审查报告（结合低并发、内网、低恶意场景）

## 背景与假设
- 使用场景：公司内网、用户规模 <100、恶意操作概率低。
- 含义：网络攻防与超高并发不是当前首要矛盾，但数据一致性、权限越权、流程闭环和可维护性仍需保证。
- 目标：优先修复可能导致业务中断、数据错误或合规风险的问题，其次再处理性能与代码质量。

## 优先级判定准则
1) 业务可用性与数据正确性（最高）：流程闭环、并发写一致性、编号唯一性。  
2) 内部越权与审计（高）：即便信任员工，也需防误操作、误查看。  
3) 性能（中）：在 10 万级数据时需可用，但当前用户量小，可逐步优化。  
4) 代码可维护性与可测试性（中）：减少未来迭代风险。

## 问题与整改方案（逐条说明）

### 1) 隐患流程闭环与并发一致性
- 现象：隐患状态可能卡在处理中，`currentStepIndex/status/dopersonal_ID` 在多人操作时可能不同步。
- 位置： [src/services/hazardDispatchEngine.ts](src/services/hazardDispatchEngine.ts)
- 改动思路：
  - 在派发入口引入数据库事务，读取当前状态后再更新，避免并发覆盖。
  - 在状态流转前校验必要字段（当前执行人、整改提交时间等），流转失败需向上抛错并提示前端。
  - 在日志与通知生成前后保持同一事务，避免部分成功。

### 2) 隐患编号唯一性
- 现象：编号生成基于前端列表长度，存在并发或刷新导致重复的风险。
- 位置： [src/app/hidden-danger/page.tsx](src/app/hidden-danger/page.tsx)
- 改动思路：编号改由后端生成：按“日期 + 自增序列”或直接使用数据库序列/UUID；创建专门接口或在创建 API 内部生成，前端不再拼接。

### 3) 延期审批与截止日期闭环
- 现象：延期审批通过后未强制更新主隐患 `deadline`，也未校验新日期合理性。
- 位置：
  - [prisma/schema.prisma](prisma/schema.prisma) 中 `HazardExtension` 与 `HazardRecord` 字段
  - 延期审批相关 API（如未实现需新增）
- 改动思路：
  - 在延期审批通过时同步更新主隐患的 `deadline`，并记录审批人/时间。
  - 增加校验：新截止日期必须晚于当前时间且不超过设定上限（例如单次延期 ≤90 天）。

### 4) 或签/会签执行状态不一致
- 现象：`candidateHandlers` 仅前端权限判断，缺少统一的持久化更新，可能出现重复或缺失操作标记。
- 位置：
  - [src/app/hidden-danger/_utils/permissions.ts](src/app/hidden-danger/_utils/permissions.ts)
  - [src/services/hazardDispatchEngine.ts](src/services/hazardDispatchEngine.ts)
- 改动思路：
  - 设计统一的数据结构（含 `userId/hasOperated/operatedAt/opinion`），所有更新通过单一服务层完成。
  - 在数据库中持久化，并在流转时校验 OR/AND 规则，防止重复操作。

### 5) “我的任务”过滤与 CC 查询性能/准确性
- 现象：`ccUsers` 以 JSON 字符串存储并用 `contains` 过滤，准确性与性能差；未来数据增大后会有查询瓶颈。
- 位置： [src/app/api/hazards/route.ts](src/app/api/hazards/route.ts)
- 改动思路：
  - 规范化为关联表（如 `HazardCC`）并建立复合索引；API 改为 join 过滤。
  - 短期可保留现状，但需在数据量上升前完成拆分迁移。

### 6) 统计接口全表扫描
- 现象：`/api/hazards?type=stats` 直接全表拉取做内存统计，10 万级数据会超时。
- 位置： [src/app/api/hazards/route.ts](src/app/api/hazards/route.ts)
- 改动思路：
  - 使用数据库 `groupBy` 聚合或维护缓存表（定时任务刷新）。
  - 对高频统计字段（`riskLevel`、`status`、`workDate/deadline`）补充索引。

### 7) IDOR 与最小化访问控制（内网也需防误查看）
- 现象：权限判断多在前端（如 `canViewHazard` 依赖客户端字段），后端未强制校验，员工误操作可能看到不应看的隐患或档案。
- 位置：
  - [src/app/api/hazards/route.ts](src/app/api/hazards/route.ts)
  - 档案与作业票相关 API（参考 `archives`、`permits` 路由）
- 改动思路：
  - 在后端读取当前用户后，基于业务规则判断可见性（上报人、当前处理人、抄送、管理员）。
  - 移除对客户端上传的可见性字段的信任，所有授权在服务端完成。

### 8) 敏感信息脱敏（内网误操作防护）
- 现象：用户/档案接口可能返回完整敏感字段（身份证、手机号）。虽为内网，但需防误传播。
- 位置：
  - 用户与档案相关 API（如 `api/users`、`api/archives/...`）
- 改动思路：
  - 按角色分级返回：管理员可见全量，普通员工仅末 4 位或掩码。
  - 在审计日志与导出功能中也应用同样脱敏策略。

### 9) JSON 解析健壮性
- 现象：`logs/ccUsers/candidateHandlers` 等 JSON 字段多处直接 `JSON.parse`，异常会导致接口 500。
- 位置： [src/app/api/hazards/route.ts](src/app/api/hazards/route.ts) 及相关服务
- 改动思路：
  - 统一封装 `safeJsonParse`，异常时返回空数组并记录告警。
  - 在入库前用 schema 校验 JSON 结构。

### 10) 错误处理与审计
- 现象：部分 API 仅 `console.error`，缺少统一错误上报；审计日志敏感字段清洗列表可能不全。
- 位置：
  - [src/app/api/hazards/route.ts](src/app/api/hazards/route.ts)
  - [src/services/systemLog.service.ts](src/services/systemLog.service.ts)
  - [src/lib/audit-utils.ts](src/lib/audit-utils.ts)
- 改动思路：
  - 引入统一的 ErrorLogger（写 DB 或文件），包含用户、请求上下文。
  - 扩充敏感字段清单（身份证、手机号、邮箱、API Key）。

### 11) 类型一致性与可维护性
- 现象：前后端 `HazardRecord`/`Incident` 类型不完全一致，日期类型混用 string/Date。
- 位置：
  - [src/types/hidden-danger.d.ts](src/types/hidden-danger.d.ts)
  - [prisma/schema.prisma](prisma/schema.prisma)
- 改动思路：
  - 建立共享类型/校验（如 Zod schema），前后端共用；统一日期为 ISO 字符串（存储 UTC，展示本地）。

### 12) 编号与导出批量操作的资源控制
- 现象：批量导入/导出未限制单次数量；导出使用 XLSX 将所有数据载入内存。
- 位置：
  - [src/app/hidden-danger/_components/views/HazardDataTable.tsx](src/app/hidden-danger/_components/views/HazardDataTable.tsx)
- 改动思路：
  - 限制单次批量导入/导出条数；导出改为后端流式生成文件。

### 13) 流程与权限常量分散、硬编码
- 现象：状态值、权限键在多文件硬编码，修改容易遗漏。
- 位置：
  - [src/app/hidden-danger/_utils/permissions.ts](src/app/hidden-danger/_utils/permissions.ts)
  - [src/lib/permissions.ts](src/lib/permissions.ts)
- 改动思路：
  - 建立统一常量文件（状态、动作、权限 key），引用而非字符串字面量。

### 14) 测试覆盖缺失
- 现象：工作流引擎、权限、编号生成等关键逻辑缺少自动化测试。
- 位置：工作流服务与 API 路由整体。
- 改动思路：
  - 为派发引擎、编号生成、权限校验编写单元测试；为关键 API 编写集成测试（可用 Jest/Supertest）。

## 整体修复路径（结合低并发内网场景）
1) 先保障业务正确性：事务化状态流转、编号唯一、延期同步、后端权限校验。  
2) 再补充数据模型与索引：CC 关系表、统计聚合优化。  
3) 强化健壮性：安全解析、错误日志、脱敏输出。  
4) 提升可维护性：统一类型/常量、拆分长函数、补齐测试。  
5) 性能优化按需推进：当前规模可接受，但预留扩展（聚合、流式导出、索引）。
