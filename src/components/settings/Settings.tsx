import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { db, getOrCreateProfile, updateProfile, calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros, type Profile, type WeightRecord, type SleepRecord } from '../../lib/db';
import dayjs from 'dayjs';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [newSleep, setNewSleep] = useState({ bedTime: '23:00', wakeTime: '07:00', quality: 3 as 1|2|3|4|5, note: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const p = await getOrCreateProfile();
    setProfile(p);
    const wr = await db.weightRecords.orderBy('date').reverse().toArray();
    setWeightRecords(wr.reverse());
    const sr = await db.sleepRecords.orderBy('date').reverse().limit(14).toArray();
    setSleepRecords(sr.reverse());
  }

  const saveProfile = async () => {
    if (!profile) return;
    await updateProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addWeight = async () => {
    if (!newWeight) return;
    await db.weightRecords.add({ date: dayjs().format('YYYY-MM-DD'), weight: parseFloat(newWeight) });
    if (profile) await updateProfile({ ...profile, weight: parseFloat(newWeight) });
    setNewWeight('');
    await loadData();
  };

  const addSleep = async () => {
    const bed = dayjs(`2024-01-01 ${newSleep.bedTime}`);
    const wake = dayjs(`2024-01-02 ${newSleep.wakeTime}`);
    const diff = wake.diff(bed, 'minute');
    const duration = diff > 0 ? diff : diff + 24 * 60;
    await db.sleepRecords.add({
      date: dayjs().format('YYYY-MM-DD'),
      bedTime: newSleep.bedTime,
      wakeTime: newSleep.wakeTime,
      duration,
      quality: newSleep.quality,
      note: newSleep.note,
    });
    setNewSleep({ bedTime: '23:00', wakeTime: '07:00', quality: 3, note: '' });
    await loadData();
  };

  const exportData = async () => {
    const data = {
      profile: await db.profile.toArray(),
      weightRecords: await db.weightRecords.toArray(),
      dailyPlans: await db.dailyPlans.toArray(),
      weeklyReviews: await db.weeklyReviews.toArray(),
      foodEntries: await db.foodEntries.toArray(),
      workoutLogs: await db.workoutLogs.toArray(),
      aiConversations: await db.aiConversations.toArray(),
      sleepRecords: await db.sleepRecords.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-tracker-backup-${dayjs().format('YYYY-MM-DD')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.profile) await db.profile.bulkPut(data.profile);
      if (data.weightRecords) await db.weightRecords.bulkPut(data.weightRecords);
      if (data.dailyPlans) await db.dailyPlans.bulkPut(data.dailyPlans);
      if (data.weeklyReviews) await db.weeklyReviews.bulkPut(data.weeklyReviews);
      if (data.foodEntries) await db.foodEntries.bulkPut(data.foodEntries);
      if (data.workoutLogs) await db.workoutLogs.bulkPut(data.workoutLogs);
      if (data.aiConversations) await db.aiConversations.bulkPut(data.aiConversations);
      if (data.sleepRecords) await db.sleepRecords.bulkPut(data.sleepRecords);
      alert('✅ 数据导入成功');
      await loadData();
    } catch {
      alert('❌ 导入失败，文件格式不正确');
    }
    e.target.value = '';
  };

  const clearAll = async () => {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) return;
    await db.delete();
    window.location.reload();
  };

  const bmr = profile ? calculateBMR(profile) : 0;
  const tdee = profile ? calculateTDEE(profile) : 0;
  const targetCal = profile ? calculateTargetCalories(profile) : 0;
  const macros = profile ? calculateMacros(profile) : null;

  // Weight line chart
  const weightChart = () => {
    if (weightRecords.length < 2) return <p className="text-muted-foreground text-center py-4">至少记录2天体重才能显示曲线</p>;
    const data = weightRecords.slice(-30);
    const min = Math.min(...data.map(w => w.weight));
    const max = Math.max(...data.map(w => w.weight));
    const range = max - min || 1;
    const w = 500;
    const h = 200;
    const pad = 30;
    const points = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((d.weight - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = h - pad - p * (h - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        {/* line */}
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {/* dots */}
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          const y = h - pad - ((d.weight - min) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
        })}
        {/* labels */}
        <text x={pad} y={h - 5} fontSize="10" fill="#9ca3af">{data[0]?.date.slice(5)}</text>
        <text x={w - pad - 30} y={h - 5} fontSize="10" fill="#9ca3af">{data[data.length - 1]?.date.slice(5)}</text>
        <text x={5} y={pad} fontSize="10" fill="#9ca3af">{max.toFixed(1)}</text>
        <text x={5} y={h - pad} fontSize="10" fill="#9ca3af">{min.toFixed(1)}</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 animate-in">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">身体档案</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">身高 (cm)</label><Input type="number" value={profile?.height || ''} onChange={e => profile && setProfile({ ...profile, height: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">当前体重 (kg)</label><Input type="number" value={profile?.weight || ''} onChange={e => profile && setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">年龄</label><Input type="number" value={profile?.age || ''} onChange={e => profile && setProfile({ ...profile, age: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">性别</label>
              <select value={profile?.gender} onChange={e => profile && setProfile({ ...profile, gender: e.target.value as any })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">目标体重 (kg)</label><Input type="number" value={profile?.targetWeight || ''} onChange={e => profile && setProfile({ ...profile, targetWeight: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">目标体脂 (%)</label><Input type="number" value={profile?.targetBodyFat || ''} onChange={e => profile && setProfile({ ...profile, targetBodyFat: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <Button onClick={saveProfile}>{saved ? '✅ 已保存' : '💾 保存档案'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">热量分析</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{bmr}</div><div className="text-muted-foreground">基础代谢</div></div>
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{tdee}</div><div className="text-muted-foreground">每日消耗</div></div>
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{targetCal}</div><div className="text-muted-foreground">目标摄入</div></div>
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{tdee - targetCal}</div><div className="text-muted-foreground">热量赤字</div></div>
          </div>
          {macros && (
            <div className="space-y-2">
              <div><div className="flex justify-between text-sm"><span>蛋白质 {macros.protein}g</span><span>{Math.round(macros.proteinKcal)} kcal</span></div><Progress value={macros.proteinKcal} max={macros.calories} /></div>
              <div><div className="flex justify-between text-sm"><span>碳水 {macros.carbs}g</span><span>{Math.round(macros.carbsKcal)} kcal</span></div><Progress value={macros.carbsKcal} max={macros.calories} /></div>
              <div><div className="flex justify-between text-sm"><span>脂肪 {macros.fat}g</span><span>{Math.round(macros.fatKcal)} kcal</span></div><Progress value={macros.fatKcal} max={macros.calories} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">体重变化曲线</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input type="number" step="0.1" placeholder="今日体重" value={newWeight} onChange={e => setNewWeight(e.target.value)} className="w-32" />
            <Button onClick={addWeight}>+ 记录</Button>
          </div>
          {weightChart()}
          <div className="space-y-1 max-h-32 overflow-y-auto mt-2">
            {weightRecords.slice(-10).map(w => (
              <div key={w.id} className="flex justify-between text-sm border-b py-1">
                <span>{w.date}</span>
                <span className="font-medium">{w.weight} kg</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">睡眠记录</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label className="text-xs text-muted-foreground">入睡时间</label><Input type="time" value={newSleep.bedTime} onChange={e => setNewSleep({ ...newSleep, bedTime: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">起床时间</label><Input type="time" value={newSleep.wakeTime} onChange={e => setNewSleep({ ...newSleep, wakeTime: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">质量 (1-5)</label>
              <select value={newSleep.quality} onChange={e => setNewSleep({ ...newSleep, quality: parseInt(e.target.value) as 1|2|3|4|5 })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={1}>1 - 很差</option>
                <option value={2}>2 - 较差</option>
                <option value={3}>3 - 一般</option>
                <option value={4}>4 - 较好</option>
                <option value={5}>5 - 很好</option>
              </select>
            </div>
            <div className="flex items-end"><Button onClick={addSleep} className="w-full">+ 记录睡眠</Button></div>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sleepRecords.map(s => (
              <div key={s.id} className="flex justify-between text-sm border-b py-1 items-center">
                <span>{s.date}</span>
                <span className="text-muted-foreground">{s.bedTime} → {s.wakeTime}</span>
                <span className="font-medium">{Math.floor(s.duration / 60)}h{s.duration % 60}m</span>
                <span>{'★'.repeat(s.quality)}{'☆'.repeat(5 - s.quality)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">数据可靠性说明</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>本应用使用浏览器 <strong>IndexedDB</strong> 本地存储数据，数据保存在当前设备的浏览器中。</p>
          <p><strong>数据不会自动同步到云端</strong>，换设备或清除浏览器数据会导致丢失。</p>
          <p><strong>可能丢失的场景：</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>清除浏览器缓存/Cookie/网站数据</li>
            <li>使用隐私模式/无痕浏览（关闭后数据自动清除）</li>
            <li>浏览器卸载或重装</li>
            <li>系统还原或重装</li>
            <li>磁盘空间不足时浏览器自动清理</li>
          </ul>
          <p className="text-amber-600 font-medium">⚠️ 建议每周点击「导出备份」保存 JSON 文件到本地或网盘。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">数据管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportData}>📤 导出备份</Button>
            <label className="inline-flex cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={importData} />
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">📥 导入数据</span>
            </label>
          </div>
          <Button variant="destructive" onClick={clearAll}>🗑️ 清空所有数据</Button>
        </CardContent>
      </Card>
    </div>
  );
}
