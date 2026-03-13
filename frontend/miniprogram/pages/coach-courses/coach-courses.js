const { request } = require('../../utils/request');

Page({
	data: {
		coachId: 0,
		list: [],
		showForm: false,
		isEdit: false,
		editingId: 0,
		form: {
			name: '',
			serviceType: '私教',
			duration: '60',
			price: '',
			content: ''
		}
	},

	onLoad(options) {
		this.setData({
			coachId: Number(options.coachId || 0)
		});
	},

	onShow() {
		this.loadMyCourses();
	},

	async loadMyCourses() {
		const user = getApp().globalData.user;
		if (!user || Number(user.role) !== 1) {
			this.setData({ list: [] });
			return;
		}

		try {
			const result = await request({
				url: '/api/courses/mine',
				method: 'GET',
				data: { userId: user.id }
			});

			this.setData({
				coachId: Number(result.coachId || this.data.coachId || 0),
				list: (result.list || []).map((item) => ({
					...item,
					priceText: Number(item.price || 0).toFixed(2)
				}))
			});
		} catch (error) {
			console.error('load courses failed', error);
		}
	},

	handleAddTap() {
		this.setData({
			showForm: true,
			isEdit: false,
			editingId: 0,
			form: {
				name: '',
				serviceType: '私教',
				duration: '60',
				price: '',
				content: ''
			}
		});
	},

	handleEditTap(event) {
		const index = Number(event.currentTarget.dataset.index);
		const item = this.data.list[index];
		if (!item) {
			return;
		}

		this.setData({
			showForm: true,
			isEdit: true,
			editingId: item.id,
			form: {
				name: item.name || '',
				serviceType: item.serviceType || '私教',
				duration: String(item.duration || ''),
				price: String(item.price || ''),
				content: item.intro || ''
			}
		});
	},

	handleCancelForm() {
		this.setData({ showForm: false });
	},

	handleInput(event) {
		const field = event.currentTarget.dataset.field;
		const value = String(event.detail.value || '');
		if (!field) {
			return;
		}

		this.setData({
			[`form.${field}`]: value
		});
	},

	async handleSubmitForm() {
		if (this._saving) {
			return;
		}

		const user = getApp().globalData.user;
		if (!user || Number(user.role) !== 1) {
			wx.showToast({ title: '请先登录教练账号', icon: 'none' });
			return;
		}

		const name = String(this.data.form.name || '').trim();
		const serviceType = String(this.data.form.serviceType || '').trim() || '私教';
		const duration = Number(this.data.form.duration || 0);
		const price = Number(this.data.form.price || 0);
		const content = String(this.data.form.content || '').trim();

		if (!name) {
			wx.showToast({ title: '请输入课程名称', icon: 'none' });
			return;
		}
		if (!duration || duration <= 0) {
			wx.showToast({ title: '请输入正确时长', icon: 'none' });
			return;
		}
		if (!Number.isFinite(price) || price < 0) {
			wx.showToast({ title: '请输入正确价格', icon: 'none' });
			return;
		}

		this._saving = true;
		wx.showLoading({ title: '保存中', mask: true });

		try {
			const payload = {
				userId: user.id,
				name,
				serviceType,
				duration,
				price,
				content
			};

			if (this.data.isEdit && this.data.editingId) {
				await request({
					url: `/api/courses/${this.data.editingId}`,
					method: 'PUT',
					data: payload
				});
			} else {
				await request({
					url: '/api/courses',
					method: 'POST',
					data: payload
				});
			}

			wx.showToast({ title: '保存成功', icon: 'success' });
			this.setData({ showForm: false });
			await this.loadMyCourses();
		} catch (error) {
			console.error('save course failed', error);
		} finally {
			this._saving = false;
			wx.hideLoading();
		}
	},

	async handleDeleteTap(event) {
		const index = Number(event.currentTarget.dataset.index);
		const item = this.data.list[index];
		const user = getApp().globalData.user;
		if (!item || !user) {
			return;
		}

		const confirmRes = await new Promise((resolve) => {
			wx.showModal({
				title: '确认删除',
				content: `确认删除课程「${item.name}」吗？`,
				confirmColor: '#1f6fff',
				success: resolve,
				fail: () => resolve({ confirm: false })
			});
		});

		if (!confirmRes.confirm) {
			return;
		}

		try {
			wx.showLoading({ title: '删除中', mask: true });
			await request({
				url: `/api/courses/${item.id}`,
				method: 'DELETE',
				data: { userId: user.id }
			});
			wx.showToast({ title: '删除成功', icon: 'success' });
			await this.loadMyCourses();
		} catch (error) {
			console.error('delete course failed', error);
		} finally {
			wx.hideLoading();
		}
	}
});