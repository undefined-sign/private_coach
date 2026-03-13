const express = require('express');
const db = require('../db');

const router = express.Router();

function toNumber(value) {
  return Number(value || 0);
}

function normalizeStatus(value) {
  return Number(value || 0);
}

async function findCoachByUserId(userId) {
  const [rows] = await db.query(
    'SELECT id, user_id, status FROM coach WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

function mapCoachOrderRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || `学员${row.user_id}`,
    scheduleId: row.schedule_id,
    courseId: row.course_id,
    courseName: row.course_name,
    serviceType: row.service_type || '',
    duration: Number(row.duration || 0),
    date: row.date_text,
    startTime: row.start_time_text,
    endTime: row.end_time_text,
    amount: Number(row.amount || 0),
    status: normalizeStatus(row.status),
    createdAt: row.created_at
  };
}

router.post('/', async (req, res, next) => {
  const userId = toNumber((req.body || {}).userId);
  const scheduleId = toNumber((req.body || {}).scheduleId);

  if (!userId || !scheduleId) {
    return res.status(400).json({ message: 'userId 和 scheduleId 必填' });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [scheduleRows] = await connection.query(
      `SELECT s.id, s.course_id, s.max_persons, s.status,
              c.price, c.name AS course_name
       FROM schedule s
       INNER JOIN course c ON c.id = s.course_id
       WHERE s.id = ?
       LIMIT 1
       FOR UPDATE`,
      [scheduleId]
    );

    const schedule = scheduleRows[0];
    if (!schedule) {
      await connection.rollback();
      return res.status(404).json({ message: '排期不存在' });
    }

    if (normalizeStatus(schedule.status) === 2) {
      await connection.rollback();
      return res.status(400).json({ message: '该排期暂不可预约' });
    }

    const [existingRows] = await connection.query(
      `SELECT id
       FROM appointment
       WHERE user_id = ? AND schedule_id = ? AND status = 0
       LIMIT 1
       FOR UPDATE`,
      [userId, scheduleId]
    );

    if (existingRows[0]) {
      await connection.rollback();
      return res.json({
        message: '你已预约该时间段，请勿重复预约',
        alreadyBooked: true,
        scheduleStatus: normalizeStatus(schedule.status)
      });
    }

    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS booked
       FROM appointment
       WHERE schedule_id = ? AND status = 0
       FOR UPDATE`,
      [scheduleId]
    );

    const bookedCount = Number(countRow.booked || 0);
    const maxPersons = Number(schedule.max_persons || 1);

    if (bookedCount >= maxPersons) {
      await connection.query(
        'UPDATE schedule SET status = 1 WHERE id = ? AND status <> 2',
        [scheduleId]
      );
      await connection.commit();
      return res.json({
        message: '该时间段已约满，请选择其他时段',
        full: true,
        scheduleStatus: 1
      });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO appointment (user_id, schedule_id, amount, status)
       VALUES (?, ?, ?, 0)`,
      [userId, scheduleId, schedule.price]
    );

    const newBookedCount = bookedCount + 1;
    const targetStatus = newBookedCount >= maxPersons ? 1 : 0;
    await connection.query(
      'UPDATE schedule SET status = ? WHERE id = ? AND status <> 2',
      [targetStatus, scheduleId]
    );

    await connection.commit();

    return res.json({
      message: '预约成功',
      item: {
        id: insertResult.insertId,
        scheduleId,
        courseId: schedule.course_id,
        courseName: schedule.course_name,
        bookedCount: newBookedCount,
        maxPersons,
        scheduleStatus: targetStatus
      }
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
  const userId = toNumber(req.query.userId);
  const statusRaw = String(req.query.status || '');
  const hasStatusFilter = ['0', '1', '2'].includes(statusRaw);
  const statusFilter = hasStatusFilter ? Number(statusRaw) : null;
  const page = toNumber(req.query.page);
  const pageSize = toNumber(req.query.pageSize);
  const usePagination = page > 0 && pageSize > 0;

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    let whereSql = 'WHERE a.user_id = ?';
    const whereParams = [userId];

    if (hasStatusFilter) {
      whereSql += ' AND a.status = ?';
      whereParams.push(statusFilter);
    }

    if (!usePagination) {
      const [rows] = await db.query(
        `SELECT a.id, a.user_id, a.schedule_id, a.amount, a.status, a.created_at,
                s.course_id,
                DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
                TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
                TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
                c.name AS course_name,
                c.service_type,
                c.duration,
                COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
         FROM appointment a
         INNER JOIN schedule s ON s.id = a.schedule_id
         INNER JOIN course c ON c.id = s.course_id
         LEFT JOIN coach co ON co.id = c.coach_id
         LEFT JOIN user u ON u.id = co.user_id
         ${whereSql}
         ORDER BY a.created_at DESC, a.id DESC`,
        whereParams
      );

      const list = rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        scheduleId: row.schedule_id,
        courseId: row.course_id,
        courseName: row.course_name,
        coachName: row.coach_name || '',
        serviceType: row.service_type || '',
        duration: Number(row.duration || 0),
        date: row.date_text,
        startTime: row.start_time_text,
        endTime: row.end_time_text,
        amount: Number(row.amount || 0),
        status: normalizeStatus(row.status),
        createdAt: row.created_at
      }));

      return res.json({ list, total: list.length, hasMore: false });
    }

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM appointment a
       ${whereSql}`,
      whereParams
    );

    const total = Number(countRow.total || 0);
    const listParams = [...whereParams, safePageSize, offset];
    const [rows] = await db.query(
      `SELECT a.id, a.user_id, a.schedule_id, a.amount, a.status, a.created_at,
              s.course_id,
              DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
              TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
              TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
              c.name AS course_name,
              c.service_type,
              c.duration,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       INNER JOIN course c ON c.id = s.course_id
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      listParams
    );

    const list = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      scheduleId: row.schedule_id,
      courseId: row.course_id,
      courseName: row.course_name,
      coachName: row.coach_name || '',
      serviceType: row.service_type || '',
      duration: Number(row.duration || 0),
      date: row.date_text,
      startTime: row.start_time_text,
      endTime: row.end_time_text,
      amount: Number(row.amount || 0),
      status: normalizeStatus(row.status),
      createdAt: row.created_at
    }));

    return res.json({
      list,
      page: safePage,
      pageSize: safePageSize,
      total,
      hasMore: offset + rows.length < total
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  const userId = toNumber((req.body || {}).userId);
  const appointmentId = toNumber(req.params.id);

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  if (!appointmentId) {
    return res.status(400).json({ message: '预约ID 无效' });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.id, a.status AS appointment_status, a.schedule_id,
              s.max_persons, s.status AS schedule_status
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [appointmentId, userId]
    );

    const record = rows[0];
    if (!record) {
      await connection.rollback();
      return res.status(404).json({ message: '预约记录不存在' });
    }

    const appointmentStatus = normalizeStatus(record.appointment_status);
    if (appointmentStatus !== 0) {
      await connection.rollback();
      return res.json({
        message: appointmentStatus === 1 ? '该预约已取消' : '当前状态不可取消',
        alreadyCancelled: appointmentStatus === 1
      });
    }

    await connection.query(
      'UPDATE appointment SET status = 1 WHERE id = ? AND user_id = ?',
      [appointmentId, userId]
    );

    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS booked
       FROM appointment
       WHERE schedule_id = ? AND status = 0
       FOR UPDATE`,
      [record.schedule_id]
    );

    const bookedCount = Number(countRow.booked || 0);
    const maxPersons = Number(record.max_persons || 1);
    let targetScheduleStatus = normalizeStatus(record.schedule_status);

    // 仅在非禁用状态下根据剩余人数回写可预约/已约满。
    if (targetScheduleStatus !== 2) {
      targetScheduleStatus = bookedCount >= maxPersons ? 1 : 0;
      await connection.query(
        'UPDATE schedule SET status = ? WHERE id = ? AND status <> 2',
        [targetScheduleStatus, record.schedule_id]
      );
    }

    await connection.commit();
    return res.json({
      message: '取消成功',
      item: {
        id: appointmentId,
        scheduleId: record.schedule_id,
        scheduleStatus: targetScheduleStatus,
        bookedCount,
        maxPersons
      }
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

router.get('/coach', async (req, res, next) => {
  const userId = toNumber(req.query.userId);
  const statusRaw = String(req.query.status || '0');
  const hasStatusFilter = ['0', '2'].includes(statusRaw);
  const statusFilter = hasStatusFilter ? Number(statusRaw) : 0;
  const page = toNumber(req.query.page);
  const pageSize = toNumber(req.query.pageSize);
  const usePagination = page > 0 && pageSize > 0;

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || normalizeStatus(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    let whereSql = 'WHERE c.coach_id = ? AND a.status <> 1';
    const whereParams = [coach.id];

    if (hasStatusFilter) {
      whereSql += ' AND a.status = ?';
      whereParams.push(statusFilter);
    }

    if (!usePagination) {
      const [rows] = await db.query(
        `SELECT a.id, a.user_id, a.schedule_id, a.amount, a.status, a.created_at,
                s.course_id,
                DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
                TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
                TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
                c.name AS course_name,
                c.service_type,
                c.duration,
                COALESCE(NULLIF(uu.nickname, ''), CONCAT('学员', a.user_id)) AS user_name
         FROM appointment a
         INNER JOIN schedule s ON s.id = a.schedule_id
         INNER JOIN course c ON c.id = s.course_id
         LEFT JOIN user uu ON uu.id = a.user_id
         ${whereSql}
         ORDER BY s.date DESC, s.start_time DESC, a.id DESC`,
        whereParams
      );

      return res.json({
        list: rows.map(mapCoachOrderRow),
        total: rows.length,
        hasMore: false
      });
    }

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       INNER JOIN course c ON c.id = s.course_id
       ${whereSql}`,
      whereParams
    );

    const total = Number(countRow.total || 0);
    const listParams = [...whereParams, safePageSize, offset];
    const [rows] = await db.query(
      `SELECT a.id, a.user_id, a.schedule_id, a.amount, a.status, a.created_at,
              s.course_id,
              DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
              TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
              TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
              c.name AS course_name,
              c.service_type,
              c.duration,
              COALESCE(NULLIF(uu.nickname, ''), CONCAT('学员', a.user_id)) AS user_name
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       INNER JOIN course c ON c.id = s.course_id
       LEFT JOIN user uu ON uu.id = a.user_id
       ${whereSql}
       ORDER BY s.date DESC, s.start_time DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      listParams
    );

    return res.json({
      list: rows.map(mapCoachOrderRow),
      page: safePage,
      pageSize: safePageSize,
      total,
      hasMore: offset + rows.length < total
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  const appointmentId = toNumber(req.params.id);
  const userId = toNumber((req.body || {}).userId);

  if (!appointmentId) {
    return res.status(400).json({ message: '预约ID 无效' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  let connection;

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || normalizeStatus(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.id, a.status AS appointment_status
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       INNER JOIN course c ON c.id = s.course_id
       WHERE a.id = ? AND c.coach_id = ?
       LIMIT 1
       FOR UPDATE`,
      [appointmentId, coach.id]
    );

    const appointment = rows[0];
    if (!appointment) {
      await connection.rollback();
      return res.status(404).json({ message: '订单不存在或无权操作' });
    }

    const status = normalizeStatus(appointment.appointment_status);
    if (status === 2) {
      await connection.rollback();
      return res.json({ message: '该订单已完成', alreadyCompleted: true });
    }
    if (status === 1) {
      await connection.rollback();
      return res.status(400).json({ message: '该订单已取消，无法确认完成' });
    }

    await connection.query(
      'UPDATE appointment SET status = 2 WHERE id = ?',
      [appointmentId]
    );

    await connection.commit();
    return res.json({ message: '确认完成成功', item: { id: appointmentId, status: 2 } });
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

router.get('/:id', async (req, res, next) => {
  const userId = toNumber(req.query.userId);
  const appointmentId = toNumber(req.params.id);

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  if (!appointmentId) {
    return res.status(400).json({ message: '预约ID 无效' });
  }

  try {
    const [rows] = await db.query(
      `SELECT a.id, a.user_id, a.schedule_id, a.amount, a.status, a.created_at,
              s.course_id,
              DATE_FORMAT(s.date, '%Y-%m-%d') AS date_text,
              TIME_FORMAT(s.start_time, '%H:%i') AS start_time_text,
              TIME_FORMAT(s.end_time, '%H:%i') AS end_time_text,
              c.name AS course_name,
              c.service_type,
              c.duration,
              c.content,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', co.id)) AS coach_name,
              co.contact AS coach_contact
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       INNER JOIN course c ON c.id = s.course_id
       LEFT JOIN coach co ON co.id = c.coach_id
       LEFT JOIN user u ON u.id = co.user_id
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1`,
      [appointmentId, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '预约记录不存在' });
    }

    const row = rows[0];
    return res.json({
      item: {
        id: row.id,
        userId: row.user_id,
        scheduleId: row.schedule_id,
        courseId: row.course_id,
        courseName: row.course_name,
        coachName: row.coach_name || '',
        coachContact: row.coach_contact || '',
        serviceType: row.service_type || '',
        duration: Number(row.duration || 0),
        intro: row.content || '',
        date: row.date_text,
        startTime: row.start_time_text,
        endTime: row.end_time_text,
        amount: Number(row.amount || 0),
        status: normalizeStatus(row.status),
        createdAt: row.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
