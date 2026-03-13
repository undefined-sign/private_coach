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

function mapStatusMeta(status) {
	if (status === 0) {
		return { text: '预约中', cls: 'status-pending' };
	}
	if (status === 1) {
		return { text: '已取消', cls: 'status-cancelled' };
	}
	if (status === 2) {
		return { text: '已完成', cls: 'status-done' };
	}
	return { text: '未知状态', cls: 'status-cancelled' };
}

function mapOrderDetail(item) {
	const normalizedDate = normalizeDateText(item.date);
	const weekday = getWeekdayText(normalizedDate);
	const shortDate = normalizedDate ? normalizedDate.slice(5) : '--';
	const startTime = formatTimeText(item.startTime) || '--:--';
	const endTime = formatTimeText(item.endTime) || '--:--';
	const statusMeta = mapStatusMeta(Number(item.status));

	return {
		...item,
		statusText: statusMeta.text,
		statusClass: statusMeta.cls,
		dateText: `${shortDate} ${weekday}`.trim(),
		timeRange: `${startTime} - ${endTime}`,
		amountText: `¥${Number(item.amount || 0).toFixed(2)}`
	};
}

Page({
	data: {
		loading: true,
		error: '',
		item: null
	},

	onLoad(options) {
		this.orderId = Number(options.orderId || 0);
	},

	onShow() {
		this.loadOrderDetail();
	},

	async loadOrderDetail() {
		const user = getApp().globalData.user;
		if (!user || !user.id) {
			this.setData({
				loading: false,
				error: '请先登录后查看预约详情。',
				item: null
			});
			return;
		}

		if (!this.orderId) {
			this.setData({
				loading: false,
				error: '预约ID无效',
				item: null
			});
			return;
		}

		this.setData({ loading: true, error: '' });

		try {
			const res = await request({
				url: `/api/appointments/${this.orderId}`,
				data: { userId: user.id }
			});

			this.setData({
				loading: false,
				item: mapOrderDetail(res.item)
			});
		} catch (error) {
			this.setData({
				loading: false,
				error: error.message || '加载预约详情失败',
				item: null
			});
		}
	}
});