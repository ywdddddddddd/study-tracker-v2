import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { type DailyPlan, type Task, getDailyPlan, saveDailyPlan, saveCustomSchedule, getCustomSchedules, deleteCustomSchedule } from '../../lib/db';
import { STUDY_SCHEDULE } from '../../data/presets';
import { useTimer, formatDuration } from '../../hooks/useTimer';
import dayjs from 'dayjs';
import { Play, Pause, Square, RotateCcw, ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';

const SECTIONS = [
  { key: 'english', label: '英语', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'dental', label: '专业课', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'other', label: '其它', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
] as const;

function TimerModal({ isOpen, onClose, taskName, onSave }: { isOpen: boolean; onClose: () => void; taskName: string; onSave: (minutes: number) => void }) {
  const { isRunning, isPaused, elapsedSeconds, start, pause, resume, stop, reset } = useTimer();
  const [accumulated, setAccumulated] = useState(0);

  if (!isOpen) return null;

  const handleStop = () => {
    const secs = stop();
    const mins = Math.round(secs / 60);
    setAccumulated(a => a + mins);
  };

  const handleSave = () => {
    onSave(accumulated);
    setAccumulated(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-muted-foreground">{taskName}</h3>
        <div className="text-7xl font-mono font-bold tracking-wider py-4">
          {formatDuration(elapsedSeconds)}
        </div>
        {accumulated > 0 && <div className="text-sm text-muted-foreground">本次已累计: {accumulated} 分钟</div>}
        <div className="flex justify-center gap-4">
          {!isRunning && !isPaused && (
            <Button size="lg" onClick={start} className="text-lg px-8 py-6 h-auto">
              <Play className="w-6 h-6 mr-2" /> 开始
            </Button>
          )}
          {isRunning && (
            <Button size="lg" variant="outline" onClick={pause} className="text-lg px-8 py-6 h-auto">
              <Pause className="w-6 h-6 mr-2" /> 暂停
            </Button>
          )}
          {isPaused && (
            <Button size="lg" onClick={resume} className="text-lg px-8 py-6 h-auto">
              <Play className="w-6 h-6 mr-2" /> 继续
            </Button>
          )}
          {(isRunning || isPaused) && (
            <Button size="lg" variant="secondary" onClick={handleStop} className="text-lg px-8 py-6 h-auto">
              <Square className="w-6 h-6 mr-2" /> 停止
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={reset} className="text-lg px-4 py-6 h-auto">
            <RotateCcw className="w-6 h-6" />
          </Button>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={accumulated === 0}>保存 ({accumulated}min)</Button>
        </div>
      </div>
    </div>
  );
}

const TASK_TEMPLATES_KEY = 'study-tracker-task-templates';

interface TaskTemplate {
  id: string;
  text: string;
  category: 'english' | 'dental' | 'other';
  plannedMinutes: number;
}

function getTaskTemplates(): TaskTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TASK_TEMPLATES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTaskTemplate(template: TaskTemplate) {
  try {
    const templates = getTaskTemplates();
    // Avoid duplicates by text+category
    const exists = templates.some(t => t.text === template.text && t.category === template.category);
    if (!exists) {
      templates.push(template);
      localStorage.setItem(TASK_TEMPLATES_KEY, JSON.stringify(templates));
    }
  } catch (e) {
    console.error('Failed to save task template:', e);
  }
}

function deleteTaskTemplate(id: string) {
  const templates = getTaskTemplates().filter(t => t.id !== id);
  localStorage.setItem(TASK_TEMPLATES_KEY, JSON.stringify(templates));
}

export default function DailyPlanPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ english: false, dental: false, other: false });
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerTaskIdx, setTimerTaskIdx] = useState<number>(-1);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [customSchedules, setCustomSchedules] = useState<{ date: string; weekday: string; gym: string; tasks: { text: string; category: 'english' | 'dental' | 'other' }[] }[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<{ date: string; weekday: string; gym: string; tasks: { text: string; category: 'english' | 'dental' | 'other' }[] } | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(getTaskTemplates);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerCategory, setTemplatePickerCategory] = useState<'english' | 'dental' | 'other'>('other');
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionTaskIdx, setCompletionTaskIdx] = useState<number>(-1);

  // Reload templates from localStorage whenever picker opens to prevent loss
  useEffect(() => {
    if (templatePickerOpen) {
      setTaskTemplates(getTaskTemplates());
    }
  }, [templatePickerOpen]);

  const loadCustomSchedules = useCallback(async () => {
    const cs = await getCustomSchedules();
    setCustomSchedules(cs);
  }, []);

  useEffect(() => { loadCustomSchedules(); }, [loadCustomSchedules]);

  const getEffectiveSchedule = useCallback((d: string) => {
    const custom = customSchedules.find(s => s.date === d);
    if (custom) return custom;
    return STUDY_SCHEDULE.find(s => s.date === d);
  }, [customSchedules]);

  const loadPlan = useCallback(async () => {
    const existing = await getDailyPlan(date);
    const schedule = getEffectiveSchedule(date);
    if (existing) {
      setPlan(existing);
    } else if (schedule) {
      const tasks: Task[] = schedule.tasks.map((t, i) => ({
        id: `${date}-${i}`,
        text: t.text,
        category: t.category,
        status: 'pending',
        plannedMinutes: 30,
        actualMinutes: 0,
        timerAccumulated: 0,
      }));
      setPlan({ date, tasks, conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 });
    } else {
      setPlan({ date, tasks: [], conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 });
    }
  }, [date, getEffectiveSchedule]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const updateTask = (idx: number, task: Task) => {
    if (!plan) return;
    const tasks = [...plan.tasks];
    tasks[idx] = task;
    const totalFocus = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    setPlan({ ...plan, tasks, totalFocusMinutes: totalFocus });
  };

  const save = async () => {
    if (!plan) return;
    await saveDailyPlan(plan);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTask = (category: 'english' | 'dental' | 'other', template?: TaskTemplate) => {
    if (!plan) return;
    const newTask: Task = {
      id: `${date}-${plan.tasks.length}-${Date.now()}`,
      text: template?.text || '',
      category: template?.category || category,
      status: 'pending',
      plannedMinutes: template?.plannedMinutes || 30,
      actualMinutes: 0,
      timerAccumulated: 0,
    };
    setPlan({ ...plan, tasks: [...plan.tasks, newTask] });
  };

  const saveCurrentTaskAsTemplate = (task: Task) => {
    if (!task.text.trim()) {
      alert('任务名称不能为空');
      return;
    }
    const template: TaskTemplate = {
      id: `template-${Date.now()}`,
      text: task.text,
      category: task.category,
      plannedMinutes: task.plannedMinutes || 30,
    };
    saveTaskTemplate(template);
    setTaskTemplates(getTaskTemplates());
    alert(`✅ 已保存任务模板: ${task.text}`);
  };

  const openTemplatePicker = (category: 'english' | 'dental' | 'other') => {
    setTemplatePickerCategory(category);
    setTemplatePickerOpen(true);
  };

  const removeTask = (idx: number) => {
    if (!plan) return;
    const tasks = plan.tasks.filter((_, i) => i !== idx);
    const totalFocus = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    setPlan({ ...plan, tasks, totalFocusMinutes: totalFocus });
  };

  const openTimer = (idx: number) => {
    setTimerTaskIdx(idx);
    setTimerOpen(true);
  };

  const handleTimerSave = (minutes: number) => {
    if (!plan || timerTaskIdx < 0) return;
    const task = plan.tasks[timerTaskIdx];
    updateTask(timerTaskIdx, { ...task, actualMinutes: (task.actualMinutes || 0) + minutes });
  };

  const openCompletionModal = (idx: number) => {
    setCompletionTaskIdx(idx);
    setCompletionModalOpen(true);
  };

  const handleCompletionSave = (rate: number, reason: string) => {
    if (!plan || completionTaskIdx < 0) return;
    const task = plan.tasks[completionTaskIdx];
    updateTask(completionTaskIdx, { ...task, completionRate: rate, reason, status: 'completed' });
    setCompletionModalOpen(false);
  };

  const doneCount = plan?.tasks.filter(t => t.status === 'completed').length || 0;
  const totalCount = plan?.tasks.length || 0;

  const getTasksByCategory = (cat: string) => plan?.tasks.filter((_, i) => plan.tasks[i].category === cat) || [];
  const getTaskIndex = (cat: string, idxInCat: number) => {
    let count = 0;
    for (let i = 0; i < (plan?.tasks.length || 0); i++) {
      if (plan!.tasks[i].category === cat) {
        if (count === idxInCat) return i;
        count++;
      }
    }
    return -1;
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setDate(d => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD'))}><ChevronLeft className="w-4 h-4" /></Button>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}>今天</Button>
        <Button variant="outline" size="sm" onClick={() => setDate(d => dayjs(d).add(1, 'day').format('YYYY-MM-DD'))}><ChevronRight className="w-4 h-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { setEditingSchedule(null); setScheduleEditorOpen(true); }}>📅 编辑计划库</Button>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      {scheduleEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setScheduleEditorOpen(false); setEditingSchedule(null); }}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">管理学习计划预设</h3>
              <Button variant="ghost" size="sm" onClick={() => { setScheduleEditorOpen(false); setEditingSchedule(null); }}>✕</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">自定义计划会覆盖内置同名日期计划。</p>

            {editingSchedule ? (
              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-medium">编辑 {editingSchedule.date} ({editingSchedule.weekday})</h4>
                <div className="flex gap-2">
                  <select value={editingSchedule.gym} onChange={e => setEditingSchedule({ ...editingSchedule, gym: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="推">推</option>
                    <option value="拉">拉</option>
                    <option value="腿">腿</option>
                    <option value="休">休</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {editingSchedule.tasks.map((t, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input value={t.text} onChange={e => {
                        const tasks = [...editingSchedule.tasks];
                        tasks[i] = { ...tasks[i], text: e.target.value };
                        setEditingSchedule({ ...editingSchedule, tasks });
                      }} className="flex-1" />
                      <select value={t.category} onChange={e => {
                        const tasks = [...editingSchedule.tasks];
                        tasks[i] = { ...tasks[i], category: e.target.value as any };
                        setEditingSchedule({ ...editingSchedule, tasks });
                      }} className="h-10 rounded-md border border-input bg-background px-2 text-sm w-24">
                        <option value="english">英语</option>
                        <option value="dental">专业课</option>
                        <option value="other">其它</option>
                      </select>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => {
                        const tasks = editingSchedule.tasks.filter((_, idx) => idx !== i);
                        setEditingSchedule({ ...editingSchedule, tasks });
                      }}>✕</Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingSchedule({ ...editingSchedule, tasks: [...editingSchedule.tasks, { text: '', category: 'other' }] })}>+ 添加任务</Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setTemplatePickerCategory('other');
                      setTemplatePickerOpen(true);
                    }}>📋 从模板添加</Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={async () => { await saveCustomSchedule(editingSchedule); await loadCustomSchedules(); setEditingSchedule(null); }}>💾 保存</Button>
                  <Button variant="outline" onClick={() => setEditingSchedule(null)}>取消</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {STUDY_SCHEDULE.map(s => {
                  const isCustom = customSchedules.some(cs => cs.date === s.date);
                  return (
                    <div key={s.date} className="flex items-center justify-between text-sm border-b py-2">
                      <div className="flex-1">
                        <span className="font-medium">{s.date} ({s.weekday})</span>
                        <span className="text-muted-foreground ml-2">健身: {s.gym} | {s.tasks.length}项任务</span>
                        {isCustom && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">已自定义</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                          const custom = customSchedules.find(cs => cs.date === s.date);
                          setEditingSchedule(custom ? { ...custom } : { ...s });
                        }}>编辑</Button>
                        {isCustom && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={async () => {
                            if (!confirm(`确定恢复 ${s.date} 为默认计划？`)) return;
                            await deleteCustomSchedule(s.date);
                            await loadCustomSchedules();
                          }}>恢复默认</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            每日结果计划表
            <span className="text-sm font-normal text-muted-foreground">{doneCount}/{totalCount} 完成</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={doneCount} max={totalCount || 1} />

          {SECTIONS.map(section => {
            const tasks = getTasksByCategory(section.key);
            const isCollapsed = collapsed[section.key];
            return (
              <div key={section.key} className={`border rounded-lg ${section.border}`}>
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [section.key]: !c[section.key] }))}
                  className={`w-full flex items-center justify-between p-3 ${section.bg} rounded-t-lg`}
                >
                  <span className={`font-semibold ${section.color}`}>{section.label} ({tasks.length})</span>
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                  {!isCollapsed && (
                    <div className="p-3 space-y-3">
                      {tasks.map((task, idxInCat) => {
                        const globalIdx = getTaskIndex(section.key, idxInCat);
                        return (
                          <div key={globalIdx} className="border rounded-lg p-3 space-y-2 bg-white">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={task.status === 'completed'}
                                onChange={e => {
                                  if (e.target.checked) {
                                    openCompletionModal(globalIdx);
                                  } else {
                                    updateTask(globalIdx, { ...task, status: 'pending', completionRate: undefined });
                                  }
                                }}
                                className="mt-2 w-4 h-4 md:w-5 md:h-5 accent-primary shrink-0"
                              />
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={task.text}
                                  onChange={e => updateTask(globalIdx, { ...task, text: e.target.value })}
                                  placeholder={`${section.label}任务`}
                                  className={task.status === 'completed' ? 'line-through opacity-60' : ''}
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <select
                                    value={task.status}
                                    onChange={e => {
                                      const newStatus = e.target.value as Task['status'];
                                      if (newStatus === 'completed') {
                                        openCompletionModal(globalIdx);
                                      } else {
                                        updateTask(globalIdx, { ...task, status: newStatus });
                                      }
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                  >
                                    <option value="pending">⬜ 待做</option>
                                    <option value="doing">🔥 进行中</option>
                                    <option value="completed">✅ 完成</option>
                                    <option value="failed">❌ 未完成</option>
                                  </select>
                                  <Button variant="ghost" size="sm" onClick={() => openTimer(globalIdx)}>
                                    <Clock className="w-4 h-4 mr-1" /> 计时
                                  </Button>
                                  <Input
                                    type="number"
                                    placeholder="耗时(min)"
                                    className="w-24 h-9 text-sm"
                                    value={task.actualMinutes ?? ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateTask(globalIdx, { ...task, actualMinutes: val === '' ? 0 : parseInt(val) || 0 });
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="预计(min)"
                                    className="w-20 h-9 text-sm"
                                    value={task.plannedMinutes ?? ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateTask(globalIdx, { ...task, plannedMinutes: val === '' ? 30 : parseInt(val) || 30 });
                                    }}
                                  />
                                  {task.completionRate !== undefined && (
                                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                                      完成度 {task.completionRate}%
                                    </span>
                                  )}
                                  {task.reason && (
                                    <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 truncate max-w-[100px]" title={task.reason}>
                                      {task.reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => removeTask(globalIdx)}>
                                  <X className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" title="保存为模板" onClick={() => saveCurrentTaskAsTemplate(task)}>
                                  💾
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => addTask(section.key)} className="flex-1">
                          + 添加{section.label}任务
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openTemplatePicker(section.key)} className="flex-1">
                          📋 从模板添加
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}

          <Textarea
            placeholder="完成✅+耗时 & 未完成❌+耗时+原因"
            value={plan?.completion || ''}
            onChange={e => plan && setPlan({ ...plan, completion: e.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">今日战果复盘</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">攻克（今天具体学会了什么？）</label>
            <Textarea value={plan?.conquered || ''} onChange={e => plan && setPlan({ ...plan, conquered: e.target.value })} placeholder="具体、可检验的成果" />
          </div>
          <div>
            <label className="text-sm font-medium">难点（哪个知识点卡住了？）</label>
            <Textarea value={plan?.difficulty || ''} onChange={e => plan && setPlan({ ...plan, difficulty: e.target.value })} placeholder="卡住的点 + 卡了多久" />
          </div>
          <div>
            <label className="text-sm font-medium">调整（明天减少/增加任务量，还是改变方法？）</label>
            <Textarea value={plan?.adjust || ''} onChange={e => plan && setPlan({ ...plan, adjust: e.target.value })} placeholder="具体的调整方案" />
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        今日总专注时长: <span className="font-semibold text-foreground">{plan?.totalFocusMinutes || 0} 分钟</span>
      </div>

      {/* Task Template Picker Modal */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTemplatePickerOpen(false)}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">选择任务模板 ({SECTIONS.find(s => s.key === templatePickerCategory)?.label})</h3>
            {taskTemplates.filter(t => t.category === templatePickerCategory).length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无模板，先创建一个任务并点击 💾 保存为模板</p>
            ) : (
              <div className="space-y-2 mb-4">
                {taskTemplates.filter(t => t.category === templatePickerCategory).map(template => (
                  <div key={template.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{template.text}</div>
                      <div className="text-xs text-muted-foreground">预计 {template.plannedMinutes} 分钟</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => {
                        if (editingSchedule) {
                          setEditingSchedule({ ...editingSchedule, tasks: [...editingSchedule.tasks, { text: template.text, category: template.category }] });
                        } else {
                          addTask(templatePickerCategory, template);
                        }
                        setTemplatePickerOpen(false);
                      }}>添加</Button>
                      <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => { deleteTaskTemplate(template.id); setTaskTemplates(getTaskTemplates()); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setTemplatePickerOpen(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Rate Modal */}
      {completionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCompletionModalOpen(false)}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">任务完成度</h3>
            {completionTaskIdx >= 0 && plan && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">任务: {plan.tasks[completionTaskIdx].text}</p>
                <div>
                  <label className="text-sm font-medium">完成度 (%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue={plan.tasks[completionTaskIdx].completionRate ?? 100}
                    className="w-full mt-1"
                    id="completion-rate"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">原因/备注 (可选)</label>
                  <input
                    type="text"
                    placeholder="为什么不是100%？或者完成的感受..."
                    className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    id="completion-reason"
                    defaultValue={plan.tasks[completionTaskIdx].reason || ''}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCompletionModalOpen(false)}>取消</Button>
                  <Button onClick={() => {
                    const rateInput = document.getElementById('completion-rate') as HTMLInputElement;
                    const reasonInput = document.getElementById('completion-reason') as HTMLInputElement;
                    handleCompletionSave(parseInt(rateInput?.value || '100'), reasonInput?.value || '');
                  }}>确认完成</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <TimerModal
        isOpen={timerOpen}
        onClose={() => setTimerOpen(false)}
        taskName={timerTaskIdx >= 0 ? plan?.tasks[timerTaskIdx]?.text || '任务' : '任务'}
        onSave={handleTimerSave}
      />
    </div>
  );
}
