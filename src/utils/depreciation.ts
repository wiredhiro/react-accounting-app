import type { FixedAsset, DepreciationSchedule } from '../types/fixedAsset';

// 定率法の償却率（2012年4月1日以後取得分 - 200%定率法）
// 参考: 国税庁の耐用年数表
const decliningBalanceRates: Record<number, number> = {
  2: 1.000,
  3: 0.667,
  4: 0.500,
  5: 0.400,
  6: 0.333,
  7: 0.286,
  8: 0.250,
  9: 0.222,
  10: 0.200,
  11: 0.182,
  12: 0.167,
  13: 0.154,
  14: 0.143,
  15: 0.133,
  16: 0.125,
  17: 0.118,
  18: 0.111,
  19: 0.105,
  20: 0.100,
  22: 0.091,
  24: 0.083,
  25: 0.080,
  30: 0.067,
  33: 0.061,
  35: 0.057,
  38: 0.053,
  40: 0.050,
  45: 0.044,
  47: 0.043,
  50: 0.040,
};

// 保証率（改定償却率への切り替え判定用）
const guaranteeRates: Record<number, number> = {
  2: 0.000,
  3: 0.11089,
  4: 0.12499,
  5: 0.10800,
  6: 0.09911,
  7: 0.08680,
  8: 0.07909,
  9: 0.07126,
  10: 0.06552,
  11: 0.05992,
  12: 0.05566,
  13: 0.05180,
  14: 0.04854,
  15: 0.04565,
  16: 0.04294,
  17: 0.04038,
  18: 0.03884,
  19: 0.03693,
  20: 0.03486,
};

// 改定償却率
const revisedRates: Record<number, number> = {
  2: 0.000,
  3: 1.000,
  4: 1.000,
  5: 0.500,
  6: 0.334,
  7: 0.334,
  8: 0.334,
  9: 0.250,
  10: 0.250,
  11: 0.200,
  12: 0.200,
  13: 0.167,
  14: 0.167,
  15: 0.143,
  16: 0.143,
  17: 0.125,
  18: 0.112,
  19: 0.112,
  20: 0.100,
};

// 定率法の償却率を取得
function getDecliningBalanceRate(usefulLife: number): number {
  return decliningBalanceRates[usefulLife] || (2 / usefulLife);
}

// 保証率を取得
function getGuaranteeRate(usefulLife: number): number {
  return guaranteeRates[usefulLife] || 0.05;
}

// 改定償却率を取得
function getRevisedRate(usefulLife: number): number {
  return revisedRates[usefulLife] || (1 / usefulLife);
}

// 日付をYYYY-MM-DD形式でフォーマット
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 2つの日付間の月数を計算
function getMonthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();

  // 日付による調整（開始日の日が終了日の日より大きい場合は1か月減らす）
  if (end.getDate() < start.getDate()) {
    months--;
  }

  return Math.max(0, months + 1); // 1か月未満でも1か月として計算
}

// 会計年度内の償却月数を計算
function getDepreciationMonths(
  acquisitionDate: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  isDisposed: boolean,
  disposalDate?: string
): number {
  const acqDate = new Date(acquisitionDate);
  const fyStart = new Date(fiscalYearStart);
  const fyEnd = new Date(fiscalYearEnd);

  // 取得前の年度は0ヶ月
  if (acqDate > fyEnd) {
    return 0;
  }

  // 償却開始日を決定（取得日の翌月から、または年度開始日から）
  let depreciationStart: Date;
  if (acqDate < fyStart) {
    depreciationStart = fyStart;
  } else {
    // 取得月の翌月から償却開始（月の途中で取得した場合）
    depreciationStart = new Date(acqDate.getFullYear(), acqDate.getMonth() + 1, 1);
  }

  // 償却終了日を決定
  let depreciationEnd: Date;
  if (isDisposed && disposalDate) {
    const dispDate = new Date(disposalDate);
    if (dispDate < fyStart) {
      return 0; // 除却済み
    }
    depreciationEnd = dispDate < fyEnd ? dispDate : fyEnd;
  } else {
    depreciationEnd = fyEnd;
  }

  if (depreciationStart > depreciationEnd) {
    return 0;
  }

  // 月数を計算
  let months = (depreciationEnd.getFullYear() - depreciationStart.getFullYear()) * 12;
  months += depreciationEnd.getMonth() - depreciationStart.getMonth() + 1;

  return Math.min(12, Math.max(0, months));
}

// 定額法による償却額を計算
function calculateStraightLineDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  months: number
): number {
  const annualDepreciation = (acquisitionCost - residualValue) / usefulLife;
  return Math.round(annualDepreciation * months / 12);
}

// 定率法による償却額を計算
function calculateDecliningBalanceDepreciation(
  acquisitionCost: number,
  beginningBookValue: number,
  usefulLife: number,
  months: number
): number {
  const rate = getDecliningBalanceRate(usefulLife);
  const guaranteeRate = getGuaranteeRate(usefulLife);
  const revisedRate = getRevisedRate(usefulLife);
  const guaranteeAmount = acquisitionCost * guaranteeRate;

  let annualDepreciation: number;

  // 償却額が償却保証額を下回る場合は改定償却率を使用
  const normalDepreciation = beginningBookValue * rate;
  if (normalDepreciation < guaranteeAmount) {
    annualDepreciation = beginningBookValue * revisedRate;
  } else {
    annualDepreciation = normalDepreciation;
  }

  // 月割り計算
  const monthlyDepreciation = Math.round(annualDepreciation * months / 12);

  // 備忘価額（1円）まで償却
  const remainingValue = beginningBookValue - monthlyDepreciation;
  if (remainingValue < 1) {
    return Math.max(0, beginningBookValue - 1);
  }

  return monthlyDepreciation;
}

// 減価償却スケジュールを計算
export function calculateDepreciationSchedule(
  asset: FixedAsset,
  fiscalYearStart: string, // YYYY-MM-DD形式
  numberOfYears: number = 10
): DepreciationSchedule[] {
  const schedules: DepreciationSchedule[] = [];

  // 会計年度開始日から年・月・日を取得
  const [, fyStartMonth, fyStartDay] = fiscalYearStart.split('-').map(Number);

  // 取得日から開始年度を計算
  const acqDate = new Date(asset.acquisitionDate);
  let currentYear = acqDate.getFullYear();

  // 取得日が会計年度開始日より前なら前年度から開始
  const acqMonth = acqDate.getMonth() + 1;
  const acqDay = acqDate.getDate();
  if (acqMonth < fyStartMonth || (acqMonth === fyStartMonth && acqDay < fyStartDay)) {
    currentYear--;
  }

  let accumulatedDepreciation = 0;
  let beginningBookValue = asset.acquisitionCost;

  for (let i = 0; i < numberOfYears; i++) {
    const yearStart = `${currentYear}-${String(fyStartMonth).padStart(2, '0')}-${String(fyStartDay).padStart(2, '0')}`;

    // 年度終了日を計算（翌年の開始日の前日）
    const endDate = new Date(currentYear + 1, fyStartMonth - 1, fyStartDay - 1);
    const yearEnd = formatDate(endDate);

    // 備忘価額（1円）に達したら終了
    if (beginningBookValue <= 1) {
      break;
    }

    // 除却済みで、除却日がこの年度より前なら終了
    if (asset.isDisposed && asset.disposalDate && asset.disposalDate < yearStart) {
      break;
    }

    // 償却月数を計算
    const months = getDepreciationMonths(
      asset.acquisitionDate,
      yearStart,
      yearEnd,
      asset.isDisposed,
      asset.disposalDate
    );

    if (months === 0 && i > 0) {
      currentYear++;
      continue;
    }

    // 償却額を計算
    let depreciationAmount: number;
    if (asset.depreciationMethod === 'straight_line') {
      depreciationAmount = calculateStraightLineDepreciation(
        asset.acquisitionCost,
        asset.residualValue,
        asset.usefulLife,
        months
      );
    } else {
      depreciationAmount = calculateDecliningBalanceDepreciation(
        asset.acquisitionCost,
        beginningBookValue,
        asset.usefulLife,
        months
      );
    }

    // 備忘価額（1円）を確保
    if (beginningBookValue - depreciationAmount < 1) {
      depreciationAmount = beginningBookValue - 1;
    }

    accumulatedDepreciation += depreciationAmount;
    const endingBookValue = beginningBookValue - depreciationAmount;

    schedules.push({
      fiscalYear: currentYear,
      yearStartDate: yearStart,
      yearEndDate: yearEnd,
      beginningBookValue,
      depreciationAmount,
      accumulatedDepreciation,
      endingBookValue,
      months,
    });

    beginningBookValue = endingBookValue;
    currentYear++;

    // 除却済みの場合、除却年度で終了
    if (asset.isDisposed && asset.disposalDate && asset.disposalDate <= yearEnd) {
      break;
    }
  }

  return schedules;
}

// 現在の帳簿価額を計算
export function calculateCurrentBookValue(
  asset: FixedAsset,
  fiscalYearStart: string,
  asOfDate: string
): number {
  const schedules = calculateDepreciationSchedule(asset, fiscalYearStart, 50);

  // 指定日時点での帳簿価額を取得
  for (const schedule of schedules) {
    if (asOfDate >= schedule.yearStartDate && asOfDate <= schedule.yearEndDate) {
      // 当期中の場合、月割りで計算
      const monthsElapsed = getMonthsBetween(schedule.yearStartDate, asOfDate);
      const monthlyDepreciation = schedule.depreciationAmount / schedule.months;
      const partialDepreciation = Math.round(monthlyDepreciation * monthsElapsed);
      return schedule.beginningBookValue - partialDepreciation;
    }
    if (asOfDate < schedule.yearStartDate) {
      return schedule.beginningBookValue;
    }
  }

  // 償却完了後
  const lastSchedule = schedules[schedules.length - 1];
  return lastSchedule ? lastSchedule.endingBookValue : asset.residualValue;
}

// 当期の償却額を取得
export function getCurrentYearDepreciation(
  asset: FixedAsset,
  fiscalYearStart: string,
  fiscalYear: number
): number {
  const schedules = calculateDepreciationSchedule(asset, fiscalYearStart, 50);
  const schedule = schedules.find((s) => s.fiscalYear === fiscalYear);
  return schedule ? schedule.depreciationAmount : 0;
}

// 累計償却額を取得
export function getAccumulatedDepreciation(
  asset: FixedAsset,
  fiscalYearStart: string,
  asOfFiscalYear: number
): number {
  const schedules = calculateDepreciationSchedule(asset, fiscalYearStart, 50);
  const schedule = schedules.find((s) => s.fiscalYear === asOfFiscalYear);
  return schedule ? schedule.accumulatedDepreciation : 0;
}
