const { request } = require('../../utils/request');

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const FILTER_TABS = [
	{ key: 'all', label: '全部' },
	{ key: '0', label: '预约中' },
	{ key: '1', label: '已取消' },
	{ key: '2', label: '已完成' }
];

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

function mapOrderItem(item) {
	const normalizedDate = normalizeDateText(item.date);
	const shortDate = normalizedDate ? normalizedDate.slice(5) : '--';
	const weekday = getWeekdayText(normalizedDate);
	const startTime = formatTimeText(item.startTime) || '--:--';
	const endTime = formatTimeText(item.endTime) || '--:--';
	const statusMeta = mapStatusMeta(Number(item.status));

	return {
		...item,
		slotText: `${shortDate} ${weekday} ${startTime}-${endTime}`.trim(),
		statusText: statusMeta.text,
		statusClass: statusMeta.cls,
		amountText: `¥${Number(item.amount || 0).toFixed(2)}`
	};
}

Page({
	data: {
		loading: true,
		error: '',
		list: [],
		activeTab: 'all',
		filterTabs: FILTER_TABS,
		page: 1,
		pageSize: 10,
		hasMore: true,
		loadingMore: false,
		cancelingOrderId: 0
	},

	onShow() {
		this.loadOrderList();
	},

	onPullDownRefresh() {
		this.loadOrderList().finally(() => {
			wx.stopPullDownRefresh();
		});
	},

	onReachBottom() {
		if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
			return;
		}

		this.loadMore();
	},

	getStatusParam() {
		if (this.data.activeTab === 'all') {
			return undefined;
		}
		return this.data.activeTab;
	},

	async loadOrderList() {
		this.setData({
			loading: true,
			error: '',
			list: [],
			page: 1,
			hasMore: true
		});

		try {
			await this.fetchPage(1, false);
		} catch (error) {
			this.setData({ error: error.message || '加载预约列表失败' });
		} finally {
			this.setData({ loading: false });
		}
	},

	async loadMore() {
		const nextPage = this.data.page + 1;
		this.setData({ loadingMore: true });

		try {
			await this.fetchPage(nextPage, true);
		} catch (error) {
			wx.showToast({
				title: error.message || '加载更多失败',
				icon: 'none'
			});
		} finally {
			this.setData({ loadingMore: false });
		}
	},

	async fetchPage(page, append) {
		const user = getApp().globalData.user;
		if (!user || !user.id) {
			this.setData({
				error: '请先登录后查看预约记录。',
				list: []
			});
			throw new Error('请先登录后查看预约记录。');
		}

		const res = await request({
			url: '/api/appointments',
			data: {
				userId: user.id,
				status: this.getStatusParam(),
				page,
				pageSize: this.data.pageSize
			}
		});

		const mappedList = (res.list || []).map(mapOrderItem);
		const nextList = append ? this.data.list.concat(mappedList) : mappedList;

		this.setData({
			list: nextList,
			page,
			hasMore: !!res.hasMore
		});
	},

	handleTabTap(event) {
		const { key } = event.currentTarget.dataset;
		if (key === undefined || key === null || String(key) === this.data.activeTab) {
			return;
		}

		this.setData({ activeTab: String(key) });
		this.loadOrderList();
 	},

	handleOrderTap(event) {
		const { orderId } = event.currentTarget.dataset;
		if (!orderId) {
			return;
		}

		wx.navigateTo({
			url: `/pages/order-detail/order-detail?orderId=${orderId}`
		});
	},

	async handleCancelTap(event) {
		const { orderId, status } = event.currentTarget.dataset;
		const user = getApp().globalData.user;

		if (!user || !user.id) {
			wx.showToast({
				title: '请先登录',
				icon: 'none'
			});
			return;
		}

		if (Number(status) !== 0) {
			wx.showToast({
				title: '仅预约中可取消',
				icon: 'none'
			});
			return;
		}

		if (!orderId || this.data.cancelingOrderId) {
			return;
		}

		this.setData({ cancelingOrderId: Number(orderId) });

		try {
			const res = await request({
				url: `/api/appointments/${Number(orderId)}/cancel`,
				method: 'POST',
				data: { userId: user.id }
			});

			wx.showToast({
				title: res.message || '取消成功',
				icon: 'none'
			});

			await this.loadOrderList();
		} catch (error) {
			wx.showToast({
				title: error.message || '取消失败',
				icon: 'none'
			});
		} finally {
			this.setData({ cancelingOrderId: 0 });
		}
	},

	handleReviewTap() {
		const event = arguments[0] || {};
		const dataset = (event.currentTarget && event.currentTarget.dataset) || {};
		const { status, orderId } = dataset;

		if (Number(status) !== 2) {
			wx.showToast({
				title: '仅已完成订单可评价',
				icon: 'none'
			});
			return;
		}

		wx.navigateTo({
			url: `/pages/review-list/review-list?orderId=${orderId || ''}`
		});
	}
});