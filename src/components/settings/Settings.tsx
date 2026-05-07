import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { exportAllData, importAllData, clearAllData, getOrCreateProfile, updateProfile } from '../../lib/db';
import type { Profile } from '../../lib/db';
import dayjs from 'dayjs';
import { Moon, Sun, Download, Upload, Trash2, User } from 'lucide-react';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getOrCreateProfile().then(setProfile);
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    await updateProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('study-tracker-dark-mode', String(next));
  };

  const exportData = async () => {
    const data = await exportAllData();
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
      await importAllData(data);
      alert('✅ 数据导入成功');
    } catch {
      alert('❌ 导入失败，文件格式不正确');
    }
    e.target.value = '';
  };

  const clearAll = async () => {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) return;
    await clearAllData();
    window.location.reload();
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Profile Settings */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <User className="w-4 h-4" /> 个人档案
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">身高 (cm)</label>
                <Input type="number" value={profile.height || ''} onChange={e => setProfile({ ...profile, height: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">当前体重 (kg)</label>
                <Input type="number" step="0.1" value={profile.weight || ''} onChange={e => setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">年龄</label>
                <Input type="number" value={profile.age || ''} onChange={e => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">性别</label>
                <select value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value as any })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">目标体重 (kg)</label>
                <Input type="number" step="0.1" value={profile.targetWeight || ''} onChange={e => setProfile({ ...profile, targetWeight: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">目标体脂 (%)</label>
                <Input type="number" step="0.1" value={profile.targetBodyFat || ''} onChange={e => setProfile({ ...profile, targetBodyFat: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          )}
          <Button onClick={saveProfile}>{saved ? '✅ 已保存' : '💾 保存档案'}</Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} 外观设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">深色模式</p>
              <p className="text-xs text-muted-foreground">减少屏幕蓝光，保护眼睛</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-primary' : 'bg-muted'}`}
              role="switch"
              aria-checked={darkMode}
              aria-label="切换深色模式"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg">数据管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>数据存储在 <strong>Supabase 云端</strong>，更换设备不会丢失。</p>
            <p className="text-amber-600 dark:text-amber-400">⚠️ 建议每月导出备份到本地。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              <Download className="w-4 h-4 mr-1" /> 导出备份
            </Button>
            <label className="inline-flex cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={importData} />
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                <Upload className="w-4 h-4" /> 导入数据
              </span>
            </label>
          </div>
          <div className="pt-2 border-t">
            <Button variant="destructive" size="sm" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-1" /> 清空所有数据
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}