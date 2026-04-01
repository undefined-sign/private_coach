const { request } = require('../../utils/request');

Page({
  data: {
    loading: true,
    refreshing: false,
    loadingMore: false,
    error: '',
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    this.resetAndLoad();
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.resetAndLoad().finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) {
      return;
    }
    this.loadMore();
  },

  async resetAndLoad() {
    this.setData({
      loading: true,
      error: '',
      list: [],
      page: 1,
      hasMore: true
    });

    await this.fetchPage(1, false);
    this.setData({ loading: false });
  },

  async loadMore() {
    const nextPage = this.data.page + 1;
    this.setData({ loadingMore: true, error: '' });

    try {
      await this.fetchPage(nextPage, true);
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  async fetchPage(page, append) {
    try {
      const res = await request({
        url: '/api/courses',
        data: {
          page,
          pageSize: this.data.pageSize
        }
      });

      const newList = res.list || [];
      this.setData({
        list: append ? this.data.list.concat(newList) : newList,
        page,
        hasMore: !!res.hasMore
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载课程列表失败'
      });
    }
  },

  handleCourseTap(event) {
    const { courseId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/schedule/schedule?courseId=${courseId}`
    });
  }
});
