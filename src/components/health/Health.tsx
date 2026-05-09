import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import {
  getOrCreateProfile, updateProfile, calculateBMR, calculateMacros,
  type Profile, type WeightRecord, type SleepRecord,
  getWeightRecords, addWeightRecord, getSleepRecords, addSleepRecord, deleteSleepRecord, updateSleepRecord,
  getFoodEntries, getWorkoutLog
} from '../../lib/db';
import type { WorkoutLog } from '../../types';
import { useRegisterSave } from '../../hooks/useTabGuard';
import SaveIndicator from '../ui/SaveIndicator';
import { SkeletonCard } from '../ui/SkeletonCard';
import dayjs from 'dayjs';

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let cardioTotal = 0;
  for (const ex of w.exercises) {
    if (ex.kind === 'cardio' && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      cardioTotal += mets * weightKg * (duration / 60);
    }
  }
  const cardioDuration = w.exercises.filter(e => e.kind === 'cardio').reduce((sum, e) => sum + (e.cardioParams?.duration || 0), 0);
  const strengthDuration = Math.max(0, (w.duration || 0) - cardioDuration);
  const strengthTotal = strengthDuration > 0 ? 4.5 * weightKg * (strengthDuration / 60) : 0;
  return Math.round(cardioTotal + strengthTotal);
}

export default function HealthPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [sleepDate, setSleepDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [newSleep, setNewSleep] = useState({ bedTime: '23:00', wakeTime: '07:00', quality: 3 as 1|2|3|4|5, note: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [editingSleepId, setEditingSleepId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Today real-time data
  const [todayIntake, setTodayIntake] = useState(0);
  const [todayBurn, setTodayBurn] = useState(0);

  useRegisterSave('health', async function () {
    if (profile) await updateProfile(profile);
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoaded(false);
    const p = await getOrCreateProfile();
    setProfile(p);
    const wr = await getWeightRecords('desc');
    setWeightRecords(wr.reverse());
    const sr = await getSleepRecords(14);
    setSleepRecords(sr.reverse());
    const today = dayjs().format('YYYY-MM-DD');
    const [foods, workout] = await Promise.all([getFoodEntries(today), getWorkoutLog(today)]);
    const intake = foods.reduce((s, e) => s + e.calories, 0);
    setTodayIntake(intake);
    const burn = workout ? calcWorkoutBurn(workout, p.weight) : 0;
    setTodayBurn(burn);
    setLoaded(true);
  }

  const saveProfile = async () => {
    if (!profile) return;
    setSaveStatus('saving');
    try {
      await updateProfile(profile);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

  const addWeight = async () => {
    if (!newWeight) return;
    await addWeightRecord({ date: dayjs().format('YYYY-MM-DD'), weight: parseFloat(newWeight) });
    if (profile) await updateProfile({ ...profile, weight: parseFloat(newWeight) });
    setNewWeight('');
    await loadData();
  };

  const addSleep = async () => {
    const bedMin = parseInt(newSleep.bedTime.split(':')[0]) * 60 + parseInt(newSleep.bedTime.split(':')[1]);
    const wakeMin = parseInt(newSleep.wakeTime.split(':')[0]) * 60 + parseInt(newSleep.wakeTime.split(':')[1]);
    const bed = dayjs(`${sleepDate} ${newSleep.bedTime}`);
    const wake = bedMin < wakeMin ? dayjs(`${sleepDate} ${newSleep.wakeTime}`) : dayjs(`${sleepDate} ${newSleep.wakeTime}`).add(1, 'day');
    const duration = wake.diff(bed, 'minute');
    if (editingSleepId) {
      await updateSleepRecord({ id: editingSleepId, date: sleepDate, bedTime: newSleep.bedTime, wakeTime: newSleep.wakeTime, duration, quality: newSleep.quality, note: newSleep.note });
      setEditingSleepId(null);
    } else {
      await addSleepRecord({ date: sleepDate, bedTime: newSleep.bedTime, wakeTime: newSleep.wakeTime, duration, quality: newSleep.quality, note: newSleep.note });
    }
    setNewSleep({ bedTime: '23:00', wakeTime: '07:00', quality: 3, note: '' });
    await loadData();
  };

  const editSleep = (s: SleepRecord) => {
    setSleepDate(s.date);
    setNewSleep({ bedTime: s.bedTime, wakeTime: s.wakeTime, quality: s.quality, note: s.note || '' });
    setEditingSleepId(s.id || null);
  };

  const removeSleep = async (id: number) => {
    if (!confirm('确定删除此睡眠记录？')) return;
    await deleteSleepRecord(id);
    await loadData();
  };

  const bmr = profile ? calculateBMR(profile) : 0;
  const totalBurn = todayBurn + bmr;
  const deficit = totalBurn - todayIntake;
  const macros = profile ? calculateMacros(profile) : null;
  const targetCal = macros?.calories || 1900;

  const weightChart = () => {
    if (weightRecords.length < 2) return <p className="text-muted-foreground text-center py-4">至少记录2天体重才能显示曲线</p>;
    const data = weightRecords.slice(-30);
    const min = Math.min(...data.map(w => w.weight));
    const max = Math.max(...data.map(w => w.weight));
    const range = max - min || 1;
    const w = 500, h = 200, pad = 30;
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
      {!loaded ? <SkeletonCard /> : (<>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">今日热量实时数据</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{todayIntake}</div>
              <div className="text-muted-foreground text-xs">已摄入 / {targetCal} kcal</div>
              <Progress value={todayIntake} max={targetCal} />
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-600">{totalBurn}</div>
              <div className="text-muted-foreground text-xs">已消耗 (运动{todayBurn}+BMR{bmr})</div>
            </div>
            <div className={`${deficit >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-3 text-center`}>
              <div className={`text-lg font-bold ${deficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {deficit >= 0 ? '+' : ''}{deficit}
              </div>
              <div className="text-muted-foreground text-xs">{deficit >= 0 ? '热量赤字' : '热量盈余'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <SaveIndicator status={saveStatus} onSave={saveProfile} />
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
          <div className="flex gap-2 mb-2">
            <Input type="date" value={sleepDate} onChange={e => setSleepDate(e.target.value)} className="w-auto h-9" />
          </div>
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
            <div className="flex items-end gap-1">
              <Button onClick={addSleep} className="flex-1">{editingSleepId ? '💾 更新' : '+ 记录睡眠'}</Button>
              {editingSleepId && <Button variant="outline" onClick={() => { setEditingSleepId(null); setNewSleep({ bedTime: '23:00', wakeTime: '07:00', quality: 3, note: '' }); }}>取消</Button>}
            </div>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sleepRecords.map(s => (
              <div key={s.id} className="flex justify-between text-sm border-b py-1 items-center">
                <span className="min-w-[70px]">{s.date}</span>
                <span className="text-muted-foreground">{s.bedTime} → {s.wakeTime}</span>
                <span className="font-medium">{Math.floor(s.duration / 60)}h{s.duration % 60}m</span>
                <span>{'★'.repeat(s.quality)}{'☆'.repeat(5 - s.quality)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => editSleep(s)}>✏️</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeSleep(s.id!)}>🗑️</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </>)}
    </div>
  );
}
