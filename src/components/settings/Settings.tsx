import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { exportAllData, importAllData, clearAllData } from '../../lib/db';
import dayjs from 'dayjs';

export default function SettingsPage() {
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
    <div className="space-y-6 animate-in">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">数据可靠性说明</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>本应用数据存储在 <strong>Supabase PostgreSQL 云端数据库</strong> 中，刷新页面或更换设备不会丢失。</p>
          <p><strong>数据可靠性：</strong>Supabase 提供自动备份和 500MB 免费额度，个人使用足够。</p>
          <p><strong>可能丢失的场景：</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase 项目被删除或暂停（免费项目 90 天无活动会暂停）</li>
            <li>数据库表被手动清空</li>
            <li>网络故障导致同步失败</li>
          </ul>
          <p className="text-amber-600 font-medium">⚠️ 建议每月点击「导出备份」保存 JSON 文件到本地作为额外保险。</p>
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
