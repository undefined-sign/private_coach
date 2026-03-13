# private_coach

健身私人教练预约微信小程序（前后端分离）。

当前项目已实现登录、教练申请、课程管理、排课管理、预约订单管理、评价管理等核心链路，适合课程设计/毕业设计/作品集展示。

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
