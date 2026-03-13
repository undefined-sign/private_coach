const { request } = require('../../utils/request');

Page({
	data: {
		user: null,
		coachProfile: null,
		showEditForm: false,
		editForm: {
			intro: '',
			skills: '',
			contact: ''
		}
	},

	async onShow() {
		const user = getApp().globalData.user;
		this.setData({
			user,
			coachProfile: (user && user.coachProfile) || null
		});

		if (!user || Number(user.role) !== 1) {
			return;
		}

		await this.loadCoachProfile();
	},

	async loadCoachProfile() {
		const user = this.data.user;
		if (!user || Number(user.role) !== 1) {
			return;
		}

		try {
			const result = await request({
				url: '/api/coaches/profile',
				method: 'GET',
				data: { userId: user.id }
			});

			if (!result || !result.item) {
				return;
			}

			const coachProfile = {
				id: result.item.id,
				intro: result.item.intro || '',
				skills: result.item.skills || '',
				contact: result.item.contact || '',
				status: result.item.status
			};

			const nextUser = {
				...user,
				coachProfile
			};

			getApp().setUser(nextUser);
			this.setData({
				user: nextUser,
				coachProfile,
				editForm: {
					intro: coachProfile.intro,
					skills: coachProfile.skills,
					contact: coachProfile.contact
				}
			});
		} catch (error) {
			console.error('load coach profile failed', error);
		}
	},

	handleEditTap() {
		const profile = this.data.coachProfile || {};
		this.setData({
			showEditForm: true,
			editForm: {
				intro: profile.intro || '',
				skills: profile.skills || '',
				contact: profile.contact || ''
			}
		});
	},

	handleCancelEdit() {
		this.setData({ showEditForm: false });
	},

	handleInput(event) {
		const field = event.currentTarget.dataset.field;
		const value = String(event.detail.value || '');
		if (!field) {
			return;
		}

		this.setData({
			[`editForm.${field}`]: value
		});
	},

	async handleSaveProfile() {
		if (this._savingProfile) {
			return;
		}

		const user = this.data.user;
		if (!user || !user.id) {
			wx.showToast({ title: '请先登录', icon: 'none' });
			return;
		}

		const intro = String(this.data.editForm.intro || '').trim();
		const skills = String(this.data.editForm.skills || '').trim();
		const contact = String(this.data.editForm.contact || '').trim();

		if (!intro || !skills || !contact) {
			wx.showToast({ title: '请完整填写信息', icon: 'none' });
			return;
		}

		this._savingProfile = true;
		wx.showLoading({ title: '保存中', mask: true });

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

			const profile = {
				id: result.coach ? result.coach.id : (this.data.coachProfile && this.data.coachProfile.id),
				intro,
				skills,
				contact,
				status: result.coach ? result.coach.status : 1
			};

			const nextUser = {
				...user,
				...(result.user || {}),
				role: 1,
				coachProfile: profile
			};

			getApp().setUser(nextUser);
			this.setData({
				user: nextUser,
				coachProfile: profile,
				showEditForm: false,
				editForm: {
					intro,
					skills,
					contact
				}
			});

			wx.showToast({ title: '保存成功', icon: 'success' });
		} catch (error) {
			console.error('save coach profile failed', error);
		} finally {
			this._savingProfile = false;
			wx.hideLoading();
		}
	},

	handleGotoCourses() {
		wx.navigateTo({ url: '/pages/coach-courses/coach-courses' });
	},

	handleGotoSchedule() {
		wx.navigateTo({ url: '/pages/coach-schedule/coach-schedule' });
	},

	handleGotoOrders() {
		wx.navigateTo({ url: '/pages/coach-orders/coach-orders' });
	},

	handleGotoReviews() {
		wx.navigateTo({ url: '/pages/coach-reviews/coach-reviews' });
	}
});