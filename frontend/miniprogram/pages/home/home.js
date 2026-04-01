const { request } = require('../../utils/request');

Page({
  data: {
    user: null,
    loading: true,
    error: '',
    coaches: [],
    topCoaches: [],
    courses: [],
    topCourses: []
  },

  onLoad() {
    this.setData({
      user: getApp().globalData.user
    });
  },

  onShow() {
    this.setData({
      user: getApp().globalData.user
    });
    this.loadPageData();
  },

  async loadPageData() {
    this.setData({ loading: true, error: '' });

    try {
      const [coachRes, courseRes] = await Promise.all([
        request({ url: '/api/coaches' }),
        request({ url: '/api/courses' })
      ]);

      this.setData({
        loading: false,
        coaches: coachRes.list || [],
        topCoaches: (coachRes.list || []).slice(0, 2),
        courses: courseRes.list || [],
        topCourses: (courseRes.list || []).slice(0, 4)
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '数据加载失败'
      });
    }
  },

  handleCoachTap(event) {
    const { coachId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?coachId=${coachId}`
    });
  },

  handleMoreCoachTap() {
    wx.navigateTo({
      url: '/pages/coach-list/coach-list'
    });
  },

  handleMoreCourseTap() {
    wx.navigateTo({
      url: '/pages/course-list/course-list'
    });
  },

  handleCourseTap(event) {
    const { courseId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/schedule/schedule?courseId=${courseId}`
    });
  },

  handleReserveTap(event) {
    const { courseId } = event.currentTarget.dataset;
    wx.showToast({
      title: `课程 ${courseId} 预约功能开发中`,
      icon: 'none'
    });
  }
});