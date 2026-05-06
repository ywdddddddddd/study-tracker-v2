import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { WORKOUT_PRESETS, GYM_SCHEDULE } from '../../data/presets';
import { getOrCreateProfile, getWorkoutLog, saveWorkoutLog } from '../../lib/db';
import type { WorkoutLog, ExerciseLog } from '../../types';
import dayjs from 'dayjs';
import { ChevronDown, ChevronUp, X, Plus, Flame } from 'lucide-react';

function calculateBurn(log: WorkoutLog, weightKg: number): number {
  let cardioTotal = 0;

  // Calculate cardio burn from each cardio exercise
  for (const ex of log.exercises) {
    if (ex.kind === 'cardio' && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      // Treadmill MET formula from ACSM Compendium of Physical Activities
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      cardioTotal += mets * weightKg * (duration / 60);
    }
  }

  // Calculate strength burn: total duration minus cardio duration
  const cardioDuration = log.exercises
    .filter(e => e.kind === 'cardio')
    .reduce((sum, e) => sum + (e.cardioParams?.duration || 0), 0);
  const strengthDuration = Math.max(0, (log.duration || 0) - cardioDuration);

  // Literature-based: 4.5 METs for resistance training (moderate effort with rest periods)
  const strengthTotal = strengthDuration > 0
    ? 4.5 * weightKg * (strengthDuration / 60)
    : 0;

  return Math.round(cardioTotal + strengthTotal);
}

function getCardioDuration(log: WorkoutLog): number {
  return log.exercises
    .filter(e => e.kind === 'cardio')
    .reduce((sum, e) => sum + (e.cardioParams?.duration || 0), 0);
}

function getStrengthDuration(log: WorkoutLog): number {
  const cardio = getCardioDuration(log);
  return Math.max(0, (log.duration || 0) - cardio);
}

export default function FitnessPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('push');
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [weight, setWeight] = useState(84);
  const [showSchedule, setShowSchedule] = useState(false);
  // Editable gym schedule with localStorage persistence
  const GYM_KEY = 'gym-schedule-custom';
  const [gymSchedule, setGymSchedule] = useState(() => {
    try {
      const stored = localStorage.getItem(GYM_KEY);
      const overrides: Record<string, string> = stored ? JSON.parse(stored) : {};
      return GYM_SCHEDULE.map(s => ({ ...s, gym: overrides[s.date] || s.gym }));
    } catch { return [...GYM_SCHEDULE]; }
  });
  const [editingGym, setEditingGym] = useState<string | null>(null);

  const changeGym = (d: string, newGym: string) => {
    setGymSchedule(prev => prev.map(s => s.date === d ? { ...s, gym: newGym } : s));
    setEditingGym(null);
    // Save override to localStorage
    try {
      const stored = localStorage.getItem(GYM_KEY);
      const overrides: Record<string, string> = stored ? JSON.parse(stored) : {};
      overrides[d] = newGym;
      localStorage.setItem(GYM_KEY, JSON.stringify(overrides));
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, [date]);

  async function loadData() {
    const profile = await getOrCreateProfile();
    setWeight(profile.weight);
    const existing = await getWorkoutLog(date);
    if (existing) {
      setLog(existing);
      setSelectedPreset(existing.type);
    } else {
      applyPreset(selectedPreset, false);
    }
  }

  const applyPreset = (type: string, saveToState = true) => {
    setSelectedPreset(type);
    const preset = WORKOUT_PRESETS.find(p => p.type === type);
    const newLog: WorkoutLog = {
      date,
      type: type as any,
      exercises: preset?.exercises.map(e => ({
        name: e.name,
        kind: e.kind,
        sets: e.kind === 'strength' ? Array(e.sets).fill({ reps: 0, weight: 0 }) : [],
        cardioParams: e.kind === 'cardio' ? (e.cardioParams || { speed: 8, incline: 1, duration: 20 }) : undefined,
      })) || [],
      duration: 60,
      notes: '',
    };
    if (saveToState) setLog(newLog);
    else setLog(newLog);
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], name };
    setLog({ ...log, exercises });
  };

  const toggleKind = (exIdx: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    const ex = exercises[exIdx];
    const newKind = ex.kind === 'strength' ? 'cardio' : 'strength';
    exercises[exIdx] = {
      ...ex,
      kind: newKind,
      sets: newKind === 'strength' ? [{ reps: 0, weight: 0 }] : [],
      cardioParams: newKind === 'cardio' ? { speed: 8, incline: 1, duration: 20 } : undefined,
    };
    setLog({ ...log, exercises });
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight', val: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], sets: [...exercises[exIdx].sets] };
    exercises[exIdx].sets[setIdx] = { ...exercises[exIdx].sets[setIdx], [field]: val };
    setLog({ ...log, exercises });
  };

  const updateCardioParam = (exIdx: number, field: 'speed' | 'incline' | 'duration', val: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], cardioParams: { ...exercises[exIdx].cardioParams, [field]: val } };
    setLog({ ...log, exercises });
  };

  const addSet = (exIdx: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], sets: [...exercises[exIdx].sets, { reps: 0, weight: 0 }] };
    setLog({ ...log, exercises });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    if (!log) return;
    const exercises = [...log.exercises];
    exercises[exIdx] = { ...exercises[exIdx], sets: exercises[exIdx].sets.filter((_, i) => i !== setIdx) };
    setLog({ ...log, exercises });
  };

  const addExercise = () => {
    if (!log) return;
    const newEx: ExerciseLog = { name: '新动作', kind: 'strength', sets: [{ reps: 0, weight: 0 }] };
    setLog({ ...log, exercises: [...log.exercises, newEx] });
  };

  const removeExercise = (exIdx: number) => {
    if (!log) return;
    setLog({ ...log, exercises: log.exercises.filter((_, i) => i !== exIdx) });
  };

  const save = async () => {
    if (!log) return;
    await saveWorkoutLog(log);
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
        <Button variant="outline" size="sm" onClick={() => setShowSchedule(!showSchedule)}>
          📅 {showSchedule ? '隐藏日程' : '健身日程'}
        </Button>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      {/* Fitness Macro Schedule List */}
      {showSchedule && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">健身日程 (4周)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-1 text-xs">
              {gymSchedule.map(s => {
                const isToday = s.date === dayjs().format('YYYY-MM-DD');
                return (
                  <div
                    key={s.date}
                    className={`p-2 rounded-md text-center border transition-colors cursor-pointer ${
                      isToday ? 'border-primary bg-primary/10 font-semibold' :
                      s.gym === '休' ? 'border-gray-200 bg-gray-50' :
                      'border-blue-200 bg-blue-50/50 hover:bg-blue-100'
                    }`}
                  >
                    <div className="text-[10px]" onClick={() => { setDate(s.date); setShowSchedule(false); }}>{s.weekday}</div>
                    <div className="text-[11px] font-medium" onClick={() => { setDate(s.date); setShowSchedule(false); }}>{s.date.slice(5)}</div>
                    {editingGym === s.date ? (
                      <select
                        value={s.gym}
                        onChange={e => changeGym(s.date, e.target.value)}
                        onBlur={() => setEditingGym(null)}
                        autoFocus
                        className="text-xs mt-0.5 px-1 py-0.5 rounded w-full border bg-background"
                      >
                        <option value="推">推</option>
                        <option value="拉">拉</option>
                        <option value="腿">腿</option>
                        <option value="休">休</option>
                      </select>
                    ) : (
                      <div
                        onClick={e => { e.stopPropagation(); setEditingGym(s.date); }}
                        className={`text-xs mt-0.5 px-1 rounded cursor-pointer hover:ring-1 hover:ring-primary ${
                          s.gym === '推' ? 'bg-red-100 text-red-700' :
                          s.gym === '拉' ? 'bg-blue-100 text-blue-700' :
                          s.gym === '腿' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.gym}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {log && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{WORKOUT_PRESETS.find(p => p.type === log.type)?.name || '自定义训练'}</span>
              <span className="text-sm font-normal text-orange-600 flex items-center gap-1">
                <Flame className="w-4 h-4" /> 预计消耗 {calculateBurn(log, weight)} kcal
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {log.exercises.map((ex, exIdx) => {
              const isCollapsed = collapsed[exIdx];
              return (
                <div key={exIdx} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted">
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={ex.name}
                        onChange={e => updateExerciseName(exIdx, e.target.value)}
                        className="h-8 font-medium bg-transparent border-0 px-0 focus-visible:ring-0"
                      />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ex.kind === 'strength' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ex.kind === 'strength' ? '力量' : '有氧'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`将「${ex.name}」切换为${ex.kind === 'strength' ? '有氧' : '力量'}类型？`)) {
                            toggleKind(exIdx);
                          }
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                        title="切换训练类型"
                      >
                        切换
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCollapsed(c => ({ ...c, [exIdx]: !c[exIdx] }))}>
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeExercise(exIdx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-3 space-y-2">
                      {ex.kind === 'strength' ? (
                        <>
                          {ex.sets.map((set, setIdx) => (
                            <div key={setIdx} className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-8">组{setIdx + 1}</span>
                              <Input type="number" placeholder="重量(kg)" className="w-24 h-8" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)} />
                              <span className="text-sm">kg</span>
                              <Input type="number" placeholder="次数" className="w-20 h-8" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)} />
                              <span className="text-sm">次</span>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeSet(exIdx, setIdx)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => addSet(exIdx)}>
                            <Plus className="w-3 h-3 mr-1" /> 加一组
                          </Button>
                        </>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">速度 (km/h)</label>
                            <Input type="number" step="0.1" value={ex.cardioParams?.speed || ''} onChange={e => updateCardioParam(exIdx, 'speed', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">坡度 (%)</label>
                            <Input type="number" value={ex.cardioParams?.incline || ''} onChange={e => updateCardioParam(exIdx, 'incline', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">时长 (min)</label>
                            <Input type="number" value={ex.cardioParams?.duration || ''} onChange={e => updateCardioParam(exIdx, 'duration', parseInt(e.target.value) || 0)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <Button variant="outline" onClick={addExercise} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> 添加动作
            </Button>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-muted-foreground text-xs">有氧时长</div>
                <div className="font-semibold text-orange-600">{getCardioDuration(log)} min</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-muted-foreground text-xs">无氧时长</div>
                <div className="font-semibold text-blue-600">{getStrengthDuration(log)} min</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">总时长:</span>
                <Input type="number" className="w-16 h-8" value={log.duration} onChange={e => setLog({ ...log, duration: parseInt(e.target.value) || 0 })} />
                <span className="text-sm">min</span>
              </div>
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
