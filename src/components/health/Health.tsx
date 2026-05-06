import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import {
  getOrCreateProfile, updateProfile, calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros,
  type Profile, type WeightRecord, type SleepRecord,
  getWeightRecords, addWeightRecord, getSleepRecords, addSleepRecord
} from '../../lib/db';
import dayjs from 'dayjs';

export default function HealthPage() {
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
    const wr = await getWeightRecords('desc');
    setWeightRecords(wr.reverse());
    const sr = await getSleepRecords(14);
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
    await addWeightRecord({ date: dayjs().format('YYYY-MM-DD'), weight: parseFloat(newWeight) });
    if (profile) await updateProfile({ ...profile, weight: parseFloat(newWeight) });
    setNewWeight('');
    await loadData();
  };

  const addSleep = async () => {
    const bed = dayjs(`2024-01-01 ${newSleep.bedTime}`);
    const wake = dayjs(`2024-01-02 ${newSleep.wakeTime}`);
    const diff = wake.diff(bed, 'minute');
    const duration = diff > 0 ? diff : diff + 24 * 60;
    await addSleepRecord({
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

  const bmr = profile ? calculateBMR(profile) : 0;
  const tdee = profile ? calculateTDEE(profile) : 0;
  const targetCal = profile ? calculateTargetCalories(profile) : 0;
  const macros = profile ? calculateMacros(profile) : null;

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
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = h - pad - p * (h - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          const y = h - pad - ((d.weight - min) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
        })}
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
            <div><label className="text-sm font-medium">身高 (cm)</label><Input type="number" value={profile?.height ?? ''} onChange={e => profile && setProfile({ ...profile, height: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">当前体重 (kg)</label><Input type="number" value={profile?.weight ?? ''} onChange={e => profile && setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">年龄</label><Input type="number" value={profile?.age ?? ''} onChange={e => profile && setProfile({ ...profile, age: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">性别</label>
              <select value={profile?.gender} onChange={e => profile && setProfile({ ...profile, gender: e.target.value as any })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">目标体重 (kg)</label><Input type="number" value={profile?.targetWeight ?? ''} onChange={e => profile && setProfile({ ...profile, targetWeight: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium">目标体脂 (%)</label><Input type="number" value={profile?.targetBodyFat ?? ''} onChange={e => profile && setProfile({ ...profile, targetBodyFat: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <Button onClick={saveProfile}>{saved ? '✅ 已保存' : '💾 保存档案'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">热量指标</CardTitle></CardHeader>
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
    </div>
  );
}
