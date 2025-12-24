import React, { useEffect, useState } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, TrendingUp, UserX, Loader2 } from 'lucide-react';

interface StatsData {
  users: {
    total: number;
    blocked: number;
    active: number;
    new_today: number;
  };
  api: {
    requests_today: number;
    weekly_trend: { date: string; count: number }[];
  };
}

export default function AdminDashboard() {
  const { get } = useAdminApi();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      const { data, error } = await get<StatsData>('admin-stats');
      if (error) {
        setError(error);
      } else {
        setStats(data);
      }
      setIsLoading(false);
    }
    fetchStats();
  }, [get]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.users.total || 0,
      description: `${stats?.users.new_today || 0} new today`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Active Users',
      value: stats?.users.active || 0,
      description: 'Currently active',
      icon: Activity,
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    {
      title: 'Blocked Users',
      value: stats?.users.blocked || 0,
      description: 'Access restricted',
      icon: UserX,
      color: 'text-red-500',
      bg: 'bg-red-500/10'
    },
    {
      title: 'API Requests Today',
      value: stats?.api.requests_today || 0,
      description: 'Total API calls',
      icon: TrendingUp,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly API Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage (Last 7 Days)</CardTitle>
          <CardDescription>Daily request volume</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.api.weekly_trend && stats.api.weekly_trend.length > 0 ? (
            <div className="h-48 flex items-end gap-2">
              {stats.api.weekly_trend.map((day, i) => {
                const maxCount = Math.max(...stats.api.weekly_trend.map(d => d.count), 1);
                const height = (day.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-primary/20 rounded-t relative" style={{ height: `${Math.max(height, 4)}%` }}>
                      <div 
                        className="absolute bottom-0 w-full bg-primary rounded-t transition-all"
                        style={{ height: '100%' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
