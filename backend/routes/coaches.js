const express = require('express');
const db = require('../db');

const router = express.Router();

function normalizeText(value, maxLength) {
  const text = String(value || '').trim();
  if (!maxLength) {
    return text;
  }
  return text.slice(0, maxLength);
}

function splitSkills(skills) {
  if (!skills || typeof skills !== 'string') {
    return [];
  }

  return skills
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapCoachRow(row) {
  const name = row.name || `教练${row.id}`;
  return {
    id: row.id,
    userId: row.user_id,
    name,
    avatarText: name.slice(0, 1),
    intro: row.intro || '资深教练，擅长定制训练计划。',
    specialties: splitSkills(row.skills),
    experience: '认证教练',
    contact: row.contact || ''
  };
}

function mapCourseRow(row) {
  let level = '中级';
  if (row.duration <= 50) {
    level = '初级';
  } else if (row.duration >= 70) {
    level = '进阶';
  }

  return {
    id: row.id,
    coachId: row.coach_id,
    name: row.name,
    intro: row.content || '课程简介待完善',
    level,
    duration: row.duration,
    serviceType: row.service_type,
    price: Number(row.price)
  };
}

router.post('/apply', async (req, res, next) => {
  const body = req.body || {};
  const userId = Number(body.userId || 0);
  const intro = normalizeText(body.intro, 2000);
  const skills = normalizeText(body.skills, 128);
  const contact = normalizeText(body.contact, 64);

  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  if (!intro || !skills || !contact) {
    return res.status(400).json({ message: 'intro、skills、contact 均为必填' });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT id, openid, nickname, role FROM user WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );

    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: '用户不存在' });
    }

    const [coachRows] = await connection.query(
      'SELECT id FROM coach WHERE user_id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );

    let coachId = 0;
    if (coachRows[0]) {
      coachId = Number(coachRows[0].id);
      await connection.query(
        'UPDATE coach SET intro = ?, skills = ?, contact = ?, status = 1 WHERE id = ?',
        [intro, skills, contact, coachId]
      );
    } else {
      const [insertResult] = await connection.query(
        'INSERT INTO coach (user_id, intro, skills, contact, status) VALUES (?, ?, ?, ?, 1)',
        [userId, intro, skills, contact]
      );
      coachId = Number(insertResult.insertId || 0);
    }

    if (Number(user.role) !== 1) {
      await connection.query('UPDATE user SET role = 1 WHERE id = ?', [userId]);
    }

    await connection.commit();

    return res.json({
      message: '申请成功',
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        role: 1
      },
      coach: {
        id: coachId,
        userId,
        intro,
        skills,
        contact,
        status: 1
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

router.get('/profile', async (req, res, next) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) {
    return res.status(400).json({ message: 'userId 必填' });
  }

  try {
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.intro, c.skills, c.contact, c.status,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', c.id)) AS name
       FROM coach c
       LEFT JOIN user u ON u.id = c.user_id
       WHERE c.user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '教练资料不存在' });
    }

    const profile = rows[0];
    return res.json({
      item: {
        id: profile.id,
        userId: profile.user_id,
        intro: profile.intro || '',
        skills: profile.skills || '',
        contact: profile.contact || '',
        status: Number(profile.status || 0),
        name: profile.name || ''
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page || 0);
    const pageSize = Number(req.query.pageSize || 0);
    const usePagination = page > 0 && pageSize > 0;

    if (!usePagination) {
      const [rows] = await db.query(
        `SELECT c.id, c.user_id, c.intro, c.skills, c.contact,
          COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', c.id)) AS name
         FROM coach c
         LEFT JOIN user u ON u.id = c.user_id
         WHERE c.status = 1
        ORDER BY c.id ASC`
      );

      return res.json({
        list: rows.map(mapCoachRow),
        total: rows.length,
        hasMore: false
      });
    }

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM coach WHERE status = 1`
    );

    const total = Number(countRow.total || 0);
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.intro, c.skills, c.contact,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', c.id)) AS name
       FROM coach c
       LEFT JOIN user u ON u.id = c.user_id
       WHERE c.status = 1
       ORDER BY c.id ASC
       LIMIT ? OFFSET ?`,
      [safePageSize, offset]
    );

    return res.json({
      list: rows.map(mapCoachRow),
      page: safePage,
      pageSize: safePageSize,
      total,
      hasMore: offset + rows.length < total
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.intro, c.skills, c.contact,
              COALESCE(NULLIF(u.nickname, ''), CONCAT('教练', c.id)) AS name
       FROM coach c
       LEFT JOIN user u ON u.id = c.user_id
       WHERE c.id = ? AND c.status = 1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '教练不存在' });
    }

    return res.json({ item: mapCoachRow(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/courses', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, coach_id, name, service_type, duration, price, content
       FROM course
       WHERE coach_id = ? AND status = 1
       ORDER BY id DESC`,
      [req.params.id]
    );

    return res.json({ list: rows.map(mapCourseRow) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
