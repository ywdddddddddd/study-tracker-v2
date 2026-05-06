import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import Dashboard from './components/dashboard/Dashboard';
import DailyPlanPage from './components/study/DailyPlan';
import WeeklyReviewPage from './components/study/WeeklyReview';
import FitnessPage from './components/fitness/Fitness';
import NutritionPage from './components/nutrition/Nutrition';
import AnalyticsPage from './components/analytics/Analytics';
import AIAssistant from './components/ai/AIAssistant';
import HealthPage from './components/health/Health';
import SettingsPage from './components/settings/Settings';
import { LayoutDashboard, ClipboardList, BarChart3, Dumbbell, Apple, PieChart, Bot, Heart, Settings } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-slate-900 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">考研筑基 · All in One 追踪系统</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[80px]"><LayoutDashboard className="w-4 h-4 mr-1" />概览</TabsTrigger>
            <TabsTrigger value="daily" className="flex-1 min-w-[80px]"><ClipboardList className="w-4 h-4 mr-1" />每日</TabsTrigger>
            <TabsTrigger value="weekly" className="flex-1 min-w-[80px]"><BarChart3 className="w-4 h-4 mr-1" />每周</TabsTrigger>
            <TabsTrigger value="fitness" className="flex-1 min-w-[80px]"><Dumbbell className="w-4 h-4 mr-1" />健身</TabsTrigger>
            <TabsTrigger value="nutrition" className="flex-1 min-w-[80px]"><Apple className="w-4 h-4 mr-1" />饮食</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 min-w-[80px]"><PieChart className="w-4 h-4 mr-1" />统计</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 min-w-[80px]"><Bot className="w-4 h-4 mr-1" />AI</TabsTrigger>
            <TabsTrigger value="health" className="flex-1 min-w-[80px]"><Heart className="w-4 h-4 mr-1" />健康</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[80px]"><Settings className="w-4 h-4 mr-1" />设置</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><Dashboard /></TabsContent>
          <TabsContent value="daily"><DailyPlanPage /></TabsContent>
          <TabsContent value="weekly"><WeeklyReviewPage /></TabsContent>
          <TabsContent value="fitness"><FitnessPage /></TabsContent>
          <TabsContent value="nutrition"><NutritionPage /></TabsContent>
          <TabsContent value="analytics"><AnalyticsPage /></TabsContent>
          <TabsContent value="ai"><AIAssistant /></TabsContent>
          <TabsContent value="health"><HealthPage /></TabsContent>
          <TabsContent value="settings"><SettingsPage /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
