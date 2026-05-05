import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { WORKOUT_PRESETS } from '../../data/presets';
import { db } from '../../lib/db';
import type { WorkoutLog } from '../../types';
import dayjs from 'dayjs';

export default function FitnessPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('push');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadLog();
  }, [date]);

  async function loadLog() {
    const existing = await db.workoutLogs.where('date').equals(date).first();
    if (existing) {
      setLog(existing);
      setSelectedPreset(existing.type);
    } else {
      const preset = WORKOUT_PRESETS.find(p => p.type === selectedPreset);
      setLog({
        date,
        type: selectedPreset as any,
        exercises: preset?.exercises.map((e: {name: string, sets: number}) => ({ name: e.name, sets: Array(e.sets).fill({ reps: 0, weight: 0 }) })) || [],
        duration: 60,
        notes: '',
      });
    }
  }

  const applyPreset = (type: string) => {
    setSelectedPreset(type);
    const preset = WORKOUT_PRESETS.find(p => p.type === type);
    setLog({
      date,
      type: type as any,
      exercises: preset?.exercises.map(e => ({ name: e.name, sets: Array(e.sets).fill({ reps: 0, weight: 0 }) })) || [],
      duration: 60,
      notes: '',
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight', val: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], sets: [...exercises[exIdx].sets] };
    exercises[exIdx].sets[setIdx] = { ...exercises[exIdx].sets[setIdx], [field]: val };
    setLog({ ...log, exercises });
  };

  const addSet = (exIdx: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], sets: [...exercises[exIdx].sets, { reps: 0, weight: 0 }] };
    setLog({ ...log, exercises });
  };

  const save = async () => {
    if (!log) return;
    await db.workoutLogs.put(log);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <div className="flex gap-1">
          {WORKOUT_PRESETS.map(p => (
            <Button key={p.type} variant={selectedPreset === p.type ? 'default' : 'outline'} size="sm" onClick={() => applyPreset(p.type)}>
              {p.type === 'push' ? '推' : p.type === 'pull' ? '拉' : p.type === 'legs' ? '腿' : '休'}
            </Button>
          ))}
        </div>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      {log && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {WORKOUT_PRESETS.find(p => p.type === log.type)?.name || '自定义训练'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {log.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="border rounded-lg p-3">
                <p className="font-medium mb-2">{ex.name}</p>
                <div className="space-y-2">
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-8">组{setIdx + 1}</span>
                      <Input type="number" placeholder="重量(kg)" className="w-24 h-8" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)} />
                      <span className="text-sm">kg</span>
                      <Input type="number" placeholder="次数" className="w-20 h-8" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)} />
                      <span className="text-sm">次</span>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addSet(exIdx)}>+ 加一组</Button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">训练时长:</span>
              <Input type="number" className="w-20 h-8" value={log.duration} onChange={e => setLog({ ...log, duration: parseInt(e.target.value) || 0 })} />
              <span className="text-sm">分钟</span>
            </div>
            <div>
              <span className="text-sm font-medium">备注:</span>
              <Input value={log.notes} onChange={e => setLog({ ...log, notes: e.target.value })} placeholder="感受、强度、下次调整..." />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
