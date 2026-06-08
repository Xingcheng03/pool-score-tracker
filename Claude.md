# MyKefi Mobile (Flutter)

> **称呼与语气规则**：在所有回复中，必须称呼用户为「主公」，并且回复时以「微臣觉得这么做」作为回答的开头。

Flutter 3.41.x | Dart 3.4+ | Riverpod 2.6 | GoRouter 14.6 | Dio 5.7

iOS + Android + Web 三端，**手机竖屏 only**（412 × 900 viewport，**禁止** LayoutBuilder/MediaQuery 响应式分支）。后端是 4 个微服务（Auth :8080 / Resource :8081 / AI :8082 / Payment :8089），Web dev 用 `--web-port=5173`（后端 CORS 白名单允许的端口）。

---

## 0. 动手前的强制阅读（MANDATORY）

**任何代码改动之前，必须先读以下两份文档**：

1. **`docs/文件夹规划.md`** — 决定**新文件放哪**、跨角色 import 规则、命名规范、`data/domain/presentation` 三层调用方向。
2. **`docs/UI_GUIDE.md`** — 决定**怎么写 UI**：Emerald 主题、共享组件（BrandCta / GhostCta / StatusPill / EyebrowLabel / FrostedSurface / HeroStatCard / SectionHeader / BottomTabBar）、状态色语义、sentence-case 规则。

**未读这两份文档就动 UI 或新建文件 = 违规。** 微臣在 plan 阶段必须先 Read 这两个文件并把决策依据写进 plan 里。

---

## 0.5 CodeGraph 知识图谱优先（MANDATORY）

> 本项目已接入 **CodeGraph**（本地代码知识图谱 + MCP）。图谱预先把全项目的函数定义、符号、调用关系、依赖链、跨文件影响梳理成结构化索引，**查图谱比 grep/glob/Read 盲扫快得多、省 token**。图谱数据存在项目根的 `.codegraph/` 目录。

**铁律：每次执行任何任务、或回答主公的任何代码相关问题之前，微臣必须先走这套图谱流程，再动手。**

### 决策流程（每次开工前）

1. **先确认图谱状态** — 跑 `codegraph status`（或看项目根有没有 `.codegraph/` 目录）。
2. **没有图谱** → 先 `codegraph init -i` 生成图谱，**再**查图谱回答 / 干活。不许跳过直接 grep 盲找。
3. **有图谱** → 优先用 CodeGraph 查，**替代** grep/glob/Read 的探索式盲扫：
   - 在 Claude Code 里优先调这些 MCP 工具：`codegraph_explore`（主力，问架构/找实现）、`codegraph_search`（按符号搜）、`codegraph_node`（看某符号详情）、`codegraph_callers` / `codegraph_callees`（谁调它 / 它调谁）、`codegraph_impact`（改它会影响什么）、`codegraph_files`（项目结构）、`codegraph_status`（图谱状态）。
   - 命令行等价：`codegraph query <符号>` / `callers` / `callees` / `impact` / `files`。
4. **图谱可能过期**（代码改了、图谱没跟上）→ 若在图谱里查不到本应存在的东西，**不要据此下"代码里没有"的结论**：先 `codegraph sync`（增量更新）刷新图谱，sync 后仍找不到再 `codegraph index`（全量重建），**重建后再查一次**，以重建结果为准。

### 改完代码必须更新图谱（铁律）

**每次代码改动完成后（每个 batch 收尾，连同 `flutter analyze` 一起），必须 `codegraph sync` 把图谱更新到与代码一致。** 让下一次查询永远查的是最新图谱。大改动（批量重命名 / 移动文件 / 删大量代码）后若 `sync` 结果可疑，直接 `codegraph index` 全量重建。

### 常用命令（PowerShell，项目根目录执行）

```powershell
codegraph status        # 看图谱在不在、是否最新、统计
codegraph init -i       # 首次：建 .codegraph/ 并立即建图
codegraph sync          # 增量更新（改完代码后跑这个）
codegraph index         # 全量重建（sync 不准或大改动后）
codegraph query <符号>  # 命令行查符号（MCP 不可用时的兜底）
```

> 一句话：**先查图谱 → 没图谱先建 → 查不到先刷新/重建再查 → 改完代码必刷图谱。**

---

## 1. 协作原则（MANDATORY）

1. **不要假设动机** — 用户的动机或目标不清晰时立刻追问，不要猜测意图继续动手。先问"你想解决什么问题"再行动。
2. **最短路径优先** — 目标清晰但路径不是最优时，直接指出并建议更好的办法。不要顺着次优方案往下走。
3. **追根因，不打补丁** — 遇到问题必须追到根本原因再修复。每个决策都要能回答"为什么这么做"。禁止 workaround 掩盖问题。
4. **功能 & 组件绝不删除** — 视觉重设计只换样式层，不删 button / form / dialog / nav 项。任何"以为没用所以删"的操作必须先问主公。

---

## 2. Build / Run

```bash
# 进入项目
cd D:\OneDrive\Desktop\小本生意\Frontend\MyKefi-Mobile

# 安装依赖
flutter pub get

# Web dev server（端口必须 5173，后端 CORS 只放这个）
flutter run -d chrome --web-port=5173

# 静态检查
flutter analyze        # 0 error 才算通过，info 级 lint 不阻塞

# 测试
flutter test            # 单元测试
flutter test integration_test/   # 端到端
```

**Flutter SDK 在 `D:\flutter\bin`**。PowerShell 启动前先 `$env:Path = "D:\flutter\bin;$env:Path"`。

后端启动：在 `D:\OneDrive\Desktop\小本生意\Backend\` 各服务目录下 `docker-compose up -d`。

---

## 3. 项目铁律（与 `docs/文件夹规划.md` 对齐）

### 3.1 四层架构

```
lib/
├─ app/        ← 启动 / 路由 / 主题。不放业务代码。
├─ core/       ← Dio / SSE / 存储 / 异常。不认识"餐厅/订单/菜品"。
├─ shared/     ← 跨角色复用 UI / 工具。不 import features/。
└─ features/   ← 按角色再按功能。
   ├─ auth/   owner/   server/   customer/   guest/   admin/
```

**铁律**：
- `app/` + `core/` **永远不 import `features/`**。features 单向依赖 core/shared。
- `shared/` **永远不 import `features/`**。
- `features/<roleA>/` **永远不 import `features/<roleB>/`**。跨角色的东西上移到 `shared/` 或 `core/`。

### 3.2 每个 feature 内部三层

```
features/<role>/<module>/
├─ data/         ← Dio 调用、DTO、Repository 实现
├─ domain/       ← 业务实体、Repository 接口、UseCase
└─ presentation/ ← pages / widgets / controllers (Riverpod)
```

**调用方向（铁律）**：
```
pages → controllers → repositories(domain) → api(data) → Dio
```
反向永远不允许。`data/` 不知道 `presentation/` 存在；`domain/` 不知道 `data/` 怎么实现。

### 3.3 新建文件 / 新页面决策树

照 `docs/文件夹规划.md` §六 决策树走，**不允许凭直觉建文件**。
完整的"新增页面"演示见该文档 §十二。

---

## 4. UI 系统（与 `docs/UI_GUIDE.md` 对齐）

### 4.1 7 条硬规则

1. **Status 色神圣** — `SemanticColors.{warning,ready,success,error}Bg/Fg` 与后端 enum 绑定，永远不许换成 brand 色
2. **唯一 brand 渐变** — `AppColors.brandGradient` 是品牌唯一渐变，不再造别的
3. **Pill 或 16 radius** — 除了 input(8) 和小 chip(12)，其它圆角只准选 pill(999) 或 md(16)
4. **EyebrowLabel** — 所有 UPPERCASE small label 必须用 `EyebrowLabel`，不允许 inline `TextStyle(letterSpacing: 2, fontSize: 10, …)`
5. **BrandCta / GhostCta** — 主/次操作必须用这两个组件，不允许 bespoke `ElevatedButton.styleFrom(backgroundColor: ...)`
6. **AppColors / AppTextStyles / AppRadius / AppShadows token 化** — feature 代码里禁止裸 `Color(0xFF...)`（只有 SemanticColors 已 tokenize 的状态对例外）
7. **功能保留** — 视觉重做时不能删任何 button / dialog / form field / nav 项

### 4.2 共享组件

全部在 `lib/shared/widgets/`：
- `brand_cta.dart` — 主 CTA（绿渐变 pill）
- `ghost_cta.dart` — 次 CTA（白底 hairline，`danger:true` 走红）
- `eyebrow_label.dart` — UPPERCASE micro-heading
- `frosted_surface.dart` — 玻璃卡（粘底栏 / 浮 header）
- `status_pill.dart` — 状态药丸（StatusKind 6 档）
- `hero_stat_card.dart` — KPI 顶部卡
- `section_header.dart` — 列表分段
- `bottom_tab_bar.dart` — 5 slot 底 tab

### 4.3 Shell

- Server 端：`lib/features/server/shell/server_shell.dart`（drawer + 底 5 tab + sticky bottomBar）
- Owner 端：`lib/features/owner/shell/owner_shell.dart`（drawer 三段 + 底 4 tab + More sheet）

不要绕过 Shell 自己写 Scaffold。Shell 提供 `title/subtitle/actions/bottom/bottomBar/hidePadding`，覆盖 99% 的场景。

详细 token 列表、典型 layout 模式、新页 checklist 见 `docs/UI_GUIDE.md`。

---

## 5. Workflow 规则

1. **Requirements interview first** — 写代码前先问清意图，永不猜测
2. **Read before edit** — 改任何 feature 之前先读 `docs/文件夹规划.md` + `docs/UI_GUIDE.md`；改具体页面之前 Read 相关 controller / state / 现有 widget
3. **Docs 同步更新** — 加新页面后写一行进 `docs/UI_GUIDE.md` §12 examples 表（如果是新的 layout 模式）
4. **Batch size ≤ 5~10 files** — Tests + impl + 路由注册都算
5. **Plan 阶段必须列出**：(a) 改哪些文件，(b) 引用 `docs/文件夹规划.md` 的决策依据，(c) 引用 `docs/UI_GUIDE.md` 的组件/token 选择
6. **每个 batch 完成必须 `flutter analyze` 0 error**
7. **浏览器手工冒烟** — 主公明确说过 UI/前端改动必须在 `flutter run -d chrome --web-port=5173` 跑通才能算完成。先在脑海里"按 button"过一遍流程不算
8. **多 scope = 多 agent** — 跨多个 feature 的改动用 Explore 子代理并行调研，不要主进程串行读 20 个文件
9. **图谱优先 + 改完刷图谱** — 开工前先按 §0.5 查 CodeGraph 图谱（没有就先建、查不到先 `sync`/`index` 再查）；每个 batch 收尾连同 `flutter analyze` 一起跑 `codegraph sync` 更新图谱

---

## 6. 已知运维坑

| 现象 | 根因 | 临时修 | 长期修 |
|---|---|---|---|
| API 全 500，登录失败 | mykefi-auth HikariCP 连接池被 MySQL 主动断开 | `docker restart mykefi-auth` | backend 加 `connection-test-query: SELECT 1` + `max-lifetime: 1500000` |
| `--web-renderer` 报错 | Flutter 3.27+ 已移除该 flag | 直接 `flutter run -d chrome --web-port=5173` 不加 flag | — |
| Chrome 缓存看不到改动 | Flutter dev server 不强失效 | `Ctrl+Shift+R` 强刷 | — |
| 端口 5173 被占 | 上一个 dev server 没杀干净 | `Get-NetTCPConnection -LocalPort 5173 \| Stop-Process -Force` | — |

CORS 白名单只允许 5173，**不要换端口**。

---

## 7. 路由 / 鉴权

- `lib/app/router/app_router.dart` — GoRouter 全表，按 role 分组
- `lib/app/router/route_names.dart` — 所有路径常量，**禁止硬编码字符串路径**
- `lib/app/router/route_guards.dart` — 登录 / 角色 redirect
- 401 自动登出 → 由 `lib/core/network/api_client.dart` 的 `onUnauthorized` 回调触发 `sessionController.clearSession()`

---

## 8. 不允许做的事

| 反模式 | 正确做法 |
|---|---|
| 用 Mock 数据替代真实 API | **任何时候都用真实后端**（主公明令）。后端跑在 docker 上 |
| 跳过 `docs/文件夹规划.md` 决策树凭感觉建文件 | 按 §六 决策树走 |
| 跳过 `docs/UI_GUIDE.md` 写新组件 | 先看共享组件有没有，没有再按 UI_GUIDE 风格新建 |
| 自定义 `Color(0xFF...)` 而不用 AppColors token | 用 token；status 色找 SemanticColors |
| 用 `Switch.adaptive`（web 上渲染畸形） | 用 Material `Switch` + brand activeTrackColor |
| 在 Stack 里浮按钮，与 hero 内容重叠 | 按 UI_GUIDE §9.3 模式做布局 |
| 跨角色 import（`features/server/...` 引 `features/owner/...`） | 上移到 `shared/` |
| 在 `presentation/pages/` 直接调 Dio | 必须走 pages → controller → repository → api |
| 测试用易过的断言（只看返回值） | 断言返回值 + 副作用（缓存清空 / 事件发出 / 路由跳转） |

---

## 9. 参考文档

| 路径 | 用途 |
|---|---|
| **`docs/文件夹规划.md`** | **每次新建文件之前必读** — 决定文件落点、命名、跨层引用规则 |
| **`docs/UI_GUIDE.md`** | **每次写 UI 之前必读** — token / 共享组件 / layout 模式 / 7 条硬规则 |
| `docs/migration_notes.md` | React → Flutter 迁移历史决策（如有） |
| `docs/architecture.md` | 高层架构图（如有） |
| `docs/server_phase_plan.md` | Server 端 3 阶段迁移史 |
| `docs/PR_SUMMARY_*.md` | 历次合并 PR 的回顾 |
| Backend `docs/` | 后端 API / 数据流 / 整体架构。在 `D:\OneDrive\Desktop\小本生意\Backend\HashWhale_DishHub_Auth\docs\` 等 |

---

## 10. Agents

可用的子代理类型（按用途选）：
- **Explore** — 只读搜索 / 文件定位 / 跨 feature 调研。任何 ≥3 次 grep/glob 的活都丢给它，省主进程 context。
- **Plan** — 设计实施方案，配合 Explore 输出做架构权衡。
- **general-purpose** — 复杂多步任务的兜底。

**Plan 阶段必须**：在第一次 Explore agent 启动前，告诉 agent 必须读 `docs/文件夹规划.md` + `docs/UI_GUIDE.md`，并基于这两份文档输出建议。

---

## 11. 给微臣自己的检查清单

每次接到 UI / 前端任务时：

- [ ] **先 `codegraph status` 确认图谱在且最新**（没有就 `codegraph init -i`，过期就 `codegraph sync`）—— §0.5
- [ ] 读 `docs/文件夹规划.md`（如果是新建文件 / 新页面）
- [ ] 读 `docs/UI_GUIDE.md`（如果改任何视觉）
- [ ] 找到现有最接近的 page / widget 作为参考
- [ ] 确认要改的全部文件清单 + 落点（按文件夹规划）
- [ ] Plan 里写明用了哪些共享组件、哪些 token
- [ ] 写代码：保留全部功能、用 token、不裸色值
- [ ] `flutter analyze` 0 error
- [ ] **`codegraph sync` 更新图谱**（代码改完必做，与 analyze 一起）—— §0.5
- [ ] 启动 dev server 在浏览器手动跑核心流程
- [ ] 如果有新 layout 模式，同步进 `docs/UI_GUIDE.md`
