const { request } = require('../../utils/request');

function mapStatusMeta(item) {
	const status = Number(item.status || 0);
	const expired = !!item.isExpired;

	if (status === 2) {
		return { text: '已删除', cls: 'status-deleted' };
	}
	if (expired) {
		return { text: '已过期', cls: 'status-expired' };
	}
	if (status === 1) {
		return { text: '已约满', cls: 'status-full' };
	}
	return { text: '可预约', cls: 'status-available' };
}

function mapScheduleItem(item) {
	const statusMeta = mapStatusMeta(item);
	const booked = Number(item.bookedCount || 0);
	const maxPersons = Number(item.maxPersons || 1);

	return {
		...item,
		statusText: statusMeta.text,
		statusClass: statusMeta.cls,
		slotText: `${item.date || '--'} ${item.startTime || '--:--'}-${item.endTime || '--:--'}`,
		personText: `${booked}/${maxPersons}`
	};
}

Page({
	data: {
		loading: true,
		error: '',
		courses: [],
		courseOptions: [{ id: 0, name: '全部课程' }],
		selectedCourseIndex: 0,
		scheduleList: [],
		showForm: false,
		isEdit: false,
		editingId: 0,
		formCourseIndex: 0,
		form: {
			courseId: 0,
			date: '',
			startTime: '09:00',
			endTime: '10:00',
			maxPersons: '1'
		},
		saving: false,
		deletingId: 0
	},

	onShow() {
		this.loadPageData();
	},

	onPullDownRefresh() {
		this.loadPageData().finally(() => {
			wx.stopPullDownRefresh();
		});
	},

	async loadPageData() {
		this.setData({ loading: true, error: '' });

		try {
			await this.loadCourses();
			await this.loadSchedules();
		} catch (error) {
			this.setData({ error: error.message || '加载排课失败' });
		} finally {
			this.setData({ loading: false });
		}
	},

	async loadCourses() {
		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			throw new Error('请使用教练账号登录');
		}

		const res = await request({
			url: '/api/courses/mine',
			method: 'GET',
			data: { userId: user.id }
		});

		const courses = res.list || [];
		const courseOptions = [{ id: 0, name: '全部课程' }].concat(
			courses.map((item) => ({ id: item.id, name: item.name }))
		);
		const firstCourse = courses[0] || null;

		this.setData({
			courses,
			courseOptions,
			selectedCourseIndex: 0,
			formCourseIndex: 0,
			form: {
				...this.data.form,
				courseId: firstCourse ? Number(firstCourse.id) : 0
			}
		});
	},

	getSelectedCourseId() {
		const option = this.data.courseOptions[this.data.selectedCourseIndex] || this.data.courseOptions[0];
		return Number((option && option.id) || 0);
	},

	async loadSchedules() {
		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			throw new Error('请使用教练账号登录');
		}

		const courseId = this.getSelectedCourseId();
		const res = await request({
			url: '/api/schedules/coach',
			method: 'GET',
			data: {
				userId: user.id,
				courseId: courseId || undefined
			}
		});

		this.setData({
			scheduleList: (res.list || []).map(mapScheduleItem)
		});
	},

	handleFilterChange(event) {
		const index = Number(event.detail.value || 0);
		this.setData({ selectedCourseIndex: index });
		this.loadSchedules();
	},

	handleAddTap() {
		const firstCourse = this.data.courses[0] || null;
		this.setData({
			showForm: true,
			isEdit: false,
			editingId: 0,
			formCourseIndex: 0,
			form: {
				courseId: firstCourse ? Number(firstCourse.id) : 0,
				date: '',
				startTime: '09:00',
				endTime: '10:00',
				maxPersons: '1'
			}
		});
	},

	handleCancelForm() {
		this.setData({ showForm: false, isEdit: false, editingId: 0 });
	},

	noopTap() {},

	getCourseIndexById(courseId) {
		const targetId = Number(courseId || 0);
		const index = this.data.courses.findIndex((item) => Number(item.id) === targetId);
		return index >= 0 ? index : 0;
	},

	handleEditTap(event) {
		const scheduleId = Number(event.currentTarget.dataset.scheduleId || 0);
		const item = this.data.scheduleList.find((row) => Number(row.id) === scheduleId);
		if (!item) {
			wx.showToast({ title: '排课信息已变化，请刷新后重试', icon: 'none' });
			return;
		}

		const formCourseIndex = this.getCourseIndexById(item.courseId);
		this.setData({
			showForm: true,
			isEdit: true,
			editingId: Number(item.id),
			formCourseIndex,
			form: {
				courseId: Number(item.courseId || 0),
				date: String(item.date || ''),
				startTime: String(item.startTime || '09:00'),
				endTime: String(item.endTime || '10:00'),
				maxPersons: String(item.maxPersons || '1')
			}
		});
	},

	handleFormCourseChange(event) {
		const index = Number(event.detail.value || 0);
		const course = this.data.courses[index] || null;
		this.setData({
			formCourseIndex: index,
			form: {
				...this.data.form,
				courseId: course ? Number(course.id) : 0
			}
		});
	},

	handleDateChange(event) {
		this.setData({
			form: {
				...this.data.form,
				date: String(event.detail.value || '')
			}
		});
	},

	handleStartTimeChange(event) {
		this.setData({
			form: {
				...this.data.form,
				startTime: String(event.detail.value || '09:00')
			}
		});
	},

	handleEndTimeChange(event) {
		this.setData({
			form: {
				...this.data.form,
				endTime: String(event.detail.value || '10:00')
			}
		});
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
		if (this.data.saving) {
			return;
		}

		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			wx.showToast({ title: '请使用教练账号登录', icon: 'none' });
			return;
		}

		const courseId = Number(this.data.form.courseId || 0);
		const date = String(this.data.form.date || '').trim();
		const startTime = String(this.data.form.startTime || '').trim();
		const endTime = String(this.data.form.endTime || '').trim();
		const maxPersons = Math.max(1, Math.floor(Number(this.data.form.maxPersons || 1)));

		if (!courseId || !date || !startTime || !endTime) {
			wx.showToast({ title: '请完整填写排课信息', icon: 'none' });
			return;
		}

		if (startTime >= endTime) {
			wx.showToast({ title: '开始时间需早于结束时间', icon: 'none' });
			return;
		}

		this.setData({ saving: true });
		wx.showLoading({ title: '保存中', mask: true });

		try {
			const payload = {
				userId: user.id,
				courseId,
				date,
				startTime,
				endTime,
				maxPersons
			};

			const res = await request({
				url: this.data.isEdit ? `/api/schedules/coach/${this.data.editingId}` : '/api/schedules/coach',
				method: this.data.isEdit ? 'PUT' : 'POST',
				data: payload
			});

			if (res && res.conflict) {
				wx.showToast({ title: res.message || '该时段有冲突', icon: 'none' });
				return;
			}

			wx.showToast({ title: res.message || (this.data.isEdit ? '修改成功' : '新增成功'), icon: 'success' });
			this.setData({ showForm: false, isEdit: false, editingId: 0 });
			await this.loadSchedules();
		} catch (error) {
			wx.showToast({ title: error.message || (this.data.isEdit ? '修改失败' : '新增失败'), icon: 'none' });
		} finally {
			this.setData({ saving: false });
			wx.hideLoading();
		}
	},

	async handleDeleteTap(event) {
		const scheduleId = Number(event.currentTarget.dataset.scheduleId || 0);
		if (!scheduleId || this.data.deletingId) {
			return;
		}

		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			wx.showToast({ title: '请使用教练账号登录', icon: 'none' });
			return;
		}

		const modalRes = await new Promise((resolve) => {
			wx.showModal({
				title: '删除过期排课',
				content: '确认删除该过期排课吗？删除后状态将置为禁用。',
				confirmColor: '#d55668',
				success: resolve,
				fail: () => resolve({ confirm: false })
			});
		});

		if (!modalRes.confirm) {
			return;
		}

		this.setData({ deletingId: scheduleId });
		try {
			const res = await request({
				url: `/api/schedules/coach/${scheduleId}`,
				method: 'DELETE',
				data: { userId: user.id }
			});

			wx.showToast({ title: res.message || '删除成功', icon: 'success' });
			await this.loadSchedules();
		} catch (error) {
			wx.showToast({ title: error.message || '删除失败', icon: 'none' });
		} finally {
			this.setData({ deletingId: 0 });
		}
	}
});
