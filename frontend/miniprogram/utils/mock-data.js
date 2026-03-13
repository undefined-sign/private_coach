const coaches = [
  {
    id: 1,
    name: '林教练',
    avatarText: '林',
    specialties: ['减脂塑形', '体态纠正'],
    experience: '6年经验'
  },
  {
    id: 2,
    name: '周教练',
    avatarText: '周',
    specialties: ['力量训练', '增肌计划'],
    experience: '8年经验'
  },
  {
    id: 3,
    name: '陈教练',
    avatarText: '陈',
    specialties: ['普拉提', '康复训练'],
    experience: '5年经验'
  }
];

const courses = [
  {
    id: 101,
    coachId: 1,
    name: '燃脂基础课',
    intro: '适合健身入门，强化心肺与基础力量。',
    level: '初级',
    duration: 60
  },
  {
    id: 102,
    coachId: 2,
    name: '力量提升课',
    intro: '系统化提升深蹲、硬拉、卧推表现。',
    level: '中级',
    duration: 75
  },
  {
    id: 103,
    coachId: 3,
    name: '核心稳定课',
    intro: '改善核心控制与腰背稳定，缓解久坐不适。',
    level: '初级',
    duration: 50
  },
  {
    id: 104,
    coachId: 1,
    name: 'HIIT 间歇课',
    intro: '高效燃脂，训练节奏快，运动体验强。',
    level: '进阶',
    duration: 45
  },
  {
    id: 105,
    coachId: 2,
    name: '增肌分化课',
    intro: '按肌群分化训练，增强肌肉质量和围度。',
    level: '进阶',
    duration: 70
  },
  {
    id: 106,
    coachId: 3,
    name: '拉伸放松课',
    intro: '改善柔韧性与关节活动度，提升恢复效率。',
    level: '初级',
    duration: 40
  }
];

function getCoachById(coachId) {
  return coaches.find((coach) => coach.id === Number(coachId));
}

function getCoursesByCoachId(coachId) {
  return courses.filter((course) => course.coachId === Number(coachId));
}

module.exports = {
  coaches,
  courses,
  getCoachById,
  getCoursesByCoachId
};
