import { fareCurrent, fareFinal } from './fares.ts';

function fareBJ(distance: number): number {
  if (distance <= 6) return 3;
  if (distance <= 12) return 4;
  if (distance <= 32) return 4 + Math.ceil((distance - 12) / 10);
  return 6 + Math.ceil((distance - 32) / 20);
}

function fareGSH(distance: number): number {
  if (distance <= 4) return 2;
  if (distance <= 12) return 2 + Math.ceil((distance - 4) / 4);
  if (distance <= 24) return 4 + Math.ceil((distance - 12) / 6);
  return 6 + Math.ceil((distance - 24) / 8);
}

function fareNJ(distance: number): number {
  let price = 2;
  let limit = 4;
  for (const step of [5, 5, 7, 7, 9, 11, 13, 15]) {
    if (distance <= limit) return price;
    limit += step;
    price += 1;
  }
  if (distance <= limit) return price;
  return price + Math.ceil((distance - limit) / 15);
}

function fareCDWH(distance: number): number {
  if (distance <= 24) return fareGSH(distance);
  if (distance <= 40) return 6 + Math.ceil((distance - 24) / 8);
  if (distance <= 50) return 8 + Math.ceil((distance - 40) / 10);
  return 9 + Math.ceil((distance - 50) / 20);
}

export const CITY_FARES = [
  { key: 'sh', name: '上海·老方案', short: '沪老方案', fn: fareCurrent, color: '#8a8a8a' },
  { key: 'shf', name: '上海·新方案', short: '沪新价', fn: fareFinal, color: '#c8102e' },
  { key: 'bj', name: '北京', short: '北京', fn: fareBJ, color: '#e6a23c' },
  { key: 'gsh', name: '广州 / 深圳 / 杭州', short: '穗深杭', fn: fareGSH, color: '#2e7d32' },
  { key: 'nj', name: '南京', short: '南京', fn: fareNJ, color: '#7b1fa2' },
  { key: 'cdwh', name: '成都 / 武汉', short: '蓉汉', fn: fareCDWH, color: '#00838f' },
] as const;

export const CITY_CARDS = [
  {
    name: '上海（2026 新方案）', color: '#c8102e',
    rule: '计程票制：起步 3 元可乘 4 公里；4–16 公里每 4 公里加 1 元，16–30 公里每 7 公里加 1 元，30–50 公里每 10 公里加 1 元，50–125 公里每 15 公里加 1 元。',
    meta: '优惠：月累计满 90 元后 9 折；计次票 35/45/60/90 次；一日票 24 元、三日票 60 元。2026-12-01 起执行；老方案（2005 版）与听证方案见「按乘距」页。',
    src: 'https://www.shanghai.gov.cn/nw4411/20260820/65c1be2474c345339c39a9ad9c724fdf.html', srcName: '上海市人民政府',
  },
  {
    name: '北京', color: '#e6a23c',
    rule: '计程限时票制（首都机场线、大兴机场线除外）：起步 6 公里（含）内 3 元；6–12 公里（含）4 元；12–22 公里（含）5 元；22–32 公里（含）6 元；32 公里以上每增加 20 公里加 1 元，票价不封顶。',
    meta: '优惠：一卡通每自然月累计满 100 元后 8 折、满 150 元后 5 折、满 400 元后不再打折（月底清零）；部分车站工作日 7 时前进站 5 折。',
    src: 'https://www.mtr.bj.cn/page/instructions.html', srcName: '京港地铁（票价方案原文）',
  },
  {
    name: '广州', color: '#2e7d32',
    rule: '里程分段计价、递远递减：起步 4 公里以内 2 元；4–12 公里每递增 4 公里加 1 元；12–24 公里每递增 6 公里加 1 元；24 公里以上每递增 8 公里加 1 元。APM 线单一票价 2 元。',
    meta: '优惠：同一羊城通卡/乘车码每自然月累计实付满 80 元不满 200 元部分 8 折、超 200 元部分 5 折（2023 年 9 月起，与公交合并累计）。2026 年内将举行票价机制优化听证。',
    src: 'https://www.gz.gov.cn/zwfw/zxfw/jtfw/content/post_10395580.html', srcName: '广州市人民政府',
  },
  {
    name: '深圳', color: '#2e7d32',
    rule: '里程分段计价、同网同价：起步 4 公里以内 2 元；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24 公里以上每 1 元可乘 8 公里（与广州、杭州公式一致）。',
    meta: '优惠：深圳通卡（含虚拟卡）普通车厢 9.5 折；90 分钟内公交↔地铁换乘每人次优惠 0.4 元。',
    src: 'https://www.sz.gov.cn/ztfw/jtly/wyc_184756/ggjtcx/csgdjtcx/content/post_7750833.html', srcName: '深圳政府在线',
  },
  {
    name: '杭州', color: '#2e7d32',
    rule: '计程票制：起步价 2 元可乘 4 公里；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24 公里以上每 1 元可乘 8 公里（与广州、深圳公式一致）。',
    meta: '优惠：储值卡/交通码每自然月累计消费 50 元以内 9 折、50（含）–100 元 7 折、100 元（含）以上 5 折（地铁公交合并累计）。',
    src: 'https://hwyst.hangzhou.com.cn/mtld/content/2023-05/11/content_8531793.htm', srcName: '杭州网（官方解答）',
  },
  {
    name: '南京', color: '#7b1fa2',
    rule: '里程分段计价：起步价 2 元可乘 4 公里；4 公里以上部分，每 1 元晋级里程依次为 5、5、7、7、9、11、13、15 公里（即 3 元至 9km、4 元至 14km……10 元至 76km；76km 以上官方未明示，本页按每 15km 加 1 元外推）。',
    meta: '优惠：储值卡月累计 150 元以下乘次 9.5 折；超 150 元后 9 折；超 200 元后 8 折；超 300 元后恢复 9.5 折。',
    src: 'https://www.njmetro.com.cn/njdtweb/portal/article-detail.do?rowId=4a8208ae7b6b11e9ac27000c2965e15a&columnId=40288e817180aad0017180ae38a40001&tag=infoopen3', srcName: '南京地铁（新闻发布会）',
  },
  {
    name: '成都', color: '#00838f',
    rule: '里程计价制：起步价 2 元可乘 4 公里；4–12 公里每递增 4 公里加 1 元；12–24 公里每递增 6 公里加 1 元；24–40 公里每递增 8 公里加 1 元；40–50 公里每递增 10 公里加 1 元；超过 50 公里每递增 20 公里加 1 元。',
    meta: '优惠：天府通卡/电子支付基本票价 9 折；每自然月单平台累计满 200 元后，自下次乘车起 6 折（各平台独立累计）。',
    src: 'https://sichuan.scol.com.cn/ggxw/202312/82437556.html', srcName: '四川在线（官方问政答复）',
  },
  {
    name: '武汉', color: '#00838f',
    rule: '里程限时计费：起步 2 元可乘 4 公里；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24–40 公里每 1 元可乘 8 公里；40–50 公里每 1 元可乘 10 公里；50 公里以上每 1 元可乘 20 公里（与成都公式一致）。进出闸限时 240 分钟。',
    meta: '优惠：武汉通卡 9 折；虚拟换乘车站 30 分钟内出站换乘连续计价。',
    src: 'https://www.wuhan.gov.cn/hdjl/rdhy/202410/t20241027_2474108.shtml', srcName: '武汉市人民政府',
  },
] as const;
