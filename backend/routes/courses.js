const express = require('express');
const db = require('../db');

const router = express.Router();

function mapLevel(duration) {
  if (duration <= 50) {
    return '初级';
  }
  if (duration >= 70) {
    return '进阶';
  }
  return '中级';
}

function mapCourseRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    name: row.name,
    intro: row.content || '课程简介待完善',
    level: mapLevel(row.duration),
    duration: row.duration,
    serviceType: row.service_type,
    price: Number(row.price),
    coachName: row.coach_name || ''
  };
}

function normalizeText(value, maxLength) {
  const text = String(value || '').trim();
  if (!maxLength) {
    return text;
  }
  return text.slice(0, maxLength);
}

function normalizeDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(1, Math.floor(n));
}

function normalizePrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return NaN;
  }
  return Number(n.toFixed(2));
}

async function findCoachByUserId(userId) {
  const [rows] = await db.query(
    'SELECT id, user_id, status FROM coach WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

router.get('/mine', async (req, res, next) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || Number(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [rows] = await db.query(
      `SELECT c.id, c.coach_id, c.name, c.service_type, c.duration, c.price, c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM course c
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE c.coach_id = ? AND c.status = 1
       ORDER BY c.id DESC`,
      [coach.id]
    );

    return res.json({ list: rows.map(mapCourseRow), coachId: coach.id });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const body = req.body || {};
  const userId = Number(body.userId || 0);
  const name = normalizeText(body.name, 64);
  const serviceType = normalizeText(body.serviceType, 64) || '私教';
  const duration = normalizeDuration(body.duration);
  const price = normalizePrice(body.price);
  const content = normalizeText(body.content, 2000);

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }
  if (!name) {
    return res.status(400).json({ message: '课程名称必填' });
  }
  if (!duration) {
    return res.status(400).json({ message: '课程时长必填' });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: '课程价格不合法' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || Number(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [result] = await db.query(
      `INSERT INTO course (coach_id, name, service_type, duration, price, content, status)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [coach.id, name, serviceType, duration, price, content]
    );

    const [rows] = await db.query(
      `SELECT c.id, c.coach_id, c.name, c.service_type, c.duration, c.price, c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM course c
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE c.id = ? LIMIT 1`,
      [result.insertId]
    );

    return res.json({ message: '新增成功', item: rows[0] ? mapCourseRow(rows[0]) : null });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const courseId = Number(req.params.id || 0);
  const body = req.body || {};
  const userId = Number(body.userId || 0);
  const name = normalizeText(body.name, 64);
  const serviceType = normalizeText(body.serviceType, 64) || '私教';
  const duration = normalizeDuration(body.duration);
  const price = normalizePrice(body.price);
  const content = normalizeText(body.content, 2000);

  if (!courseId) {
    return res.status(400).json({ message: '课程ID不合法' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }
  if (!name) {
    return res.status(400).json({ message: '课程名称必填' });
  }
  if (!duration) {
    return res.status(400).json({ message: '课程时长必填' });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: '课程价格不合法' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || Number(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [existsRows] = await db.query(
      'SELECT id FROM course WHERE id = ? AND coach_id = ? AND status = 1 LIMIT 1',
      [courseId, coach.id]
    );

    if (!existsRows[0]) {
      return res.status(404).json({ message: '课程不存在或无权操作' });
    }

    await db.query(
      `UPDATE course
       SET name = ?, service_type = ?, duration = ?, price = ?, content = ?
       WHERE id = ? AND coach_id = ? AND status = 1`,
      [name, serviceType, duration, price, content, courseId, coach.id]
    );

    const [rows] = await db.query(
      `SELECT c.id, c.coach_id, c.name, c.service_type, c.duration, c.price, c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM course c
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE c.id = ? LIMIT 1`,
      [courseId]
    );

    return res.json({ message: '修改成功', item: rows[0] ? mapCourseRow(rows[0]) : null });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const courseId = Number(req.params.id || 0);
  const userId = Number((req.body || {}).userId || 0);

  if (!courseId) {
    return res.status(400).json({ message: '课程ID不合法' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  let connection;

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || Number(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      'UPDATE course SET status = 0 WHERE id = ? AND coach_id = ? AND status = 1',
      [courseId, coach.id]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ message: '课程不存在或无权操作' });
    }

    const [scheduleResult] = await connection.query(
      `UPDATE schedule
       SET status = 2
       WHERE course_id = ?
         AND status IN (0, 1)
         AND TIMESTAMP(date, start_time) >= NOW()`,
      [courseId]
    );

    await connection.commit();

    return res.json({
      message: '删除成功',
      disabledScheduleCount: Number(scheduleResult.affectedRows || 0)
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/', async (req, res, next) => {
  const { coachId } = req.query;

  try {
    let sql =
      `SELECT c.id, c.coach_id, c.name, c.service_type, c.duration, c.price, c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM course c
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE c.status = 1`;
    const params = [];

    if (coachId) {
      sql += ' AND c.coach_id = ?';
      params.push(coachId);
    }

    sql += ' ORDER BY c.id DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ list: rows.map(mapCourseRow) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/schedules', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, course_id,
              DATE_FORMAT(date, '%Y-%m-%d') AS date_text,
              TIME_FORMAT(start_time, '%H:%i') AS start_time_text,
              TIME_FORMAT(end_time, '%H:%i') AS end_time_text,
              max_persons, status
       FROM schedule
       WHERE course_id = ?
         AND status <> 2
         AND TIMESTAMP(date, end_time) >= NOW()
       ORDER BY date ASC, start_time ASC`,
      [req.params.id]
    );

    const list = rows.map((item) => ({
      id: item.id,
      courseId: item.course_id,
      date: item.date_text,
      startTime: item.start_time_text,
      endTime: item.end_time_text,
      maxPersons: item.max_persons,
      status: item.status
    }));

    return res.json({ list });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.coach_id, c.name, c.service_type, c.duration, c.price, c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM course c
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE c.id = ? AND c.status = 1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '课程不存在' });
    }

    return res.json({ item: mapCourseRow(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
