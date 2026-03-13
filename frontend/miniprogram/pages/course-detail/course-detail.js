const { request } = require('../../utils/request');

Page({
	data: {
		loading: true,
		error: '',
		coach: null,
		courses: []
	},

	onLoad(options) {
		this.coachId = Number(options.coachId || 0);
		this.loadCoachCourses();
	},

	async loadCoachCourses() {
		if (!this.coachId) {
			this.setData({
				loading: false,
				error: '缺少教练参数，请返回首页重新进入。'
			});
			return;
		}

		this.setData({ loading: true, error: '' });

		try {
			const [coachRes, courseRes] = await Promise.all([
				request({ url: `/api/coaches/${this.coachId}` }),
				request({ url: `/api/coaches/${this.coachId}/courses` })
			]);

			this.setData({
				loading: false,
				coach: coachRes.item,
				courses: courseRes.list || []
			});
		} catch (error) {
			this.setData({
				loading: false,
				error: error.message || '未找到该教练信息，请返回首页重试。'
			});
		}
	},

	handleCourseTap(event) {
		const { courseId } = event.currentTarget.dataset;
		wx.navigateTo({
			url: `/pages/schedule/schedule?courseId=${courseId}&coachId=${this.coachId}`
		});
	},

	handleReviewListTap(event) {
		const { courseId } = event.currentTarget.dataset;
		if (!courseId) {
			return;
		}

		wx.navigateTo({
			url: `/pages/review-list/review-list?courseId=${courseId}`
		});
	}
});