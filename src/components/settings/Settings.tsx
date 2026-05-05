import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
// import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { db, getOrCreateProfile, updateProfile, calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros, type Profile, type WeightRecord } from '../../lib/db';
import dayjs from 'dayjs';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const p = await getOrCreateProfile();
    setProfile(p);
    const wr = await db.weightRecords.orderBy('date').reverse().toArray();
    setWeightRecords(wr);
  }

  const saveProfile = async () => {
    if (!profile) return;
    await updateProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addWeight = async () => {
    if (!newWeight) return;
    await db.weightRecords.add({
      date: dayjs().format('YYYY-MM-DD'),
      weight: parseFloat(newWeight),
    });
    if (profile) {
      await updateProfile({ ...profile, weight: parseFloat(newWeight) });
    }
    setNewWeight('');
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
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{bmr}</div><div className="text-muted-foreground">基础代谢 (BMR)</div></div>
            <div className="bg-muted rounded-lg p-3 text-center"><div className="text-lg font-bold">{tdee}</div><div className="text-muted-foreground">每日消耗 (TDEE)</div></div>
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
        <CardHeader className="pb-3"><CardTitle className="text-lg">体重记录</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input type="number" step="0.1" placeholder="今日体重" value={newWeight} onChange={e => setNewWeight(e.target.value)} className="w-32" />
            <Button onClick={addWeight}>+ 记录</Button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {weightRecords.map(w => (
              <div key={w.id} className="flex justify-between text-sm border-b py-1">
                <span>{w.date}</span>
                <span className="font-medium">{w.weight} kg</span>
              </div>
            ))}
          </div>
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
