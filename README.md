# private_coach

健身私人教练预约微信小程序（前后端分离）。

当前项目已实现登录、教练申请、课程管理、排课管理、预约订单管理、评价管理等核心链路，

## 技术栈

- 后端：Node.js + Express + mysql2
- 前端：微信小程序原生（WXML / WXSS / JS）
- 数据库：MySQL

## 项目结构

- backend：后端服务
	- app.js：后端入口
	- db.js：MySQL 连接池
	- routes：业务路由
		- auth.js：登录注册
		- coaches.js：教练资料/申请
		- courses.js：课程管理
		- schedules.js：教练排课管理
		- appointments.js：预约订单管理
		- reviews.js：评价管理
- frontend/miniprogram：微信小程序代码
- db/schema.sql：完整建表脚本

## 数据库初始化

1. 新建数据库（字符集建议 utf8mb4）。
2. 执行 db/schema.sql 建表。
3. 如果是历史库升级：
	 - 若 user 表仍有 gender 字段，可执行 db/migration_drop_gender.sql。

说明：coach 表当前字段已包含 contact（联系方式）。

## 后端启动

1. 进入 backend 目录。
2. 安装依赖：npm install
3. 复制 backend/.env.example 为 backend/.env 并填写配置。
4. 启动服务：node app.js

默认启动地址：http://127.0.0.1:3000

## 环境变量说明

backend/.env 中常用项：

- PORT：服务端口（默认 3000）
- DB_HOST：数据库地址
- DB_PORT：数据库端口
- DB_USER：数据库用户名
- DB_PASSWORD：数据库密码
- DB_NAME：数据库名
- WECHAT_APPID：微信小程序 appid（正式换取 openid）
- WECHAT_SECRET：微信小程序 secret（正式换取 openid）
- MOCK_OPENID：开发期可选，配置后可固定 openid 便于联调

## 小程序运行

1. 使用微信开发者工具打开 frontend/miniprogram。
2. 确认 app.js 中 baseUrl 指向后端地址（默认 http://127.0.0.1:3000）。
3. 编译并运行。

## 已实现功能

### 用户侧

- 微信登录/注册
- 首页教练与课程展示
- 教练列表与课程详情
- 课程排期查看与预约
- 我的预约（预约中/已取消/已完成）
- 取消预约
- 评价提交与评价列表查看（支持多次评价）

### 教练侧

- 教练申请（入库）与资料修改
- 教练中心
- 课程管理：新增、编辑、软删除（status=0）
- 排课管理：
	- 查看排课
	- 新增排课
	- 编辑排课（时间/人数）
	- 删除过期排课（status=2）
	- 时间重叠检测（同课程同一天）
- 订单管理：
	- 查看正预约与已完成
	- 确认完成（0 -> 2）
- 评价管理：
	- 查看课程下全部评价
	- 删除评价（is_deleted=1）

## 关键业务规则

- 课程软删除后，联动禁用未来未开始排期。
- 用户端课程排期仅展示：未删除且未过期的排期。
- 教练删除排课仅允许删除过期排课。
- 排课新增/编辑会校验同课程同日期时间段重叠。

## 主要接口（节选）

### 登录与用户

- POST /api/auth/wx-login

### 教练

- POST /api/coaches/apply
- GET /api/coaches/profile
- GET /api/coaches
- GET /api/coaches/:id

### 课程

- GET /api/courses
- GET /api/courses/mine
- POST /api/courses
- PUT /api/courses/:id
- DELETE /api/courses/:id
- GET /api/courses/:id/schedules

### 排课

- GET /api/schedules/coach
- POST /api/schedules/coach
- PUT /api/schedules/coach/:id
- DELETE /api/schedules/coach/:id

### 预约订单

- POST /api/appointments
- GET /api/appointments
- GET /api/appointments/coach
- POST /api/appointments/:id/cancel
- POST /api/appointments/:id/complete

### 评价

- GET /api/reviews
- POST /api/reviews
- GET /api/reviews/coach
- DELETE /api/reviews/:id

## API 详细说明 — 课程 / 排课 / 预约

课程（Courses）
- GET /api/courses
	- 描述：查询课程列表（对用户公开）。
	- 请求类型：GET
	- 参数（query）：page（int，可选）、pageSize（int，可选）、keyword（string，可选）、coachId（int，可选）、status（int，可选，1=有效）。
	- 鉴权：可选（公开接口）。
	- 返回：课程数组，每项包含 id、title、summary、coverUrl、coachId、price、status、createdAt 等。

- GET /api/courses/mine
	- 描述：获取当前登录教练的课程列表。
	- 请求类型：GET
	- 参数：分页参数 page/pageSize（可选）。
	- 鉴权：必须（需携带 token，返回与 userId 对应的教练课程）。
	- 返回：该教练的课程数组与分页信息。

- POST /api/courses
	- 描述：教练创建课程。
	- 请求类型：POST
	- 参数（body, JSON）：title（string, 必需）、summary（string, 可选）、description（string, 可选）、price（number, 必需）、coverUrl（string, 可选）、duration（int，可选，分钟）、status（int，可选，默认1）。
	- 鉴权：必须（教练身份）。
	- 返回：新建课程 id 与创建结果。

- PUT /api/courses/:id
	- 描述：修改课程信息。
	- 请求类型：PUT
	- 参数：id（path, 课程ID）、body 同 POST 字段（至少包含需要更新的字段）。
	- 鉴权：必须（仅课程所属教练或管理员）。
	- 返回：更新结果。

- DELETE /api/courses/:id
	- 描述：删除课程（通常为软删除，设置 status=0）。
	- 请求类型：DELETE
	- 参数：id（path, 必需）。
	- 鉴权：必须（仅所属教练或管理员）。
	- 返回：删除结果（成功/失败说明）。

- GET /api/courses/:id/schedules
	- 描述：查询某课程的排课列表（通常返回未来的可预约排课）。
	- 请求类型：GET
	- 参数：id（path, 课程ID）、可选 from/to 日期范围、status 过滤。
	- 鉴权：公开或可选（取决于是否只对登录用户开放）。
	- 返回：排课数组（包含 scheduleId、startAt、endAt、capacity、bookedCount、price、status 等）。

排课（Schedules，教练端）
- GET /api/schedules/coach
	- 描述：教练查看自己发布的排课（含历史与未来或按状态过滤）。
	- 请求类型：GET
	- 参数（query）：page、pageSize、date（可选）、status（可选）。
	- 鉴权：必须（教练）。
	- 返回：排课列表与分页。

- POST /api/schedules/coach
	- 描述：教练创建新的排课时段。
	- 请求类型：POST
	- 参数（body, JSON）：courseId（int, 必需）、date（string, 必需，YYYY-MM-DD）、startTime（string, 必需，HH:mm）、endTime（string, 必需）、capacity（int, 必需）、price（number，可选）。
	- 鉴权：必须（教练）。
	- 备注：后端应校验时间冲突并返回 400/409（冲突）提示。
	- 返回：新建排课 id。

- PUT /api/schedules/coach/:id
	- 描述：修改教练的某条排课（时间/容量/价格等）。
	- 请求类型：PUT
	- 参数：id（path, 必需）、body 包含要更新的字段。
	- 鉴权：必须（仅所属教练）。
	- 返回：更新结果（若修改时间可能再次检查冲突）。

- DELETE /api/schedules/coach/:id
	- 描述：删除/下架排课（通常软删除或设置 status）。
	- 请求类型：DELETE
	- 参数：id（path, 必需）。
	- 鉴权：必须（教练）。
	- 返回：删除结果。

预约订单（Appointments）
- POST /api/appointments
	- 描述：用户为某排课下单/预约。
	- 请求类型：POST
	- 参数（body, JSON）：scheduleId（int, 必需）、userNotes（string, 可选）、如需支付则包含 paymentInfo 或由前端走支付流程并提交 paymentId。
	- 鉴权：必须（用户登录）。
	- 备注：后端应检查排课剩余名额、用户重复预约等规则。
	- 返回：订单 id、状态（已支付/待确认等）。

- GET /api/appointments
	- 描述：用户查询自己的预约订单列表。
	- 请求类型：GET
	- 参数（query）：page、pageSize、status（可选，过滤进行中/已完成/已取消）。
	- 鉴权：必须（用户）。
	- 返回：订单列表（包含 id、scheduleId、courseInfo、coachInfo、startAt、status 等）。

- GET /api/appointments/coach
	- 描述：教练查看与自己相关的预约订单列表（供接单、管理）。
	- 请求类型：GET
	- 参数：page、pageSize、status（可选）。
	- 鉴权：必须（教练）。
	- 返回：订单列表及统计。

- POST /api/appointments/:id/cancel
	- 描述：取消订单（用户或教练在允许范围内取消）。
	- 请求类型：POST
	- 参数：id（path, 必需）、body 可含 reason（string, 可选）。
	- 鉴权：必须（操作者需为订单相关方或管理员）。
	- 返回：取消结果与退款/名额恢复逻辑说明（若有）。

- POST /api/appointments/:id/complete
	- 描述：教练标记订单已完成（课程已结束）。
	- 请求类型：POST
	- 参数：id（path, 必需）。
	- 鉴权：必须（教练或管理员）。
	- 返回：更新后的订单状态。

通用说明（简要）
- 鉴权：需要鉴权的接口须在请求头携带 Authorization: Bearer <token> 或按项目约定传递 token。后端中间件负责解析并注入 userId / role。
- 错误与响应：成功通常返回 200/201 和 { success: true, data: ..., message: '' }；校验失败或权限错误返回 400/401/403；资源不存在返回 404。
- 状态设计：课程/排课/订单等使用 status 字段表示可见性与生命周期（例如课程 1=有效，0=已删除；排课 1=正常，2=过期/下架）。
- 时间与冲突校验：后端必须对排课时间重叠、预约名额和订单幂等进行严格校验并返回明确错误码/提示。

（以上接口说明可根据项目实际实现微调）

评价（Reviews）
- GET /api/reviews
	- 描述：查询评价列表，可按课程或用户过滤。
	- 请求类型：GET
	- 参数（query）：page、pageSize、courseId（可选）、coachId（可选）、userId（可选）、status（可选）。
	- 鉴权：公开或可选（阅读公开评价一般无需鉴权）。
	- 返回：评价数组（包含 id、courseId、userId、rating、content、createdAt、is_deleted 等）。

- POST /api/reviews
	- 描述：用户对已完成的预约提交评价。
	- 请求类型：POST
	- 参数（body, JSON）：appointmentId（int, 必需）、courseId（int, 必需）、rating（int, 必需，1-5）、content（string, 可选）、images（array, 可选）。
	- 鉴权：必须（用户）。
	- 备注：后端应校验该用户确实参与过对应预约且在允许的评价时间窗口内。项目当前允许多次评价。
	- 返回：新建评价 id 与结果。

- GET /api/reviews/coach
	- 描述：教练查看自己课程下的评价列表与统计（平均分、数量）。
	- 请求类型：GET
	- 参数：page、pageSize、courseId（可选）。
	- 鉴权：必须（教练）。
	- 返回：评价列表与统计信息。

- DELETE /api/reviews/:id
	- 描述：软删除评价（设置 is_deleted 或 status 字段）。
	- 请求类型：DELETE
	- 参数：id（path, 必需）。
	- 鉴权：必须（教练或管理员，可仅允许教练删除自己课程下的不当评价）。
	- 返回：删除结果。

通用说明（针对评价）
- 反垃圾与内容审核：如需上线应考虑加入敏感词检测与图片审核流程。
- 可见性：前端展示时需过滤已删除或被屏蔽的评价（is_deleted=true 或 status!=1）。
- 评分统计：后端可维护课程/教练的评分汇总或按需计算。

