const { request } = require('../../utils/request');

Page({
  data: {
    user: null,
    showApplyForm: false,
    applyForm: {
      intro: '',
      skills: '',
      contact: ''
    }
  },

  onShow() {
    const user = getApp().globalData.user;
    const coachProfile = (user && user.coachProfile) || {};

    this.setData({
      user,
      applyForm: {
        intro: coachProfile.intro || '',
        skills: coachProfile.skills || '',
        contact: coachProfile.contact || ''
      }
    });
  },

  handleApplyTap() {
    this.setData({ showApplyForm: true });
  },

  handleCancelApply() {
    this.setData({ showApplyForm: false });
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = String(event.detail.value || '');
    if (!field) {
      return;
    }

    this.setData({
      [`applyForm.${field}`]: value
    });
  },

  async handleSubmitApply() {
    if (this._submittingApply) {
      return;
    }

    const user = this.data.user;
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const intro = String(this.data.applyForm.intro || '').trim();
    const skills = String(this.data.applyForm.skills || '').trim();
    const contact = String(this.data.applyForm.contact || '').trim();

    if (!intro || !skills || !contact) {
      wx.showToast({ title: '请完整填写申请信息', icon: 'none' });
      return;
    }

    this._submittingApply = true;
    wx.showLoading({
      title: '提交中',
      mask: true
    });

    try {
      const result = await request({
        url: '/api/coaches/apply',
        method: 'POST',
        data: {
          userId: user.id,
          intro,
          skills,
          contact
        }
      });

      const nextUser = {
        ...user,
        ...(result.user || {}),
        role: 1,
        coachProfile: {
          intro: result.coach ? result.coach.intro : intro,
          skills: result.coach ? result.coach.skills : skills,
          contact: result.coach ? result.coach.contact : contact,
          id: result.coach ? result.coach.id : undefined,
          status: result.coach ? result.coach.status : undefined
        }
      };

      getApp().setUser(nextUser);
      this.setData({
        user: nextUser,
        showApplyForm: false,
        applyForm: {
          intro: nextUser.coachProfile.intro || '',
          skills: nextUser.coachProfile.skills || '',
          contact: nextUser.coachProfile.contact || ''
        }
      });

      wx.showToast({ title: '申请成功', icon: 'success' });
    } catch (error) {
      console.error('apply coach failed', error);
    } finally {
      this._submittingApply = false;
      wx.hideLoading();
    }
  },

  handleGoCoachCenter() {
    wx.navigateTo({
      url: '/pages/coach-center/coach-center'
    });
  },

  handleLogout() {
    getApp().clearUser();
    wx.showToast({ title: '已退出', icon: 'success' });
    wx.reLaunch({ url: '/pages/login/login' });
  }
});