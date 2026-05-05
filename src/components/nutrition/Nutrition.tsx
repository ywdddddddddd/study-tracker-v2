import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
// import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { FOOD_DATABASE } from '../../data/presets';
import { db, type FoodEntry, getOrCreateProfile, calculateMacros } from '../../lib/db';
import dayjs from 'dayjs';

export default function NutritionPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState({ calories: 1900, protein: 154, carbs: 156, fat: 63 });
  const [newEntry, setNewEntry] = useState({ meal: 'breakfast' as const, name: '', weight: 100, calories: 0, protein: 0, carbs: 0, fat: 0, isCustom: false });
  const [selectedFood, setSelectedFood] = useState('');

  useEffect(() => {
    loadData();
  }, [date]);

  async function loadData() {
    const data = await db.foodEntries.where('date').equals(date).toArray();
    setEntries(data);
    const profile = await getOrCreateProfile();
    const macros = calculateMacros(profile);
    setTargets(macros);
  }

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
    await db.foodEntries.add(entry);
    await loadData();
    setNewEntry({ meal: newEntry.meal, name: '', weight: 100, calories: 0, protein: 0, carbs: 0, fat: 0, isCustom: false });
    setSelectedFood('');
  };

  const removeEntry = async (id: number) => {
    await db.foodEntries.delete(id);
    await loadData();
  };

  const selectPresetFood = (name: string) => {
    const food = FOOD_DATABASE.find(f => f.name === name);
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
    const food = FOOD_DATABASE.find(f => f.name === selectedFood);
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

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + e.calories,
    protein: acc.protein + e.protein,
    carbs: acc.carbs + e.carbs,
    fat: acc.fat + e.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
      </div>

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
              {FOOD_DATABASE.map(f => <option key={f.name} value={f.name}>{f.name} ({f.unit})</option>)}
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
    </div>
  );
}
