export interface RoutePlan {
  button?: string;
  summary: string;
  via: string[];
  lines: string[];
  hops: number[];
  firstLegStations?: string[];
}

export interface RouteCase {
  from: string;
  to: string;
  oldFare: number;
  newFare: number;
  estimate?: string;
  plans: RoutePlan[];
}

export const routeCases: Record<'direct' | 'transfer' | 'branch' | 'long' | 'missing', RouteCase> = {
  direct: {
    from: '龙华', to: '东方体育中心', oldFare: 3, newFare: 3,
    plans: [{
      summary: '约 10 分钟 · 无需换乘 · 计价里程约 4.0 公里',
      via: [], lines: ['11号线'], hops: [3],
      firstLegStations: ['龙华', '云锦路', '龙耀路', '东方体育中心'],
    }],
  },
  transfer: {
    from: '人民广场', to: '迪士尼', oldFare: 5, newFare: 8,
    plans: [{
      button: '推荐一（1 次换乘）', summary: '约 53 分钟 · 换乘 1 次 · 计价里程约 25.8 公里',
      via: ['东方体育中心'], lines: ['8号线', '11号线'], hops: [9, 9],
    }, {
      button: '推荐二（2 次换乘）', summary: '约 49 分钟 · 换乘 2 次 · 计价里程约 25.8 公里',
      via: ['龙阳路', '罗山路'], lines: ['2号线', '16号线', '11号线'], hops: [7, 2, 3],
    }],
  },
  branch: {
    from: '马陆', to: '上海赛车场', oldFare: 3, newFare: 4,
    plans: [{
      summary: '约 10 分钟 · 无需换乘 · 计价里程约 6.0 公里',
      via: [], lines: ['11号线'], hops: [2], firstLegStations: ['马陆', '嘉定新城', '上海赛车场'],
    }],
  },
  long: {
    from: '滴水湖', to: '西岑', oldFare: 15, newFare: 15,
    plans: [{
      button: '推荐一（2 次换乘）', summary: '约 167 分钟 · 换乘 2 次 · 计价里程约 123.5 公里',
      via: ['龙阳路', '虹桥火车站'], lines: ['16号线', '2号线', '17号线'], hops: [12, 17, 13],
    }, {
      button: '推荐二（3 次换乘）', summary: '约 163 分钟 · 换乘 3 次 · 计价里程约 123.5 公里',
      via: ['罗山路', '交通大学', '虹桥火车站'], lines: ['16号线', '11号线', '10号线', '17号线'], hops: [10, 12, 9, 13],
    }],
  },
  missing: {
    from: '川沙', to: '浦东3号航站楼', oldFare: 5, newFare: 7,
    estimate: '估算：17.48 公里 · 6 站',
    plans: [{
      summary: '以下为按站间距推算的里程与规则票价，仅供参考',
      via: [], lines: ['2号线'], hops: [5],
      firstLegStations: ['川沙', '凌空路', '远东大道', '海天三路', '浦东1号2号航站楼', '浦东3号航站楼'],
    }],
  },
};
