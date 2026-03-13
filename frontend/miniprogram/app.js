App({
  globalData: {
    baseUrl: 'http://127.0.0.1:3000',
    user: wx.getStorageSync('user') || null
  },

  setUser(user) {
    this.globalData.user = user;
    wx.setStorageSync('user', user);
  },

  clearUser() {
    this.globalData.user = null;
    wx.removeStorageSync('user');
  }
});