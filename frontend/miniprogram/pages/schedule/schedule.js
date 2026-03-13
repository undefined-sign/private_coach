const { request } = require('../../utils/request');

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function normalizeDateText(dateValue) {
	const raw = String(dateValue || '');
	const matched = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	return matched ? matched[1] : '';
}

function formatTimeText(timeValue) {
	const raw = String(timeValue || '');
	const matched = raw.match(/^(\d{2}:\d{2})/);
	return matched ? matched[1] : raw;
}

function getWeekdayText(normalDateText) {
	const parts = normalDateText.split('-');
	if (parts.length !== 3) {
		return '';
	}

	const year = Number(parts[0]);
	const month = Number(parts[1]);
	const day = Number(parts[2]);
	const date = new Date(year, month - 1, day);

	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return WEEKDAY_TEXT[date.getDay()] || '';
}

function mapStatusText(status) {
	if (status === 0) {
		return '可预约';
	}
	if (status === 1) {
		return '已约满';
	}
	return '暂不可约';
}

function mapAppointmentStatusText(status) {
	if (status === 0) {
		return '预约中';
	}
	if (status === 1) {
		return '已取消';
	}
	if (status === 2) {
		return '已完成';
	}
	return '未知状态';
}

function mapStatusClass(status) {
	if (status === 0) {
		return 'available';
	}
	if (status === 1) {
		return 'full';
	}
	return 'disabled';
}

function formatServiceType(serviceType) {
	const value = String(serviceType || '').trim();
	if (!value) {
		return '私教';
	}

	const lower = value.toLowerCase();
	if (value === '1' || lower === 'private' || lower === 'personal') {
		return '私教';
	}
	if (value === '2' || lower === 'group' || lower === 'small-group') {
		return '小班课';
	}

	return value;
}

function formatSlot(item) {
	const normalizedDate = normalizeDateText(item.date);
	const weekday = getWeekdayText(normalizedDate);
	const shortDate = normalizedDate.length >= 10 ? normalizedDate.slice(5) : normalizedDate;
	const startTime = formatTimeText(item.startTime);
	const endTime = formatTimeText(item.endTime);

	return {
		...item,
		displayDate: weekday ? `${shortDate} ${weekday}` : (shortDate || '--'),
		timeRange: `${startTime || '--:--'} - ${endTime || '--:--'}`,
		statusText: mapStatusText(item.status),
		statusClass: mapStatusClass(item.status),
		canReserve: Number(item.status) === 0
	};
}

Page({
	data: {
		loading: true,
		error: '',
		course: null,
		scheduleList: [],
		submittingScheduleId: 0
	},

	onLoad(options) {
		this.courseId = Number(options.courseId || 0);
		this.coachId = Number(options.coachId || 0);
		this.loadScheduleInfo();
	},

	async loadScheduleInfo() {
		this.setData({ loading: true, error: '' });

		try {
			const [courseRes, scheduleRes] = await Promise.all([
				request({ url: `/api/courses/${this.courseId}` }),
				request({ url: `/api/courses/${this.courseId}/schedules` })
			]);

			this.setData({
				loading: false,
				course: {
					...courseRes.item,
					serviceTypeText: formatServiceType(courseRes.item && courseRes.item.serviceType)
				},
				scheduleList: (scheduleRes.list || []).map(formatSlot)
			});
		} catch (error) {
			this.setData({
				loading: false,
				error: error.message || '未找到课程信息，请返回重试。'
			});
		}
	},

	async handleReserveTap(event) {
		const { scheduleId } = event.currentTarget.dataset;
		const user = getApp().globalData.user;

		if (!user || !user.id) {
			wx.showToast({
				title: '请先登录后再预约',
				icon: 'none'
			});
			return;
		}

		if (!scheduleId || this.data.submittingScheduleId) {
			return;
		}

		this.setData({ submittingScheduleId: Number(scheduleId) });

		try {
			const res = await request({
				url: '/api/appointments',
				method: 'POST',
				data: {
					userId: user.id,
					scheduleId: Number(scheduleId)
				}
			});

			wx.showToast({
				title: res.message || '预约成功',
				icon: res.alreadyBooked || res.full ? 'none' : 'success'
			});
			await this.loadScheduleInfo();
		} catch (error) {
			wx.showToast({
				title: error.message || mapAppointmentStatusText(-1),
				icon: 'none'
			});
			await this.loadScheduleInfo();
		} finally {
			this.setData({ submittingScheduleId: 0 });
		}
	}
});