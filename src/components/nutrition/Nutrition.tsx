import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { FOOD_DATABASE } from '../../data/presets';
import { type FoodEntry, getOrCreateProfile, calculateMacros, getFoodEntries, addFoodEntry, deleteFoodEntry, getCustomFoods, saveCustomFood, deleteCustomFood, getFoodEntriesInRange } from '../../lib/db';
import dayjs from 'dayjs';

export default function NutritionPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState({ calories: 1900, protein: 154, carbs: 156, fat: 63 });
  const [newEntry, setNewEntry] = useState({ meal: 'breakfast' as const, name: '', weight: 100, calories: 0, protein: 0, carbs: 0, fat: 0, isCustom: false });
  const [selectedFood, setSelectedFood] = useState('');
  const [customFoods, setCustomFoods] = useState<{ name: string; unit: string; gramsPerUnit: number; calories: number; protein: number; carbs: number; fat: number; category: string }[]>([]);
  const [foodEditorOpen, setFoodEditorOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<{ name: string; unit: string; gramsPerUnit: number; calories: number; protein: number; carbs: number; fat: number; category: string } | null>(null);
  // Schedule view
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState<{ date: string; actual: number; target: number }[]>([]);

  useEffect(() => { loadData(); }, [date]);
  useEffect(() => { loadCustomFoods(); }, []);

  async function loadData() {
    const data = await getFoodEntries(date);
    setEntries(data);
    const profile = await getOrCreateProfile();
    const macros = calculateMacros(profile);
    setTargets(macros);
  }

  async function loadCustomFoods() {
    const cf = await getCustomFoods();
    setCustomFoods(cf);
  }

  async function loadSchedule() {
    const profile = await getOrCreateProfile();
    const macros = calculateMacros(profile);
    const target = macros.calories;
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    const entries = await getFoodEntriesInRange(start, end);
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.date] = (map[e.date] || 0) + e.calories;
    }
    const days: { date: string; actual: number; target: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      days.push({ date: d, actual: map[d] || 0, target });
    }
    setScheduleData(days);
  }

  useEffect(() => {
    if (showSchedule) loadSchedule();
  }, [showSchedule]);

  const allFoods: { name: string; unit: string; gramsPerUnit: number; calories: number; protein: number; carbs: number; fat: number; category: string }[] = [...FOOD_DATABASE];
  // Merge custom foods, overriding built-in by name
  const customNames = new Set(customFoods.map(f => f.name));
  for (const cf of customFoods) {
    const idx = allFoods.findIndex(f => f.name === cf.name);
    if (idx >= 0) allFoods[idx] = cf;
    else allFoods.push(cf);
  }
  // Sort by usage frequency (desc), then by name (asc)
  const usage = getFoodUsage();
  allFoods.sort((a, b) => {
    const usageA = usage[a.name] || 0;
    const usageB = usage[b.name] || 0;
    if (usageB !== usageA) return usageB - usageA;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const addEntry = async () => {
    const entry: FoodEntry = {
      date,
      meal: newEntry.meal,
      name: newEntry.name,
      weight: newEntry.weight,
      calories: newEntry.calories,
      protein: newEntry.protein,
      carbs: newEntry.carbs,
      fat: newEntry.fat,
      isCustom: newEntry.isCustom,
    };
    await addFoodEntry(entry);
    // Track food usage for sorting
    if (newEntry.name) {
      incrementFoodUsage(newEntry.name);
    }
    await loadData();
    setNewEntry({ meal: newEntry.meal, name: '', weight: 100, calories: 0, protein: 0, carbs: 0, fat: 0, isCustom: false });
    setSelectedFood('');
  };

  const removeEntry = async (id: number) => {
    await deleteFoodEntry(id);
    await loadData();
  };

  const selectPresetFood = (name: string) => {
    const food = allFoods.find(f => f.name === name);
    if (!food) return;
    setSelectedFood(name);
    const ratio = newEntry.weight / food.gramsPerUnit;
    setNewEntry({
      ...newEntry,
      name: food.name,
      calories: Math.round(food.calories * ratio),
      protein: Math.round(food.protein * ratio * 10) / 10,
      carbs: Math.round(food.carbs * ratio * 10) / 10,
      fat: Math.round(food.fat * ratio * 10) / 10,
      isCustom: false,
    });
  };

  const updateWeight = (w: number) => {
    const food = allFoods.find(f => f.name === selectedFood);
    if (!food) {
      setNewEntry({ ...newEntry, weight: w });
      return;
    }
    const ratio = w / food.gramsPerUnit;
    setNewEntry({
      ...newEntry,
      weight: w,
      calories: Math.round(food.calories * ratio),
      protein: Math.round(food.protein * ratio * 10) / 10,
      carbs: Math.round(food.carbs * ratio * 10) / 10,
      fat: Math.round(food.fat * ratio * 10) / 10,
    });
  };

  const saveFoodToLibrary = async () => {
    if (!editingFood) return;
    await saveCustomFood(editingFood);
    await loadCustomFoods();
    setEditingFood(null);
  };

  const removeFoodFromLibrary = async (name: string) => {
    if (!confirm(`确定从食物库删除「${name}」？`)) return;
    await deleteCustomFood(name);
    await loadCustomFoods();
  };

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + e.calories,
    protein: acc.protein + e.protein,
    carbs: acc.carbs + e.carbs,
    fat: acc.fat + e.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

const FOOD_USAGE_KEY = 'study-tracker-food-usage';

function getFoodUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FOOD_USAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function incrementFoodUsage(name: string) {
  const usage = getFoodUsage();
  usage[name] = (usage[name] || 0) + 1;
  localStorage.setItem(FOOD_USAGE_KEY, JSON.stringify(usage));
}

const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={() => setFoodEditorOpen(true)}>🍱 管理食物库</Button>
        <Button variant="outline" size="sm" onClick={() => setShowSchedule(!showSchedule)}>
          📅 {showSchedule ? '隐藏日程' : '饮食日程'}
        </Button>
      </div>

      {foodEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setFoodEditorOpen(false); setEditingFood(null); }}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">管理食物库</h3>
              <Button variant="ghost" size="sm" onClick={() => { setFoodEditorOpen(false); setEditingFood(null); }}>✕</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">自定义食物会覆盖内置同名食物。删除仅移除自定义版本。</p>

            {editingFood ? (
              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-medium">{editingFood.name ? '编辑' : '新增'}食物</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="名称" value={editingFood.name} onChange={e => setEditingFood({ ...editingFood, name: e.target.value })} />
                  <Input placeholder="单位(如: 100g, 1个)" value={editingFood.unit} onChange={e => setEditingFood({ ...editingFood, unit: e.target.value })} />
                  <Input type="number" placeholder="每单位克数" value={editingFood.gramsPerUnit || ''} onChange={e => setEditingFood({ ...editingFood, gramsPerUnit: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" placeholder="热量(每单位)" value={editingFood.calories || ''} onChange={e => setEditingFood({ ...editingFood, calories: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" placeholder="蛋白质" value={editingFood.protein || ''} onChange={e => setEditingFood({ ...editingFood, protein: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" placeholder="碳水" value={editingFood.carbs || ''} onChange={e => setEditingFood({ ...editingFood, carbs: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" placeholder="脂肪" value={editingFood.fat || ''} onChange={e => setEditingFood({ ...editingFood, fat: parseFloat(e.target.value) || 0 })} />
                  <select value={editingFood.category} onChange={e => setEditingFood({ ...editingFood, category: e.target.value as any })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="carb">碳水</option>
                    <option value="protein">蛋白质</option>
                    <option value="veg">蔬菜</option>
                    <option value="fat">脂肪</option>
                    <option value="other">其它</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveFoodToLibrary}>💾 保存</Button>
                  <Button variant="outline" onClick={() => setEditingFood(null)}>取消</Button>
                </div>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" className="mb-3" onClick={() => setEditingFood({ name: '', unit: '100g', gramsPerUnit: 100, calories: 0, protein: 0, carbs: 0, fat: 0, category: 'other' })}>+ 添加新食物</Button>
                <div className="space-y-2">
                  {allFoods.map(food => (
                    <div key={food.name} className="flex items-center justify-between text-sm border-b py-2">
                      <div className="flex-1">
                        <span className="font-medium">{food.name}</span>
                        <span className="text-muted-foreground ml-2">{food.unit} | {food.calories}kcal | P:{food.protein} C:{food.carbs} F:{food.fat}</span>
                        {customNames.has(food.name) && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">自定义</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingFood({ ...food })}>编辑</Button>
                        {customNames.has(food.name) && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeFoodFromLibrary(food.name)}>删除</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">今日摄入概览</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1"><span>热量</span><span>{totals.calories} / {targets.calories} kcal</span></div>
            <Progress value={totals.calories} max={targets.calories} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span>蛋白质</span><span>{totals.protein.toFixed(1)} / {targets.protein}g</span></div>
              <Progress value={totals.protein} max={targets.protein} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>碳水</span><span>{totals.carbs.toFixed(1)} / {targets.carbs}g</span></div>
              <Progress value={totals.carbs} max={targets.carbs} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>脂肪</span><span>{totals.fat.toFixed(1)} / {targets.fat}g</span></div>
              <Progress value={totals.fat} max={targets.fat} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">添加食物</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select value={newEntry.meal} onChange={e => setNewEntry({ ...newEntry, meal: e.target.value as any })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {meals.map(m => <option key={m} value={m}>{mealLabels[m]}</option>)}
            </select>
            <select value={selectedFood} onChange={e => selectPresetFood(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-[150px]">
              <option value="">选择食物 (或自定义)</option>
              {allFoods.map(f => <option key={f.name} value={f.name}>{f.name} ({f.unit})</option>)}
            </select>
            <Input type="number" placeholder="重量(g)" className="w-24" value={newEntry.weight || ''} onChange={e => updateWeight(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="食物名称" value={newEntry.name} onChange={e => setNewEntry({ ...newEntry, name: e.target.value, isCustom: true })} className="flex-1" />
            <Input type="number" placeholder="热量" value={newEntry.calories || ''} onChange={e => setNewEntry({ ...newEntry, calories: parseFloat(e.target.value) || 0 })} className="w-20" />
            <Input type="number" placeholder="蛋白质" value={newEntry.protein || ''} onChange={e => setNewEntry({ ...newEntry, protein: parseFloat(e.target.value) || 0 })} className="w-20" />
            <Input type="number" placeholder="碳水" value={newEntry.carbs || ''} onChange={e => setNewEntry({ ...newEntry, carbs: parseFloat(e.target.value) || 0 })} className="w-20" />
            <Input type="number" placeholder="脂肪" value={newEntry.fat || ''} onChange={e => setNewEntry({ ...newEntry, fat: parseFloat(e.target.value) || 0 })} className="w-20" />
          </div>
          <Button onClick={addEntry}>+ 添加</Button>
        </CardContent>
      </Card>

      {meals.map(meal => {
        const mealEntries = entries.filter(e => e.meal === meal);
        if (mealEntries.length === 0) return null;
        return (
          <Card key={meal}>
            <CardHeader className="pb-3"><CardTitle className="text-base">{mealLabels[meal]}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mealEntries.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="flex-1">
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-muted-foreground ml-2">{entry.weight}g</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{entry.calories} kcal</span>
                    <span className="text-blue-500">P:{entry.protein}g</span>
                    <span className="text-green-500">C:{entry.carbs}g</span>
                    <span className="text-yellow-500">F:{entry.fat}g</span>
                    {entry.id && <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeEntry(entry.id!)}>✕</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Nutrition Schedule List */}
      {showSchedule && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">饮食日程 (近7天)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {scheduleData.map(d => {
                const isToday = d.date === dayjs().format('YYYY-MM-DD');
                const deficit = d.target - d.actual;
                const pct = d.target > 0 ? Math.round((d.actual / d.target) * 100) : 0;
                return (
                  <button
                    key={d.date}
                    onClick={() => { setDate(d.date); setShowSchedule(false); }}
                    className={`p-2 rounded-md text-center border transition-colors ${
                      isToday ? 'border-primary bg-primary/10 font-semibold' :
                      'border-gray-200 hover:bg-muted'
                    }`}
                  >
                    <div className="text-[10px]">{dayjs(d.date).format('ddd')}</div>
                    <div className="text-[11px] font-medium">{d.date.slice(5)}</div>
                    <div className={`text-xs mt-0.5 font-semibold ${pct <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.actual || 0}/{d.target}
                    </div>
                    <div className={`text-[10px] ${deficit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {deficit >= 0 ? `-${deficit}` : `+${-deficit}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
