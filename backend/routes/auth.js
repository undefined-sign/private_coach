const express = require('express');
const db = require('../db');

const router = express.Router();

function normalizeOpenid(openid) {
  if (typeof openid !== 'string') {
    return '';
  }

  return openid.trim();
}

async function getOpenidByCode(code) {
  if (!code) {
    throw new Error('code 不能为空');
  }

  const mockOpenid = normalizeOpenid(process.env.MOCK_OPENID);
  if (mockOpenid) {
    return mockOpenid;
  }

  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret) {
    throw new Error('未配置 WECHAT_APPID / WECHAT_SECRET，无法换取真实 openid');
  }

  const query = new URLSearchParams({
    appid,
    secret,
    js_code: code,
    grant_type: 'authorization_code'
  });

  const response = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(`微信接口请求失败，HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.errcode) {
    throw new Error(`微信换取 openid 失败：${data.errmsg || data.errcode}`);
  }

  const openid = normalizeOpenid(data.openid);
  if (!openid) {
    throw new Error('微信接口未返回 openid');
  }

  return openid;
}

async function findOrCreateUserByOpenid(connection, openid) {
  const [rows] = await connection.query(
    'SELECT id, openid, nickname, role FROM user WHERE openid = ? LIMIT 1',
    [openid]
  );

  if (rows[0]) {
    return { user: rows[0], isNewUser: false };
  }

  try {
    const [result] = await connection.query(
      'INSERT INTO user (openid, nickname, role) VALUES (?, ?, 0)',
      [openid, '微信用户']
    );

    const [createdRows] = await connection.query(
      'SELECT id, openid, nickname, role FROM user WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return { user: createdRows[0], isNewUser: true };
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      const [existingRows] = await connection.query(
        'SELECT id, openid, nickname, role FROM user WHERE openid = ? LIMIT 1',
        [openid]
      );

      return { user: existingRows[0], isNewUser: false };
    }

    throw error;
  }
}

router.post('/wx-openid', async (req, res, next) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({ message: 'code 必填' });
  }

  try {
    const openid = await getOpenidByCode(code);
    return res.json({ openid });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const openid = normalizeOpenid((req.body || {}).openid);

  if (!openid) {
    return res.status(400).json({ message: 'openid 必填' });
  }

  let connection;

  try {
    connection = await db.getConnection();
    const { user, isNewUser } = await findOrCreateUserByOpenid(connection, openid);
    return res.json({ message: '登录成功', isNewUser, user });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/wx-login', async (req, res, next) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({ message: 'code 必填' });
  }

  let connection;

  try {
    const openid = await getOpenidByCode(code);
    connection = await db.getConnection();
    const { user, isNewUser } = await findOrCreateUserByOpenid(connection, openid);
    return res.json({ message: '登录成功', isNewUser, openid, user });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
