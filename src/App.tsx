import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { TabGuardContext } from './hooks/useTabGuard';
import { LayoutDashboard, ClipboardList, BarChart3, Dumbbell, Apple, PieChart, Bot, Heart, Settings, Moon, Sun } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('study-tracker-dark-mode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('study-tracker-dark-mode', String(darkMode));
  }, [darkMode]);

  // Save-before-leave registry
  const saveFnsRef = useRef<Record<string, () => Promise<void>>>({});

  const registerSave = useCallback((tab: string, saveFn: () => Promise<void>) => {
    saveFnsRef.current[tab] = saveFn;
  }, []);

  const unregisterSave = useCallback((tab: string) => {
    delete saveFnsRef.current[tab];
  }, []);

  const saveBeforeLeave = useCallback(async (tab: string) => {
    const fn = saveFnsRef.current[tab];
    if (fn) await fn();
  }, []);

  const tabGuardValue = useMemo(() => ({ registerSave, unregisterSave, saveBeforeLeave }), [registerSave, unregisterSave, saveBeforeLeave]);

  const handleTabChange = useCallback(async (tab: string) => {
    if (isSaving) return;
    const saveFn = saveFnsRef.current[activeTab];
    setIsSaving(true);
    try {
      if (saveFn) await saveFn();
    } catch { /* allow navigation even if save fails */ }
    setActiveTab(tab);
    setIsSaving(false);
  }, [activeTab, isSaving]);

  const handleMobileNav = useCallback(async (tab: string) => {
    if (isSaving || tab === activeTab) return;
    // CRITICAL: capture save function BEFORE any state change
    // On mobile, setIsSaving triggers unmount of old component -> unregisters save
    const saveFn = saveFnsRef.current[activeTab];
    setIsSaving(true);
    try {
      if (saveFn) await saveFn();
    } catch { /* allow navigation */ }
    setActiveTab(tab);
    setIsSaving(false);
  }, [activeTab, isSaving]);

  const tabs = [
    { value: 'dashboard', label: '概览', icon: LayoutDashboard },
    { value: 'daily', label: '每日', icon: ClipboardList },
    { value: 'weekly', label: '每周', icon: BarChart3 },
    { value: 'fitness', label: '健身', icon: Dumbbell },
    { value: 'nutrition', label: '饮食', icon: Apple },
    { value: 'analytics', label: '统计', icon: PieChart },
    { value: 'ai', label: 'AI', icon: Bot },
    { value: 'health', label: '健康', icon: Heart },
    { value: 'settings', label: '设置', icon: Settings },
  ];

  const renderContent = (tab: string) => {
    switch (tab) {
      case 'dashboard': return <Dashboard />;
      case 'daily': return <DailyPlanPage />;
      case 'weekly': return <WeeklyReviewPage />;
      case 'fitness': return <FitnessPage />;
      case 'nutrition': return <NutritionPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'ai': return <AIAssistant />;
      case 'health': return <HealthPage />;
      case 'settings': return <SettingsPage />;
      default: return null;
    }
  };

  return (
    <TabGuardContext.Provider value={tabGuardValue}>
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-gradient-to-r from-slate-900 to-blue-900 text-white shadow-md dark:from-slate-950 dark:to-blue-950">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">wen的日程管理 · All in One</h1>
          <div className="flex items-center gap-2">
            {isSaving && <span className="text-xs text-white/70 animate-pulse">保存中...</span>}
            <span className="text-[10px] text-white/50 hidden sm:inline">📡 Supabase 云端</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={darkMode ? '切换浅色模式' : '切换深色模式'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Desktop: scrollable horizontal tabs */}
          <nav className="hidden md:block mb-6">
            <TabsList className="w-full flex h-auto gap-1 p-1 rounded-xl bg-muted">
              {tabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>

          {/* Mobile: single content area */}
          <div className="md:hidden pb-20">
            <TabsContent value={activeTab} className="mt-0 animate-fade-in">
              {renderContent(activeTab)}
            </TabsContent>
          </div>

          {/* Desktop content */}
          <div className="hidden md:block">
            <TabsContent value="dashboard" className="animate-fade-in"><Dashboard /></TabsContent>
            <TabsContent value="daily" className="animate-fade-in"><DailyPlanPage /></TabsContent>
            <TabsContent value="weekly" className="animate-fade-in"><WeeklyReviewPage /></TabsContent>
            <TabsContent value="fitness" className="animate-fade-in"><FitnessPage /></TabsContent>
            <TabsContent value="nutrition" className="animate-fade-in"><NutritionPage /></TabsContent>
            <TabsContent value="analytics" className="animate-fade-in"><AnalyticsPage /></TabsContent>
            <TabsContent value="ai" className="animate-fade-in"><AIAssistant /></TabsContent>
            <TabsContent value="health" className="animate-fade-in"><HealthPage /></TabsContent>
            <TabsContent value="settings" className="animate-fade-in"><SettingsPage /></TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t shadow-lg dark:bg-background/95">
        <div className="grid grid-cols-5 gap-0">
          {tabs.slice(0, 5).map(tab => (
            <button
              key={tab.value}
              onClick={() => handleMobileNav(tab.value)}
              className={`flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors ${
                activeTab === tab.value
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-5 h-5 mb-0.5" />
              <span className="truncate text-[10px] leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
        {tabs.length > 5 && (
          <div className="grid grid-cols-4 gap-0 border-t">
            {tabs.slice(5).map(tab => (
              <button
                key={tab.value}
                onClick={() => handleMobileNav(tab.value)}
                className={`flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors ${
                  activeTab === tab.value
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-5 h-5 mb-0.5" />
                <span className="truncate text-[10px] leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>
    </div>
    </TabGuardContext.Provider>
  );
}

export default App;
