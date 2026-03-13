const { request } = require('../../utils/request');

function mapReviewItem(item) {
	const rating = Number(item.rating || 0);
	return {
		...item,
		rating,
		starsText: '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating)),
		createdAtText: String(item.createdAt || '')
	};
}

Page({
	data: {
		loading: true,
		error: '',
		list: [],
		page: 1,
		pageSize: 10,
		hasMore: true,
		loadingMore: false,
		deletingId: 0
	},

	onShow() {
		this.loadReviews();
	},

	onPullDownRefresh() {
		this.loadReviews().finally(() => {
			wx.stopPullDownRefresh();
		});
	},

	onReachBottom() {
		if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
			return;
		}
		this.loadMore();
	},

	async loadReviews() {
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
			this.setData({ error: error.message || '加载评价失败' });
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
			wx.showToast({ title: error.message || '加载更多失败', icon: 'none' });
		} finally {
			this.setData({ loadingMore: false });
		}
	},

	async fetchPage(page, append) {
		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			throw new Error('请使用教练账号登录');
		}

		const res = await request({
			url: '/api/reviews/coach',
			method: 'GET',
			data: {
				userId: user.id,
				page,
				pageSize: this.data.pageSize
			}
		});

		const mapped = (res.list || []).map(mapReviewItem);
		this.setData({
			list: append ? this.data.list.concat(mapped) : mapped,
			page,
			hasMore: !!res.hasMore
		});
	},

	async handleDeleteTap(event) {
		const reviewId = Number(event.currentTarget.dataset.reviewId || 0);
		if (!reviewId || this.data.deletingId) {
			return;
		}

		const user = getApp().globalData.user;
		if (!user || !user.id || Number(user.role) !== 1) {
			wx.showToast({ title: '请使用教练账号登录', icon: 'none' });
			return;
		}

		const modalRes = await new Promise((resolve) => {
			wx.showModal({
				title: '删除评价',
				content: '删除后该评价将不再展示，确认删除吗？',
				confirmColor: '#d55668',
				success: resolve,
				fail: () => resolve({ confirm: false })
			});
		});

		if (!modalRes.confirm) {
			return;
		}

		this.setData({ deletingId: reviewId });
		try {
			const res = await request({
				url: `/api/reviews/${reviewId}`,
				method: 'DELETE',
				data: { userId: user.id }
			});

			wx.showToast({ title: res.message || '删除成功', icon: 'success' });
			await this.loadReviews();
		} catch (error) {
			wx.showToast({ title: error.message || '删除失败', icon: 'none' });
		} finally {
			this.setData({ deletingId: 0 });
		}
	}
});