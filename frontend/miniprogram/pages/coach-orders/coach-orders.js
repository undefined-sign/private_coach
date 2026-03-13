const { request } = require('../../utils/request');

const TABS = [
	{ key: '0', label: '正预约' },
	{ key: '2', label: '已完成' }
];

function formatTimeText(value) {
	const raw = String(value || '');
	const matched = raw.match(/^(\d{2}:\d{2})/);
	return matched ? matched[1] : raw;
}

function mapItem(item) {
	const dateText = String(item.date || '');
	const dateShort = dateText ? dateText.slice(5) : '--';
	const startTime = formatTimeText(item.startTime) || '--:--';
	const endTime = formatTimeText(item.endTime) || '--:--';
	const status = Number(item.status || 0);

	return {
		...item,
		slotText: `${dateShort} ${startTime}-${endTime}`,
		amountText: `¥${Number(item.amount || 0).toFixed(2)}`,
		statusText: status === 2 ? '已完成' : '预约中',
		statusClass: status === 2 ? 'status-done' : 'status-pending'
	};
}

Page({
	data: {
		loading: true,
		error: '',
		tabs: TABS,
		activeTab: '0',
		list: [],
		page: 1,
		pageSize: 10,
		hasMore: true,
		loadingMore: false,
		completingId: 0
	},

	onShow() {
		this.loadList(this.data.activeTab);
	},

	onPullDownRefresh() {
		this.loadList(this.data.activeTab).finally(() => {
			wx.stopPullDownRefresh();
		});
	},

	onReachBottom() {
		if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
			return;
		}
		this.loadMore();
	},

	async loadList(statusKey) {
		const activeTab = String(statusKey || this.data.activeTab || '0');
		this.setData({
			loading: true,
			error: '',
			activeTab,
			list: [],
			page: 1,
			hasMore: true
		});

		try {
			await this.fetchPage(1, false, activeTab);
		} catch (error) {
			this.setData({ error: error.message || '加载订单失败' });
		} finally {
			this.setData({ loading: false });
		}
	},

	async loadMore() {
		const nextPage = this.data.page + 1;
		this.setData({ loadingMore: true });

		try {
			await this.fetchPage(nextPage, true, this.data.activeTab);
		} catch (error) {
			wx.showToast({ title: error.message || '加载更多失败', icon: 'none' });
		} finally {
			this.setData({ loadingMore: false });
		}
	},

	async fetchPage(page, append, statusKey) {
		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			throw new Error('请使用教练账号登录');
		}

		const status = String(statusKey || this.data.activeTab || '0');

		const res = await request({
			url: '/api/appointments/coach',
			method: 'GET',
			data: {
				userId: user.id,
				status,
				page,
				pageSize: this.data.pageSize
			}
		});

		const mapped = (res.list || []).map(mapItem);
		const nextList = append ? this.data.list.concat(mapped) : mapped;

		this.setData({
			list: nextList,
			page,
			hasMore: !!res.hasMore
		});
	},

	handleTabTap(event) {
		const key = String(event.currentTarget.dataset.key || '0');
		if (key === this.data.activeTab) {
			return;
		}
		this.loadList(key);
	},

	async handleCompleteTap(event) {
		const orderId = Number(event.currentTarget.dataset.orderId || 0);
		const status = Number(event.currentTarget.dataset.status || 0);
		const user = getApp().globalData.user;

		if (!orderId || !user || !user.id) {
			return;
		}

		if (status !== 0) {
			wx.showToast({ title: '仅正预约可确认完成', icon: 'none' });
			return;
		}

		if (this.data.completingId) {
			return;
		}

		const modalRes = await new Promise((resolve) => {
			wx.showModal({
				title: '确认完成',
				content: '确认将该订单标记为已完成吗？',
				confirmColor: '#1f6fff',
				success: resolve,
				fail: () => resolve({ confirm: false })
			});
		});

		if (!modalRes.confirm) {
			return;
		}

		this.setData({ completingId: orderId });
		try {
			const res = await request({
				url: `/api/appointments/${orderId}/complete`,
				method: 'POST',
				data: { userId: user.id }
			});

			wx.showToast({ title: res.message || '已确认完成', icon: 'success' });
			await this.loadList(this.data.activeTab);
		} catch (error) {
			wx.showToast({ title: error.message || '确认失败', icon: 'none' });
		} finally {
			this.setData({ completingId: 0 });
		}
	}
});