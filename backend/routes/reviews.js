const express = require('express');
const db = require('../db');

const router = express.Router();

function toNumber(value) {
  return Number(value || 0);
}

async function findCoachByUserId(userId) {
  const [rows] = await db.query(
    'SELECT id, user_id, status FROM coach WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

function mapCoachReviewRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name || '',
    userId: row.user_id,
    nickname: row.nickname,
    rating: Number(row.rating || 0),
    content: row.content || '',
    createdAt: row.created_at_text
  };
}

router.get('/coach', async (req, res, next) => {
  const userId = toNumber(req.query.userId);
  const page = toNumber(req.query.page);
  const pageSize = toNumber(req.query.pageSize);
  const usePagination = page > 0 && pageSize > 0;

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const whereSql = 'WHERE c.coach_id = ? AND r.is_deleted = 0';
    const whereParams = [coach.id];

    if (!usePagination) {
      const [rows] = await db.query(
        `SELECT r.id, r.course_id, r.user_id, r.rating, r.content,
                DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text,
                c.name AS course_name,
                COALESCE(NULLIF(u.nickname, ''), CONCAT('用户', r.user_id)) AS nickname
         FROM review r
         INNER JOIN course c ON c.id = r.course_id
         LEFT JOIN user u ON u.id = r.user_id
         ${whereSql}
         ORDER BY r.created_at DESC, r.id DESC`,
        whereParams
      );

      return res.json({
        list: rows.map(mapCoachReviewRow),
        total: rows.length,
        hasMore: false
      });
    }

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM review r
       INNER JOIN course c ON c.id = r.course_id
       ${whereSql}`,
      whereParams
    );

    const total = Number(countRow.total || 0);
    const listParams = [...whereParams, safePageSize, offset];
    const [rows] = await db.query(
      `SELECT r.id, r.course_id, r.user_id, r.rating, r.content,
              DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text,
              c.name AS course_name,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('用户', r.user_id)) AS nickname
       FROM review r
       INNER JOIN course c ON c.id = r.course_id
       LEFT JOIN user u ON u.id = r.user_id
       ${whereSql}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      listParams
    );

    return res.json({
      list: rows.map(mapCoachReviewRow),
      page: safePage,
      pageSize: safePageSize,
      total,
      hasMore: offset + rows.length < total
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  const courseId = toNumber(req.query.courseId);
  const page = toNumber(req.query.page);
  const pageSize = toNumber(req.query.pageSize);
  const usePagination = page > 0 && pageSize > 0;

  if (!courseId) {
    return res.status(400).json({ message: 'courseId 必填' });
  }

  try {
    if (!usePagination) {
      const [rows] = await db.query(
      `SELECT r.id, r.course_id, r.user_id, r.rating, r.content,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text,
                COALESCE(NULLIF(u.nickname, ''), CONCAT('用户', r.user_id)) AS nickname
         FROM review r
         LEFT JOIN user u ON u.id = r.user_id
         WHERE r.course_id = ? AND r.is_deleted = 0
         ORDER BY r.created_at DESC, r.id DESC`,
        [courseId]
      );

      const list = rows.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        nickname: row.nickname,
        rating: Number(row.rating || 0),
        content: row.content || '',
        createdAt: row.created_at_text
      }));

      return res.json({ list, total: list.length, hasMore: false });
    }

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM review
       WHERE course_id = ? AND is_deleted = 0`,
      [courseId]
    );

    const total = Number(countRow.total || 0);
    const [rows] = await db.query(
          `SELECT r.id, r.course_id, r.user_id, r.rating, r.content,
            DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('用户', r.user_id)) AS nickname
       FROM review r
       LEFT JOIN user u ON u.id = r.user_id
       WHERE r.course_id = ? AND r.is_deleted = 0
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [courseId, safePageSize, offset]
    );

    const list = rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      userId: row.user_id,
      nickname: row.nickname,
      rating: Number(row.rating || 0),
      content: row.content || '',
      createdAt: row.created_at_text
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

router.post('/', async (req, res, next) => {
  const body = req.body || {};
  const userId = toNumber(body.userId);
  const orderId = toNumber(body.orderId);
  const rating = toNumber(body.rating);
  const content = String(body.content || '').trim();

  if (!userId || !orderId) {
    return res.status(400).json({ message: 'userId 和 orderId 必填' });
  }

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: '评分必须为 1-5' });
  }

  if (!content) {
    return res.status(400).json({ message: '评价内容不能为空' });
  }

  if (content.length > 512) {
    return res.status(400).json({ message: '评价内容最多 512 字' });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.id, a.user_id, a.status AS appointment_status,
              s.course_id
       FROM appointment a
       INNER JOIN schedule s ON s.id = a.schedule_id
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId, userId]
    );

    const order = rows[0];
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ message: '订单不存在' });
    }

    if (toNumber(order.appointment_status) !== 2) {
      await connection.rollback();
      return res.status(400).json({ message: '仅已完成订单可评价' });
    }

    const courseId = toNumber(order.course_id);

    const [insertResult] = await connection.query(
      `INSERT INTO review (course_id, user_id, rating, content)
       VALUES (?, ?, ?, ?)`,
      [courseId, userId, rating, content]
    );

    await connection.commit();
    return res.json({
      message: '评价成功',
      item: {
        id: insertResult.insertId,
        courseId,
        userId,
        rating,
        content
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

router.delete('/:id', async (req, res, next) => {
  const reviewId = toNumber(req.params.id);
  const userId = toNumber((req.body || {}).userId);

  if (!reviewId) {
    return res.status(400).json({ message: '评价ID 无效' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const coach = await findCoachByUserId(userId);
    if (!coach || toNumber(coach.status) !== 1) {
      return res.status(404).json({ message: '教练不存在或不可用' });
    }

    const [result] = await db.query(
      `UPDATE review r
       INNER JOIN course c ON c.id = r.course_id
       SET r.is_deleted = 1
       WHERE r.id = ? AND c.coach_id = ? AND r.is_deleted = 0`,
      [reviewId, coach.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: '评价不存在或无权删除' });
    }

    return res.json({ message: '删除成功' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
