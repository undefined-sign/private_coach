-- 用户表（user）
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID（主键）',
    openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid（唯一）',
    nickname VARCHAR(32) NOT NULL COMMENT '昵称',
    role TINYINT NOT NULL DEFAULT 0 COMMENT '身份类型（0用户/1教练）'
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 教练表（coach）
CREATE TABLE coach (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '教练ID（主键）',
    user_id BIGINT NOT NULL UNIQUE COMMENT '绑定的用户ID（外键:user）',
    intro TEXT COMMENT '个人简介',
    skills VARCHAR(128) COMMENT '擅长项目',
    contact VARCHAR(64) COMMENT '联系方式（手机号/微信号等）',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态（1有效/0禁用）',
    CONSTRAINT fk_coach_user FOREIGN KEY (user_id) REFERENCES user(id)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='教练表';

-- 课程表（course）
CREATE TABLE course (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '课程ID（主键）',
    coach_id BIGINT NOT NULL COMMENT '教练ID（外键:coach）',
    name VARCHAR(64) NOT NULL COMMENT '课程名称',
    service_type VARCHAR(64) NOT NULL DEFAULT '私教' COMMENT '服务类型（如私教、小班课等）',
    duration INT NOT NULL COMMENT '时长（分钟）',
    price DECIMAL(10,2) NOT NULL COMMENT '价格',
    content TEXT COMMENT '课程介绍/内容',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态（1有效/0下架）',
    CONSTRAINT fk_course_coach FOREIGN KEY (coach_id) REFERENCES coach(id)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='课程表';

-- 课程排期表（schedule）
CREATE TABLE schedule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '排期ID（主键）',
    course_id BIGINT NOT NULL COMMENT '课程ID（外键:course）',
    date DATE NOT NULL COMMENT '上课日期',
    start_time TIME NOT NULL COMMENT '开始时间',
    end_time TIME NOT NULL COMMENT '结束时间',
    max_persons INT NOT NULL DEFAULT 1 COMMENT '该排期最大可预约人数',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0可预约/1已约满/2已禁用等）',
    CONSTRAINT fk_schedule_course FOREIGN KEY (course_id) REFERENCES course(id)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='课程排期表';

-- 预约订单表（appointment）
CREATE TABLE appointment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    user_id BIGINT NOT NULL COMMENT '用户ID（外键:user）',
    schedule_id BIGINT NOT NULL COMMENT '排期ID（外键:schedule）',
    amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态(0预约中/1已取消/2已完成)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '预约下单时间',
    CONSTRAINT fk_appointment_user FOREIGN KEY (user_id) REFERENCES user(id),
    CONSTRAINT fk_appointment_schedule FOREIGN KEY (schedule_id) REFERENCES schedule(id)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='预约订单表';

-- 课程评价表（review）
CREATE TABLE review (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '评价ID（主键）',
    course_id BIGINT NOT NULL COMMENT '课程ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    rating TINYINT NOT NULL COMMENT '评分（1-5）',
    content VARCHAR(512) NOT NULL COMMENT '评价文字内容',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0正常/1删除）',
    CONSTRAINT fk_review_course FOREIGN KEY (course_id) REFERENCES course(id),
    CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES user(id)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4 COMMENT='课程评价表';