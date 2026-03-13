function request(options) {
  const app = getApp();

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }

        const message = (res.data && res.data.message) || '请求失败';
        wx.showToast({ title: message, icon: 'none' });
        reject(new Error(message));
      },
      fail(error) {
        wx.showToast({ title: '网络连接失败', icon: 'none' });
        reject(error);
      }
    });
  });
}

module.exports = {
  request
};