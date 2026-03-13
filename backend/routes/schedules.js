const express = require('express');
const db = require('../db');

const router = express.Router();

function toNumber(value) {
  return Number(value || 0);
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(text) ? `${text}:00` : '';
}

async function findCoachByUserId(userId) {
  const [rows] = await db.query(
    'SELECT id, status FROM coach WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function hasScheduleOverlap({ courseId, date, startTime, endTime, excludeId = 0 }) {
  let sql =
    `SELECT id
     FROM schedule
     WHERE course_id = ?
       AND date = ?
       AND status <> 2
       AND start_time < ?
       AND end_time > ?`;
  const params = [courseId, date, endTime, startTime];

  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';

  const [rows] = await db.query(sql, params);
  return !!rows[0];
}

function mapScheduleRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name || '',
    date: row.date_text,
    startTime: row.start_time_text,
    endTime: row.end_time_text,
    maxPersons: Number(row.max_persons || 1),
    bookedCount: Number(row.booked_count || 0),
    status: Number(row.status || 0),
    isExpired: Number(row.is_expired || 0) === 1
  };
}

router.get('/coach', async (req, res, next) => {
  const userId = toNumber(req.query.userId);
  const courseId = toNumber(req.query.courseId);

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    let whereSql = 'WHERE c.coach_id = ?';
    const params = [coach.id];
    if (courseId) {
      whereSql += ' AND s.course_id = ?';
      params.push(courseId);
    }

    const [rows] = await db.query(
      `SELECT s.id, s.course_id, s.max_persons, s.status,
              DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
              TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
              TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
              c.name AS course_name,
              (
                SELECT COUNT(*)
                FROM appointment a
                WHERE a.schedule_id = s.id AND a.status = 0
              ) AS booked_count,
              CASE WHEN TIMESTAMP(s.date, s.end_time) < NOW() THEN 1 ELSE 0 END AS is_expired
       FROM schedule s
       INNER JOIN course c ON c.id = s.course_id
       ${whereSql}
       ORDER BY s.date DESC, s.start_time DESC, s.id DESC`,
      params
    );

    return res.json({ list: rows.map(mapScheduleRow) });
  } catch (error) {
    return next(error);
  }
});

router.post('/coach', async (req, res, next) => {
  const body = req.body || {};
  const userId = toNumber(body.userId);
  const courseId = toNumber(body.courseId);
  const date = normalizeDate(body.date);
  const startTime = normalizeTime(body.startTime);
  const endTime = normalizeTime(body.endTime);
  const maxPersons = Math.max(1, Math.floor(toNumber(body.maxPersons || 1)));

  if (!userId || !courseId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'userId、courseId、date、startTime、endTime 必填' });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ message: '开始时间必须早于结束时间' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [courseRows] = await db.query(
      'SELECT id FROM course WHERE id = ? AND coach_id = ? AND status = 1 LIMIT 1',
      [courseId, coach.id]
    );

    if (!courseRows[0]) {
      return res.status(404).json({ message: '课程不存在或无权操作' });
    }

    const overlapped = await hasScheduleOverlap({ courseId, date, startTime, endTime });
    if (overlapped) {
      return res.json({ message: '该课程当天时间段有重叠，无法新增', conflict: true });
    }

    const [result] = await db.query(
      `INSERT INTO schedule (course_id, date, start_time, end_time, max_persons, status)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [courseId, date, startTime, endTime, maxPersons]
    );

    return res.json({
      message: '新增排课成功',
      item: {
        id: Number(result.insertId || 0),
        courseId,
        date,
        startTime: startTime.slice(0, 5),
        endTime: endTime.slice(0, 5),
        maxPersons,
        status: 0
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/coach/:id', async (req, res, next) => {
  const scheduleId = toNumber(req.params.id);
  const body = req.body || {};
  const userId = toNumber(body.userId);
  const date = normalizeDate(body.date);
  const startTime = normalizeTime(body.startTime);
  const endTime = normalizeTime(body.endTime);
  const maxPersons = Math.max(1, Math.floor(toNumber(body.maxPersons || 1)));

  if (!scheduleId || !userId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'scheduleId、userId、date、startTime、endTime 必填' });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ message: '开始时间必须早于结束时间' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.course_id, s.status,
              TIMESTAMP(s.date, s.end_time) < NOW() AS is_expired,
              (
                SELECT COUNT(*)
                FROM appointment a
                WHERE a.schedule_id = s.id AND a.status = 0
              ) AS booked_count
       FROM schedule s
       INNER JOIN course c ON c.id = s.course_id
       WHERE s.id = ? AND c.coach_id = ?
       LIMIT 1`,
      [scheduleId, coach.id]
    );

    const record = rows[0];
    if (!record) {
      return res.status(404).json({ message: '排课不存在或无权操作' });
    }

    if (toNumber(record.status) === 2) {
      return res.status(400).json({ message: '该排课已删除，无法编辑' });
    }

    if (toNumber(record.is_expired) === 1) {
      return res.status(400).json({ message: '过期排课不可编辑' });
    }

    const bookedCount = toNumber(record.booked_count);
    if (maxPersons < bookedCount) {
      return res.status(400).json({ message: `最大人数不能小于已预约人数(${bookedCount})` });
    }

    const overlapped = await hasScheduleOverlap({
      courseId: toNumber(record.course_id),
      date,
      startTime,
      endTime,
      excludeId: scheduleId
    });

    if (overlapped) {
      return res.json({ message: '该课程当天时间段有重叠，无法修改', conflict: true });
    }

    await db.query(
      `UPDATE schedule
       SET date = ?, start_time = ?, end_time = ?, max_persons = ?
       WHERE id = ?`,
      [date, startTime, endTime, maxPersons, scheduleId]
    );

    return res.json({
      message: '修改成功',
      item: {
        id: scheduleId,
        courseId: toNumber(record.course_id),
        date,
        startTime: startTime.slice(0, 5),
        endTime: endTime.slice(0, 5),
        maxPersons
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/coach/:id', async (req, res, next) => {
  const scheduleId = toNumber(req.params.id);
  const userId = toNumber((req.body || {}).userId);

  if (!scheduleId || !userId) {
    return res.status(400).json({ message: 'scheduleId 和 userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.status,
              TIMESTAMP(s.date, s.end_time) < NOW() AS is_expired
       FROM schedule s
       INNER JOIN course c ON c.id = s.course_id
       WHERE s.id = ? AND c.coach_id = ?
       LIMIT 1`,
      [scheduleId, coach.id]
    );

    const record = rows[0];
    if (!record) {
      return res.status(404).json({ message: '排课不存在或无权操作' });
    }

    if (toNumber(record.status) === 2) {
      return res.json({ message: '该排课已删除', alreadyDeleted: true });
    }

    if (toNumber(record.is_expired) !== 1) {
      return res.status(400).json({ message: '仅可删除过期排课' });
    }

    await db.query('UPDATE schedule SET status = 2 WHERE id = ?', [scheduleId]);

    return res.json({ message: '删除成功', item: { id: scheduleId, status: 2 } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
