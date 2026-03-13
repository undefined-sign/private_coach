const { request } = require('../../utils/request');

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {},

  async handleLogin() {
    if (this._submitting) {
      return;
    }

    this._submitting = true;
    wx.showLoading({
      title: '登录中',
      mask: true
    });

    try {
      const loginRes = await wxLogin();
      const result = await request({
        url: '/api/auth/wx-login',
        method: 'POST',
        data: {
          code: loginRes.code
        }
      });

      getApp().setUser(result.user);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (error) {
      console.error(error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    } finally {
      this._submitting = false;
      wx.hideLoading();
    }
  }
});