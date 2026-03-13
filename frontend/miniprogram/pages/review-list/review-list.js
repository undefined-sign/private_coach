const { request } = require('../../utils/request');

function formatDateText(value) {
	const raw = String(value || '');
	return raw.length >= 16 ? raw.slice(0, 16) : raw;
}

function mapReviewItem(item) {
	const rating = Number(item.rating || 0);
	return {
		...item,
		rating,
		starsText: '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating)),
		createdAtText: formatDateText(item.createdAt)
	};
}

Page({
	data: {
		loading: true,
		error: '',
		courseId: 0,
		courseName: '',
		orderId: 0,
		canReview: false,
		rating: 5,
		content: '',
		submitting: false,
		list: [],
		page: 1,
		pageSize: 10,
		hasMore: true,
		loadingMore: false
	},

	onLoad(options) {
		this.orderId = Number(options.orderId || 0);
		this.courseIdFromQuery = Number(options.courseId || 0);
	},

	onShow() {
		this.loadPageData();
	},

	onPullDownRefresh() {
		this.loadPageData().finally(() => {
			wx.stopPullDownRefresh();
		});
	},

	onReachBottom() {
		if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
			return;
		}
		this.loadMore();
	},

	async loadPageData() {
		this.setData({
			loading: true,
			error: '',
			list: [],
			page: 1,
			hasMore: true,
			canReview: false
		});

		try {
			await this.resolveContext();
			await this.fetchReviews(1, false);
		} catch (error) {
			this.setData({
				error: error.message || '加载评价失败'
			});
		} finally {
			this.setData({ loading: false });
		}
	},

	async resolveContext() {
		if (this.orderId) {
			const user = getApp().globalData.user;
			if (!user || !user.id) {
				throw new Error('请先登录后评价');
			}

			const orderRes = await request({
				url: `/api/appointments/${this.orderId}`,
				data: { userId: user.id }
			});

			const item = orderRes.item || {};
			this.setData({
				courseId: Number(item.courseId || 0),
				courseName: item.courseName || '',
				orderId: this.orderId,
				canReview: Number(item.status) === 2
			});
			return;
		}

		if (!this.courseIdFromQuery) {
			throw new Error('缺少课程参数');
		}

		const courseRes = await request({
			url: `/api/courses/${this.courseIdFromQuery}`
		});

		this.setData({
			courseId: this.courseIdFromQuery,
			courseName: (courseRes.item && courseRes.item.name) || '',
			orderId: 0,
			canReview: false
		});
	},

	async fetchReviews(page, append) {
		const courseId = Number(this.data.courseId || 0);
		if (!courseId) {
			throw new Error('课程信息无效');
		}

		const res = await request({
			url: '/api/reviews',
			data: {
				courseId,
				page,
				pageSize: this.data.pageSize
			}
		});

		const mappedList = (res.list || []).map(mapReviewItem);
		this.setData({
			list: append ? this.data.list.concat(mappedList) : mappedList,
			page,
			hasMore: !!res.hasMore
		});
	},

	async loadMore() {
		const nextPage = this.data.page + 1;
		this.setData({ loadingMore: true });

		try {
			await this.fetchReviews(nextPage, true);
		} catch (error) {
			wx.showToast({
				title: error.message || '加载更多失败',
				icon: 'none'
			});
		} finally {
			this.setData({ loadingMore: false });
		}
	},

	handleRatingTap(event) {
		const value = Number(event.currentTarget.dataset.value || 0);
		if (value < 1 || value > 5) {
			return;
		}
		this.setData({ rating: value });
	},

	handleContentInput(event) {
		this.setData({ content: String(event.detail.value || '') });
	},

	async handleSubmitReview() {
		if (!this.data.canReview) {
			wx.showToast({
				title: '仅已完成订单可评价',
				icon: 'none'
			});
			return;
		}

		const user = getApp().globalData.user;
		if (!user || !user.id) {
			wx.showToast({
				title: '请先登录',
				icon: 'none'
			});
			return;
		}

		const content = String(this.data.content || '').trim();
		if (!content) {
			wx.showToast({
				title: '请填写评价内容',
				icon: 'none'
			});
			return;
		}

		if (this.data.submitting) {
			return;
		}

		this.setData({ submitting: true });

		try {
			const res = await request({
				url: '/api/reviews',
				method: 'POST',
				data: {
					userId: user.id,
					orderId: this.data.orderId,
					rating: this.data.rating,
					content
				}
			});

			wx.showToast({
				title: res.message || '评价成功',
				icon: 'none'
			});

			this.setData({
				content: '',
				canReview: true
			});

			await this.fetchReviews(1, false);
		} catch (error) {
			wx.showToast({
				title: error.message || '评价失败',
				icon: 'none'
			});
		} finally {
			this.setData({ submitting: false });
		}
	}
});